// Phase 9, item 14: the IYF head creates an IYF ID for a devotee who has none; only the head; the
// dashboard's own ID wins later.
//
// The format is IYFD-<the year they connected>-NNNN, the one every IYF record uses (the head, 18 Oct
// 2026). It was briefly minted as its own SR<yy> series, which is exactly the second kind of
// identifier the rule exists to prevent — a temple resident read IYFD-2026-0001 while everybody around
// him read IYFD-2016-0003. Old SR ids still retire cleanly; none is ever issued again.
import { boot, suite, FAC, CONTACT, devoteeRow } from './harness.mjs';

const t = suite('phase 9: IYF IDs created in the app');
const { env, DB, call, clock, rows, addAccount } = boot();
clock.now = Date.parse('2026-10-09T12:00:00+05:30');
await addAccount('master', 'MASTER', 'Master pass 2026');
DB.sql.exec("UPDATE accounts SET is_master = 1 WHERE login = 'master'");
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const signUp = (phone, name) => call('auth.signUp', { phone, name, batchId: 'SPS2', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026',
  profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
await signUp('6000000071', 'Arjun Das');
await call('requests.approve', { phone: '6000000071', link: { noIdYet: true } }, M);
const idOf = (login) => rows(`SELECT iyf_id FROM accounts WHERE login = '${login}'`)[0].iyf_id;

// ---- an ID carries THEIR year, so it needs one
// "IDE should be based with the connected years" (the head, 18 Oct 2026). Never today's date in its place:
// a cohort that falls back to the creation date numbers somebody into the wrong year for good.
t.eq((await call('ids.nextApp', { login: '6000000071' }, M)).data, { next: null, needsYear: true },
  'no year on record: the preview asks for it rather than guessing one');
t.code(await call('ids.create', { login: '6000000071' }, C), 'FORBIDDEN', 'a coordinator cannot create an IYF ID');
t.code(await call('ids.create', { login: '6000000071' }, M), 'VALIDATION', 'and the head cannot create one without the year');
t.eq((await call('ids.nextApp', { login: '6000000071', year: '2019' }, M)).data.next, 'IYFD-2019-0001',
  'given the year, the preview shows the next number for THAT year');
let r = await call('ids.create', { login: '6000000071', reason: 'new to IYF', year: '2019' }, M);
t.eq(r.data?.iyfId, 'IYFD-2019-0001', 'the head creates IYFD-2019-0001');
t.eq(idOf('6000000071'), 'IYFD-2019-0001', 'linked to the account');
t.eq(rows("SELECT iyf_id FROM memberships WHERE login = '6000000071' AND to_week = ''")[0].iyf_id, 'IYFD-2019-0001', 'and to the membership');
t.eq(rows("SELECT iyf_id, connected_since FROM profiles WHERE login = '6000000071'")[0], { iyf_id: 'IYFD-2019-0001', connected_since: '2019' },
  'and the profile, with the year it carries');
t.eq(rows(`SELECT pi.state FROM person_identifiers pi JOIN person_links pl ON pl.person_id = pi.person_id
           WHERE pl.account_ref = '6000000071' AND pi.fid = 'IYFD-2019-0001'`)[0]?.state, 'current',
  'and it is in the identity authority, on their person record');
t.ok(/"iyfId":"IYFD-2019-0001"/.test(rows("SELECT after FROM audit_log WHERE action = 'identity.issue' ORDER BY id DESC LIMIT 1")[0].after), 'Activity names the new ID');
t.code(await call('ids.create', { login: '6000000071', year: '2019' }, M), 'CONFLICT', 'a devotee who has an IYFD gets no second one');
t.ok(rows("SELECT COUNT(*) AS n FROM mirror_log WHERE tbl = 'app_ids'")[0].n > 0, 'copied to the Sheets AppIds tab');

// ---- ONE counter, per year, in the authority. A counter of the app's own (the highest number it could see,
// plus one) once stood here: with 2018 at 30 in the authority it would have issued numbers the 2018 counter
// reaches later, for somebody else (18 Oct 2026).
DB.sql.exec("INSERT INTO id_sequences (series, year, next_seq, updated_at) VALUES ('IYFD', '2018', 30, '2026-10-01')");
const mk = async (login, name, year) => {
  DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
    VALUES ('${login}', 'DEVOTEE', 'ACTIVE', '${name}', '${login}', 'x', 'eA==', 1, '2026-09-01', '2026-09-01', 'test')`);
  DB.sql.exec(`INSERT INTO profiles (login, name, connected_since, updated_at, updated_by) VALUES ('${login}', '${name}', '${year}', '2026-09-01', 'test')`);
};
await mk('6000000081', 'Old Hand', '2018');
t.eq((await call('ids.create', { login: '6000000081' }, M)).data.iyfId, 'IYFD-2018-0030',
  "a 2018 devotee takes the authority's next 2018 number, not a number from any other year");
await mk('6000000082', 'Also Nineteen', '2019');
t.eq((await call('ids.create', { login: '6000000082' }, M)).data.iyfId, 'IYFD-2019-0002', 'each year counts on its own');

// ---- an old-style ID is replaced, and still resolves
await mk('6000000083', 'Legacy Holder', '2018');
DB.sql.exec("UPDATE accounts SET iyf_id = 'JN26-0901' WHERE login = '6000000083'");
r = await call('ids.create', { login: '6000000083', reason: 'old number' }, M);
t.eq(r.data?.iyfId, 'IYFD-2018-0031', 'an account on an old GP/JN/KT number gets its IYFD');
t.eq(rows("SELECT state, superseded_by FROM person_identifiers WHERE fid = 'JN26-0901'")[0], { state: 'superseded', superseded_by: 'IYFD-2018-0031' },
  'and the old number is kept, superseded, pointing at the new one — it resolves for ever');

// ---- while approving
await signUp('6000000072', 'Bhima Das');
t.code(await call('requests.approve', { phone: '6000000072', link: { createId: true } }, C), 'FORBIDDEN', 'a coordinator cannot create one while approving');
t.eq(rows("SELECT status FROM accounts WHERE login = '6000000072'")[0].status, 'PENDING', 'and nothing was approved');
r = await call('requests.approve', { phone: '6000000072', link: { createId: true } }, M);
t.eq([r.data?.created, r.data?.needsYear, rows("SELECT status FROM accounts WHERE login = '6000000072'")[0].status], [false, true, 'ACTIVE'],
  'no year on record: they are approved, and the ID waits for the year instead of taking today\'s');
DB.sql.exec("UPDATE profiles SET connected_since = '2019' WHERE login = '6000000072'");
r = await call('ids.create', { login: '6000000072' }, M);
t.eq(r.data?.iyfId, 'IYFD-2019-0003', 'once the year is known, the ID follows');


// ---- the head's list, and a dashboard number never downgrading an IYFD
DB.sql.exec(`INSERT INTO registry (iyf_id, name, phone, level, facilitator, status) VALUES ('KT26-0421', 'Arjun Das', '6000000071', 'SPS', '${FAC}', 'active')`);
let list = (await call('ids.appList', {}, M)).data.ids;
t.eq(list[0].iyfId, 'IYFD-2019-0003', "the head's list shows what the app issued, newest first");
t.eq(list.find(x => x.iyfId === 'IYFD-2019-0001').dashboardMatch, { iyfId: 'KT26-0421', name: 'Arjun Das' }, 'the dashboard has Arjun (same phone): shown as a match');
t.code(await call('ids.appList', {}, C), 'FORBIDDEN', "the list is the head's");
t.code(await call('ids.link', { login: '6000000071', iyfId: 'KT26-0421', reason: 'dashboard registered him' }, M), 'CONFLICT',
  'an older dashboard number cannot replace the IYFD he holds');
t.eq(idOf('6000000071'), 'IYFD-2019-0001', 'he keeps his IYFD');

// ---- numbers never repeat
t.code(await call('ids.unlink', { login: '6000000072', reason: 'test' }, M), 'ok', 'unlinking an app ID');
t.eq(rows("SELECT state FROM app_ids WHERE iyf_id = 'IYFD-2019-0003'")[0].state, 'RETIRED', 'retires it');
r = await call('ids.create', { login: '6000000072' }, M);
t.eq(r.data?.iyfId, 'IYFD-2019-0004', 'a new ID never reuses a number');

// ---- an account with NO id at all sets its year (Ananta's case, 22 Oct 2026): the IYFD is issued in the same save,
// with nothing to supersede — "once they fill it in their About section, at that very moment the issuance should
// be done" (the head)
{
  await signUp('6000000086', 'No Id Yet');
  await call('requests.approve', { phone: '6000000086', link: { noIdYet: true } }, M);
  DB.sql.exec("UPDATE accounts SET iyf_id = '' WHERE login = '6000000086'");
  const N = (await call('auth.login', { login: '6000000086', password: 'Devotee pass 2026' })).data.token;
  t.eq((await call('profile.get', {}, N)).data.connectedSinceSettable, true, 'no id and no year: About offers the year');
  const pr = (await call('profile.update', { connectedSince: '2020' }, N)).data;
  t.ok(/^IYFD-2020-\d{4}$/.test(pr.iyfId || ''), `no id at all: setting the year issues an IYFD at once (${pr.iyfId})`);
  t.eq(rows("SELECT iyf_id FROM accounts WHERE login = '6000000086'")[0].iyf_id, pr.iyfId, 'and the account carries it');
  t.eq(rows(`SELECT state FROM person_identifiers WHERE fid = '${pr.iyfId}'`)[0]?.state, 'current', 'as the current identifier of their person record');
}

// ---- the devotee sets their own year, once (the head, 18 Oct 2026): Suraj Sahu's case — an old JN number from
// before sign-up asked for the year, and no way to give it.
{
  await signUp('6000000084', 'Early Devotee');
  await call('requests.approve', { phone: '6000000084', link: { noIdYet: true } }, M);
  DB.sql.exec("UPDATE accounts SET iyf_id = 'JN26-0975' WHERE login = '6000000084'");
  const D = (await call('auth.login', { login: '6000000084', password: 'Devotee pass 2026' })).data.token;
  let prof = (await call('profile.get', {}, D)).data;
  t.eq([prof.connectedSinceYear, prof.connectedSinceSettable], ['', true], 'no year on record: About offers to set it');
  t.code(await call('profile.update', { connectedSince: '2031' }, D), 'VALIDATION', 'a year that has not happened is refused');
  prof = (await call('profile.update', { connectedSince: '2018' }, D)).data;
  t.ok(/^IYFD-2018-\d{4}$/.test(prof.iyfId), `setting it issues their IYFD at once (${prof.iyfId})`);
  t.eq([prof.connectedSinceYear, prof.connectedSinceSettable], ['2018', false], 'and the year is now locked');
  t.eq(rows("SELECT state, superseded_by FROM person_identifiers WHERE fid = 'JN26-0975'")[0], { state: 'superseded', superseded_by: prof.iyfId },
    'the old JN number is kept, superseded, and still resolves to them');
  t.code(await call('profile.update', { connectedSince: '2016' }, D), 'VALIDATION', 'it cannot be set a second time — the ID carries it');
  t.eq((await call('profile.get', {}, D)).data.iyfId, prof.iyfId, 'and their ID did not change');
}
// somebody already on an IYFD with no year in their profile reads it from the ID, and cannot set another
{
  await signUp('6000000085', 'Id Holder');
  await call('requests.approve', { phone: '6000000085', link: { noIdYet: true } }, M);
  DB.sql.exec("UPDATE accounts SET iyf_id = 'IYFD-2016-0451' WHERE login = '6000000085'");
  const D = (await call('auth.login', { login: '6000000085', password: 'Devotee pass 2026' })).data.token;
  const prof = (await call('profile.get', {}, D)).data;
  t.eq([prof.connectedSinceYear, prof.connectedSinceSettable], ['2016', false], 'an IYFD holder: the year is read from the ID, locked');
  t.code(await call('profile.update', { connectedSince: '2019' }, D), 'VALIDATION', 'and cannot be overwritten');
  // a profile year that disagrees with the ID: the ID's year is shown, because the ID carries it
  DB.sql.exec("UPDATE profiles SET connected_since = '2025' WHERE login = '6000000085'");
  t.eq((await call('profile.get', {}, D)).data.connectedSinceYear, '2016', "a profile year that disagrees with the ID: the ID's year is shown");
}

// the head gives the year while approving (18 Oct 2026): a sign-up with no year used to be approved with no ID and
// the toast said "the IYF ID will be linked automatically", which never happened
await signUp('6000000073', 'Chitra Das');
const want = (await call('ids.nextApp', { login: '6000000073', year: '2019' }, M)).data.next;
t.ok(/^IYFD-2019-\d{4}$/.test(want || ''), `the approval card previews the ID for the year the head picks (${want})`);
t.code(await call('requests.approve', { phone: '6000000073', link: { createId: true, year: '3019' } }, M), 'VALIDATION',
  'a year that has not happened is refused');
t.eq(rows("SELECT status FROM accounts WHERE login = '6000000073'")[0].status, 'PENDING', 'before anything is approved');
r = await call('requests.approve', { phone: '6000000073', link: { createId: true, year: '2019' } }, M);
t.eq([r.data?.created, r.data?.iyfId, rows("SELECT status FROM accounts WHERE login = '6000000073'")[0].status], [true, want, 'ACTIVE'],
  'given the year, they are approved WITH their IYFD in one step');
t.eq(rows("SELECT connected_since AS y FROM profiles WHERE login = '6000000073'")[0].y, '2019', 'and the year is on their profile');

// ---- every devotee ends on IYFD (the head, 22 Oct 2026): "only one id system must be there across everywhere".
// Nobody is removed. A devotee without an IYFD is asked for their year at their next open; answering issues it
// in that same save. Once an IYFD carries the year it is locked, so nobody is ever issued a second one.
{
  // an old number and no year (Bipin, Sandeep, Shivom, Pushpender, Suraj on live)
  await signUp('6000000087', 'Old Number No Year');
  await call('requests.approve', { phone: '6000000087', link: { noIdYet: true } }, M);
  DB.sql.exec("UPDATE accounts SET iyf_id = 'GP26-0905' WHERE login = '6000000087'");
  DB.sql.exec("UPDATE profiles SET connected_since = '' WHERE login = '6000000087'");
  const A = (await call('auth.login', { login: '6000000087', password: 'Devotee pass 2026' })).data.token;
  t.eq((await call('auth.me', {}, A)).data.user.needsYear, true, 'an old number and no year: the next open asks for the year');

  // an old number WITH a year on record (Vilash: SR26-0001, 2013) — he was locked out of setting it
  await signUp('6000000088', 'Year But Old Number');
  await call('requests.approve', { phone: '6000000088', link: { noIdYet: true } }, M);
  DB.sql.exec("UPDATE accounts SET iyf_id = 'SR26-0905' WHERE login = '6000000088'");
  DB.sql.exec("UPDATE profiles SET connected_since = '2013' WHERE login = '6000000088'");
  const V = (await call('auth.login', { login: '6000000088', password: 'Devotee pass 2026' })).data.token;
  t.eq((await call('auth.me', {}, V)).data.user.needsYear, true, 'a year on record but no IYFD: asked too');
  const pv = (await call('profile.get', {}, V)).data;
  t.eq([pv.connectedSinceYear, pv.connectedSinceSettable], ['2013', true], 'offered pre-filled with the year on record, and settable');
  t.code(await call('profile.update', { connectedSince: '2015' }, V), 'VALIDATION', 'a year on record can only be confirmed, never changed');
  t.eq(rows("SELECT iyf_id FROM accounts WHERE login = '6000000088'")[0].iyf_id, 'SR26-0905', 'and the refusal issued nothing');
  const done = (await call('profile.update', { connectedSince: '2013' }, V)).data;
  t.ok(/^IYFD-2013-\d{4}$/.test(done.iyfId || ''), `confirming it issues the IYFD at once (${done.iyfId})`);
  t.eq(rows("SELECT state FROM person_identifiers WHERE fid = 'SR26-0905'")[0]?.state, 'superseded', 'the old SR number is superseded, and still resolves');
  t.eq((await call('auth.me', {}, V)).data.user.needsYear, false, 'answered: never asked again');
  t.code(await call('profile.update', { connectedSince: '2014' }, V), 'VALIDATION', 'and the IYFD now carries the year: changing it issues nothing new');
  t.eq(rows("SELECT iyf_id FROM accounts WHERE login = '6000000088'")[0].iyf_id, done.iyfId, 'still the one IYFD');
  t.eq((await call('auth.me', {}, M)).data.user.needsYear, false, 'staff are never asked');

  // the head sees who is still to answer
  const w = (await call('ids.appList', {}, M)).data.waiting || [];
  t.ok(w.some(x => x.login === '6000000087' && x.oldId === 'GP26-0905'), 'IYF IDs lists who is still waiting, with their old number');
  t.ok(!w.some(x => x.login === '6000000088'), 'and drops them the moment they answer');
}

t.done();
