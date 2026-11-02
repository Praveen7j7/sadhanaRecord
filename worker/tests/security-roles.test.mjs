// Security review (3 Oct 2026): a coordinator must not change, or take over through a password reset, a person in
// their batch who also coordinates another batch or is the IYF head. Viewing them stays allowed.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite('security: coordinators cannot change other staff');
const { call, addAccount, DB } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const X = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const join = async (phone, name) => {
  await call('auth.signUp', { phone, name, batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026',
    profile: { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, X);
};
await join('6000000161', 'Raghav Coordinator');            // a devotee of SPS2 who coordinates DPS
await join('6000000162', 'Head Devotee');                  // a devotee of SPS2 who is also a master
await join('6000000163', 'Plain Devotee');
t.code(await call('batches.update', { batchId: 'DPS', coordinatorLogins: ['6000000161'] }, M), 'ok', 'Raghav made coordinator of DPS');
t.code(await call('masters.set', { login: '6000000162', master: true, reason: 'second head' }, M), 'ok', 'a second IYF head');

for (const [who, login] of [['a coordinator of another batch', '6000000161'], ['the IYF head', '6000000162']]) {
  t.code(await call('devotees.setDisabled', { login, disabled: true }, X), 'FORBIDDEN', `SPS2's coordinator cannot disable ${who}`);
  t.code(await call('devotees.setActive', { login, active: false }, X), 'FORBIDDEN', `… nor set them inactive`);
  t.code(await call('devotees.setPeople', { login, classDay: 'SAT' }, X), 'FORBIDDEN', `… nor change their class day`);
  t.code(await call('photo.remove', { login, reason: 'test' }, X), 'FORBIDDEN', `… nor remove their photo`);
  t.code(await call('devotees.get', { login }, X), 'ok', `… but can still see ${who} in the batch`);
  // the take-over: anyone asks for a reset with a password they chose; the batch coordinator must not be able to approve it
  await call('auth.requestReset', { login, newPassword: 'Taken over 2026' });
  t.ok(!(await call('requests.list', {}, X)).data.resets.some(r => r.login === login), `${who}'s reset is not offered to the batch coordinator`);
  t.code(await call('resets.approve', { login }, X), 'FORBIDDEN', `… and approving it is refused`);
  t.ok((await call('requests.list', {}, M)).data.resets.some(r => r.login === login), `… the IYF head sees it instead`);
}
t.code(await call('devotees.setPeople', { login: '6000000163', classDay: 'SAT' }, X), 'ok', 'a plain devotee of the batch is still managed by the coordinator');
await call('auth.requestReset', { login: '6000000163', newPassword: 'Forgot it 2026' });
t.ok((await call('requests.list', {}, X)).data.resets.some(r => r.login === '6000000163'), "a plain devotee's reset still goes to the batch coordinator");
t.code(await call('devotees.setDisabled', { login: '6000000161', disabled: true }, M), 'ok', 'the IYF head can still disable a coordinator');
t.done();
