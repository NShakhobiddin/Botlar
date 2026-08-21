import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { pickLabel } from "@/lib/engine/render";
import {
  addButton,
  deleteButton,
  deleteScreen,
  duplicateScreen,
  moveButton,
  toggleButtonRow,
  updateScreen,
} from "../actions";
import { ButtonFields } from "../button-fields";
import { mediaRef } from "@/lib/media";
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

  const [allScreens, webApps, assets] = await Promise.all([
    prisma.screen.findMany({
      where: { botId },
      select: { id: true, key: true, name: true },
      orderBy: { key: "asc" },
    }),
    prisma.webApp.findMany({
      where: { botId, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.mediaAsset.findMany({
      where: { botId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const mediaOptions = assets.map((a) => ({
    url: mediaRef(a.publicKey),
    label: a.fileName,
    kind: a.kind,
  }));

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
        <div className="flex items-center gap-2">
          <ConfirmButton
            action={duplicateScreen.bind(null, botId, screenId)}
            confirm={`"${screen.name}" ekranidan nusxa olinsinmi?`}
            tone="ghost"
          >
            Nusxa olish
          </ConfirmButton>
          {screen.key !== "start" && (
            <ConfirmButton
              action={deleteScreen.bind(null, botId, screenId)}
              confirm={`"${screen.name}" ekrani o'chirilsinmi? Unga ishora qiluvchi tugmalar ishlamay qoladi.`}
            >
              Ekranni o'chirish
            </ConfirmButton>
          )}
        </div>
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
        mediaOptions={mediaOptions}
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
                <Link
                  href={`/bots/${botId}/content/${screenId}/buttons/${b.id}`}
                  className="min-w-0 flex-1 truncate text-sm transition-colors hover:text-amber-400"
                >
                  {pickLabel(b.labels, bot.defaultLocale, bot.defaultLocale)}
                </Link>
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
          <ButtonFields locales={bot.locales} screens={allScreens} webApps={webApps} />

          <FormNotice />
          <SubmitButton tone="ghost" pendingLabel="Qo'shilmoqda…">
            Tugma qo&apos;shish
          </SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
