-- The announcement wall (the head, 2 Oct 2026): coordinators post to their batches, masters to everyone or to
-- chosen batches; each person sees what was posted for their batch(es) or for everyone. In-app only (decision 15).
CREATE TABLE announcements (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL, body TEXT NOT NULL,
  audience TEXT NOT NULL,                 -- 'ALL', or batch ids separated by commas
  pinned INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL DEFAULT '',
  author_login TEXT NOT NULL, author_name TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, removed_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX announcements_recent ON announcements (removed_at, created_at);
