"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit, requireBot } from "@/lib/auth";
import { botToken } from "@/lib/bots";
import { send, TelegramError } from "@/lib/telegram";
import { cacheFileId, resolveMedia } from "@/lib/media-send";
import { segmentWhere, type Segment } from "@/lib/segment";
import { cancelBroadcastJob, enqueueBroadcast } from "@/lib/queue";
import type { ActionState } from "@/components/forms";

/** Formadan segment shartlarini o'qiydi. */
function readSegment(formData: FormData): Segment {
  const locales = formData.getAll("locales").map(String).filter(Boolean);
  const activeDaysRaw = String(formData.get("activeDays") ?? "");
  return {
    locales: locales.length ? locales : undefined,
    activeDays: activeDaysRaw ? Number(activeDaysRaw) : null,
    excludeBlocked: true,
    openedWebApp: formData.get("openedWebApp") === "on",
    hasPhone: formData.get("hasPhone") === "on",
    joinedAfter: String(formData.get("joinedAfter") ?? "") || null,
    joinedBefore: String(formData.get("joinedBefore") ?? "") || null,
  };
}

function readButtons(formData: FormData) {
  const raw = String(formData.get("buttons") ?? "").trim();
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.split("|").map((s) => s.trim()))
    .filter((p) => p.length === 2 && p[0] && p[1])
    .map(([label, url]) => ({ label, url }));
}

export async function countAudience(botId: string, segment: Segment): Promise<number> {
  await requireBot(botId);
  return prisma.botUser.count({ where: segmentWhere(botId, segment) });
}

export async function createBroadcast(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await requireBot(botId);

  const screenId = String(formData.get("screenId") ?? "") || null;
  const text = String(formData.get("text") ?? "").trim();
  if (!screenId && !text) {
    return { error: "Xabar matnini kiriting yoki tayyor ekranni tanlang" };
  }
  if (screenId) {
    const screen = await prisma.screen.findFirst({ where: { id: screenId, botId } });
    if (!screen) return { error: "Tanlangan ekran topilmadi" };
  }

  const scheduledRaw = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return { error: "Rejalashtirilgan vaqt noto'g'ri" };
  }
  if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) {
    return { error: "Rejalashtirilgan vaqt o'tib ketgan" };
  }

  const segment = readSegment(formData);
  const total = await prisma.botUser.count({ where: segmentWhere(botId, segment) });

  const broadcast = await prisma.broadcast.create({
    data: {
      botId,
      name: String(formData.get("name") ?? "").trim() || `Xabar ${new Date().toLocaleDateString("uz-UZ")}`,
      screenId,
      text,
      parseMode: String(formData.get("parseMode") ?? "HTML"),
      mediaType: String(formData.get("mediaType") ?? "NONE") as never,
      mediaUrl: String(formData.get("mediaUrl") ?? "").trim() || null,
      buttons: readButtons(formData) as never,
      disableNotification: formData.get("disableNotification") === "on",
      segment: segment as never,
      scheduledAt,
      totalCount: total,
      status: "DRAFT",
      createdById: user.id,
    },
  });

  await audit(user.id, "broadcast.create", "Broadcast", broadcast.id);
  redirect(`/bots/${botId}/broadcasts/${broadcast.id}`);
}

/** Faqat yuborilmagan qoralamani tahrirlash mumkin. */
export async function updateBroadcast(
  botId: string,
  broadcastId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await requireBot(botId);
  const existing = await prisma.broadcast.findFirst({
    where: { id: broadcastId, botId },
  });
  if (!existing) return { error: "Xabar topilmadi" };
  if (!["DRAFT", "PAUSED", "SCHEDULED", "FAILED"].includes(existing.status)) {
    return { error: "Yuborilgan xabarni tahrirlab bo'lmaydi" };
  }

  const screenId = String(formData.get("screenId") ?? "") || null;
  const text = String(formData.get("text") ?? "").trim();
  if (!screenId && !text) {
    return { error: "Xabar matnini kiriting yoki tayyor ekranni tanlang" };
  }

  const scheduledRaw = String(formData.get("scheduledAt") ?? "").trim();
  const scheduledAt = scheduledRaw ? new Date(scheduledRaw) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return { error: "Rejalashtirilgan vaqt noto'g'ri" };
  }

  const segment = readSegment(formData);
  const total = await prisma.botUser.count({ where: segmentWhere(botId, segment) });

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      name: String(formData.get("name") ?? existing.name).trim() || existing.name,
      screenId,
      text,
      parseMode: String(formData.get("parseMode") ?? "HTML"),
      mediaType: String(formData.get("mediaType") ?? "NONE") as never,
      mediaUrl: String(formData.get("mediaUrl") ?? "").trim() || null,
      buttons: readButtons(formData) as never,
      disableNotification: formData.get("disableNotification") === "on",
      segment: segment as never,
      scheduledAt,
      totalCount: total,
    },
  });

  await audit(user.id, "broadcast.update", "Broadcast", broadcastId);
  redirect(`/bots/${botId}/broadcasts/${broadcastId}`);
}

/** Xabarni navbatga qo'yadi. Rejalashtirilgan bo'lsa kechikish bilan. */
export async function startBroadcast(botId: string, broadcastId: string): Promise<ActionState> {
  const { user } = await requireBot(botId);
  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, botId },
  });
  if (!broadcast) return { error: "Xabar topilmadi" };
  if (["RUNNING", "DONE"].includes(broadcast.status)) {
    return { error: "Bu xabar allaqachon yuborilgan yoki yuborilmoqda" };
  }

  const delay = broadcast.scheduledAt
    ? Math.max(0, broadcast.scheduledAt.getTime() - Date.now())
    : 0;

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: delay > 0 ? "SCHEDULED" : "RUNNING" },
  });

  try {
    await enqueueBroadcast(broadcastId, delay);
  } catch (err) {
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "DRAFT" },
    });
    return {
      error:
        "Navbatga qo'shilmadi — Redis bilan bog'lanib bo'lmadi. Worker ishlayotganini tekshiring. " +
        (err instanceof Error ? err.message : ""),
    };
  }

  await audit(user.id, "broadcast.start", "Broadcast", broadcastId, { delay });
  revalidatePath(`/bots/${botId}/broadcasts/${broadcastId}`);
  return {
    ok: delay > 0 ? "Xabar rejalashtirildi" : "Yuborish boshlandi",
  };
}

export async function pauseBroadcast(botId: string, broadcastId: string) {
  await requireBot(botId);
  await prisma.broadcast.updateMany({
    where: { id: broadcastId, botId, status: { in: ["RUNNING", "SCHEDULED"] } },
    data: { status: "PAUSED" },
  });
  await cancelBroadcastJob(broadcastId).catch(() => {});
  revalidatePath(`/bots/${botId}/broadcasts/${broadcastId}`);
}

export async function cancelBroadcast(botId: string, broadcastId: string) {
  await requireBot(botId);
  await prisma.broadcast.updateMany({
    where: { id: broadcastId, botId, status: { notIn: ["DONE"] } },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  await cancelBroadcastJob(broadcastId).catch(() => {});
  revalidatePath(`/bots/${botId}/broadcasts/${broadcastId}`);
}

export async function deleteBroadcast(botId: string, broadcastId: string) {
  await requireBot(botId);
  await cancelBroadcastJob(broadcastId).catch(() => {});
  await prisma.broadcast.deleteMany({ where: { id: broadcastId, botId } });
  redirect(`/bots/${botId}/broadcasts`);
}

/** Yuborishdan oldin xabarni bitta Telegram ID'ga sinov uchun jo'natadi. */
export async function sendTest(
  botId: string,
  broadcastId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { bot } = await requireBot(botId);
  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, botId },
  });
  if (!broadcast) return { error: "Xabar topilmadi" };

  const raw = String(formData.get("chatId") ?? "").trim();
  if (!/^-?\d+$/.test(raw)) {
    return { error: "Telegram ID faqat raqamlardan iborat bo'lishi kerak" };
  }

  const buttons = Array.isArray(broadcast.buttons)
    ? (broadcast.buttons as { label: string; url: string }[])
    : [];

  const media = await resolveMedia(botId, broadcast.mediaUrl);

  try {
    const sent = await send(botToken(bot), {
      chatId: Number(raw),
      text: broadcast.text,
      parseMode: broadcast.parseMode,
      mediaType: broadcast.mediaType,
      mediaUrl: media.mediaUrl,
      mediaFile: media.mediaFile,
      replyMarkup: buttons.length
        ? { inline_keyboard: buttons.map((b) => [{ text: b.label, url: b.url }]) }
        : undefined,
    });
    await cacheFileId(media.assetId, sent.fileId);
    return { ok: "Sinov xabari yuborildi" };
  } catch (err) {
    if (err instanceof TelegramError && err.isUserGone) {
      return { error: "Bu foydalanuvchi bot bilan suhbat boshlamagan — avval botga /start yozing" };
    }
    return { error: err instanceof Error ? err.message : "Yuborilmadi" };
  }
}
