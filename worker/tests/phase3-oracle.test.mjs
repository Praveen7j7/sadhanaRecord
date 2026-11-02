// Audit phase 3.4 (13 Oct 2026): a signed-in devotee must not be able to learn anything about a phone number
// they have no business knowing about.
//
// `photo.get` and `photo.remove` are gated ANY — any signed-in account may call them with any `login`. The
// narrowing is `managed()`, which used to answer NOT_FOUND / CONFLICT / FORBIDDEN according to the TARGET's state
// and only then check the caller's scope. The three different codes told a curious devotee whether a number
// belongs to a devotee at all, whether that person is a pending sign-up, and whether they are active in another
// batch — an existence oracle reachable from the ordinary app, 60 calls a minute.
//
// The rule now: for a caller who is not staff, every one of those cases is the same NOT_FOUND.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { Buffer } from 'node:buffer';

const t = suite('phase 3: photo.get tells a devotee nothing about other numbers');
const { call, addAccount, DB } = boot();

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS', 'SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;

const profile = { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000199' },
  address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
// names carry no digits (shared/names.js), so spell the suffix
const WORD = { '01': 'One', '02': 'Two', '03': 'Three', '04': 'Four' };
const signUp = (phone, batchId) => call('auth.signUp', { phone, name: 'Devotee ' + (WORD[phone.slice(-2)] || 'X'), batchId, facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile });

// the caller: an ordinary devotee of SPS
await signUp('6000000024', 'SPS');
await call('requests.approve', { phone: '6000000024', link: { noIdYet: true } }, C);
const D = (await call('auth.login', { login: '6000000024', password: 'Devotee pass 2026' })).data.token;

// the people they might probe for
await signUp('6000000025', 'SPS');                                             // pending in the caller's own batch
await signUp('6000000026', 'SPS2');
await call('requests.approve', { phone: '6000000026', link: { noIdYet: true } }, C);   // active, another batch
await signUp('6000000027', 'SPS');
await call('requests.approve', { phone: '6000000027', link: { noIdYet: true } }, C);   // active, same batch
await call('devotees.setDisabled', { login: '6000000027', disabled: true }, C);        // …then disabled

// every probe a devotee can make must come back identically
const probes = [
  ['a number nobody has signed up with', '6000000099'],
  ['a pending sign-up', '6000000025'],
  ['an active devotee of another batch', '6000000026'],
  ['a disabled devotee of their own batch', '6000000027'],
  ['the coordinator (not a devotee account)', 'sps'],
  ['the IYF head', 'master'],
  ['a number that is not a phone at all', 'not-a-phone'],
];
const answers = new Set();
for (const [what, login] of probes) {
  const r = await call('photo.get', { login }, D);
  const code = r.ok ? 'ok' : r.error.code;
  const msg = r.ok ? '' : r.error.message;
  answers.add(code + '|' + msg);
  t.code(r, 'NOT_FOUND', `photo.get for ${what} → NOT_FOUND`);
}
t.eq(answers.size, 1, 'all seven probes give one identical code AND message, so nothing can be told apart');

// the devotee can still manage their OWN photo (upload first — there is nothing to fetch otherwise)
const JPEG = Buffer.from([0xff,0xd8,0xff,0xe0,0,16,74,70,73,70,0,1,1,0,0,1,0,1,0,0,0xff,0xc0,0,11,8,0x01,0x90,0x01,0x90,1,1,17,0,0xff,0xd9]).toString('base64');
t.code(await call('photo.upload', { jpegBase64: JPEG }, D), 'ok', 'a devotee uploads their own photo');
t.code(await call('photo.get', { login: '6000000024' }, D), 'ok', '… and can fetch it back');
t.code(await call('photo.get', {}, D), 'ok', '… and with no login at all, which is how the app asks');

// …and the coordinator still gets the codes that help them work. (photo.get answers NOT_FOUND "No photo." when
// the record is reachable but empty, so these use devotees.get, whose codes are unambiguous.)
t.code(await call('devotees.get', { login: '6000000025' }, C), 'ok', 'their coordinator can still open a pending sign-up');
t.code(await call('devotees.get', { login: '6000000099' }, C), 'NOT_FOUND', '… and an unknown number is unknown to them too');
t.code(await call('devotees.get', { login: '6000000026' }, C), 'ok', '… and they may open a devotee of a batch they coordinate');


// and a devotee cannot remove anyone's photo, including a batch-mate's
// a batch-mate's photo: the same answer as any other number, so the attempt reveals nothing either
t.code(await call('photo.remove', { login: '6000000027', reason: 'testing' }, D), 'NOT_FOUND', 'a devotee cannot remove a batch-mate\'s photo, and learns nothing by trying');
t.code(await call('photo.remove', { login: '6000000024', reason: 'testing' }, D), 'ok', '… but may remove their own');

t.done();
