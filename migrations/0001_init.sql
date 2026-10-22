CREATE TABLE allowed_emails (
  email      TEXT PRIMARY KEY,                   -- siempre en minúsculas
  enabled    INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  added_by   TEXT NOT NULL,
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,
  updated_at TEXT
);
CREATE TABLE admin_audit (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('add','enable','disable','sync')),
  email  TEXT,
  ok     INTEGER NOT NULL,
  at     TEXT NOT NULL DEFAULT (datetime('now'))
);
