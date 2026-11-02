-- The master manages the facilitator list (the head, 3 Oct 2026): add a name, switch one off (it is then no longer
-- offered at sign-up, approval or a devotee's edit), and delete one that is switched off. The dashboard's NameMap
-- still feeds the list every night, but now only adds and updates its names: it never turns a switched-off name back
-- on and never brings a deleted one back. Devotees keep the facilitator they already have.
ALTER TABLE facilitators ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE facilitators ADD COLUMN source TEXT NOT NULL DEFAULT 'DASHBOARD';   -- DASHBOARD (NameMap) or APP (added by the master)
ALTER TABLE facilitators ADD COLUMN seen INTEGER NOT NULL DEFAULT 1;            -- in the last NameMap read (refresh marker)
ALTER TABLE facilitators ADD COLUMN deleted_at TEXT NOT NULL DEFAULT '';
ALTER TABLE facilitators ADD COLUMN changed_by TEXT NOT NULL DEFAULT '';
ALTER TABLE facilitators ADD COLUMN changed_at TEXT NOT NULL DEFAULT '';
-- copied to the Google Sheets from now on as well (decision 39: everything the app keeps is visible in the sheets)
INSERT INTO mirror_state (tbl) VALUES ('facilitators'), ('missed_weeks'), ('reopen_requests'), ('announcements'), ('duplicate_reviews');
