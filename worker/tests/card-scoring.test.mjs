// The facilitation card's scoring, as the head's Excel card and the dashboard define it (ADR 0012, 22 Oct 2026).
//
// Every expected figure below was worked out BY HAND from the head's card, not read back from the code: a test that
// copies the code's answer proves nothing about whether the answer is right.
//
//   sadhana %  the average of their weekly Sadhna (the app offers it from their submitted week)
//   seva %     the WEEKLY lead measures (1–6) per week, and the four MONTHLY ones (7–10) once per CLOSED month
//   goal %     their OWN students who became eligible for promotion, against their per-level targets, over the
//              phase (a facilitator) or their training batch (an ETP trainee), to the last finished week
//   net        (sadhana + seva + goal) ÷ 3, as the dashboard
//   rank       (seva + goal) ÷ 2 — the head's rule for this app's scoreboard; sadhana is shown, not ranked
import { boot, suite, FAC, CONTACT, LEAD } from './harness.mjs';
import { weekPct, monthPct, sadhanaPct } from '../src/phases.js';

const t = suite('the facilitation card: weekly and monthly, sadhana apart, the goal from eligibility');

/* ── the maths, before any plumbing ──────────────────────────────────────── */
{
  const ms = [
    { measure_id: 'sadhna', kind: 'NUMBER', frequency: 'WEEKLY', source: 'week_score' },
    { measure_id: 'stall', kind: 'NUMBER', frequency: 'WEEKLY', source: '' },
    { measure_id: 'ftp', kind: 'YESNO', frequency: 'WEEKLY', source: '' },
    { measure_id: 'seniorMeet', kind: 'NUMBER', frequency: 'MONTHLY', source: '' },
    { measure_id: 'journal', kind: 'YESNO', frequency: 'MONTHLY', source: '' }
  ];
  const T = { sadhna: { target: '80' }, stall: { target: '5' }, ftp: { target: 'YES' }, seniorMeet: { target: '1' }, journal: { target: 'YES' } };

  // a week's seva is the weekly lead measures only: Sadhna is sadhana, and the monthly four wait for their month
  t.eq(weekPct(ms, T, { sadhna: { value: '90' }, stall: { value: '5' }, ftp: { value: 'YES' } }), 100,
    'a week: stall 5/5 and FTP yes is 100 — Sadhna and the monthly measures are not in it');
  t.eq(weekPct(ms, T, { stall: { value: '0' }, ftp: { value: 'NO' } }), 0,
    'and an empty week is 0, not dragged up by a monthly measure filled some other week');
  t.eq(weekPct(ms, { seniorMeet: { target: '1' } }, { seniorMeet: { value: '1' } }), null,
    'a person asked only monthly measures has no WEEKLY seva at all — not a nought');

  // a month's figure: the monthly measures over every week of the month, counted once
  t.eq(monthPct(ms, T, [{ seniorMeet: { value: '1' } }, { journal: { value: 'YES' } }]), 100,
    'met once in the month, in different weeks: 100');
  t.eq(monthPct(ms, { seniorMeet: { target: '2' } }, [{ seniorMeet: { value: '1' } }, { seniorMeet: { value: '1' } }]), 100,
    'a number is added up across the month: 1 + 1 meets a target of 2');
  t.eq(monthPct(ms, T, [{}, {}]), 0, 'asked and never filled in the month is 0');
  t.eq(monthPct(ms, { stall: { target: '5' } }, [{ stall: { value: '5' } }]), null, 'no monthly measure asked: no monthly figure');

  // sadhana is its own figure, the raw score (it is already out of 100), never measured against a target
  t.eq(sadhanaPct(ms, [{ sadhna: { value: '90' } }, { sadhna: { value: '70' } }]), 80, 'sadhana: the average of 90 and 70');
  t.eq(sadhanaPct(ms, [{ stall: { value: '5' } }]), null, 'no Sadhna filled: no sadhana figure');
}

/* ── one facilitator, end to end ─────────────────────────────────────────── */
const { DB, call, clock, rows, addAccount } = boot();
clock.now = Date.parse('2026-11-10T10:00:00+05:30');      // a Tuesday: the week of 3 Nov is the last finished one
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('phases.open', { phaseId: 'kartik-t', name: 'Kartik T', startsOn: '2026-09-01', endsOn: '2026-12-31' }, M);
// this suite is about the scoring maths, and changes level targets in November to try each case: targets are fixed after
// the start of a phase since phase 21 (ADR 0018, target-lock.test), so its phase keeps them open to the end
await call('phases.update', { phaseId: 'kartik-t', targetsUntil: '2026-12-31' }, M);

const person = async (phone, name, batchId = 'SPS') => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, groupLeader: LEAD[batchId], password: 'Devotee pass 2026',
    profile: { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const F = await person('6000000171', 'Fac One');
// a facilitator is a row of the facilitator list (Phase 24: students point to it by id), as every facilitator login is
DB.sql.exec(`INSERT INTO facilitators ("name", "in_cohort", "order") VALUES ('Fac One', 0, 90), ('Fac Two', 0, 91)`);
DB.sql.exec("UPDATE accounts SET facilitator_name = 'Fac One' WHERE login = '6000000171'");

await call('targets.set', { phaseId: 'kartik-t', targets: [
  { measureId: 'sadhna', target: '80' }, { measureId: 'stall', target: '5' }, { measureId: 'ftp', target: 'YES' },
  { measureId: 'seniorMeet', target: '1' }, { measureId: 'journal', target: 'YES' }] }, F);
t.code(await call('card.fill', { phaseId: 'kartik-t', weekId: '2026-10-05', values: [
  { measureId: 'sadhna', value: '90' }, { measureId: 'stall', value: '5' }, { measureId: 'ftp', value: 'YES' },
  { measureId: 'seniorMeet', value: '1' }, { measureId: 'journal', value: 'YES' }] }, F), 'ok', 'October, week 1: all met, monthly ones too');
t.code(await call('card.fill', { phaseId: 'kartik-t', weekId: '2026-10-12', values: [
  { measureId: 'sadhna', value: '70' }, { measureId: 'stall', value: '0' }, { measureId: 'ftp', value: 'NO' }] }, F), 'ok', 'October, week 2: nothing done');
// a monthly measure in a month that has not closed (November): shown on the card, not yet scored
t.code(await call('card.fill', { phaseId: 'kartik-t', weekId: '2026-11-02', values: [{ measureId: 'seniorMeet', value: '1' }] }, F), 'ok',
  'November, a monthly measure: filled');

let card = (await call('card.get', { phaseId: 'kartik-t', weekId: '2026-11-02' }, F)).data;
// the card's two groups, as the paper card draws them (ADR 0012 G)
const groupOf = Object.fromEntries(card.measures.map(m => [m.measureId, m.group]));
t.eq([groupOf.sadhna, groupOf.stall, groupOf.vl23att, groupOf.oneToOne, groupOf.journal], ['sadhana', 'vl2reg', 'vl2reg', 'target', 'target'],
  'Sadhna on its own; 1–4 under Vedic Level 2 registration; 5–10 under Target');
t.eq(card.groups?.map(g => g.label), ['Sadhna', 'Vedic Level 2 registration', 'Target'], 'and the groups are named for the screen');
t.eq(card.measures.filter(m => m.frequency === 'MONTHLY').map(m => m.measureId), ['seniorMeet', 'seriousOne', 'allMeet', 'journal'],
  'the four monthly measures, exactly as on the card');
t.eq(card.phase.sadhana, 80, 'sadhana is its own figure: the average of 90 and 70 (the old code said 59)');
t.eq(card.phase.seva, 67, 'seva: weeks 100 and 0, and October 100 — (100 + 0 + 100) / 3 = 67; November is not closed yet');
t.eq(card.phase.months?.map(m => [m.month, m.pct]), [['2026-10', 100]], 'October is counted once; November waits for its month to end');
t.eq(card.score.goalPct, null, 'no stage target yet: there is no goal figure, so it is left out (not counted as 0)');
t.eq(card.score.score, 74, 'net = (80 + 67) / 2 = 74 while there is no goal — sadhana and seva are DIFFERENT figures now');

/* ── the goal: their own students who became eligible ────────────────────── */
// a student of Fac One in SPS Group 2, which (for this test) promotes on a sadhana average of 80 alone
const S = '6000000172';
await person(S, 'Student One', 'SPS2');
DB.sql.exec(`UPDATE memberships SET facilitator = 'Fac One' WHERE login = '${S}' AND to_week = ''`);
DB.sql.exec("INSERT INTO promotion_criteria (batch_id, criterion, min_value, set_by, set_at) VALUES ('SPS2', 'sad', '80', 'test', '2026-09-01')");
const submit = (login, week, overall) => DB.sql.exec(`INSERT INTO submissions (submission_id, login, name, batch_id, week_id, submitted_at,
    submitted_by, request_id, rules_version, bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall,
    seva_minutes, avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
  VALUES ('${login}-${week}', '${login}', 'x', 'SPS2', '${week}', '2026-10-01T19:00:00+05:30', '${login}', 'rq-${login}-${week}', 'r1',
    80, 80, 80, 80, 80, 80, 100, 100, 80, 80, ${overall}, 300, '8', 'YES', 'YES', 210, 140, '[]', '{}')`);
submit(S, '2026-10-05', 85); submit(S, '2026-10-12', 85);

await call('stages.set', { phaseId: 'kartik-t', stages: [{ stage: 'DPS', target: 1 }] }, F);
card = (await call('card.get', { phaseId: 'kartik-t', weekId: '2026-11-02' }, F)).data;
const dps = card.score.stages.find(s => s.stage === 'DPS');
t.eq([dps.target, dps.eligible, dps.promoted], [1, 1, 0], 'one student of theirs is eligible for DPS (none promoted yet)');
t.eq(card.score.goalPct, 100, 'the goal is scored on ELIGIBLE students: 1 of 1');
t.eq(card.score.score, 82, 'net = (80 + 67 + 100) / 3 = 82');

// a surplus at one level does not fill another's target (MetricsService.gs): 1 eligible for DPS, targets DPS 1 + BSS 1
await call('stages.set', { phaseId: 'kartik-t', stages: [{ stage: 'DPS', target: 1 }, { stage: 'BSS', target: 1 }] }, F);
t.eq((await call('card.get', { phaseId: 'kartik-t', weekId: '2026-11-02' }, F)).data.score.goalPct, 50, '1 of 2 levels met: 50');
await call('stages.set', { phaseId: 'kartik-t', stages: [{ stage: 'DPS', target: 1 }, { stage: 'BSS', target: 0 }] }, F);

// a student of somebody else does not count for them
await person('6000000173', 'Not Theirs', 'SPS2');
submit('6000000173', '2026-10-05', 95);
card = (await call('card.get', { phaseId: 'kartik-t', weekId: '2026-11-02' }, F)).data;
t.eq(card.score.stages.find(s => s.stage === 'DPS').eligible, 1, "another facilitator's eligible student is not counted for them");

/* ── an ETP trainee: the goal runs from their TRAINING's start, not the phase's ─── */
await call('batches.create', { batchId: 'ETP-61', name: 'ETP Batch 61', level: 'ETP', startedOn: '2026-11-10', endsOn: '2027-06-30' }, M);
DB.sql.exec("UPDATE batches SET started_on = '2026-10-12' WHERE batch_id = 'ETP-61'");
await call('coordinators.create', { username: 'etp61', name: 'Etp Sixtyone', batchIds: ['ETP-61'], tempPassword: 'Temp-e61-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'etp61'");
const E = (await call('auth.login', { login: 'etp61', password: 'Temp-e61-2026' })).data.token;
const TR = await person('6000000174', 'Trainee One');
await call('enrol.add', { batchId: 'ETP-61', login: '6000000174' }, E);
const tname = rows("SELECT facilitator_name AS f FROM accounts WHERE login = '6000000174'")[0].f;
// two students of the trainee: one eligible only BEFORE the training began, one after
await person('6000000175', 'Before Training', 'SPS2');
await person('6000000176', 'During Training', 'SPS2');
DB.sql.exec(`UPDATE memberships SET facilitator = '${tname}' WHERE login IN ('6000000175', '6000000176') AND to_week = ''`);
submit('6000000175', '2026-10-05', 90);                    // before 12 Oct
submit('6000000176', '2026-10-19', 90);                    // during the training
await call('stages.set', { phaseId: 'kartik-t', stages: [{ stage: 'DPS', target: 2 }] }, TR);
const tcard = (await call('card.get', { phaseId: 'kartik-t', weekId: '2026-11-02' }, TR)).data;
t.eq(tcard.score.stages.find(s => s.stage === 'DPS').eligible, 1,
  "a trainee's goal counts from their training's start (12 Oct): the student eligible only before it does not count");
t.eq(tcard.score.goalPct, 50, 'so 1 of 2');

/* ── the scoreboard ranks on seva and goal ───────────────────────────────── */
// a second facilitator with a perfect week and no stage target at all
const G = await person('6000000177', 'Fac Two');
DB.sql.exec("UPDATE accounts SET facilitator_name = 'Fac Two' WHERE login = '6000000177'");
await call('targets.set', { phaseId: 'kartik-t', targets: [{ measureId: 'stall', target: '5' }] }, G);
await call('card.fill', { phaseId: 'kartik-t', weekId: '2026-10-05', values: [{ measureId: 'stall', value: '5' }] }, G);
const board = (await call('board.get', { phaseId: 'kartik-t', weekId: '2026-11-02' }, M)).data;
const one = board.rows.find(r => r.login === '6000000171'), two = board.rows.find(r => r.login === '6000000177');
t.eq([one.seva, one.goal, one.rank], [67, 100, 84], "Fac One ranks on (seva + goal) / 2 = (67 + 100) / 2 = 84");
t.eq([two.seva, two.goal], [100, null], 'Fac Two: seva 100, no target set');
t.ok(board.rows.indexOf(one) < board.rows.indexOf(two),
  'somebody with a target ranks before somebody never given one, as the dashboard does — even with a lower seva');
t.eq(one.sadhana, 80, 'sadhana is on the row, shown, but not what the rank is made of');

/* ── who sees which board (the head, 22 Oct 2026 — ADR 0016) ─────────────── */
// the head and a training's coordinator see the whole board; a facilitator and a trainee see their OWN row and their
// place on it ("own card + own rank"), never another person's name or figures
t.eq(one.place, 1, 'every row carries its place: Fac One is first');
t.eq(two.place, null, 'somebody never given a target has no place, not a last one');
t.eq(board.of, board.rows.length, `and the board says how many are on it (${board.rows.length})`);

let mine = await call('board.get', { phaseId: 'kartik-t', weekId: '2026-11-02' }, G);
t.code(mine, 'ok', 'a facilitator opens the facilitators’ board');
t.eq(mine.data.rows.map(r => r.login), ['6000000177'], '… and sees only their own row');
t.eq([mine.data.self, mine.data.of], [true, board.rows.length], '… with how many they are ranked among');
mine = (await call('board.get', { phaseId: 'kartik-t', weekId: '2026-11-02' }, F)).data;
t.eq([mine.rows.length, mine.rows[0].place, mine.rows[0].rank], [1, 1, 84], 'Fac One sees: first, on 84');
const offered = (await call('board.list', {}, G)).data.boards;
t.eq(offered.map(b => [b.kind, b.self]), [['facilitators', true]], 'board.list offers a facilitator their own place only');

const tb = await call('board.get', { phaseId: 'kartik-t', weekId: '2026-11-02', batchId: 'ETP-61' }, TR);
t.code(tb, 'ok', "a trainee opens their training's board");
t.eq([tb.data.rows.map(r => r.login), tb.data.self], [['6000000174'], true], '… their own row only');
t.eq((await call('board.list', {}, TR)).data.boards.map(b => [b.kind, b.batchId, b.self]), [['training', 'ETP-61', true]],
  "board.list offers a trainee their training's board, not the facilitators'");
t.code(await call('board.get', { phaseId: 'kartik-t' }, TR), 'FORBIDDEN', "a trainee's place is on their training's board");
t.code(await call('board.get', { phaseId: 'kartik-t', batchId: 'ETP-61' }, G), 'FORBIDDEN', 'nobody sees a training they are not in');
const ST = (await call('auth.login', { login: S, password: 'Devotee pass 2026' })).data.token;
t.code(await call('board.get', { phaseId: 'kartik-t' }, ST), 'FORBIDDEN', 'a devotee who facilitates nobody sees no board');
t.eq((await call('board.list', {}, ST)).data.boards, [], '… and is offered none');
const eb = (await call('board.get', { phaseId: 'kartik-t', weekId: '2026-11-02', batchId: 'ETP-61' }, E)).data;
t.eq([eb.self, eb.rows.length], [false, 1], "the training's coordinator sees the whole board");

// tapping a row opens the same card the person sees for themselves, read-only
t.code(await call('card.of', { login: '6000000177', phaseId: 'kartik-t' }, G), 'ok', 'a facilitator opens their own card from the board');
t.code(await call('card.of', { login: '6000000171', phaseId: 'kartik-t' }, G), 'FORBIDDEN', "… and nobody else's");
const hc = (await call('card.of', { login: '6000000171', phaseId: 'kartik-t', weekId: '2026-11-02' }, M)).data;
t.eq([hc.person, hc.name, hc.groups?.length, hc.state], ['Fac One', 'Kartik T', 3, 'OPEN'],
  "the head's view carries what the card screen needs: whose it is, the phase, the groups, whether it is open");
t.eq(hc.score.ready?.map(x => [x.name, x.stage]), [['Student One', 'DPS']],
  'and the students behind the goal, by name, as the dashboard lists who is ready to move up');
t.eq(hc.phase.trend.map(w => w.weekId), ['2026-10-05', '2026-10-12'], 'and their recorded weeks');

/* ── the month scorecard (ADR 0012 D): one row per CLOSED month — sadhana, seva, goal, net ─────────── */
let mo = await call('card.months', { phaseId: 'kartik-t' }, F);
t.code(mo, 'ok', 'a facilitator reads their own month scorecard');
const oct = mo.data.months.find(m => m.month === '2026-10');
t.eq([oct.sadhana, oct.seva, oct.goal, oct.net], [80, 67, 100, 82],
  'October: sadhana (90 + 70) / 2 = 80; seva of weeks 100 and 0 and the month 100 = 67; goal 1 of 1 eligible = 100; net 82');
t.ok(!mo.data.months.some(m => m.month === '2026-11'), 'November has not ended: no row yet');
const sep = mo.data.months.find(m => m.month === '2026-09');
t.eq([sep.filled, sep.sadhana, sep.seva, sep.net], [0, null, null, null], 'September, nothing filled: "not filled", never a nought');
t.code(await call('card.months', { login: '6000000171', phaseId: 'kartik-t' }, M), 'ok', "the head reads anyone's");
t.code(await call('card.months', { login: '6000000171', phaseId: 'kartik-t' }, G), 'FORBIDDEN', "a facilitator cannot read another's");
t.code(await call('card.months', { login: '6000000174', phaseId: 'kartik-t' }, E), 'ok', "a training's coordinator reads their trainee's");

t.done();
