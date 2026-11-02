// TRD scored the COSATOK way (Phase 22, K2; the head, 23 Oct 2026; docs/PHASE22_BACKLOG_2026-10-23.md §2): the temple
// residents leave the SPS card for COSATOK's "Marking Scheme · Level: TRD". Every item slides in a straight line between
// two points, unfilled = 0, chanting not finished the same day = 0 (time AND rounds), the Morning program (the four temple
// activities) on time 5 · late 3 · absent 0. Overall = the week's day marks ÷ (7 × the day's maximum) × 100; the
// per-measure columns are each item's week marks ÷ (7 × its maximum) × 100; class attendance recorded, not scored.
// Every expected number below was worked out by hand (the report lists the sums), never copied from the code's output.
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';
import { CARDS, CARD_TRD, NO_ATTENDANCE_CARDS } from '../src/cards.js';
import { dayMarks, weekScores } from '../src/scoring.js';
import { dayPercent } from '../../shared/scoring.js';
import { runDeadline } from '../src/weeks.js';
import { finalScores } from '../src/classweek.js';
import { TEMPLE_KEYS } from '../../shared/temple.js';

const t = suite('phase 22: TRD scored the COSATOK way');

/* ── 1. the card is the head's two screenshots ── */
const C = CARDS[CARD_TRD];
const pts = (k) => [C[k].field || C[k].fields.join('+'), C[k].full, C[k].zero, C[k].marks];
t.eq(['to_bed', 'wake_up', 'japa', 'rounds', 'day_sleep', 'sravan', 'pathan', 'seva'].map(pts), [
  ['sleptAt', '22:00', '22:30', 25], ['wokeAt', '04:00', '04:50', 25], ['chantingDoneAt', '07:15', '17:00', 25], ['rounds', 16, 0, 10],
  ['dayRestMin', 60, 110, 25], ['hearingMin', 60, 0, 25], ['readingMin', 60, 0, 25], ['serviceMin', 360, 0, 25]],
  'each item: its answer, full marks at / zero at, and its maximum, as in COSATOK\'s TRD scheme');
t.eq([C.morning.fields, C.morning.answers, C.morning.marks], [TEMPLE_KEYS, { ON_TIME: 5, LATE: 3, ABSENT: 0 }, 20], 'the Morning program: the four temple activities, 5 / 3 / 0 each');
t.eq(C.dayMax, C.items.reduce((n, k) => n + C[k].marks, 0), 'the day\'s maximum is the items\' own (7 × 25 + 10 + 20)');
t.eq(C.dayMax, 205, '= 205');
t.eq(NO_ATTENDANCE_CARDS, ['TRD'], 'only the TRD card leaves class attendance out of the score');

/* ── 2. worked days (by hand) ── */
const A = { sleptAt: '22:10', wokeAt: '04:25', rounds: 16, chantingDoneAt: '07:00', chantingSameDay: true, dayRestMin: 85, hearingMin: 30, hearing: [{ text: 'Bhagavad-gita class' }],
  readingMin: 60, reading: { text: 'Bhagavad-gita As It Is' }, serviceMin: 90, mangalAarti: 'ON_TIME', darshanAarti: 'LATE', morningClass: 'ABSENT' };
const B = { sleptAt: '00:30', wokeAt: '03:30', rounds: 16, chantingDoneAt: '23:00', chantingSameDay: false, dayRestMin: 0, hearingMin: 90, hearing: [{ text: 'Kirtan lecture' }],
  readingMin: 0, serviceMin: 400, mangalAarti: 'ON_TIME', darshanAarti: 'ON_TIME', morningClass: 'ON_TIME', prasadam: 'ON_TIME' };
const P = { sleptAt: '21:45', wokeAt: '04:00', rounds: 20, chantingDoneAt: '07:15', chantingSameDay: true, dayRestMin: 60, hearingMin: 60, hearing: [{ text: 'Srimad-Bhagavatam class' }],
  readingMin: 60, reading: { text: 'Nectar of Devotion' }, serviceMin: 360, mangalAarti: 'ON_TIME', darshanAarti: 'ON_TIME', morningClass: 'ON_TIME', prasadam: 'ON_TIME' };
const D = { sleptAt: '22:30', wokeAt: '04:50', rounds: 8, chantingDoneAt: '17:00', chantingSameDay: true, dayRestMin: 110, hearingMin: 15, hearing: [{ text: 'Short talk' }],
  readingMin: 45, reading: { text: 'Bhagavad-gita As It Is' }, serviceMin: 180 };
const just = (d) => Object.fromEntries(Object.entries(dayMarks(CARD_TRD, d)).map(([k, m]) => [k, m.marks]));
// A: sleep 22:10 = 20 of 30 min before zero → 25 × 20/30 = 16.67 · wake 04:25 = 25 of 50 → 12.5 · done 07:00 ≤ 07:15 → 25 ·
//    16 rounds → 10 · rest 85 = 25 of 50 → 12.5 · hearing 30/60 → 12.5 · reading 60 → 25 · service 90/360 → 6.25 ·
//    morning 5 + 3 + 0 (prasadam unanswered = 0) = 8.  Total 128.42 / 205 = 62.64 % → 63
t.eq(just(A), { to_bed: 16.67, wake_up: 12.5, japa: 25, rounds: 10, day_sleep: 12.5, sravan: 12.5, pathan: 25, seva: 6.25, morning: 8 }, 'day A, item by item');
t.eq([dayPercent(dayMarks(CARD_TRD, A)).total, dayPercent(dayMarks(CARD_TRD, A)).outOf, dayPercent(dayMarks(CARD_TRD, A)).percent], [128.42, 205, 63], 'day A: 128.42 of 205 = 63 %');
// B: slept 00:30 (after midnight: later than 22:30) → 0 · woke 03:30 → 25 · NOT the same day → chanting time 0 AND rounds 0 ·
//    rest 0 → 25 · hearing 90 → 25 · reading 0 → 0 · service 400 → 25 · morning 4 × 5 = 20.  Total 120 / 205 = 58.54 % → 59
t.eq(just(B), { to_bed: 0, wake_up: 25, japa: 0, rounds: 0, day_sleep: 25, sravan: 25, pathan: 0, seva: 25, morning: 20 }, 'day B: after midnight, not the same day');
t.eq(dayPercent(dayMarks(CARD_TRD, B)).percent, 59, 'day B: 120 of 205 = 59 %');
t.eq(dayMarks(CARD_TRD, B).japa.label, 'Not the same day', 'and says why the chanting scored 0');
// P: every item at or past its full-marks point → 205 / 205 = 100 %
t.eq(dayPercent(dayMarks(CARD_TRD, P)), { total: 205, outOf: 205, percent: 100, complete: true }, 'day P: a perfect day is 205 of 205 = 100 %');
// D: exactly ON every zero point (22:30, 04:50, 17:00, 110 min) → 0 each · 8 rounds = half of 16 → 5 · hearing 15 → 6.25 ·
//    reading 45 → 18.75 · service 180 → 12.5 · no morning answers → 0.  Total 42.5 / 205 = 20.73 % → 21
t.eq(just(D), { to_bed: 0, wake_up: 0, japa: 0, rounds: 5, day_sleep: 0, sravan: 6.25, pathan: 18.75, seva: 12.5, morning: 0 }, 'day D: on the zero points, half the rounds');
t.eq(dayPercent(dayMarks(CARD_TRD, D)).percent, 21, 'day D: 42.5 of 205 = 21 %');
t.eq(dayMarks(CARD_TRD, D).morning.label, 'Not filled', 'unfilled Morning program: 0, said as not filled');
t.eq(just({ sleptAt: '21:00', chantingDoneAt: '06:00' }), { to_bed: 25, wake_up: 0, japa: 0, rounds: 0, day_sleep: 0, sravan: 0, pathan: 0, seva: 0, morning: 0 },
  'a part day while typing: before full marks is full marks; the chanting time waits for "same day"; everything unfilled is 0');
t.eq(just({ chantingDoneAt: '12:00', chantingSameDay: true }).japa, 12.82, 'chanting at 12:00: 25 × (17:00 − 12:00) / (17:00 − 07:15) = 25 × 300/585 = 12.82');
t.ok(Object.values(dayMarks(CARD_TRD, { sleptAt: '03:00', wokeAt: '11:00', dayRestMin: 600, hearingMin: 0 })).every((m) => m.marks >= 0), 'no negative marks on this card');

/* ── 3. the week (by hand): A, B, P, D complete; a part day and two empty ones count 0 ── */
// bed 41.67/175 = 23.81 → 24 · wake 62.5/175 → 36 · rest 62.5 → 36 · japa 50/175 = 28.57 → 29 · reading 68.75/175 = 39.29 → 39 ·
// hearing 68.75 → 39 · service 68.75 → 39 · morning 48/140 = 34.29 → 34 · body avg(24, 36, 36) = 32 · soul avg(29, 39, 39) = 35.67 → 36
// overall (128.42 + 120 + 205 + 42.5) / (7 × 205) = 495.92 / 1435 = 34.56 % → 35 — whatever the attendance
const WEEK = { bed: 24, wake_up: 36, day_sleep: 36, japa: 29, pathan: 39, sravan: 39, seva: 39, morning: 34, body: 32, soul: 36, overall: 35 };
const pick = (s) => Object.fromEntries(Object.keys(WEEK).map((k) => [k, s[k]]));
const w7 = [A, B, P, D, {}, {}, {}];
t.eq(pick(weekScores(CARD_TRD, w7, 'P', 0)), WEEK, 'the week: every column by hand');
t.eq([weekScores(CARD_TRD, w7, 'P', 0).attendance, weekScores(CARD_TRD, w7, 'A', 0).attendance], [100, 0], 'attendance is recorded (100 / 0)');
t.eq(weekScores(CARD_TRD, w7, 'A', 0).overall, 35, 'and not scored: absent leaves Overall at 35');
t.eq(weekScores(CARD_TRD, [P, P, P, P, P, P, P], 'A', 0).overall, 100, 'seven perfect days are 100 even when absent from class');
t.eq(weekScores(CARD_TRD, [P, {}, {}, {}, {}, {}, {}], 'P', 0).overall, 14, 'one perfect day of seven: 205 / 1435 = 14 (a part week is capped by its days)');
t.eq(finalScores({ score_card: 'TRD', attendance: 100, overall: 35, body: 32, soul: 36, seva: 39 }, 'A'), { score_card: 'TRD', attendance: 0, overall: 35, body: 32, soul: 36, seva: 39 },
  'a later Absent mark changes the attendance shown, never a TRD Overall');
t.eq(finalScores({ score_card: 'SPS', attendance: 100, overall: 80, body: 80, soul: 80, seva: 60 }, 'A').overall, 55, 'an SPS week is still re-worked: (80 + 80 + 0 + 60) / 4 = 55');
t.eq(finalScores({ attendance: 100, overall: 80, body: 80, soul: 80, seva: 60 }, 'A').overall, 55, 'and so is a row without score_card (before migration 0065)');

/* ── 4. end to end: a temple resident fills, submits, is marked absent; the deadline; the board; Analysis ── */
const { env, DB, call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const PROFILE = { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
  address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const join = async (phone, batchId, name) => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, groupLeader: LEAD[batchId] || 'Hari Das Pr', password: 'Devotee pass 2026', profile: PROFILE });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
t.eq(rows("SELECT score_card FROM batches WHERE batch_id = 'TRD'"), [{ score_card: 'TRD' }], 'migration 0065: the Temple Residents batch is on the TRD card');
t.eq(rows("SELECT value FROM settings WHERE key = 'rules_version'")[0].value, 'r4', 'and phones fetch the rules again (r4)');
const T = await join('6000000176', 'TRD', 'Tulasi Das'), T2 = await join('6000000177', 'TRD', 'Gopal Das'), S = await join('6000000178', 'SPS', 'Sundar Das');
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");
const W = '2026-10-05';
let r = await call('rules.get', {}, T);
t.eq([r.data.cardName, r.data.cards.TRD?.dayMax, r.data.temple], ['TRD', 205, true], 'a temple resident\'s phone gets the TRD card (live marks) and the Morning program questions');

at('2026-10-11T19:00:00');
const fill = async (tok, i, day) => { const d = `2026-10-${String(5 + i).padStart(2, '0')}`; return call('week.saveDay', { weekId: W, date: d, version: 0, day }, tok); };
r = await fill(T, 0, A);
t.eq([r.data?.state, r.data?.marks?.to_bed, r.data?.marks?.morning], ['complete', { label: '22:10', marks: 16.67, of: 25 }, { label: '3 of 4 answered', marks: 8, of: 20 }],
  'Save answers with the TRD marks the phone shows (the same numbers)');
for (const [i, d] of [[1, B], [2, P], [3, D]]) t.eq((await fill(T, i, d)).data?.state, 'complete', `day ${i + 1} saved complete`);
t.eq((await fill(T, 4, { sleptAt: '22:00' })).data?.state, 'partial', 'Friday only part filled (counts 0 at Submit)');
await call('week.setAttendance', { weekId: W, mark: 'P' }, T);
await call('week.saveWeekEnd', { weekId: W, version: 0, nightStay: 'YES', principles: 'YES' }, T);
r = await call('week.submit', { weekId: W }, T, { requestId: 'trd-submit-1' });
t.code(r, 'ok', 'the temple resident submits');
t.eq([pick(r.data.scores), r.data.scores.attendance, Object.keys(r.data.scores).length], [WEEK, 100, 12], 'Submit answers with the hand-worked scores, Morning program included');
const row = rows(`SELECT score_card, morning, overall, attendance, body, soul, seva, days_filled FROM submissions WHERE login = '6000000176'`)[0];
t.eq(row, { score_card: 'TRD', morning: 34, overall: 35, attendance: 100, body: 32, soul: 36, seva: 39, days_filled: 4 }, 'the row: its card, the Morning program column, the scores');
r = await call('week.get', { weekId: W }, T);
t.eq([r.data.marks[0].morning, r.data.marks[2].rounds], [{ label: '3 of 4 answered', marks: 8, of: 20 }, { label: '20 rounds', marks: 10, of: 10 }], 'week_json keeps each mark with its maximum');
t.eq(r.data.marks[4], {}, 'the part-filled Friday is left out, no marks');
r = await call('history.list', { before: '2026-10-19' }, T);
t.eq(r.data.weeks?.[0]?.dayPct, [63, 59, 100, 21, 0, 0, 0], 'the Report calendar\'s day percentages: out of 205 (SQL), the same as the Day form');

// the SPS devotee beside them is untouched
const Sday = { sleptAt: '22:10', wokeAt: '04:40', rounds: 16, chantingDoneAt: '07:00', chantingSameDay: true, dayRestMin: 30, hearingMin: 30, hearing: [{ text: 'Class' }],
  readingMin: 30, reading: { text: 'Gita' }, serviceMin: 90 };
await fill(S, 0, { ...Sday });
await call('week.setAttendance', { weekId: W, mark: 'P' }, S);
await call('week.saveWeekEnd', { weekId: W, version: 0, nightStay: 'YES', principles: 'YES' }, S);
r = await call('week.submit', { weekId: W }, S, { requestId: 'sps-submit-1' });
t.ok(r.ok && !('morning' in r.data.scores), 'an SPS week has no Morning program column');
t.eq(rows(`SELECT score_card, morning FROM submissions WHERE login = '6000000178'`)[0], { score_card: 'SPS', morning: null }, 'its row says SPS, Morning program NULL');
r = await call('history.list', { before: '2026-10-19' }, S);
t.eq(r.data.weeks[0].dayPct[0], 100, 'an SPS day is still out of 150 (25 + 25 + 25 + 25 + 25 + 25 = 150 → 100)');
const spsBefore = rows(`SELECT overall FROM submissions WHERE login = '6000000178'`)[0].overall;

// the second resident leaves one perfect day in the draft: the deadline submits it, on the TRD card
await fill(T2, 2, P);

// the deadline closes the week
at('2026-10-12T21:05:00');
let out = '';
for (let i = 0; i < 6 && !/closed|up to date/.test(out); i++) out = await runDeadline(env, DB, new Date(clock.now));
t.ok(/closed/.test(out), `the deadline closes the week (${out})`);
t.eq(rows(`SELECT submitted_by, score_card, overall, morning, attendance FROM submissions WHERE login = '6000000177'`)[0],
  { submitted_by: 'DEADLINE', score_card: 'TRD', overall: 14, morning: 14, attendance: 0 }, 'auto-submitted on the TRD card: 205 / 1435 = 14; Morning 20 / 140 = 14');

// the head marks the resident absent afterwards: shown, not scored
t.code(await call('attendance.override', { login: '6000000176', weekId: W, mark: 'A', reason: 'Was away that Sunday' }, M), 'ok', 'the head marks the temple resident absent');
r = await call('week.get', { weekId: W }, T);
t.eq([r.data.scores.attendance, r.data.scores.overall, r.data.scores.morning], [0, 35, 34], 'the week shows attendance 0, Overall still 35');
r = await call('history.list', { before: '2026-10-19' }, T);
t.eq([r.data.weeks[0].attendance, r.data.weeks[0].overall], [0, 35], 'history too');
r = await call('leaderboard.get', { batchId: 'TRD' }, M);
t.eq(r.data.rows.map((x) => [x.name, x.score]), [['Tulasi Das', 35], ['Gopal Das', 14]], 'the board (its SQL) keeps the TRD Overall whatever the mark');
await call('attendance.override', { login: '6000000178', weekId: W, mark: 'A', reason: 'Was away that Sunday' }, M);
r = await call('leaderboard.get', { batchId: 'SPS' }, M);
t.ok(r.data.rows.find((x) => x.name === 'Sundar Das').score < spsBefore, `while an SPS week marked absent still drops (${spsBefore} → ${r.data.rows.find((x) => x.name === 'Sundar Das').score})`);

// Admin › Analysis: the Morning program per batch per closed week
const bw = rows(`SELECT submitted, n_morning, sum_morning FROM batch_weeks WHERE batch_id = 'TRD' AND week_id = '${W}'`)[0];
t.eq(bw, { submitted: 2, n_morning: 2, sum_morning: 48 }, 'batch_weeks sums the Morning program over the TRD weeks (34 + 14)');
t.eq(rows(`SELECT n_morning, sum_morning FROM batch_weeks WHERE batch_id = 'SPS' AND week_id = '${W}'`)[0], { n_morning: 0, sum_morning: 0 }, 'and nothing for SPS');
r = await call('analysis.get', { from: '2026-09-28', to: '2026-10-12' }, M);
t.eq(r.data.weeks.filter((x) => x.batchId === 'TRD').map((x) => [x.weekId, x.nMorning, x.morning]), [[W, 2, 48]], 'analysis.get sends it (the screen shows 48 / 2 = 24 %)');

t.done();
