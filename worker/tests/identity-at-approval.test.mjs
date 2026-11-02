// Approving a devotee CREATES THE PERSON — roadmap 3.8, found live by the head on 16 Oct 2026.
//
// WHAT HE SAW. A devotee registered the day before (Aditya Raj Karn, approved 02:25) had an IYF ID on his
// account — GP26-0144, matched from the facilitator dashboard at approval — and could not be found in
// identity search at all. The head could read the ID and could not trace the person behind it.
//
// WHY. `requests.approve` stamped the ID on the account and stopped there. Nothing in it touched `persons`,
// `person_identifiers`, `person_names`, `person_phones` or `person_links`; only identity.js wrote there, and
// approval never called it. So every devotee approved through the app was invisible to the identity tables
// that are supposed to BE the record. The agreement is that the IYF ID is how a devotee is identified, so
// creating the person is part of approving them, not a separate step somebody remembers.
//
// The hard part is not creating a person. It is NOT creating a second one: the dashboard's people are
// already in these tables (1,345 of them live), so an approval must reuse the person it already has.
import { boot, suite, FAC, CONTACT } from './harness.mjs';

const t = suite('approval puts the devotee in the identity tables, once');
const { call, addAccount, DB, rows } = boot();

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'SPS Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;

const profile = { dob: '2001-09-13', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000199' },
  address: { line: 'House 12, Gali No 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const signUp = (phone, name, extra = {}) => call('auth.signUp',
  { phone, name, batchId: 'SPS', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile: { ...profile, ...extra } });

const personOf = (login) => rows(`SELECT p.* FROM persons p JOIN person_links l ON l.person_id = p.id
                                   WHERE l.service = 'sadhana' AND l.account_ref = '${login}'`)[0];

/* ───────── a devotee nobody has seen before: a person is created ───────── */

const NEW = '6000000171';
await signUp(NEW, 'Arjun Das', { connectedSince: '2025' });
t.eq(personOf(NEW), undefined, 'before approval there is no person: signing up alone creates nobody');
t.code(await call('requests.approve', { phone: NEW, link: { noIdYet: true } }, C), 'ok', 'the coordinator approves');

const p1 = personOf(NEW);
t.ok(!!p1, 'approving CREATES the person — this is the whole finding: it used to create nobody');
t.eq(p1.display_name, 'Arjun Das', 'with their name');
t.eq(p1.status, 'Active', 'and marked active');
t.eq(p1.connected_since, '2025', 'carrying the year they said they connected, which the form already asked for');
t.eq(rows(`SELECT phone FROM person_phones WHERE person_id = '${p1.id}'`).map(r => r.phone), [NEW], 'their phone is on the person');
t.eq(rows(`SELECT name FROM person_names WHERE person_id = '${p1.id}'`).map(r => r.name), ['Arjun Das'], '… and their name, as a name they have held');

/* ───────── and they can be FOUND, which is what the head could not do ───────── */

const found = await call('identity.search', { q: 'Arjun' }, M);
t.code(found, 'ok', 'identity search runs');
t.ok(found.data.people.some(r => r.id === p1.id), 'the devotee is findable by name — he was invisible before');
const byPhone = await call('identity.search', { q: NEW }, M);
t.ok(byPhone.data.people.some(r => r.id === p1.id), '… and by phone');

/* ───────── a devotee the DASHBOARD already knows: reused, never duplicated ───────── */
//
// This is the case the head actually hit. GP26-0144 was already in the registry, the coordinator picked it
// at approval, and a second person for the same human would be the worst possible outcome of "fixing" this.

const KNOWN = '6000000172', FID = 'GP26-0199';
DB.sql.exec(`INSERT INTO persons (id, display_name, iyf_id, status, created_at, updated_at) VALUES ('pdash1', 'ADITYA RAJ Pr', '${FID}', 'Active', '2026-01-01', '2026-01-01')`);
DB.sql.exec(`INSERT INTO person_identifiers (fid, person_id, series, state, issued_by, issued_at) VALUES ('${FID}', 'pdash1', 'GP', 'current', 'dashboard', '2026-01-01')`);
DB.sql.exec(`INSERT INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES ('${KNOWN}', 'pdash1', 1, 1, '2026-01-01')`);
DB.sql.exec(`INSERT INTO registry (iyf_id, name, phone, level, facilitator, status) VALUES ('${FID}', 'ADITYA RAJ Pr', '${KNOWN}', 'SPS', '${FAC}', 'active')`);
const before = rows('SELECT COUNT(*) AS n FROM persons')[0].n;

await signUp(KNOWN, 'Aditya Raj Karn');
t.code(await call('requests.approve', { phone: KNOWN, link: { iyfId: FID } }, C), 'ok', 'approved against the ID the dashboard already holds');

t.eq(rows('SELECT COUNT(*) AS n FROM persons')[0].n, before, 'NO second person is created for someone IYF already knows');
const p2 = personOf(KNOWN);
t.eq(p2?.id, 'pdash1', 'the account is linked to the person who was already there');
t.eq(p2.iyf_id, FID, 'who keeps their ID');
t.ok(rows(`SELECT name FROM person_names WHERE person_id = 'pdash1'`).map(r => r.name).includes('Aditya Raj Karn'),
     'the name they signed up with is ADDED beside the dashboard\'s spelling, not swapped for it');
t.eq(rows(`SELECT COUNT(*) AS n FROM person_identifiers WHERE fid = '${FID}'`)[0].n, 1, 'and the ID is not duplicated');

/* ───────── the account still carries the ID, so screens and exports agree ───────── */

const acct = rows(`SELECT iyf_id, id_source FROM accounts WHERE login = '${KNOWN}'`)[0];
t.eq([acct.iyf_id, acct.id_source], [FID, 'COORDINATOR'], 'the account keeps the ID and says where it came from');

/* ───────── approving is still ONE batch: a failure must not leave half a person ───────── */

const PEND = '6000000173';
await signUp(PEND, 'Bhima Das');
t.code(await call('requests.approve', { phone: PEND, link: { iyfId: FID } }, C), 'CONFLICT',
       'approving with an ID that belongs to someone else is refused');
t.eq(personOf(PEND), undefined, 'and NO person is left behind by the refused approval');
t.eq(rows(`SELECT status FROM accounts WHERE login = '${PEND}'`)[0].status, 'PENDING', '… the sign-up is still pending');

t.done();
