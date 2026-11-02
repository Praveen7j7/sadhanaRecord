// Reopening a week a devotee missed: a coordinator asks, the IYF head decides. Split out of coord.js on
// 13 October 2026 (audit F27 / roadmap 3.1); the code is unchanged, only its home.
import { apiError, invalid, isoIst, parseIso, normPhone } from './util.js';
import { q, one, all, audit, dirty, scopeBatches } from './db.js';
import { reasonOf, managed } from './staff.js';
import { validWeekId, windowOf } from './weeks.js';

/* ------------------------------------------------------------------------ */
/* Reopening a missed week                                                   */
/* ------------------------------------------------------------------------ */

export async function reopenRequest(d, ctx, req) {
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  const reason = reasonOf(d.reason), db = ctx.db;
  const { a, batchId } = await managed(ctx, d.login);
  if (!(await one(db, 'SELECT 1 FROM missed_weeks WHERE login = ? AND week_id = ?', a.login, String(d.weekId)))) throw apiError('CONFLICT', 'Only a missed week can be reopened.');
  await db.batch([
    q(db, `INSERT INTO reopen_requests (login, week_id, batch_id, reason, by, at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(login, week_id) DO UPDATE SET reason = excluded.reason, by = excluded.by, at = excluded.at, state = 'PENDING', decided_by = '', decided_at = ''`,
      a.login, d.weekId, batchId, reason, ctx.login, isoIst(ctx.now())),
    audit(db, ctx, 'reopen.request', a.login, batchId, null, { weekId: d.weekId }, reason, req.requestId), dirty(db, 'reopen_requests', 'audit_log')]);
  return {};
}

/** Pending reopen requests: every batch for the master, own batches for a coordinator. */
export async function reopenList(d, ctx) {
  const batches = await scopeBatches(ctx.db, ctx);
  if (!batches.length) return { requests: [] };
  return { requests: (await all(ctx.db, `SELECT r.login, a.name, r.week_id, r.batch_id, r.reason, r.by, r.at FROM reopen_requests r LEFT JOIN accounts a ON a.login = r.login
                                         WHERE r.state = 'PENDING' AND r.batch_id IN (${batches.map(() => '?').join(',')}) ORDER BY r.at`, ...batches)).map(r => ({ login: r.login, name: r.name || r.login, weekId: r.week_id, batchId: r.batch_id, reason: r.reason, by: r.by, at: r.at })) };
}

/** Master: a MISSED week becomes REOPENED and empty until `openUntil` — any time ahead, the head's call. A submitted week is never changed. */
export async function weeksReopen(d, ctx, req) {
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  const reason = reasonOf(d.reason), db = ctx.db, now = ctx.now();
  const { a, batchId } = await managed(ctx, d.login);
  if (a.status !== 'ACTIVE') throw apiError('CONFLICT', `${a.name} is not active, so they could not fill it.`);
  /*
   * How long the week stays open is the head's to choose, with NO CAP (the head, 16 Oct 2026).
   *
   * It used to be at most 14 days. That was a guess, and it was the wrong one: a devotee away for a
   * month, or a batch whose records are being put right long afterwards, needs a window the head
   * sets — and being told "within the next 14 days" by their own app helps nobody. The limit belongs
   * at the coordinator's level, where it still is: a coordinator ASKS (reopen.request) and the head
   * decides.
   *
   * Still refused, because neither is about time:
   *   · a SUBMITTED week — its scores were worked out at submit and written down (ADR 0004);
   *     reopening it would change reports that have already been read.
   *   · a week that was never MISSED — reopening empties the draft, so this would delete work
   *     somebody is in the middle of.
   */
  const until = parseIso(d.openUntil);
  if (!until || until <= now) throw invalid({ path: 'openUntil', message: 'Choose a time in the future.' });
  if (await one(db, 'SELECT 1 FROM submissions WHERE login = ? AND week_id = ?', a.login, String(d.weekId))) throw apiError('ALREADY_SUBMITTED', 'That week was submitted; it is never changed.');
  if (!(await one(db, 'SELECT 1 FROM missed_weeks WHERE login = ? AND week_id = ?', a.login, String(d.weekId)))) throw apiError('CONFLICT', 'Only a missed week can be reopened.');
  const at = isoIst(now);
  await db.batch([
    q(db, `INSERT INTO reopens (login, week_id, reason, open_until, by, at, state) VALUES (?, ?, ?, ?, ?, ?, 'OPEN')
           ON CONFLICT(login, week_id) DO UPDATE SET reason = excluded.reason, open_until = excluded.open_until, by = excluded.by, at = excluded.at, state = 'OPEN'`,
      a.login, d.weekId, reason, isoIst(until), ctx.login, at),
    q(db, 'DELETE FROM drafts WHERE login = ? AND week_id = ?', a.login, d.weekId),
    q(db, "UPDATE reopen_requests SET state = 'DONE', decided_by = ?, decided_at = ? WHERE login = ? AND week_id = ? AND state = 'PENDING'", ctx.login, at, a.login, d.weekId),
    audit(db, ctx, 'weeks.reopen', a.login, batchId, { status: 'MISSED' }, { weekId: d.weekId, openUntil: isoIst(until) }, reason, req.requestId),
    dirty(db, 'reopens', 'reopen_requests', 'audit_log')]);
  return { openUntil: isoIst(until) };
}

export async function reopenReject(d, ctx, req) {
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  const reason = reasonOf(d.reason), db = ctx.db, login = normPhone(d.login);
  const r = await one(db, "SELECT * FROM reopen_requests WHERE login = ? AND week_id = ? AND state = 'PENDING'", login, String(d.weekId));
  if (!r) throw apiError('NOT_FOUND', 'No such request.');
  await db.batch([q(db, "UPDATE reopen_requests SET state = 'REJECTED', decided_by = ?, decided_at = ? WHERE login = ? AND week_id = ?", ctx.login, isoIst(ctx.now()), login, d.weekId),
    audit(db, ctx, 'reopen.reject', login, r.batch_id, null, { weekId: d.weekId }, reason, req.requestId), dirty(db, 'reopen_requests', 'audit_log')]);
  return {};
}
