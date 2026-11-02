// Roadmap 6.6 / audit T F-10: a refusal must leave a trace the head can see.
//
// Before this, run_log took only INTERNAL errors and slow calls, so a client looping on FORBIDDEN, or
// somebody probing the API, produced NOTHING anywhere — no row, no counter, nothing on the Settings screen.
// BUSY is still deliberately uncounted (a flood must not become a flood of writes), and the counter is
// sampled 1 in 10 for the same reason plus the Free plan's 10 ms of CPU.
//
// What is checked here: a refusal is counted; the count is an estimate scaled by the sample rate; an hour
// that is not the current hour reads as 0 rather than as a stale number; an ok call counts nothing; and the
// counter rows never reach the Sheets copy (migration 0047 — three cells changing hourly would otherwise
// queue ~72 row copies a day for something nobody reads there).
import { boot, suite } from './harness.mjs';

const t = suite('observability: refusals are counted, sampled, and not mirrored');
const { call, addAccount, DB, rows, env } = boot();
// this suite IS the counter's test, so the sampling must be live here (the harness switches it off for the
// rest, where a random settings write only makes other suites flaky)
delete env.REFUSAL_SAMPLE_OFF;

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;

const settings = async () => (await call('settings.get', {}, M)).data;
const raw = (k) => (rows(`SELECT value FROM settings WHERE key = '${k}'`)[0] || {}).value || '';

/* ---- nothing yet ---- */
let s = await settings();
t.ok(s.refusals && typeof s.refusals === 'object', 'the Settings screen carries a refusals block');
t.eq([s.refusals.forbidden, s.refusals.unauthenticated, s.refusals.stale], [0, 0, 0], 'no refusals yet: all three read 0');
t.ok(s.refusals.sampled === true, 'and it says so: these are sampled estimates, not exact counts');
t.ok(/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(s.refusals.hour), `the hour it is counting (${s.refusals.hour})`);

/* ---- a refusal is counted ----
   Sampling is 1 in 10, so one call proves nothing: 200 refusals make a miss vanishingly unlikely
   (0.9^200 ≈ 7e-10) while still exercising the real sampled path rather than a stubbed one. */
const noToken = async () => call('settings.get', {});
for (let i = 0; i < 200; i++) await noToken();
s = await settings();
t.ok(s.refusals.unauthenticated > 0, `an unauthenticated call is counted (${s.refusals.unauthenticated} estimated from 200)`);
t.ok(s.refusals.unauthenticated % 10 === 0, 'the estimate is scaled by the sample rate, so it is a multiple of 10');
t.ok(s.refusals.unauthenticated >= 100 && s.refusals.unauthenticated <= 320,
     `and lands near the 200 that happened, not wildly off (${s.refusals.unauthenticated})`);
t.eq(s.refusals.forbidden, 0, 'a different code is counted separately: FORBIDDEN is still 0');

/* ---- the stored form, and what an old hour means ---- */
const stored = raw('refusals_unauthenticated');
t.ok(/^\d{4}-\d{2}-\d{2}T\d{2}\|\d+$/.test(stored), `stored as <hour>|<estimate> in one row (${stored})`);
DB.sql.exec(`UPDATE settings SET value = '2020-01-01T00|9999' WHERE key = 'refusals_unauthenticated'`);
t.eq((await settings()).refusals.unauthenticated, 0,
     'a count from another hour reads as 0, not as a stale 9999 the head would chase');

/* ---- an ok call counts nothing ---- */
DB.sql.exec(`DELETE FROM settings WHERE key LIKE 'refusals_%'`);
for (let i = 0; i < 40; i++) await call('settings.get', {}, M);
t.eq(raw('refusals_unauthenticated'), '', '40 successful calls add no counter row at all');

/* ---- and they never reach the Sheets copy (migration 0047) ---- */
DB.sql.exec(`DELETE FROM mirror_log`);
for (let i = 0; i < 200; i++) await noToken();
t.ok(raw('refusals_unauthenticated') !== '', 'the counter wrote a row (so the next check is meaningful)');
t.eq(rows(`SELECT COUNT(*) AS n FROM mirror_log WHERE tbl = 'settings' AND k1 LIKE 'refusals_%'`)[0].n, 0,
     'no refusal counter is ever queued for the Settings tab');
// the guard on the guard: an ORDINARY settings row still is, so the test above is not passing because the
// trigger is simply broken for everything
DB.sql.exec(`INSERT INTO settings (key, value, changed_by, changed_at) VALUES ('tracking_from', '2026-01-01', 'test', '2026-10-14T11:00:00+05:30')
             ON CONFLICT(key) DO UPDATE SET value = '2026-02-02'`);
t.ok(rows(`SELECT COUNT(*) AS n FROM mirror_log WHERE tbl = 'settings' AND k1 = 'tracking_from'`)[0].n > 0,
     'an ordinary settings row IS still queued, so the exclusion is specific and the trigger works');

t.done();
