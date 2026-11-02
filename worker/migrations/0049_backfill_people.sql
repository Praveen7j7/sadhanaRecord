-- Put the devotees already approved into the identity tables (16 Oct 2026; roadmap 3.8).
--
-- WHY. Until today `requests.approve` stamped an IYF ID on the account and never created the person, so
-- every devotee approved through the app was invisible to identity search — the head could read the ID on
-- the account and could not trace the person behind it. The code now creates the person at approval; this
-- catches up the ones approved before that.
--
-- NEVER CREATES A DUPLICATE. Each step skips anyone already reachable — by their phone, by their IYF ID, or
-- by a link that already exists. The dashboard's people are already in these tables, so a devotee IYF
-- already knows is LINKED to the person who is there, not copied into a second one. Running this twice
-- changes nothing the second time.
--
-- Deliberately only ACTIVE devotees: a rejected or deleted sign-up is not a person IYF is tracking, and
-- a deleted one was anonymised on purpose.

-- 1. link accounts whose person is already here, found by PHONE
INSERT OR IGNORE INTO person_links (service, account_ref, person_id, linked_at)
SELECT 'sadhana', a.login, ph.person_id, datetime('now', '+5 hours', '+30 minutes')
  FROM accounts a JOIN person_phones ph ON ph.phone = a.login
 WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE';

-- 2. …or by their IYF ID, for anyone the phone did not match
INSERT OR IGNORE INTO person_links (service, account_ref, person_id, linked_at)
SELECT 'sadhana', a.login, i.person_id, datetime('now', '+5 hours', '+30 minutes')
  FROM accounts a JOIN person_identifiers i ON i.fid = a.iyf_id
 WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE' AND COALESCE(a.iyf_id, '') <> ''
   AND NOT EXISTS (SELECT 1 FROM person_links l WHERE l.service = 'sadhana' AND l.account_ref = a.login);

-- 3. create a person for everyone still unlinked. The id follows the app's own shape ('p' + base36 time +
--    random): here, the login is unique and already unambiguous, so 'p-sr-<login>' is distinct and readable
--    in a way that says where it came from.
INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, created_at, updated_at)
SELECT 'p-sr-' || a.login, COALESCE(a.name, ''), COALESCE(a.iyf_id, ''),
       COALESCE((SELECT p.connected_since FROM profiles p WHERE p.login = a.login), ''),
       'app', 'Active',
       datetime('now', '+5 hours', '+30 minutes'), datetime('now', '+5 hours', '+30 minutes')
  FROM accounts a
 WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
   AND NOT EXISTS (SELECT 1 FROM person_links l WHERE l.service = 'sadhana' AND l.account_ref = a.login);

INSERT OR IGNORE INTO person_links (service, account_ref, person_id, linked_at)
SELECT 'sadhana', a.login, 'p-sr-' || a.login, datetime('now', '+5 hours', '+30 minutes')
  FROM accounts a
 WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
   AND EXISTS (SELECT 1 FROM persons p WHERE p.id = 'p-sr-' || a.login);

-- 4. their phone, their name and their IYF ID, for every linked devotee that is missing one.
--    OR IGNORE throughout: a value already recorded is left exactly as it is.
INSERT OR IGNORE INTO person_phones (phone, person_id, is_primary, active, added_at)
SELECT a.login, l.person_id, 1, 1, datetime('now', '+5 hours', '+30 minutes')
  FROM accounts a JOIN person_links l ON l.service = 'sadhana' AND l.account_ref = a.login
 WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE';

INSERT INTO person_names (person_id, name, kind, is_current, added_at)
SELECT l.person_id, COALESCE(a.name, ''), 'given',
       CASE WHEN EXISTS (SELECT 1 FROM person_names n WHERE n.person_id = l.person_id AND n.is_current = 1) THEN 0 ELSE 1 END,
       datetime('now', '+5 hours', '+30 minutes')
  FROM accounts a JOIN person_links l ON l.service = 'sadhana' AND l.account_ref = a.login
 WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
   AND COALESCE(a.name, '') <> ''
   AND NOT EXISTS (SELECT 1 FROM person_names n WHERE n.person_id = l.person_id AND lower(n.name) = lower(a.name));

INSERT OR IGNORE INTO person_identifiers (fid, person_id, series, state, issued_by, issued_at)
SELECT a.iyf_id, l.person_id,
       CASE WHEN instr(a.iyf_id, '-') > 0 THEN substr(a.iyf_id, 1, 2) ELSE 'IYFD' END,
       'current', 'app', datetime('now', '+5 hours', '+30 minutes')
  FROM accounts a JOIN person_links l ON l.service = 'sadhana' AND l.account_ref = a.login
 WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE' AND COALESCE(a.iyf_id, '') <> '';

-- 5. the index that keeps approval cheap.
--
-- resolve() matches a person by their exact name, lower-cased, and that was a full SCAN of person_names —
-- 1,518 rows live and growing with every person. It runs on EVERY approval, so the cost would climb as the
-- roll grows: the same shape as the query that spent D1's whole daily read allowance on 14 Oct and took the
-- app down twice. An expression index makes it a lookup instead ("SEARCH person_names USING INDEX").
CREATE INDEX IF NOT EXISTS person_names_lower ON person_names (lower(name));
