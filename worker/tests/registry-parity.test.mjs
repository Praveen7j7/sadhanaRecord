// The Worker's copies of the registry's matching rules must give exactly the keys the dashboard's
// RegistryService.gs gives. The dashboard file is only read here, never changed.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { suite } from './harness.mjs';
import { idNormPhone, idNameParts, idTokenKey, idAliasKey } from '../src/registry.js';

const t = suite('registry rules: identical to the dashboard');

// The dashboard lives in a SIBLING project, outside this repository, and is only ever read here. A checkout of
// this repo alone — which is what CI does — does not have it, so the suite says so and passes rather than crashing
// (13 Oct 2026, audit F-16). When the sibling IS present, which is the maintainer's machine, every rule is
// compared as before; the parity itself is not something to lose.
const DASH = new URL('../../../faciliatorDashboard/RegistryService.gs', import.meta.url).pathname;
if (!existsSync(DASH)) {
  t.ok(true, 'the facilitator dashboard is not checked out beside this repo, so the parity check is skipped');
  t.ok(true, '  (it runs on a machine that has ../faciliatorDashboard — see the comment in this file)');
  t.done();
}
const dash = createRequire(import.meta.url)(DASH);
const names = ['HG Rahul Sharma Prji', 'rahul sharma', 'Raahul Sharmaa', 'Sankirtaneshvar Das', 'Sankirtaneshwar dasa', 'Sri Amit Kumar Ji',
  'A', '', null, 'Prabhuji', 'Om', 'Shyam Sundar', 'Syam Sundar', 'Mohit Kr. Verma', "D'Souza Ian", 'Krishna-Chaitanya', 'H G Gaur Hari',
  'Bhakta Raj', 'Vishal', 'Wishal', 'Aaditya', 'Aditya', 'Hari Hara', '  extra   spaces  here ', 'ALLCAPS NAME', 'Nityananda Dasa Brahmachari'];
// Every SHAPE a phone arrives in, with the reserved fixture digits (roadmap 6.7): this suite only compares
// two parsers against each other, but a dialable number in a fixture is somebody's number wherever it sits.
const phones = ['6000000087', '+91 60000 00087', '06000000087', '916000000087', '600000008', '60000', '', null, 6000000087, 60000000.87,
  '60-00-00-00-87', '(600) 000-0087', '+1 650 253 0000', '0000000000', 'abc', '6.000000087E9'];
for (const nm of names) {
  t.eq(idNameParts(nm), dash.regNameParts_(nm), `name parts: ${JSON.stringify(nm)}`);
  for (const p of dash.regNameParts_(nm)) t.eq(idTokenKey(p), dash.regTokenKey_(p), `token key: ${p}`);
  for (const ph of phones) t.eq(idAliasKey(nm, ph), dash.regAliasKey_(nm, ph), `alias key: ${JSON.stringify(nm)} / ${JSON.stringify(ph)}`);
}
for (const ph of phones) t.eq(idNormPhone(ph), dash.regNormPhone_(ph), `phone: ${JSON.stringify(ph)}`);
t.done();
