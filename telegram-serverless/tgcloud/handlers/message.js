// Har bir xabarda: yozgan odamni ro'yxatga qo'shadi, /start ga javob beradi,
// adminlar uchun /broadcast, /stats, /cancel, /panel buyruqlari.

import { api } from 'sdk';
import {
  isAdmin, upsertSubscriber, welcomeText, stats,
  createJob, cancelJob, runBatch, progressText,
} from '../lib/broadcast.js';
import { MINI_APP_URL } from '../lib/config.js';

const CONTROLS = {
  inline_keyboard: [[
    { text: '▶️ Davom ettirish', callback_data: 'bc:tick' },
    { text: "⏹ To'xtatish", callback_data: 'bc:cancel' },
  ]],
};

export default async function (message) {
  if (message.chat.type !== 'private' || !message.from || message.from.is_bot) return;
  await upsertSubscriber(message.from);

  const chat_id = message.chat.id;
  const text = (message.text ?? '').trim();
  const command = text.startsWith('/') ? text.slice(1).split(/[\s@]/)[0].toLowerCase() : '';

  if (command === 'start') {
    const welcome = await welcomeText();
    await api.sendMessage({ chat_id, text: welcome, parse_mode: 'HTML' })
      .catch(() => api.sendMessage({ chat_id, text: welcome }));
    return;
  }

  if (!isAdmin(message.from.id)) return;

  if (command === 'stats') {
    const s = await stats(true);
    await api.sendMessage({
      chat_id,
      text: `📊 Obunachilar: ${s.total}\nXabar oladiganlar: ${s.active}\nBloklagan: ${s.blocked}\nImport qilingan: ${s.imported}`,
    });
    return;
  }

  if (command === 'cancel') {
    const cancelled = await cancelJob();
    await api.sendMessage({ chat_id, text: cancelled ? "⏹ To'xtatildi" : "Hozir hech narsa yuborilmayapti" });
    return;
  }

  if (command === 'panel') {
    if (!MINI_APP_URL) {
      await api.sendMessage({ chat_id, text: "Panel manzili sozlanmagan: lib/config.js dagi MINI_APP_URL ga `push` chiqargan manzilni yozing." });
      return;
    }
    // Menyu tugmasi faqat shu admin chatida o'zgaradi — oddiy obunachilar ko'rmaydi.
    await api.setChatMenuButton({
      chat_id,
      menu_button: { type: 'web_app', text: 'Panel', web_app: { url: MINI_APP_URL } },
    }).catch(() => {});
    await api.sendMessage({
      chat_id,
      text: "Boshqaruv paneli. Pastdagi «Panel» menyu tugmasi orqali ham ochiladi.",
      reply_markup: { inline_keyboard: [[{ text: '📊 Panelni ochish', web_app: { url: MINI_APP_URL } }]] },
    });
    return;
  }

  if (command === 'broadcast') {
    if (!message.reply_to_message) {
      await api.sendMessage({
        chat_id,
        text: "Yubormoqchi bo'lgan xabarni (matn, rasm, video — istalgani) shu chatga yozing, keyin unga javob tariqasida /broadcast yuboring.",
      });
      return;
    }
    const job = await createJob({
      kind: 'copy',
      fromChat: chat_id,
      messageId: message.reply_to_message.message_id,
      createdBy: message.from.id,
    });
    if (typeof job === 'string') {
      await api.sendMessage({ chat_id, text: `⚠️ ${job}` });
      return;
    }
    // Birinchi bo'lak darhol ketadi, qolgani — tugma yoki panel orqali.
    const { job: fresh } = await runBatch();
    const current = fresh ?? job;
    await api.sendMessage({
      chat_id,
      text:
        progressText(current) +
        "\n\nDavom ettirish uchun tugmani bosing yoki /panel ni oching — panel ochiq turganda o'zi yuboradi." +
        "\nManba xabarni yuborish tugaguncha o'chirmang.",
      reply_markup: current.status === 'running' ? CONTROLS : undefined,
    });
    return;
  }

  if (command === 'help' || command === 'admin') {
    await api.sendMessage({
      chat_id,
      text:
        "Admin buyruqlari:\n\n" +
        "/broadcast — xabarga javob tariqasida yuborilsa, o'sha xabar hammaga ketadi\n" +
        "/panel — boshqaruv paneli (Mini App)\n" +
        "/stats — obunachilar soni\n" +
        "/cancel — yuborishni to'xtatish",
    });
  }
}
