// Audit phase 2.8 (13 Oct 2026): migrations must work on a database that already holds data, not only on an
// empty one.
//
// Every other suite applies all 40-odd files to an empty in-memory database, so a migration that is fine on a
// fresh schema but breaks on existing rows (a NOT NULL column with no default, a UNIQUE index over data that
// already has duplicates, a data transform that assumes a shape) would pass every test and fail on the live
// database — where it would be noticed by the app going down. This suite applies the files in two halves with
// realistic rows written in between.
import { suite } from './harness.mjs';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const t = suite('phase 2: migrations apply to a database that already holds data');

const DIR = new URL('../migrations/', import.meta.url);
const files = fs.readdirSync(DIR).sort();
t.ok(files.length > 40, `${files.length} migration files found`);
t.ok(!files.includes('0040_hobbies.sql'), '0040 is absent and stays absent (it was deleted before release)');

const apply = (db, list) => { for (const f of list) db.exec(fs.readFileSync(new URL(f, DIR), 'utf8')); };

// Rows written at the mid-point, in the shape the schema has THERE (only columns that exist by then).
const seed = (db) => {
  const has = (tbl, col) => db.prepare(`SELECT COUNT(*) AS n FROM pragma_table_info(?) WHERE name = ?`).get(tbl, col).n > 0;
  const cols = (tbl, given) => {
    const info = db.prepare(`SELECT name, type, "notnull", dflt_value FROM pragma_table_info(?)`).all(tbl);
    const use = info.filter(c => c.name !== 'id' && (c.name in given || (c.notnull && c.dflt_value === null)));
    db.prepare(`INSERT INTO ${tbl} (${use.map(c => '"' + c.name + '"').join(', ')}) VALUES (${use.map(() => '?').join(', ')})`)
      .run(...use.map(c => (c.name in given ? given[c.name] : (/INT|REAL|NUM/i.test(c.type) ? 0 : ''))));
  };
  for (let i = 0; i < 5; i++) {
    const login = String(6000000700 + i);
    cols('accounts', { login, role: 'DEVOTEE', status: 'ACTIVE', name: 'Devotee ' + i, pw_hash: 'h', pw_salt: 's', pw_iterations: 1000, requested_batch: 'SPS' });
    cols('memberships', { login, batch_id: 'SPS', from_week: '2026-09-07', to_week: '', state: 'ACTIVE' });
    cols('submissions', { submission_id: login + '-w', login, week_id: '2026-09-21', batch_id: 'SPS', name: 'Devotee ' + i,
      submitted_at: '2026-09-22T10:00:00+05:30', submitted_by: login, rules_version: 'r1' });
    if (has('drafts', 'd1')) cols('drafts', { login, week_id: '2026-09-28', batch_id: 'SPS', d1: '{"v":1}', created_at: 'x', updated_at: 'x', updated_by: login });
    cols('attendance', { login, week_id: '2026-09-21', batch_id: 'SPS', mark_used: 'P' });
    // two people share a name and a phone-like value, so any later UNIQUE index over them would be exposed
    if (has('profiles', 'login')) cols('profiles', { login, name: i < 2 ? 'Same Name' : 'Devotee ' + i, dob: '2000-01-01' });
  }
  // 0001 already seeds the settings rows, so update rather than insert
  db.prepare("UPDATE settings SET value = '2026-09-01' WHERE key = 'tracking_from'").run();
};

// Apply in two halves at several split points, so each later migration meets existing rows.
for (const splitAfter of ['0020_view_sheets.sql', '0030_phase0.sql', '0038_identity_and_profile.sql']) {
  const cut = files.indexOf(splitAfter) + 1;
  const db = new DatabaseSync(':memory:');
  let err = '';
  try {
    apply(db, files.slice(0, cut));
    seed(db);
    apply(db, files.slice(cut));
  } catch (e) { err = e.message; }
  t.eq(err, '', `migrations after ${splitAfter} apply to a database with rows in it`);
  if (!err) {
    // the seeded rows survived and are still readable through the final schema
    t.eq(db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE login LIKE '60000007%'").get().n, 5, `… and the 5 seeded devotees are still there (${splitAfter})`);
    t.eq(db.prepare("SELECT COUNT(*) AS n FROM submissions WHERE week_id = '2026-09-21'").get().n, 5, '… with their submissions');
    // the columns later migrations added exist and carry their defaults, not NULL
    const nulls = db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE only_actions IS NULL OR updated_at IS NULL").get().n;
    t.eq(nulls, 0, '… and columns added later are filled with their defaults, never NULL');
  }
  db.close();
}

// A fresh database and a migrated one must end with the SAME schema: same tables, columns, indexes and triggers.
const fresh = new DatabaseSync(':memory:');
apply(fresh, files);
const stepped = new DatabaseSync(':memory:');
const cut = files.indexOf('0030_phase0.sql') + 1;
apply(stepped, files.slice(0, cut)); seed(stepped); apply(stepped, files.slice(cut));
const shape = (db) => db.prepare("SELECT type, name, COALESCE(sql, '') AS sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all()
  .map(r => `${r.type} ${r.name}: ${r.sql.replace(/\s+/g, ' ').trim()}`);
const a = shape(fresh), b = shape(stepped);
t.eq(b.length, a.length, 'a stepped database has the same number of objects as a fresh one');
const diff = a.filter((x, i) => x !== b[i]);
t.eq(diff.slice(0, 2), [], 'and every table, index and trigger is defined identically' + (diff.length ? ': ' + diff[0].slice(0, 120) : ''));
fresh.close(); stepped.close();

t.done();
