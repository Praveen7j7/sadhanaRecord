// Migration 0074 on a database shaped like live (Phase 24, 27 Oct 2026): the tables as 0001–0073 left them, with the
// traces the old name-keyed design left behind — an earlier rename (audit line + the old name kept as a removed row),
// closed memberships under the old spelling, a name referenced by nobody's list, posts and push jobs to 'STU:<name>'.
// 0074 must give every facilitator an id, every reference that id, and resolve the old spellings to the renamed one.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { suite } from './harness.mjs';

const t = suite('names: migration 0074 on live-shaped data');
const dir = new URL('../migrations/', import.meta.url);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const sql = new DatabaseSync(':memory:');
for (const f of files.filter(f => f < '0074')) sql.exec(fs.readFileSync(new URL(f, dir), 'utf8'));
const rows = (q, ...a) => sql.prepare(q).all(...a);

// ---- the state before 0074 ----
// the head renamed "Devesa Hari Prabhuji" → "HG Devesa Hari Das" on 27 Oct (the old code: row renamed, old name left as a removed row)
sql.exec(`UPDATE facilitators SET "name" = 'HG Devesa Hari Das', source = 'APP' WHERE "name" = 'Devesa Hari Prabhuji'`);
sql.exec(`INSERT INTO facilitators ("name", "in_cohort", "order", active, source, seen, deleted_at, changed_by, changed_at)
          VALUES ('Devesa Hari Prabhuji', 0, 99, 0, 'DASHBOARD', 1, '2026-10-27T09:00:00+05:30', 'master', '2026-10-27T09:00:00+05:30')`);
sql.exec(`INSERT INTO audit_log (at, who, role, action, target, batch_id, before, after, reason, request_id)
          VALUES ('2026-10-27T09:00:00+05:30', 'master', 'MASTER', 'facilitators.rename', 'HG Devesa Hari Das', '', '{"name":"Devesa Hari Prabhuji"}', '{"name":"HG Devesa Hari Das"}', '', 'r1')`);
const acct = (login, role, name, extra = {}) => sql.prepare(`INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations, facilitator_name, requested_facilitator)
  VALUES (?, ?, ?, ?, 'x', 'y', 1, ?, ?)`).run(login, role, extra.status || 'ACTIVE', name, extra.fac || '', extra.req || '');
acct('devesa', 'COORDINATOR', 'HG Devesa Hari Das', { fac: 'HG Devesa Hari Das' });               // his own login, renamed with him
acct('6000000181', 'DEVOTEE', 'Ravi Kumar');
acct('6000000182', 'DEVOTEE', 'Sita Ram');
acct('6000000183', 'DEVOTEE', 'Mohan Lal', { fac: 'Mohan Lal' });                                    // an ETP trainee under his own name
acct('6000000184', 'DEVOTEE', 'Waiting One', { status: 'PENDING', req: 'Natvar Gopinath Prabhuji' });
sql.exec(`INSERT INTO facilitators ("name", "in_cohort", "order", active, source) VALUES ('Mohan Lal', 1, 100, 1, 'APP')`);
const mem = (login, fac, from, to = '') => sql.prepare(`INSERT INTO memberships (login, batch_id, state, from_week, to_week, facilitator) VALUES (?, 'SPS', 'ACTIVE', ?, ?, ?)`).run(login, from, to, fac);
mem('6000000181', 'Devesa Hari Prabhuji', '2026-09-07', '2026-10-19');    // closed, under the OLD spelling
mem('6000000181', 'HG Devesa Hari Das', '2026-10-26');                     // open, renamed by the old cascade
mem('6000000182', 'Gone Dashboard Name', '2026-09-07');                    // a name the nightly NameMap read deleted
sql.exec(`INSERT INTO announcements (title, body, audience, author_login, author_name, created_at, updated_at)
          VALUES ('Old post', 'x', 'STU:Devesa Hari Prabhuji', 'devesa', 'Devesa Hari Prabhuji', '2026-10-20', '2026-10-20'),
                 ('New post', 'y', 'STU:HG Devesa Hari Das', 'devesa', 'HG Devesa Hari Das', '2026-10-27', '2026-10-27'),
                 ('Batch post', 'z', 'SPS,DPS', 'master', 'Head', '2026-10-27', '2026-10-27')`);
sql.exec(`INSERT INTO push_jobs (ann_id, audience, title, created_at) VALUES (1, 'STU:Devesa Hari Prabhuji', 'Old post', '2026-10-20')`);
const before = rows('SELECT COUNT(*) AS n FROM facilitators')[0].n;

// ---- 0074 ----
for (const f of files.filter(f => f >= '0074')) sql.exec(fs.readFileSync(new URL(f, dir), 'utf8'));

const id = (name) => rows('SELECT id FROM facilitators WHERE "name" = ?', name)[0]?.id;
const DEV = id('HG Devesa Hari Das');
t.ok(/^F\d{3}$/.test(DEV), `every facilitator has a permanent id (HG Devesa Hari Das = ${DEV})`);
t.eq(rows("SELECT COUNT(*) AS n FROM facilitators WHERE id IS NULL")[0].n, 0, 'none is left without one, removed rows included');
t.eq(rows('SELECT COUNT(DISTINCT id) AS n, COUNT(*) AS m FROM facilitators').map(r => r.n === r.m)[0], true, 'and no two share one');
t.eq(id('Abhaya Vishnu Prabhuji'), 'F001', 'numbered in the order the rows were created');
t.eq(rows("SELECT fac_id FROM facilitator_names WHERE \"name\" = 'Devesa Hari Prabhuji'")[0]?.fac_id, DEV,
  'the spelling an earlier rename replaced resolves to the RENAMED facilitator, not to the removed copy the old code left');
t.ok(rows("SELECT to_at FROM facilitator_names WHERE \"name\" = 'Devesa Hari Prabhuji'")[0]?.to_at !== '', 'as an earlier spelling, with when it was replaced');
t.eq(rows("SELECT fac_id, to_at FROM facilitator_names WHERE \"name\" = 'HG Devesa Hari Das'")[0], { fac_id: DEV, to_at: '' }, 'and the new one is current');
t.eq(rows("SELECT fac_id FROM memberships WHERE login = '6000000181' ORDER BY id").map(r => r.fac_id), [DEV, DEV],
  'his student points to him by id in the closed membership (old spelling) AND the open one');
const gone = id('Gone Dashboard Name');
t.ok(!!gone && rows("SELECT deleted_at FROM facilitators WHERE id = ?", gone)[0].deleted_at !== '', 'a referenced name no longer on the list gets a removed row of its own');
t.eq(rows("SELECT fac_id FROM memberships WHERE login = '6000000182'")[0].fac_id, gone, 'so that reference has an id too');
t.eq(rows('SELECT COUNT(*) AS n FROM facilitators')[0].n, before + 1, 'and that is the only row added');
t.eq(rows("SELECT fac_id FROM accounts WHERE login = 'devesa'")[0].fac_id, DEV, 'the login that IS the facilitator carries his id');
t.eq(rows("SELECT login FROM facilitators WHERE id = ?", DEV)[0].login, 'devesa', 'and the facilitator is linked to it (same name): renaming one renames both');
t.eq(rows("SELECT login FROM facilitators WHERE \"name\" = 'Mohan Lal'")[0].login, '6000000183', 'an ETP trainee under his own name is linked too');
t.eq(rows("SELECT requested_fac_id FROM accounts WHERE login = '6000000184'")[0].requested_fac_id, id('Natvar Gopinath Prabhuji'), 'a waiting sign-up points to the facilitator it chose');
t.eq(rows('SELECT audience FROM announcements ORDER BY id').map(r => r.audience), ['STU:' + DEV, 'STU:' + DEV, 'SPS,DPS'],
  'posts to "my students" are addressed by id, under either spelling; other audiences are untouched');
t.eq(rows('SELECT audience FROM push_jobs')[0].audience, 'STU:' + DEV, 'and so are their notification jobs');
t.eq(rows("SELECT facilitator FROM memberships WHERE login = '6000000181' ORDER BY id").map(r => r.facilitator), ['Devesa Hari Prabhuji', 'HG Devesa Hari Das'],
  'the name columns are kept as they were: nothing dropped, nothing rewritten (history keeps the name of its day)');
t.eq(rows("SELECT value FROM settings WHERE key = 'names_version'")[0]?.value, '1', 'the phones’ list version starts at 1');

// ---- after: a writer that sets only the name (an older release, a hand-made row) still gets the id ----
sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, facilitator) VALUES ('6000000182', 'DPS', 'ACTIVE', '2026-11-02', 'HG Devesa Hari Das')`);
t.eq(rows("SELECT fac_id FROM memberships WHERE login = '6000000182' AND batch_id = 'DPS'")[0].fac_id, DEV, 'a membership written by name only gets the id from the database');
sql.exec(`INSERT INTO facilitators ("name", "in_cohort", "order") VALUES ('Brand New Das', 0, 101)`);
const NEWID = id('Brand New Das');
t.ok(/^F\d{3}$/.test(NEWID) && NEWID > rows("SELECT MAX(id) AS m FROM facilitators WHERE id <> ?", NEWID)[0].m, `a new facilitator takes the next id (${NEWID}), never a used one`);
t.ok(Number(rows("SELECT value FROM settings WHERE key = 'names_version'")[0].value) > 1, 'and the list version moves, so phones fetch the new wheel');

// ---- real relations (ADR 0021): the database itself refuses a reference to nothing ----
t.eq(rows('PRAGMA foreign_keys')[0].foreign_keys, 1, 'foreign keys are enforced here, as on D1');
t.eq(rows('PRAGMA foreign_key_check'), [], 'after the backfill, no row points to a missing facilitator or login');
const refused = (sqlText) => { try { sql.exec(sqlText); return 'written'; } catch (e) { return /FOREIGN KEY/i.test(e.message) ? 'refused' : e.message; } };
t.eq(refused("UPDATE memberships SET fac_id = 'F999' WHERE login = '6000000181'"), 'refused', 'a membership cannot point to a facilitator id that does not exist');
t.eq(refused("INSERT INTO memberships (login, batch_id, state, from_week, fac_id) VALUES ('6000000181', 'SPS', 'ACTIVE', '2026-11-09', 'F999')"), 'refused', 'nor can a new one');
t.eq(refused("UPDATE accounts SET fac_id = 'F999' WHERE login = 'devesa'"), 'refused', 'nor an account (the facilitator it is)');
t.eq(refused("UPDATE accounts SET requested_fac_id = 'F999' WHERE login = '6000000184'"), 'refused', 'nor a waiting sign-up’s choice');
t.eq(refused("INSERT INTO facilitator_names (fac_id, \"name\") VALUES ('F999', 'Nobody At All')"), 'refused', 'nor a spelling of nobody');
t.eq(refused("UPDATE facilitators SET login = 'no-such-login' WHERE id = '" + DEV + "'"), 'refused', 'and a facilitator’s login must be a real account');
t.eq(refused("INSERT INTO facilitator_names (fac_id, \"name\") VALUES ('" + NEWID + "', 'HG Devesa Hari Das')"), 'UNIQUE constraint failed: facilitator_names.name', 'one spelling, one facilitator');
t.eq(refused("UPDATE memberships SET fac_id = NULL WHERE login = '6000000182' AND batch_id = 'SPS'"), 'written', '"no facilitator" is NULL, which is allowed');
// an erased account stops being the facilitator's login (ON DELETE SET NULL); nothing is cascaded away
sql.exec("UPDATE accounts SET fac_id = NULL, facilitator_name = '' WHERE login = 'devesa'");
sql.exec("UPDATE facilitators SET login = 'devesa' WHERE id = '" + DEV + "'");
sql.exec("DELETE FROM accounts WHERE login = 'devesa'");
t.eq(rows('SELECT login FROM facilitators WHERE id = ?', DEV)[0].login, null, 'an erased account leaves the facilitator with no login (SET NULL), the facilitator stays');
t.done();
