// One-time move of the Phase 1 data from the Sheets (written by the retired Apps Script server) into D1.
//   node setup/migrate-to-d1.mjs <out.sql>      writes the SQL; nothing is changed anywhere
//   then: cd worker && npx wrangler d1 execute sadhana --remote --file <out.sql>
// Hashes keep working only if the Worker's PW_PEPPER secret is the Apps Script project's PW_PEPPER.
// Settings are not copied (D1 has its own defaults, e.g. 10,000 hashing rounds); RunLog and Sessions are not
// copied (everyone simply logs in again).
import fs from 'node:fs';
import * as g from './sa.mjs';
import FILES from './files.json' with { type: 'json' };

const out = process.argv[2];
if (!out) throw new Error('usage: node setup/migrate-to-d1.mjs <out.sql>');

const objects = async (fileKey, tab) => {
  const v = (await g.get(FILES[fileKey], `'${tab}'!A1:AF2000`, 'FORMATTED_VALUE')).values || [];
  const h = v[0] || [];
  return v.slice(1).filter(r => r.some(x => x !== '')).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
};
const sq = v => v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const iso = v => { const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?::(\d{2}))?$/.exec(String(v).trim()); return m ? `${m[1]}T${m[2]}:${m[3] || '00'}+05:30` : String(v || ''); };
const day = v => (/^\d{4}-\d{2}-\d{2}/.exec(String(v)) || [''])[0];
const bool = v => String(v).toUpperCase() === 'TRUE' ? 1 : 0;
const int = v => (v === '' ? 0 : Number(v) || 0);
const insert = (tbl, o) => `INSERT OR REPLACE INTO ${tbl} (${Object.keys(o).join(', ')}) VALUES (${Object.values(o).map(sq).join(', ')});`;

const sql = [];
for (const a of await objects('access', 'Accounts')) {
  sql.push(insert('accounts', {
    login: a.login, role: a.role, status: a.status, name: a.name, phone: a.phone, iyf_id: a.iyf_id || null, id_source: a.id_source,
    requested_batch: a.requested_batch, pw_hash: a.pw_hash, pw_salt: a.pw_salt, pw_iterations: int(a.pw_iterations), must_change_pw: bool(a.must_change_pw),
    failed_tries: int(a.failed_tries), locked_until: iso(a.locked_until), signed_up_at: iso(a.signed_up_at), decided_at: iso(a.decided_at),
    decided_by: a.decided_by, reject_reason: a.reject_reason, last_login_at: iso(a.last_login_at), updated_at: iso(a.updated_at), updated_by: a.updated_by }));
}
for (const b of await objects('access', 'Batches')) {
  sql.push(`UPDATE batches SET name = ${sq(b.name)}, coordinator_logins = ${sq(b.coordinator_logins)}, active = ${bool(b.active)}, pilot = ${bool(b.pilot)}, updated_by = 'migration' WHERE batch_id = ${sq(b.batch_id)};`);
}
for (const m of await objects('access', 'Memberships')) {
  sql.push(insert('memberships', { login: m.login, iyf_id: m.iyf_id, batch_id: m.batch_id, state: m.state, from_week: day(m.from_week), to_week: day(m.to_week),
    level_entry_date: day(m.level_entry_date), group_leader: m.group_leader, set_by: m.set_by, set_at: iso(m.set_at), reason: m.reason }));
}
for (const r of await objects('access', 'ResetRequests')) {
  sql.push(insert('reset_requests', { login: r.login, requested_at: iso(r.requested_at), new_pw_hash: r.new_pw_hash, new_pw_salt: r.new_pw_salt,
    new_pw_iterations: int(r.new_pw_iterations), status: r.status, decided_by: r.decided_by, decided_at: iso(r.decided_at) }));
}
for (const p of await objects('profiles', 'Profiles')) {
  sql.push(insert('profiles', { login: p.login, iyf_id: p.iyf_id, name: p.name, dob: day(p.dob), blood_group: p.blood_group, emergency_name: p.emergency_name,
    emergency_relation: p.emergency_relation, emergency_phone: p.emergency_phone, photo_file_id: p.photo_file_id, photo_updated_at: iso(p.photo_updated_at),
    reading_pages_per_hour: int(p.reading_pages_per_hour) || 20, current_book_id: p.current_book_id, updated_at: iso(p.updated_at), updated_by: p.updated_by }));
}
const audit = await objects('access', 'AuditLog');
for (const x of audit) {
  sql.push(insert('audit_log', { at: iso(x.at), who: x.who, role: x.role, action: x.action, target: x.target, batch_id: x.batch_id === 'undefined' ? '' : x.batch_id,
    before: x.before, after: x.after, reason: x.reason, request_id: x.request_id }));
}
// the existing audit lines are already in the sheet: start appending after them; every other copy is rewritten
sql.push(`UPDATE mirror_state SET dirty = dirty + 1;`);
sql.push(`UPDATE mirror_state SET last_id = (SELECT COALESCE(MAX(id), 0) FROM audit_log) WHERE tbl = 'audit_log';`);
fs.writeFileSync(out, sql.join('\n') + '\n');
const count = t => sql.filter(s => s.includes(`INTO ${t} `)).length;
console.log(`wrote ${out}: ${count('accounts')} accounts, ${count('memberships')} memberships, ${count('profiles')} profiles, ${count('reset_requests')} reset requests, ${audit.length} audit lines, batch coordinators`);
