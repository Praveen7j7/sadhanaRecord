// Every server action has a screen (ADR 0017, the head, 22 Oct 2026: "features which are already there but just
// require wiring with the admin"). A sweep that day found eleven actions built, tested and gated on the server with
// nothing in the app calling them — phases, promotion rules, card unlock, merge, head access, sign out everywhere.
// This keeps it from happening again: an action in the registry must be CALLED somewhere in src (not merely listed in
// the WRITES set or the mock), or be on the machine list below with the reason.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const registry = readFileSync(join(ROOT, '../worker/src/api.js'), 'utf8');
const actions = [...registry.matchAll(/^\s*'([a-zA-Z]+\.[a-zA-Z]+)':\s*\{\s*roles:/gm)].map((m) => m[1]);

// called by something that is not a screen
const MACHINES = {
  'push.message': 'the service worker asks what to show for a push',
  'push.renew': 'the service worker renews a rotated subscription',
  'identity.mintBatch': "the Facilitator Dashboard's import (a service account)",
  'identity.serviceToken': 'tools/identity/service-token.mjs (the head, from the command line)'
};

function files(dir) {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; });
}
// the app's own code, minus the mock (it answers calls, it does not make them) and the client's action lists
const src = files(join(ROOT, 'src')).filter((p) => /\.(svelte|js)$/.test(p) && !/\/lib\/mock[^/]*\.js$/.test(p))
  .map((p) => {
    const t = readFileSync(p, 'utf8');
    // lib/api.js lists every write and public action by name, and lib/admin.js words each one for Activity: a name in a
    // list or as a key ('masters.set': 'made … a head' — never spaced, unlike a ternary's ' : ') is not a call
    return (/\/lib\/api\.js$/.test(p) ? t.replace(/new Set\(\[[\s\S]*?\]\)/g, '') : t).replace(/'[a-zA-Z]+\.[a-zA-Z]+':/g, '');
  }).join('\n');

describe('every server action is wired to a screen', () => {
  it('reads the registry', () => { expect(actions.length).toBeGreaterThan(120); });
  it('has a caller in the app for each action, or is a machine action with a reason', () => {
    const unwired = actions.filter((a) => !MACHINES[a] && !src.includes(`'${a}'`));
    expect(unwired, `built on the server, no screen calls them: ${unwired.join(', ')}`).toEqual([]);
  });
  it('lists only machine actions that still exist', () => {
    expect(Object.keys(MACHINES).filter((a) => !actions.includes(a))).toEqual([]);
  });
});
