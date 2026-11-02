// VL-2: a batch whose whole week is the attendance mark (ADR 0009, the head, 16 Oct 2026).
//
// The three tiers already existed for SPS — the devotee marks themselves, the group leader may
// overwrite that, the coordinator may overwrite both, and the IYF head may correct any of it after
// the deadline. What was never proved is that any of it works for a batch with NO SCORE CARD, which
// is what VL-2 is. These tests take a VL-2 intake through the whole chain.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite('VL-2: attendance is the whole week');
const { DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;

// batch 51 of Vedic Level 2 — attendance only, no card, no journal
t.code(await call('batches.create', { batchId: 'VL2-51', name: 'Vedic Level 2 · Batch 51', level: 'VL2', startedOn: '2026-09-07' }, M), 'ok',
  'the head opens Vedic Level 2 batch 51');

await call('coordinators.create', { username: 'vl2', name: 'Vedic Coordinator', batchIds: ['VL2-51'], tempPassword: 'Temp-vl2-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'vl2'");
const C = (await call('auth.login', { login: 'vl2', password: 'Temp-vl2-2026' })).data.token;

const join = async (phone, name) => {
  await call('auth.signUp', { phone, name, batchId: 'VL2-51', facilitator: FAC, ...CONTACT, groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
    profile: { dob: '2003-04-04', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000120', 'Rahul Verma');
await join('6000000121', 'Sanjay Rao');
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");
const W = '2026-10-05';

t.eq(rows("SELECT tracks AS t FROM batches WHERE batch_id = 'VL2-51'")[0].t, 'attendance',
  'the intake collects attendance and nothing else');

// a devotee of a VL-2 batch can be listed and marked exactly like any other
let r = await call('devotees.list', { batchId: 'VL2-51', weekId: W }, C);
t.eq(r.data.rows.map(x => x.name), ['Rahul Verma', 'Sanjay Rao'], 'the coordinator sees their batch');

// ---- attendance opens at the Sunday class, as everywhere else
at('2026-10-11T19:00:00');
t.code(await call('attendance.set', { batchId: 'VL2-51', weekId: W, marks: [{ login: '6000000120', mark: 'P' }] }, C), 'ok',
  'the coordinator marks a VL-2 devotee present — no score card needed');
t.eq(rows("SELECT coordinator_mark AS c, mark_used AS u FROM attendance WHERE login = '6000000120' AND week_id = '2026-10-05'")[0],
  { c: 'P', u: 'P' }, 'the mark is stored at the coordinator level and is the one used');

// ---- the rank: a coordinator's mark stands over a group leader's
DB.sql.exec("INSERT INTO leaders (login, batch_id, appointed_by, appointed_at) VALUES ('6000000121', 'VL2-51', 'master', '2026-10-05')");
DB.sql.exec("UPDATE memberships SET leader_login = '6000000121' WHERE login = '6000000120'");
const L = (await call('auth.login', { login: '6000000121', password: 'Devotee pass 2026' })).data.token;
t.code(await call('group.mark', { weekId: W, marks: [{ login: '6000000120', mark: 'A' }] }, L), 'ok',
  'the group leader may mark their own group');
t.eq(rows("SELECT leader_mark AS l, coordinator_mark AS c, mark_used AS u FROM attendance WHERE login = '6000000120' AND week_id = '2026-10-05'")[0],
  { l: 'A', c: 'P', u: 'P' },
  'both marks are kept, and the COORDINATOR’s is the one used — a leader cannot overwrite them');

// ---- and the head stands over the coordinator
t.code(await call('attendance.override', { login: '6000000120', weekId: W, mark: 'A', reason: 'He was at the hospital that Sunday' }, M), 'ok',
  'the head corrects it with a reason');
t.eq(rows("SELECT master_mark AS m, coordinator_mark AS c, mark_used AS u FROM attendance WHERE login = '6000000120' AND week_id = '2026-10-05'")[0],
  { m: 'A', c: 'P', u: 'A' }, "the head's correction wins, and the coordinator's mark is still on record");

// ---- nothing about a VL-2 batch asks for a day
t.eq(rows("SELECT score_card AS c FROM batches WHERE batch_id = 'VL2-51'")[0].c, '',
  'a VL-2 batch has no score card, so there is nothing to score a day against');

/* ── closing the intake, and where each devotee goes (ADR 0009) ─────────── */
//
// Closing is the only place in the app that moves somebody from one batch to another, so it is also
// the only place a promotion happens. The rule that matters: NOBODY may be left undecided. A devotee
// silently skipped would stay in a batch that is closed and nobody watches again.
{
  at('2026-10-12T10:00:00');
  // somewhere to be promoted to
  await call('batches.create', { batchId: 'VL3-51', name: 'Vedic Level 3 · Batch 51', level: 'VL3' }, M);

  let p = await call('batches.closingPreview', { batchId: 'VL2-51' }, C);
  t.eq(p.data.members.map(x => x.name), ['Rahul Verma', 'Sanjay Rao'], 'the preview lists everyone still in the intake');
  t.eq(p.data.level, 'VL2', 'and says which level it is');
  t.ok(p.data.nextBatches.some(b => b.batchId === 'VL3-51'), 'with somewhere to promote them to');

  // the batches that run without end are never closed
  t.code(await call('batches.closingPreview', { batchId: 'SPS' }, M), 'CONFLICT', 'an SPS batch has no closing: it runs with no fixed duration');

  // a closing must account for every active member
  t.code(await call('batches.close', { batchId: 'VL2-51', decisions: [{ login: '6000000120', decision: 'promoted', toBatch: 'VL3-51' }] }, C),
    'VALIDATION', 'leaving somebody undecided is refused');
  t.code(await call('batches.close', { batchId: 'VL2-51', decisions: [
    { login: '6000000120', decision: 'promoted', toBatch: 'VL3-51' },
    { login: '6000000120', decision: 'repeat' },
    { login: '6000000121', decision: 'repeat' }] }, C), 'VALIDATION', 'and naming the same person twice');
  t.code(await call('batches.close', { batchId: 'VL2-51', decisions: [
    { login: '6000000120', decision: 'promoted', toBatch: 'VL2-51' },
    { login: '6000000121', decision: 'repeat' }] }, C), 'VALIDATION', 'promoting somebody into the batch they are leaving');
  t.code(await call('batches.close', { batchId: 'VL2-51', decisions: [
    { login: '6000000120', decision: 'graduated', toBatch: 'VL3-51' },
    { login: '6000000121', decision: 'repeat' }] }, C), 'VALIDATION', 'and a decision that is not one of the three');

  // nothing above was allowed to half-close the batch
  t.eq(rows("SELECT closed_at AS c FROM batches WHERE batch_id = 'VL2-51'")[0].c, '',
    'every refusal left the intake open and nobody moved');

  const r = await call('batches.close', { batchId: 'VL2-51', decisions: [
    { login: '6000000120', decision: 'promoted', toBatch: 'VL3-51', note: 'Steady through the term' },
    { login: '6000000121', decision: 'repeat' }] }, C);
  t.code(r, 'ok', 'the coordinator closes the intake');
  t.eq([r.data.promoted, r.data.repeat, r.data.left], [1, 1, 0], 'one promoted, one repeating');

  t.ok(rows("SELECT closed_at AS c FROM batches WHERE batch_id = 'VL2-51'")[0].c !== '', 'the intake is closed');
  t.eq(rows("SELECT closed_by AS b FROM batches WHERE batch_id = 'VL2-51'")[0].b, 'vl2', 'with the name of whoever closed it');

  // the promoted devotee: the old membership ended, a new one opened in VL-3
  t.eq(rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000120' AND to_week = '' AND state = 'ACTIVE'").map(x => x.b),
    ['VL3-51'], 'the promoted devotee is now in VL-3');
  t.ok(rows("SELECT to_week AS w FROM memberships WHERE login = '6000000120' AND batch_id = 'VL2-51'")[0].w !== '',
    'and their VL-2 membership is closed, not deleted — the history stays');

  // the repeating devotee did not move
  t.eq(rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000121' AND to_week = '' AND state = 'ACTIVE'").map(x => x.b),
    ['VL2-51'], 'the repeating devotee stays where they are');

  // every decision is on record, with who took it
  t.eq(rows("SELECT decision AS d, decided_by AS b FROM batch_closings WHERE batch_id = 'VL2-51' ORDER BY login")
    .map(x => [x.d, x.b]), [['promoted', 'vl2'], ['repeat', 'vl2']], 'both decisions are recorded against the coordinator who took them');

  t.code(await call('batches.close', { batchId: 'VL2-51', decisions: [] }, C), 'CONFLICT', 'a closed intake cannot be closed again');
}

/* ── the promotion ladder (the head, 16 Oct 2026) ───────────────────────── */
//
// VL-1 → VL-2 → VL-3 → SPS → DPS → BSS or BVS, with two sideways moves: SPS → BVS directly, and
// BSS → BVS (BVS is for those who will marry; BSS is for those aspiring to brahmachari life).
// Before this, closing offered EVERY open batch, so one mis-tap could send a VL-2 devotee four
// levels up into BSS with nothing to show anything odd had happened.
{
  const { nextLevels } = await import('../src/closing.js');
  t.eq(nextLevels('VL2'), ['VL3'], 'VL-2 leads to VL-3 and nowhere else');
  t.eq(nextLevels('VL3'), ['SPS'], 'VL-3 leads to SPS');
  t.eq(nextLevels('SPS'), ['DPS', 'BVS'], 'SPS leads to DPS, or straight to BVS for those who will marry');
  t.eq(nextLevels('DPS'), ['BSS', 'BVS'], 'DPS leads to BSS or BVS');
  t.eq(nextLevels('BSS'), ['BVS'], 'a brahmachari aspirant who will marry instead moves to BVS');
  t.eq(nextLevels('BVS'), [], 'BVS is the end of the ladder');
  t.eq(nextLevels('NOPE'), [], 'an unknown level offers nothing, rather than everything');
  t.eq(nextLevels(''), [], 'and so does none');
}

/* ── promoting one devotee, with no closing (the head, 16 Oct 2026) ─────── */
//
// SPS and everything after it runs with no fixed duration, so it is never closed — which left those
// batches with no way to promote anybody at all. A coordinator moves one person up when they are
// ready, rather than waiting for a term's end that never comes.
{
  at('2026-10-12T10:00:00');
  // a devotee in SPS, and somewhere above them
  await call('coordinators.update', { username: 'vl2', batchIds: ['VL2-51', 'VL3-51', 'SPS'] }, M);
  const S = await (async () => {
    await call('auth.signUp', { phone: '6000000122', name: 'Mohan Sharma', batchId: 'SPS', facilitator: FAC, ...CONTACT,
      groupLeader: 'Hari Das Pr', password: 'Devotee pass 2026',
      profile: { dob: '2002-02-02', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
                 address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
    return call('requests.approve', { phone: '6000000122', link: { noIdYet: true } }, M);
  })();
  t.code(S, 'ok', 'a devotee joins SPS');

  let o = await call('devotees.promoteOptions', { login: '6000000122' }, M);
  t.eq(o.data.level, 'SPS', 'their level is read from their batch');
  t.eq(o.data.nextLevels, ['DPS', 'BVS'], 'and the ladder says where they may go');

  // a coordinator is held to the ladder
  t.code(await call('devotees.promote', { login: '6000000122', toBatch: 'VL2-51' }, C), 'VALIDATION',
    'a coordinator cannot send an SPS devotee backwards into a Vedic batch');
  t.code(await call('devotees.promote', { login: '6000000122', toBatch: 'BSS' }, C), 'VALIDATION',
    'nor skip DPS to reach BSS');

  // the head is not: a real journey sometimes skips a step
  const skip = await call('devotees.promote', { login: '6000000122', toBatch: 'BSS', reason: 'The head knows his service' }, M);
  t.code(skip, 'ok', 'the head may step off the ladder');
  t.eq(skip.data.offLadder, true, 'and the move says so, rather than passing as ordinary');

  t.eq(rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000122' AND to_week = '' AND state = 'ACTIVE'").map(x => x.b),
    ['BSS'], 'they are now in BSS');
  t.ok(rows("SELECT to_week AS w FROM memberships WHERE login = '6000000122' AND batch_id = 'SPS'")[0].w !== '',
    'their SPS membership is closed, not deleted — the history keeps its answer');

  // their coordinator no longer holds them: the move to BSS took them out of that coordinator's
  // batches, and ownership is checked on where they ARE, not where they were
  t.code(await call('devotees.promote', { login: '6000000122', toBatch: 'BVS' }, C), 'FORBIDDEN',
    'their old coordinator can no longer act on them once they have moved on');

  // the ordinary case, on the ladder (BSS → BVS)
  t.code(await call('devotees.promote', { login: '6000000122', toBatch: 'BVS' }, M), 'ok',
    'the move the ladder does allow goes through');
  t.code(await call('devotees.promote', { login: '6000000122', toBatch: 'BVS' }, M), 'VALIDATION',
    'promoting somebody into the batch they are already in is refused');
}

/* ── a class on a weekday (the head, 17 Oct 2026) ───────────────────────── */
//
// Attendance opened on Sunday for EVERY batch, Saturday ones included — the batches that existed all
// met at the weekend. A training batch may meet on a weekday, and on the old rule its coordinator
// could not mark the class they had just taken: attendance would not open until the Sunday after.
{
  const { attendanceOpens, classDayOf, DAY_NAME } = await import('../src/classweek.js');
  const W5 = '2026-10-05';   // a Monday

  t.eq(attendanceOpens(W5, 'SUN').toISOString().slice(0, 10), '2026-10-10', 'a Sunday class opens on the Sunday');
  t.eq(attendanceOpens(W5, 'WED').toISOString().slice(0, 10), '2026-10-06', 'a Wednesday class opens on the Wednesday');
  t.eq(attendanceOpens(W5, 'SAT').toISOString().slice(0, 10), '2026-10-09', 'and a Saturday class on the Saturday');

  // the batches that exist must not move: an unset day is still Sunday
  t.eq(attendanceOpens(W5).toISOString(), attendanceOpens(W5, 'SUN').toISOString(), 'a batch with no class day set is a Sunday batch');
  t.eq(attendanceOpens(W5, '').toISOString(), attendanceOpens(W5, 'SUN').toISOString(), 'and so is an empty one');
  t.eq(attendanceOpens(W5, 'nonsense').toISOString(), attendanceOpens(W5, 'SUN').toISOString(),
    'an unreadable day falls back to Sunday, never to Monday — opening attendance early would let a class be marked before it happened');
  t.eq(classDayOf('wed'), 'WED', 'the day is read whatever its case');
  t.eq(DAY_NAME.WED, 'Wednesday', 'and the refusal can name it, instead of saying Sunday to a Wednesday batch');
}

/* ── and the DEVOTEE is told the same day the gate uses (17 Oct 2026) ───── */
//
// The class-day change moved the three GATES (the coordinator's board, the group leader, the devotee's own
// mark) onto the batch's own day, but home.get / week.get still told the devotee "attendance opens Sunday"
// from the old Sunday-for-everyone helper. A Wednesday batch's devotee was therefore shown a date three days
// after the one on which the server had already been accepting their mark. The screen and the gate must
// answer with the same day, so the rule is pinned from the API, not from the helper.
{
  at('2026-10-07T20:00:00');                       // Wednesday evening of the week of Mon 5 Oct
  // the batch this devotee is in NOW (the promotion above moved them), so the screen and the gate are
  // asked about the same batch
  const myBatch = rows("SELECT batch_id AS b FROM memberships WHERE login = '6000000120' AND to_week = ''")[0].b;
  DB.sql.exec(`UPDATE batches SET class_day = 'WED' WHERE batch_id = '${myBatch}'`);

  const home = await call('home.get', {}, A);
  t.code(home, 'ok', 'the Wednesday batch devotee can open Home');
  const wk = home.data.weeks.find(w => w.weekId === '2026-10-05');
  t.eq(String(wk.attendance.opensAt).slice(0, 10), '2026-10-07',
    'Home says attendance opened on the batch’s Wednesday, not on the Sunday');

  // the gate agrees: the mark is accepted on that same Wednesday
  t.code(await call('week.setAttendance', { weekId: '2026-10-05', mark: 'P' }, A), 'ok',
    'and the mark the screen says is open is in fact accepted');

  // a Sunday batch is untouched: SPS-shaped batches keep the day they always had
  DB.sql.exec(`UPDATE batches SET class_day = 'SUN' WHERE batch_id = '${myBatch}'`);
  const sun = await call('home.get', {}, A);
  t.eq(String(sun.data.weeks.find(w => w.weekId === '2026-10-05').attendance.opensAt).slice(0, 10), '2026-10-11',
    'and a Sunday batch is still told the Sunday');
}

t.done();
