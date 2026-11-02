// Runs every backend suite and prints one verdict.   node tests/run-all.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const suites = fs.readdirSync(here).filter(f => f.endsWith('.test.mjs')).sort();
let passed = 0, failed = 0, bad = [];
for (const f of suites) {
  const r = spawnSync(process.execPath, [here + f], { encoding: 'utf8' });
  const m = /=== (\d+) passed, (\d+) failed/.exec(r.stdout || '');
  const p = m ? +m[1] : 0, x = m ? +m[2] : 1;
  passed += p; failed += x;
  if (r.status !== 0 || !m) bad.push(f);
  console.log(`${r.status === 0 && m ? 'ok  ' : 'FAIL'}  ${f.padEnd(28)} ${p} passed${x ? ', ' + x + ' failed' : ''}`);
  if (r.status !== 0) console.log((r.stdout || '') + (r.stderr || ''));
}
console.log(`\n${bad.length ? 'FAILED: ' + bad.join(', ') : 'all ' + suites.length + ' suites passed'} · ${passed} assertions`);
process.exit(bad.length ? 1 : 0);
