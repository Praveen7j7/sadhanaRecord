// Copies D1 into the Google Sheets (design §2d). D1 is the main copy; the sheets follow it, so a hand edit there is
// overwritten at the next copy. Password hashes, salts and session tokens are never copied (their columns stay blank).
// Columns follow setup/schema.mjs, the same layout the sheets were built with.
import { SCHEMA } from '../../setup/schema.mjs';
import FILES from '../../setup/files.json' with { type: 'json' };
import { all, one, q } from './db.js';
import { isoIst } from './util.js';
import { KEYED } from './mirrorkeys.js';
import { FREE, LIMITS } from './limits.js';
import { writeRanges, clearRanges, appendRows, sheetGrid, growTabs } from './google.js';

const NEVER_COPIED = new Set(['pw_hash', 'pw_salt', 'pw_iterations', 'new_pw_hash', 'new_pw_salt', 'new_pw_iterations', 'token_hash']);

/**
 * D1 table → [file key, tab, how, order].
 *   'keyed'  — tables that change while the app runs. A trigger appends each changed row's key to mirror_log (one
 *              database write; migration 0022); each run copies the logged rows, each to its own row of the tab
 *              (mirror_rows). A new row takes a free row (mirror_free) or goes at the end; a deleted row is blanked and
 *              its row freed. A tab is never cleared. A new table (mode 'build') is first copied whole, in rowid
 *              order, over the old content.
 *   'append' — written once, never changed (submissions, logs): rows with a higher id are added at the bottom.
 *   'all'    — reference lists that change only with a new release (rules, lectures, books): rewritten in place.
 */
export const MIRRORS = {
  accounts: ['access', 'Accounts', 'keyed'],
  batches: ['access', 'Batches', 'keyed'],
  memberships: ['access', 'Memberships', 'keyed'],
  reset_requests: ['access', 'ResetRequests', 'keyed'],
  profiles: ['profiles', 'Profiles', 'keyed'],
  settings: ['rules', 'Settings', 'keyed'],
  submissions: ['submissions2026', 'Submissions', 'append', 'ORDER BY id'],
  attendance: ['submissions2026', 'Attendance', 'keyed'],
  reopens: ['submissions2026', 'Reopens', 'keyed'],
  class_weeks: ['submissions2026', 'ClassWeeks', 'keyed'],
  card_ranges: ['rules', 'CardRanges', 'all', 'ORDER BY rowid'],
  seva_rules: ['rules', 'SevaRules', 'all', 'ORDER BY rowid'],
  chetna_options: ['rules', 'ChetnaOptions', 'all', 'ORDER BY rowid'],
  lectures: ['rules', 'Lectures', 'all', 'ORDER BY rowid'],
  books: ['rules', 'Books', 'all', 'ORDER BY rowid'],
  book_files: ['rules', 'BookFiles', 'all', 'ORDER BY book_id, "order"'],
  book_chapters: ['rules', 'BookChapters', 'all', 'ORDER BY book_id, lang, n'],
  audit_log: ['access', 'AuditLog', 'append', 'ORDER BY id'],
  run_log: ['access', 'RunLog', 'append', 'ORDER BY id'],
  // decision 39: what the app keeps is visible in the sheets too (pictures and phone notification addresses excepted)
  facilitators: ['access', 'Facilitators', 'keyed'],
  announcements: ['access', 'Announcements', 'keyed'],
  duplicate_reviews: ['access', 'DuplicateReviews', 'keyed'],
  missed_weeks: ['submissions2026', 'MissedWeeks', 'keyed'],
  reopen_requests: ['submissions2026', 'ReopenRequests', 'keyed'],
  // the head, 3 Oct 2026: weeks being filled, so the people following devotees see them as they are filled
  drafts: ['drafts', 'Drafts', 'keyed'],
  leaders: ['access', 'Leaders', 'keyed'],
  post_comments: ['access', 'PostComments', 'keyed'],
  post_reports: ['access', 'PostReports', 'keyed'],
  post_mutes: ['access', 'PostMutes', 'keyed'],
  app_ids: ['access', 'AppIds', 'keyed'],
  head_requests: ['access', 'HeadRequests', 'keyed'],
  // the IYF identity record (migration 0038)
  persons: ['access', 'Persons', 'keyed'],
  person_names: ['access', 'PersonNames', 'keyed'],
  person_phones: ['access', 'PersonPhones', 'keyed'],
  person_identifiers: ['access', 'PersonIdentifiers', 'keyed'],
  person_links: ['access', 'PersonLinks', 'keyed'],
  person_history: ['access', 'PersonHistory', 'keyed'],
  id_sequences: ['access', 'IdSequences', 'keyed']
};

/**
 * Columns this release adds that setup/schema.mjs does not list yet (Phase 0, 8 Oct 2026): copied after the schema's own
 * columns of the tab. The tabs and header cells must exist in the sheets before the release (Sheets refuses writes past a
 * tab's last column). Once setup/schema.mjs lists them, they can be deleted here (a column the schema has is never doubled).
 */
export const SCHEMA_ADDS = {
  profiles: {
    Profiles: [
      ['parent_name', "Under 18 at sign-up: the parent's or guardian's name (their consent, DPDP Act 2023)", 'text'],
      ['parent_phone', "Under 18 at sign-up: the parent's or guardian's mobile", 'text'],
      ['parent_consent_at', 'When the parent or guardian consent was given (the sign-up)', 'datetime'],
      ['privacy_consent_at', 'When the privacy notice was agreed to at sign-up (blank: an older app that did not ask)', 'datetime']
    ]
  },
  access: {
    PostReports: [
      ['id', '', 'int'], ['ann_id', 'Announcements › id', 'int'], ['comment_id', 'PostComments › id; 0 = the post itself', 'int'],
      ['reporter', 'Who reported it (login)', 'text'], ['reason', 'spam, abusive, inappropriate or other', 'enum:spam|abusive|inappropriate|other'],
      ['note', 'Optional, at most 200 characters', 'text'], ['at', '', 'datetime'],
      ['state', 'OPEN until the IYF head acts: DISMISSED (left on the wall) or REMOVED', 'enum:OPEN|DISMISSED|REMOVED'],
      ['decided_by', '', 'text'], ['decided_at', '', 'datetime']
    ],
    PostMutes: [
      ['id', '', 'int'], ['viewer', 'Who hid the comments (login); * = the IYF head hid them for everyone (and new ones are refused)', 'text'],
      ['author', 'Whose comments are hidden (login)', 'text'], ['by', 'Who did it', 'text'], ['at', '', 'datetime']
    ]
  }
};
/** A tab's columns, in order: setup/schema.mjs's, then SCHEMA_ADDS's not already there. */
export function tabCols(fileKey, tab) {
  const base = SCHEMA[fileKey]?.tabs[tab] || [], more = SCHEMA_ADDS[fileKey]?.[tab] || [];
  return [...base, ...more.filter(c => !base.some(b => b[0] === c[0]))];
}

/** One D1 row as a sheet row, in the tab's column order. */
export function toSheetRow(cols, row) {
  return cols.map(([h, , kind]) => {
    if (NEVER_COPIED.has(h)) return '';
    const v = row[h];
    if (v === null || v === undefined) return '';
    if (kind === 'bool') return v ? 'TRUE' : 'FALSE';
    if (kind === 'int') return typeof v === 'number' ? v : (v === '' ? '' : Number(v));
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v.slice(0, 16).replace('T', ' ');   // readable time
    return String(v);
  });
}

/**
 * Tabs whose column names differ from the table's: the Drafts tab (key = login|week, one column per day, and the
 * devotee's own attendance mark from the attendance table, joined in as __self).
 */
const SHAPE = {
  drafts: (r) => ({ ...r, key: `${r.login}|${r.week_id}`, d1_mon: r.d1, d2_tue: r.d2, d3_wed: r.d3, d4_thu: r.d4, d5_fri: r.d5, d6_sat: r.d6, d7_sun: r.d7, attendance_self: r.__self ?? '' })
};
const EXTRA = {
  drafts: { cols: ', x.devotee_mark AS __self', join: ' LEFT JOIN attendance x ON x.login = t.login AND x.week_id = t.week_id' },
  // likes and comments are counted when a post is copied (likes are not copied one by one: about 3 writes a like);
  // a new comment refreshes its post's row at once, likes are refreshed by the nightly recopy (step 4 below)
  announcements: { cols: ", (SELECT COUNT(*) FROM post_likes l WHERE l.ann_id = t.id) AS likes, (SELECT COUNT(*) FROM post_comments c WHERE c.ann_id = t.id AND c.removed_at = '') AS comments", join: '' }
};
export const sheetRow = (tbl, cols, r) => toSheetRow(cols, SHAPE[tbl] ? SHAPE[tbl](r) : r);

/** Small tables first, so a big one never holds the others up. */
const PRIORITY = ['accounts', 'batches', 'memberships', 'reset_requests', 'profiles', 'settings', 'audit_log', 'run_log', 'submissions', 'attendance', 'reopens', 'class_weeks',
                  'facilitators', 'leaders', 'reopen_requests', 'duplicate_reviews', 'post_comments', 'post_reports', 'post_mutes', 'app_ids', 'head_requests', 'announcements', 'missed_weeks', 'drafts',
                  'chetna_options', 'seva_rules', 'card_ranges', 'books', 'book_files', 'book_chapters', 'lectures',
                  'id_sequences', 'persons', 'person_phones', 'person_identifiers', 'person_links', 'person_names', 'person_history'];
export const ROWS_PER_RUN = FREE.MIRROR_ROWS_PER_RUN;     // the free-plan number; runs read LIMITS (limits.js)
/** Copied log entries are trimmed at night when the database's daily write budget is little used (IST Wed–Sat, 2 AM). */
export const TRIM_PER_RUN = FREE.MIRROR_TRIM_PER_RUN;
const keyOf = (tbl, r) => { const [a, b] = KEYED[tbl]; return [r[a], b ? r[b] : '']; };
const chunks = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };
/** Consecutive rows become one range: [{ row, values }] → [{ range, values }]. */
function ranges(tab, rows) {
  const out = [];
  for (const r of [...rows].sort((x, y) => x.row - y.row)) {
    const last = out[out.length - 1];
    if (last && last.next === r.row) { last.values.push(r.values); last.next++; } else out.push({ start: r.row, next: r.row + 1, values: [r.values] });
  }
  return out.map(x => ({ range: `'${tab}'!A${x.start}`, values: x.values }));
}
const mapInserts = (db, rows) => chunks(rows, 25).map(part => q(db, `INSERT OR REPLACE INTO mirror_rows (tbl, k1, k2, "row") VALUES ${part.map(() => '(?, ?, ?, ?)').join(', ')}`, ...part.flat()));

/** A table copied whole, in rowid order, over the tab from row 2 (first copy, or a rebuild). */
async function copyWhole(db, s, tab, cols, f, left) {
  const ex = EXTRA[s.tbl] || { cols: '', join: '' };
  const rows = await all(db, `SELECT t.rowid AS __rid, t.*${ex.cols} FROM ${s.tbl} t${ex.join} WHERE t.rowid > ? ORDER BY t.rowid LIMIT ?`, s.last_id, left + 1);
  const take = rows.slice(0, left), finished = rows.length <= left, from = s.rows + 2;
  if (s.last_id === 0 && s.rows === 0) f.stmts.push(q(db, 'DELETE FROM mirror_rows WHERE tbl = ?', s.tbl), q(db, 'DELETE FROM mirror_free WHERE tbl = ?', s.tbl));
  if (take.length) f.writes.push(...ranges(tab, take.map((r, i) => ({ row: from + i, values: sheetRow(s.tbl, cols, r) }))).map(w => ({ ...w, tab, lastRow: from + take.length - 1 })));
  f.stmts.push(...mapInserts(db, take.map((r, i) => [s.tbl, ...keyOf(s.tbl, r), from + i])));
  const total = s.rows + take.length;
  if (finished) f.clears.push(`'${tab}'!A${total + 2}:ZZ`);        // whatever the old copy had below the last row
  f.stmts.push(q(db, 'UPDATE mirror_state SET mode = ?, last_id = ?, rows = ?, synced_at = ? WHERE tbl = ?',
    finished ? 'live' : 'build', finished ? 0 : take[take.length - 1].__rid, total, isoIst(new Date()), s.tbl));
  f.notes.push(`${s.tbl} ${take.length}${finished ? ' (copied whole)' : ' (copying whole, continues)'}`);
  return Math.max(1, take.length);
}

/**
 * The logged rows of one table: each written at its own row; a new one at a free row or the end; a deleted one
 * blanked (its row freed). While a table is still being copied whole, only rows already copied are touched (the
 * rest arrive with the whole copy).
 */
async function copyKeys(db, s, tab, cols, f, keys) {
  const [a, b] = KEYED[s.tbl], ex = EXTRA[s.tbl] || { cols: '', join: '' }, found = [];
  for (const part of chunks(keys, 45)) {
    found.push(...await all(db, `WITH k(k1, k2) AS (VALUES ${part.map(() => '(?, ?)').join(', ')})
      SELECT k.k1 AS __k1, k.k2 AS __k2, r."row" AS __row, t.rowid AS __rid, t.*${ex.cols}
      FROM k LEFT JOIN mirror_rows r ON r.tbl = ? AND r.k1 = k.k1 AND r.k2 = k.k2
      LEFT JOIN ${s.tbl} t ON t."${a}" = k.k1${b ? ` AND t."${b}" = k.k2` : ''}${ex.join}`, ...part.flat(), s.tbl));
  }
  const building = s.mode === 'build';
  const fresh = found.filter(c => c.__rid !== null && c.__rid !== undefined && !c.__row && !building);
  const free = fresh.length ? (await all(db, 'SELECT "row" FROM mirror_free WHERE tbl = ? ORDER BY "row" LIMIT ?', s.tbl, fresh.length)).map(r => r.row) : [];
  const put = [], blank = [], mapAdd = [], mapDel = [], used = [];
  let appended = 0;
  for (const c of found) {
    if (c.__rid !== null && c.__rid !== undefined) {
      let row = c.__row;
      if (!row) {
        if (building) continue;
        if (free.length) { row = free.shift(); used.push(row); } else { row = s.rows + 2; s.rows++; appended++; }
        mapAdd.push([s.tbl, c.__k1, c.__k2, row]);
      }
      put.push({ row, values: sheetRow(s.tbl, cols, c) });
    } else if (c.__row) { blank.push(c.__row); mapDel.push([c.__k1, c.__k2]); }
  }
  if (put.length) f.writes.push(...ranges(tab, put).map(w => ({ ...w, tab, lastRow: Math.max(...put.map(p => p.row)) })));
  for (const r of blank) f.clears.push(`'${tab}'!A${r}:ZZ${r}`);
  f.stmts.push(...mapInserts(db, mapAdd));
  for (const [k1, k2] of mapDel) f.stmts.push(q(db, 'DELETE FROM mirror_rows WHERE tbl = ? AND k1 = ? AND k2 = ?', s.tbl, k1, k2));
  for (const part of chunks(blank, 45)) f.stmts.push(q(db, `INSERT OR IGNORE INTO mirror_free (tbl, "row") VALUES ${part.map(() => '(?, ?)').join(', ')}`, ...part.flatMap(r => [s.tbl, r])));
  for (const part of chunks(used, 90)) f.stmts.push(q(db, `DELETE FROM mirror_free WHERE tbl = ? AND "row" IN (${part.map(() => '?').join(', ')})`, s.tbl, ...part));
  if (appended) f.stmts.push(q(db, 'UPDATE mirror_state SET rows = ?, synced_at = ? WHERE tbl = ?', s.rows, isoIst(new Date()), s.tbl));
  if (put.length || blank.length) f.notes.push(`${s.tbl} ${put.length + blank.length}`);
  return found;
}

/** IST weekday (0 = Sunday) and hour. */
const istNow = (now) => { const d = new Date(now.getTime() + 5.5 * 3600e3); return { dow: d.getUTCDay(), hour: d.getUTCHours(), minute: d.getUTCMinutes() }; };

/**
 * Copies what changed to the Sheets, at most ROWS_PER_RUN rows a run (the Free plan allows 10 ms of processing per
 * scheduled run): the changing tables' logged rows, new rows of the logs, reference lists a release changed. Nothing is
 * cleared before it is rewritten, so a tab is never half empty. The log position and bookkeeping are saved only after
 * Google accepted every write, so a failed run is simply done again. Returns a short report ([] when nothing changed).
 */
export async function mirrorChanged(env, db, budget = LIMITS.MIRROR_ROWS_PER_RUN, now = new Date()) {
  const states = await all(db, 'SELECT * FROM mirror_state');
  const byTbl = Object.fromEntries(states.map(s => [s.tbl, s]));
  const state = states.filter(s => MIRRORS[s.tbl]).sort((a, b) => PRIORITY.indexOf(a.tbl) - PRIORITY.indexOf(b.tbl));
  const report = [], byFile = {}, file = (k) => (byFile[k] ||= { clears: [], writes: [], appends: [], stmts: [], notes: [] });
  let left = budget;

  // 1. the change log: every changing table's logged rows, from where the last run stopped
  let pos = byTbl.mirror_log?.last_id || 0;
  // a log whose highest id is below the position had its ids reused (an emptied table numbers new rows from 1 again;
  // 10 Oct 2026: that stalled the copy from 7 Oct): every entry left is then uncopied, so read it from its start
  if (pos && byTbl.mirror_log) {
    /* TWO SUBQUERIES, NOT ONE ROW (14 Oct 2026 — this one query took the live app down twice in a day).
     *
     * `SELECT MAX(id), MIN(id) FROM mirror_log` looks free and is not: SQLite optimises MAX(id) or MIN(id)
     * alone into an index lookup, but asking for BOTH in one row defeats that and becomes a full scan
     * (EXPLAIN QUERY PLAN: "SCAN mirror_log"). With 8,588 entries in the log and this running once a minute,
     * Cloudflare's own figures were 8,588 rows read per run x 598 runs = 5,136,070 rows in 24 hours, against
     * a 5,000,000 free-plan limit — 102.7% of the daily allowance on ONE line, with an efficiency of 0.0001
     * (8,588 rows read to return two numbers). Every action then failed, which is how a coordinator's export
     * came back "Please try again".
     *
     * As two scalar subqueries the plan is "SEARCH mirror_log" twice: two index lookups, two rows read.
     *
     * The check itself is still needed — it is the 10 Oct stall fix, for a log whose ids were reused after
     * the table was emptied. */
    const m = await one(db, 'SELECT (SELECT MAX(id) FROM mirror_log) AS hi, (SELECT MIN(id) FROM mirror_log) AS lo');
    if (m && m.hi !== null && m.hi < pos) pos = m.lo - 1;
  }
  const log = byTbl.mirror_log ? await all(db, 'SELECT id, tbl, k1, k2 FROM mirror_log WHERE id > ? ORDER BY id LIMIT ?', pos, left) : [];
  if (log.length) {
    const groups = new Map();
    const add = (tbl, k1, k2) => { if (!MIRRORS[tbl] || !byTbl[tbl]) return; const g = groups.get(tbl) || new Map(); g.set(`${k1}\x1f${k2}`, [k1, k2]); groups.set(tbl, g); };
    for (const e of log) {
      add(e.tbl, e.k1, e.k2);
      if (e.tbl === 'attendance') add('drafts', e.k1, e.k2);          // the Drafts tab shows the devotee's own mark
    }
    for (const tbl of PRIORITY.filter(t => groups.has(t))) {
      const [fileKey, tab] = MIRRORS[tbl];
      const found = await copyKeys(db, byTbl[tbl], tab, tabCols(fileKey, tab), file(fileKey), [...groups.get(tbl).values()]);
      // a new or removed comment: its post's comment count on the Announcements tab, at once
      if (tbl === 'post_comments' && byTbl.announcements && !groups.has('announcements')) {
        const posts = [...new Set(found.map(c => c.ann_id).filter(x => x !== null && x !== undefined))];
        if (posts.length) await copyKeys(db, byTbl.announcements, 'Announcements', tabCols('access', 'Announcements'), file('access'), posts.map(id => [id, '']));
      }
    }
    left -= log.length;
  }

  // 2. whole copies, new log rows, reference lists
  for (const s of state) {
    if (left <= 0) break;
    const [fileKey, tab, how, order] = MIRRORS[s.tbl], cols = tabCols(fileKey, tab);
    if (how === 'keyed') {
      if (s.mode === 'build') left -= await copyWhole(db, s, tab, cols, file(fileKey), left);
    } else if (how === 'append') {
      const rows = await all(db, `SELECT * FROM ${s.tbl} WHERE id > ? ${order} LIMIT ?`, s.last_id, left + 1);
      const take = rows.slice(0, left);
      if (!take.length) continue;
      const f = file(fileKey);
      f.appends.push({ range: `'${tab}'!A1`, values: take.map(r => toSheetRow(cols, r)) });
      f.stmts.push(q(db, 'UPDATE mirror_state SET last_id = ?, synced_at = ? WHERE tbl = ?', take[take.length - 1].id, isoIst(new Date()), s.tbl));
      f.notes.push(`${s.tbl} ${take.length}${rows.length > left ? ' (continues)' : ''}`);
      left -= take.length;
    } else if (s.dirty) {
      // a reference list a release changed: rewritten in place from row 2, then anything below its end cleared
      const f = file(fileKey);
      const offset = s.last_id > 0 && s.gen === s.dirty ? s.last_id : 0;     // continue, or start again after a change
      const rows = await all(db, `SELECT * FROM ${s.tbl} ${order} LIMIT ? OFFSET ?`, left + 1, offset);
      const take = rows.slice(0, left), finished = rows.length <= left;
      if (take.length) f.writes.push({ tab, range: `'${tab}'!A${2 + offset}`, values: take.map(r => toSheetRow(cols, r)), lastRow: 1 + offset + take.length });
      if (finished) f.clears.push(`'${tab}'!A${offset + take.length + 2}:ZZ`);
      f.stmts.push(finished
        ? q(db, 'UPDATE mirror_state SET dirty = CASE WHEN dirty = ? THEN 0 ELSE dirty END, last_id = 0, gen = 0, synced_at = ? WHERE tbl = ?', s.dirty, isoIst(new Date()), s.tbl)
        : q(db, 'UPDATE mirror_state SET last_id = ?, gen = ?, synced_at = ? WHERE tbl = ?', offset + take.length, s.dirty, isoIst(new Date()), s.tbl));
      f.notes.push(`${s.tbl} ${take.length}${finished ? '' : ' (continues)'}`);
      left -= Math.max(1, take.length);
    }
  }

  // 3. write to Google; save the bookkeeping only for files Google accepted; move the log on only if all were
  let allOk = true;
  for (const [fileKey, f] of Object.entries(byFile)) {
    if (!f.writes.length && !f.clears.length && !f.appends.length && !f.stmts.length) continue;
    try {
      if (f.writes.length) {
        // Sheets refuses writes below a tab's last row: add rows first where a table has outgrown its tab
        const grid = await sheetGrid(env, FILES[fileKey]), need = {};
        for (const w of f.writes) need[w.tab] = Math.max(need[w.tab] || 0, w.lastRow);
        const grow = Object.entries(need).filter(([t, last]) => grid[t] && last > grid[t].rows).map(([t, last]) => ({ sheetId: grid[t].sheetId, add: last - grid[t].rows + 500 }));
        if (grow.length) await growTabs(env, FILES[fileKey], grow);
        await writeRanges(env, FILES[fileKey], f.writes.map(({ range, values }) => ({ range, values })));
      }
      if (f.clears.length) await clearRanges(env, FILES[fileKey], f.clears);
      for (const a of f.appends) await appendRows(env, FILES[fileKey], a.range, a.values);
      if (f.stmts.length) await db.batch(f.stmts);
      report.push(...f.notes);
    } catch (e) {
      allOk = false;
      report.push(`${fileKey} failed: ${e.message}`);
    }
  }
  if (log.length && allOk) await db.batch([q(db, "UPDATE mirror_state SET last_id = ?, synced_at = ? WHERE tbl = 'mirror_log'", log[log.length - 1].id, isoIst(new Date()))]);

  // 4a. every night at 02:01 IST the Announcements tab is recopied whole, so its like counts are at most a day old
  const n = istNow(now);
  if (n.hour === 2 && n.minute === 1 && byTbl.announcements?.mode === 'live')
    await db.batch([q(db, "UPDATE mirror_state SET mode = 'build', last_id = 0, rows = 0 WHERE tbl = 'announcements' AND mode = 'live'")]);
  // 4. trim copied log entries (see trimMirrorLog below — it also runs while the copy is PAUSED)
  if (!log.length && byTbl.mirror_log) {
    const n = await trimMirrorLog(db, pos, now);
    if (n) report.push(`log trimmed ${n}`);
  }
  return report;
}

/**
 * Delete log entries the copy has already finished with.
 *
 * SEPARATE FROM THE COPY, ON PURPOSE (15 Oct 2026). This used to live inside mirrorChanged(), which is the
 * function that SENDS to Google — so switching the Sheets copy off (decision of 13 Oct) also switched off the
 * cleaning up of rows the copy had already dealt with. The log then only ever grew: 8,616 finished entries
 * were still sitting there a day later, and a scan of them is what spent D1's entire daily read allowance and
 * took the app down twice.
 *
 * Removing finished rows has nothing to do with sending anything to Google. It is housekeeping on our own
 * table, so it belongs outside the switch and runs either way.
 *
 * Quiet nights only (IST Wed–Sat 2 AM: Cloudflare's daily limits run on UTC days, and those nights fall in the
 * week's lightest ones), TRIM_PER_RUN at a time, and the entry AT the position always stays — the log is never
 * emptied, so new ids keep rising past it and the id-reuse stall of 7–10 Oct cannot come back.
 *
 * @returns {Promise<number>} how many were removed
 */
export async function trimMirrorLog(db, pos = null, now = new Date()) {
  // the night check FIRST: on 6 nights in 7 this costs nothing at all, not even a read of mirror_state
  const t = istNow(now);
  if (!(t.hour === 2 && t.dow >= 3 && t.dow <= 6)) return 0;
  // the caller may already hold the position (mirrorChanged does); otherwise read it, by primary key
  if (pos === null) pos = (await one(db, "SELECT last_id FROM mirror_state WHERE tbl = 'mirror_log'"))?.last_id || 0;
  if (!pos) return 0;
  const r = await db.batch([q(db, 'DELETE FROM mirror_log WHERE id < MIN(?, (SELECT IFNULL(MIN(id), 0) + ? FROM mirror_log))', pos, LIMITS.MIRROR_TRIM_PER_RUN)]);
  return r[0]?.meta?.changes || 0;
}

/*
 * THE SWITCH THE TRIGGERS READ (C1, migration 0075, 27 Oct 2026).
 *
 * Every mirror trigger (112 of them, 28 tables) carries `WHEN … AND COPY_ON`, so while the copy is paused a change
 * writes NO mirror_log row. Paused since 13 Oct, those rows were a third of every row the app wrote (2,727 of 8,258
 * over the suite; 12 of 35 in a devotee's week) for a queue nobody drained. The cost of the guard is one read of
 * mirror_switch by its primary key per firing trigger and 0 rows written. (Dropping the triggers would cost 0 reads,
 * but switching back on would then need DDL run by hand, and a flag flipped without it would copy nothing new — a
 * silent skip. The WHEN cannot be forgotten: the schedule keeps the row equal to SHEETS_COPY, below.)
 *
 * RESUMING THE COPY IS "SWITCH ON, THEN A FULL RE-COPY", NEVER "DRAIN THE QUEUE".
 *   1. Set SHEETS_COPY = "on" in wrangler.toml and deploy. Nothing else.
 *   2. The next scheduled run calls syncCopySwitch(), which in ONE atomic batch:
 *        · turns mirror_switch on (from this statement on, every change is queued again);
 *        · puts every row-by-row ('keyed') table in 'build': copied whole, in rowid order, over its tab;
 *        · marks every reference list ('all') changed, so it is rewritten in place;
 *        · moves the queue position to the end of mirror_log: what was queued before the pause, or before 0075, is
 *          covered by the whole copies and is never replayed (it would only rewrite rows the copy rewrites anyway).
 *      The 'append' tabs (submissions, audit_log, run_log) carry on from their own last_id, as they always do; a log
 *      row erased by retention while paused (retention.js) is simply not there to copy.
 *   Because the switch and the 'build' marks change in the same batch, a change made after it is queued and a change
 *   made before it is in the whole copy: no row can be skipped. A failed sync is retried the next minute.
 * Switching off (SHEETS_COPY anything but "on") turns the row off at the next run; the queue then stops growing.
 */
export const COPY_ON = "(SELECT state FROM mirror_switch WHERE id = 1) = 'on'";

/** Keeps mirror_switch equal to SHEETS_COPY (one keyed read a run); on the way ON, starts the full re-copy. */
export async function syncCopySwitch(db, wantOn, now = new Date()) {
  const cur = await one(db, 'SELECT state FROM mirror_switch WHERE id = 1');
  const want = wantOn ? 'on' : 'off';
  if (!cur || cur.state === want) return '';
  const at = isoIst(now);
  if (want === 'off') {
    await db.batch([q(db, "UPDATE mirror_switch SET state = 'off', changed_at = ? WHERE id = 1", at)]);
    return 'switched off: changes are no longer queued';
  }
  const keyed = Object.keys(MIRRORS).filter(t => MIRRORS[t][2] === 'keyed'), lists = Object.keys(MIRRORS).filter(t => MIRRORS[t][2] === 'all');
  const marks = (l) => l.map(() => '?').join(', ');
  await db.batch([
    q(db, "UPDATE mirror_switch SET state = 'on', changed_at = ? WHERE id = 1", at),
    q(db, `UPDATE mirror_state SET mode = 'build', last_id = 0, rows = 0 WHERE tbl IN (${marks(keyed)})`, ...keyed),
    q(db, `UPDATE mirror_state SET dirty = dirty + 1, last_id = 0, gen = 0 WHERE tbl IN (${marks(lists)})`, ...lists),
    q(db, "UPDATE mirror_state SET last_id = (SELECT IFNULL(MAX(id), 0) FROM mirror_log), synced_at = ? WHERE tbl = 'mirror_log'", at)
  ]);
  return `switched on: ${keyed.length} tabs re-copied whole, ${lists.length} lists rewritten, the old queue skipped`;
}

/** How far behind the copy is (for the master's Settings and checks): log entries not yet copied. */
/**
 * How many changes are waiting to be copied.
 *
 * `cap` BOUNDS THE SCAN, and it matters more than it looks. The unbounded COUNT here, called once a minute
 * from the scheduled run, read about 24.8 million rows a day against D1's 5 million free-plan limit once
 * mirror_log had grown to 8,600 entries — and took the live app down twice on 14 Oct 2026. With a cap the
 * query stops after `cap` matching rows, so the cost is fixed however large the log becomes.
 *
 * The answer is then "at least cap", which is all a status line needs: nobody acts differently on 4,000
 * waiting rows than on 500. Callers that want the true number pass no cap and should be rare — the head's
 * Settings screen reads it hourly, not minutely.
 *
 * @param {number} [cap] stop counting at this many; omit for the exact number
 * @returns {Promise<number>} the count, or `cap` when there are at least that many
 */
export async function mirrorBacklog(db, cap = 0) {
  const limit = cap > 0 ? ` LIMIT ${Math.floor(cap)}` : '';
  const r = await one(db, `SELECT (SELECT last_id FROM mirror_state WHERE tbl = 'mirror_log') AS pos, (SELECT MAX(id) FROM mirror_log) AS hi,
                                  (SELECT COUNT(*) FROM (SELECT 1 FROM mirror_log WHERE id > (SELECT last_id FROM mirror_state WHERE tbl = 'mirror_log')${limit})) AS n`);
  if (!r) return 0;
  // ids reused below the position (see mirrorChanged): all of the log is waiting
  if (r.hi !== null && r.pos && r.hi < r.pos) return (await one(db, `SELECT COUNT(*) AS n FROM (SELECT 1 FROM mirror_log${limit})`))?.n || 0;
  return r.n;
}
