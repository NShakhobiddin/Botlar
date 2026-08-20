import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { deleteButton, updateButton } from "../../../actions";
import { ButtonFields } from "../../../button-fields";
import { ActionForm, ConfirmButton, FormNotice, SubmitButton } from "@/components/forms";
import { Card, CardHeader, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ButtonEditPage({
  params,
}: {
  params: Promise<{ botId: string; screenId: string; buttonId: string }>;
}) {
  const { botId, screenId, buttonId } = await params;
  const { bot } = await requireBot(botId);

  const button = await prisma.button.findFirst({
    where: { id: buttonId, screenId, screen: { botId } },
    include: { screen: { select: { name: true } } },
  });
  if (!button) notFound();

  const [screens, webApps] = await Promise.all([
    prisma.screen.findMany({
      where: { botId },
      select: { id: true, key: true, name: true },
      orderBy: { key: "asc" },
    }),
    prisma.webApp.findMany({
      where: { botId, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-5">
      <Link
        href={`/bots/${botId}/content/${screenId}`}
        className="inline-block text-xs text-muted transition-colors hover:text-text"
      >
        ← {button.screen.name}
      </Link>

      <PageHeader
        eyebrow={`qator ${button.row} · o'rin ${button.col}`}
        title="Tugmani tahrirlash"
      />

      <Card>
        <CardHeader eyebrow="Tugma" title="Sozlamalar" />
        <ActionForm
          action={updateButton.bind(null, botId, screenId, buttonId)}
          className="space-y-4 p-5"
        >
          <ButtonFields
            locales={bot.locales}
            screens={screens}
            webApps={webApps}
            defaults={{
              labels: button.labels as Record<string, string>,
              action: button.action,
              url: button.url,
              targetScreenId: button.targetScreenId,
              webAppId: button.webAppId,
            }}
          />
          <FormNotice />
          <SubmitButton>Saqlash</SubmitButton>
        </ActionForm>
      </Card>

      <Card className="border-rose/25">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="text-xs text-muted">
            Tugma o&apos;chirilsa, undan keyingi tugmalar o&apos;z joyida qoladi.
          </p>
          <ConfirmButton
            action={deleteButton.bind(null, botId, screenId, buttonId)}
            confirm="Tugma o'chirilsinmi?"
          >
            Tugmani o&apos;chirish
          </ConfirmButton>
        </div>
      </Card>
    </div>
  );
}
