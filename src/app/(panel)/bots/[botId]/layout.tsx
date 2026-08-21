import { requireBot } from "@/lib/auth";
import { hourlyActivity } from "@/lib/stats";
import { Tabs } from "@/components/nav";
import { Badge, SignalStrip } from "@/components/ui";

export default async function BotLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const signal = await hourlyActivity(botId);
  const base = `/bots/${botId}`;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="eyebrow mb-1.5">@{bot.username}</div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
            {bot.name}
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
          </h1>
        </div>
        <div className="w-full max-w-[260px]">
          <SignalStrip buckets={signal} />
          <div className="eyebrow mt-1.5 text-right">soatlik faollik · 24s</div>
        </div>
      </div>

      <div className="mb-6 border-b border-ink-600">
        <Tabs
          items={[
            { href: base, label: "Statistika", exact: true },
            { href: `${base}/content`, label: "Kontent" },
            { href: `${base}/broadcasts`, label: "Xabar yuborish" },
            { href: `${base}/users`, label: "Obunachilar" },
            { href: `${base}/media`, label: "Media" },
            { href: `${base}/webapps`, label: "Web App" },
            { href: `${base}/settings`, label: "Sozlamalar" },
          ]}
        />
      </div>

      {children}
    </>
  );
}
