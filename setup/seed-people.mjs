// Reads (read-only) the dashboard's NameMap and the Head Names used in each batch tab of the sadhana sheet in 2026,
// and writes sadhanaRecord/setup/data/people.json: the canonical facilitators and a clean group-leader list per batch
// (duplicate spellings merged, the most-used spelling kept; placeholders left out). Uses the dashboard's
// service account through impl/gs.mjs; changes nothing anywhere.      node sadhanaRecord/setup/seed-people.mjs
import fs from 'node:fs';
import * as g from '../../impl/gs.mjs';
const SADHANA = '1P2m8BfaB-9KXySZ5f--Nqx3rL9N-PGfGuacmfE_Wo3Y';
const TABS = { SPS: 'SPS', SPS2: 'SPS Group 2', SPSO: 'SPS Online', DPS: 'DPS', BSS: 'BSS', BVS: 'BVS' };
const PLACEHOLDER = /^(tba|tbd|na|n\/a|inactive|inactive devotee|to be all?ott?ed|-|none)$/i;
const key = n => n.toLowerCase().replace(/^z(?=[a-z])/, '').replace(/\b(hg|pr|prji|prabhu|prabhuji)\b/g, ' ').replace(/[^a-z]/g, '');

const nm = (await g.get(g.LIVE, 'NameMap!A2:C400')).values || [];
const fac = new Map();
for (const [, canon, cohort] of nm) if (canon && !fac.has(canon.trim())) fac.set(canon.trim(), String(cohort || '').toUpperCase() === 'TRUE' || String(cohort || '').toLowerCase() === 'yes');
const facilitators = [...fac].map(([name, inCohort]) => ({ name, inCohort })).sort((a, b) => (b.inCohort - a.inCohort) || a.name.localeCompare(b.name));

const leaders = {};
for (const [id, tab] of Object.entries(TABS)) {
  const head = (await g.get(SADHANA, `'${tab}'!A1:AF1`)).values[0], hi = head.indexOf('Head Name'), mi = head.indexOf('Month');
  const rows = ((await g.get(SADHANA, `'${tab}'!A2:AF4000`)).values || []).filter(r => /'26/.test(r[mi] || ''));
  const groups = new Map();
  for (const r of rows) {
    const n = String(r[hi] || '').replace(/\s+/g, ' ').trim();
    if (!n || PLACEHOLDER.test(n)) continue;
    const k = key(n); if (!k) continue;
    const gr = groups.get(k) || new Map(); gr.set(n, (gr.get(n) || 0) + 1); groups.set(k, gr);
  }
  leaders[id] = [...groups.values()].map(gr => {
    const spellings = [...gr].sort((a, b) => b[1] - a[1]);
    return { name: spellings[0][0].replace(/^z(?=[A-Z])/i, ''), rows: spellings.reduce((s, x) => s + x[1], 0), merged: spellings.slice(1).map(x => x[0]) };
  }).sort((a, b) => b.rows - a.rows);
}
fs.writeFileSync(new URL('./data/people.json', import.meta.url), JSON.stringify({ facilitators, leaders }, null, 1));
console.log(`facilitators: ${facilitators.length} (${facilitators.filter(f => f.inCohort).length} in the current cohort)`);
for (const [b, l] of Object.entries(leaders)) console.log(`${b}: ${l.length} group leaders · ${l.map(x => x.name + (x.merged.length ? ` [+${x.merged.join(', ')}]` : '')).join(' | ')}`);
