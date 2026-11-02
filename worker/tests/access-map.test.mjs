// The access map (docs/ACCESS_MAP.md) is generated from the route table and the registry; this keeps it in step. A
// new screen, a moved gate or a new action changes the map, and the change is then reviewed in the diff rather than
// discovered later. To update: node tools/access/map.mjs (from sadhanaRecord/).
import { readFileSync } from 'node:fs';
import { suite } from './harness.mjs';
import { build, fieldsFile } from '../../tools/access/map.mjs';

const t = suite('access map: docs/ACCESS_MAP.md matches the route table and the registry');
const want = await build();
let have = ''; try { have = readFileSync(new URL('../../docs/ACCESS_MAP.md', import.meta.url), 'utf8'); } catch { /* missing */ }
t.ok(have.length > 0, 'docs/ACCESS_MAP.md exists');
t.ok(have === want, have === want ? 'the map is up to date' : 'the map is out of date: run node tools/access/map.mjs and review the diff');
let mf = ''; try { mf = readFileSync(new URL('../../frontend/src/lib/mockfields.js', import.meta.url), 'utf8'); } catch { /* missing */ }
const ff = await fieldsFile();
t.ok(mf === ff, mf === ff ? "the mock's field list matches the registry" : 'frontend/src/lib/mockfields.js is out of date: run node tools/access/map.mjs');
t.ok(/## Screens \(\d+\)/.test(want) && /## Server actions \(\d+\)/.test(want), 'it lists every screen and every action');
t.done();
