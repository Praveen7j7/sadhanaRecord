-- One timestamp format per column (13 Oct 2026; audit finding B9 / roadmap 2.5).
--
-- Every timestamp the app writes is Indian time with its offset, "2026-10-13T09:30:00+05:30" (util.js isoIst),
-- and screens, exports and comparisons assume that. Three places wrote UTC "…Z" into the same columns instead:
--   · accounts.updated_at   — registry.js followMerges(), when the dashboard merges an ID
--   · settings.changed_at   — registry.js, the registry_sig fingerprint row
--   · mirror_state.synced_at — mirror.js, on every copy
-- A "Z" string sorts 5 hours 30 minutes away from its IST neighbours, and `view_state.synced_at` (the same column
-- name, written in IST) is actually SORTED ON in views.js:123 to pick the next view sheet to refresh. The code now
-- writes isoIst() everywhere; this migration converts the rows that are already stored.
--
-- The conversion adds 5 hours 30 minutes to the instant and re-writes it with the offset, so the moment in time is
-- unchanged — only its spelling. Rows already in IST (they end in "+05:30") are left alone, which also makes this
-- file safe to re-run.
--
-- Checked on sample values before writing this (node:sqlite, 13 Oct 2026): an evening UTC value crosses correctly
-- into the next IST day, a value already in IST and an empty string are untouched, and a second run changes
-- nothing. The one difference from the original is that any milliseconds are dropped
-- ("…04:23:45.123Z" → "…09:53:45+05:30", 0.123 s), which is what isoIst() writes anyway — seconds, no fraction —
-- so the converted rows match every other timestamp in the database.

UPDATE accounts
   SET updated_at = strftime('%Y-%m-%dT%H:%M:%S', updated_at, '+330 minutes') || '+05:30'
 WHERE updated_at LIKE '%Z' AND strftime('%Y', updated_at, '+330 minutes') IS NOT NULL;

UPDATE settings
   SET changed_at = strftime('%Y-%m-%dT%H:%M:%S', changed_at, '+330 minutes') || '+05:30'
 WHERE changed_at LIKE '%Z' AND strftime('%Y', changed_at, '+330 minutes') IS NOT NULL;

UPDATE mirror_state
   SET synced_at = strftime('%Y-%m-%dT%H:%M:%S', synced_at, '+330 minutes') || '+05:30'
 WHERE synced_at LIKE '%Z' AND strftime('%Y', synced_at, '+330 minutes') IS NOT NULL;
