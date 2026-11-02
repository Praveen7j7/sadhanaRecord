// Mock of the coordinator and master tools (worker/src/coord.js): status board, attendance, no-class weeks, filling
// chart, devotees, birthdays, profile and photo, reopening missed weeks, possible duplicate IDs. One class a week:
// each devotee has a class day (Sunday or Saturday); attendance is marked from that day.
// The SPS batch gets 11 made-up devotees whose weeks are generated (submitted / filling / missed), so every screen
// has realistic data; real devotees (who log in) use the weekly-form state of mockweeks.js.
import { normEmail, emailProblem, normWhatsapp } from './contact.js';
import { dayMarks, pct100 } from '$shared/scoring.js';
import { windowText } from '$shared/window.js';
import { addressErrors, cleanAddress } from './address.js';
import { attendanceOpens, readDay, DAY_NAME, _state, nowD, ymd, isoIst, mondayOf, weekStart, addDays, validWeekId, closesOf, classWeekOf, classDefault, markUsed, attView, stateOf, CARDS, cardNameOf, weekScores, pickScores } from './mockweeks.js';

const dk = (login, w) => login + '|' + w;
/* The refusals name the deadline the (mock) master has set, through the one formatter both sides use
   (shared/window.js). closesOf follows the mock's settings, so the words are read back from that moment
   rather than from a second copy of the setting; "Monday 9 PM" used to be literal here. */
const DAY3 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const deadlinePhrase = (w) => { const t = new Date(closesOf(w).getTime() + 5.5 * 3600e3); return `${windowText(`${DAY3[t.getUTCDay()]} ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`, 'Monday 9 PM')} deadline`; };
// [login, name, class day] — Deepak's class day was never set (an older account)
const SYN = [
  ['6000000011', 'Aarav Gupta', 'SUN'], ['6000000012', 'Bhavesh Jain', 'SUN'], ['6000000013', 'Chetan Arora', 'SUN'],
  ['6000000014', 'Deepak Yadav', null], ['6000000015', 'Gaurav Saini', 'SAT'], ['6000000016', 'Harish Rawat', 'SUN'],
  ['6000000017', 'Ishaan Kapoor', 'SUN'], ['6000000018', 'Jatin Malik', 'SAT'], ['6000000019', 'Kunal Bhatia', 'SUN'],
  ['6000000020', 'Lalit Chauhan', 'SUN'], ['6000000021', 'Manish Tiwari', 'SUN'],
];
// this week's pattern by person (index): S submitted, C submitted by the coordinator, D filling, N not started
const NOW_PLAN = ['S', 'S', 'C', 'D', 'D', 'N', 'N', 'D', 'S', 'N', 'N'];
const MISSED_PLAN = { 5: [1, 3], 6: [2], 7: [5], 3: [7] };   // weeks back that were missed
const BLOOD = ['A+', 'B+', 'O+', 'AB+', 'B-', 'O-', "Don't know"];
const FACS = ['Natvar Gopinath Prabhuji', 'Vilasa Padmanabha Prabhuji'];

let photos, reopenReqs, reopens, seededFor, seedDb, reviewedDups = new Map();
// who became inactive or came back (Phase 23, ADR 0020; worker activity_events): { id, login, batchId, day, change, how, at, by }
let events = [], evSeq = 0;
/** The daily job, for the tests (the server's runs from the cron): how many it made inactive. */
export let runDailyInactive = () => 0;
let cameBackApp = () => {}, manualActivity = () => {};
/** For mock.js: a sign-in or a signed-in call by someone the app made inactive. */
export const mockCameBackApp = (login) => cameBackApp(login);
// group leaders (decision 41): login → { batchId, appointedBy, appointedAt }; members carry leaderLogin on their open membership
let leaders = new Map();
/** The batch a login leads a group in (null: not a group leader), for user.scopes.groupLeader. */
export const leaderBatch = (login) => leaders?.get(login)?.batchId || null;
const synIndex = (login) => SYN.findIndex((s) => s[0] === login);
const FROM = '2026-01-05';                       // everyone made up has been in SPS since this Monday

/** Called from mock.js reset(): adds the made-up devotees with their memberships, profiles and photos. */
export function seedStaff(db) {
  events = []; evSeq = 0;
  photos = new Map(); reviewedDups = new Map(); reopenReqs = new Map(); reopens = new Map(); leaders = new Map(); seededFor = null; seedDb = db;
  SYN.forEach(([login, name, cd], i) => {
    const status = i === 9 ? 'INACTIVE' : i === 10 ? 'DISABLED' : 'ACTIVE';
    db.users[login] = {
      login, role: 'DEVOTEE', name, status, batchId: 'SPS', iyfId: i % 4 === 3 ? null : `IYFD-2026-01${String(i + 10).padStart(2, '0')}`,   // the live format (one issuer, IYFD-<year>-NNNN); KT26 stays only as an old id in the registry levelEntryDate: FROM,
      email: i === 3 ? '' : name.toLowerCase().replace(' ', '.') + '@gmail.com', whatsapp: i % 3 === 2 ? '' : login,
      profile: { dob: `${2000 + (i % 6)}-0${1 + (i % 9)}-1${i % 9}`, bloodGroup: BLOOD[i % BLOOD.length], emergency: { name: 'Parent of ' + name.split(' ')[0], relation: i % 2 ? 'Mother' : 'Father', phone: '60000001' + String(60 + (i % 40)).padStart(2, '0') } },
      memberships: i === 9
        ? [{ batchId: 'SPS', state: 'ACTIVE', fromWeek: FROM, toWeek: '2026-08-31', facilitator: FACS[i % 2], classDay: cd, reason: '' },
           { batchId: 'SPS', state: 'INACTIVE', fromWeek: '2026-09-07', toWeek: null, facilitator: FACS[i % 2], classDay: cd, reason: 'inactive' }]
        : [{ batchId: 'SPS', state: 'ACTIVE', fromWeek: FROM, toWeek: null, facilitator: FACS[i % 2], classDay: cd, reason: '' }],
    };
    if (i === 0 || i === 3) photos.set(login, { jpegBase64: fakeJpeg(name, i), updatedAt: '2026-09-20T10:00:00+05:30' });
  });
  const sunil = db.users['6000000001'];
  sunil.memberships = [{ batchId: 'SPS', state: 'ACTIVE', fromWeek: FROM, toWeek: null, facilitator: FACS[0], classDay: 'SUN', reason: '' }];
  sunil.profile = { dob: '2002-03-21', bloodGroup: 'B+', emergency: { name: 'Ramesh Kumar', relation: 'Father', phone: '6000000077' } };
  sunil.levelEntryDate = FROM;
  sunil.profile.address = { line: 'House 21, Gali 4', area: 'Punjabi Bagh', city: 'Delhi', pin: '110026' };
  // Sunil leads a group of four (log in as 6000000001 to see My group)
  leaders.set('6000000001', { batchId: 'SPS', appointedBy: 'sps', appointedAt: '2026-10-03T10:00:00+05:30' });
  for (const l of ['6000000011', '6000000012', '6000000013', '6000000014']) db.users[l].memberships.at(-1).leaderLogin = '6000000001';
  // the registry: a second ID on Karan Malhotra's phone (a "same phone" duplicate; the two Rahul Sharmas are "same name")
  db.registry.push({ iyfId: 'KT26-0088', name: 'Karan M', level: 'SPS', facilitator: 'Hari Das', phones: ['6000000076'], linked: null });
}

/** What depends on the (mock) clock is added on first use for the week in focus: this week's own marks,
 *  birthdays today and in the next days, one pending request to reopen last week. */
function ensure() {
  const now = nowD(), focus = focusWeek(now);
  if (seededFor === focus) return;
  seededFor = focus;
  const atts = _state().atts, md = (days) => ymd(new Date(now.getTime() + days * 864e5)).slice(4);
  SYN.forEach(([login], i) => {
    const own = { 0: 'P', 1: 'P', 3: 'P', 4: 'P', 8: 'P', 6: 'A' }[i];
    if ((own || i === 2) && !atts.has(dk(login, focus))) atts.set(dk(login, focus), { devotee: own || null, coordinator: i === 2 ? 'P' : null });
    const u = seedDb.users[login];
    if (u?.profile && (i === 1 || i === 4 || i === 8)) u.profile.dob = { 1: '2004', 4: '2002', 8: '2001' }[i] + md({ 1: 0, 4: 3, 8: 6 }[i]);
  });
  const w1 = addDays(focus, -7);
  if (![...reopenReqs.values()].some((r) => r.state === 'PENDING'))
    reopenReqs.set(dk('6000000016', w1), { login: '6000000016', weekId: w1, batchId: 'SPS', reason: 'He was in hospital that week.', by: 'sps', at: isoIst(new Date(now.getTime() - 3 * 3600e3)), state: 'PENDING' });
}

/** A small JPEG with the initial (dev only, drawn when there is a canvas; tests get a stand-in). */
function fakeJpeg(name, i) {
  if (typeof document === 'undefined') return '/9j/' + btoa(name).replace(/=/g, '');
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = ['#a23a1a', '#1d6b34', '#1a56c4'][i % 3]; g.fillRect(0, 0, 160, 160);
  g.fillStyle = '#fff'; g.font = 'bold 72px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name.charAt(0), 80, 88);
  return c.toDataURL('image/jpeg', 0.8).split(',')[1];
}

export function focusWeek(now = nowD()) {
  const thisWeek = mondayOf(now), lastWeek = addDays(thisWeek, -7);
  return now < closesOf(lastWeek) ? lastWeek : thisWeek;
}

/** When a person's own photo was last set (auth.me photoAt); null for none. */
export const photoAtOf = (login) => photos?.get(login)?.updatedAt || null;

export function installStaff(A, h) {
  const before = new Set(Object.keys(A));
  const { ok, fail, fieldFail } = h;
  const STAFF = ['COORDINATOR', 'MASTER'], MASTER = ['MASTER'], ANY = ['DEVOTEE', 'COORDINATOR', 'MASTER'];
  const db = () => h.db();
  const scope = (u) => h.batchIdsOf(u);
  const requireBatch = (u, b) => (!db().batches.some((x) => x.batchId === b) ? fail('NOT_FOUND', 'No such batch.') : !scope(u).includes(b) ? fail('FORBIDDEN', 'That batch is not yours.') : null);
  const reasonOk = (r) => typeof r === 'string' && r.trim().length >= 2 && r.trim().length <= 200;

  // memberships (approved devotees without one get one from this week)
  function memberships(u) {
    if (!u.memberships && u.role === 'DEVOTEE' && ['ACTIVE', 'INACTIVE', 'DISABLED'].includes(u.status) && u.batchId)
      u.memberships = [{ batchId: u.batchId, state: 'ACTIVE', fromWeek: mondayOf(nowD()), toWeek: null, facilitator: u.facilitator || FACS[0], classDay: u.classDay || null, reason: '' }];
    return u.memberships || [];
  }
  const current = (u) => memberships(u).find((m) => !m.toWeek) || null;
  const memberIn = (u, batchId, w) => memberships(u).find((m) => m.batchId === batchId && m.fromWeek <= w && (!m.toWeek || m.toWeek >= w));

  // one devotee's week, as the board shows it
  function weekOf(u, w) {
    const { subs, missed, drafts } = _state(), k = dk(u.login, w), reo = reopens.get(k);
    if (subs.has(k)) { const s = subs.get(k); return { status: 'SUBMITTED', daysFilled: 7, days: [], submittedAt: s.submittedAt, byCoordinator: !!s.onBehalf, overall: s.scores.overall }; }
    if (missed.has(k)) return { status: reo ? 'REOPENED' : 'MISSED', daysFilled: missed.get(k).daysFilled, days: [], submittedAt: null, byCoordinator: false, overall: null };
    if (drafts.has(k)) { const days = drafts.get(k).d.map((x) => stateOf(x)); return { status: 'DRAFT', daysFilled: days.filter((x) => x === 'complete').length, days, submittedAt: null, byCoordinator: false, overall: null }; }
    const i = synIndex(u.login), focus = focusWeek();
    const m = memberIn(u, 'SPS', w);
    if (i < 0 || !m || m.state !== 'ACTIVE' || w > focus) return { status: 'NOT_STARTED', daysFilled: 0, days: [], submittedAt: null, byCoordinator: false, overall: null };
    const back = Math.round((weekStart(focus) - weekStart(w)) / (7 * 864e5));
    if (back === 0) {
      const p = NOW_PLAN[i];
      if (p === 'S' || p === 'C') return { status: 'SUBMITTED', daysFilled: 7, days: [], submittedAt: isoIst(new Date(weekStart(w).getTime() + 6 * 864e5 + 19 * 3600e3)), byCoordinator: p === 'C', overall: 60 + ((i * 13) % 35) };
      if (p === 'D') { const n = i === 7 ? 5 : 2 + (i % 3); const days = Array.from({ length: 7 }, (_, d) => (d < n ? 'complete' : d === n ? 'partial' : 'empty')); return { status: 'DRAFT', daysFilled: n, days, submittedAt: null, byCoordinator: false, overall: null }; }
      return { status: 'NOT_STARTED', daysFilled: 0, days: [], submittedAt: null, byCoordinator: false, overall: null };
    }
    if ((MISSED_PLAN[i] || []).includes(back)) return { status: reo ? 'REOPENED' : 'MISSED', daysFilled: (i + back) % 5, days: [], submittedAt: null, byCoordinator: false, overall: null };
    return { status: 'SUBMITTED', daysFilled: 7, days: [], submittedAt: isoIst(new Date(weekStart(w).getTime() + 6 * 864e5 + 20 * 3600e3)), byCoordinator: (i + back) % 7 === 0, overall: 55 + ((i * 37 + back * 11) % 41) };
  }
  const isMissed = (u, w) => { const s = weekOf(u, w).status; return s === 'MISSED' || s === 'REOPENED'; };

  function boardRows(batchIds, w) {
    const out = [];
    for (const u of Object.values(db().users)) {
      if (u.role !== 'DEVOTEE' || ['PENDING', 'REJECTED'].includes(u.status)) continue;
      const m = batchIds.map((b) => memberIn(u, b, w)).find(Boolean);
      if (!m) continue;
      const att = _state().atts.get(dk(u.login, w)), cw = classWeekOf(m.batchId, w);
      out.push({ login: u.login, name: u.name, iyfId: u.iyfId || null, batchId: m.batchId, accountStatus: u.status, membership: m.state,
        facilitator: m.facilitator, classDay: m.classDay || null, whatsapp: u.whatsapp || '', hasPhoto: photos.has(u.login), ...weekOf(u, w),
        leaderLogin: m.leaderLogin || '', attendance: { ...attView(att, cw), locked: nowD() >= closesOf(w) } });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }
  const expected = (r) => r.membership === 'ACTIVE' && r.accountStatus === 'ACTIVE';

  function managed(u, login, { allowPending = false } = {}) {
    const t = db().users[String(login || '')];
    if (!t || t.role !== 'DEVOTEE') return { err: fail('NOT_FOUND', 'No devotee with that phone.') };
    if (!allowPending && ['PENDING', 'REJECTED'].includes(t.status)) return { err: fail('CONFLICT', 'Approve or reject the sign-up first.') };
    if (t.login === u.login) return { err: fail('FORBIDDEN', 'You cannot change your own account here.') };
    const batchId = current(t)?.batchId || t.batchId;
    if (!scope(u).includes(batchId)) return { err: fail('FORBIDDEN', 'That devotee is not in your batches.') };
    return { t, batchId };
  }

  /** One level's mark (decision 41): a higher mark that differs from the devotee's own leaves a note for them. */
  function writeMark(level, login, w, mark, batchId) {
    const k = dk(login, w), a = _state().atts.get(k) || {};
    a[level] = mark || null;
    if (a.devotee && mark && mark !== a.devotee && markUsed(a, classWeekOf(batchId, w)) !== a.devotee) a.notice = isoIst(nowD());
    _state().atts.set(k, a);
    analysisMemo.clear();                                   // a mark changes that week's final score (C4)
    return a;
  }

  // ---------- facilitator logins and the read-only week (4 Oct 2026) ----------
  const DEMO_DAY = { sleptAt: '22:15', wokeAt: '04:30', dayRestMin: 30, rounds: 16, chantingDoneAt: '07:10', chantingSameDay: true, hearingMin: 30, hearing: [{ text: 'Bhagavad-gita class' }], readingMin: 20, reading: { text: 'Bhagavad Gita As It Is' }, serviceMin: 45 };
  /** One devotee's week, read-only (as the server's weekRead). */
  function weekRead(t, w) {
    const k = dk(t.login, w), real = _state().subs.get(k), x = weekOf(t, w);
    if (real) return { weekId: w, status: 'SUBMITTED', submittedAt: real.submittedAt, days: real.days, marks: real.marks, weekEnd: { nightStay: real.nightStay, principles: real.principles, chantingAverage: real.avgRounds }, scores: real.scores };
    if (x.status === 'SUBMITTED') {                                // a made-up submitted week: a plausible one
      const days = Array.from({ length: 7 }, (_, i) => ({ ...DEMO_DAY, rounds: 16 - (i % 3) })), s = weekScores(CARDS[cardNameOf(t.batchId || 'SPS')], days, 'P', 315);
      return { weekId: w, status: 'SUBMITTED', submittedAt: x.submittedAt, days, marks: s.marks, weekEnd: { nightStay: 'YES', principles: 'YES', chantingAverage: 15 }, scores: pickScores(s) };
    }
    if (x.status === 'MISSED') return { weekId: w, status: 'MISSED', daysFilled: x.daysFilled };
    const dr = _state().drafts.get(k), card = CARDS[cardNameOf(t.batchId || 'SPS')];
    // how the week is going so far (11 Oct 2026): the same shape the server sends, so the facilitator
    // sees the gist of a week still being filled without adding the days up
    const filled = (dr?.d || []).filter(Boolean);
    const sum = (key) => filled.reduce((n, y) => n + (Number(y[key]) || 0), 0);
    const summary = filled.length ? (() => {
      const seven = Array.from({ length: 7 }, (_, i) => dr?.d?.[i] || {});
      const sc = weekScores(card, seven, '', sum('serviceMin'));
      return { daysFilled: filled.length, partial: true,
        overall: sc.overall ?? pickScores(sc).overall, body: sc.body ?? pickScores(sc).body, soul: sc.soul ?? pickScores(sc).soul,
        reading: { minutes: sum('readingMin'), books: ['Bhagavad-gita As It Is'] },
        hearing: { minutes: sum('hearingMin'), lectures: ['Qualities of a Sadhaka'] },
        seva: { minutes: sum('serviceMin') },
        japa: { rounds: sum('rounds'), days: filled.filter((y) => Number(y.rounds) > 0).length } };
    })() : null;
    return { weekId: w, status: x.status, summary, days: (x.days.length ? x.days : Array(7).fill('empty')).map((st, i) => ({ state: st, ...(dr?.d?.[i] ? { marks: dayMarks(card, dr.d[i]) } : {}) })) };
  }
  const facName = (u) => u.facilitatorName || '';
  const facUsers = () => Object.values(db().users).filter((x) => x.facilitatorName);
  const facLoginView = (x) => ({ username: x.login, facilitator: x.facilitatorName, name: x.name, status: x.status, mustChangePassword: !!x.mustChange, lastLogin: null,
    kind: x.role === 'DEVOTEE' ? 'member' : 'login', batch: (x.role === 'DEVOTEE' && ((x.memberships || []).find((m) => !m.toWeek)?.batchId || x.batchId)) || 'TRD' });
  // Person records (migration 0038): the lasting person behind every login. Two made-up people, enough to
  // show what the screen does — one with an id and a previous name, one of the 493 with no year and so no id.
  const PEOPLE = [
    { id: 'p-has', iyfId: 'IYFD-2020-0017', name: 'HG Devesa Hari Das', connectedSince: '2020', connectedSinceSource: 'import',
      status: 'Active', mergedInto: '',
      names: [{ name: 'HG Devesa Hari Das', kind: 'initiated', current: true, from: '' }, { name: 'Debojeet Dey', kind: 'given', current: false, from: '' }],
      phones: [{ phone: '6000000031', primary: true, active: true }],
      identifiers: [{ fid: 'IYFD-2020-0017', state: 'current', supersededBy: '', issuedBy: 'import', at: '2026-10-11' },
                    { fid: 'KT26-0042', state: 'superseded', supersededBy: 'IYFD-2020-0017', issuedBy: 'dashboard', at: '2026-01-01' }],
      facilitators: ['HG Vilasa Padmanabha Das'], levels: ['BSS', 'Joined'], sources: ['L:HG Vilasa padmanabha pr#214'], accounts: [] },
    { id: 'p-noyear', iyfId: '', name: 'Alok Tiwari', connectedSince: '', connectedSinceSource: '', status: 'Active', mergedInto: '',
      names: [{ name: 'Alok Tiwari', kind: 'given', current: true, from: '' }],
      phones: [{ phone: '6000000032', primary: true, active: true }],
      identifiers: [], facilitators: ['Ankit Narula Das'], levels: ['SPS'], sources: [], accounts: [] },
    // a second record of Devesa Hari Das from an old sheet, under his given name: what Merge is for
    { id: 'p-dup', iyfId: '', name: 'Debojeet Dey', connectedSince: '', connectedSinceSource: '', status: 'Active', mergedInto: '',
      names: [{ name: 'Debojeet Dey', kind: 'given', current: true, from: '' }],
      phones: [{ phone: '6000000033', primary: true, active: true }],
      identifiers: [{ fid: 'GP26-0101', state: 'current', supersededBy: '', issuedBy: 'dashboard', at: '2026-02-01' }],
      facilitators: [], levels: ['SPS'], sources: [], accounts: [] },
  ];
  const pFind = (q) => { const t = String(q || '').toLowerCase();
    return PEOPLE.filter((p) => p.names.some((n) => n.name.toLowerCase().includes(t))
      || p.phones.some((h) => h.phone === t) || p.identifiers.some((i) => i.fid.toLowerCase() === t)); };
  A['identity.search'] = [MASTER, (d) => ok({ people: pFind(d.q) })];
  A['identity.get'] = [MASTER, (d) => { const p = PEOPLE.find((x) => x.id === d.personId); return p ? ok(p) : fail('NOT_FOUND', 'No such person.'); }];
  A['identity.link'] = [MASTER, (d) => { const p = PEOPLE.find((x) => x.id === d.personId); if (!p) return fail('NOT_FOUND', 'No such person.');
    p.accounts = [...p.accounts, { service: 'sadhana', account: d.login, at: '2026-10-11' }]; return ok({ ok: true, person: p }); }];
  // two records of one person become one (identity.js identityMerge): the loser points at the keeper; its ids are
  // superseded by the keeper's, its phones, names and accounts move. A human confirms; nothing auto-merges.
  A['identity.merge'] = [MASTER, (d) => {
    const keep = PEOPLE.find((x) => x.id === d.keep), lose = PEOPLE.find((x) => x.id === d.lose);
    if (!d.keep || !d.lose) return fieldFail([['lose', 'Give both person records.']]);
    if (d.keep === d.lose) return fail('CONFLICT', 'That is one person, not two.');
    const reason = String(d.reason || '').trim();
    if (reason.length < 2 || reason.length > 200) return fieldFail([['reason', 'Say why these are one person.']]);
    if (!keep || !lose) return fail('NOT_FOUND', 'No such person.');
    if (keep.mergedInto) return fail('CONFLICT', 'The record you are keeping was itself merged away; merge into the newer one.');
    if (lose.mergedInto) return fail('CONFLICT', 'That record is already merged.');
    const moved = { identifiers: lose.identifiers.length, phones: lose.phones.length, accounts: lose.accounts.length };
    keep.identifiers = [...keep.identifiers, ...lose.identifiers.map((i) => ({ ...i, state: 'superseded', supersededBy: keep.iyfId || '' }))];
    keep.phones = [...keep.phones, ...lose.phones.filter((h) => !keep.phones.some((k) => k.phone === h.phone)).map((h) => ({ ...h, primary: false }))];
    keep.names = [...keep.names, ...lose.names.filter((n) => !keep.names.some((k) => k.name === n.name)).map((n) => ({ ...n, current: false }))];
    keep.accounts = [...keep.accounts, ...lose.accounts.filter((a) => !keep.accounts.some((k) => k.account === a.account))];
    Object.assign(lose, { mergedInto: keep.id, status: 'Inactive', identifiers: [], phones: [], accounts: [] });
    return ok({ keep, moved });
  }];
  A['identity.mint'] = [MASTER, (d) => { const p = PEOPLE.find((x) => x.id === d.personId); if (!p) return fail('NOT_FOUND', 'No such person.');
    if (p.iyfId) return fail('CONFLICT', `${p.name} already has ${p.iyfId}.`);
    if (!/^(19|20)\d{2}$/.test(String(d.year || ''))) return fieldFail([['year', 'Choose the year they first came to IYF Delhi.']]);
    p.iyfId = `IYFD-${d.year}-0001`; p.connectedSince = String(d.year); p.connectedSinceSource = 'coordinator';
    p.identifiers = [{ fid: p.iyfId, state: 'current', supersededBy: '', issuedBy: 'app', at: '2026-10-11' }];
    return ok({ fid: p.iyfId, person: p }); }];
  A['identity.supersede'] = [MASTER, (d) => { const p = PEOPLE.find((x) => x.id === d.personId); if (!p) return fail('NOT_FOUND', 'No such person.');
    if (!p.iyfId) return fail('CONFLICT', 'That person has no IYF ID yet — create one instead.');
    if (!/^(19|20)\d{2}$/.test(String(d.year || ''))) return fieldFail([['year', 'Choose the year they first came to IYF Delhi.']]);
    const was = p.iyfId; p.iyfId = `IYFD-${d.year}-0002`; p.connectedSince = String(d.year);
    p.identifiers = [...p.identifiers.map((i) => (i.fid === was ? { ...i, state: 'superseded', supersededBy: p.iyfId } : i)),
                     { fid: p.iyfId, state: 'current', supersededBy: '', issuedBy: 'app', at: '2026-10-11' }];
    return ok({ fid: p.iyfId, was, person: p }); }];

  A['facLogins.link'] = [MASTER, (d) => {
    const f = [], ph = String(d.phone || '').replace(/\D/g, '').slice(-10), x = db().users[ph];
    if (!h.facilitators().includes(d.facilitator)) f.push(['facilitator', 'Choose a facilitator from the list.']);
    else if (facUsers().some((y) => y.facilitatorName === d.facilitator && y.status !== 'DISABLED')) f.push(['facilitator', `${d.facilitator} already has a login.`]);
    if (!/^[6-9]\d{9}$/.test(ph)) f.push(['phone', 'Enter their 10-digit mobile number.']);
    else if (!x || x.role !== 'DEVOTEE') f.push(['phone', 'No devotee in the app with that number.']);
    else if (x.status !== 'ACTIVE') f.push(['phone', 'That devotee is not active.']);
    else if (x.facilitatorName) f.push(['phone', `${x.name} is already linked to ${x.facilitatorName}.`]);
    if (f.length) return fieldFail(f);
    x.facilitatorName = d.facilitator;
    return ok({ login: facLoginView(x) });
  }];
  A['facLogins.unlink'] = [MASTER, (d) => {
    const x = db().users[d.username]; if (!x?.facilitatorName) return fail('NOT_FOUND', 'No facilitator login with that username.');
    if (x.role !== 'DEVOTEE') return fail('CONFLICT', 'This is a facilitator login: switch it off instead.');
    x.facilitatorName = ''; return ok({ ok: true });
  }];
  A['facLogins.list'] = [MASTER, () => ok({ logins: facUsers().map(facLoginView) })];
  A['facLogins.create'] = [MASTER, (d, u) => {
    const f = [], un = String(d.username || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9.-]{2,29}$/.test(un)) f.push(['username', 'Use 3–30 lowercase letters, digits, dots or dashes, starting with a letter.']);
    if (!h.facilitators().includes(d.facilitator)) f.push(['facilitator', 'Choose a facilitator from the list.']);
    else if (facUsers().some((x) => x.facilitatorName === d.facilitator && x.status !== 'DISABLED')) f.push(['facilitator', `${d.facilitator} already has a login.`]);
    if (typeof d.tempPassword !== 'string' || d.tempPassword.length < 8) f.push(['tempPassword', 'Use 8 to 64 characters']);
    if (f.length) return fieldFail(f);
    if (db().users[un]) return fail('CONFLICT', `The username ${un} is taken.`);
    db().users[un] = { login: un, role: 'COORDINATOR', name: d.facilitator, password: d.tempPassword, status: 'ACTIVE', mustChange: true, facilitatorName: d.facilitator };
    return ok({ login: facLoginView(db().users[un]) });
  }];
  A['facLogins.setDisabled'] = [MASTER, (d) => { const x = db().users[d.username]; if (!x?.facilitatorName) return fail('NOT_FOUND', 'No facilitator login with that username.'); if (x.role === 'DEVOTEE') return fail('CONFLICT', `${x.name} uses the app as a devotee: remove the facilitator link instead.`); x.status = d.disabled ? 'DISABLED' : 'ACTIVE'; return ok({ login: facLoginView(x) }); }];
  A['facLogins.resetPassword'] = [MASTER, (d) => { const x = db().users[d.username]; if (!x?.facilitatorName) return fail('NOT_FOUND', 'No facilitator login with that username.'); x.password = d.tempPassword; x.mustChange = true; return ok({ login: facLoginView(x) }); }];
  // the student page (worker facilitator.js devoteeView): fac.devotee, and share.devotee (mockshare.js) without contact
  function devoteeOf(x) {
    const focus = focusWeek(), weeks = [];
    for (let back = 1; back < 30 && weeks.length < 12; back++) { const w = addDays(focus, -7 * back), y = weekOf(x.t, w); if (y.status === 'SUBMITTED' || y.status === 'MISSED') weeks.push({ weekId: w, status: y.status, overall: y.overall }); }
    const b = db().batches.find((y) => y.batchId === x.m.batchId);
    return { login: x.t.login, name: x.t.name, iyfId: x.t.iyfId || null, phone: x.t.login, whatsapp: x.t.whatsapp || x.t.login, batchId: x.m.batchId, batchName: b?.name || x.m.batchId, active: x.t.status === 'ACTIVE', since: x.m.fromWeek, weeks };
  }
  const facMine = (u, login) => { const t = db().users[String(login || '')]; const m = t && current(t); return m && facName(u) && m.facilitator === facName(u) ? { t, m } : null; };
  A['fac.devotees'] = [ANY, (d, u) => {
    if (!facName(u)) return fail('FORBIDDEN', 'You do not have access to this.');
    const w = d.weekId || focusWeek(), names = Object.fromEntries(db().batches.map((b) => [b.batchId, b.name]));
    const rows = boardRows(db().batches.map((b) => b.batchId), w).filter((r) => r.facilitator === facName(u) && r.login !== u.login);
    return ok({ weekId: w, closesAt: isoIst(closesOf(w)), facilitator: facName(u), rows: rows.map((r) => ({ login: r.login, name: r.name, iyfId: r.iyfId, phone: r.login, whatsapp: r.whatsapp || r.login, hasPhoto: r.hasPhoto, batchId: r.batchId, batchName: names[r.batchId] || r.batchId,
      active: expected(r), status: r.status, daysFilled: r.daysFilled, days: r.days, overall: r.overall, attendance: r.attendance?.used || null })) });
  }];
  A['fac.devotee'] = [ANY, (d, u) => {
    if (!facName(u)) return fail('FORBIDDEN', 'You do not have access to this.');
    const x = facMine(u, d.login); if (!x) return fail('NOT_FOUND', 'Not one of your devotees.');
    return ok(devoteeOf(x));
  }];
  /* The promotion explorer (phase 21; worker/src/explorer.js): the facilitator's students on the ladder, from any batch,
     with every figure over the period and their batch's rule. Figures from the weeks the mock holds (weekRead). */
  // where each level can move, as the server's closing.js nextLevels (the promote dialog's list below is its own)
  const MEASURED = ['VL2', 'VL3', 'SPS', 'DPS', 'BSS'], NEXT_LEVELS = { VL2: ['VL3'], VL3: ['SPS'], SPS: ['DPS', 'BVS'], DPS: ['BSS', 'BVS'], BSS: ['BVS'] };
  const mondayOfYmd = (x) => { const dd = new Date(x + 'T00:00:00Z'); return addDays(x, -((dd.getUTCDay() + 6) % 7)); };
  A['fac.eligible'] = [ANY, (d, u) => {
    if (!facName(u)) return fail('FORBIDDEN', 'Only a facilitator has students.');
    const closed = focusWeek(), period = String(d.period || 'phase'), ymd = /^\d{4}-\d{2}-\d{2}$/;
    const phase = (A['phases.list']?.[1]?.({}, u)?.data?.phases || []).find((p) => p.state === 'OPEN') || null;
    let first, last = closed;
    if (period === 'phase') { if (!phase) return fail('NOT_FOUND', 'No phase is open; choose a period.'); first = mondayOfYmd(phase.startsOn); }
    else if (period === 'week') first = closed;
    else if (period === 'month') first = addDays(closed, -21);
    else if (period === 'year') first = addDays(closed, -51 * 7);
    else if (period === 'custom') {
      const from = String(d.from || ''), to = String(d.to || '');
      if (!ymd.test(from)) return fieldFail([['from', 'A date, as 2026-09-01.']]);
      if (!ymd.test(to)) return fieldFail([['to', 'A date, as 2026-10-31.']]);
      if (to < from) return fieldFail([['to', 'The end comes after the start.']]);
      if ((Date.parse(to) - Date.parse(from)) / 864e5 > 400) return fieldFail([['to', 'At most 400 days at a time.']]);
      first = mondayOfYmd(from); last = mondayOfYmd(to) > closed ? closed : mondayOfYmd(to);
    } else return fieldFail([['period', 'Phase, week, month, year or custom.']]);
    const weeksIn = []; for (let w = first; w <= last; w = addDays(w, 7)) weeksIn.push(w);
    const students = Object.values(db().users).filter((t) => t.role === 'DEVOTEE' && t.status === 'ACTIVE' && t.login !== u.login && current(t)?.facilitator === facName(u))
      .map((t) => { const m = current(t), b = db().batches.find((y) => y.batchId === m.batchId); return { t, m, b, level: String(b?.level || '').toUpperCase() }; })
      .filter((x) => MEASURED.includes(x.level)).sort((a, b) => a.t.name.localeCompare(b.t.name));
    const figuresOf = (t) => {
      const subs = weeksIn.map((w) => weekRead(t, w)).filter((x) => x?.status === 'SUBMITTED');
      const n = subs.length, avg = (f) => subs.reduce((s, x) => s + (Number(f(x)) || 0), 0) / n;
      const present = subs.filter((x) => (x.scores?.attendance ?? 0) >= 100).length;
      return n ? { weeks: n, att: present / n, heldClasses: n, sad: Math.round(avg((x) => x.scores?.overall)), chant: Math.round(avg((x) => x.weekEnd?.chantingAverage) * 10) / 10,
        cls: Math.round(avg((x) => x.scores?.attendance)), night: subs.filter((x) => x.weekEnd?.nightStay === 'YES').length / n, pr: subs.every((x) => x.weekEnd?.principles === 'YES') ? 'YES' : 'NO' }
        : { weeks: 0, att: null, heldClasses: 0, sad: null, chant: null, cls: null, night: null, pr: null };
    };
    return ok({ period, from: first, to: last, lastClosed: closed, phase: phase ? { phaseId: phase.phaseId, name: phase.name, startsOn: phase.startsOn } : null, labels: h.criteriaLabels(),
      // only an IYF ID is shown, never an old GP/JN/KT number (worker/src/explorer.js, admin.js APP_ID)
      students: students.map(({ t, m, b, level }) => ({ login: t.login, name: t.name, iyfId: /^IYFD-\d{4}-\d{4,}$/.test(t.iyfId || '') ? t.iyfId : '', batchId: m.batchId, batchName: b?.name || m.batchId, level,
        next: NEXT_LEVELS[level] || [], rule: h.ruleOf(m.batchId, level), figures: figuresOf(t) })) });
  }];
  /* Admin › Analysis (phase 21; worker/src/analysis.js): every batch's weekly SUMS over a period, as batch_weeks holds
     them — worked out here from the weeks the mock holds, closed weeks only — and the trainings' figures. */
  const analysisMemo = new Map();
  A['analysis.get'] = [MASTER, (d) => {
    const ymd = /^\d{4}-\d{2}-\d{2}$/, from = String(d.from || ''), to = String(d.to || '');
    if (!ymd.test(from)) return fieldFail([['from', 'A date, as 2026-09-01.']]);
    if (!ymd.test(to)) return fieldFail([['to', 'A date, as 2026-10-31.']]);
    if (to < from) return fieldFail([['to', 'The end comes after the start.']]);
    if ((Date.parse(to) - Date.parse(from)) / 864e5 > 731) return fieldFail([['to', 'At most two years at a time.']]);
    const closed = focusWeek(), weeks = [];
    const people = Object.values(db().users).filter((t) => t.role === 'DEVOTEE' && t.status === 'ACTIVE');
    for (let w = mondayOfYmd(from) < from ? addDays(mondayOfYmd(from), 7) : mondayOfYmd(from); w <= to && w <= closed; w = addDays(w, 7)) {
      for (const b of db().batches) {
        const k = b.batchId + '|' + w;
        if (!analysisMemo.has(k)) {
          const r = { batchId: b.batchId, weekId: w, submitted: 0, missed: 0, overall: 0, body: 0, soul: 0, bed: 0, wake: 0, nRounds: 0, rounds: 0, reading: 0, hearing: 0, seva: 0, night: 0, principles: 0, present: 0, held: 0, nMorning: 0, morning: 0 };
          for (const t of people.filter((x) => current(x)?.batchId === b.batchId)) {
            const x = weekRead(t, w);
            if (x?.status === 'MISSED') { r.missed++; continue; }
            if (x?.status !== 'SUBMITTED') continue;
            const sc = x.scores || {}, days = x.days || [], sum = (f) => days.reduce((n, dd) => n + (Number(dd?.[f]) || 0), 0);
            // the FINAL score, as the Board and the server's summary (C4; worker classweek.js finalScores): a later
            // Present/Absent mark replaces the attendance; TRD records attendance without scoring it
            const used = markUsed(_state().atts.get(dk(t.login, w)), classWeekOf(b.batchId, w));
            const att = used === 'P' ? 100 : used === 'A' ? 0 : (sc.attendance ?? 0);
            const overall = att === (sc.attendance ?? 0) || cardNameOf(b.batchId) === 'TRD' ? (sc.overall || 0)
              : pct100(((sc.body || 0) + (sc.soul || 0) + att + (sc.seva || 0)) / 4);
            r.submitted++; r.overall += overall; r.body += sc.body || 0; r.soul += sc.soul || 0; r.bed += sc.bed || 0; r.wake += sc.wake_up || 0;
            if (x.weekEnd?.chantingAverage !== undefined && x.weekEnd?.chantingAverage !== null && x.weekEnd?.chantingAverage !== '') { r.nRounds++; r.rounds += Number(x.weekEnd.chantingAverage) || 0; }
            r.reading += sum('readingMin'); r.hearing += sum('hearingMin'); r.seva += sum('serviceMin');
            if (x.weekEnd?.nightStay === 'YES') r.night++; if (x.weekEnd?.principles === 'YES') r.principles++;
            r.held++; if (att >= 100) r.present++;
            // the Morning program (TRD, Phase 22; analysis.js COUNT(morning) / SUM(morning)): only weeks that have it
            if (sc.morning !== undefined && sc.morning !== null) { r.nMorning++; r.morning += sc.morning; }
          }
          analysisMemo.set(k, r);
        }
        const r = analysisMemo.get(k);
        if (r.submitted || r.missed) weeks.push(r);
      }
    }
    const phases = (A['phases.list']?.[1]?.({}, { role: 'MASTER' })?.data?.phases || []).map((p) => ({ phaseId: p.phaseId, name: p.name, startsOn: p.startsOn, endsOn: p.endsOn }));
    return ok({ from, to, lastClosed: closed, batches: db().batches.map((b) => ({ batchId: b.batchId, name: b.name, level: b.level, active: b.active !== false })),
      phases, weeks, trainings: h.trainingsSummary(from, to) });
  }];
  A['fac.week'] = [ANY, (d, u) => { if (!facName(u)) return fail('FORBIDDEN', 'You do not have access to this.'); const x = facMine(u, d.login); if (!x) return fail('NOT_FOUND', 'Not one of your devotees.'); return ok(weekRead(x.t, d.weekId)); }];
  A['devotees.week'] = [STAFF, (d, u) => {
    const m = managed(u, d.login); if (m.err) return m.err;
    const now = nowD(), open = [mondayOf(now), ...(now < closesOf(addDays(mondayOf(now), -7)) ? [addDays(mondayOf(now), -7)] : [])];
    if (!h.scopesOf(u).master && !open.includes(d.weekId)) return fail('FORBIDDEN', 'Coordinators see only the week being filled now. Ask the IYF head for an earlier week.');
    return ok(weekRead(m.t, d.weekId));
  }];

  // ---------- group leaders (decision 41) ----------
  const memberView = (r) => ({ login: r.login, name: r.name, batchId: r.batchId, iyfId: r.iyfId, phone: r.login, whatsapp: r.whatsapp || r.login, hasPhoto: r.hasPhoto, active: expected(r),
    status: r.status, daysFilled: r.daysFilled, days: r.days, submittedAt: r.submittedAt, overall: r.overall, attendance: r.attendance });
  const myGroup = (u) => leaders.get(u.login) || null;
  // one pool per level (SPS, SPS Group 2, SPS Online): as the server's levelBatches()
  // the batch's own class day, as the server reads it (classweek.js). One lookup, so no site keeps
  // its own copy of the fact.
  const dayOfBatch = (b) => readDay(db().batches.find((x) => x.batchId === b)?.classDay);
  const levelOf = (b) => db().batches.find((x) => x.batchId === b)?.level || b;
  const levelBatches = (b) => db().batches.filter((x) => (x.level || x.batchId) === levelOf(b)).map((x) => x.batchId);
  A['group.list'] = [['DEVOTEE'], (d, u) => {
    const l = myGroup(u); if (!l) return fail('FORBIDDEN', 'You are not a group leader.');
    const w = d.weekId === undefined ? focusWeek() : d.weekId;
    if (!validWeekId(w)) return fieldFail([['weekId', 'Not a week.']]);
    const now = nowD(), opens = attendanceOpens(w, dayOfBatch(myGroup(u)?.batchId));
    return ok({ weekId: w, batchId: l.batchId, closesAt: isoIst(closesOf(w)), attendanceOpensAt: isoIst(opens), attendanceOpen: now >= opens && now < closesOf(w),
      classWeek: classWeekOf(l.batchId, w), members: boardRows(levelBatches(l.batchId), w).filter((r) => r.leaderLogin === u.login && r.login !== u.login).map(memberView) });
  }];
  A['group.mark'] = [['DEVOTEE'], (d, u) => {
    const l = myGroup(u); if (!l) return fail('FORBIDDEN', 'You are not a group leader.');
    if (!validWeekId(d.weekId)) return fieldFail([['weekId', 'Not a week.']]);
    if (!Array.isArray(d.marks) || !d.marks.length || d.marks.length > 300) return fieldFail([['marks', 'Mark at least one devotee.']]);
    const now = nowD();
    const gcd = dayOfBatch(l.batchId);
    if (now < attendanceOpens(d.weekId, gcd)) return fail('FUTURE_DAY', `Attendance can be marked from the ${DAY_NAME[gcd]} class.`);
    if (now >= closesOf(d.weekId)) return fail('WINDOW_CLOSED', `Attendance for this week closed at its ${deadlinePhrase(d.weekId)}. Ask your coordinator.`);
    const members = new Map(boardRows(levelBatches(l.batchId), d.weekId).filter((r) => r.leaderLogin === u.login && r.login !== u.login).map((r) => [r.login, r]));
    for (const [i, m] of d.marks.entries()) {
      const r = m && members.get(String(m.login));
      if (!r) return fieldFail([[`marks.${i}.login`, 'Not in your group that week.']]);
      if (m.mark !== null && !['P', 'A'].includes(m.mark)) return fieldFail([[`marks.${i}.mark`, 'P, A or null.']]);
      if (!expected(r)) return fieldFail([[`marks.${i}.login`, `${r.name} is not active, so no attendance is taken.`]]);
    }
    for (const m of d.marks) writeMark('leader', String(m.login), d.weekId, m.mark, members.get(String(m.login)).batchId);
    return ok({ saved: d.marks.length });
  }];
  A['leaders.list'] = [STAFF, (d, u) => {
    const e = requireBatch(u, d.batchId); if (e) return e;
    const fam = levelBatches(d.batchId).filter((b) => scope(u).includes(b));
    const w = mondayOf(nowD()), rows = boardRows(fam, w), byLogin = new Map(rows.map((r) => [r.login, r]));
    const mine = [...leaders.entries()].filter(([, x]) => fam.includes(x.batchId));
    const isLeader = new Set(mine.map(([l]) => l));
    return ok({ batchId: d.batchId, weekId: w, batches: fam.map((b) => ({ batchId: b, name: db().batches.find((x) => x.batchId === b)?.name || b })),
      groups: mine.map(([l, x]) => { const r = byLogin.get(l);
        return { leader: { login: l, name: r?.name || l, phone: l, whatsapp: r?.whatsapp || l, hasPhoto: !!r?.hasPhoto, attendance: r?.attendance || null }, appointedBy: x.appointedBy, appointedAt: x.appointedAt,
          members: rows.filter((m) => m.leaderLogin === l && m.login !== l).map(memberView) }; }),
      unassigned: rows.filter((m) => expected(m) && !isLeader.has(m.login) && (!m.leaderLogin || !isLeader.has(m.leaderLogin))).map(memberView) });
  }];
  const batchDevotee = (u, login) => {
    const t = db().users[String(login || '')];
    if (!t || t.role !== 'DEVOTEE' || t.status !== 'ACTIVE') return { err: fail('NOT_FOUND', 'No active devotee with that phone.') };
    const m = current(t);
    if (!m || m.state !== 'ACTIVE') return { err: fail('CONFLICT', `${t.name} is not an active member of a batch.`) };
    const e = requireBatch(u, m.batchId); if (e) return { err: e };
    return { t, m };
  };
  A['leaders.set'] = [STAFF, (d, u) => {
    if (typeof d.leader !== 'boolean') return fieldFail([['leader', 'true or false.']]);
    const x = batchDevotee(u, d.login); if (x.err) return x.err;
    const was = leaders.get(x.t.login);
    if (d.leader) {
      if (!was) { leaders.set(x.t.login, { batchId: x.m.batchId, appointedBy: u.login, appointedAt: isoIst(nowD()) }); x.m.leaderLogin = ''; }
      return ok({ login: x.t.login, leader: true, batchId: (was || leaders.get(x.t.login)).batchId });
    }
    if (was) { leaders.delete(x.t.login); for (const t of Object.values(db().users)) { const m = current(t); if (m?.leaderLogin === x.t.login) m.leaderLogin = ''; } }
    return ok({ login: x.t.login, leader: false });
  }];
  A['leaders.assign'] = [STAFF, (d, u) => {
    const logins = Array.isArray(d.logins) ? d.logins.map(String) : [];
    if (!logins.length || logins.length > 300) return fieldFail([['logins', 'Choose 1 to 300 devotees.']]);
    const l = d.leader ? leaders.get(String(d.leader)) : null;
    if (d.leader && !l) return fieldFail([['leader', 'Not a group leader.']]);
    if (l) { const e = requireBatch(u, l.batchId); if (e) return e; }
    const todo = [];
    for (const [i, login] of logins.entries()) {
      const x = batchDevotee(u, login); if (x.err) return x.err;
      if (l && !levelBatches(l.batchId).includes(x.m.batchId)) return fieldFail([[`logins.${i}`, `${x.t.name} is in a batch of another level.`]]);
      if (leaders.has(x.t.login)) return fieldFail([[`logins.${i}`, `${x.t.name} is a group leader (in no group).`]]);
      if ((x.m.leaderLogin || '') !== (d.leader || '')) todo.push(x.m);
    }
    for (const m of todo) m.leaderLogin = d.leader || '';
    return ok({ leader: d.leader || null, moved: todo.length });
  }];

  // ---------- board, chart, attendance ----------
  A['devotees.list'] = [STAFF, (d, u) => {
    const e = requireBatch(u, d.batchId); if (e) return e;
    if (d.status !== undefined && !['ACTIVE', 'INACTIVE', 'DISABLED'].includes(d.status)) return fieldFail([['status', 'ACTIVE, INACTIVE or DISABLED.']]);
    const w = d.weekId === undefined ? focusWeek() : d.weekId;
    if (!validWeekId(w)) return fieldFail([['weekId', 'Not a week.']]);
    const now = nowD();
    // attendance is for the week's class: it can be marked from the class day (Sunday) until the week's deadline (submit_closes)
    const opens = attendanceOpens(w, dayOfBatch(d.batchId));
    return ok({ weekId: w, closesAt: isoIst(closesOf(w)), attendanceOpensAt: isoIst(opens), attendanceOpen: now < closesOf(w) && now >= opens, classWeek: classWeekOf(d.batchId, w),
      rows: boardRows([d.batchId], w).filter((r) => !d.status || r.accountStatus === d.status) });
  }];

  // ---------- members: everyone of the caller's batches (a master: all), active, inactive and disabled ----------
  A['members.list'] = [STAFF, (d, u) => {
    let ids = scope(u);
    if (d.batchId) { const e = requireBatch(u, d.batchId); if (e) return e; ids = [d.batchId]; }
    const status = d.status || 'ALL';
    if (!['ALL', 'ACTIVE', 'INACTIVE', 'DISABLED'].includes(status)) return fieldFail([['status', 'ALL, ACTIVE, INACTIVE or DISABLED.']]);
    const lim = d.limit ?? 50, off = d.offset ?? 0, q = String(d.q || '').trim().toLowerCase();
    const latest = (x) => memberships(x).at(-1) || null;
    let rows = Object.values(db().users).filter((x) => x.role === 'DEVOTEE' && ['ACTIVE', 'INACTIVE', 'DISABLED'].includes(x.status) && latest(x) && ids.includes(latest(x).batchId))
      .filter((x) => !d.classDay || latest(x).classDay === d.classDay)
      .filter((x) => !d.bloodGroup || x.profile?.bloodGroup === d.bloodGroup)
      .filter((x) => !q || x.name.toLowerCase().includes(q) || x.login.includes(q.replace(/\D/g, '') || q) || String(x.iyfId || '').toLowerCase().includes(q));
    // a devotee's status as staff read it (worker devotees.js effective): an ACTIVE account with an INACTIVE membership reads INACTIVE
    const eff = (x) => (x.status === 'ACTIVE' && latest(x).state === 'INACTIVE' ? 'INACTIVE' : x.status);
    const counts = { ACTIVE: 0, INACTIVE: 0, DISABLED: 0 };
    rows.forEach((x) => counts[eff(x)]++);
    if (status !== 'ALL') rows = rows.filter((x) => eff(x) === status);
    const view = (x) => { const m = latest(x), b = db().batches.find((y) => y.batchId === m.batchId);
      return { login: x.login, name: x.name, iyfId: x.iyfId || null, status: eff(x), batchId: m.batchId, batchName: b?.name || m.batchId,
        inactiveSince: m.state === 'INACTIVE' || x.status === 'INACTIVE' ? m.fromWeek : null, since: m.state === 'ACTIVE' ? m.fromWeek : null,
        classDay: m.classDay || null, facilitator: m.facilitator || '', whatsapp: x.whatsapp || '', email: x.email || '', hasPhoto: photos.has(x.login), bloodGroup: x.profile?.bloodGroup || null,
        lastSubmitted: null, weeksSubmitted: 0, lastLogin: null }; };
    const by = d.sort === 'inactive' ? (a, b) => (a.status === 'INACTIVE' ? 0 : 1) - (b.status === 'INACTIVE' ? 0 : 1) || a.name.localeCompare(b.name) : (a, b) => a.name.localeCompare(b.name);
    rows = rows.map(view).sort(by);
    return ok({ rows: rows.slice(off, off + lim), total: rows.length, counts });
  }];

  A['stats.batch'] = [STAFF, (d, u) => {
    const e = requireBatch(u, d.batchId); if (e) return e;
    const n = d.weeks === undefined ? 12 : d.weeks;
    if (!Number.isInteger(n) || n < 1 || n > 26) return fieldFail([['weeks', '1 to 26.']]);
    const w0 = focusWeek(), rows = boardRows([d.batchId], w0), exp = rows.filter(expected), count = (s) => exp.filter((r) => r.status === s).length;
    const weeks = Array.from({ length: n }, (_, i) => addDays(w0, -7 * (n - 1 - i)));
    const missedLog = [];
    const trend = weeks.map((w) => {
      const rs = boardRows([d.batchId], w), ex = rs.filter((r) => r.membership === 'ACTIVE'), s = rs.filter((r) => r.status === 'SUBMITTED').length;
      for (const r of rs) if (r.status === 'MISSED') missedLog.push({ login: r.login, name: r.name, weekId: w, daysFilled: r.daysFilled });
      return { weekId: w, expected: ex.length, submitted: s, missed: rs.filter((r) => r.status === 'MISSED').length, filledPct: ex.length ? Math.min(100, Math.round((s / ex.length) * 100)) : 0 };
    });
    missedLog.sort((a, b) => (a.weekId < b.weekId ? 1 : a.weekId > b.weekId ? -1 : a.name.localeCompare(b.name)));
    const cur = Object.values(db().users).filter((x) => x.role === 'DEVOTEE' && current(x)?.batchId === d.batchId);
    return ok({
      weekId: w0,
      thisWeek: { expected: exp.length, submitted: count('SUBMITTED'), draft: count('DRAFT') + count('REOPENED'), notStarted: count('NOT_STARTED'), missed: count('MISSED'),
        byDay: Array.from({ length: 7 }, (_, i) => exp.filter((r) => r.status === 'SUBMITTED' || r.days[i] === 'complete').length) },
      trend,
      people: { active: cur.filter((x) => x.status === 'ACTIVE' && current(x).state === 'ACTIVE').length, inactive: cur.filter((x) => x.status === 'INACTIVE' || current(x).state === 'INACTIVE').length,
        disabled: cur.filter((x) => x.status === 'DISABLED').length, pending: Object.values(db().users).filter((x) => x.status === 'PENDING' && x.batchId === d.batchId).length },
      missedLog: missedLog.slice(0, 200),
    });
  }];

  A['attendance.set'] = [STAFF, (d, u) => {
    const e = requireBatch(u, d.batchId); if (e) return e;
    if (!validWeekId(d.weekId)) return fieldFail([['weekId', 'Not a week.']]);
    if (!Array.isArray(d.marks) || !d.marks.length || d.marks.length > 300) return fieldFail([['marks', 'Mark at least one devotee.']]);
    const now = nowD();
    const bcd = readDay(dayOfBatch(d.batchId));
    if (now < attendanceOpens(d.weekId, bcd)) return fail('FUTURE_DAY', `Attendance can be marked from the ${DAY_NAME[bcd]} class.`);
    if (now >= closesOf(d.weekId)) return fail('WINDOW_CLOSED', `Attendance for this week closed at its ${deadlinePhrase(d.weekId)}. Ask the master to change it.`);
    const members = new Map(boardRows([d.batchId], d.weekId).map((r) => [r.login, r]));
    for (const [i, m] of d.marks.entries()) {
      if (!m || !members.has(String(m.login))) return fieldFail([[`marks.${i}.login`, 'Not a devotee of this batch that week.']]);
      if (m.mark !== null && !['P', 'A'].includes(m.mark)) return fieldFail([[`marks.${i}.mark`, 'P, A or null.']]);
      const r = members.get(String(m.login));
      if (!expected(r)) return fieldFail([[`marks.${i}.login`, `${r.name} is not active, so no attendance is taken.`]]);
    }
    for (const m of d.marks) writeMark('coordinator', m.login, d.weekId, m.mark, members.get(String(m.login)).batchId);
    return ok({ saved: d.marks.length });
  }];

  A['attendance.override'] = [MASTER, (d, u) => {
    if (!reasonOk(d.reason)) return fieldFail([['reason', 'Give a short reason.']]);
    if (!validWeekId(d.weekId)) return fieldFail([['weekId', 'Not a week.']]);
    if (d.mark !== null && !['P', 'A'].includes(d.mark)) return fieldFail([['mark', 'P, A or null.']]);
    const m = managed(u, d.login); if (m.err) return m.err;
    const row = boardRows(scope(u), d.weekId).find((r) => r.login === m.t.login);
    if (!row) return fail('NOT_FOUND', `${m.t.name} was not in a batch that week.`);
    const a = writeMark('master', m.t.login, d.weekId, d.mark, row.batchId);
    return ok(attView(a, classWeekOf(row.batchId, d.weekId)));
  }];

  A['weeks.setClass'] = [STAFF, (d, u) => {
    const e = requireBatch(u, d.batchId); if (e) return e;
    if (!validWeekId(d.weekId)) return fieldFail([['weekId', 'Not a week.']]);
    const now = nowD();
    if (weekStart(d.weekId) - now > 14 * 864e5) return fieldFail([['weekId', 'At most two weeks ahead.']]);
    const closed = now >= closesOf(d.weekId), master = h.scopesOf(u).master;
    if (closed && !master) return fail('WINDOW_CLOSED', `This week closed at its ${deadlinePhrase(d.weekId)}. Ask the master to change it.`);
    if (closed && !reasonOk(d.reason)) return fieldFail([['reason', 'Give a short reason.']]);
    const regular = d.kind === 'REGULAR', note = String(d.note || '').replace(/\s+/g, ' ').trim();
    if (!regular && !['HOLIDAY', 'FESTIVAL', 'OTHER'].includes(d.kind)) return fieldFail([['kind', 'Holiday, festival, other, or a regular class.']]);
    if (!regular && (note.length < 2 || note.length > 80)) return fieldFail([['note', 'Say why there is no class (2–80 characters), e.g. Diwali.']]);
    if (!regular && typeof d.everyonePresent !== 'boolean') return fieldFail([['everyonePresent', 'Choose: everyone present, or only those you mark.']]);
    const k = d.batchId + '|' + d.weekId;
    if (regular) _state().classWeeks.delete(k);
    else _state().classWeeks.set(k, { kind: d.kind, note, everyonePresent: d.everyonePresent, by: u.login, at: isoIst(now) });
    return ok({ weekId: d.weekId, classWeek: classWeekOf(d.batchId, d.weekId) });
  }];

  // ---------- one devotee ----------
  A['devotees.get'] = [STAFF, (d, u) => {
    const m = managed(u, d.login, { allowPending: true }); if (m.err) return m.err;
    const t = m.t, cur = current(t), p = t.profile, focus = focusWeek(), lastWeeks = [];
    for (let back = 0; back < 30 && lastWeeks.length < 8; back++) {
      const w = addDays(focus, -7 * back), x = weekOf(t, w);
      if (x.status === 'SUBMITTED' || x.status === 'MISSED' || x.status === 'REOPENED') { const at = _state().atts.get(dk(t.login, w)); lastWeeks.push({ weekId: w, status: x.status === 'SUBMITTED' ? 'SUBMITTED' : 'MISSED', overall: x.overall, byCoordinator: x.byCoordinator, attendance: at ? (({ used, by }) => ({ used, by }))(attView(at, null)) : null }); }
    }
    const age = p?.dob ? Math.floor((nowD() - new Date(p.dob + 'T00:00:00+05:30')) / 31557600000) : null;
    return ok({
      login: t.login, name: t.name, iyfId: t.iyfId || null, status: t.status === 'ACTIVE' && cur?.state === 'INACTIVE' ? 'INACTIVE' : t.status, batchId: m.batchId,
      facilitator: cur?.facilitator || t.facilitator || '', classDay: cur?.classDay || t.classDay || null, email: t.email || '', whatsapp: t.whatsapp || '',
      since: cur?.fromWeek || null, levelEntryDate: t.levelEntryDate || null, hasPhoto: photos.has(t.login),
      profile: p ? { dob: p.dob || null, age, bloodGroup: p.bloodGroup || null, emergency: p.emergency || null, address: p.address || null } : null,
      memberships: memberships(t).map((x) => ({ ...x })), lastWeeks,
      trainings: h.trainingsOf ? h.trainingsOf(t.login) : [],
    });
  }];

  // promote ONE devotee, no closing (closing.js, 16 Oct 2026): the ladder for a coordinator, any batch for the head
  const LADDER = { VL2: ['VL3'], VL3: ['SPS'], SPS: ['DPS'], DPS: ['BSS', 'BVS'], BSS: [] };
  const levelOfB = (id) => String(db().batches.find((b) => b.batchId === id)?.level || '').toUpperCase();
  A['devotees.promoteOptions'] = [STAFF, (d, u) => {
    const m = managed(u, d.login); if (m.err) return m.err;
    const cur = current(m.t); if (!cur) return fail('CONFLICT', `${m.t.name} is not in a batch.`);
    const allowed = LADDER[levelOfB(cur.batchId)] || [], master = h.scopesOf(u).master;
    const open = db().batches.filter((b) => b.active && !b.closedAt && b.batchId !== cur.batchId);
    return ok({ login: m.t.login, name: m.t.name, batchId: cur.batchId, level: levelOfB(cur.batchId), nextLevels: allowed,
      batches: open.filter((b) => master || allowed.includes(String(b.level || '').toUpperCase()))
        .map((b) => ({ batchId: b.batchId, name: b.name, level: b.level, offLadder: !allowed.includes(String(b.level || '').toUpperCase()) })) });
  }];
  A['devotees.promote'] = [STAFF, (d, u) => {
    const m = managed(u, d.login); if (m.err) return m.err;
    const t = m.t, cur = current(t);
    if (!cur) return fail('CONFLICT', `${t.name} is not in a batch.`);
    if (t.status !== 'ACTIVE') return fail('CONFLICT', `${t.name} is not active.`);
    const dest = db().batches.find((b) => b.batchId === d.toBatch && b.active && !b.closedAt);
    if (!dest) return fieldFail([['toBatch', 'Choose the batch they move up to.']]);
    if (dest.batchId === cur.batchId) return fieldFail([['toBatch', `${t.name} is already in that batch.`]]);
    const allowed = LADDER[levelOfB(cur.batchId)] || [], toLevel = String(dest.level || '').toUpperCase();
    if (!allowed.includes(toLevel) && !h.scopesOf(u).master) return fieldFail([['toBatch', `${t.name} cannot move from ${levelOfB(cur.batchId)} to ${toLevel}. Ask the IYF head.`]]);
    const week = d.fromWeek || mondayOf(nowD()), from = cur.batchId;
    cur.toWeek = addDays(week, -7);
    t.memberships.push({ ...cur, batchId: dest.batchId, fromWeek: week, toWeek: null, reason: String(d.reason || '').trim() || `promoted from ${from}` });
    t.batchId = dest.batchId;
    return ok({ login: t.login, name: t.name, fromBatch: from, toBatch: dest.batchId, fromWeek: week, offLadder: !allowed.includes(toLevel) });
  }];
  // ADR 0014 D: active devotees whose facilitator is not on the active list (facilitators.js orphans)
  A['facilitators.orphans'] = [MASTER, () => {
    const on = h.facilitators();
    const students = Object.values(db().users).filter((x) => x.role === 'DEVOTEE' && x.status === 'ACTIVE')
      .map((x) => ({ x, m: current(x) })).filter(({ m }) => m && m.state === 'ACTIVE' && m.facilitator && !on.includes(m.facilitator))
      .map(({ x, m }) => ({ login: x.login, name: x.name, iyfId: x.iyfId || '', batchId: m.batchId, batchName: h.batchName ? h.batchName(m.batchId) : m.batchId, facilitator: m.facilitator, since: m.fromWeek }))
      .sort((a, b) => a.facilitator.localeCompare(b.facilitator) || a.name.localeCompare(b.name));
    return ok({ students, facilitators: on });
  }];
  A['devotees.setPeople'] = [STAFF, (d, u) => {
    const m = managed(u, d.login); if (m.err) return m.err;
    const cur = current(m.t); if (!cur) return fail('CONFLICT', 'This devotee has no batch.');
    const f = [];
    if (d.facilitator !== undefined && d.facilitator !== cur.facilitator && !h.facilitators().includes(d.facilitator)) f.push(['facilitator', 'Choose the facilitator from the list.']);
    if (d.classDay !== undefined && !['SUN', 'SAT'].includes(d.classDay)) f.push(['classDay', 'Sunday or Saturday.']);
    if (f.length) return fieldFail(f);
    if (d.facilitator !== undefined) cur.facilitator = d.facilitator;
    if (d.classDay !== undefined) cur.classDay = d.classDay;
    return ok({ facilitator: cur.facilitator, classDay: cur.classDay || null });
  }];

  A['devotees.setActive'] = [STAFF, (d, u) => {
    if (typeof d.active !== 'boolean') return fieldFail([['active', 'true or false.']]);
    const m = managed(u, d.login); if (m.err) return m.err;
    const t = m.t, cur = current(t);
    if (t.status === 'DISABLED') return fail('CONFLICT', 'Enable the account first.');
    // a facilitator, coordinator or head among the devotees: only the head changes them (worker managed({ change: true }))
    if (!h.scopesOf(u).master && (t.facilitatorName || t.isMaster || db().batches.some((b) => b.coordinator === t.login || (t.coordinates || []).includes(b.batchId))))
      return fail('FORBIDDEN', 'This person also coordinates a batch or is the IYF head; only the IYF head can change them.');
    // the worker (devotees.js, Phase 22 I2): only the MEMBERSHIP changes; the login stays ACTIVE and keeps working
    if (t.status === 'ACTIVE' && (cur?.state === 'ACTIVE') === d.active && !(t.autoInactive && !d.active)) return ok({ status: t.status === 'ACTIVE' && cur?.state === 'INACTIVE' ? 'INACTIVE' : t.status });
    if (!cur) return fail('CONFLICT', 'This devotee has no batch.');
    const now = nowD(), thisWeek = mondayOf(now), allowed = [thisWeek, addDays(thisWeek, 7)];
    if (now < closesOf(addDays(thisWeek, -7))) allowed.unshift(addDays(thisWeek, -7));
    const from = d.fromWeek === undefined ? thisWeek : String(d.fromWeek);
    if (!allowed.includes(from)) return fieldFail([['fromWeek', 'Choose this week, next week, or last week until its deadline.']]);
    const state = d.active ? 'ACTIVE' : 'INACTIVE';
    if (cur.state !== state) {
      manualActivity(t, cur.batchId, state, u.login);
      if (cur.fromWeek >= from) Object.assign(cur, { state, fromWeek: from, reason: d.active ? 'reactivated' : 'inactive' });
      else { cur.toWeek = addDays(from, -7); t.memberships.push({ ...cur, state, fromWeek: from, toWeek: null, reason: d.active ? 'reactivated' : 'inactive' }); }
    }
    if (t.status === 'INACTIVE') t.status = 'ACTIVE';
    // a person's decision replaces the app's (worker devotees.js): using the app no longer brings them back
    t.autoInactive = false;
    return ok({ status: state, fromWeek: from });
  }];

  A['devotees.setDisabled'] = [STAFF, (d, u) => {
    if (typeof d.disabled !== 'boolean') return fieldFail([['disabled', 'true or false.']]);
    const m = managed(u, d.login); if (m.err) return m.err;
    const t = m.t;
    if (d.disabled === (t.status === 'DISABLED')) return ok({ status: t.status });
    // enabling returns the login to ACTIVE; an inactive membership stays and reads INACTIVE (worker devotees.js)
    t.status = d.disabled ? 'DISABLED' : 'ACTIVE';
    if (d.disabled) h.endSessions(t.login);
    return ok({ status: !d.disabled && current(t)?.state === 'INACTIVE' ? 'INACTIVE' : t.status });
  }];

  A['devotees.delete'] = [STAFF, (d, u) => {
    const m = managed(u, d.login, { allowPending: true }); if (m.err) return m.err;
    if (String(d.confirmPhone || '').replace(/\D/g, '').slice(-10) !== m.t.login) return fieldFail([['confirmPhone', 'Type the phone number again to confirm.']]);
    delete db().users[m.t.login];
    photos.delete(m.t.login);
    h.endSessions(m.t.login);
    for (const r of db().registry) if (r.linked === m.t.login) r.linked = null;
    return ok({});
  }];

  // ---------- missed weeks ----------
  A['reopen.request'] = [STAFF, (d, u) => {
    if (!validWeekId(d.weekId)) return fieldFail([['weekId', 'Not a week.']]);
    if (!reasonOk(d.reason)) return fieldFail([['reason', 'Give a short reason.']]);
    const m = managed(u, d.login); if (m.err) return m.err;
    if (!isMissed(m.t, d.weekId)) return fail('CONFLICT', 'Only a missed week can be reopened.');
    reopenReqs.set(dk(m.t.login, d.weekId), { login: m.t.login, weekId: d.weekId, batchId: m.batchId, reason: d.reason.trim(), by: u.login, at: isoIst(nowD()), state: 'PENDING' });
    return ok({});
  }];
  A['reopen.list'] = [STAFF, (d, u) => ok({ requests: [...reopenReqs.values()].filter((r) => r.state === 'PENDING' && (h.scopesOf(u).master || (h.batchIdsOf?.(u) || []).includes(r.batchId))).sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((r) => ({ login: r.login, name: db().users[r.login]?.name || r.login, weekId: r.weekId, batchId: r.batchId, reason: r.reason, by: r.by, at: r.at })) })];
  A['reopen.reject'] = [MASTER, (d) => {
    if (!validWeekId(d.weekId)) return fieldFail([['weekId', 'Not a week.']]);
    if (!reasonOk(d.reason)) return fieldFail([['reason', 'Give a short reason.']]);
    const r = reopenReqs.get(dk(String(d.login), d.weekId));
    if (!r || r.state !== 'PENDING') return fail('NOT_FOUND', 'No such request.');
    r.state = 'REJECTED';
    return ok({});
  }];
  A['weeks.reopen'] = [MASTER, (d, u) => {
    if (!validWeekId(d.weekId)) return fieldFail([['weekId', 'Not a week.']]);
    if (!reasonOk(d.reason)) return fieldFail([['reason', 'Give a short reason.']]);
    const m = managed(u, d.login); if (m.err) return m.err;
    if (m.t.status !== 'ACTIVE') return fail('CONFLICT', `${m.t.name} is not active, so they could not fill it.`);
    const until = new Date(d.openUntil || ''), now = nowD();
    // no cap on how far ahead the head may hold a week open (the head, 16 Oct 2026); the limit is at
    // the coordinator's level, where they ask and the head decides
    if (isNaN(until) || until <= now) return fieldFail([['openUntil', 'Choose a time in the future.']]);
    if (weekOf(m.t, d.weekId).status === 'SUBMITTED') return fail('ALREADY_SUBMITTED', 'That week was submitted; it is never changed.');
    if (!isMissed(m.t, d.weekId)) return fail('CONFLICT', 'Only a missed week can be reopened.');
    reopens.set(dk(m.t.login, d.weekId), { openUntil: isoIst(until) });
    const r = reopenReqs.get(dk(m.t.login, d.weekId)); if (r) r.state = 'DONE';
    return ok({ openUntil: isoIst(until) });
  }];

  // ---------- birthdays ----------
  A['birthdays.today'] = [STAFF, (d, u) => {
    const batches = scope(u), now = nowD(), days = Array.from({ length: 8 }, (_, i) => ymd(new Date(now.getTime() + i * 864e5)));
    const today = [], upcoming = [];
    for (const t of Object.values(db().users)) {
      const cur = t.role === 'DEVOTEE' && t.status === 'ACTIVE' ? current(t) : null;
      if (!cur || cur.state !== 'ACTIVE' || !batches.includes(cur.batchId) || !t.profile?.dob) continue;
      const i = days.findIndex((x) => x.slice(5) === t.profile.dob.slice(5));
      if (i < 0) continue;
      const item = { login: t.login, name: t.name, batchId: cur.batchId, date: days[i], age: Number(days[i].slice(0, 4)) - Number(t.profile.dob.slice(0, 4)) };
      (i === 0 ? today : upcoming).push(item);
    }
    upcoming.sort((x, y) => x.date.localeCompare(y.date) || x.name.localeCompare(y.name));
    return ok({ today, upcoming });
  }];

  // ---------- own profile and photo ----------
  const BG = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', "Don't know"];
  const yearSeq = {};   // the mock's stand-in for id_sequences: one counter per year
  const profileView = (u) => ({ name: u.name, iyfId: u.iyfId || '', email: u.email || '', whatsapp: u.whatsapp || '', classDay: current(u)?.classDay || u.classDay || null, facilitator: current(u)?.facilitator || u.facilitator || null, dob: u.profile?.dob || null, bloodGroup: u.profile?.bloodGroup || null, emergency: u.profile?.emergency || null, address: u.profile?.address || null,
    readingPagesPerHour: u.readingPagesPerHour ?? 20, hasPhoto: photos.has(u.login), photoUpdatedAt: photos.get(u.login)?.updatedAt || null,
    ...(() => { const y = (/^IYFD-(\d{4})-/.exec(u.iyfId || '')?.[1] || '') || String(u.profile?.connectedSince || '');
                // settable until an IYFD carries the year (worker profile.js, 22 Oct 2026)
                return { connectedSinceYear: y, connectedSinceSettable: !/^IYFD-/.test(u.iyfId || '') }; })() });
  // their own trainings travel with their profile: About shows what they did in ETP, and the person
  // it is about could not see their own record before (18 Oct 2026)
  A['profile.get'] = [ANY, (d, u) => ok({ ...profileView(u), trainings: h.trainingsOf ? h.trainingsOf(u.login) : [] })];
  A['profile.update'] = [ANY, (d, u) => {
    const f = [], set = {};
    if (d.dob !== undefined) {
      const age = /^\d{4}-\d{2}-\d{2}$/.test(d.dob || '') ? Math.floor((nowD() - new Date(d.dob)) / 31557600000) : -1;
      if (age < 12 || age > 80) f.push(['dob', 'Check your date of birth.']); else set.dob = d.dob;
    }
    if (d.bloodGroup !== undefined) { if (!BG.includes(d.bloodGroup)) f.push(['bloodGroup', 'Choose from the list.']); else set.bloodGroup = d.bloodGroup; }
    if (d.emergency !== undefined) {
      const em = d.emergency || {}, n = String(em.name || '').trim(), r = String(em.relation || '').trim(), ph = String(em.phone || '').replace(/\D/g, '').slice(-10);
      if (!/^[\p{L} .']{2,60}$/u.test(n)) f.push(['emergency.name', "Enter the emergency contact's name."]);
      if (!r || r.length > 30) f.push(['emergency.relation', 'Enter how they are related to you.']);
      if (!/^[6-9]\d{9}$/.test(ph)) f.push(['emergency.phone', 'Enter their 10-digit mobile number.']);
      else if (ph === u.login) f.push(['emergency.phone', "Use someone else's number, not your own."]);
      set.emergency = { name: n, relation: r, phone: ph };
    }
    if (d.email !== undefined) {
      const e = normEmail(d.email);
      if (!e) f.push(['email', 'Enter a valid email address.']);
      else { const m = emailProblem(e); if (m) f.push(['email', m]); else u.email = e; }
    }
    if (d.whatsapp !== undefined) { const w = normWhatsapp(d.whatsapp); if (w === null) f.push(['whatsapp', 'Enter a 10-digit WhatsApp number, or leave it empty.']); else u.whatsapp = w; }
    if (d.classDay !== undefined) { if (!['SUN', 'SAT'].includes(d.classDay)) f.push(['classDay', 'Sunday or Saturday.']); else { const m = current(u); if (m) m.classDay = d.classDay; else u.classDay = d.classDay; } }
    // one's own facilitator (the head, 5 Oct 2026): picked from the list; a name switched off is kept only if it is the current one
    if (d.facilitator !== undefined) { const m = current(u), was = m?.facilitator || u.facilitator || ''; if (d.facilitator !== was && !h.facilitators().includes(d.facilitator)) f.push(['facilitator', 'Choose your facilitator from the list.']); else if (m) m.facilitator = d.facilitator; else u.facilitator = d.facilitator; }
    // one's own name through the one rename (worker names.js): a facilitator who IS this login is renamed with them
    if (d.name !== undefined) { const n = String(d.name || '').replace(/\s+/g, ' ').trim(); if (!/^[\p{L} .']{2,60}$/u.test(n)) f.push(['name', 'Enter your name (letters and spaces).']); else { const why = h.renamePerson ? h.renamePerson(u, n) : (u.name = n, ''); if (why) f.push(['name', why]); } }
    if (d.address !== undefined) { const ae = addressErrors(d.address); if (Object.keys(ae).length) f.push(...Object.entries(ae)); else set.address = cleanAddress(d.address); }
    if (d.readingPagesPerHour !== undefined) { if (!Number.isInteger(d.readingPagesPerHour) || d.readingPagesPerHour < 1 || d.readingPagesPerHour > 200) f.push(['readingPagesPerHour', '1 to 200 pages.']); else u.readingPagesPerHour = d.readingPagesPerHour; }
    let newYear = '';
    if (d.connectedSince !== undefined) {
      // as the worker: an IYFD locks it; a year on record may only be confirmed; with none, it is chosen
      const held = /^IYFD-(\d{4})-/.exec(u.iyfId || '')?.[1] || '';
      const onRecord = String(u.profile?.connectedSince || '').slice(0, 4);
      const y = String(d.connectedSince || ''), now = nowD().getFullYear();
      if (held) f.push(['connectedSince', 'Your year is already set. Ask the IYF head if it is wrong.']);
      else if (onRecord && y !== onRecord) f.push(['connectedSince', `Your year is on record as ${onRecord}. Ask the IYF head if it is wrong.`]);
      else if (!/^(19|20)\d{2}$/.test(y) || +y < 1980 || +y > now) f.push(['connectedSince', 'Choose the year you first came to IYF Delhi.']);
      else newYear = y;
    }
    if (f.length) return fieldFail(f);
    u.profile = { ...(u.profile || {}), ...set };
    if (newYear) {
      // the IYFD id follows at once, from a counter per YEAR, superseding any old number
      yearSeq[newYear] = (yearSeq[newYear] || 0) + 1;
      u.profile.connectedSince = newYear;
      u.iyfId = `IYFD-${newYear}-${String(yearSeq[newYear]).padStart(4, '0')}`;
    }
    return ok(profileView(u));
  }];
  const photoOwner = (u, login) => (login === undefined || String(login) === u.login ? { login: u.login, own: true } : (() => { const m = managed(u, login, { allowPending: true }); return m.err ? m : { login: m.t.login, own: false }; })());
  A['photo.upload'] = [ANY, (d, u) => {
    const s = String(d.jpegBase64 || '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s) || s.length > Math.ceil((150 * 1024) / 3) * 4 || !s.startsWith('/9j/')) return fieldFail([['jpegBase64', 'The photo must be a JPEG of at most 150 KB.']]);
    const at = isoIst(nowD());
    photos.set(u.login, { jpegBase64: s, updatedAt: at });
    return ok({ hasPhoto: true, photoUpdatedAt: at });
  }];
  A['photo.get'] = [ANY, (d, u) => {
    const o = photoOwner(u, d.login); if (o.err) return o.err;
    const p = photos.get(o.login);
    return p ? ok({ jpegBase64: p.jpegBase64, updatedAt: p.updatedAt }) : fail('NOT_FOUND', 'No photo.');
  }];
  A['photo.remove'] = [ANY, (d, u) => {
    const o = photoOwner(u, d.login); if (o.err) return o.err;
    if (!o.own && !reasonOk(d.reason)) return fieldFail([['reason', 'Give a short reason.']]);
    photos.delete(o.login);
    return ok({ hasPhoto: false });
  }];

  // ---------- IYF IDs (master) ----------
  const regView = (r) => ({ ...h.regRow(r), linkedAccount: r.linked ? { login: r.linked, name: db().users[r.linked]?.name || '' } : null });
  A['ids.get'] = [MASTER, (d) => {
    const id = String(d.iyfId || '').trim().toUpperCase(), r = db().registry.find((x) => x.iyfId === id);
    if (!r) return fail('UNKNOWN_ID', id + ' is not in the registry.');
    const t = r.linked && db().users[r.linked];
    return ok({ ...regView(r), phones: [...r.phones], batchHistory: t ? memberships(t).map((m) => ({ batchId: m.batchId, state: m.state, fromWeek: m.fromWeek, toWeek: m.toWeek || '' })) : [] });
  }];
  A['ids.link'] = [MASTER, (d) => {
    if (!reasonOk(d.reason)) return fieldFail([['reason', 'Give a short reason.']]);
    const t = db().users[String(d.login || '')];
    if (!t || t.role !== 'DEVOTEE') return fail('NOT_FOUND', 'No devotee with that phone.');
    if (['PENDING', 'REJECTED'].includes(t.status)) return fail('CONFLICT', 'Approve the sign-up first.');
    const id = String(d.iyfId || '').trim().toUpperCase(), r = db().registry.find((x) => x.iyfId === id);
    if (!r) return fail('UNKNOWN_ID', 'That IYF ID was never allocated.');
    if (r.mergedInto) return fail('UNKNOWN_ID', `That ID was merged into ${r.mergedInto}. Use ${r.mergedInto} instead.`);
    if (r.linked && r.linked !== t.login) return fail('CONFLICT', `${id} already belongs to another account.`);
    for (const x of db().registry) if (x.linked === t.login) x.linked = null;
    r.linked = t.login; t.iyfId = id;
    return ok({});
  }];
  A['ids.unlink'] = [MASTER, (d) => {
    if (!reasonOk(d.reason)) return fieldFail([['reason', 'Give a short reason.']]);
    const t = db().users[String(d.login || '')];
    if (!t || t.role !== 'DEVOTEE') return fail('NOT_FOUND', 'No devotee with that phone.');
    if (!t.iyfId) return fail('CONFLICT', 'This account has no IYF ID linked.');
    for (const x of db().registry) if (x.linked === t.login) x.linked = null;
    t.iyfId = null;
    return ok({});
  }];
  A['ids.possibleDuplicates'] = [MASTER, (d) => {
    const rows = db().registry.filter((r) => !r.mergedInto), byPhone = new Map(), byName = new Map();
    for (const r of rows) {
      const p = r.phones[0]; if (p) (byPhone.get(p) || byPhone.set(p, []).get(p)).push(r);
      const parts = r.name.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
      if (parts.length >= 2) { const k = [...parts].sort().join(' '); (byName.get(k) || byName.set(k, []).get(k)).push(r); }
    }
    const view = (r) => ({ iyfId: r.iyfId, name: r.name, level: r.level, facilitator: r.facilitator, phoneEnd: '…' + (r.phones[0] || '0000').slice(-4), mergedInto: r.mergedInto || null,
      linkedAccount: r.linked ? { login: r.linked, name: db().users[r.linked]?.name || '' } : null });
    const groups = [];
    for (const [, l] of byPhone) if (l.length > 1) groups.push({ why: 'same phone', ids: l.map(view) });
    for (const [, l] of byName) if (l.length > 1) groups.push({ why: 'same name', ids: l.map(view) });
    const keyed = groups.map((g) => ({ ...g, key: g.ids.map((i) => i.iyfId).sort().join(',') })).map((g) => (reviewedDups.has(g.key) ? { ...g, reviewed: reviewedDups.get(g.key) } : g));
    const open = keyed.filter((g) => !g.reviewed);
    return ok({ groups: d.showReviewed ? keyed : open, total: open.length, reviewedCount: keyed.length - open.length,
      byKind: { samePhone: open.filter((g) => g.why === 'same phone').length, sameName: open.filter((g) => g.why === 'same name').length } });
  }];
  A['ids.reviewDuplicate'] = [MASTER, (d, u) => {
    const ids = [...new Set((d.ids || []).map(String))].sort();
    if (ids.length < 2) return fieldFail([['ids', 'The IDs of the group.']]);
    if (d.decision === 'UNDO') reviewedDups.delete(ids.join(',')); else reviewedDups.set(ids.join(','), { by: u.login, at: isoIst(nowD()) });
    return ok({ key: ids.join(','), decision: d.decision });
  }];

  /* Automatic inactive (Phase 23, ADR 0020; worker inactive.js, migration 0071). The server's daily job is a cron; the
     mock has no clock-driven jobs, so it is runDailyInactive() (exported for the tests), with the same rule: an ACTIVE
     devotee whose open ACTIVE membership began 30+ days ago, with no day filled AND no use of the app for 30 days.
     Filling a day or submitting brings anyone back (FILLED); signing in or a signed-in call only those the app made
     inactive (APP, u.autoInactive). Every change is an event: Home's notices and the analysis read them. */
  const ACT_DAYS = 30;
  const trainingB = (b) => /^(ETP|MTP|FTP)-\d+$/.test(String(b.batchId || '')) || String(b.level || '').toUpperCase() === 'ETP';
  const evPush = (login, batchId, change, how, by) => { const at = isoIst(nowD()); events.push({ id: ++evSeq, login, batchId, day: at.slice(0, 10), change, how, at, by }); };
  function comeBack(t, from, how, by) {
    const m = t && current(t);
    if (!m || m.state !== 'INACTIVE') return false;
    const reason = how === 'APP' ? 'came back: used the app' : how === 'FILLED' ? 'came back: filled a day' : 'reactivated';
    evPush(t.login, m.batchId, 'ACTIVE', how, by || t.login);
    if (m.fromWeek >= from) Object.assign(m, { state: 'ACTIVE', reason });
    else { m.toWeek = addDays(from, -7); t.memberships.push({ ...m, state: 'ACTIVE', fromWeek: from, toWeek: null, reason }); }
    t.autoInactive = false;
    return true;
  }
  runDailyInactive = (trackingFrom = '2026-08-31') => {
    const now = nowD(), cut = new Date(now.getTime() - ACT_DAYS * 864e5), cutoff = isoIst(cut), cutDay = cutoff.slice(0, 10), week = mondayOf(now), cutWeek = mondayOf(cut);
    if (!trackingFrom || cutDay < trackingFrom) return 0;
    const { subs, drafts, missed } = _state();
    let n = 0;
    for (const t of Object.values(db().users)) {
      if (t.role !== 'DEVOTEE' || t.status !== 'ACTIVE') continue;
      const m = current(t);
      if (!m || m.state !== 'ACTIVE' || m.fromWeek > cutDay) continue;
      if ((t.lastLogin || '') >= cutoff || (t.lastUsedAt || '') >= cutoff) continue;
      let filled = false;
      for (let w = addDays(cutWeek, -7); w <= week && !filled; w = addDays(w, 7)) {
        const k = dk(t.login, w), x = weekOf(t, w);
        if (x.status === 'SUBMITTED' && (x.submittedAt || '') >= cutoff) filled = true;
        else if (drafts.has(k) && w >= cutWeek) filled = true;
        else if (missed.has(k) && (missed.get(k).daysFilled || 0) > 0 && w >= cutWeek) filled = true;
        else if (subs.has(k) && (subs.get(k).submittedAt || '') >= cutoff) filled = true;
      }
      if (filled || events.some((e) => e.login === t.login && e.how === 'AUTO' && e.day === isoIst(now).slice(0, 10))) continue;
      evPush(t.login, m.batchId, 'INACTIVE', 'AUTO', 'SYSTEM');
      if (m.fromWeek >= week) Object.assign(m, { state: 'INACTIVE', reason: 'auto: 30 days with no day filled and no use of the app' });
      else { m.toWeek = addDays(week, -7); t.memberships.push({ ...m, state: 'INACTIVE', fromWeek: week, toWeek: null, reason: 'auto: 30 days with no day filled and no use of the app' }); }
      t.autoInactive = true;
      n++;
    }
    return n;
  };
  const scopeOfA = (u, batchId) => {
    const mine = new Set(h.batchIdsOf(u)), cls = db().batches.filter((b) => !trainingB(b) && mine.has(b.batchId));
    if (batchId !== undefined && batchId !== '') { const b = cls.find((x) => x.batchId === String(batchId)); return b ? [b] : null; }
    return cls;
  };
  A['activity.notices'] = [STAFF, (d, u) => {
    const ids = scopeOfA(u).map((b) => b.batchId), since = addDays(isoIst(nowD()).slice(0, 10), -13);
    return ok({ since, events: events.filter((e) => ids.includes(e.batchId) && e.day >= since).sort((a, b) => b.id - a.id).slice(0, 60)
      .map((e) => ({ id: e.id, login: e.login, name: db().users[e.login]?.name || e.login, batchId: e.batchId, day: e.day, change: e.change, how: e.how, at: e.at, by: e.by })) });
  }];
  A['activity.stats'] = [STAFF, (d, u) => {
    const today = isoIst(nowD()).slice(0, 10), thisMonth = today.slice(0, 7);
    const month = d.month === undefined || d.month === '' ? thisMonth : String(d.month);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fieldFail([['month', 'A month, as 2026-10.']]);
    const batches = scopeOfA(u, d.batchId); if (!batches) return fail('FORBIDDEN', 'That batch is not yours.');
    const ids = batches.map((b) => b.batchId), [ty, tm] = thisMonth.split('-').map(Number);
    const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(ty, tm - 1 - (11 - i), 1)).toISOString().slice(0, 7));
    const list = batches.map((b) => {
      const ppl = Object.values(db().users).filter((x) => x.role === 'DEVOTEE' && current(x)?.batchId === b.batchId);
      return { batchId: b.batchId, name: b.name, level: b.level || '', active: ppl.filter((x) => x.status === 'ACTIVE' && current(x).state === 'ACTIVE').length,
        inactive: ppl.filter((x) => x.status !== 'DISABLED' && (x.status === 'INACTIVE' || current(x).state === 'INACTIVE')).length };
    });
    const ev = events.filter((e) => ids.includes(e.batchId));
    const M = Object.fromEntries(months.map((m) => [m, { month: m, inactive: 0, active: 0, auto: 0, manual: 0, filled: 0, app: 0 }]));
    for (const e of ev) { const x = M[e.day.slice(0, 7)]; if (!x) continue; x[e.change === 'INACTIVE' ? 'inactive' : 'active']++; x[e.how.toLowerCase()]++; }
    const [y, mo] = month.split('-').map(Number), last = month === thisMonth ? Number(today.slice(8, 10)) : new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const days = Array.from({ length: month > thisMonth ? 0 : last }, (_, i) => { const k = `${month}-${String(i + 1).padStart(2, '0')}`;
      return { day: k, inactive: ev.filter((e) => e.day === k && e.change === 'INACTIVE').length, active: ev.filter((e) => e.day === k && e.change === 'ACTIVE').length }; });
    return ok({ month, batches: list, totals: { active: list.reduce((a, b) => a + b.active, 0), inactive: list.reduce((a, b) => a + b.inactive, 0) }, months: months.map((m) => M[m]), days });
  }];
  // a submitted week or a saved day brings an inactive devotee back (worker weeks.js → comeBackStatements, FILLED)
  for (const name of ['week.submit', 'week.saveDay']) {
    const f0 = A[name];
    if (f0) A[name] = [f0[0], (d, u, t) => {
      const res = f0[1](d, u, t);
      if (res?.ok) { const me = db().users[d.onBehalfOf || u.login]; if (me && me.status === 'ACTIVE') comeBack(me, d.weekId, 'FILLED', u.login); }
      return res;
    }, ...f0.slice(2)];
  }
  // signing in or a signed-in call: only someone the app made inactive (worker session.js / auth.js, APP)
  cameBackApp = (login) => { const t = db().users[login]; if (t?.autoInactive) comeBack(t, mondayOf(nowD()), 'APP', login); };
  manualActivity = (t, batchId, change, by) => evPush(t.login, batchId, change, 'MANUAL', by);

  // every action added here first adds what depends on the clock (see ensure)
  for (const name of Object.keys(A)) if (!before.has(name)) { const [roles, fn, mc] = A[name]; A[name] = [roles, (d, u, t) => { ensure(); return fn(d, u, t); }, mc]; }
  // for Share sadhana (mockshare.js): the facilitator's student page and week, after the same clock-dependent seeding
  // Home's birthdays (worker weeks.js birthdayStmt): ACTIVE devotees whose open, ACTIVE membership is in this batch and whose
  // dob's month-day is one of `mds`, by name, at most 20 (after the seeding that puts a birthday on today)
  const birthdaysIn = (batchId, mds) => { ensure(); return Object.values(db().users)
    .filter((t) => t.role === 'DEVOTEE' && t.status === 'ACTIVE' && t.profile?.dob && mds.includes(t.profile.dob.slice(5)) && current(t)?.state === 'ACTIVE' && current(t)?.batchId === batchId)
    .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 20).map((t) => ({ login: t.login, name: t.name })); };
  return { current, birthdaysIn, devoteeOf: (x) => { ensure(); return devoteeOf(x); }, weekRead: (t, w) => { ensure(); return weekRead(t, w); } };
}
