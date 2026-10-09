// Paneldan yozilgan xabarni hammaga yuborishni boshlaydi.

import { EndpointError } from 'sdk';
import { requireAdmin } from '../lib/guard.js';
import { createJob, parseButtons } from '../lib/broadcast.js';

export default async function (input, ctx) {
  const admin = requireAdmin(ctx);
  const text = String(input.text ?? '').trim();
  const photo = String(input.photo ?? '').trim() || null;
  const buttons = parseButtons(input.buttons);

  if (typeof buttons === 'string') throw new EndpointError(buttons, { code: 'BAD_BUTTONS' });
  if (!text && !photo) throw new EndpointError('Matn yoki rasm kiriting', { code: 'EMPTY' });
  if (photo && text.length > 1024) throw new EndpointError("Rasm ostidagi matn 1024 belgidan oshmasin", { code: 'TOO_LONG' });

  const job = await createJob({ kind: 'compose', text, photo, buttons: JSON.stringify(buttons), createdBy: admin.id });
  if (typeof job === 'string') throw new EndpointError(job, { code: 'CANNOT_START' });
  return { job };
}
