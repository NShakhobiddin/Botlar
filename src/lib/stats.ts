import "server-only";
import { prisma } from "@/lib/db";

const DAY = 86_400_000;

export type BotOverview = {
  total: number;
  active24h: number;
  active7d: number;
  active30d: number;
  blocked: number;
  newToday: number;
  new7d: number;
  new30d: number;
  growth7d: number; // oldingi 7 kunga nisbatan %
};

export async function botOverview(botId: string): Promise<BotOverview> {
  const now = Date.now();
  const since = (days: number) => new Date(now - days * DAY);

  const [total, active24h, active7d, active30d, blocked, newToday, new7d, prev7d] =
    await Promise.all([
      prisma.botUser.count({ where: { botId } }),
      prisma.botUser.count({ where: { botId, lastSeenAt: { gte: since(1) } } }),
      prisma.botUser.count({ where: { botId, lastSeenAt: { gte: since(7) } } }),
      prisma.botUser.count({ where: { botId, lastSeenAt: { gte: since(30) } } }),
      prisma.botUser.count({ where: { botId, isBlocked: true } }),
      prisma.botUser.count({ where: { botId, createdAt: { gte: startOfToday() } } }),
      prisma.botUser.count({ where: { botId, createdAt: { gte: since(7) } } }),
      prisma.botUser.count({
        where: { botId, createdAt: { gte: since(14), lt: since(7) } },
      }),
    ]);

  const new30d = await prisma.botUser.count({
    where: { botId, createdAt: { gte: since(30) } },
  });

  const growth7d = prev7d === 0 ? (new7d > 0 ? 100 : 0) : ((new7d - prev7d) / prev7d) * 100;

  return { total, active24h, active7d, active30d, blocked, newToday, new7d, new30d, growth7d };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type DayPoint = {
  date: string;
  newUsers: number;
  activeUsers: number;
  blocked: number;
};

/**
 * Kunlik o'sish grafigi uchun qator.
 * Qisqa oraliq — jonli so'rov (har doim aniq).
 * Uzoq oraliq — worker yig'gan DailyStat jadvalidan (tez).
 */
export async function dailySeries(botId: string, days = 30): Promise<DayPoint[]> {
  if (days > 45) return dailySeriesFromRollup(botId, days);
  return dailySeriesLive(botId, days);
}

async function dailySeriesFromRollup(botId: string, days: number): Promise<DayPoint[]> {
  const from = new Date(Date.now() - days * DAY);
  from.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.dailyStat.findMany({
    where: { botId, date: { gte: from } },
    orderBy: { date: "asc" },
  });
  const byDate = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));

  const out: DayPoint[] = [];
  for (let i = 0; i <= days; i++) {
    const key = new Date(from.getTime() + i * DAY).toISOString().slice(0, 10);
    const row = byDate.get(key);
    out.push({
      date: key,
      newUsers: row?.newUsers ?? 0,
      activeUsers: row?.activeUsers ?? 0,
      blocked: row?.blockedUsers ?? 0,
    });
  }
  return out;
}

async function dailySeriesLive(botId: string, days: number): Promise<DayPoint[]> {
  const from = new Date(Date.now() - days * DAY);
  from.setHours(0, 0, 0, 0);

  const [joins, actives, blocks] = await Promise.all([
    prisma.$queryRaw<{ d: Date; c: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS d, COUNT(*) AS c
      FROM "BotUser" WHERE "botId" = ${botId} AND "createdAt" >= ${from}
      GROUP BY 1`,
    prisma.$queryRaw<{ d: Date; c: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS d, COUNT(DISTINCT "botUserId") AS c
      FROM "Event" WHERE "botId" = ${botId} AND "createdAt" >= ${from}
      GROUP BY 1`,
    prisma.$queryRaw<{ d: Date; c: bigint }[]>`
      SELECT date_trunc('day', "blockedAt") AS d, COUNT(*) AS c
      FROM "BotUser" WHERE "botId" = ${botId} AND "blockedAt" >= ${from}
      GROUP BY 1`,
  ]);

  const index = (rows: { d: Date; c: bigint }[]) =>
    new Map(rows.map((r) => [r.d.toISOString().slice(0, 10), Number(r.c)]));
  const j = index(joins);
  const a = index(actives);
  const b = index(blocks);

  const out: DayPoint[] = [];
  for (let i = 0; i <= days; i++) {
    const key = new Date(from.getTime() + i * DAY).toISOString().slice(0, 10);
    out.push({
      date: key,
      newUsers: j.get(key) ?? 0,
      activeUsers: a.get(key) ?? 0,
      blocked: b.get(key) ?? 0,
    });
  }
  return out;
}

/** Signal chizig'i uchun oxirgi 24 soatlik hodisalar. */
export async function hourlyActivity(botId: string, hours = 24): Promise<number[]> {
  const from = new Date(Date.now() - hours * 3_600_000);
  const rows = await prisma.$queryRaw<{ h: Date; c: bigint }[]>`
    SELECT date_trunc('hour', "createdAt") AS h, COUNT(*) AS c
    FROM "Event" WHERE "botId" = ${botId} AND "createdAt" >= ${from}
    GROUP BY 1`;

  const map = new Map(rows.map((r) => [r.h.toISOString().slice(0, 13), Number(r.c)]));
  const out: number[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    const key = new Date(Date.now() - i * 3_600_000).toISOString().slice(0, 13);
    out.push(map.get(key) ?? 0);
  }
  return out;
}

export async function topScreens(botId: string, days = 7) {
  const from = new Date(Date.now() - days * DAY);
  const rows = await prisma.event.groupBy({
    by: ["name"],
    where: { botId, type: "SCREEN_VIEW", createdAt: { gte: from } },
    _count: { name: true },
    orderBy: { _count: { name: "desc" } },
    take: 8,
  });
  return rows.map((r) => ({ name: r.name || "—", count: r._count.name }));
}

export async function topCommands(botId: string, days = 7) {
  const from = new Date(Date.now() - days * DAY);
  const rows = await prisma.event.groupBy({
    by: ["name"],
    where: { botId, type: { in: ["COMMAND", "START"] }, createdAt: { gte: from } },
    _count: { name: true },
    orderBy: { _count: { name: "desc" } },
    take: 8,
  });
  return rows.map((r) => ({ name: `/${r.name || "start"}`, count: r._count.name }));
}

export async function localeBreakdown(botId: string) {
  const rows = await prisma.botUser.groupBy({
    by: ["locale"],
    where: { botId },
    _count: { locale: true },
    orderBy: { _count: { locale: "desc" } },
  });
  return rows.map((r) => ({ locale: r.locale, count: r._count.locale }));
}

export type WebAppStats = {
  id: string;
  name: string;
  url: string;
  opens: number;
  uniqueUsers: number;
  avgDurationSec: number;
  events: number;
};

export async function webAppStats(botId: string, days = 30): Promise<WebAppStats[]> {
  const from = new Date(Date.now() - days * DAY);
  const apps = await prisma.webApp.findMany({ where: { botId } });

  return Promise.all(
    apps.map(async (app) => {
      const [opens, sessions, events, unique] = await Promise.all([
        prisma.webAppSession.count({
          where: { webAppId: app.id, startedAt: { gte: from } },
        }),
        prisma.webAppSession.aggregate({
          where: { webAppId: app.id, startedAt: { gte: from } },
          _avg: { durationMs: true },
        }),
        prisma.event.count({
          where: { webAppId: app.id, type: "WEBAPP_EVENT", createdAt: { gte: from } },
        }),
        prisma.webAppSession.findMany({
          where: { webAppId: app.id, startedAt: { gte: from } },
          distinct: ["telegramId"],
          select: { id: true },
        }),
      ]);
      return {
        id: app.id,
        name: app.name,
        url: app.url,
        opens,
        uniqueUsers: unique.length,
        avgDurationSec: Math.round((sessions._avg.durationMs ?? 0) / 1000),
        events,
      };
    })
  );
}

/** Mini App ichidagi custom eventlar reytingi. */
export async function webAppTopEvents(botId: string, days = 30) {
  const from = new Date(Date.now() - days * DAY);
  const rows = await prisma.event.groupBy({
    by: ["name"],
    where: { botId, type: "WEBAPP_EVENT", createdAt: { gte: from } },
    _count: { name: true },
    orderBy: { _count: { name: "desc" } },
    take: 10,
  });
  return rows.map((r) => ({ name: r.name || "—", count: r._count.name }));
}
