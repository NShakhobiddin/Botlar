import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { isSafeKey, mediaDir } from "@/lib/media";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Yuklangan fayllarni tarqatadi. Ochiq endpoint — Telegram serverlari
 * media yuborish uchun shu havolani o'zi yuklab oladi.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  if (!isSafeKey(key)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const asset = await prisma.mediaAsset.findUnique({
    where: { publicKey: key },
    select: { mimeType: true, size: true, fileName: true },
  });
  if (!asset) return new NextResponse("Not found", { status: 404 });

  const filePath = path.join(mediaDir(), key);
  try {
    statSync(filePath);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const stream = createReadStream(filePath) as unknown as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${encodeURIComponent(asset.fileName)}"`,
    },
  });
}
