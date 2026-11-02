// Old pages keep working after a release: the files of the two releases before this one stay served next to the new
// build's files. They are content-hashed, so they never clash and nothing new ever loads them. A phone (or a store
// app left open for days) still running an older version can then load any screen it hasn't stored yet, until it
// reloads onto the new version. Without this, Cloudflare has only the newest files and the old screen fails.
//
// /release-assets.json (published with every release) lists this release's own files and the previous release's.
// The next release carries both lists: the live release + the one before it. Before that file existed, the live
// release's files are found by following the live page's references.
//
//   node scripts/carry-assets.mjs [dist] [--dry]     copies into <dist>/assets (default dist); --dry only reports
import fs from 'node:fs';
import path from 'node:path';

const APP = 'https://sadhana-record.iyfdelhi-sadhana.workers.dev/';
const REF = /[\w.-]+-[\w-]{8}\.(?:js|css|woff2?|png|svg|webp)/g;      // a hashed build file name, as the code refers to it

async function get(name) {
  const r = await fetch(APP + 'assets/' + name, { cache: 'no-store' });
  const type = r.headers.get('content-type') || '';
  return r.ok && !type.includes('text/html') ? Buffer.from(await r.arrayBuffer()) : null;
}

/** The live release's files: the page's start files and everything they refer to, followed through. */
async function crawl() {
  const html = await (await fetch(APP, { cache: 'no-store' })).text();
  const todo = [...new Set([...html.matchAll(/\/assets\/([\w.-]+)/g)].map((m) => m[1]))], seen = new Map();
  while (todo.length) {
    const n = todo.shift();
    if (seen.has(n)) continue;
    const body = await get(n);
    seen.set(n, body);
    if (body && /\.(js|css)$/.test(n)) for (const m of body.toString('utf8').match(REF) || []) if (!seen.has(m)) todo.push(m);
  }
  return seen;
}

export async function carryAssets(dist = 'dist', { dry = false } = {}) {
  const dir = path.join(dist, 'assets'), own = fs.readdirSync(dir).sort();
  let live = null;
  try {
    const r = await fetch(APP + 'release-assets.json', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) live = await r.json();
  } catch { /* first release with this file: crawl instead */ }
  let files;                                                       // name → contents (null: the server hasn't got it)
  if (live) {
    files = new Map();
    for (const n of new Set([...(live.own || []), ...(live.prev || [])])) files.set(n, await get(n));
  } else files = await crawl();
  const liveOwn = live ? live.own : [...files.keys()].filter((n) => files.get(n)).sort();
  let copied = 0, bytes = 0;
  const missing = [];
  for (const [n, body] of files) {
    if (own.includes(n)) continue;                                  // unchanged between releases: already in the build
    if (!body) { missing.push(n); continue; }
    if (!dry) fs.writeFileSync(path.join(dir, n), body);
    copied++; bytes += body.length;
  }
  const record = { own, prev: liveOwn.filter((n) => files.get(n)) };
  if (!dry) fs.writeFileSync(path.join(dist, 'release-assets.json'), JSON.stringify(record) + '\n');
  return { source: live ? 'release-assets.json' : 'crawl', copied, kb: Math.round(bytes / 1024), missing, own: own.length, prev: record.prev.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), dry = args.includes('--dry');
  const r = await carryAssets(args.find((a) => !a.startsWith('--')) || 'dist', { dry });
  console.log(`${dry ? '[dry run] ' : ''}old release files carried: ${r.copied} (${r.kb} KB, found via ${r.source}); this build ${r.own} files, previous ${r.prev}` + (r.missing.length ? ` · not on the server any more: ${r.missing.length}` : ''));
}
