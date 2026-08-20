import "server-only";
import { prisma } from "@/lib/db";
import { botToken, parseChannels } from "@/lib/bots";
import {
  answerCallbackQuery,
  getChatMember,
  send,
  TelegramError,
  type TgUpdate,
  type TgUser,
} from "@/lib/telegram";
import {
  buildKeyboard,
  CB,
  interpolate,
  parseCallback,
  pickLabel,
  pickTranslation,
  type FullScreen,
} from "@/lib/engine/render";
import type { Bot, BotUser, EventType } from "@prisma/client";

const SCREEN_INCLUDE = {
  translations: true,
  buttons: {
    include: { webApp: true, targetScreen: { select: { key: true } } },
    orderBy: [{ row: "asc" as const }, { col: "asc" as const }],
  },
};

/** Telegram'dan kelgan bitta update'ni to'liq qayta ishlaydi. */
export async function handleUpdate(bot: Bot, update: TgUpdate): Promise<void> {
  if (update.my_chat_member) return handleChatMember(bot, update);

  const from =
    update.message?.from ?? update.callback_query?.from ?? update.edited_message?.from;
  if (!from || from.is_bot) return;

  const token = botToken(bot);
  const botUser = await upsertBotUser(bot, from);

  if (botUser.isBanned) return;

  if (bot.maintenanceMode) {
    await send(token, {
      chatId: Number(botUser.telegramId),
      text: bot.maintenanceText || "🛠 Bot vaqtincha texnik ishlar tufayli to'xtatilgan.",
    });
    return;
  }

  // Majburiy obuna — obuna bo'lmaguncha boshqa hech narsa ko'rsatilmaydi.
  const channels = parseChannels(bot.requiredChannels);
  if (channels.length > 0) {
    const isCheck =
      update.callback_query?.data === CB.checkSub || !!update.callback_query;
    const missing = await missingChannels(token, channels, Number(botUser.telegramId));
    if (missing.length > 0) {
      if (update.callback_query) {
        await answerCallbackQuery(
          token,
          update.callback_query.id,
          "Avval kanallarga obuna bo'ling",
          true
        ).catch(() => {});
      }
      await sendSubscriptionGate(token, botUser, missing);
      return;
    }
    if (isCheck && update.callback_query?.data === CB.checkSub) {
      await answerCallbackQuery(token, update.callback_query.id, "✅ Rahmat!").catch(
        () => {}
      );
      await showScreenByKey(bot, botUser, "start");
      return;
    }
  }

  if (update.callback_query) return handleCallback(bot, botUser, update);
  if (update.message) return handleMessage(bot, botUser, update);
}

// ------------------------------------------------------------------- message

async function handleMessage(bot: Bot, botUser: BotUser, update: TgUpdate) {
  const msg = update.message!;
  const token = botToken(bot);
  const chatId = Number(botUser.telegramId);

  if (msg.contact?.phone_number) {
    await prisma.botUser.update({
      where: { id: botUser.id },
      data: { phone: msg.contact.phone_number },
    });
  }

  const text = (msg.text ?? "").trim();

  // 1) Buyruq
  if (text.startsWith("/")) {
    const key = text.slice(1).split(/[\s@]/)[0].toLowerCase();
    await logEvent(bot.id, botUser.id, key === "start" ? "START" : "COMMAND", key);
    const command = await prisma.botCommand.findUnique({
      where: { botId_command: { botId: bot.id, command: key } },
    });
    if (command?.screenId) {
      await showScreenById(bot, botUser, command.screenId);
    } else {
      await showScreenByKey(bot, botUser, key === "start" ? "start" : "start");
    }
    return;
  }

  await logEvent(bot.id, botUser.id, "MESSAGE", "");

  // 2) Reply-klaviatura tugmasi bosilgan bo'lishi mumkin
  const matched = await matchReplyButton(bot, botUser, text);
  if (matched) return;

  // 3) Formadan javob kutilyaptimi
  if (botUser.awaitingField && botUser.currentScreenKey) {
    const screen = await prisma.screen.findUnique({
      where: { botId_key: { botId: bot.id, key: botUser.currentScreenKey } },
    });
    const data = { ...(botUser.data as Record<string, unknown>) };
    data[botUser.awaitingField] = text;
    await prisma.botUser.update({
      where: { id: botUser.id },
      data: { data: data as never, awaitingField: null },
    });
    if (screen?.inputNextKey) {
      await showScreenByKey(bot, { ...botUser, data: data as never }, screen.inputNextKey);
      return;
    }
    await send(token, { chatId, text: "✅ Qabul qilindi, rahmat!" });
    return;
  }

  // 4) Kalit so'z triggerlari
  if (await matchTrigger(bot, botUser, text)) return;

  // 5) Tushunarsiz xabar — fallback ekran yoki jim turish
  const fallback = await loadScreen(bot.id, "fallback");
  if (fallback) await renderScreen(bot, botUser, fallback);
}

/** Yozilgan matnni kalit so'z triggerlari bilan solishtiradi. */
async function matchTrigger(bot: Bot, botUser: BotUser, text: string) {
  if (!text) return false;

  const triggers = await prisma.trigger.findMany({
    where: { botId: bot.id, isActive: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  const hit = triggers.find((t) => {
    const haystack = t.caseSensitive ? text : text.toLowerCase();
    const needle = t.caseSensitive ? t.pattern : t.pattern.toLowerCase();
    switch (t.matchType) {
      case "EXACT":
        return haystack === needle;
      case "STARTS_WITH":
        return haystack.startsWith(needle);
      default:
        return haystack.includes(needle);
    }
  });
  if (!hit) return false;

  await prisma.trigger
    .update({ where: { id: hit.id }, data: { hitCount: { increment: 1 } } })
    .catch(() => {});
  await showScreenById(bot, botUser, hit.screenId);
  return true;
}

/** Reply klaviaturada bosilgan tugmani matni bo'yicha topadi. */
async function matchReplyButton(bot: Bot, botUser: BotUser, text: string) {
  if (!text) return false;
  const buttons = await prisma.button.findMany({
    where: { screen: { botId: bot.id, keyboardType: "REPLY" } },
    include: { webApp: true, targetScreen: { select: { key: true, id: true } } },
  });
  const hit = buttons.find((b) => {
    const labels = b.labels as Record<string, string>;
    return Object.values(labels ?? {}).some((l) => l === text);
  });
  if (!hit) return false;

  if (hit.action === "SCREEN" && hit.targetScreenId) {
    await showScreenById(bot, botUser, hit.targetScreenId);
    return true;
  }
  if (hit.action === "COMMAND" && hit.commandKey) {
    await showScreenByKey(bot, botUser, hit.commandKey);
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ callback

async function handleCallback(bot: Bot, botUser: BotUser, update: TgUpdate) {
  const cq = update.callback_query!;
  const token = botToken(bot);
  await answerCallbackQuery(token, cq.id).catch(() => {});
  await logEvent(bot.id, botUser.id, "CALLBACK", cq.data ?? "");

  const parsed = parseCallback(cq.data ?? "");
  switch (parsed.kind) {
    case "screen":
      return showScreenById(bot, botUser, parsed.id);
    case "command":
      return showScreenByKey(bot, botUser, parsed.key);
    case "back":
      return showScreenByKey(bot, botUser, "start");
    default:
      return;
  }
}

// ------------------------------------------------------------- chat member

async function handleChatMember(bot: Bot, update: TgUpdate) {
  const cm = update.my_chat_member!;
  if (cm.chat.type !== "private") return;
  const blocked = ["kicked", "left"].includes(cm.new_chat_member.status);

  const botUser = await prisma.botUser.findUnique({
    where: { botId_telegramId: { botId: bot.id, telegramId: BigInt(cm.from.id) } },
  });
  if (!botUser) return;

  await prisma.botUser.update({
    where: { id: botUser.id },
    data: { isBlocked: blocked, blockedAt: blocked ? new Date() : null },
  });
  await logEvent(bot.id, botUser.id, blocked ? "BLOCK" : "UNBLOCK", "");
}

// -------------------------------------------------------------------- screen

async function loadScreen(botId: string, key: string): Promise<FullScreen | null> {
  return prisma.screen.findUnique({
    where: { botId_key: { botId, key } },
    include: SCREEN_INCLUDE,
  }) as Promise<FullScreen | null>;
}

export async function showScreenByKey(bot: Bot, botUser: BotUser, key: string) {
  const screen = await loadScreen(bot.id, key);
  if (!screen) return;
  await renderScreen(bot, botUser, screen);
}

async function showScreenById(bot: Bot, botUser: BotUser, id: string) {
  const screen = (await prisma.screen.findFirst({
    where: { id, botId: bot.id },
    include: SCREEN_INCLUDE,
  })) as FullScreen | null;
  if (!screen) return;
  await renderScreen(bot, botUser, screen);
}

/** Ekranni foydalanuvchi tiliga moslab yuboradi va holatini saqlaydi. */
export async function renderScreen(bot: Bot, botUser: BotUser, screen: FullScreen) {
  const token = botToken(bot);
  const locale = botUser.locale || bot.defaultLocale;
  const tr = pickTranslation(screen, locale, bot.defaultLocale);
  if (!tr) return;

  const vars = {
    name: botUser.firstName,
    first_name: botUser.firstName,
    last_name: botUser.lastName ?? "",
    username: botUser.username ?? "",
    id: botUser.telegramId.toString(),
    ...(botUser.data as Record<string, unknown>),
  };

  await send(token, {
    chatId: Number(botUser.telegramId),
    text: interpolate(tr.text, vars),
    parseMode: tr.parseMode,
    mediaType: tr.mediaType,
    mediaUrl: tr.mediaUrl,
    replyMarkup: buildKeyboard(screen, locale, bot.defaultLocale),
  });

  await prisma.botUser.update({
    where: { id: botUser.id },
    data: {
      currentScreenKey: screen.key,
      awaitingField: screen.awaitsInput ? screen.inputField : null,
    },
  });
  await logEvent(bot.id, botUser.id, "SCREEN_VIEW", screen.key);
}

// -------------------------------------------------------- majburiy obuna

async function missingChannels(
  token: string,
  channels: { chatId: string; title: string; url: string }[],
  telegramId: number
) {
  const results = await Promise.all(
    channels.map(async (ch) => {
      try {
        const m = await getChatMember(token, ch.chatId, telegramId);
        const ok = ["creator", "administrator", "member"].includes(m.status);
        return ok ? null : ch;
      } catch {
        // Bot kanalda admin emas — bunday kanalni tekshirib bo'lmaydi, o'tkazib yuboramiz.
        return null;
      }
    })
  );
  return results.filter((c): c is (typeof channels)[number] => c !== null);
}

async function sendSubscriptionGate(
  token: string,
  botUser: BotUser,
  missing: { title: string; url: string }[]
) {
  await send(token, {
    chatId: Number(botUser.telegramId),
    text:
      "📢 Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:\n\n" +
      missing.map((c, i) => `${i + 1}. ${c.title}`).join("\n"),
    replyMarkup: {
      inline_keyboard: [
        ...missing.map((c) => [{ text: `➕ ${c.title}`, url: c.url }]),
        [{ text: "✅ Tekshirish", callback_data: CB.checkSub }],
      ],
    },
  }).catch(() => {});
}

// --------------------------------------------------------------------- misc

async function upsertBotUser(bot: Bot, from: TgUser): Promise<BotUser> {
  const telegramId = BigInt(from.id);
  const locale = bot.locales.includes(from.language_code ?? "")
    ? from.language_code!
    : bot.defaultLocale;

  return prisma.botUser.upsert({
    where: { botId_telegramId: { botId: bot.id, telegramId } },
    create: {
      botId: bot.id,
      telegramId,
      username: from.username,
      firstName: from.first_name ?? "",
      lastName: from.last_name,
      locale,
      isPremium: !!from.is_premium,
    },
    update: {
      username: from.username,
      firstName: from.first_name ?? "",
      lastName: from.last_name,
      isPremium: !!from.is_premium,
      isBlocked: false,
      blockedAt: null,
      lastSeenAt: new Date(),
      messageCount: { increment: 1 },
    },
  });
}

async function logEvent(
  botId: string,
  botUserId: string | null,
  type: EventType,
  name: string
) {
  await prisma.event
    .create({ data: { botId, botUserId, type, name: name.slice(0, 100) } })
    .catch(() => {});
}

export { TelegramError };
