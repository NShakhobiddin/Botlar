"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit, requireBot } from "@/lib/auth";
import type { ActionState } from "../../actions";

const KEY_RE = /^[a-z0-9_]{2,40}$/;

export async function createScreen(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { bot, user } = await requireBot(botId);

  const key = String(formData.get("key") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!KEY_RE.test(key)) {
    return { error: "Kalit faqat kichik harf, raqam va _ dan iborat bo'lsin (2-40 belgi)" };
  }

  const exists = await prisma.screen.findUnique({
    where: { botId_key: { botId, key } },
  });
  if (exists) return { error: `"${key}" kaliti band` };

  const screen = await prisma.screen.create({
    data: {
      botId,
      key,
      name: name || key,
      translations: {
        create: bot.locales.map((locale) => ({
          locale,
          text: "",
          parseMode: "HTML",
        })),
      },
    },
  });

  await audit(user.id, "screen.create", "Screen", screen.id, { key });
  redirect(`/bots/${botId}/content/${screen.id}`);
}

export async function updateScreen(
  botId: string,
  screenId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { bot, user } = await requireBot(botId);
  const screen = await prisma.screen.findFirst({ where: { id: screenId, botId } });
  if (!screen) return { error: "Ekran topilmadi" };

  await prisma.screen.update({
    where: { id: screenId },
    data: {
      name: String(formData.get("name") ?? screen.name).trim() || screen.name,
      keyboardType: formData.get("keyboardType") as never,
      resizeKeyboard: formData.get("resizeKeyboard") === "on",
      oneTimeKeyboard: formData.get("oneTimeKeyboard") === "on",
      awaitsInput: formData.get("awaitsInput") === "on",
      inputField: String(formData.get("inputField") ?? "") || null,
      inputNextKey: String(formData.get("inputNextKey") ?? "") || null,
    },
  });

  for (const locale of bot.locales) {
    const text = String(formData.get(`text_${locale}`) ?? "");
    const parseMode = String(formData.get(`parseMode_${locale}`) ?? "HTML");
    const mediaType = String(formData.get(`mediaType_${locale}`) ?? "NONE");
    const mediaUrl = String(formData.get(`mediaUrl_${locale}`) ?? "").trim() || null;

    await prisma.screenTranslation.upsert({
      where: { screenId_locale: { screenId, locale } },
      create: { screenId, locale, text, parseMode, mediaType: mediaType as never, mediaUrl },
      update: { text, parseMode, mediaType: mediaType as never, mediaUrl },
    });
  }

  await audit(user.id, "screen.update", "Screen", screenId);
  revalidatePath(`/bots/${botId}/content/${screenId}`);
  return { ok: "Ekran saqlandi" };
}

export async function deleteScreen(botId: string, screenId: string) {
  const { user } = await requireBot(botId);
  const screen = await prisma.screen.findFirst({ where: { id: screenId, botId } });
  if (!screen) redirect(`/bots/${botId}/content`);
  if (screen.key === "start") throw new Error("Boshlang'ich ekranni o'chirib bo'lmaydi");

  await prisma.screen.delete({ where: { id: screenId } });
  await audit(user.id, "screen.delete", "Screen", screenId, { key: screen.key });
  redirect(`/bots/${botId}/content`);
}

// ------------------------------------------------------------------ tugmalar

export async function addButton(
  botId: string,
  screenId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { bot } = await requireBot(botId);
  const screen = await prisma.screen.findFirst({ where: { id: screenId, botId } });
  if (!screen) return { error: "Ekran topilmadi" };

  const labels: Record<string, string> = {};
  for (const locale of bot.locales) {
    const v = String(formData.get(`label_${locale}`) ?? "").trim();
    if (v) labels[locale] = v;
  }
  if (Object.keys(labels).length === 0) {
    return { error: "Kamida bitta tilda tugma matnini kiriting" };
  }

  const action = String(formData.get("action") ?? "SCREEN");
  const url = String(formData.get("url") ?? "").trim() || null;
  const targetScreenId = String(formData.get("targetScreenId") ?? "") || null;
  const webAppId = String(formData.get("webAppId") ?? "") || null;

  if (action === "SCREEN" && !targetScreenId) return { error: "Qaysi ekranga o'tishini tanlang" };
  if (action === "URL" && !url) return { error: "Havolani kiriting" };
  if (action === "WEBAPP" && !webAppId) return { error: "Web App'ni tanlang" };

  const last = await prisma.button.findFirst({
    where: { screenId },
    orderBy: [{ row: "desc" }],
  });

  await prisma.button.create({
    data: {
      screenId,
      labels: labels as never,
      action: action as never,
      url: action === "URL" ? url : null,
      targetScreenId: action === "SCREEN" ? targetScreenId : null,
      webAppId: action === "WEBAPP" ? webAppId : null,
      row: (last?.row ?? -1) + 1,
      col: 0,
    },
  });

  revalidatePath(`/bots/${botId}/content/${screenId}`);
  return { ok: "Tugma qo'shildi" };
}

export async function deleteButton(botId: string, screenId: string, buttonId: string) {
  await requireBot(botId);
  await prisma.button.deleteMany({ where: { id: buttonId, screen: { botId } } });
  revalidatePath(`/bots/${botId}/content/${screenId}`);
  redirect(`/bots/${botId}/content/${screenId}`);
}

/** Tugmani yuqoriga/pastga siljitadi. */
export async function moveButton(
  botId: string,
  screenId: string,
  buttonId: string,
  direction: "up" | "down"
) {
  await requireBot(botId);
  const buttons = await prisma.button.findMany({
    where: { screenId, screen: { botId } },
    orderBy: [{ row: "asc" }, { col: "asc" }],
  });
  const i = buttons.findIndex((b) => b.id === buttonId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= buttons.length) return;

  await prisma.$transaction([
    prisma.button.update({ where: { id: buttons[i].id }, data: { row: buttons[j].row } }),
    prisma.button.update({ where: { id: buttons[j].id }, data: { row: buttons[i].row } }),
  ]);
  revalidatePath(`/bots/${botId}/content/${screenId}`);
}

/** Tugmani yonidagi bilan bir qatorga qo'yadi yoki alohida qatorga chiqaradi. */
export async function toggleButtonRow(
  botId: string,
  screenId: string,
  buttonId: string
) {
  await requireBot(botId);
  const buttons = await prisma.button.findMany({
    where: { screenId, screen: { botId } },
    orderBy: [{ row: "asc" }, { col: "asc" }],
  });
  const i = buttons.findIndex((b) => b.id === buttonId);
  if (i <= 0) return;

  const current = buttons[i];
  const prev = buttons[i - 1];

  if (current.row === prev.row) {
    // Alohida qatorga chiqarish: keyingi hammasi bir pastga suriladi.
    await prisma.$transaction([
      ...buttons.slice(i).map((b) =>
        prisma.button.update({ where: { id: b.id }, data: { row: b.row + 1, col: 0 } })
      ),
    ]);
  } else {
    const colsInRow = buttons.filter((b) => b.row === prev.row).length;
    if (colsInRow >= 3) return; // bir qatorda 3 tadan ko'p tugma qulay emas
    await prisma.button.update({
      where: { id: current.id },
      data: { row: prev.row, col: colsInRow },
    });
  }
  revalidatePath(`/bots/${botId}/content/${screenId}`);
}

// ------------------------------------------------------------------ buyruqlar

export async function saveCommand(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireBot(botId);
  const command = String(formData.get("command") ?? "")
    .trim()
    .replace(/^\//, "")
    .toLowerCase();
  if (!/^[a-z0-9_]{1,32}$/.test(command)) {
    return { error: "Buyruq faqat kichik harf, raqam va _ dan iborat bo'lsin" };
  }

  const screenId = String(formData.get("screenId") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim();

  await prisma.botCommand.upsert({
    where: { botId_command: { botId, command } },
    create: { botId, command, description, screenId },
    update: { description, screenId },
  });

  revalidatePath(`/bots/${botId}/content`);
  return { ok: `/${command} saqlandi. Telegram menyusiga yozish uchun "Menyuni yangilash"ni bosing.` };
}

export async function deleteCommand(botId: string, command: string) {
  await requireBot(botId);
  await prisma.botCommand.deleteMany({ where: { botId, command } });
  revalidatePath(`/bots/${botId}/content`);
}

/** Ekranni tugmalari va tarjimalari bilan nusxalaydi. */
export async function duplicateScreen(botId: string, screenId: string) {
  const { user } = await requireBot(botId);
  const source = await prisma.screen.findFirst({
    where: { id: screenId, botId },
    include: { translations: true, buttons: true },
  });
  if (!source) redirect(`/bots/${botId}/content`);

  let key = `${source.key}_nusxa`;
  for (let i = 2; await prisma.screen.findUnique({ where: { botId_key: { botId, key } } }); i++) {
    key = `${source.key}_nusxa_${i}`;
  }

  const copy = await prisma.screen.create({
    data: {
      botId,
      key,
      name: `${source.name} (nusxa)`,
      keyboardType: source.keyboardType,
      resizeKeyboard: source.resizeKeyboard,
      oneTimeKeyboard: source.oneTimeKeyboard,
      awaitsInput: source.awaitsInput,
      inputField: source.inputField,
      inputNextKey: source.inputNextKey,
      translations: {
        create: source.translations.map((t) => ({
          locale: t.locale,
          text: t.text,
          parseMode: t.parseMode,
          mediaType: t.mediaType,
          mediaUrl: t.mediaUrl,
        })),
      },
      buttons: {
        create: source.buttons.map((b) => ({
          labels: b.labels as never,
          action: b.action,
          row: b.row,
          col: b.col,
          // O'ziga ishora qilgan tugmalar nusxaga emas, asl ekranga qoladi.
          targetScreenId: b.targetScreenId,
          url: b.url,
          webAppId: b.webAppId,
          commandKey: b.commandKey,
        })),
      },
    },
  });

  await audit(user.id, "screen.duplicate", "Screen", copy.id, { from: source.key });
  redirect(`/bots/${botId}/content/${copy.id}`);
}

export async function updateButton(
  botId: string,
  screenId: string,
  buttonId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { bot } = await requireBot(botId);
  const button = await prisma.button.findFirst({
    where: { id: buttonId, screen: { botId } },
  });
  if (!button) return { error: "Tugma topilmadi" };

  const labels: Record<string, string> = {};
  for (const locale of bot.locales) {
    const v = String(formData.get(`label_${locale}`) ?? "").trim();
    if (v) labels[locale] = v;
  }
  if (Object.keys(labels).length === 0) {
    return { error: "Kamida bitta tilda tugma matnini kiriting" };
  }

  const action = String(formData.get("action") ?? "SCREEN");
  const url = String(formData.get("url") ?? "").trim() || null;
  const targetScreenId = String(formData.get("targetScreenId") ?? "") || null;
  const webAppId = String(formData.get("webAppId") ?? "") || null;

  if (action === "SCREEN" && !targetScreenId) return { error: "Qaysi ekranga o'tishini tanlang" };
  if (action === "URL" && !url) return { error: "Havolani kiriting" };
  if (action === "WEBAPP" && !webAppId) return { error: "Web App'ni tanlang" };

  await prisma.button.update({
    where: { id: buttonId },
    data: {
      labels: labels as never,
      action: action as never,
      url: action === "URL" ? url : null,
      targetScreenId: action === "SCREEN" ? targetScreenId : null,
      webAppId: action === "WEBAPP" ? webAppId : null,
    },
  });

  revalidatePath(`/bots/${botId}/content/${screenId}`);
  return { ok: "Tugma yangilandi" };
}
