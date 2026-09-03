CREATE TABLE users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  language TEXT NOT NULL DEFAULT 'ru' CHECK (language IN ('ru', 'en')),
  timezone_offset_minutes INTEGER NOT NULL DEFAULT 180 CHECK (timezone_offset_minutes BETWEEN -720 AND 840),
  daily_digest_hour INTEGER NOT NULL DEFAULT 9 CHECK (daily_digest_hour BETWEEN 0 AND 23),
  daily_digest_enabled INTEGER NOT NULL DEFAULT 1 CHECK (daily_digest_enabled IN (0, 1)),
  last_digest_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'archived')),
  priority TEXT NOT NULL DEFAULT 'low' CHECK (priority IN ('low', 'medium', 'high')),
  due_at TEXT,
  remind_at TEXT,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX idx_tasks_owner_status_due ON tasks(owner_id, status, due_at);
CREATE INDEX idx_tasks_pending_reminders ON tasks(remind_at) WHERE status = 'pending' AND reminder_sent = 0;
CREATE INDEX idx_users_digest ON users(daily_digest_enabled, daily_digest_hour);

PRAGMA optimize;
