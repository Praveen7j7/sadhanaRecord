// Phase 9, item 24 (the user, 9 Oct 2026, release-blocking): the IYF head appoints a new IYF head directly — someone with
// no coordination history — with a reason. It takes effect only when EVERY other active head has approved (alone: at
// once). Promoting a staff login to head goes the same way. The new head is staff-only (no sadhana).
import { boot, suite } from './harness.mjs';

const t = suite('phase 9: appointing an IYF head');
const { DB, call, clock, rows, addAccount } = boot();
clock.now = Date.parse('2026-10-09T12:00:00+05:30');
await addAccount('master', 'MASTER', 'Master pass 2026');            // the recovery login
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const head = (username, more = {}) => ({ username, name: 'Madhava Das', tempPassword: 'Temp-head-2026', master: true, reason: 'Coming from Chennai to lead IYF Delhi', ...more });
const signIn = async (login, pw) => (await call('auth.login', { login, password: pw })).data;

// ---- the rules of the form
t.code(await call('coordinators.create', head('x1'), C), 'FORBIDDEN', 'a coordinator cannot appoint a head');
t.code(await call('coordinators.create', head('x1', { reason: '' }), M), 'VALIDATION', 'a reason is required');
t.code(await call('coordinators.create', head('x1', { batchIds: ['SPS2'] }), M), 'VALIDATION', 'a head is given no batches');

// ---- alone (only the recovery login is a head): it takes effect at once
let r = await call('coordinators.create', head('anand', { name: 'Anand Das' }), M);
t.ok(r.ok && !r.data.pending, 'with no other head to ask, the new head is made at once');
t.eq(rows("SELECT role, is_master, must_change_pw FROM accounts WHERE login = 'anand'")[0], { role: 'MASTER', is_master: 1, must_change_pw: 1 }, 'role MASTER, head access, a new password at first sign-in');
t.eq(rows("SELECT action, reason FROM audit_log WHERE target = 'anand'"), [{ action: 'masters.create', reason: 'Coming from Chennai to lead IYF Delhi' }], 'Activity says masters.create, with the reason');
let s = await signIn('anand', 'Temp-head-2026');
t.code(await call('auth.changePassword', { current: 'Temp-head-2026', new: 'Anand new 2026' }, s.token), 'ok', 'the new head chooses a password');
s = await signIn('anand', 'Anand new 2026');
t.ok(s.user.scopes.master && !s.user.scopes.devotee && !s.user.scopes.coordinator.length, 'a head with no sadhana and no batches');
const A = s.token;
t.code(await call('stats.all', { weeks: 8 }, A), 'ok', 'the head\'s numbers open');
t.code(await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 0, day: { rounds: 16 } }, A), 'FORBIDDEN', 'no sadhana form for them');

// ---- promoting a staff login: the other head (anand) must approve
await call('coordinators.create', { username: 'bhakti', name: 'Bhakti Devi', batchIds: [], tempPassword: 'Temp-bhak-2026' }, A);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'bhakti'");
r = await call('masters.set', { login: 'bhakti', master: true, reason: 'Second head for the youth' }, M);
t.ok(r.ok && r.data.pending, 'the recovery login promotes bhakti: it waits for anand');
t.eq(r.data.request.heads.map(h => h.login), ['anand'], 'asked: anand');
t.eq(rows("SELECT is_master FROM accounts WHERE login = 'bhakti'")[0].is_master, 0, 'not a head yet');
let q = (await call('heads.requests', {}, A)).data.open[0];
t.ok(q.mine && q.kind === 'PROMOTE', 'anand sees it, to approve');
r = await call('heads.decide', { id: q.id, approve: true }, A);
t.ok(r.ok && r.data.done, 'anand approves: done');
t.eq(rows("SELECT is_master FROM accounts WHERE login = 'bhakti'")[0].is_master, 1, 'bhakti is a head');
t.ok(/approved by every head \(anand\)/.test(rows("SELECT reason FROM audit_log WHERE action = 'masters.set' AND target = 'bhakti'")[0].reason), 'Activity: the reason and who approved');
const B = (await signIn('bhakti', 'Temp-bhak-2026')).token;

// ---- with other heads: everyone must approve
r = await call('coordinators.create', head('madhava'), A);
t.ok(r.ok && r.data.pending, 'anand appoints madhava: it waits for the other heads');
t.eq(r.data.request.heads.map(h => h.login), ['bhakti'], 'asked: every other active head (not the recovery login)');
t.ok(!rows("SELECT 1 AS x FROM accounts WHERE login = 'madhava'").length, 'no account yet');
t.ok(!rows("SELECT pw_hash FROM head_requests WHERE login = 'madhava'")[0].pw_hash.includes('Temp'), 'the temporary password is kept only as a hash');
t.code(await call('coordinators.create', head('madhava'), A), 'CONFLICT', 'the same username cannot be asked twice');
q = (await call('heads.requests', {}, B)).data.open.find(x => x.login === 'madhava');
t.code(await call('heads.decide', { id: q.id, approve: true }, A), 'FORBIDDEN', 'the head who asked does not approve their own request');
t.code(await call('heads.decide', { id: q.id, approve: true }, C), 'FORBIDDEN', 'a coordinator cannot approve');
r = await call('heads.decide', { id: q.id, approve: true }, B);
t.ok(r.ok && r.data.done, 'bhakti approves: everyone has, so madhava is made');
t.eq(rows("SELECT role, is_master FROM accounts WHERE login = 'madhava'")[0], { role: 'MASTER', is_master: 1 }, 'madhava is a head');
t.eq(rows("SELECT pw_hash FROM head_requests WHERE login = 'madhava'")[0].pw_hash, '', 'the stored hash is cleared once used');
t.ok((await signIn('madhava', 'Temp-head-2026'))?.user?.mustChangePassword, 'madhava signs in with the temporary password');

// ---- one "no" turns it down; withdrawing; lapsing
r = await call('coordinators.create', head('gopal', { name: 'Gopal Das' }), A);       // asks bhakti and madhava
t.eq(r.data.request.heads.map(h => h.login).sort(), ['bhakti', 'madhava'], 'now two heads are asked');
q = r.data.request;
t.code(await call('heads.decide', { id: q.id, approve: true }, B), 'ok', 'bhakti approves');
t.eq(rows('SELECT state FROM head_requests WHERE id = ' + q.id)[0].state, 'OPEN', 'still waiting for madhava');
const MD = (await signIn('madhava', 'Temp-head-2026')).token;
await call('auth.changePassword', { current: 'Temp-head-2026', new: 'Madhava new 2026' }, MD);
const MD2 = (await signIn('madhava', 'Madhava new 2026')).token;
t.code(await call('heads.decide', { id: q.id, approve: false }, MD2), 'VALIDATION', 'declining needs a short reason');
t.code(await call('heads.decide', { id: q.id, approve: false, note: 'We have enough heads' }, MD2), 'ok', 'madhava declines');
t.ok(!rows("SELECT 1 AS x FROM accounts WHERE login = 'gopal'").length && rows('SELECT state FROM head_requests WHERE id = ' + q.id)[0].state === 'REJECTED', 'one "no": not made');
t.code(await call('heads.decide', { id: q.id, approve: true }, B), 'CONFLICT', 'a decided request cannot be approved');
r = await call('coordinators.create', head('hari', { name: 'Hari Das' }), A);
t.code(await call('heads.withdraw', { id: r.data.request.id }, B), 'FORBIDDEN', 'only the head who asked can withdraw');
t.code(await call('heads.withdraw', { id: r.data.request.id }, A), 'ok', 'anand withdraws it');
r = await call('coordinators.create', head('isha', { name: 'Isha Devi' }), A);
clock.now = Date.parse('2026-10-24T12:00:00+05:30');
t.code(await call('heads.decide', { id: r.data.request.id, approve: true }, B), 'CONFLICT', 'after 14 days an open request has lapsed');
t.eq(rows("SELECT state FROM head_requests WHERE login = 'isha'")[0].state, 'EXPIRED', 'marked lapsed');

// ---- the trail
const acts = rows("SELECT action FROM audit_log WHERE action LIKE 'masters.%' ORDER BY id").map(x => x.action);
t.ok(['masters.request', 'masters.approve', 'masters.decline', 'masters.withdraw', 'masters.create', 'masters.set'].every(a => acts.includes(a)), 'every step is in Activity');
t.ok(!rows("SELECT 1 AS x FROM audit_log WHERE action = 'coordinators.create' AND target IN ('anand', 'madhava')").length, 'never written as coordinators.create');
t.done();
