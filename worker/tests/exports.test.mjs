// Phase 9, item 21 (the head, 9 Oct 2026): exports for coordinators and the IYF head, a page at a time.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { runDeadline } from '../src/weeks.js';
import { PER_HOUR, fieldGaps } from '../src/exports.js';

const t = suite('phase 9: exports');
const { env, DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
DB.sql.exec("UPDATE accounts SET is_master = 1 WHERE login = 'master'");
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const join = async (phone, name, batchId = 'SPS2') => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000161', 'Arjun Das');
await join('6000000162', 'Bhima Das');
await join('6000000163', 'Other Batch', 'BSS');
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");
const W = '2026-10-05';
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30,
              hearingMin: 40, hearing: [{ lectureId: 'SD-W001-SPL' }], readingMin: 30, reading: { bookId: 'B41' }, serviceMin: 60 };
t.code(await call('week.saveDay', { weekId: W, date: W, version: 0, day }, A), 'ok', 'Arjun fills Monday');
at('2026-10-12T21:01:00');
for (let i = 0; i < 10; i++) { const r = await runDeadline(env, DB, new Date(clock.now)); if (r === 'up to date' || r.endsWith('closed')) break; }
t.eq(rows(`SELECT login FROM submissions WHERE week_id = '${W}'`).map(r => r.login), ['6000000161'], 'the deadline submitted Arjun\'s part week');
t.ok(rows(`SELECT login FROM missed_weeks WHERE week_id = '${W}' AND batch_id = 'SPS2'`).some(r => r.login === '6000000162'), 'and marked Bhima missed');

/** Every page of an export: { columns, rows, pages }. */
const all = async (tok, data) => {
  let cursor, out = null, pages = 0;
  do {
    const r = await call('exports.page', { ...data, ...(cursor ? { cursor } : {}) }, tok);
    if (!r.ok) return r;
    out = out ? { ...out, rows: [...out.rows, ...r.data.rows] } : r.data; cursor = r.data.next; pages++;
  } while (cursor && pages < 60);
  return { ok: true, columns: out.columns, rows: out.rows, pages };
};
const col = (x, label) => x.columns.indexOf(label);
const byPhone = (x, phone) => x.rows.find(r => r[col(x, 'Phone')] === phone);

t.eq(fieldGaps(), { noValue: [], notShared: [] }, 'every shared export field has a value on the server, and none is extra');

// ---- the catalog: what this person may choose
let c = (await call('exports.catalog', {}, C)).data;
t.eq(c.grains.map(g => g.id), ['people', 'weeks', 'days'], 'a coordinator: devotee, week and day rows');
t.ok(!c.fields.some(f => f.personal), 'no personal fields offered to a coordinator');
t.eq(c.batches.map(b => b.id), ['SPS2'], 'only their batch');
c = (await call('exports.catalog', {}, M)).data;
t.ok(c.grains.some(g => g.id === 'activity') && c.fields.some(f => f.id === 'dob' && f.personal), 'the head: also staff, batches, Activity, and personal fields');
t.code(await call('exports.catalog', {}, A), 'FORBIDDEN', 'a devotee has no exports');

// ---- per week: scores, attendance and profile fields in one file
let x = await all(C, { grain: 'weeks', fields: ['week', 'name', 'phone', 'facilitator', 'email', 'weekStatus', 'weekDays', 'overall', 'attendance', 'markedBy'], batchIds: ['SPS2'], from: '2026-10-01', to: '2026-10-31' });
t.ok(x.ok && x.pages === 5, 'October: one page a week (5 weeks)');
t.eq(x.columns, ['Week (Monday)', 'Name', 'Phone', 'Facilitator', 'Email', 'Week status', 'Days filled', 'Overall', 'Attendance', 'Marked by'], 'exactly the chosen fields, in the chosen order');
t.eq([byPhone(x, '6000000161')?.[col(x, 'Week status')], byPhone(x, '6000000161')?.[col(x, 'Days filled')], byPhone(x, '6000000161')?.[col(x, 'Facilitator')]], ['Submitted', 1, FAC], 'Arjun: submitted, 1 day, with his facilitator');
t.eq([byPhone(x, '6000000162')?.[col(x, 'Week status')], byPhone(x, '6000000162')?.[col(x, 'Overall')]], ['Missed', 0], 'Bhima: missed, 0');
t.ok(!byPhone(x, '6000000163'), 'no one from another batch');
x = await all(C, { grain: 'weeks', fields: ['phone', 'weekStatus'], batchIds: ['SPS2'], from: W, to: W, filters: { status: 'missed' } });
t.eq(x.rows, [['6000000162', 'Missed']], 'filter: only missed weeks');
x = await all(C, { grain: 'weeks', fields: ['phone'], batchIds: ['SPS2'], from: W, to: W, filters: { facilitator: 'Nobody Prabhuji' } });
t.eq(x.rows.length, 0, 'filter: by facilitator');

// ---- per day
x = await all(C, { grain: 'days', fields: ['date', 'name', 'rounds', 'sleptAt', 'dayService', 'marksJapa'], batchIds: ['SPS2'], from: W, to: W });
t.eq(x.rows.length, 1, 'by day: only the days inside the range (Monday 5 Oct)');
t.eq(x.rows[0].slice(0, 5), [W, 'Arjun Das', 16, '22:05', 60], 'Monday\'s answers');
x = await all(C, { grain: 'days', fields: ['date'], batchIds: ['SPS2'], from: W, to: '2026-10-11' });
t.eq(x.rows.length, 7, 'the whole week: 7 days');

// ---- per devotee: the profile view, with the sadhana summary of the range
x = await all(C, { grain: 'people', fields: ['name', 'phone', 'classDay', 'facilitator', 'status', 'weeksSubmitted', 'weeksMissed', 'daysFilled', 'avgOverall'], batchIds: ['SPS2'], from: '2026-10-01', to: '2026-10-31' });
t.eq(x.rows.map(r => r[0]).sort(), ['Arjun Das', 'Bhima Das'], 'the batch\'s devotees');
t.eq(byPhone(x, '6000000161').slice(5, 8), [1, 0, 1], 'Arjun: 1 week submitted, none missed, 1 day');
t.eq(byPhone(x, '6000000161')[8], rows("SELECT overall FROM submissions WHERE login = '6000000161'")[0].overall, 'his average overall is his one week\'s');
t.eq(byPhone(x, '6000000162').slice(5, 7), [0, 1], 'Bhima: 1 week missed');
x = await all(C, { grain: 'people', fields: ['name', 'email'], batchIds: ['SPS2'] });
t.ok(x.ok && x.rows.length === 2, 'a plain contact list needs no dates');
t.code(await call('exports.page', { grain: 'people', fields: ['name', 'avgOverall'], batchIds: ['SPS2'] }, C), 'VALIDATION', 'summary fields need the dates');
t.code(await call('exports.page', { grain: 'people', fields: ['name', 'dob'], batchIds: ['SPS2'] }, C), 'FORBIDDEN', 'a coordinator cannot ask for personal fields');
x = await all(M, { grain: 'people', fields: ['phone', 'pin', 'bloodGroup'], batchIds: ['SPS2'] });
t.eq(byPhone(x, '6000000161').slice(1), ['110026', 'O+'], 'the head: personal fields when ticked');
x = await all(M, { grain: 'people', fields: ['name'], batchIds: ['SPS2', 'BSS'] });
t.eq(x.pages, 2, 'two batches: one page each');

// ---- the rules
t.code(await call('exports.page', { grain: 'weeks', fields: ['name'], batchIds: ['BSS'], from: W, to: W }, C), 'FORBIDDEN', 'a coordinator cannot export another batch');
t.code(await call('exports.page', { grain: 'weeks', fields: ['date'], batchIds: ['SPS2'], from: W, to: W }, C), 'VALIDATION', 'a field of another row kind is refused');
t.code(await call('exports.page', { grain: 'weeks', fields: [], batchIds: ['SPS2'], from: W, to: W }, C), 'VALIDATION', 'at least one field');
t.code(await call('exports.page', { grain: 'staff' }, C), 'FORBIDDEN', 'a coordinator cannot export the staff list');
t.code(await call('exports.page', { grain: 'activity', from: W, to: W }, C), 'FORBIDDEN', 'nor the Activity log');
t.code(await call('exports.page', { grain: 'weeks', fields: ['name'], batchIds: ['SPS2'], from: W, to: W }, A), 'FORBIDDEN', 'a devotee cannot export');
t.code(await call('exports.page', { grain: 'weeks', fields: ['name'], batchIds: ['SPS2'], from: '2026-01-01', to: '2026-10-01' }, C), 'VALIDATION', 'more than 6 months at a time is refused');
t.code(await call('exports.page', { grain: 'weeks', fields: ['name'], batchIds: ['SPS2'], from: '2026-10-10', to: '2026-10-01' }, C), 'VALIDATION', 'an end before the start is refused');
t.code(await call('exports.page', { grain: 'nope', fields: ['name'], batchIds: ['SPS2'] }, C), 'VALIDATION', 'an unknown row kind is refused');
const logged = rows("SELECT who, after FROM audit_log WHERE action = 'exports.run' ORDER BY id");
t.ok(logged.some(l => l.who === 'sps' && /"rows":"weeks"/.test(l.after) && /"from":"2026-10-01"/.test(l.after) && /"facilitator"/.test(l.after)), 'each export is in Activity: who, rows, fields, range');
t.ok(logged.some(l => l.who === 'master' && /"personal":true/.test(l.after)), 'with personal details noted');
const exportsRun = logged.length;
await all(C, { grain: 'weeks', fields: ['name'], batchIds: ['SPS2'], from: '2026-09-01', to: '2026-10-31' });
t.eq(rows("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'exports.run'")[0].n, exportsRun + 1, 'one Activity line per export, not per page');

// ---- the head's fixed exports
x = await all(M, { grain: 'staff' });
t.ok(x.rows.some(r => r[0] === 'sps' && r[2] === 'Coordinator') && x.rows.some(r => r[0] === 'master' && r[2] === 'IYF head'), 'staff: coordinators and the head');
x = await all(M, { grain: 'batches' });
t.ok(x.rows.find(r => r[0] === 'SPS2')?.[6] === 2, 'all batches, with their devotees');
x = await all(M, { grain: 'activity', from: '2026-10-05', to: '2026-10-12' });
t.ok(x.rows.some(r => r[3] === 'requests.approve') && x.rows.every(r => r[0] >= '2026-10-05' && r[0] < '2026-10-13'), 'the Activity log for the range');

// ---- the rate limit
let refused = false;
for (let i = 0; i < PER_HOUR + 2 && !refused; i++) refused = (await call('exports.page', { grain: 'batches' }, M)).error?.code === 'BUSY';
t.ok(refused, `at most ${PER_HOUR} exports an hour`);
t.done();
