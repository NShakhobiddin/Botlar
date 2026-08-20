/**
 * Oddiy xotiradagi cheklagich — parolni terib topishga urinishlarga qarshi.
 * Bir nechta nusxa ishlayotganda har biri o'z hisobini yuritadi; bu himoyani
 * zaiflashtiradi, lekin hech qanday tashqi bog'liqlik qo'shmaydi.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export type RateResult = { ok: boolean; retryAfterSec: number; remaining: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();

  // Xotira cheksiz o'smasin — eskirganlarni tozalaymiz.
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0, remaining: limit - 1 };
  }

  bucket.count++;
  if (bucket.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
      remaining: 0,
    };
  }
  return { ok: true, retryAfterSec: 0, remaining: limit - bucket.count };
}

export function resetLimit(key: string): void {
  buckets.delete(key);
}
