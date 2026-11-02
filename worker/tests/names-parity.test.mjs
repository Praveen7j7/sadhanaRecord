// Response parity for the names work (Phase 24, 27 Oct 2026): every read the change touched answers EXACTLY as it did
// before, for every role, when nothing has been renamed. The golden file was written by the code before the change
// (NAMES_PARITY_WRITE=1 node tests/names-parity.test.mjs, on the tree of 27 Oct 2026); the differences the change was
// MEANT to make are listed in EXPECTED and nowhere else, so any other drift fails here.
import fs from 'node:fs';
import { suite } from './harness.mjs';
import { scenario, readsOf } from './names-fixture.mjs';

const t = suite('names: replies unchanged (response parity)');
const GOLDEN = new URL('./fixtures/names-parity.json', import.meta.url);
const got = await readsOf(await scenario());

// the only intended differences with no rename: the dashboard is no longer part of the app (the head, 27 Oct 2026)
const EXPECTED = (key, v) => {
  if (key === 'master.facilitators') for (const f of v.facilitators) delete f.inDashboard;
  // the version of the lists the phone holds (Phase 24): new beside the two versions that were there
  if (v?.versions) delete v.versions.names;
  // the journals version is DATA a migration sets (a peer's book relink moved it j4 → j5 after the golden was written)
  if (v?.versions) delete v.versions.journals;
  if (key === 'meta') delete v.version;
  return v;
};

if (process.env.NAMES_PARITY_WRITE === '1') {
  fs.mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true });
  fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 1) + '\n');
  console.log('written', GOLDEN.pathname);
  t.ok(true, 'golden written');
} else {
  const want = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  t.eq(Object.keys(got), Object.keys(want), 'the same reads');
  for (const k of Object.keys(want)) t.eq(EXPECTED(k, structuredClone(got[k])), EXPECTED(k, structuredClone(want[k])), `${k}: the same reply`);
  // and the golden is not vacuous: the reads it pins carry the names this change is about
  t.ok(JSON.stringify(want['fac.devotees']).includes('Arjun Das'), 'the golden holds the facilitator’s students');
  t.ok(JSON.stringify(want['dev.wall']).includes('For my students'), 'and the post to his students, seen by a student');
  t.ok(JSON.stringify(want['master.devotees.SPS.past']).includes('Bhima Das'), 'and the past week with the closed membership');
}
t.done();
