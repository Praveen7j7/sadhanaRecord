// Sign-up step 1 (the user, 11 Oct 2026): ask for the phone first, look it up, and open the form with
// what we already know about that devotee — they should not retype six years of history. The records come
// from the two Facilitation Journals (8,800 rows → 1,345 people, migration 0038).
// The lookup is public, so it must also give nothing away to someone probing numbers.
import { boot, suite } from './harness.mjs';

const t = suite('sign-up: look the phone up first');
const { DB, call, rows } = boot();

// a devotee imported from the journals: two names, a facilitator history, an ID already minted
DB.sql.exec(`
  INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, merged_into, import_batch, created_at, updated_at)
    VALUES ('p-imported', 'HG Devesa Hari Das', 'IYFD-2020-0017', '2020', 'import', 'Active', '', 'b1', '2026-10-11', '2026-10-11');
  INSERT INTO person_names (person_id, name, kind, is_current, from_at, added_at) VALUES
    ('p-imported', 'Debojeet Dey', 'given', 0, '', '2026-10-11'),
    ('p-imported', 'HG Devesa Hari Das', 'initiated', 1, '', '2026-10-11');
  INSERT INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES ('6000000101', 'p-imported', 1, 1, '2026-10-11');
  INSERT INTO person_history (person_id, kind, value, seq, source, recorded_at) VALUES
    ('p-imported', 'facilitator', 'HG Rohit Garg Das', 0, 'import', '2026-10-11'),
    ('p-imported', 'facilitator', 'HG Vilasa Padmanabha Das', 1, 'import', '2026-10-11'),
    ('p-imported', 'level', 'VL-2', 0, 'import', '2026-10-11'),
    ('p-imported', 'level', 'SPS - 2', 1, 'import', '2026-10-11');
  -- someone imported who has no ID yet: the year was never recorded (507 of the 1,345)
  INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, merged_into, import_batch, created_at, updated_at)
    VALUES ('p-noyear', 'Alok Tiwari', '', '', '', 'Inactive', '', 'b1', '2026-10-11', '2026-10-11');
  INSERT INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES ('6000000102', 'p-noyear', 1, 1, '2026-10-11');
  -- a record merged away: it must not answer for anyone
  INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, merged_into, import_batch, created_at, updated_at)
    VALUES ('p-merged', 'Duplicate Record', '', '2019', 'import', 'Inactive', 'p-imported', 'b1', '2026-10-11', '2026-10-11');
  INSERT INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES ('6000000103', 'p-merged', 1, 1, '2026-10-11');
  -- an old number they stopped using: kept, but inactive
  INSERT INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES ('6000000104', 'p-imported', 0, 0, '2026-10-11');
`);

// ---- a devotee we already hold: recognised, but nothing about them is shown
let r = await call('auth.lookup', { phone: '6000000101' });
t.code(r, 'ok', 'a number we hold is found');
t.eq(r.data.found, true, 'found');
t.eq(r.data.hasAccount, false, 'they have no account yet');
t.eq(r.data.maskedName, 'H• D•••• H••• D••', 'only a MASKED name: the real person knows themselves, a stranger learns nothing');
t.eq(r.data.connectedSinceLocked, true, 'the year is locked: it is in their IYF ID, so only a coordinator may change it');
t.eq(r.data.name, undefined, 'the real name is never returned');
t.eq(r.data.facilitator, undefined, 'nor the facilitator');
t.eq(r.data.level, undefined, 'nor the level');
t.eq(r.data.profession, undefined, 'nor profession, education or area');

// ---- the 507 with no year
r = await call('auth.lookup', { phone: '6000000102' });
t.eq([r.data.found, r.data.maskedName], [true, 'A••• T••••'], 'someone with no year is recognised too');
t.eq(r.data.connectedSinceLocked, false, 'and they give the year, which mints their ID — they do NOT start from scratch');

// ---- what must NOT happen
t.eq((await call('auth.lookup', { phone: '6000000103' })).data.found, false, 'a merged-away record never answers');
t.eq((await call('auth.lookup', { phone: '6000000104' })).data.found, false, 'an old number they stopped using does not answer');
t.eq((await call('auth.lookup', { phone: '6000000089' })).data, { found: false, hasAccount: false }, 'an unknown number returns the same shape and nothing else');
t.code(await call('auth.lookup', { phone: '12345' }), 'VALIDATION', 'a number that is not 10 digits is refused');

// ---- someone who already has an account goes to sign-in, never to a second account
DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations)
             VALUES ('6000000105', 'DEVOTEE', 'ACTIVE', 'Has Account', '6000000105', 'x', 'y', 10000);
             INSERT INTO persons (id, display_name, iyf_id, connected_since, connected_since_src, status, merged_into, import_batch, created_at, updated_at)
               VALUES ('p-acct', 'Has Account', '', '2021', 'import', 'Active', '', 'b1', '2026-10-11', '2026-10-11');
             INSERT INTO person_phones (phone, person_id, is_primary, active, added_at) VALUES ('6000000105', 'p-acct', 1, 1, '2026-10-11');`);
r = await call('auth.lookup', { phone: '6000000105' });
t.eq([r.data.found, r.data.hasAccount], [false, true], 'an existing account is sent to sign-in and nothing about them is returned');

// ---- the whole response, so nothing can be added to it by accident
r = await call('auth.lookup', { phone: '6000000101' });
t.eq(Object.keys(r.data).sort(), ['connectedSinceLocked', 'found', 'hasAccount', 'maskedName'],
  'the response is exactly four fields: recognition only, never the record');

t.done();
