// Eski bazadagi obunachilar ID'larini qo'shadi. Panel katta ro'yxatni bo'laklab yuboradi.

import { EndpointError } from 'sdk';
import { requireAdmin } from '../lib/guard.js';
import { importIds } from '../lib/broadcast.js';

const MAX_CHUNK = 2000;

export default async function (input, ctx) {
  requireAdmin(ctx);
  const ids = Array.isArray(input.ids) ? input.ids : [];
  if (!ids.length) throw new EndpointError("Ro'yxat bo'sh", { code: 'EMPTY' });
  if (ids.length > MAX_CHUNK) throw new EndpointError(`Bir so'rovda ${MAX_CHUNK} tadan ko'p emas`, { code: 'TOO_MANY' });
  return importIds(ids);
}
