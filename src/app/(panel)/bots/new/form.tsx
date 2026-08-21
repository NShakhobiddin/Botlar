"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBot, type ActionState } from "../actions";
import { Button, Card, Field } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button tone="primary" type="submit" disabled={pending}>
      {pending ? "Telegram tekshirilmoqda…" : "Botni ulash"}
    </Button>
  );
}

export function NewBotForm({ canWebhook }: { canWebhook: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(createBot, {});
  const [mode, setMode] = useState(canWebhook ? "WEBHOOK" : "POLLING");

  return (
    <Card className="p-5">
      <form action={action} className="space-y-5">
        <Field
          label="Bot tokeni"
          hint="@BotFather → /mybots → API Token. Token AES-256 bilan shifrlanadi va panelda hech qachon to'liq ko'rsatilmaydi."
        >
          <input
            name="token"
            required
            autoFocus
            placeholder="123456789:AAF-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="font-mono"
          />
        </Field>

        <Field label="Nomi" hint="Bo'sh qoldirilsa Telegram'dagi nomi olinadi.">
          <input name="name" placeholder="Do'kon boti" />
        </Field>

        <Field
          label="Telegram bilan ulanish"
          hint={
            mode === "POLLING"
              ? "Bot Telegram'dan o'zi so'raydi. Domen, HTTPS va statik IP kerak emas — panel uy kompyuterida ham ishlaydi."
              : "Telegram sizning saytingizga o'zi murojaat qiladi. Tezroq, lekin ochiq HTTPS domen shart."
          }
        >
          <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="WEBHOOK" disabled={!canWebhook}>
              Webhook {canWebhook ? "" : "— APP_URL o'rnatilmagan"}
            </option>
            <option value="POLLING">Polling — tashqi serversiz</option>
          </select>
        </Field>

        {!canWebhook && (
          <p className="rounded-[6px] border border-ink-600 bg-ink-800 px-3 py-2 text-xs text-muted">
            <span className="font-mono text-amber-400">APP_URL</span> ochiq HTTPS manzilga
            o&apos;rnatilmagani uchun polling tanlandi. Bot shu kompyuter yoqiq turganda
            ishlaydi.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Asosiy til">
            <select name="defaultLocale" defaultValue="uz">
              <option value="uz">O'zbekcha (uz)</option>
              <option value="ru">Ruscha (ru)</option>
              <option value="en">Inglizcha (en)</option>
            </select>
          </Field>
          <Field label="Qo'llab-quvvatlanadigan tillar" hint="Vergul bilan: uz,ru,en">
            <input name="locales" defaultValue="uz" className="font-mono" />
          </Field>
        </div>

        {state.error && (
          <p className="rounded-[6px] border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
            {state.error}
          </p>
        )}

        <Submit />
      </form>
    </Card>
  );
}
