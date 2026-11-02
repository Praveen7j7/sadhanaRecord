-- Notifications are a default of the app on every phone that allows them, signed in or not (the head, 3 Oct 2026).
-- push_subs.login '' = a phone with nobody signed in. The push itself carries no content: when it arrives, the phone
-- asks push.message what to show, which is kept here in `pending` (JSON { title, body, url, tag }).
ALTER TABLE push_subs ADD COLUMN pending TEXT NOT NULL DEFAULT '';
-- an announcement to send as notifications, worked through 35 phones a scheduled run
CREATE TABLE push_jobs (
  id INTEGER PRIMARY KEY, ann_id INTEGER NOT NULL, audience TEXT NOT NULL, title TEXT NOT NULL, created_at TEXT NOT NULL,
  cursor INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN', 'DONE')), sent INTEGER NOT NULL DEFAULT 0
);
