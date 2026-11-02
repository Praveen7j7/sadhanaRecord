// Timings from real phones, sampled (22 Oct 2026, B4; the head said yes: D-5).
//
// No desktop Lighthouse can say how fast the app is on a devotee's phone in Delhi. About 1 open in 100 of a signed-in
// person sends four numbers — first paint, largest paint, the slowest tap's delay, layout shift — with the screen, the
// phone's tier and its connection type. They go into the technical log (run_log) as one row, action 'vitals', where
// the head's Activity screen and a query can read them. Never a name or a phone number: only timings and the build.
//
// A sample, never a stream: at most 3 rows a day per person (a counter row), so a misbehaving or hostile client cannot
// spend the free plan's writes. About 100 samples a day at 5,000 devotees ≈ 300 writes (the row, its Sheets-copy log
// entry, the counter) out of 100,000.
import { invalid, isoIst } from './util.js';
import { run } from './db.js';
import { overLimit } from './auth.js';

const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 1000) / 1000 : null);
const TIERS = ['high', 'balanced', 'low'];

export async function vitalsReport(d, ctx, req) {
  const m = { fcp: num(d.fcp, 60000), lcp: num(d.lcp, 60000), inp: num(d.inp, 60000), cls: num(d.cls, 10) };
  if (m.fcp === null && m.lcp === null && m.inp === null && m.cls === null) throw invalid({ path: 'lcp', message: 'No timings.' });
  const route = String(d.route || '').replace(/[^a-z0-9/_-]/gi, '').slice(0, 40);
  const tier = TIERS.includes(d.tier) ? d.tier : '';
  const net = String(d.net || '').replace(/[^a-z0-9-]/gi, '').slice(0, 12);
  if (await overLimit(ctx, 'vitals:' + ctx.login, 3, 86400)) return { kept: false };
  await run(ctx.db, 'INSERT INTO run_log (at, action, ms, ok, error_code, detail, app_build) VALUES (?, ?, ?, 1, ?, ?, ?)',
    isoIst(ctx.now()), 'vitals', Math.round(m.lcp ?? m.fcp ?? 0), '', JSON.stringify({ ...m, route, tier, net }), String(req?.app || '').slice(0, 40));
  return { kept: true };
}
