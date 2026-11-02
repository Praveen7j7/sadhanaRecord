-- 4 Oct 2026 (the head):
--  · facilitator logins: a staff account (role COORDINATOR: the role CHECK allows three roles) with no batches, tied to one
--    name of the facilitators list; it sees, read-only, the devotees whose membership has that facilitator, and their weeks
--  · announcements become posts: likes and comments (WhatsApp sharing needs nothing stored)
ALTER TABLE accounts ADD COLUMN facilitator_name TEXT NOT NULL DEFAULT '';
CREATE INDEX accounts_by_facilitator ON accounts (facilitator_name) WHERE facilitator_name <> '';
CREATE INDEX memberships_by_facilitator ON memberships (facilitator, to_week);

CREATE TABLE post_likes (
  ann_id INTEGER NOT NULL,
  login TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (ann_id, login)
);
CREATE TABLE post_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ann_id INTEGER NOT NULL,
  login TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  at TEXT NOT NULL,
  removed_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX post_comments_by_post ON post_comments (ann_id, id) WHERE removed_at = '';
