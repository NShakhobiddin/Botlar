"use client";

import { useState } from "react";
import { Field } from "@/components/ui";

export type MediaOption = { url: string; label: string; kind: string };

/**
 * Media turi + havolasi. Kutubxonadan tanlanganda ikkalasi ham
 * bir vaqtda to'ldiriladi — turini qo'lda moslash shart emas.
 */
export function MediaField({
  typeName,
  urlName,
  defaultType = "NONE",
  defaultUrl = "",
  options,
}: {
  typeName: string;
  urlName: string;
  defaultType?: string;
  defaultUrl?: string | null;
  options: MediaOption[];
}) {
  const [type, setType] = useState(defaultType);
  const [url, setUrl] = useState(defaultUrl ?? "");

  return (
    <>
      <Field label="Media turi">
        <select name={typeName} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="NONE">Yo&apos;q</option>
          <option value="PHOTO">Rasm</option>
          <option value="VIDEO">Video</option>
          <option value="ANIMATION">GIF</option>
          <option value="DOCUMENT">Fayl</option>
        </select>
      </Field>

      <Field
        label="Media havolasi"
        hint={options.length > 0 ? undefined : "Media bo'limiga fayl yuklasangiz shu yerdan tanlanadi."}
      >
        <input
          name={urlName}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… yoki Telegram file_id"
          className="font-mono text-xs"
        />
        {options.length > 0 && (
          <select
            value=""
            aria-label="Kutubxonadan tanlash"
            className="mt-2"
            onChange={(e) => {
              const picked = options.find((o) => o.url === e.target.value);
              if (!picked) return;
              setUrl(picked.url);
              setType(picked.kind);
            }}
          >
            <option value="">Kutubxonadan tanlash…</option>
            {options.map((o) => (
              <option key={o.url} value={o.url}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
    </>
  );
}
