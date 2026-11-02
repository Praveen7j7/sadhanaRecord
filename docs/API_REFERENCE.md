# API reference — Sadhana Record

**Generated from `worker/src/api.js` on 12 October 2026.** Every action below was read from the route table, not
from memory: its name, the roles allowed, whether it writes, and the exact fields it accepts.

**122 actions · 71 writes · 51 reads.**
The historical figure of "95 actions" is out of date.

> **Corrected 13 Oct 2026.** This document first said 116. My extraction matched `'([a-z]+\.[a-zA-Z]+)'`, so the
> six **camelCase** modules — all of `facLogins.*` (`api.js:83-88`, every one MASTER) — were silently dropped.
> Found by prompt-f0's second pass. The table below has been regenerated with `[a-zA-Z]+` and now holds all 122.

## How the API works

One endpoint, `POST /`, with an action name in the body. There are no REST paths.

```json
{ "v": 1, "action": "week.saveDay", "token": "<64 hex>", "app": "<build>",
  "requestId": "<uuid>", "data": { } }
```

Every reply is **HTTP 200**, success or not:

```json
{ "ok": true,  "data": { }, "serverTime": "2026-10-12T07:14:00+05:30" }
{ "ok": false, "error": { "code": "VALIDATION", "message": "…", "fields": [] } }
```

The gate every call passes, in order (`worker/src/api.js`, `handle()`):

1. **Version** — `v` must match, else `UPGRADE_REQUIRED`.
2. **Known action** — else `BAD_REQUEST`.
3. **Unknown field** — any key in `data` outside the action's `fields` list is rejected. This is a whitelist, not a filter.
4. **Session** — unless `PUBLIC`; an ended, expired, or role-changed session fails with `UNAUTHENTICATED`.
5. **Role** — `allowed(route.roles, ctx.scopes)`.
6. **Service account** — a login with `only_actions` set may call only those actions (migration 0041).
7. **requestId** — every write needs one; the reply is cached against it so a retry never writes twice.

Actions marked **noReplay** skip that cache: they are safe to repeat by themselves.

## Actions by area

`write` = changes data. `roles` = who may call it. `fields` = the only accepted keys of `data`.

### Coordinator and batch screens — `coord.js` (29)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `account.delete` | ANY | **yes** ·noReplay | `password`, `confirm` |
| `attendance.override` | MASTER | **yes** | `login`, `weekId`, `mark`, `reason` |
| `attendance.set` | STAFF | **yes** | `batchId`, `weekId`, `marks` |
| `audit.list` | MASTER | read | `who`, `what`, `target`, `from`, `to`, `before`, `limit` |
| `birthdays.today` | STAFF | read | — |
| `devotees.delete` | STAFF | **yes** | `login`, `confirmPhone` |
| `devotees.get` | STAFF | read | `login` |
| `devotees.list` | STAFF | read | `batchId`, `status`, `weekId` |
| `devotees.setActive` | STAFF | **yes** | `login`, `active`, `fromWeek` |
| `devotees.setDisabled` | STAFF | **yes** | `login`, `disabled` |
| `devotees.setPeople` | STAFF | **yes** | `login`, `facilitator`, `classDay` |
| `ids.possibleDuplicates` | MASTER | read | `showReviewed` |
| `ids.reviewDuplicate` | MASTER | **yes** | `ids`, `decision`, `why`, `reason` |
| `members.list` | STAFF | read | `batchId`, `status`, `classDay`, `bloodGroup`, `q`, `sort`, `offset`, `limit` |
| `photo.get` | ANY | read | `login` |
| `photo.remove` | ANY | **yes** | `login`, `reason` |
| `photo.upload` | ANY | **yes** | `jpegBase64` |
| `profile.get` | ANY | read | — |
| `profile.update` | ANY | **yes** | `name`, `dob`, `bloodGroup`, `emergency`, `address`, `classDay`, `readingPagesPerHour`, `ema… |
| `reopen.list` | STAFF | read | — |
| `reopen.reject` | MASTER | **yes** | `login`, `weekId`, `reason` |
| `reopen.request` | STAFF | **yes** | `login`, `weekId`, `reason` |
| `runlog.list` | MASTER | read | `limit` |
| `settings.get` | MASTER | read | — |
| `settings.update` | MASTER | **yes** | `submitWindow`, `trackingFrom`, `reminderTime`, `logRetentionMonths` |
| `stats.all` | MASTER | read | `weeks` |
| `stats.batch` | STAFF | read | `batchId`, `weeks` |
| `weeks.reopen` | MASTER | **yes** | `login`, `weekId`, `reason`, `openUntil` |
| `weeks.setClass` | STAFF | **yes** | `batchId`, `weekId`, `kind`, `note`, `everyonePresent`, `reason` |

### Head / admin screens — `admin.js` (21)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `admin.lists` | MASTER | read | — |
| `batches.create` | MASTER | **yes** | `batchId`, `name`, `level`, `pilot` |
| `batches.list` | MASTER | read | — |
| `batches.update` | MASTER | **yes** | `batchId`, `name`, `active`, `pilot`, `coordinatorLogins` |
| `coordinators.create` | MASTER | **yes** | `username`, `name`, `phone`, `batchIds`, `tempPassword`, `master`, `reason` |
| `coordinators.list` | MASTER | read | — |
| `coordinators.resetPassword` | MASTER | **yes** | `username`, `tempPassword` |
| `coordinators.setDisabled` | MASTER | **yes** | `username`, `disabled` |
| `coordinators.update` | MASTER | **yes** | `username`, `name`, `phone`, `batchIds` |
| `heads.decide` | MASTER | **yes** | `id`, `approve`, `note` |
| `heads.requests` | MASTER | read | — |
| `heads.withdraw` | MASTER | **yes** | `id` |
| `ids.appList` | MASTER | read | — |
| `ids.create` | MASTER | **yes** | `login`, `reason` |
| `ids.get` | MASTER | read | `iyfId` |
| `ids.link` | MASTER | **yes** | `login`, `iyfId`, `reason` |
| `ids.nextApp` | MASTER | read | — |
| `ids.search` | MASTER | read | `q` |
| `ids.unlink` | MASTER | **yes** | `login`, `reason` |
| `masters.set` | MASTER | **yes** | `login`, `master`, `reason` |
| `meta.get` | PUBLIC | read | — |

### Announcements and the wall — `ann.js` (15)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `announcements.comment` | ANY | **yes** | `id`, `body` |
| `announcements.comments` | ANY | read | `id` |
| `announcements.create` | ANY | **yes** | `title`, `body`, `audience`, `pinned`, `expiresAt`, `publishAt`, `image` |
| `announcements.image` | ANY | read | `id` |
| `announcements.like` | ANY | **yes** ·noReplay | `id`, `like` |
| `announcements.list` | ANY | read | — |
| `announcements.remove` | ANY | **yes** | `id` |
| `announcements.report` | ANY | **yes** ·noReplay | `id`, `commentId`, `reason`, `note` |
| `announcements.reports` | MASTER | read | — |
| `announcements.resolve` | MASTER | **yes** | `postId`, `commentId`, `action` |
| `announcements.uncomment` | ANY | **yes** | `commentId` |
| `announcements.update` | ANY | **yes** | `id`, `title`, `body`, `audience`, `pinned`, `expiresAt`, `publishAt`, `image` |
| `mutes.list` | ANY | read | — |
| `mutes.set` | ANY | **yes** ·noReplay | `commentId`, `key`, `mute` |
| `mutes.setAll` | MASTER | **yes** ·noReplay | `commentId`, `key`, `mute` |

### Facilitator screens and logins — `fac.js` (10)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `devotees.week` | STAFF | read | `login`, `weekId` |
| `fac.devotee` | FAC | read | `login` |
| `fac.devotees` | FAC | read | `weekId` |
| `fac.week` | FAC | read | `login`, `weekId` |
| `facLogins.create` | MASTER | **yes** | `username`, `facilitator`, `tempPassword` |
| `facLogins.link` | MASTER | **yes** | `facilitator`, `phone` |
| `facLogins.list` | MASTER | read | — |
| `facLogins.resetPassword` | MASTER | **yes** | `username`, `tempPassword` |
| `facLogins.setDisabled` | MASTER | **yes** | `username`, `disabled` |
| `facLogins.unlink` | MASTER | **yes** | `username` |

### Sign-in, sign-up, passwords — `auth.js` (7)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `auth.changePassword` | ANY | **yes** | `current`, `new` |
| `auth.login` | PUBLIC | read | `login`, `password`, `device` |
| `auth.logout` | ANY | read | — |
| `auth.lookup` | PUBLIC | read | `phone` |
| `auth.me` | ANY | read | — |
| `auth.requestReset` | PUBLIC | **yes** | `login`, `newPassword` |
| `auth.signUp` | PUBLIC | **yes** | `phone`, `name`, `batchId`, `password`, `profile`, `consentPhoto`, `facilitator`, `classDay`… |

### Filling and submitting a week — `weeks.js` (7)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `history.list` | ANY | read | `before`, `limit`, `onBehalfOf` |
| `home.get` | DEVOTEE | read | — |
| `week.get` | ANY | read | `weekId`, `onBehalfOf` |
| `week.saveDay` | ANY | **yes** ·noReplay | `weekId`, `date`, `version`, `day`, `onBehalfOf` |
| `week.saveWeekEnd` | ANY | **yes** ·noReplay | `weekId`, `version`, `nightStay`, `principles`, `onBehalfOf` |
| `week.setAttendance` | DEVOTEE | **yes** ·noReplay | `weekId`, `mark` |
| `week.submit` | ANY | **yes** | `weekId`, `onBehalfOf` |

### IYF identity record — `identity.js` (7)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `identity.get` | MASTER | read | `personId`, `phone`, `iyfId`, `name` |
| `identity.link` | MASTER | **yes** | `login`, `personId`, `reason` |
| `identity.mint` | MASTER | **yes** | `personId`, `year`, `reason` |
| `identity.mintBatch` | MASTER | **yes** ·noReplay | `rows`, `requestedBy` |
| `identity.search` | MASTER | read | `q` |
| `identity.serviceToken` | MASTER | **yes** | `login`, `note`, `reason` |
| `identity.supersede` | MASTER | **yes** | `personId`, `year`, `reason` |

### Sign-up and reset requests — `reqs.js` (6)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `registry.search` | STAFF | read | `q` |
| `requests.approve` | STAFF | **yes** | `phone`, `link`, `levelEntryDate`, `facilitator`, `classDay`, `groupLeader` |
| `requests.list` | STAFF | read | `batchId` |
| `requests.reject` | STAFF | **yes** | `phone`, `reason` |
| `resets.approve` | STAFF | **yes** | `login` |
| `resets.reject` | STAFF | **yes** | `login` |

### Notifications — `push.js` (6)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `push.detach` | ANY | **yes** | `endpoint` |
| `push.message` | PUBLIC | read | `endpoint` |
| `push.register` | PUBLIC | **yes** | `endpoint`, `keys` |
| `push.renew` | PUBLIC | **yes** ·noReplay | `oldEndpoint`, `endpoint`, `keys` |
| `push.subscribe` | ANY | **yes** | `endpoint`, `keys` |
| `push.unsubscribe` | PUBLIC | **yes** | `endpoint` |

### Group leaders — `groups.js` (5)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `group.list` | LEADER | read | `weekId` |
| `group.mark` | LEADER | **yes** | `weekId`, `marks` |
| `leaders.assign` | STAFF | **yes** | `leader`, `logins` |
| `leaders.list` | STAFF | read | `batchId` |
| `leaders.set` | STAFF | **yes** | `login`, `leader`, `reason` |

### facs — `facs.js` (4)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `facilitators.add` | MASTER | **yes** | `name` |
| `facilitators.delete` | MASTER | **yes** | `name`, `reason` |
| `facilitators.list` | MASTER | read | — |
| `facilitators.setActive` | MASTER | **yes** | `name`, `active` |

### Score cards and rules — `rules.js` (3)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `books.setCurrent` | ANY | **yes** ·noReplay | `bookId`, `onBehalfOf` |
| `journals.get` | ANY | read | `have`, `onBehalfOf` |
| `rules.get` | ANY | read | `have`, `onBehalfOf` |

### exp — `exp.js` (2)

| Action | Roles | Write | Accepts |
|---|---|---|---|
| `exports.catalog` | STAFF | read | — |
| `exports.page` | STAFF | read | `grain`, `fields`, `batchIds`, `from`, `to`, `filters`, `cursor` |
---

## Error codes

Generated from `worker/src/codes.js` by `node tools/docs/codes.mjs`, and kept honest by
`worker/tests/codes.test.mjs`: a code the server throws but does not describe, a described code nothing can
throw, and a code missing from this page each fail the suite. This replaces a hand-written table that listed
nine of the twenty-two codes.


<!-- codes:start (generated by tools/docs/codes.mjs — do not edit by hand) -->

| Code | Means | Retrying helps? |
|---|---|---|
| `BAD_REQUEST` | The call itself is malformed: unknown action, unknown field, bad JSON, a data key the action does not accept. | only after changing the request |
| `UPGRADE_REQUIRED` | The app is older than the API contract. The app reloads itself to pick up the new build. | only after changing the request |
| `UNAUTHENTICATED` | No usable session: the token is missing, malformed, ended, expired, or the account is no longer active. | only after changing the request |
| `MUST_CHANGE_PASSWORD` | The account must choose a new password before anything else is allowed. | only after changing the request |
| `FORBIDDEN` | The caller is signed in but may not do this: wrong scope, another coordinator's batch, a staff account they may not change, or a service token outside its allow-list. | no — the answer will not change |
| `VALIDATION` | One or more fields are wrong. `fields[]` carries a path and a message for each. | only after changing the request |
| `NOT_FOUND` | No such record, or none the caller may see. Used deliberately in place of FORBIDDEN where saying "it exists" would itself disclose something (facilitator.js). | no — the answer will not change |
| `CONFLICT` | The record is not in a state that allows this: already approved, already linked, a sign-up still pending, a duplicate. | no — the answer will not change |
| `UNKNOWN_ID` | An IYF ID that is not in the dashboard registry copy. | yes, later |
| `BAD_CREDENTIALS` | Wrong password, or an unknown login (deliberately the same answer for both). | only after changing the request |
| `LOCKED_OUT` | Too many wrong passwords. `data.until` says when it ends. | yes, later |
| `ACCOUNT_DISABLED` | The account is disabled or inactive; a coordinator or the head must re-enable it. | no — the answer will not change |
| `PENDING_APPROVAL` | The sign-up is waiting for a coordinator. | yes, later |
| `RESET_EXPIRED` | The temporary password from an approved reset is past its 24 hours; the devotee asks for a new reset and the coordinator approves it again. | only after changing the request |
| `REJECTED` | The sign-up was rejected. | no — the answer will not change |
| `FUTURE_DAY` | That day has not happened yet in Indian time. | no — the answer will not change |
| `STALE` | Another device saved this day first. `data` carries the server's current copy; the app adopts it. | only after changing the request |
| `WINDOW_CLOSED` | The week is past its deadline and not reopened, or attendance is not open yet. | no — the answer will not change |
| `ALREADY_SUBMITTED` | This week was already submitted; a submitted week never changes. | no — the answer will not change |
| `INCOMPLETE` | Submit needs at least one whole day. `fields[]` lists what is missing. | only after changing the request |
| `COMMENTS_BLOCKED` | The IYF head has hidden this person's comments for everyone. | no — the answer will not change |
| `BUSY` | A rate limit said no, or an ID allocation is contended. NOT a lock. The app retries three times, two seconds apart. | yes, later |
| `INTERNAL` | A fault on the server. The message is deliberately generic; the detail is in `run_log`. | yes, later |
| `DAILY_LIMIT` | The database has stopped answering for the day (D1's row budget); every action fails until it resets at 05:30 IST. The person is told only that the app is resting — the plan and the quota go to run_log, never to them. | yes, later |

_24 codes. Every reply is HTTP 200 with `ok: false` (see ADR 0001); the `http` column in
`worker/src/codes.js` is only there to say what each code would be in a status-code API._
<!-- codes:end -->

## Review notes — 12 October 2026 (second pass, read-only)

A second session re-read `worker/src/api.js` and every handler against this page. Corrections, in page order:

1. **Counts.** The route table has **122 actions, 71 writes, 51 reads, 11 `noReplay`** (`api.js:29-162`). The six
   `facLogins.*` actions (`api.js:83-88`, all MASTER, five writes: `list`, `create`, `setDisabled`, `resetPassword`,
   `link`, `unlink`; handlers in `facilitator.js`) are missing from every table above. By role: PUBLIC 9 · ANY 31 ·
   DEVOTEE 2 · LEADER 2 · FAC 3 · STAFF 25 · **MASTER 50**.
2. **Version gate.** Only a *lower* `v` gives `UPGRADE_REQUIRED`; any other mismatch is `BAD_REQUEST 'Unknown version'`
   (`api.js:167-170`). The gate also requires `data` to be a plain object (`:174`) and applies the
   `MUST_CHANGE_PASSWORD` check between session and role (`:179`).
3. **Replay cache is not a lock.** The reply is stored *after* the handler via `waitUntil` (`api.js:198`); two
   overlapping retries with the same `requestId` both execute. Eleven actions skip the cache (`noReplay`).
4. **Module headings** use import aliases: `ann.js` is `announcements.js`, `reqs.js` is `requests.js`, `facs.js` is
   `facilitators.js`, `fac.js` is `facilitator.js`, `exp.js` is `exports.js`.
5. **`write` does not mean "changes data".** It means "needs a `requestId` and goes through the replay cache".
   `auth.login`, `auth.logout`, `auth.lookup` (counters), `push.message` (`pending`), `exports.page` (audit + counter),
   `heads.requests` (`expireHeads`) and the hourly session touch all write without the flag.
6. **Error codes.** `BUSY` is a rate limit or ID-allocation contention, not "a lock is held". Codes also thrown and not
   listed: `STALE`, `FUTURE_DAY`, `WINDOW_CLOSED`, `ALREADY_SUBMITTED`, `INCOMPLETE`, `LOCKED_OUT`, `BAD_CREDENTIALS`,
   `PENDING_APPROVAL`, `REJECTED`, `ACCOUNT_DISABLED`, `COMMENTS_BLOCKED`, `UNKNOWN_ID`, `INTERNAL`. They are string
   literals in each module; `util.js` holds no list.
7. **`NOT_FOUND` is not uniformly used for "not yours".** An out-of-scope batch answers `FORBIDDEN 'That batch is not
   yours'` (`requests.js:12`); `managed()` answers `NOT_FOUND` / `CONFLICT` / `FORBIDDEN` by the target's state before
   the scope check (`coord.js:47-55`). Only `facilitator.js:132` collapses to `NOT_FOUND`.
8. **`dirty()` does not append to `mirror_log`.** It bumps `mirror_state.dirty` for six reference tables and is a no-op
   otherwise (`db.js:37-41`); row changes reach `mirror_log` through triggers.
9. **Scoring moments.** `week.submit` is not the only one: `runDeadline` scores auto-submitted weeks (`weeks.js:453-454`)
   and `finalScores()` re-derives attendance/overall on every read (`classweek.js:62-66`).
10. **Scheduled work is reachable from a request:** `requests.approve` / `ids.link` → `checkIyfId` → `refreshRegistry`
    reads the Google sheet in-request (`registry.js:208-211`).
11. `api.js` is 233 lines; handlers live in **13** modules (`api.js:7-19`); 33 is the number of files in `src/`.
12. `requestId` is accepted as `[A-Za-z0-9-]{8,64}` (`api.js:191`), not only a UUID.

The findings behind these notes, with severities and fix shapes, are in `FULL_AUDIT_2026-10-12.md` §6 and §7.

---

## Change log — phase 3 (13 October 2026)

**One action added: `auth.logoutAll`** (`ANY`, write, no fields). Signs out every device of the calling login,
including the device that asked, and returns `{ devices }` so the app can say how many. Audited as
`auth.logoutAll`. Before it, a person on a shared or lost phone could only end that one session; the others
stayed valid for 30 days unless they changed their password (audit F21).

The counts after phase 3 were **124 actions · 73 writes · 51 reads** (`auth.logoutAll` and `identity.merge`).
A first version of this note said 123: it was written before `identity.merge` was added later in the same phase.

**Also in phase 3**, with no change to any action's name, fields or permissions:

- `photo.get` and `photo.remove` now answer a non-staff caller asking about any login but their own with the same
  `NOT_FOUND` as for a number that never signed up. They used to answer `NOT_FOUND` / `CONFLICT` / `FORBIDDEN` by
  the target's state, which told a curious devotee whether a number was a devotee, pending, or in another batch
  (audit F4).
- `profile.update` is one atomic write. It used to issue up to four, so a failure part-way could leave a new
  facilitator with an old class day, or a renamed account whose profile row still held the old name (audit F16).
- The error-code table above is generated from `worker/src/codes.js`; `worker/tests/codes.test.mjs` fails if the
  server throws a code the registry does not describe, if the registry lists one nothing can throw, or if a code
  is missing from this page.
- `frontend/tests/writes.test.js` was matching `write: true` only when it came straight after `roles:`, so a route
  with `mustChangeOk` in between slipped past the contract check entirely. Found by adding `auth.logoutAll` and
  noticing the test stayed green; fixed, and it then caught the missing entry at once.

---

## Change log — phase 4 (13 October 2026)

**One action added: `announcements.get`** (`ANY`, read, `id`). Returns one post by id, through the same visibility
rule as the list. The wall shows the 50 newest posts a person may see, and a shared WhatsApp link is exactly the
one people keep and forward, so a link to an older post used to say "no longer on the wall" about a post that is
perfectly alive (audit FE-17). The app now fetches that post and puts it at the top.

**Counts: 125 actions · 73 writes · 52 reads.**

**Also in phase 4**, with no change to any action's name, fields or permissions:

- **`announcements.list` and everything that looks a post up through it** apply the audience test **in the query**
  instead of after it (audit F9). It used to read the newest 200 unexpired posts and then filter, so once the wall
  held more than 200 a devotee whose batch's posts were older saw fewer than their page — or an empty wall — and
  `announcements.image`, `like` and `comment` answered `NOT_FOUND` for a post that existed. A test now seeds 231
  posts and asserts the devotee still sees theirs; on the old code their wall comes back empty.
- **The copy to Google Sheets is paused** (`SHEETS_COPY`), so no action writes to a sheet any more. The inbound read
  of the dashboard's Devotees tab still runs. See `INTEGRATIONS.md`.
