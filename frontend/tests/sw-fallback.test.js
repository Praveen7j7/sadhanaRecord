// The installed app answers every navigation with itself (workbox navigateFallback), except the pages listed in
// navigateFallbackDenylist. A file people OPEN in a tab — a song book PDF, the account-deletion page — is a navigation
// too: if it is not listed, the app swallows it and lands on Home (Vaishnava Songs, the head, 23 Oct 2026).
// This guard reads every such file in public/ and fails if one would be swallowed.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const config = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
const literal = config.match(/navigateFallbackDenylist:\s*(\[[^\]]*\])/)?.[1];
// evaluates only this project's own vite.config.js text (an array of regex literals), never outside input
const deny = literal ? new Function(`return ${literal}`)() : [];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push('/' + path.relative(path.join(root, 'public'), p));
  }
  return out;
}

describe('pages opened outside the app are never answered by the app', () => {
  it('reads the denylist from vite.config.js', () => {
    expect(deny.length).toBeGreaterThan(0);
    expect(deny.every((r) => r instanceof RegExp)).toBe(true);
  });
  // a PDF or a stand-alone HTML page in public/ is opened as a page of its own
  const opened = walk(path.join(root, 'public')).filter((f) => /\.(pdf|html)$/.test(f) && f !== '/index.html');
  it('has such files to check', () => expect(opened.length).toBeGreaterThan(2));
  for (const f of opened) it(`${f} opens as itself`, () => expect(deny.some((r) => r.test(f)), f).toBe(true));
});
