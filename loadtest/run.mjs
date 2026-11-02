// Phase 6 load test against the SEPARATE load Worker (sadhana-record-api-load + sadhana-load database).
//   node loadtest/run.mjs profile     each action alone, warm, N times: latency + D1 rows (x-meter)
//   node loadtest/run.mjs devices     5 phones saving the same day at once (and, with the clock on Sunday, submitting)
//   node loadtest/run.mjs ramp        open-loop steps of rising requests/second, the 9 PM mix
//   node loadtest/run.mjs submit      Sunday wave of submits (clock shifted to Sunday evening on the load Worker)
// Writes loadtest/out/<phase>.jsonl (one line per call). CPU time per call comes from `wrangler tail --env load`.
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';

const URL_ = 'https://sadhana-record-api-load.iyfdelhi-sadhana.workers.dev/';
const people = JSON.parse(readFileSync(new URL('./out/people.json', import.meta.url), 'utf8'));
const phase = process.argv[2] || 'profile';
const out = new URL(`./out/${phase}.jsonl`, import.meta.url);
writeFileSync(out, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;

async function call(action, data, token, ip) {
  const body = JSON.stringify({ v: 1, action, token, requestId: crypto.randomUUID(), app: 'load', data });
  const t0 = performance.now();
  let status = 0, ok = false, code = '', meter = null, j = null;
  try {
    const r = await fetch(URL_, { method: 'POST', headers: { 'content-type': 'text/plain', 'x-load-ip': ip || '10.0.0.' + (seq % 250) }, body });
    status = r.status; meter = JSON.parse(r.headers.get('x-meter') || 'null');
    const text = await r.text();
    try { j = JSON.parse(text); ok = !!j.ok; code = j.ok ? '' : j.error?.code || ''; } catch { code = 'HTTP_' + status + (/1102|exceeded/i.test(text) ? '_CPU' : ''); }
  } catch (e) { code = 'NETWORK'; }
  const ms = Math.round(performance.now() - t0);
  appendFileSync(out, JSON.stringify({ i: ++seq, at: Date.now(), action, ms, status, ok, code, ...(meter || {}) }) + '\n');
  return { ok, code, data: j?.data, error: j?.error, ms };
}

const IST = (d) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
const mondayOf = (ymd) => { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const skew = Number(process.env.SKEW_MS || 0);
const today = IST(new Date(Date.now() + skew)), week = mondayOf(today);
const DAY = { sleptAt: '22:15', wokeAt: '04:35', dayRestMin: 30, rounds: 16, chantingSameDay: true, chantingDoneAt: '07:10', hearingMin: 30, readingMin: 30, serviceMin: 45,
  hearing: [{ text: 'Load test lecture' }], reading: { text: 'Load test book' } };
const dev = (i) => people.devotees[i % people.devotees.length];
const coord = (b) => people.coordinators.find((c) => c.batch === b);

// one devotee's "save today": read the version, then save (the app does the same)
async function saveToday(d, date = today) {
  const w = await call('week.get', { weekId: week }, d.token);
  const v = w.data?.days?.find((x) => x.date === date)?.version ?? 0;
  return call('week.saveDay', { weekId: week, date, version: v, day: DAY }, d.token);
}

if (phase === 'profile') {
  const N = Number(process.env.N || 12);
  const m = people.master, c = coord('SPS');
  const reads = [
    ['meta.get', () => [{}, undefined]], ['auth.me', (i) => [{}, dev(i).token]], ['home.get', (i) => [{}, dev(i).token]],
    ['week.get', (i) => [{ weekId: week }, dev(i).token]], ['history.list', (i) => [{}, dev(i).token]], ['profile.get', (i) => [{}, dev(i).token]],
    ['rules.get', (i) => [{}, dev(i).token]], ['journals.get', (i) => [{}, dev(i).token]], ['announcements.list', (i) => [{}, dev(i).token]],
    ['devotees.list', () => [{ batchId: 'SPS' }, c.token]], ['stats.batch', () => [{ batchId: 'SPS' }, c.token]], ['members.list', () => [{ batchId: 'SPS' }, c.token]],
    ['birthdays.today', () => [{}, c.token]], ['requests.list', () => [{ batchId: 'SPS' }, c.token]], ['stats.all', () => [{}, m.token]],
    ['members.list (all)', () => [{}, m.token]], ['audit.list', () => [{}, m.token]], ['facilitators.list', () => [{}, m.token]]
  ];
  for (const [name, args] of reads) {
    for (let i = 0; i < N; i++) { const [data, token] = args(100 + i); await call(name.split(' ')[0], data, token); }
    console.log('profiled', name);
  }
  // writes: each on a different devotee (no STALE), N times
  for (let i = 0; i < N; i++) await saveToday(dev(300 + i));
  console.log('profiled week.saveDay');
  for (let i = 0; i < N; i++) await call('week.saveWeekEnd', { weekId: week, version: 0, nightStay: 'YES', principles: 'YES' }, dev(300 + i).token);
  console.log('profiled week.saveWeekEnd');
  for (let i = 0; i < N; i++) await call('auth.login', { login: dev(500 + i).login, password: 'Load test pass 2026' }, undefined, '10.9.9.' + i);
  console.log('profiled auth.login');
  for (let i = 0; i < 3; i++) await call('attendance.set', { batchId: 'SPS', weekId: week, marks: people.devotees.filter((d) => d.batch === 'SPS').slice(0, 50).map((d) => ({ login: d.login, mark: 'P' })) }, c.token);
  console.log('profiled attendance.set (50 marks)');
}

if (phase === 'devices') {
  // 5 phones of the same devotee save the same day at the same moment, 10 times over
  const res = [];
  for (let t = 0; t < 10; t++) {
    const d = dev(1500 + t);
    const w = await call('week.get', { weekId: week }, d.token);
    const v = w.data?.days?.find((x) => x.date === today)?.version ?? 0;
    const r = await Promise.all([0, 1, 2, 3, 4].map((k) => call('week.saveDay', { weekId: week, date: today, version: v, day: { ...DAY, rounds: 16 + k } }, d.token)));
    res.push(r.map((x) => (x.ok ? 'ok' : x.code)).sort().join(','));
  }
  console.log(JSON.stringify(res));
}

if (phase === 'ramp') {
  // open loop: requests start on a timer whatever the answers do; the 9 PM mix
  const steps = (process.env.STEPS || '5,10,20,40,80,160').split(',').map(Number), secs = Number(process.env.SECS || 20);
  const mix = [[0.44, 'home.get'], [0.15, 'week.get'], [0.12, 'announcements.list'], [0.15, 'save'], [0.12, 'auth.me'], [0.01, 'devotees.list'], [0.01, 'stats.batch']];
  let k = 0;
  for (const rps of steps) {
    const t0 = Date.now(), pend = [];
    console.log(`step ${rps}/s for ${secs}s`);
    for (let n = 0; n < rps * secs; n++) {
      const due = t0 + (n * 1000) / rps; const wait = due - Date.now(); if (wait > 0) await sleep(wait);
      const r = Math.random(); let acc = 0, pick = 'home.get';
      for (const [p, a] of mix) { acc += p; if (r < acc) { pick = a; break; } }
      const d = dev(k++ * 7919);
      const c = coord(d.batch);
      const job = pick === 'save' ? saveToday(d) : pick === 'week.get' ? call('week.get', { weekId: week }, d.token)
        : pick === 'devotees.list' ? call('devotees.list', { batchId: c.batch }, c.token) : pick === 'stats.batch' ? call('stats.batch', { batchId: c.batch }, c.token)
        : call(pick, {}, d.token);
      pend.push(job.then(() => {}, () => {}));
    }
    await Promise.all(pend);
    appendFileSync(out, JSON.stringify({ step: rps, from: t0, to: Date.now() }) + '\n');
    await sleep(3000);
  }
}

if (phase === 'fill') {
  // complete weeks through the API (7 days, week-end answers, own attendance) for the devotees the submit wave uses
  const from = Number(process.env.FROM || 1000), count = Number(process.env.COUNT || 205), conc = 8;
  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(week + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); });
  let next = 0, bad = 0;
  async function one(d) {
    const w = await call('week.get', { weekId: week }, d.token);
    for (const date of days) {
      const v = w.data?.days?.find((x) => x.date === date)?.version ?? 0;
      const r = await call('week.saveDay', { weekId: week, date, version: v, day: DAY }, d.token); if (!r.ok) bad++;
    }
    const r1 = await call('week.saveWeekEnd', { weekId: week, version: w.data?.weekEnd?.version ?? 0, nightStay: 'YES', principles: 'YES' }, d.token); if (!r1.ok) bad++;
    const r2 = await call('week.setAttendance', { weekId: week, mark: 'P' }, d.token); if (!r2.ok) bad++;
  }
  await Promise.all(Array.from({ length: conc }, async () => { while (next < count) await one(dev(from + next++)); }));
  console.log('filled', count, 'weeks; failed calls', bad);
}

if (phase === 'submit') {
  // needs SKEW_MS so that "today" is Sunday evening, and drafts already complete (loadtest/drafts.sql)
  const from = Number(process.env.FROM || 1000), count = Number(process.env.COUNT || 200), rps = Number(process.env.RPS || 20);
  const t0 = Date.now(), pend = [];
  for (let n = 0; n < count; n++) {
    const due = t0 + (n * 1000) / rps; const wait = due - Date.now(); if (wait > 0) await sleep(wait);
    pend.push(call('week.submit', { weekId: week }, dev(from + n).token));
  }
  const rs = await Promise.all(pend);
  const tally = {}; for (const r of rs) tally[r.ok ? 'ok' : r.code] = (tally[r.ok ? 'ok' : r.code] || 0) + 1;
  console.log('submit', JSON.stringify(tally));
  // 5 phones submitting the same week at once
  const five = [];
  for (let t = 0; t < 5; t++) {
    const d = dev(from + count + t);
    const r = await Promise.all([0, 1, 2, 3, 4].map(() => call('week.submit', { weekId: week }, d.token)));
    five.push(r.map((x) => (x.ok ? 'ok' : x.code)).sort().join(','));
  }
  console.log('5 phones submit:', JSON.stringify(five));
}
console.log('done', phase, seq, 'calls');
