// Decision 34: one person, one login. A coordinator or master can also be a devotee with their own form.
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';

const t = suite('scopes: devotee, coordinator and master in one login');
const { call, rows, addAccount, DB } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026', { name: 'IYF Head' });
DB.sql.exec("UPDATE accounts SET is_master = 1 WHERE login = 'master'");
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const join = async (phone, name, batchId) => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, groupLeader: LEAD[batchId], password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data;
};

// a devotee of SPS2 who is also given the coordination of SPS2
let r = await join('6000000141', 'Raghav Das', 'SPS2');
t.eq(r.user.scopes, { devotee: { batchId: 'SPS2' }, groupLeader: null, facilitator: null, trainee: null, coordinator: [], master: false, ftp: false, rights: {} }, 'a devotee: own form only');
t.code(await call('requests.list', {}, r.token), 'FORBIDDEN', 'no coordinator screens yet');
t.code(await call('coordinators.update', { username: '6000000141', batchIds: ['SPS2'] }, M), 'ok', 'the master makes him coordinator of SPS2 (his own login)');
r = (await call('auth.login', { login: '6000000141', password: 'Devotee pass 2026' })).data;
const R = r.token;
t.eq(r.user.scopes, { devotee: { batchId: 'SPS2' }, groupLeader: null, facilitator: null, trainee: null, coordinator: ['SPS2'], master: false, ftp: false, rights: {} }, 'one login: devotee and coordinator');
t.code(await call('home.get', {}, R), 'ok', 'he still fills his own sadhana');
t.code(await call('requests.list', {}, R), 'ok', 'and sees SPS2 requests');
t.eq((await call('rules.get', {}, R)).data.cardName, 'SPS', 'his own card is his batch card');

// he cannot approve himself, nor his own reset
await call('auth.signUp', { phone: '6000000142', name: 'New Comer', batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026',
  profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
t.code(await call('requests.approve', { phone: '6000000142', link: { noIdYet: true } }, R), 'ok', 'he approves a newcomer of his batch');
t.code(await call('auth.requestReset', { login: '6000000141' }), 'ok', 'he asks for a reset');
t.eq((await call('requests.list', {}, R)).data.resets.length, 0, 'his own reset is not in his list');
t.code(await call('resets.approve', { login: '6000000141' }, R), 'FORBIDDEN', 'and he cannot approve it');
// decision 46: the master's approval returns the temporary password, which he then has to change
const mAppr = await call('resets.approve', { login: '6000000141' }, M);
t.code(mAppr, 'ok', 'the master can');

// on behalf: only with staff scope, never confused with the own form
const N = (await call('auth.login', { login: '6000000142', password: 'Devotee pass 2026' })).data.token;
let R2 = (await call('auth.login', { login: '6000000141', password: mAppr.data.tempPassword })).data.token;
t.code(await call('auth.changePassword', { current: mAppr.data.tempPassword, new: 'Another pass 2026' }, R2), 'ok', 'he chooses his own password before carrying on');
R2 = (await call('auth.login', { login: '6000000141', password: 'Another pass 2026' })).data.token;
t.code(await call('week.get', { weekId: '2026-09-28', onBehalfOf: '6000000141' }, N), 'FORBIDDEN', 'a plain devotee cannot open someone else\'s form');
t.ok((await call('week.get', { weekId: '2026-09-28', onBehalfOf: '6000000142' }, R2)).ok, 'the coordinator can open his devotee\'s form');
t.ok((await call('week.get', { weekId: '2026-09-28', onBehalfOf: '6000000141' }, R2)).ok, 'onBehalfOf himself = his own form');

// master scope granted to a person; never lost by the recovery login or the last master
t.code(await call('masters.set', { login: '6000000141', master: true, reason: 'second head' }, R2), 'FORBIDDEN', 'only a master grants master');
t.code(await call('masters.set', { login: '6000000141', master: true, reason: 'second head' }, M), 'ok', 'the master grants master to Raghav');
r = (await call('auth.login', { login: '6000000141', password: 'Another pass 2026' })).data;
t.eq([r.user.scopes.master, r.user.scopes.devotee?.batchId, r.user.batchIds.length], [true, 'SPS2', 7], 'devotee + coordinator + master: all batches as staff');
t.code(await call('masters.set', { login: 'master', master: false, reason: 'test' }, r.token), 'CONFLICT', 'the recovery login always stays master');
t.code(await call('masters.set', { login: '6000000141', master: false, reason: 'done' }, M), 'ok', 'master scope removed again');
t.code(await call('coordinators.list', {}, r.token), 'UNAUTHENTICATED', 'removing master scope signs that person out');
t.ok((await call('coordinators.list', {}, M)).data.some(c => c.username === '6000000141' && c.personal && c.batchIds.includes('SPS2')), 'the coordinators list shows personal logins');
t.code(await call('coordinators.setDisabled', { username: '6000000141', disabled: true }, M), 'CONFLICT', 'a personal login is not switched off from the coordinator screen');
t.code(await call('coordinators.update', { username: '6000000141', batchIds: [] }, M), 'ok', 'coordination is taken away by removing the batches');
r = (await call('auth.login', { login: '6000000141', password: 'Another pass 2026' })).data;
t.eq(r.user.scopes, { devotee: { batchId: 'SPS2' }, groupLeader: null, facilitator: null, trainee: null, coordinator: [], master: false, ftp: false, rights: {} }, 'back to devotee only');
t.done();
