import { readFileSync } from 'node:fs';
const people = JSON.parse(readFileSync('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/loadtest/out/people.json', 'utf8'));
const c = people.coordinators.find((x) => x.batch === 'SPS');
const marks = people.devotees.filter((d) => d.batch === 'SPS').slice(0, 250).map((d) => ({ login: d.login, mark: 'P' }));
for (let i = 0; i < 2; i++) {
  const t0 = performance.now();
  const r = await fetch('https://sadhana-record-api-load.iyfdelhi-sadhana.workers.dev/', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ v: 1, action: 'attendance.set', token: c.token, requestId: crypto.randomUUID(), app: 'load', data: { batchId: 'SPS', weekId: '2026-09-28', marks } }) });
  const j = await r.json();
  console.log(Math.round(performance.now() - t0) + 'ms', r.headers.get('x-meter'), j.ok ? JSON.stringify(j.data) : JSON.stringify(j.error).slice(0, 200));
}
