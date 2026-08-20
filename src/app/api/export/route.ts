import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { segmentWhere } from "@/lib/segment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Excel UTF-8 ni to'g'ri o'qishi uchun BOM
  return "﻿" + rows.map((r) => r.map(escape).join(";")).join("\n");
}

function attachment(body: string, name: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Obunachilar va yuborish hisobotlarini CSV ko'rinishida beradi. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const botId = url.searchParams.get("bot") ?? "";
  const type = url.searchParams.get("type") ?? "users";

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) return new NextResponse("Not found", { status: 404 });
  if (bot.ownerId !== user.id && user.role !== "OWNER") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const stamp = new Date().toISOString().slice(0, 10);

  if (type === "broadcast") {
    const broadcastId = url.searchParams.get("id") ?? "";
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: broadcastId, botId },
    });
    if (!broadcast) return new NextResponse("Not found", { status: 404 });

    const deliveries = await prisma.broadcastDelivery.findMany({
      where: { broadcastId },
      include: { botUser: { select: { telegramId: true, username: true, firstName: true } } },
      orderBy: { status: "asc" },
      take: 100_000,
    });

    const rows: (string | number | null)[][] = [
      ["telegram_id", "username", "ism", "holat", "xato", "vaqt"],
      ...deliveries.map((d) => [
        d.botUser.telegramId.toString(),
        d.botUser.username ?? "",
        d.botUser.firstName,
        d.status,
        d.error ?? "",
        d.sentAt?.toISOString() ?? "",
      ]),
    ];
    return attachment(csv(rows), `yuborish-${broadcast.name.slice(0, 30)}-${stamp}.csv`);
  }

  const segmentParam = url.searchParams.get("segment");
  let where;
  try {
    where = segmentParam
      ? segmentWhere(botId, JSON.parse(segmentParam))
      : { botId };
  } catch {
    where = { botId };
  }

  const users = await prisma.botUser.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100_000,
  });

  const rows: (string | number | null)[][] = [
    ["telegram_id", "username", "ism", "familiya", "telefon", "til", "xabarlar", "bloklagan", "ban", "qoshilgan", "oxirgi_faollik"],
    ...users.map((u) => [
      u.telegramId.toString(),
      u.username ?? "",
      u.firstName,
      u.lastName ?? "",
      u.phone ?? "",
      u.locale,
      u.messageCount,
      u.isBlocked ? "ha" : "yo'q",
      u.isBanned ? "ha" : "yo'q",
      u.createdAt.toISOString(),
      u.lastSeenAt.toISOString(),
    ]),
  ];
  return attachment(csv(rows), `obunachilar-${bot.username}-${stamp}.csv`);
}
