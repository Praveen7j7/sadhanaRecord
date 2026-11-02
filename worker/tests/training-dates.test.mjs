// A training batch's lifecycle (Phase 22, J1; the head, 26 Oct 2026: "In ETP there is no way to mark the batch ended, or
// to define a new batch's start and end date; its dates are custom, the rest is like the original facilitators").
//   · the head sets a training's start and END date (end after start; the start never in the future, as every batch)
//   · its status: RUNNING · PAST_END ("Past its end date — end it?") · ENDED; nothing ends by itself
//   · ending is Close batch (closing.js); an ended training takes no new attendance or cards, its history stays readable
//   · the end date bounds the trainee's card (phases.js windowFrom: "a trainee's card runs over their training's dates")
// And (K2 loose end) a new TRD-level batch asks the Morning program its card scores.
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';
import { runDeadline } from '../src/weeks.js';

const t = suite('phase 22: a training batch has its own dates, a status, and ends when a person ends it');
const { env, DB, call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-20T10:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
let M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('phases.open', { phaseId: 'kartik-2026', name: 'Kartik Phase', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M);

/* ── creating ETP-22 with its own dates ── */
const make = (o) => call('batches.create', { batchId: 'ETP-22', name: 'ETP · Batch 22', level: 'ETP', ...o }, M);
const fieldOf = (r) => r.error?.fields?.[0]?.path || r.error?.details?.[0]?.path || '';
let r = await make({ startedOn: '2026-10-19' });
t.eq([r.error?.code, fieldOf(r)], ['VALIDATION', 'endsOn'], 'a new training must be given its end date');
r = await make({ startedOn: '2026-10-19', endsOn: '2026-10-19' });
t.eq([r.error?.code, fieldOf(r), r.error?.fields?.[0]?.message || r.error?.details?.[0]?.message], ['VALIDATION', 'endsOn', 'The end comes after the start.'], 'the end comes after the start (not on it)');
r = await make({ endsOn: '2026-10-20' });
t.eq([r.error?.code, fieldOf(r)], ['VALIDATION', 'endsOn'], 'with no start given it starts today, so the end must come after today');
r = await make({ startedOn: '2026-11-02', endsOn: '2027-01-31' });
t.eq([r.error?.code, fieldOf(r)], ['VALIDATION', 'startedOn'], 'a training cannot start in the future either (its card would have no week to fill — ETP-21, 18 Oct)');
r = await make({ startedOn: '2026-10-19', endsOn: '31-12-2026' });
t.eq([r.error?.code, fieldOf(r)], ['VALIDATION', 'endsOn'], 'the end is a date');
r = await call('batches.create', { batchId: 'SPS9', name: 'SPS Group 9', level: 'SPS', endsOn: '2026-12-31' }, M);
t.eq([r.error?.code, fieldOf(r)], ['VALIDATION', 'endsOn'], 'only a training has an end date');
r = await make({ startedOn: '2026-10-19', endsOn: '2026-11-08' });
t.code(r, 'ok', 'ETP-22 is created with its own dates');
t.eq([r.data.startedOn, r.data.endsOn, r.data.status, r.data.closedAt], ['2026-10-19', '2026-11-08', 'RUNNING', ''], 'and is Running');
t.eq(rows("SELECT started_on, ends_on, closed_at FROM batches WHERE batch_id = 'ETP-22'"), [{ started_on: '2026-10-19', ends_on: '2026-11-08', closed_at: '' }], 'stored');
const sps = (await call('batches.list', {}, M)).data.find((b) => b.batchId === 'SPS');
t.ok(!('endsOn' in sps) && !('status' in sps), 'a class batch carries no end date and no training status');

/* ── its coordinator, and a student ── */
await call('coordinators.create', { username: 'etp22', name: 'Etp Twentytwo', batchIds: ['ETP-22'], tempPassword: 'Temp-e22-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'etp22'");
const E = (await call('auth.login', { login: 'etp22', password: 'Temp-e22-2026' })).data.token;
const PROFILE = { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
  address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
await call('auth.signUp', { phone: '6000000181', name: 'Keshav Das', batchId: 'SPS', facilitator: FAC, ...CONTACT, groupLeader: LEAD.SPS, password: 'Devotee pass 2026', profile: PROFILE });
await call('requests.approve', { phone: '6000000181', link: { noIdYet: true } }, M);
const S = (await call('auth.login', { login: '6000000181', password: 'Devotee pass 2026' })).data.token;
t.code(await call('enrol.add', { batchId: 'ETP-22', login: '6000000181' }, E), 'ok', 'a devotee is enrolled');

/* ── the end date bounds the trainee's card ── */
r = await call('card.get', { phaseId: 'kartik-2026', weekId: '2026-10-19' }, S);
t.eq([r.data?.trainee, r.data?.from, r.data?.to], [true, '2026-10-19', '2026-11-08'], "the trainee's card runs over the training's dates, not to the phase's end");
t.code(await call('card.fill', { phaseId: 'kartik-2026', weekId: '2026-10-19', values: [{ measureId: 'stall', value: '1' }] }, S), 'ok', 'a week inside is filled');
r = await call('card.fill', { phaseId: 'kartik-2026', weekId: '2026-11-09', values: [{ measureId: 'stall', value: '1' }] }, S);
t.eq([r.error?.code, r.error?.fields?.[0]?.message || r.error?.details?.[0]?.message], ['VALIDATION', 'That week is outside your training.'], 'a week after the end date is not');

/* ── the head moves the dates ── */
r = await call('batches.update', { batchId: 'ETP-22', endsOn: '2026-10-18' }, M);
t.eq([r.error?.code, fieldOf(r)], ['VALIDATION', 'endsOn'], 'an end before the start is refused');
r = await call('batches.update', { batchId: 'ETP-22', startedOn: '2026-10-25' }, M);
t.eq([r.error?.code, fieldOf(r)], ['VALIDATION', 'startedOn'], 'a start moved into the future is refused');
r = await call('batches.update', { batchId: 'ETP-22', startedOn: '2026-11-08' }, M);
t.eq([r.error?.code], ['VALIDATION'], 'a start moved onto the end date is refused (the end comes after it)');
r = await call('batches.update', { batchId: 'SPS', endsOn: '2026-12-31' }, M);
t.eq([r.error?.code, fieldOf(r)], ['VALIDATION', 'endsOn'], 'a class batch has no dates to set here');
r = await call('batches.update', { batchId: 'ETP-22', endsOn: '2026-11-15' }, M);
t.eq([r.ok, r.data?.endsOn, r.data?.status], [true, '2026-11-15', 'RUNNING'], 'the head moves the end date');
t.eq((await call('card.get', { phaseId: 'kartik-2026', weekId: '2026-10-19' }, S)).data?.to, '2026-11-15', 'and the card window follows it');
t.code(await call('batches.update', { batchId: 'ETP-22', endsOn: '2026-11-08' }, E), 'FORBIDDEN', 'its coordinator does not set the dates — the head does');
await call('batches.update', { batchId: 'ETP-22', endsOn: '2026-11-08' }, M);

/* ── past its end date: asked, never ended by itself ── */
at('2026-11-08T20:00:00');
t.eq((await call('batches.list', {}, M)).data.find((b) => b.batchId === 'ETP-22').status, 'RUNNING', 'on the end date itself it is still Running');
at('2026-11-10T21:30:00');
for (let i = 0; i < 6; i++) await runDeadline(env, DB, new Date(clock.now));          // the Monday jobs run as usual
t.eq((await call('batches.list', {}, M)).data.find((b) => b.batchId === 'ETP-22').status, 'PAST_END', 'the day after its end date the head sees "Past its end date"');
const metaE = await call('meta.get', {}, E, { token: E });
const staffE = (metaE.data.staffBatches || []).find((b) => b.batchId === 'ETP-22');
t.eq([staffE?.status, staffE?.startedOn, staffE?.endsOn], ['PAST_END', '2026-10-19', '2026-11-08'], 'and so does its coordinator (meta, for the Batch screen)');
t.eq(rows("SELECT closed_at FROM batches WHERE batch_id = 'ETP-22'")[0].closed_at, '', 'nothing ended it: the batch is still open');
t.code(await call('training.attendance', { batchId: 'ETP-22', weekId: '2026-11-09', marks: [{ login: '6000000181', mark: 'P' }] }, E), 'ok',
  'a training past its end date still takes attendance until a person ends it');
t.eq((await call('enrol.list', { batchId: 'ETP-22' }, E)).data?.closed, false, 'and still reads as open to its coordinator');

/* ── ending it: Close batch ── */
t.code(await call('batches.close', { batchId: 'ETP-22', decisions: [{ login: '6000000181', decision: 'qualified' }] }, E), 'ok', 'its coordinator ends it (Close batch)');
const ended = (await call('batches.list', {}, M)).data.find((b) => b.batchId === 'ETP-22');
t.eq([ended.status, ended.closedAt.slice(0, 10)], ['ENDED', '2026-11-10'], 'it reads Ended');
t.code(await call('training.attendance', { batchId: 'ETP-22', weekId: '2026-11-09', marks: [{ login: '6000000181', mark: 'A' }] }, E), 'CONFLICT', 'an ended training takes no new attendance');
t.code(await call('card.fill', { phaseId: 'kartik-2026', weekId: '2026-10-26', values: [{ measureId: 'stall', value: '2' }] }, S), 'WINDOW_CLOSED', 'and no new cards');
t.code(await call('enrol.add', { batchId: 'ETP-22', login: '6000000181' }, M), 'CONFLICT', 'nor new students');
t.code(await call('batches.update', { batchId: 'ETP-22', endsOn: '2026-12-31' }, M), 'CONFLICT', 'its dates are a record now');
r = await call('card.get', { phaseId: 'kartik-2026', weekId: '2026-10-19' }, S);
t.eq([r.data?.closed, r.data?.to], [true, '2026-11-08'], "the trainee's card is a record, over the training's dates: ended after its end date, it runs to the end date");
t.eq(r.data?.measures?.find((m) => m.measureId === 'stall')?.value, '1', 'what they filled is still there to read');
t.eq(rows("SELECT COUNT(*) AS n FROM training_attendance WHERE batch_id = 'ETP-22'")[0].n, 1, 'and its attendance is kept');
t.ok(!((await call('meta.get', {}, E, { token: E })).data.staffBatches || []).some((b) => b.batchId === 'ETP-22'), 'an ended training leaves the coordinator\'s working list, as before');

/* ── two routes (the head, 26 Oct 2026): a training's card is ONE card over its own dates, across phases ── */
{
  at('2026-11-16T10:00:00');
  await call('phases.update', { phaseId: 'kartik-2026', name: 'Kartik Phase', startsOn: '2026-09-01', endsOn: '2026-12-31', targetsUntil: '2026-12-15', reason: 'targets till mid December' }, M);
  t.code(await call('batches.create', { batchId: 'ETP-23', name: 'ETP · Batch 23', level: 'ETP', startedOn: '2026-11-16', endsOn: '2027-02-28' }, M), 'ok',
    'ETP-23 runs 16 Nov 2026 – 28 Feb 2027, across the end of Kartik');
  await call('auth.signUp', { phone: '6000000182', name: 'Madhava Das', batchId: 'SPS', facilitator: FAC, ...CONTACT, groupLeader: LEAD.SPS, password: 'Devotee pass 2026', profile: PROFILE });
  await call('requests.approve', { phone: '6000000182', link: { noIdYet: true } }, M);
  let S2 = (await call('auth.login', { login: '6000000182', password: 'Devotee pass 2026' })).data.token;
  t.code(await call('enrol.add', { batchId: 'ETP-23', login: '6000000182' }, M), 'ok', 'a devotee is enrolled');
  r = await call('card.get', {}, S2);
  t.eq([r.data.phaseId, r.data.name, r.data.from, r.data.to, r.data.startsOn, r.data.endsOn], ['ETP-23', 'ETP · Batch 23', '2026-11-16', '2027-02-28', '2026-11-16', '2027-02-28'],
    "the trainee's card is the training's: keyed by it, named for it, over its own dates — not Kartik's");
  t.eq(r.data.targets.until, '2026-11-22', "its targets are fixed after the training's first week, not the phase's date (ADR 0018, the ETP route)");
  t.code(await call('targets.set', { phaseId: 'ETP-23', targets: [{ measureId: 'stall', target: '3' }] }, S2), 'ok', 'targets set');
  t.code(await call('card.fill', { phaseId: 'ETP-23', weekId: '2026-12-14', values: [{ measureId: 'stall', value: '2' }] }, S2), 'ok', 'a December week filled');
  // Kartik closes, Gaur opens: the training goes on, on the same card
  await call('phases.open', { phaseId: 'gaur-2027', name: 'Gaur Phase', startsOn: '2027-01-01', endsOn: '2027-04-30' }, M);
  at('2027-01-13T10:00:00');
  // two months on: sign in again (sessions expire)
  S2 = (await call('auth.login', { login: '6000000182', password: 'Devotee pass 2026' })).data.token;
  M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
  t.code(await call('card.fill', { phaseId: 'ETP-23', weekId: '2027-01-11', values: [{ measureId: 'stall', value: '3' }] }, S2), 'ok', 'a January week filled, into the same card');
  t.code(await call('card.fill', { phaseId: 'gaur-2027', weekId: '2027-01-11', values: [{ measureId: 'calls', value: '4' }] }, S2), 'ok',
    'an app still holding the phase id fills the training card all the same');
  r = await call('card.get', { weekId: '2027-01-11' }, S2);
  t.eq([r.data.phaseId, r.data.from, r.data.to, r.data.filledWeeks], ['ETP-23', '2026-11-16', '2027-02-28', ['2026-12-14', '2027-01-11']],
    'one continuous card from start to end: December and January weeks together');
  t.eq(rows("SELECT DISTINCT phase_id FROM fills WHERE login = '6000000182'").map((x) => x.phase_id), ['ETP-23'], 'every fill is keyed by the training, none by a phase');
  t.eq((await call('card.of', { login: '6000000182' }, M)).data.phaseId, 'ETP-23', 'the head reads the same card');
  const bd = await call('board.get', { batchId: 'ETP-23', weekId: '2027-01-11' }, M);
  t.eq([bd.data.startsOn, bd.data.endsOn, bd.data.training], ['2026-11-16', '2027-02-28', true], "the training's board carries its own dates, for the scoreboard to show (27 Oct 2026)");
  t.eq([bd.data.phaseId, bd.data.rows[0]?.week, bd.data.rows[0]?.weeksFilled, bd.data.rows[0]?.weeks], ['ETP-23', 100, 2, 15],
    "its board is the training's: January's week (3 of a target of 3), both weeks filled, of 15 from 16 Nov to 28 Feb (a phase would have cut it)");
  // the FTP route stays on phases
  r = await call('card.get', { weekId: '2027-01-11' }, M);
  t.eq([r.data.phaseId, r.data.from, r.data.to, r.data.trainee], ['gaur-2027', '2027-01-01', '2027-04-30', false], "a facilitator's card is still the phase's");
  t.ok(!(await call('board.get', { weekId: '2027-01-11' }, M)).data.rows.some((x) => x.login === '6000000182'), "and a trainee is not on the facilitators' board (their place is on the training's)");
  t.eq((await call('profile.get', {}, S2)).data?.trainings?.[0]?.phaseId ?? (await call('devotees.get', { login: '6000000182' }, M)).data.trainings[0].phaseId, 'ETP-23',
    "the profile's training record opens the training's card");
}

/* ── migration 0068: a trainee's rows kept under a phase move to their training's key; a facilitator's stay ── */
{
  const fs = await import('node:fs');
  DB.sql.exec(`INSERT INTO fills (phase_id, login, measure_id, week_id, value, filled_by, filled_at) VALUES ('kartik-2026', '6000000182', 'journal', '2026-11-23', 'YES', 'x', 'x')`);
  DB.sql.exec(`INSERT INTO targets (phase_id, login, measure_id, target, set_by, set_at) VALUES ('kartik-2026', 'master', 'stall', '5', 'x', 'x')`);
  DB.sql.exec(fs.readFileSync(new URL('../migrations/0068_training_cards.sql', import.meta.url), 'utf8'));
  t.eq(rows("SELECT phase_id FROM fills WHERE login = '6000000182' AND measure_id = 'journal'")[0].phase_id, 'ETP-23', "a trainee's phase-keyed fill moves to the training");
  t.eq(rows("SELECT phase_id FROM targets WHERE login = 'master' AND measure_id = 'stall' AND target = '5'")[0].phase_id, 'kartik-2026', "a facilitator's stays on the phase");
}

/* ── K2 loose end: a TRD-level batch asks the Morning program ── */
t.code(await call('batches.create', { batchId: 'TRD2', name: 'Temple Residents 2', level: 'TRD' }, M), 'ok', 'a second TRD batch');
t.eq(rows("SELECT score_card, temple_activities FROM batches WHERE batch_id = 'TRD2'"), [{ score_card: 'TRD', temple_activities: 1 }], 'on the TRD card, asking the Morning program');
t.eq(rows("SELECT temple_activities FROM batches WHERE batch_id = 'SPS9' OR batch_id = 'ETP-22'").map((x) => x.temple_activities), [0], 'nobody else is asked');

t.done();
