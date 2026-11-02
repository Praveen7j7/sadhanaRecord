# Merging the two lanes into live — what must not be lost

**22 October 2026, prompt-5b (lane S).** The final step before the ONE gate copies `sadhanaRecord-revamp/` over
`sadhanaRecord/`. Copying whole files is safe only where one lane alone changed the file. This note lists the files
that BOTH lanes changed, and the tooling files the revamp had fallen behind on, so neither lane's work is reverted.

## 0. Current state (22 Oct, evening) — the revamp is the SUPERSET

Since P's 30bf4cf, both lanes keep the revamp complete: P copies every file it alone changed live → revamp, and sends
patches for the files S holds, which S applies in the revamp (done for 1b473ea, f29eb09 and 30bf4cf: closing, api ×2,
oversight, audit-allow, App.svelte). So the revamp now equals **live + lane S**, and the final merge is:

1. P stops editing live and makes its last copy live → revamp (patches for S-held files, as before).
2. S applies them; the revamp worker suite, audit:sql, vitest and the browser suite run green on the revamp.
3. `diff -rq` live vs revamp: every difference must be a lane-S change (listed in the tracker), none live-only.
4. Copy revamp → live (frontend/src, frontend/tests, frontend/public, frontend/scripts, frontend/vite.config.js,
   worker/src, worker/migrations, worker/tests, worker/wrangler.toml, shared, tools, setup).
5. The ONE gate on live.

The per-file patches in §1 stay as the record and as the fallback if the order above cannot be kept.
New since §2 was written (lane S): `SignedIn.svelte`, `lib/signedin.js`, `main.js`, `App.svelte` (A4); `lib/prefetch.js`
(B3); `lib/countup.js` (C3/C10); `ui/EmptyState.svelte` (C9); `ui/Ring.svelte`; `ui/FirstRun.svelte`; `styles/auth.css`,
`styles/seg.css`, `styles/screens.css`, `app.css` (ladder); `screens/Login|SignUp|Forgot|Account.svelte`,
`devotee/Week|Report|History.svelte`, `coord/StaffHome|SignUpCard|Requests|Members.svelte` (copy, C6, C7);
`tools/browser/screenreader.mjs`, `tools/browser/shoot.mjs`, `tools/perf/routevitals.mjs`; tests `countup`,
`prefetch-data`, `submit-window` (the guide no longer states a time).

## 1. Files both lanes changed — apply the patch, do not copy the file

Take **live's** file (prompt-92's work) and apply lane S's patch from this folder on top. Each patch was checked
with `git apply --check` against live's working tree on 22 Oct.

| File | Live (lane P) has | Lane S patch | Check |
|---|---|---|---|
| `worker/src/closing.js` | ADR 0010 in `closingClose` (qualifying takes facilitation back; `takeBack` from `enrol.js`) | `closing-preview-G6.patch` — `closingPreview` reads everyone's attendance count in one round trip | applies cleanly |
| `worker/src/api.js` | `criteria.get`, leaderboard, `facilitators.*` registry lines | `api-G2-replay.patch` — the replay check rides in the scope batch (G2), `q` imported | applies cleanly |
| `frontend/src/lib/api.js` | `phases.update`, `facilitators.rename`, `facilitators.setLasting` in `WRITES` (take live's list) | `client-api-G16-public.patch` — three public actions in `PUBLIC` (G16) | applies cleanly |
| `frontend/src/master/HeadHome.svelte` | its own uncommitted edit | `headhome-F5-cron.patch` — a failed scheduled job under System health (F5) | applies cleanly |
| `worker/tests/audit-allow.mjs` | three `facilitators.rename` lines | one line: `SELECT phase_id, starts_on, ends_on FROM phases WHERE starts_on <= ? AND ends_on >= ? ORDER BY starts_on DESC` replaces the same text without `, starts_on, ends_on` | edit by hand (one line) |
| `worker/tests/roles.test.mjs` | `facilitators.rename/orphans/setLasting` GATE lines | none — the revamp copy has only the leaderboard lines, which live also has | take live's |

## 2. Files only lane S changed — copy revamp → live

Worker: new `cronfail.js` (F5), `index.js` + `oversight.js` (F5 call sites, `settings.get` → `cronFailed`), `board.js`, `phases.js`, `eligible.js` (= live's `criteriaGet` + B1/G6), `groups.js`, `db.js`, `session.js`,
`index.js`, `push.js`, `mirror.js`, `erase.js`, `weeks.js`, `retention.js`, `auth.js`, `announcements.js`,
`rules.js`, `devotees.js`, `oversight.js`, new `limits.js`; tests `round-trips.test.mjs`, new `limits.test.mjs`, new `cronfail.test.mjs`;
`wrangler.toml` (= live + G0 placement hint; the `[env.staging]` block is in both).

Frontend: `vite.config.js`, `scripts/size.mjs`, `public/_headers`, `.env.example`, `index.html`, `src/main.js`,
`src/app.css`, `src/lib/darshan.js`, `src/lib/lazy.js`, `src/ui/Darshan.svelte`, `src/screens/Welcome.svelte`,
`src/screens/Home.svelte`, `src/screens/DevoteeHome.svelte`, `src/master/Settings.svelte` + `src/coord/Board2.svelte` (G23), `src/screens/Account.svelte` (G23; prompt-92 three-way merged their `endAll` into it in the revamp), `public/darshan/darshan.json` + new `blur.json`, the
five compressed icons, `src/lib/mockadmin.js` (`cronFailed: []`), `tools/browser/shoot.mjs` (G20), `tools/perf/routevitals.mjs` (copied from live); tests `api.test.js`.

Before copying any of these, check live's `git status`: if one of them shows as modified on live, it has a lane-P
change too and belongs in §1.

## 3. Tooling the revamp had fallen behind on — already synced live → revamp (22 Oct)

The revamp held older copies of files neither lane touched this round, so a revamp → live copy would have reverted
live work: `frontend/scripts/release.mjs` (6.5's automatic rollback), `worker/package.json` (the deploy gate),
`.github/workflows/checks.yml`, `frontend/public/.well-known/assetlinks.json`, `tools/release/phases.json` (the gate
ledger) and `tools/identity/import-people.mjs`. Also `worker/wrangler.toml` was missing `[env.staging]` (6.8). All are
now identical to live in the revamp. Still live-only and to be copied over (not needed by the build): `tools/brand`,
`tools/store`, `tools/video`, `tools/perf/routevitals.mjs` (copied), `RELEASE-16-NOTES.md`, `.gitignore`.

## 3b. OPEN before the gate — lane S (prompt-5b, closed 22 Oct evening)

Rerun of the red parts on a frozen copy (tree3, taken BEFORE P's 8ff6e0a copy, the Login/auth.css patches and the
Board renames; results in the session scratchpad `parts3/`). dlane 23/0 is green; logins, nav, coord and design never ran
(the run was stopped at close). **These reds are owed a fix or a proven verdict:**

1. **devotee: "the local draft is removed after the save" (8×, every width)** — new since B2. Likely cause: since B2 the
   Save button reads "Saved ✓" the moment it is pressed, so the check's `saveSettles` + label read no longer means
   "the request finished", and the IndexedDB `q:` key is read before the queue drains. Decide by probe: wait for
   `saver.saving()` to be false (or for `idbKeys('q:')` to empty) and see whether the draft really goes. If it never
   goes, B2 broke the queue clean-up (`lib/saver.js` `unsent()` / `sending`) — fix the code, not the check.
2. **devotee: Hearing "previous week button" / "→ key steps forward" / swipe (14×)** — the screen steps correctly by
   hand (probe: week 3 → 2 within 50 ms). The check reads after a fixed `sleep(150)` on the High tier; suspect the page
   view transition. Make the check wait for the text (`waitForFunction`), then re-judge.
3. **devotee: Account "the pencil opens that section only" + "Cancel … focus returns to the pencil" (320, 2× each)**
   — not yet diagnosed (Account had G23 + acc-hero edits by S).
4. **p7: "a swipe to the left on the day goes to the next day"** — new in tree3, the copy that has C4. Suspect
   C4's `arrived()` wait in `lib/router.svelte.js` (Day → Day keeps `nav.sticky-top.chips` on screen, so it waits up to
   160 ms). Check: does the swipe's navigation complete, and does the check read too early? If C4 is the cause and the
   fix is not obvious, removing `arrived()` (C4 then degrades to a fade) is the safe revert.
5. **oct7: "a student's page: pick any past week" + "a submitted week to open"** — red in both runs (tree2 and tree3);
   not diagnosed. Possibly the ETP-21 mock rename (dates) — check against P's 8ff6e0a mock.
6. **tiers: "[820 looks] high: 3D time wheel"** (tree2 run) — not diagnosed.
7. **C4 is owed its full browser run** including `logins` and `nav` (router is shared by every role).

**Status (22 Oct, later):** 2, 3, 5, 6 = check timing, not product bugs: taps during a page-change animation are not
delivered, and the motion work had made a page change outlast `go()`'s 250 ms. `go()` now waits for
`!document.activeViewTransition`; devotee 226/0, back 13/0, a11y 3/0, oct7 16/0, tiers 85/0, etp/facCard/facilitator
green. The motion was also shortened (nav-pill and vt-week/vt-days 240 ms, router wait ≤ 100 ms) so people lose fewer
taps. 1 and 4 are also timing: the draft IS removed (77 ms after the tap, before aria-busy clears; new unit test in weeks.test pins the order), and the swipe landed inside the Home → Day transition. Both green with the `go()` wait: devotee 230/0, p7 9/0, dayview 42/0, dlane 23/0, vitest 464/464. **All §3b reds are resolved**; item 7 (C4's logins/nav run) goes to the full run. **Also fixed (the head, live has it too):** every search box
lost focus after one letter. `SignedIn.svelte` re-mounted the screen on each address change; it now uses
`screenFile()` via `loadedOnce`. Guarded by the verify check "the reading search keeps its focus while typing". **And:**
desktop Sign in / Sign up now use Welcome's 50/50 split (`auth.css`, `Plain.svelte` sizes 50vw). Stale gate selectors
in `components.mjs` / `motion-audit.mjs` (`.rulesnote`, "How your day is scored") are now `.jscore, .dr-rules` /
`^Scoring$`.

Then one fresh freeze of the merged tree (exclude `tools/devices`, `tools/video`, `tools/store` — 12 GB) and the gate.

## 4. After the merge

**Renamed files (22 Oct, S):** `coord/Board.svelte` → `coord/BatchStatus.svelte` and `coord/Board2.svelte` →
`coord/FacilitationBoard.svelte` (only `coord/Batch.svelte` imports them; `ACCESS_MAP.md` regenerated). A copy
revamp → live ADDS the new names but does not remove the old ones: delete `sadhanaRecord/frontend/src/coord/Board.svelte`
and `Board2.svelte` in live after the copy, or the `diff -rq` below shows them as live-only.

`diff -rq` the two trees (excluding node_modules, dist, .wrangler, screenshots): only lane-P files still in progress
may differ. Then the ONE gate: worker `npm test` + `audit:sql`, client `vitest`, `gate.mjs checks 20` (all parts),
`size.mjs` (now also refuses a mock build and any precached file importing a non-precached one), Lighthouse stored in
`docs/perf`, the collision sweep, screenshots 390/820/1280 light + dark. Then `migrate:remote` (0059+), the worker
`npm run deploy`, the app `npm run release`, and on live: `cf-placement` must no longer read `local-…` (G0).
