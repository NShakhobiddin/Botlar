import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { botToken } from "@/lib/bots";
import { verifyInitData } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type Body = {
  key: string;
  initData?: string;
  type: "open" | "event" | "ping" | "close";
  name?: string;
  payload?: Record<string, unknown>;
  sessionId?: string;
  durationMs?: number;
  platform?: string;
};

/**
 * Mini App'lardan statistika qabul qiladi.
 * Ochiq endpoint, lekin har so'rov Telegram initData imzosi bilan tekshiriladi.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  if (!body.key || !body.type) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  const app = await prisma.webApp.findUnique({
    where: { trackKey: body.key },
    include: { bot: true },
  });
  if (!app || !app.isActive) {
    return NextResponse.json({ ok: false }, { status: 404, headers: CORS });
  }

  // `open` va `event` yozuvlari faqat Telegram imzosi bilan qabul qilinadi.
  // trackKey ochiq bo'lgani uchun imzosiz so'rovlar statistikani buzishi mumkin edi.
  const needsSignature = body.type === "open" || body.type === "event";
  const tgUser = body.initData
    ? await verifyInitData(botToken(app.bot), body.initData)
    : null;

  if (needsSignature && !tgUser) {
    return NextResponse.json(
      { ok: false, error: "initData imzosi tekshiruvdan o'tmadi" },
      { status: 401, headers: CORS }
    );
  }

  const botUser = tgUser
    ? await prisma.botUser.findUnique({
        where: { botId_telegramId: { botId: app.botId, telegramId: BigInt(tgUser.id) } },
        select: { id: true },
      })
    : null;

  if (body.type === "open") {
    const session = await prisma.webAppSession.create({
      data: {
        webAppId: app.id,
        botUserId: botUser?.id ?? null,
        telegramId: BigInt(tgUser!.id),
        platform: (body.platform ?? "unknown").slice(0, 40),
      },
    });
    await prisma.event.create({
      data: {
        botId: app.botId,
        botUserId: botUser?.id ?? null,
        webAppId: app.id,
        type: "WEBAPP_OPEN",
        name: app.name,
      },
    });
    return NextResponse.json({ ok: true, sessionId: session.id }, { headers: CORS });
  }

  if (!body.sessionId) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  if (body.type === "ping" || body.type === "close") {
    await prisma.webAppSession
      .updateMany({
        where: { id: body.sessionId, webAppId: app.id },
        data: {
          lastPingAt: new Date(),
          durationMs: Math.max(0, Math.min(body.durationMs ?? 0, 6 * 3_600_000)),
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true }, { headers: CORS });
  }

  if (body.type === "event") {
    await prisma.$transaction([
      prisma.event.create({
        data: {
          botId: app.botId,
          botUserId: botUser?.id ?? null,
          webAppId: app.id,
          type: "WEBAPP_EVENT",
          name: (body.name ?? "event").slice(0, 100),
          payload: (body.payload ?? {}) as never,
        },
      }),
      prisma.webAppSession.updateMany({
        where: { id: body.sessionId, webAppId: app.id },
        data: { eventCount: { increment: 1 }, lastPingAt: new Date() },
      }),
    ]);
    return NextResponse.json({ ok: true }, { headers: CORS });
  }

  return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
}
