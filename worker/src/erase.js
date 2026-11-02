// Deleting a devotee (the store rules: Apple 5.1.1(v), Google Play account deletion; the head's decisions, 5 Oct 2026).
// The account, profile, photo, unsent days, comments, likes, reports, hidden lists, sessions, phones' notification
// addresses and requests go.
// Submitted weeks, attendance and missed weeks stay, so a batch's past numbers don't change, but under a random
// pseudonym (deleted-<12 hex>): no name, phone or IYF ID is left, and free-text reasons about the person are blanked.
// The audit log keeps that a deletion happened, without saying who it was.
//
// The keyed Sheets tabs follow by themselves (the triggers log the old and the new key: the old row is blanked, the new
// one written). The append tabs (Submissions, AuditLog) are never rewritten by the copy, so eraseSheets() rewrites the
// person's rows there, and the batch view sheets get a `redo:<week>` step (views.js).
// Cost (free plan): a deletion scans the audit log once (and, for a group leader, attendance); deletions are rare.
import { q, one, all, audit, dirty } from './db.js';
import { isoIst, mondayOf } from './util.js';
import { addDays } from './weeks.js';
import { MIRRORS, sheetRow } from './mirror.js';
import { SCHEMA } from '../../setup/schema.mjs';
import FILES from '../../setup/files.json' with { type: 'json' };
import { batchValues, writeRanges } from './google.js';
import { LIMITS } from './limits.js';

export const DELETED_NAME = 'Deleted devotee';
export const isDeleted = (login) => String(login || '').startsWith('deleted-');
const QUEUE = 'erase:';   // counters rows: erase:<tbl>:<pseudonym> → n = last id rewritten in the sheet; erase:mirror_log:<pseudonym>:<to> → n = from
const KEEP_QUEUE_MS = 90 * 86400e3;           // the hourly tidy-up deletes expired counters

function pseudonym() {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return 'deleted-' + [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Removes or anonymises everything about account `a` (a devotee), in one database batch. `how`: 'self' or 'coordinator'.
 * Returns { pseudonym, weeksKept }.
 */
export async function eraseDevotee(ctx, a, how, requestId = '') {
  const db = ctx.db, L = a.login, P = pseudonym(), now = ctx.now(), at = isoIst(now);
  const lastWeek = addDays(mondayOf(now), -7);
  const kept = (await one(db, 'SELECT COUNT(*) AS n FROM submissions WHERE login = ?', L)).n;
  const batchId = (await one(db, "SELECT batch_id FROM memberships WHERE login = ? ORDER BY to_week = '' DESC, id DESC LIMIT 1", L))?.batch_id || a.requested_batch || '';
  // the weeks the batch view sheets show this person in (their rows are written again with the new name, in order)
  const logFrom = (await one(db, 'SELECT COALESCE(MAX(id), 0) AS m FROM mirror_log'))?.m || 0;
  // only a group leader (now or before) is named on other people's rows: the scans for that run only then (free plan)
  const wasLeader = !!(await one(db, 'SELECT 1 AS x FROM leaders WHERE login = ? UNION ALL SELECT 1 FROM memberships WHERE leader_login = ? LIMIT 1', L, L));
  const viewWeeks = await all(db, 'SELECT DISTINCT b.level, s.week_id FROM submissions s JOIN batches b ON b.batch_id = s.batch_id WHERE s.login = ?', L);
  const json = (s) => JSON.stringify(s);
  const scrubJson = (col) => `CASE WHEN ${col} = '' THEN '' ELSE replace(replace(replace(${col}, ?, ?), ?, ?), ?, '""') END`;
  const scrubArgs = [json(L), json(P), json(a.name), json(DELETED_NAME), json(a.iyf_id || '\u0000none')];
  const by = (col) => `${col} = CASE WHEN ${col} = ? THEN ? ELSE ${col} END`;
  const stmts = [
    // the change log's older entries keyed by the phone (already copied, or redone by the entries this batch makes)
    /* k1 OR k2: a log entry keyed on the phone in either column still holds it. person_phones is keyed on
       the phone itself (mirrorkeys.js), so the identity deletions below queue entries carrying it —
       account-delete.test.mjs caught exactly that, which is what the test is for. */
    q(db, 'DELETE FROM mirror_log WHERE k1 = ? OR k2 = ?', L, L),
    // memberships: the open one ends last week; the group this person led is freed; history keeps the pseudonym
    q(db, "UPDATE memberships SET to_week = ?, reason = 'deleted' WHERE login = ? AND to_week = ''", lastWeek, L),
    q(db, `UPDATE memberships SET login = ?, iyf_id = '', ${by('set_by')} WHERE login = ?`, P, L, P, L),
    q(db, "UPDATE memberships SET leader_login = '' WHERE leader_login = ? AND to_week = ''", L),
    q(db, 'UPDATE memberships SET leader_login = ? WHERE leader_login = ?', P, L),
    q(db, `UPDATE memberships SET ${by('set_by')} WHERE set_by = ?`, L, P, L),
    q(db, 'DELETE FROM leaders WHERE login = ?', L),
    q(db, `UPDATE leaders SET ${by('appointed_by')} WHERE appointed_by = ?`, L, P, L),
    // submitted weeks: kept, anonymised (the week JSON too)
    q(db, `UPDATE submissions SET login = ?, submission_id = ? || '-' || week_id, name = ?, iyf_id = '', ${by('submitted_by')},
             week_json = CASE WHEN week_json = '' OR json_valid(week_json) = 0 THEN week_json ELSE json_set(json_remove(week_json, '$.iyfId'), '$.login', ?, '$.name', ?) END
           WHERE login = ?`, P, P, DELETED_NAME, L, P, P, DELETED_NAME, L),
    q(db, "UPDATE attendance SET login = ?, reason = '' WHERE login = ?", P, L),
    ...(wasLeader ? [q(db, `UPDATE attendance SET ${by('changed_by')}, ${by('leader_by')} WHERE changed_by = ? OR leader_by = ?`, L, P, L, P, L, L)] : []),
    q(db, 'UPDATE missed_weeks SET login = ? WHERE login = ?', P, L),
    // requests still open go; decided ones stay (anonymised, reasons blanked)
    q(db, "DELETE FROM reopens WHERE login = ? AND state = 'OPEN'", L),
    q(db, "UPDATE reopens SET login = ?, reason = '' WHERE login = ?", P, L),
    q(db, "DELETE FROM reopen_requests WHERE login = ? AND state = 'PENDING'", L),
    q(db, `UPDATE reopen_requests SET login = ?, reason = '', ${by('by')} WHERE login = ?`, P, L, P, L),
    // the wall's moderation: their reports and hidden lists, the reports about their comments, and others' mutes of them
    q(db, 'DELETE FROM post_reports WHERE reporter = ? OR comment_id IN (SELECT id FROM post_comments WHERE login = ?)', L, L),
    q(db, 'DELETE FROM post_mutes WHERE viewer = ? OR author = ?', L, L),
    // Share sadhana (migration 0070): whatever they shared, and whatever was shared with them, goes
    q(db, 'DELETE FROM sadhana_shares WHERE owner = ?', L),
    q(db, 'DELETE FROM sadhana_shares WHERE viewer = ?', L),
    // gone entirely
    ...['drafts', 'photos', 'profiles', 'reset_requests', 'sessions', 'post_likes', 'post_comments', 'push_subs'].map(t => q(db, `DELETE FROM ${t} WHERE login = ?`, L)),
    // saved replies (a repeated request gets the same answer): theirs, and anyone's that names them
    q(db, "DELETE FROM replies WHERE (key >= ? AND key < ?) OR instr(body, ?) > 0", L + ':', L + ';', L),
    q(db, 'DELETE FROM counters WHERE instr(key, ?) > 0', L),
    // the audit log: entries by or about this person, and the group-leader moves that list them, without name, phone,
    // IYF ID or free-text reason
    q(db, `UPDATE audit_log SET ${by('who')}, ${by('target')}, before = ${scrubJson('before')}, after = ${scrubJson('after')}, reason = ''
           WHERE who = ? OR target = ?`, L, P, L, P, ...scrubArgs, ...scrubArgs, L, L),
    ...(wasLeader ? [q(db, `UPDATE audit_log SET before = replace(before, ?, ?), after = replace(after, ?, ?) WHERE action = 'leaders.assign' AND (instr(before, ?) > 0 OR instr(after, ?) > 0)`,
      json(L), json(P), json(L), json(P), json(L), json(L))] : []),
    // the batch view sheets: those weeks are written again; This week drops the person
    ...viewWeeks.map(r => q(db, 'INSERT OR IGNORE INTO view_dirty (view, part) VALUES (?, ?)', 'view' + r.level, 'redo:' + r.week_id)),
    ...[...new Set(viewWeeks.map(r => r.level))].map(l => q(db, "INSERT OR IGNORE INTO view_dirty (view, part) VALUES (?, 'board')", 'view' + l)),
    // the append tabs in Sheets: rewritten by eraseSheets()
    ...['submissions', 'audit_log'].map(t => q(db, 'INSERT OR REPLACE INTO counters (key, n, expires) VALUES (?, 0, ?)', `${QUEUE}${t}:${P}`, now.getTime() + KEEP_QUEUE_MS)),
    q(db, 'DELETE FROM accounts WHERE login = ?', L),
    audit(db, { ...ctx, login: how === 'self' ? P : ctx.login }, 'account.delete', P, batchId, null, { by: how, weeksKept: kept }, '', requestId),
    /* The IDENTITY tables (16 Oct 2026). Approving a devotee now creates a person (roadmap 3.8), so
       deleting one has to erase that person too — account-delete.test.mjs caught this immediately, which is
       what it is for: a name, a phone and an IYF ID were left behind in persons, person_names,
       person_phones and person_links after a delete that promises to leave none.

       Same shape as everywhere else here: the LINK goes, the identifying values are replaced with the
       pseudonym, and the person row itself STAYS so a merge or an old export still resolves. A person other
       accounts also point at is left alone — they are someone else's record too. */
    q(db, `UPDATE persons SET display_name = ?, iyf_id = '', status = 'Inactive', updated_at = ?
            WHERE id IN (SELECT person_id FROM person_links WHERE service = 'sadhana' AND account_ref = ?)
              AND NOT EXISTS (SELECT 1 FROM person_links x WHERE x.person_id = persons.id AND x.account_ref <> ?)`,
      DELETED_NAME, at, L, L),
    q(db, `DELETE FROM person_names WHERE person_id IN (SELECT person_id FROM person_links WHERE service = 'sadhana' AND account_ref = ?)
             AND NOT EXISTS (SELECT 1 FROM person_links x WHERE x.person_id = person_names.person_id AND x.account_ref <> ?)`, L, L),
    q(db, 'DELETE FROM person_phones WHERE phone = ?', L),
    q(db, `DELETE FROM person_identifiers WHERE person_id IN (SELECT person_id FROM person_links WHERE service = 'sadhana' AND account_ref = ?)
             AND NOT EXISTS (SELECT 1 FROM person_links x WHERE x.person_id = person_identifiers.person_id AND x.account_ref <> ?)`, L, L),
    q(db, "DELETE FROM person_links WHERE service = 'sadhana' AND account_ref = ?", L),
    dirty(db, 'accounts', 'profiles', 'memberships', 'reset_requests', 'audit_log',
          'persons', 'person_names', 'person_phones', 'person_identifiers', 'person_links'),
    // last: the change-log entries this batch made (the old keys, with the phone) are deleted once copied (eraseSheets)
    q(db, "INSERT OR REPLACE INTO counters (key, n, expires) VALUES (? || (SELECT COALESCE(MAX(id), 0) FROM mirror_log), ?, ?)", `${QUEUE}mirror_log:${P}:`, logFrom, now.getTime() + KEEP_QUEUE_MS)
  ];
  await db.batch(stmts);
  return { pseudonym: P, weeksKept: kept };
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Sheets: the append tabs                                                                                             */
/* ------------------------------------------------------------------------------------------------------------------ */

const WINDOW = 25, MAX_SPAN = 600;            // rows a run: LIMITS.ERASE_PER_RUN (limits.js)

/** The columns that identify a copied row in its tab (unchanged by the anonymising). */
const IDENT = { submissions: ['week_id', 'submitted_at', 'request_id'], audit_log: ['at', 'action', 'request_id'] };
/** The rows of `tbl` that hold the pseudonym (already anonymised in D1). */
const MINE = {
  submissions: 'login = ?1',
  audit_log: "who = ?1 OR target = ?1 OR (action = 'leaders.assign' AND (instr(before, '\"' || ?1 || '\"') > 0 OR instr(after, '\"' || ?1 || '\"') > 0))"
};
const colName = (i) => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));
const str = (x) => (x === undefined || x === null ? '' : String(x));

/**
 * One step of rewriting a deleted person's rows in the Submissions and AuditLog tabs. These tabs are only ever appended
 * to, in id order, and their tables never lose rows, so a row sits at about 1 + its id (less any ids never used): the
 * few identifying columns are read around that place, the row is found by them, then written whole. Rows not copied
 * yet need nothing: the copy will send them anonymised. Returns a short report, or '' when there is nothing to do.
 */
export async function eraseSheets(env, db) {
  const jobs = await all(db, "SELECT key, n FROM counters WHERE key LIKE 'erase:%' ORDER BY key");
  let job = null;
  for (const j of jobs) {
    const [, tbl, , to] = j.key.split(':');
    if (tbl !== 'mirror_log') { job = j; break; }
    // the change log's entries from the deletion hold the old phone as a row key: gone once the copy has used them
    if ((await one(db, "SELECT last_id FROM mirror_state WHERE tbl = 'mirror_log'"))?.last_id >= Number(to)) {
      // The deleted person's phone is a row KEY in these entries, so every one of them must go — the account
      // deletion promise (erase.js header, store rules) outranks the id-reuse worry, and keeping the last entry
      // would leave the phone in the log for ever (account-delete.test.mjs checks exactly that). Instead, a
      // placeholder entry is appended first, so the table never becomes empty and ids keep rising: the reuse
      // problem (audit J10) is solved without keeping anything personal.
      await db.batch([
        q(db, "INSERT INTO mirror_log (tbl, k1, k2) VALUES ('mirror_state', 'mirror_log', '')"),
        q(db, 'DELETE FROM mirror_log WHERE id > ? AND id <= ?', j.n, Number(to)),
        q(db, 'DELETE FROM counters WHERE key = ?', j.key)
      ]);
      return `change log ${j.n + 1}–${to}: deleted`;
    }
  }
  if (!job) return '';
  const [, tbl, P] = job.key.split(':');
  const done = () => db.batch([q(db, 'DELETE FROM counters WHERE key = ?', job.key)]).then(() => `${tbl} ${P}: done`);
  if (!MIRRORS[tbl] || !MINE[tbl]) return done();
  const [fileKey, tab] = MIRRORS[tbl], cols = SCHEMA[fileKey].tabs[tab];
  const copied = (await one(db, 'SELECT last_id FROM mirror_state WHERE tbl = ?', tbl))?.last_id || 0;
  const rows = await all(db, `SELECT * FROM ${tbl} WHERE (${MINE[tbl]}) AND id > ?2 AND id <= ?3 ORDER BY id LIMIT ?4`, P, job.n, copied, LIMITS.ERASE_PER_RUN);
  if (!rows.length) return done();
  const { n, m } = await one(db, `SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS m FROM ${tbl}`);
  const gaps = Math.max(0, m - n), idx = IDENT[tbl].map(c => cols.findIndex(x => x[0] === c)), last = colName(Math.max(...idx));
  const want = rows.map(r => {
    const values = sheetRow(tbl, cols, r), to = 1 + r.id + WINDOW, from = Math.max(2, 1 + r.id - gaps - WINDOW, to - MAX_SPAN);
    return { r, values, from, guess: 1 + r.id - gaps, id: idx.map(i => str(values[i])).join('\u0001') };
  });
  const got = await batchValues(env, FILES[fileKey], want.map(w => `'${tab}'!A${w.from}:${last}${1 + w.r.id + WINDOW}`));
  const writes = [], missing = [];
  want.forEach((w, i) => {
    const block = got[i] || [], near = block.map((_, k) => k).sort((x, y) => Math.abs(w.from + x - w.guess) - Math.abs(w.from + y - w.guess));
    const k = near.find(j => idx.map(c => str((block[j] || [])[c])).join('\u0001') === w.id);
    if (k === undefined) missing.push(w.r.id); else writes.push({ range: `'${tab}'!A${w.from + k}`, values: [w.values] });
  });
  if (writes.length) await writeRanges(env, FILES[fileKey], writes);
  await db.batch([q(db, 'UPDATE counters SET n = ? WHERE key = ?', rows[rows.length - 1].id, job.key)]);
  return `${tbl} ${P}: ${writes.length} row(s) rewritten${missing.length ? `, not found: ids ${missing.join(', ')}` : ''}`;
}
