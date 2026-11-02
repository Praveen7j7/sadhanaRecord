// Temple activities (phase 21, 23 Oct 2026; the head's "Update Sadhana" screenshot): a temple resident answers Mangal
// Aarti, Darshan Aarti, Morning Class and Prasadam each day as On Time / Late / Absent. Only a batch with the flag
// (the Temple Residents, migration 0062) is asked; never required. Since Phase 22 (migration 0065) the TRD card scores
// them as the Morning program (tests/trd-scoring.test.mjs has the scheme); before that they were recorded, not scored.
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';
import { TEMPLE_KEYS } from '../../shared/temple.js';

const t = suite('phase 21: the temple activities');
const { call, clock, rows, addAccount } = boot();
const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-06T10:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const PROFILE = { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' },
  address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const join = async (phone, batchId, name) => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, groupLeader: LEAD[batchId] || 'Hari Das Pr', password: 'Devotee pass 2026', profile: PROFILE });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const T = await join('6000000161', 'TRD', 'Temple Devotee'), S = await join('6000000162', 'SPS', 'Class Devotee');
{
  t.eq(rows("SELECT batch_id, temple_activities AS f FROM batches WHERE temple_activities = 1"), [{ batch_id: 'TRD', f: 1 }], 'only the Temple Residents batch asks the temple activities');
  // r3 in 0062; r4 since the TRD card (Phase 22, migration 0065)
  t.eq(rows("SELECT value FROM settings WHERE key = 'rules_version'")[0].value, 'r4', 'and phones fetch the rules again (r4)');
}

// what the phone is told
let r = await call('rules.get', {}, T);
t.eq([r.ok, r.data.temple, r.data.cardName], [true, true, 'TRD'], 'a temple resident\'s rules ask the temple activities, on the TRD card (Phase 22)');
r = await call('rules.get', {}, S);
t.eq(r.data.temple, false, 'an SPS devotee\'s do not');
r = await call('rules.get', { onBehalfOf: '6000000161' }, M);
t.eq(r.data.temple, true, 'filling for a temple resident, the head is asked them too');

// saving
const W = (await call('home.get', {}, T)).data.weeks.at(-1).weekId, D = '2026-10-06';
r = await call('week.saveDay', { weekId: W, date: D, version: 0, day: { mangalAarti: 'ON_TIME', darshanAarti: 'LATE' } }, T);
t.eq([r.ok, r.data?.state], [true, 'partial'], 'a temple resident saves two answers; the day is still partial (they are not required)');
t.ok(!TEMPLE_KEYS.some((k) => r.data.missing.includes(k)), 'and none of the four is listed as missing');
r = await call('week.saveDay', { weekId: W, date: D, version: 1, day: { morningClass: 'ABSENT', prasadam: 'ON_TIME' } }, T);
t.code(r, 'ok', 'the other two');
const saved = JSON.parse(rows(`SELECT d2 FROM drafts WHERE login = '6000000161' AND week_id = '${W}'`)[0].d2);
t.eq(TEMPLE_KEYS.map((k) => saved[k]), ['ON_TIME', 'LATE', 'ABSENT', 'ON_TIME'], 'all four are stored on the day');
t.eq(r.data.marks.morning, { label: '4 of 4 answered', marks: 13, of: 20 }, 'and scored as the Morning program: on time 5 + late 3 + absent 0 + on time 5 (Phase 22)');
t.code(await call('week.saveDay', { weekId: W, date: D, version: 2, day: { mangalAarti: 'EARLY' } }, T), 'VALIDATION', 'an answer outside On Time / Late / Absent is refused');
r = await call('week.saveDay', { weekId: W, date: D, version: 2, day: { mangalAarti: null } }, T);
t.ok(r.ok && !('mangalAarti' in JSON.parse(rows(`SELECT d2 FROM drafts WHERE login = '6000000161' AND week_id = '${W}'`)[0].d2)), 'an answer can be cleared');

// nobody else can store them
const WS = (await call('home.get', {}, S)).data.weeks.at(-1).weekId;
r = await call('week.saveDay', { weekId: WS, date: D, version: 0, day: { mangalAarti: 'ON_TIME' } }, S);
t.eq([r.ok ? 'ok' : r.error.code, r.error?.fields?.[0]?.path || r.error?.details?.[0]?.path || ''], ['VALIDATION', 'day.mangalAarti'], 'an SPS devotee cannot store a temple answer');

// a complete day with the answers submits and keeps them in the week
const full = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
r = await call('week.saveDay', { weekId: W, date: D, version: 3, day: { ...full, mangalAarti: 'LATE' } }, T);
t.eq(r.data?.state, 'complete', 'the nine answers complete the day; the temple answers change nothing about that');

t.done();
