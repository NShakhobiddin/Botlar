import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { mediaRef } from "@/lib/media";
import { countAudience, createBroadcast } from "../actions";
import { Composer } from "./composer";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewBroadcastPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);

  const [total, screens, assets] = await Promise.all([
    prisma.botUser.count({ where: { botId, isBlocked: false, isBanned: false } }),
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
        eyebrow="Yangi"
        title="Xabar tayyorlash"
        description="Xabar avval qoralama sifatida saqlanadi. Yuborish keyingi qadamda, sinov jo'natgandan so'ng boshlanadi."
      />
      <Composer
        botId={botId}
        locales={bot.locales}
        defaultTotal={total}
        action={createBroadcast.bind(null, botId)}
        countAction={countAudience}
        screens={screens}
        mediaOptions={assets.map((a) => ({
          url: mediaRef(a.publicKey),
          label: a.fileName,
          kind: a.kind,
        }))}
      />
    </>
  );
}
