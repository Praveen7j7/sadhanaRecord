-- The copy to Sheets works in pieces (at most 300 rows a run), because the Free plan allows only 10 ms of
-- processing per scheduled run. For a table being rewritten, last_id is how far the rewrite has got and gen is
-- the change count it started from (a change part-way restarts the rewrite).
ALTER TABLE mirror_state ADD COLUMN gen INTEGER NOT NULL DEFAULT 0;
