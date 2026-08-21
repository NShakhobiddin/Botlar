/**
 * Broadcast worker — alohida jarayon.
 * Telegram limiti ~30 xabar/sek, xavfsizlik uchun 25/sek bilan yuboramiz.
 */
import { Worker, type Job } from "bullmq";

try {
  process.loadEnvFile(".env");
} catch {
  // .env yo'q — Docker env_file orqali berilgan.
}

import { prisma } from "@/lib/db";
import { botToken } from "@/lib/bots";
import { send, TelegramError } from "@/lib/telegram";
import { cacheFileId, resolveMedia } from "@/lib/media-send";
import { segmentWhere } from "@/lib/segment";
import { BROADCAST_QUEUE, redis, type BroadcastJob } from "@/lib/queue";
import { aggregateStats, pruneEvents, sweepScheduled } from "@/worker/maintenance";
import { startPoller } from "@/worker/poller";

const RATE_PER_SECOND = Number(process.env.BROADCAST_RATE ?? 25);
const BATCH = 200;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Counters = { sent: number; failed: number; blocked: number };

async function processBroadcast(job: Job<BroadcastJob>) {
  const { broadcastId } = job.data;

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: { bot: true, screen: { include: { translations: true } } },
  });
  if (!broadcast) return;
  if (!["SCHEDULED", "RUNNING", "DRAFT"].includes(broadcast.status)) {
    console.log(`[broadcast ${broadcastId}] status=${broadcast.status}, o'tkazib yuborildi`);
    return;
  }

  const token = botToken(broadcast.bot);
  const where = segmentWhere(broadcast.botId, broadcast.segment);
  const total = await prisma.botUser.count({ where });

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "RUNNING", startedAt: new Date(), totalCount: total },
  });

  const counters: Counters = { sent: 0, failed: 0, blocked: 0 };
  const buttons = Array.isArray(broadcast.buttons)
    ? (broadcast.buttons as { label: string; url: string }[])
    : [];
  const replyMarkup = buttons.length
    ? { inline_keyboard: buttons.map((b) => [{ text: b.label, url: b.url }]) }
    : undefined;

  const inline: Content = {
    text: broadcast.text,
    parseMode: broadcast.parseMode,
    mediaType: broadcast.mediaType,
    mediaUrl: broadcast.mediaUrl,
  };
  // Tayyor ekran yuborilayotgan bo'lsa, har bir foydalanuvchi o'z tilidagi matnni oladi.
  const byLocale = new Map<string, Content>(
    (broadcast.screen?.translations ?? []).map((t) => [
      t.locale,
      {
        text: t.text,
        parseMode: t.parseMode,
        mediaType: t.mediaType as Content["mediaType"],
        mediaUrl: t.mediaUrl,
      },
    ])
  );
  const contentFor = (locale: string): Content =>
    byLocale.get(locale) ?? byLocale.get(broadcast.bot.defaultLocale) ?? inline;

  // Har bir variant uchun media bir marta hal qilinadi.
  for (const content of [inline, ...byLocale.values()]) {
    if (content.mediaType !== "NONE" && content.mediaUrl) {
      content.resolved = await resolveMedia(broadcast.botId, content.mediaUrl);
    }
  }

  let cursor: string | undefined;
  let stopped = false;

  while (!stopped) {
    const users = await prisma.botUser.findMany({
      where,
      select: { id: true, telegramId: true, locale: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1].id;

    // Har batch boshida pauza/bekor qilinganini tekshiramiz.
    const fresh = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      select: { status: true },
    });
    if (fresh?.status === "PAUSED" || fresh?.status === "CANCELLED") {
      console.log(`[broadcast ${broadcastId}] ${fresh.status}`);
      stopped = true;
      break;
    }

    // Allaqachon yuborilganlarni bitta so'rovda aniqlaymiz — foydalanuvchi boshiga
    // qo'shimcha so'rov yubormaymiz (100 000 obunachida bu sezilarli farq).
    const handled = new Set(
      (
        await prisma.broadcastDelivery.findMany({
          where: {
            broadcastId,
            botUserId: { in: users.map((u) => u.id) },
            status: { not: "PENDING" },
          },
          select: { botUserId: true },
        })
      ).map((d) => d.botUserId)
    );

    const startedAt = Date.now();
    for (const user of users) {
      if (handled.has(user.id)) continue;
      await sendOne(
        token,
        broadcastId,
        user,
        contentFor(user.locale),
        replyMarkup,
        broadcast.disableNotification,
        counters
      );
    }

    // Batch tezligini limitga moslash
    const elapsed = Date.now() - startedAt;
    const minMs = (users.length / RATE_PER_SECOND) * 1000;
    if (elapsed < minMs) await sleep(minMs - elapsed);

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        sentCount: counters.sent,
        failedCount: counters.failed,
        blockedCount: counters.blocked,
      },
    });
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      status: stopped ? "PAUSED" : "DONE",
      finishedAt: stopped ? null : new Date(),
      sentCount: counters.sent,
      failedCount: counters.failed,
      blockedCount: counters.blocked,
    },
  });

  console.log(
    `[broadcast ${broadcastId}] tugadi: ${counters.sent} yuborildi, ` +
      `${counters.blocked} bloklagan, ${counters.failed} xato`
  );
}

type Content = {
  text: string;
  parseMode: string;
  mediaType: "NONE" | "PHOTO" | "VIDEO" | "DOCUMENT" | "ANIMATION";
  mediaUrl: string | null;
  /** Yuborishdan oldin bir marta hal qilinadi — har obunachi uchun emas. */
  resolved?: import("@/lib/media-send").ResolvedMedia;
};

async function sendOne(
  token: string,
  broadcastId: string,
  user: { id: string; telegramId: bigint },
  content: Content,
  replyMarkup: unknown,
  disableNotification: boolean,
  counters: Counters,
  attempt = 0
): Promise<void> {
  try {
    const res = await send(token, {
      chatId: Number(user.telegramId),
      text: content.text,
      parseMode: content.parseMode,
      mediaType: content.mediaType,
      mediaUrl: content.mediaUrl,
      replyMarkup,
      disableNotification,
    });
    counters.sent++;
    await recordDelivery(broadcastId, user.id, "SENT", null, res.message_id);
  } catch (err) {
    if (err instanceof TelegramError) {
      if (err.isRateLimit && attempt < 3) {
        await sleep(((err.retryAfter ?? 2) + 1) * 1000);
        return sendOne(token, broadcastId, user, content, replyMarkup, disableNotification, counters, attempt + 1);
      }
      if (err.isUserGone) {
        counters.blocked++;
        await prisma.botUser.update({
          where: { id: user.id },
          data: { isBlocked: true, blockedAt: new Date() },
        }).catch(() => {});
        await recordDelivery(broadcastId, user.id, "BLOCKED", err.message);
        return;
      }
    }
    counters.failed++;
    await recordDelivery(
      broadcastId,
      user.id,
      "FAILED",
      err instanceof Error ? err.message.slice(0, 300) : "noma'lum xato"
    );
  }
}

async function recordDelivery(
  broadcastId: string,
  botUserId: string,
  status: "SENT" | "FAILED" | "BLOCKED",
  error: string | null,
  messageId?: number
) {
  await prisma.broadcastDelivery
    .upsert({
      where: { broadcastId_botUserId: { broadcastId, botUserId } },
      create: { broadcastId, botUserId, status, error, messageId, sentAt: new Date() },
      update: { status, error, messageId, sentAt: new Date() },
    })
    .catch(() => {});
}

const worker = new Worker<BroadcastJob>(BROADCAST_QUEUE, processBroadcast, {
  connection: redis(),
  concurrency: Number(process.env.BROADCAST_CONCURRENCY ?? 2),
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} xato:`, err);
  const id = job?.data.broadcastId;
  if (id) {
    prisma.broadcast
      .update({ where: { id }, data: { status: "FAILED" } })
      .catch(() => {});
  }
});

worker.on("ready", () => console.log("[worker] broadcast worker tayyor"));

// ---------------------------------------------------------------- fon ishlari

const SWEEP_MS = 60_000;
const AGGREGATE_MS = 10 * 60_000;
const PRUNE_MS = 6 * 60 * 60_000;

async function safely(name: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    if (typeof result === "number" && result > 0) {
      console.log(`[maintenance] ${name}: ${result}`);
    }
  } catch (err) {
    console.error(`[maintenance] ${name} xato:`, err);
  }
}

// Ishga tushganda oxirgi 90 kunni to'ldiramiz — grafiklar bo'sh turmasin.
void safely("boshlang'ich agregatsiya", () => aggregateStats(90));
void safely("rejalashtirilganlarni tekshirish", sweepScheduled);

const timers = [
  setInterval(() => void safely("rejalashtirilganlarni tekshirish", sweepScheduled), SWEEP_MS),
  setInterval(() => void safely("kunlik agregatsiya", () => aggregateStats(2)), AGGREGATE_MS),
  setInterval(() => void safely("eski hodisalarni tozalash", pruneEvents), PRUNE_MS),
];

// Polling rejimidagi botlar shu jarayonda tinglanadi.
const stopPoller = process.env.DISABLE_POLLER === "true" ? () => {} : startPoller();

async function shutdown() {
  console.log("[worker] to'xtatilmoqda...");
  timers.forEach(clearInterval);
  stopPoller();
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
