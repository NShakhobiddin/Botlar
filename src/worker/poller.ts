/**
 * Polling rejimi — webhook o'rniga.
 *
 * Bot Telegram'dan yangiliklarni o'zi so'raydi, shuning uchun ochiq domen,
 * HTTPS sertifikat va statik IP kerak emas. Panelni uy kompyuterida yoki
 * ichki tarmoqda ishlatish uchun shu rejim ishlatiladi.
 */
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { botToken } from "@/lib/bots";
import { deleteWebhook, getUpdates, TelegramError } from "@/lib/telegram";
import { handleUpdate } from "@/lib/engine/handle";
import { redis } from "@/lib/queue";
import type { Bot } from "@prisma/client";

/** Bir bot ustida bir vaqtda faqat bitta jarayon ishlashi kerak — aks holda Telegram 409 qaytaradi. */
const LOCK_MS = 60_000;
const POLL_TIMEOUT_SEC = 25;
const SCAN_MS = 10_000;

const instanceId = crypto.randomUUID();
const running = new Map<string, { stop: () => void }>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquireLock(botId: string): Promise<boolean> {
  const key = `poll:lock:${botId}`;
  const client = redis();
  const current = await client.get(key);
  if (current === instanceId) {
    await client.pexpire(key, LOCK_MS);
    return true;
  }
  const res = await client.set(key, instanceId, "PX", LOCK_MS, "NX");
  return res === "OK";
}

async function releaseLock(botId: string) {
  const key = `poll:lock:${botId}`;
  const client = redis();
  if ((await client.get(key)) === instanceId) await client.del(key);
}

async function readOffset(botId: string): Promise<number> {
  const raw = await redis().get(`poll:offset:${botId}`);
  return raw ? Number(raw) : 0;
}

async function writeOffset(botId: string, offset: number) {
  await redis().set(`poll:offset:${botId}`, String(offset));
}

/** Bitta bot uchun uzluksiz getUpdates halqasi. */
async function pollBot(bot: Bot) {
  let stopped = false;
  running.set(bot.id, { stop: () => (stopped = true) });

  const token = botToken(bot);
  // Webhook o'rnatilgan bo'lsa Telegram getUpdates'ga ruxsat bermaydi.
  await deleteWebhook(token).catch(() => {});
  await prisma.bot
    .update({ where: { id: bot.id }, data: { webhookSetAt: null } })
    .catch(() => {});

  console.log(`[poller] @${bot.username} tinglanmoqda`);
  let failures = 0;

  while (!stopped) {
    if (!(await acquireLock(bot.id))) {
      // Boshqa jarayon shu botni tinglayapti.
      await sleep(LOCK_MS / 2);
      continue;
    }

    try {
      const offset = await readOffset(bot.id);
      const updates = await getUpdates(token, offset, POLL_TIMEOUT_SEC);
      failures = 0;

      for (const update of updates) {
        // Update qayta ishlanmasa ham offset oldinga suriladi —
        // bitta buzuq xabar butun botni to'xtatib qo'ymasin.
        await writeOffset(bot.id, update.update_id + 1);
        try {
          const fresh = await prisma.bot.findUnique({ where: { id: bot.id } });
          if (fresh) await handleUpdate(fresh, update);
        } catch (err) {
          console.error(`[poller] @${bot.username} update ${update.update_id}:`, err);
        }
      }
    } catch (err) {
      failures++;
      if (err instanceof TelegramError && err.code === 409) {
        console.error(
          `[poller] @${bot.username}: webhook hali o'chirilmagan yoki boshqa nusxa ishlayapti`
        );
        await deleteWebhook(token).catch(() => {});
      } else if (err instanceof TelegramError && err.code === 401) {
        console.error(`[poller] @${bot.username}: token yaroqsiz, to'xtatildi`);
        stopped = true;
        break;
      } else {
        console.error(`[poller] @${bot.username}:`, err instanceof Error ? err.message : err);
      }
      // Ketma-ket xatolarda tobora uzoqroq kutamiz (eng ko'pi 60 s).
      await sleep(Math.min(60_000, 2000 * 2 ** Math.min(failures, 5)));
    }
  }

  await releaseLock(bot.id);
  running.delete(bot.id);
  console.log(`[poller] @${bot.username} to'xtatildi`);
}

/** Polling rejimidagi botlarni kuzatib boradi: yangisini ishga tushiradi, o'chganini to'xtatadi. */
export function startPoller(): () => void {
  let alive = true;

  async function scan() {
    const bots = await prisma.bot.findMany({
      where: { mode: "POLLING", isActive: true },
    });
    const wanted = new Set(bots.map((b) => b.id));

    for (const [botId, handle] of running) {
      if (!wanted.has(botId)) handle.stop();
    }
    for (const bot of bots) {
      if (!running.has(bot.id)) void pollBot(bot);
    }
  }

  void scan().catch((err) => console.error("[poller] skan xatosi:", err));
  const timer = setInterval(() => {
    if (alive) void scan().catch((err) => console.error("[poller] skan xatosi:", err));
  }, SCAN_MS);

  return () => {
    alive = false;
    clearInterval(timer);
    for (const handle of running.values()) handle.stop();
  };
}
