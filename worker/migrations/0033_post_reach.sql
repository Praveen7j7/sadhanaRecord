-- Phase 9, item 18: how far an announcement reached. The notification job counts, as it works through the phones,
-- how many it tried (the audience's phones when it was sent), how many took it, how many are gone (the browser said
-- the address no longer exists, or 7 failures in a row) and how many failed this time; and when it finished.
-- Additive; no data about people (counts only). push_jobs is not copied to Sheets (an internal queue, like push_subs).
ALTER TABLE push_jobs ADD COLUMN tried INTEGER NOT NULL DEFAULT 0;
ALTER TABLE push_jobs ADD COLUMN gone INTEGER NOT NULL DEFAULT 0;
ALTER TABLE push_jobs ADD COLUMN failed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE push_jobs ADD COLUMN done_at TEXT NOT NULL DEFAULT '';
-- the reach is read by post (the Wall, for its author and the head) and a removal closes a post's job: by ann_id
CREATE INDEX push_jobs_ann ON push_jobs (ann_id);
