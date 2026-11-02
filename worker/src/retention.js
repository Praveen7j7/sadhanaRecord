// Logs are kept for a set time, then erased (Phase 9, item 11; the head, 9 Oct 2026): 6 months by default, 3 · 6 · 12 ·
// 24 in Settings. Which: the Activity log (audit_log), the technical log of slow / refused calls (run_log) and finished
// notification jobs (push_jobs). Never sadhana, submissions, attendance, accounts or announcements.
//   · at night (01:00–02:00 IST, away from the 9–11 PM rush), in chunks of CHUNK rows a table, a few runs a night — so a
//     shorter setting catches up over some nights and the free plan's daily writes are never at risk
//   · bounded reads: a log is only ever appended, so its oldest rows are its lowest ids; the oldest row is looked at
//     first (one row by its primary key) and nothing more is read when it is still inside the period; no index needed
//   · while the Sheets copy is ON, a row not copied to Sheets yet is never erased (mirror_state.last_id). While it is
//     PAUSED (SHEETS_COPY off, since 13 Oct 2026) the period alone decides (G1, 27 Oct 2026): the copy position froze
//     at the pause, so the old rule erased nothing and the logs grew without end; and nothing will copy those rows
//     later — switching the copy back on re-copies the tabs from where they are (mirror.js › syncCopySwitch), so a
//     row older than the period is one the head has said need not be kept, copied or not
//   · the Sheets copy is trimmed too (the head's answer, 9 Oct 2026 — the one agreed exception to "Sheets changes are
//     additive", for log rows only): the oldest rows of the AuditLog and RunLog tabs, from the top, once a night. The
//     tabs and their columns stay. Deleting from the top keeps every later row in the same order, so the copy's appends
//     and a deletion's row rewrites (erase.js, which finds a row near 1 + id − gaps) still line up.
import { q, one, run, setting } from './db.js';
import { FREE, LIMITS } from './limits.js';
import { isoIst } from './util.js';
import { SCHEMA } from '../../setup/schema.mjs';
import FILES from '../../setup/files.json' with { type: 'json' };
import { sheetValues, sheetGrid, sheetRequests } from './google.js';

export const RETENTION_MONTHS = [3, 6, 12, 24];
export const DEFAULT_MONTHS = 6;
export const CHUNK = FREE.RETENTION_CHUNK;     // the free-plan number; runs read LIMITS (limits.js)
const LOGS = [['audit_log', 'AuditLog'], ['run_log', 'RunLog']];

export async function retentionMonths(db) {
  const n = Number(await setting(db, 'log_retention_months', String(DEFAULT_MONTHS)));
  return RETENTION_MONTHS.includes(n) ? n : DEFAULT_MONTHS;
}
/** The first moment kept: `months` calendar months before `now`, in Indian time. */
export function cutoffOf(now, months) {
  const ist = new Date(now.getTime() + 5.5 * 3600e3);
  const back = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - months, ist.getUTCDate(), ist.getUTCHours(), ist.getUTCMinutes()));
  // the day may not exist in that month (31 Aug − 6 months): Date.UTC rolls it over, which keeps a day or two more, never less
  return isoIst(new Date(back.getTime() - 5.5 * 3600e3));
}

/**
 * One night run's share: at most CHUNK rows of each log older than the period. Returns a short report or ''.
 * `copyOn`: the Sheets copy is switched on (index.js passes SHEETS_COPY). Anything but `false` keeps the rule that an
 * uncopied row is never erased, so a caller that does not say is never the one that loses a row.
 */
export async function runRetention(db, now = new Date(), copyOn = true) {
  const months = await retentionMonths(db), cutoff = cutoffOf(now, months), out = [];
  for (const [tbl] of LOGS) {
    const first = await one(db, `SELECT id, at FROM ${tbl} ORDER BY id LIMIT 1`);
    if (!first || first.at >= cutoff) continue;
    // paused: no copy position to respect (the same statement, bounded by the highest id instead: one row, by key)
    const upTo = copyOn === false
      ? (await one(db, `SELECT MAX(id) AS id FROM ${tbl}`))?.id ?? 0
      : (await one(db, 'SELECT last_id FROM mirror_state WHERE tbl = ?', tbl))?.last_id ?? 0;
    const r = await run(db, `DELETE FROM ${tbl} WHERE id IN (SELECT id FROM ${tbl} WHERE id <= ? ORDER BY id LIMIT ?) AND at < ?`, upTo, LIMITS.RETENTION_CHUNK, cutoff);
    if (r.meta.changes) out.push(`${tbl} ${r.meta.changes}`);
  }
  // finished notification jobs (their reach goes with them)
  const job = await one(db, 'SELECT id, created_at FROM push_jobs ORDER BY id LIMIT 1');
  if (job && job.created_at < cutoff) {
    const r = await run(db, "DELETE FROM push_jobs WHERE id IN (SELECT id FROM push_jobs ORDER BY id LIMIT ?) AND state = 'DONE' AND created_at < ?", LIMITS.RETENTION_CHUNK, cutoff);
    if (r.meta.changes) out.push(`push_jobs ${r.meta.changes}`);
  }
  if (!out.length) return '';
  const note = `logs kept ${months} months (from ${cutoff.slice(0, 10)}): erased ${out.join(', ')}`;
  // noted in the technical log (the head's Activity › Technical log)
  await run(db, "INSERT INTO run_log (at, action, ms, ok, error_code, detail, app_build) VALUES (?, 'retention', 0, 1, '', ?, '')", isoIst(now), note);
  return note;
}

/** The Sheets copy: the oldest rows of each log tab older than the period, at most SHEET_CHUNK a tab a night. */
export async function trimSheetLogs(env, db, now = new Date()) {
  if (!env.GOOGLE_SA_KEY) return '';
  const months = await retentionMonths(db), cutoffMs = Date.parse(cutoffOf(now, months)), id = FILES.access, out = [];
  let grid = null;
  for (const [, tab] of LOGS) {
    const col = SCHEMA.access.tabs[tab].findIndex(c => c[0] === 'at');
    if (col < 0) continue;
    const L = String.fromCharCode(65 + col);
    const cells = await sheetValues(env, id, `'${tab}'!${L}2:${L}${1 + LIMITS.RETENTION_SHEET_CHUNK}`);
    // the leading rows older than the period (a row whose time can't be read stops the count: nothing is guessed)
    let k = 0;
    for (const r of cells) { const t = Date.parse(String(r[0] ?? '')); if (!(t < cutoffMs)) break; k++; }
    if (!k) continue;
    grid ||= await sheetGrid(env, id);
    if (!grid[tab]) continue;
    await sheetRequests(env, id, [{ deleteDimension: { range: { sheetId: grid[tab].sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + k } } }]);
    out.push(`${tab} ${k}`);
  }
  return out.length ? `sheets trimmed: ${out.join(', ')}` : '';
}
