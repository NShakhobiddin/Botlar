import type { Bot } from "@prisma/client";
import { open } from "@/lib/crypto";

export function botToken(bot: Pick<Bot, "tokenCipher" | "tokenIv" | "tokenTag">): string {
  return open({ cipher: bot.tokenCipher, iv: bot.tokenIv, tag: bot.tokenTag });
}

export function webhookUrl(botId: string): string {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  if (!base) throw new Error("APP_URL o'rnatilmagan (masalan https://panel.example.com)");
  return `${base}/api/tg/${botId}`;
}

export type RequiredChannel = { chatId: string; title: string; url: string };

export function parseChannels(raw: unknown): RequiredChannel[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is RequiredChannel =>
      !!c && typeof c === "object" && typeof (c as RequiredChannel).chatId === "string"
  );
}
