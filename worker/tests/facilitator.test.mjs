// Facilitator logins and the read-only view of a devotee's sadhana (the head, 4 Oct 2026): viewing and filling are two
// permissions. A facilitator views their own devotees only; a coordinator views and fills the open week of their
// batches; the IYF head views and fills any week.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { webcrypto as wc } from 'node:crypto';
import { runAnnouncementPushes } from '../src/push.js';

const t = suite('facilitator logins and viewing a devotee\'s sadhana');
const { env, DB, call, clock, rows, addAccount } = boot();
const at = s => { clock.now = Date.parse(s + '+05:30'); };
at('2026-10-05T09:00:00');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS2'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const OTHER = (await call('meta.get', {})).data.facilitators.find(n => n !== FAC);
const join = async (phone, name, facilitator = FAC, batchId = 'SPS2') => {
  await call('auth.signUp', { phone, name, batchId, facilitator, ...CONTACT, password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};
const A = await join('6000000091', 'Arjun Das');
const B = await join('6000000192', 'Bhima Das', FAC, 'BSS');
const X = await join('6000000193', 'Other Facilitator', OTHER);
DB.sql.exec("UPDATE settings SET value = '2026-10-05' WHERE key = 'tracking_from'");

// ---- the head creates the login
t.code(await call('facLogins.create', { username: 'natvar', facilitator: FAC, tempPassword: 'Temp-fac-2026' }, C), 'FORBIDDEN', 'only the IYF head creates facilitator logins');
t.code(await call('facLogins.create', { username: 'natvar', facilitator: 'Not On The List', tempPassword: 'Temp-fac-2026' }, M), 'VALIDATION', 'a name from the facilitators list only');
let r = await call('facLogins.create', { username: 'natvar', facilitator: FAC, tempPassword: 'Temp-fac-2026' }, M);
t.eq([r.data?.login?.facilitator, r.data?.login?.mustChangePassword], [FAC, true], 'created, with a temporary password');
t.code(await call('facLogins.create', { username: 'natvar2', facilitator: FAC, tempPassword: 'Temp-fac-2026' }, M), 'VALIDATION', 'one login per facilitator');
t.eq((await call('facLogins.list', {}, M)).data.logins.map(l => l.username), ['natvar'], 'listed for the head');
t.ok(!(await call('coordinators.list', {}, M)).data.some(c => c.username === 'natvar' || c.login === 'natvar'), 'not among the coordinators');
t.code(await call('coordinators.update', { username: 'natvar', batchIds: ['SPS2'] }, M), 'CONFLICT', 'and can never be given batches');

// ---- the facilitator signs in
r = await call('auth.login', { login: 'natvar', password: 'Temp-fac-2026' });
t.eq([r.data.user.scopes.facilitator, r.data.user.scopes.coordinator, r.data.user.mustChangePassword], [{ name: FAC }, [], true], 'signs in as a facilitator (no batches), must choose a password first');
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'natvar'");
const F = (await call('auth.login', { login: 'natvar', password: 'Temp-fac-2026' })).data.token;

// ---- their devotees, any batch, read-only
at('2026-10-06T10:00:00');
const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 0, day }, A);
r = await call('fac.devotees', {}, F);
t.eq(r.data.rows.map(x => [x.name, x.batchName]).sort(), [['Arjun Das', 'SPS Group 2'], ['Bhima Das', 'BSS']], 'their devotees, from any batch; not another facilitator\'s');
t.eq(r.data.rows.find(x => x.name === 'Arjun Das').status, 'DRAFT', 'with this week\'s status');
r = await call('fac.devotee', { login: '6000000091' }, F);
t.eq([r.data.name, r.data.phone, r.data.whatsapp], ['Arjun Das', '6000000091', '6000000091'], 'one devotee: contact for a call or WhatsApp');
t.code(await call('fac.devotee', { login: '6000000193' }, F), 'NOT_FOUND', 'not another facilitator\'s devotee');
r = await call('fac.week', { login: '6000000091', weekId: '2026-10-05' }, F);
t.eq([r.data.status, r.data.days.map(x => x.state)], ['DRAFT', ['complete', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty']], 'the week being filled: how far it is');
t.ok(r.data.days[0].marks && Object.keys(r.data.days[0].marks).length > 0 && !r.data.days[1].marks, 'a filled day comes with its marks (the day report before Submit)');
// viewing is not editing
t.code(await call('week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 1, day, onBehalfOf: '6000000091' }, F), 'FORBIDDEN', 'a facilitator cannot fill or change a devotee\'s sadhana');
t.code(await call('devotees.list', { batchId: 'SPS2' }, F), 'FORBIDDEN', 'nor use the batch tools');
t.code(await call('attendance.set', { batchId: 'SPS2', weekId: '2026-10-05', marks: [{ login: '6000000091', mark: 'P' }] }, F), 'FORBIDDEN', 'nor mark attendance');

// a submitted week, in full
for (const [i, d] of ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].entries()) { at(d + 'T21:00:00'); await call('week.saveDay', { weekId: '2026-10-05', date: d, version: 0, day }, A); }
at('2026-10-11T19:00:00');
await call('week.saveWeekEnd', { weekId: '2026-10-05', version: 0, nightStay: 'YES', principles: 'YES' }, A);
await call('week.setAttendance', { weekId: '2026-10-05', mark: 'P' }, A);
t.code(await call('week.submit', { weekId: '2026-10-05' }, A), 'ok', 'Arjun submits');
r = await call('fac.week', { login: '6000000091', weekId: '2026-10-05' }, F);
t.eq([r.data.status, r.data.days.length, typeof r.data.scores.overall, r.data.weekEnd.nightStay], ['SUBMITTED', 7, 'number', 'YES'], 'a submitted week: day by day, scores, week-end');
t.eq((await call('fac.devotee', { login: '6000000091' }, F)).data.weeks.map(w => [w.weekId, w.status]), [['2026-10-05', 'SUBMITTED']], 'their weeks with scores');

// ---- viewing for staff: the coordinator the open week only, the head any week
at('2026-10-20T10:00:00');                                                   // two weeks on: 5 Oct is closed
t.code(await call('devotees.week', { login: '6000000091', weekId: '2026-10-19' }, C), 'ok', 'the coordinator views the week being filled');
t.code(await call('devotees.week', { login: '6000000091', weekId: '2026-10-05' }, C), 'FORBIDDEN', 'not an earlier week');
t.eq((await call('devotees.week', { login: '6000000091', weekId: '2026-10-05' }, M)).data.status, 'SUBMITTED', 'the IYF head views any week');
t.code(await call('devotees.week', { login: '6000000192', weekId: '2026-10-19' }, C), 'FORBIDDEN', 'a coordinator: own batches only');

// ---- switched off, password reset
t.code(await call('facLogins.setDisabled', { username: 'natvar', disabled: true }, M), 'ok', 'the head switches the login off');
t.code(await call('fac.devotees', {}, F), 'UNAUTHENTICATED', 'its session ends');
t.code(await call('auth.login', { login: 'natvar', password: 'Temp-fac-2026' }), 'ACCOUNT_DISABLED', 'and it cannot sign in');
await call('facLogins.setDisabled', { username: 'natvar', disabled: false }, M);
t.eq((await call('facLogins.resetPassword', { username: 'natvar', tempPassword: 'New-temp-2026' }, M)).data?.login?.mustChangePassword, true, 'a reset gives a new temporary password');
t.eq(rows("SELECT action FROM audit_log WHERE action LIKE 'facilitators.login%' ORDER BY id").map(x => x.action), ['facilitators.loginCreate', 'facilitators.loginSetDisabled', 'facilitators.loginSetDisabled', 'facilitators.loginResetPassword'], 'every change logged');

// ---- 7 Oct 2026: a facilitator who uses the app as a devotee gets the view in their own login (no second login)
t.code(await call('facLogins.link', { facilitator: OTHER, phone: '6000000091' }, C), 'FORBIDDEN', 'only the IYF head links a facilitator');
t.code(await call('facLogins.link', { facilitator: FAC, phone: '6000000091' }, M), 'VALIDATION', 'a facilitator who already has a login cannot be linked again');
t.code(await call('facLogins.link', { facilitator: OTHER, phone: '6000000052' }, M), 'VALIDATION', 'only a devotee of the app can be linked');
r = await call('facLogins.link', { facilitator: OTHER, phone: '6000000091' }, M);
t.eq([r.data?.login?.kind, r.data?.login?.batch, r.data?.login?.facilitator], ['member', 'SPS2', OTHER], 'linked: the devotee\'s own account, their batch shown');
t.eq((await call('facLogins.list', {}, M)).data.logins.map(l => [l.username, l.kind, l.batch]).sort(), [['6000000091', 'member', 'SPS2'], ['natvar', 'login', 'TRD']], 'listed with the facilitator-only login (no batch: TRD)');
r = await call('fac.devotees', {}, A);
t.eq(r.data?.rows?.map(x => x.login), ['6000000193'], 'their own login now shows their students (and never themself)');
t.ok((await call('home.get', {}, A)).ok, 'and their own sadhana still works');
t.code(await call('facLogins.setDisabled', { username: '6000000091', disabled: true }, M), 'CONFLICT', 'a devotee\'s own login is never switched off from here');
t.eq((await call('facLogins.resetPassword', { username: '6000000091', tempPassword: 'Member-temp-2026' }, M)).data?.login?.mustChangePassword, true, 'the head can still give them a temporary password');
t.ok((await call('facLogins.unlink', { username: '6000000091' }, M)).ok, 'the link is removed');
t.code(await call('facLogins.unlink', { username: 'natvar' }, M), 'CONFLICT', 'a facilitator-only login is switched off, not unlinked');
t.eq(rows("SELECT facilitator_name AS f FROM accounts WHERE login = '6000000091'")[0].f, '', 'their account is a devotee only again');
t.eq(rows("SELECT action FROM audit_log WHERE action LIKE 'facilitators.%Member' ORDER BY id").map(x => x.action), ['facilitators.linkMember', 'facilitators.unlinkMember'], 'link and unlink logged');

// ---- 7 Oct 2026: filling for a devotee shows their own card and lists (not the staff member's mix)
let j = (await call('journals.get', { onBehalfOf: '6000000192' }, M)).data;
const bssJournal = rows("SELECT hearing_journal AS j FROM batches WHERE batch_id = 'BSS'")[0].j;
t.eq([j.journals, j.ownBookLevel, j.batchId, j.lectures.length > 0 && j.lectures.every(l => l.journal === bssJournal), Array.isArray(j.heard)], [[bssJournal], 'BSS/BVS', 'BSS', true, true], 'the head filling for a BSS devotee: their journal only, their book level, their heard list');
t.eq((await call('rules.get', { onBehalfOf: '6000000192' }, M)).data.cardName, 'BVS/DPS/BSS', 'and their score card');
t.code(await call('journals.get', { onBehalfOf: '6000000192' }, C), 'FORBIDDEN', 'a coordinator only for devotees of their batches');
t.eq((await call('journals.get', { onBehalfOf: '6000000091' }, C)).data.batchId, 'SPS2', 'a coordinator for their own batch\'s devotee');
t.code(await call('journals.get', { onBehalfOf: '6000000091' }, X), 'FORBIDDEN', 'a devotee never for someone else');

// ---- 7 Oct 2026: the head adds a batch; its level sets the card and the journal
t.code(await call('batches.create', { batchId: 'SPS3', name: 'SPS Group 3', level: 'SPS' }, C), 'FORBIDDEN', 'only the IYF head adds a batch');
t.code(await call('batches.create', { batchId: 'SPS2', name: 'Again', level: 'SPS' }, M), 'VALIDATION', 'an ID already used is refused');
t.code(await call('batches.create', { batchId: 'BX1', name: 'X', level: 'LEVEL9' }, M), 'VALIDATION', 'a level must be one of the four');
r = await call('batches.create', { batchId: 'sps3', name: 'SPS Group 3', level: 'SPS', pilot: true }, M);
t.eq([r.data?.batchId, r.data?.level, r.data?.pilot, r.data?.active], ['SPS3', 'SPS', true, true], 'added (ID in capitals), active, pilot');
t.eq(rows("SELECT score_card AS c, hearing_journal AS j FROM batches WHERE batch_id = 'SPS3'")[0], { c: 'SPS', j: 'SPS/DPS' }, 'the SPS card and journal, from its level');
// 16 Oct 2026 (ADR 0009): VL-2 and VL-3 run as numbered intakes — "Vedic Level 2, batch 51"
r = await call('batches.create', { batchId: 'VL2-51', name: 'Vedic Level 2 · Batch 51', level: 'VL2', startedOn: '2026-01-05' }, M);
t.eq([r.data?.batchId, r.data?.level, r.data?.tracks], ['VL2-51', 'VL2', 'attendance'], 'a VL-2 intake takes attendance and nothing else');
t.eq(r.data?.startedOn, '2026-01-05', 'and carries the date the intake began');
t.eq(r.data?.closedAt, '', 'a new intake is open: a coordinator closes it, no timer does');
t.eq(rows("SELECT score_card AS c, hearing_journal AS j FROM batches WHERE batch_id = 'VL2-51'")[0], { c: '', j: '' },
  'with no score card and no hearing journal — there is nothing for a card to score in an attendance week');

r = await call('batches.create', { batchId: 'VL3-51', name: 'Vedic Level 3 · Batch 51', level: 'VL3' }, M);
t.eq([r.data?.batchId, r.data?.tracks], ['VL3-51', 'attendance,rounds'], 'VL-3 takes attendance and rounds');
t.ok(r.ok !== false, 'and batch 51 exists in BOTH levels at once: the two count separately');

t.code(await call('batches.create', { batchId: 'VL2-51', name: 'Again', level: 'VL2' }, M), 'VALIDATION', 'the same intake twice is refused');
t.code(await call('batches.create', { batchId: 'VL2-51X', name: 'Bad', level: 'VL2' }, M), 'VALIDATION', 'a batch number is digits only');
t.code(await call('batches.create', { batchId: 'VL2-52', name: 'Mismatch', level: 'VL3' }, M), 'VALIDATION', 'the id and the level must agree');
t.code(await call('batches.create', { batchId: 'VL2-53', name: 'Bad date', level: 'VL2', startedOn: '5 Jan' }, M), 'VALIDATION', 'a start date is a real date');

// the batches that run without end are untouched: never numbered, never closed
t.eq(rows("SELECT tracks AS t, started_on AS s FROM batches WHERE batch_id = 'SPS3'")[0], { t: 'full', s: '' },
  'an SPS batch still asks the full week and has no intake date');

// 8 Oct 2026: each level gets the same card and journal as the batch of that level already running, and the journal has lectures
for (const lv of ['DPS', 'BSS', 'BVS']) t.ok((await call('batches.create', { batchId: lv + '9', name: lv + ' Group 9', level: lv }, M)).ok !== false, `added a ${lv} batch`);
for (const lv of ['SPS', 'DPS', 'BSS', 'BVS']) {
  const made = rows(`SELECT score_card AS c, hearing_journal AS j FROM batches WHERE batch_id = '${lv === 'SPS' ? 'SPS3' : lv + '9'}'`)[0];
  t.eq(made, rows(`SELECT score_card AS c, hearing_journal AS j FROM batches WHERE batch_id = '${lv}'`)[0], `a new ${lv} batch matches the running ${lv} batch`);
  t.ok(rows(`SELECT COUNT(*) AS n FROM lectures WHERE "journal" = '${made.j}'`)[0].n > 0, `its journal (${made.j}) has lectures`);
}
t.ok((await call('meta.get', {})).data.batches.some(b => b.batchId === 'SPS3'), 'offered at sign-up at once');

{ // ---- announcements to youth facilitators and to TRD facilitators (the head, 9 Oct 2026): together, every facilitator
  DB.sql.exec("UPDATE accounts SET facilitator_name = '" + OTHER.replace(/'/g, "''") + "' WHERE login = '6000000193'");   // a devotee who is a facilitator (youth)
  const X2 = (await call('auth.login', { login: '6000000193', password: 'Devotee pass 2026' })).data.token;
  // a facilitator login with no batch (TRD), for a third name on the list
  const THIRD = (await call('meta.get', {})).data.facilitators.find(n => n !== FAC && n !== OTHER);
  t.code(await call('facLogins.create', { username: 'trdfac', facilitator: THIRD, tempPassword: 'Temp-trd-2026' }, M), 'ok', 'a TRD facilitator login');
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'trdfac'");
  const F2 = (await call('auth.login', { login: 'trdfac', password: 'Temp-trd-2026' })).data.token;
  DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = '6000000091'");
  const A2 = (await call('auth.login', { login: '6000000091', password: 'Member-temp-2026' })).data.token;   // its password was reset above
  const post = (title, audience, tok = M) => call('announcements.create', { title, body: 'For facilitators.', audience }, tok);
  t.code(await post('Coordinator to TRD', ['FAC_TRD'], C), 'FORBIDDEN', 'only the IYF head posts to facilitators');
  t.code(await post('Meeting for TRD facilitators', ['FAC_TRD']), 'ok', 'the head posts to TRD facilitators');
  t.code(await post('Meeting for youth facilitators', ['FAC_YOUTH']), 'ok', 'and to youth facilitators');
  t.code(await post('Both kinds', ['FAC_YOUTH', 'FAC_TRD']), 'ok', 'or to both (every facilitator)');
  const seen = async (tok) => { const x = await call('announcements.list', {}, tok); return x.data.announcements.map(a => a.title).filter(x => /facilitators|Both kinds/.test(x)).sort(); };
  t.eq(await seen(F2), ['Both kinds', 'Meeting for TRD facilitators'], 'a TRD facilitator sees the TRD post and the one to both');
  t.eq(await seen(X2), ['Both kinds', 'Meeting for youth facilitators'], 'a youth facilitator sees the youth post and the one to both');
  t.eq(await seen(A2), [], 'a devotee who is not a facilitator sees neither');
  // the phones: only those facilitators' phones get the push
  const k = await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await wc.subtle.exportKey('jwk', k.privateKey);
  env.VAPID_PRIVATE_JWK = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d });
  env.VAPID_PUBLIC = Buffer.from(await wc.subtle.exportKey('raw', k.publicKey)).toString('base64url'); env.VAPID_SUBJECT = 'mailto:test@example.org';
  DB.sql.exec('DELETE FROM push_subs');
  for (const [n, l] of [['trd', 'trdfac'], ['youth', '6000000193'], ['plain', '6000000091'], ['nobody', '']]) DB.sql.exec(`INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at) VALUES ('https://fcm.googleapis.com/fcm/send/fac-${n}', '${l}', 'x', 'y', '')`);
  DB.sql.exec("UPDATE push_jobs SET state = 'DONE'");
  const sent = [], f0 = globalThis.fetch;
  globalThis.fetch = async (url, opt) => { if (String(url).includes('/fac-')) { sent.push(String(url).split('/fac-')[1]); return { ok: true, status: 201, json: async () => ({}) }; } return f0(url, opt); };
  const pushTo = async (audience) => { sent.length = 0; await post('Push ' + audience.join('+'), audience); DB.sql.exec("UPDATE push_jobs SET state = 'DONE' WHERE id < (SELECT MAX(id) FROM push_jobs)");
    await runAnnouncementPushes(env, DB, new Date(clock.now)); return [...sent].sort(); };
  t.eq(await pushTo(['FAC_TRD']), ['trd'], 'a post to TRD facilitators reaches only their phones');
  t.eq(await pushTo(['FAC_YOUTH']), ['youth'], 'a post to youth facilitators reaches only theirs');
  t.eq(await pushTo(['FAC_YOUTH', 'FAC_TRD', 'BSS']), ['trd', 'youth'], 'facilitators and a batch together (no BSS phone here)');
  globalThis.fetch = f0;
}
t.done();
