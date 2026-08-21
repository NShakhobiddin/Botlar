import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  Badge,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BotsPage() {
  const user = await requireUser();
  const bots = await prisma.bot.findMany({
    where: user.role === "OWNER" ? {} : { ownerId: user.id },
    include: { _count: { select: { users: true, screens: true, broadcasts: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <PageHeader
        eyebrow="Ro'yxat"
        title="Botlar"
        description="Har bir bot alohida kontent, obunachi bazasi va statistikaga ega."
        action={
          <LinkButton tone="primary" href="/bots/new">
            Bot qo'shish
          </LinkButton>
        }
      />

      <Card>
        {bots.length === 0 ? (
          <Empty
            title="Ro'yxat bo'sh"
            hint="Botni ulash uchun @BotFather bergan tokenni kiriting."
            action={
              <LinkButton tone="primary" href="/bots/new">
                Bot qo'shish
              </LinkButton>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Bot</Th>
                <Th>Holat</Th>
                <Th className="text-right">Obunachi</Th>
                <Th className="text-right">Ekran</Th>
                <Th className="text-right">Yuborish</Th>
              </tr>
            </thead>
            <tbody>
              {bots.map((bot) => (
                <tr key={bot.id} className="transition-colors hover:bg-ink-800">
                  <Td>
                    <Link href={`/bots/${bot.id}`} className="block">
                      <div className="font-medium">{bot.name}</div>
                      <div className="font-mono text-xs text-faint">@{bot.username}</div>
                    </Link>
                  </Td>
                  <Td>
                    {!bot.isActive ? (
                      <Badge>O'chirilgan</Badge>
                    ) : bot.maintenanceMode ? (
                      <Badge tone="warn">Texnik ish</Badge>
                    ) : bot.mode === "POLLING" ? (
                      <Badge tone="live">Polling</Badge>
                    ) : bot.webhookSetAt ? (
                      <Badge tone="live">Ishlayapti</Badge>
                    ) : (
                      <Badge tone="danger">Webhook yo'q</Badge>
                    )}
                  </Td>
                  <Td className="tabular text-right">{bot._count.users.toLocaleString("uz-UZ")}</Td>
                  <Td className="tabular text-right text-muted">{bot._count.screens}</Td>
                  <Td className="tabular text-right text-muted">{bot._count.broadcasts}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
