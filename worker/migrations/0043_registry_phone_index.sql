-- An index on registry.phone (13 Oct 2026; audit finding B10 / roadmap 2.3).
--
-- Why: `registry` is the copy of the dashboard's Devotees tab, about 1,600 rows and growing with every new devotee
-- IYF registers. It is keyed by iyf_id, so every lookup BY PHONE had no index to use. EXPLAIN QUERY PLAN before
-- this migration, for the head's "IDs created in the app" screen (src/admin.js:436):
--     SCAN app_ids USING COVERING INDEX app_ids_by_login
--     SEARCH registry USING AUTOMATIC COVERING INDEX (phone=?) LEFT-JOIN
-- "AUTOMATIC" means SQLite built a throwaway index for that one statement and threw it away again — it pays the
-- build cost on every call. A plain `WHERE phone = ?` was a full SCAN.
--
-- Additive, re-runnable, and it costs one small index on a table the schedule rewrites in diffs only.

CREATE INDEX IF NOT EXISTS registry_phone ON registry (phone);
