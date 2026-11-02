import { boot } from '/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/worker/tests/harness.mjs';
import { buildView } from '/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/worker/src/views.js';
const N = Number(process.argv[2] || 1650), WEEKS = 12;
const { DB } = boot();
const day = { sleptAt: '22:15', wokeAt: '04:35', dayRestMin: 30, rounds: 16, chantingSameDay: true, chantingDoneAt: '07:10', hearingMin: 30, readingMin: 30, serviceMin: 45, hearing: [{ text: 'x' }], reading: { text: 'y' } };
const marks = Array(7).fill({ to_bed: { label: '10:00 - 10:15 PM', marks: 25 }, wake_up: { label: '04:30 - 04:45 AM', marks: 25 }, japa: { label: 'x', marks: 20 }, day_sleep: { label: 'x', marks: 25 } });
const s = DB.sql;
s.exec('BEGIN');
const ia = s.prepare("INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations) VALUES (?, 'DEVOTEE', 'ACTIVE', ?, 'x', 'x', 1)");
const im = s.prepare("INSERT INTO memberships (login, batch_id, state, from_week) VALUES (?, 'SPS', 'ACTIVE', '2026-01-05')");
const is = s.prepare(`INSERT INTO submissions (submission_id, login, name, batch_id, week_id, submitted_at, submitted_by, request_id, rules_version, bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall, seva_minutes, avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
  VALUES (?, ?, ?, 'SPS', ?, '2026-10-04T19:00:00+05:30', ?, ?, 'r1', 80, 80, 80, 80, 80, 80, 80, 100, 80, 80, 80, 300, '16', 'YES', 'YES', 210, 210, ?, ?)`);
const dj = JSON.stringify(Array(7).fill(day)), mj = JSON.stringify(marks);
const wk = (i) => { const d = new Date(Date.UTC(2026, 9, 5) - i * 7 * 864e5); return d.toISOString().slice(0, 10); };
for (let n = 0; n < N; n++) { const l = String(6000000900 + n); ia.run(l, 'Devotee ' + n); im.run(l); for (let w = 0; w < WEEKS; w++) is.run(l + '-' + wk(w), l, 'Devotee ' + n, wk(w), l, 'r' + n + w, dj, mj); }
s.exec('COMMIT');
const batches = [{ batch_id: 'SPS', name: 'SPS' }];
for (let i = 0; i < 3; i++) {
  const t0 = performance.now(); const v = await buildView(DB, batches, wk(0)); const ms = performance.now() - t0;
  console.log(`N=${N}: build ${ms.toFixed(0)} ms (Node, includes SQLite) · rows: ${Object.entries(v).map(([k, x]) => k + ' ' + x.length).join(', ')}`);
}
const { boardRows } = await import('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/worker/src/coord.js');
const { all } = await import('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/worker/src/db.js');
for (let i = 0; i < 2; i++) {
  let t0 = performance.now(); const b = await boardRows(DB, ['SPS'], wk(0)); const tb = performance.now() - t0;
  t0 = performance.now(); const subs = await all(DB, "SELECT * FROM submissions WHERE batch_id = 'SPS' AND week_id >= ?", wk(11)); const tq = performance.now() - t0;
  t0 = performance.now(); let n = 0; for (const s of subs.filter(x => x.week_id >= wk(3))) { const d = JSON.parse(s.days_json); n += d.length; } const tp = performance.now() - t0;
  // the same work without SQLite: rows already in memory (what a Worker's CPU would see), Days rows for one week
  const one = subs.filter(x => x.week_id === wk(0));
  t0 = performance.now(); const rows = []; for (const s of one) { const ds = JSON.parse(s.days_json), mk = JSON.parse(s.marks_json); ds.forEach((d, k) => rows.push([s.week_id, s.name, 'SPS', 'Mon', mk[k]?.to_bed?.label, d.rounds, `${d.dayRestMin} min`, `${d.hearingMin} min`])); } const tdw = performance.now() - t0;
  console.log(`board ${b.length} rows ${tb.toFixed(0)} ms · 12-week query ${subs.length} rows ${tq.toFixed(0)} ms · parse days(4 wk) ${tp.toFixed(0)} ms · Days rows for ONE week in memory (${rows.length}) ${tdw.toFixed(1)} ms`);
}
