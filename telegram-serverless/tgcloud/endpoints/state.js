// Panel ochilganda: statistika, joriy yuborish, tarix, /start matni.

import { api } from 'sdk';
import { requireAdmin } from '../lib/guard.js';
import { stats, currentJob, history, welcomeText, getSetting, setSetting } from '../lib/broadcast.js';
import { BATCH_SIZE, RATE_PER_SEC } from '../lib/config.js';

async function botInfo() {
  const cached = await getSetting('bot_info');
  if (cached) return cached;
  const me = await api.getMe().catch(() => null);
  if (!me) return null;
  const info = { username: me.username, first_name: me.first_name };
  await setSetting('bot_info', info);
  return info;
}

export default async function (input, ctx) {
  const admin = requireAdmin(ctx);
  const [s, bot, current, recent, welcome] = await Promise.all([
    stats(input.fresh === true),
    botInfo(),
    currentJob(),
    history(10),
    welcomeText(),
  ]);
  return { stats: s, bot, current, history: recent, welcome, admin: { id: admin.id, first_name: admin.first_name }, batchSize: BATCH_SIZE, rate: RATE_PER_SEC };
}
