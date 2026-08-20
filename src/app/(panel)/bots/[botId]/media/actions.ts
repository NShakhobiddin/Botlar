"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, requireBot } from "@/lib/auth";
import { removeFile, storeFile } from "@/lib/media";
import type { ActionState } from "@/components/forms";

export async function uploadMedia(
  botId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { user } = await requireBot(botId);

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Fayl tanlanmadi" };

  const saved: string[] = [];
  for (const file of files) {
    try {
      const stored = await storeFile(file);
      await prisma.mediaAsset.create({
        data: {
          botId,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          size: stored.size,
          kind: stored.kind,
          publicKey: stored.publicKey,
        },
      });
      saved.push(stored.fileName);
    } catch (err) {
      return {
        error: `${file.name}: ${err instanceof Error ? err.message : "yuklanmadi"}`,
      };
    }
  }

  await audit(user.id, "media.upload", "MediaAsset", botId, { count: saved.length });
  revalidatePath(`/bots/${botId}/media`);
  return { ok: `${saved.length} ta fayl yuklandi` };
}

export async function deleteMedia(botId: string, assetId: string) {
  const { user } = await requireBot(botId);
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, botId } });
  if (!asset) return;

  await prisma.mediaAsset.delete({ where: { id: assetId } });
  await removeFile(asset.publicKey);
  await audit(user.id, "media.delete", "MediaAsset", assetId, { fileName: asset.fileName });
  revalidatePath(`/bots/${botId}/media`);
}
