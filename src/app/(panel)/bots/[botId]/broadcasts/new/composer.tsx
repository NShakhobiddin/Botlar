"use client";

import { useActionState, useState, useTransition } from "react";
import type { Segment } from "@/lib/segment";
import { Button, Card, CardHeader, Field } from "@/components/ui";
import { MediaField, type MediaOption } from "@/components/media-field";
import { Notice, SubmitButton, type ActionState } from "@/components/forms";

export type BroadcastDraft = {
  name: string;
  text: string;
  parseMode: string;
  mediaType: string;
  mediaUrl: string | null;
  buttons: { label: string; url: string }[];
  disableNotification: boolean;
  scheduledAt: string;
  screenId: string | null;
  segment: Segment;
};

const EMPTY: BroadcastDraft = {
  name: "",
  text: "",
  parseMode: "HTML",
  mediaType: "NONE",
  mediaUrl: "",
  buttons: [],
  disableNotification: false,
  scheduledAt: "",
  screenId: null,
  segment: {},
};

export function Composer({
  botId,
  locales,
  defaultTotal,
  action,
  countAction,
  screens,
  mediaOptions,
  initial,
  submitLabel = "Qoralamani saqlash",
}: {
  botId: string;
  locales: string[];
  defaultTotal: number;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  countAction: (botId: string, segment: Segment) => Promise<number>;
  screens: { id: string; name: string }[];
  mediaOptions: MediaOption[];
  initial?: BroadcastDraft;
  submitLabel?: string;
}) {
  const draft = initial ?? EMPTY;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [text, setText] = useState(draft.text);
  const [screenId, setScreenId] = useState(draft.screenId ?? "");
  const [count, setCount] = useState(defaultTotal);
  const [counting, startCount] = useTransition();

  function recount(form: HTMLFormElement) {
    const fd = new FormData(form);
    const segment: Segment = {
      locales: fd.getAll("locales").map(String).filter(Boolean),
      activeDays: fd.get("activeDays") ? Number(fd.get("activeDays")) : null,
      excludeBlocked: true,
      openedWebApp: fd.get("openedWebApp") === "on",
      hasPhone: fd.get("hasPhone") === "on",
      joinedAfter: String(fd.get("joinedAfter") ?? "") || null,
      joinedBefore: String(fd.get("joinedBefore") ?? "") || null,
    };
    startCount(async () => setCount(await countAction(botId, segment)));
  }

  const minutes = Math.ceil(count / 25 / 60);
  const usingScreen = screenId !== "";

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <Card>
          <CardHeader eyebrow="Mazmuni" title="Xabar" />
          <div className="space-y-4 p-5">
            <Field label="Nomi" hint="Faqat panelda ko'rinadi — tarixda topish uchun.">
              <input name="name" defaultValue={draft.name} placeholder="Yangi yil aksiyasi" />
            </Field>

            <Field
              label="Tayyor ekranni yuborish"
              hint="Tanlansa, quyidagi matn o'rniga o'sha ekran har bir obunachiga o'z tilida boradi."
            >
              <select
                name="screenId"
                value={screenId}
                onChange={(e) => setScreenId(e.target.value)}
              >
                <option value="">— yangi matn yozaman —</option>
                {screens.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className={usingScreen ? "pointer-events-none space-y-4 opacity-40" : "space-y-4"}>
              <Field label="Matn" hint="HTML: <b>qalin</b>, <i>kursiv</i>, <a href=''>havola</a>">
                <textarea
                  name="text"
                  rows={9}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Assalomu alaykum! Bugun…"
                  className="font-mono text-[13px] leading-relaxed"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Format">
                  <select name="parseMode" defaultValue={draft.parseMode}>
                    <option value="HTML">HTML</option>
                    <option value="Markdown">Markdown</option>
                    <option value="None">Oddiy matn</option>
                  </select>
                </Field>
                <MediaField
                  typeName="mediaType"
                  urlName="mediaUrl"
                  defaultType={draft.mediaType}
                  defaultUrl={draft.mediaUrl}
                  options={mediaOptions}
                />
              </div>

              <Field label="Tugmalar" hint="Har qatorda bittadan: Matn | https://havola">
                <textarea
                  name="buttons"
                  rows={3}
                  defaultValue={draft.buttons.map((b) => `${b.label} | ${b.url}`).join("\n")}
                  placeholder={"Batafsil | https://example.uz\nKanalimiz | https://t.me/kanal"}
                  className="font-mono text-xs"
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="disableNotification"
                defaultChecked={draft.disableNotification}
              />
              Ovozsiz yuborilsin
            </label>
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Kimga boradi" title="Segment" />
          <div
            className="space-y-4 p-5"
            onChange={(e) => recount(e.currentTarget.closest("form")!)}
          >
            <Field label="Tillar" hint="Hech biri belgilanmasa — barcha tillar.">
              <div className="flex flex-wrap gap-4 pt-1">
                {locales.map((l) => (
                  <label key={l} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="locales"
                      value={l}
                      defaultChecked={draft.segment.locales?.includes(l)}
                    />
                    <span className="font-mono uppercase">{l}</span>
                  </label>
                ))}
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Faollik">
                <select name="activeDays" defaultValue={draft.segment.activeDays ?? ""}>
                  <option value="">Hammasi</option>
                  <option value="1">Oxirgi 1 kun</option>
                  <option value="7">Oxirgi 7 kun</option>
                  <option value="30">Oxirgi 30 kun</option>
                  <option value="90">Oxirgi 90 kun</option>
                </select>
              </Field>
              <Field label="Qo'shilgan — dan">
                <input type="date" name="joinedAfter" defaultValue={draft.segment.joinedAfter ?? ""} />
              </Field>
              <Field label="Qo'shilgan — gacha">
                <input type="date" name="joinedBefore" defaultValue={draft.segment.joinedBefore ?? ""} />
              </Field>
            </div>

            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="openedWebApp" defaultChecked={draft.segment.openedWebApp} />
                Faqat Mini App ochganlar
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="hasPhone" defaultChecked={draft.segment.hasPhone} />
                Faqat raqam qoldirganlar
              </label>
            </div>

            <Field label="Rejalashtirish" hint="Bo'sh qoldirilsa — keyingi qadamda qo'lda yuborasiz.">
              <input type="datetime-local" name="scheduledAt" defaultValue={draft.scheduledAt} />
            </Field>
          </div>
        </Card>

        <Notice state={state} />
        <SubmitButton pendingLabel="Saqlanmoqda…">{submitLabel}</SubmitButton>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader eyebrow="Auditoriya" title="Nechta odamga boradi" />
          <div className="p-5">
            <div className="tabular text-3xl font-semibold text-amber-400">
              {counting ? "…" : count.toLocaleString("uz-UZ")}
            </div>
            <p className="mt-1 text-xs text-faint">
              Taxminan {minutes < 1 ? "1 daqiqadan kam" : `${minutes} daqiqa`} davom etadi
              (25 xabar/sek).
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Ko'rinishi" title="Telegramda" />
          <div className="bg-ink-950 p-4">
            <div className="max-w-[260px] rounded-[12px] rounded-tl-[4px] bg-ink-700 px-3.5 py-2.5 text-[13px] leading-snug">
              {usingScreen ? (
                <span className="text-faint">
                  Tanlangan ekran matni yuboriladi — kontent bo&apos;limida ko&apos;rishingiz mumkin.
                </span>
              ) : text ? (
                <span className="whitespace-pre-wrap">{text.replace(/<[^>]+>/g, "")}</span>
              ) : (
                <span className="text-faint">— matn kiritilmagan —</span>
              )}
            </div>
          </div>
        </Card>

        <Button
          type="button"
          tone="quiet"
          onClick={(e) => recount(e.currentTarget.closest("form")!)}
          className="w-full"
        >
          Auditoriyani qayta hisoblash
        </Button>
      </div>
    </form>
  );
}
