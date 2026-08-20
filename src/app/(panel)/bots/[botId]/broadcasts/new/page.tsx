import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
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

  const total = await prisma.botUser.count({
    where: { botId, isBlocked: false, isBanned: false },
  });

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
        createAction={createBroadcast.bind(null, botId)}
        countAction={countAudience}
      />
    </>
  );
}
