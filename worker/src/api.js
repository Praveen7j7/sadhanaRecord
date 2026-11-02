// The one endpoint (API contract §0). Every call is a POST of { v, action, token, requestId, app, data } and every
// answer is HTTP 200 with { ok, data | error, serverTime }.
// Order of checks: version → action → fields → session (unless public) → forced password change → role → replay → action.
import { ApiError, apiError, isoIst, csv } from './util.js';
import { q, one, run, requestDb } from './db.js';
import { sessionCtx } from './session.js';
import * as auth from './auth.js';
import * as reqs from './requests.js';
import * as admin from './admin.js';
import * as closing from './closing.js';
import * as phases from './phases.js';
import * as eligible from './eligible.js';
import * as enrol from './enrol.js';
import * as identity from './identity.js';
import * as rules from './rules.js';
import * as weeks from './weeks.js';
import * as ann from './announcements.js';
import * as coord from './coord.js';
import * as push from './push.js';
import * as facs from './facilitators.js';
import * as groups from './groups.js';
import * as fac from './facilitator.js';
import * as exp from './exports.js';
import * as lb from './leaderboard.js';
import * as inactive from './inactive.js';
import * as mc from './monthcard.js';
import * as grants from './grants.js';
import * as vitals from './vitals.js';
import * as staffhome from './staffhome.js';
import * as explorer from './explorer.js';
import * as analysis from './analysis.js';
import * as shares from './shares.js';
import * as batchreq from './batchreq.js';
import * as report from './report.js';

export const API_VERSION = 1;
// Who may call an action, by scope (decision 34): ANY signed-in person · DEVOTEE has their own form ·
// STAFF coordinates a batch or is a master · MASTER
const PUBLIC = 'PUBLIC', ANY = 'ANY', DEVOTEE = 'DEVOTEE', STAFF = 'STAFF', MASTER = 'MASTER', LEADER = 'LEADER', FAC = 'FAC', FTP = 'FTP';
const allowed = (who, s) => who === ANY || (who === DEVOTEE && !!s.devotee) || (who === LEADER && !!s.groupLeader) || (who === FAC && !!s.facilitator) || (who === STAFF && (s.master || s.coordinator.length > 0)) || (who === MASTER && s.master) || (who === FTP && (s.master || !!s.ftp));
const SLOW_MS = 1500;
/* Roadmap 6.6 (audit T F-10): only INTERNAL errors and slow calls reach the Run Log, so a burst of
   FORBIDDEN or UNAUTHENTICATED — a broken client, or somebody probing — left no trace anywhere the head
   can see. These codes are counted per hour instead of logged per call: a flood must not become a flood of
   database writes (the same reason BUSY is not logged at all), and the Free plan's 10 ms of CPU leaves no
   room for a row each time. One UPSERT into a single settings row per sampled refusal, and the counts show
   up on the head's Settings screen.
   SAMPLE: 1 in 10. A real problem produces hundreds an hour, so a tenth of them is still unmistakable,
   while a single stray refusal costs nothing. */
const WATCHED_CODES = new Set(['FORBIDDEN', 'UNAUTHENTICATED', 'STALE']);
const REFUSAL_SAMPLE = 10;

/** The routing table. `fields`: every allowed key of `data`; `write`: needs a requestId. */
export const ROUTES = {
  'meta.get':                   { roles: PUBLIC, fields: [], fn: admin.meta },
  'auth.signUp':                { roles: PUBLIC, write: true, fields: ['phone', 'name', 'batchId', 'password', 'profile', 'consentPhoto', 'facilitator', 'classDay', 'email', 'whatsapp', 'groupLeader', 'parentConsent', 'privacyConsent'], fn: auth.signUp },
  'auth.lookup':                { roles: PUBLIC, fields: ['phone'], fn: auth.lookup },
  'auth.login':                 { roles: PUBLIC, fields: ['login', 'password', 'device'], fn: auth.login },
  /* Decision 46: the requester no longer chooses the password — the server makes it at approval.
     `newPassword` stays in the whitelist and is IGNORED by the handler, on purpose. The field list is a
     hard gate (an unknown field is BAD_REQUEST), so removing it would make every app already installed
     fail at "I forgot my password" the moment this ships, with "Something went wrong" and no way forward.
     Accepting and discarding it means an old app's request is queued normally; its user is then told to
     collect the temporary password from their coordinator, which is the new flow working correctly.
     The handler never reads the value — auth.requestReset does not mention it. */
  // `newPassword` is ACCEPTED AND IGNORED on purpose (decision 46, roadmap 1.1): the server makes the
  // temporary password at approval, and requestReset writes blanks. The field stays in the whitelist
  // because an old app still on a phone sends it, and dropping it would refuse that person's reset
  // request outright — tests/reset-decision46.test.mjs pins exactly this.
  'auth.requestReset':          { roles: PUBLIC, write: true, fields: ['login', 'newPassword'], fn: auth.requestReset },
  'auth.me':                    { roles: ANY, mustChangeOk: true, fields: [], fn: auth.me },
  'auth.logout':                { roles: ANY, mustChangeOk: true, fields: [], fn: auth.logout },
  // sign out every device of this login, including this one (audit F21)
  'auth.logoutAll':             { roles: ANY, mustChangeOk: true, write: true, fields: [], fn: auth.logoutAll },
  // the devices this account is signed in on, and ending one of them from another (18 Oct 2026)
  'auth.sessions':              { roles: ANY, fields: [], fn: auth.sessionsList },
  'auth.sessionEnd':            { roles: ANY, write: true, fields: ['id'], fn: auth.sessionsEnd },
  'auth.changePassword':        { roles: ANY, mustChangeOk: true, write: true, fields: ['current', 'new'], fn: auth.changePassword },
  'rules.get':                  { roles: ANY, fields: ['have', 'onBehalfOf'], fn: rules.rulesGet },
  'journals.get':               { roles: ANY, fields: ['have', 'onBehalfOf'], fn: rules.journalsGet },
  'books.chapters':             { roles: ANY, fields: ['bookId', 'lang'], fn: rules.booksChapters },
  // the book being read, kept on the server (one write; safe to repeat)
  'books.setCurrent':           { roles: ANY, write: true, noReplay: true, fields: ['bookId', 'onBehalfOf'], fn: rules.setCurrentBook },
  'home.get':                   { roles: DEVOTEE, fields: [], fn: weeks.homeGet },
  'week.get':                   { roles: ANY, fields: ['weekId', 'onBehalfOf'], fn: weeks.weekGet },
  'week.saveDay':               { roles: ANY, write: true, noReplay: true, fields: ['weekId', 'date', 'version', 'day', 'onBehalfOf'], fn: weeks.saveDay },
  'week.saveWeekEnd':           { roles: ANY, write: true, noReplay: true, fields: ['weekId', 'version', 'nightStay', 'principles', 'onBehalfOf'], fn: weeks.saveWeekEnd },
  'week.setAttendance':         { roles: DEVOTEE, write: true, noReplay: true, fields: ['weekId', 'mark'], fn: weeks.setAttendance },
  'week.submit':                { roles: ANY, write: true, fields: ['weekId', 'onBehalfOf'], fn: weeks.submit },
  'history.list':               { roles: ANY, fields: ['before', 'limit', 'onBehalfOf'], fn: weeks.historyList },
  'announcements.list':         { roles: ANY, fields: [], fn: ann.list },
  'announcements.create':       { roles: ANY, write: true, fields: ['title', 'body', 'audience', 'pinned', 'expiresAt', 'publishAt', 'image'], fn: ann.create },
  'announcements.update':       { roles: ANY, write: true, fields: ['id', 'title', 'body', 'audience', 'pinned', 'expiresAt', 'publishAt', 'image'], fn: ann.update },
  // one post by id, for a shared link to a post older than the wall's page (audit FE-17)
  'announcements.get':          { roles: ANY, fields: ['id'], fn: ann.get },
  'announcements.image':        { roles: ANY, fields: ['id'], fn: ann.image },
  'announcements.remove':       { roles: ANY, write: true, fields: ['id'], fn: ann.remove },
  'announcements.like':         { roles: ANY, write: true, noReplay: true, fields: ['id', 'like'], fn: ann.like },
  'announcements.comments':     { roles: ANY, fields: ['id'], fn: ann.comments },
  'announcements.comment':      { roles: ANY, write: true, fields: ['id', 'body'], fn: ann.comment },
  'announcements.uncomment':    { roles: ANY, write: true, fields: ['commentId'], fn: ann.uncomment },
  // the wall's moderation (store rules): report a post or comment; hide a person's comments for oneself, or (the IYF
  // head) for everyone; the head's queue of reports
  'announcements.report':       { roles: ANY, write: true, noReplay: true, fields: ['id', 'commentId', 'reason', 'note'], fn: ann.report },
  'announcements.reports':      { roles: MASTER, fields: [], fn: ann.reports },
  'announcements.resolve':      { roles: MASTER, write: true, fields: ['postId', 'commentId', 'action'], fn: ann.resolve },
  'mutes.list':                 { roles: ANY, fields: [], fn: ann.mutesList },
  'mutes.set':                  { roles: ANY, write: true, noReplay: true, fields: ['commentId', 'key', 'mute'], fn: ann.mutesSet },
  'mutes.setAll':               { roles: MASTER, write: true, noReplay: true, fields: ['commentId', 'key', 'mute'], fn: ann.mutesSetAll },
  'requests.list':              { roles: STAFF, fields: ['batchId'], fn: reqs.list },
  'requests.approve':           { roles: STAFF, write: true, fields: ['phone', 'link', 'levelEntryDate', 'facilitator', 'classDay', 'groupLeader'], fn: reqs.approve },
  'requests.reject':            { roles: STAFF, write: true, fields: ['phone', 'reason'], fn: reqs.reject },
  'resets.approve':             { roles: STAFF, write: true, fields: ['login'], fn: reqs.resetApprove },
  'resets.reject':              { roles: STAFF, write: true, fields: ['login'], fn: reqs.resetReject },
  'registry.search':            { roles: STAFF, fields: ['q'], fn: reqs.registrySearch },
  'admin.lists':                { roles: MASTER, fields: [], fn: admin.adminLists },
  // group leaders (decision 41)
  'group.list':                 { roles: LEADER, fields: ['weekId'], fn: groups.groupList },
  'group.mark':                 { roles: LEADER, write: true, fields: ['weekId', 'marks'], fn: groups.groupMark },
  'leaders.list':               { roles: STAFF, fields: ['batchId'], fn: groups.leadersList },
  'leaders.set':                { roles: STAFF, write: true, fields: ['login', 'leader', 'reason'], fn: groups.leadersSet },
  'leaders.assign':             { roles: STAFF, write: true, fields: ['leader', 'logins'], fn: groups.leadersAssign },
  'facilitators.list':          { roles: FTP, fields: [], fn: facs.list },
  'facilitators.add':           { roles: FTP, write: true, fields: ['name'], fn: facs.add },
  'facilitators.setActive':     { roles: FTP, write: true, fields: ['name', 'active'], fn: facs.setActive },
  'facilitators.delete':        { roles: MASTER, write: true, fields: ['name', 'reason'], fn: facs.remove },
  // ADR 0014: one rename, everywhere; the students whose facilitator stopped facilitating, for the head to decide
  'facilitators.rename':        { roles: FTP, write: true, fields: ['name', 'newName', 'reason'], fn: facs.rename },
  'facilitators.orphans':       { roles: MASTER, fields: [], fn: facs.orphans },
  'facilitators.setLasting':    { roles: FTP, write: true, fields: ['name', 'reason'], fn: facs.setLasting },
  'facLogins.list':             { roles: MASTER, fields: [], fn: fac.loginsList },
  'facLogins.create':           { roles: MASTER, write: true, fields: ['username', 'facilitator', 'tempPassword'], fn: fac.loginsCreate },
  'facLogins.setDisabled':      { roles: MASTER, write: true, fields: ['username', 'disabled'], fn: fac.loginsSetDisabled },
  'facLogins.resetPassword':    { roles: MASTER, write: true, fields: ['username', 'tempPassword'], fn: fac.loginsResetPassword },
  'facLogins.link':             { roles: MASTER, write: true, fields: ['facilitator', 'phone'], fn: fac.loginsLink },
  'facLogins.unlink':           { roles: MASTER, write: true, fields: ['username'], fn: fac.loginsUnlink },
  'fac.devotees':               { roles: FAC, fields: ['weekId'], fn: fac.devotees },
  'fac.devotee':                { roles: FAC, fields: ['login'], fn: fac.devotee },
  'fac.week':                   { roles: FAC, fields: ['login', 'weekId'], fn: fac.week },
  // the promotion explorer (phase 21): their students on the ladder, every figure over a period, with each batch's rule
  'fac.eligible':               { roles: FAC, fields: ['period', 'from', 'to'], fn: explorer.facEligible },
  'devotees.week':              { roles: STAFF, fields: ['login', 'weekId'], fn: fac.staffWeek },
  // Share sadhana (27 Oct 2026, shares.js): the owner shares their own sadhana by phone; the facilitator is derived, never
  // stored. The viewer's side is by the share's id, never the owner's login (their phone); ANY at the gate and checked
  // against the share row on every call (FORBIDDEN without one)
  'share.list':                 { roles: DEVOTEE, fields: [], fn: shares.shareList },
  'share.lookup':               { roles: DEVOTEE, fields: ['phone'], fn: shares.shareLookup },
  'share.add':                  { roles: DEVOTEE, write: true, fields: ['phone'], fn: shares.shareAdd },
  'share.remove':               { roles: DEVOTEE, write: true, fields: ['login'], fn: shares.shareRemove },
  'share.leave':                { roles: ANY, write: true, fields: ['id'], fn: shares.shareLeave },
  'share.devotee':              { roles: ANY, fields: ['id'], fn: shares.shareDevotee },
  'share.week':                 { roles: ANY, fields: ['id', 'weekId'], fn: shares.shareWeek },
  'coordinators.list':          { roles: MASTER, fields: [], fn: admin.coordinatorsList },
  'coordinators.create':        { roles: MASTER, write: true, fields: ['username', 'name', 'phone', 'batchIds', 'tempPassword', 'master', 'ftp', 'reason'], fn: admin.coordinatorsCreate },
  'coordinators.update':        { roles: MASTER, write: true, fields: ['username', 'name', 'phone', 'batchIds'], fn: admin.coordinatorsUpdate },
  'coordinators.setDisabled':   { roles: MASTER, write: true, fields: ['username', 'disabled'], fn: admin.coordinatorsSetDisabled },
  'coordinators.resetPassword': { roles: MASTER, write: true, fields: ['username', 'tempPassword'], fn: admin.coordinatorsResetPassword },
  'batches.list':               { roles: MASTER, fields: [], fn: admin.batchesList },
  'batches.update':             { roles: MASTER, write: true, fields: ['batchId', 'name', 'active', 'pilot', 'coordinatorLogins', 'startedOn', 'endsOn'], fn: admin.batchesUpdate },
  'batches.create':             { roles: MASTER, write: true, fields: ['batchId', 'name', 'level', 'pilot', 'startedOn', 'endsOn', 'coordinatorLogins', 'fromRequest'], fn: admin.batchesCreate },
  // Phase 23: a coordinator asks to start a numbered intake or a training; the head declines here, approves by creating it
  'batchReq.create':            { roles: STAFF, write: true, fields: ['level', 'startsOn', 'endsOn', 'note'], fn: batchreq.batchReqCreate },
  'batchReq.list':              { roles: STAFF, fields: [], fn: batchreq.batchReqList },
  'batchReq.withdraw':          { roles: STAFF, write: true, fields: ['id'], fn: batchreq.batchReqWithdraw },
  'batchReq.decide':            { roles: MASTER, write: true, fields: ['id', 'decision', 'note'], fn: batchreq.batchReqDecide },
  'ids.search':                 { roles: MASTER, fields: ['q'], fn: admin.idsSearch },
  'ids.get':                    { roles: MASTER, fields: ['iyfId'], fn: admin.idsGet },
  'ids.link':                   { roles: MASTER, write: true, fields: ['login', 'iyfId', 'reason'], fn: admin.idsLink },
  // IYF IDs created in the app (Phase 9, item 14): the head only
  'ids.create':                 { roles: MASTER, write: true, fields: ['login', 'reason', 'year'], fn: admin.idsCreate },
  'ids.nextApp':                { roles: MASTER, fields: ['login', 'year'], fn: admin.idsNextApp },
  'ids.appList':                { roles: MASTER, fields: [], fn: admin.idsAppList },
  'ids.unlink':                 { roles: MASTER, write: true, fields: ['login', 'reason'], fn: admin.idsUnlink },
  // the IYF identity record (migration 0038): the master's mapping screen, and the dashboard's hourly job
  'identity.search':            { roles: MASTER, fields: ['q'], fn: identity.identitySearch },
  'identity.get':               { roles: MASTER, fields: ['personId', 'phone', 'iyfId', 'name'], fn: identity.identityGet },
  'identity.link':              { roles: MASTER, write: true, fields: ['login', 'personId', 'reason'], fn: identity.identityLink },
  'identity.mint':              { roles: MASTER, write: true, fields: ['personId', 'year', 'reason'], fn: identity.identityMint },
  'identity.supersede':         { roles: MASTER, write: true, fields: ['personId', 'year', 'reason'], fn: identity.identitySupersede },
  // fold a duplicate person record into another (audit B8): the head only, audited, never automatic
  'identity.merge':             { roles: MASTER, write: true, fields: ['keep', 'lose', 'reason'], fn: identity.identityMerge },
  'identity.mintBatch':         { roles: MASTER, write: true, noReplay: true, fields: ['rows', 'requestedBy'], fn: identity.mintBatch },
  // the dashboard's scoped service token (migration 0041): created by a master, shown once
  'identity.serviceToken':      { roles: MASTER, write: true, fields: ['login', 'note', 'reason'], fn: identity.serviceToken },
  'ids.possibleDuplicates':     { roles: MASTER, fields: ['showReviewed'], fn: coord.idsPossibleDuplicates },
  'ids.reviewDuplicate':        { roles: MASTER, write: true, fields: ['ids', 'decision', 'why', 'reason'], fn: coord.idsReviewDuplicate },
  'profile.get':                { roles: ANY, fields: [], fn: coord.profileGet },
  'profile.update':             { roles: ANY, write: true, fields: ['name', 'dob', 'bloodGroup', 'emergency', 'address', 'classDay', 'readingPagesPerHour', 'email', 'whatsapp', 'facilitator', 'profession', 'skills', 'connectedSince'], fn: coord.profileUpdate },
  'photo.upload':               { roles: ANY, write: true, fields: ['jpegBase64'], fn: coord.photoUpload },
  'photo.get':                  { roles: ANY, fields: ['login'], fn: coord.photoGet },
  'photo.remove':               { roles: ANY, write: true, fields: ['login', 'reason'], fn: coord.photoRemove },
  'devotees.list':              { roles: STAFF, fields: ['batchId', 'status', 'weekId'], fn: coord.devoteesList },
  'members.list':               { roles: STAFF, fields: ['batchId', 'status', 'classDay', 'bloodGroup', 'q', 'sort', 'offset', 'limit'], fn: coord.membersList },
  'devotees.get':               { roles: STAFF, fields: ['login'], fn: coord.devoteesGet },
  'devotees.setActive':         { roles: STAFF, write: true, fields: ['login', 'active', 'fromWeek'], fn: coord.devoteesSetActive },
  'devotees.setDisabled':       { roles: STAFF, write: true, fields: ['login', 'disabled'], fn: coord.devoteesSetDisabled },
  'devotees.delete':            { roles: STAFF, write: true, fields: ['login', 'confirmPhone'], fn: coord.devoteesDelete },
  // the person deletes their own account (store rules); noReplay: no saved reply keyed by their phone outlives them
  'account.delete':             { roles: ANY, write: true, noReplay: true, fields: ['password', 'confirm'], fn: coord.accountDelete },
  'devotees.setPeople':         { roles: STAFF, write: true, fields: ['login', 'facilitator', 'classDay'], fn: coord.devoteesSetPeople },

  // closing a Vedic intake (ADR 0009): the coordinator of that batch, or the head. This is the only
  // place in the app that moves a devotee from one batch to another, so it is also the only place a
  // promotion happens — and every move carries the name of whoever decided it.
  'batches.closingPreview':     { roles: STAFF, fields: ['batchId'], fn: closing.closingPreview },
  'batches.close':              { roles: STAFF, write: true, fields: ['batchId', 'decisions', 'fromWeek', 'reason'], fn: closing.closingClose },

  // promoting one devotee, without closing anything: SPS and after run with no fixed duration, so a
  // coordinator moves somebody up when they are ready rather than at a term's end (ADR 0009)
  'devotees.promoteOptions':    { roles: STAFF, fields: ['login'], fn: closing.promoteOptions },
  'devotees.promote':           { roles: STAFF, write: true, fields: ['login', 'toBatch', 'fromWeek', 'reason'], fn: closing.devoteePromote },

  // Phases and the target card (the head, 17 Oct 2026). The head opens a phase; a facilitator or
  // ETP student fills their OWN card — nobody fills somebody else's, because the figures are that
  // person's own report and a card filled for them would not mean what the board says it means.
  'phases.list':                { roles: ANY, fields: [], fn: phases.phaseList },
  'phases.open':                { roles: MASTER, write: true, fields: ['phaseId', 'name', 'startsOn', 'endsOn'], fn: phases.phaseOpen },
  'phases.update':              { roles: MASTER, write: true, fields: ['phaseId', 'name', 'startsOn', 'endsOn', 'targetsUntil', 'reason'], fn: phases.phaseUpdate },
  'phases.close':               { roles: MASTER, write: true, fields: ['phaseId', 'reason'], fn: phases.phaseClose },
  'card.get':                   { roles: ANY, fields: ['phaseId', 'weekId'], fn: phases.cardGet },
  'card.fill':                  { roles: ANY, write: true, fields: ['phaseId', 'weekId', 'values'], fn: phases.cardFill },
  // a person sets their OWN targets for a phase — what they feel is feasible. No login: a target
  // somebody else chose is not a commitment, and the board would score them against it.
  'targets.set':                { roles: ANY, write: true, fields: ['phaseId', 'targets'], fn: phases.targetsSet },
  // stage targets: how many students they mean to move up per level, which gives the goal % the
  // dashboard's score is a third of. The ACHIEVED half is counted from real promotions, not typed.
  'stages.set':                 { roles: ANY, write: true, fields: ['phaseId', 'stages'], fn: phases.stagesSet },
  // a finished training's card is a record; the head may open ONE for a real correction, with a reason
  'card.unlock':                { roles: MASTER, write: true, fields: ['login', 'reason'], fn: phases.cardUnlock },
  // ADR 0018: a set target is fixed after the start of the phase; the head opens one person's for 7 days
  'targets.unlock':             { roles: FTP, write: true, fields: ['login', 'phaseId', 'reason'], fn: phases.targetsUnlock },
  // the boards: a training batch's to its own coordinator and the head; the facilitators' to the head
  'board.list':                 { roles: ANY, fields: [], fn: phases.boardList },
  // one person's card, opened from a scoreboard row: the head, or the coordinator of their training
  // the month scorecard (ADR 0012 D): their own; the head anyone's; a training's coordinator their trainees'
  'card.months':                { roles: ANY, fields: ['login', 'phaseId'], fn: mc.cardMonths },
  'card.of':                    { roles: ANY, fields: ['login', 'phaseId', 'weekId'], fn: phases.cardOfPerson },
  'board.get':                  { roles: ANY, fields: ['phaseId', 'weekId', 'batchId'], fn: phases.boardGet },
  // the sadhana leaderboard (ADR 0013): staff rank their batches (the head: any, or all IYF); a devotee their own place
  'leaderboard.get':            { roles: STAFF, fields: ['period', 'weekId', 'month', 'year', 'from', 'to', 'batchId', 'page'], fn: lb.leaderboardGet },
  'leaderboard.mine':           { roles: ANY, fields: [], fn: lb.leaderboardMine },
  // a training's own class attendance, marked by its coordinator (the head, 18 Oct 2026). Separate
  // from attendance.set, which marks a devotee's own batch class: an ETP student sits in both.
  'training.attendance':        { roles: STAFF, write: true, fields: ['batchId', 'weekId', 'marks'], fn: phases.trainingAttendanceSet },

  // who is ready for the next level, computed from this app's data (17 Oct 2026). It REPORTS:
  // a coordinator still promotes somebody, nothing here moves anyone.
  // enrolling existing devotees in a training (17 Oct 2026): nobody signs up INTO one. The search
  // spans all of IYF on purpose — a training draws from the whole of it.
  'enrol.search':               { roles: STAFF, fields: ['batchId', 'q'], fn: enrol.enrolSearch },
  'enrol.list':                 { roles: STAFF, fields: ['batchId'], fn: enrol.enrolList },
  'enrol.add':                  { roles: STAFF, write: true, fields: ['batchId', 'login', 'reason'], fn: enrol.enrolAdd },
  'enrol.remove':               { roles: STAFF, write: true, fields: ['batchId', 'login', 'reason'], fn: enrol.enrolRemove },
  'eligible.list':              { roles: STAFF, fields: ['batchId', 'from', 'to'], fn: eligible.eligibleList },
  'criteria.get':               { roles: MASTER, fields: ['batchId'], fn: eligible.criteriaGet },
  'criteria.set':               { roles: MASTER, write: true, fields: ['batchId', 'criteria', 'reason'], fn: eligible.criteriaSet },
  'weeks.setClass':             { roles: STAFF, write: true, fields: ['batchId', 'weekId', 'kind', 'note', 'everyonePresent', 'reason'], fn: coord.weeksSetClass },
  'attendance.set':             { roles: STAFF, write: true, fields: ['batchId', 'weekId', 'marks'], fn: coord.attendanceSet },
  'stats.batch':                { roles: STAFF, fields: ['batchId', 'weeks'], fn: coord.statsBatch },
  'birthdays.today':            { roles: STAFF, fields: [], fn: coord.birthdaysToday },
  'reopen.request':             { roles: STAFF, write: true, fields: ['login', 'weekId', 'reason'], fn: coord.reopenRequest },
  'reopen.list':                { roles: STAFF,  fields: [], fn: coord.reopenList },
  'reopen.reject':              { roles: MASTER, write: true, fields: ['login', 'weekId', 'reason'], fn: coord.reopenReject },
  // Phase 23 (ADR 0020, inactive.js): who became inactive by themselves or came back — Home's notices and the analysis.
  // STAFF at the gate; the handler narrows to the caller's class batches (the head: all of IYF Delhi).
  'activity.notices':           { roles: STAFF, fields: [], fn: inactive.activityNotices },
  'activity.stats':             { roles: STAFF, fields: ['batchId', 'month'], fn: inactive.activityStats },
  'weeks.reopen':               { roles: MASTER, write: true, fields: ['login', 'weekId', 'reason', 'openUntil'], fn: coord.weeksReopen },
  'attendance.override':        { roles: MASTER, write: true, fields: ['login', 'weekId', 'mark', 'reason'], fn: coord.attendanceOverride },
  'push.register':              { roles: PUBLIC, write: true, fields: ['endpoint', 'keys'], fn: push.register },
  'push.subscribe':             { roles: ANY, write: true, fields: ['endpoint', 'keys'], fn: push.subscribe },
  'push.detach':                { roles: ANY, write: true, fields: ['endpoint'], fn: push.detach },
  'push.unsubscribe':           { roles: PUBLIC, write: true, fields: ['endpoint'], fn: push.unsubscribe },
  // timings from real phones, 1 open in 100, at most 3 a day per person (B4, the head's D-5)
  'vitals.report':              { roles: ANY, write: true, noReplay: true, fields: ['fcp', 'lcp', 'inp', 'cls', 'route', 'tier', 'net'], fn: vitals.vitalsReport },
  'push.message':               { roles: PUBLIC, fields: ['endpoint'], fn: push.message },
  'push.renew':                 { roles: PUBLIC, write: true, noReplay: true, fields: ['oldEndpoint', 'endpoint', 'keys'], fn: push.renew },
  // Admin › Analysis (phase 21): every batch's weekly sums over a period, for the head's trends and report
  'analysis.get':               { roles: MASTER, fields: ['from', 'to'], fn: analysis.analysisGet },
  // Admin › Reports (Phase 23 P14): one report for any period, in one call. The head; or anyone the head gave `reports`
  // (grants.js), whose scope the handler forces to their own batches, students or trainings
  'report.options':             { roles: MASTER, fields: [], fn: report.reportOptions },
  'report.get':                 { roles: MASTER, fields: ['from', 'to', 'compare', 'scope', 'sections'], fn: report.reportGet },
  'stats.all':                  { roles: MASTER, fields: ['weeks'], fn: coord.statsAll },
  // permissions per person (ADR 0015): the head gives and takes, any devotee or staff
  'access.search':              { roles: MASTER, fields: ['q'], fn: grants.accessSearch },
  'access.get':                 { roles: MASTER, fields: ['login'], fn: grants.accessGet },
  'access.list':                { roles: MASTER, fields: [], fn: grants.accessList },
  'access.set':                 { roles: MASTER, write: true, fields: ['login', 'capability', 'effect', 'until', 'reason'], fn: grants.accessSet },
  'access.assign':              { roles: MASTER, write: true, fields: ['login', 'role', 'batchIds', 'rights', 'until', 'reason'], fn: grants.accessAssign },
  'access.revoke':              { roles: MASTER, write: true, fields: ['login', 'role', 'reason'], fn: grants.accessRevoke },
  'audit.list':                 { roles: MASTER, fields: ['who', 'what', 'target', 'from', 'to', 'before', 'limit', 'q', 'actions'], fn: coord.auditList },
  'runlog.list':                { roles: MASTER, fields: ['limit'], fn: coord.runlogList },
  'settings.get':               { roles: MASTER, fields: [], fn: coord.settingsGet },
  'home.staff':                 { roles: MASTER, fields: ['weeks'], fn: staffhome.homeStaff },
  // exports (Phase 9, item 21): a page at a time; the first page is checked, rate-limited and logged in Activity
  'exports.catalog':            { roles: STAFF, fields: [], fn: exp.catalog },
  'exports.page':               { roles: STAFF, fields: ['grain', 'fields', 'batchIds', 'from', 'to', 'filters', 'cursor'], fn: exp.page },
  'settings.update':            { roles: MASTER, write: true, fields: ['submitWindow', 'trackingFrom', 'reminderTime', 'logRetentionMonths'], fn: coord.settingsUpdate },
  'masters.set':                { roles: MASTER, write: true, fields: ['login', 'master', 'reason'], fn: admin.mastersSet },
  // a new IYF head needs every other active head's approval (Phase 9, item 24)
  'heads.requests':             { roles: MASTER, fields: [], fn: admin.headsRequests },
  'heads.decide':               { roles: MASTER, write: true, fields: ['id', 'approve', 'note'], fn: admin.headsDecide },
  'heads.withdraw':             { roles: MASTER, write: true, fields: ['id'], fn: admin.headsWithdraw }
};

const bad = () => apiError('BAD_REQUEST', 'Something went wrong. Please try again.');

async function handle(req, ctx) {
  if (req.v !== API_VERSION) {
    if (typeof req.v === 'number' && req.v < API_VERSION) throw apiError('UPGRADE_REQUIRED', 'A new version of the app is ready.');
    throw apiError('BAD_REQUEST', 'Unknown version');
  }
  const route = typeof req.action === 'string' && Object.hasOwn(ROUTES, req.action) ? ROUTES[req.action] : null;
  if (!route) throw apiError('BAD_REQUEST', 'Unknown action');
  const data = req.data === undefined ? {} : req.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw apiError('BAD_REQUEST', 'Bad data');
  for (const k of Object.keys(data)) if (!route.fields.includes(k)) throw apiError('BAD_REQUEST', 'Unknown field ' + k);

  const rid = String(req.requestId || '');
  /* The replay check of a signed-in write rides in the batch that reads the caller's scopes (22 Oct 2026, G2): one
   * round trip less on every save. Its key needs the caller's login, which only the session read knows, so it is
   * handed over as a statement made from the login. It is only READ early; every check below still runs in the same
   * order, so a refused call answers exactly as before. */
  const replay = route.write && !route.noReplay && route.roles !== PUBLIC && /^[A-Za-z0-9-]{8,64}$/.test(rid)
    ? { stmt: (login) => q(ctx.db, 'SELECT body FROM replies WHERE key = ?', `${login || 'anon'}:${req.action}:${rid}`) }
    : null;
  if (route.roles !== PUBLIC) {
    Object.assign(ctx, await sessionCtx(ctx, req.token, replay ? [replay] : []));
    grants.withAccess(ctx);              // a role past its end date drops out; the scopes carry the rights (ADR 0019)
    if (ctx.mustChange && !route.mustChangeOk) throw apiError('MUST_CHANGE_PASSWORD', 'Please choose a new password first.');
    // the role gate, then what the head has given or taken for this person (ADR 0015): read from the account row the
    // session already loaded, so no extra round trip
    if (!grants.gate(ctx, req.action, data, allowed(route.roles, ctx.scopes))) throw apiError('FORBIDDEN', 'You do not have access to this.');
    // A service account (migration 0041) may call ONLY the actions it was created for, whatever its role
    // otherwise allows: the dashboard's hourly job holds a token that mints IYF IDs and can do nothing else,
    // so a Script Property every dashboard editor can read is no longer a master key. Empty = a person, no limit.
    if (ctx.acct?.only_actions && !csv(ctx.acct.only_actions).includes(req.action)) {
      throw apiError('FORBIDDEN', 'This login may only call: ' + ctx.acct.only_actions);
    }
  }
  if (!route.write) return (await route.fn(data, ctx, req)) ?? {};

  if (!/^[A-Za-z0-9-]{8,64}$/.test(rid)) throw apiError('BAD_REQUEST', 'Missing request id');
  // saves that are safe to repeat by themselves (a retried save returns ok) skip the replay cache: one write less
  if (route.noReplay) return (await route.fn(data, ctx, req)) ?? {};
  const key = `${ctx.login || 'anon'}:${req.action}:${rid}`;
  const seen = replay && 'row' in replay ? replay.row : await one(ctx.db, 'SELECT body FROM replies WHERE key = ?', key);
  if (seen) return JSON.parse(seen.body);
  const out = (await route.fn(data, ctx, req)) ?? {};
  ctx.waitUntil(run(ctx.db, 'INSERT OR IGNORE INTO replies (key, body, at) VALUES (?, ?, ?)', key, JSON.stringify(out), Date.now()));
  return out;
}

/** One API call: parses, runs and logs. Returns the reply object. */
export async function apiCall(rawBody, env, waitUntil, clock = () => new Date(), meta = {}) {
  const t0 = Date.now(), ctx = { env, db: requestDb(env.DB), now: clock, waitUntil, ip: meta.ip || '', login: '', role: '' };
  let req = null, res;
  try {
    if (!rawBody || rawBody.length > 400000) throw bad();
    try { req = JSON.parse(rawBody); } catch { throw bad(); }
    if (!req || typeof req !== 'object' || Array.isArray(req)) throw bad();
    res = { ok: true, data: await handle(req, ctx) };
  } catch (e) {
    if (e instanceof ApiError) {
      res = { ok: false, error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}), ...(e.details ? { details: e.details } : {}) } };
      // data (STALE's current day, LOCKED_OUT's time): at the top, as always, and inside error too, where the app reads it
      if (e.data) { res.data = e.data; res.error.data = e.data; }
    } else {
      console.error('internal', e && e.stack || e);
      const detail = String(e && e.message || e);
      /* D1's free plan stops serving reads for the rest of the UTC day once the row budget is spent. Every
         action then fails, and "Please try again" is actively misleading: trying again cannot work until
         the budget resets at 00:00 UTC (05:30 IST). Seen on 14 Oct 2026 — a coordinator's export and a
         sign-in both failed this way and the screen only said "Please try again". Its own code, so the app
         can say what happened and when it will work. */
      const capped = /free tier daily|daily row read limit|exceeded .*limit/i.test(detail);
      /* THE DEVOTEE IS NEVER TOLD ABOUT THE PLAN (the head, 15 Oct 2026).
       *
       * My first version of this said "Today's free database allowance is used up. It resets at 5:30 AM
       * IST." That is IYF's billing arrangement with Cloudflare, and it is nobody else's business: a
       * devotee trying to fill their sadhana has no use for it, cannot act on it, and should not be shown
       * which plan the temple is on. What they need is the truth in their own terms — it is us, not them,
       * it is temporary, and roughly when to come back.
       *
       * The DISTINCTION is kept where it is useful: the code stays DAILY_LIMIT, and the exact Cloudflare
       * wording goes to run_log as `detail`, so the head's Activity screen and anyone reading the logs sees
       * precisely what happened within seconds. Only the sentence the person reads changes. */
      res = capped
        ? { ok: false, error: { code: 'DAILY_LIMIT', message: 'The app is resting and will be back in the morning. Nothing you have filled is lost.' } }
        : { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } };
      res._internal = capped ? `DB DAILY LIMIT REACHED — ${detail}`.slice(0, 300) : detail.slice(0, 300);
    }
  }
  const ms = Date.now() - t0, internal = res._internal;
  delete res._internal;
  res.serverTime = isoIst(clock());
  // slow or failed calls go to the Run Log — but not while the database itself is overloaded (writing then only adds load)
  // BUSY (a rate limit said no) is not logged: a flood must not turn into database writes (security review, 3 Oct 2026)
  const overloaded = /overloaded|queued for too long/i.test(internal || '');
  if (((!res.ok && (res.error.code === 'INTERNAL' || res.error.code === 'DAILY_LIMIT')) || ms > SLOW_MS) && !overloaded) {
    waitUntil(env.DB.prepare('INSERT INTO run_log (at, action, ms, ok, error_code, detail, app_build) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(isoIst(clock()), String(req?.action || '?').slice(0, 40), ms, res.ok ? 1 : 0, res.ok ? '' : res.error.code, internal || '', String(req?.app || '').slice(0, 40)).run()
      .catch(e => console.error('run log', e.message)));
  }
  // roadmap 6.6: the sampled refusal counter. Not while the database is struggling, for the same reason.
  /* `env.REFUSAL_SAMPLE_OFF` switches the sampler off entirely. It exists for the SUITES: sampling with
     Math.random() made any test that compares the settings table flaky, because about one run in ten wrote
     a counter row in the middle of it (mirror.test.mjs, ~1 failure in 10 runs, 15 Oct 2026). The counter
     itself is tested directly in phase6-observability.test.mjs, where the sampling is the point. */
  const counting = !res.ok && WATCHED_CODES.has(res.error.code) && !overloaded && !env.REFUSAL_SAMPLE_OFF;
  if (counting && Math.random() * REFUSAL_SAMPLE < 1) {
    const hour = isoIst(clock()).slice(0, 13);                 // 2026-10-14T11, IST
    const key = `refusals_${res.error.code.toLowerCase()}`;
    waitUntil(env.DB.prepare(
      `INSERT INTO settings (key, value, note, changed_by, changed_at) VALUES (?, ?, ?, 'schedule', ?)
         ON CONFLICT(key) DO UPDATE SET
           value = CASE WHEN substr(settings.value, 1, 13) = ?
             THEN ? || '|' || CAST(CAST(substr(settings.value, 15) AS INTEGER) + ? AS INTEGER)
             ELSE ? END,
           changed_at = excluded.changed_at`)
      .bind(key, `${hour}|${REFUSAL_SAMPLE}`, `${res.error.code} refusals this hour (sampled 1 in ${REFUSAL_SAMPLE})`,
            isoIst(clock()), hour, hour, REFUSAL_SAMPLE, `${hour}|${REFUSAL_SAMPLE}`).run()
      .catch(e => console.error('refusal count', e.message)));
  }
  return res;
}
