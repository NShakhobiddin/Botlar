import { requireBot } from "@/lib/auth";
import { parseChannels, webhookUrl } from "@/lib/bots";
import { maskToken } from "@/lib/crypto";
import { deleteBot, refreshWebhook, updateBotSettings, webhookStatus } from "../../actions";
import { SettingsForm } from "./form";
import { CopyBox } from "@/components/copy";
import { ConfirmButton, SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BotSettingsPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const { bot } = await requireBot(botId);
  const info = await webhookStatus(botId);

  let url = "";
  try {
    url = webhookUrl(botId);
  } catch {
    url = "APP_URL o'rnatilmagan";
  }

  async function refresh() {
    "use server";
    await refreshWebhook(botId);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          eyebrow="Telegram ulanishi"
          title="Webhook"
          action={
            <form action={refresh}>
              <SubmitButton tone="ghost" pendingLabel="O'rnatilmoqda…">
                Qayta o&apos;rnatish
              </SubmitButton>
            </form>
          }
        />
        <div className="space-y-4 p-5">
          <div>
            <div className="eyebrow mb-2">Manzil</div>
            <CopyBox text={url} />
          </div>

          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="eyebrow mb-1">Holat</div>
              {info?.url ? (
                <Badge tone="live">Ulangan</Badge>
              ) : (
                <Badge tone="danger">Ulanmagan</Badge>
              )}
            </div>
            <div>
              <div className="eyebrow mb-1">Navbatdagi update</div>
              <span className="tabular">{info?.pending_update_count ?? "—"}</span>
            </div>
            <div>
              <div className="eyebrow mb-1">Token</div>
              <span className="font-mono text-xs text-muted">
                {maskToken(`${bot.telegramId}:xxxxxxxxxxxxxxxxxxxx`)}
              </span>
            </div>
          </div>

          {info?.last_error_message && (
            <p className="rounded-[6px] border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
              Telegram oxirgi xato: {info.last_error_message}
            </p>
          )}
        </div>
      </Card>

      <SettingsForm
        action={updateBotSettings.bind(null, botId)}
        bot={{
          name: bot.name,
          isActive: bot.isActive,
          maintenanceMode: bot.maintenanceMode,
          maintenanceText: bot.maintenanceText,
          defaultLocale: bot.defaultLocale,
          locales: bot.locales,
        }}
        channels={parseChannels(bot.requiredChannels)}
      />

      <Card className="border-rose/25">
        <CardHeader eyebrow="Qaytarib bo'lmaydi" title="Botni o'chirish" />
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-lg text-xs text-muted">
            Bot, uning barcha ekranlari, obunachilari va statistikasi butunlay o&apos;chadi.
            Telegram tomonidagi webhook ham olib tashlanadi. Bot @BotFather&apos;da saqlanib qoladi.
          </p>
          <ConfirmButton
            action={deleteBot.bind(null, botId)}
            confirm={`"${bot.name}" va uning barcha ma'lumotlari o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.`}
          >
            Botni o&apos;chirish
          </ConfirmButton>
        </div>
      </Card>
    </div>
  );
}
