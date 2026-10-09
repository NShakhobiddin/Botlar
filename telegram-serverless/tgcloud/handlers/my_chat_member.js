// Foydalanuvchi botni bloklasa yoki qayta yoqsa — ro'yxatda belgilanadi.

import { setBlocked } from '../lib/broadcast.js';

export default async function (update) {
  if (update.chat.type !== 'private') return;
  const status = update.new_chat_member?.status;
  await setBlocked(update.from, status === 'kicked' || status === 'left');
}
