// Every batch on a screen comes from the server (22 Oct 2026, the head: "I define ETP batch 21 and I get ETP batch 51 —
// everything should be wired"). No file the app ships may name a particular batch: a batch id such as ETP-21, SPS2,
// SPSO or VL2-51 belongs to the data, never to the code. Level names (SPS, DPS, BSS, BVS, TRD, VL2, VL3, ETP) are the
// product's fixed vocabulary and are allowed; the in-memory mock (lib/mock*.js) is test data and is skipped; comments
// are skipped.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../src', import.meta.url).pathname;
const files = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : [p]; });
// a numbered intake (ETP-21, VL2-51, MTP-3) or one of the named class batches (SPS2, SPSO)
const BATCH_ID = /\b(?:ETP|MTP|FTP|VL[123])-\d+\b|\bSPS[2-9O]\b|ETP\s*·?\s*Batch\s+\d+/;
// a field's placeholder ("e.g. SPS3") is an example of the format, not a batch shown as if it were real
const strip = (t) => t.replace(/placeholder="[^"]*"/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('no screen names a particular batch', () => {
  const shipped = files(SRC).filter((p) => /\.(svelte|js)$/.test(p) && !/\/lib\/mock[^/]*\.js$/.test(p));
  it('reads the app', () => { expect(shipped.length).toBeGreaterThan(100); });
  it('every batch id comes from the server', () => {
    const found = shipped.flatMap((p) => { const m = strip(readFileSync(p, 'utf8')).match(BATCH_ID); return m ? [`${p.slice(SRC.length + 1)}: ${m[0]}`] : []; });
    expect(found, `batch ids written into the app: ${found.join(', ')}`).toEqual([]);
  });
});
