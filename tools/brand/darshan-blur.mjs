#!/usr/bin/env node
// Adds a `blur` to every painting in darshan.json: a 24 px JPEG inlined as a data URI (~1.3 KB each).
//
// Why (the user, 12 Oct 2026): on a low battery or a poor connection tier.js stops loading the paintings, and
// the welcome panel used to show flat navy — the person sees a broken screen rather than a quiet one. A data
// URI needs NO network request at all, so it shows at any battery and offline, and the panel always carries a
// painting rather than a blank. Blurred up it reads as the real thing.
//
//   node tools/brand/darshan-blur.mjs           # flagship only (the welcome and sign-in panels)
//   node tools/brand/darshan-blur.mjs --all     # every painting
//
// Re-runnable: an entry that already has a blur of the current size is left alone.
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIR = 'frontend/public/darshan';
const MANIFEST = `${DIR}/darshan.json`;
const PX = 64;                      // 64 px, ~3 KB each: at 24 px the deity was no longer recognisable (12 Oct 2026)
const all = process.argv.includes('--all');

const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const want = m.images.filter((i) => i.active && (all || i.flagship));
const tmp = mkdtempSync(join(tmpdir(), 'blur-'));
let made = 0, kept = 0, missed = 0, bytes = 0;

for (const img of want) {
  if (typeof img.blur === 'string' && img.blur.startsWith('data:image/jpeg')) { kept++; continue; }
  // the smallest file we already ship is the best source: it decodes fastest and the detail is thrown away anyway
  const src = [`${DIR}/${img.id}-480.avif`, `${DIR}/${img.id}-480.webp`, `${DIR}/${img.id}-960.webp`].find(existsSync);
  if (!src) { console.warn(`  no source for ${img.id}`); missed++; continue; }
  const out = join(tmp, `${img.id}.jpg`);
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', String(PX), '-s', 'formatOptions', '55', src, '--out', out], { stdio: 'ignore' });
    const b64 = readFileSync(out).toString('base64');
    img.blur = `data:image/jpeg;base64,${b64}`;
    bytes += b64.length; made++;
  } catch (e) { console.warn(`  ${img.id}: ${e.message}`); missed++; }
}
rmSync(tmp, { recursive: true, force: true });

if (made) writeFileSync(MANIFEST, JSON.stringify(m, null, 1) + '\n');
console.log(`${made} made, ${kept} already had one, ${missed} skipped · ${(bytes / 1024).toFixed(1)} KB added to the manifest`);
