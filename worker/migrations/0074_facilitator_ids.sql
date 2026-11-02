-- 0074 — One name, one place (Phase 24; docs/NAMES_ONE_SOURCE_2026-10-27.md, the head, 27 Oct 2026).
--
-- A facilitator's name was the KEY other records pointed to, so a rename had to be copied into every place that held
-- it, and some were missed (posts to "my students", closed memberships, past weeks, a linked devotee). From here a
-- facilitator has a permanent id; every reference holds the id; the name is read from the one row when shown.
--
-- ADDITIVE ONLY. Nothing is dropped or renamed. Every name column (memberships.facilitator, accounts.facilitator_name,
-- accounts.requested_facilitator) stays and is still written for one release, so the code before this one still reads
-- right if it is rolled back. Backfilled here from today's names; triggers keep id and name in step for any writer
-- that sets only the name (an older release, a hand-made row).
--
-- Before applying on live: back up facilitators, memberships(id, facilitator), accounts(login, facilitator_name,
-- requested_facilitator), announcements(id, audience), push_jobs(id, audience) into impl/baseline/.
--
-- REAL RELATIONS (the head, 27 Oct 2026): the new structures carry foreign keys, so a reference can never point to
-- nothing — facilitator_names.fac_id, memberships.fac_id, accounts.fac_id and accounts.requested_fac_id all REFERENCE
-- facilitators(id) (made unique below), and facilitators.login REFERENCES accounts(login). SQLite allows a REFERENCES
-- clause on a column added by ALTER TABLE only with a NULL default, so "no facilitator" is NULL in every new column
-- (never ''). No ON DELETE CASCADE: a facilitator is soft-deleted (deleted_at), never removed. The one exception is
-- facilitators.login, ON DELETE SET NULL: an account that is erased (erase.js) simply stops being the facilitator's login.
-- The older tables keep no FKs of their own (ADR 0003: adding one needs a table rebuild).
PRAGMA defer_foreign_keys = true;

-- 1. The permanent id ('F' + order of creation, %03d widening past 999; never reused, removed rows included)
--    and the login that IS this facilitator, when there is one.
ALTER TABLE facilitators ADD COLUMN id TEXT;                                            -- NULL only until the trigger below gives one
ALTER TABLE facilitators ADD COLUMN login TEXT REFERENCES accounts(login) ON DELETE SET NULL;
-- unique (NULLs apart), so it is the parent of every reference below — created before any of them
CREATE UNIQUE INDEX facilitators_by_id ON facilitators (id);

-- 2. Every spelling a facilitator has had. One row per spelling; the current one has to_at = ''. An old link, an
--    import or a name typed in an older record resolves through it to the same facilitator, for ever.
CREATE TABLE facilitator_names (
  fac_id   TEXT NOT NULL REFERENCES facilitators(id),
  "name"   TEXT NOT NULL,
  from_at  TEXT NOT NULL DEFAULT '',     -- '' = held before 0074
  to_at    TEXT NOT NULL DEFAULT '',     -- '' = the current spelling
  PRIMARY KEY (fac_id, "name")
);
-- one spelling resolves to exactly ONE facilitator (an old link, an import, a record of its day)
CREATE UNIQUE INDEX facilitator_names_name ON facilitator_names ("name");
CREATE INDEX facilitator_names_by_fac ON facilitator_names (fac_id, to_at);
CREATE INDEX facilitator_names_lower ON facilitator_names (lower("name"));       -- the clash check on a rename

-- 3. Names that are still referenced but no longer on the list (a dashboard name the old nightly NameMap read deleted)
--    get a removed row, so every reference can hold an id.
INSERT OR IGNORE INTO facilitators ("name", "in_cohort", "order", active, source, seen, deleted_at, changed_by, changed_at)
  SELECT DISTINCT n, 0, 9999, 0, 'APP', 0, strftime('%Y-%m-%dT%H:%M:%S', 'now', '+330 minutes') || '+05:30', 'migration 0074', ''
    FROM (SELECT facilitator AS n FROM memberships WHERE facilitator <> ''
          UNION SELECT facilitator_name FROM accounts WHERE facilitator_name <> ''
          UNION SELECT requested_facilitator FROM accounts WHERE requested_facilitator <> '')
   WHERE n NOT IN (SELECT "name" FROM facilitators)
     -- a name an earlier rename replaced is not a facilitator of its own: it resolves below to the renamed one
     AND n NOT IN (SELECT json_extract(before, '$.name') FROM audit_log WHERE action = 'facilitators.rename');

-- 4. ids, in the order the rows were created
UPDATE facilitators SET id = 'F' || printf('%03d', (SELECT COUNT(*) FROM facilitators f2 WHERE f2.rowid <= facilitators.rowid));

-- 5. Spellings. First every name an earlier rename replaced, to the facilitator it became (chains A → B → C followed to
--    the end). The old code left each replaced name behind as a removed row of its own; that row keeps an id but no
--    spelling, so nothing resolves to it.
WITH RECURSIVE r(old, new, at) AS (
    SELECT json_extract(before, '$.name'), target, at FROM audit_log WHERE action = 'facilitators.rename'),
  chain(old, cur, at, depth) AS (
    SELECT old, new, at, 0 FROM r
    UNION SELECT chain.old, r.new, chain.at, chain.depth + 1 FROM chain JOIN r ON r.old = chain.cur AND r.at >= chain.at WHERE chain.depth < 20)
INSERT OR IGNORE INTO facilitator_names ("name", fac_id, from_at, to_at)
  SELECT c.old, f.id, '', c.at FROM chain c JOIN facilitators f ON f."name" = c.cur
   WHERE c.cur NOT IN (SELECT old FROM r) ORDER BY c.depth DESC;
-- then every row's own name, current
INSERT OR IGNORE INTO facilitator_names ("name", fac_id, from_at, to_at) SELECT "name", id, '', '' FROM facilitators;

-- 6. The id beside every name that points to a facilitator: memberships (open AND closed), the facilitator a login is,
--    the facilitator a waiting sign-up chose.
ALTER TABLE memberships ADD COLUMN fac_id TEXT REFERENCES facilitators(id);
ALTER TABLE accounts ADD COLUMN fac_id TEXT REFERENCES facilitators(id);
ALTER TABLE accounts ADD COLUMN requested_fac_id TEXT REFERENCES facilitators(id);
UPDATE memberships SET fac_id = (SELECT fac_id FROM facilitator_names n WHERE n."name" = memberships.facilitator) WHERE facilitator <> '';
UPDATE accounts SET fac_id = (SELECT fac_id FROM facilitator_names n WHERE n."name" = accounts.facilitator_name) WHERE facilitator_name <> '';
UPDATE accounts SET requested_fac_id = (SELECT fac_id FROM facilitator_names n WHERE n."name" = accounts.requested_facilitator) WHERE requested_facilitator <> '';
CREATE INDEX memberships_by_fac_id ON memberships (fac_id, to_week);
CREATE INDEX accounts_by_fac_id ON accounts (fac_id);
CREATE INDEX accounts_by_requested_fac ON accounts (requested_fac_id);

-- 7. A facilitator who IS a login: the account whose facilitator this is and whose name is the facilitator's name (a
--    facilitator login, an ETP trainee enrolled under their own name). Their name is then one value: renaming either
--    renames both (worker/src/names.js renamePerson). A youth facilitator whose own name differs stays unlinked.
UPDATE facilitators SET login = (SELECT a.login FROM accounts a WHERE a.fac_id = facilitators.id AND a.name = facilitators."name"
                                   AND a.status <> 'DISABLED' ORDER BY a.status = 'ACTIVE' DESC, a.login LIMIT 1);
CREATE INDEX facilitators_by_login ON facilitators (login);

-- 8. Posts to "my students" and their notification jobs are addressed by id. Rewritten here, once: such an audience is
--    always the tag on its own (announcements.js audienceOf), 'STU:' + the name with commas as ';'.
UPDATE announcements SET audience = 'STU:' || (SELECT n.fac_id FROM facilitator_names n WHERE 'STU:' || replace(n."name", ',', ';') = announcements.audience)
 WHERE audience LIKE 'STU:%' AND EXISTS (SELECT 1 FROM facilitator_names n WHERE 'STU:' || replace(n."name", ',', ';') = announcements.audience);
UPDATE push_jobs SET audience = 'STU:' || (SELECT n.fac_id FROM facilitator_names n WHERE 'STU:' || replace(n."name", ',', ';') = push_jobs.audience)
 WHERE audience LIKE 'STU:%' AND EXISTS (SELECT 1 FROM facilitator_names n WHERE 'STU:' || replace(n."name", ',', ';') = push_jobs.audience);

-- 9. Keeping id and name in step for any writer that sets only the name.
--    A new facilitator row gets the next id and its spelling; a name held only as an old spelling of someone else
--    passes to the new holder (a current name always means its own row). References that waited for the name get it.
CREATE TRIGGER facilitators_give_id AFTER INSERT ON facilitators WHEN NEW.id IS NULL BEGIN
  UPDATE facilitators SET id = 'F' || printf('%03d', (SELECT COALESCE(MAX(k), 0) + 1 FROM (
           SELECT CAST(substr(id, 2) AS INTEGER) AS k FROM facilitators WHERE id IS NOT NULL
           UNION ALL SELECT CAST(substr(fac_id, 2) AS INTEGER) FROM facilitator_names)))
   WHERE rowid = NEW.rowid;
END;
CREATE TRIGGER facilitators_spelling AFTER UPDATE OF id ON facilitators WHEN NEW.id IS NOT NULL AND OLD.id IS NULL BEGIN
  INSERT INTO facilitator_names ("name", fac_id, from_at, to_at) VALUES (NEW."name", NEW.id, NEW.changed_at, '')
    ON CONFLICT("name") DO UPDATE SET fac_id = excluded.fac_id, from_at = excluded.from_at, to_at = '' WHERE facilitator_names.to_at <> '';
  UPDATE memberships SET fac_id = NEW.id WHERE facilitator = NEW."name" AND fac_id IS NULL;
  UPDATE accounts SET fac_id = NEW.id WHERE facilitator_name = NEW."name" AND fac_id IS NULL;
  UPDATE accounts SET requested_fac_id = NEW.id WHERE status = 'PENDING' AND requested_facilitator = NEW."name" AND requested_fac_id IS NULL;
END;
--    A renamed row: the new spelling is current, the old one stays as an earlier spelling (names.js also stamps the time).
CREATE TRIGGER facilitators_renamed AFTER UPDATE OF "name" ON facilitators WHEN NEW."name" IS NOT OLD."name" AND NEW.id IS NOT NULL BEGIN
  UPDATE facilitator_names SET to_at = CASE WHEN NEW.changed_at <> '' THEN NEW.changed_at ELSE strftime('%Y-%m-%dT%H:%M:%S', 'now', '+330 minutes') || '+05:30' END
   WHERE "name" = OLD."name" AND fac_id = NEW.id AND to_at = '';
  INSERT INTO facilitator_names ("name", fac_id, from_at, to_at) VALUES (NEW."name", NEW.id, NEW.changed_at, '')
    ON CONFLICT("name") DO UPDATE SET fac_id = excluded.fac_id, from_at = excluded.from_at, to_at = '' WHERE facilitator_names.fac_id = excluded.fac_id OR facilitator_names.to_at <> '';
END;
--    A membership or an account given a facilitator by NAME only: the id follows (only when they disagree, so a
--    writer that sets both costs no extra write).
CREATE TRIGGER memberships_fac_ins AFTER INSERT ON memberships WHEN NEW.facilitator <> '' AND NEW.fac_id IS NULL BEGIN
  UPDATE memberships SET fac_id = (SELECT fac_id FROM facilitator_names WHERE "name" = NEW.facilitator) WHERE id = NEW.id;
END;
CREATE TRIGGER memberships_fac_upd AFTER UPDATE OF facilitator ON memberships
  WHEN NEW.fac_id IS OLD.fac_id AND NEW.fac_id IS NOT (SELECT fac_id FROM facilitator_names WHERE "name" = NEW.facilitator) BEGIN
  UPDATE memberships SET fac_id = (SELECT fac_id FROM facilitator_names WHERE "name" = NEW.facilitator) WHERE id = NEW.id;
END;
CREATE TRIGGER accounts_fac_ins AFTER INSERT ON accounts
  WHEN (NEW.facilitator_name <> '' AND NEW.fac_id IS NULL) OR (NEW.requested_facilitator <> '' AND NEW.requested_fac_id IS NULL) BEGIN
  UPDATE accounts SET fac_id = COALESCE(fac_id, (SELECT fac_id FROM facilitator_names WHERE "name" = NEW.facilitator_name)),
                      requested_fac_id = COALESCE(requested_fac_id, (SELECT fac_id FROM facilitator_names WHERE "name" = NEW.requested_facilitator))
   WHERE login = NEW.login;
END;
CREATE TRIGGER accounts_fac_upd AFTER UPDATE OF facilitator_name ON accounts
  WHEN NEW.fac_id IS OLD.fac_id AND NEW.fac_id IS NOT (SELECT fac_id FROM facilitator_names WHERE "name" = NEW.facilitator_name) BEGIN
  UPDATE accounts SET fac_id = (SELECT fac_id FROM facilitator_names WHERE "name" = NEW.facilitator_name) WHERE login = NEW.login;
END;
CREATE TRIGGER accounts_reqfac_upd AFTER UPDATE OF requested_facilitator ON accounts
  WHEN NEW.requested_fac_id IS OLD.requested_fac_id AND NEW.requested_fac_id IS NOT (SELECT fac_id FROM facilitator_names WHERE "name" = NEW.requested_facilitator) BEGIN
  UPDATE accounts SET requested_fac_id = (SELECT fac_id FROM facilitator_names WHERE "name" = NEW.requested_facilitator) WHERE login = NEW.login;
END;
--    The login link follows the account: a login that stops being this facilitator (training ended, unlinked) is
--    unlinked; one that becomes it under the same name is linked.
CREATE TRIGGER accounts_fac_link AFTER UPDATE OF fac_id ON accounts WHEN NEW.fac_id IS NOT OLD.fac_id BEGIN
  UPDATE facilitators SET login = NULL WHERE login = NEW.login AND id IS NOT NEW.fac_id;
  UPDATE facilitators SET login = NEW.login WHERE id = NEW.fac_id AND "name" = NEW.name AND login IS NULL;
END;

-- 10. The phone's lists (the facilitator wheel, batch names) follow a change on the next start, at no extra call:
--     auth.me / home.get send this number with the other versions, and the phone asks for meta.get only when it moved.
INSERT OR IGNORE INTO settings (key, value, note, changed_by, changed_at)
  VALUES ('names_version', '1', 'Moves when a facilitator or a batch name changes; phones then fetch the lists again on start', 'migration 0074', '');
CREATE TRIGGER names_version_fac_ins AFTER INSERT ON facilitators BEGIN
  UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'names_version';
END;
CREATE TRIGGER names_version_fac_upd AFTER UPDATE OF "name", active, deleted_at, "order" ON facilitators BEGIN
  UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'names_version';
END;
CREATE TRIGGER names_version_batch_ins AFTER INSERT ON batches BEGIN
  UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'names_version';
END;
CREATE TRIGGER names_version_batch_upd AFTER UPDATE OF name, active, closed_at, offered_at_signup, tracks, coordinator_logins ON batches BEGIN
  UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'names_version';
END;
