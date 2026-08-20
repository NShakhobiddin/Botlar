import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { describeSegment } from "@/lib/segment";
import {
  Badge,
  Card,
  CardHeader,
  Empty,
  LinkButton,
  Table,
  Td,
  Th,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "neutral" | "live" | "warn" | "danger" | "info" }> = {
  DRAFT: { label: "Qoralama", tone: "neutral" },
  SCHEDULED: { label: "Rejalashtirilgan", tone: "info" },
  RUNNING: { label: "Yuborilmoqda", tone: "warn" },
  PAUSED: { label: "To'xtatilgan", tone: "warn" },
  DONE: { label: "Yuborilgan", tone: "live" },
  CANCELLED: { label: "Bekor qilingan", tone: "neutral" },
  FAILED: { label: "Xato", tone: "danger" },
};

export default async function BroadcastsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  await requireBot(botId);

  const broadcasts = await prisma.broadcast.findMany({
    where: { botId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <Card>
      <CardHeader
        eyebrow="Tarix"
        title="Xabar yuborish"
        action={
          <LinkButton tone="primary" href={`/bots/${botId}/broadcasts/new`}>
            Yangi xabar
          </LinkButton>
        }
      />

      {broadcasts.length === 0 ? (
        <Empty
          title="Hali xabar yuborilmagan"
          hint="Xabar tayyorlab, kimga borishini segment orqali tanlaysiz. Yuborishdan oldin o'zingizga sinov jo'natishingiz mumkin."
          action={
            <LinkButton tone="primary" href={`/bots/${botId}/broadcasts/new`}>
              Yangi xabar
            </LinkButton>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Xabar</Th>
              <Th>Holat</Th>
              <Th>Kimga</Th>
              <Th className="text-right">Yetdi</Th>
              <Th className="text-right">Bloklagan</Th>
              <Th className="text-right">Xato</Th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => {
              const s = STATUS[b.status] ?? STATUS.DRAFT;
              const pct = b.totalCount ? (b.sentCount / b.totalCount) * 100 : 0;
              return (
                <tr key={b.id} className="transition-colors hover:bg-ink-800">
                  <Td>
                    <Link href={`/bots/${botId}/broadcasts/${b.id}`} className="block">
                      <div className="font-medium">{b.name}</div>
                      <div className="truncate text-xs text-faint">
                        {b.text.replace(/<[^>]+>/g, "").slice(0, 70)}
                      </div>
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {b.status === "RUNNING" && (
                      <div className="mt-1.5 h-1 w-20 overflow-hidden rounded-full bg-ink-700">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </Td>
                  <Td className="max-w-[200px] truncate text-xs text-muted">
                    {describeSegment(b.segment)}
                  </Td>
                  <Td className="tabular text-right text-signal">{b.sentCount.toLocaleString("uz-UZ")}</Td>
                  <Td className="tabular text-right text-rose">{b.blockedCount.toLocaleString("uz-UZ")}</Td>
                  <Td className="tabular text-right text-muted">{b.failedCount.toLocaleString("uz-UZ")}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
