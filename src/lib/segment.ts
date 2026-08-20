import type { Prisma } from "@prisma/client";

export type Segment = {
  locales?: string[];
  /** Oxirgi N kun ichida faol bo'lganlar */
  activeDays?: number | null;
  /** Botni bloklaganlarni chiqarib tashlash (odatda true) */
  excludeBlocked?: boolean;
  /** Faqat Mini App ochganlar */
  openedWebApp?: boolean;
  joinedAfter?: string | null;
  joinedBefore?: string | null;
  /** Faqat telefon raqamini bergan foydalanuvchilar */
  hasPhone?: boolean;
};

export const DEFAULT_SEGMENT: Segment = { excludeBlocked: true };

/** Segmentni Prisma `where` shartiga aylantiradi. */
export function segmentWhere(botId: string, raw: unknown): Prisma.BotUserWhereInput {
  const s = { ...DEFAULT_SEGMENT, ...((raw as Segment) ?? {}) };
  const where: Prisma.BotUserWhereInput = { botId, isBanned: false };

  if (s.excludeBlocked !== false) where.isBlocked = false;
  if (s.locales?.length) where.locale = { in: s.locales };
  if (s.hasPhone) where.phone = { not: null };

  if (s.activeDays && s.activeDays > 0) {
    const since = new Date(Date.now() - s.activeDays * 86_400_000);
    where.lastSeenAt = { gte: since };
  }

  if (s.joinedAfter || s.joinedBefore) {
    where.createdAt = {};
    if (s.joinedAfter) where.createdAt.gte = new Date(s.joinedAfter);
    if (s.joinedBefore) where.createdAt.lte = new Date(s.joinedBefore);
  }

  if (s.openedWebApp) where.webAppSessions = { some: {} };

  return where;
}

export function describeSegment(raw: unknown): string {
  const s = { ...DEFAULT_SEGMENT, ...((raw as Segment) ?? {}) };
  const parts: string[] = [];
  if (s.locales?.length) parts.push(`til: ${s.locales.join(", ")}`);
  if (s.activeDays) parts.push(`oxirgi ${s.activeDays} kunda faol`);
  if (s.openedWebApp) parts.push("Mini App ochganlar");
  if (s.hasPhone) parts.push("telefon raqami bor");
  if (s.joinedAfter) parts.push(`${s.joinedAfter} dan keyin qo'shilgan`);
  if (s.joinedBefore) parts.push(`${s.joinedBefore} gacha qo'shilgan`);
  return parts.length ? parts.join(" · ") : "Barcha faol obunachilar";
}
