// In-memory mock of the Phase 1 API (dev / offline only; never bundled when VITE_API_URL is set).
import { installWeeks, resetWeeks, setNow, nowD, _state, isoIst } from './mockweeks.js';
import { installStaff, seedStaff, leaderBatch, photoAtOf, mockCameBackApp } from './mockstaff.js';
import { normEmail, emailProblem, normWhatsapp } from './contact.js';
import { addressErrors, cleanAddress } from './address.js';
import { installAdmin } from './mockadmin.js';
import { installPhase9 } from './mockphase9.js';
import { FIELDS, CAPS } from './mockfields.js';
import { installCard } from './mockcard.js';
import { installShare } from './mockshare.js';
import { installReport } from './mockreport.js';
export { setNow };

// Seed logins: master / master-pass-1, sps / sps-pass-12, facilitator natvar / natvar-pass-1, devotee 6000000001 / pass-12345, pending devotee 6000000310 / pass-12345.
// Mixed scopes: meera / meera-pass-1 (devotee in SPS + coordinator of DPS), guru / guru-pass-12 (devotee in SPS + master).

const now = () => new Date().toISOString();
const ist = (d = new Date()) => new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 19) + '+05:30';

const ok = (data = {}) => ({ ok: true, data, serverTime: ist(nowD()) });
const fail = (code, message, extra = {}) => ({ ok: false, error: { code, message, ...extra }, serverTime: ist(nowD()) });
const fieldFail = (fields, message = 'Some answers need fixing.') => fail('VALIDATION', message, { fields: fields.map(([path, m]) => ({ path, message: m })) });

// offline can start switched on (a test reopening the app with no connection: localStorage sr.mockOffline = '1')
let db, sessions, replies, latency = 1500, offline = (() => { try { return localStorage.getItem('sr.mockOffline') === '1'; } catch { return false; } })();
var admin, phase9, card, share;   // the newer actions' state (mockadmin.js, mockphase9.js, mockcard.js, mockshare.js), reset with the rest
export function setLatency(ms) { latency = ms; }
/** Tests only: change a mock person's record in place (e.g. a rejected sign-up), without a reload. */
export function _patchUser(login, patch) { if (db.users[login]) Object.assign(db.users[login], patch); }
/** Dev / test: every call fails as if there were no connection. */
export function setOffline(v) { offline = !!v; }
const jitter = () => (latency ? latency + (Math.random() - 0.5) * (latency / 1.5) : 0); // 1500 +/- 500

export function reset() {
  facReset();
  db = {
    // classDay lives on the BATCH, as it does on the server since migration 0051 — not on the
    // membership beside it. Two copies of one fact is how the class-day change reached the server
    // and missed the mock in the first place (ee9fed4, 17 Oct 2026).
    batches: [
      { batchId: 'SPS', name: 'SPS', level: 'SPS', active: true, pilot: false, coordinator: 'sps', classDay: 'SUN' },
      { classDay: 'SUN', batchId: 'SPS2', name: 'SPS Group 2', level: 'SPS', active: true, pilot: false, coordinator: 'sps' },
      { classDay: 'SUN', batchId: 'SPSO', name: 'SPS Online', level: 'SPS', active: true, pilot: false, coordinator: 'sps' },
      { batchId: 'DPS', name: 'DPS', level: 'DPS', classDay: 'SUN', active: true, pilot: false, coordinator: 'meera' },
      { batchId: 'BSS', name: 'BSS', level: 'BSS', classDay: 'SUN', active: true, pilot: false, coordinator: null },
      { batchId: 'BVS', name: 'BVS', level: 'BVS', classDay: 'SUN', active: true, pilot: false, coordinator: null },
      // temple residents: a batch of their own since 17 Oct 2026, so they can sign up, fill their
      // sadhana and be seen by a coordinator like anybody else
      // phase 21: they also answer the temple activities each day (batches.temple_activities, migration 0062)
      { batchId: 'TRD', name: 'Temple Residents', level: 'TRD', classDay: 'SUN', active: true, pilot: false, coordinator: null, templeActivities: true },
      // a training batch, so the demo and the browser checks can reach the card and the board
      { batchId: 'ETP-21', name: 'ETP · Batch 21', level: 'ETP', classDay: 'WED', active: true, pilot: false, coordinator: 'etp', startedOn: '2026-10-17', closedAt: '', offeredAtSignup: 0 },
    ],
    users: {
      meera: { login: 'meera', role: 'COORDINATOR', name: 'Meera Devi', password: 'meera-pass-1', status: 'ACTIVE', mustChange: false, batchId: 'SPS' },
      master: { login: 'master', role: 'MASTER', name: 'IYF Head', password: 'master-pass-1', status: 'ACTIVE', mustChange: false },
      guru: { login: 'guru', role: 'MASTER', name: 'Govinda Das', password: 'guru-pass-12', status: 'ACTIVE', mustChange: false, batchId: 'SPS' },
      sps: { login: 'sps', role: 'COORDINATOR', name: 'SPS Team', password: 'sps-pass-12', status: 'ACTIVE', mustChange: false, lastLogin: null },
      // The ETP coordinator, who was missing (18 Oct 2026): the training had no coordinator, so every
      // check of the Students screen ran as the MASTER and the one login that actually uses it was
      // never exercised. That is how "I search and see nothing" went unnoticed here.
      etp: { login: 'etp', role: 'COORDINATOR', name: 'ETP Team', password: 'etp-pass-12', status: 'ACTIVE', mustChange: false, lastLogin: null },
      // a facilitator login (4 Oct 2026): sees, read-only, the devotees with this facilitator
      natvar: { login: 'natvar', role: 'COORDINATOR', name: 'Natvar Gopinath Prabhuji', password: 'natvar-pass-1', status: 'ACTIVE', mustChange: false, facilitatorName: 'Natvar Gopinath Prabhuji' },
      // a temple resident (phase 21): the fixture for the TRD day form's temple activities
      '6000000092': { login: '6000000092', role: 'DEVOTEE', name: 'Raman Das', password: 'trd-pass-12', status: 'ACTIVE', batchId: 'TRD', iyfId: 'IYFD-2021-0092', email: '', whatsapp: '6000000092', classDay: 'SUN' },
      '6000000001': { login: '6000000001', role: 'DEVOTEE', name: 'Sunil Kumar', password: 'pass-12345', status: 'ACTIVE', batchId: 'SPS', iyfId: 'IYFD-2019-0003', email: 'sunil.kumar@gmail.com', whatsapp: '6000000001', classDay: 'SUN' },
      '6000000087': signup('6000000087', 'Rahul Sharma', 'SPS', '2003-08-14', 'B+', 'Mohan Sharma', 'Father', '6000000070', '2026-10-01T09:10:00', 'SUN', 'rahul.sharma@gmail.com', '6000000087'),
      '6000000074': signup('6000000074', 'Ankit Verma', 'SPS2', '2001-02-03', 'O+', 'Sita Verma', 'Mother', '6000000078', '2026-10-01T18:40:00', 'SAT', 'ankit.v@yahoo.com', ''),
      '6000000034': signup('6000000034', 'Karan Mehta', 'SPSO', '1999-12-30', "Don't know", 'Raj Mehta', 'Brother', '6000000079', '2026-10-02T07:05:00', 'SUN', 'karan.mehta@outlook.com', '6000000033'),
      '6000000088': signup('6000000088', 'Neha Gupta', 'DPS', '2000-05-21', 'A-', 'Anil Gupta', 'Father', '6000000144', '2026-10-02T08:30:00', 'SAT', 'neha.gupta@gmail.com', '6000000088'),
    },
    registry: [
      { iyfId: 'KT26-0003', name: 'Sunil Kumar', level: 'SPS', facilitator: 'Hari Das', phones: ['6000000001'], linked: '6000000001' },
      { iyfId: 'KT26-0017', name: 'Ankit Verma', level: 'SPS', facilitator: 'Gopal Das', phones: ['6000000117'], linked: null },
      { iyfId: 'KT26-0042', name: 'Rahul Sharma', level: 'SPS', facilitator: 'Hari Das', phones: ['6000000087'], linked: null },
      { iyfId: 'KT26-0043', name: 'Rahul Sharma', level: 'DPS', facilitator: 'Madhav Das', phones: ['6000000143'], linked: null },
      { iyfId: 'GP25-0101', name: 'Karan Malhotra', level: 'DPS', facilitator: 'Madhav Das', phones: ['6000000076'], linked: null },
      { iyfId: 'JN25-0210', name: 'Neha Gupta', level: 'DPS', facilitator: 'Radha Devi', phones: ['6000000088'], linked: null },
      { iyfId: 'KT26-0061', name: 'Sanjay Rao', level: 'DPS', facilitator: 'Radha Devi', phones: ['6000000034'], linked: null },
      { iyfId: 'KT26-0050', name: 'Old Duplicate', level: 'BSS', facilitator: 'Hari Das', phones: ['6000000150'], linked: null, mergedInto: 'KT26-0042' },
    ],
    resets: [{ login: '6000000001', name: 'Sunil Kumar', at: '2026-10-02T06:15:00+05:30', newPassword: 'fresh-pass-77' }],
    nextId: 70,
  };
  sessions = new Map();
  replies = new Map();
  resetWeeks();
  admin?.reset();
  phase9?.reset();
  card?.reset();
  share?.reset();
  seedStaff(db);   // 11 more SPS devotees with generated weeks, profiles, photos, birthdays, a reopen request, a duplicate ID
}
function signup(phone, name, batchId, dob, bloodGroup, emName, relation, emPhone, at, classDay, email, whatsapp) {
  return { login: phone, role: 'DEVOTEE', name, password: 'pass-12345', status: 'PENDING', batchId, at: at + '+05:30', profile: { dob, bloodGroup, emergency: { name: emName, relation, phone: emPhone } }, facilitator: 'Natvar Gopinath Prabhuji', classDay, email, whatsapp };
}
reset();

// ---------- helpers ----------
const coordName = (b) => (b.coordinator ? db.users[b.coordinator]?.name || '' : '');
const batchIdsOf = (u) => (u.role === 'MASTER' ? db.batches.map((b) => b.batchId) : db.batches.filter((b) => b.coordinator === u.login || (u.coordinates || []).includes(b.batchId)).map((b) => b.batchId));
// roles given from Access (worker grants.js, ADR 0019): u.coordinates holds the batches a personal login was given; a role
// past its end date (u.grants['@<role>']) drops out on the next call, and the scopes carry the rights, as withAccess does
const roleEnded = (u, r) => { const x = u.grants?.['@' + r]; return !!x?.until && x.until < isoIst(nowD()).slice(0, 10); };
const kindOfBatch = (b) => (/^ETP-\d+$/.test(String(b || '')) ? 'training' : 'coordinator');
// the FTP coordinator (ADR 0019): a role on its own, for all of IYF; never a head (who holds everything already)
const ftpScope = (u) => u.role !== 'MASTER' && !u.isMaster && !!u.grants?.['@ftp'] && !roleEnded(u, 'ftp');
// the whole facilitators' board: the head, and the FTP coordinator unless the head took it away (phases.js wholeFacBoard)
export const wholeFacBoard = (u) => u.role === 'MASTER' || (ftpScope(u) && rightsOf(u).facBoard !== 'deny');
const coordScope = (u) => (u.role === 'COORDINATOR' || u.coordinates?.length ? batchIdsOf(u).filter((b) => !roleEnded(u, kindOfBatch(b))) : []);
const rightsOf = (u) => {
  const day = isoIst(nowD()).slice(0, 10), out = {};
  for (const [id, v] of Object.entries(u.grants || {})) if (CAPS.some((c) => c.id === id) && (v.effect === 'allow' || v.effect === 'deny') && (!v.until || v.until >= day)) out[id] = v.effect;
  return out;
};
const userView = (u) => ({
  photoAt: photoAtOf(u.login),   // when their own photo was last set, as auth.me sends it
  role: u.role, name: u.name, login: u.login, iyfId: u.iyfId || null,
  batchIds: u.role === 'DEVOTEE' ? (coordScope(u).length ? coordScope(u) : u.batchId ? [u.batchId] : []) : [...new Set([...(u.batchId ? [u.batchId] : []), ...batchIdsOf(u)])],
  scopes: { devotee: u.batchId ? { batchId: u.batchId } : null, facilitator: u.facilitatorName && u.status === 'ACTIVE' ? { name: u.facilitatorName } : null, groupLeader: u.role === 'DEVOTEE' && u.status === 'ACTIVE' && leaderBatch(u.login) && !roleEnded(u, 'leader') ? { batchId: leaderBatch(u.login) } : null, trainee: card?.traineeOf ? card.traineeOf(u.login) : null, coordinator: coordScope(u), master: u.role === 'MASTER' || !!u.isMaster, rights: rightsOf(u), ftp: ftpScope(u) },
  mustChangePassword: !!u.mustChange,
  // one id system (worker auth.js userInfo, 22 Oct 2026): a devotee without an IYFD is asked for their year first
  needsYear: u.role === 'DEVOTEE' && !/^IYFD-/.test(u.iyfId || ''),
});
const phoneEnd = (p) => '…' + p.slice(-4);
const regRow = (r) => ({ iyfId: r.iyfId, name: r.name, level: r.level, facilitator: r.facilitator, phoneEnd: phoneEnd(r.phones[0] || '0000'), linked: !!r.linked, mergedInto: r.mergedInto || null });
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

function matchesFor(u) {
  const out = [];
  for (const r of db.registry) {
    if (r.mergedInto) continue;
    const byPhone = r.phones.includes(u.login);
    const byName = norm(r.name) === norm(u.name);
    const parts = (n) => n.toLowerCase().split(/\s+/).filter(Boolean);
    const nameMatches = byName || parts(r.name).some((p) => parts(u.name).includes(p));
    if (byPhone || byName) out.push({ ...regRow(r), why: byPhone && byName ? 'phone + name' : byPhone ? 'phone' : 'name only', nameMatches });
  }
  return out.sort((a, b) => (b.why === 'phone + name') - (a.why === 'phone + name'));
}
function search(q) {
  const s = q.trim().toLowerCase();
  const digits = s.replace(/\D/g, '');
  return db.registry
    .filter((r) => r.name.toLowerCase().includes(s) || r.iyfId.toLowerCase().includes(s) || (digits.length >= 3 && r.phones.some((p) => p.includes(digits))))
    .slice(0, 20);
}

// ---------- action table ----------
// Each entry: [roles | null for public, handler(data, caller) -> reply]
const A = {};

// the master's facilitator list (worker/src/facilitators.js): only switched-on, not deleted names are offered
// Phase 24 (one name, one place), as the server: each facilitator has a permanent id; every spelling it has had stays in
// facNames (name → id), so an old one still finds it and is never given to somebody else
var facs, facNames, facSeq;                                 // var: reset() (above) fills it before this line runs
function facReset() {
  facSeq = 0; facNames = new Map();
  facs = ['Natvar Gopinath Prabhuji', 'Vilasa Padmanabha Prabhuji', 'Jaya Vamandev Prabhuji', 'Ankit Narula Prabhuji'].map((name) => newFac(name, 'DASHBOARD'));
}
function newFac(name, source, by = '') {
  const f = { id: 'F' + String(++facSeq).padStart(3, '0'), name, source, active: true, deleted: false, changedBy: by, changedAt: by ? ist() : '' };
  facNames.set(name, f.id);
  return f;
}
facs || facReset();
const offered = () => facs.filter((f) => f.active && !f.deleted).map((f) => f.name);
const facIdOf = (name) => facNames.get(String(name ?? '')) || '';
const facNameOf = (id) => facs.find((f) => f.id === id)?.name;
// the version of the names a phone holds (auth.me / home.get versions.names, meta.get version): moves when a name does
const namesV = () => { let x = 0; for (const c of JSON.stringify([offered(), db.batches.map((b) => [b.batchId, b.name, !!b.active, b.closedAt || ''])])) x = (x * 31 + c.charCodeAt(0)) | 0; return String(x >>> 0); };
// the login that IS a facilitator: their facilitator name is theirs and the names are the same (one person, one name)
const loginOfFac = (f) => Object.values(db.users).find((x) => x.facilitatorName === f.name && x.name === f.name && x.status !== 'DISABLED');
const facView = (f) => {
  const members = Object.values(db.users).filter((x) => x.role === 'DEVOTEE' && ['ACTIVE', 'INACTIVE'].includes(x.status) && x.facilitator === f.name).length;
  const waiting = Object.values(db.users).filter((x) => x.status === 'PENDING' && x.facilitator === f.name).length;
  const acct = Object.values(db.users).find((x) => x.facilitatorName === f.name && x.status === 'ACTIVE');
  return { name: f.name, active: f.active, source: f.source, members, waiting, changedBy: f.changedBy, changedAt: f.changedAt,
           temporary: acct?.facilitation === 'temporary', login: acct?.login || '' };
};
/** Why `name` cannot be facilitator f's name ('' = free): another's current name, or another's earlier spelling. */
const facClash = (f, name) => {
  const other = facs.find((x) => x !== f && x.name.toLowerCase() === name.toLowerCase());
  if (other) return other.deleted ? `${other.name} was a facilitator once and was removed; choose another name.` : `${other.name} is already on the list.`;
  for (const [n, id] of facNames) if (n.toLowerCase() === name.toLowerCase() && id !== f.id) return `${name} was an earlier name of ${facNameOf(id) || 'another facilitator'}; choose another name.`;
  return '';
};
/** renamePerson (worker/src/names.js): the facilitator row, the login that IS them, and every reference — the mock keeps
 *  names on its records, so it moves them all, open and closed, which is what the server's id reads show. */
function renameFac(f, name, by) {
  const old = f.name, me = loginOfFac(f);
  if (me) me.name = name;
  for (const x of Object.values(db.users)) {
    if (x.facilitatorName === old) x.facilitatorName = name;
    if (x.facilitator === old) x.facilitator = name;
    for (const m of x.memberships || []) if (m.facilitator === old) m.facilitator = name;
  }
  facNames.set(name, f.id);
  Object.assign(f, { name, source: 'APP', changedBy: by, changedAt: ist() });
}
/** A person's own rename (profile.update, coordinators.update): '' when done, else why not. */
function renamePerson(u, name) {
  const f = facs.find((x) => !x.deleted && x.name === u.name && u.facilitatorName === x.name);
  if (f && name !== f.name) { const why = facClash(f, name); if (why) return why; renameFac(f, name, u.login); return ''; }
  u.name = name;
  return '';
}
// ADR 0010: an enrolment puts the trainee's name on the list; taking it back switches it off unless somebody else holds it
const offerFacilitator = (name) => { const f = facs.find((x) => x.name === name); if (!f) facs.push(newFac(name, 'APP')); };
const withdrawFacilitator = (name, login) => { const f = facFind(name);
  if (f && !Object.values(db.users).some((x) => x.login !== login && x.facilitatorName === name && x.status === 'ACTIVE')) f.active = false; };
const facFind = (n) => facs.find((f) => f.name === String(n ?? '') && !f.deleted);
A['facilitators.list'] = [['MASTER', 'FTP'], () => { const l = facs.filter((f) => !f.deleted).map(facView); return ok({ facilitators: l, counts: { on: l.filter((f) => f.active).length, off: l.filter((f) => !f.active).length } }); }];
A['facilitators.add'] = [['MASTER', 'FTP'], (d, u) => {
  const name = String(d.name ?? '').replace(/\s+/g, ' ').trim();
  if (!/^[A-Za-z][A-Za-z .']{2,59}$/.test(name)) return fieldFail([['name', 'Letters, spaces, dots and apostrophes, 3 to 60 characters.']]);
  const same = facs.find((f) => f.name.toLowerCase() === name.toLowerCase());
  if (same && !same.deleted) return fieldFail([['name', `${same.name} is already on the list${same.active ? '' : ' (switched off)'}.`]]);
  const was = !same && [...facNames].find(([n]) => n.toLowerCase() === name.toLowerCase());
  if (was) return fieldFail([['name', `${name} was an earlier name of ${facNameOf(was[1])}; choose another name.`]]);
  if (same) Object.assign(same, { deleted: false, active: true, changedBy: u.login, changedAt: ist() });
  else facs.push(newFac(name, 'APP', u.login));
  return ok(facView(same || facs[facs.length - 1]));
}];
A['facilitators.setActive'] = [['MASTER', 'FTP'], (d, u) => {
  const f = facFind(d.name);
  if (!f) return fail('NOT_FOUND', 'No facilitator ' + d.name + ' on the list.');
  Object.assign(f, { active: !!d.active, changedBy: u.login, changedAt: ist() });
  return ok(facView(f));
}];
// ADR 0014 A + Phase 24 (worker facilitators.js rename): the one row is renamed and every reference follows it; the
// login that IS the facilitator takes the name too (one person, one name); the old spelling still finds them
A['facilitators.rename'] = [['MASTER', 'FTP'], (d, u) => {
  const f = facFind(d.name);
  if (!f) return fail('NOT_FOUND', 'No facilitator ' + d.name + ' on the list.');
  const name = String(d.newName ?? '').replace(/\s+/g, ' ').trim();
  if (!/^[A-Za-z][A-Za-z .']{2,59}$/.test(name)) return fieldFail([['newName', 'Letters, spaces, dots and apostrophes, 3 to 60 characters.']]);
  if (name === f.name) return fieldFail([['newName', 'That is the name it has now.']]);
  const why = facClash(f, name);
  if (why) return fieldFail([['newName', why]]);
  const old = f.name, users = Object.values(db.users);
  const moved = { students: users.filter((x) => (x.memberships || []).some((m) => !m.toWeek && m.facilitator === old) || (x.role === 'DEVOTEE' && x.status !== 'PENDING' && !x.memberships && x.facilitator === old)).length,
                  logins: users.filter((x) => x.facilitatorName === old).length, waiting: users.filter((x) => x.status === 'PENDING' && x.facilitator === old).length };
  renameFac(f, name, u.login);
  return ok({ ...facView(f), was: old, moved });
}];
// ADR 0014 C: what FTP will grant, by the head until then
A['facilitators.setLasting'] = [['MASTER', 'FTP'], (d) => {
  const f = facFind(d.name);
  if (!f) return fail('NOT_FOUND', 'No facilitator ' + d.name + ' on the list.');
  const x = Object.values(db.users).find((y) => y.facilitatorName === f.name && y.status === 'ACTIVE');
  if (!x) return fail('NOT_FOUND', `${f.name} has no account facilitating under that name.`);
  x.facilitation = 'lasting';
  return ok(facView(f));
}];
A['facilitators.delete'] = [['MASTER'], (d, u) => {
  const f = facFind(d.name);
  if (!f) return fail('NOT_FOUND', 'No facilitator ' + d.name + ' on the list.');
  if (f.active) return fail('CONFLICT', 'Switch ' + f.name + ' off first; only a switched-off facilitator can be deleted.');
  Object.assign(f, { deleted: true, changedBy: u.login, changedAt: ist() });
  return ok({ name: f.name, deleted: true });
}];
// The sign-up list leaves trainings out (offeredAtSignup === 0) and staffBatches keeps them, exactly as the
// server does. The mock used to return one list for both, so the checks could not see the bug that hid a
// training's Students tab from its own coordinator (17 Oct 2026).
A['meta.get'] = [null, (d, token) => ok({
  version: namesV(),
  batches: db.batches.filter((b) => b.active && b.offeredAtSignup !== 0).map((b) => ({ batchId: b.batchId, name: b.name, coordinatorName: coordName(b) })),
  // a closed batch leaves the staff list too (admin.js meta); a training carries its dates and status (Phase 22, J1)
  staffBatches: token ? db.batches.filter((b) => b.active && !b.closedAt).map((b) => ({ batchId: b.batchId, name: b.name, level: b.level || '', coordinatorName: coordName(b), ...trainingDates(b) })) : undefined,
  facilitators: offered(),
  classDays: [{ id: 'SUN', name: 'Sunday' }, { id: 'SAT', name: 'Saturday' }],
  push: { publicKey: 'BGDhgIxfw89gjwuubVs4PPOwGclzUfUU2se1Sq9PQCGP_xAmDk5RCEJEtESgS0KEt4oC5tGdop9am7k6MteTJ-s', time: admin.reminderTime() },
  submitWindow: admin.submitWindow(),          // the master setting, so the app's wording follows it
  minApp: '0',
})];

// Sign-up step 1 (11 Oct 2026): the number is looked up as it is typed. Only a MASKED name comes back —
// the endpoint is public and there is no OTP, so whoever typed the number is not yet known to be its owner.
// 6000000177 is the devotee we already hold; every other number is unknown.
A['auth.lookup'] = [null, (d) => {
  const phone = String(d.phone || '');
  if (!/^[6-9]\d{9}$/.test(phone)) return fieldFail([['phone', 'Enter the 10-digit mobile number.']]);
  if (phone === '6000000001') return ok({ found: false, hasAccount: true });
  if (phone === '6000000177') return ok({ found: true, hasAccount: false, maskedName: 'M•••• S••••', connectedSinceLocked: true });
  return ok({ found: false, hasAccount: false });
}];

A['auth.signUp'] = [null, (d) => {
  const f = [];
  const p = d.profile || {};
  const em = p.emergency || {};
  if (!/^[6-9]\d{9}$/.test(d.phone || '')) f.push(['phone', 'Enter a 10-digit mobile number']);
  if (!/^[\p{L} ]{2,60}$/u.test(d.name || '')) f.push(['name', 'Use 2 to 60 letters and spaces']);
  if (!db.batches.some((b) => b.batchId === d.batchId && b.active)) f.push(['batchId', 'Choose your batch']);
  if (typeof d.password !== 'string' || d.password.length < 8 || d.password.length > 64) f.push(['password', 'Use 8 to 64 characters']);
  else if (d.password === d.phone) f.push(['password', 'Password cannot be your phone number']);
  else if (['password', '12345678', 'password1', 'qwerty123'].includes(d.password.toLowerCase())) f.push(['password', 'This password is too common']);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.dob || '');
  const age = m ? Math.floor((Date.now() - new Date(p.dob)) / 31557600000) : null;
  if (age === null || age < 15 || age > 80) f.push(['profile.dob', age !== null && age < 15 ? 'You must be at least 15 to sign up.' : 'Check your date of birth.']);
  // 15–17: a parent or guardian agrees (8 Oct 2026), as the server
  const pc = d.parentConsent || {};
  if (age !== null && age >= 15 && age < 18) {
    if (!/^[\p{L} ]{2,60}$/u.test(pc.name || '')) f.push(['parentConsent.name', 'Use 2 to 60 letters and spaces']);
    if (!/^[6-9]\d{9}$/.test(pc.phone || '')) f.push(['parentConsent.phone', 'Enter a 10-digit mobile number']);
    else if (pc.phone === d.phone) f.push(['parentConsent.phone', "Use your parent's or guardian's own number"]);
  }
  if (!['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', "Don't know"].includes(p.bloodGroup)) f.push(['profile.bloodGroup', 'Choose a blood group']);
  if (!/^[\p{L} ]{2,60}$/u.test(em.name || '')) f.push(['profile.emergency.name', 'Use 2 to 60 letters and spaces']);
  if (!em.relation) f.push(['profile.emergency.relation', 'Choose the relation']);
  if ('connectedSince' in p && !/^\d{4}$/.test(p.connectedSince || '')) f.push(['profile.connectedSince', 'Choose the year you first came to IYF Delhi (this year if you are new).']);
  if (!/^[6-9]\d{9}$/.test(em.phone || '')) f.push(['profile.emergency.phone', 'Enter a 10-digit mobile number']);
  else if (em.phone === d.phone) f.push(['profile.emergency.phone', 'Use a different number from your own']);
  f.push(...Object.entries(addressErrors(p.address, 'profile.address')));
  if (!offered().includes(d.facilitator)) f.push(['facilitator', 'Choose your facilitator from the list.']);
  if (!['SUN', 'SAT'].includes(d.classDay)) f.push(['classDay', 'Choose your class day: Sunday or Saturday.']);
  const email = normEmail(d.email);
  if (!email) f.push(['email', 'Enter a valid email address.']);
  const whatsapp = normWhatsapp(d.whatsapp);
  if (whatsapp === null) f.push(['whatsapp', 'Enter a 10-digit WhatsApp number, or leave it empty.']);
  if (f.length) return fieldFail(f);
  const em2 = emailProblem(email) || (/@(example\.invalid|nomail\.test)$/.test(email) ? `${email.split('@')[1]} cannot receive email. Check the spelling of your email.` : '');
  if (em2) return fieldFail([['email', em2]]);
  if (db.users[d.phone] && db.users[d.phone].status !== 'REJECTED') return fail('CONFLICT', 'This number already has an account. Log in, or use Forgot password.');
  db.users[d.phone] = { login: d.phone, role: 'DEVOTEE', name: d.name.trim(), password: d.password, status: 'PENDING', batchId: d.batchId, at: ist(), profile: { ...p, address: cleanAddress(p.address) }, facilitator: d.facilitator, classDay: d.classDay, email, whatsapp,
    ...(age < 18 && pc.name ? { parentName: pc.name.trim(), parentPhone: pc.phone } : {}) };
  return ok({ status: 'PENDING' });
}];

A['auth.login'] = [null, (d) => {
  const u = db.users[String(d.login || '')];
  if (u && u.lockedUntil && Date.parse(u.lockedUntil) > Date.now()) return fail('LOCKED_OUT', 'Too many wrong tries.', { data: { until: u.lockedUntil } });
  if (!u || u.password !== d.password) {
    if (u) {
      u.fails = (u.fails || 0) + 1;
      if (u.fails >= 5) { u.fails = 0; u.lockedUntil = new Date(Date.now() + 15 * 60e3).toISOString(); return fail('LOCKED_OUT', 'Too many wrong tries.', { data: { until: u.lockedUntil } }); }
    }
    return fail('BAD_CREDENTIALS', 'Phone or password is wrong');
  }
  u.fails = 0;
  if (u.status === 'PENDING') return fail('PENDING_APPROVAL', "Your sign-up is waiting for your coordinator's approval.", { details: { firstName: u.name.split(' ')[0], batchName: db.batches.find((b) => b.batchId === u.batchId)?.name || u.batchId, facilitatorName: u.facilitator || null, requestedAt: u.at } });
  if (u.status === 'REJECTED') return fail('REJECTED', `Your sign-up was not approved${u.rejectReason ? ': ' + u.rejectReason : '.'} Please speak to your coordinator.`, { details: { firstName: u.name.split(' ')[0], batchName: db.batches.find((b) => b.batchId === u.batchId)?.name || u.batchId, facilitatorName: u.facilitator || null, requestedAt: u.at, reason: u.rejectReason || null } });
  if (u.status === 'DISABLED') return fail('ACCOUNT_DISABLED', 'This account is disabled. Please contact your coordinator.');
  // the server (auth.js): an INACTIVE account is one that left a closed intake or was left so by the old rule
  if (u.status === 'INACTIVE') return fail('ACCOUNT_DISABLED', 'This login is not in use now. Please speak to your coordinator.');
  const token = 'tok_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  sessions.set(token, u.login);
  u.lastLogin = ist();
  // signing in brings back someone the app made inactive (worker auth.js, ADR 0020)
  if (u.autoInactive) mockCameBackApp(u.login);
  const payload = { token, expiresAt: ist(new Date(Date.now() + 30 * 864e5)), user: userView(u) };
  return ok(payload); // mustChangePassword travels in payload.user
}];

/* Decision 46: the request carries the phone number only. `newPassword` is still accepted from an older app
   and IGNORED — the real API keeps it in the field whitelist for exactly that reason, because an unknown
   field is a hard BAD_REQUEST and removing it would break every installed app. */
A['auth.requestReset'] = [null, (d) => {
  const u = db.users[String(d.login || '')];
  if (u && u.status === 'ACTIVE' && u.role !== 'MASTER') {
    db.resets = db.resets.filter((r) => r.login !== u.login);
    db.resets.push({ login: u.login, name: u.name, at: ist() });      // no password here any more
  }
  return ok({ status: 'RESET_REQUESTED' });
}];

const ANY = ['DEVOTEE', 'COORDINATOR', 'MASTER'];
A['auth.me'] = [ANY, (d, u) => ok({ user: userView(u), versions: { rules: 'r0', journals: 'j0', names: namesV() }, today: ist().slice(0, 10), openWeeks: [] }), true];
A['auth.logout'] = [ANY, (d, u, token) => { sessions.delete(token); return ok(); }, true];
// every device of this account, this one included (auth.js logoutAll)
A['auth.logoutAll'] = [ANY, (d, u) => { let n = 0; for (const [t, l] of [...sessions]) if (l === u.login) { sessions.delete(t); n++; } return ok({ devices: n }); }];
// The devices this account is signed in on, and ending one of them from another (18 Oct 2026).
// The mock holds one session per login, so this shows the one device — enough to prove the screen
// draws, the row says "this device", and signing it out logs you straight out.
A['auth.sessions'] = [ANY, (d, u, token) => ok({ devices: [...sessions.entries()]
  .filter(([, l]) => l === u.login)
  .map(([t]) => ({ id: t.slice(0, 16), device: 'This browser', thisOne: t === token,
                   signedInAt: ist(nowD()), lastUsedAt: ist(nowD()), expiresAt: ist(nowD()) })) })];
A['auth.sessionEnd'] = [ANY, (d, u, token) => {
  const hit = [...sessions.entries()].find(([t, l]) => l === u.login && t.slice(0, 16) === String(d.id || ''));
  if (!hit) return fail('NOT_FOUND', 'That device is already signed out.');
  sessions.delete(hit[0]);
  return ok({ ended: true, thisOne: hit[0] === token });
}];
A['auth.changePassword'] = [ANY, (d, u) => {
  if (u.password !== d.current) return fail('BAD_CREDENTIALS', 'Your current password is wrong');
  if (typeof d.new !== 'string' || d.new.length < 8 || d.new.length > 64) return fieldFail([['new', 'Use 8 to 64 characters']]);
  if (d.new === u.login) return fieldFail([['new', 'Password cannot be your phone number']]);
  if (d.new === d.current) return fieldFail([['new', 'Choose a different password']]);
  u.password = d.new;
  u.mustChange = false;
  for (const [t, l] of sessions) if (l === u.login && t !== d.__token) sessions.delete(t);
  return ok();
}, true];
// a devotee deletes their own account (worker/src/erase.js), checked in the server's order: 5 tries in 15 minutes and
// it waits; staff ask the IYF head first; the password; the word DELETE. Every session of the person ends; the login is gone.
A['account.delete'] = [ANY, (d, u) => {
  const tries = (u.deleteTries || []).filter((t) => Date.now() - t < 15 * 60e3);
  if (tries.length >= 5) return fail('BUSY', 'Too many tries. Please wait 15 minutes and try again.');
  u.deleteTries = [...tries, Date.now()];
  if (u.role !== 'DEVOTEE' || u.facilitatorName) return fail('FORBIDDEN', 'Ask the IYF head to remove your role first.');
  if (u.password !== d.password) return fail('BAD_CREDENTIALS', 'Your password is wrong.');
  if (String(d.confirm ?? '').trim().toUpperCase() !== 'DELETE') return fieldFail([['confirm', 'Type DELETE to confirm.']], 'Type DELETE to confirm.');
  for (const [t, l] of sessions) if (l === u.login) sessions.delete(t);
  for (const r of db.registry) if (r.linked === u.login) r.linked = null;
  share?.forget(u.login);           // worker erase.js: their shares go, both ways
  delete db.users[u.login];
  return ok();
}];

// ---- coordinator / master ----
const STAFF = ['COORDINATOR', 'MASTER'];
const inScope = (u, batchId) => batchIdsOf(u).includes(batchId);

A['requests.list'] = [STAFF, (d, u) => {
  if (d.batchId && !inScope(u, d.batchId)) return fail('FORBIDDEN', 'That batch is not yours.');
  const scope = d.batchId ? [d.batchId] : batchIdsOf(u);
  const signUps = Object.values(db.users)
    .filter((x) => x.role === 'DEVOTEE' && x.status === 'PENDING' && scope.includes(x.batchId))
    .map((x) => ({ phone: x.login, name: x.name, batchId: x.batchId, at: x.at, profile: x.profile, facilitator: x.facilitator || null, classDay: x.classDay || null, email: x.email || '', whatsapp: x.whatsapp || '', matches: matchesFor(x), ...(x.parentName ? { parentName: x.parentName, parentPhone: x.parentPhone } : {}) }));
  const resets = db.resets
    .filter((r) => { const t = db.users[r.login]; return t && (u.role === 'MASTER' || (t.role === 'DEVOTEE' && scope.includes(t.batchId))); })
    .map(({ login, name, at }) => ({ login, name, role: db.users[login].role, at }));
  return ok({ signUps, resets });
}];

A['registry.search'] = [STAFF, (d) => {
  if (typeof d.q !== 'string' || d.q.trim().length < 3) return fieldFail([['q', 'Type at least 3 characters']]);
  return ok({ results: search(d.q).map(regRow) });
}];

A['requests.approve'] = [STAFF, (d, u) => {
  const t = db.users[d.phone];
  if (!t || t.role !== 'DEVOTEE' || t.status !== 'PENDING') return fail('NOT_FOUND', 'That sign-up is no longer waiting.');
  if (!inScope(u, t.batchId)) return fail('FORBIDDEN', 'That batch is not yours.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.levelEntryDate || '')) return fieldFail([['levelEntryDate', 'Choose a date']]);
  if (!d.link || (!d.link.iyfId && !d.link.noIdYet)) return fail('BAD_REQUEST', 'Something went wrong');
  const fac = d.facilitator ?? t.facilitator;
  if (!offered().includes(fac)) return fieldFail([['facilitator', fac === t.facilitator ? `${fac} is no longer on the facilitator list. Choose the facilitator from the list.` : 'Choose the facilitator from the list.']]);
  const cd = d.classDay ?? t.classDay;
  if (!['SUN', 'SAT'].includes(cd)) return fieldFail([['classDay', 'Choose the class day: Sunday or Saturday.']]);
  let row = null;
  if (d.link.iyfId) {
    row = db.registry.find((r) => r.iyfId === d.link.iyfId);
    if (!row) return fail('UNKNOWN_ID', 'That IYF ID was never allocated.');
    if (row.mergedInto) return fail('UNKNOWN_ID', `That ID was merged into ${row.mergedInto}. Use ${row.mergedInto} instead.`, { data: { mergedInto: row.mergedInto } });
    if (row.linked) return fail('CONFLICT', 'That ID is already linked to another account.');
    row.linked = t.login;
    t.iyfId = row.iyfId;
  }
  t.status = 'ACTIVE';
  t.levelEntryDate = d.levelEntryDate;
  t.facilitator = fac; t.classDay = cd;
  return ok({ iyfId: row ? row.iyfId : null, linked: !!row });
}];

A['requests.reject'] = [STAFF, (d, u) => {
  const t = db.users[d.phone];
  if (!t || t.role !== 'DEVOTEE' || t.status !== 'PENDING') return fail('NOT_FOUND', 'That sign-up is no longer waiting.');
  if (!inScope(u, t.batchId)) return fail('FORBIDDEN', 'That batch is not yours.');
  if (typeof d.reason !== 'string' || d.reason.trim().length < 2) return fieldFail([['reason', 'Give a reason']]);
  t.status = 'REJECTED';
  t.rejectReason = d.reason.trim();
  return ok();
}];

/* Decision 46: APPROVING generates the password here, as the server does, and returns it once. The same
   readable alphabet (no 0/O, 1/l/I, 5/S, 8/B) and the same nnnn-nnnn-nnnn shape, so the dialog looks in the
   mock exactly as it will in production. The mock is not a security boundary, so Math.random is fine here;
   the real one uses crypto.getRandomValues (worker/src/crypto.js newTempPassword). */
const TEMP_CHARS = 'abcdefghjkmnpqrtuvwxyz234679';
const mockTempPassword = () => [0, 1, 2]
  .map(() => Array.from({ length: 4 }, () => TEMP_CHARS[Math.floor(Math.random() * TEMP_CHARS.length)]).join(''))
  .join('-');

function resetOp(approve) {
  return [STAFF, (d, u) => {
    const r = db.resets.find((x) => x.login === d.login);
    const t = db.users[d.login];
    if (!r || !t) return fail('NOT_FOUND', 'That reset request is gone.');
    const allowed = u.role === 'MASTER' || (t.role === 'DEVOTEE' && inScope(u, t.batchId));
    if (!allowed) return fail('FORBIDDEN', 'That request is not for your batch.');
    let out = {};
    if (approve) {
      const temp = mockTempPassword();
      t.password = temp;
      t.mustChange = true;                                  // the temporary password gets them in, no further
      for (const [tok, l] of sessions) if (l === t.login) sessions.delete(tok);
      out = { tempPassword: temp, expiresInHours: 24, name: t.name || '', login: t.login,
              whatsapp: t.whatsapp || '', shownOnce: true,
              expiresAt: ist() };
    }
    db.resets = db.resets.filter((x) => x !== r);
    return ok(out);
  }];
}
A['resets.approve'] = resetOp(true);
A['resets.reject'] = resetOp(false);

// ---- master only ----
const MASTER = ['MASTER'];
const coordRow = (u) => ({ username: u.login, name: u.name, phone: u.phone || null, batchIds: batchIdsOf(u), status: u.status, mustChangePassword: !!u.mustChange, lastLogin: u.lastLogin || null, master: u.role === 'MASTER' || !!u.isMaster , ftp: !!u.grants?.['@ftp'] });
const phoneBad = (p) => p !== undefined && p !== null && p !== '' && !/^[6-9]\d{9}$/.test(p);
function assign(username, batchIds) {
  for (const b of db.batches) {
    if (batchIds.includes(b.batchId)) b.coordinator = username;
    else if (b.coordinator === username) b.coordinator = null;
  }
}
const badBatches = (ids) => !Array.isArray(ids) || ids.some((i) => !db.batches.some((b) => b.batchId === i));
const tempPwProblem = (p) => (typeof p !== 'string' || p.length < 8 || p.length > 64 ? 'Use 8 to 64 characters' : '');

// both admin lists in one call, as the server's admin.lists
A['admin.lists'] = [['MASTER'], (d, u) => ({ ok: true, data: { coordinators: A['coordinators.list'][1](d, u).data, batches: A['batches.list'][1](d, u).data } })];

A['coordinators.list'] = [MASTER, () => ok(Object.values(db.users).filter((u) => u.role === 'COORDINATOR' && !u.facilitatorName).map(coordRow))];
// head access for a staff member (admin.js mastersSet); mockphase9 wraps it with the other heads' approval
A['masters.set'] = [MASTER, (d) => {
  const x = db.users[String(d.login || '')];
  if (!x || !['COORDINATOR', 'MASTER'].includes(x.role)) return fail('NOT_FOUND', 'No such staff member.');
  if (typeof d.master !== 'boolean') return fieldFail([['master', 'Choose yes or no.']]);
  if (String(d.reason || '').trim().length < 2) return fieldFail([['reason', 'Give a short reason.']]);
  const isHead = (u) => u.status === 'ACTIVE' && (u.role === 'MASTER' || !!u.isMaster);
  if (!d.master && x.login === 'master') return fail('CONFLICT', 'The recovery login always stays a master.');
  if (!d.master && isHead(x) && Object.values(db.users).filter(isHead).length <= 1) return fail('CONFLICT', 'There must always be at least one master.');
  if (x.role === 'COORDINATOR') x.isMaster = d.master;
  return ok({ coordinator: coordRow(x) });
}];
A['coordinators.create'] = [MASTER, (d) => {
  const f = [];
  if (!/^[a-z0-9._-]{3,30}$/.test(d.username || '')) f.push(['username', 'Use 3 to 30 lowercase letters, digits, . _ -']);
  if (!/^[\p{L} ]{2,60}$/u.test(d.name || '')) f.push(['name', 'Use 2 to 60 letters and spaces']);
  if (badBatches(d.batchIds)) f.push(['batchIds', 'Choose valid batches']);
  // an FTP coordinator: no batches, the FTP role at once (worker admin.js coordinatorsCreate, 27 Oct 2026)
  if (d.ftp === true && (d.batchIds || []).length) f.push(['batchIds', 'An FTP coordinator has no batches: they look after the facilitators.']);
  const tp = tempPwProblem(d.tempPassword);
  if (tp) f.push(['tempPassword', tp]);
  if (phoneBad(d.phone)) f.push(['phone', 'Enter a 10-digit mobile number']);
  if (f.length) return fieldFail(f);
  if (db.users[d.username]) return fail('CONFLICT', 'That username is already taken.');
  db.users[d.username] = { login: d.username, role: 'COORDINATOR', name: d.name.trim(), password: d.tempPassword, status: 'ACTIVE', mustChange: true, phone: d.phone || null,
    ...(d.ftp === true ? { grants: { '@ftp': { until: '', at: '', by: 'master', reason: '' } } } : {}) };
  assign(d.username, d.batchIds || []);
  return ok({ coordinator: coordRow(db.users[d.username]) });
}];
A['coordinators.update'] = [MASTER, (d) => {
  const u = db.users[d.username];
  if (!u || u.role !== 'COORDINATOR') return fail('NOT_FOUND', 'No such coordinator.');
  if (d.name !== undefined && !/^[\p{L} ]{2,60}$/u.test(d.name)) return fieldFail([['name', 'Use 2 to 60 letters and spaces']]);
  if (d.batchIds !== undefined && badBatches(d.batchIds)) return fieldFail([['batchIds', 'Choose valid batches']]);
  if (phoneBad(d.phone)) return fieldFail([['phone', 'Enter a 10-digit mobile number']]);
  if (d.name !== undefined) renamePerson(u, d.name.trim());          // the one rename (worker names.js): their posts follow
  if (d.phone !== undefined) u.phone = d.phone || null;
  if (d.batchIds !== undefined) assign(u.login, d.batchIds); // moving a batch ends the old coordinator's access at once
  return ok({ coordinator: coordRow(u) });
}];
A['coordinators.setDisabled'] = [MASTER, (d) => {
  const u = db.users[d.username];
  if (!u || u.role !== 'COORDINATOR') return fail('NOT_FOUND', 'No such coordinator.');
  u.status = d.disabled ? 'DISABLED' : 'ACTIVE';
  if (d.disabled) for (const [t, l] of sessions) if (l === u.login) sessions.delete(t);
  return ok({ coordinator: coordRow(u) });
}];
A['coordinators.resetPassword'] = [MASTER, (d) => {
  const u = db.users[d.username];
  if (!u || u.role !== 'COORDINATOR') return fail('NOT_FOUND', 'No such coordinator.');
  const tp = tempPwProblem(d.tempPassword);
  if (tp) return fieldFail([['tempPassword', tp]]);
  u.password = d.tempPassword;
  u.mustChange = true;
  for (const [t, l] of sessions) if (l === u.login) sessions.delete(t);
  return ok({ coordinator: coordRow(u) });
}];

// a training batch (ETP-21) and where it stands, as the server's admin.js isTrainingBatch / trainingStatus (Phase 22, J1)
const isTrainingBatch = (id) => /^ETP-\d{1,4}$/.test(String(id || ''));
const todayIst = () => isoIst(nowD()).slice(0, 10);
const trainingStatus = (b, today = todayIst()) => (b.closedAt ? 'ENDED' : b.endsOn && today > b.endsOn ? 'PAST_END' : 'RUNNING');
const trainingDates = (b) => (isTrainingBatch(b.batchId) ? { startedOn: b.startedOn || '', endsOn: b.endsOn || '', status: trainingStatus(b) } : {});
const batchRow = (b) => ({
  batchId: b.batchId, name: b.name, level: b.batchId, active: b.active, pilot: !!b.pilot, standing: true,
  coordinatorLogins: b.coordinator ? [b.coordinator] : [], coordinatorNames: b.coordinator ? [coordName(b)] : [],
  ...(b.startedOn !== undefined ? { startedOn: b.startedOn || '', closedAt: b.closedAt || '' } : {}),
  ...(isTrainingBatch(b.batchId) ? { endsOn: b.endsOn || '', status: trainingStatus(b) } : {}),
});
const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** As the server's trainingEndProblem: only a training has an end date; a date; after the start; required for a new one. */
const trainingEndProblem = (training, endsOn, startsOn, required) => {
  if (!training) return endsOn ? ['endsOn', 'Only a training batch has an end date.'] : null;
  if (!endsOn) return required ? ['endsOn', 'When does this training end?'] : null;
  if (!YMD.test(endsOn) || isNaN(Date.parse(endsOn))) return ['endsOn', 'A date, as 2026-12-31.'];
  if (YMD.test(startsOn) && endsOn <= startsOn) return ['endsOn', 'The end comes after the start.'];
  return null;
};
A['batches.list'] = [MASTER, () => ok(db.batches.map(batchRow))];
A['batches.update'] = [MASTER, (d) => {
  const b = db.batches.find((x) => x.batchId === d.batchId);
  if (!b) return fail('NOT_FOUND', 'No such batch.');
  if (d.name !== undefined && (typeof d.name !== 'string' || d.name.trim().length < 2 || d.name.length > 40)) return fieldFail([['name', 'Use 2 to 40 characters']]);
  if (d.coordinatorLogins !== undefined && (!Array.isArray(d.coordinatorLogins) || d.coordinatorLogins.some((l) => db.users[l]?.role !== 'COORDINATOR'))) return fieldFail([['coordinatorLogins', 'Choose coordinators']]);
  // a training's dates (Phase 22, J1; admin.js batchesUpdate): the head moves them while it runs; an ended one's are a record
  let start = b.startedOn || '', end = b.endsOn || '';
  if (d.startedOn !== undefined || d.endsOn !== undefined) {
    if (!isTrainingBatch(b.batchId)) return fieldFail([[d.endsOn !== undefined ? 'endsOn' : 'startedOn', 'Only a training batch has its own dates here.']]);
    if (b.closedAt) return fail('CONFLICT', `${b.name} has ended; its dates are a record now.`);
    if (d.startedOn !== undefined) {
      start = String(d.startedOn).trim();
      if (!YMD.test(start) || isNaN(Date.parse(start))) return fieldFail([['startedOn', 'A date, as 2026-01-05.']]);
      if (start > todayIst()) return fieldFail([['startedOn', 'A batch starts today or earlier, never on a future date.']]);
    }
    if (d.endsOn !== undefined) end = String(d.endsOn).trim();
    const p = trainingEndProblem(true, end, start, d.endsOn !== undefined);
    if (p) return fieldFail([p]);
  }
  if (d.startedOn !== undefined) b.startedOn = start;
  if (d.endsOn !== undefined) b.endsOn = end;
  if (d.name !== undefined) b.name = d.name.trim();
  if (d.active !== undefined) b.active = !!d.active;
  if (d.pilot !== undefined) b.pilot = !!d.pilot;
  if (d.coordinatorLogins !== undefined) b.coordinator = d.coordinatorLogins[0] || null; // mock keeps one coordinator per batch
  return ok(batchRow(b));
}];

// as the server's admin.js batchesCreate: a numbered intake (VL2-51, VL3-51, ETP-22) or a class batch of a level
const VEDIC_IDS = { VL2: 'Vedic Level 2', VL3: 'Vedic Level 3', ETP: 'ETP' };
A['batches.create'] = [MASTER, (d) => {
  const f = [], id = String(d.batchId || '').trim().toUpperCase(), name = String(d.name || '').replace(/\s+/g, ' ').trim();
  const vedic = (id.match(/^(VL[23]|ETP)-\d{1,4}$/) || [])[1] || null, level = String(d.level || '');
  if (!vedic && !/^[A-Z][A-Z0-9]{1,7}$/.test(id)) f.push(['batchId', '2–8 capital letters or digits, starting with a letter (e.g. SPS3) — or VL2-51 for a Vedic Level intake.']);
  else if (db.batches.some((x) => x.batchId === id)) f.push(['batchId', `There is already a batch ${id}.`]);
  if (name.length < 2 || name.length > 40) f.push(['name', 'Give the batch a name.']);
  else if (db.batches.some((x) => x.name.toLowerCase() === name.toLowerCase())) f.push(['name', 'Another batch has this name.']);
  if (!vedic && !['SPS', 'DPS', 'BSS', 'BVS', 'TRD'].includes(level)) f.push(['level', 'Choose the level.']);
  if (vedic && level && level !== vedic) f.push(['level', `${id} is a ${VEDIC_IDS[vedic]} batch.`]);
  if (d.startedOn !== undefined && d.startedOn !== '' && !YMD.test(String(d.startedOn))) f.push(['startedOn', 'A date, as 2026-01-05.']);
  if (d.startedOn && YMD.test(String(d.startedOn)) && String(d.startedOn) > todayIst()) f.push(['startedOn', 'A batch starts today or earlier, never on a future date.']);
  const training = isTrainingBatch(id), endsOn = String(d.endsOn ?? '').trim();
  const ep = trainingEndProblem(training, endsOn, String(d.startedOn || '').trim() || todayIst(), true);
  if (ep) f.push(ep);
  // its coordinators at creation, approved people only (admin.js, Phase 23)
  const coords = Array.isArray(d.coordinatorLogins) ? [...new Set(d.coordinatorLogins.map((l) => String(l).trim().toLowerCase()).filter(Boolean))] : [];
  if (d.coordinatorLogins !== undefined && (!Array.isArray(d.coordinatorLogins) || coords.some((l) => !db.users[l] || !['ACTIVE', 'INACTIVE'].includes(db.users[l].status)))) f.push(['coordinatorLogins', 'No approved person with that login.']);
  if (f.length) return fieldFail(f);
  // the request this batch fulfils (batchreq.js fulfilling): waiting, and for this level
  const fr = d.fromRequest !== undefined ? batchReqs().find((x) => x.id === d.fromRequest) : null;
  if (d.fromRequest !== undefined && !fr) return fieldFail([['fromRequest', 'No such request.']]);
  if (fr && fr.state !== 'WAITING') return fail('CONFLICT', `That request was already ${BR_STATE[fr.state].toLowerCase()}.`);
  if (fr && fr.level !== vedic) return fieldFail([['batchId', `The request was for a ${VEDIC_IDS[fr.level]} batch.`]]);
  const lvl = vedic || level;
  if (fr) Object.assign(fr, { state: 'STARTED', decidedBy: 'master', decidedAt: isoIst(nowD()), batchId: id });
  for (const l of coords.slice(1)) db.users[l].coordinates = [...(db.users[l].coordinates || []), id];
  const b = { batchId: id, name, level: lvl, classDay: 'SUN', active: true, pilot: !!d.pilot, coordinator: coords[0] || null,
    ...(vedic ? { startedOn: String(d.startedOn || '').trim() || todayIst(), closedAt: '' } : {}),
    ...(training ? { endsOn, offeredAtSignup: 0 } : {}),
    // a TRD-level batch asks (and its card scores) the Morning program (Phase 22)
    ...(lvl === 'TRD' ? { templeActivities: true } : {}) };
  db.batches.push(b);
  return ok(batchRow(b));
}];

/* Asking to start a batch (Phase 23; worker batchreq.js): a coordinator asks for a VL-2 / VL-3 intake or a training; the
   head declines here, or approves by creating it (batches.create fromRequest, above). */
const BR_LEVEL = { VL2: 'Vedic Level 2', VL3: 'Vedic Level 3', ETP: 'ETP' };
const BR_STATE = { WAITING: 'Waiting', STARTED: 'Started', DECLINED: 'Declined', WITHDRAWN: 'Withdrawn' };
const batchReqs = () => (db.batchRequests ||= []);
const brView = (r, u) => ({ id: r.id, level: r.level, levelName: BR_LEVEL[r.level], startsOn: r.startsOn, endsOn: r.endsOn, note: r.note, by: r.by,
  byName: db.users[r.by]?.name || r.by, at: r.at, state: r.state, stateName: BR_STATE[r.state], decidedBy: r.decidedBy || '',
  decidedByName: r.decidedBy ? db.users[r.decidedBy]?.name || r.decidedBy : '', decidedAt: r.decidedAt || '', decisionNote: r.decisionNote || '',
  batchId: r.batchId || '', batchName: db.batches.find((b) => b.batchId === r.batchId)?.name || '', mine: r.by === u.login });
A['batchReq.create'] = [STAFF, (d, u) => {
  const f = [], level = String(d.level || '').toUpperCase(), startsOn = String(d.startsOn || '').trim(), endsOn = String(d.endsOn ?? '').trim(), note = String(d.note || '').replace(/\s+/g, ' ').trim();
  if (!BR_LEVEL[level]) f.push(['level', 'Choose VL-2, VL-3 or ETP.']);
  if (!YMD.test(startsOn) || isNaN(Date.parse(startsOn))) f.push(['startsOn', 'A date, as 2026-11-02.']);
  else if (startsOn < todayIst()) f.push(['startsOn', 'The start is today or later.']);
  const ep = BR_LEVEL[level] ? trainingEndProblem(level === 'ETP', endsOn, startsOn, true) : null;
  if (ep) f.push(ep);
  if (note.length > 300) f.push(['note', 'At most 300 characters.']);
  if (f.length) return fieldFail(f);
  if (batchReqs().some((r) => r.by === u.login && r.level === level && r.state === 'WAITING')) return fail('CONFLICT', `You have already asked for a ${BR_LEVEL[level]} batch; it is waiting for the IYF head.`);
  const r = { id: batchReqs().length + 1, level, startsOn, endsOn: level === 'ETP' ? endsOn : '', note, by: u.login, at: isoIst(nowD()), state: 'WAITING' };
  batchReqs().push(r);
  return ok(brView(r, u));
}];
A['batchReq.list'] = [STAFF, (d, u) => {
  const all = batchReqs();
  const rows = u.role === 'MASTER'
    ? [...all.filter((r) => r.state === 'WAITING').sort((a, b) => a.at.localeCompare(b.at)), ...all.filter((r) => r.state !== 'WAITING').sort((a, b) => b.id - a.id).slice(0, 20)]
    : all.filter((r) => r.by === u.login).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
  return ok({ requests: rows.map((r) => brView(r, u)), waiting: rows.filter((r) => r.state === 'WAITING').length });
}];
const brFor = (u, id, own) => {
  const r = batchReqs().find((x) => x.id === id);
  if (!r || (own && r.by !== u.login)) return { err: fail('NOT_FOUND', 'No such request.') };
  if (r.state !== 'WAITING') return { err: fail('CONFLICT', `That request was already ${BR_STATE[r.state].toLowerCase()}.`) };
  return { r };
};
A['batchReq.withdraw'] = [STAFF, (d, u) => {
  const { r, err } = brFor(u, d.id, true); if (err) return err;
  Object.assign(r, { state: 'WITHDRAWN', decidedBy: u.login, decidedAt: isoIst(nowD()) });
  return ok(brView(r, u));
}];
A['batchReq.decide'] = [MASTER, (d, u) => {
  if (d.decision !== 'decline') return fieldFail([['decision', 'Approve by creating the batch in Batch setup; here a request is declined.']]);
  const note = String(d.note || '').replace(/\s+/g, ' ').trim();
  if (note.length < 2) return fieldFail([['note', 'Say why, for the coordinator who asked.']]);
  if (note.length > 300) return fieldFail([['note', 'At most 300 characters.']]);
  const { r, err } = brFor(u, d.id, false); if (err) return err;
  Object.assign(r, { state: 'DECLINED', decidedBy: u.login, decidedAt: isoIst(nowD()), decisionNote: note });
  return ok(brView(r, u));
}];

A['ids.search'] = [MASTER, (d) => {
  if (typeof d.q !== 'string' || d.q.trim().length < 3) return fieldFail([['q', 'Type at least 3 characters']]);
  return ok({ results: search(d.q).map((r) => ({ ...regRow(r), linkedAccount: r.linked ? { login: r.linked, name: db.users[r.linked]?.name || '' } : null })) });
}];

// one lookup for a batch's class day, so no module keeps its own copy of the fact (17 Oct 2026)
const classDayFor = (batchId) => db.batches.find((b) => b.batchId === batchId)?.classDay || 'SUN';
// the batch asks the temple activities (phase 21; batches.temple_activities on the server)
const templeFor = (batchId) => !!db.batches.find((b) => b.batchId === batchId)?.templeActivities;
installWeeks(A, { ok, fail, fieldFail, facIdOf, facNameOf, namesV, birthdaysIn: (b, mds) => staffViews.birthdaysIn(b, mds), scopesOf: (u) => userView(u).scopes, userView, batchIds: () => db.batches.map((b) => b.batchId), user: (l) => db.users[l], nameOf: (l) => db.users[l]?.name || 'Someone', classDayFor, templeFor });
const staffViews = installStaff(A, { ok, fail, fieldFail, renamePerson, db: () => db, trainingsSummary: (f, t) => card?.trainingsSummary?.(f, t) || [], ruleOf: (b, l) => card?.ruleOf?.(b, l) || {}, criteriaLabels: () => card?.criteriaLabels || {}, batchIdsOf, classDayFor, scopesOf: (u) => userView(u).scopes, regRow, facilitators: () => offered(), trainingsOf: (l) => (card?.trainingsOf ? card.trainingsOf(l) : []), 
  endSessions: (login) => { for (const [t, l] of sessions) if (l === login) sessions.delete(t); } });
// Share sadhana (worker shares.js): the viewer reads the facilitator's student page and week, from mockstaff.js
share = installShare(A, { ok, fail, fieldFail, db: () => db, scopesOf: (u) => userView(u).scopes, ...staffViews });
admin = installAdmin(A, { ok, fail, fieldFail, db: () => db, batchIdsOf, leaderBatch, scopesOf: (u) => userView(u).scopes });
phase9 = installPhase9(A, { ok, fail, fieldFail, db: () => db, batchIdsOf, scopesOf: (u) => userView(u).scopes });
// the target card: weekScoreOf lets Sadhna be OFFERED from the week the app already scored,
// which is the one measure the person does not have to type
card = installCard(A, { ok, fail, fieldFail, batchIdsOf, wholeFacBoard,
  // the batches and one person, for the scoreboards (18 Oct 2026)
  batches: () => db.batches, userOf: (l) => db.users[String(l || '')] || null, allUsers: () => Object.values(db.users),
  // a training draws from all of IYF, not from one batch
  allDevotees: () => Object.values(db.users).filter((x) => x.role === 'DEVOTEE' && x.status === 'ACTIVE')
    .map((x) => ({ login: x.login, name: x.name, iyfId: x.iyfId || '', batchId: x.batchId || '' })),
  batchName: (b) => db.batches.find((x) => x.batchId === b)?.name || b,
  offerFacilitator, withdrawFacilitator,
  // a week as the server stores it, for the leaderboard: SUBMITTED with its score, or MISSED
  weekOf: (login, weekId) => { const w = A['week.get']?.[1]?.({ weekId }, db.users[login]); return w?.ok ? { status: w.data.status, overall: w.data.scores?.overall ?? null } : null; },
  membersOf: (b) => Object.values(db.users).filter((x) => x.role === 'DEVOTEE' && x.batchId === b && x.status === 'ACTIVE').map((x) => ({ login: x.login, name: x.name })),
  // the FACILITATORS — accounts that hold a facilitator name, as the server's board reads them (22 Oct 2026: this read
  // `facilitator`, the name a DEVOTEE picked, so the head's board listed devotees and left the facilitators off)
  // the FTP route's people (phases.js boardScope): a trainee's temporary facilitation puts them on their training's board instead
  facilitatorLogins: () => Object.values(db.users).filter((x) => x.facilitatorName && x.facilitation !== 'temporary' && x.status === 'ACTIVE').map((x) => ({ login: x.login, name: x.name })),
  weekScoreOf: (login, weekId) => {
  const w = A['week.get']?.[1]?.({ weekId }, db.users[login]);
  return w?.ok && w.data?.scores?.overall !== undefined ? Math.round(w.data.scores.overall) : null;
} });
installReport(A, { ok, fail, fieldFail, db: () => db, scopesOf: (u) => userView(u).scopes, facIdOf, facNameOf, facilitators: () => offered() });   // Admin › Reports (report.js)
// the head's Home in one request (worker staffhome.js, Phase 6): the same handlers, answered together
A['home.staff'] = [['MASTER'], (d, u, tok) => {
  const w = d.weeks === undefined ? 8 : d.weeks;
  if (!Number.isInteger(w) || w < 1 || w > 8) return fieldFail([['weeks', '1 to 8 weeks.']]);
  const part = (k, data = {}) => A[k][1](data, u, tok).data;
  return ok({ requests: part('requests.list'), reopens: part('reopen.list'), reports: part('announcements.reports'), heads: part('heads.requests'),
    settings: part('settings.get'), batches: part('batches.list'), runlog: part('runlog.list', { limit: 100 }), stats: part('stats.all', { weeks: w }),
    orphans: part('facilitators.orphans'), weeks: w });
}];
if (typeof window !== 'undefined') window.__mock = { setNow, reset, setLatency, setOffline, state: _state, now: () => nowD().toISOString() }; // dev console: __mock.setNow('2026-10-04T19:00:00+05:30')

// ---------- entry point ----------
const ALLOWED_KEYS = new Set(['v', 'action', 'token', 'requestId', 'app', 'data']);

export async function handle(body) {
  await new Promise((r) => setTimeout(r, jitter()));
  if (offline) throw new TypeError('Failed to fetch');
  const reply = run(body);
  if (body && body.requestId && reply.ok) replies.set(body.requestId, reply);
  return JSON.parse(JSON.stringify(reply)); // as if it crossed the network
}

function run(body) {
  if (!body || typeof body !== 'object' || Object.keys(body).some((k) => !ALLOWED_KEYS.has(k))) return fail('BAD_REQUEST', 'Something went wrong');
  if (body.v !== 1) return fail('UPGRADE_REQUIRED', 'Please update the app.');
  const entry = A[body.action];
  if (!entry) return fail('BAD_REQUEST', 'Something went wrong');
  const [roles, fn, allowMustChange] = entry;
  const data = body.data ?? {};
  // the server's own checks (worker/src/api.js handle), from the registry via lib/mockfields.js (G15, 22 Oct 2026): a
  // field the action does not take, or a write with no request id, is BAD_REQUEST — so a screen sending either fails
  // its browser check here, instead of passing against the mock and failing on the server
  const spec = FIELDS[body.action];
  if (spec && (typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some((k) => !spec[1].includes(k)))) return fail('BAD_REQUEST', 'Something went wrong');
  if (spec?.[0] && !/^[A-Za-z0-9-]{8,64}$/.test(String(body.requestId || ''))) return fail('BAD_REQUEST', 'Something went wrong');
  if (body.requestId && replies.has(body.requestId)) return replies.get(body.requestId);

  // A public route still gets the token when one was sent: meta.get is public (sign-up calls it
  // before any login) but answers a signed-in caller with their staff batch list too, exactly as
  // the server does.
  if (roles === null) return fn(data, body.token && sessions.get(body.token) ? body.token : null);

  const login = body.token ? sessions.get(body.token) : null;
  const u = login && db.users[login];
  if (!u) return fail('UNAUTHENTICATED', 'Please log in again.');
  if (u.status === 'DISABLED') { sessions.delete(body.token); return fail('UNAUTHENTICATED', 'Please log in again.'); }
  if (u.mustChange && !allowMustChange) return fail('MUST_CHANGE_PASSWORD', 'Please choose a new password.');
  // a signed-in call is use of the app (worker session.js): someone the app made inactive is back (ADR 0020)
  u.lastUsedAt = isoIst(nowD());
  if (u.autoInactive) mockCameBackApp(u.login);
  // ADR 0015 (worker grants.js gate): what the head gave or took for this person; a head's own powers are never taken
  const cap = CAPS.find((c) => c.actions.includes(body.action) || (c.onBehalf.includes(body.action) && data.onBehalfOf !== undefined && data.onBehalfOf !== ''));
  const gr = cap && u.grants?.[cap.id], today = isoIst(nowD()).slice(0, 10);
  const eff = gr && (!gr.until || gr.until >= today) ? gr.effect : '';
  if (eff === 'deny' && u.role !== 'MASTER') return fail('FORBIDDEN', 'The IYF head has turned this off for you.');
  // the server gates on scopes, not the account's role: a personal login given batches in Access passes a staff gate
  const byRole = roles.includes(u.role) || (roles.includes('COORDINATOR') && coordScope(u).length > 0) || (roles.includes('FTP') && ftpScope(u));
  if (!byRole && !(eff === 'allow' && cap.give)) return fail('FORBIDDEN', 'You do not have access to this.');
  return fn({ ...data, __token: body.token }, u, body.token);
}
