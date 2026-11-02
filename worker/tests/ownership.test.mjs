// The other half of the role question: the gate says who may ASK, this says whose records they may touch.
//
// Phase 6.2 / audit F-04 and the AUTHORIZATION note: "STAFF is not a permission — it is permission to ask." A
// coordinator passing the STAFF gate has proved only that they coordinate SOME batch; every one of those handlers
// must then narrow to the batches they actually coordinate. The audit read all of them and found one real defect
// (devotees.delete, fixed in phase 1), but nothing in the suite would have caught a NEW handler that forgot.
//
// So: one coordinator of SPS, one of DPS, and a devotee in each. Every action that names a person or a batch is
// called by the WRONG coordinator and must be refused, and by the right one and must not be refused by scope.
// A new STAFF action appears in the UNCHECKED list at the bottom until someone decides what its narrowing is.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { ROUTES } from '../src/api.js';

const t = suite('ownership: a coordinator may act only inside their own batches');
const { call, addAccount, DB, rows } = boot();

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;

const coordinator = async (username, batchIds) => {
  await call('coordinators.create', { username, name: username.toUpperCase() + ' Coordinator', batchIds, tempPassword: `Temp-${username}-2026` }, M);
  DB.sql.exec(`UPDATE accounts SET must_change_pw = 0 WHERE login = '${username}'`);
  return (await call('auth.login', { login: username, password: `Temp-${username}-2026` })).data.token;
};
const SPS = await coordinator('sps', ['SPS']);
const DPS = await coordinator('dps', ['DPS']);

const profile = { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000199' },
  address: { line: 'House 12, Gali No 3, Punjabi Bagh', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const join = async (phone, name, batchId, approver) => {
  await call('auth.signUp', { phone, name, batchId, facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile });
  const r = await call('requests.approve', { phone, link: { noIdYet: true } }, approver);
  if (!r.ok) throw new Error(`approve ${phone}: ${JSON.stringify(r.error)}`);
  return phone;
};
const MINE = await join('6000000131', 'Devotee Sps', 'SPS', SPS);       // the SPS coordinator's own devotee
const THEIRS = await join('6000000132', 'Devotee Dps', 'DPS', DPS);     // in the OTHER coordinator's batch

const WEEK = '2026-09-28';
/** Every STAFF/ANY action that names a person or a batch, with arguments for the two cases. */
const CASES = [
  // action,                    args for a devotee / batch,              what it is
  ['devotees.get', (p) => ({ login: p }), 'open a devotee'],
  ['devotees.week', (p) => ({ login: p, weekId: WEEK }), 'read their week'],
  ['devotees.setActive', (p) => ({ login: p, active: false }), 'set them inactive'],
  ['devotees.setDisabled', (p) => ({ login: p, disabled: true }), 'disable them'],
  ['devotees.setPeople', (p) => ({ login: p, classDay: 'SAT' }), 'change their class day'],
  // promotion moves somebody between batches, so another batch's coordinator must not reach it
  ['devotees.promoteOptions', (p) => ({ login: p }), 'see where they may be promoted'],
  ['devotees.promote', (p) => ({ login: p, toBatch: 'DPS' }), 'promote them'],
  ['devotees.delete', (p) => ({ login: p, confirmPhone: p }), 'delete them'],
  ['photo.get', (p) => ({ login: p }), 'see their photo'],
  ['photo.remove', (p) => ({ login: p, reason: 'the ownership test' }), 'remove their photo'],
  ['reopen.request', (p) => ({ login: p, weekId: WEEK, reason: 'the ownership test' }), 'ask to reopen their week'],
  ['week.get', (p) => ({ weekId: WEEK, onBehalfOf: p }), 'read their week on their behalf'],
  ['week.saveDay', (p) => ({ weekId: WEEK, date: WEEK, version: 0, day: {}, onBehalfOf: p }), 'fill their day'],
  ['week.submit', (p) => ({ weekId: WEEK, onBehalfOf: p }), 'submit their week'],
  ['rules.get', (p) => ({ onBehalfOf: p }), 'read their card'],
  ['journals.get', (p) => ({ onBehalfOf: p }), 'read their journal'],
  ['leaders.set', (p) => ({ login: p, leader: true, reason: 'the ownership test' }), 'make them a group leader'],
];
const BATCH_CASES = [
  ['devotees.list', (b) => ({ batchId: b }), 'list a batch'],
  ['stats.batch', (b) => ({ batchId: b, weeks: 4 }), "see a batch's filling chart"],
  ['requests.list', (b) => ({ batchId: b }), "see a batch's sign-ups"],
  ['attendance.set', (b) => ({ batchId: b, weekId: WEEK, marks: [] }), "mark a batch's attendance"],
  ['weeks.setClass', (b) => ({ batchId: b, weekId: WEEK, kind: 'HELD', reason: 'the ownership test' }), "declare a batch's class"],
  ['leaders.list', (b) => ({ batchId: b }), "see a batch's group leaders"],
  // a training batch's board belongs to its own coordinator; another batch's must not reach it
  ['board.get', (b) => ({ batchId: b }), "see a batch's board"],
  // the sadhana leaderboard ranks a batch's devotees by name and score: their own coordinator's, nobody else's
  ['leaderboard.get', (b) => ({ batchId: b }), "rank a batch's devotees"],
  // who became inactive or came back, by batch (ADR 0020): their own coordinator's, nobody else's
  ['activity.stats', (b) => ({ batchId: b }), "see a batch's active and inactive"],
  ['training.attendance', (b) => ({ batchId: b, weekId: '2026-10-12', marks: [{ login: 'x', mark: 'P' }] }),
    "mark a training's class attendance"],
  // eligibility is who may be promoted out of a batch: another batch's coordinator must not see it
  // a training's students belong to its own coordinator; another batch's must not reach them
  ['enrol.list', (b) => ({ batchId: b }), "see a training's students"],
  ['enrol.search', (b) => ({ batchId: b, q: 'ar' }), "search for somebody to enrol"],
  ['enrol.add', (b) => ({ batchId: b, login: '6000000131' }), 'enrol somebody'],
  ['enrol.remove', (b) => ({ batchId: b, login: '6000000131' }), 'remove somebody'],
  ['eligible.list', (b) => ({ batchId: b }), "see who is eligible in a batch"],
  // closing a Vedic intake moves devotees between batches, so another batch's coordinator must not
  // reach it. SPS is not a Vedic batch, so its own coordinator gets CONFLICT ("runs with no fixed
  // duration") rather than FORBIDDEN — which is the right refusal, and still proves the scope held.
  ['batches.closingPreview', (b) => ({ batchId: b }), "open a batch's closing"],
  ['batches.close', (b) => ({ batchId: b, decisions: [] }), "close a batch's intake"],
  // real grain and field ids (exports.catalog): a wrong one is refused as VALIDATION before the scope is checked,
  // which would make this case prove nothing
  ['exports.page', (b) => ({ grain: 'weeks', fields: ['name'], batchIds: [b], from: '2026-09-01', to: '2026-09-30' }), "export a batch's weeks"],
];

const REFUSED = ['FORBIDDEN', 'NOT_FOUND'];        // either is a correct refusal; see AUTHORIZATION.md on which
let leaks = [];

for (const [action, args, what] of CASES) {
  // the WRONG coordinator must be refused
  const no = await call(action, args(THEIRS), SPS);
  const code = no.ok ? 'ok' : no.error.code;
  if (!REFUSED.includes(code)) leaks.push(`${action}: SPS's coordinator could ${what} of a DPS devotee → ${code}`);
  else t.ok(true, `${action}: a coordinator cannot ${what} outside their batches (${code})`);
}
for (const [action, args, what] of BATCH_CASES) {
  const no = await call(action, args('DPS'), SPS);
  const code = no.ok ? 'ok' : no.error.code;
  if (!REFUSED.includes(code)) leaks.push(`${action}: SPS's coordinator could ${what} for DPS → ${code}`);
  else t.ok(true, `${action}: a coordinator cannot ${what} they do not coordinate (${code})`);
}
t.eq(leaks, [], `no action lets a coordinator reach another batch${leaks.length ? `:\n      ${leaks.join('\n      ')}` : ''}`);

// …and the same calls are NOT refused by scope for their own batch (a VALIDATION or CONFLICT is fine: the gate and
// the narrowing both let them through, which is what is under test)
let wrongly = [];
for (const [action, args, what] of CASES) {
  const yes = await call(action, args(MINE), SPS);
  const code = yes.ok ? 'ok' : yes.error.code;
  if (code === 'FORBIDDEN') wrongly.push(`${action}: SPS's coordinator could not ${what} of their OWN devotee → FORBIDDEN`);
}
for (const [action, args] of BATCH_CASES) {
  const yes = await call(action, args('SPS'), SPS);
  if (!yes.ok && yes.error.code === 'FORBIDDEN') wrongly.push(`${action}: refused for the coordinator's OWN batch`);
}
t.eq(wrongly, [], `a coordinator can still act inside their own batches${wrongly.length ? `:\n      ${wrongly.join('\n      ')}` : ''}`);

// Admin › Reports (Phase 23 P14): a MASTER action the head may give (`reports`); given, report.js forces the scope to the
// coordinator's own batches — asking for another batch is refused, "all" means theirs
t.code(await call('access.set', { login: 'sps', capability: 'reports', effect: 'allow', reason: 'the ownership test' }, M), 'ok', 'the head gives SPS Reports');
const SPSr = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;
const rep = (scope) => call('report.get', { from: '2026-09-28', to: '2026-10-04', scope }, SPSr);
t.code(await rep({ kind: 'batch', id: 'DPS' }), 'FORBIDDEN', "report.get: SPS's coordinator cannot report on DPS");
t.code(await rep({ kind: 'batch', id: 'SPS' }), 'ok', '… on their own batch, yes');
t.eq((await rep({ kind: 'all' })).data?.scope?.batchIds, ['SPS'], '… and all of IYF becomes their own batch');
t.ok(!JSON.stringify((await rep({ kind: 'all' })).data).includes(THEIRS), "… with nothing of DPS's devotee in it");

// the head is not narrowed: every batch is theirs
t.code(await call('devotees.get', { login: THEIRS }, M), 'ok', 'the head may open a devotee of any batch');
t.code(await call('devotees.list', { batchId: 'DPS' }, M), 'ok', '… and list any batch');

/* ──────── which STAFF actions are NOT covered above, so a new one cannot slip in unnoticed ──────── */

const STAFF_ACTIONS = Object.keys(ROUTES).filter((a) => ROUTES[a].roles === 'STAFF').sort();
const covered = new Set([...CASES, ...BATCH_CASES].map(([a]) => a));
// these take no person and no batch, so there is nothing to narrow: they answer for the caller's own scope
const NOTHING_TO_NARROW = ['birthdays.today', 'members.list', 'activity.notices', 'registry.search', 'reopen.list', 'exports.catalog',
  'requests.approve', 'requests.reject', 'resets.approve', 'resets.reject', 'leaders.assign',
  // asking to start a batch (Phase 23) names no batch and no person: a request is the requester's own — another
  // coordinator neither lists nor withdraws it (checked below, and in batchreq.test.mjs)
  'batchReq.create', 'batchReq.list', 'batchReq.withdraw',
  // board.list and card.of became ANY on 22 Oct 2026 (ADR 0016) and are narrowed in their handlers;
  // card-scoring.test.mjs and phases.test.mjs check who reads which.
  ];
const unchecked = STAFF_ACTIONS.filter((a) => !covered.has(a) && !NOTHING_TO_NARROW.includes(a));
t.eq(unchecked, [], `every STAFF action is either checked above or listed as having nothing to narrow${unchecked.length ? ` — decide for: ${unchecked.join(', ')}` : ''}`);
t.ok(STAFF_ACTIONS.length >= 25, `${STAFF_ACTIONS.length} STAFF actions in the table`);

// the four in NOTHING_TO_NARROW that DO take a person are narrowed by the request's own batch: spot-check two
t.code(await call('requests.approve', { phone: '6000000133', link: { noIdYet: true } }, SPS), 'NOT_FOUND', 'a sign-up that does not exist is not approved');
await call('auth.signUp', { phone: '6000000134', name: 'Devotee Other', batchId: 'DPS', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile });
t.code(await call('requests.approve', { phone: '6000000134', link: { noIdYet: true } }, SPS), 'FORBIDDEN', "a coordinator cannot approve another batch's sign-up");
t.code(await call('requests.approve', { phone: '6000000134', link: { noIdYet: true } }, DPS), 'ok', '… and its own coordinator can');

// A password reset is narrowed the same way (the head, 16 Oct 2026): the coordinator of the batch
// that devotee is in, and nobody else's. The temporary password is shown once at approval, so an
// approval by the wrong person is a password handed to someone with no business holding it.
await call('auth.requestReset', { login: '6000000132' });
t.code(await call('resets.approve', { login: '6000000132' }, SPS), 'FORBIDDEN',
  "a coordinator cannot approve another batch's password reset");
t.code(await call('resets.approve', { login: '6000000132' }, DPS), 'ok',
  '… and the coordinator of their own batch can');

// Anyone who is not a devotee — a temple resident, a facilitator, another coordinator — goes to the
// head alone, whichever batch a coordinator holds.
await call('auth.requestReset', { login: 'dps' });
t.code(await call('resets.approve', { login: 'dps' }, SPS), 'FORBIDDEN', 'a coordinator does not reset staff');
t.code(await call('resets.approve', { login: 'dps' }, M), 'ok', 'only the head does');


// two fresh devotees, one in each batch (the sweep above deleted and deactivated its own); the share checks below use them
const IN_SPS = await join('6000000135', 'Devotee Quiet Sps', 'SPS', M), IN_DPS = await join('6000000136', 'Devotee Quiet Dps', 'DPS', M);

// Share sadhana (shares.js, 27 Oct 2026): a share opens ONE person's sadhana to ONE other person. Their own coordinator and
// the head get nothing from it, and nobody removes or leaves a share that is not theirs.
const tokOf = async (p) => (await call('auth.login', { login: p, password: 'Devotee pass 2026' })).data.token;
const OWNER = await tokOf(IN_SPS), VIEWER = await tokOf(IN_DPS), THIRD = await tokOf(await join('6000000137', 'Devotee Third', 'SPS', M));
t.code(await call('share.add', { phone: IN_DPS }, OWNER), 'ok', 'an SPS devotee shares their sadhana with a DPS devotee');
// the viewer reaches it by the share's id (never the owner's phone); a leaked id is worth nothing to anybody else
const SHARE = (await call('share.list', {}, VIEWER)).data.sharedWithMe[0].id;
t.code(await call('share.devotee', { id: SHARE }, VIEWER), 'ok', '… who may read it');
t.code(await call('share.devotee', { id: SHARE }, SPS), 'FORBIDDEN', "the owner's own coordinator gets nothing extra from a share");
t.code(await call('share.week', { id: SHARE, weekId: WEEK }, M), 'FORBIDDEN', '… nor does the head');
t.code(await call('share.devotee', { id: SHARE }, THIRD), 'FORBIDDEN', 'nor another devotee');
t.code(await call('share.remove', { login: IN_DPS }, THIRD), 'NOT_FOUND', "nobody removes somebody else's share");
t.code(await call('share.leave', { id: SHARE }, THIRD), 'NOT_FOUND', '… or leaves one made to somebody else');
t.eq(rows('SELECT owner, viewer FROM sadhana_shares'), [{ owner: IN_SPS, viewer: IN_DPS }], 'the share is untouched');

// Asking to start a batch (Phase 23): the request is the requester's; another coordinator neither sees nor withdraws it
{
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  // a fresh DPS coordinator: the reset above ended the first one's sessions
  const DPS2 = await coordinator('dpsb', ['DPS']);
  const mine = await call('batchReq.create', { level: 'VL2', startsOn: today, note: 'the ownership test' }, SPS);
  t.code(mine, 'ok', "the SPS coordinator asks to start a VL-2 batch");
  t.code(await call('batchReq.list', {}, DPS2), 'ok', 'the DPS coordinator lists their own requests');
  t.eq((await call('batchReq.list', {}, DPS2)).data.requests.map((r) => r.id), [], "the DPS coordinator does not see it");
  t.code(await call('batchReq.withdraw', { id: mine.data.id }, DPS2), 'NOT_FOUND', '… nor withdraw it');
  t.code(await call('batchReq.decide', { id: mine.data.id, decision: 'decline', note: 'no' }, DPS2), 'FORBIDDEN', '… nor decide it');
  t.eq(rows(`SELECT state FROM batch_requests WHERE id = ${mine.data.id}`)[0].state, 'WAITING', 'it is untouched');
}

t.done();
