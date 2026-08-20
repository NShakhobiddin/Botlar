/**
 * Fon ishlari: kunlik statistikani yig'ish, o'tkazib yuborilgan
 * rejalashtirilgan xabarlarni tiklash va eski hodisalarni tozalash.
 */
import { prisma } from "@/lib/db";
import { enqueueBroadcast } from "@/lib/queue";

const DAY = 86_400_000;

function dayStart(offsetDays = 0): Date {
  const d = new Date(Date.now() - offsetDays * DAY);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Bitta bot uchun bitta kunning ko'rsatkichlarini hisoblab yozadi. */
async function aggregateDay(botId: string, date: Date): Promise<void> {
  const next = new Date(date.getTime() + DAY);
  const range = { gte: date, lt: next };

  const [newUsers, blockedUsers, messages, webAppOpens, activeRows] = await Promise.all([
    prisma.botUser.count({ where: { botId, createdAt: range } }),
    prisma.botUser.count({ where: { botId, blockedAt: range } }),
    prisma.event.count({ where: { botId, type: "MESSAGE", createdAt: range } }),
    prisma.event.count({ where: { botId, type: "WEBAPP_OPEN", createdAt: range } }),
    prisma.event.findMany({
      where: { botId, createdAt: range, botUserId: { not: null } },
      distinct: ["botUserId"],
      select: { botUserId: true },
    }),
  ]);

  await prisma.dailyStat.upsert({
    where: { botId_date: { botId, date } },
    create: {
      botId,
      date,
      newUsers,
      blockedUsers,
      messages,
      webAppOpens,
      activeUsers: activeRows.length,
    },
    update: {
      newUsers,
      blockedUsers,
      messages,
      webAppOpens,
      activeUsers: activeRows.length,
    },
  });
}

/** Oxirgi `days` kunni qayta hisoblaydi (worker ishga tushganda — to'ldirish uchun). */
export async function aggregateStats(days = 2): Promise<number> {
  const bots = await prisma.bot.findMany({ select: { id: true } });
  let written = 0;
  for (const bot of bots) {
    for (let i = 0; i < days; i++) {
      await aggregateDay(bot.id, dayStart(i));
      written++;
    }
  }
  return written;
}

/**
 * Vaqti kelgan, lekin navbatda qolmagan xabarlarni qaytadan navbatga qo'yadi.
 * Redis tozalangan yoki worker uzoq o'chib turgan holatlar uchun.
 */
export async function sweepScheduled(): Promise<number> {
  const due = await prisma.broadcast.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date(Date.now() + 60_000) },
    },
    select: { id: true, scheduledAt: true },
    take: 50,
  });

  for (const b of due) {
    const delay = Math.max(0, (b.scheduledAt?.getTime() ?? 0) - Date.now());
    await enqueueBroadcast(b.id, delay).catch(() => {});
  }
  return due.length;
}

/** Eski hodisalarni o'chiradi — Event jadvali cheksiz o'smasin. */
export async function pruneEvents(): Promise<number> {
  const days = Number(process.env.EVENT_RETENTION_DAYS ?? 180);
  if (!Number.isFinite(days) || days <= 0) return 0;

  const { count } = await prisma.event.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - days * DAY) } },
  });
  return count;
}
