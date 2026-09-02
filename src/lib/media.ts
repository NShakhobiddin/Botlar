// Faqat server tomonida ishlatiladi (Next server komponentlari va worker jarayoni).
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "@/lib/crypto";
import type { MediaType } from "@prisma/client";

/** Yuklangan fayllar shu papkada yotadi (Docker'da volume sifatida ulanadi). */
export function mediaDir(): string {
  return path.resolve(process.env.MEDIA_DIR ?? "./data/media");
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/** Telegram qabul qiladigan turlar. */
const ALLOWED: Record<string, { kind: MediaType; ext: string }> = {
  "image/jpeg": { kind: "PHOTO", ext: "jpg" },
  "image/png": { kind: "PHOTO", ext: "png" },
  "image/webp": { kind: "PHOTO", ext: "webp" },
  "image/gif": { kind: "ANIMATION", ext: "gif" },
  "video/mp4": { kind: "VIDEO", ext: "mp4" },
  "video/quicktime": { kind: "VIDEO", ext: "mov" },
  "application/pdf": { kind: "DOCUMENT", ext: "pdf" },
  "application/zip": { kind: "DOCUMENT", ext: "zip" },
  "audio/mpeg": { kind: "DOCUMENT", ext: "mp3" },
};

export function describeAllowed(): string {
  return "JPG, PNG, WEBP, GIF, MP4, MOV, PDF, ZIP, MP3";
}

export type StoredFile = {
  publicKey: string;
  kind: MediaType;
  mimeType: string;
  size: number;
  fileName: string;
};

/** Faylni diskka yozadi va ochiq havola kalitini qaytaradi. */
export async function storeFile(file: File): Promise<StoredFile> {
  const spec = ALLOWED[file.type];
  if (!spec) {
    throw new Error(`Bu fayl turi qo'llab-quvvatlanmaydi. Ruxsat berilgan: ${describeAllowed()}`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Fayl juda katta (${Math.round(file.size / 1024 / 1024)} MB). Chegara — 20 MB.`);
  }
  if (file.size === 0) throw new Error("Fayl bo'sh");

  const publicKey = `${randomToken(16)}.${spec.ext}`;
  const dir = mediaDir();
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, publicKey), Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      throw new Error(
        `Fayllar papkasiga yozib bo'lmadi (${dir}). Papka ruxsatlarini tekshiring.`
      );
    }
    if (code === "ENOSPC") throw new Error("Diskda joy qolmadi");
    throw err;
  }

  return {
    publicKey,
    kind: spec.kind,
    mimeType: file.type,
    size: file.size,
    fileName: file.name.slice(0, 200) || publicKey,
  };
}

export async function removeFile(publicKey: string): Promise<void> {
  if (!isSafeKey(publicKey)) return;
  await unlink(path.join(mediaDir(), publicKey)).catch(() => {});
}

/** Havola kalitida papkadan chiqib ketuvchi belgilar bo'lmasligi kerak. */
export function isSafeKey(key: string): boolean {
  return /^[A-Za-z0-9_-]{10,64}\.[a-z0-9]{2,5}$/.test(key);
}

/**
 * Kontent ichida saqlanadigan ko'chma ishora.
 * Ochiq havolaga bog'lanmagani uchun domen o'zgarsa ham ishlayveradi
 * va polling rejimida (domensiz) ham to'g'ri hal qilinadi.
 */
export function mediaRef(publicKey: string): string {
  return `media:${publicKey}`;
}

/** Saqlangan qiymatdan fayl kalitini ajratadi. Boshqa qiymatlar uchun null. */
export function parseMediaRef(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("media:")) {
    const key = value.slice(6);
    return isSafeKey(key) ? key : null;
  }
  const match = value.match(/\/api\/media\/([A-Za-z0-9_-]+\.[a-z0-9]+)$/);
  return match && isSafeKey(match[1]) ? match[1] : null;
}

/** Ochiq havola — faqat APP_URL o'rnatilgan bo'lsa. */
export function publicMediaUrl(publicKey: string): string | null {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return base ? `${base}/api/media/${publicKey}` : null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
