-- Keep the server's own bookkeeping rows out of the Settings tab (13 Oct 2026; audit findings J3 and J12).
--
-- Why:
--   · master_reset_applied — the marker of the last MASTER_RESET_PASSWORD. It used to be a plain SHA-256 of a
--     temporary master password that stays live until the head signs in, and `settings` is copied to the Rules
--     sheet, so anyone able to read that sheet had an offline guessing target. src/setup.js now keys the marker
--     with PW_PEPPER; this migration also stops the row reaching the sheet at all.
--   · registry_refresh / registry_sig — written by the schedule every 30 minutes, so an idle system rewrote the
--     Settings tab about 48 times a day for a status nobody reads there (the Settings screen reads D1 directly).
--
-- Additive and safe to re-run: only the two settings triggers are replaced (the generated form is in 0022 and in
-- setup/build-mirror-sql.mjs › LOG_WHEN, which now carries the same list). `mirror_state` is deliberately NOT
-- reset, so the Settings tab is not rebuilt from scratch; the rows already there stay correct.

DROP TRIGGER IF EXISTS mirror_settings_ins;
DROP TRIGGER IF EXISTS mirror_settings_upd;

CREATE TRIGGER mirror_settings_ins AFTER INSERT ON settings
  WHEN NEW."key" NOT IN ('reminder_cursor', 'reminder_day', 'master_reset_applied', 'registry_refresh', 'registry_sig')
  BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('settings', NEW."key", ''); END;

CREATE TRIGGER mirror_settings_upd AFTER UPDATE ON settings
  WHEN NEW."key" NOT IN ('reminder_cursor', 'reminder_day', 'master_reset_applied', 'registry_refresh', 'registry_sig')
  BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('settings', NEW."key", ''); END;

-- The old marker (a plain hash of a temporary master password that may still be in use) is already in the sheet.
-- Overwrite it with a constant, not with '': an EMPTY value would make applyMasterReset() treat a still-present
-- MASTER_RESET_PASSWORD secret as "not applied yet" and apply it again on the next minute's run — resetting the
-- head's password and ending their sessions without anyone asking. A non-empty placeholder can never equal a real
-- marker either, so the format change on its own already causes at most one re-application if the secret is still
-- set; that is why the runbook says to delete the secret after use (docs/OPERATIONS.md §3).
-- This UPDATE queues one ordinary row copy, which overwrites the leaked cell on the next run; afterwards the key
-- is excluded by the triggers above and never reaches the sheet again.
UPDATE settings
   SET value = 'retired-2026-10-13',
       note  = 'Marker of the last MASTER_RESET_PASSWORD applied (keyed with PW_PEPPER; never copied to Sheets)'
 WHERE key = 'master_reset_applied';
