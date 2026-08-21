/**
 * Telegram Bot API manzili.
 * O'zingizning Bot API serveringizni ishlatsangiz (katta fayllar uchun)
 * TELEGRAM_API_URL orqali almashtiring.
 */
const API = (process.env.TELEGRAM_API_URL ?? "https://api.telegram.org").replace(/\/$/, "");

export class TelegramError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly retryAfter?: number,
    readonly method?: string
  ) {
    super(message);
    this.name = "TelegramError";
  }

  /** Foydalanuvchi botni bloklagan / o'chirgan / chatga kirish yo'q. */
  get isUserGone(): boolean {
    if (this.code === 403) return true;
    if (this.code !== 400) return false;
    const m = this.message.toLowerCase();
    return (
      m.includes("chat not found") ||
      m.includes("user is deactivated") ||
      m.includes("peer_id_invalid")
    );
  }

  get isRateLimit(): boolean {
    return this.code === 429;
  }
}

export async function callApi<T = unknown>(
  token: string,
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 20_000
): Promise<T> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body[k] = typeof v === "object" ? JSON.stringify(v) : v;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const raw = await res.text();
    let json: {
      ok: boolean;
      result?: T;
      description?: string;
      error_code?: number;
      parameters?: { retry_after?: number };
    };
    try {
      json = JSON.parse(raw);
    } catch {
      // Telegram (yoki oradagi proxy) JSON o'rniga HTML qaytardi — 502/504 va shunga o'xshash holatlar.
      throw new TelegramError(
        `${method}: Telegram JSON o'rniga ${res.status} javob qaytardi — ${raw.slice(0, 120)}`,
        res.status,
        undefined,
        method
      );
    }
    if (!json.ok) {
      throw new TelegramError(
        json.description ?? "Telegram API xatosi",
        json.error_code ?? res.status,
        json.parameters?.retry_after,
        method
      );
    }
    return json.result as T;
  } catch (err) {
    if (err instanceof TelegramError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new TelegramError(`${method}: so'rov vaqti tugadi`, 408, undefined, method);
    }
    throw new TelegramError(
      err instanceof Error ? err.message : "Tarmoq xatosi",
      0,
      undefined,
      method
    );
  }
}

// ------------------------------------------------------------------ tiplar

export type TgUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  date: number;
  text?: string;
  contact?: { phone_number: string; user_id?: number };
  location?: { latitude: number; longitude: number };
  web_app_data?: { data: string; button_text: string };
};

export type TgCallbackQuery = {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
};

export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: TgCallbackQuery;
  my_chat_member?: {
    from: TgUser;
    chat: { id: number; type: string };
    new_chat_member: { status: string };
    old_chat_member: { status: string };
  };
};

// ------------------------------------------------------------------ metodlar

export const getMe = (token: string) => callApi<TgUser>(token, "getMe");

export const setWebhook = (
  token: string,
  url: string,
  secretToken: string,
  allowed: string[] = ["message", "callback_query", "my_chat_member"]
) =>
  callApi<boolean>(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: allowed,
    drop_pending_updates: false,
    max_connections: 60,
  });

export const deleteWebhook = (token: string) =>
  callApi<boolean>(token, "deleteWebhook", { drop_pending_updates: false });

export const getWebhookInfo = (token: string) =>
  callApi<{
    url: string;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  }>(token, "getWebhookInfo");

/** Long polling — webhook o'rniga. Domen va HTTPS talab qilmaydi. */
export const getUpdates = (
  token: string,
  offset: number,
  timeoutSec = 25,
  allowed: string[] = ["message", "callback_query", "my_chat_member"]
) =>
  callApi<TgUpdate[]>(
    token,
    "getUpdates",
    { offset, timeout: timeoutSec, allowed_updates: allowed },
    (timeoutSec + 10) * 1000
  );

export const setMyCommands = (
  token: string,
  commands: { command: string; description: string }[]
) => callApi<boolean>(token, "setMyCommands", { commands });

export const answerCallbackQuery = (
  token: string,
  id: string,
  text?: string,
  showAlert = false
) =>
  callApi<boolean>(token, "answerCallbackQuery", {
    callback_query_id: id,
    text,
    show_alert: showAlert,
  });

export const getChatMember = (token: string, chatId: string, userId: number) =>
  callApi<{ status: string }>(token, "getChatMember", {
    chat_id: chatId,
    user_id: userId,
  });

export type SendOptions = {
  chatId: number | string;
  text: string;
  parseMode?: string;
  mediaType?: "NONE" | "PHOTO" | "VIDEO" | "DOCUMENT" | "ANIMATION";
  /** URL yoki Telegram file_id. */
  mediaUrl?: string | null;
  /** Diskdagi fayl — ochiq havola bo'lmaganda Telegram'ga to'g'ridan-to'g'ri yuklanadi. */
  mediaFile?: { path: string; fileName: string } | null;
  replyMarkup?: unknown;
  disableNotification?: boolean;
  disableWebPagePreview?: boolean;
};

export type SendResult = {
  message_id: number;
  /** Fayl yuklangan bo'lsa — keyingi yuborishlarda qayta ishlatiladigan id. */
  fileId?: string;
};

type MediaResult = {
  message_id: number;
  photo?: { file_id: string }[];
  video?: { file_id: string };
  document?: { file_id: string };
  animation?: { file_id: string };
};

function extractFileId(r: MediaResult): string | undefined {
  if (r.photo?.length) return r.photo[r.photo.length - 1].file_id;
  return r.video?.file_id ?? r.document?.file_id ?? r.animation?.file_id;
}

/** Faylni multipart bilan yuklaydi — ochiq havola kerak emas. */
async function uploadFile(
  token: string,
  method: string,
  field: string,
  file: { path: string; fileName: string },
  fields: Record<string, unknown>
): Promise<MediaResult> {
  const { readFile } = await import("node:fs/promises");
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    form.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  form.append(field, new Blob([await readFile(file.path)]), file.fileName);

  const res = await fetch(`${API}/bot${token}/${method}`, { method: "POST", body: form });
  const raw = await res.text();
  let json: { ok: boolean; result?: MediaResult; description?: string; error_code?: number };
  try {
    json = JSON.parse(raw);
  } catch {
    throw new TelegramError(
      `${method}: Telegram JSON o'rniga ${res.status} javob qaytardi`,
      res.status,
      undefined,
      method
    );
  }
  if (!json.ok) {
    throw new TelegramError(
      json.description ?? "Fayl yuborilmadi",
      json.error_code ?? res.status,
      undefined,
      method
    );
  }
  return json.result!;
}

const MEDIA_METHOD: Record<string, { method: string; field: string }> = {
  PHOTO: { method: "sendPhoto", field: "photo" },
  VIDEO: { method: "sendVideo", field: "video" },
  DOCUMENT: { method: "sendDocument", field: "document" },
  ANIMATION: { method: "sendAnimation", field: "animation" },
};

/** Matn yoki media yuboradi — turini va yuborish usulini o'zi tanlaydi. */
export async function send(token: string, o: SendOptions): Promise<SendResult> {
  const parse_mode = !o.parseMode || o.parseMode === "None" ? undefined : o.parseMode;
  const media = o.mediaType && o.mediaType !== "NONE" ? MEDIA_METHOD[o.mediaType] : null;

  if (media) {
    const common = {
      chat_id: o.chatId,
      caption: o.text ? o.text.slice(0, 1024) : undefined,
      parse_mode,
      reply_markup: o.replyMarkup,
      disable_notification: o.disableNotification,
    };

    if (o.mediaFile) {
      const result = await uploadFile(token, media.method, media.field, o.mediaFile, common);
      return { message_id: result.message_id, fileId: extractFileId(result) };
    }

    if (o.mediaUrl) {
      const result = await callApi<MediaResult>(token, media.method, {
        ...common,
        [media.field]: o.mediaUrl,
      });
      return { message_id: result.message_id, fileId: extractFileId(result) };
    }
  }

  return callApi(token, "sendMessage", {
    chat_id: o.chatId,
    text: o.text.slice(0, 4096),
    parse_mode,
    reply_markup: o.replyMarkup,
    disable_notification: o.disableNotification,
    link_preview_options: o.disableWebPagePreview ? { is_disabled: true } : undefined,
  });
}

/** Mini App'dan kelgan initData'ni tekshirish (Telegram HMAC imzosi). */
export async function verifyInitData(
  token: string,
  initData: string
): Promise<TgUser | null> {
  const crypto = await import("node:crypto");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(token)
    .digest();
  const computed = crypto
    .createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date") ?? 0);
  if (Date.now() / 1000 - authDate > 86400) return null; // 24 soatdan eski

  try {
    return JSON.parse(params.get("user") ?? "null") as TgUser;
  } catch {
    return null;
  }
}
