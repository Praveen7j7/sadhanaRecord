// Audit phase 3.9 (13 Oct 2026): folding one person record into another.
//
// Nothing could undo a duplicate before this. Two records for one human — a re-registration under a second phone,
// a sibling signed up on the family number, an import that did not match — stayed two for ever, and
// `persons.merged_into`, `person_identifiers.state = 'superseded'` and `superseded_by` were columns no code ever
// wrote. The promise in migration 0038 is that an old IYF ID resolves for ever; these assertions are what make
// that true across a merge.
import { boot, suite } from './harness.mjs';
import { identityMerge } from '../src/identity.js';
import { scopesOf, account } from '../src/db.js';

const t = suite('phase 3: merging two person records');
const { env, DB, call, clock, addAccount, rows } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;

const now = '2026-10-05T10:00:00+05:30';
// include every column named in `given` (even `id`, which persons needs: the mirror trigger reads NEW.id)
const put = (tb, given) => {
  const cols = DB.sql.prepare(`PRAGMA table_info(${tb})`).all().filter(c => (c.name in given) || (c.name !== 'id' && c.notnull && c.dflt_value === null));
  DB.sql.prepare(`INSERT INTO ${tb} (${cols.map(c => '"' + c.name + '"').join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...cols.map(c => (c.name in given ? given[c.name] : (/INT|REAL|NUM/i.test(c.type) ? 0 : ''))));
};

// Two records for one person: KEEP has the newer ID, LOSE is the duplicate with an older ID, its own phone,
// its own past name and a linked sadhana account.
put('persons', { id: 'P-KEEP', display_name: 'Radha Devi', iyf_id: 'IYFD-2026-0010', status: 'Active', created_at: now });
put('persons', { id: 'P-LOSE', display_name: 'Radha D', iyf_id: 'IYFD-2019-0044', status: 'Active', created_at: now });
put('person_identifiers', { fid: 'IYFD-2026-0010', person_id: 'P-KEEP', series: 'IYFD', state: 'current', issued_at: now });
put('person_identifiers', { fid: 'IYFD-2019-0044', person_id: 'P-LOSE', series: 'IYFD', state: 'current', issued_at: now });
put('person_phones', { phone: '6000000171', person_id: 'P-KEEP', is_primary: 1, active: 1, added_at: now });
put('person_phones', { phone: '6000000172', person_id: 'P-LOSE', is_primary: 1, active: 1, added_at: now });
put('person_names', { person_id: 'P-LOSE', name: 'Radha D', kind: 'given', is_current: 1, from_at: '', added_at: now });
put('person_history', { person_id: 'P-LOSE', kind: 'phone', value: '6000000172', at: now, source: 'import' });
DB.sql.exec("INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations, must_change_pw, iyf_id) VALUES ('6000000172','DEVOTEE','ACTIVE','Radha D','h','s',1000,0,'IYFD-2019-0044')");
put('person_links', { service: 'sadhana', account_ref: '6000000172', person_id: 'P-LOSE', linked_at: now });

const acct = await account(DB, 'master');
const ctx = { db: DB, env, now: () => new Date(clock.now), login: 'master', role: 'MASTER', acct, scopes: await scopesOf(DB, acct), waitUntil: () => {} };
const req = { requestId: 'merge-test-0001' };

// ---- refusals first ----
let e = '';
try { await identityMerge({ keep: 'P-KEEP', lose: 'P-KEEP', reason: 'same' }, ctx, req); } catch (x) { e = x.code; }
t.eq(e, 'CONFLICT', 'a record cannot be merged into itself');
e = '';
try { await identityMerge({ keep: 'P-KEEP', lose: 'P-NONE', reason: 'missing' }, ctx, req); } catch (x) { e = x.code; }
t.eq(e, 'NOT_FOUND', 'an unknown record is refused');
e = '';
try { await identityMerge({ keep: 'P-KEEP', lose: 'P-LOSE', reason: 'x' }, ctx, req); } catch (x) { e = x.code; }
t.eq(e, 'VALIDATION', 'a merge needs a real reason, not one character');

// ---- the merge ----
const out = await identityMerge({ keep: 'P-KEEP', lose: 'P-LOSE', reason: 'same person, re-registered on a new phone' }, ctx, req);
t.eq(out.moved, { identifiers: 1, phones: 1, accounts: 1 }, 'it reports what moved');

const person = (id) => rows('SELECT * FROM persons WHERE id = ?', id)[0];
t.eq(person('P-LOSE').merged_into, 'P-KEEP', 'the duplicate points at the record that was kept');
t.eq(person('P-LOSE').status, 'Inactive', '… and is no longer active');
t.ok(!!person('P-LOSE'), '… but is NOT deleted, so an old reference still resolves');
t.eq(person('P-KEEP').merged_into, '', 'the kept record is untouched');
t.eq(person('P-KEEP').display_name, 'Radha Devi', '… and keeps its name');

// the old IYF ID must still resolve — this is the promise of migration 0038
const oldId = rows("SELECT person_id, state, superseded_by FROM person_identifiers WHERE fid = 'IYFD-2019-0044'")[0];
t.eq(oldId.person_id, 'P-KEEP', 'the old IYF ID now belongs to the kept person');
t.eq(oldId.state, 'superseded', '… marked superseded, not deleted');
t.eq(oldId.superseded_by, 'IYFD-2026-0010', '… and says which ID replaced it');
t.eq(rows("SELECT state FROM person_identifiers WHERE fid = 'IYFD-2026-0010'")[0].state, 'current', 'the kept ID is still the current one');

// phones, names, history and the account link
t.eq(rows("SELECT person_id, is_primary FROM person_phones WHERE phone = '6000000172'")[0], { person_id: 'P-KEEP', is_primary: 0 }, "the duplicate's phone moved, and is not primary");
t.eq(rows("SELECT person_id, is_primary FROM person_phones WHERE phone = '6000000171'")[0].is_primary, 1, "the kept record's own phone stays primary");
t.eq(rows("SELECT COUNT(*) AS n FROM person_names WHERE person_id = 'P-KEEP' AND is_current = 1")[0].n, 0, "the duplicate's name is a past name, never a second current one");
t.eq(rows("SELECT COUNT(*) AS n FROM person_names WHERE person_id = 'P-LOSE'")[0].n, 0, '… and no name is left behind');
t.eq(rows("SELECT person_id FROM person_history WHERE value = '6000000172'")[0].person_id, 'P-KEEP', 'the history moved');
t.eq(rows("SELECT person_id FROM person_links WHERE account_ref = '6000000172'")[0].person_id, 'P-KEEP', 'the sadhana account is linked to the kept person');
t.eq(rows("SELECT iyf_id FROM accounts WHERE login = '6000000172'")[0].iyf_id, 'IYFD-2026-0010', "the account carries the kept person's IYF ID");

// audited, with the reason and the detail of what moved
const log = rows("SELECT * FROM audit_log WHERE action = 'identity.merge'")[0];
t.ok(!!log, 'the merge is in the audit log');
t.eq(log.reason, 'same person, re-registered on a new phone', '… with the reason the head gave');
t.eq(log.batch_id, '', '… and no stray value in batch_id (audit F6: these calls used to shift their arguments)');
t.eq(JSON.parse(log.before).iyfId, 'IYFD-2019-0044', '… recording which record was folded away');
t.eq(JSON.parse(log.after).mergedInto, 'P-KEEP', '… and into which');

// ---- merging again, or into a merged-away record, is refused ----
e = '';
try { await identityMerge({ keep: 'P-KEEP', lose: 'P-LOSE', reason: 'again, by mistake' }, ctx, req); } catch (x) { e = x.code; }
t.eq(e, 'CONFLICT', 'the same merge cannot be done twice');
put('persons', { id: 'P-THIRD', display_name: 'Someone Else', iyf_id: '', status: 'Active', created_at: now });
e = '';
try { await identityMerge({ keep: 'P-LOSE', lose: 'P-THIRD', reason: 'into a merged-away record' }, ctx, req); } catch (x) { e = x.code; }
t.eq(e, 'CONFLICT', 'nothing may be merged INTO a record that was itself merged away');

// ---- only the head ----
t.code(await call('identity.merge', { keep: 'P-KEEP', lose: 'P-THIRD', reason: 'a coordinator trying' }), 'UNAUTHENTICATED', 'signed out: refused');
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
t.code(await call('identity.merge', { keep: 'P-KEEP', lose: 'P-THIRD', reason: 'a coordinator trying' }, C), 'FORBIDDEN', 'a coordinator cannot merge person records');
t.code(await call('identity.merge', { keep: 'P-KEEP', lose: 'P-THIRD', reason: 'the head doing it properly' }, M), 'ok', 'the IYF head can');

t.done();
