# Sadhana Record — Complete Audit, UX Modernization and Performance Blueprint

**21 October 2026. Analysis only.** No application code, dependency, schema, configuration or deployment was
changed. What was created: this document, its companion `UX_PERF_DEPTH_ANALYSIS_2026-10-21.md` (the depth
analysis written earlier today, referenced below as **DEPTH**), two Lighthouse JSON files under `docs/perf/`, and a
screenshot set under `frontend/screenshots/` (git-ignored). Read-only database inspection used `wrangler d1 info`
and three `SELECT` statements on live; nothing was written.

Audited build: app `index-BFsEoGYS.js` (phase 19, live 21 Oct 11:32 IST), API Worker `be468dd6`, D1 `sadhana`.

**Evidence labels used throughout:** `[VD]` verified defect · `[VI]` verified inefficiency · `[MB]` measured
bottleneck · `[PB]` probable bottleneck (code, not measured) · `[SC]` security concern · `[MC]` maintainability
concern · `[UX]` UX deficiency · `[PE]` proposed enhancement · `[UA]` unverified assumption.

---

## Deliverable 1 — Executive summary

**Current maturity.** A finished, consistent, tested product on the free Cloudflare plan: 55 screens on 58
primitives and one token layer; one route table; 144 API actions behind one gated endpoint with role, field and
object-level checks; 68 tables with 55 indexes; a service worker with a proven self-update; 55 server suites
(2,930 assertions), 445 client tests and a 2,100-check browser gate that every release passes. The companion
analysis places every area at level 3–4.5 on a defined five-step scale (DEPTH §2); no area is below 3.

**Biggest strengths to preserve.** The design system (warm paper light / indigo dark, serif headings, area accents
as markers, no web fonts, no libraries); the capability tiers that make the same screens affordable on low phones;
the devotee Home as a true hero screen; the one-call repeat open; the idempotent write path (request ids and the
`replies` table); the SQL audits that keep the free plan safe; the release gate.

**Most important weaknesses (all bounded).**
1. **In-app speed on the newer screens** `[MB]`: `card.of` 25 round trips, `card.get` 22, `stats.batch` 16,
   `devotees.get` 15, `board.get` 13, `settings.get` 13 — the only calls that average 3–4 s on live.
2. **First paint on a slow phone** `[MB]`: Welcome LCP 3.2 s, because the hero painting is fetched twice, the
   stylesheet render-blocks ≈ 0.6 s, 21 KiB of the startup JS is unused before sign-in, and a 45 KB icon rides along.
3. **Dark mode reads flatter than light** `[UX]`: surface steps too close in value; no depth cue on cards.
4. **Width on desktop** `[UX]`: Report, the Day form and the staff Home leave a third to two thirds of the screen empty.
5. **The head's Home makes 8 requests on open** `[VI]`, two of them the heaviest actions in the app.
6. **Process risk** `[VD]`: the application tree is not under version control (one `phase0` commit in the parent
   repository, the tree untracked — unchanged since the 12 Oct audit; re-checked today, see §2.11).

**Most consequential risks.** The untracked tree (one disk, one machine); `week.submit` at 9 ms CPU p50 against
the 10 ms cap (any scoring change must be measured on the load Worker); Sunday writes at 5,000 devotees ≈ 80–85 %
of the free day; no field performance data from India (every latency figure is lab or Seoul→Seoul).

**Highest-value improvements.** (1) The round-trip pass on the six slow actions — zero bytes, server only, the
17 Oct method; (2) one fetch for the Welcome painting + critical CSS inline + today's darshan entry instead of the
119-image catalogue; (3) the public/shell split so Welcome and Login carry ≤ 35 KB; (4) dark-mode tonal steps and the
hero-card material; (5) "Same as yesterday" and a section bar on the Day form; (6) numbers on Report and the staff Home.

**Strategy.** Not a rebuild. Five bulk phases through the existing gate (DEPTH §7): fast first paint and fast
calls → public/shell split and the budget ladder → depth and vibrancy → fewer taps → numbers from real phones.
Every phase measured before and after with the same tool; every business rule, scope and route untouched.

---

## Deliverable 2 — Verified current state

### 2.1 Stack (verified in `package.json`, `vite.config.js`, `wrangler.toml`)

| Layer | Actual | Note on the historical figures in the brief |
|---|---|---|
| UI | Svelte 5.57 (runes), Vite 8.3, `@tailwindcss/vite` 4.3 — Tailwind's `theme.css` layer is imported and utility classes are used in markup; the design tokens live in `app.css` (90 custom properties), not in Tailwind config | "Tailwind 4" ✓ |
| PWA | `vite-plugin-pwa` 1.3 / Workbox: `registerType: autoUpdate`, `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`, `navigateFallback: /index.html` | ✓ |
| API | Cloudflare Worker `sadhana-record-api`, wrangler 4.151, one POST endpoint, **144 actions in 46 modules** | brief said ≈ 95: outdated |
| Database | D1 `sadhana` (APAC), **68 tables, 55 indexes, 128 triggers** (the Sheets-mirror change log), **57 migration files, latest 0058** | brief said 43 tables / 28 migrations: outdated |
| Tests | 55 server suites · 2,930 assertions; 32 client files · 445 tests; browser `verify.mjs` with 34 parts (1,885 checks in the gate) + `components.mjs` 219 + `back-guard.mjs` 17 + `motion-audit.mjs` 27; SQL audits (`query-plans.mjs`, `write-audit.mjs`), fixture-phone sweep | — |
| Sizes | startup JS **56.90 KB gzip** (7 files), CSS 13.85 KB, largest lazy chunk 29.41 KB, precache 678.69 KB / 117 entries | brief said 55.4 / 14.45: a 12 Oct build |

### 2.2 Repository architecture
`sadhanaRecord/` (live tree) and `sadhanaRecord-revamp/` (next batch; identical today). `frontend/` (Svelte app,
`src/{screens,devotee,coord,master,fac,ui,lib}`, `routes.js`, `tests/`, `scripts/`), `worker/` (`src/*.js`,
`migrations/`, `tests/`), `shared/` (scoring, names, places, skills, window, export fields — used by both),
`tools/` (browser checks, perf, release gate, identity service tokens, store build), `setup/` (sheet schema, data
generators), `docs/`. `docs/` is shared between the two trees (hard link / symlink).

### 2.3 Architecture map (verified by reading the code paths)

```
Phone / laptop
 └─ index.html (no-cache) ─ sw.js (Workbox precache: startup + devotee chunks; staff-* CacheFirst at runtime; darshan SWR, 8 entries)
     └─ App.svelte ── router.svelte.js (hash routes) ── routes.js (ONE table: pattern → screen key → scope → title → area → loader)
          ├─ session.svelte.js (restore: kept user from localStorage 'sr.user'; token 'sr.token'; one call at a repeat open)
          ├─ cache.svelte.js (per-login read cache: memory + sessionStorage, MAX_AGE 2 min, in-flight dedupe, patch after writes)
          ├─ idb.js (IndexedDB: journals, kept Home) · prefetch.js (loader on pointerdown) · tier.js · theme.js · motion.js
          └─ screens → ui primitives → lib/api.js  { v, action, token, requestId, app, data }  POST →
                                                                                                 ↓
Worker api.js ─ registry: roles · write flag · field whitelist · PUBLIC / PUBLIC_WITH_TOKEN
   ├─ session.js (token hash → session + account in ONE join; sliding expiry; ended on status/role change)
   ├─ db.js scopesOf (devotee / groupLeader / facilitator / trainee / coordinator[] / master) — on EVERY call, batched reads()
   ├─ per-module handlers (auth, weeks, classweek, closing, phases, identity, admin, requests, rules, announcements, push, …)
   │     validation: util.invalid() per field · authorization: requireBatch / behalfBatch / scope checks in the handler
   ├─ replies table (request id → same answer on retry) · audit_log · run_log (slow > 1.5 s or failed only)
   └─ D1 (q / one / all / reads() / batch) — triggers log row changes for the (paused) Sheets mirror
Scheduled: every minute (mirror copy ≤ 300 rows, Monday-deadline closing, announcement pushes); 14–17 UTC windows (9 PM IST reminders, 35 phones per run)
External: Web Push (VAPID), Google Sheets (paused), Drive links (books, lectures — opened, never fetched by the app)
```

**Where responsibilities sit.** Validation: the registry's field whitelist (unknown field → BAD_REQUEST) and the
handler's `invalid()`; the client validates the same rules for feedback (`lib/validate.js`, `signup-validation`
tests). Authorization: the registry's role gate, then object-level checks in the handler (`requireBatch`,
`behalfBatch`, `personForApproval`…), guarded by `roles.test.mjs` (every action must be in GATE_OF_RECORD) and
`ownership.test.mjs`. Errors: handlers throw `apiError`; `api.js` shapes `{ ok:false, error:{code,message,…} }`
and logs slow/failed calls; the client's `errorMessage()` maps codes to words; `hooks.onUnauthenticated` signs out.

**Coupling and duplication `[MC]`.** Low. The one deliberate duplication is scoring in `shared/scoring.js` (used by
both sides, kept in parity by `scoring-shared` tests). `Board.svelte` (batch status) and `Board2.svelte`
(facilitation board) are two screens with misleading names, not duplicated code. The paused Sheets modules
(`mirror.js`, triggers, setup) are kept by decision, not dead. `APP_MINTED` still admits the retired `SR` id
series (harmless, a leftover). No circular dependencies found between `lib/*` modules by import inspection.

### 2.4 Route inventory — see Deliverable 3 (44 route patterns + 4 public screens, from `routes.js`).

### 2.5 Component and design-system inventory
58 primitives in `ui/` (Button, IconButton, Icon (47 glyphs), TextInput, NumInput, TextArea, DateInput, TimePicker,
Wheel, WheelSelect, Select, MultiSelect, Seg, Toggle, Checkbox, Radio/RadioGroup, Search, CommandSearch, Sheet, Menu,
Shell, Tabs, Row, RingRow, Ring, Bars, ColBars, Meters, Spark, Trend, Status, Banner, Toaster, Skeleton, EmptyState,
FormSection, FormActions, EditSection, Photo, PhotoZoom, Darshan, Quotes, QuoteCarousel, DayPractice, FirstRun,
Reminder, Refreshing, SlowHint, ScopeStrip, WeekPicker, WeekRead, Export*, AnnImage, Plain, AddressFields …).
Tokens: 90 (colour, type scale with `clamp()`, 8-step spacing, 6 radii, 3 shadows, 4 durations, 3 easings, glass,
tiers). It is a genuine system: every screen in today's screenshots uses it; no locally-styled duplicate of a
primitive was found. Three staff screens render `<table>` directly (`Activity`, `Batches`, `Coordinators`) and
three chart primitives do; consistent.

### 2.6 API architecture
One endpoint; a registry row per action: `{ roles, write?, noReplay?, fields, fn }`. 144 actions. Public actions
(`meta.get`, `auth.login`, `auth.signUp`, `auth.requestReset`, `auth.lookup` …) strip the token except
`PUBLIC_WITH_TOKEN`. Per-IP limits `[auth.js]`: login 200/10 min, sign-up 100/h, reset 30/h, lookup 60/10 min;
account lockout after `lockout_tries` (5) wrong passwords; BUSY is never logged (flood → no writes). Idempotency:
write actions carry a request id; the `replies` table returns the same answer on retry (`noReplay` opts out for
reads-as-writes like `books.setCurrent`).

### 2.7 Database architecture
68 tables (accounts, sessions, memberships, batches, submissions/weeks, drafts, attendance, training_attendance,
enrolments, phases/targets/fills/stage_targets, announcements + comments/likes/reports/mutes, identity: persons,
person_identifiers/phones/names/links/history, id_sequences, app_ids, registry (dashboard copy), reset_requests,
reopens, batch_closings, push_subs/jobs, audit_log, run_log, replies, mirror_state/log, settings, books, book_files,
book_chapters, lectures, rules tables …). 55 indexes (list in §6.4). 128 triggers = the mirror's change log on
every mirrored table. Retention job trims logs. D1 Time Travel + weekly export (`backup-restore.md`).

### 2.8 Authentication and authorization model (verified)
Phone + password (PBKDF2 10,000 iterations, per-user salt); token = random, stored hashed in `sessions`, sent in the
JSON body (never a cookie → **no CSRF surface**); client keeps it in `localStorage` (`sr.token`) with the kept user
(`sr.user`), cleared on logout and on an UNAUTHENTICATED answer; sliding expiry (`session_days` setting), the
`last_used_at` write throttled to once an hour. Scopes derived per call from memberships, leaders, facilitator
name, enrolments and coordinator batch lists; the `master` login is recovery-only, a new head needs every head's
approval (`heads.*`). Devices list + remote sign-out since phase 18.

### 2.9 PWA behaviour (verified in `vite.config.js`, `lib/sw.js`, `scripts/carry-assets.mjs`)
Precache: startup + devotee chunks + icons/brand subset (117 entries, 679 KB); `staff-*` chunks are excluded and
cached at first use (CacheFirst, 20 entries); darshan paintings StaleWhileRevalidate (8 entries, 30 days);
`index.html`, `sw.js`, `workbox-*.js`, manifest `no-cache`; hashed assets `immutable` one year. Update: the new
worker installs, `skipWaiting` + `clientsClaim`, the page listens for `controllerchange` and reloads once with a
flag — proven on every release ("the open page moved by itself"). Old clients: the release keeps the previous two
releases' assets in `dist/` so a cached page can still load screens it has not cached.

### 2.10 Performance metrics — Deliverable 5. Testing and deployment — Deliverables 2.11 / 7 and §9.

### 2.11 Deployment and process state
Worker: `npm run deploy` (gated by `audit:sql`). App: `npm run release` (tests, build, size, carry assets, deploy,
live smoke, ledger). Bulk changes go through `gate.mjs checks <n>`. **The application tree is not under version
control** (parent repo has one commit `phase0`; `git ls-files sadhanaRecord` is empty — re-verified today). No CI.

### 2.12 Not verified today (stated plainly)
Field performance from India (no RUM); INP (only TBT 0 ms in the lab); Lighthouse on authenticated routes (needs a
session; the browser gate and hop counts stand in); Brotli sizes (`size.mjs` measures gzip; Cloudflare serves
Brotli, so wire bytes are smaller than quoted); D1 query plans on live (the local audit over the full suite is the
evidence: 31 approved scans, 0 new); behaviour at 5,000 devotees (the 3 Oct load test ran at 2,000); a real
TalkBack/VoiceOver pass (only the scripted screen-reader audit, results in §10).

---

## Deliverable 3 — Route-by-route audit

Conventions for the table: **Access** = scope from `routes.js`; **API on entry** = actions the screen calls when
opened (from the screen's own `call()`/`load()` sites; `home.get`/`auth.me` come from the shell); **States** =
loading / empty / error as implemented (S = `Skeleton`, E = `EmptyState`, B = `Banner`/`errorMessage`, T = toast;
"—" = none needed or none present, said which); **Visual** = today's screenshots, light and dark; **Resp.** =
390 / 820 / 1280 behaviour; **A11y** = concerns seen in code or checks; **Perf** = chunk and hops; **P** =
priority of the proposed change (P0–P3). Routes handled by one router file (`Batch.svelte`, `Admin.svelte`,
`Devotee.svelte`) are listed individually; their chunk is shared.

### Public
| Route | Screen | API on entry | States | Visual (L / D) | Resp. | A11y | Perf | UX / findings | Proposed | P |
|---|---|---|---|---|---|---|---|---|---|---|
| `/welcome` | `Welcome.svelte` (startup chunk) | `meta.get`, `darshan.json` | — / — / painting fallback to colour | excellent desktop split; phone band; dark: good | ✓ all | Lighthouse 100; carousel has roledescription + hold rules | **LCP 3.2 s**: painting fetched twice `[MB]`; 21 KiB unused JS `[VI]`; CSS render-blocks 0.6 s `[MB]`; 31 KB catalogue preloaded `[VI]` | A1 A2 A3 A4 A5 (DEPTH) | P1 |
| `/login` | `Login.svelte` | `auth.login` | B on error; lockout message with time | good both; dark fine | ✓ | labels, autocomplete, device label | perf 96; 21 KiB unused JS | expired-session banner "You were signed out" ✓ | A4 | P1 |
| `/signup` | `SignUp.svelte` (lazy 6.5 KB) | `auth.lookup` (masked), `auth.signUp` | B per field; draft kept in sessionStorage | 4 steps, gold rule, section icons; dark good | ✓ | labels/errors associated (`ValidationMessage`) | — | Vedic intakes offered when open (server verified; **phone look not re-checked**) `[UA]` | verify item 5 visually | P2 |
| `/forgot` | `Forgot.svelte` | `auth.requestReset` | "sent" either way (by design) | plain, fine | ✓ | ✓ | — | — | — | — |

### Devotee (own sadhana) — chunk `Devotee` 29.41 KB (shared by Week/Day/History/Report/Hearing/Reading)
| Route | Screen | API on entry | States | Visual | Resp. | A11y | Perf | UX / findings | Proposed | P |
|---|---|---|---|---|---|---|---|---|---|---|
| `/home` | `DevoteeHome.svelte` (startup) | `home.get` (one call), `announcements.list`, `group.list` (leaders), `fac.devotees` (facilitators) | S / "no weeks yet" copy / B | **hero screen**; dark flatter (card separation by border only) `[UX]` | ✓; 1280 two columns | ✓ | 2–4 requests | Getting-started card dominates for new users (by design, skippable) | C1 C2 C5 (DEPTH) | P2 |
| `/week`, `/week/:w` | `Week.svelte` | from `home.get` cache; `week.saveWeekEnd`, `week.setAttendance`, `week.submit` | S / — / B+T | honest states (Missing amber / Not filled / Not yet) | ✓ | ring has text; rows are links | — | submit sheet = 3 controls (night stay, principles, attendance) counted from code | C4 (shared-element) | P3 |
| `/day/:w/:d` | `Day.svelte` 414 lines | `week.get` (cache) ; writes `week.saveDay`, `books.setCurrent` | S / — / B+T, STALE reconcile | sectioned, floating score+Save; **desktop single 720 px column, right third empty** `[UX]` | ✓; 1280 wastes width | labels ✓; inputmode on numeric fields **not verified** `[UA]` | saves wait 0.7–2 s on live `[MB]` | 13 controls (7 numbers, 3 times, 1 seg, 1 text, 1 textarea) + hearing/reading pickers; no "same as yesterday" | B2 D1 D2 D3 C8 | **P1** |
| `/history` | `History.svelte` | `history.list` | S / E / B | row icons ph18 | ✓ | ✓ | one call (`dayPct`) | — | — | — |
| `/report` | `Report.svelte` | `history.list`, `week.get` | S / E ("No record for…") / B | calendar + empty ring; **desktop two-thirds blank** `[UX]` | ✓ | colour key has text | — | month's numbers not shown | C6 E3 | P2 |
| `/hearing`, `/learn` (redirect) | `Hearing.svelte` + `LectureList` | journals via `getJournals` (IndexedDB, versioned) | S / E / B | dense, good; "Continue" hero | ✓ | week stepper keyboard ✓ | — | — | D7 | P3 |
| `/reading` | `Reading.svelte` + `BookList`, `BookFiles`, `BookChapters` (lazy 1.1 KB) | journals (cache); `books.chapters` on tap | S / E / B | bilingual since phase 19; good both | ✓ | chapters list labelled | — | — | D7 | P3 |
| `/wall` | `Wall.svelte` 504 lines (lazy 12 KB) | `announcements.list` (+12 write actions) | S / E / B+T | cards; dark good | ✓ | like/comment buttons labelled | largest screen file `[MC]` | split the markup (roadmap 4.2) | M-1 | P2 |
| `/group` | `Group.svelte` | `group.list`, `group.mark` | S / E / B | — | ✓ | ✓ | — | — | — | — |
| `/card` | `Card.svelte` (lazy) | `card.get` **22 hops** `[VI]`; `targets.set`, `card.fill`, `stages.set` | S / E / B+T | measure icons ph18 | ✓ | ✓ | 2.9 s avg among slow calls `[MB]` | — | B1 | **P1** |
| `/account` | `Account.svelte` | `auth.sessions` (on Devices open), `profile.update`, `auth.sessionEnd` | S / — / B+T | plain, correct both | ✓ | ✓ | — | — | — | — |
| `/account` › Profile sheet | `Profile.svelte` | `profile.get` 11 hops, `profile.update`, `photo.*` | S / — / B | ✓ | ✓ | ✓ | — | — | B1 | P2 |
| `/change-password` | `ChangePassword.svelte` | `auth.changePassword` | — / — / B | ✓ | ✓ | ✓ | — | forced on temp password ✓ | — | — |

### Facilitator — chunk `staff-Fac` 4.67 KB
| `/my-devotees`, `…/:login`, `…/:login/:w` | `Fac.svelte` | `fac.devotees`, `fac.devotee` | S / E / B | grouped Needs you / Filling / Submitted, ring rows, split view ≥ 1024 (corrected verdict 19 Oct) | ✓ | ✓ | — | — | — | — |

### Coordinator (class batch) — chunk `staff-Batch` 13.93 KB (+ `WeekRead` 5.47, `DevoteeDetail` 8.77, `Requests` 8.33)
| Route | Screen | API on entry | States | Visual | Resp. | A11y | Perf | UX / findings | Proposed | P |
|---|---|---|---|---|---|---|---|---|---|---|
| `/batch` | `Batch.svelte` → `Board.svelte` 299 lines | `devotees.list`, `weeks.setClass`, `attendance.set` | S / E / B+T | phone: card list + dot strips; 820+: table with headers — good | ✓ | P/A marks have sr names (phase 20) | `devotees.list` 1.9 s avg among slow calls | week picker = two selects `[UX]`; nudge is per person | D4 D5 | P2 |
| `/members` | `Members.svelte` | `members.list` (paged 50), `devotees.delete` | S / E / B+T | rows with avatar | ✓ | ✓ | render cost measured 19 Oct: 635 nodes, < 0.1 ms layout | **class-batch coordinator can delete accounts** (`REPORTED` item 4) `[SC-product]` | needs `batches.kind` | **P1** |
| `/stats` | `Stats.svelte` | `stats.batch` **16 hops** | S / E / B | bars | ✓ | charts without table `[UX-a11y]` | 1,584 rows at 2,000 devotees by design | — | B1 E3 | P2 |
| `/leaders` | `Leaders.svelte` | `leaders.list/assign/set` | S / E / B+T | ✓ | ✓ | ✓ | — | — | — | — |
| `/requests` | `Requests.svelte` + `SignUpCard`, `TempPassword` | `requests.list`, `reopen.list`, `announcements.reports` | S / E / B+T | approve + issue IYFD in one step (ph18) | ✓ | ✓ | 3 requests on open (could be one) `[PE]` | — | B3-style merge `[PE]` | P3 |
| `/devotee/:login` | `DevoteeDetail.svelte` 410 lines | `devotees.get` **15 hops**, `devotees.promoteOptions` | S / — / B | excellent (dark screenshot) | ✓ | ✓ | 393 ms avg; 16 INTERNAL errors 17 Oct (fixed 8120dac) | file size `[MC]` | B1, split | P2 |
| `/devotee/:login/week/:w`, `/fill/:login/…` | `WeekRead.svelte`, `Devotee.svelte` on behalf | `week.get` (behalf) | S / — / B | ✓ | ✓ | ✓ | — | Svelte `state_referenced_locally` warning in `WeekRead` (build log) `[MC]` | fix the warning | P3 |
| `/closing` | `Closing.svelte` | `batches.closingPreview` (**one COUNT per member — N+1** `[VI]`), `batches.close` | S / E / B+T | Qualified / Repeat / Left; rows padded (ph19) | ✓ | choice named per row | N members → N round trips (small batches today) | — | one grouped COUNT | P2 |

### Coordinator (training) — same chunk
| `/students` | `Students.svelte` | `enrol.list/search/add/remove` | S / E / B+T | ✓ ph18 | ✓ | ✓ | — | — | — | — |
| `/board` | `Board2.svelte` | `board.get` **13 hops**, `training.attendance` | S / E / B+T | dense by design | ✓ (9rem cols) | ✓ | 3.5 s avg among slow calls `[MB]` | name misleads (`Board` vs `Board2`) `[MC]` | B1, rename | **P1** |
| `/scoreboards` | `Scoreboards.svelte` | `board.list` 5, `board.get` 13, `card.of` **25 hops** | S / E / B | rank chip ph18 | ✓ | ✓ | `card.of` 3.9 s avg `[MB]` | — | B1 | **P1** |

### Head (admin) — chunk `staff-Admin` 28.10 KB (router + 10 tabs; `Ids` 380, `Coordinators` 301 lines)
| Route | Screen | API on entry | States | Visual | Resp. | A11y | Perf | UX / findings | Proposed | P |
|---|---|---|---|---|---|---|---|---|---|---|
| `/home` (head) | `HeadHome.svelte` | **8 requests**: `stats.all` 12 hops, `settings.get` 13 hops, `requests.list`, `reopen.list`, `heads.requests`, `announcements.reports`, `runlog.list`, `batches.list` `[VI]` | S per block / — / inline retry per block | Decisions, System health, Batches this week (mostly a sentence today) | ✓ | ✓ | the two heaviest actions on every open | thin "Batches this week" `[UX]` | B1 C7; one `home.staff` aggregate `[PE]` | **P1** |
| `/overview` | `Overview.svelte` | `stats.all`, `batches.list` | S / E / B | counters + progress bars; dark good | ✓ | ✓ | 14–27 k rows at 2,000 devotees `[PB]` | — | B5 | P2 |
| `/devotees` | `Devotees.svelte` | `devotees.list` (all) | S / E / B+T | ✓ | ✓ | ✓ | — | who may delete (item 4) | `batches.kind` | P1 |
| `/groups` | `Groups.svelte` | leaders by batch | S / E / B | ✓ | ✓ | ✓ | — | — | — | — |
| `/coordinators` | `Coordinators.svelte` | `coordinators.list`, `batches.list`, `heads.requests` (+7 writes) | S / E / B+T | list rows; toolbar cluster (ph20) | ✓ | ✓ | — | — | — | — |
| `/facilitators` | `Facilitators.svelte` | `facilitators.list` (+3 writes) | S / E / B+T | ✓ | ✓ | ✓ | — | — | — | — |
| `/batches` | `Batches.svelte` | `batches.list`, `coordinators.list` (+2 writes) | S / E / B+T | table | ✓ | ✓ | — | — | — | — |
| `/ids` | `Ids.svelte` 380 lines | `ids.search/get/link/unlink/create/nextApp/appList/possibleDuplicates/reviewDuplicate`, `identity.search` | S / E / B+T | 4 tools in 2 rows < 400 px (ph19) | ✓ | ✓ | — | duplicates **merge** UI absent (`identity.merge` exists server-side) `[UX]` | build the merge screen | P2 |
| `/reopens` | `Reopens.svelte` | `reopen.list`, `weeks.reopen`, `reopen.reject` | S / E / B+T | clock icon ph18 | ✓ | ✓ | — | — | — | — |
| `/activity` | `Activity.svelte` | `audit.list`, `runlog.list` | S / E / B | table | ✓ | ✓ | paged | `run_log` holds slow/failed calls only — fine, but the screen does not say so `[UX]` | caption | P3 |
| `/settings` | `Settings.svelte` | `settings.get` **13 hops**, `settings.update` | S / — / B+T | ✓ | ✓ | ✓ | 2.7 s avg `[MB]` | — | B1 | P1 |

### Shared surfaces (not routes)
Drawer/sidebar (`Shell`, `Menu`): one model for bar (< 600), rail (600–1023), sidebar; verified at every width in
the gate's `nav` and `logins` parts. Sheets (`Sheet.svelte`): focus trapped, Back closes (`back-guard`), spring
motion, opaque on Low. Toasts with undo (`Toaster`). Confirmations for destructive actions (delete account, close
batch, remove enrolment): consistent `Sheet` + typed word for account deletion. Offline banner and "kept" badge
(`Refreshing`, `SlowHint`). Splash: emblem + line, skipped only by a flag `[PE: skip for returning users]`.

**Screens with no `EmptyState`:** by design where there is nothing to be empty (Home, Day, Week, Account, Profile,
Login, Welcome, Settings, the routers). **No `Banner`:** `StaffHome`, `HeadHome` use inline "Couldn't load … Retry"
per block instead (seen in code) — consistent with the pattern, not a gap.

---

## Deliverable 3b — User journeys (counts from code and the gate; estimates marked)

| Role / journey | Screens | User actions | Fields | Requests | Blocking waits | Findings |
|---|---|---|---|---|---|---|
| Devotee, first entry | Welcome → Sign up (4 steps) → pending page → (approval) → Login → Home | ~22 (counted from the form's controls) | 14 required (phone, WhatsApp y/n, name, email, DOB, blood group, batch, facilitator, class day, address ×5, password ×2; parent ×2 if 15–17) | 3 (`meta.get`, `auth.lookup`, `auth.signUp`) | none (draft kept if the tab dies) | long by necessity (identity for approval); the masked lookup is a good step |
| Devotee, daily fill | Home → Day (1 tap "Fill Monday") → Save → back | 2 screens; **1 tap to reach, ~13–16 field entries, 1 Save** | 13 controls | 1 (`week.saveDay`; `week.get` served from the kept Home) | the Save (0.7–2 s on live `[MB]`) | D1 "Same as yesterday" would cut entries on a repeat day to ~3–5 (estimate); B2 removes the wait |
| Devotee, week submit | Week → submit sheet (night stay, principles, attendance) → Submit | 2 | 3 | 2–3 (`saveWeekEnd`, `setAttendance`, `submit`) | 1.5 s (`week.submit` live) | fine; the celebration moment is plain (C10) |
| Devotee, review / correct | Week → day → edit → Save; after deadline → "Ask to reopen" | 2–3 | — | 1–2 | — | clear |
| Group leader, mark the group | Home "Needs you" → Group → mark present/absent | 2 | 1 per person | 2 | — | ✓ |
| Facilitator, students | Home → My students → student → week | 3 | — | 2 (`fac.devotees`, `fac.devotee`) | — | ✓ |
| Coordinator, Monday loop | Home (2 requests) → Batch status → nudge (call/WA per person) → Requests (3 requests) | 3–4 | — | ~6 | `devotees.list` 1.9 s avg `[MB]` | nudges one at a time (D4); Requests could be one request (P3) |
| Coordinator, approve sign-up | Requests → card (match registry / new IYFD + year) → Approve | 1–2 | 2–4 | 2–3 | — | ✓ since phase 18 |
| ETP coordinator, weekly | Home → Board (13 hops) → mark attendance → Scoreboards (`card.of` 25 hops per row opened) | 3 | 1 per student | 3+ | **3.5–3.9 s per open** `[MB]` | B1 is the fix |
| Head, daily | Home (**8 requests**) → Decisions → Requests / Reopens / Heads | 2–3 | — | 8 + | `stats.all`, `settings.get` | B1, C7, one aggregate |
| Head, identity | IYF IDs → search → link / create (year) / review duplicates | 2 | 1–3 | 2–4 | — | merge screen missing (P2) |
| Anyone, session expiry / unauthorized | kept Home → server says UNAUTHENTICATED → Login with "signed out" banner → return path restored | — | — | 1 | — | tested (`phase1-session`, incl. the same-tab reload added 19 Oct) |
| Anyone, offline | kept Home + journals from IndexedDB; writes refused with a clear message; reconnect retries `auth.me` | — | — | 0 | — | tested; no write queue by design (a sadhana day is small and re-entered) |

Blocking interactions are few and are all network waits; the product-level opportunity is repeated entry (D1), the
engineering one is the round trips (B1) and the optimistic save (B2).

---

## Deliverable 4 — Design modernization proposal

### 4.1 The system as it stands (keep)
Tokens: brand `#004fdc` (light) / `#78a8ff` (dark), navy and gold as brand accents; area markers (devotee blue,
coordinator amber `#a14a08`/`#f2a25a`, admin plum `#7a2346`/`#e9a6c0`); warm neutrals in light (`#f6f2eb` page,
`#fbf9f6` surface, `#ffffff` raised); indigo night in dark (`#110f17 → #1a1822 → #24212e → #2d2a39`); semantic
success/warning/danger/info with soft fills by `color-mix`; type: serif display (Iowan/Palatino stack) + system
sans, `clamp()` scale; spacing 4–48; radii 6–24; three shadow levels; glass only on floating surfaces (bar, nav pill,
sheets, drawer, the verse panel on High); motion 120/200/440 ms, spring for sheets, ×0.8 on lower tiers, removed
under reduced motion; three capability tiers. Accessibility baked in: focus ring, 44 px targets, names.

### 4.2 Direction: "the same product, with depth"
Not a new look. The target is that both themes read as **deliberate, premium and calm**, that every screen has
**one hero**, that numbers **reveal** rather than sit, and that desktop **uses its width**. Concretely:

| Element | Light | Dark | Where |
|---|---|---|---|
| Surface steps | keep | open the steps (≈ `#121018 / #1b1924 / #262330 / #312d3e`, to be contrast-validated) + 1 px `--glass-edge` top highlight on raised cards + deeper `--shadow-2` | every card |
| Hero material | soft area wash (≤ 8 %) inside the hero card's header | same, slightly stronger (≤ 10 %) | week card, Needs-you block, Continue card |
| Numbers | count-up once, ring stroke-draw, bars grow once (High only) | same | day score, Report ring, counters, Scoreboards |
| Travel | shared-element View Transition Home → Week → Day (High) | same | the week strip and the day heading |
| Scroll | darshan card settles 8–12 px on scroll (CSS scroll timeline, High) | same | Home |
| Width | ≥ 1024: Report two columns with the month's numbers; Day form with a sticky rail; staff Home balanced columns | same | Report, Day, staff Home |
| Imagery | unchanged matrix (`UI_UX_360_REVAMP.md` §8.2): Welcome, desktop sign-in, Home card, pending page, submitted sheet (opt.), devotee empty states (opt.) | same | — |

**Inappropriate effects, excluded:** glass or gradients behind data, forms or tables; images on work screens;
looping or auto-playing motion; per-row entrance animations; web fonts; a charts library; blur layers beyond two.

### 4.3 Component standards (additions only)
`Card` gains a `hero` variant (wash header) and a `raised` dark highlight; `Ring`/`Meters` gain a one-shot
`reveal` prop; `Seg` keeps its optional icon; a `SectionBar` (sticky jump bar) for long forms; `DayRail` for the
desktop Day form; `Table` stays per-screen (three uses) — not worth a primitive yet.

### 4.4 Motion principles (unchanged, made complete)
Animate only transform/opacity/colour; one-shot; start on visibility; nothing moves under a typing finger;
entrance ≥ exit; tiers: High full, Balanced ×0.8 no parallax, Low/reduced = crossfade or instant with final state.
Theme switch: instant (no transition on `color-scheme` change) to avoid a two-tone flash — verified today in the
`tiers` gate part (`themeMenu`).

### 4.5 Responsive patterns
Phone: single column, bar of 5, sheets; tablet (600–1023): rail + table layouts; desktop (≥ 1024): sidebar +
two-column content where the content is two kinds (Home, Report, Day), list-detail for staff (Fac already does).
Large desktop (1920): `--content-max` 1120 px keeps line lengths sane — keep.

### 4.6 Accessibility standards (in the system, not after)
WCAG 2.2 AA: contrast via tokens only (validator in `tests/contrast.test.js`); every control ≥ 44 px; every icon
button named; sheets trap focus and restore it; live regions for status; charts get a table twin (E3); reduced
motion honoured by tokens; text size setting kept; a stored screen-reader pass per release (§10).

---

## Deliverable 5 — Performance report

### 5.1 Measurement definitions (so no two figures are compared wrongly)
- **Initial JS** = the seven files `index.html` loads before anything renders, **gzip level 9**, as `scripts/size.mjs`
  measures: `index`, `rolldown-runtime`, `index-client` (Svelte runtime), `pro.svelte`, `api`, `disclose-version`,
  `preload-helper`. Today **56.90 KB**. Brotli (what Cloudflare actually serves) is smaller; not measured.
- **Initial CSS** = `index-*.css`, gzip: **13.85 KB** (+ `contrast.css` 0.88 KB conditional).
- **Largest lazy chunk** = any single non-startup JS file, gzip: Devotee **29.41 KB**.
- **Total emitted** (12 Oct measurement, same build shape): 899 KB raw / 279 KB gzip, 124 files.
- **Precache** = what the service worker stores on install, uncompressed: **678.69 KB / 117 entries**.
- **First meaningful interaction, Welcome** (Lighthouse total byte weight, transfer): **299 KiB**; Login 197 KiB.

### 5.2 Lab results (stored today; mobile profile = Moto G class, 4× CPU slowdown, slow 4G)
| Page | Perf | A11y | BP | FCP | LCP | TBT | CLS | SI | Bytes |
|---|---|---|---|---|---|---|---|---|---|
| Welcome | 91 | 100 | 100 | 2.0 s | **3.2 s** | 0 ms | 0 | 2.6 s | 299 KiB |
| Login | 96 | 100 | 100 | 1.9 s | 2.4 s | 0 ms | 0 | 2.6 s | 197 KiB |
Against the brief's proposed targets (FCP ≤ 1.8, LCP ≤ 2.0): **not met** in this lab profile today; TBT and CLS met.
INP: not measurable in the lab; TBT 0 ms and `max-potential-fid` 30–50 ms suggest it is fine `[UA]`.

### 5.3 Initial-load breakdown (Welcome, from the Lighthouse network records)
`darshan/v086-960.avif` 50 KB + `v086-480.webp` 42 KB (**the same painting twice** `[MB]`), `icons/icon-192.png`
45 KB (manifest icon), `index-*.js` 35 KB, `darshan.json` 31 KB, `index-client` 20 KB, CSS 16 KB, emblem webp 8 KB.

### 5.4 Route-level loading costs
Lazy chunks (gzip): Devotee 29.41, staff-Admin 28.10, staff-Batch 13.93, Wall ≈ 12, staff-DevoteeDetail 8.77,
staff-ExportButton 8.46, staff-Requests 8.33, quotes 8.00, SignUp ≈ 6.5, staff-WeekRead 5.47, staff-ExportSheet 5.10,
staff-Fac 4.67, swipe 3.71, staff-HeadHome 3.40, validate 2.58, BookChapters 1.16. Staff chunks are fetched once and
cached (CacheFirst). The devotee chunk is precached, so a signed-in devotee's navigation costs no network.

### 5.5 Rendering
DOM: 46–47 elements on the public pages; 635 (`/members`, 12 rows) and 703 (`/batch`, 12 rows) measured 19 Oct
at 4× CPU with forced layout < 0.1 ms; lists are paged at 50. No virtualization needed `[verified 19 Oct]`. Timers
and listeners audited 19 Oct (Darshan, Wheel fixed). Blur: ≤ 2 layers; off on Low/Balanced. No measured
re-render hotspots; Svelte 5 fine-grained reactivity keeps derived work local (`[UA]` for the 400-line screens — a
profile of Day and Wall on a throttled phone is a Phase-0 task).

### 5.6 API request patterns per screen — Deliverable 3 ("API on entry"); the two heavy cases: head's Home (8
requests), Scoreboards (`card.of` per row opened).

### 5.7 Budget compliance and the policy (brief §7.2)
Within budget (60) but above target (55) on JS; CSS likewise. **Stage 1 (optimize within budget)** has concrete
headroom: 21 KiB of the startup chunk is unused on the public pages → the public/shell split (A4) is the route
back under target for the public pages while the shell keeps its bytes. **Stage 2** (expansion to ≤ 80): only by
named need, documented per DEPTH §4's ladder; nothing in this blueprint requires it — every proposed byte is lazy
or CSS.

### 5.8 Proposed optimizations — expected impact and confidence
| Item | Expected | Confidence |
|---|---|---|
| A1 single painting fetch + priority | LCP −0.5…−0.9 s; −40 KB | high (the waste is measured) |
| A2 critical CSS inline | FCP/LCP −0.15…−0.6 s (lab says 630 ms blocking) | medium (depends on how much CSS is truly critical) |
| A3 daily darshan entry | −29 KB on every first open | high |
| A4 public/shell split | −≈ 20 KB on Welcome/Login; 0 on the signed-in app | high |
| A5 icons | −35…−200 KB on the first open (icon-192 / -512) | high |
| B1 round trips | `card.of` 3.9 s → ≈ 1 s class; `board.get`, `settings.get` likewise | high (same method as 17 Oct, measured then) |
| B2 optimistic save | perceived save 0 ms; same server cost | medium (STALE reconcile must be right) |
| B3 idle prefetch | second tap −1 round trip | medium |

---

## Deliverable 6 — API and database audit

### 6.1 Journeys → actions → hops (harness measurement; a batch or `reads()` = 1)
| Action | Hops | Statements | Used by |
|---|---|---|---|
| `auth.me` | 4 | 7 | cold open |
| `home.get` | 11 | 24 | devotee Home (repeat open: the only call) |
| `week.get` | 9 | 17 | Day/Week (behalf), Report |
| `journals.get` | 8 | 11 | Hearing/Reading (versioned, cached in IndexedDB) |
| `profile.get` | 11 | 14 | Profile sheet |
| `card.get` | **22** | 25 | My targets / ETP weekly card |
| `card.of` | **25** | 28 | Scoreboards row |
| `board.get` | 13 | 16 | Board2, Scoreboards |
| `settings.get` | 13 | 16 | Settings, head's Home |
| `devotees.get` | 15 | 18 | Devotee detail |
| `stats.batch` | 16 | 19 | Filling chart |
| `stats.all` | 12 | 15 | Overview, head's Home |
| `members.list` / `board.list` / `requests.list` / `announcements.list` / `meta.get` | 5 / 5 / 4 / 4 / 4 | — | — |
`[VI]` Every action above 8 hops is a candidate for the `reads()` pass; `card.*` and `board.get` are new (phases
17–18) and never had it. **N+1 verified in code:** `closingPreview` runs one `COUNT` per member (`closing.js`
loop) — small batches today, still a pattern to replace with one `GROUP BY login`.

### 6.2 Repeated / redundant requests
Head's Home: 8 requests, of which `settings.get` and `stats.all` are the heaviest in the app `[VI]`; Requests: 3
requests that could be one `[PE]`; Scoreboards: one `card.of` per row opened (by design, on demand). No duplicate
requests from component lifecycles were found: `cache.svelte.js` dedupes in-flight loads and the 19 Oct tests
assert call counts (`cache-calls.test.js`).

### 6.3 Payloads
`journals.get` returns 324 lectures + 76 books (versioned, fetched once per version, kept in IndexedDB) — correct.
`stats.all` 14–27 k rows at 2,000 devotees `[PB]` — pre-aggregate per batch (B5). `darshan.json` 94 KB raw / 31 KB
gz on every public page `[VI]` (A3). Lists paged at 40–50. No over-fetching found elsewhere by inspection.

### 6.4 Indexes and schema (read-only)
55 indexes, each introduced from an EXPLAIN that said SCAN (roadmap 2.3); the audit's approved-scan list is 31 with
reasons. Composite keys on the hot paths (`submissions_by_week`, `attendance_by_week`, `memberships_by_login/batch`,
`sessions_last_used`, `person_names_search`, `training_attendance_week`, `fills_by_person`). **No missing index
is claimed**: the hop counts are the lever, not the plans. Schema recommendations: none required for any item in
this blueprint; `batches.kind` (class / training) is the one additive column a product decision (who may delete)
would need — migration, default `class`, no backfill risk.

### 6.5 Data integrity and concurrency (verified by tests and code)
Idempotent writes (`replies` by request id; the gate's `writes.test.js` lists every write action); day versions
(STALE → the server's copy replaces the local one); the Monday deadline job is atomic per run (`GROUP BY login`
fix); permission changes end sessions (`status`/`role` check on every call); account deletion anonymises, never
drops (verified by `account-delete.test.mjs` over every table). No correctness depends on the client: the server
re-validates every field (registry whitelist + `invalid()`).

### 6.6 Capacity (current / measured / projected)
Current: 35 k rows read, 332 written a day (16 devotees). Measured (3 Oct, 2,000 devotees): `week.submit` 9 ms CPU
p50, 36 rows; ceiling ≈ 35 calls/s; deadline job 8–16 ms CPU per run. Projected (5,000 devotees, Sunday): writes
≈ 80–85 k of 100 k `[from PERFORMANCE.md; not re-measured]` — the first real limit; reads stay far under 5 M.

---

## Deliverable 7 — Prioritized issue register (consolidated, deduplicated)

Fields: ID · Priority · Category · Where · Evidence · Proposal · Benefit · Complexity (S/M/L, relative) · Risk ·
Tests required · Bytes · Runtime · Confidence.

| ID | P | Cat | Where | Evidence | Proposal | Benefit | Cx | Risk | Tests | Bytes | Conf. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R-01 | **P0** | process `[VD]` | whole tree | `git ls-files sadhanaRecord` empty; one machine | commit the tree; tag each release; CI runs `npm test` both sides | recoverability | S | none | — | 0 | high |
| R-02 | **P1** | `[MB]` | `card.of`, `card.get`, `board.get`, `settings.get`, `devotees.get`, `stats.batch`, `profile.get`, `journals.get`, `home.get` | hops table; live 3–4 s | `reads()` pass per action, parity diff | 3–4 s → ≈ 1 s | M | parity; `audit:sql` 0 new | per-action parity test, existing suites | 0 | high |
| R-03 | **P1** | `[MB]` | Welcome LCP | double fetch, 3.2 s | A1 | −0.5…0.9 s LCP | S | low | `welcome` part, Lighthouse stored | −40 KB | high |
| R-04 | **P1** | `[VI]` | public pages | 21 KiB unused JS | A4 public/shell split | ≤ 35 KB public | M | lazy loader, smoke checks | gate `logins`, smoke | −20 KB public | high |
| R-05 | **P1** | `[MB]` | all first opens | CSS blocks 630 ms | A2 critical CSS | FCP/LCP | M | duplication | Lighthouse | 0 | medium |
| R-06 | **P1** | `[VI]` | every public page | `darshan.json` 31 KB | A3 daily entry | −29 KB | S | low | `welcome`, `darshan9` parts | −29 KB | high |
| R-07 | **P1** | `[VI]` | head's Home | 8 requests | B1 + one aggregate (`home.staff`) `[PE]` | 8 → 3 requests | M | new action → GATE_OF_RECORD | `roles`, `ownership` | ~0.3 KB | medium |
| R-08 | **P1** | `[UX]`/product | `/members`, `/devotees` | class coordinators can delete | `batches.kind`, gate delete to the head and training coordinators | safety | M | migration (additive) | `roles`, `ownership` | 0 | high (decision needed) |
| R-09 | **P1** | `[UX]` | Day form | 13 entries each day; saves wait | D1 "Same as yesterday", D2 keypads, D3 section bar, B2 optimistic save | time to fill −30 % (est.) | M | data honesty (D1 visible tap); STALE path | Day browser part extended, `writes` | ~2.5 KB lazy | medium |
| R-10 | P1 | `[UX]` | dark mode, all | flat surfaces | C1 tonal steps + highlight | premium dark | S | contrast | contrast validator, dark screenshots | 0 | high |
| R-11 | P1 | `[VI]` | `icon-192/512.png` | 45 / 213 KB | A5 compress | −35…200 KB first open | S | none | — | — | high |
| R-12 | P2 | `[UX]` | Report | empty ring, blank desktop | C6 month numbers, two columns | useful report | M | none | `devotee` part | ~1.5 KB lazy | high |
| R-13 | P2 | `[UX]` | staff Home (coord, head) | thin cards, unbalanced columns | C7 meters/rings, balance | scannable | M | none | `master`, `coord` parts | ~2 KB lazy | high |
| R-14 | P2 | `[UX]` | Day form desktop | right third empty | C8 sticky rail | width used | S | none | screenshots | ~1 KB | high |
| R-15 | P2 | `[PE]` | Home, Week, Day, counters | no reveal/travel | C2 hero wash, C3 count-up, C4 shared-element, C5 scroll settle (High only) | depth, orientation | M | motion audit | `motion-audit`, `p7` | ~2 KB CSS | medium |
| R-16 | P2 | `[VI]` | `closingPreview` | N+1 COUNT | one `GROUP BY` | hops −N | S | none | `phases` tests | 0 | high |
| R-17 | P2 | `[UX]` | IYF IDs | no merge screen (`identity.merge` exists) | build the merge/unmerge sheet with both histories | the head's duplicate work | M | identity rules | `identity` tests, `master` part | ~3 KB lazy | high |
| R-18 | P2 | `[MC]` | `Wall` 504, `DevoteeDetail` 410, `Ids` 380 lines | size | split markup (roadmap 4.2) | maintainability | M | none | existing parts | 0 | high |
| R-19 | P2 | `[MC]` | `Board.svelte` / `Board2.svelte` | names mislead | rename to `BatchStatus` / `FacilitationBoard` | clarity | S | imports | build | 0 | high |
| R-20 | P2 | `[UX-a11y]` | charts | no table twin | E3 "Show as table" | WCAG 1.3.1 | S | none | `a11y` part | ~0.5 KB | high |
| R-21 | P2 | `[UX]` | boards | two selects for the week | D5 week strip | fewer taps | S | none | `coord` part | ~0.4 KB | high |
| R-22 | P2 | product `[PE]` | boards | nudge one by one | D4 nudge-all via WhatsApp | coordinator time | S | expectation | `coord` part | ~0.5 KB | decision |
| R-23 | P2 | `[PB]` | `stats.all` | 14–27 k rows, 55–74 ms CPU in the load test vs 10 ms cap on paper | B5 pre-aggregate; **measure on live with `LOAD_METER=1` first** | head's screens at scale | M | parity | `phase2-stats` | 0 | medium |
| R-24 | P2 | `[UA]` | all | no field data from India | B4 sampled vitals (1/100 → `run_log`) | real numbers | S | writes budget (≈ 50/day at 5 k) | `read-budget` test | ~1 KB | decision |
| R-25 | P2 | ops | releases | no rollback runbook, no cron-failure alert | roadmap 6.5 / 6.6 | reliability | S | none | drill | 0 | high |
| R-26 | P3 | `[PE]` | Requests | 3 requests on open | one `requests.inbox` | −2 requests | S | gate record | `roles` | 0 | medium |
| R-27 | P3 | `[MC]` | `WeekRead.svelte:22` | Svelte `state_referenced_locally` warning | wrap in `$derived`/`untrack` | clean build | S | none | build | 0 | high |
| R-28 | P3 | `[PE]` | splash | shown to returning users | A6 skip when kept | −0.3 s perceived (est.) | S | none | `phase1` part | 0 | medium |
| R-29 | P3 | `[PE]` | Hearing/Reading | position not remembered | D7 | convenience | S | none | `booklang` | ~0.2 KB | high |
| R-30 | P3 | `[PE]` | desktop | no shortcuts | D6 `/`, `[`, `]` | staff speed | S | none | `nav` | ~0.3 KB | medium |
| R-31 | P3 | `[MC]` | `admin.js` `APP_MINTED` | retired `SR` series still admitted | drop `SR` from the regex | clarity | S | legacy rows | `appids` | 0 | high |
| R-32 | P3 | `[UX]` | Activity | log scope unexplained | caption "slow or failed calls only" | clarity | S | none | — | ~0 | high |
| R-33 | P2 | security `[SC]` | login hashing | PBKDF2 10 k < current guidance | F4 25 k after load-Worker measurement | work factor ×2.5 | S | CPU cap | load Worker | 0 | decision |
| R-34 | P2 | product | ETP | removed/left trainee keeps facilitator scope | one server line after the decision | correctness of scope | S | none | `phases` | 0 | decision |
| R-35 | P2 | `[UX]` measured | desktop: IYF IDs, My targets, Wall, History, Scoreboards, Reopens, Day | space audit: 33–60 % of the content column used (§10) | two-column or list-detail layouts from 1024 px (IDs: search + record side by side; card: targets + week; Wall: feed + pinned/new; History: list + month; Scoreboards: board + person card; Reopens: list + request) | desktop staff and devotee screens use their width | M | none | screenshots at 1280/1440, space audit ≥ 70 % | ~2–3 KB lazy | high |
| R-36 | P3 | `[UX]` | public routes | one `document.title` for Welcome / Login / Sign up / Forgot (screen-reader sweep) | per-route titles ("Sign in · Sādhana Record" …) | orientation, SEO (360 §15 P2) | S | none | `screenreader` sweep | ~0.1 KB | high |
| R-37 | P2 | `[UX-a11y]` | Account (devotee), Home (coordinator, head) at 390 | tab order jumps back up the page 3× | put the floating bar / sticky tools after their content in DOM order, or set the focus sequence explicitly | WCAG 2.4.3 focus order | S | layout | `screenreader` sweep, `back-guard` | 0 | high |
| R-38 | P3 | tooling | `tools/browser/screenreader.mjs` | the all-persona run stops at the second sign-in; the `puppeteer-core` import only resolves from `frontend/` | wait for the sign-in button; import by absolute path like `verify.mjs`; make it a gate part | a stored pass per release (E1) | S | none | — | 0 | high |

**Security findings:** no confirmed vulnerability. Verified controls: strict CSP (`script-src 'self'`,
`frame-ancestors 'none'`), no `{@html}`, parameterised SQL (the single interpolated identifier is a column name from
a fixed map, `classweek.js`), token never in a cookie or URL, per-IP limits and lockout, object-level checks guarded
by tests, sensitive values never logged (`run_log` holds action/ms/code), service worker never caches API responses
(`connect-src` API is runtime-fetched, not precached), logout clears localStorage, sessionStorage and IndexedDB
(tested). Patterns to keep validating `[SC]`: the no-OTP model is a deliberate product decision (impersonation
accepted; first-claim-wins with leader-visible provenance) — document it on the pending-approval page for users.

---

## Deliverable 8 — Target-state architecture

**Keep as is (verified sound):** Svelte 5 + Vite + Workbox; the one route table; the token layer and tiers; the
registry-gated Worker; D1 with keyed writes and the SQL audits; the cache/session/prefetch trio; the release gate;
the two-tree workflow (with the same-day copy rule).

**Improve (this blueprint):** startup split into public + shell; `reads()` on every action above 8 hops; one
staff-home aggregate; optimistic saves on the day form; dark tonal steps and hero material; numbers that reveal;
desktop width; the Day form's shortcuts; chart table twins; a stored screen-reader pass; a rollback runbook and
cron alerts; sampled field vitals (if agreed).

**Only after further investigation:** `stats.all` pre-aggregation (measure CPU on live first); PBKDF2 work factor
(load Worker); Hindi interface strings (product); the identity merge screen (needs the head's rules on screen).

**Reliability model:** gate per bulk phase → `npm run deploy` → `npm run release` → live smoke → ledger →
peer broadcast → same-day copy to the revamp; add: commit + tag per release (R-01), rollback runbook (R-25).

---

## Deliverable 9 — Phased roadmap (planning only)

| Phase | Prerequisites | Scope | Acceptance | Risk |
|---|---|---|---|---|
| **0 — Verified baseline** (done today, plus two tasks) | — | this document; Lighthouse stored; hops table; screenshots; **add:** commit the tree (R-01); profile Day and Wall on a throttled phone | all artefacts under `docs/perf/` and `docs/` | none |
| **1 — Correctness & reliability** | decisions R-08, R-34 | `batches.kind` + delete gate; trainee scope rule; rollback runbook; cron alert | `roles`/`ownership` green with the new gates; a rollback drill recorded | low |
| **2 — Performance foundations** (= DEPTH phase 21) | 0 | R-02 R-03 R-05 R-06 R-11 R-16 R-28 | Lighthouse Welcome ≥ 95 / LCP ≤ 2.5 s, Login ≥ 98; every listed action ≤ its hop target with parity; `audit:sql` 0 new; size within 60 | medium (parity) |
| **2b — Public/shell split** (= 22) | 2 | R-04; `size.mjs` public ≤ 35 | gate + stored Lighthouse pair; smoke on every public route | medium |
| **3 — Design-system foundation** (= 23, part) | 0 | R-10 tokens; `Card` hero/raised variants; `SectionBar`, `DayRail`, reveal props | contrast validator green; dark screenshots every route | low |
| **4 — Route-by-route modernization** (= 23) | 3 | R-12 R-13 R-14 R-15 R-20 R-27 R-32; imagery per matrix (R-C9/C10 if decided) | screenshots every route both themes 4 widths; collision sweep 0; motion audit | low |
| **5 — Workflow optimization** (= 24) | 2 | R-09 (B2 D1 D2 D3) R-07 R-17 R-19 R-21 R-22 R-26 R-29 R-30 | taps per daily fill counted before/after; Day browser part; `writes` list; screen-reader pass stored | medium (optimistic path) |
| **6 — PWA / offline / update hardening** | 2b | verify the split under the service worker (navigateFallback, carry-assets for the new public entry); offline launch on both entries; old-client test | `sw` tests + release's self-reload check | medium |
| **7 — Validation and refinement** (= 25) | all | full gate; Lighthouse; load Worker CPU (R-23 R-33); B4 if decided; before/after table | every target in Deliverable 10 met or explained | low |

Independent deliveries: phases 2 and 3 can run in parallel in separate copies (server vs tokens); 2b and 6 are
one coordinated release; 4 and 5 after 3.

---

## Deliverable 10 — Acceptance criteria

| Area | Criterion |
|---|---|
| Visual consistency | every route screenshotted at 390/820/1280/1920 in light and dark; 0 collisions; both themes pass the contrast validator; one hero per screen |
| Workflow efficiency | a repeat day's fill ≤ 5 entries + Save (with D1); save feedback instant (B2); head's Home ≤ 3 requests; board week change 1 tap |
| Accessibility | Lighthouse a11y 100 on public pages; stored screen-reader pass on 5 flows with 0 open findings; every chart has a table twin |
| Performance (lab, mobile profile) | Welcome ≥ 95, LCP ≤ 2.5 s (≤ 2.0 s stretch), FCP ≤ 1.8 s stretch; Login ≥ 98; CLS 0; TBT ≤ 50 ms; public JS ≤ 35 KB; shell within 60; largest lazy ≤ 30; precache ≤ 800 |
| Performance (server) | no action above 8 hops on the devotee or staff paths; `run_log` shows no action averaging > 1.5 s for a week; `week.submit` ≤ 9 ms CPU on the load Worker |
| Correctness | server 55+ suites, client 445+, gate green; parity diffs for every optimised action; `audit:sql` 0 new scans / mass writes |
| Reliability | tree committed and tagged per release; rollback drill performed once; cron failure alert exists; old-client reload proven on each release |

---

## Deliverable 11 — Open questions (not answerable from the evidence)

1. Real-user latency and INP from Delhi phones (needs B4 or a field tool).
2. Behaviour at 5,000 devotees (the 2,000 load test is the last measurement).
3. Whether `stats.all`'s load-test CPU (55–74 ms) is real on the live free plan (it succeeds live; measure).
4. Whether the Day form's numeric fields already open the numeric keypad on Android/iOS (D2).
5. The head's rules for the duplicate-merge screen (what the reviewer must see side by side).
6. Who may delete accounts after `batches.kind` (training coordinators too?).
7. A removed/left trainee's facilitator scope.
8. Hindi interface strings — wanted or not.
9. Acceptable PBKDF2 cost once measured on the Worker.
10. Store distribution (iOS shell, domain) — outside this blueprint but it changes "fast" (no browser chrome).

---

## The seventeen questions, answered

1. **Verified state:** Deliverable 2 — a finished, consistent, tested app at level 3–4.5 everywhere.
2. **Weakest UX:** the ETP coordinator's weekly loop (3–4 s screens), the Day form on a repeat day (13 entries),
   the Report screen's emptiness, desktop width use.
3. **Light/dark inconsistency:** no screen is wrong in dark; all read flatter (surface steps); Home, Week, Account
   show it most.
4. **What stops it feeling polished:** flat dark surfaces, equal-weight cards, numbers that do not reveal, empty
   desktop thirds, waits on the newer screens.
5. **Time wasted:** the 13 daily entries; one-at-a-time nudges; the head's 8-request Home; 3–4 s boards.
6. **Frontend problems with measurable consequences:** double painting fetch, blocking CSS, unused public JS,
   heavy icons and catalogue (all in Lighthouse).
7. **API calls unnecessary/repeated/inefficient:** head's Home 8 (two heavy); Requests 3; `card.of`/`card.get`/
   `board.get`/`settings.get`/`devotees.get`/`stats.batch` hop counts; `closingPreview` N+1.
8. **Queries/indexes deserving attention:** none missing; the lever is hops; `stats.all` rows at scale.
9. **Backend/DB changes with the greatest return:** R-02 (zero bytes, 3–4 s → 1 s), R-07, R-16, then R-23.
10. **Security/data-integrity:** no confirmed vulnerability; integrity enforced server-side and tested; keep the
    no-OTP decision documented; raise PBKDF2 after measuring.
11. **Offline/update limits:** sound; no write queue by design; the one untested combination is the public/shell
    split under the service worker (phase 6).
12. **Staying within ≈ 60 KB:** split public/shell (−20 KB public), keep every new byte lazy or CSS.
13. **What could justify more bytes:** nothing here; the ladder (DEPTH §4) says how a named feature would.
14. **Final design system:** the current one with dark tonal steps, a hero material, reveal props, a section bar,
    a day rail, chart table twins — Deliverable 4.
15. **Order:** R-01 → performance foundations (R-02…R-06, R-11) → public/shell split → tokens → routes → workflows
    → validation (Deliverable 9).
16. **Success:** Deliverable 10.
17. **Assumptions to verify first:** Deliverable 11 items 1–4 and 9.

**Recommended target state in one paragraph.** The same Sadhana Record — same roles, flows, rules, routes and
contracts — with Welcome under 2.5 s on a slow phone, every screen answering in about a second, dark mode as
deliberate as light, one hero per screen that reveals its numbers, desktop width used, a repeat day filled in a
handful of taps, every chart readable by a screen reader, and the whole tree committed, tagged and rollback-ready.
Phases: 0 baseline (commit) → 1 correctness → 2 performance foundations → 2b public/shell split → 3 tokens and
variants → 4 routes → 5 workflows → 6 PWA hardening → 7 validation — each through the existing gate.

---

## §10 Appendix — today's scripted runs (dev server, mock API, 21 Oct)

- **`verify.mjs a11y`** (keyboard reach, names, focus on the main flows): **3 passed, 0 failed.**
- **`space-audit.mjs`** (desktop use of width, 90 route views at 1280 and 1440 px; `fill%` = share of the content
  column holding content, `right⅓%` = share of the right third used): median fill **78 % at 1280, 74 % at 1440**;
  **0 overlaps**. The emptiest desktop screens `[UX]`: IYF IDs 33–39 %, My targets 40–49 %, Wall 50–57 %, History
  54–55 %, Scoreboards 54–55 %, Reopens 57–60 %, the Day form 71–78 % (right third 12–33 %). Registered as R-35.
- **`screenreader.mjs`** (scripted announcement sweep — accessible names, roles, live regions, focus order — run
  per persona at 390 and 1280 px; 60 route loads in all): **0 blockers, 0 majors, 7 minors of 3 distinct kinds**:
  (1) `document.title` is the same on every signed-out route (SEO/orientation, `[UX]`, registered as R-36);
  (2) tab order jumps back up the page 3× on the devotee Account and on the coordinator's and head's Home at
  390 px — the floating/fixed elements come earlier in DOM order than they appear (`[UX-a11y]`, R-37);
  (3) nothing else. The tool only ran per persona: a run over all personas in one process stops at the second
  sign-in (`button[type=submit]` not found) — a tool defect, not an app one, to fix in `tools/browser` (R-38).
  This is a scripted pass, not a TalkBack/VoiceOver session (Deliverable 2.12).
