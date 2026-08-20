import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireBot } from "@/lib/auth";
import { syncCommands } from "../../actions";
import { createScreen, deleteCommand, saveCommand } from "./actions";
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

export default async function ContentPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);

  const [screens, commands] = await Promise.all([
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
  ]);

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
