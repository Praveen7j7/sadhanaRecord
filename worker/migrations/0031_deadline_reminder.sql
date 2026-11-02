-- The deadline reminder (Phase 4, 9 Oct 2026): three hours before last week's Monday 9 PM deadline, one push to each
-- devotee who has not submitted it (src/push.js runDeadlineReminder). It claims its phones from its own progress row,
-- shard 1, the same way the 9 PM reminder uses shard 0. Additive: the row is added only if it is not already there.
-- reminder_progress is not copied to Sheets (0021), so no tab changes.
INSERT OR IGNORE INTO reminder_progress (shard) VALUES (1);
