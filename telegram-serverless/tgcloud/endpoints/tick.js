// Panel ochiq turganda takror-takror chaqiriladi: har safar bitta bo'lak.

import { requireAdmin } from '../lib/guard.js';
import { runBatch } from '../lib/broadcast.js';

export default async function (input, ctx) {
  requireAdmin(ctx);
  return runBatch();
}
