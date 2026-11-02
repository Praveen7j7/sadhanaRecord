# Sadhana App: API contract v1

Written 2 Oct 2026, before any code; kept up to date with the live server (last updated 5 Oct 2026: `account.delete`). The frontend (a Svelte PWA on Cloudflare) and the backend (a Cloudflare Worker with a D1 database; the first Apps Script server was retired, design decision 7) are both built against this file. A change to the contract is made here first.

**Endpoint:** `POST https://sadhana-record-api.iyfdelhi-sadhana.workers.dev/` (body `text/plain`, JSON inside, so no CORS preflight). **77 actions** in total; the routing table is `worker/src/api.js` (`ROUTES`).

Companion documents: `sadhana-app-design.md` (decisions, data model §5, roles §4, accounts §3, IDs §3b).

---

## 0. Conventions

### One endpoint, named actions
Every call is an HTTPS `POST` to the API URL (the Cloudflare Worker since 2 Oct 2026; the Apps Script web app before).

- `Content-Type: text/plain;charset=utf-8` (no cross-site pre-check, so one round trip). The body is still JSON.
- The token goes in the body and every reply is HTTP 200 with `ok` true or false (kept from the Apps Script version so the app needs no change).

**Request**
```json
{
  "v": 1,
  "action": "week.saveDay",
  "token": "q2Xf…",
  "requestId": "6f1c0e8a-…",
  "app": "2026.10.02-1",
  "data": { }
}
```
| Field | Rule |
|---|---|
| `v` | Contract version. The server answers `UPGRADE_REQUIRED` if it no longer supports it; the PWA then reloads itself. |
| `action` | One of the actions below. Unknown → `BAD_REQUEST`. |
| `token` | Absent only on **public** actions. |
| `requestId` | Required on every action that writes, except `auth.login`, `auth.logout` and `auth.me`. A random UUID made by the app, reused only when retrying the same call. Repeating the same `requestId` returns the first successful answer and writes nothing again (kept 6 hours; for `week.submit`, kept for good in the submission row). |
| `app` | The frontend build, for the Run Log. |
| `data` | The action's input, described per action. Unknown fields → `BAD_REQUEST`. |

**Reply**
```json
{ "ok": true,  "data": { }, "serverTime": "2026-10-05T20:41:07+05:30" }
{ "ok": false, "error": { "code": "VALIDATION", "message": "Some answers are missing.",
                          "fields": [ { "path": "days.2026-09-30.hearingTopic", "message": "Tuesday → Hearing topic missing" } ] },
  "serverTime": "…" }
```
`message` is plain, user-facing English.

**Writes answer with what changed** (the updated row or object), so the app updates the screen from the reply and never reloads a whole list after a change. `fields` is present only for `VALIDATION` and `INCOMPLETE`.

### Formats
| Thing | Format |
|---|---|
| Phone | exactly 10 digits, first digit 6–9. The app strips spaces, `+91` and a leading `0` before sending. |
| Coordinator login | username, `^[a-z0-9._-]{3,30}$` (e.g. `sps`) |
| IYF ID | `^(GP|JN|KT)\d{2}-\d{4}$`, e.g. `KT26-0042`. **The format alone never makes an ID valid (§0, "IYF IDs").** |
| Date | `YYYY-MM-DD`, Indian time |
| Time of day | `HH:MM`, 24-hour, Indian time |
| `weekId` | the Monday of the week, `YYYY-MM-DD` (weeks run Monday to Sunday) |
| Minutes | whole numbers |
| Timestamps in replies | ISO 8601 with `+05:30` |

### Roles
`PUBLIC` (no token) · `DEVOTEE` · `COORDINATOR` (only the batches assigned to their account) · `MASTER` (everything).
The server works out the caller from the token alone. Nothing the page sends ("I am devotee X", "batch Y") is trusted; every `iyfId` or `batchId` in `data` is checked against the caller's scope.

### Devotees are identified by their login
Every action about a devotee names them by `login` (their 10-digit phone). Their IYF ID is a linked attribute: it may be blank for a new devotee until the dashboard's registry has allocated it (§6).

### IYF IDs: only allocated IDs are accepted
The Sadhana app never creates or changes IYF IDs and never writes to the dashboard. It only **reads** the dashboard's Devotees tab (§6). An IYF ID is accepted in any action only if **all** of these hold, checked on the server at the moment of use:
1. it matches the format,
2. it exists in the dashboard's Devotees tab (it was actually allocated there),
3. it is not marked "Merged into …" (the app then names the ID it was merged into),
4. for linking: no other account has it.

Devotees never type an IYF ID. Coordinators and the master choose IDs only from registry search results, and the server re-reads the registry before linking. A made-up ID in the right format is refused with `UNKNOWN_ID`.

### Error codes
| Code | Meaning | What the app does |
|---|---|---|
| `BAD_REQUEST` | malformed body, unknown action or field | shows "Something went wrong", logs it |
| `UPGRADE_REQUIRED` | the app is older than the server supports | reloads to the new version |
| `UNAUTHENTICATED` | no token, or it expired or was ended | goes to the login screen |
| `FORBIDDEN` | the role or batch does not allow this | shows the message |
| `NOT_FOUND` | the thing asked for does not exist | shows the message |
| `VALIDATION` | input broke a rule; see `fields` | marks each field |
| `INCOMPLETE` | Submit with something missing; see `fields` | lists "Tuesday → Sravan missing" |
| `BAD_CREDENTIALS` | wrong phone/username or password (never says which) | "Phone or password is wrong" |
| `LOCKED_OUT` | 5 wrong tries; `data.until` says when it opens | shows the time |
| `PENDING_APPROVAL` | right password, account not yet approved | "Waiting for your coordinator" |
| `REJECTED` | sign-up was rejected | shows the message |
| `ACCOUNT_DISABLED` | disabled by a coordinator or the master | shows the message |
| `MUST_CHANGE_PASSWORD` | coordinator's first login with a temporary password | opens Change password |
| `CONFLICT` | e.g. phone already has an account, ID already linked | shows the message |
| `UNKNOWN_ID` | the IYF ID was never allocated, or was merged | shows the message (and the "merged into" ID) |
| `ALREADY_SUBMITTED` | the week was already submitted | shows the submitted week |
| `WINDOW_CLOSED` | outside the week's open time | shows when it opens / that it closed |
| `FUTURE_DAY` | a day after today | — |
| `STALE` | the day was saved from another device; `data.current` holds it | "Updated on another device", reloads that day |
| `BUSY` | the server is busy, or too many attempts came from one network (per network: 200 logins in 10 min, 100 sign-ups or 30 reset requests an hour) | retries after 2 s, up to 3 times, same `requestId`; then shows the message |
| `INTERNAL` | anything else; logged in the Run Log | "Please try again" |

### Sessions
- `auth.login` returns a random 32-byte token. The server stores only its SHA-256 hash (Sessions tab, cached).
- Valid for 30 days from the **last** use. Logout, a password change, a reset, disable, inactive or delete end it.
- The PWA keeps the token in the browser's local storage. No third-party scripts are loaded, and a strict Content Security Policy is set on Cloudflare Pages.

---

## 1. Public actions

### `meta.get`
For the sign-up and login screens.
- **in** `{}`
- **out** `{ batches: [{ batchId: "SPS", name: "SPS", coordinatorName: "…", groupLeaders: ["Divyanshu Pr", …] }], facilitators: ["Natvar Gopinath Prabhuji", …], submitWindow: { opens: "SUN 18:00", closes: "MON 21:00" }, minApp }`. `facilitators` are the names the master has switched on (decision 39): the dashboard NameMap's canonical names plus any the master added, minus any switched off or deleted. Sign-up, the coordinator's approval and a devotee's edit all use this one list.

### `auth.signUp`

**Changed 3 Oct 2026 (decision 37):** also `classDay: "SUN" | "SAT"` (required), `email` (required; format, a common-misspelling check and a DNS lookup of the mail domain — VALIDATION on `email` otherwise; a DNS failure never blocks), `whatsapp` (optional 10-digit number). `groupLeader` is accepted from older apps and ignored.

**Changed 3 Oct 2026 (decision 41):** `profile.address` is **required** and valid by construction (4 Oct 2026): `{ line (house and street, 5–120), area (2–60), city, state, pin }` — India; `state` from the list of states and union territories; in Delhi `city` is one of its 11 districts, elsewhere the city typed; `pin` 6 digits of that state (its first two digits: Delhi 11, Haryana 12–13 …; `shared/places.js`, the same rules in the app and the server) — VALIDATION on `profile.address.line` etc. Devotees who signed up earlier add it in Account (`profile.update`).

- **in**
```json
{ "phone": "6000000310", "name": "Rahul Sharma", "batchId": "DPS", "password": "…",
  "facilitator": "Natvar Gopinath Prabhuji", "groupLeader": "Nitin Gupta pr",
  "profile": { "dob": "2003-08-14", "bloodGroup": "B+",
               "emergency": { "name": "…", "relation": "Father", "phone": "9…" },
               "address": { "line": "House 12, Gali 3", "area": "Punjabi Bagh", "city": "Delhi", "pin": "110026" } },
  "consentPhoto": false }
```
- **rules** `facilitator` required, one of `meta.get` facilitators; `groupLeader` optional, one of the batch's `groupLeaders` when given (decision 33); name 2–60 letters and spaces; password 8–64 characters, not a commonly used password, not the phone number; `bloodGroup` one of A+ A− B+ B− AB+ AB− O+ O− or "Don't know"; `dob` age 12–80; emergency phone 10 digits and not the devotee's own.
- **out** `{ status: "PENDING" }`
- **errors** `VALIDATION`, `CONFLICT` (this number already has an account: "Log in, or use Forgot password")
- No IYF ID is sent. The coordinator links one at approval (§3).
- The photo, if any, is uploaded after the first login (`photo.upload`).

### `auth.login`
- **in** `{ "login": "6000000310" | "sps", "password": "…", "device": "Android Chrome" }`
- **out** `{ token, expiresAt, user: { login, role, name, iyfId, batchIds: ["DPS"], mustChangePassword: false } }`. `batchIds`: a devotee's batch, a coordinator's batches, every batch for the master.
- **errors** `BAD_CREDENTIALS`, `LOCKED_OUT` (`data.until`), `PENDING_APPROVAL`, `REJECTED`, `ACCOUNT_DISABLED` (also for an inactive devotee, with its own message). The status errors are given only after the password is right.
- **Temporary password:** login succeeds with `mustChangePassword: true`. Until the password is changed, every action except `auth.changePassword`, `auth.logout` and `auth.me` answers `MUST_CHANGE_PASSWORD`.

### `auth.requestReset`
- **in** `{ "login": "6000000310", "newPassword": "…" }`
- **out** always `{ status: "RESET_REQUESTED" }`, even for an unknown number, so nobody can test which numbers have accounts.
- The old password keeps working until the coordinator (or, for a coordinator, the master) approves. On approval the new password takes over and every session ends.

---

## 2. Any signed-in user

| Action | in | out |
|---|---|---|
| `auth.me` | `{}` | `{ user (as in login), versions: { rules, journals }, today: "YYYY-MM-DD", openWeeks: [weekId] }` |
| `auth.logout` | `{}` | `{}` — ends this session |
| `auth.changePassword` | `{ current, new }` | `{}` — ends every other session. `BAD_CREDENTIALS`, `VALIDATION` |
| `account.delete` | `{ password, confirm }`, where `confirm` is the word `DELETE` (any case) | `{}`. The person's own account is deleted and every session ends. The account, profile, photo, drafts, comments, likes, push addresses and requests are deleted. Submitted weeks, attendance and missed weeks are kept under a random pseudonym (`deleted-…`, name "Deleted devotee", no IYF ID), so batch numbers don't change. Free-text reasons about the person are blanked, in the audit log too; the deletion's own audit entry doesn't say who it was. The Sheets copies follow within minutes (`erase.js`). Errors: `BUSY` (5 tries per 15 min), `FORBIDDEN` (coordinator, master or facilitator: the role is removed first), `BAD_CREDENTIALS`, `VALIDATION` (`confirm`). |

---

### The 9 PM reminder (decision 38)
| Action | in | out |
|---|---|---|
| `push.register` (public) | `{ endpoint, keys: { p256dh, auth } }` — a phone that allowed notifications with **nobody signed in**; keeps whoever is attached; 60 an hour per network | `{ on: true, time }` |
| `push.subscribe` | `{ endpoint, keys: { p256dh, auth } }` — from the browser's PushManager; attaches the signed-in person (any role; the reminder goes to devotees); at most 5 devices a person | `{ on: true, time }` |
| `push.detach` | `{ endpoint }` — at log-out: the phone keeps its notifications, without that person | `{ on: true }` |
| `push.unsubscribe` (public) | `{ endpoint }` — notifications off on this phone (knowing the push address is the proof) | `{ on: false }` |
| `push.message` (public) | `{ endpoint }` — asked by the phone's service worker when an EMPTY push arrives | `{ title, body, url: "/#/…", tag }` — what to show: the 9 PM reminder ("Today isn't filled yet" or "Today is filled ✓"; Sunday: "mark attendance and submit" or "Your week is submitted ✓"), a new announcement, an attendance notice, or a general reminder for signed-out phones |
| `push.renew` (public) | `{ oldEndpoint, endpoint, keys }` — sent by the service worker when the browser renews the phone's push address (`pushsubscriptionchange`); knowing the old address is the proof | `{ on: true, time }` — the row, with the person on it, moves to the new address (unknown old address: registered with nobody) |

Notifications are a default of the app (decision 38, the head 3 Oct): the permission is asked once, at the first tap after opening the app; the phone then registers itself, signed in or not, until switched off by hand. **Every day at 9 PM** every active devotee's phone gets the reminder, filled or not (the head, 3 Oct evening), and it pops up with a vibration even over an older one. Opening Account re-checks that the phone is attached to the person signed in.

### Announcements (decision 35; posts like social media, decision 44)
| Action | in | out |
|---|---|---|
| `announcements.list` | `{}` | `{ announcements: [ { id, title, body, audience: "ALL" \| [batchId \| "FAC_YOUTH" \| "FAC_TRD" \| "STU:<facilitator>"], pinned, expiresAt, publishAt, shownAt, scheduled, author, createdAt, updatedAt, canEdit, image: { w, h, v } \| null } ], latestAt, canPost }` — what the caller may see (everyone's posts, their batch's, the batches they coordinate, their facilitator's posts to students, their own posts; a master sees all), pinned first, newest shown first. A post not started yet (`scheduled: true`) is listed only for its author and the IYF head; `shownAt` is its start (or `createdAt`); `latestAt` ignores scheduled posts |
| `announcements.image` | `{ id }` — one post's picture, fetched only when it scrolls into view | `{ jpegBase64, v }` |
| `announcements.create` (master, coordinator, facilitator) | `{ title, body, audience: "ALL" \| [batchId] \| ["STUDENTS"], pinned?, expiresAt?, publishAt?, image?: base64 JPEG }` — a coordinator posts only to batches they coordinate; a facilitator only to `["STUDENTS"]` (stored as `STU:<their name>`: the devotees whose facilitator they are, any batch; Phase 9); `publishAt`: when it appears (absent, null or past = at once; at most 60 days ahead); `expiresAt`: after the start, at most 90 days after it; plain text (links in the body are shown as links); picture at most 1600 px a side and 240 KB | `{ announcement }` — queues a notification to the phones of its audience, sent at `publishAt` |
| `announcements.update` | `{ id, title?, body?, audience?, pinned?, expiresAt?, publishAt?, image?: base64 \| null }` — author or a master; `image: null` removes the picture; `publishAt` changes only while the post waits (`null` = "Post now"; a post already shown is refused) and its notification moves with it | `{ announcement }` — logged |
| `announcements.remove` | `{ id }` — author or a master | `{ removed: id }` — kept, hidden, logged |

`meta.get` gives `push: { publicKey, time }` (the VAPID public key) or `null` when reminders are off.

## 3. Devotee

**Posts (decision 44, 4 Oct 2026).** `announcements.list` adds `likes`, `liked`, `comments` to each post; `audience` is sent to staff only (`null` for a devotee). The WhatsApp share carries the link `<app>/#/wall?post=<id>`: a logged-in reader lands on that post (scrolled to and highlighted); a logged-out reader logs in first and then lands on it.

| Action | Who | in | out |
|---|---|---|---|
| `announcements.like` | anyone who sees the post | `{ id, like: true \| false }` | `{ likes, liked, comments }` — not copied to Sheets row by row (counts on Announcements, refreshed nightly) |
| `announcements.comments` | anyone who sees the post | `{ id }` | `{ comments: [ { id, name, body, at, mine, canRemove } ] }` (oldest first, ≤ 200) |
| `announcements.comment` | anyone who sees the post | `{ id, body }` (1–500 characters, plain text) | `{ comment, likes, liked, comments }` |
| `announcements.uncomment` | the writer, the post's author, the head | `{ commentId }` | `{ likes, liked, comments }` — kept with `removed_at`; audited when not one's own |

Share is a WhatsApp link made on the phone (nothing stored). A coordinator's post always goes to their own batches (no audience choice); the head chooses, and changes it when editing.

### `home.get`
Everything the home screen needs, in one call.
- **out**
```json
{ "profile": { "iyfId": "KT26-0042", "name": "…", "batchId": "DPS", "hasPhoto": true },
  "weeks": [ { "weekId": "2026-09-28", "status": "DRAFT", "canSubmit": true, "closesAt": "2026-10-05T21:00:00+05:30",
               "days": [ { "date": "2026-09-28", "state": "complete", "version": 3 } ],
               "weekEnd": { "state": "missing" }, "attendance": { "used": "P", "by": "COORDINATOR" } } ],
  "versions": { "rules": "r3", "journals": "j1" },
  "progress": { "lecturesHeard": 37, "lecturesInLevel": 324, "currentBook": { "bookId": "B23", "estimate": "≈ 40% · about 3 weeks left" } } }
```
- `weeks` holds only the open weeks (1, or 2 on Monday before 9 PM). `state` is `empty`, `partial` or `complete`. Week `status`: `NOT_STARTED`, `DRAFT`, `SUBMITTED`, `MISSED`, `REOPENED`.

### `week.get`
- **in** `{ weekId }` — an open week, or any past week of the caller (read-only)
- **out** `{ weekId, status, days: [ Day + version + marks ], weekEnd: { version, nightStay, principles, opensAt, open, state }, attendance: { devotee, leader, coordinator, master, used, by, notice, locked, classWeek, opensAt }, scores (when submitted) }`
- `attendance.by`: who gave the mark that counts — `master` · `coordinator` · `leader` · `class` (a no-class week) · `devotee`. `attendance.notice`: when a higher mark that differs from the devotee's own was given (the app shows a note; the phone also gets one notification), `null` once they agree.
- A **submitted** week's `days` and `marks` are read from the stored compact week JSON (decision 42); weeks submitted before it from the old `days_json` / `marks_json`. The reply has the same shape either way.

### The `Day` object
| Field | Type | Required | Rule |
|---|---|---|---|
| `sleptAt` | time | yes | the previous night's sleep time |
| `wokeAt` | time | yes | |
| `rounds` | int | yes | 0–64 |
| `chantingDoneAt` | time | yes | when chanting was finished |
| `chantingSameDay` | bool | yes | No → Japa takes the card's last range |
| `dayRestMin` | int | yes | 0–600 |
| `hearingMin` | int | yes | 0–600 |
| `hearing` | `[{ lectureId } \| { text }]` | when `hearingMin` > 0 | at least one; `lectureId` from the caller's level list, `text` 2–120 characters |
| `readingMin` | int | yes | 0–600 |
| `reading` | `{ bookId } \| { text }` | when `readingMin` > 0 | `bookId` from the book list (any level), `text` 2–120 |
| `serviceMin` | int | yes | 0–999 |
| `serviceTopic` | text | no | ≤ 120 |
| `exerciseMin` | int | no | 0–600 |
| `studyJobHrs` | number | no | 0–24, steps of 0.5 |
| `chetnaPositive`, `chetnaNegative` | `[string]` | no | from the option lists in Rules |
| `comment` | text | no | ≤ 500 |

### `week.saveDay`
Sent by the app a few seconds after typing stops. Partial days are allowed; completeness is checked at Submit.
- **in** `{ weekId, date, version, day: { …only the fields to set… } }`
- **out** `{ version, state, missing: ["hearingTopic"], marks: { toBed: { range: "10:00–10:15 PM", marks: 25 }, … } }` — marks are a live preview from the level's card
- **errors** `WINDOW_CLOSED`, `FUTURE_DAY`, `STALE` (`data.current` = the server's copy), `ALREADY_SUBMITTED`, `VALIDATION`

### `week.saveWeekEnd`
- **in** `{ weekId, version, nightStay: "YES" | "NO", principles: "YES" | "NO" }`
- **out** `{ version, chantingAverage: 16.3 }` — the chanting average is worked out from the daily rounds, never typed
- **errors** `FUTURE_DAY` before **Saturday 18:00 IST** of the week (decision 41: "Night Stay and the 4 regulative principles open on Saturday at 6 PM."), `STALE`, `WINDOW_CLOSED`

### `week.setAttendance` (devotee's own mark)
- **in** `{ weekId, mark: "P" | "A" }`
- **out** `{ devotee: "P", leader: null, coordinator: null, master: null, used: "P", by: "devotee", notice: null }` — the lowest level: any higher mark wins whenever set
- **errors** `FUTURE_DAY` before **Sunday 00:00 IST** (one Sunday class for everyone, Saturday-class devotees too), `CONFLICT` in a no-class week, `WINDOW_CLOSED` after Monday 9 PM

### `week.submit`
- **in** `{ weekId }`
- **checks** valid session · ACTIVE devotee · inside the submit window (Sun 6 PM – Mon 9 PM) · not already submitted (under the lock) · **at least one complete day** · week-end answered · attendance marked · every value allowed for the devotee's level
- **Part weeks (4 Oct 2026, decision 45):** only the complete days count; a day not complete is left out and adds 0 marks, so each daily category is the week's marks ÷ 175 and the week is capped by its days (1 perfect day ≈ 14%, 5 ≈ 71%, 7 = 100%). Attendance and Seva stay weekly, as in the sheets.
- **out** `{ submittedAt, daysFilled: 1–7, scores: { bed, wakeUp, daySleep, japa, pathan, sravan, seva, attendance, body, soul, overall, morning? } }`
  — `morning` (the Morning program, 0–100) only on the TRD card (Phase 22, migration 0065). On that card Overall = the
  week's day marks ÷ (7 × 205) × 100, each other column = that item's week marks ÷ (7 × its maximum) × 100, and
  `attendance` is recorded but not scored: a later mark never changes a TRD Overall.
- **errors** `INCOMPLETE` (`fields`: `days` "Fill at least one whole day", `weekEnd.nightStay`, `weekEnd.principles`, `attendance`), `ALREADY_SUBMITTED`, `WINDOW_CLOSED`, `BUSY`
- After this the week can never be changed by the devotee.

### `history.list`
- **in** `{ before?: weekId, limit?: 1–26 (default 8) }`
- **out** `{ weeks: [ { weekId, status: "SUBMITTED" | "MISSED", overall, body, soul, attendance, seva, daysFilled } ], more: true }`. A MISSED week scores **0** (all five numbers 0); `daysFilled` is the days it counted (submitted) or had begun (missed).

### Profile and photo
| Action | in | out |
|---|---|---|
| `profile.get` | `{}` | `{ email, whatsapp, classDay, dob, bloodGroup, emergency: { name, relation, phone } \| null, address: { line, area, city, state, pin } \| null, readingPagesPerHour, hasPhoto, photoUpdatedAt }` |
| `profile.update` | any of `{ name, dob, bloodGroup, emergency, address, classDay, readingPagesPerHour, email, whatsapp }` (`name`: one's own, any role, letters and spaces, audited as `profile.rename`; `classDay`: `SUN` or `SAT`, sets the current batch membership's class day, audited as `profile.classDay`; before approval it changes the requested class day) (same checks as sign-up; pages 1–200). Contact details (email, WhatsApp, address, emergency contact) are changed **only by the devotee**; coordinators and the head see them (`devotees.get › profile.address`) | as `profile.get` |
| `photo.upload` | `{ jpegBase64 }` — JPEG only, 64–400 px each side, at most 150 KB; the server reads the size from the JPEG header (the app crops and shrinks any photo first) | `{ hasPhoto: true, photoUpdatedAt }` — kept in D1 (`photos`), never copied to Sheets |
| `photo.get` | `{ login? }` — own photo; coordinators their batch; master anyone | `{ jpegBase64, updatedAt }` or `NOT_FOUND` |
| `photo.remove` | `{ login?, reason? }` — own; coordinator / master with a reason (logged) | `{ hasPhoto: false }` |

### Lists (cached on the phone by version)
| Action | in | out |
|---|---|---|
| `rules.get` | `{ have?: "r1" }` | `{ notModified: true, version }` or `{ version, cardName, cards: { [cardName]: { to_bed: [ { label, marks, from, to } ], wake_up, day_sleep: [ { label, marks, min, max } ], japa, pathan, sravan, seva } }, chetnaOptions: { positive: [], negative: [] } }`. A devotee gets their batch's card (`SPS`, `BVS/DPS/BSS` or, for the temple residents, `TRD`: `{ kind: 'linear', items, dayMax: 205, <item>: { label, field \| fields, full, zero, marks, clock?, night?, sameDay?, unit?, answers? } }`, COSATOK's TRD scheme — marks slide between `full` and `zero`; a TRD day's marks are `{ label, marks, of }`); staff get the cards of their batches |
| `journals.get` | `{ have?: "j3" }` | `{ notModified: true, version }` or `{ version, journals: ["SPS/DPS"], lectures: [ { lectureId: "SD-W001-SPL", journal, week, slot, title, audioUrl, inFolder? } ], books: [ { bookId, title, titleHi?, chaptersHi?, level, words, language, files: [ { label, url, lang? } ] } ], ownBookLevel: "SPS/DPS", bookLink, bookNote, heard: [lectureId] }`. **English and Hindi sections (19 Oct 2026, migration 0058):** a file with `lang: "hi"` is a Hindi PDF; every other file is English, so a book with no Hindi edition keeps exactly its old shape. A book with a Hindi edition carries `titleHi` (shown in the Hindi section, with the English title under it); a Śrīmad-Bhāgavatam canto carries `chaptersHi`, the number of its chapters, whose PDFs come from `books.chapters`. Reading shows English (every book, as before) or हिन्दी (only books with a Hindi PDF), kept in the address (`bl=hi`) and on the phone. Mapping: `setup/build-hindi-books-sql.mjs` from the head's Drive folder, listed with every subfolder by `setup/list-drive-folder.mjs`. A devotee gets only their batch's journal (SPS/DPS, BSS or BVS); names are batch names, never "Level 4/5". `audioUrl` is the lecture's own Drive file (matched read-only from its folder by `setup/match-lectures.mjs`), or the folder with `inFolder: true` when no single file matches, or blank; `files` are the book's own PDF(s) (`setup/match-books.py`; several for multi-volume books, none when the PDF is not in the IYF folder). The app opens these links; it never builds a Drive link itself |
| `books.chapters` | `{ bookId: "B68", lang: "hi" }` | `{ bookId, lang, chapters: [ { part: "Part 1", label: "1. Bhagavan Sri Krishna ka Avatar", url } ] }` — one book's chapter PDFs in one language, in order (Contents and Introduction first; Canto 10 grouped by its four parts). Any signed-in person. Read only when somebody opens a canto's chapters, by key, so the 349 Hindi chapter rows are never part of `journals.get`. `VALIDATION` for a language other than `en`/`hi`; `NOT_FOUND` for an unknown book; a book with none gives `chapters: []` |

---

## 4. Coordinator (own batches only)

### Sign-ups and resets
| Action | in | out |
|---|---|---|
| `requests.list` | `{ batchId? }` | `{ signUps: [ { phone, name, batchId, at, facilitator, classDay, email, whatsapp, profile, matches: [ { iyfId, name, level, facilitator, phoneEnd: "…3210", why: "phone + name", linked: false } ] } ], resets: [ { login, name, role, at } ] }` — `matches` use the registry's own matching rules (phone + spelling-proof name), read from the Devotees tab |
| `registry.search` | `{ q }` — name, IYF ID or phone, at least 3 characters | `{ results: [ { iyfId, name, level, facilitator, phoneEnd, linked: false, mergedInto: null } ] }` — at most 20, read from the Devotees tab |
| `requests.approve` | `{ phone, link: { iyfId } \| { noIdYet: true }, levelEntryDate, facilitator?, classDay? }` — facilitator and class day default to the devotee's choices; facilitator must be a listed one, class day SUN or SAT (`groupLeader` from older apps is ignored) | `{ iyfId: "KT26-0042" \| null, linked: true \| false }` |
| `requests.reject` | `{ phone, reason }` | `{}` |
| `resets.approve` / `resets.reject` | `{ login }` | `{}` |

`requests.approve` rules:
- `{ iyfId }`: must pass all four ID checks (§0). The account becomes ACTIVE, linked to that ID.
- `{ noIdYet: true }`: for someone the registry does not know yet. The account becomes ACTIVE with no IYF ID. The dashboard's own hourly registration allocates the ID once the devotee's first submitted week reaches Raw, and the nightly link job (§7) links it.
- One account per IYF ID and one per phone; `CONFLICT` otherwise.

### Devotees
A coordinator changes (status, disable, facilitator / class day, photo removal) and decides password resets only for plain devotees of their batches. A person who also coordinates a batch or is the IYF head can be viewed but only a master changes them (`FORBIDDEN`), and their reset requests go to a master (security review, 3 Oct 2026).

| Action | in | out |
|---|---|---|
| `devotees.list` | `{ batchId, status?: "ACTIVE" \| "INACTIVE" \| "DISABLED", weekId? }` (default: last week until its Monday 9 PM deadline, then this week) | `{ weekId, closesAt, attendanceOpen, rows: [ { login, name, iyfId, batchId, accountStatus, membership, facilitator, groupLeader, hasPhoto, status: "SUBMITTED" \| "DRAFT" \| "REOPENED" \| "NOT_STARTED" \| "MISSED", daysFilled, days: [7 × "complete" \| "partial" \| "empty"], submittedAt, byCoordinator, overall, attendance: { devotee, coordinator, used, locked } } ] }` |
| `devotees.get` | `{ login }` | `{ login, name, iyfId, status, batchId, facilitator, groupLeader, since, levelEntryDate, hasPhoto, profile: { dob, age, bloodGroup, emergency } \| null, memberships: [...], lastWeeks: [ { weekId, status, overall, byCoordinator } ] }` |
| `devotees.setActive` | `{ login, active: true \| false, fromWeek? }` — this week (default), next week, or last week until its deadline | `{ status, fromWeek }` — inactive (Phase 22 I2, the head 26 Oct 2026) changes the open MEMBERSHIP only: the account stays ACTIVE, the login and its sessions keep working, they drop off every count from that week, and a filled day or submitted week makes them active again by itself (using the app does not undo a person's mark; it clears the app's own flag `accounts.auto_inactive`); each change writes an `activity_events` row (MANUAL). Reactivating opens a new membership (same batch, facilitator, group leader), no new approval. Either makes an account left INACTIVE by the old rule ACTIVE again. Staff, facilitator or head accounts: the head only. Blocking the login is `devotees.setDisabled` (enabling returns the login to ACTIVE; an inactive membership stays) |
| `activity.notices` | `{}` — STAFF; a coordinator's class batches, the head all of IYF Delhi | `{ since, events: [ { id, login, name, batchId, day, change: "INACTIVE" \| "ACTIVE", how: "AUTO" \| "MANUAL" \| "FILLED" \| "APP", at, by } ] }` — the last 14 days, newest first, at most 60 (Home's notices and the bell; ADR 0020, migration 0071) |
| `activity.stats` | `{ batchId?, month? ("2026-11", default this month) }` — STAFF, the same scope; a batch not theirs is FORBIDDEN | `{ month, batches: [ { batchId, name, level, active, inactive } ], totals: { active, inactive }, months: [12 × { month, inactive, active, auto, manual, filled, app }], days: [ { day, inactive, active } ] }` — now (open memberships: active = ACTIVE membership and ACTIVE account), the last 12 months, and every day of `month` up to today. The automatic rule: the daily job (00:13 IST) makes inactive an ACTIVE devotee whose open membership began 30+ days ago and who for 30 days saved no day (draft, submission, or a part week with days) AND used no app (no sign-in, no signed-in call); nothing before `settings.tracking_from`. Using the app brings back only those the app made inactive; a filled day anyone. The Phase 22 `inactive.list` / `inactive.decide` are removed |
| `devotees.setDisabled` | `{ login, disabled: true \| false }` | `{ status }` — disable ends sessions; enable needs no new approval |
| `devotees.delete` | `{ login, confirmPhone }`; `confirmPhone` must be typed again | `{}`. Exactly what `account.delete` does (5 Oct 2026): weeks are kept anonymised, not under the phone. A coordinator or master account is refused (the role is removed first). |
| `devotees.setPeople` | `{ login, facilitator?, classDay? }` — facilitator from the switched-on list (decisions 33, 39; a devotee's current name is kept even if switched off), class day SUN or SAT | `{ facilitator, classDay }` — logged |
| `members.list` | `{ batchId?, status?: "ALL" \| "ACTIVE" \| "INACTIVE" \| "DISABLED", classDay?: "SUN" \| "SAT", bloodGroup? (one of the blood groups, "Don't know" included), q? (name, phone or IYF ID), sort?: "name" \| "inactive" \| "lastSubmitted", offset?, limit? (1–200, default 50) }` — the caller's batches (a master: every batch) | `{ rows: [ { login, name, iyfId, status, batchId, batchName, inactiveSince, since, classDay, facilitator, whatsapp, email, hasPhoto, bloodGroup, lastSubmitted, weeksSubmitted, lastLogin } ], total, counts: { ACTIVE, INACTIVE, DISABLED } }` — the Members tab (coordinator) and All devotees (master), paged on the server |

### Attendance
- `attendance.set` **in** `{ batchId, weekId, marks: [ { login, mark: "P" | "A" | null } ] }` → `{ saved: n }`. 1 to 300 marks a call (`VALIDATION` beyond that; the app sends a bigger batch in parts of 250); `null` clears the coordinator's mark (the group leader's or the devotee's own is used again). Only devotees of that batch that week. Allowed from **Sunday 00:00 IST** (one class for everyone, decision 41) until its Monday 9 PM deadline, for active devotees only, even after the devotee submitted; after it `WINDOW_CLOSED` (the master uses `attendance.override`). The coordinator's mark wins over the group leader's and the devotee's own; the IYF head's (`attendance.override`) over all; the bridge and the view sheets read the attendance table, so a later mark counts even for a week already submitted.
- `weeks.setClass` **in** `{ batchId, weekId, kind: "HOLIDAY" | "FESTIVAL" | "OTHER" | "REGULAR", note?, everyonePresent?, reason? }` → `{ weekId, classWeek: { kind, note, everyonePresent, by, at } | null }`. A week with **no regular class** (decision 36): `everyonePresent: true` → everyone in the batch is Present; `false` → only those the coordinator marks Present count (e.g. who came to the festival), everyone else Absent, and devotees' own marks are ignored. A coordinator's mark for one person still wins. `REGULAR` removes the setting. The batch coordinator until the week's deadline; the master any time (after the deadline with a `reason`). Up to two weeks ahead. While set, `week.setAttendance` answers `CONFLICT` and Submit does not need the devotee's mark; `home.get` / `week.get` / `devotees.list` show `classWeek`.
- **Which mark counts (decision 41):** the IYF head's › the coordinator's › the group leader's › the no-class week's setting › the devotee's own. Each level writes only its own column (`master_mark`, `coordinator_mark`, `leader_mark`, `devotee_mark`), so a lower level never overwrites a higher one; `mark_used` is worked out on every write. A group leader's own attendance is marked by the coordinator. Submitted rows keep the scores worked out at submit and are never changed; the app, the view sheets and the bridge show Attendance and Overall with the final mark.

### Group leaders (decision 41, 3 Oct 2026)
A **group leader** is a student devotee of a batch appointed by its coordinator (or the IYF head). Each leads one group drawn from every batch of the same level (`batches.level`: SPS, SPS Group 2 and SPS Online are one pool; the head, 3 Oct 2026), only from the batches the caller manages; a devotee is in at most one group (`memberships.leader_login`); a leader is in no group. A member's attendance stays under the member's own batch. `user.scopes.groupLeader: { batchId } | null`.

| Action | Who | in | out |
|---|---|---|---|
| `group.list` | the leader | `{ weekId? }` (default: the focus week) | `{ weekId, batchId, closesAt, attendanceOpensAt, attendanceOpen, classWeek, members: [ { login, name, iyfId, phone, whatsapp, hasPhoto, active, status, daysFilled, days, submittedAt, overall, attendance } ] }` — phone and WhatsApp for the call links next to each name |
| `group.mark` | the leader | `{ weekId, marks: [ { login, mark: "P" \| "A" \| null } ] }` (1–300; own group's active members only) | `{ saved }` — Sunday 00:00 IST until Monday 9 PM (`FUTURE_DAY` / `WINDOW_CLOSED`) |
| `leaders.list` | coordinator (own batch), head (any) | `{ batchId }` | `{ batchId, weekId, batches: [ { batchId, name } ] (the level's batches the caller manages), groups: [ { leader: { login, name, phone, whatsapp, hasPhoto, attendance }, appointedBy, appointedAt, members: [ … as group.list ] } ], unassigned: [ … ] }` — as the groups are now |
| `leaders.set` | coordinator, head | `{ login, leader: true \| false, reason? }` | `{ login, leader, batchId? }` — appointing takes the person out of any group; removing leaves the group's members in no group. Audited |
| `leaders.assign` | coordinator, head | `{ leader: login \| "", logins: [ … ] }` (1–300; batches of the leader's level that the caller manages; not leaders) | `{ leader, moved }` — `""` takes them out of any group. Audited |

### Viewing a devotee's sadhana, and facilitator logins (decision 43, 4 Oct 2026)
**Viewing** a devotee's sadhana and **filling** it for them are two permissions. A facilitator views only; a coordinator views and fills the week being filled now (their batches); the IYF head views and fills any week.

| Action | Who | in | out |
|---|---|---|---|
| `devotees.week` | coordinator (own batches, the open week only), head (any week) | `{ login, weekId }` | read-only week: a submitted week `{ status: "SUBMITTED", days, marks, weekEnd, scores }`; else `{ status, days: [ { state } ] }` or `{ status: "MISSED", daysFilled, overall: 0 }`; a submitted part week also carries `daysFilled`, and its days left out are `{}` |
| `facLogins.list` / `.create` / `.setDisabled` / `.resetPassword` | head | `{}` / `{ username, facilitator, tempPassword }` / `{ username, disabled }` / `{ username, tempPassword }` | `{ logins }` / `{ login: { username, facilitator, name, status, mustChangePassword } }` — one login per facilitator of the list; a staff login (role COORDINATOR) with **no batches** and `accounts.facilitator_name`; never shown among coordinators; audited |
| `fac.devotees` | facilitator | `{ weekId? }` | `{ weekId, closesAt, rows: [ { login, name, phone, whatsapp, batchName, status, daysFilled, days, overall } ] }` — every devotee whose membership has this facilitator, any batch |
| `fac.devotee` | facilitator | `{ login }` | `{ login, name, phone, whatsapp, batchName, weeks: [ { weekId, status, overall, … } ] }` |
| `fac.week` | facilitator | `{ login, weekId }` | as `devotees.week` |

`user.scopes.facilitator: { name } | null`. A facilitator cannot fill, mark attendance or use the batch tools.

### Share sadhana (27 Oct 2026, migration 0070, `worker/src/shares.js`)
A devotee's sadhana is seen by their facilitator by default — **derived** from the open membership's `facilitator`, never
stored, so a change of facilitator moves it at once. The devotee may also share it, by phone, with any active devotee of
the app. No acceptance step: the share is one row `sadhana_shares (id, owner, viewer, created_at)`, and every viewer call
checks that row on that call, so removing or leaving takes effect at once. The viewer reads what the facilitator's student
page shows, **without contact**: no phone, WhatsApp, email, address or birthday, and **never the owner's login** (it is
their phone) — the viewer's side works by the share's random `id` (10 url-safe characters, the first a letter). Staff get
nothing extra: a coordinator or the head reads a share only if one was made to them. Routes: `#/share`,
`#/share/with-me`, `#/shared/<id>`, `#/shared/<id>/<weekId>`.

| Action | Who | in | out |
|---|---|---|---|
| `share.list` | devotee (own form) | `{}` | `{ facilitator: { name } \| null, sharedWith: [ { login, name, since } ], sharedWithMe: [ { id, name, batchName, since } ], limit: 20 }` — `sharedWith` names are masked ("Sunil K."); one read round trip |
| `share.lookup` | devotee | `{ phone }` | `{ name: "Sunil K." }` (first name, last initial); else VALIDATION on `phone`: own number · "No active devotee in the app has this number." (unknown, pending, disabled or staff alike) · "X is your facilitator and already sees your sadhana." · "Already shared with X." · "You can share with at most 20 people. Remove someone first." BUSY after 30 lookups/adds an hour |
| `share.add` ✎ | devotee | `{ phone }` | `{ shared: { login, name, since } }` — the same checks as lookup; audited `share.add` |
| `share.remove` ✎ | devotee (the owner) | `{ login }` (the viewer's, from `sharedWith`) | `{ ok: true }`; NOT_FOUND when not shared (the facilitator is not a share and cannot be removed); audited |
| `share.leave` ✎ | anyone signed in (the viewer) | `{ id }` | `{ ok: true }`; NOT_FOUND unless the share is the caller's; audited |
| `share.devotee` | anyone signed in (the viewer) | `{ id }` | as `fac.devotee` without `login`, `phone`, `whatsapp`: `{ name, iyfId, batchId, batchName, active, since, weeks }`; FORBIDDEN unless the share is the caller's now |
| `share.week` | anyone signed in (the viewer) | `{ id, weekId }` | as `fac.week`; FORBIDDEN unless the share is the caller's now |

Deleting an account deletes its shares both ways.

### On someone's behalf
`week.saveDay`, `week.saveWeekEnd` and `week.submit` accept `onBehalfOf: login` from a coordinator of that devotee's batch. The row is marked "submitted by coordinator". The same window and checks apply.

### Reopen request
- `reopen.request` **in** `{ login, weekId, reason }` → `{}`. Only for a MISSED week. Only the master reopens: `reopen.list {}` → `{ requests: [ { login, name, weekId, batchId, reason, by, at } ] }`; `weeks.reopen` marks the request done; `reopen.reject { login, weekId, reason }` → `{}`.

### Views
| Action | in | out |
|---|---|---|
| `stats.batch` | `{ batchId, weeks?: 1–26 (default 12) }` | `{ weekId, thisWeek: { expected, submitted, draft, notStarted, missed, byDay: [7 counts] }, trend: [ { weekId, expected, submitted, missed, filledPct } ], people: { active, inactive, disabled, pending }, missedLog: [ { login, name, weekId, daysFilled } ] }` |
| `birthdays.today` | `{}` | `{ today: [ { login, name, batchId, date, age } ], upcoming: [ …the next 7 days ] }` for the caller's batches (every batch for a master); active devotees only |

---

## 5. Master

Everything a coordinator can do, for every batch, plus:

### Coordinators
| Action | in | out |
|---|---|---|
| `admin.lists` | `{}` | `{ coordinators: [ …as coordinators.list ], batches: [ …as batches.list ] }` — both lists in one call; the admin screens use this |
| `coordinators.list` | `{}` | `[ { username, name, phone, batchIds, status, mustChangePassword, lastLogin } ]` |
| `coordinators.create` | `{ username, name, phone?, batchIds, tempPassword }` | `{ coordinator }` (a list row) — the coordinator must change it at first login |
| `coordinators.update` | `{ username, name?, phone?, batchIds? }` | `{ coordinator }` — `batchIds` is the full new set; moving a batch ends the old coordinator's access to it at once |
| `coordinators.setDisabled` | `{ username, disabled }` | `{ coordinator }` |
| `coordinators.resetPassword` | `{ username, tempPassword }` | `{ coordinator }` — ends their sessions; must change at next login |
| `masters.set` | `{ login, master: true \| false, reason }` — give or remove the master scope (any approved person) | `{ coordinator }` — removing it ends their sessions; the recovery login `master` always stays a master, and there is always at least one; logged |

### Facilitators (decision 39)
| Action | in | out |
|---|---|---|
| `facilitators.list` | `{}` | `{ facilitators: [ { name, active, source: "DASHBOARD" \| "APP", inDashboard, members, waiting, changedBy, changedAt } ], counts: { on, off } }` — `members`: devotees whose current membership has the name; `waiting`: sign-ups that chose it |
| `facilitators.add` | `{ name }` | the row — letters, spaces, dots, apostrophes, 3–60; no second copy in any case (VALIDATION); a deleted name comes back switched on; logged |
| `facilitators.setActive` | `{ name, active }` | the row — off: no longer offered or accepted at sign-up, approval or a devotee's edit (a devotee's current name is kept when other details change); logged |
| `facilitators.delete` | `{ name, reason? }` | `{ name, deleted: true }` — only a switched-off name (CONFLICT otherwise); kept as a deleted row so the nightly NameMap read never brings it back; devotees keep it on their record; logged |

### Batches and settings
| Action | in | out |
|---|---|---|
| `batches.list` | `{}` | `[ { batchId, name, level, active, pilot, standing, coordinatorLogins: ["sps"], coordinatorNames: ["…"] } ]` |
| `batches.update` | `{ batchId, name?, active?, pilot?, coordinatorLogins?: [username], startedOn?, endsOn? }` | the batch — the same assignment `coordinators.update` makes, seen from the batch. `startedOn` / `endsOn` (Phase 22, J1): a **training** batch only, while it runs (`CONFLICT` once ended: its dates are a record); start today or earlier, end after the start |
| `batchReq.create` | `{ level: 'VL2'\|'VL3'\|'ETP', startsOn, endsOn?, note? }` | STAFF. A coordinator asks the head to start a numbered intake or a training (Phase 23, migration 0072): start today or later; `endsOn` for a training only, after the start; one WAITING request per level per person (`CONFLICT`). → the request `{ id, level, levelName, startsOn, endsOn, note, by, byName, at, state, stateName, decidedBy, decidedByName, decidedAt, decisionNote, batchId, batchName, mine }` |
| `batchReq.list` | `{}` | STAFF. `{ requests: [request], waiting }` — a coordinator: their own (any state, newest first); the head: every WAITING one (oldest first) then the latest 20 decided |
| `batchReq.withdraw` | `{ id }` | STAFF. The requester, while WAITING → WITHDRAWN (somebody else's: `NOT_FOUND`; decided: `CONFLICT`) |
| `batchReq.decide` | `{ id, decision: 'decline', note }` | MASTER. DECLINED with the head's note. **Approving is creating the batch:** `batches.create { …, coordinatorLogins?, fromRequest: id }` — the same rules as any new batch; the request becomes STARTED (with `batchId`) in the same write. A future start is refused by `batches.create`: the batch is created on its day |
| (training rows) | | `batches.list` / `batches.create` / `batches.update` add `endsOn` and `status: RUNNING \| PAST_END \| ENDED` to a training batch (ENDED = closed by Close batch; PAST_END = after `endsOn`, not ended — nothing ends by itself). `batches.create` requires `endsOn` for a new training; meta's `staffBatches` carries `startedOn`, `endsOn`, `status` for a training. A trainee's card window ends at the earlier of `endsOn` and the phase's end (or the day the training was ended) |
| `settings.get` / `settings.update` | `{ submitWindow?: { opens: "SUN 18:00", closes: "MON 21:00" }, trackingFrom?: Monday or "", reminderTime?: "18:00"–"22:59" }` | `{ submitWindow, trackingFrom, reminderTime, registryRefresh, pushDevices }` — logged. `trackingFrom` is the pilot's first week: from then on a week not submitted by its deadline is marked missed |

### IYF IDs
| Action | in | out |
|---|---|---|
| `ids.search` | `{ q }` | as `registry.search`, plus `linkedAccount: { login, name } \| null` |
| `ids.get` | `{ iyfId }` | registry row, its phones (from the aliases), `linkedAccount`, batch history |
| `ids.link` | `{ login, iyfId, reason }` | `{}` — four ID checks apply; replaces any earlier link |
| `ids.unlink` | `{ login, reason }` | `{}` — the account stays usable with no IYF ID until linked again |
| `ids.possibleDuplicates` | `{ showReviewed? }` | `{ groups: [ { why: "same phone" \| "same name", ids: [ registry row + `linkedAccount` ] } ], total }` — IDs (not merged) sharing a phone, or the same whole name spelling-proof (honorifics such as "Das" kept). For review only. Merging stays in the dashboard (the app never writes the registry); a merged ID shows "Merged into X" here once the dashboard marks it |
| `ids.reviewDuplicate` | `{ ids: [iyfId, …], decision: "NOT_DUPLICATE" \| "UNDO", why, reason? }` | `{ key, decision }` — "Not duplicates" hides the group from the review list (shown again with `showReviewed`); `UNDO` brings it back; logged. The list also returns `reviewedCount` |

### Weeks and attendance after the deadline
| Action | in | out |
|---|---|---|
| `weeks.reopen` | `{ login, weekId, reason, openUntil }` — `openUntil` within the next 14 days | `{ openUntil }` — only a MISSED week (a submitted week is never changed) of an active devotee. It becomes REOPENED and empty; the devotee (or their coordinator) fills it again from scratch and submits before `openUntil`; logged |
| `attendance.override` | `{ login, weekId, mark: "P" \| "A" \| null, reason }` | `{ devotee, coordinator, used }` — any week, even locked; logged with the reason |

### Oversight
| Action | in | out |
|---|---|---|
| `stats.all` | `{ weeks?: 1–26 (default 8) }` | `{ batches: [ { batchId, name, weekId, thisWeek, people, trend: [ { weekId, filledPct, missed } ], missed } ], totals: { expected, submitted, draft, notStarted, missed, active, pending } }` |
| `audit.list` | `{ who?, what? (action prefix), target?, from?, to? (YYYY-MM-DD), before? (id), limit? (≤ 200, default 50) }` | `{ rows: [ { id, at, who, role, action, target, batchId, before, after, reason } ], more }`, newest first |
| `runlog.list` | `{ limit? }` | `{ rows: [ { at, action, ms, ok, errorCode, detail, app } ] }` — only slow (> 1.5 s) or failed calls are logged |

---

## 6. The IYF ID registry (read-only)

The registry is the dashboard's **Devotees** tab (spreadsheet `165UBdHjeNfcQjCZ8dXbM9vfOJhBj0d19odmLg6rNGZA`). The dashboard project is not changed in any way.

- A scheduled job reads columns A–Q (IYF ID, name, phone, level, facilitator, status, alias table P:Q) every 30 minutes through the Sheets API, as the service account `iyf-delhi@sadhanareport.iam.gserviceaccount.com` (needs **Viewer** access on that spreadsheet), into a `registry` table in D1. Lookups and searches read that table: instant.
- Linking re-reads the dashboard only when the chosen ID is missing from the copy (a very new ID).
- It never writes there. New IDs come only from the dashboard's own hourly registration, when a devotee's first submitted week reaches Raw through the bridge.
- Matching uses the same rules as the registry (normalised phone + spelling-proof first name; same phone with a shared name part), copied and tested against the dashboard's own code.

**No second ID, ever:**
- Weeks of a linked devotee are copied into the sadhana sheet with **the registry's own name and phone for that ID**, so the hourly registration always recognises them.
- Weeks of a devotee with no ID yet are copied with their sign-up name and phone; the registry allocates once, and the nightly link job links that ID (by the same alias key) the next night.
- One account per IYF ID: a link to an ID that another account has is refused.

## 7. Scheduled jobs (no caller)

| Job | When | Does |
|---|---|---|
| Deadline | Monday 21:00 IST (runs 21:00 onwards, up to 25 automatic submissions and 100 devotees a minute) | an unsubmitted week **with at least one complete day is submitted as it stands** (`submitted_by` DEADLINE, week-end answers and attendance as far as given: blank / 0), AuditLog `week.autoSubmitted`; a week with **no complete day** → MISSED (score 0), draft deleted, AuditLog `week.dropped` (devotee, week, days begun); then attendance locks |
| Bridge | nightly | submitted weeks → current sadhana-sheet columns (Night Stay "Yes" → "Yes Coming") |
| View sheets | any minute with nothing left to copy to Sheets; one small step a run (`src/views.js`, migration 0020) | the four batch view spreadsheets kept step by step (decision 40): a new submission inserted as one row at its place (newest week first, names A–Z; Days: 7 rows); a week's Scores rows rewritten when its attendance changes; This week rewritten row by row where it changed, at most every 10 minutes; weeks older than 12 (Days: 4) removed once a week. What changed is flagged by triggers (`view_dirty`), so an idle view costs a few reads |
| Backups | always / weekly | D1 Time Travel keeps every minute of the last 7 days (free plan); the owner exports the whole database weekly (`docs/backup-restore.md`, drill 3 Oct 2026: restore 4 s). The planned nightly spreadsheet copies were not built (the service account cannot create files) |
| 9 PM reminder | from `reminder_time` (21:00) IST, 35 devices a minute until done (Free plan: 50 outside requests a run) | an EMPTY Web Push (VAPID-signed, no payload to encrypt) to each device of every active devotee, every day (the words say whether today is filled; Sunday: whether the week is submitted), and to every signed-out phone; the app's service worker shows the words; devices the push service no longer knows (404/410), or failing 7 times, are removed |
| Sessions | nightly | removes expired sessions |
| Facilitators | with the registry refresh (nightly) | reads the dashboard's NameMap (read-only): adds new names switched on and updates the order; removes dashboard names no longer in NameMap; never changes the master's switch, never brings back a deleted name, keeps names added in the app (one that reaches NameMap becomes a dashboard name); writes nothing when NameMap is unchanged |
| Copy to Sheets | every minute, 300 rows a run | changed tables → the store sheets (decision 39): Accounts, Batches, Memberships, ResetRequests, AuditLog, RunLog, Facilitators, Announcements, DuplicateReviews (Access); Profiles; Settings and the lists (Rules); Submissions, Attendance (open-week marks too), ClassWeeks, Reopens, MissedWeeks, ReopenRequests (Submissions 2026); Drafts (Sadhana · Drafts: one row per devotee-week, d1_mon…d7_sun, week_end, attendance_self). Only changed rows, from the append-only change log (migration 0022), within about a minute. Not copied: password hashes, session tokens, photos and post pictures (binary), phone notification addresses |
| Attendance notices | any minute the reminder and announcements did not use (decision 41) | attendance rows whose `notice_at` is set and `notice_sent` 0 (a partial index), 5 minutes after the change: one push to each of the devotee's phones ("Attendance updated: … marked Absent by your group leader. You had marked Present."), then `notice_sent = 1`. A mark corrected within the 5 minutes, or one that agrees with the devotee's own by then, sends nothing |
| Link IDs | nightly | for each account with no IYF ID, looks the login phone and name up in the registry; exactly one match → linked (`id_source` AUTO, AuditLog) |

---

## 8. Permissions at a glance

| | Devotee | Coordinator | Master |
|---|---|---|---|
| Own week: fill, submit | ✓ | on behalf, own batch | on behalf, any |
| Approve / reject sign-ups and resets | | own batch | all + coordinators' resets |
| Link an existing IYF ID | | at approval, own batch | any time |
| New IYF ID | | never (the dashboard allocates) | never (the dashboard allocates) |
| Unlink / relink IDs | | | ✓ |
| Active / inactive, disable, delete devotees | | own batch | all |
| Attendance before the deadline | own mark (group leader: their group, over the devotee's own) | own batch (over the leader's) | all (over everyone) |
| Attendance after the deadline, reopen a week | | request only | ✓ |
| Facilitator of a devotee | | own batch | all |
| Group leaders: appoint, remove, put devotees in groups | | own batch | all |
| Contact details (email, WhatsApp, address, emergency) | change own | see, own batch | see, all |
| Possible duplicate IDs | | | ✓ |
| Coordinators, batches, settings | | | ✓ |
| Stats | own history | own batch | all |
| Photos | own | own batch | all |

---

## 8b. Cost per call and limits (load test, 3 Oct 2026)

Measured with 2,000 test devotees on a separate copy of the server (`docs/load-test-report.md`). Free plan: 10 ms CPU a call, 100,000 requests a day, D1 5 million rows read and 100,000 written a day (reset 05:30 IST).

| Action | CPU (median) | D1 queries | Rows read | Rows written |
|---|---|---|---|---|
| `meta.get` | 2 ms | 4 | 116 | 0 |
| `auth.me` | 5 ms | 6 | 23 | 0 |
| `home.get` | 8 ms | 15 | 25 | 0 |
| `week.get` | 9 ms | 17 | 24 | 0 |
| `week.saveDay` | 8 ms | 16 | 27 | 2 (first save of a week 6) |
| `week.submit` | 9 ms | 23 | 36 | 6 |
| `auth.login` | 7 ms | 10 | 40 | 6 |
| `devotees.list` (600 devotees) | 13 ms | 13 | 1,986 | 0 |
| `stats.batch` | 16 ms | 18 | 4,392 | 0 |
| `stats.all` | 55 ms | 86 | 14,609 | 0 |
| Monday deadline (one scheduled run, 100 devotees) | 8–16 ms | 306 | 412–4,186 | 445 |

- Every call reads settings, the batch list and the caller's membership at most once (`requestDb` in `worker/src/db.js`).
- Rows written include the triggers that log changes for the Sheets copy (migrations 0018, 0020) and the one-row reply kept for a repeated `requestId`; re-measured after phase 6. An attendance mark writes 1 row.
- A separate load-test Worker (`[env.load]`, never the live API) adds an `x-meter` response header with the call's D1 queries and rows.
- The single D1 database answers about 35 calls a second with these query counts, on either plan.

## 8c. The compact week JSON (decision 42, `submissions.week_json`, v 1)
Every week submitted from 3 Oct 2026 is stored as one compact JSON (no spaces, no empty or null fields). The daily report reads its days from it, and the facilitator dashboard will read the same format for filtering. Rows from before keep `days_json` / `marks_json`; readers use `weekOf()` (`worker/src/weekjson.js`), and SQL uses `DAYS_SQL()`.
```json
{"v":1,"week":"2026-09-28","login":"98…","iyfId":"KT26-0042","name":"…","batch":"SPS",
 "days":[{"date":"2026-09-28","sleptAt":"22:15","wokeAt":"04:30","dayRestMin":30,"rounds":16,"chantingSameDay":true,"chantingDoneAt":"07:10",
          "hearingMin":30,"hearing":[{"lectureId":"L4-012"}],"readingMin":30,"reading":{"bookId":"B12"},"serviceMin":45,
          "m":{"to_bed":["10:00 - 10:15 PM",25],"wake_up":["…",20],"japa":["…",25]}}, … 7 days],
 "weekEnd":{"nightStay":"YES","principles":"YES","avgRounds":16},"attendance":"P","sevaMinutes":315,
 "scores":{"bed":90,"wake_up":80,"day_sleep":100,"japa":70,"pathan":85,"sravan":90,"seva":100,"attendance":100,"body":90,"soul":82,"overall":93}}
```
A week is a few KB, well under the Sheets cell limit (50,000 characters): never add per-day attachments to it. `attendance` is the mark at submit; the final mark is in the attendance table.

## 9. Versioning

- Adding an action or an optional field keeps `v: 1`.
- Removing or renaming anything, or changing a rule's meaning, makes `v: 2`. The server answers both for one release, then sends `UPGRADE_REQUIRED` to `v: 1`.
- `minApp` in `meta.get` lets the server force a reload when an old app version must not keep running.
