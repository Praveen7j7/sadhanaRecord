# Phase 20 release: what goes out, in what order, and what is still to fix

**Written 22 Oct 2026 by prompt-3e.** This page stands alone: a fresh session (or the head) can release from it without
any chat history. Sources: `sadhanaRecord-revamp/docs/merge-2026-10-22/MERGE_NOTES.md` and `HANDOFF_prompt-92.md`,
`sadhanaRecord-revamp/docs/BUILD_TRACKER_2026-10-22.md`, and the full browser run recorded in §4.

> **STATUS: PHASE 20 IS LIVE, 23 Oct 2026, 00:22 IST.** See §0 for what went live. The rest of this page is the
> record of how it got there, plus what is still owed (§5 leftovers, §5b TRD temple activities, §6).

## 0. Release record (prompt-3e, on the head's "release tonight")

| | |
|---|---|
| App | `assets/index-5ecRWMrU.js` · Worker `sadhana-record` version `d200ae2c-f16b-4720-8a2d-674e104e1f95` · build 2026.10.23-0020 · 00:22 IST |
| API | `sadhana-record-api` version `01c62ce8-1b5e-445e-97ef-2ed88a7b146f` (rollback: `npx wrangler rollback ae18ba82-138e-4eaa-8631-5a048cabf201`) |
| Database | `0059_measure_groups`, `0060_facilitation_kind`, `0061_account_grants` applied 00:19 IST. Bookmark just before: `0000040c-00000002-0000510c-68a3e04d0254a357169933929aad44fd` |
| Gate | attempt 2, fingerprint `bd2da831c9d551a3`, 00:18 IST: verify 2056/0 · components 219/0 · back-guard 17/0 · motion-audit 27/0 · routevitals 68/68 · screen-reader 0 blocker / 0 major (7 minor) · vitest · 68 server suites / 3244 assertions · audit:sql 0 new |
| Live checks | release.mjs: the open app moved by itself; 13 lazy chunks load; manifest, sign-in, welcome, forgot, sign-up render; service worker installs; no page errors. API `meta.get` ok. `cf-placement: remote-SIN` ×3 (was `local-MRS`, so G0 works: the API now runs beside the database). New actions exist on live (`access.list`, `home.staff`, `leaderboard.get`, `facilitators.orphans`, `criteria.get` → UNAUTHENTICATED; an unknown action → BAD_REQUEST). D1 read-back: `measures.grp` sadhana 1 / vl2reg 4 / target 6; `accounts.facilitation` lasting 2 / temporary 2 / none 18; `grants` set on 0 accounts |
| Trees | live and revamp identical for every release path; `tools/release/phases.json` synced; live `CLAUDE.md` kept |
| Broadcast | prompt-f6 (the only other session on these folders; the rest were Dentalkart sessions) |

**Not checked while the head slept: signing in as the live test accounts.** I don't have their passwords. A
2-minute check in the morning: close and reopen the app first (the first open after a release runs the cached copy
until it reloads), then as `sps` open Home, a batch, Scoreboards; as `etp` open Students, Board, Scoreboards; as the
devotee (6000000303) open Week, Day, Card; as the head open Admin › Access and Activity.

**Not done, on purpose:** F4 (PBKDF2 25k) waits for the head's OK. Git: nothing committed (commit only when asked).

## 1. Where things stand (22 Oct 2026, 19:00 IST)

| What | State |
|---|---|
| Build | Finished in both lanes: prompt-92 (lane P, live tree) and prompt-5b (lane S, revamp). |
| Revamp `sadhanaRecord-revamp/` | The **superset**: live + lane S. The release is cut from it. |
| Live tree `sadhanaRecord/` | Last commits `8ff6e0a` (code) and `b6b3b75` (CLAUDE.md). The merge revamp → live is **NOT done**. |
| Deployed | **Nothing from phase 20.** App: phase 19 `index-BFsEoGYS`. Worker: `ae18ba82` (22 Oct 08:54Z = 14:24 IST, via the gated `npm run deploy`, see §6 Q1). |
| Remote D1 | `0059_measure_groups`, `0060_facilitation_kind`, `0061_account_grants` **not applied** (`wrangler d1 migrations list sadhana --remote`, 22 Oct 18:58 IST). |
| Gate ledger | `frontend/release-phase.json` = `{ "phase": 20 }`; phase 19 is the last `live` row in `tools/release/phases.json`. |

## 2. What the release contains

One **bulk** release (phase 20): migrations, Worker and app together. The item-by-item list with proof is
`sadhanaRecord-revamp/docs/BUILD_TRACKER_2026-10-22.md`. In short:

**Database: three additive migrations** (all `ALTER TABLE … ADD COLUMN` with defaults, plus an index; nothing dropped):

| File | What it adds | Used by |
|---|---|---|
| `0059_measure_groups.sql` | the facilitation card's measure groups (sadhana / VL-2 registration / target) | ADR 0012 card and month scorecard |
| `0060_facilitation_kind.sql` | `accounts.facilitation` = '' / temporary / lasting; anyone facilitating before ETP becomes lasting | ADR 0010, 0014 |
| `0061_account_grants.sql` | `accounts.grants` (per-person permissions JSON) + an index on the rows that have one | ADR 0015, Admin › Access |

The new Worker code reads these columns, so **migrations go first**. Remote D1 on 22 Oct 18:58 IST: none applied.

**Worker (`worker/`)**
- Product (lane P, prompt-92): ADR 0010 temporary/lasting facilitation and take-back; 0012 card cadence, groups, month
  scorecard, seva + goal ranking; 0013 sadhana leaderboard + export; 0014 facilitator rename cascade and "Needs a new
  facilitator"; 0015 staff permissions (`grants.js`); 0017 admin wiring (`phases.update`); one IYF ID system (a devotee
  with no IYFD gets one with their connected year); `home.staff` (staff Home in 1 request instead of 8); `criteria.get`.
- Speed (lane S, prompt-5b): B1 round-trip pass, G2 replay check inside the scope batch, G6 N+1 removed
  (`eligible.list`, `closingPreview`, `board.get` no longer grow with people), G7 leaders/group hops, G5 `limits.js`,
  F5 `cronfail.js` (a failed scheduled job shows under System health).
- `wrangler.toml`: **G0 placement hint** `region = "aws:ap-southeast-1"` replaces `mode = "smart"`. If the deploy
  refuses the key, put `mode = "smart"` back (see the comment in the file).

**App (`frontend/`)**: everything in tracker sections A–E and G (first paint, optimistic saves, shared-element
travel, vibrancy ladder, copy audit, accessibility, Home layout shift fixed, caches on Account/Settings/Board), the
new staff screens (Admin › Access, Phases, Facilitators, Leaderboard, Scoreboards, month scorecard, Batch status /
Facilitation board renames), and the service-worker split (G13/G17) checked by `scripts/size.mjs`.

**Not in this release (decided):** E4 Hindi interface (the head, 22 Oct); G11 read replicas (not needed); G9 (already built).

**One live-data step after the deploy:** F4. Measure PBKDF2 at 25k on the load Worker (`wrangler tail`, real CPU
under the 10 ms cap). Then set the `pbkdf2_iterations` setting to 25000 on live; `auth.js` rehashes each password at
the next sign-in. Skip this step if the measured CPU leaves no headroom.

## 3. Release order

The head's rule: ONE gate, ONE deploy. Each step must be green before the next.

1. **Wait for the build to finish.** prompt-5b's three agents are fixing the MERGE_NOTES §3b reds in the revamp. Also
   apply the check fixes in §5 (A1, A2) in the revamp.
2. **Merge revamp → live** per `MERGE_NOTES.md` §0 and §4:
   - `diff -rq` the trees; every difference must be a lane-S change.
   - Copy frontend/src, tests, public, scripts, vite.config.js, worker/src, migrations, tests, wrangler.toml, shared,
     tools and setup.
   - Delete live's `frontend/src/coord/Board.svelte` and `Board2.svelte`.
   - **Keep live's `CLAUDE.md`**: it is newer.
   - Copy the live-only tools (`tools/brand`, `tools/store`, `tools/video`) only if they differ.
   - Trap: inside the revamp, `git apply` does nothing; use `patch -p1`, then grep.
3. **Freeze live** onto its own port (exclude `tools/devices`, `tools/video`, `tools/store`). Restart the dev server
   right before the run; prove the port owner with `lsof`.
4. **The gate:** `node tools/release/gate.mjs checks 20` (`release-phase.json` is already 20). It runs vitest,
   build + size, verify.mjs, components.mjs, back-guard.mjs, motion-audit.mjs, routevitals `--check` and the
   screen-reader sweep. Also run `cd worker && npm test && npm run audit:sql`. If the source changes during the run,
   the gate refuses to stamp; run it again.
5. `cd worker && npx wrangler versions list`: the newest must be `ae18ba82` (§6 Q1). Anything newer means a peer
   deployed; stop and ask.
6. **Back up D1** (`sadhana-backup-restore`: note the Time Travel bookmark). Then
   `cd worker && npm run migrate:remote` and confirm 0059–0061 show as applied.
7. `cd worker && npm run deploy` (gated by audit:sql; never `wrangler deploy` raw). Check:
   `curl -sI -X POST https://sadhana-record-api.iyfdelhi-sadhana.workers.dev/ | grep cf-placement` must no longer read
   `local-…`.
8. `cd frontend && npm run release` (tests, build, size, proves an open page moves to the new version).
9. `node tools/release/gate.mjs smoke` on live. Then sign in as the test accounts (`sps`, `etp`, devotee
   6000000303): Home, a week, the card, Scoreboards, Admin › Access.
10. F4 (§2), if measured safe.
11. Write the release record in `docs/releases/`, update `docs/deploy-log.json` (the script does that) and the
    memory notes, then message every peer session (ListAgents) with the Worker version, the `index-*.js` and the checks.

**Taken before the release (22 Oct, 22:18 IST, prompt-3e):**
- **D1 Time Travel bookmark:** `0000040b-0000000e-0000510c-d3683ba518f372b48711a70f0ef9cf5e`. Restore with
  `yes | npx wrangler d1 time-travel restore sadhana --bookmark=<it>`.
- **Live files before the merge:** git `b6b3b75` (no uncommitted changes under frontend, worker, shared, tools, setup),
  plus a tar at `/private/tmp/claude-501/-Users-maclapctp409-Downloads-hpStuff-prompt/9f917bc6-11ad-45fa-828f-57d1d3f04d47/scratchpad/live-before-phase20.tgz`.
- **Merge check:** the only live-only files are `coord/Board.svelte` and `Board2.svelte` (deleted per MERGE_NOTES §4)
  and `tools/brand`, `store`, `video` (kept). One differing file was newer in live, `worker/src/oversight.js`; the
  revamp's copy holds live's `refusalsView` plus B5/F5, so it is the superset.
- Sheets: `SHEETS_COPY=off` since 13 Oct, so the "sheet tab before the column" rule does not apply to 0059–0061.

**Rollback:** the Worker goes back with `npx wrangler rollback ae18ba82-138e-4eaa-8631-5a048cabf201`. The app goes
back with `release.mjs`'s automatic rollback, or by redeploying the phase 19 dist. The migrations are additive and
can stay; the old code ignores the new columns.

## 4. Test runs on frozen copies of the revamp (prompt-3e, port 5260)

All runs were against the in-memory mock on a dev server serving the frozen copy. No Cloudflare quota was used.

**Run 1: revamp frozen 22 Oct 18:56 IST** (before prompt-5b's last fixes)

| Suite | Result |
|---|---|
| `verify.mjs` (every part) | **2052 passed, 0 failed**, no page errors (31 min) |
| `components.mjs` | CRASHED at its first check: stale selector `.rulesnote` (§5 A1). With the selector fixed in the frozen copy only: **219/0** |
| `back-guard.mjs` | 17/0 |
| `motion-audit.mjs` | CRASHED: waits for the button text "How your day is scored" (§5 A2). Fixed in the copy only: **27/0** |
| `screenreader.mjs` | 0 blocker · 0 major · 7 minor (§5 C1, C2) |
| `routevitals --check` | 3 over budget, reproduced twice (§5 B1–B3) |
| client `vitest` | 463/463 |
| worker suite | all green, 2733 assertions (after the frozen copy got `setup/` and a real `docs/`, see the traps below) |
| `audit:sql` | 37 approved scans, 0 new · 317 writes, 22 approved mass, 0 new · phones clean |
| build + `size.mjs` | OK: within budget |

**Run 2: revamp re-frozen 22 Oct 21:16 IST** (prompt-5b's §3b fixes landed; the revamp is kept quiet for this run)

| Suite | Result |
|---|---|
| `verify.mjs` (every part) | **2056 passed, 0 failed**, no page errors (31 min) |
| `components.mjs` | **219/0** |
| `back-guard.mjs` | **17/0** |
| `motion-audit.mjs` | **27/0** |
| `screenreader.mjs` | **0 blocker · 0 major** · 7 minor (C1, C2) |
| `routevitals --check` | **2 over budget**: training coordinator `/students` and `/scoreboards`, repeat visits (B3, B4). devotee `/account` repeat is now 62 ms (B2 cured) and head `/activity` passes |
| client `vitest` | **464/464** |
| worker suite | **68 suites, 2747 assertions, all green** |
| `audit:sql` | 0 new scans, 0 new mass writes, phones clean |
| build + `size.mjs` | **OK: within budget** |

**Owed before the gate:** B3 + B4 fixed (sent to prompt-f6), then ONE re-freeze and a rerun of routevitals and the
verify parts `etp`, `coord`, `access15`. Fixes landed after the 21:16 freeze and not yet run in a browser: B1
(Activity). Its rerun is the same routevitals run.

**Traps found while running (for whoever runs the gate):**
- `sadhanaRecord-revamp/docs` is a **symlink** to `../sadhanaRecord/docs`, so both trees share one docs folder. A
  frozen copy made with `rsync -a` carries a broken link, and `codes.test` and `access-map.test` then fail on
  missing files. Copy with `--copy-links`.
- The worker suite imports `setup/schema.mjs` (through `mirror.js`), so a frozen copy needs `setup/` too.
- `npm run audit:sql` writes its log to the fixed path `/tmp/sr-sql.log`, which two sessions running it at once
  would overwrite. Run the steps with your own `SQL_LOG=<path>` (as `worker/package.json` does) if a peer may be
  running it too.

## 5. Fixes still owed (only noted during the run, none fixed here)

**How fixes flow (the head, 22 Oct evening):** the test session (prompt-3e) keeps the suite running on a frozen copy.
Each red goes to the fixing session (prompt-5b until it closed at about 21:30; then prompt-f6), which fixes it in
`sadhanaRecord-revamp/` and replies with the files and the parts to rerun. At the end there is ONE re-freeze, and only
those parts are rerun. The "State" column below says where each item is.

**A. Checks out of date. These would make the gate fail with no product bug behind them.**

| # | Where | Fix | State |
|---|---|---|---|
| A1 | `tools/browser/components.mjs` 58, 60, 92, 95 | `.rulesnote` → the visible one of `.jscore, .dr-rules` (G12 replaced "How your day is scored ›" with a "Scoring" chip) | ✅ fixed in the revamp by prompt-5b (22 Oct evening) |
| A2 | `tools/browser/motion-audit.mjs` 172, 173, 181, 227, 228 | `/How your day is scored/` → `/^Scoring$/` | ✅ fixed in the revamp by prompt-5b |
| A3 | live `sadhanaRecord/tools/browser/` | same stale lines; the merge revamp → live carries A1/A2 over | goes with the merge |

**B. routevitals budget reds (`--check`, 4× CPU, slow 4G, 390 px)**

| # | Screen | Measured | Cause / next step |
|---|---|---|---|
| B1 | head `/activity` | first or repeat visit: "never showed its content" | **Found:** `master/Activity.svelte:93` renders `<Skeleton rows={2}>` inside the CLOSED "Technical log" `<details>`; `runlog.list` loads only when it is opened, so a `.sk` stays in `<main>` forever. Not visible to a person; it fails every "skeletons gone" wait. Fix: draw the body only while `techOpen`. ✅ **fixed in the revamp by prompt-f6** (`Activity.svelte` 91–100: `{#if !techOpen}` first; no other `<Skeleton>` inside a `<details>` in frontend/src). Rerun owed: routevitals |
| B2 | devotee `/account`, repeat visit | 2967 ms, then 2704 ms (budget 100) | ✅ **cured** by prompt-5b's `SignedIn.svelte` fix (a screen no longer remounts on each address change): 62 ms in run 2 |
| B3 | training coordinator `/students`, repeat visit | 1106, 1633, then 1221 ms | **Found:** `coord/Students.svelte:51` calls `enrol.list` on every mount and never uses `lib/cache.svelte.js`. Fix: the shared 2-minute read cache (as G23 did for Account/Settings/Board), patched after `enrol.add`/`enrol.remove`. Sent to prompt-f6 |
| B4 | training coordinator `/scoreboards`, repeat visit | 3100 ms (run 2; the head's is 8 ms) | **Found:** `coord/Scoreboards.svelte:41,55` call `board.list`/`board.get` uncached. Same fix as B3. Sent to prompt-f6 |

**B5. Targeted rerun on the revamp frozen 22:04 (after prompt-f6's B1/B3/B4 fixes):** B1 ✅ head `/activity` 7 ms;
B3 ✅ `/students` repeat 10 ms; B4 ✅ `/scoreboards` repeat 6 ms. verify `etp` 30/0, `coord` 139/0, `access15` 16/0,
`master` 36/0; vitest 464/464.

**R. routevitals itself is unreliable on a dev server. Fix the CHECK before the gate (sent to prompt-f6)**

| # | Symptom | Cause | Fix |
|---|---|---|---|
| R1 | devotee `/week` "never showed its content": 60 ms at 21:55, then TIMEOUT twice at 22:0x | the app correctly rewrites `#/week` → `#/week/<current weekId>` ~40 ms later (`devotee/Devotee.svelte:38`, since 9 Oct). The check wants the hash exactly, so it passes only when its 16 ms poll lands before the rewrite | accept the route or a sub-path of it |
| R2 | the slow repeat visit moves between screens: `/account` again 62 / 2535 / 3052 ms, facilitator `/card` again 19 / 1656, head `/activity` again 7 / 1986, with 4 unrelated files changed | on the vite dev server Account's first visit is about 15 separate module requests; under 4× CPU and slow 4G that outlasts the 600 ms settle, and "ready" (any 20 characters in `<main>`, no `.sk`) can be met before the new screen draws, so the cost lands on a later visit | "ready" waits for the screen's own marker; ideally run routevitals against a built preview |

**R fix and what it exposed (prompt-f6, ~22:30):** "ready" now waits for `main[data-path]` (`ui/Shell.svelte` +
`tools/perf/routevitals.mjs`), and `/week` passes. The honest check then shows three screens slow on EVERY repeat
visit (0 KiB / 1 request, so the time is their own server read): devotee `/card` 1444–1685 ms, facilitator `/card`
1483–1812 ms, head `/activity` 1060–1873 ms. `screens/Card.svelte:65-66` (`card.get`/`card.of`) and
`master/Activity.svelte:30` (`audit.list`) skip the read cache; same pattern as B3/B4. Not a regression from live.
**The head chose to fix them before the release (option A, 22 Oct ~22:35).** prompt-f6 is caching them, refreshing
after every card write. After its "go": re-freeze, routevitals ×2 plus verify `facilitator`, `facs`, `etp`, `dlane`,
`logins`, then the merge and the gate.

**Release night log (prompt-3e)**
- 22:37 prompt-f6 "go" (Card + Activity cached; routevitals 68/68 ×2 on its copy). 22:38 merge revamp → live: `diff -rq`
  of every release path empty, Board/Board2 deleted, live `CLAUDE.md` kept.
- 22:38–23:17 **gate attempt 1: FAILED, not stamped.** Green: vitest, build + size, 68 suites / 3244 assertions,
  audit:sql 0 new, verify, components, back-guard, motion-audit. Red: routevitals "facilitator /card (again): layout
  shift 0.149 > 0.1".
- Cause (prompt-f6, layout-shift probe): Card's "Month by month" section sits above the levels and measures, and it
  comes from a second read (`card.months`) that starts only after the card has drawn, so when it lands it pushes them
  down. A person sees this on a FIRST visit too. Fix: a card drawn for the first time waits for its month list behind
  the skeleton (at most 1.5 s). Applied 23:36 to live AND revamp `screens/Card.svelte`; trees identical.
- Reruns before the fix: Card's shift 0.149 / 0 / 0 (intermittent). Two other first-visit shifts, once each:
  coordinator `/requests` 0.51 (cold server) and head `/overview` 0.433. Sent to prompt-f6 for the same probe.
- The 1.5 s cap had a hole: under load `card.months` took longer, the card drew without it, and the section landed
  inside the first visit's window (0.149, devotee and facilitator). 23:39 the cap was dropped:
  `await cacheLoad(monthsKey(d), monthsGet(d))`, bounded by the API's own 15 s deadline; an error draws the card
  without months. prompt-f6, running alone: routevitals 68/68 ×2, Card first visits 0.000–0.001.
  `/requests` and `/overview` did not reproduce in 5 tries each, so they count as dev-server first-load noise (a cold vite
  serving 36 separate modules).
- `gate.mjs` left attempt 1's dev server (:5436) running after its red exit; I killed it by pid. **Fix owed in
  `tools/release/gate.mjs`:** stop the spawned vite on every exit path.
- 23:40 **gate attempt 2** started on live (two-line Card change applied to both trees). 00:18 **green and stamped**.
- 00:19 bookmark, then migrate 0059–0061 ✅ · 00:20 `npm run deploy` → API `01c62ce8` · 00:22 `npm run release` → app
  `index-5ecRWMrU.js`, **phase 20 LIVE**. Details in §0.

**C. Screen-reader minors (do not fail the gate)**

| # | Where | Finding |
|---|---|---|
| C1 | every route | `document.title` is always "IYF Delhi Sadhana Record"; a per-screen title would help screen-reader users |
| C2 | devotee `/account` at 390 | the Tab order jumps back up the page 3× |

**D. Code warnings seen in the dev-server log (not failures)**
- `devotee/BookChapters.svelte:16`: `state_referenced_locally` for `remember`, `bookId`, `lang` (the value is read
  once). Check that the chapter list follows a book or language change made while the screen is open.
- `[svelte] derived_inert` warnings at runtime ("reading a derived belonging to a now-destroyed effect"). Find the
  screen (`STACK=1` on verify) and confirm it shows no stale value.

**E. Bug found on live by the head, fixed in the revamp (ships with this release)**
- A search box lost its focus after one letter (Reading, Hearing, the staff lists): `SignedIn.svelte` remounted the
  screen on every address change. Fixed with `loadedOnce('screen:'+s, …)` (prompt-5b), with a new verify check:
  "the reading search keeps its focus while typing". **Live has the bug until this release.**

## 5b. Next feature after this release: temple activities for TRD (the head, 22 Oct 22:30)

The head sent a reference screenshot of a day form ("Update Sadhana") for a **TRD (Temple Residents)** devotee. It has a
**Temple Activities** block: Mangal Aarti, Darshan Aarti, Morning Class and Prasadam, each answered **On Time / Late /
Absent**. The person also lives in the temple, so these are asked as well. Positive/Negative Chetna in the same
screenshot already exists in our Day form (`rules.chetnaOptions`). The temple block does not exist for any batch:
`grep -i mangal` finds nothing in frontend, worker or shared. TRD today is a batch scored on the SPS card with the
standard day form.

**Not in phase 20** (tests already run; this changes the day's fields, server validation, perhaps scoring, the mock
and the checks). Build it as its own phase after the head answers:
1. Who sees it: only TRD members, or anyone marked as living in the temple?
2. Does it score (Late vs Absent marks), or is it recorded only?
3. Are all four required for a complete day, or optional?
4. Asked every day, including days away from the temple?
5. Who sees the answers: TRD facilitator, coordinator, head, exports?

Likely shape (to confirm against the code when built): field names on the day the way Chetna's are; the fields come
with the batch's rules, so only batches that have them show the block; mirror in `lib/mockweeks.js` `FIELDS`; a
check that a TRD devotee sees the block and an SPS devotee does not.

## 6. Open questions

- **Q1. The Worker was deployed twice on 22 Oct with no release record:** `ff95e8b8` (08:53:36Z) and `ae18ba82`
  (08:54:53Z), both through the gated `npm run deploy` ("audit:sql passed" in `docs/deploy-log.json`). The times match
  live commit `ac70fae` (14:25 IST: "IYFD tests for an account with no id"). That deploy was most likely prompt-92's
  IYFD fix. prompt-92 is closed and could not be asked. It does not block: remote D1 has no 0059–0061, so that code
  does not depend on them. The release session checks that `wrangler versions list` still ends at `ae18ba82`.
- **Q2. F4 (PBKDF2 25k):** a live setting change. It needs the head's OK after the load-Worker measurement.
- **Q3. The G0 placement hint:** if Cloudflare refuses `region` on the free plan, the fallback is `mode = "smart"`,
  which never moved this Worker (`cf-placement: local-MRS` on 22 Oct).
