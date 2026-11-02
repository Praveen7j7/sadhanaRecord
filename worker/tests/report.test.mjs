// Admin › Reports (Phase 23 P14, docs/REPORTS_SPEC_2026-10-27.md): report.get builds one report for any period in ONE
// call. What is pinned here:
//   · the period maths: whole Monday weeks, only closed ones, the period before of the same length, a year at most
//   · the scope the SERVER forces: the head any; a coordinator given `reports` their own batches only, a facilitator
//     their own students, a training coordinator their own trainings — never another's, whatever is asked
//   · the numbers are the screens' own: Analysis (batch_weeks), the Leaderboard (its own statement) and the Scoreboard
//     (board.get) give exactly what the report gives for the same period
//   · a blank week is not a zero: quality is over filled weeks, and reporting is counted on its own
//   · one batch of reads for the report's own statements, and a pinned budget of round trips
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';
import { runDeadline } from '../src/weeks.js';

const t = suite('Admin › Reports: report.get');
const { env, DB, call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const staff = async (username, batchIds) => {
  await call('coordinators.create', { username, name: username.toUpperCase() + ' Coordinator', batchIds, tempPassword: `Temp-${username}-2026` }, M);
  DB.sql.exec(`UPDATE accounts SET must_change_pw = 0 WHERE login = '${username}'`);
  return username;
};
const token = async (login, pw) => (await call('auth.login', { login, password: pw })).data.token;
DB.sql.exec("INSERT INTO batches (batch_id, name, level, score_card, hearing_journal, tracks, class_day, started_on, sheet_tab) VALUES ('ETP-21', 'ETP · Batch 21', 'ETP', 'SPS', 'SPS/DPS', 'full', 'WED', '2026-09-28', 'ETP-21')");
await staff('sps', ['SPS2']); await staff('dps', ['DPS']); await staff('etp', ['ETP-21']);

const OTHER = 'Abhaya Vishnu Prabhuji';      // a second facilitator from the list
const join = async (phone, name, batchId, facilitator) => {
  await call('auth.signUp', { phone, name, batchId, facilitator, ...CONTACT, groupLeader: LEAD[batchId], password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000135' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  const r = await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  if (!r.ok) throw new Error('approve ' + phone + ' ' + JSON.stringify(r.error));
};
const [A, B, C, D] = ['6000000181', '6000000182', '6000000183', '6000000184'];
await join(A, 'Arjun Das', 'SPS2', FAC); await join(B, 'Bhima Das', 'SPS2', FAC); await join(C, 'Chandra Das', 'SPS2', OTHER); await join(D, 'Dhruva Das', 'DPS', FAC);
DB.sql.exec("UPDATE settings SET value = '2026-09-28' WHERE key = 'tracking_from'");
DB.sql.exec(`UPDATE memberships SET from_week = '2026-09-28' WHERE login IN ('${A}', '${B}', '${C}', '${D}')`);
DB.sql.exec(`INSERT INTO enrolments (batch_id, login, state, from_week, added_by, added_at) VALUES
  ('ETP-21', '${A}', 'ACTIVE', '2026-09-28', 'etp', '2026-09-28'), ('ETP-21', '${B}', 'ACTIVE', '2026-09-28', 'etp', '2026-09-28')`);

// the facilitator's own login, and a phase with their card
await call('facLogins.create', { username: 'natvar', facilitator: FAC, tempPassword: 'Temp-fac-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'natvar'");
await call('phases.open', { phaseId: 'kartik-t', name: 'Kartik T', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M);
const facId = rows('SELECT id FROM facilitators WHERE "name" = ?', FAC)[0].id;
const otherId = rows('SELECT id FROM facilitators WHERE "name" = ?', OTHER)[0].id;

const W1 = '2026-09-28', W2 = '2026-10-05';
const submit = (login, batch, week, overall, rounds, att) => DB.sql.exec(`INSERT INTO submissions (submission_id, login, name, batch_id, week_id, submitted_at,
    submitted_by, request_id, rules_version, bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall,
    seva_minutes, avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
  VALUES ('${login}-${week}', '${login}', 'x', '${batch}', '${week}', '${week}T19:00:00+05:30', '${login}', 'rq-${login}-${week}', 'r3',
    70, 50, 80, 80, 60, 80, 100, ${att === 'P' ? 100 : 0}, 70, 75, ${overall}, 300, '${rounds}', 'YES', 'YES', 100, 70, '[]', '{}')`);
const mark = (login, batch, week, m) => DB.sql.exec(`INSERT INTO attendance (login, week_id, batch_id, coordinator_mark, mark_used, changed_by, changed_at) VALUES ('${login}', '${week}', '${batch}', '${m}', '${m}', 'sps', '${week}')`);
// week 1: Arjun 60 and Dhruva 75 submit; Bhima and Chandra miss it
submit(A, 'SPS2', W1, 60, 8, 'P'); mark(A, 'SPS2', W1, 'P');
submit(D, 'DPS', W1, 75, 16, 'P'); mark(D, 'DPS', W1, 'P');
// week 2: Arjun 90, Bhima 70 and Dhruva 80 submit; Chandra misses again — he never fills in the period
submit(A, 'SPS2', W2, 90, 16, 'P'); mark(A, 'SPS2', W2, 'P');
submit(B, 'SPS2', W2, 70, '', 'A'); mark(B, 'SPS2', W2, 'A');
submit(D, 'DPS', W2, 80, 16, 'P'); mark(D, 'DPS', W2, 'P');
const close = async (when) => { at(when); let out = ''; for (let i = 0; i < 6 && !/closed|up to date/.test(out); i++) out = await runDeadline(env, DB, new Date(clock.now)); return out; };
await close('2026-10-05T21:05:00');
// the facilitator's card for week 2, before it closes
at('2026-10-11T10:00:00');
const F = await token('natvar', 'Temp-fac-2026');
await call('targets.set', { phaseId: 'kartik-t', targets: [{ measureId: 'stall', target: '5' }, { measureId: 'seniorMeet', target: '1' }] }, F);
await call('card.fill', { phaseId: 'kartik-t', weekId: W2, values: [{ measureId: 'stall', value: '4' }, { measureId: 'seniorMeet', value: '1' }] }, F);
await call('stages.set', { phaseId: 'kartik-t', stages: [{ stage: 'DPS', target: 1 }] }, F);
t.ok(/closed/.test(await close('2026-10-12T21:05:00')), 'both weeks are closed');
at('2026-10-13T10:00:00');
t.eq(rows(`SELECT COUNT(*) AS n FROM batch_weeks`)[0].n, 4, 'the summary holds both weeks of both batches');

const SPS = await token('sps', 'Temp-sps-2026'), ETP = await token('etp', 'Temp-etp-2026'), DEV = await token(C, 'Devotee pass 2026');
const Fn = await token('natvar', 'Temp-fac-2026');
const get = (data, tok = M) => call('report.get', data, tok);
const LAST = { from: '2026-10-05', to: '2026-10-11', compare: true };

/* ───────────────────────────── the period ───────────────────────────── */
let r = await get({ ...LAST, scope: { kind: 'all' } });
t.code(r, 'ok', 'the head builds a report for last week');
const rep = r.data || {};
t.eq([rep.from, rep.to, rep.days, rep.lastClosed, rep.weeks], ['2026-10-05', '2026-10-11', 7, W2, [W2]], 'a week: its dates, 7 days, the one closed week');
t.eq(rep.compare, { from: '2026-09-28', to: '2026-10-04', weeks: [W1] }, 'compared with the week before, of the same length');
r = await get({ from: '2026-10-01', to: '2026-10-31', compare: true, scope: { kind: 'all' } });
t.eq([r.data?.days, r.data?.weeks, r.data?.compare?.from, r.data?.compare?.to], [31, [W2], '2026-08-31', '2026-09-30'],
  'a month: the weeks whose Monday falls in it, never one still open; the 31 days before it to compare');
r = await get({ from: '2026-10-05', to: '2026-10-11', scope: { kind: 'all' } });
t.eq([r.ok, r.data?.compare], [true, null], 'compare off: no earlier period');
r = await get({ from: '2025-10-13', to: '2026-10-11', compare: true, scope: { kind: 'all' } });
t.eq([r.ok, r.data?.people?.cmp, r.data?.compare?.weeks?.length > 0, r.data?.people?.cur?.byBatch?.SPS2?.due], [true, null, true, 6],
  'a year: compared from the weekly sums only — the period before is not read person by person (2.0M rows at 5,000 devotees)');
t.code(await get({ from: '2025-10-01', to: '2026-09-30', scope: { kind: 'all' } }), 'ok', 'a year of 365 days is allowed');
t.code(await get({ from: '2024-10-01', to: '2025-09-30', scope: { kind: 'all' } }), 'ok', '… and a leap year of 366');
r = await get({ from: '2025-09-30', to: '2026-10-01', scope: { kind: 'all' } });
t.eq([r.ok ? 'ok' : r.error.code, r.error?.fields?.[0]?.path], ['VALIDATION', 'to'], 'longer than 366 days: a field error on the end date');
t.code(await get({ from: '01-10-2026', to: '2026-10-11' }), 'VALIDATION', 'dates as dates');
t.code(await get({ from: '2026-10-11', to: '2026-10-05' }), 'VALIDATION', 'the end after the start');
t.code(await get({ ...LAST, sections: ['nonsense'] }), 'VALIDATION', 'only known sections');
t.code(await get({ ...LAST, scope: { kind: 'planet' } }), 'VALIDATION', 'only known scopes');

/* ───────────────────────── the same numbers as the screens ───────────────────────── */
const an = await call('analysis.get', { from: '2026-09-28', to: '2026-10-11' }, M);
t.eq(rep.sadhana, an.data.weeks, 'sadhana rows: exactly what Analysis reads for the period and the one before');
const lb = await call('leaderboard.get', { period: 'custom', from: '2026-10-05', to: '2026-10-11' }, M);
t.eq(rep.leaderboard?.rows, lb.data.rows.slice(0, 10), 'top devotees: exactly the Leaderboard for the same dates');
t.eq(rep.leaderboard?.total, lb.data.total, '… with its count');
const bd = await call('board.get', { phaseId: 'kartik-t', weekId: W2 }, M);
t.eq(rep.board?.rows, bd.data.rows, "the scoreboard: exactly the facilitators' board for the period's last closed week");
t.eq([rep.board?.phaseId, rep.board?.weekId], ['kartik-t', W2], '… of the phase that week falls in');
const nat = (rep.facilitators || []).find((f) => f.facId === facId);
const natRow = bd.data.rows.find((x) => x.login === 'natvar');
t.eq(nat?.card, { seva: natRow.seva, sadhana: natRow.sadhana, goal: natRow.goal, rank: natRow.rank, place: natRow.place,
  weeksFilled: natRow.weeksFilled, weeks: natRow.weeks, filled: natRow.filled, asked: natRow.asked }, "the facilitator's scorecard is the board's own row");

/* ───────────────────────────── blank is not zero ───────────────────────────── */
t.eq(rep.people?.cur?.byBatch?.SPS2, { people: 3, never: 1, filled: 2, due: 3, score: 160 },
  'SPS Group 2 last week: 3 due, 2 filled, 1 never; the score sums only filled weeks (80 a week, not 53)');
t.eq(rep.people?.cmp?.byBatch?.SPS2, { people: 3, never: 2, filled: 1, due: 3, score: 60 }, '… and the week before');
t.eq(rep.people?.cur?.byFac?.[facId], { people: 3, never: 0, filled: 3, due: 3, score: 240 }, "by facilitator: Natvar's three students all filled");
t.eq(rep.people?.cur?.byFac?.[otherId], { people: 1, never: 1, filled: 0, due: 1, score: 0 }, "… the other facilitator's one never did");
t.eq(rep.students?.byFac?.[facId], 3, 'students now, by facilitator');
t.eq(rep.students?.total, 4, 'everyone in the batches now');
const spsWeek = rep.sadhana.find((w) => w.batchId === 'SPS2' && w.weekId === W2);
t.eq([spsWeek.submitted, spsWeek.missed, spsWeek.overall, spsWeek.nRounds, spsWeek.rounds], [2, 1, 160, 1, 16],
  'the summary keeps missed weeks apart and rounds over those who gave them');
t.eq(rep.work?.cur?.approved, 4, "coordinators' work: four sign-ups approved in the period");
t.ok(rep.health && rep.health.noFacilitator === 0 && rep.health.missingProfile === 0, 'data health: everyone has a facilitator and a profile');

/* ───────────────────────────── who may ask, and for what ───────────────────────────── */
t.code(await get({ ...LAST, scope: { kind: 'all' } }, SPS), 'FORBIDDEN', 'a coordinator without the right: refused');
t.code(await call('report.options', {}, SPS), 'FORBIDDEN', '… and no options either');
t.code(await get({ ...LAST, scope: { kind: 'all' } }, DEV), 'FORBIDDEN', 'a devotee: refused');
for (const login of ['sps', 'natvar', 'etp']) t.code(await call('access.set', { login, capability: 'reports', effect: 'allow', reason: 'the report test' }, M), 'ok', `the head gives ${login} Reports`);
const SPS2 = await token('sps', 'Temp-sps-2026'), ETP2 = await token('etp', 'Temp-etp-2026'), F2 = await token('natvar', 'Temp-fac-2026');
r = await get({ ...LAST, scope: { kind: 'all' } }, SPS2);
t.eq([r.ok, r.data?.scope?.kind, r.data?.scope?.batchIds], [true, 'batches', ['SPS2']], 'the coordinator asking for all of IYF gets their own batches');
t.ok(r.ok && r.data.sadhana.every((w) => w.batchId === 'SPS2') && r.data.sadhana.length === 2, '… only their batch in the sums');
const lbC = await call('leaderboard.get', { period: 'custom', from: '2026-10-05', to: '2026-10-11' }, SPS2);
t.eq(r.data?.leaderboard?.rows, lbC.data.rows, "… and their own Leaderboard's rows");
t.ok(r.ok && !r.data.leaderboard.rows.some((x) => x.login === D), "… never DPS's devotee");
t.eq(r.data?.board, null, '… no facilitators\' scoreboard: a class coordinator has none in the app');
t.ok(r.ok && !Object.keys(r.data.people.cur.byBatch).includes('DPS'), '… nor DPS in reporting');
t.code(await get({ ...LAST, scope: { kind: 'batch', id: 'DPS' } }, SPS2), 'FORBIDDEN', 'a coordinator cannot get another batch');
t.code(await get({ ...LAST, scope: { kind: 'batch', id: 'SPS2' } }, SPS2), 'ok', '… their own, yes');
t.code(await get({ ...LAST, scope: { kind: 'facilitator', id: facId } }, SPS2), 'FORBIDDEN', '… nor a facilitator');
t.code(await get({ ...LAST, scope: { kind: 'training', id: 'ETP-21' } }, SPS2), 'FORBIDDEN', '… nor a training');
const opts = await call('report.options', {}, SPS2);
t.eq(opts.data?.scopes?.map((s) => s.kind), ['all', 'batch'], 'the options offer the coordinator only what the server allows');
t.eq(opts.data?.scopes?.[1]?.items?.map((b) => b.id), ['SPS2'], '… their own batch');
const optsM = await call('report.options', {}, M);
t.eq(optsM.data?.scopes?.map((s) => s.kind), ['all', 'batch', 'facilitator', 'training'], 'the head: every scope');
t.ok(optsM.data?.phases?.some((p) => p.phaseId === 'kartik-t') && optsM.data?.trainings?.some((x) => x.batchId === 'ETP-21'), '… with the phases and trainings to pick as a period');

// the facilitator: their own students, whatever they ask
r = await get({ ...LAST, scope: { kind: 'all' } }, F2);
t.eq([r.ok, r.data?.scope?.kind, r.data?.scope?.facId], [true, 'facilitator', facId], 'a facilitator asking for all gets their own students');
t.eq(r.data?.leaderboard?.rows?.map((x) => x.login).sort(), [A, B, D].sort(), '… only their students ranked');
t.ok(r.ok && !JSON.stringify(r.data).includes(C), "… and nothing about another facilitator's student");
const dpsBw = an.data.weeks.filter((w) => w.batchId === 'DPS');
t.eq(r.data?.sadhana?.filter((w) => w.batchId === 'DPS'), dpsBw, "their students' sums: DPS (all theirs) equals the batch summary");
t.eq(r.data?.sadhana?.find((w) => w.batchId === 'SPS2' && w.weekId === W2)?.submitted, 2, '… SPS Group 2 counts only their two');
t.eq(r.data?.sadhana?.find((w) => w.batchId === 'SPS2' && w.weekId === W2)?.missed, 0, "… and not the other facilitator's missed week");
t.eq(r.data?.board?.rows?.map((x) => x.login), ['natvar'], '… their own place on the board, alone');
t.code(await get({ ...LAST, scope: { kind: 'facilitator', id: otherId } }, F2), 'FORBIDDEN', 'a facilitator cannot get another facilitator');
t.code(await get({ ...LAST, scope: { kind: 'batch', id: 'SPS2' } }, F2), 'FORBIDDEN', '… nor a batch');

// the training coordinator: their own training
r = await get({ ...LAST, scope: { kind: 'training', id: 'ETP-21' } }, ETP2);
t.eq([r.ok, r.data?.scope?.kind, r.data?.scope?.trainingIds], [true, 'training', ['ETP-21']], 'a training coordinator gets their training');
t.eq(r.data?.trainings?.map((x) => [x.batchId, x.active]), [['ETP-21', 2]], '… its enrolled');
t.eq(r.data?.leaderboard?.rows?.map((x) => x.login).sort(), [A, B].sort(), "… and its trainees' sadhana only");
const bdT = await call('board.get', { batchId: 'ETP-21', weekId: W2 }, ETP2);
t.eq(r.data?.board?.rows, bdT.data.rows, "… the training's own scoreboard");
t.code(await get({ ...LAST, scope: { kind: 'batch', id: 'SPS2' } }, ETP2), 'FORBIDDEN', 'a training coordinator cannot get a class batch');
r = await get({ ...LAST, scope: { kind: 'all' } }, ETP2);
t.eq(r.data?.scope?.trainingIds, ['ETP-21'], '… and "all" means their trainings');

// the head picks any one
t.code(await get({ ...LAST, scope: { kind: 'batch', id: 'DPS' } }, M), 'ok', 'the head: any batch');
t.code(await get({ ...LAST, scope: { kind: 'facilitator', id: 'F999' } }, M), 'NOT_FOUND', '… a facilitator who does not exist is not found');
t.code(await get({ ...LAST, scope: { kind: 'batch', id: 'ETP-21' } }, M), 'VALIDATION', '… a training is not a class batch');
// sections: only what was asked is read
r = await get({ ...LAST, scope: { kind: 'all' }, sections: ['reporting'] }, M);
t.ok(r.ok && r.data.sadhana.length > 0 && r.data.leaderboard === null && r.data.board === null && r.data.work === null && r.data.trainings === null,
  'one section ticked: only its figures are read');

/* ───────────────────────────── one call, its round trips ───────────────────────────── */
let hops = 0, batches = [];
const realPrepare = DB.prepare.bind(DB), realBatch = DB.batch.bind(DB);
DB.prepare = (s) => { const wrap = (x) => ({ ...x, s: x.s, args: x.args, bind: (...a) => wrap(x.bind(...a)),
  first: async () => { hops++; return x.first(); }, all: async () => { hops++; return x.all(); }, run: async () => { hops++; return x.run(); } });
  return wrap(realPrepare(s)); };
DB.batch = async (list) => { hops++; batches.push(list.map((x) => x.s)); return realBatch(list); };
const M2 = await token('master', 'Master pass 2026');
hops = 0; batches = [];
r = await get({ ...LAST, scope: { kind: 'all' } }, M2);
const mine = batches.filter((b) => b.some((s) => /FROM batch_weeks/.test(s)));
t.eq(mine.length, 1, "the report's own statements go in ONE batch");
t.ok(mine[0] && ['WITH w AS', 'FROM audit_log', 'FROM activity_events', 'FROM memberships', 'FROM enrolments'].every((k) => mine[0].some((s) => s.includes(k))),
  '… the leaderboard, the audit log, the activity, the people and the trainings among them');
// 15 = the session (2) + Settings and the phases side by side (2) + the report's ONE batch (1) + beside it, at the same
// time: board.get's own reads (5 in a row), the head's orphans (3, at once) and possible duplicates (3). Waited for in a
// row: 2 + 1 + 5 = 8, the scoreboard being the longest branch.
t.ok(r.ok && hops <= 15, `a whole report for the head: ${hops} round trips (budget 15, see above)`);
hops = 0;
r = await get({ ...LAST, scope: { kind: 'all' }, sections: ['reporting', 'quality'] }, M2);
t.ok(r.ok && hops <= 5, `reporting and quality alone: ${hops} round trips (budget 5)`);
DB.prepare = realPrepare; DB.batch = realBatch;

t.done();
