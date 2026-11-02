// Admin › Analysis (phase 21, 23 Oct 2026): the per-batch weekly summary the deadline job writes (batch_weeks,
// migration 0064), and analysis.get, which reads a period of it for the head in one round trip.
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';
import { runDeadline } from '../src/weeks.js';

const t = suite('phase 21: the analysis summary');
const { env, DB, call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const join = async (phone, name) => {
  await call('auth.signUp', { phone, name, batchId: 'SPS2', facilitator: FAC, ...CONTACT, groupLeader: LEAD.SPS2, password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
};
await join('6000000168', 'One Das'); await join('6000000169', 'Two Das'); await join('6000000170', 'Three Das');
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");
DB.sql.exec("UPDATE memberships SET from_week = '2026-09-28' WHERE login IN ('6000000168', '6000000169', '6000000170')");
const W = '2026-10-05';
const submit = (login, week, overall, rounds, reading, hearing, night, pr) => DB.sql.exec(`INSERT INTO submissions (submission_id, login, name, batch_id, week_id, submitted_at,
    submitted_by, request_id, rules_version, bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall,
    seva_minutes, avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
  VALUES ('${login}-${week}', '${login}', 'x', 'SPS2', '${week}', '2026-10-10T19:00:00+05:30', '${login}', 'rq-${login}-${week}', 'r3',
    70, 60, 80, 80, 80, 80, 100, 100, 80, 80, ${overall}, 300, '${rounds}', '${night}', '${pr}', ${hearing}, ${reading}, '[]', '{}')`);
submit('6000000168', W, 90, 16, 120, 200, 'YES', 'YES');
submit('6000000169', W, 70, '', 60, 0, 'NO', 'YES');            // no rounds given: not counted in the rounds average
DB.sql.exec(`INSERT INTO attendance (login, week_id, batch_id, mark_used, changed_by, changed_at) VALUES ('6000000168', '${W}', 'SPS2', 'P', 'sps', '${W}'), ('6000000169', '${W}', 'SPS2', 'A', 'sps', '${W}')`);

// the Monday deadline closes the week: the one who did not submit is missed, and the week is summed
at('2026-10-12T21:05:00');
let out = '';
for (let i = 0; i < 6 && !/closed|up to date/.test(out); i++) out = await runDeadline(env, DB, new Date(clock.now));
t.ok(/closed/.test(out), `the deadline job closes the week (${out})`);
const r0 = rows(`SELECT * FROM batch_weeks WHERE batch_id = 'SPS2' AND week_id = '${W}'`)[0];
t.ok(!!r0, 'the closed week has its summary row');
t.eq([r0.submitted, r0.missed, r0.sum_overall, r0.n_rounds, r0.sum_rounds, r0.sum_reading, r0.sum_hearing, r0.night_yes, r0.principles_yes, r0.present, r0.held],
  [2, 1, 160, 1, 16, 180, 200, 1, 2, 1, 2], 'with the sums: 2 submitted, 1 missed, rounds over those who gave them, minutes, night stay, principles, class marks');
t.eq(rows("SELECT COUNT(*) AS n FROM batch_weeks WHERE week_id > '2026-10-05'")[0].n, 0, 'the week still running is never summed');

// a late change to a closed week (a reopened week submitted after the deadline) is caught by the next close
submit('6000000170', W, 80, 12, 30, 30, 'YES', 'YES');
DB.sql.exec(`DELETE FROM missed_weeks WHERE login = '6000000170' AND week_id = '${W}'`);
at('2026-10-19T21:05:00');
out = '';
for (let i = 0; i < 6 && !/closed|up to date/.test(out); i++) out = await runDeadline(env, DB, new Date(clock.now));
const r1 = rows(`SELECT submitted, missed, sum_overall FROM batch_weeks WHERE batch_id = 'SPS2' AND week_id = '${W}'`)[0];
t.eq([r1.submitted, r1.missed, r1.sum_overall], [3, 0, 240], 'the next close refreshes the three weeks before it, so the late submission counts');

// ---- C4 (27 Oct 2026): a late attendance mark on a closed, submitted week — Analysis says what the Board says ----
{
  const board = async () => (await call('devotees.list', { batchId: 'SPS2', weekId: W }, M)).data;
  const boardSum = (b) => (b.devotees || b.rows || b).filter((x) => x.status === 'SUBMITTED').reduce((n, x) => n + x.overall, 0);
  const analysisOf = async () => (await call('analysis.get', { from: '2026-09-01', to: '2026-12-31' }, M)).data.weeks.find((w) => w.weekId === W && w.batchId === 'SPS2');
  const b0 = await board();
  t.eq([boardSum(b0), (await analysisOf()).overall], [240, 240], 'before: the Board and Analysis agree on the closed week (240)');
  at('2026-10-21T10:00:00');
  t.code(await call('attendance.override', { login: '6000000168', weekId: W, mark: 'A', reason: 'Was not at the class after all' }, M), 'ok', 'the head marks a submitted, closed week Absent');
  const b1 = await board(), a1 = await analysisOf();
  t.eq(boardSum(b1), 215, 'the Board re-works that week: 90 → 65 (attendance 0), so 215');
  t.eq(a1.overall, boardSum(b1), `Analysis says the same at once (${a1.overall}), without waiting for a deadline`);
  t.eq([a1.present, a1.held], [0, 2], '… and its class marks follow the mark too');
  const a2 = rows(`SELECT COUNT(*) AS n FROM batch_weeks WHERE week_id = '${W}'`)[0].n;
  t.eq(a2, 1, '… by re-writing that one batch-week row (keyed), not adding one');
  // the next Monday close refreshes the four weeks before it: it sums the FINAL scores too, so it keeps 215
  at('2026-10-26T21:05:00');
  for (let i = 0, out = ''; i < 6 && !/closed|up to date/.test(out); i++) out = await runDeadline(env, DB, new Date(clock.now));
  t.eq((await analysisOf()).overall, 215, 'the next deadline refresh keeps the final score (it no longer sums the score stored at submit)');
  // a mark on a week still open changes nothing in the summary (the deadline sums it)
  t.eq(rows("SELECT COUNT(*) AS n FROM batch_weeks WHERE week_id = '2026-10-26'")[0].n, 0, 'an open week is never summed');
}

// reading it
let r = await call('analysis.get', { from: '2026-09-01', to: '2026-12-31' }, M);
t.eq([r.ok, r.data.weeks.find((w) => w.weekId === W && w.batchId === 'SPS2')?.submitted], [true, 3], 'the head reads a period of the summary');
t.ok(r.data.batches.some((b) => b.batchId === 'SPS2' && b.level === 'SPS') && Array.isArray(r.data.phases) && r.data.lastClosed === '2026-10-19', 'with the batches, the phases and the last closed week (10-19: the C4 block above ran one more close)');
// the trainings, read live beside it: who is in, how it ended for those who left, and the training attendance
DB.sql.exec("INSERT INTO batches (batch_id, name, level, score_card, hearing_journal, tracks, class_day, started_on, sheet_tab) VALUES ('ETP-21', 'ETP · Batch 21', 'ETP', 'SPS', 'SPS/DPS', 'full', 'WED', '2026-09-28', 'ETP-21')");
DB.sql.exec(`INSERT INTO enrolments (batch_id, login, state, from_week, added_by, added_at) VALUES
  ('ETP-21', '6000000168', 'ACTIVE', '2026-09-28', 'master', '2026-09-28'), ('ETP-21', '6000000169', 'ACTIVE', '2026-09-28', 'master', '2026-09-28'),
  ('ETP-21', '6000000170', 'ENDED', '2026-09-28', 'master', '2026-09-28')`);
DB.sql.exec(`INSERT INTO training_attendance (login, batch_id, week_id, mark, marked_by, marked_at) VALUES
  ('6000000168', 'ETP-21', '${W}', 'P', 'etp', '${W}'), ('6000000169', 'ETP-21', '${W}', 'A', 'etp', '${W}'), ('6000000168', 'ETP-21', '2026-10-12', 'P', 'etp', '2026-10-12')`);
r = await call('analysis.get', { from: '2026-09-01', to: '2026-12-31' }, M);
const etp = r.data.trainings.find((x) => x.batchId === 'ETP-21');
t.eq([etp?.active, etp?.removed, etp?.qualified], [2, 1, 0], 'each training: in it now, taken out, qualified');
t.eq(etp.weeks, [{ weekId: W, present: 1, held: 2 }, { weekId: '2026-10-12', present: 1, held: 1 }], 'and its attendance week by week, present of those marked');
t.ok(!r.data.trainings.some((x) => x.batchId === 'SPS2'), 'a class batch is not a training');
t.code(await call('analysis.get', { from: '2026-09-01', to: '2026-12-31' }, C), 'FORBIDDEN', 'only the head');
t.code(await call('analysis.get', { from: '01-09-2026', to: '2026-12-31' }, M), 'VALIDATION', 'dates as dates');
t.code(await call('analysis.get', { from: '2026-12-31', to: '2026-09-01' }, M), 'VALIDATION', 'the end after the start');
t.code(await call('analysis.get', { from: '2023-01-01', to: '2026-12-31' }, M), 'VALIDATION', 'at most two years at a time');

t.done();
