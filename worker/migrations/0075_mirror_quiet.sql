-- C1 (COPIES_AND_SPEED_AUDIT_2026-10-27 §4): the paused Sheets copy stops writing a change-log row on every change.
--
-- The copy to Google Sheets has been paused since 13 Oct 2026 (wrangler.toml SHEETS_COPY = "off"), but its 112
-- triggers on 28 tables still added a mirror_log row for every insert, update and delete: a third of every row the
-- app wrote (2,727 of 8,258 over the server suite; 12 of the 35 rows of a devotee's week), into a queue nothing read.
--
-- Each of those triggers is re-created here EXACTLY as it was in force after 0074 — same event, same table, same
-- body, same condition — with one thing added to its WHEN: the copy switch. While the switch is off a change costs one
-- read of mirror_switch by its primary key and writes no row. (tests/mirror-quiet.test.mjs proves the body and the
-- old condition of every trigger are unchanged, and that no mirror trigger is left without the switch.)
--
-- THE SWITCH IS KEPT BY THE SCHEDULE, NOT BY HAND. Every scheduled run makes mirror_switch equal to SHEETS_COPY
-- (worker/src/mirror.js syncCopySwitch). It starts OFF, as the copy is now. Resuming the copy is: set
-- SHEETS_COPY = "on" and deploy; the next run switches the triggers on AND starts a full re-copy of every tab in the
-- same atomic batch, so no change can fall between the two. The queue left from before is skipped, never replayed:
-- the whole copies cover it (docs/INTEGRATIONS.md, "Resuming the copy").
--
-- Generated from the in-force schema (scratchpad gen0075.mjs, 27 Oct 2026); new mirror triggers get the guard from
-- setup/build-mirror-sql.mjs.
CREATE TABLE IF NOT EXISTS mirror_switch (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state TEXT NOT NULL DEFAULT 'off' CHECK (state IN ('on', 'off')),
  changed_at TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO mirror_switch (id, state, changed_at) VALUES (1, 'off', '');

DROP TRIGGER IF EXISTS mirror_accounts_del;
CREATE TRIGGER mirror_accounts_del AFTER DELETE ON accounts WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('accounts', OLD."login", ''); END;
DROP TRIGGER IF EXISTS mirror_accounts_ins;
CREATE TRIGGER mirror_accounts_ins AFTER INSERT ON accounts WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('accounts', NEW."login", ''); END;
DROP TRIGGER IF EXISTS mirror_accounts_key;
CREATE TRIGGER mirror_accounts_key AFTER UPDATE ON accounts WHEN (OLD."login" IS NOT NEW."login") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('accounts', OLD."login", ''); END;
DROP TRIGGER IF EXISTS mirror_accounts_upd;
CREATE TRIGGER mirror_accounts_upd AFTER UPDATE ON accounts WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('accounts', NEW."login", ''); END;
DROP TRIGGER IF EXISTS mirror_announcements_del;
CREATE TRIGGER mirror_announcements_del AFTER DELETE ON announcements WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('announcements', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_announcements_ins;
CREATE TRIGGER mirror_announcements_ins AFTER INSERT ON announcements WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('announcements', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_announcements_key;
CREATE TRIGGER mirror_announcements_key AFTER UPDATE ON announcements WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('announcements', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_announcements_upd;
CREATE TRIGGER mirror_announcements_upd AFTER UPDATE ON announcements WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('announcements', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_app_ids_del;
CREATE TRIGGER mirror_app_ids_del AFTER DELETE ON app_ids WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('app_ids', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_app_ids_ins;
CREATE TRIGGER mirror_app_ids_ins AFTER INSERT ON app_ids WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('app_ids', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_app_ids_key;
CREATE TRIGGER mirror_app_ids_key AFTER UPDATE ON app_ids WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('app_ids', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_app_ids_upd;
CREATE TRIGGER mirror_app_ids_upd AFTER UPDATE ON app_ids WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('app_ids', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_attendance_del;
CREATE TRIGGER mirror_attendance_del AFTER DELETE ON attendance WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('attendance', OLD."login", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_attendance_ins;
CREATE TRIGGER mirror_attendance_ins AFTER INSERT ON attendance WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('attendance', NEW."login", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_attendance_key;
CREATE TRIGGER mirror_attendance_key AFTER UPDATE ON attendance WHEN (OLD."login" IS NOT NEW."login" OR OLD."week_id" IS NOT NEW."week_id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('attendance', OLD."login", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_attendance_upd;
CREATE TRIGGER mirror_attendance_upd AFTER UPDATE ON attendance WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('attendance', NEW."login", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_batches_del;
CREATE TRIGGER mirror_batches_del AFTER DELETE ON batches WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('batches', OLD."batch_id", ''); END;
DROP TRIGGER IF EXISTS mirror_batches_ins;
CREATE TRIGGER mirror_batches_ins AFTER INSERT ON batches WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('batches', NEW."batch_id", ''); END;
DROP TRIGGER IF EXISTS mirror_batches_key;
CREATE TRIGGER mirror_batches_key AFTER UPDATE ON batches WHEN (OLD."batch_id" IS NOT NEW."batch_id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('batches', OLD."batch_id", ''); END;
DROP TRIGGER IF EXISTS mirror_batches_upd;
CREATE TRIGGER mirror_batches_upd AFTER UPDATE ON batches WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('batches', NEW."batch_id", ''); END;
DROP TRIGGER IF EXISTS mirror_class_weeks_del;
CREATE TRIGGER mirror_class_weeks_del AFTER DELETE ON class_weeks WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('class_weeks', OLD."batch_id", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_class_weeks_ins;
CREATE TRIGGER mirror_class_weeks_ins AFTER INSERT ON class_weeks WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('class_weeks', NEW."batch_id", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_class_weeks_key;
CREATE TRIGGER mirror_class_weeks_key AFTER UPDATE ON class_weeks WHEN (OLD."batch_id" IS NOT NEW."batch_id" OR OLD."week_id" IS NOT NEW."week_id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('class_weeks', OLD."batch_id", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_class_weeks_upd;
CREATE TRIGGER mirror_class_weeks_upd AFTER UPDATE ON class_weeks WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('class_weeks', NEW."batch_id", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_drafts_del;
CREATE TRIGGER mirror_drafts_del AFTER DELETE ON drafts WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('drafts', OLD."login", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_drafts_ins;
CREATE TRIGGER mirror_drafts_ins AFTER INSERT ON drafts WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('drafts', NEW."login", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_drafts_key;
CREATE TRIGGER mirror_drafts_key AFTER UPDATE ON drafts WHEN (OLD."login" IS NOT NEW."login" OR OLD."week_id" IS NOT NEW."week_id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('drafts', OLD."login", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_drafts_upd;
CREATE TRIGGER mirror_drafts_upd AFTER UPDATE ON drafts WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('drafts', NEW."login", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_duplicate_reviews_del;
CREATE TRIGGER mirror_duplicate_reviews_del AFTER DELETE ON duplicate_reviews WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('duplicate_reviews', OLD."group_key", ''); END;
DROP TRIGGER IF EXISTS mirror_duplicate_reviews_ins;
CREATE TRIGGER mirror_duplicate_reviews_ins AFTER INSERT ON duplicate_reviews WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('duplicate_reviews', NEW."group_key", ''); END;
DROP TRIGGER IF EXISTS mirror_duplicate_reviews_key;
CREATE TRIGGER mirror_duplicate_reviews_key AFTER UPDATE ON duplicate_reviews WHEN (OLD."group_key" IS NOT NEW."group_key") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('duplicate_reviews', OLD."group_key", ''); END;
DROP TRIGGER IF EXISTS mirror_duplicate_reviews_upd;
CREATE TRIGGER mirror_duplicate_reviews_upd AFTER UPDATE ON duplicate_reviews WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('duplicate_reviews', NEW."group_key", ''); END;
DROP TRIGGER IF EXISTS mirror_facilitators_del;
CREATE TRIGGER mirror_facilitators_del AFTER DELETE ON facilitators WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('facilitators', OLD."name", ''); END;
DROP TRIGGER IF EXISTS mirror_facilitators_ins;
CREATE TRIGGER mirror_facilitators_ins AFTER INSERT ON facilitators WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('facilitators', NEW."name", ''); END;
DROP TRIGGER IF EXISTS mirror_facilitators_key;
CREATE TRIGGER mirror_facilitators_key AFTER UPDATE ON facilitators WHEN (OLD."name" IS NOT NEW."name") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('facilitators', OLD."name", ''); END;
DROP TRIGGER IF EXISTS mirror_facilitators_upd;
CREATE TRIGGER mirror_facilitators_upd AFTER UPDATE ON facilitators WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('facilitators', NEW."name", ''); END;
DROP TRIGGER IF EXISTS mirror_head_requests_del;
CREATE TRIGGER mirror_head_requests_del AFTER DELETE ON head_requests WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('head_requests', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_head_requests_ins;
CREATE TRIGGER mirror_head_requests_ins AFTER INSERT ON head_requests WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('head_requests', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_head_requests_key;
CREATE TRIGGER mirror_head_requests_key AFTER UPDATE ON head_requests WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('head_requests', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_head_requests_upd;
CREATE TRIGGER mirror_head_requests_upd AFTER UPDATE ON head_requests WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('head_requests', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_id_sequences_del;
CREATE TRIGGER mirror_id_sequences_del AFTER DELETE ON id_sequences WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('id_sequences', OLD."series", OLD."year"); END;
DROP TRIGGER IF EXISTS mirror_id_sequences_ins;
CREATE TRIGGER mirror_id_sequences_ins AFTER INSERT ON id_sequences WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('id_sequences', NEW."series", NEW."year"); END;
DROP TRIGGER IF EXISTS mirror_id_sequences_key;
CREATE TRIGGER mirror_id_sequences_key AFTER UPDATE ON id_sequences WHEN (OLD."series" IS NOT NEW."series" OR OLD."year" IS NOT NEW."year") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('id_sequences', OLD."series", OLD."year"); END;
DROP TRIGGER IF EXISTS mirror_id_sequences_upd;
CREATE TRIGGER mirror_id_sequences_upd AFTER UPDATE ON id_sequences WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('id_sequences', NEW."series", NEW."year"); END;
DROP TRIGGER IF EXISTS mirror_leaders_del;
CREATE TRIGGER mirror_leaders_del AFTER DELETE ON leaders WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('leaders', OLD."login", ''); END;
DROP TRIGGER IF EXISTS mirror_leaders_ins;
CREATE TRIGGER mirror_leaders_ins AFTER INSERT ON leaders WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('leaders', NEW."login", ''); END;
DROP TRIGGER IF EXISTS mirror_leaders_key;
CREATE TRIGGER mirror_leaders_key AFTER UPDATE ON leaders WHEN (OLD."login" IS NOT NEW."login") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('leaders', OLD."login", ''); END;
DROP TRIGGER IF EXISTS mirror_leaders_upd;
CREATE TRIGGER mirror_leaders_upd AFTER UPDATE ON leaders WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('leaders', NEW."login", ''); END;
DROP TRIGGER IF EXISTS mirror_memberships_del;
CREATE TRIGGER mirror_memberships_del AFTER DELETE ON memberships WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('memberships', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_memberships_ins;
CREATE TRIGGER mirror_memberships_ins AFTER INSERT ON memberships WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('memberships', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_memberships_key;
CREATE TRIGGER mirror_memberships_key AFTER UPDATE ON memberships WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('memberships', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_memberships_upd;
CREATE TRIGGER mirror_memberships_upd AFTER UPDATE ON memberships WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('memberships', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_missed_weeks_del;
CREATE TRIGGER mirror_missed_weeks_del AFTER DELETE ON missed_weeks WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('missed_weeks', OLD."login", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_missed_weeks_ins;
CREATE TRIGGER mirror_missed_weeks_ins AFTER INSERT ON missed_weeks WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('missed_weeks', NEW."login", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_missed_weeks_key;
CREATE TRIGGER mirror_missed_weeks_key AFTER UPDATE ON missed_weeks WHEN (OLD."login" IS NOT NEW."login" OR OLD."week_id" IS NOT NEW."week_id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('missed_weeks', OLD."login", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_missed_weeks_upd;
CREATE TRIGGER mirror_missed_weeks_upd AFTER UPDATE ON missed_weeks WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('missed_weeks', NEW."login", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_person_history_del;
CREATE TRIGGER mirror_person_history_del AFTER DELETE ON person_history WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_history', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_person_history_ins;
CREATE TRIGGER mirror_person_history_ins AFTER INSERT ON person_history WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_history', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_person_history_key;
CREATE TRIGGER mirror_person_history_key AFTER UPDATE ON person_history WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_history', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_person_history_upd;
CREATE TRIGGER mirror_person_history_upd AFTER UPDATE ON person_history WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_history', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_person_identifiers_del;
CREATE TRIGGER mirror_person_identifiers_del AFTER DELETE ON person_identifiers WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_identifiers', OLD."fid", ''); END;
DROP TRIGGER IF EXISTS mirror_person_identifiers_ins;
CREATE TRIGGER mirror_person_identifiers_ins AFTER INSERT ON person_identifiers WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_identifiers', NEW."fid", ''); END;
DROP TRIGGER IF EXISTS mirror_person_identifiers_key;
CREATE TRIGGER mirror_person_identifiers_key AFTER UPDATE ON person_identifiers WHEN (OLD."fid" IS NOT NEW."fid") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_identifiers', OLD."fid", ''); END;
DROP TRIGGER IF EXISTS mirror_person_identifiers_upd;
CREATE TRIGGER mirror_person_identifiers_upd AFTER UPDATE ON person_identifiers WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_identifiers', NEW."fid", ''); END;
DROP TRIGGER IF EXISTS mirror_person_links_del;
CREATE TRIGGER mirror_person_links_del AFTER DELETE ON person_links WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_links', OLD."service", OLD."account_ref"); END;
DROP TRIGGER IF EXISTS mirror_person_links_ins;
CREATE TRIGGER mirror_person_links_ins AFTER INSERT ON person_links WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_links', NEW."service", NEW."account_ref"); END;
DROP TRIGGER IF EXISTS mirror_person_links_key;
CREATE TRIGGER mirror_person_links_key AFTER UPDATE ON person_links WHEN (OLD."service" IS NOT NEW."service" OR OLD."account_ref" IS NOT NEW."account_ref") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_links', OLD."service", OLD."account_ref"); END;
DROP TRIGGER IF EXISTS mirror_person_links_upd;
CREATE TRIGGER mirror_person_links_upd AFTER UPDATE ON person_links WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_links', NEW."service", NEW."account_ref"); END;
DROP TRIGGER IF EXISTS mirror_person_names_del;
CREATE TRIGGER mirror_person_names_del AFTER DELETE ON person_names WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_names', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_person_names_ins;
CREATE TRIGGER mirror_person_names_ins AFTER INSERT ON person_names WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_names', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_person_names_key;
CREATE TRIGGER mirror_person_names_key AFTER UPDATE ON person_names WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_names', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_person_names_upd;
CREATE TRIGGER mirror_person_names_upd AFTER UPDATE ON person_names WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_names', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_person_phones_del;
CREATE TRIGGER mirror_person_phones_del AFTER DELETE ON person_phones WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_phones', OLD."phone", ''); END;
DROP TRIGGER IF EXISTS mirror_person_phones_ins;
CREATE TRIGGER mirror_person_phones_ins AFTER INSERT ON person_phones WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_phones', NEW."phone", ''); END;
DROP TRIGGER IF EXISTS mirror_person_phones_key;
CREATE TRIGGER mirror_person_phones_key AFTER UPDATE ON person_phones WHEN (OLD."phone" IS NOT NEW."phone") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_phones', OLD."phone", ''); END;
DROP TRIGGER IF EXISTS mirror_person_phones_upd;
CREATE TRIGGER mirror_person_phones_upd AFTER UPDATE ON person_phones WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('person_phones', NEW."phone", ''); END;
DROP TRIGGER IF EXISTS mirror_persons_del;
CREATE TRIGGER mirror_persons_del AFTER DELETE ON persons WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('persons', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_persons_ins;
CREATE TRIGGER mirror_persons_ins AFTER INSERT ON persons WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('persons', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_persons_key;
CREATE TRIGGER mirror_persons_key AFTER UPDATE ON persons WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('persons', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_persons_upd;
CREATE TRIGGER mirror_persons_upd AFTER UPDATE ON persons WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('persons', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_comments_del;
CREATE TRIGGER mirror_post_comments_del AFTER DELETE ON post_comments WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_comments', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_comments_ins;
CREATE TRIGGER mirror_post_comments_ins AFTER INSERT ON post_comments WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_comments', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_comments_key;
CREATE TRIGGER mirror_post_comments_key AFTER UPDATE ON post_comments WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_comments', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_comments_upd;
CREATE TRIGGER mirror_post_comments_upd AFTER UPDATE ON post_comments WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_comments', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_mutes_del;
CREATE TRIGGER mirror_post_mutes_del AFTER DELETE ON post_mutes WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_mutes', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_mutes_ins;
CREATE TRIGGER mirror_post_mutes_ins AFTER INSERT ON post_mutes WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_mutes', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_mutes_key;
CREATE TRIGGER mirror_post_mutes_key AFTER UPDATE ON post_mutes WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_mutes', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_mutes_upd;
CREATE TRIGGER mirror_post_mutes_upd AFTER UPDATE ON post_mutes WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_mutes', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_reports_del;
CREATE TRIGGER mirror_post_reports_del AFTER DELETE ON post_reports WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_reports', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_reports_ins;
CREATE TRIGGER mirror_post_reports_ins AFTER INSERT ON post_reports WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_reports', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_reports_key;
CREATE TRIGGER mirror_post_reports_key AFTER UPDATE ON post_reports WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_reports', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_post_reports_upd;
CREATE TRIGGER mirror_post_reports_upd AFTER UPDATE ON post_reports WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('post_reports', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_profiles_del;
CREATE TRIGGER mirror_profiles_del AFTER DELETE ON profiles WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('profiles', OLD."login", ''); END;
DROP TRIGGER IF EXISTS mirror_profiles_ins;
CREATE TRIGGER mirror_profiles_ins AFTER INSERT ON profiles WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('profiles', NEW."login", ''); END;
DROP TRIGGER IF EXISTS mirror_profiles_key;
CREATE TRIGGER mirror_profiles_key AFTER UPDATE ON profiles WHEN (OLD."login" IS NOT NEW."login") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('profiles', OLD."login", ''); END;
DROP TRIGGER IF EXISTS mirror_profiles_upd;
CREATE TRIGGER mirror_profiles_upd AFTER UPDATE ON profiles WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('profiles', NEW."login", ''); END;
DROP TRIGGER IF EXISTS mirror_reopen_requests_del;
CREATE TRIGGER mirror_reopen_requests_del AFTER DELETE ON reopen_requests WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reopen_requests', OLD."login", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_reopen_requests_ins;
CREATE TRIGGER mirror_reopen_requests_ins AFTER INSERT ON reopen_requests WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reopen_requests', NEW."login", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_reopen_requests_key;
CREATE TRIGGER mirror_reopen_requests_key AFTER UPDATE ON reopen_requests WHEN (OLD."login" IS NOT NEW."login" OR OLD."week_id" IS NOT NEW."week_id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reopen_requests', OLD."login", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_reopen_requests_upd;
CREATE TRIGGER mirror_reopen_requests_upd AFTER UPDATE ON reopen_requests WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reopen_requests', NEW."login", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_reopens_del;
CREATE TRIGGER mirror_reopens_del AFTER DELETE ON reopens WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reopens', OLD."login", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_reopens_ins;
CREATE TRIGGER mirror_reopens_ins AFTER INSERT ON reopens WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reopens', NEW."login", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_reopens_key;
CREATE TRIGGER mirror_reopens_key AFTER UPDATE ON reopens WHEN (OLD."login" IS NOT NEW."login" OR OLD."week_id" IS NOT NEW."week_id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reopens', OLD."login", OLD."week_id"); END;
DROP TRIGGER IF EXISTS mirror_reopens_upd;
CREATE TRIGGER mirror_reopens_upd AFTER UPDATE ON reopens WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reopens', NEW."login", NEW."week_id"); END;
DROP TRIGGER IF EXISTS mirror_reset_requests_del;
CREATE TRIGGER mirror_reset_requests_del AFTER DELETE ON reset_requests WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reset_requests', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_reset_requests_ins;
CREATE TRIGGER mirror_reset_requests_ins AFTER INSERT ON reset_requests WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reset_requests', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_reset_requests_key;
CREATE TRIGGER mirror_reset_requests_key AFTER UPDATE ON reset_requests WHEN (OLD."id" IS NOT NEW."id") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reset_requests', OLD."id", ''); END;
DROP TRIGGER IF EXISTS mirror_reset_requests_upd;
CREATE TRIGGER mirror_reset_requests_upd AFTER UPDATE ON reset_requests WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('reset_requests', NEW."id", ''); END;
DROP TRIGGER IF EXISTS mirror_settings_del;
CREATE TRIGGER mirror_settings_del AFTER DELETE ON settings WHEN (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('settings', OLD."key", ''); END;
DROP TRIGGER IF EXISTS mirror_settings_ins;
CREATE TRIGGER mirror_settings_ins AFTER INSERT ON settings WHEN (NEW."key" NOT IN ('reminder_cursor', 'reminder_day', 'master_reset_applied', 'registry_refresh', 'registry_sig', 'refusals_forbidden', 'refusals_unauthenticated', 'refusals_stale')) AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('settings', NEW."key", ''); END;
DROP TRIGGER IF EXISTS mirror_settings_key;
CREATE TRIGGER mirror_settings_key AFTER UPDATE ON settings WHEN (OLD."key" IS NOT NEW."key") AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('settings', OLD."key", ''); END;
DROP TRIGGER IF EXISTS mirror_settings_upd;
CREATE TRIGGER mirror_settings_upd AFTER UPDATE ON settings WHEN (NEW."key" NOT IN ('reminder_cursor', 'reminder_day', 'master_reset_applied', 'registry_refresh', 'registry_sig', 'refusals_forbidden', 'refusals_unauthenticated', 'refusals_stale')) AND (SELECT state FROM mirror_switch WHERE id = 1) = 'on' BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('settings', NEW."key", ''); END;

-- C8: two indexes that duplicate another and that no statement uses (query-plan audit, 27 Oct 2026: every statement
-- the suites run on these tables was planned with and without them — 0 plans used either, 0 plans changed, 0 scans).
--   reset_requests_by_login (0001) = idx_reset_login_status (0048), both (login, status); the planner uses the 0048 one
--   activity_events_day (day) is the first column of activity_events_day_how (day, how, login), which serves every lookup
-- Each costs an index row written on every write to its table. IF EXISTS: activity_events comes from 0071.
DROP INDEX IF EXISTS reset_requests_by_login;
DROP INDEX IF EXISTS activity_events_day;
