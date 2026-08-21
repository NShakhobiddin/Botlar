import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { describeAllowed, formatSize, mediaRef, publicMediaUrl } from "@/lib/media";
import { deleteMedia, uploadMedia } from "./actions";
import { UploadForm } from "./upload-form";
import { CopyBox } from "@/components/copy";
import { ConfirmButton } from "@/components/forms";
import { Badge, Card, CardHeader, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  PHOTO: "Rasm",
  VIDEO: "Video",
  ANIMATION: "GIF",
  DOCUMENT: "Fayl",
  NONE: "—",
};

export default async function MediaPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  await requireBot(botId);

  const assets = await prisma.mediaAsset.findMany({
    where: { botId },
    orderBy: { createdAt: "desc" },
  });
  const totalSize = assets.reduce((sum, a) => sum + a.size, 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          eyebrow="Yuklash"
          title="Media kutubxonasi"
          action={
            <span className="text-xs text-faint">
              {assets.length} ta fayl · {formatSize(totalSize)}
            </span>
          }
        />
        <div className="p-5">
          <UploadForm action={uploadMedia.bind(null, botId)} allowed={describeAllowed()} />
        </div>
      </Card>

      {assets.length === 0 ? (
        <Card>
          <Empty
            title="Kutubxona bo'sh"
            hint="Yuklangan fayllar ekranlar va xabarlarda ro'yxatdan tanlanadi — havolani qo'lda yozish shart emas."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const ref = mediaRef(asset.publicKey);
            const url = publicMediaUrl(asset.publicKey);
            return (
              <Card key={asset.id} className="overflow-hidden">
                <div className="flex h-40 items-center justify-center border-b border-ink-600 bg-ink-950">
                  {asset.kind === "PHOTO" || asset.kind === "ANIMATION" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/media/${asset.publicKey}`}
                      alt={asset.fileName}
                      className="max-h-40 max-w-full object-contain"
                    />
                  ) : (
                    <div className="font-mono text-3xl text-faint">
                      {asset.kind === "VIDEO" ? "▶" : "🗎"}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{asset.fileName}</div>
                      <div className="mt-0.5 text-xs text-faint">
                        {formatSize(asset.size)} ·{" "}
                        {asset.createdAt.toLocaleDateString("uz-UZ")}
                      </div>
                    </div>
                    <Badge>{KIND_LABEL[asset.kind]}</Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="eyebrow">Kontentga qo&apos;yish uchun</div>
                    <CopyBox text={ref} />
                    {url && (
                      <details className="text-xs text-faint">
                        <summary className="cursor-pointer">Ochiq havola</summary>
                        <div className="mt-1.5">
                          <CopyBox text={url} />
                        </div>
                      </details>
                    )}
                  </div>

                  <ConfirmButton
                    action={deleteMedia.bind(null, botId, asset.id)}
                    confirm={`"${asset.fileName}" o'chirilsinmi? Bu faylga ishora qiluvchi ekranlar media'siz qoladi.`}
                    tone="quiet"
                  >
                    O&apos;chirish
                  </ConfirmButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
