// Our read-only copies of the registry's matching rules must give exactly the keys the dashboard's
// RegistryService.gs gives; otherwise a linked devotee could be seen as someone new. The dashboard
// file is only read here, never changed.
import { createRequire } from 'node:module';
import { boot, suite } from './gas.mjs';

const t = suite('registry rules: identical to the dashboard');
const require = createRequire(import.meta.url);
const DASH = new URL('../../../faciliatorDashboard/RegistryService.gs', import.meta.url).pathname;
const dash = require(DASH);
const { g } = boot();

const names = ['HG Rahul Sharma Prji', 'rahul sharma', 'Raahul Sharmaa', 'Sankirtaneshvar Das', 'Sankirtaneshwar dasa', 'Sri Amit Kumar Ji',
  'A', '', null, 'Prabhuji', 'Om', 'Shyam Sundar', 'Syam Sundar', 'Mohit Kr. Verma', "D'Souza Ian", 'Krishna-Chaitanya', 'H G Gaur Hari',
  'Bhakta Raj', 'Vishal', 'Wishal', 'Aaditya', 'Aditya', 'Hari Hara', '  extra   spaces  here ', 'ALLCAPS NAME', 'Nityananda Dasa Brahmachari'];
const phones = ['6000000310', '+91 98765 43210', '09876543210', '919876543210', '987654321', '98765', '', null, 6000000310, 98765432.1,
  '98-76-54-32-10', '(987) 654-3210', '+1 650 253 0000', '0000000000', 'abc', '9.87654321E9'];

let n = 0;
for (const nm of names) {
  t.eq(g.idNameParts_(nm), dash.regNameParts_(nm), `name parts: ${JSON.stringify(nm)}`);
  for (const p of dash.regNameParts_(nm)) t.eq(g.idTokenKey_(p), dash.regTokenKey_(p), `token key: ${p}`);
  for (const ph of phones) { t.eq(g.idAliasKey_(nm, ph), dash.regAliasKey_(nm, ph), `alias key: ${JSON.stringify(nm)} / ${JSON.stringify(ph)}`); n++; }
}
for (const ph of phones) t.eq(g.idNormPhone_(ph), dash.regNormPhone_(ph), `phone: ${JSON.stringify(ph)}`);
console.log(`  compared ${n} name × phone pairs`);
t.done();
