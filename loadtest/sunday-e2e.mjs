// End-to-end Sunday submission on the TEST server (clock = Sunday 4 Oct 2026, 7 PM IST): three devotees each fill a
// whole week the way the app does (week.get → 7 × saveDay → week-end → attendance → submit), then check the result.
import { readFileSync } from 'node:fs';
const API = 'https://sadhana-record-api-load.iyfdelhi-sadhana.workers.dev/';
const people = JSON.parse(readFileSync('/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/loadtest/out/people.json', 'utf8')).devotees;
const call = async (action, data, token) => {
  const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ v: 1, action, token, requestId: crypto.randomUUID(), app: 'e2e', data }) });
  return r.json();
};
const W = '2026-10-12', days = Array.from({ length: 7 }, (_, k) => new Date(Date.parse(W + 'T00:00:00Z') + k * 864e5).toISOString().slice(0, 10));
const DAY = { sleptAt: '22:10', wokeAt: '04:30', dayRestMin: 20, rounds: 16, chantingSameDay: true, chantingDoneAt: '07:00', hearingMin: 30, readingMin: 30, serviceMin: 60,
  hearing: [{ text: 'Sunday class lecture' }], reading: { text: 'Bhagavad-gita As It Is' } };
let allOk = true;
for (const i of [1400, 1401, 1402]) {
  const d = people[i], steps = [];
  const w = await call('week.get', { weekId: W }, d.token);
  steps.push(['week.get', w.ok ? `${w.data.status}, submit window ${w.data.submitWindow?.opensAt?.slice(0, 16) ?? ''}` : w.error.code]);
  for (const date of days) { const v = w.data.days.find(x => x.date === date)?.version ?? 0; const r = await call('week.saveDay', { weekId: W, date, version: v, day: DAY }, d.token); if (!r.ok) steps.push([`saveDay ${date}`, r.error.code + ' ' + r.error.message]); }
  steps.push(['7 days saved', 'ok']);
  const we = await call('week.saveWeekEnd', { weekId: W, version: w.data.weekEnd?.version ?? 0, nightStay: 'YES', principles: 'YES' }, d.token);
  steps.push(['week-end', we.ok ? 'ok' : we.error.code]);
  const at = await call('week.setAttendance', { weekId: W, mark: 'P' }, d.token);
  steps.push(['attendance (Sunday)', at.ok ? 'ok' : at.error.code + ' ' + at.error.message]);
  const s = await call('week.submit', { weekId: W }, d.token);
  steps.push(['SUBMIT', s.ok ? `ok · overall ${s.data.scores.overall}%` : s.error.code + ' ' + s.error.message]);
  const again = await call('week.submit', { weekId: W }, d.token);
  steps.push(['submit again', again.ok ? 'ok?!' : again.error.code]);
  const after = await call('week.get', { weekId: W }, d.token), hist = await call('history.list', {}, d.token);
  steps.push(['afterwards', `week ${after.data?.status} · history ${hist.data?.weeks?.find(x => x.weekId === W)?.status}`]);
  const ok = s.ok && after.data?.status === 'SUBMITTED' && !again.ok;
  allOk &&= ok;
  console.log(`devotee ${i}${i === 1402 ? ' (no class day set, like the test account)' : ''}: ${ok ? 'PASS' : 'FAIL'}`);
  for (const [k, v] of steps) console.log(`   ${k.padEnd(20)} ${v}`);
}
console.log(allOk ? 'ALL SUBMITTED' : 'SOMETHING FAILED');
