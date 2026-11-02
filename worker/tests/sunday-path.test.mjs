// S2 (COPIES_AND_SPEED_AUDIT_2026-10-27 §5): the Sunday path — the calls every devotee makes most — in fewer round trips,
// with every reply exactly as it was.
//
//   1. PARITY. One scripted world runs every week.* action through its normal and refusal paths (STALE, a retried save,
//      ALREADY_SUBMITTED, WINDOW_CLOSED, MISSED, a reopened week, FUTURE_DAY, INCOMPLETE, VALIDATION, a coordinator on a
//      devotee's behalf, an inactive devotee coming back, a no-class week). Every reply is compared with the replies the
//      code gave BEFORE this change, kept in tests/fixtures/sunday-path-replies.json (recorded with RECORD=1 on 27 Oct
//      2026 from the unchanged weeks.js). A reply that differs fails here. Re-record ONLY for an intended reply change.
//   2. BUDGETS. Round trips per action (a statement alone is one; a batch is one), measured the way round-trips.test.mjs
//      does, on calls whose hourly session refresh is not due. They were 13 / 13 / 11 / 9 / 8 before (audit §5 S2).
//   3. ROWS. Rows returned per action, before and after, so fewer hops are not bought with more rows.
import fs from 'node:fs';
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';
import { runDeadline } from '../src/weeks.js';

const t = suite('S2: the Sunday path, fewer round trips, the same replies');
const GOLD = new URL('./fixtures/sunday-path-replies.json', import.meta.url);
const RECORD = process.env.RECORD === '1';
const { env, DB, call, clock, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const join = async (phone, batchId, name) => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, groupLeader: LEAD[batchId], password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000199' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000196', 'SPS2', 'Arjun Das');
const B = await join('6000000197', 'SPS2', 'Bhima Das');
const X = await join('6000000198', 'BSS', 'Other Batch');
DB.sql.exec("UPDATE settings SET value = '2026-09-21' WHERE key = 'tracking_from'");
DB.sql.exec("UPDATE memberships SET from_week = '2026-09-21' WHERE login IN ('6000000196', '6000000197', '6000000198')");

// ---- the meter: round trips and rows returned, per call ----
let hops = 0, rowsBack = 0;
const realPrepare = DB.prepare.bind(DB), realBatch = DB.batch.bind(DB);
const count = (r) => { if (r && Array.isArray(r.results)) rowsBack += r.results.length; else if (r && !r.meta) rowsBack += 1; return r; };
DB.prepare = (s) => { const wrap = (x) => ({ ...x, s: x.s, args: x.args, bind: (...a) => wrap(x.bind(...a)),
  first: async () => { hops++; return count(await x.first()); }, all: async () => { hops++; return count(await x.all()); }, run: async () => { hops++; return x.run(); } });
  return wrap(realPrepare(s)); };
DB.batch = async (list) => { hops++; const out = await realBatch(list); out.forEach(count); return out; };

const replies = [], cost = {};
/** One call of the script: its reply is kept for the parity check, its cost under its label. */
const step = async (label, action, data, token) => {
  hops = 0; rowsBack = 0;
  const r = await call(action, data, token);
  replies.push([label, r]);
  cost[label] = { action, hops, rows: rowsBack };
  return r;
};
/** A budget probe: the same call, first warming the session so its hourly refresh is not counted. */
const probe = async (label, action, data, token) => { await call('auth.me', {}, token); return step(label, action, data, token); };

const W1 = '2026-09-28', W2 = '2026-10-05', W3 = '2026-10-12';
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
const rich = { ...day, hearingMin: 30, hearing: [{ lectureId: 'SD-W001-SPL' }, { text: 'A class on Sunday' }], readingMin: 20, reading: { bookId: 'B01' },
               chetnaPositive: ['Appreciative'], chetnaNegative: ['Angry'], comment: 'Good day' };

// Monday 10:00: last week (W1) open until its 9 PM deadline, this week (W2) begun
at('2026-10-05T10:00:00');
await probe('get W2 not started', 'week.get', { weekId: W2 }, A);
await step('get bad week', 'week.get', { weekId: 'x' }, A);
await step('get W1 not started', 'week.get', { weekId: W1 }, A);
await step('get closed week', 'week.get', { weekId: '2026-09-21' }, A);
await probe('saveDay new draft', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 0, day }, A);
await probe('saveDay retried', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 0, day }, A);
await step('saveDay stale', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 0, day: { ...day, rounds: 12 } }, A);
await step('saveDay future', 'week.saveDay', { weekId: W2, date: '2026-10-06', version: 0, day }, A);
await step('saveDay not in week', 'week.saveDay', { weekId: W2, date: '2026-10-12', version: 0, day }, A);
await step('saveDay no version', 'week.saveDay', { weekId: W2, date: '2026-10-05', day }, A);
await probe('saveDay lookups', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 1, day: rich }, A);
await step('saveDay bad lookups', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 2,
  day: { hearingMin: 10, hearing: [{ lectureId: 'BSS-W001-SPL' }], reading: { bookId: 'NOPE' }, chetnaPositive: ['Nope'], rounds: 99 } }, A);
await step('saveDay unknown field', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 2, day: { colour: 'red' } }, A);
await step('saveDay clears a field', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 2, day: { comment: null } }, A);
await probe('saveDay existing draft', 'week.saveDay', { weekId: W1, date: '2026-09-28', version: 0, day }, A);
await step('saveDay W1 day 2', 'week.saveDay', { weekId: W1, date: '2026-09-29', version: 0, day }, A);
await step('saveDay closed week', 'week.saveDay', { weekId: '2026-09-21', date: '2026-09-21', version: 0, day }, A);
await step('saveDay behalf', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 0, day, onBehalfOf: '6000000197' }, C);
await step('saveDay behalf other batch', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 0, day, onBehalfOf: '6000000198' }, C);
await probe('get W2 draft', 'week.get', { weekId: W2 }, A);
await step('get W2 behalf', 'week.get', { weekId: W2, onBehalfOf: '6000000196' }, C);
await step('weekEnd too early', 'week.saveWeekEnd', { weekId: W2, version: 0, nightStay: 'YES', principles: 'YES' }, A);
await step('attendance too early', 'week.setAttendance', { weekId: W2, mark: 'P' }, A);
await step('attendance bad mark', 'week.setAttendance', { weekId: W1, mark: 'X' }, A);
await probe('attendance W1', 'week.setAttendance', { weekId: W1, mark: 'P' }, A);
await step('submit incomplete', 'week.submit', { weekId: W1 }, A);
await probe('weekEnd W1', 'week.saveWeekEnd', { weekId: W1, version: 0, nightStay: 'YES', principles: 'YES' }, A);
await step('weekEnd retried', 'week.saveWeekEnd', { weekId: W1, version: 0, nightStay: 'YES', principles: 'YES' }, A);
await step('weekEnd stale', 'week.saveWeekEnd', { weekId: W1, version: 0, nightStay: 'NO' }, A);
await step('weekEnd bad value', 'week.saveWeekEnd', { weekId: W1, version: 1, nightStay: 'MAYBE' }, A);
await step('weekEnd no version', 'week.saveWeekEnd', { weekId: W1, principles: 'NO' }, A);
await step('get W1 draft', 'week.get', { weekId: W1 }, A);
await probe('submit W1', 'week.submit', { weekId: W1 }, A);
await step('submit again', 'week.submit', { weekId: W1 }, A);
await step('saveDay submitted', 'week.saveDay', { weekId: W1, date: '2026-09-30', version: 0, day }, A);
await step('weekEnd submitted', 'week.saveWeekEnd', { weekId: W1, version: 1, nightStay: 'NO' }, A);
await probe('get W1 submitted', 'week.get', { weekId: W1 }, A);
await step('attendance submitted week', 'week.setAttendance', { weekId: W1, mark: 'A' }, A);
await step('get W1 submitted after mark', 'week.get', { weekId: W1 }, A);
await step('submit before window', 'week.submit', { weekId: W2 }, A);
await step('history', 'history.list', { limit: 5 }, A);

// Sunday evening: the window is open
at('2026-10-11T19:00:00');
await step('weekEnd W2', 'week.saveWeekEnd', { weekId: W2, version: 0, nightStay: 'YES', principles: 'NO' }, A);
await step('attendance W2', 'week.setAttendance', { weekId: W2, mark: 'A' }, A);
await step('submit nothing filled', 'week.submit', { weekId: W2 }, X);
await step('submit behalf', 'week.submit', { weekId: W2, onBehalfOf: '6000000196' }, C);
await step('get W2 submitted', 'week.get', { weekId: W2 }, A);
// a week with no regular class: the coordinator gives attendance
await call('weeks.setClass', { batchId: 'SPS2', weekId: W3, kind: 'FESTIVAL', note: 'Diwali', everyonePresent: true }, C);
at('2026-10-18T10:00:00');
await step('attendance class week', 'week.setAttendance', { weekId: W3, mark: 'P' }, A);
await step('get W3 class week', 'week.get', { weekId: W3 }, A);
await step('saveDay W3', 'week.saveDay', { weekId: W3, date: '2026-10-12', version: 0, day }, A);

// the Monday deadlines: W2 and W3 close; Bhima missed W2 (his saved day was for W2 — auto-submitted), X missed W2
at('2026-10-12T21:05:00');
for (let i = 0, out = ''; i < 6 && !/closed|up to date/.test(out); i++) out = await runDeadline(env, DB, new Date(clock.now));
at('2026-10-13T10:00:00');
await step('get missed', 'week.get', { weekId: W2 }, X);
await step('saveDay missed', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 0, day }, X);
await step('attendance missed', 'week.setAttendance', { weekId: W2, mark: 'P' }, X);
await step('get B auto-submitted', 'week.get', { weekId: W2 }, B);
// the head reopens X's missed week
await call('weeks.reopen', { login: '6000000198', weekId: W2, reason: 'Hospital', openUntil: '2026-10-15T21:00:00+05:30' }, M);
await step('get reopened', 'week.get', { weekId: W2 }, X);
await step('saveDay reopened', 'week.saveDay', { weekId: W2, date: '2026-10-05', version: 0, day }, X);
await step('weekEnd reopened', 'week.saveWeekEnd', { weekId: W2, version: 0, nightStay: 'NO', principles: 'YES' }, X);
await step('attendance reopened', 'week.setAttendance', { weekId: W2, mark: 'P' }, X);
await step('submit reopened', 'week.submit', { weekId: W2 }, X);
await step('get behalf old week', 'week.get', { weekId: W1, onBehalfOf: '6000000196' }, C);
await step('get head old week', 'week.get', { weekId: W1, onBehalfOf: '6000000196' }, M);
await step('get head not a devotee', 'week.get', { weekId: W1 }, M);
// an inactive devotee's saved day brings them back (ADR 0020)
DB.sql.exec("UPDATE memberships SET state = 'INACTIVE' WHERE login = '6000000196' AND to_week = ''");
await step('saveDay inactive comes back', 'week.saveDay', { weekId: W3, date: '2026-10-13', version: 0, day }, A);
await step('home after', 'home.get', {}, A);

// ---- 1. parity ----
const got = Object.fromEntries(replies.map(([k, r]) => [k, r]));
if (RECORD) {
  fs.mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true });
  fs.writeFileSync(GOLD, JSON.stringify({ recorded: '2026-10-27 (weeks.js before S2)', replies: got, cost }, null, 1) + '\n');
  console.log(`  recorded ${replies.length} replies`);
}
const gold = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
t.eq(Object.keys(got), Object.keys(gold.replies), `the same ${replies.length} calls as the recording`);
let same = 0;
for (const [k, r] of Object.entries(got)) { if (JSON.stringify(r) === JSON.stringify(gold.replies[k])) same++; else t.eq(r, gold.replies[k], `reply unchanged: ${k}`); }
t.eq(same, replies.length, `${same} of ${replies.length} replies are exactly as before`);
t.ok(replies.filter(([, r]) => !r.ok).length >= 20 && new Set(replies.filter(([, r]) => !r.ok).map(([, r]) => r.error.code)).size >= 7,
  `the script reaches the refusal paths (${[...new Set(replies.filter(([, r]) => !r.ok).map(([, r]) => r.error.code))].join(', ')})`);

// ---- 2. budgets (each probe's session refresh is warmed first, so these are the action's own hops) ----
for (const [label, budget, was] of [
  ['saveDay new draft', 4, 13], ['saveDay existing draft', 4, 12], ['saveDay retried', 3, 11], ['saveDay lookups', 4, 16],
  ['weekEnd W1', 4, 11], ['attendance W1', 4, 8], ['submit W1', 5, 13],
  ['get W2 draft', 4, 9], ['get W2 not started', 4, 9], ['get W1 submitted', 3, 4]
]) {
  const c = cost[label], old = gold.cost[label];
  t.ok(c.hops <= budget, `${c.action} (${label}): ${c.hops} round trips, budget ${budget} (recorded before: ${old?.hops}, audit: ${was})`);
  // ---- 3. rows: never more rows for fewer hops
  t.ok(c.rows <= old.rows + 1, `${label}: ${c.rows} rows returned (before ${old.rows})`);
}
console.log('  hops / rows per probe, before → after:');
for (const k of Object.keys(cost).filter(k => gold.cost[k] && /^(saveDay (new|existing|retried|lookups)|weekEnd W1|attendance W1|submit W1|get W2 draft|get W2 not|get W1 submitted)/.test(k)))
  console.log(`    ${k.padEnd(24)} ${String(gold.cost[k].hops).padStart(2)} → ${String(cost[k].hops).padStart(2)} hops · ${String(gold.cost[k].rows).padStart(3)} → ${String(cost[k].rows).padStart(3)} rows`);

t.done();
