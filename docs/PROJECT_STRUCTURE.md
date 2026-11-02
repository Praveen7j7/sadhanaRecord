# Project structure — Sadhana Record

**12 October 2026 · read from the tree as it is, not from older documents.** Every path below exists; counts were
taken with `find`/`wc` on this date. Nothing was changed to write this.

Use this page to answer *"where does X live, and where do I change it?"*. The design reasoning is in
`ARCHITECTURE.md`; the tables in `DATABASE.md`; the actions in `API_REFERENCE.md`.

## 1. The tree (two levels)

```
sadhanaRecord/
├── README.md                 folder map (partly stale: see §6)
├── RELEASE-16-NOTES.md
├── shared/                   code used by BOTH the server and the app (4 files, 225 lines)
│   ├── scoring.js            the card scoring: day marks, week percentages (the only scoring code)
│   ├── exportfields.js       the export catalogue's field list
│   ├── places.js             address pick-lists (states, districts)
│   └── skills.js             the profile's skills list
├── worker/                   THE SERVER — Cloudflare Worker + D1 (live: sadhana-record-api.…workers.dev)
│   ├── wrangler.toml         bindings, crons, vars, the separate load-test env
│   ├── package.json          test · dev · deploy · migrate:local · migrate:remote · audit:sql
│   ├── src/                  33 modules, 6,383 lines (see §2)
│   ├── migrations/           40 SQL files, 0001 → 0041 (no 0040), 3,395 lines
│   ├── tests/                35 files, 3,690 lines: node tests on SQLite (no network), the SQL audits
│   └── .dev.vars             local secrets (PW_PEPPER); never commit
├── frontend/                 THE APP — Svelte 5 PWA (live: sadhana-record.…workers.dev as static assets)
│   ├── vite.config.js        PWA (workbox) config, chunk naming, /version.json, $shared alias
│   ├── wrangler.jsonc        static-asset deploy, 404-page handling
│   ├── build-id.js           the build id sent as `app` in every call
│   ├── release-phase.json    which modernization phase this tree is (read by the release gate)
│   ├── index.html            the page, the splash
│   ├── public/               866 files: _headers (CSP, caching), push-sw.js, 404/privacy/delete-account pages,
│   │                         icons, brand, darshan/ (843 files, 118 MB — never precached)
│   ├── src/                  173 files, 15,855 lines (see §3)
│   ├── scripts/              size.mjs (budget), release.mjs (guarded publish), carry-assets.mjs, icons.mjs, shots.mjs
│   ├── tests/                24 vitest files, 2,239 lines
│   ├── dist/                 the last build (120 MB, mostly darshan/); the gate compares it with production
│   └── .env.production.local VITE_API_URL only
├── tools/                    checks and utilities (each has a matching ../.claude/skills/sadhana-* skill)
│   ├── browser/              verify.mjs (1,240+ browser checks at 11 widths), components, motion/space audits, screenshots
│   ├── release/              gate.mjs + phases.json: the phase gate (checks → stamp → check → release → record)
│   ├── perf/                 lighthouse.sh, sqltrace.mjs (SQL per call), viewcpu.mjs (view-sheet CPU)
│   ├── sheets/               sync-audit.mjs (live, read-only: D1 vs Sheets)
│   ├── identity/             service-token.mjs (the scoped dashboard token), import-people.mjs
│   ├── docs/                 Markdown → branded PDF
│   ├── brand/, video/, devices/
├── loadtest/                 the load test (separate Worker + database; never live)
├── setup/                    one-time builders: schema.mjs (Sheets tabs), build-*-sql.mjs (data migrations), migrate-to-d1.mjs
├── backend/                  RETIRED Apps Script server (replaced by worker/ on 2 Oct 2026); reference only
├── brand/                    official logo sources
└── docs/                     all documentation (this folder); see §5
```

Sibling trees in the parent folder (not part of this app's code path): `sadhanaRecord-revamp/` (working copy of the
UI revamp; its `docs/` files are **hard links** to this tree's `docs/` — editing one edits both), `sadhanaRecord-phase5/`
and `sadhanaRecord-phase6/` (stale snapshots of released phases).

## 2. Server modules — `worker/src/`

| Module | Lines | Owns | Tables it touches (main) |
|---|---|---|---|
| `index.js` | 119 | the Worker: `fetch` (CORS, GET health, POST → `apiCall`), `scheduled` (the minutely run, the two reminder crons) | `run_log`, `replies`, `counters`, `sessions` (tidy) |
| `api.js` | 233 | **the route table** (122 actions), the gate order, the replay cache, the Run Log | `replies`, `run_log` |
| `session.js` | 49 | token → caller; sliding expiry; ending sessions | `sessions`, `accounts` |
| `db.js` | 113 | `q/one/all/run`, the per-request memo (`requestDb`), `scopesOf`, `scopeBatches`, `audit`, `isStaffAccount`, `dirty` | `settings`, `batches`, `memberships`, `leaders`, `audit_log`, `mirror_state` |
| `util.js` | 106 | `ApiError`, Indian time (`isoIst`, `mondayOf`, `ymd`), phone/login/name/password rules | — |
| `crypto.js` | 55 | PBKDF2 + pepper, session tokens, constant-time compare | — |
| `auth.js` | 292 | sign-up, lookup, login (lockout), logout, change password, reset requests, `auth.me` | `accounts`, `sessions`, `reset_requests`, `counters`, `profiles` |
| `contact.js` | 65 | email / WhatsApp / class-day / address checks (mirrored in `frontend/src/lib/contact.js`) | — |
| `requests.js` | 152 | coordinator approvals: sign-ups, resets; registry search | `accounts`, `memberships`, `reset_requests`, `registry` |
| `weeks.js` | 481 | **the weekly form**: `home.get`, `week.get`, `saveDay`, `saveWeekEnd`, `setAttendance`, `submit`, history, the Monday deadline job | `drafts`, `submissions`, `attendance`, `missed_weeks`, `class_weeks`, `reopens` |
| `classweek.js` | 66 | attendance rules shared by the form, group leaders and coordinators | `class_weeks`, `attendance` |
| `weekjson.js` | 41 | the submitted week as one JSON (decision 42) | `submissions` |
| `rules.js` | 106 | `rules.get`, `journals.get`, `books.setCurrent` | `card_ranges`, `seva_rules`, `chetna_options`, `lectures`, `books`, `book_files` |
| `cards.js` / `scoring.js` | 112 / 10 | the two score cards as data; re-export of `shared/scoring.js` | — |
| `coord.js` | **871** | coordinator and master tools: board, members, devotee detail, profile, photos, status changes, delete, class weeks, attendance, stats, reopen, audit/run-log views, settings, duplicates | most tables |
| `admin.js` | 467 | `meta.get`, coordinators, batches, IYF ID links, app IDs, masters, head requests | `accounts`, `batches`, `registry`, `app_ids`, `head_requests` |
| `identity.js` | 297 | the IYF identity record (0038): search, get, link, mint, supersede, mintBatch, service tokens | `persons`, `person_*`, `id_sequences` |
| `registry.js` | 224 | the registry copy from the dashboard's Devotees tab (every 30 min), facilitator refresh | `registry`, `facilitators` |
| `groups.js` | 155 | group leaders (decision 41): group list/mark, leaders list/set/assign | `leaders`, `attendance` |
| `facilitator.js` | 228 | facilitator logins and their read-only views | `accounts`, `memberships`, `submissions` |
| `facilitators.js` | 77 | the facilitator list (add / active / delete) | `facilitators` |
| `announcements.js` | 417 | the wall: posts, images, likes, comments, reports, mutes, resolve | `announcements`, `announcement_images`, `post_*` |
| `push.js` | 325 | Web Push: register/subscribe/renew, 9 PM reminders (sharded), announcement pushes, attendance notices | `push_subs`, `push_jobs`, `reminder_progress` |
| `exports.js` | 280 | the export catalogue and paged export (rate-limited, logged) | read-only over many tables |
| `erase.js` | 159 | deleting a devotee: D1 rows and the append-only Sheets tabs | many |
| `retention.js` | 80 | log retention (audit, run log, Sheets logs) | `audit_log`, `run_log` |
| `mirror.js` / `mirrorkeys.js` | 325 / 46 | D1 → Sheets copy (triggers → `mirror_log` → 300 rows a run) | `mirror_*` |
| `views.js` | 308 | the four batch view sheets | `view_*` |
| `google.js` | 63 | Sheets API as the service account (JWT → access token) | — |
| `setup.js` | 35 | master-password recovery from the `MASTER_RESET_PASSWORD` secret | `accounts` |
| `loadmeter.js` | 26 | row metering for the load-test Worker only | — |

Where business rules live, by topic:

- **Scoring** → `shared/scoring.js` only (the app imports it as `$shared/scoring.js`).
- **Week state machine, deadline, part weeks** → `worker/src/weeks.js` (`missingOf`, `stateOf`, `runDeadline`); mirrored on the phone by `frontend/src/lib/daylogic.js`.
- **Who may do what** → the `roles` column of `ROUTES` in `api.js`, then each handler's own narrowing with `scopeBatches` / `isStaffAccount` (see `AUTHORIZATION.md`).
- **Attendance** → `classweek.js` (+ `groups.js` for leaders, `coord.js` for staff).
- **Input rules** → `util.js` (phone, login, name, password), `contact.js` (email, WhatsApp, address, class day).

## 3. App modules — `frontend/src/`

| Folder | Files · lines | What goes here |
|---|---|---|
| `main.js`, `App.svelte` | 169 | start-up: `restore()`, route → screen file (lazy), public/forced-password/shell branches, splash |
| `lib/` | 57 · 4,680 | **everything that is not a component**: router, session, api client, cache, saver, scopes, nav model, validation, pure helpers, device tier, theme, push, mocks |
| `ui/` | 59 · 2,698 | shared components: Shell (bars, menu, bell), form controls, Sheet (dialogs), EmptyState, Skeleton, Banner, Toaster, charts (Bars, Ring, Trend, Spark), Darshan, QuoteCarousel, WeekRead |
| `screens/` | 12 · 1,384 | screens every role shares: Welcome, Login, SignUp, Forgot, ChangePassword, Home (dispatches to a role home), DevoteeHome, Profile, Account, DeleteAccount, HowTo, PhotoCrop |
| `devotee/` | 15 · 2,211 | the devotee's own screens: Devotee (sub-router), Day, Week, History, Report, Reading/Hearing (+ lists, pickers, BookFiles), Wall, Group (group leader) |
| `coord/` | 10 · 1,651 | coordinator screens: Batch (tabs), Board, Members, Leaders, Stats, Requests (+ SignUpCard), DevoteeDetail, Birthdays, StaffHome |
| `fac/` | 1 · 204 | the facilitator's "My students" |
| `master/` | 11 · 1,624 | the IYF head's Admin (tabs): Overview, Coordinators, Batches, Facilitators, Ids, Reopens, Activity, Settings, HeadHome, `sync.js` |
| `styles/` | — | `screens.css` (lazy screens' styles), `auth.css`, `seg.css`; `app.css` is the start-up CSS |

Key `lib/` files a developer touches most:

| File | Lines | Role |
|---|---|---|
| `router.svelte.js` | 116 | hash router `#/path`, view transitions, the unsaved-changes leave guard, scroll memory |
| `session.svelte.js` | 84 | `session.user`, `restore()` (kept user + `auth.me`), `logout()`, `endHere()` |
| `api.js` | 174 | `call(action, data)`: token, `requestId` reuse on retry, BUSY retries, 15 s timeout, server clock skew, the `WRITES`/`PUBLIC` sets (must match `worker/src/api.js`) |
| `cache.svelte.js` | 128 | read cache (memory + sessionStorage + IndexedDB, per login scope, 2-minute max age), `READS` registry, `prefetch` |
| `saver.js` | 129 | one day's answers: draft in IndexedDB, diff-only save with version, STALE handling |
| `weekstore.js` | 37 | local update of cached weeks after a write (no refetch) |
| `scopes.js`, `nav.js`, `area.js` | 12 / 77 / 32 | scopes from `auth.me`; the one navigation model; the accent area per route |
| `validate.js`, `contact.js` | 87 / 39 | client-side mirrors of the server rules (server stays the authority) |
| `tier.js`, `motion.js`, `theme.js` | 126 / 30 / 52 | device tier (high/balanced/low), reduced motion, theme |
| `sw.js`, `push.js`, `pushask.js` | 29 / 96 / 10 | service-worker registration + reload policy; Web Push on this phone |
| `mock*.js` | 1,970 | the in-memory API used when `VITE_API_URL` is unset (dev, browser checks); excluded from production builds |

## 4. Tests and checks

| Where | Runner | What |
|---|---|---|
| `worker/tests/*.test.mjs` | `cd worker && npm test` (`run-all.mjs`) | 30 suites on SQLite in Node; Google and push are faked |
| `worker/tests/query-plans.mjs`, `write-audit.mjs` | `npm run audit:sql` | every SQL statement's plan (no full scans) and the writes per action |
| `worker/tests/security-roles.test.mjs`, `audit-allow.mjs` | part of `npm test` | role gate per action (see `TESTING.md` for what is and is not covered) |
| `frontend/tests/*.test.js` | `cd frontend && npm test` (vitest) | client logic, mock permission rules, contrast, sw, cache, deletion |
| `tools/browser/verify.mjs` | `node tools/browser/verify.mjs` with `vite --port 5199` | 1,240+ browser checks, every screen and role, 11 widths |
| `tools/release/gate.mjs` | `node tools/release/gate.mjs checks|check|record|status|smoke` | the phase gate; `npm run release` calls it |

## 5. Documentation map — `docs/`

| Group | Files | Status |
|---|---|---|
| **Verified current state** (12 Oct 2026) | `DATABASE.md`, `DATA_DICTIONARY.md`, `API_REFERENCE.md`, `AUTHORIZATION.md`, `DEFECTS_VERIFIED.md`, `ARCHITECTURE.md`, `PROJECT_STRUCTURE.md` (this), `FRONTEND_GUIDE.md`, `INTEGRATIONS.md`, `OPERATIONS.md`, `TESTING.md`, `PERFORMANCE.md`, `USER_FLOWS.md` | authoritative; corrections noted inside each |
| **The audit and the plan** | `FULL_AUDIT_2026-10-12.md`, `IMPLEMENTATION_ROADMAP.md`, `LMP_ARCHITECTURE.md`, `DECISIONS/` | proposals, clearly marked |
| **Design history** | `sadhana-app-design.md` (decisions 1–45), `sadhana-api-contract.md`, `development-history.md`, `stakeholder-brief.md` | background; the contract is **older than the code** (122 actions now) |
| **UI revamp (plan of record)** | `revamp/` (README, UI_UX_360, DESIGN_SYSTEM, ROUTE_BY_ROUTE, FINAL_FEATURE_MATRIX, PERFORMANCE_SEO_ACCESSIBILITY, IMPLEMENTATION_ROADMAP, REVAMP_PROGRESS) | current for UI work |
| **Operations** | `backup-restore.md`, `go-live-checklist.md`, `phase-gates.md`, `releases/`, `load-test-report.md`, `store-distribution-audit.md`, `account-deletion-plan.md` | current |
| **Superseded** | `modernization-audit.md` (counts corrected 12 Oct; assessments as of 4 Oct), `ux-modernization-proposal.md`, `pre-store-revamp-review.md`, `sadhana-entry-sheet-plan.md`, `phase6-route-inventory.md`, `screens-status.md` | read for history only |

## 6. Things in the tree a newcomer should know

1. **The app is not under version control.** The parent folder is a git repository with one commit (`phase0`) and
   `sadhanaRecord/` is entirely untracked. Rollback today means "the previous Cloudflare version" (`wrangler versions`),
   not a commit. See `OPERATIONS.md` and the roadmap's first task.
2. **`docs/` is hard-linked with `sadhanaRecord-revamp/docs/`** (same inode). Edit either path and both change. New files
   are not linked automatically.
3. **`README.md` files are partly stale**: `worker/README.md` says the Sheets copy runs every 5 minutes (it is every
   minute, `wrangler.toml`); `frontend/README.md` still describes the Apps Script URL and Cloudflare Pages
   (`_headers` is honoured by Workers static assets, so the file itself is still right).
4. **`backend/` is retired code** (Apps Script). Nothing imports it. Keep or archive, but do not change it.
5. **`frontend/src/lib/mock*.js` is 1,970 lines of a second implementation of the server rules** for dev and the
   browser checks. It is excluded from production builds (`vite.config.js`), but it must be kept in step by hand —
   there is no test that diffs it against the server.
6. **Two routing tables must agree by hand**: `worker/src/api.js` `ROUTES` (the truth) and the `WRITES` / `PUBLIC` sets
   in `frontend/src/lib/api.js`. Today they differ only by `push.renew` (called from `public/push-sw.js` with its own
   request id, so harmless) and the public push actions (called without a token anyway).
7. **`coord.js` is the one oversized server file** (871 lines, ~30 actions across profile, photos, staff tools, stats,
   settings, duplicates). Splitting it is justified by responsibilities (see `IMPLEMENTATION_ROADMAP.md`), not by length.
8. **`public/darshan/` is 118 MB of paintings** in the deploy (not in the offline install). Each `wrangler deploy` of the
   app uploads only changed files, but a fresh clone deploy carries all of it.

## 7. "I need to change…" — where to go

| Change | Server | App | Tests to update |
|---|---|---|---|
| a scoring rule | `shared/scoring.js`, `worker/src/cards.js` | (shared) | `worker/tests/scoring.test.mjs`, `frontend/tests/scoring-shared.test.js` |
| the day form's fields | `weeks.js` (`missingOf`, validation), `weekjson.js` | `devotee/Day.svelte`, `lib/daylogic.js`, `lib/saver.js` | `weeks.test.mjs`, `frontend/tests/weeks.test.js` |
| a new action | `api.js` ROUTES + the module | `lib/api.js` WRITES (if a write) + the screen; `lib/cache.svelte.js` READS if cached | `security-roles.test.mjs` (add the role case), the module's test |
| who may call an action | `api.js` `roles`, then the handler's `scopeBatches` / ownership | `lib/scopes.js`, `lib/nav.js` (what shows) | `security-roles.test.mjs`, `scopes.test.mjs` |
| a table or column | a **new** migration `0042_…sql` (additive), `mirrorkeys.js` + triggers if copied to Sheets, `setup/schema.mjs` for the tab | — | `mirror.test.mjs`, `query-plans` |
| sign-up / profile fields | `auth.js`, `contact.js`, `coord.js` (`profileUpdate`) | `screens/SignUp.svelte`, `screens/Profile.svelte`, `lib/validate.js`, `lib/contact.js` | `phase1.test.mjs`, `address9.test.mjs`, `frontend/tests/ui-logic.test.js` |
| the Sheets copy | `mirror.js`, `mirrorkeys.js`, `views.js`, `erase.js` | — | `mirror.test.mjs`, `views.test.mjs`, `tools/sheets/sync-audit.mjs` (live) |
| notifications | `push.js`, `index.js` crons | `lib/push.js`, `public/push-sw.js` | `push.test.mjs` |
| navigation / a new screen | — | `App.svelte` (route → file), `lib/nav.js`, `lib/area.js`, `ui/Shell.svelte` | `frontend/tests/nav.test.js`, `tools/browser/verify.mjs` |
| the release | — | `scripts/release.mjs`, `release-phase.json` | `tools/release/gate.mjs` |
