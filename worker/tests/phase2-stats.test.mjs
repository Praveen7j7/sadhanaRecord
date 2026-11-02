// Audit phase 2 (13 Oct 2026): stats.all is counted by the database instead of building every batch's board.
// The numbers must not change, so this suite pins them against hand-computed expectations on a seed that covers
// every status the board distinguishes: submitted, draft, missed, reopened-and-drafted, not started, inactive
// account, inactive membership, a membership that closed before the week, a deleted devotee (membership, no
// account), and a pending sign-up.
// Phone numbers are from the project's test range (60000000xx).
import { boot, suite } from './harness.mjs';
import { statsAll, statsBatch } from '../src/coord.js';
import { scopesOf, account } from '../src/db.js';

const t = suite('phase 2: stats.all counted in SQL');
const { env, DB, call, clock, addAccount, rows } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');

// The harness clock is Monday 2026-10-05 10:00 IST, before that week's deadline, so focusWeek() is 2026-09-28.
const WEEK = '2026-09-28', PREV = '2026-09-21', OLD = '2026-09-14';
const B = 'SPS';

const colsOf = (tb) => DB.sql.prepare(`PRAGMA table_info(${tb})`).all();
const put = (tb, given) => {
  const cols = colsOf(tb).filter(c => c.name !== 'id' && (c.name in given || (c.notnull && c.dflt_value === null)));
  DB.sql.prepare(`INSERT INTO ${tb} (${cols.map(c => '"' + c.name + '"').join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...cols.map(c => (c.name in given ? given[c.name] : (/INT|REAL|NUM/i.test(c.type) ? 0 : ''))));
};
const devotee = (login, { status = 'ACTIVE', state = 'ACTIVE', from = OLD, to = '', noAccount = false } = {}) => {
  if (!noAccount) put('accounts', { login, role: 'DEVOTEE', status, name: 'Devotee ' + login.slice(-2), pw_hash: 'h', pw_salt: 's', pw_iterations: 1000, must_change_pw: 0, requested_batch: B });
  put('memberships', { login, batch_id: B, from_week: from, to_week: to, state });
};
const submitted = (login, week) => put('submissions', { submission_id: login + '-' + week, login, week_id: week, batch_id: B,
  name: 'Devotee ' + login.slice(-2), submitted_at: '2026-09-29T10:00:00+05:30', submitted_by: login, week_json: '{}', overall: 70, days_filled: 7, rules_version: 'r1' });
const draft = (login, week) => put('drafts', { login, week_id: week, batch_id: B, d1: '{"v":1}', created_at: 'x', updated_at: 'x', updated_by: login });
const missedWeek = (login, week, days = 0) => put('missed_weeks', { login, week_id: week, batch_id: B, days_filled: days, at: 'x' });
const reopened = (login, week) => put('reopens', { login, week_id: week, batch_id: B, state: 'OPEN', open_until: '2026-10-12T21:00:00+05:30', by: 'master', at: 'x', reason: 'test' });

// ---- the seed, one devotee per case ----
devotee('6000000002'); submitted('6000000002', WEEK);                          // SUBMITTED
devotee('6000000003'); submitted('6000000003', WEEK);                          // SUBMITTED
devotee('6000000004'); draft('6000000004', WEEK);                              // DRAFT
devotee('6000000005'); missedWeek('6000000005', WEEK);                         // MISSED
devotee('6000000006'); missedWeek('6000000006', WEEK, 2); reopened('6000000006', WEEK); draft('6000000006', WEEK);  // REOPENED → counts as draft
devotee('6000000106');                                                          // NOT_STARTED
devotee('6000000107', { status: 'INACTIVE' }); submitted('6000000107', WEEK);   // not expected, submission ignored
devotee('6000000108', { state: 'INACTIVE' }); draft('6000000108', WEEK);        // not expected, draft ignored
devotee('6000000009', { to: PREV }); submitted('6000000009', WEEK);            // left before the week: ignored
devotee('6000000110', { noAccount: true }); submitted('6000000110', WEEK);     // deleted devotee: not expected
devotee('6000000007', { from: WEEK });                                          // joined this week: NOT_STARTED
put('accounts', { login: '6000000008', role: 'DEVOTEE', status: 'PENDING', name: 'Pending One', pw_hash: 'h', pw_salt: 's', pw_iterations: 1000, must_change_pw: 0, requested_batch: B });
// an older week, so the trend has something to show
for (const l of ['6000000002', '6000000003', '6000000004']) submitted(l, PREV);
missedWeek('6000000005', PREV);

const acct = await account(DB, 'master');
const ctx = { db: DB, env, now: () => new Date(clock.now), login: 'master', role: 'MASTER', acct, scopes: await scopesOf(DB, acct), waitUntil: () => {} };

const all8 = await statsAll({ weeks: 8 }, ctx);
const sps = all8.batches.find(b => b.batchId === B);

t.eq(sps.weekId, WEEK, 'the overview is about the week being filled');
// expected = ACTIVE account + ACTIVE membership open across the week: 201,202,203,204,205,206,211 = 7
t.eq(sps.thisWeek.expected, 7, 'expected counts only active devotees whose membership covers the week');
t.eq(sps.thisWeek.submitted, 2, 'submitted ignores a submission by someone no longer expected');
t.eq(sps.thisWeek.draft, 2, 'draft counts a plain draft and a reopened week, and loses to a submission');
t.eq(sps.thisWeek.missed, 1, 'missed does not count the reopened week');
t.eq(sps.thisWeek.notStarted, 2, 'not started = expected − submitted − draft − missed');
t.eq(sps.people.pending, 1, 'a pending sign-up is counted for the batch it asked for');
t.eq(sps.people.active, 7, 'active people = the expected count');

// The trend. Its denominator is NOT `expected`: it counts every ACTIVE membership of a devotee-or-deleted
// account, so it also includes the devotee whose ACCOUNT went inactive (…207) and the deleted devotee whose
// membership survives (…210) — nine here, against seven expected. That is the rule the per-batch chart has
// always used (coord.js statsBatch), kept deliberately: the chart asks "how much of the batch filled that
// week", including people who have since left. Submissions in the numerator are counted as they stand, for the
// same reason. Worth knowing when reading the Overview: the bar and the "2 of 7" line have different
// denominators by design.
const OPEN = 9;
const prev = sps.trend.find(w => w.weekId === PREV), cur = sps.trend.find(w => w.weekId === WEEK);
t.eq(sps.trend.length, 8, 'eight weeks of trend');
t.eq(prev.missed, 1, 'the trend keeps each week\'s missed count');
// five submission rows exist for this week: …201, …202 (expected) plus …207 (account inactive), …209 (left the
// batch) and …210 (deleted). The chart counts rows, the status line counts expected people — hence 5/9 here
// against "2 of 7" above.
t.eq(cur.filledPct, Math.round((5 / OPEN) * 100), "this week's percentage counts every submission row over the open memberships");
t.eq(prev.filledPct, Math.round((3 / OPEN) * 100), "the previous week's percentage uses that week's memberships");
// a week before anyone joined: nobody open, 0 % and no division by zero
const before = sps.trend[0];
t.eq(before.filledPct, 0, 'a week before the batch existed is 0 %, not NaN');
// three missed-week rows exist in the window: …204 this week and last, …205 this week (reopened — still a row)
t.eq(sps.missed, 3, 'the batch line reports every missed-week row in the window, reopened ones included');

// totals add up across batches, and an empty batch contributes nothing
const sum = (k) => all8.batches.reduce((a, b) => a + b.thisWeek[k], 0);
t.eq(all8.totals.expected, sum('expected'), 'totals.expected is the sum of the batches');
t.eq(all8.totals.submitted, sum('submitted'), 'totals.submitted likewise');
t.eq(all8.totals.pending, 1, 'totals.pending counts the one pending sign-up');

// stats.batch must agree with the overview line for the same week (it builds the board the long way)
const one = await statsBatch({ batchId: B, weeks: 8 }, ctx);
t.eq(one.thisWeek.expected, sps.thisWeek.expected, 'stats.batch and stats.all agree on expected');
t.eq(one.thisWeek.submitted, sps.thisWeek.submitted, '… on submitted');
t.eq(one.thisWeek.draft, sps.thisWeek.draft, '… on draft (board precedence: submitted > missed > draft)');
t.eq(one.thisWeek.missed, sps.thisWeek.missed, '… on missed');
t.eq(one.thisWeek.notStarted, sps.thisWeek.notStarted, '… and on not started');
t.eq(one.trend.map(w => w.filledPct).join(','), sps.trend.map(w => w.filledPct).join(','), '… and on the whole trend');

// the window is honoured and bounded: 1 and 26 weeks work, 0 and 27 are refused
t.eq((await statsAll({ weeks: 1 }, ctx)).batches[0].trend.length, 1, 'one week of trend is allowed');
t.eq((await statsAll({ weeks: 26 }, ctx)).batches[0].trend.length, 26, '26 weeks is the most');
t.code(await call('stats.all', { weeks: 0 }, (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token), 'VALIDATION', 'zero weeks is refused');

t.done();
