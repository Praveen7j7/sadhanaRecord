// Marking attendance: the coordinator's board marks, the head's override after the deadline, and declaring a
// week's class (held, cancelled, everyone present). Split out of coord.js on 13 October 2026 (audit F27 /
// roadmap 3.1); the code is unchanged, only its home.
import { apiError, invalid, isoIst, validYmd, cleanName } from './util.js';
import { q, one, all, audit, dirty, scopeBatches, setting } from './db.js';
// C4: a mark on a week already closed re-writes that batch-week's Analysis summary in the same batch
import { refreshClosed } from './analysis.js';
import { requireBatch } from './requests.js';
import { COLS, reasonOf, focusWeek, managed } from './staff.js';
import { boardRows, reopenOpen, expected } from './board.js';
import { validWeekId, windowOf, addDays, weekStart } from './weeks.js';
import { CLASS_KINDS, classWeekOf, classDefault, classView, markLevel, writeMark, attendanceOpens, classOpensFor, DAY_NAME } from './classweek.js';

/* ------------------------------------------------------------------------ */
/* Attendance                                                                */
/* ------------------------------------------------------------------------ */

const MARKS = ['P', 'A'];


/**
 * The coordinator marks Present / Absent for their batch, until the week's Monday 9 PM deadline; after it, only devotees
 * whose week the IYF head reopened, until the reopen's own deadline. `mark: null` clears it. One Activity line a save.
 */
export async function attendanceSet(d, ctx, req) {
  await requireBatch(ctx, d.batchId);
  const db = ctx.db, now = ctx.now(), batchId = String(d.batchId);
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  if (!Array.isArray(d.marks) || !d.marks.length) throw invalid({ path: 'marks', message: 'Mark at least one devotee.' });
  if (d.marks.length > 300) throw invalid({ path: 'marks', message: 'At most 300 marks in one save; the app sends a big batch in parts.' });
  // the batch's own class day, not Sunday for everyone (17 Oct 2026): a weekday class must be
  // markable on the day it is held
  const cls = await classOpensFor(db, batchId, d.weekId);
  if (now < cls.opens) throw apiError('FUTURE_DAY', `Attendance can be marked from the ${cls.name} class.`);
  const win = await windowOf(db, d.weekId), closed = now >= win.closes;
  const members = new Map((await boardRows(db, [batchId], d.weekId)).map(r => [r.login, r]));
  // the deadline is a master setting, so the refusal has to name the time that is actually set
  const closedMsg = `Attendance for this week closed at its ${win.words.deadlinePhrase}. Ask the master to change it.`;
  if (closed && !d.marks.some(m => reopenOpen(members.get(String(m?.login)), now))) throw apiError('WINDOW_CLOSED', closedMsg);
  const at = isoIst(now), stmts = [], def = classDefault(await classWeekOf(db, batchId, d.weekId));
  const done = await setting(db, 'deadline_done', '');            // read before any write is prepared (memoised)
  for (const [i, m] of d.marks.entries()) {
    if (!m || typeof m !== 'object' || !members.has(String(m.login))) throw invalid({ path: `marks.${i}.login`, message: 'Not a devotee of this batch that week.' });
    if (m.mark !== null && !MARKS.includes(m.mark)) throw invalid({ path: `marks.${i}.mark`, message: 'P, A or null.' });
    const mem = members.get(String(m.login));
    if (!expected(mem)) throw invalid({ path: `marks.${i}.login`, message: `${mem.name} is not active, so no attendance is taken.` });
    if (closed && !reopenOpen(mem, now)) throw invalid({ path: `marks.${i}.login`, message: `${mem.name}'s week is closed; only reopened weeks can still be marked.` });
    // the coordinator's level (over the group leader's and the devotee's); a master's correction stays above it
    stmts.push(writeMark(db, { level: 'coordinator', login: String(m.login), weekId: d.weekId, batchId, mark: m.mark || '', by: ctx.login, at, def, force: closed }));
  }
  const res = await db.batch([...stmts, ...refreshClosed(db, done, batchId, d.weekId, at),
    audit(db, ctx, 'attendance.set', batchId, batchId, null, markSummary(d.weekId, d.marks), '', req.requestId), dirty(db, 'attendance', 'audit_log')]);
  return { saved: res.slice(0, stmts.length).reduce((s, r) => s + (r.meta.changes || 0), 0) };
}

/** The Activity line of an attendance save: the week and how many were marked Present, Absent or cleared. */
export function markSummary(weekId, marks) {
  const n = (v) => marks.filter(m => (m.mark || null) === v).length;
  return { weekId, marked: marks.length, present: n('P'), absent: n('A'), cleared: n(null) };
}

/** Master: attendance after the deadline (the week is locked), with a reason. */
export async function attendanceOverride(d, ctx, req) {
  const reason = reasonOf(d.reason), db = ctx.db;
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  if (d.mark !== null && !MARKS.includes(d.mark)) throw invalid({ path: 'mark', message: 'P, A or null.' });
  const { a } = await managed(ctx, d.login);
  const row = (await boardRows(db, await scopeBatches(db, ctx), d.weekId)).find(r => r.login === a.login);
  if (!row) throw apiError('NOT_FOUND', `${a.name} was not in a batch that week.`);
  const before = await one(db, 'SELECT master_mark, coordinator_mark, leader_mark, devotee_mark, mark_used FROM attendance WHERE login = ? AND week_id = ?', a.login, d.weekId);
  const def = classDefault(await classWeekOf(db, row.batchId, d.weekId)), done = await setting(db, 'deadline_done', '');
  await db.batch([writeMark(db, { level: 'master', login: a.login, weekId: d.weekId, batchId: row.batchId, mark: d.mark || '', by: ctx.login, at: isoIst(ctx.now()), reason, def, force: true }),
    // after the deadline this is the usual case: the closed week's summary follows the new mark (C4)
    ...refreshClosed(db, done, row.batchId, d.weekId, isoIst(ctx.now())),
    audit(db, ctx, 'attendance.override', a.login, row.batchId, before, { weekId: d.weekId, mark: d.mark }, reason, req.requestId),
    dirty(db, 'attendance', 'audit_log')]);
  const now = await one(db, 'SELECT devotee_mark, leader_mark, coordinator_mark, master_mark, mark_used FROM attendance WHERE login = ? AND week_id = ?', a.login, d.weekId);
  return { devotee: now.devotee_mark || null, leader: now.leader_mark || null, coordinator: now.coordinator_mark || null, master: now.master_mark || null, used: now.mark_used || null };
}

/**
 * A week with no regular class (holiday, festival or another reason), or back to a regular class (kind REGULAR).
 * everyonePresent: true → everyone in the batch is Present; false → only those the coordinator marks Present
 * (e.g. those who came to the festival), everyone else Absent. A mark for one person still wins. The batch
 * coordinator until the week's Monday 9 PM deadline; the master any time, after the deadline with a reason.
 */
export async function weeksSetClass(d, ctx, req) {
  await requireBatch(ctx, d.batchId);
  const db = ctx.db, now = ctx.now(), at = isoIst(now), batchId = String(d.batchId);
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  if (weekStart(d.weekId) - now > 14 * 86400000) throw invalid({ path: 'weekId', message: 'At most two weeks ahead.' });
  const win = await windowOf(db, d.weekId), closed = now >= win.closes;
  if (closed && !ctx.scopes.master) throw apiError('WINDOW_CLOSED', `This week closed at its ${win.words.deadlinePhrase}. Ask the master to change it.`);
  const reason = closed ? reasonOf(d.reason) : cleanName(d.reason || '');
  const regular = d.kind === 'REGULAR';
  if (!regular && !CLASS_KINDS.includes(d.kind)) throw invalid({ path: 'kind', message: 'Holiday, festival, other, or a regular class.' });
  const note = cleanName(d.note || '');
  if (!regular && (note.length < 2 || note.length > 80)) throw invalid({ path: 'note', message: 'Say why there is no class (2–80 characters), e.g. Diwali.' });
  if (!regular && typeof d.everyonePresent !== 'boolean') throw invalid({ path: 'everyonePresent', message: 'Choose: everyone present, or only those you mark.' });
  const before = await classWeekOf(db, batchId, d.weekId), mode = d.everyonePresent ? 'ALL_PRESENT' : 'MARKED';
  const def = regular ? '' : (mode === 'ALL_PRESENT' ? 'P' : 'A'), lock = closed ? '1 = 1' : 'locked = 0';
  const members = (await boardRows(db, [batchId], d.weekId)).map(r => r.login);
  const done = await setting(db, 'deadline_done', '');            // read before any write is prepared (memoised)
  const stmts = [regular
    ? q(db, 'DELETE FROM class_weeks WHERE batch_id = ? AND week_id = ?', batchId, d.weekId)
    : q(db, `INSERT INTO class_weeks (batch_id, week_id, kind, note, mode, by, at) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(batch_id, week_id) DO UPDATE SET kind = excluded.kind, note = excluded.note, mode = excluded.mode, by = excluded.by, at = excluded.at`,
        batchId, d.weekId, d.kind, note, mode, ctx.login, at)];
  // every member's mark_used follows the new setting (a head's, coordinator's or group leader's mark for them still wins)
  for (const login of members) {
    if (def) stmts.push(q(db, `INSERT OR IGNORE INTO attendance (login, week_id, batch_id, mark_used, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?)`, login, d.weekId, batchId, def, ctx.login, at));
    stmts.push(q(db, `UPDATE attendance SET mark_used = COALESCE(NULLIF(master_mark, ''), NULLIF(coordinator_mark, ''), NULLIF(leader_mark, ''), NULLIF(?, ''), NULLIF(devotee_mark, ''), '')
                      WHERE login = ? AND week_id = ? AND ${lock}`, def, login, d.weekId));
  }
  await db.batch([...stmts, ...refreshClosed(db, done, batchId, d.weekId, at),
    audit(db, ctx, 'weeks.setClass', batchId, batchId, classView(before), regular ? null : { weekId: d.weekId, kind: d.kind, note, mode }, reason, req.requestId),
    dirty(db, 'class_weeks', 'attendance', 'audit_log')]);
  return { weekId: d.weekId, classWeek: classView(await classWeekOf(db, batchId, d.weekId)) };
}
