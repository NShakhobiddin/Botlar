import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { handleUpdate } from "@/lib/engine/handle";
import type { TgUpdate } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telegram webhook. Telegram 200'ni tez kutadi — shuning uchun javob darhol
 * qaytariladi, update esa `after()` ichida qayta ishlanadi.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot || !bot.isActive) {
    return NextResponse.json({ ok: true });
  }

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== bot.webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  after(async () => {
    try {
      await handleUpdate(bot, update);
    } catch (err) {
      console.error(`[webhook ${bot.username}]`, err);
    }
  });

  return NextResponse.json({ ok: true });
}
