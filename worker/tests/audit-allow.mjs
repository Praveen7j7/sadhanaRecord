// The approved exceptions for the two database audits (Phase 9, item 19; prompt-58's audit §5.2, 9 Oct 2026).
// tests/write-audit.mjs flags MASS writes (a scan, no WHERE, or INSERT…SELECT); tests/query-plans.mjs flags statements
// that SCAN a table which grows. Each statement below was looked at and is fine as it is, for the reason given. The
// audits fail only on a flagged statement that is NOT here (new, or changed) — so a new one stands out at once.
// To add one: say why in one line (how often it runs, why the scan is bounded or rare). Matching is on the start of
// the statement with spaces collapsed and IN lists written (?), so a changed statement is caught again.
export const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim().replace(/\(\?(\s*,\s*\?)*\)/g, '(?)');

export const ALLOW = [
  // ---- roles given from Access with an end date (ADR 0019, 26 Oct 2026)
  ['SELECT login, name, grants FROM accounts WHERE grants LIKE \'%"@%\'',
   'the daily 00:07 IST job (grants.js expireRoles), ONCE a day: about 5,000 rows read at the largest, 0.1% of the daily 5M free rows, and no write unless a role has ended. An index cannot serve a LIKE inside the grants JSON, and a per-call check already drops an ended role at once'],
  // ---- phases and the target card (17 Oct 2026): the two tables here that do NOT grow with people
  ['SELECT * FROM measures WHERE active = 1 ORDER BY seq',
   'the eleven lead measures: a fixed list read from the dashboard card, 11 rows for ever. It does not grow with devotees, facilitators or weeks'],
  ['INSERT OR IGNORE INTO facilitators ("name", "in_cohort", "order") VALUES (?, 1, (SELECT COALESCE(MAX("order"), 0) + 1 FROM facilitators))',
   'ONE row when a trainee qualifies: the subquery only puts them last in the pick list. facilitators is about 25 rows and grows by a person, not by a week'],
  ['SELECT phase_id, starts_on, ends_on FROM phases WHERE starts_on <= ? AND ends_on >= ? ORDER BY starts_on DESC',
   'which phase a date falls in: the same ~30-row table, read for one training on a contact card'],
  ['SELECT * FROM phases ORDER BY starts_on DESC LIMIT 24',
   'three phases a year, so about 30 rows after a decade, and LIMIT 24 caps the read. Unlike submissions or attendance, a phase is not per person per week'],
  // ---- Admin › Analysis (phase 21, 23 Oct 2026; worker/src/analysis.js, migration 0064)
  ['SELECT phase_id, name, starts_on, ends_on FROM phases ORDER BY starts_on DESC LIMIT 12',
   'the phases for the head\'s Analysis filter: three a year, LIMIT 12 caps it, read only when the head opens Analysis'],
  ['INSERT INTO batch_weeks (batch_id, week_id, submitted, missed,',
   'the weekly summary: run by the Monday deadline job for one closed week at a time (and the three before it); every source subquery is WHERE week_id = ? on an indexed column, and it writes one keyed row per batch (~10)'],
  // ---- erasing a devotee (erase.js): rare, started by a person, and must reach every historical row
  ['UPDATE audit_log SET who = CASE WHEN who = ? THEN ? ELSE who END', 'account deletion: scrubs the person from every Activity row (rare, user-initiated)'],
  ["UPDATE audit_log SET before = replace(before, ?, ?), after = replace(after, ?, ?) WHERE action = 'leaders.assign'", 'account deletion: their name inside group-leader changes (rare)'],
  ['UPDATE attendance SET changed_by = CASE WHEN changed_by = ? THEN ? ELSE changed_by END', 'account deletion (and a staff rename): who marked attendance (rare)'],
  ['UPDATE leaders SET appointed_by = CASE WHEN appointed_by = ? THEN ? ELSE appointed_by END', 'account deletion / rename of the staff login that appointed leaders (rare, small table)'],
  ['UPDATE memberships SET set_by = CASE WHEN set_by = ? THEN ? ELSE set_by END', 'account deletion / rename of the staff login that set memberships (rare)'],
  ['DELETE FROM counters WHERE instr(key, ?) > 0', 'account deletion: the person\'s rate-limit counters (rare; counters expire hourly, so the table stays small)'],
  ['DELETE FROM replies WHERE (key >= ? AND key < ?) OR instr(body, ?) > 0', 'account deletion: cached replies naming them (rare; replies are cleared after 6 h)'],
  ['DELETE FROM mirror_log WHERE k1 = ?', 'account deletion: the copy queue entries keyed by the old phone (rare; the queue is trimmed nightly)'],
  ['DELETE FROM post_comments WHERE login = ?', 'account deletion: their comments (rare)'],
  ['DELETE FROM post_likes WHERE login = ?', 'account deletion: their likes (rare)'],
  ['DELETE FROM post_mutes WHERE viewer = ? OR author = ?', 'account deletion: hidden lists naming them (rare, small table)'],
  ['DELETE FROM post_reports WHERE reporter = ? OR comment_id IN', 'account deletion: their reports and reports on their comments (rare, small table)'],
  ['INSERT OR REPLACE INTO counters (key, n, expires) VALUES (? || (SELECT COALESCE(MAX(id), 0) FROM mirror_log)', 'account deletion: notes where the copy queue ends (MAX(id) reads one row by the primary key)'],
  ['SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS m FROM audit_log', 'account deletion: how many Activity ids are gone, to find rows in the sheet (rare; the log is capped by retention)'],

  // ---- the weekly deadline job (weeks.js): once a week, bounded by the week
  ["DELETE FROM drafts WHERE week_id <= ? AND login NOT IN (SELECT login FROM reopens WHERE state = 'OPEN')", 'weekly: clears finished weeks\' drafts (drafts only hold open weeks, so the table stays small)'],
  ["UPDATE reopens SET state = 'EXPIRED' WHERE state = 'OPEN' AND open_until <= ?", 'weekly: closes reopen windows that ran out (small table)'],
  ["SELECT login, open_until FROM reopens WHERE week_id = ? AND state = 'OPEN'", 'a batch board: the open reopens of one week (small table: a few rows a week)'],

  // ---- small or capped tables, or reads that stop early
  ['SELECT * FROM registry', 'the registry refresh compares the whole dashboard copy (every 30 minutes, by design: ~1 read per IYF ID)'],
  ["SELECT * FROM accounts WHERE role = 'COORDINATOR' OR is_master = 1 OR login IN", 'the head\'s Staff list (opened rarely; staff are a few dozen)'],
  ["SELECT login, name, role, status, is_master, facilitator_name, last_login_at FROM accounts WHERE role IN ('COORDINATOR', 'MASTER') OR is_master = 1", 'the head\'s staff export (rare, head only; the staff matched are a few dozen)'],
  ["SELECT login, name FROM accounts WHERE is_master = 1 OR role IN ('COORDINATOR', 'MASTER')", 'new-head requests: the staff names to show who is asked (rare, head only; a few dozen staff)'],
  ["SELECT login, name FROM accounts WHERE role IN ('COORDINATOR', 'MASTER') OR is_master = 1", 'the head\'s batch export: coordinator names (rare, head only)'],
  ["SELECT 1 AS x FROM accounts WHERE facilitator_name = ? AND status <> 'DISABLED'", 'creating a facilitator login (rare, the head only)'],
  // ADR 0015 (22 Oct 2026): the head finding a person on Admin › Access — head only, typed, 20 rows at most
  ["SELECT login, name, role, status, is_master, facilitator_name, grants FROM accounts WHERE login NOT LIKE 'deleted-%' AND (name LIKE ? OR login LIKE ?) ORDER BY name LIMIT", 'access.search: the head looking a person up by name (a contains-search, as every name search here; rare, head only, LIMIT 20)'],
  // (the four ADR 0014 A rename statements that stood here went with Phase 24: a rename is one row now, src/names.js)
  // ---- one name, one place (Phase 24, migration 0074, src/names.js): the facilitator's id written beside the name
  ["INSERT INTO accounts (login, role, status, name, phone, requested_batch, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by, requested_facilitator, email, whatsapp, requested_class_day, requested_fac_id) VALUES",
   'sign-up: ONE row (VALUES); the only SELECT is the scalar lookup of the chosen facilitator\'s id by name (facilitator_names primary key)'],
  ["INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, must_change_pw, signed_up_at, decided_at, decided_by, updated_at, updated_by, facilitator_name, facilitation, fac_id) VALUES",
   'a facilitator login, created by the head: ONE row (VALUES); the SELECT is the scalar id lookup by name (facilitator_names primary key)'],
  ['INSERT INTO memberships (login, iyf_id, batch_id, state, from_week, level_entry_date, set_by, set_at, reason, facilitator, class_day, fac_id) SELECT',
   'approval: ONE membership row (SELECT … WHERE changes() = 1: a constant row), with the facilitator\'s id by a keyed scalar lookup'],
  ["INSERT INTO person_names (person_id, \"name\", kind, is_current, from_at, added_at) SELECT l.person_id, ?, 'given', 1, ?, ? FROM person_links l WHERE l.service = 'sadhana' AND l.account_ref = ?",
   'renamePerson: the new name on the person behind ONE login (person_links primary key), only when they do not have it already; a rename, rare'],
  ['SELECT at, action, ms, ok, error_code, detail, app_build FROM run_log ORDER BY id DESC LIMIT ?', 'the technical log: newest first by the primary key, stops at the LIMIT'],
  ['SELECT id, at, who, role, action, target, batch_id, before, after, reason FROM audit_log WHERE', 'Activity: newest first by the primary key with LIMIT 30; filters narrow it; the log is capped by retention'],
  ['SELECT id, at FROM audit_log ORDER BY id LIMIT 1', 'retention: the oldest row by the primary key (one row)'],
  ['SELECT id, at FROM run_log ORDER BY id LIMIT 1', 'retention: the oldest row by the primary key (one row)'],
  ['SELECT id, created_at FROM push_jobs ORDER BY id LIMIT 1', 'retention: the oldest job by the primary key (one row)'],
  ["DELETE FROM push_jobs WHERE id IN (SELECT id FROM push_jobs ORDER BY id LIMIT ?) AND state = 'DONE'", 'retention: the oldest jobs by the primary key, a chunk a night'],
  ['INSERT INTO facilitators ("name", "in_cohort", "order", active, source, seen, changed_by, changed_at) VALUES (?, 0, (SELECT COALESCE(MAX("order")', 'adding a facilitator: the next order number (small table, rare)'],
  ['INSERT INTO memberships (login, iyf_id, batch_id, state, from_week, level_entry_date, set_by, set_at, reason, facilitator, class_day) SELECT', 'a membership change copies the open row (SCAN CONSTANT ROW: one row, no table scan)'],
  // ---- the hourly tidy-up (index.js, minute 7) and the head's Activity list, reached by tests/dashboard-retired.test.mjs
  ['DELETE FROM replies WHERE at < ?', 'hourly (minute 7): cached replies older than 6 h; the table holds only the last 6 hours of writes, so the scan is of a small table'],
  ['DELETE FROM counters WHERE expires < ?', 'hourly (minute 7): expired rate-limit counters; they live an hour, so the table stays small'],
  ['SELECT id, at, who, role, action, target, batch_id, before, after, reason FROM audit_log ORDER BY id DESC LIMIT ?', 'Activity with no filter: newest first by the primary key, stops at the LIMIT'],
  ['INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at) SELECT ?, login, ?, ?, ? FROM push_subs WHERE endpoint = ?', 'a phone renews its push address: copies its own row by the unique endpoint'],

  ["INSERT INTO audit_log (at, who, role, action, target, batch_id, before, after, reason, request_id) VALUES (?, ?, ?, 'ids.create'", 'creating an app IYF ID: the Activity line reads the new ID from the new row by its primary key (one row)'],

  /* ---- found when the audit's table list was derived from the schema (14 Oct 2026) ----
     These three were always being scanned; the old hand-written list simply did not name their tables, which
     is how `SELECT MAX(id), MIN(id) FROM mirror_log` reached 102.7% of D1's daily read limit unnoticed.
     Each is approved on COST, not on shape: what matters is rows-read x how often it runs. */

  ['SELECT group_key, by, at FROM duplicate_reviews',
   'the head\'s possible-duplicates screen, opened by hand. One row per duplicate group a head has decided on, ' +
   'so it grows with decisions (tens), never with devotees; and nothing scheduled reads it'],

  ["SELECT * FROM head_requests WHERE state <> 'OPEN' ORDER BY id DESC LIMIT 20",
   'the heads\' decided requests, on a head-only screen. One row per request to make a coordinator a head: ' +
   'a handful a year. Not scheduled'],

  ['SELECT COUNT(*) AS n FROM (SELECT 1 FROM mirror_log)',
   'mirrorBacklog()\'s fallback for a log whose ids were reused. The caller passes a cap (LIMIT), so the scan ' +
   'stops there and the cost is fixed however large the log grows; the uncapped form is read once an hour, ' +
   'not once a minute (see worker/src/index.js and tests/read-budget.test.mjs)'],

  ["INSERT INTO person_names (person_id, name, kind, is_current, added_at) SELECT ?, ?, 'given', ?, ? WHERE NOT EXISTS",
   'approval records the name the devotee signed up with (roadmap 3.8). INSERT…SELECT only because of the ' +
   'NOT EXISTS guard that stops a duplicate name on the same person: it writes ONE row, never a bulk write, ' +
   'and the guard is an index lookup (person_names_lower, migration 0049)'],

  // ---- the tests' own reads (not app code)
  ["SELECT 1 AS x FROM audit_log WHERE action = 'profile.facilitator' AND target =", 'tests/coord.test.mjs checks an Activity line (test only)'],
  // ---- automatic inactive (Phase 23, ADR 0020, inactive.js, migration 0071)
  ["INSERT INTO activity_events (login, batch_id, day, change, how, at, by_login) SELECT a.login, MIN(m.batch_id), ?, 'INACTIVE', 'AUTO'",
   'the daily job (00:13 IST, once a day): the open ACTIVE memberships of active devotees, every subquery keyed by login (sessions_by_login, drafts and submissions and missed_weeks primary keys, activity_events_day_how); writes only the people it makes inactive'],
  ["INSERT INTO activity_events (login, batch_id, day, change, how, at, by_login) SELECT login, batch_id, ?, 'ACTIVE'",
   "coming back (a saved day, a submitted week, a sign-in or a call): ONE row from the person's own open INACTIVE membership (memberships_by_login), only while it is inactive"],
  ["INSERT INTO audit_log (at, who, role, action, target, batch_id, before, after, reason, request_id) SELECT ?, 'SYSTEM', 'SYSTEM', 'inactive.auto'",
   "one Activity line a day with how many the daily job made inactive: COUNT over that day's AUTO events (activity_events_day_how); one row or none"],
  ["INSERT INTO audit_log (at, who, role, action, target, batch_id, before, after, reason, request_id) SELECT ?, ?, ?, 'inactive.cameBack'",
   "coming back: ONE Activity row from the person's own open INACTIVE membership (memberships_by_login), only while it is inactive"],
  ['INSERT INTO memberships (login, iyf_id, batch_id, state, from_week, level_entry_date, class_day, facilitator, fac_id, leader_login, set_by, set_at, reason) SELECT',
   "a membership row copied with a new state: the daily job (only the logins of today's AUTO events, activity_events_day_how) or one person coming back (memberships_by_login); never a table read in bulk"],
];

/** The allow-list entry for a statement, or undefined. */
export const allowed = (sql) => { const s = norm(sql); return ALLOW.find(([start]) => s.startsWith(norm(start))); };

/** Prints the flagged statements split into approved and new; exits 1 when any is new. */
export function report(flagged, label) {
  const fresh = flagged.filter(f => !allowed(f.sql));
  for (const f of fresh) console.log(`NEW   ${f.line}`);
  console.log(`\n${label}: ${flagged.length - fresh.length} approved (tests/audit-allow.mjs), ${fresh.length} new`);
  if (fresh.length) { console.log('A new statement scans or writes in bulk: make it use an index, or add it to tests/audit-allow.mjs with one line on why it is fine.'); process.exitCode = 1; }
}
