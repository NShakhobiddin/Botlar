import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { webAppStats, webAppTopEvents } from "@/lib/stats";
import { createWebApp, deleteWebApp } from "./actions";
import { RankChart } from "@/components/charts";
import { CopyBox } from "@/components/copy";
import { ActionForm, ConfirmButton, FormNotice, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Empty, Field, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WebAppsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  await requireBot(botId);

  const [apps, stats, topEvents] = await Promise.all([
    prisma.webApp.findMany({ where: { botId }, orderBy: { createdAt: "asc" } }),
    webAppStats(botId, 30),
    webAppTopEvents(botId, 30),
  ]);

  const appUrl = process.env.APP_URL ?? "https://panel.example.com";

  return (
    <div className="space-y-5">
      {apps.length === 0 ? (
        <Card>
          <Empty
            title="Web App ulanmagan"
            hint="Mini App'ni ulasangiz, uni kim ochgani, qancha vaqt ishlatgani va ichida nima qilgani shu yerda ko'rinadi."
          />
        </Card>
      ) : (
        apps.map((app) => {
          const s = stats.find((x) => x.id === app.id);
          const snippet = `<script src="${appUrl}/track.js" data-key="${app.trackKey}"></script>`;
          return (
            <Card key={app.id}>
              <CardHeader
                eyebrow={app.url}
                title={app.name}
                action={
                  <ConfirmButton
                    action={deleteWebApp.bind(null, botId, app.id)}
                    confirm={`"${app.name}" o'chirilsinmi? Yig'ilgan statistika ham o'chadi.`}
                  >
                    O&apos;chirish
                  </ConfirmButton>
                }
              />

              <div className="grid grid-cols-2 divide-x divide-y divide-ink-600 lg:grid-cols-4 lg:divide-y-0">
                <Stat label="Ochilishlar" value={s?.opens ?? 0} hint="30 kunda" />
                <Stat label="Noyob foydalanuvchi" value={s?.uniqueUsers ?? 0} tone="signal" />
                <Stat
                  label="O'rtacha sessiya"
                  value={formatDuration(s?.avgDurationSec ?? 0)}
                  tone="violet"
                />
                <Stat label="Hodisalar" value={s?.events ?? 0} tone="amber" />
              </div>

              <div className="border-t border-ink-600 p-5">
                <div className="eyebrow mb-2">Statistika kodi</div>
                <p className="mb-3 text-xs text-muted">
                  Shu qatorni Mini App&apos;ingizning <code className="font-mono text-amber-400">&lt;head&gt;</code>{" "}
                  qismiga qo&apos;ying. Maxsus hodisa yozish uchun:{" "}
                  <code className="font-mono text-amber-400">Botlar.track(&quot;checkout&quot;, {"{ summa: 250000 }"})</code>
                </p>
                <CopyBox text={snippet} />
              </div>
            </Card>
          );
        })
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Yangi" title="Web App qo'shish" />
          <ActionForm action={createWebApp.bind(null, botId)} className="space-y-4 p-5">
            <Field label="Nomi">
              <input name="name" required placeholder="Do'kon" />
            </Field>
            <Field label="Havola" hint="Telegram Mini App faqat HTTPS orqali ochiladi.">
              <input
                name="url"
                required
                placeholder="https://shop.example.uz"
                className="font-mono text-xs"
              />
            </Field>
            <FormNotice />
            <SubmitButton pendingLabel="Qo'shilmoqda…">Qo&apos;shish</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <CardHeader eyebrow="30 kun" title="Mini App ichidagi hodisalar" />
          {topEvents.length === 0 ? (
            <Empty
              title="Hodisa yozilmagan"
              hint="Botlar.track(...) chaqirilganda shu ro'yxat to'ladi."
            />
          ) : (
            <div className="p-3">
              <RankChart data={topEvents} height={240} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
