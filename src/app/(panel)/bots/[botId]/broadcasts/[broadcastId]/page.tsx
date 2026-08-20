import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { describeSegment } from "@/lib/segment";
import {
  cancelBroadcast,
  pauseBroadcast,
  sendTest,
  startBroadcast,
} from "../actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, ConfirmButton, FormNotice, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Field, Stat } from "@/components/ui";

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

export default async function BroadcastPage({
  params,
}: {
  params: Promise<{ botId: string; broadcastId: string }>;
}) {
  const { botId, broadcastId } = await params;
  await requireBot(botId);

  const broadcast = await prisma.broadcast.findFirst({
    where: { id: broadcastId, botId },
  });
  if (!broadcast) notFound();

  const failures = await prisma.broadcastDelivery.findMany({
    where: { broadcastId, status: "FAILED" },
    include: { botUser: { select: { telegramId: true, username: true } } },
    take: 10,
  });

  const s = STATUS[broadcast.status];
  const done = broadcast.sentCount + broadcast.failedCount + broadcast.blockedCount;
  const pct = broadcast.totalCount ? (done / broadcast.totalCount) * 100 : 0;
  const live = broadcast.status === "RUNNING" || broadcast.status === "SCHEDULED";
  const canStart = ["DRAFT", "PAUSED", "FAILED"].includes(broadcast.status);

  const buttons = Array.isArray(broadcast.buttons)
    ? (broadcast.buttons as { label: string; url: string }[])
    : [];

  async function start() {
    "use server";
    await startBroadcast(botId, broadcastId);
  }

  return (
    <div className="space-y-5">
      {live && <AutoRefresh />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/bots/${botId}/broadcasts`}
          className="text-xs text-muted transition-colors hover:text-text"
        >
          ← Barcha xabarlar
        </Link>
        <div className="flex items-center gap-2">
          {canStart && (
            <ConfirmButton
              action={start}
              confirm={
                broadcast.scheduledAt
                  ? `Xabar ${broadcast.scheduledAt.toLocaleString("uz-UZ")} da ${broadcast.totalCount} ta odamga yuboriladi. Davom etamizmi?`
                  : `Xabar hoziroq ${broadcast.totalCount} ta odamga yuboriladi. Bu amalni qaytarib bo'lmaydi. Davom etamizmi?`
              }
              tone="primary"
            >
              {broadcast.scheduledAt ? "Rejaga qo'yish" : "Hoziroq yuborish"}
            </ConfirmButton>
          )}
          {broadcast.status === "RUNNING" && (
            <ConfirmButton
              action={pauseBroadcast.bind(null, botId, broadcastId)}
              confirm="Yuborish to'xtatilsinmi? Keyinroq davom ettirish mumkin."
              tone="ghost"
            >
              To&apos;xtatish
            </ConfirmButton>
          )}
          {broadcast.status !== "DONE" && broadcast.status !== "CANCELLED" && (
            <ConfirmButton
              action={cancelBroadcast.bind(null, botId, broadcastId)}
              confirm="Xabar butunlay bekor qilinsinmi?"
            >
              Bekor qilish
            </ConfirmButton>
          )}
        </div>
      </div>

      <Card>
        <CardHeader
          eyebrow={describeSegment(broadcast.segment)}
          title={broadcast.name}
          action={<Badge tone={s.tone}>{s.label}</Badge>}
        />

        <div className="grid grid-cols-2 divide-x divide-y divide-ink-600 lg:grid-cols-4 lg:divide-y-0">
          <Stat label="Auditoriya" value={broadcast.totalCount} />
          <Stat label="Yetkazildi" value={broadcast.sentCount} tone="signal" />
          <Stat
            label="Bloklaganlar"
            value={broadcast.blockedCount}
            tone="rose"
            hint="Bu foydalanuvchilar bazada bloklangan deb belgilandi"
          />
          <Stat label="Xato" value={broadcast.failedCount} tone="amber" />
        </div>

        {broadcast.totalCount > 0 && (
          <div className="border-t border-ink-600 px-5 py-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>{done.toLocaleString("uz-UZ")} / {broadcast.totalCount.toLocaleString("uz-UZ")}</span>
              <span className="tabular">{pct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            {broadcast.scheduledAt && broadcast.status === "SCHEDULED" && (
              <p className="mt-2 text-xs text-faint">
                Rejalashtirilgan vaqt: {broadcast.scheduledAt.toLocaleString("uz-UZ")}
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Mazmuni" title="Xabar matni" />
          <div className="bg-ink-950 p-5">
            <div className="max-w-[300px] rounded-[12px] rounded-tl-[4px] bg-ink-700 px-3.5 py-2.5 text-[13px] leading-snug">
              <span className="whitespace-pre-wrap">
                {broadcast.text.replace(/<[^>]+>/g, "")}
              </span>
            </div>
            {buttons.length > 0 && (
              <div className="mt-1.5 max-w-[300px] space-y-1">
                {buttons.map((b, i) => (
                  <div
                    key={i}
                    className="truncate rounded-[8px] bg-ink-700/70 px-2 py-1.5 text-center text-[12px] text-sky"
                  >
                    {b.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader eyebrow="Yuborishdan oldin" title="Sinov xabari" />
            <ActionForm
              action={sendTest.bind(null, botId, broadcastId)}
              className="space-y-4 p-5"
            >
              <Field
                label="Telegram ID"
                hint="O'z ID'ingizni @userinfobot dan olishingiz mumkin. Avval botga /start yozing."
              >
                <input name="chatId" placeholder="584013219" className="font-mono" required />
              </Field>
              <FormNotice />
              <SubmitButton tone="ghost" pendingLabel="Yuborilmoqda…">
                Sinov yuborish
              </SubmitButton>
            </ActionForm>
          </Card>

          {failures.length > 0 && (
            <Card>
              <CardHeader eyebrow={`${broadcast.failedCount} ta`} title="Xatolar" />
              <div className="divide-y divide-ink-800">
                {failures.map((f) => (
                  <div key={f.id} className="px-5 py-2.5 text-xs">
                    <span className="font-mono text-muted">
                      {f.botUser.username ? `@${f.botUser.username}` : f.botUser.telegramId.toString()}
                    </span>
                    <div className="text-faint">{f.error}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
