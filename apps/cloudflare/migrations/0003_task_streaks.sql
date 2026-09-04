ALTER TABLE users ADD COLUMN streak_count INTEGER NOT NULL DEFAULT 0
  CHECK (streak_count BETWEEN 0 AND 1000);

ALTER TABLE users ADD COLUMN streak_last_completed_at TEXT;

PRAGMA optimize;
