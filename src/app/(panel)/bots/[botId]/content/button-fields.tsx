import { Field } from "@/components/ui";

export type ButtonDefaults = {
  labels?: Record<string, string>;
  action?: string;
  url?: string | null;
  targetScreenId?: string | null;
  webAppId?: string | null;
};

/** Tugma qo'shish va tahrirlash formalari uchun umumiy maydonlar. */
export function ButtonFields({
  locales,
  screens,
  webApps,
  defaults = {},
}: {
  locales: string[];
  screens: { id: string; key: string; name: string }[];
  webApps: { id: string; name: string }[];
  defaults?: ButtonDefaults;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {locales.map((locale) => (
          <Field key={locale} label={`Matn (${locale})`}>
            <input
              name={`label_${locale}`}
              defaultValue={defaults.labels?.[locale] ?? ""}
              placeholder="📦 Buyurtma berish"
            />
          </Field>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bosilganda">
          <select name="action" defaultValue={defaults.action ?? "SCREEN"}>
            <option value="SCREEN">Boshqa ekranga o&apos;tadi</option>
            <option value="URL">Havolani ochadi</option>
            <option value="WEBAPP">Mini App ochadi</option>
            <option value="BACK">Orqaga qaytaradi</option>
            <option value="SHARE_CONTACT">Telefon raqamni so&apos;raydi</option>
            <option value="SHARE_LOCATION">Manzilni so&apos;raydi</option>
          </select>
        </Field>
        <Field label="Maqsad ekran">
          <select name="targetScreenId" defaultValue={defaults.targetScreenId ?? ""}>
            <option value="">— tanlanmagan —</option>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.key})
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Havola" hint="«Havolani ochadi» tanlansa to'ldiriladi.">
          <input
            name="url"
            defaultValue={defaults.url ?? ""}
            placeholder="https://example.uz"
            className="font-mono text-xs"
          />
        </Field>
        <Field label="Web App" hint="«Mini App ochadi» tanlansa to'ldiriladi.">
          <select name="webAppId" defaultValue={defaults.webAppId ?? ""}>
            <option value="">— tanlanmagan —</option>
            {webApps.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </>
  );
}
