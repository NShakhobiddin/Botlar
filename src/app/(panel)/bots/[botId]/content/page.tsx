import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { syncCommands } from "../../actions";
import { createScreen, deleteCommand, saveCommand } from "./actions";
import { createTrigger, deleteTrigger, toggleTrigger } from "./trigger-actions";
import { ActionForm, ConfirmButton, FormNotice, SubmitButton } from "@/components/forms";
import {
  Badge,
  Card,
  CardHeader,
  Empty,
  Field,
  Table,
  Td,
  Th,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const MATCH_LABEL: Record<string, string> = {
  CONTAINS: "Ichida bo'lsa",
  EXACT: "Aynan teng",
  STARTS_WITH: "Shu bilan boshlansa",
};

export default async function ContentPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);

  const [screens, commands, triggers] = await Promise.all([
    prisma.screen.findMany({
      where: { botId },
      include: {
        translations: true,
        _count: { select: { buttons: true, linkedFrom: true } },
      },
      orderBy: [{ isSystem: "desc" }, { key: "asc" }],
    }),
    prisma.botCommand.findMany({
      where: { botId },
      include: { screen: { select: { name: true, key: true } } },
      orderBy: { command: "asc" },
    }),
    prisma.trigger.findMany({
      where: { botId },
      include: { screen: { select: { name: true } } },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const hasFallback = screens.some((s) => s.key === "fallback");

  async function syncAction() {
    "use server";
    await syncCommands(botId);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          eyebrow="Bot nima ko'rsatadi"
          title="Ekranlar"
          action={
            <span className="text-xs text-faint">
              {screens.length} ta · {bot.locales.join(" / ")}
            </span>
          }
        />
        {screens.length === 0 ? (
          <Empty title="Ekran yo'q" hint="Quyidan birinchi ekranni yarating." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ekran</Th>
                <Th>Kalit</Th>
                <Th>Matn boshlanishi</Th>
                <Th className="text-right">Tugma</Th>
                <Th className="text-right">Havolalar</Th>
              </tr>
            </thead>
            <tbody>
              {screens.map((screen) => {
                const tr =
                  screen.translations.find((t) => t.locale === bot.defaultLocale) ??
                  screen.translations[0];
                return (
                  <tr key={screen.id} className="transition-colors hover:bg-ink-800">
                    <Td>
                      <Link
                        href={`/bots/${botId}/content/${screen.id}`}
                        className="flex items-center gap-2 font-medium hover:text-amber-400"
                      >
                        {screen.name}
                        {screen.isSystem && <Badge>tizim</Badge>}
                        {screen.awaitsInput && <Badge tone="info">javob kutadi</Badge>}
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs text-muted">{screen.key}</Td>
                    <Td className="max-w-xs truncate text-xs text-faint">
                      {tr?.text ? tr.text.replace(/<[^>]+>/g, "").slice(0, 60) : "— bo'sh —"}
                    </Td>
                    <Td className="tabular text-right text-muted">
                      {screen._count.buttons}
                    </Td>
                    <Td className="tabular text-right text-muted">
                      {screen._count.linkedFrom}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {!hasFallback && (
        <Card className="border-amber-500/25">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="eyebrow mb-1">Tavsiya</div>
              <p className="text-sm">
                <span className="font-mono text-amber-400">fallback</span> kalitli ekran
                yarating
              </p>
              <p className="mt-1 max-w-xl text-xs text-muted">
                Bot tushunmagan xabarga shu ekran javob beradi. Hozir bunday xabarlarga
                bot umuman javob bermaydi — foydalanuvchi bot ishlamayapti deb o&apos;ylashi
                mumkin.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          eyebrow="Matnga javob"
          title="Kalit so'zlar"
          action={
            <span className="text-xs text-faint">
              Buyruq ham, tugma ham bo'lmagan matnlar shu ro'yxat bo'yicha tekshiriladi
            </span>
          }
        />

        {triggers.length === 0 ? (
          <Empty
            title="Kalit so'z yo'q"
            hint="Masalan «narx» so'zi yozilganda narxlar ekranini ochish."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Kalit so'z</Th>
                <Th>Qanday solishtiriladi</Th>
                <Th>Ochiladigan ekran</Th>
                <Th className="text-right">Ishlagan</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {triggers.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-ink-800">
                  <Td>
                    <span className={t.isActive ? "font-mono text-sm" : "font-mono text-sm text-faint line-through"}>
                      {t.pattern}
                    </span>
                  </Td>
                  <Td className="text-xs text-muted">{MATCH_LABEL[t.matchType]}</Td>
                  <Td className="text-sm">{t.screen.name}</Td>
                  <Td className="tabular text-right text-muted">{t.hitCount}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      <ConfirmButton
                        action={toggleTrigger.bind(null, botId, t.id)}
                        confirm={t.isActive ? "Kalit so'z o'chirib qo'yilsinmi?" : "Kalit so'z yoqilsinmi?"}
                        tone="quiet"
                      >
                        {t.isActive ? "O'chirib qo'yish" : "Yoqish"}
                      </ConfirmButton>
                      <ConfirmButton
                        action={deleteTrigger.bind(null, botId, t.id)}
                        confirm={`"${t.pattern}" o'chirilsinmi?`}
                        tone="quiet"
                      >
                        ✕
                      </ConfirmButton>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        <ActionForm
          action={createTrigger.bind(null, botId)}
          className="space-y-4 border-t border-ink-600 p-5"
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Kalit so'z">
              <input name="pattern" required placeholder="narx" className="font-mono" />
            </Field>
            <Field label="Solishtirish">
              <select name="matchType" defaultValue="CONTAINS">
                <option value="CONTAINS">Ichida bo'lsa</option>
                <option value="EXACT">Aynan teng bo'lsa</option>
                <option value="STARTS_WITH">Shu bilan boshlansa</option>
              </select>
            </Field>
            <Field label="Ochiladigan ekran">
              <select name="screenId" defaultValue="">
                <option value="">— tanlang —</option>
                {screens.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tartib" hint="Kichik raqam oldin tekshiriladi.">
              <input name="priority" type="number" defaultValue={0} className="font-mono" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="caseSensitive" />
            Katta-kichik harf farqlansin
          </label>
          <FormNotice />
          <SubmitButton tone="ghost">Kalit so&apos;z qo&apos;shish</SubmitButton>
        </ActionForm>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Yangi" title="Ekran yaratish" />
          <ActionForm action={createScreen.bind(null, botId)} className="space-y-4 p-5">
            <Field
              label="Kalit"
              hint="Kod ichida ishlatiladigan nom. Masalan: narxlar, aloqa, yordam."
            >
              <input name="key" required placeholder="narxlar" className="font-mono" />
            </Field>
            <Field label="Nomi" hint="Panelda ko'rinadigan tushunarli nom.">
              <input name="name" placeholder="Narxlar ro'yxati" />
            </Field>
            <FormNotice />
            <SubmitButton pendingLabel="Yaratilmoqda…">Ekran yaratish</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <CardHeader
            eyebrow="Telegram menyusi"
            title="Buyruqlar"
            action={
              <form action={syncAction}>
                <SubmitButton tone="ghost" pendingLabel="Yozilmoqda…">
                  Menyuni yangilash
                </SubmitButton>
              </form>
            }
          />

          <div className="divide-y divide-ink-800">
            {commands.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="font-mono text-sm text-amber-400">/{c.command}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-faint">
                  {c.description || "—"} → {c.screen?.name ?? "ekran biriktirilmagan"}
                </span>
                {c.command !== "start" && (
                  <ConfirmButton
                    action={deleteCommand.bind(null, botId, c.command)}
                    confirm={`/${c.command} buyrug'i o'chirilsinmi?`}
                    tone="quiet"
                  >
                    O'chirish
                  </ConfirmButton>
                )}
              </div>
            ))}
            {commands.length === 0 && <Empty title="Buyruq yo'q" />}
          </div>

          <ActionForm
            action={saveCommand.bind(null, botId)}
            className="space-y-4 border-t border-ink-600 p-5"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Buyruq">
                <input name="command" required placeholder="yordam" className="font-mono" />
              </Field>
              <Field label="Ekran">
                <select name="screenId" defaultValue="">
                  <option value="">— tanlanmagan —</option>
                  {screens.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Tavsif" hint="Telegram menyusida buyruq yonida ko'rinadi.">
              <input name="description" placeholder="Yordam olish" />
            </Field>
            <FormNotice />
            <SubmitButton tone="ghost">Buyruqni saqlash</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
