import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { botOverview, hourlyActivity } from "@/lib/stats";
import {
  Badge,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  SignalStrip,
  Stat,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const user = await requireUser();
  const bots = await prisma.bot.findMany({
    where: user.role === "OWNER" ? {} : { ownerId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (bots.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Boshqaruv"
          title={`Salom, ${user.name.split(" ")[0]}`}
          description="Birinchi botingizni ulang — token kiritishingiz bilan webhook o'rnatiladi va bot ishlay boshlaydi."
        />
        <Card>
          <Empty
            title="Hali bot ulanmagan"
            hint="@BotFather'dan olgan tokeningizni kiriting. Token shifrlangan holda saqlanadi."
            action={
              <LinkButton tone="primary" href="/bots/new">
                Bot qo'shish
              </LinkButton>
            }
          />
        </Card>
      </>
    );
  }

  const cards = await Promise.all(
    bots.map(async (bot) => ({
      bot,
      stats: await botOverview(bot.id),
      signal: await hourlyActivity(bot.id),
      running: await prisma.broadcast.count({
        where: { botId: bot.id, status: { in: ["RUNNING", "SCHEDULED"] } },
      }),
    }))
  );

  const totals = cards.reduce(
    (acc, c) => ({
      users: acc.users + c.stats.total,
      active: acc.active + c.stats.active7d,
      newToday: acc.newToday + c.stats.newToday,
      blocked: acc.blocked + c.stats.blocked,
    }),
    { users: 0, active: 0, newToday: 0, blocked: 0 }
  );

  return (
    <>
      <PageHeader
        eyebrow="Boshqaruv"
        title={`Salom, ${user.name.split(" ")[0]}`}
        description={`${bots.length} ta bot ulangan. Quyida oxirgi 24 soatdagi faollik.`}
        action={
          <LinkButton tone="primary" href="/bots/new">
            Bot qo'shish
          </LinkButton>
        }
      />

      <Card className="mb-6 grid grid-cols-2 divide-x divide-y divide-ink-600 md:grid-cols-4 md:divide-y-0">
        <Stat label="Jami obunachi" value={totals.users} />
        <Stat label="7 kunda faol" value={totals.active} tone="signal" />
        <Stat label="Bugun qo'shilgan" value={totals.newToday} tone="amber" />
        <Stat label="Bloklaganlar" value={totals.blocked} tone="rose" />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map(({ bot, stats, signal, running }) => (
          <Link key={bot.id} href={`/bots/${bot.id}`} className="group">
            <Card className="h-full transition-colors group-hover:border-ink-600 group-hover:bg-ink-800">
              <div className="flex items-start justify-between gap-3 px-5 pt-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        bot.isActive
                          ? "pulse size-1.5 rounded-full bg-signal text-signal"
                          : "size-1.5 rounded-full bg-faint"
                      }
                    />
                    <h3 className="truncate font-semibold">{bot.name}</h3>
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-faint">
                    @{bot.username}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {bot.maintenanceMode && <Badge tone="warn">Texnik ish</Badge>}
                  {running > 0 && <Badge tone="info">{running} ta yuborish</Badge>}
                  {bot.mode === "POLLING" ? (
                    <Badge tone="live">Polling</Badge>
                  ) : (
                    !bot.webhookSetAt && <Badge tone="danger">Webhook yo'q</Badge>
                  )}
                </div>
              </div>

              <div className="px-5 py-3.5">
                <SignalStrip buckets={signal} />
                <div className="eyebrow mt-1.5">oxirgi 24 soat</div>
              </div>

              <div className="grid grid-cols-3 border-t border-ink-600 divide-x divide-ink-600">
                <Stat label="Obunachi" value={stats.total} />
                <Stat label="24s faol" value={stats.active24h} tone="signal" />
                <Stat
                  label="7 kun o'sish"
                  value={`${stats.growth7d >= 0 ? "+" : ""}${stats.growth7d.toFixed(0)}%`}
                  tone={stats.growth7d >= 0 ? "signal" : "rose"}
                  hint={`${stats.new7d} ta yangi`}
                />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
