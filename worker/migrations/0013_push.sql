-- The 9 PM reminder (Web Push, approved by the head 3 Oct 2026; decision 15 relaxed for this one reminder).
-- One row per phone/browser that said yes. No message content is sent: the app on the phone shows the text.
CREATE TABLE push_subs (
  endpoint TEXT PRIMARY KEY, login TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  created_at TEXT NOT NULL, last_sent TEXT NOT NULL DEFAULT '', last_status INTEGER NOT NULL DEFAULT 0, fails INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX push_subs_by_login ON push_subs (login);
INSERT INTO settings (key, value, note, changed_by) VALUES
  ('reminder_time', '21:00', 'Daily reminder (IST) to devotees whose day is not filled yet', 'setup'),
  ('reminder_day', '', 'Last day the reminder run started', 'setup'),
  ('reminder_cursor', '0', 'How far today''s reminder run has got (push_subs rowid)', 'setup');
