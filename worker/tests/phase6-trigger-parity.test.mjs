// The mirror triggers exist in TWO places and must say the same thing:
//   · setup/build-mirror-sql.mjs, via LOG_WHEN in src/mirrorkeys.js — used to build a FRESH database
//   · worker/migrations/00xx_*.sql — used to bring an EXISTING database (including production) forward
//
// Nothing checked they agreed. While adding the refusal counters (roadmap 6.6) I removed the exclusion from
// the generator and every suite stayed green, because the test database is built from the migrations. The
// two would have drifted silently: a rebuilt database would copy rows to Sheets that production did not, or
// the other way round, and the difference would only show up as a mysteriously busy Settings tab.
//
// So this suite compares the two directly, for whichever tables have a WHEN condition at all.
import { suite } from './harness.mjs';
import { LOG_WHEN } from '../src/mirrorkeys.js';
import { COPY_ON } from '../src/mirror.js';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const t = suite('mirror triggers: the generator and the migrations agree');
const MIG = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** Every migration, oldest first, concatenated: the LAST definition of a trigger is the one in force. */
const files = readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
const sql = files.map(f => readFileSync(join(MIG, f), 'utf8')).join('\n');
// 46, not 47: 0040_hobbies.sql was deleted (whether it was ever applied remotely is roadmap 0.5, an
// owner-only check), so the file count runs one behind the highest number.
t.ok(files.length >= 46, `${files.length} migrations read`);

/** The WHEN condition of the last CREATE TRIGGER mirror_<tbl>_<ins|upd> in migration order. */
function whenInMigrations(tbl, kind) {
  const re = new RegExp(`CREATE TRIGGER mirror_${tbl}_${kind}\\s+AFTER (?:INSERT|UPDATE) ON ${tbl}\\s*([\\s\\S]*?)BEGIN`, 'g');
  let last = null;
  for (const m of sql.matchAll(re)) last = m[1];
  if (last === null) return undefined;                      // no such trigger in any migration
  const w = /^\s*WHEN\s+([\s\S]*?)\s*$/.exec(last);
  return w ? w[1].replace(/\s+/g, ' ').trim() : '';          // '' = a trigger with no condition
}

const norm = (c) => String(c || '').replace(/\s+/g, ' ').trim();

let checked = 0;
for (const [tbl, conds] of Object.entries(LOG_WHEN)) {
  for (const kind of ['ins', 'upd']) {
    // since 0075 every mirror trigger also reads the copy switch (generator: `(LOG_WHEN) AND COPY_ON`)
    const want = norm(`(${conds[kind]}) AND ${COPY_ON}`);
    const got = whenInMigrations(tbl, kind);
    t.ok(got !== undefined, `migrations define mirror_${tbl}_${kind}`);
    t.eq(got, want, `mirror_${tbl}_${kind}: the migrations' WHEN matches LOG_WHEN`);
    checked++;
  }
}
t.ok(checked >= 2, `${checked} trigger conditions compared`);

// and the thing that prompted this: the refusal counters are excluded in BOTH places
for (const key of ['refusals_forbidden', 'refusals_unauthenticated', 'refusals_stale']) {
  t.ok(norm(LOG_WHEN.settings.ins).includes(key), `LOG_WHEN excludes ${key}`);
  t.ok(String(whenInMigrations('settings', 'ins')).includes(key), `the migrations exclude ${key}`);
}

t.done();
