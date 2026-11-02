// Phase 3 on the server: a whole week, from Monday morning to the Monday 9 PM deadline after it.
import { boot, suite , FAC, LEAD, CONTACT } from './harness.mjs';
import { runDeadline } from '../src/weeks.js';
import { weekScores } from '../src/scoring.js';
import { mirrorChanged } from '../src/mirror.js';

const t = suite('phase 3: the weekly form');
const { env, DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
await DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const join = async (phone, batchId, name = 'Test Devotee') => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, groupLeader: LEAD[batchId], password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000043', 'SPS2', 'Arjun Das'), B = await join('6000000044', 'SPS2', 'Bhima Das'), X = await join('6000000045', 'BSS', 'Other Batch');
const E = await join('6000000125', 'SPS2', 'Eka Das');      // submits a part week by hand (4 Oct 2026)
DB.sql.exec("INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations) VALUES ('6000000124', 'DEVOTEE', 'ACTIVE', 'Chandra Das', 'x', 'x', 1000)");
DB.sql.exec("INSERT INTO memberships (login, batch_id, state, from_week) VALUES ('6000000124', 'SPS2', 'ACTIVE', '2026-10-05')");   // never opens the app
const W = '2026-10-05';
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");   // the pilot starts this week
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30,
              hearingMin: 40, hearing: [{ lectureId: 'SD-W001-SPL' }], readingMin: 30, reading: { bookId: 'B41' }, serviceMin: 60 };
const dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];

// ---- Monday morning
let r = await call('home.get', {}, A);
t.eq(r.data.weeks.map(w => [w.weekId, w.status]), [['2026-09-28', 'NOT_STARTED'], [W, 'NOT_STARTED']], 'Monday morning: last week (until 9 PM) and this week are open');
t.eq(r.data.weeks[1].days.map(d => d.future), [false, true, true, true, true, true, true], 'only today can be filled');
t.code(await call('week.saveDay', { weekId: W, date: '2026-10-06', version: 0, day }, A), 'FUTURE_DAY', 'tomorrow cannot be filled in advance');
t.code(await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 0, day: { ...day, rounds: 99 } }, A), 'VALIDATION', 'bad answers refused');
t.code(await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 0, day: { ...day, hearing: [{ lectureId: 'BSS-W001-SPL' }] } }, A), 'VALIDATION', 'a lecture from another batch\'s journal is refused');
t.code(await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 0, day: { chetnaPositive: ['Humble', 'Made up'] } }, A), 'VALIDATION', 'Chetna only from the list');
t.code(await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 0, day: { aadhaar: '1' } }, A), 'BAD_REQUEST', 'unknown fields refused');
r = await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 0, day: { sleptAt: '22:05', wokeAt: '04:35' } }, A);
t.eq([r.data.version, r.data.state, r.data.marks.to_bed], [1, 'partial', { label: '10:00 - 10:15 PM', marks: 25 }], 'a part-filled day is saved, with live marks');
t.ok(r.data.missing.includes('rounds') && !r.data.missing.includes('sleptAt'), 'and the server says what is still missing');
t.code(await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 0, day: { rounds: 4 } }, A), 'STALE', 'a second device with an old version is told');
r = await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 1, day }, A);
t.eq([r.data.version, r.data.state, r.data.missing], [2, 'complete', []], 'the day completed');
t.eq((await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 2, day: { hearingMin: 0, hearing: null } }, A)).data.state, 'complete', 'no hearing topic needed with 0 minutes');
t.eq((await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 3, day: { hearingMin: 20 } }, A)).data.missing, ['hearing'], 'hearing minutes again: the cleared topic is asked for');
t.eq((await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 4, day: { hearing: [{ text: 'Kirtan class' }] } }, A)).data.missing, [], 'a typed topic is enough');
await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 5, day }, A);
t.code(await call('week.setAttendance', { weekId: W, mark: 'P' }, A), 'FUTURE_DAY', 'own attendance only after the Sunday class');

// coordinator on behalf: own batch only
t.code(await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 0, day: { sleptAt: '23:30' }, onBehalfOf: '6000000044' }, C), 'ok', 'coordinator fills a day for a devotee of their batch');
t.code(await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 0, day, onBehalfOf: '6000000045' }, C), 'FORBIDDEN', 'not for another batch');
t.code(await call('week.saveDay', { weekId: W, date: '2026-10-05', version: 0, day, onBehalfOf: '6000000044' }, A), 'FORBIDDEN', 'a devotee cannot fill someone else\'s');

// ---- through the week
for (let i = 1; i < 7; i++) {
  at(`${dates[i]}T21:30:00`);
  t.code(await call('week.saveDay', { weekId: W, date: dates[i], version: 0, day: i === 5 ? { ...day, chantingSameDay: false } : day }, A), 'ok', `${dates[i]} filled that evening`);
}
at('2026-10-10T21:30:00');                                                // Saturday: the submit window is not open
t.code(await call('week.submit', { weekId: W }, A), 'WINDOW_CLOSED', 'Saturday: too early to submit');
at('2026-10-11T18:30:00');                                                // Sunday 6:30 PM
t.code(await call('week.setAttendance', { weekId: W, mark: 'P' }, A), 'ok', 'own attendance mark on the class Sunday');
r = await call('week.submit', { weekId: W }, A);
t.ok(r.error?.code === 'INCOMPLETE' && r.error.fields.some(f => f.message === 'Night Stay missing'), 'Sunday 6:30 PM: missing week-end answers listed');
t.eq((await call('week.saveWeekEnd', { weekId: W, version: 0, nightStay: 'YES', principles: 'YES' }, A)).data, { version: 1, chantingAverage: 16 }, 'week-end answers; chanting average worked out');
r = await call('week.submit', { weekId: W }, A, { requestId: 'submit-arjun-1' });
const expect = weekScores('SPS', [day, day, day, day, day, { ...day, chantingSameDay: false }, day], 'P', 420);
t.eq(r.data.scores, Object.fromEntries(['bed', 'wake_up', 'day_sleep', 'japa', 'pathan', 'sravan', 'seva', 'attendance', 'body', 'soul', 'overall'].map(k => [k, expect[k]])), 'submitted; scores from the SPS card');
t.eq((await call('week.submit', { weekId: W }, A, { requestId: 'submit-arjun-1' })).data, r.data, 'the same Submit again returns the first answer');
t.code(await call('week.submit', { weekId: W }, A), 'ALREADY_SUBMITTED', 'a new Submit is refused');

/*
 * The contact card, on a devotee who HAS a submitted week (17 Oct 2026, live defect).
 *
 * devotees.get threw `ReferenceError: finalScores is not defined` for every such devotee: the import
 * at devotees.js:14 named classDefault, markLevel and markUsed but not finalScores, which line 83
 * calls on a SUBMITTED row. The coordinator saw "Please try again" and nothing else.
 *
 * 2,600 assertions missed it because no test ever opened a card after a submit — devotees.get was
 * only ever called on devotees whose weeks were empty, where the line never runs. So the check that
 * matters is not "does the card load" but "does it load for someone with a week behind them".
 */
{
  const card = await call('devotees.get', { login: '6000000043' }, M);
  t.code(card, 'ok', 'the card opens for a devotee with a submitted week');
  const wk = card.data.lastWeeks.find(w => w.weekId === W);
  t.eq(wk?.status, 'SUBMITTED', 'their submitted week is on it');
  t.ok(typeof wk?.overall === 'number', 'with the score finalScores works out from the attendance mark');
}
t.eq((await call('home.get', {}, A)).data.progress.heard, ['SD-W001-SPL'], 'lectures picked in submitted weeks count as heard');
t.code(await call('week.saveDay', { weekId: W, date: dates[6], version: 0, day }, A), 'ALREADY_SUBMITTED', 'a submitted week can never be changed');
t.eq(rows('SELECT COUNT(*) n FROM drafts WHERE login = ?', '6000000043')[0].n, 0, 'the draft is gone');
t.eq((await call('week.get', { weekId: W }, A)).data.status, 'SUBMITTED', 'the week reads back as submitted');

// ---- E: a part week is an option (the head, 4 Oct 2026): the complete days count, a day not filled scores 0
at('2026-10-06T21:30:00');
await call('week.saveDay', { weekId: W, date: dates[1], version: 0, day: { sleptAt: '22:05', wokeAt: '04:35' } }, E);   // Tuesday begun, never completed
at('2026-10-11T18:40:00');
await call('week.setAttendance', { weekId: W, mark: 'P' }, E);
await call('week.saveWeekEnd', { weekId: W, version: 0, nightStay: 'YES', principles: 'YES' }, E);
r = await call('week.submit', { weekId: W }, E);
t.ok(r.error?.code === 'INCOMPLETE' && r.error.fields.some(f => f.path === 'days' && f.message === 'Fill at least one whole day'), 'no complete day: Submit asks for at least one whole day');
t.code(await call('week.saveDay', { weekId: W, date: dates[0], version: 0, day }, E), 'ok', 'a past day of the open week filled on Sunday');
r = await call('week.submit', { weekId: W }, E, { requestId: 'submit-eka-1' });
const part = weekScores('SPS', [day, {}, {}, {}, {}, {}, {}], 'P', 60);
t.eq([r.data.daysFilled, r.data.scores.japa, r.data.scores.overall], [1, part.japa, part.overall], 'one complete day: submitted, scored ÷ 175 (the part-filled Tuesday counts 0)');
t.ok(part.japa <= 15 && part.overall < weekScores('SPS', [day, day, day, day, day, day, day], 'P', 420).overall, 'a part week is capped by its days (one perfect day ≈ 14% a category)');
t.eq(rows('SELECT days_filled FROM submissions WHERE login = ?', '6000000125')[0].days_filled, 1, 'days_filled kept on the submission');
const wj = JSON.parse(rows('SELECT week_json FROM submissions WHERE login = ?', '6000000125')[0].week_json);
t.eq([wj.daysFilled, wj.days[0].m.japa[1] > 0, Object.keys(wj.days[1]), wj.attendance], [1, true, ['date', 'm'], 'P'], 'the week JSON says 1 day; the left-out Tuesday has no answers or marks');
t.eq((await call('week.get', { weekId: W }, E)).data.daysFilled, 1, 'week.get reads back 1 of 7 days');

// ---- B: two days filled, never submitted
for (const i of [0, 1]) { at(`${dates[i]}T21:30:00`); await call('week.saveDay', { weekId: W, date: dates[i], version: i === 0 ? 1 : 0, day }, B); }
at('2026-10-12T20:59:00');                                                // the next Monday, a minute before the deadline
t.ok((await call('home.get', {}, B)).data.weeks.some(w => w.weekId === W && w.canSubmit), 'Monday 8:59 PM: last week can still be submitted');
t.eq(await runDeadline(env, DB, new Date(clock.now)), '2026-09-28: closed', 'the week before (nobody belonged yet) is closed first');
t.eq(await runDeadline(env, DB, new Date(clock.now)), 'up to date', 'before 9 PM this week is not closed');
at('2026-10-12T21:00:00');
t.code(await call('week.saveDay', { weekId: W, date: dates[2], version: 0, day }, B), 'WINDOW_CLOSED', '9 PM: the week is closed');
t.ok(!(await call('home.get', {}, B)).data.weeks.some(w => w.weekId === W), 'and no longer offered');
t.eq(await runDeadline(env, DB, new Date(clock.now)), '2026-10-05: 1 submitted as filled, 2 marked missed', 'the deadline job submits Bhima\'s two complete days as they stand and marks the two with none missed');
t.eq(await runDeadline(env, DB, new Date(clock.now)), '2026-10-05: closed', 'then closes the week');
t.eq(await runDeadline(env, DB, new Date(clock.now)), 'up to date', 'and then has nothing to do');
t.eq(rows('SELECT login, days_filled FROM missed_weeks ORDER BY login'), [{ login: '6000000045', days_filled: 0 }, { login: '6000000124', days_filled: 0 }], 'missed: only those with no complete day (Arjun and Eka submitted; Bhima was submitted at the deadline)');
const auto = rows("SELECT submitted_by, days_filled, attendance, night_stay, overall FROM submissions WHERE login = '6000000044'")[0];
const autoExpect = weekScores('SPS', [day, day, {}, {}, {}, {}, {}], null, 120);
t.eq(auto, { submitted_by: 'DEADLINE', days_filled: 2, attendance: 0, night_stay: '', overall: autoExpect.overall }, 'Bhima: submitted by the deadline with 2 days, no attendance mark (0) and no week-end answers (blank)');
t.eq(rows("SELECT target, after FROM audit_log WHERE action = 'week.autoSubmitted'").map(a => [a.target, JSON.parse(a.after).daysFilled]), [['6000000044', 2]], 'the automatic Submit is in the AuditLog');
t.eq(rows("SELECT COUNT(*) n FROM drafts WHERE week_id = ?", W)[0].n, 0, 'their drafts are deleted');
t.eq(rows("SELECT target, after FROM audit_log WHERE action = 'week.dropped' ORDER BY target").map(a => [a.target, JSON.parse(a.after).daysFilled]), [['6000000045', 0], ['6000000124', 0]], 'each drop is in the AuditLog');
t.eq(rows('SELECT locked FROM attendance WHERE week_id = ?', W).map(a => a.locked), [1, 1], 'attendance locked');
// dayPct (13 Oct 2026, roadmap 5.4): the seven days' percentages travel with the history, so the Report screen's
// month calendar needs no week.get per week. Bhima filled two whole days and nothing else.
t.eq((await call('history.list', {}, B)).data.weeks, [{ weekId: W, status: 'SUBMITTED', overall: autoExpect.overall, body: autoExpect.body, soul: autoExpect.soul, attendance: 0, seva: autoExpect.seva, daysFilled: 2, dayPct: [100, 100, 0, 0, 0, 0, 0] }], 'Bhima\'s history: the part week, 2 of 7 days, with each day\'s percentage');
t.eq((await call('history.list', {}, X)).data.weeks, [{ weekId: W, status: 'MISSED', overall: 0, body: 0, soul: 0, attendance: 0, seva: 0, daysFilled: 0 }], 'a missed week scores 0 in history');
t.eq((await call('week.get', { weekId: W }, X)).data, { weekId: W, status: 'MISSED', daysFilled: 0, overall: 0 }, 'and in week.get');
// The coordinator may no longer open a week that is past (the user's decision, 13 Oct 2026; audit F10): by now the
// clock is 12 Oct and W is 05 Oct, two weeks back. devotees.week always refused this and said "ask the IYF head";
// week.get onBehalfOf used to allow it, so the same question had two answers. One rule now — and the head still
// sees everything.
t.code(await call('week.get', { weekId: W, onBehalfOf: '6000000044' }, C), 'FORBIDDEN', 'a coordinator cannot open a past week on a devotee\'s behalf');
t.eq((await call('week.get', { weekId: W, onBehalfOf: '6000000044' }, M)).data.daysFilled, 2, 'the IYF head reads the part week');
const board = (await call('devotees.list', { batchId: 'SPS2', weekId: W }, C)).data.rows;
const rowOf = (login) => board.find(x => x.login === login);
t.eq([rowOf('6000000125').daysFilled, rowOf('6000000125').days], [1, ['complete', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty']], 'the board shows which day Eka\'s part week counted');
t.eq([rowOf('6000000044').status, rowOf('6000000044').days.filter(x => x === 'complete').length], ['SUBMITTED', 2], 'and Bhima\'s two days');
t.eq([rowOf('6000000043').daysFilled, rowOf('6000000043').days], [7, []], 'a whole week: 7, no mask needed');
t.eq(rowOf('6000000124').overall, 0, 'a missed week scores 0 on the board');
t.eq((await call('history.list', {}, A)).data.weeks.map(w => [w.weekId, w.status, w.overall]), [[W, 'SUBMITTED', expect.overall]], 'and the submitted one');

// ---- copies to the sheets
const report = [];
for (let i = 0; i < 12; i++) report.push(...await mirrorChanged(env, DB));
t.ok(report.includes('submissions 3') && report.some(x => x.startsWith('attendance')), 'the three submissions (one whole, two part weeks) and attendance reach the Submissions 2026 sheet');

// ---- before the pilot starts, nobody is ever marked missed
const fresh = boot();
await fresh.addAccount('master', 'MASTER', 'Master pass 2026');
fresh.DB.sql.exec("INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations) VALUES ('6000000046', 'DEVOTEE', 'ACTIVE', 'Early Devotee', 'x', 'x', 1000)");
fresh.DB.sql.exec("INSERT INTO memberships (login, batch_id, state, from_week) VALUES ('6000000046', 'SPS2', 'ACTIVE', '2026-09-21')");
t.eq(await runDeadline(fresh.env, fresh.DB, new Date(Date.parse('2026-10-12T21:05:00+05:30'))), '2026-10-05: closed', 'tracking_from blank: the week closes without marking anyone missed');
t.eq(fresh.rows('SELECT COUNT(*) n FROM missed_weeks')[0].n, 0, 'nobody missed before the pilot');
t.done();
