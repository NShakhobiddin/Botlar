import Link from "next/link";
import clsx from "clsx";
import { requireBot } from "@/lib/auth";
import {
  botOverview,
  dailySeries,
  localeBreakdown,
  topCommands,
  topScreens,
} from "@/lib/stats";
import { BlockedChart, GrowthChart, RankChart } from "@/components/charts";
import { Card, CardHeader, Empty, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

export default async function BotStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { botId } = await params;
  const { range } = await searchParams;
  await requireBot(botId);

  const days = RANGES.includes(Number(range) as never) ? Number(range) : 30;

  const [stats, series, commands, screens, locales] = await Promise.all([
    botOverview(botId),
    dailySeries(botId, days),
    topCommands(botId, days),
    topScreens(botId, days),
    localeBreakdown(botId),
  ]);

  const retention =
    stats.total === 0 ? 0 : ((stats.total - stats.blocked) / stats.total) * 100;

  return (
    <div className="space-y-5">
      <Card className="grid grid-cols-2 divide-x divide-y divide-ink-600 lg:grid-cols-4 lg:divide-y-0">
        <Stat label="Jami obunachi" value={stats.total} hint={`${stats.new30d} ta — 30 kunda`} />
        <Stat label="Kunlik faol (DAU)" value={stats.active24h} tone="signal" />
        <Stat label="Oylik faol (MAU)" value={stats.active30d} tone="signal" />
        <Stat
          label="Bazada qolganlar"
          value={`${retention.toFixed(1)}%`}
          hint={`${stats.blocked} ta bloklagan`}
          tone={retention > 90 ? "signal" : "rose"}
        />
      </Card>

      <Card>
        <CardHeader
          eyebrow={`${days} kun`}
          title="Obunachilar o'sishi"
          action={
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-3 text-xs text-muted sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" /> Yangi
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-signal" /> Faol
                </span>
              </div>
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <Link
                    key={r}
                    href={`/bots/${botId}?range=${r}`}
                    className={clsx(
                      "rounded-[6px] px-2.5 py-1 font-mono text-xs transition-colors",
                      r === days ? "bg-ink-700 text-text" : "text-faint hover:text-text"
                    )}
                  >
                    {r}k
                  </Link>
                ))}
              </div>
            </div>
          }
        />
        <div className="p-3">
          <GrowthChart data={series} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow={`${days} kun`} title="Eng ko'p ishlatilgan buyruqlar" />
          {commands.length === 0 ? (
            <Empty title="Ma'lumot yig'ilmagan" hint="Bot ishga tushgach shu yerda ko'rinadi." />
          ) : (
            <div className="p-3">
              <RankChart data={commands} />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader eyebrow={`${days} kun`} title="Eng ko'p ochilgan ekranlar" />
          {screens.length === 0 ? (
            <Empty title="Ma'lumot yig'ilmagan" hint="Foydalanuvchilar tugmalarni bosgach to'ladi." />
          ) : (
            <div className="p-3">
              <RankChart data={screens} />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader eyebrow={`${days} kun`} title="Botni bloklaganlar" />
          <div className="p-3">
            <BlockedChart data={series} />
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Hozirgi holat" title="Tillar bo'yicha taqsimot" />
          <div className="divide-y divide-ink-800">
            {locales.map((l) => {
              const pct = stats.total ? (l.count / stats.total) * 100 : 0;
              return (
                <div key={l.locale} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-8 font-mono text-xs uppercase text-muted">
                    {l.locale}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="tabular w-20 text-right text-sm">
                    {l.count.toLocaleString("uz-UZ")}
                  </span>
                  <span className="tabular w-12 text-right text-xs text-faint">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
            {locales.length === 0 && <Empty title="Obunachilar yo'q" />}
          </div>
        </Card>
      </div>
    </div>
  );
}
