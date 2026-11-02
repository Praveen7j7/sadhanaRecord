// Phase 1 on the Worker, end to end through the API: sign-up, login, lockout, forced password change,
// coordinators, batch scope, approval with IYF ID rules, resets, sessions, replays, sheet copies.
import crypto from 'node:crypto';
import { boot, suite , FAC, LEAD, CONTACT } from './harness.mjs';
import { mirrorChanged } from '../src/mirror.js';
import { verifyPassword } from '../src/crypto.js';

const t = suite('phase 1 on Cloudflare: accounts and access');
const REG = [
  { id: 'KT26-0042', name: 'Rahul Sharma', phone: '6000000087', level: 'SPS', facilitator: 'Vilasa Padmanabha Prabhuji', alias: ['6000000087|rl', 'KT26-0042'] },
  { id: 'GP26-0007', name: 'Amit Verma Pr', phone: '6000000070', level: 'SPS' },
  { id: 'GP26-0008', name: 'Old Duplicate', phone: '6000000078', level: 'DPS', status: 'Merged into GP26-0007' },
  { id: 'JN26-0100', name: 'Rahul Sharma', phone: '6000000036', level: 'DPS' }
];
const { env, DB, call, clock, rows, addAccount, google } = boot({ registry: REG });
t.eq(rows('SELECT COUNT(*) AS n FROM registry')[0].n, 4, 'the registry snapshot holds the four IDs (the dashboard is no longer read, 27 Oct 2026)');

// ---- hashes made by the Apps Script server (same scheme) still verify here
{
  const pep = env.PW_PEPPER, pw = 'Old server pass 1', salt = crypto.randomBytes(16);
  const key = crypto.createHmac('sha256', pep).update(pw).digest();
  const stored = { pw_hash: crypto.pbkdf2Sync(key, salt, 1000, 32, 'sha256').toString('base64'), pw_salt: salt.toString('base64'), pw_iterations: 1000 };
  t.ok(await verifyPassword(pw, stored, pep), 'Apps Script-era hash verifies on the Worker');
  t.ok(!(await verifyPassword('wrong', stored, pep)), 'and a wrong password does not');
}

// ---- envelope
t.code(await call('meta.get', {}, undefined, { override: { v: 0 } }), 'UPGRADE_REQUIRED', 'old app version');
t.code(await call('nope.nothing'), 'BAD_REQUEST', 'unknown action');
t.code(await call('meta.get', { extra: 1 }), 'BAD_REQUEST', 'unknown field');
let r = await call('meta.get');
// TRD joined on 17 Oct 2026: temple residents are a batch of their own, so they appear at sign-up
t.eq(r.data.batches.map(b => b.batchId), ['SPS', 'SPS2', 'SPSO', 'DPS', 'BSS', 'BVS', 'TRD'], 'meta lists the batches, TRD among them');

// ---- master (created by setup, temporary password)
await addAccount('master', 'MASTER', 'TempMaster#2026', { name: 'IYF Head', mustChange: true });
r = await call('auth.login', { login: 'master', password: 'TempMaster#2026', device: 'test' });
t.ok(r.ok && r.data.user.mustChangePassword && r.data.user.role === 'MASTER', 'master logs in, must change password');
const M = r.data.token;
t.ok(rows('SELECT pw_iterations FROM accounts WHERE login = ?', 'master')[0].pw_iterations === 10000, 'old 1000-round hash upgraded at login');
t.code(await call('coordinators.list', {}, M), 'MUST_CHANGE_PASSWORD', 'blocked until the password is changed');
t.code(await call('auth.me', {}, M), 'ok', 'auth.me allowed meanwhile');
t.code(await call('auth.changePassword', { current: 'TempMaster#2026', new: 'harekrishna' }, M), 'VALIDATION', 'common password refused');
t.code(await call('auth.changePassword', { current: 'TempMaster#2026', new: 'Gauranga Nitai 2026' }, M), 'ok', 'master sets own password');
t.code(await call('coordinators.list', {}, M), 'ok', 'master unblocked');
r = await call('admin.lists', {}, M);
t.ok(Array.isArray(r.data.coordinators) && r.data.batches.length === 7, 'admin.lists: coordinators and batches in one call');

// ---- coordinator
t.code(await call('coordinators.create', { username: 'sps', name: 'SPS Coordinators', batchIds: ['SPS', 'NOPE'], tempPassword: 'Temp-sps-2026' }, M), 'VALIDATION', 'unknown batch');
r = await call('coordinators.create', { username: 'sps', name: 'SPS Coordinators', batchIds: ['SPS', 'SPS2', 'SPSO'], tempPassword: 'Temp-sps-2026' }, M);
t.eq([r.data.coordinator?.username, r.data.coordinator?.batchIds], ['sps', ['SPS', 'SPS2', 'SPSO']], 'create returns the new row');
t.code(await call('coordinators.create', { username: 'sps', name: 'Again', batchIds: [], tempPassword: 'Temp-sps-2026' }, M), 'CONFLICT', 'username unique');
r = await call('auth.login', { login: 'SPS', password: 'Temp-sps-2026' });
let C = r.data.token;
t.eq(r.data.user.batchIds, ['SPS', 'SPS2', 'SPSO'], 'coordinator login reports their batches');
t.code(await call('auth.changePassword', { current: 'Temp-sps-2026', new: 'Sps coordinators 108!' }, C), 'ok', 'coordinator changes password');
t.code(await call('coordinators.list', {}, C), 'FORBIDDEN', 'coordinator cannot manage coordinators');

// ---- sign-up
const profile = { dob: '2002-04-14', bloodGroup: 'B+', emergency: { name: 'Suresh Sharma', relation: 'Father', phone: '6000000189' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const signUp = (over = {}, extra) => { const b = { phone: '+91 60000 00087', name: 'Rahul  Sharma', batchId: 'SPS2', password: 'My sadhana 2026', profile, facilitator: FAC, ...over };
  b.groupLeader ??= LEAD[b.batchId]; b.classDay ??= 'SUN'; b.email ??= 'devotee@gmail.com'; return call('auth.signUp', b, undefined, extra); };
r = await signUp({ phone: '12345', password: 'abc' });
t.eq(r.error?.fields?.map(f => f.path), ['phone', 'password'], 'each bad field named');
t.code(await signUp({ profile: { ...profile, aadhaar: '1234' } }), 'BAD_REQUEST', 'no extra profile fields (no ID numbers)');
r = await signUp({ facilitator: 'HG Natvar Gopinath Pr', classDay: 'MON', email: 'not-an-email' });
t.eq(r.error?.fields?.map(f => f.path), ['facilitator', 'classDay', 'email'], 'facilitator from the list, class day Sunday/Saturday, a valid email (decision 33, 3 Oct 2026)');
t.eq((await signUp({ email: 'rahul@gmial.com' })).error?.fields?.[0]?.message, 'Did you mean rahul@gmail.com?', 'a common email misspelling is pointed out');
google.state.dns['nosuchdomain.example'] = { Status: 3 };
t.code(await signUp({ email: 'rahul@nosuchdomain.example' }), 'VALIDATION', 'an email domain that does not exist is refused');
google.state.dns['nomail.example'] = { Status: 0, Answer: [{ type: 1 }] };
t.code(await signUp({ email: 'rahul@nomail.example' }), 'VALIDATION', 'a domain with no mail servers is refused');
t.code(await signUp({ whatsapp: '12345' }), 'VALIDATION', 'a WhatsApp number must be a 10-digit number');
t.code(await signUp({ phone: '6000000086', name: 'Old App', groupLeader: 'Anything', email: 'Old.App@Example.org', whatsapp: '60000 00086' }), 'ok', 'an older app sending a group leader still works (it is ignored)');
t.eq(rows("SELECT email, whatsapp, requested_class_day, requested_group_leader FROM accounts WHERE login = '6000000086'")[0], { email: 'old.app@example.org', whatsapp: '6000000086', requested_class_day: 'SUN', requested_group_leader: '' }, 'email, WhatsApp and class day stored (email lower-case)');
t.code(await signUp({ phone: '6000000085', facilitator: undefined }), 'VALIDATION', 'the facilitator is required');
r = await call('meta.get');
t.ok(r.data.facilitators.length === 42 && r.data.facilitators.includes(FAC) && r.data.classDays.map(c => c.id).join() === 'SUN,SAT' && !('groupLeaders' in r.data.batches[0]), 'meta.get lists the 42 facilitators and the two class days (no group leaders)');
t.eq((await signUp({}, { requestId: 'fixed-request-id-1' })).data, { status: 'PENDING' }, 'sign-up accepted');
t.eq((await signUp({}, { requestId: 'fixed-request-id-1' })).data, { status: 'PENDING' }, 'same requestId replays the first answer');
t.code(await signUp(), 'CONFLICT', 'second sign-up for the same phone refused');
t.code(await call('auth.login', { login: '06000000087', password: 'My sadhana 2026' }), 'PENDING_APPROVAL', 'pending told only after the right password');
t.code(await call('auth.login', { login: '6000000087', password: 'wrong one' }), 'BAD_CREDENTIALS', 'wrong password');
t.code(await call('auth.login', { login: '6000000100', password: 'whatever 1' }), 'BAD_CREDENTIALS', 'unknown number looks the same');
t.code(await signUp({ phone: '6000000073', batchId: 'DPS', name: 'Dps Person' }), 'ok', 'a DPS sign-up');

// ---- coordinator scope and registry matches
r = await call('requests.list', {}, C);
t.eq(r.data.signUps.map(s => s.phone).sort(), ['6000000086', '6000000087'], 'SPS coordinator sees only SPS-batch sign-ups');
t.eq(r.data.signUps.find(x => x.phone === '6000000087').matches.map(m => [m.iyfId, m.why, m.nameMatches]), [['KT26-0042', 'phone + name', true], ['JN26-0100', 'name', true]], 'registry matches with name check');
t.code(await call('requests.list', { batchId: 'DPS' }, C), 'FORBIDDEN', 'cannot ask for another batch');
t.code(await call('requests.approve', { phone: '6000000073', link: { noIdYet: true } }, C), 'FORBIDDEN', 'cannot approve another batch');
t.eq((await call('registry.search', { q: 'rahul' }, C)).data.results.map(x => x.iyfId), ['KT26-0042', 'JN26-0100'], 'registry search by name');

// ---- only allocated IDs
t.code(await call('requests.approve', { phone: '6000000087', link: { iyfId: 'KT26-9999' } }, C), 'UNKNOWN_ID', 'made-up ID in the right format refused');
r = await call('requests.approve', { phone: '6000000087', link: { iyfId: 'GP26-0008' } }, C);
t.ok(r.error?.code === 'UNKNOWN_ID' && r.error.message.includes('GP26-0007'), 'merged ID refused, names the ID it went into');
t.code(await call('requests.approve', { phone: '6000000087', link: {} }, C), 'VALIDATION', 'must choose an ID or no-ID-yet');
t.code(await call('requests.approve', { phone: '6000000087', link: { iyfId: 'kt26-0042' }, facilitator: 'Not A Facilitator' }, C), 'VALIDATION', 'approval needs a listed facilitator');
{ const su = (await call('requests.list', {}, C)).data.signUps.find(x => x.phone === '6000000087');
  t.eq([su.facilitator, su.classDay, su.email], [FAC, 'SUN', 'devotee@gmail.com'], 'the coordinator sees the facilitator, class day and email given at sign-up'); }
t.code(await call('requests.approve', { phone: '6000000087', link: { iyfId: 'kt26-0042' }, classDay: 'MON' }, C), 'VALIDATION', 'approval: class day Sunday or Saturday');
t.eq((await call('requests.approve', { phone: '6000000087', link: { iyfId: 'kt26-0042' }, levelEntryDate: '2026-09-01', classDay: 'SAT' }, C)).data, { iyfId: 'KT26-0042', linked: true }, 'approved and linked, class day corrected by the coordinator');
t.eq(rows('SELECT facilitator, class_day, group_leader FROM memberships WHERE login = ?', '6000000087')[0], { facilitator: FAC, class_day: 'SAT', group_leader: '' }, 'the membership holds the canonical facilitator and the class day; no group leader');
t.code(await call('requests.approve', { phone: '6000000087', link: { noIdYet: true } }, C), 'CONFLICT', 'cannot decide twice');
t.eq(rows('SELECT login, iyf_id, batch_id, state, from_week FROM memberships'), [{ login: '6000000087', iyf_id: 'KT26-0042', batch_id: 'SPS2', state: 'ACTIVE', from_week: '2026-10-05' }], 'membership opened this Monday');
t.eq(rows('SELECT iyf_id FROM profiles WHERE login = ?', '6000000087')[0].iyf_id, 'KT26-0042', 'profile linked');

// one account per ID, enforced by the database too
t.code(await signUp({ phone: '6000000080', name: 'Rahul Sharma' }), 'ok', 'another sign-up');
t.code(await call('requests.approve', { phone: '6000000080', link: { iyfId: 'KT26-0042' } }, C), 'CONFLICT', 'an ID already linked cannot be linked again');
let dbRefused = false;
try { DB.sql.prepare("UPDATE accounts SET iyf_id = 'KT26-0042' WHERE login = '6000000080'").run(); } catch { dbRefused = true; }
t.ok(dbRefused, 'the database itself refuses a second account on one IYF ID');
t.eq((await call('requests.approve', { phone: '6000000080', link: { noIdYet: true } }, C)).data, { iyfId: null, linked: false }, 'approve with no ID yet');

// two approvals at once: only one can win
t.code(await signUp({ phone: '6000000084', name: 'Race Person' }), 'ok', 'a third sign-up');
const both = await Promise.all([
  call('requests.approve', { phone: '6000000084', link: { noIdYet: true } }, C),
  call('requests.approve', { phone: '6000000084', link: { noIdYet: true } }, M)
]);
t.eq(both.map(x => x.ok ? 'ok' : x.error.code).sort(), ['CONFLICT', 'ok'], 'simultaneous approvals: one wins, one is told');
t.eq(rows("SELECT COUNT(*) AS n FROM memberships WHERE login = '6000000084'")[0].n, 1, 'and only one membership exists');

// ---- devotee
r = await call('auth.login', { login: '6000000087', password: 'My sadhana 2026', device: 'Android' });
const D = r.data.token;
t.eq([r.data.user.role, r.data.user.iyfId, r.data.user.batchIds], ['DEVOTEE', 'KT26-0042', ['SPS2']], 'devotee logs in with ID and batch');
t.code(await call('requests.list', {}, D), 'FORBIDDEN', 'devotee cannot see requests');
t.code(await call('auth.me', {}, 'f'.repeat(64)), 'UNAUTHENTICATED', 'unknown token');

// ---- lockout
for (let i = 0; i < 4; i++) await call('auth.login', { login: '6000000080', password: 'nope nope' });
r = await call('auth.login', { login: '6000000080', password: 'nope nope' });
t.ok(r.error?.code === 'LOCKED_OUT' && r.data?.until, '5th wrong try locks the account');
t.code(await call('auth.login', { login: '6000000080', password: 'My sadhana 2026' }), 'LOCKED_OUT', 'even the right password waits');
clock.now += 16 * 60000;
t.code(await call('auth.login', { login: '6000000080', password: 'My sadhana 2026' }), 'ok', 'opens after 15 minutes');

// ---- reset (decision 46, 14 Oct 2026: the SERVER makes the password at approval; the requester supplies
// none, and `newPassword` is accepted-and-ignored only so an older app does not break. Full flow:
// tests/reset-decision46.test.mjs)
t.eq((await call('auth.requestReset', { login: '6000000029', newPassword: 'Brand new pass 1' })).data, { status: 'RESET_REQUESTED' }, 'unknown number: same reply');
t.code(await call('auth.requestReset', { login: '6000000087', newPassword: 'Brand new pass 1' }), 'ok', 'reset requested');
t.code(await call('auth.login', { login: '6000000087', password: 'Brand new pass 1' }), 'BAD_CREDENTIALS', 'the password the requester typed never works — it is not kept at all');
t.eq((await call('requests.list', {}, C)).data.resets.map(x => [x.login, x.role]), [['6000000087', 'DEVOTEE']], 'coordinator sees the reset');
const appr = await call('resets.approve', { login: '6000000087' }, C);
t.code(appr, 'ok', 'coordinator approves');
t.code(await call('auth.me', {}, D), 'UNAUTHENTICATED', 'old sessions ended by the reset');
t.code(await call('auth.login', { login: '6000000087', password: 'Brand new pass 1' }), 'BAD_CREDENTIALS', 'and still does not work after approval');
t.code(await call('auth.login', { login: '6000000087', password: appr.data.tempPassword }), 'ok', "the server's temporary password is what works");
t.code(await call('resets.approve', { login: '6000000087' }, C), 'NOT_FOUND', 'nothing left to approve');
t.code(await call('auth.requestReset', { login: 'sps' }), 'ok', 'coordinator asks for a reset');
t.code(await call('resets.approve', { login: 'sps' }, C), 'FORBIDDEN', 'cannot approve their own');
const spsAppr = await call('resets.approve', { login: 'sps' }, M);
t.code(spsAppr, 'ok', 'master approves it');

// ---- access follows the batch at once
// must_change_pw is set by the reset, so the temporary password is cleared before the scope checks below
C = (await call('auth.login', { login: 'sps', password: spsAppr.data.tempPassword })).data.token;
t.code(await call('auth.changePassword', { current: spsAppr.data.tempPassword, new: 'Coordinator new 1' }, C), 'ok', 'the coordinator must choose their own password first');
C = (await call('auth.login', { login: 'sps', password: 'Coordinator new 1' })).data.token;
t.code(await call('requests.list', { batchId: 'SPS2' }, C), 'ok', 'coordinator has SPS2');
t.code(await call('batches.update', { batchId: 'SPS2', coordinatorLogins: [] }, M), 'ok', 'master moves SPS2 away');
t.code(await call('requests.list', { batchId: 'SPS2' }, C), 'FORBIDDEN', 'access to SPS2 ends at once');
t.code(await call('coordinators.setDisabled', { username: 'sps', disabled: true }, M), 'ok', 'master disables the coordinator');
t.code(await call('auth.me', {}, C), 'UNAUTHENTICATED', 'disabled coordinator signed out');

// ---- master ID tools
t.eq((await call('ids.search', { q: 'KT26' }, M)).data.results[0].linkedAccount, { login: '6000000087', name: 'Rahul Sharma' }, 'ID search shows the linked account');
t.code(await call('ids.link', { login: '6000000080', iyfId: 'JN26-0100', reason: 'found on the register' }, M), 'ok', 'master links an existing ID');
t.code(await call('ids.unlink', { login: '6000000080', reason: 'wrong person' }, M), 'ok', 'master unlinks');
t.ok(rows("SELECT * FROM audit_log WHERE action = 'ids.unlink'").length === 1, 'ID changes are audited');

// ---- copies to Google Sheets
google.writes.length = 0;
const report = [];
for (let run = 0; run < 12; run++) report.push(...await mirrorChanged(env, DB));      // until the big rules tables are through
t.ok(report.some(x => x.startsWith('accounts')), 'changed tables copied: ' + report.join(', '));
const accWrite = google.writes.find(w => w.url.includes('values:batchUpdate') && w.body.data.some(d => d.range.startsWith("'Accounts'")));
const accRows = accWrite.body.data.find(d => d.range.startsWith("'Accounts'")).values;
t.ok(accWrite.body.valueInputOption === 'RAW', 'copied as RAW: typed text is never run as a formula');
t.ok(accRows.length >= 5 && accRows.every(r => r[8] === '' && r[9] === '' && r[10] === '') && accRows.some(r => r[7] === 'SPS2'), 'no password hash, salt or rounds ever reach the sheet');
t.ok(accRows.some(r => r[0] === '6000000087' && typeof r[0] === 'string'), 'phones copied as text');
t.ok(google.writes.some(w => w.url.includes('AuditLog') && w.url.includes(':append')), 'audit lines appended, not rewritten');
google.writes.length = 0;
t.eq(await mirrorChanged(env, DB), [], 'nothing changed: nothing copied');
google.state.failSheets = true;
t.code(await call('batches.update', { batchId: 'SPS2', name: 'SPS Group Two' }, M), 'ok', 'a change made while Sheets is down');
t.code(await call('batches.update', { batchId: 'SPS2', coordinatorLogins: ['sps'] }, M), 'VALIDATION', 'a switched-off login cannot be given a batch');
const failed = await mirrorChanged(env, DB);
t.ok(failed.some(x => x.includes('failed')), 'Sheets down: reported, and the change stays queued');
google.state.failSheets = false;
t.ok((await mirrorChanged(env, DB)).some(x => x.startsWith('batches')), 'copied once Sheets is back');

t.done();
