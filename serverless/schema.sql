-- Obunachilar. id — Telegram chat ID.
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY,
  first_name  TEXT,
  username    TEXT,
  blocked     INTEGER NOT NULL DEFAULT 0,
  source      TEXT    NOT NULL DEFAULT 'bot',   -- 'bot' | 'import'
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
-- Yuborishda faqat faollar id bo'yicha tartib bilan o'qiladi.
CREATE INDEX IF NOT EXISTS users_active ON users (blocked, id);

CREATE TABLE IF NOT EXISTS broadcasts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  status       TEXT    NOT NULL,                -- running | done | cancelled
  kind         TEXT    NOT NULL,                -- compose | copy
  text         TEXT,
  photo        TEXT,
  buttons      TEXT,                            -- JSON: [{ "text": "...", "url": "..." }]
  from_chat    INTEGER,                         -- copy: manba chat
  message_id   INTEGER,                         -- copy: manba xabar
  cursor       INTEGER NOT NULL DEFAULT 0,      -- oxirgi ishlangan user id
  total        INTEGER NOT NULL DEFAULT 0,
  sent         INTEGER NOT NULL DEFAULT 0,
  blocked      INTEGER NOT NULL DEFAULT 0,
  failed       INTEGER NOT NULL DEFAULT 0,
  retry_at     INTEGER NOT NULL DEFAULT 0,      -- 429 bo'lsa shu vaqtgacha kutiladi
  lock_until   INTEGER NOT NULL DEFAULT 0,      -- bir vaqtda ikki bo'lak yuborilmasin
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at  INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
