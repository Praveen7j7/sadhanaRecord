// The IYF identity record (migration 0038, imported 11 Oct 2026): the master's mapping screen and the
// dashboard's hourly job. The rule that matters most (the user, 11 Oct 2026): NO year of connection, NO id —
// it is minted when they sign up, or when a course registration supplies the year.
import { boot, suite } from './harness.mjs';

const t = suite('IYF identity: mapping, minting, and the dashboard batch');
const { DB, call, rows, addAccount } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await addAccount('6000000091', 'DEVOTEE', 'Devotee pass 2026');
const D = (await call('auth.login', { login: '6000000091', password: 'Devotee pass 2026' })).data.token;

const now = '2026-10-11';
DB.sql.exec(`
  -- someone imported WITH a year: has an id, and an older dashboard id that was superseded
  INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, merged_into, import_batch, created_at, updated_at)
    VALUES ('p-has', 'HG Devesa Hari Das', 'IYFD-2020-0017', '2020', 'import', 'Active', '', 'b1', '${now}', '${now}');
  INSERT INTO person_names (person_id, name, kind, is_current, from_at, added_at) VALUES
    ('p-has', 'Debojeet Dey', 'given', 0, '', '${now}'),
    ('p-has', 'HG Devesa Hari Das', 'initiated', 1, '', '${now}');
  INSERT INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES ('6000000101', 'p-has', 1, 1, '${now}');
  INSERT INTO person_identifiers (fid, person_id, series, state, superseded_by, issued_by, issued_at) VALUES
    ('IYFD-2020-0017', 'p-has', 'IYFD', 'current', '', 'import', '${now}'),
    ('KT26-0042', 'p-has', 'KT', 'superseded', 'IYFD-2020-0017', 'dashboard', '2026-01-01');
  INSERT INTO person_history (person_id, kind, value, seq, source, recorded_at) VALUES
    ('p-has', 'facilitator', 'HG Vilasa Padmanabha Das', 0, 'import', '${now}'),
    ('p-has', 'level', 'BSS', 0, 'import', '${now}');
  -- an SPS devotee with NO year: must stay without an id (one of the 493)
  INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, merged_into, import_batch, created_at, updated_at)
    VALUES ('p-noyear', 'Alok Tiwari', '', '', '', 'Active', '', 'b1', '${now}', '${now}');
  INSERT INTO person_names (person_id, name, kind, is_current, from_at, added_at) VALUES ('p-noyear', 'Alok Tiwari', 'given', 1, '', '${now}');
  INSERT INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES ('6000000102', 'p-noyear', 1, 1, '${now}');
  INSERT INTO id_sequences (series, year, next_seq, updated_at) VALUES ('IYFD', '2026', 1, '${now}');
`);

// ---- search finds a person by ANY name, phone or id they have ever had
let r = await call('identity.search', { q: 'Debojeet' }, M);
t.eq(r.data.people.length, 1, 'a PREVIOUS name finds them — or a facilitator makes a second record by mistake');
t.eq(r.data.people[0].iyfId, 'IYFD-2020-0017', '…and it is the same person');
t.eq((await call('identity.search', { q: 'KT26-0042' }, M)).data.people[0]?.iyfId, 'IYFD-2020-0017', 'a superseded id still finds them');
t.eq((await call('identity.search', { q: '6000000101' }, M)).data.people.length, 1, 'so does the phone');
t.code(await call('identity.search', { q: 'Debojeet' }, D), 'FORBIDDEN', 'a devotee cannot search the identity records — master only');

// ---- the full record
r = await call('identity.get', { personId: 'p-has' }, M);
t.eq(r.data.names.map(n => n.name), ['HG Devesa Hari Das', 'Debojeet Dey'], 'every name, current first');
t.eq(r.data.identifiers.length, 2, 'every id they have held');
t.eq(r.data.identifiers.find(i => i.fid === 'KT26-0042').supersededBy, 'IYFD-2020-0017', 'and which one replaced which');
t.eq(r.data.facilitators, ['HG Vilasa Padmanabha Das'], 'their facilitator history');

// ---- NO YEAR, NO ID (the rule)
t.eq((await call('identity.get', { personId: 'p-noyear' }, M)).data.iyfId, '', 'an SPS devotee with no year of connection has NO id');
r = await call('identity.mint', { personId: 'p-noyear', year: '' }, M);
t.code(r, 'VALIDATION', 'and one cannot be minted without a year');
t.code(await call('identity.mint', { personId: 'p-noyear', year: '2027' }, M), 'VALIDATION', 'nor with a year that has not happened');
t.code(await call('identity.mint', { personId: 'p-has', year: '2021' }, M), 'CONFLICT', 'a person who already has an id is never renumbered');

// ---- minting once the year is known (sign-up, or a coordinator)
r = await call('identity.mint', { personId: 'p-noyear', year: '2024', reason: 'they told their facilitator' }, M);
t.code(r, 'ok', 'with a year, the id is minted');
t.ok(/^IYFD-2024-\d{4}$/.test(r.data.fid), `the year is IN the id: ${r.data.fid}`);
t.eq(rows("SELECT connected_since, connected_since_src FROM persons WHERE id = 'p-noyear'")[0],
  { connected_since: '2024', connected_since_src: 'coordinator' }, 'and the year is kept with its source');

// ---- a wrong year is fixed by SUPERSEDING, never by renumbering
const firstId = r.data.fid;
r = await call('identity.supersede', { personId: 'p-noyear', year: '2019', reason: 'the facilitator found an older record' }, M);
t.code(r, 'ok', 'a wrong year is corrected by superseding');
t.ok(/^IYFD-2019-\d{4}$/.test(r.data.fid), 'the new id carries the right year');
t.eq(rows(`SELECT state, superseded_by FROM person_identifiers WHERE fid = '${firstId}'`)[0],
  { state: 'superseded', superseded_by: r.data.fid }, 'the old id is superseded, never deleted');
t.eq((await call('identity.search', { q: firstId }, M)).data.people[0]?.iyfId, r.data.fid, '…and it still finds them for ever');

// ---- linking an account that has no phone (devesa.hari and the like)
await addAccount('devesa.hari', 'COORDINATOR', 'Coord pass 2026');
t.code(await call('identity.link', { login: 'devesa.hari', personId: 'p-has' }, M), 'ok', 'a non-phone login is linked by hand');
t.eq(rows("SELECT iyf_id FROM accounts WHERE login = 'devesa.hari'")[0].iyf_id, 'IYFD-2020-0017', 'and the account carries their id, so exports agree');

// ---- the dashboard's hourly job
r = await call('identity.mintBatch', { requestedBy: 'dashboard_cron', rows: [
  { key: 'a', phone: '6000000101', name: 'Devesa Hari', year: '2026' },     // already has one
  { key: 'b', phone: '6000000102', name: 'Alok Tiwari', year: '2026' },     // has one now too
  { key: 'c', phone: '6000000103', name: 'New Devotee', year: '2026' },     // VL-1 → VL-2: new person
  { key: 'd', phone: '6000000104', name: 'No Year Given', year: '' },       // SPS, no year
  { key: 'e', phone: 'not a phone', name: 'Bad Row', year: '2026' },        // unusable
] }, M);
t.code(r, 'ok', 'the batch answers');
t.eq(r.data.ids.a, 'IYFD-2020-0017', 'someone who already has an id gets the SAME one back — a retry never burns a number');
t.eq(r.data.ids.b, rows("SELECT iyf_id FROM persons WHERE id = 'p-noyear'")[0].iyf_id, 'a known person keeps the year we already hold, not the registration year');
t.ok(/^IYFD-2026-\d{4}$/.test(r.data.ids.c), 'a VL-1 → VL-2 registration mints from the registration year');
t.eq(r.data.ids.d, '', 'NO year of connection → NO id: it waits for sign-up');
t.eq(r.data.ids.e, '', 'and a row we cannot place comes back blank rather than failing the run');
t.eq(r.data.detail.find(x => x.key === 'd').why, 'no year of connection', 'with the reason, so the job can log it');
t.eq(rows("SELECT connected_since_src FROM persons WHERE display_name = 'New Devotee'")[0].connected_since_src,
  'inferred: course registration', 'a registration year is marked inferred, so a coordinator can correct it');

// ---- the batch is idempotent: the cron re-runs every hour
const again = await call('identity.mintBatch', { requestedBy: 'dashboard_cron', rows: [
  { key: 'c', phone: '6000000103', name: 'New Devotee', year: '2026' }] }, M);
t.eq(again.data.ids.c, r.data.ids.c, 'running the job again returns the same id, never a second one');
t.eq(rows("SELECT COUNT(*) n FROM persons WHERE display_name = 'New Devotee'")[0].n, 1, 'and does not create the person twice');

// ---- the dashboard's scoped service token (migration 0041)
// The job needs ONE action. A master's own token reaches 49, including devotees.delete, and has to sit in a
// Script Property any dashboard editor can read. These checks are the whole reason the account exists.
r = await call('identity.serviceToken', { login: 'dashboard-cron' }, M);
t.code(r, 'ok', 'a master creates the dashboard service account');
t.ok(/^[0-9a-f]{64}$/.test(r.data.token), 'and gets a token back, once');
t.eq(r.data.onlyActions, 'identity.mintBatch', 'scoped to the one action the job calls');
const CRON = r.data.token;

t.code(await call('identity.mintBatch', { requestedBy: 'dashboard_cron', rows: [
  { key: 'x', phone: '6000000109', name: 'Cron Minted', year: '2023' }] }, CRON), 'ok', 'the cron token CAN mint ids — the job works');
t.eq(rows("SELECT connected_since FROM persons WHERE display_name = 'Cron Minted'")[0].connected_since, '2023', 'and the mint really happened');

// everything else is refused, though the account's role is MASTER
t.code(await call('identity.search', { q: 'Debojeet' }, CRON), 'FORBIDDEN', 'but it cannot search the identity records');
t.code(await call('devotees.delete', { login: '6000000091' }, CRON), 'FORBIDDEN', 'nor delete a devotee');
t.code(await call('coordinators.create', { username: 'sneaky', name: 'Sneaky', tempPassword: 'Sneaky pass 2026' }, CRON), 'FORBIDDEN', 'nor create a coordinator');
t.code(await call('identity.serviceToken', { login: 'another-cron' }, CRON), 'FORBIDDEN', 'nor mint itself a second token');

// a person's master token is unaffected by the new column
t.code(await call('identity.search', { q: 'Debojeet' }, M), 'ok', 'an ordinary master keeps full access');

// re-running rolls the key: the old token stops working, so a leak is cut off by pasting a new value
const again2 = await call('identity.serviceToken', { login: 'dashboard-cron', reason: 'rolling the key' }, M);
t.code(again2, 'ok', 'running it again rolls the key');
t.ok(again2.data.rekeyed, 'and says it re-keyed rather than created');
t.ok(again2.data.token !== CRON, 'the token is a new one');
t.code(await call('identity.mintBatch', { requestedBy: 'dashboard_cron', rows: [] }, CRON), 'UNAUTHENTICATED', 'the OLD token is dead');
t.code(await call('identity.mintBatch', { requestedBy: 'dashboard_cron', rows: [] }, again2.data.token), 'ok', 'the new one works');

// the service login cannot be used to sign in to the app at all
t.code(await call('auth.login', { login: 'dashboard-cron', password: 'no-login' }), 'BAD_CREDENTIALS', 'and nobody can sign in as it');

// a master must not be able to turn a PERSON's login into a service account by reusing the name
t.code(await call('identity.serviceToken', { login: 'master' }, M), 'CONFLICT', "a person's login is never re-keyed by mistake");

// ---- the profile feeds the identity record (the user, 11 Oct 2026)
// A facilitator gives their number on their own profile screen. That must reach their person record, or their
// identity stays empty while they appear as a facilitator on other people's rows.
await addAccount('6000000155', 'DEVOTEE', 'Fac pass 2026');
const F = (await call('auth.login', { login: '6000000155', password: 'Fac pass 2026' })).data.token;
DB.sql.exec(`
  INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, merged_into, import_batch, created_at, updated_at)
    VALUES ('p-fac', 'Vilasa Padmanabha', 'IYFD-2017-0003', '2017', 'import', 'Active', '', 'b1', '${now}', '${now}');
  INSERT INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES ('6000000155', 'p-fac', 1, 1, '${now}');
  UPDATE accounts SET iyf_id = 'IYFD-2017-0003' WHERE login = '6000000155';
`);
t.eq(rows("SELECT COUNT(*) n FROM person_phones WHERE person_id = 'p-fac'")[0].n, 1, 'before: one phone on file');

const upd = await call('profile.update', { whatsapp: '6000000166' }, F);
t.code(upd, 'ok', 'the profile saves');
t.eq(rows("SELECT COUNT(*) n FROM person_phones WHERE person_id = 'p-fac' AND phone = '6000000166'")[0].n, 1,
  'a WhatsApp number given on the profile reaches their person record');
t.eq(rows("SELECT COUNT(*) n FROM person_links WHERE person_id = 'p-fac' AND account_ref = '6000000155'")[0].n, 1,
  'and the account is linked to the person, so exports agree');
// the email reaches the record too, and an unchanged one is not written twice
await call('profile.update', { email: 'devesa.hari@example.org' }, F);
t.eq(rows("SELECT value FROM person_history WHERE person_id = 'p-fac' AND kind = 'email'").map(r => r.value),
  ['devesa.hari@example.org'], 'the email given on the profile reaches their record');
await call('profile.update', { whatsapp: '6000000166' }, F);
t.eq(rows("SELECT COUNT(*) n FROM person_history WHERE person_id = 'p-fac' AND kind = 'email'")[0].n, 1,
  'and saving again does not write it twice');

// it must not create a SECOND person for someone already held
t.eq(rows("SELECT COUNT(*) n FROM persons WHERE display_name = 'Vilasa Padmanabha'")[0].n, 1,
  'and never makes a second record for someone we already hold');

/*
 * The IYF IDs screen must not disagree with the Devotees screen (the head, 16 Oct 2026).
 *
 * The screen searches the REGISTRY, which is the dashboard's view: it holds the batch number a person
 * was given and nothing of the identity record. So someone who has since been given a real IYFD- id
 * was still shown under their old number, with no sign the newer one existed — Amrit reading
 * GP26-0001 while his record said IYFD-2016-0003.
 */
{
  DB.sql.exec(`
    INSERT INTO registry (iyf_id, name, level, facilitator, phone, aliases, merged_into)
      VALUES ('KT26-0042', 'Debojeet Dey', 'BSS', 'HG Vilasa Padmanabha Das', '6000000101', '[]', '');
    INSERT INTO registry (iyf_id, name, level, facilitator, phone, aliases, merged_into)
      VALUES ('KT26-0099', 'Nobody Here', 'SPS', '', '6000000199', '[]', '');
  `);

  const d = (await call('ids.get', { iyfId: 'KT26-0042' }, M)).data;
  t.eq(d.person?.iyfId, 'IYFD-2020-0017', 'an old batch number answers with the current IYF ID');
  t.eq(d.person?.matchedBy, 'id', 'and says it found them by the id itself, not by guessing');
  t.ok(d.person?.names.some(n => n.name === 'HG Devesa Hari Das'), 'the initiated name comes with it');
  t.ok(d.person?.names.some(n => n.name === 'Debojeet Dey'), 'and the name they were known by before');
  t.ok(d.person?.identifiers.some(i => i.fid === 'KT26-0042'), 'the old id is still held, not dropped');

  // the registry's own fields must survive: the batch and facilitator live nowhere else
  t.eq(d.name, 'Debojeet Dey', 'the registry row is still returned beside the person');
  t.eq(d.facilitator, 'HG Vilasa Padmanabha Das', 'including the facilitator, which the person record has no column for');

  // most of the registry has no person at all (236 of 250 GP26- rows on 16 Oct 2026): those read as before
  const none = (await call('ids.get', { iyfId: 'KT26-0099' }, M)).data;
  t.eq(none.person, null, 'a registry row with no person record answers with none, rather than inventing one');
  t.eq(none.name, 'Nobody Here', 'and still returns everything the screen showed before');
}

/* ── only an IYF id identifies somebody in the app (the head, 17 Oct 2026) ── */
//
// "Once the student is in the app, only the IYF unique id is used to identify him — not G type ids
// or K or J type", and that holds EVERYWHERE: the board, a contact card, a facilitator's students,
// the exports. They all print accounts.iyf_id, so the rule belongs there rather than on each
// screen.
//
// Nothing is lost. The legacy number stays in person_identifiers and still finds the person — old
// ids resolve for ever. RESOLVING an id and PRINTING it are different things.
{
  const { currentIdFor } = await import('../src/admin.js');

  // p-has holds IYFD-2020-0017 with KT26-0042 attached (seeded at the top of this file)
  t.eq(await currentIdFor(DB, 'KT26-0042'), 'IYFD-2020-0017',
    'a legacy id resolves to the current one, which is what gets printed');
  t.eq(await currentIdFor(DB, 'kt26-0042'), 'IYFD-2020-0017', 'whatever its case');
  t.eq(await currentIdFor(DB, 'IYFD-2020-0017'), 'IYFD-2020-0017', 'a current id is already current');

  // the honest limit: no current id means the old one stays rather than being invented
  t.eq(await currentIdFor(DB, 'GP26-9999'), 'GP26-9999',
    'a legacy id with nothing behind it is left alone — inventing one would be worse than showing it');
  t.eq(await currentIdFor(DB, ''), '', 'and no id is still no id');

  // Linking by the OLD number labels them with the new one. A fresh legacy id and person, because
  // KT26-0042 is already linked to somebody here and ids.link rightly refuses a second account.
  DB.sql.exec(`INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, merged_into, import_batch, created_at, updated_at)
    VALUES ('p-old', 'Old Number Prabhu', 'IYFD-2019-0055', '2019', 'import', 'Active', '', 'b1', '${now}', '${now}')`);
  DB.sql.exec(`INSERT INTO person_identifiers (fid, person_id, series, state, superseded_by, issued_by, issued_at) VALUES
    ('IYFD-2019-0055', 'p-old', 'IYFD', 'current', '', 'import', '${now}'),
    ('GP26-0501', 'p-old', 'GP', 'superseded', 'IYFD-2019-0055', 'dashboard', '2026-01-01')`);
  DB.sql.exec(`INSERT INTO registry (iyf_id, name, level, facilitator, phone, aliases, merged_into)
    VALUES ('GP26-0501', 'Old Number Prabhu', 'SPS', '', '6000000091', '[]', '')`);
  const lk = await call('ids.link', { login: '6000000091', iyfId: 'GP26-0501', reason: 'Linking by his old number' }, M);
  t.code(lk, 'ok', 'the head links him by the number the dashboard knows');
  t.eq(rows("SELECT iyf_id AS i FROM accounts WHERE login = '6000000091'")[0].i, 'IYFD-2019-0055',
    'and the account is labelled with the CURRENT id, not the legacy one that was typed');

  // and the old number still finds them
  const found = (await call('identity.search', { q: 'KT26-0042' }, M)).data.people;
  t.ok(found.some(p => p.iyfId === 'IYFD-2020-0017'),
    'while a search for the old number still finds the person: it resolves, it just is not shown');
}

t.done();
