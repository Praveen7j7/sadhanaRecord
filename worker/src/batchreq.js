// Asking to start a batch (Phase 23; the head, 27 Oct 2026: "A new VL-2, VL-3 or any training batch, say ETP, can be
// started by the admin, and the coordinators can even initiate a request, and the approval for the batch beginning the
// admin gives").
//
//   batchReq.create    a coordinator asks: level (VL2 · VL3 · ETP), the proposed start (today or later), a training's
//                      end, a note
//   batchReq.list      a coordinator: their own requests, every state; the head: every request waiting, and the latest
//                      decided
//   batchReq.withdraw  the requester, while it waits
//   batchReq.decide    the head declines, with a note
//
// APPROVING is not here. The head approves by creating the batch in Admin › Batch setup's own form, pre-filled from the
// request: batches.create with `fromRequest` (admin.js). One set of rules for every new batch — the number, the name,
// the start never in the future, a training's end after its start — and the request is marked STARTED in the same
// atomic write as the batch it became. A second "approve" path here would have been a second copy of those rules.
//
// Why a future start is not created by a timer: "the day when i defined the batch window from that day week wise card
// inputs will be taken" (the head, 18 Oct 2026) — a batch starts the day it is defined. A request may PROPOSE a later
// day; the head creates it on that day (or starts it sooner, by choosing today). Nothing starts by itself, as nothing
// closes by itself (ADR 0009).
import { apiError, invalid, isoIst, cleanName } from './util.js';
import { q, one, all, audit, dirty } from './db.js';
import { trainingEndProblem } from './admin.js';

/** The levels a coordinator may ask for: the numbered intakes and the trainings the app runs (admin.js VEDIC). */
export const ASKABLE = { VL2: 'Vedic Level 2', VL3: 'Vedic Level 3', ETP: 'ETP' };
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const STATES = { WAITING: 'Waiting', STARTED: 'Started', DECLINED: 'Declined', WITHDRAWN: 'Withdrawn' };

const VIEW_SQL = `SELECT r.*, a.name AS by_name, d.name AS decided_name, b.name AS batch_name
                    FROM batch_requests r LEFT JOIN accounts a ON a.login = r.requested_by
                    LEFT JOIN accounts d ON d.login = r.decided_by LEFT JOIN batches b ON b.batch_id = r.batch_id`;
const view = (r, ctx) => ({
  id: r.id, level: r.level, levelName: ASKABLE[r.level] || r.level, startsOn: r.starts_on, endsOn: r.ends_on || '', note: r.note || '',
  by: r.requested_by, byName: r.by_name || r.requested_by, at: r.requested_at,
  state: r.state, stateName: STATES[r.state] || r.state,
  decidedBy: r.decided_by || '', decidedByName: r.decided_by ? (r.decided_name || r.decided_by) : '', decidedAt: r.decided_at || '',
  decisionNote: r.decision_note || '', batchId: r.batch_id || '', batchName: r.batch_name || '',
  mine: r.requested_by === ctx.login
});

export async function batchReqCreate(d, ctx, req) {
  const db = ctx.db, today = isoIst(ctx.now()).slice(0, 10), problems = [];
  // the coordinators ask (the head may too — though they would simply start it in Batch setup)
  const level = String(d.level || '').toUpperCase(), startsOn = String(d.startsOn || '').trim(), endsOn = String(d.endsOn ?? '').trim();
  const note = cleanName(d.note || '');
  if (!ASKABLE[level]) problems.push({ path: 'level', message: 'Choose VL-2, VL-3 or ETP.' });
  if (!YMD.test(startsOn) || isNaN(Date.parse(startsOn))) problems.push({ path: 'startsOn', message: 'A date, as 2026-11-02.' });
  else if (startsOn < today) problems.push({ path: 'startsOn', message: 'The start is today or later.' });
  // the same end-date rule as batches.create: only a training has one, and it comes after the start
  const endProblem = ASKABLE[level] ? trainingEndProblem(level === 'ETP', endsOn, startsOn, true) : null;
  if (endProblem) problems.push(endProblem);
  if (note.length > 300) problems.push({ path: 'note', message: 'At most 300 characters.' });
  if (problems.length) throw invalid(problems);
  // one waiting request of a level per coordinator: a second tap, or the same ask twice, is not a second batch
  if (await one(db, "SELECT 1 AS x FROM batch_requests WHERE requested_by = ? AND level = ? AND state = 'WAITING'", ctx.login, level)) {
    throw apiError('CONFLICT', `You have already asked for a ${ASKABLE[level]} batch; it is waiting for the IYF head.`);
  }
  const at = isoIst(ctx.now());
  const res = await db.batch([
    q(db, `INSERT INTO batch_requests (level, starts_on, ends_on, note, requested_by, requested_at) VALUES (?, ?, ?, ?, ?, ?)`,
      level, startsOn, level === 'ETP' ? endsOn : '', note, ctx.login, at),
    audit(db, ctx, 'batchReq.create', level, '', null, { level, startsOn, ...(level === 'ETP' ? { endsOn } : {}) }, note, req.requestId),
    dirty(db, 'audit_log')]);
  const id = res[0]?.meta?.last_row_id;
  return view(await one(db, `${VIEW_SQL} WHERE r.id = ?`, id), ctx);
}

/** Their own (coordinator), or every waiting one and the latest 20 decided (the head). */
export async function batchReqList(d, ctx) {
  const db = ctx.db;
  const rows = ctx.scopes.master
    ? [...await all(db, `${VIEW_SQL} WHERE r.state = 'WAITING' ORDER BY r.requested_at`),
       ...await all(db, `${VIEW_SQL} WHERE r.state <> 'WAITING' ORDER BY r.id DESC LIMIT 20`)]
    : await all(db, `${VIEW_SQL} WHERE r.requested_by = ? ORDER BY r.requested_at DESC LIMIT 30`, ctx.login);
  const requests = rows.map(r => view(r, ctx));
  return { requests, waiting: requests.filter(r => r.state === 'WAITING').length };
}

/** The request this caller may act on: their own (withdraw) or any (the head deciding). */
async function requestFor(ctx, id, own) {
  const r = Number.isInteger(id) ? await one(ctx.db, 'SELECT * FROM batch_requests WHERE id = ?', id) : null;
  // somebody else's request answers as if it did not exist: no coordinator learns of another's
  if (!r || (own && r.requested_by !== ctx.login)) throw apiError('NOT_FOUND', 'No such request.');
  if (r.state !== 'WAITING') throw apiError('CONFLICT', `That request was already ${STATES[r.state].toLowerCase()}.`);
  return r;
}

export async function batchReqWithdraw(d, ctx, req) {
  const db = ctx.db, r = await requestFor(ctx, d.id, true), at = isoIst(ctx.now());
  await db.batch([
    q(db, "UPDATE batch_requests SET state = 'WITHDRAWN', decided_by = ?, decided_at = ? WHERE id = ? AND state = 'WAITING'", ctx.login, at, r.id),
    audit(db, ctx, 'batchReq.withdraw', r.level, '', null, { id: r.id, level: r.level }, '', req.requestId),
    dirty(db, 'audit_log')]);
  return view(await one(db, `${VIEW_SQL} WHERE r.id = ?`, r.id), ctx);
}

/** The head declines, with a note the requester reads. (Approving is creating the batch: batches.create fromRequest.) */
export async function batchReqDecide(d, ctx, req) {
  const db = ctx.db;
  if (d.decision !== 'decline') throw invalid({ path: 'decision', message: 'Approve by creating the batch in Batch setup; here a request is declined.' });
  const note = cleanName(d.note || '');
  if (note.length < 2) throw invalid({ path: 'note', message: 'Say why, for the coordinator who asked.' });
  if (note.length > 300) throw invalid({ path: 'note', message: 'At most 300 characters.' });
  const r = await requestFor(ctx, d.id, false), at = isoIst(ctx.now());
  await db.batch([
    q(db, "UPDATE batch_requests SET state = 'DECLINED', decided_by = ?, decided_at = ?, decision_note = ? WHERE id = ? AND state = 'WAITING'", ctx.login, at, note, r.id),
    audit(db, ctx, 'batchReq.decline', r.requested_by, '', null, { id: r.id, level: r.level }, note, req.requestId),
    dirty(db, 'audit_log')]);
  return view(await one(db, `${VIEW_SQL} WHERE r.id = ?`, r.id), ctx);
}

/**
 * For batches.create: the WAITING request a new batch fulfils, checked against the batch being made (its level), and the
 * statement that marks it STARTED in the same write as the batch. Throws if it is not waiting or does not match.
 */
export async function fulfilling(db, ctx, id, level, batchId) {
  const r = Number.isInteger(id) ? await one(db, 'SELECT * FROM batch_requests WHERE id = ?', id) : null;
  if (!r) throw invalid({ path: 'fromRequest', message: 'No such request.' });
  if (r.state !== 'WAITING') throw apiError('CONFLICT', `That request was already ${STATES[r.state].toLowerCase()}.`);
  if (r.level !== level) throw invalid({ path: 'batchId', message: `The request was for a ${ASKABLE[r.level]} batch.` });
  const at = isoIst(ctx.now());
  return { r, stmts: [
    q(db, "UPDATE batch_requests SET state = 'STARTED', decided_by = ?, decided_at = ?, batch_id = ? WHERE id = ? AND state = 'WAITING'", ctx.login, at, batchId, r.id),
    audit(db, ctx, 'batchReq.approve', r.requested_by, batchId, null, { id: r.id, level: r.level, batchId }, '', '')] };
}
