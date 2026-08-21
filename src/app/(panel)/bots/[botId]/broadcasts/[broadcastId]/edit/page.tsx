import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { mediaRef } from "@/lib/media";
import type { Segment } from "@/lib/segment";
import { countAudience, updateBroadcast } from "../../actions";
import { Composer } from "../../new/composer";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/** datetime-local maydoni uchun mahalliy vaqt ko'rinishi. */
function toLocalInput(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditBroadcastPage({
  params,
}: {
  params: Promise<{ botId: string; broadcastId: string }>;
}) {
  const { botId, broadcastId } = await params;
  const { bot } = await requireBot(botId);

  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, botId },
  });
  if (!broadcast) notFound();
  if (!["DRAFT", "PAUSED", "SCHEDULED", "FAILED"].includes(broadcast.status)) {
    redirect(`/bots/${botId}/broadcasts/${broadcastId}`);
  }

  const [screens, assets] = await Promise.all([
    prisma.screen.findMany({
      where: { botId },
      select: { id: true, name: true },
      orderBy: { key: "asc" },
    }),
    prisma.mediaAsset.findMany({ where: { botId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Tahrirlash"
        title={broadcast.name}
        description="O'zgartirishlar saqlangach yuborish sahifasiga qaytasiz."
      />
      <Composer
        botId={botId}
        locales={bot.locales}
        defaultTotal={broadcast.totalCount}
        action={updateBroadcast.bind(null, botId, broadcastId)}
        countAction={countAudience}
        screens={screens}
        mediaOptions={assets.map((a) => ({
          url: mediaRef(a.publicKey),
          label: a.fileName,
          kind: a.kind,
        }))}
        submitLabel="O'zgarishlarni saqlash"
        initial={{
          name: broadcast.name,
          text: broadcast.text,
          parseMode: broadcast.parseMode,
          mediaType: broadcast.mediaType,
          mediaUrl: broadcast.mediaUrl,
          buttons: Array.isArray(broadcast.buttons)
            ? (broadcast.buttons as { label: string; url: string }[])
            : [],
          disableNotification: broadcast.disableNotification,
          scheduledAt: toLocalInput(broadcast.scheduledAt),
          screenId: broadcast.screenId,
          segment: (broadcast.segment ?? {}) as Segment,
        }}
      />
    </>
  );
}
