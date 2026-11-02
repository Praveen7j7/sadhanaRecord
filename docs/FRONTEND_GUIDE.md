# Frontend guide — Sadhana Record (Svelte 5 PWA)

**12 October 2026 · verified against `frontend/src` and the built `dist/` (build 2026.10.12-0813).** For a new
developer: how routing, state, the API client, forms and offline work, and where the known problems are. Findings
are classified; line numbers are from this tree.

## 1. Routing

- **Hash routes** (`#/path?query`), one page `/`. `src/lib/router.svelte.js` keeps `route.path` (query included),
  numbers every history entry, remembers scroll per entry, runs view transitions (never with reduced motion or on
  the low tier) and holds a **leave guard** for unsaved forms (`setLeaveGuard`, `whenSettled`, `resume`).
- **Gating is in `App.svelte`, not the router** (`:27-42` signed-out → `/welcome` with the deep link kept in
  `sessionStorage sr.return`; forced `/change-password`; `:89-102` path → lazy screen key *only if the scopes allow*;
  known path outside the scopes → "Not available to you"; unknown → "Page not found" via `nav.js knownRoute`).
- **Screens are files loaded on demand** (`App.svelte:104-121`). Staff and master chunks are emitted as
  `assets/staff-*.js` (`vite.config.js:101-102`, decided by the importing file's folder) and kept out of the precache.
- **Five hand-kept lists must agree** when a route is added: `App.svelte` `screen`/`LOAD`, `nav.js` `ITEMS`/`KNOWN`,
  `Shell.svelte` `TITLES`, `area.js`, `prefetch.js`. No test checks their consistency (finding FE-20).

| Route | Screen file | Who | Chunk |
|---|---|---|---|
| `/welcome` `/login` `/signup` `/forgot` | `screens/*` | signed out | precached |
| `/change-password` | `screens/ChangePassword` | any; forced when `mustChangePassword` | precached |
| `/`, `/home` | `screens/Home` → `DevoteeHome` / `coord/StaffHome` / `master/HeadHome` | any | main (+ staff) |
| `/week[/w]`, `/day/w/d`, `/history[/w]`, `/report`, `/hearing`, `/reading` | `devotee/Devotee` sub-router | `sc.devotee` | precached `Devotee-*` |
| `/fill/<login>/week|day/…` | `devotee/Devotee` with `behalf` | `canRequests` (staff) | precached |
| `/wall[?post=id]` | `devotee/Wall` | any signed in | precached `Wall-*` |
| `/group` | `devotee/Group` | `sc.groupLeader` | precached |
| `/my-devotees[/login[/w]]` | `fac/Fac` (+ `ui/WeekRead`) | `sc.facilitator` | precached |
| `/requests[?type=reopen]` | `coord/Requests` | `canRequests` | staff |
| `/batch` `/members` `/stats` `/leaders` | `coord/Batch` tabs | `canRequests` | staff |
| `/devotee/<login>[/week/w]` | `coord/DevoteeDetail`, `ui/WeekRead` | `canRequests` | staff / precached |
| `/overview /devotees /groups /coordinators /facilitators /batches /ids /activity /settings` | `master/Admin` tabs | `sc.master` | staff `staff-Admin-*` |
| `/account[?f=howto]` | `screens/Account` → `Profile`, `DeleteAccount` | any | precached |

The full per-route table with API actions, data dependencies, loading/empty/error states and offline behaviour is
in `FULL_AUDIT_2026-10-12.md` §8.

## 2. State

| Store | File | Persisted where |
|---|---|---|
| `session` `{ user, ready }` | `lib/session.svelte.js` | `localStorage sr.user`, token in `sr.token` |
| `route`, `nav.unsaved` | `lib/router.svelte.js` | history state `{ i }` |
| read cache entries | `lib/cache.svelte.js` | memory → `sessionStorage sr.c.<login>|<key>` → IndexedDB `c:<login>|home.get` and `profile.get` only |
| `batchSel`, `wide`, `toasts/net/install`, `annState` | `lib/batchsel.svelte.js`, `wide.svelte.js`, `pro.svelte.js`, `ann.svelte.js` | none / `sr.annSeen.<login>` |

**Rule: after a write, patch the cache; never refetch.** `weekstore.js` patches `home.get` after `saveDay`/`submit`;
Wall patches the list and comments after like/comment/create; `DevoteeDetail` patches `devotees.list:<batch>`.
Reads go through `cache.load(key, fetcher)` (deduplicated, 2-minute freshness, pull-to-refresh forces). Keys are
namespaced `action:param` because `READS[key.split(':')[0]]` resolves the default fetcher.

## 3. The API client (`lib/api.js`)

- One `POST` with `Content-Type: text/plain` (no CORS preflight); token in the body, never the URL.
- **`requestId` per write, reused on retry** until the server answers ok or a non-retryable error
  (`:88-93,111-133`). `tests/writes.test.js` checks the `WRITES` set against the server's route table.
- Only `BUSY` is retried (3 × 2 s). `NETWORK`/`TIMEOUT` propagate; 15 s timeout, 60 s for photo/announcement uploads.
- `UNAUTHENTICATED` clears the token only when the failing call carried the *current* token (`:136`), so a late
  reply from an earlier sign-in cannot sign the next person out.
- `UPGRADE_REQUIRED` → `location.reload()` at once (`:139`), bypassing the unsaved-day guard the service-worker
  path has (FE-9).
- `serverTime` on every reply sets a clock skew used by the week gates (`:28-34`).
- **`crypto.randomUUID()` has no fallback** (`:74`): on WebView < 92 or a non-secure origin every write throws
  before sending (FE-8, device fleet unverified).

## 4. The day form and offline

`lib/saver.js` owns one day's answers: a draft per keystroke in IndexedDB (`q:<login>:<week>:<date>`), **Save sends
only the diff with the server's version**, `STALE` adopts the server copy and tells the person, `NETWORK` marks the
draft `pressed` with status `offline` ("Not sent · no connection", `Day.svelte:357`) and it is sent oldest-first on
`online` or the next Home open (`saver.js:113-129`, `DevoteeHome.svelte:51-57`). **Offline writes are never shown as
successful.** Week-end answers and attendance are not queued; they fail with a message.

Offline reads: what is in `sessionStorage`/IndexedDB for that login. Only `home.get` and `profile.get` survive a cold
open. Cold start with an expired token stays on the kept screen and signs out cleanly when the network returns
(`session.svelte.js:44-61`).

## 5. PWA

- `vite-plugin-pwa` `autoUpdate`, `skipWaiting + clientsClaim + cleanupOutdatedCaches`; registration in `lib/sw.js`
  (reload once on `controllerchange`, delayed while a day is unsaved; `reg.update()` hourly and on visibility).
- Precache: 125 entries, 757 KB (measured from `dist/sw.js`); staff chunks, icons, big brand files, legal pages and all
  darshan paintings excluded. Runtime caches: `/darshan/*` stale-while-revalidate (8 entries, 30 days), `staff-*.js`
  cache-first (20). **The API origin is never cached by the service worker.**
- Push: permission asked at the first tap (product decision, FE-14); `push.register` anonymous or `push.subscribe`
  attached; `push.detach` on log-out; `public/push-sw.js` fetches the words with `push.message` and only opens app URLs.
- **Per-user data at rest:** cache and drafts are keyed by login and the UI never shows another login's data; but
  log-out leaves other devotees' photos (`photo:<login>`), announcement images, journals, rules, current book and the
  sign-up draft (DOB, address, parent phone) on the phone (`session.svelte.js:77-84` clears only token, user,
  `sr.c.*`, `c:*`). On a shared phone that is data for the next user (FE-3, P2).

## 6. Forms and validation

Client rules mirror the server in `lib/validate.js` and `lib/contact.js`; shared rules live in `../shared/`
(address places, skills, scoring, export fields). Field-by-field comparison:

| Field | Client | Server | Verdict |
|---|---|---|---|
| Phone | `normalizePhone` + `/^[6-9]\d{9}$/` | `normPhone`, same regex | equal |
| **Name** | `/^[\p{L} ]{2,60}$/u` (`validate.js:15`) | `/^[A-Za-z][A-Za-z .']{1,59}$/` (`util.js:74`) | **mismatch (FE-2):** IAST/Devanagari pass the client, fail at submit; "A. Kumar" the reverse; Account rename has no client rule |
| Username | `/^[a-z0-9._-]{3,30}$/` | needs a leading letter | minor |
| Password | 8–64, ≠ phone | + no repeated char, no `0123…`/`abc…` runs, common-list | server message after submit, acceptable |
| Email / WhatsApp / class day / age / consent | same tables | same (+ MX check) | equal |
| **Address** | `$shared/places.js` both sides | same | equal — **but** `Profile.svelte:42` drops `house/street/landmark` and `AddressFields.svelte:14-17` re-splits the one-line address at the first comma on every save (FE-1, P2, data loss) |
| Day form numbers, photo and image limits | NumInput max; 150 KB / 240 KB | same | equal |

Dialogs: one `<dialog>` wrapper (`ui/Sheet.svelte`) with focus return, tap-outside and Android Back
(`ui/backclose.js`). A few inline `.confirm` boxes remain (Wall, DevoteeDetail, Profile, Week). Focus moves to the
first invalid control after a refused save (`lib/focus.js`); page changes focus the `h1`. Contrast is tested from the
CSS tokens (`tests/contrast.test.js`). Touch targets are 44 px except `btn-sm` (36 px) in Wall menus and the comment
Send button.

## 7. Performance facts (measured)

| What | Value |
|---|---|
| Startup JS (gzip) | 55.03 KB (budget 60, target 55 — WARN) |
| Startup CSS (gzip) | 13.77 KB (budget 15, target 13.5 — WARN) |
| Largest lazy chunk | `Devotee` 28.83 KB (budget 35) |
| Precache | 125 entries, 757 KB (budget 800 KB, not enforced) |
| Fonts | system stacks only; no `@font-face` |
| Images | darshan AVIF/WebP/JPEG `srcset` with inline blur; never on the low tier or with data saver |

Device tiers (`lib/tier.js`): `high` / `balanced` / `low` from memory, cores, pointer, connection, battery and
measured jank; the low tier drops view transitions, blur, motion.css, the flat wheel and darshan images.

## 8. Component findings

| ID | Class | Sev | Where | Finding | Fix shape |
|---|---|---|---|---|---|
| FE-1 | **Confirmed defect** | P2 | `screens/Profile.svelte:42`, `ui/AddressFields.svelte:14-17` | Address parts lost on every Account › Address save | carry `house/street/landmark` through `fromServer`, `OWNS.address`, `cleanAddress`; test with a comma in the house |
| FE-2 | **Confirmed defect** | P2 | `lib/validate.js:15` vs `worker/src/util.js:74` | Name rule mismatch | move `validName` to `shared/`; one rule (`\p{L}` plus ` .'-`) |
| FE-3 | **Confirmed privacy risk** | P2 | `lib/session.svelte.js:77-84`, `photos.js:32`, `annimage.js:36`, `refdata.js`, `SignUp.svelte:64` | Log-out leaves others' photos, images, journals, sign-up draft on the phone | `endHere()` deletes `photo:`, `ann:`, `journals:` prefixes and `sr.rules.*`, `sr.book.*`, `sr.signupDraft`; extend `tests/deletion.test.js` |
| FE-4 | Confirmed defect | P3 | `screens/Account.svelte:130` | `history.replaceState(null)` wipes the router's history index | preserve `history.state` |
| FE-5 | Confirmed defect | P3 | `lib/hashq.js:10` vs `router.svelte.js:89` | `replaceHashParams` leaves `route.path` stale → lost filters / duplicate entry on re-tapping the active tab | set `route.path` too |
| FE-6 | Maintainability | P3 | `lib/meta.js:10` vs `SignUp.svelte:79-85` | two writers of `sr.meta` with different shapes | SignUp uses `loadMeta()` |
| FE-7 | Probable bottleneck | P3 | `devotee/Report.svelte:54-59` | up to six `week.get` per month view | `history.list` carries per-day percents, or `weeks.getMany` |
| FE-8 | Unverified assumption | P2 | `lib/api.js:74` | no `randomUUID` fallback | `crypto.randomUUID?.() ?? v4FromGetRandomValues()` |
| FE-9 | Confirmed defect | P3 | `lib/api.js:139` | `UPGRADE_REQUIRED` reloads without the unsaved-day guard; possible double reload | route through `sw.js`'s busy-aware reload |
| FE-10 | Maintainability | P3 | `QuoteCarousel:28`, `Darshan:59,62`, `Wheel:44`, `Wall:204`, `Week:42`, `Day:87,133` | short timers not cleared on unmount | clear in effect cleanup |
| FE-11 | Maintainability | P3 | `coord/Members.svelte:42` | `$effect` used for a pure derivation | `$derived` |
| FE-12 | Proposed enhancement | P3 | `lib/idb.js:18-27`, `saver.js:37` | IndexedDB write failures are silent; a draft can vanish | `idbSet` resolves false; the saver says so once |
| FE-14 | Proposed enhancement (product) | P3 | `main.js:22-30` | notification prompt on the very first tap, signed out | ask after the first saved day |
| FE-15 | Probable bottleneck | P3 | `vite.config.js:101-102` | ~75 KB raw of staff-only code (`WeekRead`, `Export*`, `Reopens`, staff CSS) precached on devotee phones | extend the `staff-` test to those files; add their CSS to `globIgnores` |
| FE-17 | Proposed enhancement | P3 | `Wall.svelte:192-206`, `announcements.js:19` | a shared link to a post older than the 50 newest shows "no longer on the wall" | `announcements.get {id}` |
| FE-19 | Maintainability | P3 | `DevoteeHome:133-139` ≡ `Day:242-247`; `Day:91-107` ≡ `Week:109-121` | duplicated day-chip strip and leave-guard wiring | `ui/DayChips.svelte`, `lib/leaveguard.svelte.js` |
| FE-20 | Maintainability | P3 | `App.svelte`, `nav.js`, `Shell.svelte`, `area.js`, `prefetch.js` | five route lists, no consistency test | one `routes.js` table + a test |

Verified sound (not findings): CSV injection neutralised (`lib/csv.js:6`); no `{@html}`/`innerHTML`; CSP forbids
inline script/style; all `addEventListener`s in components are removed in cleanup; every fetching `$effect` goes
through `cache.load` or `untrack`; rotators hold still on press/hover/focus with no pause buttons; time handling is
IST-fixed and device-timezone-independent.

## 9. Splits that are justified by responsibility (not by line count)

| File | Responsibilities | Verdict |
|---|---|---|
| `devotee/Wall.svelte` (494) | compose/edit with scheduling + picture; feed + post menu; likes/comments; share deep link; report sheet + mutes + head's queue | **split** into `devotee/wall/` (ComposeForm, Post, Comments, ReportSheet, ReportsQueue) with the cache patches in `lib/wallstore.js` |
| `master/Ids.svelte` (342) | four tabs: registry search, person records, duplicates, app-created IDs | **split** into `master/ids/` |
| `devotee/Day.svelte` (404) | one form + three sheets + leave guard | extract the sheets and the leave guard; keep the form |
| `coord/DevoteeDetail.svelte` (366) | profile card, batch history, weeks, eight confirm actions | extract `DevoteeActions`, `DevoteeWeeks` |
| `coord/BatchStatus.svelte` (was `Board.svelte`), `master/Coordinators.svelte` | acceptable; logic already in `lib/staff.js` | keep |

## 10. Proposed structure (keep what works)

```
src/
  routes.js                 NEW — the one route table consumed by App, Shell, nav, area, prefetch (+ test)
  lib/  (unchanged) + wallstore.js, leaveguard.svelte.js
  ui/   (design system; move WeekRead + Export* to coord/ or give them the staff- prefix)
  screens/  devotee/ (+ wall/)  coord/  fac/  master/ (+ ids/)  styles/
tests/   + routes.test.js, deletion.test.js extended for log-out
```

## 11. What to know before changing a feature

- **A new screen**: five places today (§1); lazy screens import `styles/screens.css` themselves; anything imported
  statically from `Home.svelte` lands in the startup chunk and counts against the budget (`scripts/size.mjs`).
- **A new server call**: `call(action, data)`; a write must be in `WRITES` or the server answers `BAD_REQUEST`
  (checked by `tests/writes.test.js`); shared reads go through `cache.load` and are patched after writes.
- **Day form**: everything flows through `createSaver`; field errors come back as `fields[].path` (`day.<key>`);
  live marks use `$shared/scoring.js`, the server's file.
- **Per-user data**: anything written to IndexedDB/localStorage must be keyed by login and listed in `lib/forget.js`
  (deletion) and, after FE-3, in `session.endHere()` (log-out); `tests/deletion.test.js` enumerates the keys.
- **Dialogs**: `ui/Sheet.svelte` only; a sheet opened from a leave guard passes `back={false}`.
- **Motion and rotators**: no pause buttons; hold still on press/hover/focus; respect reduced motion, the low tier
  and data saver; `pace.js` spaces changes.
- **Tests**: `npx vitest run` (node, no DOM; the mock API stands in for the Worker); screens are verified by
  `tools/browser/verify.mjs` and the size script.
