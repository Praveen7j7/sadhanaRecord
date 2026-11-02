// Phase 23 (ADR 0020; the head, 27 Oct 2026; inactive.js, migration 0071). A devotee silent for 30 days — no day of
// sadhana saved AND no use of the app — becomes inactive by the daily job; filling a day or using the app brings them
// back (the app's own marks only, for using the app); a coordinator's "Mark inactive" is not undone by using the app.
// Coordinators and the head see the changes on Home; the analysis counts them by month and by day. No more requests.
import fs from 'node:fs';
import { boot, suite } from './harness.mjs';
import { ROUTES } from '../src/api.js';
import { dailyInactive } from '../src/inactive.js';
import { runDeadline } from '../src/weeks.js';

const t = suite('automatic inactive: 30 days with no day filled and no use of the app; back by filling or using the app');
const { env, DB, call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
const PW = 'Devotee pass 2026';

at('2026-10-01T10:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'spsai', name: 'Sps Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-spsai-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'spsai'");
DB.sql.exec("UPDATE settings SET value = '2026-09-28' WHERE key = 'tracking_from'");
DB.sql.exec("UPDATE settings SET value = '365' WHERE key = 'session_days'");

const person = async (login, batch, from, extra = '') => {
  await addAccount(login, 'DEVOTEE', PW, { name: 'Dev ' + login.slice(-2) });
  if (extra) DB.sql.exec(`UPDATE accounts SET ${extra} WHERE login = '${login}'`);
  DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, set_by, set_at) VALUES ('${login}', '${batch}', 'ACTIVE', '${from}', 'test', '2026-09-01')`);
};
const sub = (login, week, when) => DB.sql.exec(`INSERT INTO submissions (submission_id, login, name, batch_id, week_id, submitted_at, submitted_by, request_id, rules_version,
    bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall, seva_minutes, avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
  VALUES ('${login}-${week}', '${login}', 'x', 'SPS', '${week}', '${when}', '${login}', 'rq-${login}-${week}', 'r1', 80, 80, 80, 80, 80, 80, 80, 100, 80, 80, 80, 0, '16', 'YES', 'YES', 0, 0, '[]', '{}')`);

// everyone in SPS since 7 Sep unless said; the run is Tuesday 10 Nov 00:13 IST, so the 30 days reach back to 11 Oct
await person('6000000171', 'SPS', '2026-09-07');                                                   // A: silent → inactive
await person('6000000172', 'SPS', '2026-09-07', "last_login_at = '2026-11-01T09:00:00+05:30'");     // B: signed in lately
await person('6000000173', 'SPS', '2026-09-07');                                                   // C: saved a day lately
DB.sql.exec("INSERT INTO drafts (login, week_id, batch_id, d1, created_at, updated_at, updated_by) VALUES ('6000000173', '2026-11-02', 'SPS', '{}', 'x', '2026-11-05T08:00:00+05:30', '6000000173')");
await person('6000000174', 'SPS', '2026-10-19');                                                   // D: joined three weeks ago
await person('6000000175', 'SPS', '2026-09-07');                                                   // E: used the app lately
await person('6000000176', 'SPS', '2026-09-07'); sub('6000000176', '2026-10-12', '2026-10-18T19:00:00+05:30');   // F: a week submitted lately
await person('6000000177', 'SPS', '2026-09-07');                                                   // G: a part week with days in it dropped lately
DB.sql.exec("INSERT INTO missed_weeks (login, week_id, batch_id, days_filled, at) VALUES ('6000000177', '2026-10-19', 'SPS', 2, '2026-10-26T21:00:00+05:30')");
await person('6000000178', 'SPS', '2026-09-07');                                                   // H: a missed week with NO day → still silent
DB.sql.exec("INSERT INTO missed_weeks (login, week_id, batch_id, days_filled, at) VALUES ('6000000178', '2026-10-19', 'SPS', 0, '2026-10-26T21:00:00+05:30')");
await person('6000000179', 'DPS', '2026-09-07');                                                   // P: silent, DPS
// H and E sign in on 1 Oct (before the 30 days): H's session is then unused, E's is used on 8 Nov
const tokH = (await call('auth.login', { login: '6000000178', password: PW })).data.token;
const tokE = (await call('auth.login', { login: '6000000175', password: PW })).data.token;
at('2026-11-08T12:00:00');
t.code(await call('home.get', {}, tokE), 'ok', 'E uses the app on 8 Nov');

/* ── the daily job ── */
at('2026-11-10T00:13:00');
DB.sql.exec("UPDATE settings SET value = '2026-10-20' WHERE key = 'tracking_from'");
t.eq(await dailyInactive(DB, new Date(clock.now)), '', 'nothing while the 30 days still reach back before the first tracked week');
DB.sql.exec("UPDATE settings SET value = '2026-09-28' WHERE key = 'tracking_from'");
t.ok(/^3 made inactive/.test(await dailyInactive(DB, new Date(clock.now))), 'the job runs');
const ev = () => rows('SELECT login, batch_id, day, change, how FROM activity_events ORDER BY id').map(r => [r.login, r.change, r.how]);
t.eq(ev(), [['6000000171', 'INACTIVE', 'AUTO'], ['6000000178', 'INACTIVE', 'AUTO'], ['6000000179', 'INACTIVE', 'AUTO']],
  'A, H and P only: not after a sign-in, a saved day, use of the app, a submitted week, a part week with days, nor for a new joiner');
t.eq(rows("SELECT state, from_week, to_week, reason FROM memberships WHERE login = '6000000171' ORDER BY id").map(r => [r.state, r.from_week, r.to_week]),
  [['ACTIVE', '2026-09-07', '2026-11-02'], ['INACTIVE', '2026-11-09', '']], 'their membership is inactive from this week; the weeks before stay active');
t.eq(rows("SELECT status, auto_inactive FROM accounts WHERE login = '6000000171'")[0], { status: 'ACTIVE', auto_inactive: 1 }, 'the account and login stay; the app marks it as its own');
t.eq(rows("SELECT json_extract(after, '$.count') AS n FROM audit_log WHERE action = 'inactive.auto'").map(r => r.n), [3], 'one Activity line: 3');
t.eq(await dailyInactive(DB, new Date(clock.now)), 'nobody to make inactive', 'a second run the same day changes nothing');
t.eq(rows('SELECT COUNT(*) AS n FROM activity_events')[0].n, 3, 'no duplicate events');

/* ── notices: the coordinator their batches, the head all; not a devotee ── */
const C = (await call('auth.login', { login: 'spsai', password: 'Temp-spsai-2026' })).data.token;
const M2 = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
let r = await call('activity.notices', {}, C);
t.eq(r.data.events.map(e => [e.login, e.change, e.how]).sort(), [['6000000171', 'INACTIVE', 'AUTO'], ['6000000178', 'INACTIVE', 'AUTO']], 'the SPS coordinator sees SPS only');
r = await call('activity.notices', {}, M2);
t.eq(r.data.events.length, 3, 'the head sees all of IYF Delhi');
t.eq(Object.keys(r.data.events[0]).sort(), ['at', 'batchId', 'by', 'change', 'day', 'how', 'id', 'login', 'name'], 'each notice says who, where, what and how');
t.eq((await call('home.staff', {}, M2)).data.notices.events.length, 3, "and they come with the head's Home");
const B = (await call('auth.login', { login: '6000000172', password: PW })).data.token;
t.code(await call('activity.notices', {}, B), 'FORBIDDEN', 'a devotee has none');

/* ── back by using the app: sign-in (A) and a signed-in call (H) — the app's own marks only ── */
const A = (await call('auth.login', { login: '6000000171', password: PW })).data.token;
t.eq(rows("SELECT state, from_week, to_week FROM memberships WHERE login = '6000000171' ORDER BY id").map(r => [r.state, r.from_week, r.to_week]),
  [['ACTIVE', '2026-09-07', '2026-11-02'], ['ACTIVE', '2026-11-09', '']], 'A signs in: active again at once');
t.eq(rows("SELECT auto_inactive FROM accounts WHERE login = '6000000171'")[0].auto_inactive, 0, 'the flag is cleared');
t.code(await call('home.get', {}, tokH), 'ok', 'H opens the app with an old session');
t.eq(rows("SELECT state FROM memberships WHERE login = '6000000178' AND to_week = ''")[0].state, 'ACTIVE', 'H is active again from that call');
t.eq(rows("SELECT login, how FROM activity_events WHERE change = 'ACTIVE' ORDER BY id").map(r => [r.login, r.how]), [['6000000171', 'APP'], ['6000000178', 'APP']], 'both recorded as back through the app');
t.code(await call('home.get', {}, A), 'ok', 'later calls change nothing more');
t.eq(rows("SELECT COUNT(*) AS n FROM activity_events WHERE login = '6000000171'")[0].n, 2, 'one event in, one out');

/* ── a coordinator's "Mark inactive" stays when they use the app; a filled day brings them back ── */
r = await call('devotees.setActive', { login: '6000000172', active: false }, C);
t.eq(r.data, { status: 'INACTIVE', fromWeek: '2026-11-09' }, 'the coordinator marks B inactive');
t.code(await call('auth.login', { login: '6000000172', password: PW }), 'ok', 'B can still sign in');
t.code(await call('home.get', {}, B), 'ok', '… and use the app');
t.eq(rows("SELECT state FROM memberships WHERE login = '6000000172' AND to_week = ''")[0].state, 'INACTIVE', 'which does not undo a person\'s decision');
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
at('2026-11-10T21:30:00');
t.code(await call('week.saveDay', { weekId: '2026-11-09', date: '2026-11-09', version: 0, day }, B), 'ok', 'B fills Monday');
t.eq(rows("SELECT state FROM memberships WHERE login = '6000000172' AND to_week = ''")[0].state, 'ACTIVE', 'a filled day brings them back');
t.code(await call('week.saveDay', { weekId: '2026-11-09', date: '2026-11-10', version: 0, day }, B), 'ok', 'the next save');
t.eq(rows("SELECT how FROM activity_events WHERE login = '6000000172' ORDER BY id").map(r => r.how), ['MANUAL', 'FILLED'], 'recorded once as marked, once as filled');
// the head marks P (inactive by the app) inactive: now their decision, so signing in does not bring P back
t.eq((await call('devotees.setActive', { login: '6000000179', active: false }, M2)).data.status, 'INACTIVE', 'the head marks P inactive');
t.eq(rows("SELECT auto_inactive FROM accounts WHERE login = '6000000179'")[0].auto_inactive, 0, "the app's flag is gone");
t.code(await call('auth.login', { login: '6000000179', password: PW }), 'ok', 'P signs in');
t.eq(rows("SELECT state FROM memberships WHERE login = '6000000179' AND to_week = ''")[0].state, 'INACTIVE', 'and stays inactive');

/* ── the analysis: now, month by month, day by day ── */
r = await call('activity.stats', { month: '2026-11' }, M2);
t.code(r, 'ok', 'the head asks');
const nov = r.data.months.find(m => m.month === '2026-11');
t.eq([nov.inactive, nov.active, nov.auto, nov.manual, nov.filled, nov.app], [4, 3, 3, 1, 1, 2], 'November: 4 inactive (3 by the app, 1 marked), 3 back (2 by the app, 1 by filling)');
t.eq(r.data.months.length, 12, 'twelve months');
t.eq(r.data.days.find(d => d.day === '2026-11-10'), { day: '2026-11-10', inactive: 4, active: 3 }, 'day by day: 10 Nov');
t.eq(r.data.days.length, 10, 'every day of the month so far, quiet days as 0');
t.eq(r.data.days[0], { day: '2026-11-01', inactive: 0, active: 0 }, '… a quiet day is a 0');
const sps = r.data.batches.find(b => b.batchId === 'SPS');
t.eq([sps.active, sps.inactive], [8, 0], 'now: SPS 8 active, none inactive');
t.eq([r.data.batches.find(b => b.batchId === 'DPS').inactive, r.data.totals.inactive], [1, 1], 'DPS 1 inactive (P), 1 in total');
r = await call('activity.stats', { month: '2026-11' }, C);
t.eq([r.data.batches.map(b => b.batchId), r.data.months.find(m => m.month === '2026-11').inactive], [['SPS'], 3], 'the SPS coordinator: SPS only (3 inactive in November)');
t.code(await call('activity.stats', { batchId: 'DPS' }, C), 'FORBIDDEN', 'not another batch');
t.code(await call('activity.stats', { month: '2026-13' }, C), 'VALIDATION', 'a real month');

/* ── nothing is raised as requests any more ── */
t.ok(!ROUTES['inactive.list'] && !ROUTES['inactive.decide'], 'the request actions are gone');
DB.sql.exec("UPDATE settings SET value = '2026-10-26' WHERE key = 'deadline_done'");
at('2026-11-10T22:00:00');
for (let i = 0; i < 10; i++) if (/closed|up to date/.test(await runDeadline(env, DB, new Date(clock.now)))) break;
t.eq(rows('SELECT COUNT(*) AS n FROM inactive_requests')[0].n, 0, 'the deadline job raises no "Inactive?" request');
// migration 0071 closes any request left open by Phase 22
DB.sql.exec("INSERT INTO inactive_requests (login, batch_id, raised_week, raised_at) VALUES ('6000000174', 'SPS', '2026-10-19', 'x')");
const close = /UPDATE inactive_requests[\s\S]*?;/.exec(fs.readFileSync(new URL('../migrations/0071_automatic_inactive.sql', import.meta.url), 'utf8'))[0];
DB.sql.exec(close);
t.eq(rows('SELECT status FROM inactive_requests').map(r => r.status), ['CLOSED'], 'the migration closes open requests');

t.done();
