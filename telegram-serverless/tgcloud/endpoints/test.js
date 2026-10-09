// Xabarni avval panelni ochgan adminning o'ziga yuboradi.

import { EndpointError, BotApiError } from 'sdk';
import { requireAdmin } from '../lib/guard.js';
import { deliver, parseButtons } from '../lib/broadcast.js';

export default async function (input, ctx) {
  const admin = requireAdmin(ctx);
  const text = String(input.text ?? '').trim();
  const photo = String(input.photo ?? '').trim() || null;
  const buttons = parseButtons(input.buttons);

  if (typeof buttons === 'string') throw new EndpointError(buttons, { code: 'BAD_BUTTONS' });
  if (!text && !photo) throw new EndpointError('Matn yoki rasm kiriting', { code: 'EMPTY' });

  try {
    await deliver({ kind: 'compose', text, photo, buttons: JSON.stringify(buttons) }, admin.id);
  } catch (err) {
    if (err instanceof BotApiError) {
      const hint = err.code === 403 ? ' — avval botga /start yozing' : '';
      throw new EndpointError(`Telegram rad etdi: ${err.description}${hint}`, { code: 'TELEGRAM', telegram: err.code });
    }
    throw err;
  }
  return { ok: true };
}
