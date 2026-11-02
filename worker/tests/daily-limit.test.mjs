// D1's free plan stops serving reads once the day's row budget is spent, and resets at 00:00 UTC
// (05:30 IST). Until then EVERY action fails.
//
// WHY THIS EXISTS. On 14 October 2026 a coordinator tapped Export on the Batch setup screen and got
// "Please try again". It was not an export fault at all: the database had stopped answering, and the same
// thing had already failed a sign-in that morning. "Please try again" is the worst possible advice there —
// trying again cannot work until the reset, so the person retries, fails, and concludes the app is broken.
//
// It also went unrecorded. The run log's newest entry that day was from 04:54, hours before the report, so
// nothing in the app could have told the head what was happening.
//
// So: its own code, its own message naming the reset time, and it IS written to the run log.
import { boot, suite } from './harness.mjs';
import { ERRORS } from '../src/codes.js';

const t = suite('the daily D1 allowance is reported as itself, not as "please try again"');
const { call, DB, rows, addAccount } = boot();

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;

/* The real D1 wording, as it appeared in production that day. */
const REAL = "D1_ERROR: Your account has exceeded D1's free tier daily row read limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.";

/** Make the next call fail exactly as D1 does when the budget is spent. */
function capOnce(message) {
  const real = DB.prepare.bind(DB);
  let armed = true;
  DB.prepare = (sql) => {
    if (armed && /FROM batches/i.test(sql)) { armed = false; throw new Error(message); }
    return real(sql);
  };
  return () => { DB.prepare = real; };
}

/* ───────── it is recognised, and says something true ───────── */

let undo = capOnce(REAL);
const r = await call('batches.list', {}, M);
undo();
t.eq(r.error?.code, 'DAILY_LIMIT', 'the spent allowance has its own code, not the catch-all INTERNAL');
t.ok(!/try again/i.test(r.error.message), 'it does NOT say "try again" — that is the advice that wasted the coordinator\'s time');

/* WHAT THE PERSON IS TOLD (the head, 15 Oct 2026). My first version said "Today's free database allowance
   is used up. It resets at 5:30 AM IST." That is IYF's billing arrangement with Cloudflare: a devotee
   cannot act on it, and should not be shown which plan the temple is on. They are told the truth in their
   own terms instead — it is us, it is temporary, their work is safe. */
for (const leak of [/free/i, /tier/i, /allowance/i, /quota/i, /limit/i, /plan/i, /upgrade/i, /database/i, /D1/, /Cloudflare/i, /row/i]) {
  t.ok(!leak.test(r.error.message), `the person is not told about ${leak} — ${JSON.stringify(r.error.message)}`);
}
t.ok(/back in the morning/i.test(r.error.message), 'they are told roughly when to come back');
t.ok(/nothing you have filled is lost/i.test(r.error.message), '… and that their work is safe, which is the thing they actually fear');

/* ───────── and it is written down, so the head can see it happened ───────── */

t.ok(rows("SELECT COUNT(*) AS n FROM run_log WHERE error_code = 'DAILY_LIMIT'")[0].n > 0,
     'it reaches the Run Log; the day this was reported, nothing had been logged for 12 hours');
/* …and the LOG keeps every word the person was spared. This is the half that matters to whoever is on call:
   the code to filter on, and Cloudflare's exact sentence to act on. */
const logged = rows("SELECT detail FROM run_log WHERE error_code = 'DAILY_LIMIT' ORDER BY id DESC LIMIT 1")[0]?.detail || '';
t.ok(/DB DAILY LIMIT REACHED/.test(logged), `the log says plainly what happened: ${JSON.stringify(logged.slice(0, 60))}`);
t.ok(/free tier daily row read limit/i.test(logged), '… including Cloudflare\'s own wording, for whoever reads it');

/* ───────── an ordinary fault is still an ordinary fault ───────── */

undo = capOnce('SQLITE_ERROR: no such column: nonsense');
const other = await call('batches.list', {}, M);
undo();
t.eq(other.error?.code, 'INTERNAL', 'a normal server fault is still INTERNAL');
t.ok(/try again/i.test(other.error.message), '… and there "try again" is the right advice');

/* ───────── the wording D1 actually uses, in the forms it uses ───────── */

for (const msg of [REAL,
                   'D1_ERROR: Your account has exceeded D1\'s free tier daily row read limit.',
                   'exceeded the daily row read limit']) {
  const stop = capOnce(msg);
  const x = await call('batches.list', {}, M);
  stop();
  t.eq(x.error?.code, 'DAILY_LIMIT', `recognised: ${JSON.stringify(msg.slice(0, 60))}`);
}

/* ───────── the registry describes it ───────── */

t.ok(!!ERRORS.DAILY_LIMIT, 'the code is in the registry');
t.eq(ERRORS.DAILY_LIMIT.http, 503, 'answered as 503: the service is temporarily unavailable, not broken');
t.ok(/05:30 IST/.test(ERRORS.DAILY_LIMIT.meaning), 'and the registry says when it resets, for whoever reads the table');

t.done();
