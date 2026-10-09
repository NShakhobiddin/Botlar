// Bot ichidagi «Davom ettirish» / «To'xtatish» tugmalari.

import { api } from 'sdk';
import { isAdmin, runBatch, cancelJob, currentJob, progressText } from '../lib/broadcast.js';

const CONTROLS = {
  inline_keyboard: [[
    { text: '▶️ Davom ettirish', callback_data: 'bc:tick' },
    { text: "⏹ To'xtatish", callback_data: 'bc:cancel' },
  ]],
};

export default async function (query) {
  const data = query.data ?? '';
  if (!data.startsWith('bc:')) return;

  if (!isAdmin(query.from.id)) {
    await api.answerCallbackQuery({ callback_query_id: query.id, text: "Ruxsat yo'q" });
    return;
  }

  let job;
  let toast;
  if (data === 'bc:cancel') {
    await cancelJob();
    job = null;
    toast = "To'xtatildi";
  } else {
    const result = await runBatch();
    job = result.job;
    if (result.waitMs > 1500) toast = `${Math.ceil(result.waitMs / 1000)} s dan keyin bosing`;
    else if (result.note) toast = result.note;
  }

  await api.answerCallbackQuery({ callback_query_id: query.id, text: toast }).catch(() => {});

  const message = query.message;
  if (!message) return;
  const shown = job ?? (await currentJob());
  const text = shown ? progressText(shown) : "⏹ To'xtatildi";
  await api.editMessageText({
    chat_id: message.chat.id,
    message_id: message.message_id,
    text,
    reply_markup: shown && shown.status === 'running' ? CONTROLS : undefined,
  }).catch(() => {}); // matn o'zgarmagan bo'lsa Telegram 400 qaytaradi — e'tiborsiz
}
