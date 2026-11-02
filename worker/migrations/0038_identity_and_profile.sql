-- 0038 — IYF identity authority + the profile fields the signup form needs.
-- Additive only: no existing table is altered in a way that changes current behaviour,
-- every new column has a default, and nothing is dropped. Safe to apply with live accounts.
--
-- Background: 8,800 rows across two historical Facilitation Journals resolved to 1,345
-- people; 838 of them hold a minted IYFD-<year>-<seq> ID. This migration gives the app
-- somewhere to put them, and gives signup the fields it asks for.
-- See aiOpsPlatform/identity/{INJECTION-PLAN,SIGNUP-FLOW,PROFILE-MAPPING}.md

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The person: internal, permanent, never displayed, never reused.
--    A person exists whether or not they have an app account.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE persons (
  id                TEXT PRIMARY KEY,              -- ULID
  display_name      TEXT NOT NULL,                 -- current name; the only one shown
  iyf_id            TEXT NOT NULL DEFAULT '',      -- IYFD-2019-0044; '' until minted
  connected_since   TEXT NOT NULL DEFAULT '',      -- 'YYYY' or ISO date
  connected_since_src TEXT NOT NULL DEFAULT '',    -- import | app | coordinator | inferred
  status            TEXT NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active','Inactive')),
  merged_into       TEXT NOT NULL DEFAULT '',      -- set when this person is merged away
  import_batch      TEXT NOT NULL DEFAULT '',      -- lets one import be undone wholesale
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX persons_iyf_id ON persons (iyf_id) WHERE iyf_id <> '';
CREATE INDEX persons_status ON persons (status);
CREATE INDEX persons_batch  ON persons (import_batch) WHERE import_batch <> '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Names are history, not a field. Initiation ADDS a name; it never erases one.
--    Every name stays searchable — a facilitator who knew someone as "Debojeet Dey"
--    must still find them, or they create a duplicate.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE person_names (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('given','initiated','spelling_variant')),
  is_current  INTEGER NOT NULL DEFAULT 0,
  from_at     TEXT NOT NULL DEFAULT '',
  added_at    TEXT NOT NULL
);
CREATE INDEX person_names_person  ON person_names (person_id);
CREATE INDEX person_names_search  ON person_names (name);
CREATE UNIQUE INDEX person_names_one_current ON person_names (person_id) WHERE is_current = 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Phones. One number belongs to exactly one person. A changed number keeps the
--    old one as an inactive alternate so historical records still resolve.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE person_phones (
  phone       TEXT PRIMARY KEY,                    -- normalised, 10 digits
  person_id   TEXT NOT NULL,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  added_at    TEXT NOT NULL
);
CREATE INDEX person_phones_person ON person_phones (person_id, is_primary DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Identifier history: superseded IDs resolve forever (GP26-0061 -> IYFD-2021-0040).
--    Nothing is ever deleted; a number is never reissued.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE person_identifiers (
  fid           TEXT PRIMARY KEY,                  -- IYFD-2019-0044 | GP26-0061 | SR26-0001
  person_id     TEXT NOT NULL,
  series        TEXT NOT NULL DEFAULT 'IYFD',
  state         TEXT NOT NULL DEFAULT 'current' CHECK (state IN ('current','superseded','retired')),
  superseded_by TEXT NOT NULL DEFAULT '',
  issued_by     TEXT NOT NULL DEFAULT '',          -- import | app | dashboard
  issued_at     TEXT NOT NULL,
  ended_at      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX person_identifiers_person ON person_identifiers (person_id, state);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. One person, many service accounts (this app, and whatever else later).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE person_links (
  service     TEXT NOT NULL,                       -- 'sadhana'
  account_ref TEXT NOT NULL,                       -- accounts.login
  person_id   TEXT NOT NULL,
  linked_at   TEXT NOT NULL,
  PRIMARY KEY (service, account_ref)
);
CREATE INDEX person_links_person ON person_links (person_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. The ID counter. Per-year sequence, so it resets annually and stays 4 digits:
--    the busiest year on record is 333 people, against a 9,999 ceiling.
--    Minting advances next_seq with a conditional UPDATE; the unique index on
--    person_identifiers.fid makes a duplicate impossible even under a race.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE id_sequences (
  series     TEXT NOT NULL,
  year       TEXT NOT NULL,
  next_seq   INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (series, year)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Imported history, read-only. This is what makes a profile a record rather
--    than a form: where every value came from, and what changed over the years.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE person_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id   TEXT NOT NULL,
  kind        TEXT NOT NULL,                       -- facilitator | level | source_row | note
  value       TEXT NOT NULL,
  seq         INTEGER NOT NULL DEFAULT 0,          -- ordering within a kind
  source      TEXT NOT NULL DEFAULT '',            -- 'L:HG Jayavamandev pr#412'
  recorded_at TEXT NOT NULL
);
CREATE INDEX person_history_person ON person_history (person_id, kind, seq);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Profile fields the signup form needs. Added to the existing `profiles` table,
--    all defaulted and all editable by the person from the account section later.
--    (`profiles` already has: dob, emergency_*, addr_*, parent_*, photo_*.)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN gender            TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN marital_status    TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN initiated_name    TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN class_level       TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN chanting_rounds   TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN education         TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN education_institute TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN profession        TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN organization      TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN skills            TEXT NOT NULL DEFAULT '';   -- JSON array
ALTER TABLE profiles ADD COLUMN connected_since   TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN connected_area    TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN connected_by      TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN person_id         TEXT NOT NULL DEFAULT '';
-- which fields came from the import and have not yet been confirmed by the person
ALTER TABLE profiles ADD COLUMN imported_fields   TEXT NOT NULL DEFAULT '';   -- JSON array

CREATE INDEX profiles_person ON profiles (person_id) WHERE person_id <> '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Signup approval: an account is created pending and a coordinator approves it.
--    This is the backstop for a wrong self-match or a duplicate that slipped through.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE accounts ADD COLUMN signup_state   TEXT NOT NULL DEFAULT '';  -- ''|PENDING|APPROVED|REJECTED
ALTER TABLE accounts ADD COLUMN signup_at      TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN approved_by    TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN approved_at    TEXT NOT NULL DEFAULT '';
ALTER TABLE accounts ADD COLUMN phone_changed_from TEXT NOT NULL DEFAULT '';

CREATE INDEX accounts_signup_pending ON accounts (signup_state) WHERE signup_state = 'PENDING';
