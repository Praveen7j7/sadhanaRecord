// Group leaders, the attendance levels and their times, conflict notices, the address, the blood-group filter and the
// compact week JSON (design decisions 41 and 42, the head 3 Oct 2026).
import { webcrypto as wc } from 'node:crypto';
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { runAttendanceNotices, noticeText } from '../src/push.js';
import { weekOf, weekJson } from '../src/weekjson.js';

const t = suite('decision 41/42: group leaders, attendance levels, week JSON');
const { env, DB, call, clock, rows, addAccount } = boot();
const k = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await wc.subtle.exportKey('jwk', k.privateKey);
env.VAPID_PRIVATE_JWK = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d });
env.VAPID_PUBLIC = Buffer.from(await wc.subtle.exportKey('raw', k.publicKey)).toString('base64url');
env.VAPID_SUBJECT = 'mailto:test@example.org';
const pushed = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt = {}) => (String(url).startsWith('https://fcm.googleapis.com/') ? (pushed.push(String(url)), { status: 201 }) : realFetch(url, opt));

const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');                                                   // Monday of week W
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
for (const [u, b] of [['sps', 'SPS2'], ['bss', 'BSS']]) {
  await call('coordinators.create', { username: u, name: u.toUpperCase() + ' Coordinator', batchIds: [b], tempPassword: 'Temp-' + u + '-2026' }, M);
  DB.sql.exec(`UPDATE accounts SET must_change_pw = 0 WHERE login = '${u}'`);
}
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const CB = (await call('auth.login', { login: 'bss', password: 'Temp-bss-2026' })).data.token;
const ADDR = { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' };
const profile = (extra = {}) => ({ dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: ADDR, ...extra });
const join = async (phone, name, batchId = 'SPS2', p = profile()) => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile: p });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};

// ---- the address at sign-up
let r = await call('auth.signUp', { phone: '6000000090', name: 'No Address', batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026',
  profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' } } });
t.eq([r.error?.code, r.error?.fields.map(f => f.path).sort()], ['VALIDATION', ['profile.address.area', 'profile.address.city', 'profile.address.line', 'profile.address.pin']], 'sign-up: the address is required');
r = await call('auth.signUp', { phone: '6000000090', name: 'Bad Pin', batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile: profile({ address: { ...ADDR, pin: '012345' } }) });
t.eq(r.error?.fields.map(f => f.path), ['profile.address.pin'], 'a PIN code is 6 digits, not starting with 0');
r = await call('auth.signUp', { phone: '6000000090', name: 'Odd Field', batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile: profile({ address: { ...ADDR, aadhaar: '1' } }) });
t.eq(r.error?.code, 'VALIDATION', 'no unknown address fields');

const L = await join('6000000081', 'Lalit Das');                              // the group leader
const A = await join('6000000082', 'Arjun Das', 'SPS2', profile({ bloodGroup: 'B+' }));
const B = await join('6000000183', 'Bhima Das');
const D = await join('6000000184', 'Dhruva Das');                             // in no group
const X = await join('6000000185', 'Other Batch', 'BSS');
t.eq(rows("SELECT addr_line, addr_area, addr_city, addr_state, addr_pin FROM profiles WHERE login = '6000000082'")[0], { addr_line: 'House 12, Gali 3', addr_area: 'Punjabi Bagh', addr_city: 'West Delhi', addr_state: 'Delhi', addr_pin: '110026' }, 'the address is kept, with its state');
r = await call('auth.signUp', { phone: '6000000195', name: 'Wrong Pin', batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile: profile({ address: { ...ADDR, pin: '400001' } }) });
t.eq(r.error?.fields?.map(f => [f.path, f.message]), [['profile.address.pin', 'This PIN code is not in Delhi']], 'a PIN code of another state is refused (Mumbai 400001 for Delhi)');
r = await call('auth.signUp', { phone: '6000000195', name: 'No District', batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile: profile({ address: { ...ADDR, city: 'Gotham' } }) });
t.eq(r.error?.fields?.map(f => f.path), ['profile.address.city'], 'in Delhi, the district comes from the list');
r = await call('auth.signUp', { phone: '6000000195', name: 'Gurgaon Devotee', batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile: profile({ address: { line: 'Flat 2, Tower B', area: 'Sector 45', city: 'Gurugram', state: 'Haryana', pin: '122003' } }) });
t.code(r, 'ok', 'another state: the city typed, a PIN of that state');
await call('requests.reject', { phone: '6000000195', reason: 'Test sign-up' }, M);
t.eq((await call('requests.list', {}, C)).data.signUps?.length ?? 0, 0, 'every test sign-up approved');

// ---- the address afterwards: the devotee changes it; the coordinator sees it
DB.sql.exec("UPDATE profiles SET addr_line = '', addr_area = '', addr_city = '', addr_pin = '' WHERE login = '6000000183'");   // signed up before 3 Oct
t.eq((await call('profile.get', {}, B)).data.address, null, 'a devotee from before has no address yet');
t.code(await call('profile.update', { address: { line: 'Flat 4', area: '', pin: '1100' } }, B), 'VALIDATION', 'a part address is refused');
r = await call('profile.update', { address: { line: 'Flat 4B, Sector 9', area: 'Rohini', city: 'North West Delhi', state: 'Delhi', pin: '110085' } }, B);
t.eq(r.data.address, { line: 'Flat 4B, Sector 9', area: 'Rohini', city: 'North West Delhi', state: 'Delhi', pin: '110085' }, 'the devotee adds it in Account');
t.eq((await call('devotees.get', { login: '6000000183' }, C)).data.profile.address.area, 'Rohini', 'the coordinator sees it');
t.code(await call('devotees.get', { login: '6000000183' }, CB), 'FORBIDDEN', 'not another batch\'s coordinator');
t.code(await call('profile.update', { address: ADDR, onBehalfOf: '6000000183' }, C), 'BAD_REQUEST', 'nobody changes it for them');

// ---- the blood-group filter
r = await call('members.list', { bloodGroup: 'B+' }, M);
t.eq(r.data.rows.map(x => [x.name, x.bloodGroup]), [['Arjun Das', 'B+']], 'the master filters members by blood group');
t.eq((await call('members.list', { batchId: 'SPS2', bloodGroup: 'O+' }, C)).data.rows.map(x => x.name), ['Bhima Das', 'Dhruva Das', 'Lalit Das'], 'with the batch filter');
t.eq((await call('members.list', { bloodGroup: 'O+' }, CB)).data.rows.map(x => x.name), ['Other Batch'], "a coordinator: only their batches");
t.code(await call('members.list', { bloodGroup: 'Z+' }, M), 'VALIDATION', 'only real blood groups');

// ---- appointing a leader and making the group (Tuesday: the board shows this week)
at('2026-10-06T09:00:00');
t.code(await call('group.list', {}, L), 'FORBIDDEN', 'not a leader yet');
t.code(await call('leaders.set', { login: '6000000081', leader: true }, A), 'FORBIDDEN', 'a devotee cannot appoint');
t.code(await call('leaders.set', { login: '6000000185', leader: true }, C), 'FORBIDDEN', 'a coordinator: own batch only');
t.eq((await call('leaders.set', { login: '6000000081', leader: true }, C)).data, { login: '6000000081', leader: true, batchId: 'SPS2' }, 'the coordinator appoints a leader');
r = (await call('auth.login', { login: '6000000081', password: 'Devotee pass 2026' })).data;
const LT = r.token;
t.eq(r.user.scopes.groupLeader, { batchId: 'SPS2' }, 'the leader sees the group screen (scope)');
t.eq((await call('leaders.assign', { leader: '6000000081', logins: ['6000000082', '6000000183'] }, C)).data, { leader: '6000000081', moved: 2 }, 'the coordinator puts devotees in the group');
t.eq((await call('leaders.assign', { leader: '6000000081', logins: ['6000000082'] }, C)).data.moved, 0, 'again: nothing to change (no write)');
t.code(await call('leaders.assign', { leader: '6000000081', logins: ['6000000081'] }, C), 'VALIDATION', 'a leader is in no group');
t.code(await call('leaders.assign', { leader: '6000000081', logins: ['6000000185'] }, M), 'VALIDATION', 'same batch only (even for the head)');
t.code(await call('leaders.assign', { leader: '6000000081', logins: ['6000000184'] }, CB), 'FORBIDDEN', "not another batch's coordinator");
r = await call('leaders.list', { batchId: 'SPS2' }, M);
t.eq([r.data.groups.map(g => [g.leader.name, g.members.map(m => m.name)]), r.data.unassigned.map(m => m.name)], [[['Lalit Das', ['Arjun Das', 'Bhima Das']]], ['Dhruva Das']], 'the head sees every group and who is in none');

r = await call('group.list', {}, LT);
t.eq(r.data.members.map(m => [m.name, m.phone, m.whatsapp, m.status]), [['Arjun Das', '6000000082', '6000000082', 'NOT_STARTED'], ['Bhima Das', '6000000183', '6000000183', 'NOT_STARTED']],
  'the leader sees the group: phone and WhatsApp for the call links, and the week\'s status');
t.eq([r.data.weekId, r.data.attendanceOpen, r.data.attendanceOpensAt], ['2026-10-05', false, '2026-10-11T00:00:00+05:30'], 'attendance opens on Sunday');
t.code(await call('group.mark', { weekId: '2026-10-05', marks: [{ login: '6000000082', mark: 'P' }] }, LT), 'FUTURE_DAY', 'Tuesday: no marks before the Sunday class');

// ---- week-end answers open Saturday 6 PM; attendance Sunday
const W = '2026-10-05';
DB.sql.exec(`UPDATE settings SET value = '${W}' WHERE key = 'tracking_from'`);
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
const dates = [0, 1, 2, 3, 4, 5, 6].map(i => new Date(Date.parse(W + 'T00:00:00Z') + i * 864e5).toISOString().slice(0, 10));
at('2026-10-10T17:59:00');
t.code(await call('week.saveWeekEnd', { weekId: W, version: 0, nightStay: 'YES' }, A), 'FUTURE_DAY', 'Saturday 5:59 PM: Night Stay not open yet');
t.code(await call('week.saveWeekEnd', { weekId: W, version: 0, principles: 'YES' }, A), 'FUTURE_DAY', 'nor the 4 regulative principles');
r = await call('week.get', { weekId: W }, A);
t.eq([r.data.weekEnd.open, r.data.weekEnd.opensAt], [false, '2026-10-10T18:00:00+05:30'], 'the form says when they open');
at('2026-10-10T18:00:00');
t.code(await call('week.saveWeekEnd', { weekId: W, version: 0, nightStay: 'YES', principles: 'YES' }, A), 'ok', 'Saturday 6 PM: open');
t.code(await call('week.setAttendance', { weekId: W, mark: 'P' }, A), 'FUTURE_DAY', 'Saturday evening: own attendance not yet (one Sunday class for all)');
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000082', mark: 'P' }] }, C), 'FUTURE_DAY', 'nor the coordinator');

// ---- Sunday: the levels
at('2026-10-11T10:00:00');
const att = login => rows('SELECT devotee_mark, leader_mark, coordinator_mark, master_mark, mark_used, notice_at, notice_sent FROM attendance WHERE login = ? AND week_id = ?', login, W)[0];
t.code(await call('week.setAttendance', { weekId: W, mark: 'P' }, A), 'ok', 'Sunday: Arjun marks himself Present');
t.code(await call('week.setAttendance', { weekId: W, mark: 'P' }, B), 'ok', 'Bhima too');
t.eq((await call('group.mark', { weekId: W, marks: [{ login: '6000000082', mark: 'A' }, { login: '6000000183', mark: 'P' }] }, LT)).data.saved, 2, 'the leader marks the group');
t.eq([att('6000000082').mark_used, att('6000000082').leader_mark, !!att('6000000082').notice_at, att('6000000082').notice_sent], ['A', 'A', true, 0], "leader's Absent is used over Arjun's own Present: a notice is due");
t.eq([att('6000000183').mark_used, att('6000000183').notice_at], ['P', ''], 'same as his own: no notice');
t.eq(rows("SELECT leader_by FROM attendance WHERE login = '6000000082'")[0].leader_by, '6000000081', 'who marked is kept');
r = await call('week.get', { weekId: W }, A);
t.eq([r.data.attendance.used, r.data.attendance.by, r.data.attendance.devotee, !!r.data.attendance.notice], ['A', 'leader', 'P', true], 'Arjun sees the mark, who gave it, and the note');
t.code(await call('group.mark', { weekId: W, marks: [{ login: '6000000184', mark: 'P' }] }, LT), 'VALIDATION', 'only the leader\'s own group');
t.code(await call('group.mark', { weekId: W, marks: [{ login: '6000000082', mark: 'L' }] }, LT), 'VALIDATION', 'P, A or null');
t.code(await call('group.mark', { weekId: W, marks: [{ login: '6000000082', mark: 'P' }] }, A), 'FORBIDDEN', 'a devotee cannot mark others');

// the coordinator over the leader; the leader cannot undo it
await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000183', mark: 'A' }] }, C);
t.eq([att('6000000183').mark_used, !!att('6000000183').notice_at], ['A', true], "the coordinator's Absent over Bhima's Present: notice");
await call('group.mark', { weekId: W, marks: [{ login: '6000000183', mark: 'P' }] }, LT);
t.eq([att('6000000183').leader_mark, att('6000000183').mark_used], ['P', 'A'], 'a later leader mark is kept but the coordinator\'s is used');
t.code(await call('week.setAttendance', { weekId: W, mark: 'A' }, L), 'ok', 'the leader marks their own attendance as a devotee');
await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000081', mark: 'P' }] }, C);
t.eq(att('6000000081').mark_used, 'P', "the leader's own attendance: the coordinator's mark");
t.code(await call('group.mark', { weekId: W, marks: [{ login: '6000000081', mark: 'P' }] }, LT), 'VALIDATION', 'a leader cannot mark themselves');

// ---- the notice push, 5 minutes after the change
const ep = n => ({ endpoint: `https://fcm.googleapis.com/fcm/send/grp-${n}`, keys: { p256dh: 'B' + 'x'.repeat(86), auth: 'a'.repeat(22) } });
await call('push.subscribe', ep('arjun'), A);
await call('push.subscribe', ep('bhima'), B);
t.eq(await runAttendanceNotices(env, DB, new Date(clock.now + 60e3)), '', 'not within 5 minutes (a quick correction sends nothing)');
pushed.length = 0;
const report = await runAttendanceNotices(env, DB, new Date(clock.now + 6 * 60e3));
t.eq([report, pushed.sort()], ['attendance notices: 3 (2 pushes)', ['https://fcm.googleapis.com/fcm/send/grp-arjun', 'https://fcm.googleapis.com/fcm/send/grp-bhima']], 'one push to each devotee whose mark was overruled (Lalit has no phone signed up: in-app only)');
t.eq([att('6000000082').notice_sent, att('6000000183').notice_sent], [1, 1], 'marked sent');
r = await call('push.message', { endpoint: ep('arjun').endpoint });
t.eq([r.data.title, r.data.body], ['Attendance updated', 'Your Sunday class attendance for the week of 5 Oct was marked Absent by your group leader. You had marked Present.'], 'the phone shows what changed and who changed it');
t.eq((await call('push.message', { endpoint: ep('bhima').endpoint })).data.body.includes('by your coordinator'), true, "Bhima's says the coordinator");
pushed.length = 0;
t.eq(await runAttendanceNotices(env, DB, new Date(clock.now + 7 * 60e3)), '', 'sent once only');
t.eq(noticeText({ week_id: W, devotee_mark: 'P', leader_mark: 'A', coordinator_mark: 'P', master_mark: '', mark_used: 'P' }), null, 'nothing to tell once a higher mark agrees with the devotee');

// the coordinator agrees with Arjun: the in-app note goes away
await call('attendance.set', { batchId: 'SPS2', weekId: W, marks: [{ login: '6000000082', mark: 'P' }] }, C);
r = await call('week.get', { weekId: W }, A);
t.eq([r.data.attendance.used, r.data.attendance.by, r.data.attendance.notice], ['P', 'coordinator', null], 'the coordinator\'s Present: used, no note');

// ---- after the deadline: only the head
at('2026-10-12T21:00:00');
t.code(await call('group.mark', { weekId: W, marks: [{ login: '6000000082', mark: 'A' }] }, LT), 'WINDOW_CLOSED', 'the leader: closed at Monday 9 PM');
r = await call('attendance.override', { login: '6000000082', weekId: W, mark: 'A', reason: 'Left before the class' }, M);
t.eq([r.error?.code ?? 'ok', att('6000000082').master_mark, att('6000000082').mark_used], ['ok', 'A', 'A'], 'the head overrides everyone, after the deadline too');

// ---- the compact week JSON
at('2026-10-11T19:00:00');
for (const [i, d] of dates.entries()) DB.sql.prepare(`UPDATE drafts SET d${i + 1} = ? WHERE login = '6000000082' AND week_id = ?`).run(JSON.stringify(d === '2026-10-07' ? { ...day, hearingMin: 30, hearing: [{ text: 'Kirtan class' }] } : day), W);
DB.sql.exec("DELETE FROM attendance WHERE login = '6000000082'");
await call('week.setAttendance', { weekId: W, mark: 'P' }, A);
r = await call('week.submit', { weekId: W }, A);
t.code(r, 'ok', 'Arjun submits on Sunday evening');
const s = rows("SELECT days_json, marks_json, week_json FROM submissions WHERE login = '6000000082'")[0];
const wj = JSON.parse(s.week_json);
t.eq([s.days_json, s.marks_json, wj.v, wj.week, wj.batch, wj.days.length, wj.days[2].date, wj.days[2].hearing, wj.attendance, wj.weekEnd],
  ['', '', 1, W, 'SPS2', 7, '2026-10-07', [{ text: 'Kirtan class' }], 'P', { nightStay: 'YES', principles: 'YES', avgRounds: 16 }], 'one compact JSON holds the whole week');
t.ok(!/\s{2}|null|""/.test(s.week_json) && Array.isArray(wj.days[0].m.to_bed), 'compact: no spaces, nulls or empty fields; each day carries its marks');
r = await call('week.get', { weekId: W }, A);
t.eq([r.data.status, r.data.days.length, r.data.days[2].hearingMin, r.data.marks[0].to_bed.marks > 0], ['SUBMITTED', 7, 30, true], 'the day-wise report is read from the JSON');
const old = { week_json: '', days_json: JSON.stringify([day]), marks_json: JSON.stringify([{ to_bed: { label: 'x', marks: 25 } }]) };
t.eq(weekOf(old), { days: [day], marks: [{ to_bed: { label: 'x', marks: 25 } }] }, 'a week submitted before the JSON still reads');
t.eq(weekOf({ week_json: weekJson({ week: W, login: '1', name: 'n', batch: 'SPS', days: [day], marks: [{ to_bed: { label: 'x', marks: 25 } }], weekEnd: {}, attendance: '', scores: {} }) }),
  { days: [day], marks: [{ to_bed: { label: 'x', marks: 25 } }] }, 'write and read give back the same week');
t.eq((await call('home.get', {}, A)).error, undefined, 'home (heard lectures) reads the JSON');

// ---- removing a leader frees the group
at('2026-10-13T10:00:00');
t.eq((await call('leaders.set', { login: '6000000081', leader: false, reason: 'Moved city' }, C)).data, { login: '6000000081', leader: false }, 'the coordinator removes the leader');
t.eq(rows("SELECT COUNT(*) n FROM memberships WHERE leader_login = '6000000081'")[0].n, 0, 'the members are in no group');
t.code(await call('group.list', {}, LT), 'FORBIDDEN', 'the group screen is gone');
t.eq(rows("SELECT action FROM audit_log WHERE action LIKE 'leaders.%' ORDER BY rowid").map(x => x.action), ['leaders.appoint', 'leaders.assign', 'leaders.remove'], 'every change audited');

// ---- one level, one pool: SPS, SPS Group 2 and SPS Online (the head, 3 Oct 2026 evening)
const SP = await join('6000000186', 'Sita Devi', 'SPS');
t.code(await call('leaders.set', { login: '6000000081', leader: true }, M), 'ok', 'the head appoints Lalit (SPS Group 2) again');
t.eq((await call('leaders.assign', { leader: '6000000081', logins: ['6000000186'] }, M)).data.moved, 1, 'a devotee of SPS joins the group of an SPS Group 2 leader (same level)');
r = await call('leaders.assign', { leader: '6000000081', logins: ['6000000185'] }, M);
t.eq([r.error?.code, /another level/.test(r.error?.fields?.[0]?.message || '')], ['VALIDATION', true], 'a BSS devotee cannot (another level)');
r = await call('leaders.list', { batchId: 'SPS' }, M);
t.eq([r.data.batches.map(b => b.batchId), r.data.groups.map(g => [g.leader.name, g.members.map(m => [m.name, m.batchId])])], [['SPS', 'SPS2', 'SPSO'], [['Lalit Das', [['Sita Devi', 'SPS']]]]], 'the head sees the level together: the SPS2 leader with an SPS member');
t.eq((await call('leaders.list', { batchId: 'SPS2' }, C)).data.batches.map(b => b.batchId), ['SPS2'], 'a coordinator of SPS Group 2 only: only that batch');
t.code(await call('leaders.assign', { leader: '6000000081', logins: ['6000000186'] }, C), 'FORBIDDEN', 'a coordinator of SPS Group 2 only cannot move a devotee of SPS (a batch they do not manage)');
t.code(await call('leaders.set', { login: '6000000186', leader: true }, C), 'FORBIDDEN', 'nor appoint one');
at('2026-10-18T10:00:00');
const LT2 = (await call('auth.login', { login: '6000000081', password: 'Devotee pass 2026' })).data.token;
t.eq((await call('group.list', { weekId: '2026-10-12' }, LT2)).data.members.map(m => m.name), ['Sita Devi'], 'the leader sees the member from SPS');
t.code(await call('group.mark', { weekId: '2026-10-12', marks: [{ login: '6000000186', mark: 'P' }] }, LT2), 'ok', 'and marks her Sunday attendance');
t.eq(rows("SELECT batch_id, leader_mark FROM attendance WHERE login = '6000000186' AND week_id = '2026-10-12'")[0], { batch_id: 'SPS', leader_mark: 'P' }, "the mark is kept under her own batch (SPS)");

// ---- one's own name, any role (4 Oct 2026)
r = await call('profile.update', { name: 'Sita Devi Dasi' }, SP);
t.eq([r.data?.name, rows("SELECT name FROM accounts WHERE login = '6000000186'")[0].name, rows("SELECT name FROM profiles WHERE login = '6000000186'")[0].name], ['Sita Devi Dasi', 'Sita Devi Dasi', 'Sita Devi Dasi'], 'a devotee changes their own name (account and profile)');
t.code(await call('profile.update', { name: 'x1' }, SP), 'VALIDATION', 'letters and spaces only');
t.eq(rows("SELECT before, after FROM audit_log WHERE action = 'profile.rename' ORDER BY id DESC LIMIT 1")[0], { before: '{"name":"Sita Devi"}', after: '{"name":"Sita Devi Dasi"}' }, 'the change is logged (Activity)');
t.eq((await call('profile.update', { name: 'Sps Team Delhi' }, C)).data?.name, 'Sps Team Delhi', 'staff change their own name too');

// ---- one's own class day (4 Oct 2026)
r = await call('profile.update', { classDay: 'SAT' }, SP);
t.eq([r.data?.classDay, rows("SELECT class_day FROM memberships WHERE login = '6000000186' AND to_week = ''")[0].class_day], ['SAT', 'SAT'], 'a devotee sets their class day in Account');
t.code(await call('profile.update', { classDay: 'MON' }, SP), 'VALIDATION', 'Sunday or Saturday only');

globalThis.fetch = realFetch;
t.done();
