// Faqat server tomonida ishlatiladi (Next server komponentlari va worker jarayoni).
import path from "node:path";
import { access } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { mediaDir, parseMediaRef, publicMediaUrl } from "@/lib/media";

export type ResolvedMedia = {
  mediaUrl?: string | null;
  mediaFile?: { path: string; fileName: string } | null;
  /** Fayl yuklangach file_id shu yozuvga saqlanadi. */
  assetId?: string;
};

/**
 * Saqlangan media qiymatini yuborishga tayyor ko'rinishga keltiradi.
 *
 * Tartib: avval Telegram file_id (eng tez), keyin diskdagi fayl
 * (ochiq havola kerak emas), oxirida ochiq havola.
 */
export async function resolveMedia(
  botId: string,
  value: string | null | undefined
): Promise<ResolvedMedia> {
  if (!value) return {};

  const key = parseMediaRef(value);
  if (!key) {
    // Tashqi havola yoki to'g'ridan-to'g'ri kiritilgan file_id
    return { mediaUrl: value };
  }

  const asset = await prisma.mediaAsset.findFirst({
    where: { publicKey: key, botId },
    select: { id: true, publicKey: true, fileName: true, telegramFileId: true },
  });
  if (!asset) return {};

  if (asset.telegramFileId) return { mediaUrl: asset.telegramFileId };

  const filePath = path.join(mediaDir(), asset.publicKey);
  try {
    await access(filePath);
    return {
      mediaFile: { path: filePath, fileName: asset.fileName },
      assetId: asset.id,
    };
  } catch {
    // Fayl diskda yo'q — ochiq havola qolgan yagona imkoniyat
    return { mediaUrl: publicMediaUrl(asset.publicKey) };
  }
}

/** Birinchi yuborishdan qaytgan file_id ni saqlaydi. */
export async function cacheFileId(assetId: string | undefined, fileId: string | undefined) {
  if (!assetId || !fileId) return;
  await prisma.mediaAsset
    .update({ where: { id: assetId }, data: { telegramFileId: fileId } })
    .catch(() => {});
}
