// THE role test: every action in the route table, against every scope, generated from the table itself.
//
// Phase 6 / audit F-04. This is the gap the audit called the highest-value untested invariant in the repo: the
// route table has 125 actions, a FORBIDDEN assertion existed for only 49 of the 113 non-public ones, and a new
// action could be added with no role test at all. Six actions had never been called by any test.
//
// Because this suite READS `ROUTES` rather than listing actions, a new action is covered the moment it is added —
// and if its gate is wrong, this fails rather than some screen failing in Delhi. It checks the GATE
// (`allowed()` in api.js): who may ask at all. Ownership and batch narrowing inside each handler is the separate
// matrix in tests/ownership.test.mjs.
//
// What counts as a pass, per cell:
//   · a scope the gate EXCLUDES must get FORBIDDEN (or UNAUTHENTICATED for a caller with no session)
//   · a scope the gate ALLOWS must get anything EXCEPT FORBIDDEN — VALIDATION, NOT_FOUND, CONFLICT and ok all
//     mean the gate let it through, which is what is under test here
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { ROUTES } from '../src/api.js';

/**
 * THE GATE OF RECORD: which scope may ask for each action, written down HERE and nowhere else.
 *
 * This list is deliberately NOT derived from the route table. An earlier version of this suite computed the
 * expectation from `ROUTES[action].roles` — the very thing under test — so weakening `settings.update` from MASTER
 * to STAFF moved the expectation with it and 726 green cells proved nothing. Verified: that sabotage passed.
 *
 * So: changing a gate in api.js now FAILS here until the change is made deliberately in this list too, which is
 * the point — a permission change should be a visible, reviewed edit, not a one-word slip inside a long table.
 * A new action fails here until it is added, which closes the audit's other complaint (F-04: a new action needed
 * no role test at all).
 *
 * Generated from the table on 13 October 2026, after the audit had read every handler, and reviewed line by line.
 */
const GATE_OF_RECORD = {
  'account.delete':             'ANY',
  // Phase 23 (ADR 0020): who became inactive or came back, and the analysis — narrowed to the caller's class batches
  'activity.notices':           'STAFF',
  'activity.stats':             'STAFF',
  'admin.lists':                'MASTER',
  'announcements.comment':      'ANY',
  'announcements.comments':     'ANY',
  'announcements.create':       'ANY',
  'announcements.get':          'ANY',
  'announcements.image':        'ANY',
  'announcements.like':         'ANY',
  'announcements.list':         'ANY',
  'announcements.remove':       'ANY',
  'announcements.report':       'ANY',
  'announcements.reports':      'MASTER',
  'announcements.resolve':      'MASTER',
  'announcements.uncomment':    'ANY',
  'announcements.update':       'ANY',
  'attendance.override':        'MASTER',
  'attendance.set':             'STAFF',
  'access.search':              'MASTER',
  'access.get':                 'MASTER',
  'access.list':                'MASTER',
  'access.set':                 'MASTER',
  'access.assign':              'MASTER',
  'access.revoke':              'MASTER',
  'audit.list':                 'MASTER',
  'auth.changePassword':        'ANY',
  'auth.login':                 'PUBLIC',
  'auth.logout':                'ANY',
  'auth.logoutAll':             'ANY',
  'auth.sessions':              'ANY',
  'auth.sessionEnd':            'ANY',
  'auth.lookup':                'PUBLIC',
  'auth.me':                    'ANY',
  'auth.requestReset':          'PUBLIC',
  'auth.signUp':                'PUBLIC',
  'batches.create':             'MASTER',
  // Phase 23: a coordinator asks to start a batch and sees / withdraws their own (narrowed in batchreq.js to the
  // requester); only the head declines — and approves, by batches.create (MASTER) with fromRequest
  'batchReq.create':            'STAFF',
  'batchReq.list':              'STAFF',
  'batchReq.withdraw':          'STAFF',
  'batchReq.decide':            'MASTER',
  'batches.list':               'MASTER',
  'batches.update':             'MASTER',
  'birthdays.today':            'STAFF',
  'books.chapters':             'ANY',          // a canto's chapter PDFs: the same public book links everyone sees
  'books.setCurrent':           'ANY',
  'coordinators.create':        'MASTER',
  'coordinators.list':          'MASTER',
  'coordinators.resetPassword': 'MASTER',
  'coordinators.setDisabled':   'MASTER',
  'coordinators.update':        'MASTER',
  'devotees.delete':            'STAFF',
  'devotees.get':               'STAFF',
  'devotees.list':              'STAFF',
  'devotees.setActive':         'STAFF',
  // closing a Vedic intake moves devotees between batches, so it is the coordinator of that batch
  // (requireBatch) or the head — never another batch's coordinator (ADR 0009)
  'batches.closingPreview':     'STAFF',
  'batches.close':              'STAFF',
  // promoting one devotee: their own coordinator (managed()), or the head. The ladder is enforced
  // for a coordinator and the head may step off it, with the move recorded as off-ladder.
  'devotees.promoteOptions':    'STAFF',
  'devotees.promote':           'STAFF',
  // phases and the target card (17 Oct 2026). card.get/card.fill are ANY because they act on the
  // CALLER's own card and never take a login — a facilitator fills their own report, nobody else's.
  'phases.list':                'ANY',
  'phases.open':                'MASTER',
  'phases.update':              'MASTER',
  'phases.close':               'MASTER',
  'card.get':                   'ANY',
  'card.fill':                  'ANY',
  'targets.set':                'ANY',
  'stages.set':                 'ANY',
  'card.unlock':                'MASTER',
  'targets.unlock':             'FTP',
  // the boards and the card behind a row (ADR 0016, 22 Oct 2026): ANY, because a facilitator or a trainee sees
  // their OWN place and their own card, read-only. The handler narrows: whole boards to the head and a training's
  // coordinator, one row to the person on it, nothing to anyone else (card-scoring.test.mjs proves each).
  'board.get':                  'ANY',
  'board.list':                 'ANY',
  'card.of':                    'ANY',
  'card.months':                'ANY',
  // the sadhana leaderboard (ADR 0013): staff narrowed to their batches in the handler; a devotee's own place only
  'leaderboard.get':            'STAFF',
  'leaderboard.mine':           'ANY',
  'training.attendance':        'STAFF',
  // enrolling existing devotees in a training: the training's own coordinator, or the head
  'enrol.search':               'STAFF',
  'enrol.list':                 'STAFF',
  'enrol.add':                  'STAFF',
  'enrol.remove':               'STAFF',
  'eligible.list':              'STAFF',
  'criteria.get':               'MASTER',
  'criteria.set':               'MASTER',
  'devotees.setDisabled':       'STAFF',
  'devotees.setPeople':         'STAFF',
  'devotees.week':              'STAFF',
  'exports.catalog':            'STAFF',
  'exports.page':               'STAFF',
  'fac.devotee':                'FAC',
  'fac.devotees':               'FAC',
  'fac.week':                   'FAC',
  'fac.eligible':               'FAC',
  'facLogins.create':           'MASTER',
  'facLogins.link':             'MASTER',
  'facLogins.list':             'MASTER',
  'facLogins.resetPassword':    'MASTER',
  'facLogins.setDisabled':      'MASTER',
  'facLogins.unlink':           'MASTER',
  'facilitators.add':           'FTP',
  'facilitators.rename':        'FTP',
  'facilitators.orphans':       'MASTER',
  'facilitators.setLasting':    'FTP',
  'facilitators.delete':        'MASTER',
  'facilitators.list':          'FTP',
  'facilitators.setActive':     'FTP',
  'group.list':                 'LEADER',
  'group.mark':                 'LEADER',
  'heads.decide':               'MASTER',
  'heads.requests':             'MASTER',
  'heads.withdraw':             'MASTER',
  'history.list':               'ANY',
  'home.get':                   'DEVOTEE',
  'identity.get':               'MASTER',
  'identity.link':              'MASTER',
  'identity.merge':             'MASTER',
  'identity.mint':              'MASTER',
  'identity.mintBatch':         'MASTER',
  'identity.search':            'MASTER',
  'identity.serviceToken':      'MASTER',
  'identity.supersede':         'MASTER',
  'ids.appList':                'MASTER',
  'ids.create':                 'MASTER',
  'ids.get':                    'MASTER',
  'ids.link':                   'MASTER',
  'ids.nextApp':                'MASTER',
  'ids.possibleDuplicates':     'MASTER',
  'ids.reviewDuplicate':        'MASTER',
  'ids.search':                 'MASTER',
  'ids.unlink':                 'MASTER',
  'journals.get':               'ANY',
  'leaders.assign':             'STAFF',
  'leaders.list':               'STAFF',
  'leaders.set':                'STAFF',
  'masters.set':                'MASTER',
  'members.list':               'STAFF',
  'meta.get':                   'PUBLIC',
  'mutes.list':                 'ANY',
  'mutes.set':                  'ANY',
  'mutes.setAll':               'MASTER',
  'photo.get':                  'ANY',
  'photo.remove':               'ANY',
  'photo.upload':               'ANY',
  'profile.get':                'ANY',
  'profile.update':             'ANY',
  'push.detach':                'ANY',
  'push.message':               'PUBLIC',
  'push.register':              'PUBLIC',
  'push.renew':                 'PUBLIC',
  'push.subscribe':             'ANY',
  'push.unsubscribe':           'PUBLIC',
  'vitals.report':              'ANY',
  'registry.search':            'STAFF',
  'reopen.list':                'STAFF',
  'reopen.reject':              'MASTER',
  'reopen.request':             'STAFF',
  'requests.approve':           'STAFF',
  'requests.list':              'STAFF',
  'requests.reject':            'STAFF',
  'resets.approve':             'STAFF',
  'resets.reject':              'STAFF',
  'rules.get':                  'ANY',
  'runlog.list':                'MASTER',
  'home.staff':                 'MASTER',
  'settings.get':               'MASTER',
  'settings.update':            'MASTER',
  // Share sadhana (27 Oct 2026): the owner's own list and shares need their own form; the viewer's reads and leaving are
  // anyone signed in, narrowed to an existing share row inside (FORBIDDEN without one; staff get nothing extra)
  'share.list':                 'DEVOTEE',
  'share.lookup':               'DEVOTEE',
  'share.add':                  'DEVOTEE',
  'share.remove':               'DEVOTEE',
  'share.leave':                'ANY',
  'share.devotee':              'ANY',
  'share.week':                 'ANY',
  'analysis.get':               'MASTER',
  // Admin › Reports (Phase 23 P14): the head; the `reports` right gives it beyond the role, scope forced in report.js
  'report.get':                 'MASTER',
  'report.options':             'MASTER',
  'stats.all':                  'MASTER',
  'stats.batch':                'STAFF',
  'week.get':                   'ANY',
  'week.saveDay':               'ANY',
  'week.saveWeekEnd':           'ANY',
  'week.setAttendance':         'DEVOTEE',
  'week.submit':                'ANY',
  'weeks.reopen':               'MASTER',
  'weeks.setClass':             'STAFF',
};

const t = suite('roles: every action × every scope, from the route table');
const { call, addAccount, DB, rows } = boot();

/* ──────────────────────────── one account per scope ──────────────────────────── */

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;

// a coordinator of SPS only (so a cross-batch case is possible for the ownership suite)
await call('coordinators.create', { username: 'sps', name: 'Sps Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'");
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;

const profile = { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000199' },
  address: { line: 'House 12, Gali No 3, Punjabi Bagh', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const join = async (phone, name) => {
  await call('auth.signUp', { phone, name, batchId: 'SPS', facilitator: FAC, ...CONTACT, password: 'Devotee pass 2026', profile });
  await call('requests.approve', { phone, link: { noIdYet: true } }, C);
  return (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
};

const D = await join('6000000121', 'Devotee Plain');          // a devotee, nothing else
// Every action that takes a `login`/`phone` is pointed at THIS devotee, never at one of the scopes above:
// devotees.delete, devotees.setDisabled and friends would otherwise destroy the caller the sweep is using.
const TARGET = '6000000129';
await join(TARGET, 'Devotee Target');
const L = await join('6000000122', 'Devotee Leader');         // …made a group leader below
t.code(await call('leaders.set', { login: '6000000122', leader: true, reason: 'the role test needs a group leader' }, C), 'ok', 'a group leader exists');
const LEADER_T = (await call('auth.login', { login: '6000000122', password: 'Devotee pass 2026' })).data.token;

// a facilitator login: an account carrying facilitator_name
await call('facLogins.create', { username: 'natvar', facilitator: FAC, tempPassword: 'Temp-fac-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'natvar'");
const F = (await call('auth.login', { login: 'natvar', password: 'Temp-fac-2026' })).data.token;

// the dashboard's service account: MASTER by role, but only_actions = identity.mintBatch
const svc = await call('identity.serviceToken', { login: 'dashboard-cron', note: 'role test', reason: 'the role test needs a service account' }, M);
const SVC = svc.ok ? svc.data.token : null;

// The matrix calls EVERY action, including auth.logout, auth.logoutAll and auth.changePassword — so a scope's
// session dies part-way through its own row, and every later cell would read UNAUTHENTICATED and look like a
// gate failure. Each scope therefore carries how to sign in again, and a fresh token is taken per cell. (The
// password moves when changePassword runs, so `pw` is updated when that happens.)
const SCOPES = [
  { key: 'signed out', login: null, has: { devotee: false, groupLeader: false, facilitator: false, coordinator: false, master: false } },
  { key: 'devotee', login: '6000000121', pw: 'Devotee pass 2026', has: { devotee: true, groupLeader: false, facilitator: false, coordinator: false, master: false } },
  { key: 'group leader', login: '6000000122', pw: 'Devotee pass 2026', has: { devotee: true, groupLeader: true, facilitator: false, coordinator: false, master: false } },
  { key: 'facilitator', login: 'natvar', pw: 'Temp-fac-2026', has: { devotee: false, groupLeader: false, facilitator: true, coordinator: false, master: false } },
  { key: 'coordinator', login: 'sps', pw: 'Temp-sps-2026', has: { devotee: false, groupLeader: false, facilitator: false, coordinator: true, master: false } },
  { key: 'the head', login: 'master', pw: 'Master pass 2026', has: { devotee: false, groupLeader: false, facilitator: false, coordinator: true, master: true } },
];

/**
 * A live token for a scope. Signing in on every cell would trip the five-wrong-tries lockout and cost 750 hashes,
 * so the token is kept and renewed only when a cell has actually ended the session (auth.logout, auth.logoutAll,
 * auth.changePassword — all of which this matrix calls). The lockout counter is cleared before each sign-in,
 * because a sign-in with a password an earlier cell moved counts as a wrong try.
 */
const tokenFor = async (sc) => {
  if (!sc.login) return undefined;
  if (sc.token && (await call('auth.me', {}, sc.token)).ok) return sc.token;
  DB.sql.prepare("UPDATE accounts SET failed_tries = 0, locked_until = '' WHERE login = ?").run(sc.login);
  for (const pw of [sc.pw, SAMPLE.new]) {
    const r = await call('auth.login', { login: sc.login, password: pw });
    if (r.ok) { sc.pw = pw; sc.token = r.data.token; return r.data.token; }
    DB.sql.prepare("UPDATE accounts SET failed_tries = 0, locked_until = '' WHERE login = ?").run(sc.login);
  }
  const a = rows('SELECT status, failed_tries, locked_until FROM accounts WHERE login = ?', sc.login)[0];
  throw new Error(`cannot sign ${sc.key} (${sc.login}) in again: account is ${a ? JSON.stringify(a) : 'GONE'}`);
};

/** Does the gate let this scope ask? Mirrors allowed() in api.js, over the INTENDED role from the list above. */
const gateAllows = (roles, has) => roles === 'ANY' || roles === 'PUBLIC'
  || (roles === 'DEVOTEE' && has.devotee) || (roles === 'LEADER' && has.groupLeader)
  || (roles === 'FAC' && has.facilitator) || (roles === 'STAFF' && (has.master || has.coordinator))
  || (roles === 'MASTER' && has.master)
  // FTP (ADR 0019): the head, or an FTP coordinator given the role in Access (access-roles.test.mjs proves that half)
  || (roles === 'FTP' && (has.master || has.ftp));

/* ──────────────── a plausible argument for every field, so VALIDATION is not mistaken for FORBIDDEN ──────────── */

const WEEK = '2026-09-28';
const SAMPLE = {
  phone: TARGET, login: TARGET, confirmPhone: TARGET, weekId: WEEK, date: '2026-09-28',
  batchId: 'SPS', batchIds: ['SPS'], username: 'someone', name: 'Some Name', facilitator: FAC, classDay: 'SUN',
  password: 'Devotee pass 2026', current: 'Devotee pass 2026', new: 'Another pass 2026', newPassword: 'Another pass 2026',
  reason: 'the generated role test', title: 'A title', body: 'A body', audience: 'ALL', id: 1, commentId: 1, postId: 1,
  mark: 'P', marks: [], version: 0, day: {}, limit: 5, weeks: 4, q: 'x', iyfId: 'KT26-0001', personId: 'P-1',
  year: '2026', rows: [], requestedBy: 'role test', endpoint: 'https://fcm.googleapis.com/fcm/send/role-test',
  oldEndpoint: 'https://fcm.googleapis.com/fcm/send/role-test', keys: { p256dh: 'k', auth: 'a' },
  jpegBase64: '', image: null, grain: 'week', fields: [], from: '2026-09-01', to: '2026-09-30', filters: {},
  tempPassword: 'Temp-pass-2026', disabled: false, active: true, master: false, leader: true, logins: [],
  pinned: false, like: true, mute: true, key: 'k', note: 'role test', approve: true, decision: 'SAME', why: 'x',
  ids: ['KT26-0001', 'KT26-0002'], showReviewed: false, level: 'SPS', pilot: false, coordinatorLogins: ['sps'],
  kind: 'HELD', everyonePresent: false, fromWeek: WEEK, openUntil: '2026-10-20T21:00:00+05:30', onBehalfOf: undefined,
  bookId: 'B1', have: '', consentPhoto: false, parentConsent: undefined, privacyConsent: true, email: 'x@gmail.com',
  whatsapp: '6000000121', groupLeader: undefined, profile: undefined, device: 'test', submitWindow: undefined,
  trackingFrom: undefined, reminderTime: undefined, logRetentionMonths: undefined, dob: '2000-01-01',
  bloodGroup: 'O+', emergency: undefined, address: undefined, readingPagesPerHour: undefined, profession: undefined,
  skills: undefined, nightStay: 'NO', principles: 'YES', expiresAt: null, publishAt: undefined, before: undefined,
  cursor: undefined, status: undefined, sort: undefined, offset: 0, who: undefined, what: undefined, target: undefined,
  levelEntryDate: '2026-09-01', link: { noIdYet: true }, keep: 'P-1', lose: 'P-2', compare: true, scope: { kind: 'all' }, sections: ['reporting'],
};
const argsFor = (route) => Object.fromEntries(route.fields.filter((f) => SAMPLE[f] !== undefined).map((f) => [f, SAMPLE[f]]));

/* ──────────────────────────────── the matrix ──────────────────────────────── */

// Four actions destroy or re-key the caller they are tested with, which would unpick the rest of the sweep:
// account.delete removes the account, and the three below end its sessions or move its password. Their GATES are
// checked on their own further down, with accounts made for the purpose.
const SELF_DESTRUCTIVE = ['account.delete', 'auth.logout', 'auth.logoutAll', 'auth.sessionEnd', 'auth.changePassword'];
// ANY actions whose HANDLER refuses some signed-in people — a narrowing, not a gate failure (see the loop below)
//
// Two groups, with the reason each:
//   · the weekly form (weeks.js, rules.js) — every one of these resolves a devotee's OWN form through target()
//     or behalfBatch(), so a facilitator or a coordinator with no sadhana of their own is refused inside the
//     handler. Since 13 Oct a coordinator may not read someone else's past weeks either (F10).
//   · the wall — posting needs a posting right (canPost), removing needs authorship (editable).
const FORM_ACTIONS = ['rules.get', 'journals.get', 'books.setCurrent', 'home.get', 'week.get', 'week.saveDay',
  'week.saveWeekEnd', 'week.setAttendance', 'week.submit', 'history.list'];
// card.of narrows by the PERSON inside the handler: a coordinator may read the card of somebody
// enrolled in a training they hold and of nobody else, so a probe with an arbitrary login is
// rightly FORBIDDEN. The real rule — their own trainee yes, anyone else no — is checked in
// phases.test.mjs, where two trainings with different coordinators exist to tell apart.
// board.get refuses somebody on no board (a devotee who neither facilitates nor trains), and a board that is not theirs.
// leaderboard.get refuses a coordinator asking for all of IYF (the head's alone); leaderboard.mine somebody with no batch.
const HANDLER_REFUSES = [...FORM_ACTIONS, 'announcements.create', 'announcements.remove', 'card.of', 'board.get', 'leaderboard.get', 'leaderboard.mine',
  // card.months reads the caller's own, or (head, a training's coordinator) somebody else's: an arbitrary login is refused
  'card.months',
  // share.devotee / share.week: only someone the owner shared with — anyone else, staff included, is refused inside
  'share.devotee', 'share.week'];
const names = Object.keys(ROUTES).sort().filter((a) => !SELF_DESTRUCTIVE.includes(a));

// Before any call: does the route table still say what the record says? This is what catches a gate changed in
// api.js, a new action added without a decision, and an action removed.
const added = Object.keys(ROUTES).filter((a) => !GATE_OF_RECORD[a]);
const removed = Object.keys(GATE_OF_RECORD).filter((a) => !ROUTES[a]);
const moved = Object.keys(ROUTES).filter((a) => GATE_OF_RECORD[a] && GATE_OF_RECORD[a] !== ROUTES[a].roles)
  .map((a) => `${a}: ${GATE_OF_RECORD[a]} → ${ROUTES[a].roles}`);
t.eq(added, [], `no action is in the route table without a decision in GATE_OF_RECORD${added.length ? ` (add it there, with the reason): ${added.join(', ')}` : ''}`);
t.eq(removed, [], `no action in GATE_OF_RECORD has disappeared from the table${removed.length ? `: ${removed.join(', ')}` : ''}`);
t.eq(moved, [], `no action's gate has changed without the record changing too${moved.length ? `: ${moved.join('; ')}` : ''}`);
t.ok(names.length > 120, `${names.length} actions in the route table`);

let cells = 0, wrongDeny = [], wrongAllow = [];
for (const action of names) {
  const route = ROUTES[action], data = argsFor(route), intended = GATE_OF_RECORD[action];
  for (const sc of SCOPES) {
    // a PUBLIC action is reachable signed out by design; a non-public one needs a session, and a signed-out
    // caller gets UNAUTHENTICATED from the session check before the gate is even consulted
    if (!sc.login && intended !== 'PUBLIC') {
      const r = await call(action, data, undefined);
      if (r.ok || r.error.code !== 'UNAUTHENTICATED') wrongAllow.push(`${action} / signed out → ${r.ok ? 'ok' : r.error.code} (want UNAUTHENTICATED)`);
      cells++;
      continue;
    }
    const token = await tokenFor(sc);
    const r = await call(action, data, token);
    const code = r.ok ? 'ok' : r.error.code;
    cells++;
    if (gateAllows(intended, sc.has)) {
      // The gate should not be what stops them — but a few ANY actions narrow inside the handler, by design, and
      // that refusal is also FORBIDDEN. HANDLER_REFUSES names them, with the reason each, so the rule stays
      // strict for the other 121: a new FORBIDDEN anywhere else fails this test.
      if (code === 'FORBIDDEN' && !HANDLER_REFUSES.includes(action)) {
        wrongDeny.push(`${action} (${intended}) / ${sc.key} → FORBIDDEN, but ${intended} should allow this scope`);
      }
    } else if (code !== 'FORBIDDEN') {
      wrongAllow.push(`${action} (${intended}) / ${sc.key} → ${code}, but ${intended} should exclude this scope`);
    }
  }
}

console.log(`   ${names.length} actions × ${SCOPES.length} scopes = ${cells} cells; ${wrongAllow.length} let a scope past its gate, ${wrongDeny.length} refused one it allows`);
t.ok(cells > 700, `${cells} cells checked (${names.length} actions × ${SCOPES.length} scopes)`);
t.eq(wrongAllow.slice(0, 6), [], `no action lets a scope past its gate${wrongAllow.length ? ` — ${wrongAllow.length} did:\n      ${wrongAllow.slice(0, 6).join('\n      ')}` : ''}`);
t.eq(wrongDeny.slice(0, 6), [], `no action refuses a scope its gate allows${wrongDeny.length ? ` — ${wrongDeny.length} did:\n      ${wrongDeny.slice(0, 6).join('\n      ')}` : ''}`);

/* ──────────── the four actions left out of the sweep, each with its own account ──────────── */

// Their gates still need checking; what they must not do is break the sweep's other 121 rows.
// account.delete and auth.* are ANY, so the only thing a gate can refuse is a caller with no session.
for (const action of SELF_DESTRUCTIVE) {
  t.code(await call(action, argsFor(ROUTES[action]), undefined), 'UNAUTHENTICATED', `${action} needs a session`);
}
// and each really does what it says, with an account made for it
const victim = await join('6000000123', 'Devotee Doomed');
t.code(await call('auth.logoutAll', {}, victim), 'ok', 'auth.logoutAll works for a devotee');
t.code(await call('auth.me', {}, victim), 'UNAUTHENTICATED', '… and really ends the session');
const v2 = (await call('auth.login', { login: '6000000123', password: 'Devotee pass 2026' })).data.token;
t.code(await call('auth.changePassword', { current: 'Devotee pass 2026', new: 'Changed pass 2026' }, v2), 'ok', 'auth.changePassword works');
t.code(await call('account.delete', { password: 'Changed pass 2026', confirm: 'DELETE' }, v2), 'ok', 'account.delete removes a devotee\'s own account');
t.eq(rows("SELECT COUNT(*) AS n FROM accounts WHERE login = '6000000123'")[0].n, 0, '… and the account is gone');
// a coordinator and the head may NOT delete their own account this way (they hold a role first)
t.code(await call('account.delete', { password: 'Temp-sps-2026', confirm: 'DELETE' }, await tokenFor(SCOPES[4])), 'FORBIDDEN', 'a coordinator cannot delete their own account');
t.code(await call('account.delete', { password: 'Master pass 2026', confirm: 'DELETE' }, await tokenFor(SCOPES[5])), 'FORBIDDEN', '… nor the head');

/* ──────────── the service account: MASTER by role, but one action only (migration 0041) ──────────── */

if (SVC) {
  t.code(await call('identity.mintBatch', { rows: [], requestedBy: 'role test' }, SVC), 'ok', 'the service account may call the one action it was made for');
  for (const action of ['devotees.delete', 'coordinators.resetPassword', 'settings.update', 'auth.logout', 'auth.changePassword', 'identity.serviceToken']) {
    t.code(await call(action, argsFor(ROUTES[action]), SVC), 'FORBIDDEN', `… and not ${action}, whatever its role allows`);
  }
} else {
  t.ok(false, 'the service account could not be created, so its allow-list is untested');
}

/* ──────────── every action is exercised: the count the audit asked for ──────────── */

t.eq(names.filter((a) => !ROUTES[a].fields).length, 0, 'every route declares its accepted fields');
const writesWithoutId = names.filter((a) => ROUTES[a].write && !ROUTES[a].noReplay);
t.ok(writesWithoutId.length > 50, `${writesWithoutId.length} write actions go through the replay cache`);

t.done();
