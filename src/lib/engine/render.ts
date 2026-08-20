import type { Button, Screen, ScreenTranslation, WebApp } from "@prisma/client";

export type FullScreen = Screen & {
  translations: ScreenTranslation[];
  buttons: (Button & { webApp: WebApp | null; targetScreen: { key: string } | null })[];
};

/** Callback data 64 baytdan oshmasligi kerak — shuning uchun qisqa prefikslar. */
export const CB = {
  screen: (id: string) => `s:${id}`,
  command: (key: string) => `c:${key}`,
  back: "back",
  checkSub: "chksub",
} as const;

export function parseCallback(data: string): 
  | { kind: "screen"; id: string }
  | { kind: "command"; key: string }
  | { kind: "back" }
  | { kind: "checkSub" }
  | { kind: "unknown"; raw: string } {
  if (data === CB.back) return { kind: "back" };
  if (data === CB.checkSub) return { kind: "checkSub" };
  if (data.startsWith("s:")) return { kind: "screen", id: data.slice(2) };
  if (data.startsWith("c:")) return { kind: "command", key: data.slice(2) };
  return { kind: "unknown", raw: data };
}

/** Tarjimani topadi; topilmasa default tilga, u ham bo'lmasa birinchisiga tushadi. */
export function pickTranslation(
  screen: FullScreen,
  locale: string,
  defaultLocale: string
): ScreenTranslation | null {
  return (
    screen.translations.find((t) => t.locale === locale) ??
    screen.translations.find((t) => t.locale === defaultLocale) ??
    screen.translations[0] ??
    null
  );
}

export function pickLabel(
  labels: unknown,
  locale: string,
  defaultLocale: string
): string {
  if (!labels || typeof labels !== "object") return "—";
  const map = labels as Record<string, string>;
  return map[locale] || map[defaultLocale] || Object.values(map)[0] || "—";
}

type InlineButton = Record<string, unknown>;

/** Tugmalarni row/col bo'yicha tartiblab Telegram klaviaturasiga aylantiradi. */
export function buildKeyboard(
  screen: FullScreen,
  locale: string,
  defaultLocale: string
): unknown | undefined {
  if (screen.keyboardType === "NONE" || screen.buttons.length === 0) {
    return screen.keyboardType === "REPLY" ? { remove_keyboard: true } : undefined;
  }

  const rows = new Map<number, typeof screen.buttons>();
  for (const b of [...screen.buttons].sort((a, b) => a.col - b.col)) {
    const list = rows.get(b.row) ?? [];
    list.push(b);
    rows.set(b.row, list);
  }
  const ordered = [...rows.entries()].sort(([a], [b]) => a - b).map(([, v]) => v);

  if (screen.keyboardType === "REPLY") {
    const keyboard = ordered.map((row) =>
      row.map((b) => {
        const text = pickLabel(b.labels, locale, defaultLocale);
        if (b.action === "SHARE_CONTACT") return { text, request_contact: true };
        if (b.action === "SHARE_LOCATION") return { text, request_location: true };
        if (b.action === "WEBAPP" && b.webApp)
          return { text, web_app: { url: b.webApp.url } };
        return { text };
      })
    );
    return {
      keyboard,
      resize_keyboard: screen.resizeKeyboard,
      one_time_keyboard: screen.oneTimeKeyboard,
    };
  }

  const inline_keyboard = ordered
    .map((row) =>
      row
        .map((b): InlineButton | null => {
          const text = pickLabel(b.labels, locale, defaultLocale);
          switch (b.action) {
            case "URL":
              return b.url ? { text, url: b.url } : null;
            case "WEBAPP":
              return b.webApp ? { text, web_app: { url: b.webApp.url } } : null;
            case "SCREEN":
              return b.targetScreenId
                ? { text, callback_data: CB.screen(b.targetScreenId) }
                : null;
            case "COMMAND":
              return b.commandKey
                ? { text, callback_data: CB.command(b.commandKey) }
                : null;
            case "BACK":
              return { text, callback_data: CB.back };
            default:
              return null;
          }
        })
        .filter((b): b is InlineButton => b !== null)
    )
    .filter((row) => row.length > 0);

  return inline_keyboard.length ? { inline_keyboard } : undefined;
}

/** Matndagi {{name}} kabi o'rinbosarlarni foydalanuvchi ma'lumotlari bilan almashtiradi. */
export function interpolate(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}
