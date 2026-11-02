// Phase 4 on the server: the coordinator's batch tools and the master's after-deadline tools.
import { boot, suite, FAC, LEAD, CONTACT, devoteeRow } from './harness.mjs';
import { runDeadline } from '../src/weeks.js';
import { jpegSize } from '../src/image.js';
import { finalScores, markUsed } from '../src/classweek.js';
import { refreshOneView, VIEWS as VIEW_NAMES } from '../src/views.js';
import FILES from '../../setup/files.json' with { type: 'json' };

const t = suite('phase 4: coordinator and master tools');
const registry = [
  { id: 'GP26-0101', name: 'Arjun Mehta', phone: '6000000046' },
  { id: 'GP26-0102', name: 'HG Arjun Mehta Pr', phone: '6000000052' },   // same name: a possible duplicate
  { id: 'GP26-0105', name: 'Amit Kumar', phone: '6000000071' },
  { id: 'GP26-0106', name: 'Mohit Kumar', phone: '6000000072' },        // NOT the same name (vowels kept)
  { id: 'GP26-0103', name: 'Gopal Sharma', phone: '6000000050' },
  { id: 'GP26-0104', name: 'Govind Rao', phone: '6000000050' }          // same phone
];
const { env, DB, call, clock, rows, addAccount, google } = boot({ registry });
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const join = async (phone, batchId, name, dob = '2001-01-01') => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, groupLeader: LEAD[batchId], password: 'Devotee pass 2026',
    profile: { dob, bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000046', 'SPS2', 'Arjun Das', '2000-10-05');      // birthday today
const B = await join('6000000047', 'SPS2', 'Bhima Das', '1999-10-09');      // in 4 days
const X = await join('6000000048', 'BSS', 'Other Batch');
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");
const W = '2026-10-05', W2 = '2026-10-12';
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30,
              hearingMin: 0, readingMin: 0, serviceMin: 60 };

// ---- the status board (Arjun begins Monday and leaves it incomplete: with no whole day the deadline marks him missed)
await call('week.saveDay', { weekId: W, date: W, version: 0, day: { sleptAt: day.sleptAt, wokeAt: day.wokeAt } }, A);
let r = await call('devotees.list', { batchId: 'SPS2' }, C);
t.eq(r.data.weekId, '2026-09-28', 'Monday morning: the board shows last week until its 9 PM deadline');
r = await call('devotees.list', { batchId: 'SPS2', weekId: W }, C);
t.eq(r.data.rows.map(x => [x.name, x.status, x.daysFilled, x.days[0]]), [['Arjun Das', 'DRAFT', 0, 'partial'], ['Bhima Das', 'NOT_STARTED', 0, undefined]], 'this week: one draft (Monday begun, no whole day yet), one not started');
t.eq([r.data.rows[0].facilitator, r.data.rows[0].classDay], [FAC, 'SUN'], 'facilitator and class day shown from the membership');
t.eq([r.data.attendanceOpen, r.data.attendanceOpensAt.slice(0, 10)], [false, '2026-10-11'], 'attendance opens on the class day (Sunday)');
t.code(await call('devotees.list', { batchId: 'BSS' }, C), 'FORBIDDEN', 'not another batch');
t.code(await call('devotees.list', { batchId: 'SPS2' }, A), 'FORBIDDEN', 'not for devotees');

// ---- birthdays
r = await call('birthdays.today', {}, C);
t.eq([r.data.today.map(x => [x.name, x.age]), r.data.upcoming.map(x => [x.name, x.date])], [[['Arjun Das', 26]], [['Bhima Das', '2026-10-09']]], "today's and the next 7 days' birthdays, own batch only");
t.eq((await call('birthdays.today', {}, M)).data.today.length, 1, 'the master sees every batch');

// ---- attendance: for the week's class, from the class day (Sunday) to the Monday 9 PM deadline
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000046', mark: 'P' }] }, C), 'FUTURE_DAY', 'Monday: the Sunday class has not happened, so nobody can be marked');
t.code(await call('week.setAttendance', { weekId: W, mark: 'P' }, A), 'FUTURE_DAY', 'nor can the devotee mark themselves');
at('2026-10-11T10:00:00');                                                // the class Sunday
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000046', mark: 'P' }, { login: '6000000047', mark: 'A' }] }, C), 'ok', 'coordinator marks the batch');
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000048', mark: 'P' }] }, C), 'VALIDATION', 'only devotees of that batch');
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W2, marks: [{ login: '6000000046', mark: 'P' }] }, C), 'FUTURE_DAY', 'not a week that has not started');
await call('week.setAttendance', { weekId: W, mark: 'A' }, A);
t.eq(rows("SELECT login, devotee_mark, coordinator_mark, mark_used FROM attendance WHERE week_id = '2026-10-05' ORDER BY login"),
  [{ login: '6000000046', devotee_mark: 'A', coordinator_mark: 'P', mark_used: 'P' }, { login: '6000000047', devotee_mark: '', coordinator_mark: 'A', mark_used: 'A' }],
  "the coordinator's mark wins over the devotee's");
await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000046', mark: null }] }, C);
t.eq(rows("SELECT mark_used FROM attendance WHERE login = '6000000046' AND week_id = '2026-10-05'")[0].mark_used, 'A', "clearing the coordinator's mark falls back to the devotee's");

// ---- a week with no regular class
const used = () => rows("SELECT login, mark_used FROM attendance WHERE week_id = '2026-10-05' ORDER BY login").map(x => x.mark_used);
t.code(await call('weeks.setClass', { batchId: 'SPS2', weekId: W, kind: 'FESTIVAL', note: 'Diwali' }, C), 'VALIDATION', 'choose everyone present or only those marked');
r = await call('weeks.setClass', { batchId: 'SPS2', weekId: W, kind: 'FESTIVAL', note: 'Diwali', everyonePresent: true }, C);
t.eq(r.data.classWeek && [r.data.classWeek.kind, r.data.classWeek.everyonePresent], ['FESTIVAL', true], 'festival week: everyone present');
t.eq(used(), ['P', 'A'], "everyone Present, except a person the coordinator marked Absent (their mark wins)");
t.code(await call('week.setAttendance', { weekId: W, mark: 'A' }, A), 'CONFLICT', "the devotee's own mark is not asked for that week");
t.eq((await call('home.get', {}, A)).data.weeks.find(w => w.weekId === W).attendance.classWeek.note, 'Diwali', 'the devotee sees why');
r = await call('weeks.setClass', { batchId: 'SPS2', weekId: W, kind: 'FESTIVAL', note: 'Diwali', everyonePresent: false }, C);
t.eq(used(), ['A', 'A'], 'only those marked count: unmarked people are Absent, their own mark ignored');
await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000046', mark: 'P' }] }, C);
t.eq(used(), ['P', 'A'], 'the coordinator marks who came');
t.eq((await call('devotees.list', { batchId: 'SPS2', weekId: W }, C)).data.classWeek.everyonePresent, false, 'the board shows the setting');
t.code(await call('weeks.setClass', { batchId: 'BSS', weekId: W, kind: 'HOLIDAY', note: 'x y', everyonePresent: true }, C), 'FORBIDDEN', 'own batches only');
await call('weeks.setClass', { batchId: 'SPS2', weekId: W, kind: 'REGULAR' }, C);
t.eq([used(), rows("SELECT COUNT(*) AS n FROM class_weeks")[0].n], [['P', 'A'], 0], 'back to a regular class: the marks given stay, the setting is gone');
await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000046', mark: null }] }, C);
t.eq(used(), ['A', 'A'], "and with no coordinator mark the devotee's own mark is used again");
t.eq([markUsed(null, { mode: 'ALL_PRESENT' }), markUsed({ devotee_mark: 'P' }, { mode: 'MARKED' }), markUsed({ coordinator_mark: 'A' }, { mode: 'ALL_PRESENT' }), markUsed({ devotee_mark: 'P' }, null)],
  ['P', 'A', 'A', 'P'], 'mark rule: coordinator, then the week setting, then the devotee');
const sub = { body: 80, soul: 70, seva: 60, attendance: 0, overall: 53 };
t.eq([finalScores(sub, 'P').attendance, finalScores(sub, 'P').overall, finalScores(sub, 'A'), finalScores(sub, '')], [100, 78, sub, sub],
  'a later Present raises Attendance and Overall (rounded like the card); no change otherwise');

// ---- facilitator and class day correction (the group leader is no longer used)
t.code(await call('devotees.setPeople', { login: '6000000047', facilitator: 'Someone Typed' }, C), 'VALIDATION', 'facilitator only from the list');
t.code(await call('devotees.setPeople', { login: '6000000047', classDay: 'FRI' }, C), 'VALIDATION', 'class day: Sunday or Saturday');
t.eq((await call('devotees.setPeople', { login: '6000000047', classDay: 'SAT' }, C)).data.classDay, 'SAT', 'moved to the Saturday class');
t.eq((await call('devotees.get', { login: '6000000047' }, C)).data.classDay, 'SAT', 'shown on the devotee detail');
t.code(await call('devotees.setPeople', { login: '6000000047', groupLeader: 'X' }, C), 'BAD_REQUEST', 'the group leader is gone');
t.code(await call('groupLeaders.set', { batchId: 'SPS2', names: ['X Pr'] }, C), 'BAD_REQUEST', 'and so is its list');
await call('devotees.setPeople', { login: '6000000047', classDay: 'SUN' }, C);

// ---- profile and photo
const jpeg = (w, h, pad = 0) => {
  const b = new Uint8Array(20 + pad); b.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255]); b[b.length - 2] = 0xff; b[b.length - 1] = 0xd9;
  return Buffer.from(b).toString('base64');
};
t.eq(jpegSize(Buffer.from(jpeg(400, 300), 'base64')), { h: 300, w: 400 }, 'JPEG size read from its header');
t.code(await call('photo.upload', { jpegBase64: jpeg(800, 800) }, A), 'VALIDATION', 'a photo bigger than 400 × 400 is refused');
t.code(await call('photo.upload', { jpegBase64: Buffer.from('GIF89a........').toString('base64') }, A), 'VALIDATION', 'only JPEG');
t.code(await call('photo.upload', { jpegBase64: jpeg(400, 400, 160 * 1024) }, A), 'VALIDATION', 'at most 150 KB');
t.eq((await call('photo.upload', { jpegBase64: jpeg(400, 400) }, A)).data.hasPhoto, true, 'own photo saved');
t.eq((await call('photo.get', { login: '6000000046' }, C)).data.jpegBase64, jpeg(400, 400), 'the batch coordinator sees it');
t.ok(!!(await call('devotees.get', { login: '6000000046' }, C)).data.photoUpdatedAt, 'devotee detail gives the photo date (for the phone cache)');
// NOT_FOUND, not FORBIDDEN (13 Oct 2026, audit F4): photo.get is gated ANY, so a devotee could otherwise read a
// stranger's state out of the error code — "no devotee with that phone" vs "approve the sign-up first" vs "that
// batch is not yours" tells them whether a number is a devotee, pending, or in another batch. One answer now.
t.code(await call('photo.get', { login: '6000000046' }, X), 'NOT_FOUND', 'a devotee of another batch gets the same answer as for an unknown number');
t.code(await call('photo.remove', { login: '6000000046' }, C), 'VALIDATION', 'the coordinator removes it only with a reason');
t.eq((await call('devotees.list', { batchId: 'SPS2', weekId: W }, C)).data.rows[0].hasPhoto, true, 'the board says who has a photo');
r = await call('profile.update', { bloodGroup: 'B+', readingPagesPerHour: 25 }, A);
t.eq([r.data.bloodGroup, r.data.readingPagesPerHour, r.data.hasPhoto], ['B+', 25, true], 'own profile updated');
t.code(await call('profile.update', { dob: '2024-01-01' }, A), 'VALIDATION', 'a child-age birth date is refused');
// one's own facilitator (the head, 5 Oct 2026): picked from the list; a switched-off name is kept only while it is one's own
t.eq((await call('profile.get', {}, A)).data.facilitator, FAC, 'own facilitator shown on the profile');
t.code(await call('profile.update', { facilitator: 'Someone Typed Prabhuji' }, A), 'VALIDATION', 'a typed name is refused');
await call('facilitators.add', { name: 'Test Newfac Prabhuji' }, M);
r = await call('profile.update', { facilitator: 'Test Newfac Prabhuji' }, A);
t.eq(r.data.facilitator, 'Test Newfac Prabhuji', 'changed to another name from the list');
t.eq((await call('devotees.get', { login: '6000000046' }, C)).data.facilitator, 'Test Newfac Prabhuji', 'the coordinator sees the new facilitator');
t.ok(!!(await DB.prepare("SELECT 1 AS x FROM audit_log WHERE action = 'profile.facilitator' AND target = '6000000046'").first()), 'the change is in the audit log');
await call('facilitators.setActive', { name: 'Test Newfac Prabhuji', active: false }, M);
t.eq((await call('profile.update', { facilitator: 'Test Newfac Prabhuji', bloodGroup: 'B+' }, A)).ok, true, 'a switched-off name that is still one\'s own can be kept');
t.code(await call('profile.update', { facilitator: 'Test Newfac Prabhuji' }, B), 'VALIDATION', 'but cannot be newly chosen');
t.eq((await call('profile.update', { facilitator: FAC }, A)).data.facilitator, FAC, 'and back');

// ---- the deadline, the missed list and the filling chart
at('2026-10-12T21:05:00');
for (let i = 0; i < 5; i++) await runDeadline({}, DB, new Date(clock.now));
r = await call('stats.batch', { batchId: 'SPS2', weeks: 4 }, C);
t.eq(r.data.missedLog.map(x => [x.name, x.weekId, x.daysFilled]), [['Arjun Das', W, 1], ['Bhima Das', W, 0]], 'missed list with days filled');
t.eq(r.data.trend.at(-2), { weekId: W, expected: 2, submitted: 0, missed: 2, filledPct: 0 }, 'filling chart: 0 of 2 submitted that week');
t.eq([r.data.weekId, r.data.thisWeek.expected, r.data.people.active], [W2, 2, 2], 'after the deadline the board moves on to the new week');
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000046', mark: 'P' }] }, C), 'WINDOW_CLOSED', 'coordinator attendance closes at the deadline');

// ---- reopen: requested by the coordinator, decided by the master
t.code(await call('reopen.request', { login: '6000000046', weekId: W, reason: 'Was in hospital' }, C), 'ok', 'coordinator asks for a reopen');
t.eq((await call('reopen.list', {}, M)).data.requests.map(x => [x.name, x.weekId]), [['Arjun Das', W]], 'the master sees the request');
t.eq((await call('reopen.list', {}, C)).data.requests.length, 1, 'the coordinator sees their own batch\'s pending requests');
t.code(await call('weeks.reopen', { login: '6000000046', weekId: W, reason: 'Hospital', openUntil: '2026-10-14T21:00:00+05:30' }, C), 'FORBIDDEN', 'only the master reopens');
// 16 Oct 2026: the head sets the window with no cap — it used to be 14 days, which was a guess that
// helped nobody when a devotee was away for a month. The limit sits at the coordinator's level: they
// ask, the head decides.
t.code(await call('weeks.reopen', { login: '6000000046', weekId: W, reason: 'Hospital', openUntil: '2027-06-30T21:00:00+05:30' }, M), 'ok', 'the head may hold a week open for as long as they judge right');
t.code(await call('weeks.reopen', { login: '6000000046', weekId: W, reason: 'Hospital', openUntil: '2020-01-01T21:00:00+05:30' }, M), 'VALIDATION', 'but not into the past: a window that has already closed opens nothing');
// The two refusals that are NOT about time, and now carry the weight the cap used to share:
//   · a submitted week is never reopened — its scores were worked out at submit (ADR 0004), so
//     reopening would change reports somebody has already read;
//   · a week that was never missed is never reopened — a reopen empties the draft, so this would
//     delete work somebody is in the middle of.
// W2 has not reached its deadline, so nobody has missed it yet
t.code(await call('weeks.reopen', { login: '6000000047', weekId: W2, reason: 'Checking', openUntil: '2026-10-20T21:00:00+05:30' }, M), 'CONFLICT',
  'a week that was never missed is not reopened: the draft would be emptied');
t.code(await call('weeks.reopen', { login: '6000000046', weekId: W, reason: 'Hospital', openUntil: '2026-10-14T21:00:00+05:30' }, M), 'ok', 'the master reopens the missed week');
t.eq((await call('reopen.list', {}, M)).data.requests, [], 'the request is done');
r = await call('home.get', {}, A);
t.eq(r.data.weeks[0].weekId === W && r.data.weeks[0].status, 'REOPENED', 'the devotee sees it reopened');
t.eq(r.data.weeks[0].days[0].state, 'empty', 'and empty: filled again from scratch');
t.eq((await call('devotees.get', { login: '6000000046' }, C)).data.lastWeeks.find(w => w.weekId === W).status, 'REOPENED', 'the devotee detail shows it reopened');
t.code(await call('weeks.reopen', { login: '6000000047', weekId: W2, reason: 'x y', openUntil: '2026-10-14T21:00:00+05:30' }, M), 'CONFLICT', 'only a missed week');

// ---- attendance after the deadline (master)
t.code(await call('attendance.override', { login: '6000000047', weekId: W, mark: 'P', reason: '' }, M), 'VALIDATION', 'needs a reason');
t.code(await call('weeks.setClass', { batchId: 'SPS2', weekId: W, kind: 'HOLIDAY', note: 'Rain', everyonePresent: true }, C), 'WINDOW_CLOSED', 'a coordinator cannot change a closed week');
t.code(await call('weeks.setClass', { batchId: 'SPS2', weekId: W, kind: 'HOLIDAY', note: 'Rain', everyonePresent: true }, M), 'VALIDATION', 'the master can, with a reason');
t.code(await call('weeks.setClass', { batchId: 'SPS2', weekId: W, kind: 'HOLIDAY', note: 'Rain', everyonePresent: true, reason: 'Class cancelled, told late' }, M), 'ok', 'the master overrides a locked week');
t.eq(rows("SELECT mark_used FROM attendance WHERE week_id = '2026-10-05' ORDER BY login").map(x => x.mark_used), ['P', 'A'], 'everyone Present except the coordinator\'s explicit Absent');
await call('weeks.setClass', { batchId: 'SPS2', weekId: W, kind: 'REGULAR', reason: 'Back to normal for the test' }, M);
t.eq((await call('attendance.override', { login: '6000000047', weekId: W, mark: 'P', reason: 'Was at the temple program' }, M)).data.used, 'P', 'the master changes a locked week');
t.eq(rows("SELECT action, reason FROM audit_log WHERE action = 'attendance.override'"), [{ action: 'attendance.override', reason: 'Was at the temple program' }], 'and it is logged');

// ---- inactive, disable, delete
t.code(await call('devotees.setActive', { login: '6000000047', active: false, fromWeek: '2026-01-05' }, C), 'VALIDATION', 'inactive only from this, next, or last week');
r = await call('devotees.setActive', { login: '6000000047', active: false }, C);
t.eq(r.data, { status: 'INACTIVE', fromWeek: W2 }, 'inactive from this week');
// the head, 26 Oct 2026 (Phase 22 I2): inactive only takes them out of the counts — the login and its sessions keep working
t.code(await call('home.get', {}, B), 'ok', 'inactive keeps their session (it no longer logs them out)');
t.eq(rows("SELECT status FROM accounts WHERE login = '6000000047'")[0].status, 'ACTIVE', 'the account stays ACTIVE: only the membership is inactive');
t.code(await call('auth.login', { login: '6000000047', password: 'Devotee pass 2026' }), 'ok', 'and they can still sign in');
t.eq((await call('devotees.get', { login: '6000000047' }, C)).data.status, 'INACTIVE', 'staff still read them as inactive');
t.eq((await call('stats.batch', { batchId: 'SPS2' }, C)).data.thisWeek.expected, 1, 'and they drop off the expected list');
t.eq(rows("SELECT state, from_week, to_week FROM memberships WHERE login = '6000000047' ORDER BY id"),
  [{ state: 'ACTIVE', from_week: W, to_week: W }, { state: 'INACTIVE', from_week: W2, to_week: '' }], 'history kept: active until last week, inactive from this week');
// ---- members: everyone in the batch, active and inactive
r = await call('members.list', { batchId: 'SPS2' }, C);
t.eq([r.data.total, r.data.counts], [2, { ACTIVE: 1, INACTIVE: 1, DISABLED: 0 }], 'members: the whole batch, active and inactive, with counts');
r = await call('members.list', { status: 'INACTIVE' }, C);
t.eq(r.data.rows.map(m => [m.name, m.inactiveSince, m.batchName]), [['Bhima Das', W2, 'SPS Group 2']], 'the inactive filter shows since when');
t.eq((await call('members.list', { q: 'arj' }, C)).data.rows.map(m => m.name), ['Arjun Das'], 'search by name');
t.eq((await call('members.list', { q: '000046' }, C)).data.rows.map(m => m.login), ['6000000046'], 'search by phone');
t.code(await call('members.list', { batchId: 'BSS' }, C), 'FORBIDDEN', 'a coordinator sees only their batches');
r = await call('members.list', {}, M);
t.ok(r.data.rows.some(m => m.batchId === 'BSS') && r.data.rows.some(m => m.batchId === 'SPS2'), 'the master sees every batch together');
t.eq((await call('members.list', { batchId: 'BSS' }, M)).data.rows.map(m => m.name), ['Other Batch'], 'and one batch at a time');
t.eq((await call('members.list', { limit: 1, offset: 1 }, M)).data.rows.length, 1, 'paged');
t.code(await call('members.list', {}, A), 'FORBIDDEN', 'not for devotees');
t.eq((await call('devotees.setActive', { login: '6000000047', active: true }, C)).data.status, 'ACTIVE', 'reactivated without a new approval');
t.eq((await call('devotees.setDisabled', { login: '6000000048', disabled: true }, C)).error?.code, 'FORBIDDEN', 'cannot disable another batch');
t.eq((await call('devotees.setDisabled', { login: '6000000046', disabled: true }, C)).data.status, 'DISABLED', 'disabled');
t.code(await call('auth.login', { login: '6000000046', password: 'Devotee pass 2026' }), 'ACCOUNT_DISABLED', 'cannot log in');
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W2, marks: [{ login: '6000000046', mark: 'P' }] }, C), 'FUTURE_DAY', 'attendance for this week opens on Sunday');
at('2026-10-18T10:00:00');
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W2, marks: [{ login: '6000000046', mark: 'P' }] }, C), 'VALIDATION', 'a disabled devotee is not marked');
at('2026-10-12T21:05:00');
t.eq((await call('devotees.setDisabled', { login: '6000000046', disabled: false }, C)).data.status, 'ACTIVE', 'enabled again');
t.code(await call('devotees.setActive', { login: 'sps', active: false }, C), 'NOT_FOUND', 'coordinators are not devotees here');
t.code(await call('devotees.delete', { login: '6000000047', confirmPhone: '6000000037' }, C), 'VALIDATION', 'delete needs the phone typed again');
t.code(await call('devotees.delete', { login: '6000000047', confirmPhone: '60000 00047' }, C), 'ok', 'deleted');
t.eq([rows("SELECT COUNT(*) AS n FROM accounts WHERE login = '6000000047'")[0].n, rows("SELECT COUNT(*) AS n FROM missed_weeks WHERE login = '6000000047'")[0].n,
      rows("SELECT COUNT(*) AS n FROM missed_weeks WHERE login LIKE 'deleted-%'")[0].n, rows("SELECT COUNT(*) AS n FROM memberships WHERE login = '6000000047'")[0].n],
     [0, 0, 1, 0], 'login gone; history kept under a pseudonym (5 Oct 2026: a coordinator delete anonymises too); no membership under the phone');

// ---- possible duplicate IDs (master only)
r = await call('ids.possibleDuplicates', {}, M);
t.eq(r.data.groups.map(g => [g.why, g.ids.map(i => i.iyfId)]), [['same phone', ['GP26-0103', 'GP26-0104']], ['same name', ['GP26-0101', 'GP26-0102']]], 'same phone and same name groups listed (honorifics ignored; Amit Kumar and Mohit Kumar are not the same name)');
t.code(await call('ids.possibleDuplicates', {}, C), 'FORBIDDEN', 'master only');
t.code(await call('ids.reviewDuplicate', { ids: ['GP26-0103', 'GP26-0104'], decision: 'NOT_DUPLICATE', why: 'same phone', reason: 'Brothers, one family phone' }, M), 'ok', 'the master marks a group "not duplicates"');
r = await call('ids.possibleDuplicates', {}, M);
t.eq([r.data.total, r.data.reviewedCount, r.data.groups.some(g => g.ids.some(i => i.iyfId === 'GP26-0103'))], [1, 1, false], 'it leaves the list (counted as reviewed)');
t.ok((await call('ids.possibleDuplicates', { showReviewed: true }, M)).data.groups.find(g => g.key === 'GP26-0103,GP26-0104')?.reviewed?.by === 'master', 'and can be shown again, with who reviewed it');
await call('ids.reviewDuplicate', { ids: ['GP26-0104', 'GP26-0103'], decision: 'UNDO' }, M);
t.eq((await call('ids.possibleDuplicates', {}, M)).data.total, 2, 'undo puts it back');
t.code(await call('ids.reviewDuplicate', { ids: ['GP26-0103'], decision: 'NOT_DUPLICATE' }, M), 'VALIDATION', 'a group has at least two IDs');

// (following a dashboard merge — the scheduled read moving an account to the ID the dashboard kept — is retired with the
// dashboard read itself, 27 Oct 2026: the app issues IYF IDs and merges people itself, identity.merge)

// ---- the batch view sheets (built step by step; tests/views.test.mjs checks them row for row against a full build)
google.writes.length = 0;
const reports = [];
for (let i = 0; i < 40; i++) { const r = await refreshOneView(env, DB, new Date(clock.now)); if (!r) break; reports.push(r); }
t.ok(VIEW_NAMES.every(v => reports.some(r => r.startsWith(v + ': emptied'))) && reports.length < 40, `each view built, then nothing until something changes (${reports.length} steps)`);
const spsTab = google.state.tab(FILES.viewSPS, 'This week').rows.slice(1).filter(r => r.length);
t.eq(spsTab.map(r => [r[0], r[2], r[4]]), [['Arjun Das', 'SPS Group 2', 'Not started']], 'SPS view: this week by name, batch name and plain status');
t.ok(!JSON.stringify(google.state.tab(FILES.viewSPS, 'This week').rows).includes('Other Batch'), "another level's devotees never appear in the SPS view");
t.code(await call('week.saveDay', { weekId: W2, date: W2, version: 0, day, onBehalfOf: '6000000046' }, C), 'ok', 'coordinator fills a day on his behalf');
clock.now += 11 * 60e3;                                   // This week is rewritten at most every 10 minutes
t.eq((await refreshOneView(env, DB, new Date(clock.now))).split(':')[0], 'viewSPS', 'a change in SPS rewrites only the SPS view');
t.eq(await refreshOneView(env, DB, new Date(clock.now)), '', 'and nothing else');

t.done();
