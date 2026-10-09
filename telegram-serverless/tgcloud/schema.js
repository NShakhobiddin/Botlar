import { table, integer, text, index, sql } from 'sdk/db';

// Obunachilar. tg_id — Telegram chat ID.
export const subscribers = table('subscribers', {
  tgId:      integer('tg_id').primaryKey(),
  firstName: text('first_name'),
  username:  text('username'),
  blocked:   integer('blocked').notNull().default(0),
  source:    text('source').notNull().default('bot'),     // bot | import
  createdAt: integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  // Yuborishda faqat faollar tg_id tartibida o'qiladi.
  activeIdx: index('idx_subscribers_active').on(t.blocked, t.tgId),
}));

// Ommaviy xabarlar. Har biri bo'laklab yuboriladi: `cursor` — oxirgi ishlangan tg_id.
export const broadcasts = table('broadcasts', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  status:     text('status').notNull(),                 // running | done | cancelled
  kind:       text('kind').notNull(),                   // compose | copy
  text:       text('text'),
  photo:      text('photo'),
  buttons:    text('buttons'),                          // JSON: [{ "text": "...", "url": "..." }]
  fromChat:   integer('from_chat'),                     // copy: manba chat
  messageId:  integer('message_id'),                    // copy: manba xabar
  cursor:     integer('cursor').notNull().default(0),
  total:      integer('total').notNull().default(0),
  sent:       integer('sent').notNull().default(0),
  blocked:    integer('blocked').notNull().default(0),
  failed:     integer('failed').notNull().default(0),
  nextAt:     integer('next_at').notNull().default(0),     // ms: keyingi bo'lak bundan oldin emas
  lockUntil:  integer('lock_until').notNull().default(0),  // ms: bir vaqtda ikki bo'lak bo'lmasin
  createdBy:  integer('created_by'),
  createdAt:  integer('created_at').default(sql`(unixepoch())`),
  finishedAt: integer('finished_at'),
}, (t) => ({
  statusIdx: index('idx_broadcasts_status').on(t.status),
}));

export const settings = table('settings', {
  key:   text('key').primaryKey(),
  value: text('value'),
});
