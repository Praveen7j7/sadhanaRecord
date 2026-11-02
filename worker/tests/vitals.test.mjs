// B4 (22 Oct 2026): sampled timings from real phones — signed-in only, bounded numbers, at most 3 rows a day per person.
import { boot, suite } from './harness.mjs';

const t = suite('sampled phone timings');
const { call, rows, clock, addAccount } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const n = () => rows("SELECT COUNT(*) AS n FROM run_log WHERE action = 'vitals'")[0].n;

t.code(await call('vitals.report', { lcp: 2100 }), 'UNAUTHENTICATED', 'signed-in only: no session, no row');
t.code(await call('vitals.report', { route: '/home' }, M), 'VALIDATION', 'no timing at all is refused');
t.code(await call('vitals.report', { lcp: 'slow' }, M), 'VALIDATION', 'a number that is not a number does not count as one');
const r = await call('vitals.report', { fcp: 900.4, lcp: 2100, inp: 180, cls: 0.02, route: '/home', tier: 'balanced', net: '4g' }, M);
t.eq(r.data, { kept: true }, 'a sample is kept');
const row = rows("SELECT ms, ok, detail FROM run_log WHERE action = 'vitals'")[0];
t.eq([row.ms, row.ok], [2100, 1], 'one row: the largest paint as its time');
t.eq(JSON.parse(row.detail), { fcp: 900.4, lcp: 2100, inp: 180, cls: 0.02, route: '/home', tier: 'balanced', net: '4g' }, 'the four numbers, the screen, the tier and the connection — nothing about the person');
await call('vitals.report', { lcp: 99999999, cls: 0.1, route: "/x'; DROP", tier: 'ultra' }, M);
t.eq(JSON.parse(rows("SELECT detail FROM run_log WHERE action = 'vitals' ORDER BY id DESC LIMIT 1")[0].detail),
  { fcp: null, lcp: null, inp: null, cls: 0.1, route: '/xDROP', tier: '', net: '' }, 'out-of-range numbers drop to null; route, tier and net are cleaned');
await call('vitals.report', { lcp: 1000 }, M);
t.eq((await call('vitals.report', { lcp: 1000 }, M)).data, { kept: false }, 'the fourth in a day is not kept');
t.eq(n(), 3, 'at most 3 rows a day per person');
clock.now += 86400000 + 1000;
t.eq((await call('vitals.report', { lcp: 1000 }, M)).data, { kept: true }, 'the next day counts again');
t.done();
