-- The 9 PM reminder, claimed in chunks (3 Oct 2026): on the first night, one of the two extra evening schedules never
-- reached its part (Cloudflare seemingly treated "* 15-17 * * *" and "0-59 15-17 * * *" as one), so a third of the
-- phones got nothing. Now every evening run — however many fire — claims the next PER_RUN phones from one shared
-- position in a single UPDATE … RETURNING (prev = where the chunk starts, cursor = where it ends; -1 = all claimed).
-- Two runs can never take the same phones and none is skipped; fewer runs only means slower. Row shard = 0 is used.
ALTER TABLE reminder_progress ADD COLUMN prev INTEGER NOT NULL DEFAULT 0;
