import { EndpointError } from 'sdk';
import { isAdmin } from './broadcast.js';

/** Endpoint faqat adminlar uchun. Init data platforma tomonidan tekshirilgan. */
export function requireAdmin(ctx) {
  const user = ctx.initData?.user;
  if (!user || !isAdmin(user.id)) {
    throw new EndpointError("Bu panel faqat adminlar uchun", { code: 'FORBIDDEN', userId: user?.id ?? null });
  }
  return user;
}
