-- Keep the sampled refusal counters out of the Settings tab (14 Oct 2026; roadmap 6.6, audit T F-10).
--
-- What they are: src/api.js now counts FORBIDDEN, UNAUTHENTICATED and STALE refusals per hour, one sampled
-- UPSERT in ten, into `settings` rows keyed refusals_forbidden / refusals_unauthenticated / refusals_stale.
-- Before this, nothing anywhere recorded a refusal unless it was an INTERNAL error or a slow call, so a
-- broken client or somebody probing the API produced no signal the head could see.
--
-- Why they must not be mirrored: each row changes up to once an hour per code, which would queue about 72
-- sheet-row copies a day for three cells nobody reads in the sheet — the head's Settings screen reads D1
-- directly. This is the same reasoning as registry_refresh in 0042.
--
-- Additive and safe to re-run: only the two settings triggers are replaced. The generated form of these
-- triggers lives in 0022 and in setup/build-mirror-sql.mjs › LOG_WHEN, which carries the same list.
-- `mirror_state` is deliberately NOT reset, so the Settings tab is not rebuilt; rows already there stay correct.

DROP TRIGGER IF EXISTS mirror_settings_ins;
DROP TRIGGER IF EXISTS mirror_settings_upd;

CREATE TRIGGER mirror_settings_ins AFTER INSERT ON settings
  WHEN NEW."key" NOT IN ('reminder_cursor', 'reminder_day', 'master_reset_applied', 'registry_refresh', 'registry_sig',
                         'refusals_forbidden', 'refusals_unauthenticated', 'refusals_stale')
  BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('settings', NEW."key", ''); END;

CREATE TRIGGER mirror_settings_upd AFTER UPDATE ON settings
  WHEN NEW."key" NOT IN ('reminder_cursor', 'reminder_day', 'master_reset_applied', 'registry_refresh', 'registry_sig',
                         'refusals_forbidden', 'refusals_unauthenticated', 'refusals_stale')
  BEGIN INSERT INTO mirror_log (tbl, k1, k2) VALUES ('settings', NEW."key", ''); END;
