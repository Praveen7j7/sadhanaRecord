-- Phase 9, item 23 (the head, 9 Oct 2026): scheduled announcements. publish_at is when a post appears and its
-- notification goes out ('' = at once, as every post so far). Additive: the old code ignores the column.
-- Item 8 (facilitators post to their students) needs no schema change: the audience 'STU:<facilitator name>'.
-- Build the Sheets column first: `node setup/build-store.mjs apply access` adds publish_at at the end of Announcements.
ALTER TABLE announcements ADD COLUMN publish_at TEXT NOT NULL DEFAULT '';
