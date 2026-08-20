"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, requireBot, requireUser } from "@/lib/auth";
import { maskToken, randomToken, seal } from "@/lib/crypto";
import { botToken, webhookUrl } from "@/lib/bots";
import {
  deleteWebhook,
  getMe,
  getWebhookInfo,
  setMyCommands,
  setWebhook,
  TelegramError,
} from "@/lib/telegram";

export type ActionState = { error?: string; ok?: string };

const tokenSchema = z
  .string()
  .trim()
  .regex(/^\d{6,}:[A-Za-z0-9_-]{30,}$/, "Token formati noto'g'ri (masalan 123456:AA...)");

/** Yangi bot qo'shadi: tokenni tekshiradi, shifrlaydi, webhook o'rnatadi. */
export async function createBot(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role === "VIEWER") return { error: "Ko'ruvchi bot qo'sha olmaydi" };

  const parsed = tokenSchema.safeParse(formData.get("token"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const token = parsed.data;

  let me;
  try {
    me = await getMe(token);
  } catch (err) {
    return {
      error:
        err instanceof TelegramError
          ? `Telegram tokenni qabul qilmadi: ${err.message}`
          : "Telegram bilan bog'lanib bo'lmadi",
    };
  }

  const existing = await prisma.bot.findUnique({ where: { username: me.username! } });
  if (existing) return { error: `@${me.username} allaqachon qo'shilgan` };

  const sealed = seal(token);
  const secret = randomToken(24);
  const defaultLocale = String(formData.get("defaultLocale") ?? "uz");
  const locales = String(formData.get("locales") ?? "uz")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const bot = await prisma.bot.create({
    data: {
      name: String(formData.get("name") ?? "").trim() || me.first_name,
      username: me.username!,
      telegramId: BigInt(me.id),
      tokenCipher: sealed.cipher,
      tokenIv: sealed.iv,
      tokenTag: sealed.tag,
      webhookSecret: secret,
      ownerId: user.id,
      defaultLocale,
      locales: locales.length ? locales : [defaultLocale],
    },
  });

  // Har bir yangi bot ishlaydigan holatda boshlansin — /start ekrani tayyor turadi.
  await seedStarterContent(bot.id, defaultLocale, me.first_name);

  try {
    await setWebhook(token, webhookUrl(bot.id), secret);
    await prisma.bot.update({
      where: { id: bot.id },
      data: { webhookSetAt: new Date() },
    });
  } catch (err) {
    // Bot yaratildi, lekin webhook o'rnatilmadi — sozlamalar sahifasidan qayta urinish mumkin.
    console.error("[createBot] webhook", err);
  }

  await audit(user.id, "bot.create", "Bot", bot.id, {
    username: me.username,
    token: maskToken(token),
  });

  redirect(`/bots/${bot.id}`);
}

async function seedStarterContent(botId: string, locale: string, botName: string) {
  const start = await prisma.screen.create({
    data: {
      botId,
      key: "start",
      name: "Boshlang'ich ekran",
      keyboardType: "INLINE",
      isSystem: true,
      translations: {
        create: {
          locale,
          text: `Assalomu alaykum, {{name}}! 👋\n\n<b>${botName}</b> botiga xush kelibsiz.\n\nQuyidagi tugmalardan birini tanlang.`,
          parseMode: "HTML",
        },
      },
    },
  });

  const about = await prisma.screen.create({
    data: {
      botId,
      key: "about",
      name: "Biz haqimizda",
      keyboardType: "INLINE",
      translations: {
        create: {
          locale,
          text: "Bu matnni boshqaruv panelidan tahrirlashingiz mumkin.",
          parseMode: "HTML",
        },
      },
    },
  });

  await prisma.button.createMany({
    data: [
      {
        screenId: start.id,
        labels: { [locale]: "ℹ️ Biz haqimizda" },
        action: "SCREEN",
        targetScreenId: about.id,
        row: 0,
        col: 0,
      },
      {
        screenId: about.id,
        labels: { [locale]: "⬅️ Orqaga" },
        action: "BACK",
        row: 0,
        col: 0,
      },
    ],
  });

  await prisma.botCommand.create({
    data: {
      botId,
      command: "start",
      description: "Botni ishga tushirish",
      screenId: start.id,
    },
  });
}

// ------------------------------------------------------------------ webhook

export async function refreshWebhook(botId: string): Promise<ActionState> {
  const { bot, user } = await requireBot(botId);
  try {
    const token = botToken(bot);
    await setWebhook(token, webhookUrl(bot.id), bot.webhookSecret);
    await prisma.bot.update({
      where: { id: bot.id },
      data: { webhookSetAt: new Date() },
    });
    await audit(user.id, "bot.webhook.set", "Bot", bot.id);
    revalidatePath(`/bots/${botId}/settings`);
    return { ok: "Webhook o'rnatildi" };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Webhook o'rnatilmadi",
    };
  }
}

export async function webhookStatus(botId: string) {
  const { bot } = await requireBot(botId);
  try {
    return await getWebhookInfo(botToken(bot));
  } catch {
    return null;
  }
}

/** Panelda saqlangan buyruqlarni Telegram menyusiga yozadi. */
export async function syncCommands(botId: string): Promise<ActionState> {
  const { bot, user } = await requireBot(botId);
  const commands = await prisma.botCommand.findMany({
    where: { botId, isVisible: true },
    orderBy: { sortOrder: "asc" },
  });
  try {
    await setMyCommands(
      botToken(bot),
      commands.map((c) => ({
        command: c.command,
        description: c.description || c.command,
      }))
    );
    await audit(user.id, "bot.commands.sync", "Bot", botId, { count: commands.length });
    return { ok: `${commands.length} ta buyruq Telegram menyusiga yozildi` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Buyruqlar yozilmadi" };
  }
}

// ----------------------------------------------------------------- sozlamalar

export async function updateBotSettings(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { bot, user } = await requireBot(botId);

  const channelsRaw = String(formData.get("requiredChannels") ?? "").trim();
  const requiredChannels = channelsRaw
    ? channelsRaw
        .split("\n")
        .map((line) => line.split("|").map((s) => s.trim()))
        .filter((p) => p.length >= 2 && p[0])
        .map(([chatId, title, url]) => ({
          chatId,
          title: title || chatId,
          url: url || `https://t.me/${chatId.replace("@", "")}`,
        }))
    : [];

  const locales = String(formData.get("locales") ?? "uz")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await prisma.bot.update({
    where: { id: bot.id },
    data: {
      name: String(formData.get("name") ?? bot.name).trim() || bot.name,
      isActive: formData.get("isActive") === "on",
      maintenanceMode: formData.get("maintenanceMode") === "on",
      maintenanceText: String(formData.get("maintenanceText") ?? "") || null,
      defaultLocale: String(formData.get("defaultLocale") ?? bot.defaultLocale),
      locales: locales.length ? locales : bot.locales,
      requiredChannels: requiredChannels as never,
    },
  });

  await audit(user.id, "bot.update", "Bot", bot.id);
  revalidatePath(`/bots/${botId}`, "layout");
  return { ok: "Sozlamalar saqlandi" };
}

export async function deleteBot(botId: string) {
  const { bot, user } = await requireBot(botId);
  if (user.role === "VIEWER") throw new Error("Ruxsat yo'q");

  await deleteWebhook(botToken(bot)).catch(() => {});
  await prisma.bot.delete({ where: { id: bot.id } });
  await audit(user.id, "bot.delete", "Bot", bot.id, { username: bot.username });
  redirect("/bots");
}
