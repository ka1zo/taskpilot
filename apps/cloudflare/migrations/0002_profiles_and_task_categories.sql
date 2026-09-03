ALTER TABLE users ADD COLUMN display_name TEXT;

ALTER TABLE tasks ADD COLUMN category TEXT NOT NULL DEFAULT 'inbox'
  CHECK (category IN ('inbox', 'work', 'personal', 'study', 'health'));

CREATE INDEX idx_tasks_owner_category ON tasks(owner_id, category);

PRAGMA optimize;
