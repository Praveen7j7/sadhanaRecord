// The master's facilitator list (the head, 3 Oct 2026): switched-on names only, at sign-up, approval and edit;
// add, switch off, delete; the list is the app's own (nothing outside it changes it, 27 Oct 2026); copied to the Access sheet.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { mirrorChanged } from '../src/mirror.js';

const t = suite('facilitators: managed by the master, one list for every route');
const { env, DB, call, rows, addAccount, google } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const signUp = (phone, facilitator) => call('auth.signUp', { phone, name: 'Some Devotee', batchId: 'SPS', facilitator, ...CONTACT, password: 'Devotee pass 2026',
  profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
const offered = async () => (await call('meta.get', {})).data.facilitators;

// ---- everyone is switched on to begin with
let r = await call('facilitators.list', {}, M);
const n0 = r.data.facilitators.length;
t.ok(n0 > 30 && r.data.facilitators.every(f => f.active && f.source === 'DASHBOARD' && !('inDashboard' in f)), `every name starts switched on, as first loaded (${n0}); no dashboard flag any more`);
t.eq(r.data.counts, { on: n0, off: 0 }, 'counts');
t.eq((await offered()).length, n0, 'sign-up offers all of them');
t.code(await call('facilitators.list', {}, C), 'FORBIDDEN', 'only the master manages the list');

// ---- add
r = await call('facilitators.add', { name: '  Madhav   Das Prabhuji ' }, M);
t.eq([r.data.name, r.data.active, r.data.source], ['Madhav Das Prabhuji', true, 'APP'], 'added (spaces tidied), marked as added in the app');
t.ok((await offered()).includes('Madhav Das Prabhuji'), 'offered at sign-up straight away');
t.code(await call('facilitators.add', { name: 'madhav das prabhuji' }, M), 'VALIDATION', 'no second copy (any case)');
t.code(await call('facilitators.add', { name: 'X1' }, M), 'VALIDATION', 'letters only, at least 3');
t.code(await signUp('6000000141', 'Madhav Das Prabhuji'), 'ok', 'a devotee can sign up with the new name');

// ---- switch off: gone from sign-up, approval and edit; existing devotees keep it
t.code(await signUp('6000000142', FAC), 'ok', 'a sign-up waiting with ' + FAC);
r = await call('facilitators.setActive', { name: FAC, active: false }, M);
t.eq([r.data.active, r.data.waiting], [false, 1], 'switched off; one sign-up is waiting with it');
t.ok(!(await offered()).includes(FAC), 'no longer offered at sign-up');
t.code(await signUp('6000000049', FAC), 'VALIDATION', 'a new sign-up cannot choose it');
r = await call('requests.approve', { phone: '6000000142', link: { noIdYet: true } }, C);
t.code(r, 'VALIDATION', 'approval asks the coordinator to choose another');
t.ok(/no longer on the facilitator list/.test(r.error.fields[0].message), 'and says why');
t.code(await call('requests.approve', { phone: '6000000142', link: { noIdYet: true }, facilitator: 'Madhav Das Prabhuji' }, C), 'ok', 'approved with a switched-on name');
t.code(await call('requests.approve', { phone: '6000000141', link: { noIdYet: true } }, C), 'ok', 'approved');
t.code(await call('devotees.setPeople', { login: '6000000141', facilitator: FAC }, C), 'VALIDATION', "edit: can't newly choose a switched-off name");
await call('facilitators.setActive', { name: FAC, active: true }, M);
t.code(await call('devotees.setPeople', { login: '6000000141', facilitator: FAC }, C), 'ok', 'switched on again: can be chosen');
await call('facilitators.setActive', { name: FAC, active: false }, M);
t.code(await call('devotees.setPeople', { login: '6000000141', facilitator: FAC, classDay: 'SAT' }, C), 'ok', "a devotee's current (switched-off) name is kept when other details change");
r = await call('facilitators.list', {}, M);
t.eq(r.data.facilitators.find(f => f.name === FAC).members, 1, 'the list shows how many devotees have it');

// ---- delete: only a switched-off name
t.code(await call('facilitators.delete', { name: 'Madhav Das Prabhuji' }, M), 'CONFLICT', 'a switched-on name cannot be deleted');
t.code(await call('facilitators.delete', { name: FAC }, M), 'ok', 'a switched-off name is deleted');
r = await call('facilitators.list', {}, M);
t.ok(!r.data.facilitators.some(f => f.name === FAC), 'gone from the list');
t.eq(rows("SELECT facilitator FROM memberships WHERE login = '6000000141'")[0].facilitator, FAC, "the devotee's record keeps the name");
t.code(await call('facilitators.setActive', { name: FAC, active: true }, M), 'NOT_FOUND', 'a deleted name cannot be switched on');

// ---- nothing outside the app changes the list (the NameMap read is retired, 27 Oct 2026): the master's switch-off and
// deletion stand, and the app's own names keep their source
await call('facilitators.setActive', { name: 'Ankit Narula Prabhuji', active: false }, M);
r = await call('facilitators.list', {}, M);
t.eq(r.data.facilitators.find(f => f.name === 'Ankit Narula Prabhuji')?.active, false, "the master's switch-off stands");
t.eq(r.data.facilitators.find(f => f.name === 'Madhav Das Prabhuji')?.source, 'APP', "the app's own name stays the app's");
t.ok(!r.data.facilitators.some(f => f.name === FAC), 'and a deleted name stays deleted');
DB.sql.exec('DELETE FROM mirror_log');

// ---- copied to the Access sheet, with the audit trail
google.writes.length = 0;
const rep = await mirrorChanged(env, DB, 300);
t.ok(rep.some(x => x.startsWith('facilitators')), 'copied: ' + rep.join(', '));
const w = google.writes.find(x => x.body?.data?.some(d => d.range.startsWith("'Facilitators'")));
const facRows = w?.body.data.filter(d => d.range.startsWith("'Facilitators'")).flatMap(d => d.values) || [];
t.eq(facRows.find(v => v[0] === 'Madhav Das Prabhuji')?.slice(0, 3), ['Madhav Das Prabhuji', 'TRUE', 'APP'], 'the Facilitators tab row: name, active, source');
t.eq(rows("SELECT action FROM audit_log WHERE action LIKE 'facilitators.%' ORDER BY id").map(a => a.action),
  ['facilitators.add', 'facilitators.setActive', 'facilitators.setActive', 'facilitators.setActive', 'facilitators.delete', 'facilitators.setActive'], 'every change is in the audit log');
t.done();
