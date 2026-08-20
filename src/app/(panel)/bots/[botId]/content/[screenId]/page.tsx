import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { pickLabel } from "@/lib/engine/render";
import {
  addButton,
  deleteButton,
  deleteScreen,
  moveButton,
  toggleButtonRow,
  updateScreen,
} from "../actions";
import { ScreenEditor } from "@/components/screen-editor";
import { ActionForm, ConfirmButton, FormNotice, InlineAction, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, Empty, Field } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  SCREEN: "Ekranga o'tadi",
  URL: "Havola ochadi",
  WEBAPP: "Mini App ochadi",
  COMMAND: "Buyruq bajaradi",
  BACK: "Orqaga qaytaradi",
  SHARE_CONTACT: "Raqam so'raydi",
  SHARE_LOCATION: "Manzil so'raydi",
};

export default async function ScreenEditorPage({
  params,
}: {
  params: Promise<{ botId: string; screenId: string }>;
}) {
  const { botId, screenId } = await params;
  const { bot } = await requireBot(botId);

  const screen = await prisma.screen.findFirst({
    where: { id: screenId, botId },
    include: {
      translations: true,
      buttons: {
        include: { targetScreen: { select: { name: true } }, webApp: { select: { name: true } } },
        orderBy: [{ row: "asc" }, { col: "asc" }],
      },
    },
  });
  if (!screen) notFound();

  const [allScreens, webApps] = await Promise.all([
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

  // Ko'rinish uchun tugmalarni qatorlarga guruhlash
  const rowMap = new Map<number, string[]>();
  for (const b of screen.buttons) {
    const labels = rowMap.get(b.row) ?? [];
    labels.push(pickLabel(b.labels, bot.defaultLocale, bot.defaultLocale));
    rowMap.set(b.row, labels);
  }
  const buttonRows = [...rowMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([row, labels]) => ({ row, labels }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/bots/${botId}/content`}
          className="text-xs text-muted transition-colors hover:text-text"
        >
          ← Barcha ekranlar
        </Link>
        {screen.key !== "start" && (
          <ConfirmButton
            action={deleteScreen.bind(null, botId, screenId)}
            confirm={`"${screen.name}" ekrani o'chirilsinmi? Unga ishora qiluvchi tugmalar ishlamay qoladi.`}
          >
            Ekranni o'chirish
          </ConfirmButton>
        )}
      </div>

      <ScreenEditor
        action={updateScreen.bind(null, botId, screenId)}
        locales={bot.locales}
        defaultLocale={bot.defaultLocale}
        screen={{
          name: screen.name,
          key: screen.key,
          keyboardType: screen.keyboardType,
          resizeKeyboard: screen.resizeKeyboard,
          oneTimeKeyboard: screen.oneTimeKeyboard,
          awaitsInput: screen.awaitsInput,
          inputField: screen.inputField,
          inputNextKey: screen.inputNextKey,
        }}
        translations={screen.translations}
        buttonRows={buttonRows}
        screenKeys={allScreens.map((s) => s.key)}
      />

      <Card>
        <CardHeader
          eyebrow={`${screen.buttons.length} ta`}
          title="Tugmalar"
          action={
            <span className="text-xs text-faint">
              Yonma-yon qo&apos;yish uchun «↔» tugmasidan foydalaning
            </span>
          }
        />

        {screen.buttons.length === 0 ? (
          <Empty title="Tugma yo'q" hint="Quyidagi shakl orqali birinchi tugmani qo'shing." />
        ) : (
          <div className="divide-y divide-ink-800">
            {screen.buttons.map((b, i) => (
              <div key={b.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="tabular w-8 text-xs text-faint">{b.row}.{b.col}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {pickLabel(b.labels, bot.defaultLocale, bot.defaultLocale)}
                </span>
                <Badge tone={b.action === "URL" || b.action === "WEBAPP" ? "info" : "neutral"}>
                  {ACTION_LABEL[b.action] ?? b.action}
                </Badge>
                <span className="hidden max-w-[180px] truncate font-mono text-[11px] text-faint sm:block">
                  {b.targetScreen?.name ?? b.webApp?.name ?? b.url ?? b.commandKey ?? ""}
                </span>
                <div className="flex items-center gap-0.5">
                  <InlineAction action={moveButton.bind(null, botId, screenId, b.id, "up")} title="Yuqoriga">↑</InlineAction>
                  <InlineAction action={moveButton.bind(null, botId, screenId, b.id, "down")} title="Pastga">↓</InlineAction>
                  {i > 0 && (
                    <InlineAction
                      action={toggleButtonRow.bind(null, botId, screenId, b.id)}
                      title="Yuqoridagi bilan bir qatorga"
                    >
                      ↔
                    </InlineAction>
                  )}
                  <ConfirmButton
                    action={deleteButton.bind(null, botId, screenId, b.id)}
                    confirm="Tugma o'chirilsinmi?"
                    tone="quiet"
                  >
                    ✕
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}

        <ActionForm
          action={addButton.bind(null, botId, screenId)}
          className="space-y-4 border-t border-ink-600 p-5"
        >
          <div className="eyebrow">Yangi tugma</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {bot.locales.map((locale) => (
              <Field key={locale} label={`Matn (${locale})`}>
                <input name={`label_${locale}`} placeholder="📦 Buyurtma berish" />
              </Field>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bosilganda">
              <select name="action" defaultValue="SCREEN">
                <option value="SCREEN">Boshqa ekranga o&apos;tadi</option>
                <option value="URL">Havolani ochadi</option>
                <option value="WEBAPP">Mini App ochadi</option>
                <option value="BACK">Orqaga qaytaradi</option>
                <option value="SHARE_CONTACT">Telefon raqamni so&apos;raydi</option>
                <option value="SHARE_LOCATION">Manzilni so&apos;raydi</option>
              </select>
            </Field>
            <Field label="Maqsad ekran">
              <select name="targetScreenId" defaultValue="">
                <option value="">— tanlanmagan —</option>
                {allScreens.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.key})
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Havola" hint="«Havolani ochadi» tanlansa to'ldiriladi.">
              <input name="url" placeholder="https://example.uz" className="font-mono text-xs" />
            </Field>
            <Field label="Web App" hint="«Mini App ochadi» tanlansa to'ldiriladi.">
              <select name="webAppId" defaultValue="">
                <option value="">— tanlanmagan —</option>
                {webApps.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <FormNotice />
          <SubmitButton tone="ghost" pendingLabel="Qo'shilmoqda…">
            Tugma qo&apos;shish
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
