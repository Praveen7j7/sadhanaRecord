-- Sadhana Record, main copy (D1). The Google Sheets are copies of these tables (design §2d).
-- Times are ISO strings in Indian time (2026-10-05T21:00:00+05:30); weeks and dates are YYYY-MM-DD.

CREATE TABLE accounts (
  login TEXT PRIMARY KEY,                 -- devotee phone, or coordinator / master username
  role TEXT NOT NULL CHECK (role IN ('DEVOTEE','COORDINATOR','MASTER')),
  status TEXT NOT NULL CHECK (status IN ('PENDING','ACTIVE','INACTIVE','DISABLED','REJECTED')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  iyf_id TEXT,                            -- NULL until linked; one account per IYF ID (index below)
  id_source TEXT NOT NULL DEFAULT '',
  requested_batch TEXT NOT NULL DEFAULT '',
  pw_hash TEXT NOT NULL,
  pw_salt TEXT NOT NULL,
  pw_iterations INTEGER NOT NULL,
  must_change_pw INTEGER NOT NULL DEFAULT 0,
  failed_tries INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT NOT NULL DEFAULT '',
  signed_up_at TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT '',
  decided_by TEXT NOT NULL DEFAULT '',
  reject_reason TEXT NOT NULL DEFAULT '',
  last_login_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX accounts_one_per_iyf_id ON accounts (iyf_id) WHERE iyf_id IS NOT NULL;
CREATE INDEX accounts_by_status ON accounts (status, requested_batch);

CREATE TABLE batches (
  batch_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  score_card TEXT NOT NULL,
  hearing_journal TEXT NOT NULL,
  sheet_tab TEXT NOT NULL,
  coordinator_logins TEXT NOT NULL DEFAULT '',
  standing INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  pilot INTEGER NOT NULL DEFAULT 0,
  view_sheet_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE memberships (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL,
  iyf_id TEXT NOT NULL DEFAULT '',
  batch_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE','INACTIVE')),
  from_week TEXT NOT NULL,
  to_week TEXT NOT NULL DEFAULT '',
  level_entry_date TEXT NOT NULL DEFAULT '',
  group_leader TEXT NOT NULL DEFAULT '',
  set_by TEXT NOT NULL DEFAULT '',
  set_at TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX memberships_by_login ON memberships (login);

CREATE TABLE reset_requests (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  new_pw_hash TEXT NOT NULL,
  new_pw_salt TEXT NOT NULL,
  new_pw_iterations INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','SUPERSEDED')),
  decided_by TEXT NOT NULL DEFAULT '',
  decided_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX reset_requests_by_login ON reset_requests (login, status);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,            -- SHA-256 of the token; the token itself is never stored
  login TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  device TEXT NOT NULL DEFAULT '',
  ended_at TEXT NOT NULL DEFAULT '',
  end_reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX sessions_by_login ON sessions (login);

CREATE TABLE profiles (
  login TEXT PRIMARY KEY,
  iyf_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  dob TEXT NOT NULL DEFAULT '',
  blood_group TEXT NOT NULL DEFAULT '',
  emergency_name TEXT NOT NULL DEFAULT '',
  emergency_relation TEXT NOT NULL DEFAULT '',
  emergency_phone TEXT NOT NULL DEFAULT '',
  photo_file_id TEXT NOT NULL DEFAULT '',
  photo_updated_at TEXT NOT NULL DEFAULT '',
  reading_pages_per_hour INTEGER NOT NULL DEFAULT 20,
  current_book_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT '',
  changed_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL, who TEXT NOT NULL, role TEXT NOT NULL, action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '', batch_id TEXT NOT NULL DEFAULT '',
  before TEXT NOT NULL DEFAULT '', after TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '', request_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE run_log (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL, action TEXT NOT NULL, ms INTEGER NOT NULL, ok INTEGER NOT NULL,
  error_code TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '', app_build TEXT NOT NULL DEFAULT ''
);

-- The dashboard's Devotees tab, copied every 30 minutes (read-only source; API contract §6)
CREATE TABLE registry (
  iyf_id TEXT PRIMARY KEY,
  name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', level TEXT NOT NULL DEFAULT '',
  facilitator TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '', merged_into TEXT,
  aliases TEXT NOT NULL DEFAULT '[]'      -- JSON array of the registry's alias keys for this ID
);

-- A repeated requestId returns the first answer (kept 6 hours)
CREATE TABLE replies (
  key TEXT PRIMARY KEY, body TEXT NOT NULL, at INTEGER NOT NULL
);
-- Rate limits (sign-ups per hour, resets per day)
CREATE TABLE counters (
  key TEXT PRIMARY KEY, n INTEGER NOT NULL, expires INTEGER NOT NULL
);
-- Which tables changed since the last copy to Sheets
CREATE TABLE mirror_state (
  tbl TEXT PRIMARY KEY, dirty INTEGER NOT NULL DEFAULT 1, last_id INTEGER NOT NULL DEFAULT 0, synced_at TEXT NOT NULL DEFAULT ''
);

INSERT INTO batches (batch_id, name, level, score_card, hearing_journal, sheet_tab, standing, active, pilot, updated_by) VALUES
  ('SPS',  'SPS',         'SPS', 'SPS',         'Level 4',     'SPS',         1, 1, 0, 'setup'),
  ('SPS2', 'SPS Group 2', 'SPS', 'SPS',         'Level 4',     'SPS Group 2', 1, 1, 1, 'setup'),
  ('SPSO', 'SPS Online',  'SPS', 'SPS',         'Level 4',     'SPS Online',  1, 1, 0, 'setup'),
  ('DPS',  'DPS',         'DPS', 'BVS/DPS/BSS', 'Level 4',     'DPS',         1, 1, 0, 'setup'),
  ('BSS',  'BSS',         'BSS', 'BVS/DPS/BSS', 'Level 5 BSS', 'BSS',         1, 1, 0, 'setup'),
  ('BVS',  'BVS',         'BVS', 'BVS/DPS/BSS', 'Level 5 BVS', 'BVS',         1, 1, 0, 'setup');

INSERT INTO settings (key, value, note, changed_by) VALUES
  ('submit_opens', 'SUN 18:00', 'Week submit window opens (IST)', 'setup'),
  ('submit_closes', 'MON 21:00', 'Deadline: unsubmitted weeks are dropped and marked MISSED (IST)', 'setup'),
  ('session_days', '30', 'A session ends after this many days without use', 'setup'),
  ('lockout_tries', '5', 'Wrong passwords in a row before a lock', 'setup'),
  ('lockout_minutes', '15', '', 'setup'),
  ('pbkdf2_iterations', '10000', 'PBKDF2 rounds for new hashes; Free plan ~10 ms CPU allows about this; raise to 100000 on Workers Paid', 'setup'),
  ('rules_version', 'r0', 'Raised whenever card ranges / Seva rules / Chetna options change', 'setup'),
  ('journals_version', 'j0', 'Raised whenever lectures / books change', 'setup'),
  ('min_app', '', 'Oldest app build allowed to keep running', 'setup');

INSERT INTO mirror_state (tbl) VALUES ('accounts'), ('batches'), ('memberships'), ('reset_requests'), ('profiles'), ('settings'), ('audit_log'), ('run_log');
