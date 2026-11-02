# UI/UX modernization + performance engineering — one plan, two lanes

**19 October 2026.** Two briefs arrived for the same app at the same time: a UI/UX modernization and a performance
engineering pass. This merges them into one phase sequence with the scope **split into two lanes that can run at
once without touching the same files**, and both land in **one release** (phase 20) through the full gate, as the
head decided on 18 Oct. Both briefs are menus: this takes what fits the free plan, low-end phones and the rules in
`CLAUDE.md`, and says what it leaves out and why.

**Where the work happens:** `sadhanaRecord-revamp/` (frontend AND worker). Never the live tree — peers deploy
whatever sits on the live disk, which is how the 17 Oct worker changes went out unannounced. `revamp/docs` is a
symlink to the live `docs/`, so documents are written once.

**Release gate:** prompt-05 is releasing phase 19 (Hindi books) from the live tree now. Nothing syncs revamp→live
until that is live and committed. Then the revamp is synced over live as **phase 20, bulk**, one gate run.

---

## 0. What both briefs ask for that is ALREADY DONE (do not redo)

Verified in the code and the measurements on 19 Oct, not from the documents:

| Brief asks for | Status | Evidence |
|---|---|---|
| Design tokens, light + dark as a system, role accents as markers, brand blue | ✅ phases 0–18 | `app.css` 90 tokens, `[data-theme]`, `[data-area]`, `[data-tier]`; decision D1 in `docs/revamp/DESIGN_SYSTEM.md` |
| Hardcoded colours removed | ✅ | 15 left, all legitimate (mask gradients `#000`, photo backdrop, canvas flatten) |
| Focus, hover, pressed, disabled states | ✅ | global `:focus-visible` ring (`app.css:213`), `:active` scale on btn/iconbtn/rows/chips/seg, 14 disabled rules, reduced-motion override |
| Icon system, no library, accessible names | ✅ phase 18 | 47 icons, ~11 B each, `aria-hidden` + `IconButton` label |
| Empty, loading, error states | ✅ | `EmptyState` (12 sites), `Skeleton`, `Banner`, `Toaster`, `Status` |
| One nav model, one route table | ✅ | `lib/nav.js`, `routes.js` |
| Budgets enforced | ✅ | `scripts/size.mjs`: JS 56.76/60 KB, CSS 13.85/15, precache 672/800 KB |
| Round trips on the devotee path | ✅ 17 Oct | auth.me 8→4, home.get 22→10, week.get 17→9; parity-proven |
| Query plans, scans, mass writes | ✅ | `audit:sql` 0 new; schema-derived growing-table list |
| D1 budget | ✅ | 36.6 k rows read / 553 written a day (<1 %) |
| Request dedupe, idempotent writes | ✅ | `api.js` in-flight ids + server `replies` table; `cache.svelte.js` shared loads |
| Tests | ✅ | server 55 suites / 2,913; client 32 files / 435; browser gate 1,847; collision sweep |

**So neither brief is a rebuild.** What remains is a short list of real items, below.

## 1. What is NOT taken, and why

| From | Dropped | Why |
|---|---|---|
| UI | glass, gradients, illustrations, charts library, "modernize every route" re-skin | budget at target; the design system is decided (D1); finished devotee screens are not touched (head: don't disturb the wiring) |
| UI | new primitives / component framework | the primitives exist; new ones only if a screenshot shows a gap |
| Perf | Redis, summary tables, background jobs, virtualization | no measured need; free-plan rules forbid writes to record nothing; lists are paged |
| Perf | cross-request caches of settings/batches | staleness after a head's change; hop already removed by `reads()` |
| Perf | load test against production | forbidden by the brief itself; the load Worker exists for this |
| Both | any backend behaviour change, schema change, scope or route change | out of both briefs' permission; product decisions stay open (trainee scope, who may delete) |

---

## 2. Lane ownership (so two sessions never edit the same file)

| | **UI lane** | **Perf lane** |
|---|---|---|
| Owns | `frontend/src/ui/*`, `frontend/src/styles/*`, `app.css`, every screen component in `screens/ coord/ master/ fac/ devotee/` **except** the files below | `frontend/src/lib/*` (api, cache, session, meta, prefetch, staff.js), `App.svelte`, `vite.config.js`, `scripts/*`, `worker/src/*`, `worker/tests/*`, `worker/migrations/*`, `tools/perf/*` |
| Shared screens with a perf item | `devotee/Report.svelte` → **Perf lane** (P-7) · `coord/Members.svelte` → **UI lane** (render cost measured by Perf lane, change made by UI lane) | |
| Tests | `frontend/tests/*` for screens it changes; `tools/browser/verify.mjs` parts for those screens; **`frontend/src/lib/mock*.js`** (the fixtures the browser checks run against — screen work, so UI lane, the one exception to "lib is Perf") | `frontend/tests/*` for lib; `worker/tests/*`; `tools/perf/*` |
| Docs | `docs/perf/` screenshots + Lighthouse (shared, written once) | `docs/perf/` baselines, traces |

Rule: a lane that needs a file the other owns **messages first** (ListAgents) and waits. Neither lane runs a browser
verify while the other edits `frontend/src` (hot reload drops the mock clock). Dev server for the revamp: **port
5195**; the live tree's gate uses 5199.

**The docs symlink.** `sadhanaRecord-revamp/docs` → `../sadhanaRecord/docs`. Any sync that copies the link as a
directory (`rsync --copy-dirlinks`, `--no-links`, a plain `cp -r`) replaces it with a REAL folder, and from then on
the two trees' documentation diverges silently. The revamp→live sync must exclude `docs/` or preserve links
(`rsync -a` keeps them). Check after every sync: `ls -ld sadhanaRecord-revamp/docs` must still print `l…`.

---

## 3. Phases

Each phase has a UI half and a Perf half that run together. A phase ends with its own check; the release is one.

### Phase 0 — Baseline (shared, done 19 Oct)
- Revamp == live (prompt-05 synced; `diff -rq` clean). Client 435/435, build green, sizes as in §0.
- Route → component → API → SQL map: `routes.js` + `api.js` registry + `tools/perf/sqltrace.mjs`.
- Open: Lighthouse has never been stored. Phase 5 writes it.

### Phase 1 — Startup and screens
| UI lane | Perf lane |
|---|---|
| Screenshot every route for every persona at 390 light / 1280 dark on the revamp server (`tools/browser/shoot.mjs`, scratch copy on :5195). **Look**, then list real defects only: collisions, misalignment, inconsistent spacing, a primitive used wrongly. No re-skin. | **One call at open**: `session.restore()` calls `auth.me` and `home.get` together; `home.get` now carries `user`. Make a devotee's repeat open one call; keep `auth.me` the authority on cold start, sign-in, role change. Measure calls per open before/after. |
| Fix the defects found in the primitives first (`Row`, `Status`, `Tabs`, list spacing), so every screen gains at once. | **Startup budget**: JS 56.76 KB against a 55 KB target. P-8: ~75 KB raw of staff-only code still precached; widen the `staff-` chunk test in `vite.config.js`. Target: back under 55 KB without slower navigation. |
| Check: screenshots re-taken, collision sweep 0, client tests green. | Check: `npm run size` under target or a written reason; parity diff on `auth.me`/`home.get` responses; `tests/` for session restore. |

**Phase 1 UI — what the screenshots showed (19 Oct, 67 views + 8 facilitator views, 0 page errors).**
The staff screens are on the system's primitives and read as one product with the devotee screens; the status
map's "functional, plain" verdict was wrong and is corrected there. One defect class, on every admin page: Export
sat in its own row above the page, the page put its count and primary action in a second row, and Refresh in a
third — three lines of chrome before the list on a phone, each aligned differently. **Fixed:** `Admin.svelte`
passes Export to the page as a `tools` snippet; Overview, Coordinators, Facilitators, Batches and Reopens lay
Refresh · Export · primary action in one `.ph-tools` cluster in their own `page-head` (`styles/screens.css`).
Batch setup's explanatory sentence ("A batch's level sets…", against the head's rule) became the batch count.
Verified: build green, client 440/440, after-screenshots at 390 light and 1280 dark. Devotee-side and
coordinator-side toolbars were already single-row and are untouched.

**Phase 1 Perf — one call on a devotee's repeat open (19 Oct).** Every open asked twice: `auth.me` for identity,
`home.get` for the weeks. `home.get` already carried the same `user` object (worker `weeks.js:303`), so for a
devotee this phone has shown before the first answer serves both. Gated narrowly — `kept && scopesOf(kept).devotee`
— so a cold open, staff with no devotee scope, a changed role and a different person on the phone all still ask
`auth.me`; if `home.get` ever lacks `user` (an older API mid-release) it falls back. **The mock had to be fixed
first**: the worker returned `user`, the mock did not, so the browser checks would have proved the wrong thing.
Tests: 3 new in `cache-calls.test.js`, confirmed **red on the old code, green on the new**; 443 client tests pass.
**One regression caught and fixed in the same pass:** importing `HOME` from `weekstore.js` pulled the week store
and `daylogic` into the STARTUP chunk, +1.63 KB — the entire remaining headroom. The constant is declared locally
instead; startup is 56.87 KB, 0.11 KB over the pre-change baseline for a whole round trip removed.

### Phase 2 — Staff screens and the API path
| UI lane | Perf lane |
|---|---|
| Facilitator (`fac/Fac.svelte`), admin lists (`master/Coordinators, Facilitators, Activity, Overview`), `coord/Members`: only what Phase 1's screenshots showed. Members row chips: **after** the Perf lane's render measurement. | **Report month** (P-7): up to six `week.get` per month view → one bounded `weeks.getMany` or per-day percents already in `history.list`; prove rows read do not rise. |
| Rename, not merge: `Board.svelte` (batch status) and `Board2.svelte` (facilitation board) are two screens with confusing names, not a duplication. A rename is optional and touches `Batch.svelte` (Perf lane's `App.svelte` is not involved). | **Long-list render cost**: `/members` and `/board` at 300 rows on a throttled profile (puppeteer CPU 4×). Numbers to the UI lane before chips ship. |
| | `staff.js:129` stale comment ("Sunday for everyone") — comment only. |
| Check: changed screens screenshotted phone + desktop, light + dark; `verify.mjs` parts for those screens. | Check: `sqltrace` statements per action, `statscost.mjs 2000`, `audit:sql` 0 new. |

**Phase 2 Perf — the long-list worry does not survive measurement (19 Oct).** The fear was hundreds of rows ×
an extra DOM node. Measured on the dev server at 390 px with the CPU throttled 4× (a low-end phone), after waiting
for the rows to actually render:

| Screen | Rows | DOM nodes | Forced layout |
|---|---|---|---|
| `/members` | 12 | 635 | < 0.1 ms |
| `/batch` board | 12 | 703 | < 0.1 ms |

And the list is **paged at 50** (`Members.svelte:28`, mock and worker agree), so the worst case is 50 rows, not
300. An icon chip per row is ~50 extra nodes on a page already at ~635. **Verdict: the render cost is not a
reason to avoid the chips.** Whether they belong is a design question, and the screenshots say the rows read well
as they are, so none were added. Also confirmed closed: the Report month view (`history.list` carries `dayPct`;
`cache-calls.test.js` asserts no `week.get` loop) and P-8 (0 staff chunks in the 108-entry precache).

### Phase 3 — Interaction, rendering, resources
| UI lane | Perf lane |
|---|---|
| Verify (not add): keyboard focus order on every dialog and sheet, screen-reader names on every icon button, reduced-motion on every rotator, 44 px targets. Fix what fails. | Listeners and timers that outlive their component (the `Wheel.svelte` settle timer was one, fixed 18 Oct): grep `setTimeout`/`addEventListener` in `ui/*` for missing cleanup. |
| ~~The dev mock's class day~~ — **already done** (found 19 Oct in the phase-19 sync): `mock.js` keeps `classDay` on the batch "as the server does since 0051", `attendanceOpens(w, classDay)` takes the day, and all six call sites pass the batch's day. Item 9 of `REPORTED-2026-10-17.md` can be closed. | `week.submit` at 9 ms CPU p50 against the 10 ms cap: measure on the load Worker; no code change unless it crosses 9.5. PBKDF2 10 k iterations: measure 50 k / 100 k there; decision to the head. |
| Check: `tools/browser/screenreader.mjs`, `motion-audit.mjs`, `back-guard.mjs`. | Check: load Worker run with `LOAD_METER=1`; CPU figures written to `docs/perf/`. |

**Phase 3 Perf — two timers fixed, one number for the head (19 Oct).**
- **`Darshan.svelte`**: a painting's `decode()` and an `<img>` `onload` each set timers that wrote component state
  on their own clock, so they could fire after the person had left the screen — the same shape as the wheel
  picker's settle timer, which reached a devotee as a page error in phase 18. Every timer is now tracked and
  cleared on unmount, with a `gone` guard for one already in flight. The other six `ui/` components that set
  timers or listeners were checked and already clean.
- **PBKDF2** (`tools/perf/pbkdf2.mjs`, which was missing from the revamp tree and has been copied across):

  | iterations | ms per hash (this Mac) |
  |---|---|
  | 10,000 (today) | 0.78 |
  | 25,000 | 1.84 |
  | 50,000 | 3.62 |
  | 100,000 | 7.29 |

  **Not changed, and this is the head's call.** The 10 ms Worker cap covers the WHOLE request, and a login also
  does session and account work; 100,000 would leave almost nothing. 25,000 (1.84 ms) is the affordable step that
  still triples today's work factor. A Mac is not a Worker, so the number to act on is the load Worker's, which
  needs `LOAD_METER=1` and is a deploy — out of scope for a frontend phase. Recorded, not decided.
- `week.submit` CPU is unchanged from the 3 Oct load test (9 ms p50) because nothing in these phases touched
  scoring. The live `run_log` holds only wall-clock times for slow calls (`auth.login` max 1,767 ms, avg 498 ms
  over 21 rows), which say nothing about CPU — noted so the figure is not mistaken for one.

### Phase 4 — Failure and freshness (Perf lane; UI lane verifies the states)
- Slow network, offline reopen, response after navigation, logout with requests in flight, account switch on one
  phone: the client already handles these (`cache.svelte.js` scope, `clearKept`, in-flight ids). **Test them**, in
  `frontend/tests/`, rather than assume. UI lane screenshots each state (Banner, offline, stale).
- Nothing here changes a business rule. A finding that needs one goes to the head.

**Phase 4 — the failure paths, driven (19 Oct).** `phase1-session.test.js` already covered a server that never
answers, a timed-out write keeping its request id, an offline reopen, a session the server has ended, a late
answer about an earlier sign-in, and kept data never crossing between people. All still pass with the one-call
change. **Added:** logging out while the open is still in flight leaves nobody signed in and nothing kept.
**Honestly not covered, and said so in the file:** a role or name changed on the server mid-session cannot be
expressed in this harness — each fresh app builds a mock that does not know the old token, so restore signs the
person out, which is what the "ended session" test relies on. The guarantee there is structural (home.get's
`user` comes from the same server function as auth.me's, and `begin()` always overwrites the kept copy) and the
browser suite drives it for real. One stale test title was corrected rather than left passing vacuously.

### Phase 5 — Final measurement and ONE release (shared)
1. Perf lane: `npm test` both trees, `audit:sql`, `npm run build`, `npm run size`, `sqltrace`, calls-per-open trace, load Worker CPU.
2. UI lane: full `verify.mjs` (all parts, ~25 min, quiet tree), 180-view collision sweep, screenshots per role.
3. **Lighthouse**: `tools/perf/lighthouse.sh` against the live URLs after phase 20 is up, JSON committed under
   `docs/perf/lh-<date>-<page>.json`. Closes roadmap 0.3 and 5.5.
4. Release: bump `frontend/release-phase.json` → 20; `gate.mjs checks 20`; sync revamp→live; `npm run deploy`
   (worker) then `npm run release` (app); message every peer; `docs/releases/2026-10-xx-phase20.md`.
5. Report in the shape both briefs ask for: before/after table with evidence, files changed, tests run, remaining
   bottlenecks, unimplemented recommendations — unmeasured metrics marked **not measured**, never estimated.

---

## 4. The before/after table both briefs want (filled as phases close)

| Metric | Before (19 Oct) | After | Evidence |
|---|---|---|---|
| Startup JS (gzip) | 56.76 KB | | `npm run size` |
| Startup CSS | 13.85 KB | | same |
| Largest lazy chunk | Devotee 28.94 KB | | same |
| Precache | 671.91 KB / 114 entries | | same |
| API calls at a devotee's repeat open | 2 (`auth.me`, `home.get`) | | request trace |
| Round trips `auth.me` / `home.get` / `week.get` | 4 / 10 / 9 | | hop counter |
| `/report` month view calls | up to 6 | | request trace |
| `week.submit` CPU p50 | 9 ms (3 Oct load test) | | load Worker |
| D1 rows read / written per day | 36,576 / 553 | | `wrangler d1 info` |
| Lighthouse mobile (Welcome, Login) | **not measured** (never stored) | | `docs/perf/*.json` |
| Collisions across 180 views | 0 | | sweep |

---

## 4b. Roadmap items neither lane owns (so they are not lost)

`docs/IMPLEMENTATION_ROADMAP.md` lists these open; none belongs to a lane above and none is UI or performance work:

| Item | What | When |
|---|---|---|
| 0.3, 5.5 | Lighthouse stored | **closes with Phase 5** of this plan; update the roadmap banner when phase 20 is up |
| 6.5 | release rollback procedure | deferred "until after a release" — that has now happened twice (18, 19); overdue |
| 6.6 | observability | same |
| 6.7 | fixtures | same |
| 6.8 | staging | same |

The four 6.x items need the head to schedule them; they are flagged here so they do not fall between the lanes.

## 4c. Phase board — the state of every phase, both lanes

Tick as each closes. **Both lanes built by this session (prompt-8d), 19 Oct.** Phases 1–4 are complete in `sadhanaRecord-revamp/`; phase 5 is the single test-and-release pass, as the head asked: build everything first, release once.

| Phase | UI lane | state | Perf lane | state |
|---|---|---|---|---|
| **0 Baseline** | screenshots of 67 views + 8 facilitator views, 0 page errors | ✅ done | revamp == live, client 435/435, build green, sizes recorded | ✅ done |
| **1 Startup & screens** | admin toolbar: Export+count+action+Refresh in one `.ph-tools` cluster (6 files); Batch setup's explanatory sentence → batch count | ✅ done | **one call at open** done; P-8 **already fixed** (0 staff chunks in a 108-entry precache); startup 56.87/55 KB, +0.11 for a round trip saved | ✅ done |
| **2 Staff screens & API** | nothing further found — the screens are finished (verdict corrected in the status map) | ✅ closed | Report month was **already done** (13 Oct, `dayPct` in `history.list`, test present); **long-list render cost measured** — see below | ✅ closed |
| **3 Interaction & a11y** | screen-reader sweep 0 blocker/0 major, 4 real minors fixed (see below); motion 27/0; back-guard 17/0 | ✅ done | `Darshan.svelte` timers now cleared on unmount; PBKDF2 measured (below) | ✅ done, one decision for the head |
| **4 Failure & freshness** | states exercised by the suite below; screenshots fold into phase 5 | ✅ done | failure paths driven, not reasoned about (below) | ✅ done |
| **5 Measure & ONE release** | full `verify.mjs`, 180-view collision sweep, per-role screenshots | ⬜ blocked on phase 19 | sizes, `audit:sql`, sqltrace, load-Worker CPU, **Lighthouse → `docs/perf/`** | ⬜ blocked on phase 19 |

**Phase 3 UI — what the sweep found and what was done (19 Oct).** 60 route loads, **0 blocker, 0 major, 12 minor
(6 distinct)**. Four were real and are fixed; two are accepted:
- *fixed* — `Batches.svelte` desktop table: eight buttons all named "Edit" → `aria-label={'Edit ' + b.name}`.
- *fixed* — `Board.svelte` attendance: "Present"/"Absent" ×14 on one screen → the devotee's name in the label.
- *fixed* — `Group.svelte`: the same, for a group leader's rows.
- *fixed, and a real bug beyond the sweep* — both boards printed a hard-coded **"Opens Sun"** on a row that
  cannot be marked yet, for every batch. Now the batch's own day from `attendanceOpensAt` (new `dowShort()` in
  `lib/dates.js`). This is the third place the 17 Oct class-day change was missed; the gates and the devotee's
  week view were the first two.
- *accepted* — `document.title` is the app name on the signed-out routes: `App.svelte` sets a per-route title for
  every public page, and the sweep reads it before that effect runs.
- *accepted* — Account at 1280 px reports a backwards tab jump: it is a two-column grid, so the DOM order is the
  reading order and the visual order differs by design.

## 5. Who does what now

- **This session (prompt-8d): UI lane.** Dev server on :5195 is up; screenshots of every route per persona are
  running; Phase 1 UI starts from what they show.
- **Perf lane: a second session.** Start at Phase 1 Perf: calls-per-open trace, then the staff-chunk test. Message
  before touching `App.svelte` or anything under `lib/`. Both lanes read this file first and tick its table.
- **Nobody syncs revamp→live** until prompt-05 says phase 19 is live and committed.

---

## 6. Release attempt, 19 October — STOPPED BY THE GATE (read this first)

**Nothing of phase 19's app half or phase 20 is live.** The server half of 19 IS live and safe (migration `0058`
applied, API `be468dd6` deployed, Time Travel bookmark in the phase-19 record). The current app ignores the new
fields, so devotees are unaffected right now.

**State of the trees:** `sadhanaRecord/` and `sadhanaRecord-revamp/` are IDENTICAL for `frontend/src`,
`frontend/tests` and `tools/browser`. `frontend/release-phase.json` is **19** in both, deliberately — a combined
release keeps 19, because `gate.mjs check 20` would block on 19 not being recorded live. The release record
`docs/releases/2026-10-19-phase19-hindi-books.md` is written for both halves; only `__LIVE__` and `__TESTS__`
remain to fill.

**Why the release did not happen.** `gate.mjs checks 19` crashed partway through `verify.mjs`, so it never
stamped, and the release watcher correctly refused to publish. Two separate problems, in this order:

1. `FAIL [390] slot + search narrow it (undefined)` — `verify.mjs:328`, the Hearing lectures count
   (`/^\d+ of 324 lectures$/`). Returned `undefined`, i.e. the element was not found. This is **phase 19's area**
   (books/lectures), not phase 20's.
2. `verify.mjs CRASHED` in `measuredSlowness` (`verify.mjs:1637`) — after `page.reload()` it waits for
   `#login, .welcome` for 15 s and times out. **Reproduced in isolation**, so it is not a timing artifact of the
   long run.

**What was ruled out for problem 2, with evidence:**
- The ended-session path is unchanged: `tests/phase1-session.test.js` "a session the server has ended" passes —
  the person is signed out and the kept copy cleared, which is exactly what that check waits for.
- `hooks.onUnauthenticated()` fires inside `api.js:160-162`, BEFORE the `.catch()` in `restore()`, so the
  one-call change cannot swallow a sign-out.
- The crashing lines are **not** among today's 141 uncommitted `verify.mjs` edits (those are all in the books
  area); the tier check itself is unchanged code.
- A bisect with the one-call change reverted was started but **not completed** (the tier check runs two slow-scroll
  simulations and is very slow; it was stopped to restore the tree rather than leave it in a reverted state).
  **This is the one open question.** `/tmp/sess.mine` held the backup; the tree is restored and verified identical
  to the revamp.

**What passed, on this exact combined source:** client 444; worker 55 suites / 2,930 assertions; `audit:sql`
0 new scans, 0 new mass writes, phones clean; build green; sizes within budget. Browser parts run separately on
the same source: `master` 36/0, `coord` 135/0, `devotee` 226/0, `groups` 28/0, `logins` 692/0 — 1,117 checks,
0 failures, 0 page errors.

**To finish (any session with budget):**
1. Decide problem 1 with prompt-05 — it is their feature. Run `node verify.mjs devotee` and look at the Hearing
   screen's lectures count; 324 is a fixture number.
2. Settle problem 2: run `node verify.mjs tiers` on a quiet dev server, once as-is and once with the `viaHome`
   block in `session.svelte.js:72-74` replaced by `Promise.resolve(null)`. If it fails both ways, it is not
   phase 20's and the check or its fixture is at fault.
3. `node tools/release/gate.mjs checks 19` → green → `cd frontend && npm run release`.
4. Fill `__LIVE__` and `__TESTS__` in the phase-19 record; message every peer.

### 6.1 Investigation, 19 Oct — what the two gate failures are NOT

**Phase 20 is cleared for problem 2, by direct comparison.** `verify.mjs tiers` was run with the one-call change
reverted (`viaHome` → `Promise.resolve(null)`): login failed **identically**. The regression, whatever it is, is
not phase 20's. The tree was restored and verified identical to the revamp afterwards (no TEMP markers).

**A wrong turn worth not repeating.** Chasing it, I wrote debug scripts that signed in WITHOUT waiting for the
splash to clear, and concluded login was broken for everyone. It is not. `#splash` is `position: fixed; z-index:
100; pointer-events: auto`, so while it is up it swallows a click on the sign-in button — `elementFromPoint` at
the button's centre returns the splash div, and Puppeteer's `click()` lands on it. The splash clears by itself at
about t+3 s. `verify.mjs`'s own `login()` helper (`:112-119`) already waits for it; my scripts did not. Two
further theories were also tested and disproved: a temporal-dead-zone on `enter`/`target` in `Login.svelte`
(the closure resolves fine — verified in the browser) and `deviceLabel()` throwing (it returns `Mac · Chrome`).
The API itself answers correctly throughout (`auth.login` → user + token).

**So the open question is narrower than §6 said:** both failures happened inside a gate run that takes 25–50
minutes, on a dev server that other work was touching. `tiers` is being re-run alone on a quiet server to tell a
real failure from a run-condition one. If it passes alone, the gate needs a clean re-run, not a code fix.


### 6.2 Resolved, 19 Oct — problem 2 WAS phase 20's, and is fixed

**I was wrong in §6.1.** The bisect there compared the wrong thing (a dev server mid-edit). Run properly on a
quiet server, the `tiers` check told the truth: a **real regression, mine**.

**The bug.** After a reload against a server that no longer knows the token, the devotee was signed out
underneath (`session.user` null) but the app stayed on `#/home` — no redirect, a dead screen. Measured three ways
on the same scenario: old code → `#/login`; my one-call version → stuck on `#/home`; fixed → `#/welcome`.

**Two causes, both needed fixing, each proved before changing:**
1. `load()` keeps its error in the cache entry and **resolves**, so `restore()` finished without the catch ever
   running. Fixed by re-reading the entry and rethrowing.
2. That alone did nothing: after a reload the tab's `sessionStorage` still held a `home.get` from seconds before,
   inside the 2-minute window, so `load` served it and **nothing was asked of the server** — measured, "actions
   asked after reload: []", cache age 5.4 s. Fixed with `{ force: true }`.

**The optimisation survives:** `load` shares the in-flight promise with prefetch's own `home.get`, so a repeat
open is still ONE request. `cache-calls.test.js` "a devotee: home.get only" (asserting `auth.me` is NOT called)
still passes.

**Verified after the fix:** `tiers` 85/0 exit 0 no page errors; `phase1-session` + `cache-calls` 18/18.
prompt-05 added a fail-first unit test for it and reports problem 1 (the Hearing count) intermittent — `devotee`
226/0 on re-run, and that check now waits for the count itself.

**Handover:** prompt-05 owns the release from here — copying this fix to both trees, full gate 19, then release.
