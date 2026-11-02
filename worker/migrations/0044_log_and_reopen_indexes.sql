-- Indexes for the tables that grow for ever and are filtered by hand (13 Oct 2026; audit §6 / roadmap 2.3).
-- Each one was chosen from EXPLAIN QUERY PLAN output, not from a guess: every statement below said SCAN before.
--
--   audit_log   the head's Activity screen filters by who / target / a date range (coord.js auditList), and
--               erase.js sweeps `who = ? OR target = ?` when a devotee is deleted. The table keeps six months of
--               every staff and identity change, so a scan grows with the whole history, not with one batch.
--               Three single-column indexes rather than one composite: the filters are used separately, and
--               SQLite can only use one of them per query anyway.
--   reopens     read on EVERY batch board and every devotee board (`week_id = ? AND state = 'OPEN'`), and rows
--               are never deleted, only closed — so this scan grows with every reopen ever granted.
--   sessions    the hourly tidy-up deletes by `last_used_at`; the table holds one row per sign-in for 60 days.
--
-- Deliberately NOT added:
--   accounts(role)         — `role <> 'DEVOTEE'` matches almost every staff row; an index would not be used.
--   person_names(name)     — already exists (person_names_search, 0038:45) and already serves the lookup.
--   reopen_requests(state) — a handful of rows at a time; the audit's own allow-list treats it as small.
--
-- Additive and re-runnable. Index writes cost a little on insert; all three tables are written rarely (an audit
-- row per staff action, a reopen per request, a session per sign-in) and read on screens people wait for.

CREATE INDEX IF NOT EXISTS audit_log_who     ON audit_log (who, id);
CREATE INDEX IF NOT EXISTS audit_log_target  ON audit_log (target, id);
CREATE INDEX IF NOT EXISTS audit_log_at      ON audit_log (at);
CREATE INDEX IF NOT EXISTS reopens_week_state ON reopens (week_id, state);
CREATE INDEX IF NOT EXISTS sessions_last_used ON sessions (last_used_at);
