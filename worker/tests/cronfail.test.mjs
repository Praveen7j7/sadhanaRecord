// A failed scheduled job reaches the head's Home (22 Oct 2026, F5 / roadmap 6.6): one throttled settings row per job,
// returned by settings.get from the settings it already reads. Before this a failing deadline or reminder run wrote
// a line to Cloudflare's log and nothing anyone in the app could see.
import { boot, suite } from './harness.mjs';
import worker from '../src/index.js';
import { cronFailures } from '../src/cronfail.js';

const t = suite('a failed scheduled job is shown to the head');
const { env, DB, call, rows, addAccount } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const failures = async () => (await call('settings.get', {}, M)).data.cronFailed;
t.eq(await failures(), [], 'nothing has failed: settings.get says so');

// a run in which the database refuses everything except the alert's own write: every job of the minute fails
const at = (s) => ({ cron: '* * * * *', scheduledTime: Date.parse(s + '+05:30') });
const broken = (why) => ({ ...env, DB: { ...DB, prepare: (sql) => { if (/^\s*INSERT INTO settings \(key, value, note/.test(sql) && /cron_failed|A scheduled job failed/.test(sql)) return DB.prepare(sql); throw new Error(why); },
  batch: () => Promise.reject(new Error(why)), exec: () => { throw new Error(why); } } });
const ctx = { waitUntil() {} };
await worker.scheduled(at('2026-10-26T21:05:00'), broken('D1 is unavailable'), ctx);

let f = await failures();
t.ok(f.some((x) => x.job === 'deadline' && x.name === 'Monday deadline' && x.message === 'D1 is unavailable'), 'the Monday deadline run failed: named and explained');
t.ok(f.every((x) => x.at === '2026-10-26T21:05:00+05:30'), 'each failure carries the time of the run');
t.eq(f.map((x) => x.job).sort(), ['deadline', 'notices'], 'each job that failed in that run has its own line (the others return early at that hour)');

// throttled: the same job failing again within 10 minutes writes nothing; after that it is updated
const before = rows("SELECT value FROM settings WHERE key = 'cron_failed:deadline'")[0].value;
await worker.scheduled(at('2026-10-26T21:09:00'), broken('still unavailable'), ctx);
t.eq(rows("SELECT value FROM settings WHERE key = 'cron_failed:deadline'")[0].value, before, 'failing again within 10 minutes writes nothing');
await worker.scheduled(at('2026-10-26T21:16:00'), broken('still unavailable'), ctx);
f = await failures();
t.eq(f.find((x) => x.job === 'deadline').message, 'still unavailable', 'eleven minutes on, the latest failure replaces it');

// a healthy run writes no alert at all
const n = rows("SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'cron_failed:%'")[0].n;
const stamp = rows("SELECT MAX(changed_at) AS m FROM settings WHERE key LIKE 'cron_failed:%'")[0].m;
await worker.scheduled(at('2026-10-26T21:35:00'), env, ctx);
t.eq(rows("SELECT COUNT(*) AS n, MAX(changed_at) AS m FROM settings WHERE key LIKE 'cron_failed:%'")[0], { n, m: stamp }, 'a run with no failure writes nothing');

// the reader: newest first, a message may contain anything but the separator
t.eq(cronFailures({ 'cron_failed:tidy': '2026-10-26T10:07:00+05:30|a', 'cron_failed:deadline': '2026-10-27T21:05:00+05:30|b', other: 'x' }).map((x) => x.job),
  ['deadline', 'tidy'], 'listed newest first, other settings ignored');

t.done();
