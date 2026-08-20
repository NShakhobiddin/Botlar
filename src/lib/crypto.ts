import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY o'rnatilmagan. `openssl rand -hex 32` bilan yarating."
    );
  }
  const buf = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : crypto.createHash("sha256").update(raw).digest();
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY 32 bayt bo'lishi kerak");
  return buf;
}

export type Sealed = { cipher: string; iv: string; tag: string };

/** Bot tokenini shifrlash. Baza o'g'irlansa ham token ochilmaydi. */
export function seal(plain: string): Sealed {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGO, key(), iv);
  const cipher = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return {
    cipher: cipher.toString("base64"),
    iv: iv.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
  };
}

export function open(sealed: Sealed): string {
  const d = crypto.createDecipheriv(ALGO, key(), Buffer.from(sealed.iv, "base64"));
  d.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(sealed.cipher, "base64")),
    d.final(),
  ]).toString("utf8");
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Token oxirgi 4 belgisidan boshqasi yashiriladi: 12345:AAF…xyz9 */
export function maskToken(token: string): string {
  const [id, secret] = token.split(":");
  if (!secret) return "•".repeat(8);
  return `${id}:${secret.slice(0, 3)}${"•".repeat(6)}${secret.slice(-4)}`;
}
