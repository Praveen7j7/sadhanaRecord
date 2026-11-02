-- The 9 PM reminder in three parts (phase 6, 3 Oct 2026): the free plan allows 50 outside requests per scheduled run,
-- so one run reaches 35 phones a minute (5,000 phones would take until 23:25). Two extra schedules fire every minute in
-- the evening (wrangler.toml); each sends to its own third of the phones (rowid % 3), so 105 phones a minute — 5,000 in
-- under an hour, at no cost. Each part keeps its own progress here (not in Settings, so nothing is copied to Sheets).
CREATE TABLE reminder_progress (shard INTEGER PRIMARY KEY, day TEXT NOT NULL DEFAULT '', cursor INTEGER NOT NULL DEFAULT 0);
INSERT INTO reminder_progress (shard) VALUES (0), (1), (2);
