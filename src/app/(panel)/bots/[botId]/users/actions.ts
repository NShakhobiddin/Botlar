"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireBot } from "@/lib/auth";
import { botToken } from "@/lib/bots";
import { send, TelegramError } from "@/lib/telegram";
import type { ActionState } from "@/components/forms";

export async function toggleBan(botId: string, botUserId: string) {
  const { user } = await requireBot(botId);
  const target = await prisma.botUser.findFirst({ where: { id: botUserId, botId } });
  if (!target) return;

  await prisma.botUser.update({
    where: { id: botUserId },
    data: { isBanned: !target.isBanned },
  });
  await audit(user.id, target.isBanned ? "user.unban" : "user.ban", "BotUser", botUserId);
  revalidatePath(`/bots/${botId}/users`);
}

/** Panel orqali bitta obunachiga to'g'ridan-to'g'ri xabar yuboradi. */
export async function sendDirectMessage(
  botId: string,
  botUserId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { bot, user } = await requireBot(botId);
  const target = await prisma.botUser.findFirst({ where: { id: botUserId, botId } });
  if (!target) return { error: "Obunachi topilmadi" };

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Xabar matnini kiriting" };

  try {
    await send(botToken(bot), {
      chatId: Number(target.telegramId),
      text,
      parseMode: "HTML",
    });
  } catch (err) {
    if (err instanceof TelegramError && err.isUserGone) {
      await prisma.botUser.update({
        where: { id: botUserId },
        data: { isBlocked: true, blockedAt: new Date() },
      });
      revalidatePath(`/bots/${botId}/users/${botUserId}`);
      return { error: "Foydalanuvchi botni bloklagan — xabar yetib bormadi" };
    }
    return { error: err instanceof Error ? err.message : "Yuborilmadi" };
  }

  await audit(user.id, "user.message", "BotUser", botUserId);
  revalidatePath(`/bots/${botId}/users/${botUserId}`);
  return { ok: "Xabar yuborildi" };
}

export async function resetUserState(botId: string, botUserId: string) {
  await requireBot(botId);
  await prisma.botUser.updateMany({
    where: { id: botUserId, botId },
    data: { currentScreenKey: null, awaitingField: null, data: {} },
  });
  revalidatePath(`/bots/${botId}/users/${botUserId}`);
}
