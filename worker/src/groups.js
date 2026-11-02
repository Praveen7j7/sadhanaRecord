// Group leaders (design decision 41, the head 3 Oct 2026). A group leader is a student devotee of a batch, appointed by
// that batch's coordinator (or the IYF head). Each leads one group of devotees of the same LEVEL — every batch with the
// same batches.level is one pool (SPS, SPS Group 2 and SPS Online; the head, 3 Oct evening) — and a devotee is in at most
// one group (memberships.leader_login). The leader does two things: marks the Sunday class attendance of the group, and
// follows each member's sadhana for the week (and calls them). Coordinators and the head see and change every group.
import { apiError, invalid, isoIst, mondayOf, normPhone } from './util.js';
import { q, one, all, account, currentMembership, audit, dirty, scopeBatches, batchesAll } from './db.js';
import { requireBatch } from './requests.js';
import { boardRows, focusWeek, reopenOpen, markSummary } from './coord.js';
import { validWeekId, windowOf } from './weeks.js';
import { classWeekOf, classWeeksFor, classDefault, classView, writeMark, attendanceOpens, classOpensFor } from './classweek.js';

const MARKS = ['P', 'A'];
const active = r => r.membership === 'ACTIVE' && r.accountStatus === 'ACTIVE';
const memberView = r => ({
  login: r.login, name: r.name, batchId: r.batchId, iyfId: r.iyfId, phone: r.login, whatsapp: r.whatsapp || r.login, hasPhoto: r.hasPhoto,
  active: active(r), status: r.status, daysFilled: r.daysFilled, days: r.days, submittedAt: r.submittedAt, overall: r.overall, attendance: r.attendance,
  reopenUntil: r.reopenUntil
});

/** The batches one group can draw from: every batch of the same level as `batchId` (SPS, SPS2, SPSO → all three). */
async function levelBatches(db, batchId) {
  /* From the batch list every call already holds (scopesOf reads it into the call's memory), not two more round trips
   * one after the other (22 Oct 2026, G7). The same answer as the SQL it replaces — `level = ?` then ORDER BY batch_id —
   * including SQL's rule that a NULL level equals nothing, so a batch with no level has an empty pool. */
  const list = await batchesAll(db), id = String(batchId), b = list.find(x => x.batch_id === id);
  if (!b) return [id];
  if (b.level === null || b.level === undefined) return [];
  return list.filter(x => x.level === b.level).map(x => x.batch_id).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
}

/** The caller's group (a group leader): the leader row, or FORBIDDEN. */
async function myGroup(ctx) {
  const l = await one(ctx.db, 'SELECT * FROM leaders WHERE login = ?', ctx.login);
  if (!l) throw apiError('FORBIDDEN', 'You are not a group leader.');
  return l;
}

/** group.list: the leader's group for a week (default: the focus week), with each member's status, attendance and phone. */
export async function groupList(d, ctx) {
  const l = await myGroup(ctx), db = ctx.db;
  const weekId = d.weekId === undefined ? await focusWeek(db, ctx.now()) : String(d.weekId);
  if (!validWeekId(weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  const rows = (await boardRows(db, await levelBatches(db, l.batch_id), weekId)).filter(r => r.leaderLogin === ctx.login && r.login !== ctx.login);
  const win = await windowOf(db, weekId), opens = (await classOpensFor(db, l.batch_id, weekId)).opens, now = ctx.now();
  return { weekId, batchId: l.batch_id, closesAt: isoIst(win.closes), attendanceOpensAt: isoIst(opens), attendanceOpen: now >= opens && now < win.closes,
           classWeek: classView(await classWeekOf(db, l.batch_id, weekId)), members: rows.map(memberView) };
}

/** group.mark: the leader marks Present / Absent (null clears) for members of their group, Sunday → Monday 9 PM (a
 *  member whose week the IYF head reopened: until the reopen's deadline). One Activity line a save. */
export async function groupMark(d, ctx, req) {
  const l = await myGroup(ctx), db = ctx.db, now = ctx.now();
  if (!validWeekId(d.weekId)) throw invalid({ path: 'weekId', message: 'Not a week.' });
  if (!Array.isArray(d.marks) || !d.marks.length) throw invalid({ path: 'marks', message: 'Mark at least one devotee.' });
  if (d.marks.length > 300) throw invalid({ path: 'marks', message: 'At most 300 marks in one save.' });
  const cls = await classOpensFor(db, l.batch_id, d.weekId);
  if (now < cls.opens) throw apiError('FUTURE_DAY', `Attendance can be marked from the ${cls.name} class.`);
  const win2 = await windowOf(db, d.weekId), closed = now >= win2.closes;
  const fam = await levelBatches(db, l.batch_id), cws = await classWeeksFor(db, fam, d.weekId);
  const members = new Map((await boardRows(db, fam, d.weekId)).filter(r => r.leaderLogin === ctx.login && r.login !== ctx.login).map(r => [r.login, r]));
  if (closed && !d.marks.some(m => reopenOpen(members.get(String(m?.login)), now))) throw apiError('WINDOW_CLOSED', `Attendance for this week closed at its ${win2.words.deadlinePhrase}. Ask your coordinator.`);
  const at = isoIst(now), stmts = [];
  for (const [i, m] of d.marks.entries()) {
    const mem = m && members.get(String(m.login));
    if (!mem) throw invalid({ path: `marks.${i}.login`, message: 'Not in your group that week.' });
    if (m.mark !== null && !MARKS.includes(m.mark)) throw invalid({ path: `marks.${i}.mark`, message: 'P, A or null.' });
    if (!active(mem)) throw invalid({ path: `marks.${i}.login`, message: `${mem.name} is not active, so no attendance is taken.` });
    if (closed && !reopenOpen(mem, now)) throw invalid({ path: `marks.${i}.login`, message: `${mem.name}'s week is closed; only reopened weeks can still be marked.` });
    // each member's own batch: its attendance row and its no-class week
    stmts.push(writeMark(db, { level: 'leader', login: mem.login, weekId: d.weekId, batchId: mem.batchId, mark: m.mark || '', by: ctx.login, at, def: classDefault(cws[mem.batchId]), force: closed }));
  }
  const res = await db.batch([...stmts, audit(db, ctx, 'group.mark', l.batch_id, l.batch_id, null, markSummary(d.weekId, d.marks), '', req.requestId), dirty(db, 'attendance', 'audit_log')]);
  return { saved: res.slice(0, -2).reduce((s, r) => s + (r.meta.changes || 0), 0) };
}

/* ---------------------------------------------------------------------------------------------------------------- */
/* Coordinators and the IYF head: appoint group leaders and assign devotees                                          */
/* ---------------------------------------------------------------------------------------------------------------- */

/**
 * leaders.list: every group of a batch (leader, members) and the active devotees not in any group, as they are now
 * (this week's memberships: someone who joined today shows, though the board still shows last week until Monday 9 PM).
 */
export async function leadersList(d, ctx) {
  await requireBatch(ctx, d.batchId);
  const db = ctx.db, batchId = String(d.batchId), weekId = mondayOf(ctx.now());
  // the level's batches the caller looks after (a coordinator of SPS only sees SPS's devotees; one of all three, all)
  const mine = new Set(await scopeBatches(db, ctx)), fam = (await levelBatches(db, batchId)).filter(b => mine.has(b));
  const rows = await boardRows(db, fam, weekId);
  const leaders = await all(db, `SELECT * FROM leaders WHERE batch_id IN (${fam.map(() => '?').join(',')}) ORDER BY appointed_at`, ...fam);
  const names = Object.fromEntries((await batchesAll(db)).map(b => [b.batch_id, b.name]));
  const isLeader = new Set(leaders.map(x => x.login)), byLogin = new Map(rows.map(r => [r.login, r]));
  return {
    batchId, weekId, batches: fam.map(b => ({ batchId: b, name: names[b] || b })),
    groups: leaders.map(x => {
      const r = byLogin.get(x.login);
      return { leader: { login: x.login, name: r?.name || x.login, phone: x.login, whatsapp: r?.whatsapp || x.login, hasPhoto: !!r?.hasPhoto, attendance: r?.attendance || null },
               appointedBy: x.appointed_by, appointedAt: x.appointed_at,
               members: rows.filter(m => m.leaderLogin === x.login && m.login !== x.login).map(memberView) };
    }),
    // leaders themselves are in no group: their own attendance is marked by the coordinator
    unassigned: rows.filter(m => active(m) && !isLeader.has(m.login) && (!m.leaderLogin || !isLeader.has(m.leaderLogin))).map(memberView)
  };
}

/** The open membership of an active devotee of a batch the caller manages. */
async function batchDevotee(ctx, loginIn) {
  const login = normPhone(loginIn), a = login ? await account(ctx.db, login) : null;
  if (!a || a.role !== 'DEVOTEE' || a.status !== 'ACTIVE') throw apiError('NOT_FOUND', 'No active devotee with that phone.');
  const m = await currentMembership(ctx.db, a.login);
  if (!m || m.state !== 'ACTIVE') throw apiError('CONFLICT', `${a.name} is not an active member of a batch.`);
  await requireBatch(ctx, m.batch_id);
  return { a, m };
}

/** leaders.set: appoint (leader: true) or remove (false) a group leader. Removing frees their group's members. */
export async function leadersSet(d, ctx, req) {
  if (typeof d.leader !== 'boolean') throw invalid({ path: 'leader', message: 'true or false.' });
  const db = ctx.db, { a, m } = await batchDevotee(ctx, d.login), at = isoIst(ctx.now());
  const was = await one(db, 'SELECT * FROM leaders WHERE login = ?', a.login);
  if (d.leader) {
    if (was) return { login: a.login, leader: true, batchId: was.batch_id };
    await db.batch([
      q(db, 'INSERT INTO leaders (login, batch_id, appointed_by, appointed_at) VALUES (?, ?, ?, ?)', a.login, m.batch_id, ctx.login, at),
      // a leader is in no group: their own attendance is the coordinator's to mark
      q(db, "UPDATE memberships SET leader_login = '' WHERE login = ? AND to_week = '' AND leader_login <> ''", a.login),
      audit(db, ctx, 'leaders.appoint', a.login, m.batch_id, null, { leader: true }, '', req.requestId)]);
    return { login: a.login, leader: true, batchId: m.batch_id };
  }
  if (!was) return { login: a.login, leader: false };
  await db.batch([
    q(db, 'DELETE FROM leaders WHERE login = ?', a.login),
    q(db, "UPDATE memberships SET leader_login = '' WHERE leader_login = ? AND to_week = ''", a.login),
    audit(db, ctx, 'leaders.remove', a.login, was.batch_id, { leader: true }, { leader: false }, String(d.reason || ''), req.requestId)]);
  return { login: a.login, leader: false };
}

/** leaders.assign: puts devotees in a leader's group (leader: '' takes them out of any group). Same batch only. */
export async function leadersAssign(d, ctx, req) {
  const db = ctx.db, logins = Array.isArray(d.logins) ? d.logins.map(x => normPhone(x)).filter(Boolean) : [];
  if (!logins.length || logins.length > 300) throw invalid({ path: 'logins', message: 'Choose 1 to 300 devotees.' });
  let leader = null, fam = [];
  if (d.leader) {
    leader = await one(db, 'SELECT * FROM leaders WHERE login = ?', normPhone(d.leader));
    if (!leader) throw invalid({ path: 'leader', message: 'Not a group leader.' });
    await requireBatch(ctx, leader.batch_id);
    fam = await levelBatches(db, leader.batch_id);
  }
  const stmts = [], moved = [];
  for (const [i, login] of logins.entries()) {
    const { a, m } = await batchDevotee(ctx, login);
    if (leader && !fam.includes(m.batch_id)) throw invalid({ path: `logins.${i}`, message: `${a.name} is in a batch of another level.` });
    if (await one(db, 'SELECT 1 FROM leaders WHERE login = ?', a.login)) throw invalid({ path: `logins.${i}`, message: `${a.name} is a group leader (in no group).` });
    if ((m.leader_login || '') === (leader?.login || '')) continue;
    stmts.push(q(db, "UPDATE memberships SET leader_login = ? WHERE id = ?", leader?.login || '', m.id));
    moved.push({ login: a.login, from: m.leader_login || null });
  }
  if (stmts.length) await db.batch([...stmts, audit(db, ctx, 'leaders.assign', leader?.login || '(none)', leader?.batch_id || '', { moved }, { leader: leader?.login || null }, '', req.requestId)]);
  return { leader: leader?.login || null, moved: moved.length };
}
