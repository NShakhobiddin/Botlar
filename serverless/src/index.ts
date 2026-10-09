/**
 * Botlar — serverless ommaviy xabar yuboruvchi.
 *
 * Cloudflare Workers'da ishlaydi: server, domen va oylik to'lov kerak emas.
 * Obunachilar D1 bazasida saqlanadi, xabarlar har daqiqada (va panel ochiq
 * bo'lsa har bir necha soniyada) bo'laklab yuboriladi.
 */
import { appPage, loginPage } from "./page";

export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  ADMIN_PASSWORD: string;
  ADMIN_IDS?: string;
  BATCH_SIZE?: string;
  TELEGRAM_API?: string;
}

type Job = {
  id: number;
  status: "running" | "done" | "cancelled";
  kind: "compose" | "copy";
  text: string | null;
  photo: string | null;
  buttons: string | null;
  from_chat: number | null;
  message_id: number | null;
  cursor: number;
  total: number;
  sent: number;
  blocked: number;
  failed: number;
  retry_at: number;
  lock_until: number;
  created_at: number;
  finished_at: number | null;
};

const SESSION_COOKIE = "bx_session";
const SESSION_TTL = 7 * 24 * 3600;
const IMPORT_CHUNK = 2000;
const STATS_CACHE_SEC = 120;

const now = () => Math.floor(Date.now() / 1000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// =================================================================== Telegram

class TgError extends Error {
  constructor(message: string, readonly code: number, readonly retryAfter?: number) {
    super(message);
  }
  /** Foydalanuvchi botni bloklagan yoki akkaunti o'chgan. */
  get gone(): boolean {
    if (this.code === 403) return true;
    const m = this.message.toLowerCase();
    return (
      this.code === 400 &&
      (m.includes("chat not found") || m.includes("user is deactivated") || m.includes("peer_id_invalid"))
    );
  }
}

async function tg<T = unknown>(env: Env, method: string, params: Record<string, unknown> = {}): Promise<T> {
  const base = (env.TELEGRAM_API || "https://api.telegram.org").replace(/\/$/, "");
  const res = await fetch(`${base}/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const raw = await res.text();
  let json: { ok: boolean; result?: T; description?: string; error_code?: number; parameters?: { retry_after?: number } };
  try {
    json = JSON.parse(raw);
  } catch {
    throw new TgError(`Telegram JSON o'rniga ${res.status} qaytardi`, res.status);
  }
  if (!json.ok) {
    throw new TgError(json.description ?? "Telegram xatosi", json.error_code ?? res.status, json.parameters?.retry_after);
  }
  return json.result as T;
}

type Button = { text: string; url: string };

function keyboard(buttonsJson: string | null): unknown {
  if (!buttonsJson) return undefined;
  try {
    const list = JSON.parse(buttonsJson) as Button[];
    return list.length ? { inline_keyboard: list.map((b) => [{ text: b.text, url: b.url }]) } : undefined;
  } catch {
    return undefined;
  }
}

/** Bitta foydalanuvchiga xabarni yetkazadi. */
async function deliver(env: Env, job: Pick<Job, "kind" | "text" | "photo" | "buttons" | "from_chat" | "message_id">, chatId: number) {
  if (job.kind === "copy") {
    return tg(env, "copyMessage", { chat_id: chatId, from_chat_id: job.from_chat, message_id: job.message_id });
  }
  const reply_markup = keyboard(job.buttons);
  if (job.photo) {
    return tg(env, "sendPhoto", {
      chat_id: chatId,
      photo: job.photo,
      caption: job.text ? job.text.slice(0, 1024) : undefined,
      parse_mode: "HTML",
      reply_markup,
    });
  }
  return tg(env, "sendMessage", { chat_id: chatId, text: (job.text ?? "").slice(0, 4096), parse_mode: "HTML", reply_markup });
}

function adminIds(env: Env): number[] {
  return (env.ADMIN_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
}

// =================================================================== Yuborish

function batchSize(env: Env): number {
  const n = Number(env.BATCH_SIZE ?? 40);
  return Number.isFinite(n) ? Math.min(1000, Math.max(1, Math.floor(n))) : 40;
}

export type TickResult = { job: Job | null; note?: string };

/**
 * Navbatdagi bo'lakni yuboradi. Cron va ochiq panel bir vaqtda chaqirsa
 * ham bir bo'lak ikki marta yuborilmaydi — `lock_until` orqali egallanadi.
 */
export async function runBatch(env: Env): Promise<TickResult> {
  const t = now();
  const job = await env.DB.prepare("SELECT * FROM broadcasts WHERE status = 'running' ORDER BY id LIMIT 1").first<Job>();
  if (!job) return { job: null };
  if (job.retry_at > t) return { job, note: `Telegram ${job.retry_at - t} s kutishni so'radi` };

  const claim = await env.DB.prepare("UPDATE broadcasts SET lock_until = ? WHERE id = ? AND lock_until < ? AND status = 'running'")
    .bind(t + 55, job.id, t)
    .run();
  if (claim.meta.changes !== 1) return { job, note: "boshqa jarayon yubormoqda" };

  const { results: users } = await env.DB.prepare("SELECT id FROM users WHERE blocked = 0 AND id > ? ORDER BY id LIMIT ?")
    .bind(job.cursor, batchSize(env))
    .all<{ id: number }>();

  if (users.length === 0) {
    await env.DB.prepare("UPDATE broadcasts SET status = 'done', finished_at = ?, lock_until = 0 WHERE id = ? AND status = 'running'")
      .bind(t, job.id)
      .run();
    // Adminlarga yakuniy hisobot
    for (const admin of adminIds(env)) {
      await tg(env, "sendMessage", {
        chat_id: admin,
        text: `✅ Xabar yuborildi\n\nYetdi: ${job.sent}\nBloklagan: ${job.blocked}\nXato: ${job.failed}`,
      }).catch(() => {});
    }
    const done = await env.DB.prepare("SELECT * FROM broadcasts WHERE id = ?").bind(job.id).first<Job>();
    return { job: done };
  }

  let cursor = job.cursor;
  let sent = 0;
  let failed = 0;
  let retryAt = 0;
  const gone: number[] = [];

  for (const user of users) {
    try {
      await deliver(env, job, user.id);
      sent++;
    } catch (err) {
      if (err instanceof TgError && err.code === 429) {
        // Kursor surilmaydi — shu foydalanuvchidan davom etiladi.
        retryAt = now() + (err.retryAfter ?? 5) + 1;
        break;
      }
      if (err instanceof TgError && err.gone) gone.push(user.id);
      else failed++;
    }
    cursor = user.id;
    await sleep(35); // ~28 xabar/s — Telegram chegarasi 30
  }

  const writes: D1PreparedStatement[] = [];
  if (gone.length) {
    // id'lar bazaning o'zidan olingan butun sonlar — to'g'ridan-to'g'ri qo'yish xavfsiz.
    writes.push(env.DB.prepare(`UPDATE users SET blocked = 1 WHERE id IN (${gone.join(",")})`));
  }
  writes.push(
    env.DB.prepare(
      "UPDATE broadcasts SET cursor = ?, sent = sent + ?, blocked = blocked + ?, failed = failed + ?, retry_at = ?, lock_until = 0 WHERE id = ?"
    ).bind(cursor, sent, gone.length, failed, retryAt, job.id)
  );
  await env.DB.batch(writes);

  const fresh = await env.DB.prepare("SELECT * FROM broadcasts WHERE id = ?").bind(job.id).first<Job>();
  return { job: fresh };
}

async function startBroadcast(env: Env, fields: Partial<Job>): Promise<Job | string> {
  const running = await env.DB.prepare("SELECT id FROM broadcasts WHERE status = 'running' LIMIT 1").first();
  if (running) return "Oldingi xabar hali yuborilmoqda — tugashini kuting yoki bekor qiling";

  const total = (await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE blocked = 0").first<{ n: number }>())?.n ?? 0;
  if (total === 0) return "Obunachi yo'q — avval ro'yxatni import qiling yoki bot rejimini yoqing";

  const job = await env.DB.prepare(
    `INSERT INTO broadcasts (status, kind, text, photo, buttons, from_chat, message_id, total)
     VALUES ('running', ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(
      fields.kind ?? "compose",
      fields.text ?? null,
      fields.photo ?? null,
      fields.buttons ?? null,
      fields.from_chat ?? null,
      fields.message_id ?? null,
      total
    )
    .first<Job>();
  return job!;
}

// =================================================================== Sessiya

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(data: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Taqqoslash vaqti matnga bog'liq bo'lmasin. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

async function isAuthed(req: Request, env: Env): Promise<boolean> {
  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < now()) return false;
  return safeEqual(sig, await hmac(env.ADMIN_PASSWORD, `session:${exp}`));
}

async function sessionCookie(env: Env, secure: boolean): Promise<string> {
  const exp = now() + SESSION_TTL;
  const sig = await hmac(env.ADMIN_PASSWORD, `session:${exp}`);
  return `${SESSION_COOKIE}=${exp}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}${secure ? "; Secure" : ""}`;
}

// =================================================================== Sozlamalar

async function getSetting<T>(env: Env, key: string): Promise<T | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

async function setSetting(env: Env, key: string, value: unknown) {
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, JSON.stringify(value))
    .run();
}

const DEFAULT_WELCOME = "Assalomu alaykum! 👋\n\nObuna bo'lganingiz uchun rahmat — yangiliklar shu yerga keladi.";

// =================================================================== HTTP

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });

const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer",
      ...headers,
    },
  });

function parseButtons(raw: unknown): Button[] | string {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const out: Button[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const [text, url] = line.split("|").map((s) => s.trim());
    if (!text || !url) return `Tugma qatori noto'g'ri: "${line.trim()}" — "Matn | https://havola" ko'rinishida yozing`;
    if (!/^https?:\/\//.test(url) && !/^tg:\/\//.test(url)) return `Tugma havolasi https:// bilan boshlanishi kerak: ${url}`;
    out.push({ text: text.slice(0, 64), url });
  }
  return out;
}

async function stats(env: Env, fresh = false) {
  const cached = await getSetting<{ at: number; total: number; active: number; blocked: number; imported: number }>(env, "stats_cache");
  if (!fresh && cached && now() - cached.at < STATS_CACHE_SEC) return cached;
  // Bu so'rov barcha qatorlarni o'qiydi — shuning uchun natija keshlanadi
  // (D1 bepul tarifida kuniga 5 mln o'qish chegarasi bor).
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS total, COALESCE(SUM(blocked = 0), 0) AS active, COALESCE(SUM(blocked), 0) AS blocked, COALESCE(SUM(source = 'import'), 0) AS imported FROM users"
  ).first<{ total: number; active: number; blocked: number; imported: number }>();
  const value = { at: now(), ...row! };
  await setSetting(env, "stats_cache", value);
  return value;
}

async function botInfo(env: Env) {
  const cached = await getSetting<{ username: string; first_name: string }>(env, "bot_info");
  if (cached) return cached;
  try {
    const me = await tg<{ username: string; first_name: string }>(env, "getMe");
    const info = { username: me.username, first_name: me.first_name };
    await setSetting(env, "bot_info", info);
    return info;
  } catch {
    return null;
  }
}

async function handleApi(req: Request, env: Env, path: string): Promise<Response> {
  const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};

  switch (path) {
    case "/api/state": {
      const [s, bot, current, history, welcome, webhook] = await Promise.all([
        stats(env, body.fresh === true),
        botInfo(env),
        env.DB.prepare("SELECT * FROM broadcasts WHERE status = 'running' ORDER BY id LIMIT 1").first<Job>(),
        env.DB.prepare("SELECT id, status, kind, text, total, sent, blocked, failed, created_at, finished_at FROM broadcasts ORDER BY id DESC LIMIT 10").all(),
        getSetting<string>(env, "welcome"),
        tg<{ url: string; pending_update_count: number; last_error_message?: string }>(env, "getWebhookInfo").catch(() => null),
      ]);
      const origin = new URL(req.url).origin;
      return json({
        stats: s,
        bot,
        current,
        history: history.results,
        welcome: welcome ?? DEFAULT_WELCOME,
        webhook: webhook ? { active: webhook.url === `${origin}/webhook`, otherUrl: webhook.url && webhook.url !== `${origin}/webhook` ? webhook.url : null, error: webhook.last_error_message ?? null } : null,
        batchSize: batchSize(env),
      });
    }

    case "/api/tick": {
      const result = await runBatch(env);
      return json(result);
    }

    case "/api/test": {
      const chatId = Number(body.chatId);
      if (!Number.isSafeInteger(chatId) || chatId === 0) return json({ error: "Telegram ID faqat raqamlardan iborat bo'lsin" }, 400);
      const buttons = parseButtons(body.buttons);
      if (typeof buttons === "string") return json({ error: buttons }, 400);
      const text = String(body.text ?? "").trim();
      const photo = String(body.photo ?? "").trim() || null;
      if (!text && !photo) return json({ error: "Matn yoki rasm kiriting" }, 400);
      try {
        await deliver(env, { kind: "compose", text, photo, buttons: JSON.stringify(buttons), from_chat: null, message_id: null }, chatId);
        return json({ ok: "Sinov xabari yuborildi — Telegram'ni tekshiring" });
      } catch (err) {
        if (err instanceof TgError && err.gone) {
          return json({ error: "Bu ID bot bilan suhbat boshlamagan. Avval botga /start yozing." }, 400);
        }
        return json({ error: err instanceof Error ? err.message : "Yuborilmadi" }, 400);
      }
    }

    case "/api/broadcast": {
      const buttons = parseButtons(body.buttons);
      if (typeof buttons === "string") return json({ error: buttons }, 400);
      const text = String(body.text ?? "").trim();
      const photo = String(body.photo ?? "").trim() || null;
      if (!text && !photo) return json({ error: "Matn yoki rasm kiriting" }, 400);
      if (photo && text.length > 1024) return json({ error: "Rasm ostidagi matn 1024 belgidan oshmasin" }, 400);
      const job = await startBroadcast(env, { kind: "compose", text, photo, buttons: JSON.stringify(buttons) });
      if (typeof job === "string") return json({ error: job }, 400);
      return json({ job });
    }

    case "/api/cancel": {
      await env.DB.prepare("UPDATE broadcasts SET status = 'cancelled', finished_at = ?, lock_until = 0 WHERE status = 'running'").bind(now()).run();
      return json({ ok: "Bekor qilindi" });
    }

    case "/api/import": {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      if (ids.length === 0) return json({ error: "Ro'yxat bo'sh" }, 400);
      if (ids.length > IMPORT_CHUNK) return json({ error: `Bir so'rovda ${IMPORT_CHUNK} tadan ko'p emas` }, 400);
      const clean = ids.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0);
      if (clean.length === 0) return json({ error: "Yaroqli ID topilmadi" }, 400);
      // Butun son ekani tekshirilgan — so'rovga to'g'ridan-to'g'ri qo'yish xavfsiz.
      const values = clean.map((id) => `(${id}, 'import')`).join(",");
      const res = await env.DB.prepare(`INSERT OR IGNORE INTO users (id, source) VALUES ${values}`).run();
      return json({ added: res.meta.changes, skipped: ids.length - res.meta.changes });
    }

    case "/api/welcome": {
      const text = String(body.text ?? "").trim();
      if (!text) return json({ error: "Matn bo'sh bo'lmasin" }, 400);
      await setSetting(env, "welcome", text.slice(0, 4000));
      return json({ ok: "Saqlandi" });
    }

    case "/api/webhook": {
      if (body.enable === true) {
        const origin = new URL(req.url).origin;
        if (!origin.startsWith("https://")) return json({ error: "Webhook faqat HTTPS manzilda ishlaydi — deploy qilingan nusxada yoqing" }, 400);
        await tg(env, "setWebhook", {
          url: `${origin}/webhook`,
          secret_token: (await sha256(env.BOT_TOKEN)).slice(0, 48),
          allowed_updates: ["message", "my_chat_member"],
        });
        return json({ ok: "Bot rejimi yoqildi — yangi obunachilar endi o'zi yoziladi" });
      }
      await tg(env, "deleteWebhook", {});
      return json({ ok: "Bot rejimi o'chirildi" });
    }

    default:
      return json({ error: "Topilmadi" }, 404);
  }
}

// =================================================================== Telegram webhook

type TgUser = { id: number; first_name?: string; username?: string; is_bot?: boolean };
type Update = {
  message?: {
    message_id: number;
    from?: TgUser;
    chat: { id: number; type: string };
    text?: string;
    reply_to_message?: { message_id: number };
  };
  my_chat_member?: { from: TgUser; chat: { id: number; type: string }; new_chat_member: { status: string } };
};

async function handleWebhook(req: Request, env: Env): Promise<Response> {
  const expected = (await sha256(env.BOT_TOKEN)).slice(0, 48);
  if (req.headers.get("x-telegram-bot-api-secret-token") !== expected) return new Response("", { status: 401 });

  const update = (await req.json().catch(() => ({}))) as Update;

  if (update.my_chat_member && update.my_chat_member.chat.type === "private") {
    const left = ["kicked", "left"].includes(update.my_chat_member.new_chat_member.status);
    const u = update.my_chat_member.from;
    await env.DB.prepare(
      `INSERT INTO users (id, first_name, username, blocked) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET blocked = excluded.blocked`
    )
      .bind(u.id, u.first_name ?? null, u.username ?? null, left ? 1 : 0)
      .run();
    return json({ ok: true });
  }

  const msg = update.message;
  if (!msg || msg.chat.type !== "private" || !msg.from || msg.from.is_bot) return json({ ok: true });

  // Faqat nimadir o'zgarganda yoziladi — D1'ning kunlik yozuv chegarasi tejaladi.
  await env.DB.prepare(
    `INSERT INTO users (id, first_name, username, source) VALUES (?, ?, ?, 'bot')
     ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username, blocked = 0
     WHERE users.blocked = 1 OR users.first_name IS NOT excluded.first_name OR users.username IS NOT excluded.username`
  )
    .bind(msg.from.id, msg.from.first_name ?? null, msg.from.username ?? null)
    .run();

  const text = (msg.text ?? "").trim();
  const command = text.startsWith("/") ? text.slice(1).split(/[\s@]/)[0].toLowerCase() : "";
  const isAdmin = adminIds(env).includes(msg.from.id);
  const reply = (t: string) => tg(env, "sendMessage", { chat_id: msg.chat.id, text: t }).catch(() => {});

  if (command === "start") {
    const welcome = (await getSetting<string>(env, "welcome")) ?? DEFAULT_WELCOME;
    await tg(env, "sendMessage", { chat_id: msg.chat.id, text: welcome, parse_mode: "HTML" }).catch(() => reply(welcome));
    return json({ ok: true });
  }

  if (!isAdmin) return json({ ok: true });

  if (command === "stats") {
    const s = await stats(env, true);
    await reply(`📊 Obunachilar: ${s.total}\nFaol: ${s.active}\nBloklagan: ${s.blocked}\nImport qilingan: ${s.imported}`);
  } else if (command === "broadcast") {
    if (!msg.reply_to_message) {
      await reply("Yubormoqchi bo'lgan xabarni (matn, rasm, video — istalgani) shu chatga yozing, keyin unga javob tariqasida /broadcast yuboring.");
    } else {
      const job = await startBroadcast(env, { kind: "copy", from_chat: msg.chat.id, message_id: msg.reply_to_message.message_id });
      await reply(typeof job === "string" ? `⚠️ ${job}` : `🚀 Boshlandi: ${job.total} ta obunachiga. Tugaganda xabar beraman.\nTo'xtatish: /cancel\n\nManba xabarni yuborish tugaguncha o'chirmang.`);
    }
  } else if (command === "cancel") {
    await env.DB.prepare("UPDATE broadcasts SET status = 'cancelled', finished_at = ?, lock_until = 0 WHERE status = 'running'").bind(now()).run();
    await reply("⏹ To'xtatildi");
  }

  return json({ ok: true });
}

// =================================================================== Kirish

async function handleLogin(req: Request, env: Env): Promise<Response> {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");

  const lock = await getSetting<{ fails: number; until: number }>(env, "login_lock");
  if (lock && lock.until > now()) {
    return html(loginPage(`Juda ko'p noto'g'ri urinish. ${Math.ceil((lock.until - now()) / 60)} daqiqadan so'ng qayta urining.`), {});
  }

  // Ikkala tomonni bir xil uzunlikka keltirib taqqoslaymiz.
  const ok = safeEqual(await sha256(password), await sha256(env.ADMIN_PASSWORD));
  if (!ok) {
    const fails = (lock && lock.until > now() - 900 ? lock.fails : 0) + 1;
    await setSetting(env, "login_lock", { fails, until: fails >= 10 ? now() + 900 : 0 });
    await sleep(800);
    return html(loginPage("Parol noto'g'ri"));
  }

  await setSetting(env, "login_lock", { fails: 0, until: 0 });
  const secure = new URL(req.url).protocol === "https:";
  return new Response(null, { status: 303, headers: { location: "/", "set-cookie": await sessionCookie(env, secure) } });
}

// =================================================================== Kirish nuqtasi

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (!env.BOT_TOKEN || !env.ADMIN_PASSWORD) {
      return html(loginPage("Sozlanmagan: BOT_TOKEN va ADMIN_PASSWORD maxfiy qiymatlarini kiriting (README'ga qarang)."));
    }
    if (env.ADMIN_PASSWORD.length < 12) {
      return html(loginPage("ADMIN_PASSWORD kamida 12 belgi bo'lishi kerak — panel ochiq internetda turadi."));
    }

    if (url.pathname === "/webhook" && req.method === "POST") return handleWebhook(req, env);
    if (url.pathname === "/login" && req.method === "POST") return handleLogin(req, env);
    if (url.pathname === "/logout" && req.method === "POST") {
      return new Response(null, { status: 303, headers: { location: "/", "set-cookie": `${SESSION_COOKIE}=; Path=/; Max-Age=0` } });
    }

    const authed = await isAuthed(req, env);

    if (url.pathname.startsWith("/api/")) {
      if (!authed) return json({ error: "Qaytadan kiring" }, 401);
      if (req.method !== "POST") return json({ error: "POST kerak" }, 405);
      // Boshqa saytlardan yuborilgan so'rovlarni rad etamiz.
      const origin = req.headers.get("origin");
      if (origin && origin !== url.origin) return json({ error: "Ruxsat yo'q" }, 403);
      return handleApi(req, env, url.pathname);
    }

    if (url.pathname === "/") return html(authed ? appPage() : loginPage());
    return new Response("Topilmadi", { status: 404 });
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runBatch(env).catch((err) => console.error("[cron]", err)));
  },
} satisfies ExportedHandler<Env>;
