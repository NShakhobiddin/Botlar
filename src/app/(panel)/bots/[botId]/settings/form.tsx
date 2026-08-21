"use client";

import { useState } from "react";
import { ActionForm, FormNotice, SubmitButton, type ActionState } from "@/components/forms";
import { Card, CardHeader, Field } from "@/components/ui";

export function SettingsForm({
  action,
  bot,
  channels,
  canWebhook,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  canWebhook: boolean;
  bot: {
    name: string;
    mode: string;
    isActive: boolean;
    maintenanceMode: boolean;
    maintenanceText: string | null;
    defaultLocale: string;
    locales: string[];
  };
  channels: { chatId: string; title: string; url: string }[];
}) {
  const [maintenance, setMaintenance] = useState(bot.maintenanceMode);
  const [mode, setMode] = useState(bot.mode);

  return (
    <ActionForm action={action}>
      <div className="space-y-5">
        <Card>
          <CardHeader eyebrow="Asosiy" title="Bot sozlamalari" />
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nomi">
                <input name="name" defaultValue={bot.name} />
              </Field>
              <Field label="Asosiy til">
                <select name="defaultLocale" defaultValue={bot.defaultLocale}>
                  <option value="uz">O&apos;zbekcha (uz)</option>
                  <option value="ru">Ruscha (ru)</option>
                  <option value="en">Inglizcha (en)</option>
                </select>
              </Field>
              <Field label="Tillar" hint="Vergul bilan: uz,ru,en">
                <input
                  name="locales"
                  defaultValue={bot.locales.join(",")}
                  className="font-mono text-xs"
                />
              </Field>
            </div>

            <Field
              label="Telegram bilan ulanish"
              hint={
                mode === "POLLING"
                  ? "Bot Telegram'dan o'zi so'raydi — domen va HTTPS kerak emas."
                  : "Telegram saytingizga o'zi murojaat qiladi — ochiq HTTPS domen shart."
              }
            >
              <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="WEBHOOK" disabled={!canWebhook}>
                  Webhook {canWebhook ? "" : "— APP_URL o'rnatilmagan"}
                </option>
                <option value="POLLING">Polling — tashqi serversiz</option>
              </select>
            </Field>

            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isActive" defaultChecked={bot.isActive} />
                Bot yoqilgan
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="maintenanceMode"
                  checked={maintenance}
                  onChange={(e) => setMaintenance(e.target.checked)}
                />
                Texnik ish rejimi
              </label>
            </div>

            {maintenance && (
              <Field
                label="Texnik ish xabari"
                hint="Rejim yoqilganda bot har qanday xabarga shu matn bilan javob beradi."
              >
                <textarea
                  name="maintenanceText"
                  rows={2}
                  defaultValue={bot.maintenanceText ?? ""}
                  placeholder="🛠 Bot vaqtincha ishlamayapti. Tez orada qaytamiz."
                />
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Kirish sharti" title="Majburiy obuna" />
          <div className="space-y-4 p-5">
            <Field
              label="Kanallar"
              hint="Har qatorda bittadan: @kanal | Ko'rinadigan nom | https://t.me/kanal — bot kanalda admin bo'lishi shart."
            >
              <textarea
                name="requiredChannels"
                rows={4}
                defaultValue={channels
                  .map((c) => `${c.chatId} | ${c.title} | ${c.url}`)
                  .join("\n")}
                placeholder="@mening_kanalim | Mening kanalim | https://t.me/mening_kanalim"
                className="font-mono text-xs"
              />
            </Field>
            <p className="text-xs text-faint">
              Bo&apos;sh qoldirilsa majburiy obuna o&apos;chadi. Bot admin bo&apos;lmagan
              kanal tekshirilmaydi va foydalanuvchini to&apos;smaydi.
            </p>
          </div>
        </Card>

        <FormNotice />
        <SubmitButton>Sozlamalarni saqlash</SubmitButton>
      </div>
    </ActionForm>
  );
}
