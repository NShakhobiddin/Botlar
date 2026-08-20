"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { Card, CardHeader, Field } from "@/components/ui";
import { Notice, SubmitButton, type ActionState } from "@/components/forms";

type Translation = {
  locale: string;
  text: string;
  parseMode: string;
  mediaType: string;
  mediaUrl: string | null;
};

type ButtonRow = { row: number; labels: string[] };

export type ScreenEditorProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  locales: string[];
  defaultLocale: string;
  screen: {
    name: string;
    key: string;
    keyboardType: string;
    resizeKeyboard: boolean;
    oneTimeKeyboard: boolean;
    awaitsInput: boolean;
    inputField: string | null;
    inputNextKey: string | null;
  };
  translations: Translation[];
  buttonRows: ButtonRow[];
  screenKeys: string[];
};

const PLACEHOLDERS = [
  { tag: "{{name}}", desc: "ismi" },
  { tag: "{{username}}", desc: "@useri" },
  { tag: "{{id}}", desc: "Telegram ID" },
];

export function ScreenEditor({
  action,
  locales,
  defaultLocale,
  screen,
  translations,
  buttonRows,
  screenKeys,
}: ScreenEditorProps) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [active, setActive] = useState(defaultLocale);
  const [texts, setTexts] = useState<Record<string, string>>(
    Object.fromEntries(locales.map((l) => [
      l,
      translations.find((t) => t.locale === l)?.text ?? "",
    ]))
  );
  const [awaits, setAwaits] = useState(screen.awaitsInput);

  const current = translations.find((t) => t.locale === active);

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <Card>
          <CardHeader eyebrow={`kalit: ${screen.key}`} title="Xabar matni" />

          {locales.length > 1 && (
            <div className="flex gap-1 border-b border-ink-600 px-3 pt-3">
              {locales.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setActive(l)}
                  className={clsx(
                    "rounded-t-[6px] px-3 py-1.5 font-mono text-xs uppercase transition-colors",
                    active === l
                      ? "bg-ink-700 text-text"
                      : "text-faint hover:text-text"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4 p-5">
            {/* Barcha tillar formada qoladi — faqat faoli ko'rinadi. */}
            {locales.map((locale) => {
              const tr = translations.find((t) => t.locale === locale);
              return (
                <div key={locale} className={locale === active ? "space-y-4" : "hidden"}>
                  <Field
                    label="Matn"
                    hint="HTML teglar: <b>qalin</b>, <i>kursiv</i>, <a href=''>havola</a>, <code>kod</code>"
                  >
                    <textarea
                      name={`text_${locale}`}
                      rows={9}
                      value={texts[locale] ?? ""}
                      onChange={(e) =>
                        setTexts((prev) => ({ ...prev, [locale]: e.target.value }))
                      }
                      placeholder="Assalomu alaykum, {{name}}!"
                      className="font-mono text-[13px] leading-relaxed"
                    />
                  </Field>

                  <div className="flex flex-wrap gap-1.5">
                    {PLACEHOLDERS.map((p) => (
                      <button
                        key={p.tag}
                        type="button"
                        onClick={() =>
                          setTexts((prev) => ({
                            ...prev,
                            [locale]: (prev[locale] ?? "") + p.tag,
                          }))
                        }
                        className="rounded-full border border-ink-600 px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-amber-500 hover:text-amber-400"
                      >
                        {p.tag}
                        <span className="ml-1 text-faint">{p.desc}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Format">
                      <select name={`parseMode_${locale}`} defaultValue={tr?.parseMode ?? "HTML"}>
                        <option value="HTML">HTML</option>
                        <option value="Markdown">Markdown</option>
                        <option value="None">Oddiy matn</option>
                      </select>
                    </Field>
                    <Field label="Media turi">
                      <select name={`mediaType_${locale}`} defaultValue={tr?.mediaType ?? "NONE"}>
                        <option value="NONE">Yo'q</option>
                        <option value="PHOTO">Rasm</option>
                        <option value="VIDEO">Video</option>
                        <option value="ANIMATION">GIF</option>
                        <option value="DOCUMENT">Fayl</option>
                      </select>
                    </Field>
                    <Field label="Media havolasi">
                      <input
                        name={`mediaUrl_${locale}`}
                        defaultValue={tr?.mediaUrl ?? ""}
                        placeholder="https://… yoki file_id"
                        className="font-mono text-xs"
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Xatti-harakat" title="Ekran sozlamalari" />
          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nomi">
                <input name="name" defaultValue={screen.name} />
              </Field>
              <Field label="Klaviatura turi" hint="Inline — xabar ostida; Reply — kirish maydoni ustida.">
                <select name="keyboardType" defaultValue={screen.keyboardType}>
                  <option value="INLINE">Inline tugmalar</option>
                  <option value="REPLY">Reply klaviatura</option>
                  <option value="NONE">Tugmasiz</option>
                </select>
              </Field>
            </div>

            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="resizeKeyboard" defaultChecked={screen.resizeKeyboard} />
                Klaviaturani siqish
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="oneTimeKeyboard" defaultChecked={screen.oneTimeKeyboard} />
                Bir martalik klaviatura
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="awaitsInput"
                  checked={awaits}
                  onChange={(e) => setAwaits(e.target.checked)}
                />
                Foydalanuvchidan javob kutilsin
              </label>
            </div>

            {awaits && (
              <div className="grid gap-3 rounded-[8px] border border-ink-600 bg-ink-800 p-4 sm:grid-cols-2">
                <Field label="Javob nomi" hint="Javob shu nom bilan saqlanadi va {{nom}} orqali ishlatiladi.">
                  <input name="inputField" defaultValue={screen.inputField ?? ""} className="font-mono" placeholder="telefon" />
                </Field>
                <Field label="Javobdan keyingi ekran">
                  <select name="inputNextKey" defaultValue={screen.inputNextKey ?? ""}>
                    <option value="">— yo'q —</option>
                    {screenKeys.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Preview
          text={texts[active] ?? ""}
          buttonRows={buttonRows}
          locale={active}
          defaultLocale={defaultLocale}
        />
        <Notice state={state} />
        <SubmitButton className="w-full">Ekranni saqlash</SubmitButton>
      </div>
    </form>
  );
}

/** Telegramda qanday ko'rinishini taxminiy ko'rsatadi. */
function Preview({
  text,
  buttonRows,
  locale,
  defaultLocale,
}: {
  text: string;
  buttonRows: ButtonRow[];
  locale: string;
  defaultLocale: string;
}) {
  const rendered = text
    .replace(/\{\{\s*name\s*\}\}/g, "Aziz")
    .replace(/\{\{\s*username\s*\}\}/g, "azizbek")
    .replace(/\{\{\s*id\s*\}\}/g, "584013219")
    .replace(/\{\{\s*\w+\s*\}\}/g, "…");

  return (
    <Card className="overflow-hidden">
      <CardHeader eyebrow={`ko'rinishi · ${locale}`} title="Telegramda" />
      <div className="bg-ink-950 p-4">
        <div className="max-w-[280px] rounded-[12px] rounded-tl-[4px] bg-ink-700 px-3.5 py-2.5">
          {rendered ? (
            <div
              className="whitespace-pre-wrap text-[13px] leading-snug"
              dangerouslySetInnerHTML={{ __html: sanitize(rendered) }}
            />
          ) : (
            <div className="text-[13px] text-faint">— matn kiritilmagan —</div>
          )}
        </div>

        {buttonRows.length > 0 && (
          <div className="mt-1.5 max-w-[280px] space-y-1">
            {buttonRows.map((row, i) => (
              <div key={i} className="flex gap-1">
                {row.labels.map((label, j) => (
                  <div
                    key={j}
                    className="flex-1 truncate rounded-[8px] bg-ink-700/70 px-2 py-1.5 text-center text-[12px] text-sky"
                  >
                    {label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="border-t border-ink-600 px-4 py-2.5 text-[11px] text-faint">
        Taxminiy ko&apos;rinish. {locale !== defaultLocale && "Bu til uchun matn bo'sh bo'lsa, asosiy til ishlatiladi."}
      </p>
    </Card>
  );
}

/** Faqat Telegram qo'llaydigan teglarni qoldiradi. */
function sanitize(html: string): string {
  return html
    .replace(/<(?!\/?(b|i|u|s|code|pre|a|strong|em)\b)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
}
