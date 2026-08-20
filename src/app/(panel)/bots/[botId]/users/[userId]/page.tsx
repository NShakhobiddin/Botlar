import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { resetUserState, sendDirectMessage, toggleBan } from "../actions";
import { ActionForm, ConfirmButton, FormNotice, SubmitButton } from "@/components/forms";
import {
  Badge,
  Card,
  CardHeader,
  Empty,
  Field,
  SignalStrip,
  Stat,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  START: "Botni ishga tushirdi",
  COMMAND: "Buyruq",
  MESSAGE: "Xabar yozdi",
  CALLBACK: "Tugma bosdi",
  SCREEN_VIEW: "Ekran ochildi",
  BLOCK: "Botni bloklandi",
  UNBLOCK: "Blokdan chiqdi",
  WEBAPP_OPEN: "Mini App ochdi",
  WEBAPP_EVENT: "Mini App hodisasi",
  BROADCAST_SENT: "Ommaviy xabar",
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ botId: string; userId: string }>;
}) {
  const { botId, userId } = await params;
  await requireBot(botId);

  const botUser = await prisma.botUser.findFirst({
    where: { id: userId, botId },
  });
  if (!botUser) notFound();

  const [events, sessions, deliveries, eventCount] = await Promise.all([
    prisma.event.findMany({
      where: { botUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.webAppSession.findMany({
      where: { botUserId: userId },
      include: { webApp: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    prisma.broadcastDelivery.findMany({
      where: { botUserId: userId },
      include: { broadcast: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      take: 10,
    }),
    prisma.event.count({ where: { botUserId: userId } }),
  ]);

  // Oxirgi 14 kunlik faollik — signal chizig'i uchun
  const buckets = new Array(14).fill(0);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  for (const e of events) {
    const diff = Math.floor((dayStart.getTime() - e.createdAt.getTime()) / 86_400_000);
    if (diff >= 0 && diff < 14) buckets[13 - diff]++;
  }

  const answers = Object.entries((botUser.data as Record<string, unknown>) ?? {});
  const fullName = `${botUser.firstName} ${botUser.lastName ?? ""}`.trim();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/bots/${botId}/users`}
          className="text-xs text-muted transition-colors hover:text-text"
        >
          ← Barcha obunachilar
        </Link>
        <div className="flex items-center gap-2">
          <ConfirmButton
            action={resetUserState.bind(null, botId, userId)}
            confirm="Foydalanuvchining joriy holati va forma javoblari tozalansinmi?"
            tone="ghost"
          >
            Holatni tozalash
          </ConfirmButton>
          <ConfirmButton
            action={toggleBan.bind(null, botId, userId)}
            confirm={
              botUser.isBanned
                ? "Ban olib tashlansinmi?"
                : "Ban qilinsinmi? Bot bu foydalanuvchiga javob bermay qo'yadi."
            }
          >
            {botUser.isBanned ? "Banni olish" : "Ban qilish"}
          </ConfirmButton>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
          <div>
            <div className="eyebrow mb-1">
              {botUser.username ? `@${botUser.username}` : "username yo'q"}
            </div>
            <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
              {fullName || "Ismsiz"}
              {botUser.isBanned ? (
                <Badge tone="danger">Ban</Badge>
              ) : botUser.isBlocked ? (
                <Badge tone="warn">Bloklagan</Badge>
              ) : (
                <Badge tone="live">Faol</Badge>
              )}
              {botUser.isPremium && <Badge tone="info">Premium</Badge>}
            </h1>
          </div>
          <div className="w-full max-w-[220px]">
            <SignalStrip buckets={buckets} />
            <div className="eyebrow mt-1.5 text-right">kunlik faollik · 14 kun</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 divide-x divide-y divide-ink-600 border-t border-ink-600 lg:grid-cols-4 lg:divide-y-0">
          <Stat label="Telegram ID" value={botUser.telegramId.toString()} />
          <Stat label="Xabarlar" value={botUser.messageCount} tone="signal" />
          <Stat label="Hodisalar" value={eventCount} tone="amber" />
          <Stat
            label="Qo'shilgan"
            value={botUser.createdAt.toLocaleDateString("uz-UZ")}
            hint={`oxirgi faollik: ${botUser.lastSeenAt.toLocaleString("uz-UZ", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}`}
          />
        </div>

        <dl className="grid gap-x-6 gap-y-3 border-t border-ink-600 px-5 py-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="eyebrow mb-0.5">Til</dt>
            <dd className="font-mono uppercase">{botUser.locale}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-0.5">Telefon</dt>
            <dd className="font-mono">{botUser.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="eyebrow mb-0.5">Joriy ekran</dt>
            <dd className="font-mono">{botUser.currentScreenKey ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Panel orqali" title="Shaxsiy xabar" />
          <ActionForm
            action={sendDirectMessage.bind(null, botId, userId)}
            className="space-y-4 p-5"
          >
            <Field label="Matn" hint="HTML teglar ishlaydi. Xabar darhol yuboriladi.">
              <textarea
                name="text"
                rows={4}
                required
                placeholder="Assalomu alaykum! Buyurtmangiz tayyor."
              />
            </Field>
            <FormNotice />
            <SubmitButton pendingLabel="Yuborilmoqda…">Yuborish</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <CardHeader eyebrow="Formadan" title="Javoblar" />
          {answers.length === 0 ? (
            <Empty
              title="Javob yo'q"
              hint="«Javob kutilsin» yoqilgan ekranlarda foydalanuvchi yozgan javoblar shu yerda to'planadi."
            />
          ) : (
            <dl className="divide-y divide-ink-800">
              {answers.map(([key, value]) => (
                <div key={key} className="flex gap-4 px-5 py-2.5 text-sm">
                  <dt className="w-32 shrink-0 font-mono text-xs text-muted">{key}</dt>
                  <dd className="min-w-0 break-words">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Oxirgi 40 ta" title="Harakatlar tarixi" />
          {events.length === 0 ? (
            <Empty title="Hodisa yo'q" />
          ) : (
            <div className="max-h-[420px] divide-y divide-ink-800 overflow-y-auto">
              {events.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-5 py-2 text-xs">
                  <span className="tabular w-24 shrink-0 text-faint">
                    {e.createdAt.toLocaleString("uz-UZ", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="w-40 shrink-0 truncate text-muted">
                    {EVENT_LABEL[e.type] ?? e.type}
                  </span>
                  <span className="min-w-0 truncate font-mono text-faint">{e.name}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader eyebrow="Mini App" title="Sessiyalar" />
            {sessions.length === 0 ? (
              <Empty title="Mini App ochilmagan" />
            ) : (
              <div className="divide-y divide-ink-800">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                    <span className="tabular w-24 shrink-0 text-faint">
                      {s.startedAt.toLocaleDateString("uz-UZ")}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.webApp.name}</span>
                    <span className="font-mono text-muted">{s.platform}</span>
                    <span className="tabular w-14 text-right text-muted">
                      {Math.round(s.durationMs / 1000)}s
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader eyebrow="Ommaviy xabarlar" title="Yetkazilganlar" />
            {deliveries.length === 0 ? (
              <Empty title="Xabar yuborilmagan" />
            ) : (
              <div className="divide-y divide-ink-800">
                {deliveries.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                    <span className="tabular w-24 shrink-0 text-faint">
                      {d.sentAt?.toLocaleDateString("uz-UZ") ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{d.broadcast.name}</span>
                    <Badge
                      tone={
                        d.status === "SENT" ? "live" : d.status === "BLOCKED" ? "warn" : "danger"
                      }
                    >
                      {d.status === "SENT" ? "yetdi" : d.status === "BLOCKED" ? "bloklagan" : "xato"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
