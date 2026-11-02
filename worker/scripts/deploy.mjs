#!/usr/bin/env node
// Roadmap 6.5 (audit T F-14): `npm run deploy` in worker/ used to call wrangler straight away. The rule that
// `audit:sql` must pass before a Worker deploy lived only in a document, so the one deploy that mattered
// could skip it. This makes the rule the code path: checks first, then wrangler, and a rollback target
// recorded in case the deploy is bad.
//
//   node scripts/deploy.mjs              checks, then deploy
//   node scripts/deploy.mjs --skip-checks  deploy only (asks for a reason, logs it; for an emergency)
//   node scripts/deploy.mjs --dry-run    the checks and what WOULD be deployed, nothing published
//
// What this deliberately does NOT do: apply migrations. Those are ordered, irreversible and need the owner
// to watch them (docs/OPERATIONS.md). `npm run migrate:remote` stays a separate, deliberate step.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER = join(HERE, '..');
const WRANGLER = 'npx --no-install wrangler';
const argv = process.argv.slice(2);
const skip = argv.includes('--skip-checks');
const dry = argv.includes('--dry-run');

const sh = (cmd, opts = {}) => execSync(cmd, { cwd: WORKER, stdio: 'inherit', ...opts });
const read = (cmd) => execSync(cmd, { cwd: WORKER, encoding: 'utf8' });

/** The version actually serving traffic. deployments list (not versions list: a version may be uploaded and
 *  carry nothing) and OLDEST-FIRST, so the deployment in force is the last entry. */
function liveVersion() {
  try {
    const ds = JSON.parse(read(`${WRANGLER} deployments list --json`));
    const cur = Array.isArray(ds) && ds.length ? ds[ds.length - 1] : null;
    const full = cur && (cur.versions || []).find(v => Number(v.percentage) === 100);
    return full ? full.version_id : '';
  } catch { return ''; }
}

/* ---- 1. the checks ---- */
if (skip) {
  const why = argv[argv.indexOf('--skip-checks') + 1];
  if (!why || why.startsWith('--')) {
    console.error('--skip-checks needs a reason, in quotes, so the log says why the gate was bypassed:\n' +
                  '  node scripts/deploy.mjs --skip-checks "reverting the 03:00 outage, checks ran on the commit before"');
    process.exit(2);
  }
  console.log(`⚠ checks SKIPPED · reason: ${why}`);
} else {
  console.log('running the checks that must pass before a Worker deploy (audit:sql: suites, query plans, write audit, fixture phones)…');
  const r = spawnSync('npm', ['run', '--silent', 'audit:sql'], { cwd: WORKER, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('\nchecks FAILED — nothing was deployed. Fix them, or (only in an emergency) ' +
                  'node scripts/deploy.mjs --skip-checks "the reason".');
    process.exit(r.status || 1);
  }
}

/* ---- 2. what is live now, so a bad deploy can be undone ---- */
const before = liveVersion();
if (before) console.log(`live now: ${before}`);
else console.warn('could not read the live version: note it by hand (npm run versions) before continuing, ' +
                  'because an automatic rollback will not be possible.');

if (dry) { console.log('--dry-run: the checks passed and nothing was published.'); process.exit(0); }

/* ---- 3. deploy, and keep the rollback target where a later session can find it ---- */
try {
  sh(`${WRANGLER} deploy`);
} catch (e) {
  console.error(`\ndeploy failed: ${e.message}`);
  if (before) console.error(`the app should still be serving ${before}; check with: npm run versions`);
  process.exit(1);
}

const after = liveVersion();
const log = join(WORKER, '..', 'docs', 'deploy-log.json');
try {
  mkdirSync(dirname(log), { recursive: true });
  const prev = existsSync(log) ? JSON.parse(readFileSync(log, 'utf8')) : { note: 'Worker deploys, newest last. Written by worker/scripts/deploy.mjs (roadmap 6.5). `rollbackTo` is the version that was serving BEFORE this deploy.', deploys: [] };
  prev.deploys.push({ at: new Date().toISOString(), version: after || '(unknown)', rollbackTo: before || '(unknown)', checks: skip ? 'SKIPPED' : 'audit:sql passed' });
  prev.deploys = prev.deploys.slice(-40);
  writeFileSync(log, JSON.stringify(prev, null, 2) + '\n');
} catch (e) { console.warn(`could not write the deploy log: ${e.message}`); }

console.log(`\ndeployed${after ? `: ${after}` : ''}.`);
if (before) console.log(`if this build turns out to be bad: npx --no-install wrangler rollback ${before}`);
console.log('Migrations are NOT part of this: run npm run migrate:remote deliberately, and read docs/OPERATIONS.md first.');
