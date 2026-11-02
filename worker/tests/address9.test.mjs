// Phase 9, item 13 (the head, 9 Oct 2026): the address in parts — house / flat, street (optional), landmark (optional),
// area, district or city, state, PIN. The one line staff see is built from house and street; the older one-line shape
// still works.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite('phase 9: the address in parts');
const { DB, call, rows, addAccount } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
const base = { batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026' };
const profile = (address) => ({ dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address });
const parts = { house: 'B-12, 2nd floor', street: 'Gali no. 3', landmark: 'Near the metro', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' };

t.code(await call('auth.signUp', { ...base, phone: '6000000081', name: 'Arjun Das', profile: profile(parts) }), 'ok', 'sign-up with the address in parts');
t.eq(rows("SELECT addr_house, addr_street, addr_landmark, addr_line FROM profiles WHERE login = '6000000081'")[0],
  { addr_house: 'B-12, 2nd floor', addr_street: 'Gali no. 3', addr_landmark: 'Near the metro', addr_line: 'B-12, 2nd floor, Gali no. 3' }, 'kept in parts, with the one line built from house and street');
t.code(await call('auth.signUp', { ...base, phone: '6000000082', name: 'Bhima Das', profile: profile({ ...parts, street: '', landmark: '' }) }), 'ok', 'street and landmark are optional');
t.code(await call('auth.signUp', { ...base, phone: '6000000183', name: 'Chandra Das', profile: profile({ ...parts, house: '' }) }), 'VALIDATION', 'the house number is required');
t.code(await call('auth.signUp', { ...base, phone: '6000000184', name: 'Deva Das', profile: profile({ line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' }) }), 'ok', 'the older one-line address still works');
t.eq(rows("SELECT addr_house, addr_line FROM profiles WHERE login = '6000000184'")[0], { addr_house: '', addr_line: 'House 12, Gali 3' }, 'kept as one line, with no parts');
t.code(await call('auth.signUp', { ...base, phone: '6000000185', name: 'Eka Das', profile: profile({ ...parts, flat: 'x' }) }), 'VALIDATION', 'an unknown address field is refused');

// the coordinator sees it; the devotee edits it in parts
const req = (await call('requests.list', {}, M)).data.signUps.find(s => s.phone === '6000000081');
t.eq(req.profile.address, { line: 'B-12, 2nd floor, Gali no. 3', house: 'B-12, 2nd floor', street: 'Gali no. 3', landmark: 'Near the metro', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' }, 'the sign-up card has the parts');
await call('requests.approve', { phone: '6000000184', link: { noIdYet: true } }, M);
const D = (await call('auth.login', { login: '6000000184', password: 'Devotee pass 2026' })).data.token;
t.ok(!('house' in (await call('profile.get', {}, D)).data.address), 'an older address comes back as one line');
t.code(await call('profile.update', { address: { ...parts, house: 'Flat 4', street: 'Road 7', landmark: '' } }, D), 'ok', 'the devotee changes it, in parts');
t.eq((await call('profile.get', {}, D)).data.address.line, 'Flat 4, Road 7', 'the line follows the parts');
t.done();
