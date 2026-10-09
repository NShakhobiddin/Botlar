// Ommaviy yuborish mantig'i: obunachilar, bo'laklab yuborish, statistika.
//
// Platformada cron yo'q, shuning uchun yuborish bo'laklarga bo'lingan:
// har bir chaqiruv (Mini App panel yoki bot ichidagi tugma) bitta bo'lakni
// yuboradi. Tezlik `next_at` orqali cheklanadi — kod ichida kutish shart emas.

import { db, api, BotApiError } from 'sdk';
import { sql } from 'sdk/db';
import { ADMIN_IDS, BATCH_SIZE, RATE_PER_SEC, DEFAULT_WELCOME } from './config.js';

const STATS_CACHE_MS = 60_000;
const LOCK_MS = 60_000;

export function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}

// ------------------------------------------------------------------ sozlamalar

export async function getSetting(key) {
  const row = await db.get(sql`SELECT value FROM settings WHERE key = ${key}`);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export async function setSetting(key, value) {
  await db.run(sql`INSERT INTO settings (key, value) VALUES (${key}, ${JSON.stringify(value)})
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
}

export async function welcomeText() {
  return (await getSetting('welcome')) ?? DEFAULT_WELCOME;
}

// ------------------------------------------------------------------ obunachilar

/** Botga yozgan odamni yozib qo'yadi. Faqat nimadir o'zgarganda yozuv bo'ladi. */
export async function upsertSubscriber(user) {
  await db.run(sql`INSERT INTO subscribers (tg_id, first_name, username, source)
    VALUES (${user.id}, ${user.first_name ?? null}, ${user.username ?? null}, 'bot')
    ON CONFLICT(tg_id) DO UPDATE SET first_name = excluded.first_name,
      username = excluded.username, blocked = 0
    WHERE subscribers.blocked = 1
       OR subscribers.first_name IS NOT excluded.first_name
       OR subscribers.username IS NOT excluded.username`);
}

export async function setBlocked(user, blocked) {
  await db.run(sql`INSERT INTO subscribers (tg_id, first_name, username, blocked)
    VALUES (${user.id}, ${user.first_name ?? null}, ${user.username ?? null}, ${blocked ? 1 : 0})
    ON CONFLICT(tg_id) DO UPDATE SET blocked = excluded.blocked`);
}

/** Eski bazadan ID'larni qo'shadi. Takrorlari o'tkazib yuboriladi. */
export async function importIds(ids) {
  const clean = [...new Set(ids.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))];
  if (!clean.length) return { added: 0, skipped: ids.length };
  // Butun ro'yxat bitta parametr sifatida — so'rov uzunligi ro'yxatga bog'liq emas.
  const res = await db.run(sql`INSERT OR IGNORE INTO subscribers (tg_id, source)
    SELECT value, 'import' FROM json_each(${JSON.stringify(clean)})`);
  return { added: res.rowsAffected, skipped: ids.length - res.rowsAffected };
}

export async function stats(fresh = false) {
  const cached = await getSetting('stats_cache');
  if (!fresh && cached && Date.now() - cached.at < STATS_CACHE_MS) return cached;
  const row = await db.get(sql`SELECT COUNT(*) AS total,
      COALESCE(SUM(blocked = 0), 0) AS active,
      COALESCE(SUM(blocked = 1), 0) AS blocked,
      COALESCE(SUM(source = 'import'), 0) AS imported
    FROM subscribers`);
  const value = { at: Date.now(), ...row };
  await setSetting('stats_cache', value);
  return value;
}

// ------------------------------------------------------------------ yuborish

function keyboard(buttonsJson) {
  if (!buttonsJson) return undefined;
  try {
    const list = JSON.parse(buttonsJson);
    return list.length ? { inline_keyboard: list.map((b) => [{ text: b.text, url: b.url }]) } : undefined;
  } catch {
    return undefined;
  }
}

/** Bitta odamga yetkazadi. */
export async function deliver(job, chatId) {
  if (job.kind === 'copy') {
    return api.copyMessage({ chat_id: chatId, from_chat_id: job.from_chat, message_id: job.message_id });
  }
  const reply_markup = keyboard(job.buttons);
  if (job.photo) {
    return api.sendPhoto({
      chat_id: chatId,
      photo: job.photo,
      caption: job.text ? job.text.slice(0, 1024) : undefined,
      parse_mode: 'HTML',
      reply_markup,
    });
  }
  return api.sendMessage({ chat_id: chatId, text: (job.text ?? '').slice(0, 4096), parse_mode: 'HTML', reply_markup });
}

/** Foydalanuvchi botni bloklagan yoki akkaunti o'chgan. */
function isGone(err) {
  if (!(err instanceof BotApiError)) return false;
  if (err.code === 403) return true;
  const d = String(err.description ?? '').toLowerCase();
  return err.code === 400 && (d.includes('chat not found') || d.includes('user is deactivated') || d.includes('peer_id_invalid'));
}

/** "Matn | https://havola" qatorlarini tugmalarga aylantiradi. Xato bo'lsa — matn. */
export function parseButtons(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [text, url] = line.split('|').map((s) => s.trim());
    if (!text || !url) return `Tugma qatori noto'g'ri: "${line.trim()}" — "Matn | https://havola" ko'rinishida yozing`;
    if (!/^(https?|tg):\/\//.test(url)) return `Tugma havolasi https:// bilan boshlanishi kerak: ${url}`;
    out.push({ text: text.slice(0, 64), url });
  }
  return out;
}

export async function currentJob() {
  return db.get(sql`SELECT * FROM broadcasts WHERE status = 'running' ORDER BY id LIMIT 1`);
}

export async function history(limit = 10) {
  return db.all(sql`SELECT id, status, kind, text, total, sent, blocked, failed, created_at, finished_at
    FROM broadcasts ORDER BY id DESC LIMIT ${limit}`);
}

/** Yangi yuborishni boshlaydi. Xato bo'lsa — tushuntirish matni qaytadi. */
export async function createJob(fields) {
  if (await currentJob()) return 'Oldingi xabar hali yuborilmoqda — tugashini kuting yoki bekor qiling';

  const row = await db.get(sql`SELECT COUNT(*) AS n FROM subscribers WHERE blocked = 0`);
  if (!row || row.n === 0) return "Obunachi yo'q — avval ro'yxatni import qiling yoki odamlar botga /start yozsin";

  const res = await db.run(sql`INSERT INTO broadcasts
      (status, kind, text, photo, buttons, from_chat, message_id, total, created_by)
    VALUES ('running', ${fields.kind}, ${fields.text ?? null}, ${fields.photo ?? null},
      ${fields.buttons ?? null}, ${fields.fromChat ?? null}, ${fields.messageId ?? null},
      ${row.n}, ${fields.createdBy ?? null})`);
  return db.get(sql`SELECT * FROM broadcasts WHERE id = ${res.lastInsertRowid}`);
}

export async function cancelJob() {
  const res = await db.run(sql`UPDATE broadcasts SET status = 'cancelled', finished_at = unixepoch(), lock_until = 0
    WHERE status = 'running'`);
  return res.rowsAffected > 0;
}

/**
 * Navbatdagi bo'lakni yuboradi.
 * Qaytaradi: { job, waitMs } — `waitMs` keyingi chaqiruvgacha qancha kutish kerakligi.
 */
export async function runBatch() {
  const now = Date.now();
  const job = await currentJob();
  if (!job) return { job: null, waitMs: 0 };
  if (job.next_at > now) return { job, waitMs: job.next_at - now };

  // Bir bo'lakni bitta chaqiruv egallaydi — panel va tugma bir vaqtda bosilsa ham
  // hech kim xabarni ikki marta olmaydi.
  const claim = await db.run(sql`UPDATE broadcasts SET lock_until = ${now + LOCK_MS}
    WHERE id = ${job.id} AND status = 'running' AND lock_until < ${now}`);
  if (claim.rowsAffected !== 1) return { job, waitMs: 1000, note: 'Boshqa oyna yubormoqda' };

  const users = await db.all(sql`SELECT tg_id FROM subscribers
    WHERE blocked = 0 AND tg_id > ${job.cursor} ORDER BY tg_id LIMIT ${BATCH_SIZE}`);

  if (users.length === 0) {
    await db.run(sql`UPDATE broadcasts SET status = 'done', finished_at = unixepoch(), lock_until = 0
      WHERE id = ${job.id} AND status = 'running'`);
    const done = await db.get(sql`SELECT * FROM broadcasts WHERE id = ${job.id}`);
    await notifyFinished(done);
    return { job: done, waitMs: 0 };
  }

  const started = Date.now();
  let cursor = job.cursor;
  let sent = 0;
  let failed = 0;
  let retryAfter = 0;
  const gone = [];

  for (const user of users) {
    try {
      await deliver(job, user.tg_id);
      sent++;
    } catch (err) {
      if (err instanceof BotApiError && err.code === 429) {
        // Kursor surilmaydi — keyingi safar shu odamdan boshlanadi.
        retryAfter = Number(err.parameters?.retry_after ?? 5);
        break;
      }
      if (isGone(err)) gone.push(user.tg_id);
      else {
        failed++;
        console.warn('yuborilmadi', { chat: user.tg_id, code: err?.code, description: err?.description });
      }
    }
    cursor = user.tg_id;
  }

  const processed = sent + failed + gone.length;
  const nextAt = retryAfter
    ? Date.now() + (retryAfter + 1) * 1000
    : started + Math.ceil((processed * 1000) / RATE_PER_SEC);

  if (gone.length) {
    await db.run(sql`UPDATE subscribers SET blocked = 1
      WHERE tg_id IN (SELECT value FROM json_each(${JSON.stringify(gone)}))`);
  }
  await db.run(sql`UPDATE broadcasts SET cursor = ${cursor}, sent = sent + ${sent},
      blocked = blocked + ${gone.length}, failed = failed + ${failed},
      next_at = ${nextAt}, lock_until = 0
    WHERE id = ${job.id}`);

  const fresh = await db.get(sql`SELECT * FROM broadcasts WHERE id = ${job.id}`);
  return {
    job: fresh,
    waitMs: Math.max(0, nextAt - Date.now()),
    note: retryAfter ? `Telegram ${retryAfter} s kutishni so'radi` : undefined,
  };
}

export function progressText(job) {
  const done = job.sent + job.blocked + job.failed;
  const pct = job.total ? Math.min(100, Math.round((done / job.total) * 100)) : 0;
  const head =
    job.status === 'done' ? '✅ Yuborildi' : job.status === 'cancelled' ? "⏹ To'xtatildi" : `📤 Yuborilmoqda — ${pct}%`;
  return `${head}\n\nYetdi: ${job.sent}\nBloklagan: ${job.blocked}\nXato: ${job.failed}\nJami: ${done} / ${job.total}`;
}

async function notifyFinished(job) {
  const targets = new Set([...ADMIN_IDS, job.created_by].filter(Boolean));
  for (const chatId of targets) {
    await api.sendMessage({ chat_id: chatId, text: progressText(job) }).catch(() => {});
  }
}
