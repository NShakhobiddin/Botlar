import { EndpointError } from 'sdk';
import { requireAdmin } from '../lib/guard.js';
import { setSetting } from '../lib/broadcast.js';

export default async function (input, ctx) {
  requireAdmin(ctx);
  const text = String(input.text ?? '').trim();
  if (!text) throw new EndpointError("Matn bo'sh bo'lmasin", { code: 'EMPTY' });
  await setSetting('welcome', text.slice(0, 4000));
  return { ok: true };
}
