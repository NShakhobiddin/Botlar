import { requireAdmin } from '../lib/guard.js';
import { cancelJob } from '../lib/broadcast.js';

export default async function (input, ctx) {
  requireAdmin(ctx);
  return { cancelled: await cancelJob() };
}
