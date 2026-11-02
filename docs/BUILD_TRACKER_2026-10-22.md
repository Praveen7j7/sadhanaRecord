# Build tracker — every item agreed 21–22 October, and who owns it

**22 October 2026.** The head: *"build together all the things which I have discussed, all, leave none."*
This file is the coverage check for that. Every item in `UX_PERF_DEPTH_ANALYSIS_2026-10-21.md` §5, every ADR from
0010 to 0015, and the overdue roadmap items are listed once, with an owner. **An item with no owner is a defect in
this file.** Lanes as agreed in `IMPLEMENTATION_PROMPTS_2026-10-21.md` ("Two sessions, two lanes").

- **P** = product lane, prompt-92, live tree
- **S** = speed & design lane, prompt-5b, `sadhanaRecord-revamp/`
- Status: ✅ built and checked · 🔨 in progress · ⏳ waiting (reason given) · ⬜ not started

## Lessons for the final full-suite run

- **Restart every dev server immediately before a browser run.** On 22 Oct `verify.mjs tiers` failed on both trees
  ("the post's picture waits for a tap", no `.annimg`). It was not a product bug: a peer edited `mock.js` while the
  server ran, Vite then served the app a `?t=` copy of the mock, and the check and the app held two different mock
  instances — the post the check created never reached the app's Wall. A fresh server: 85/0 on both trees.

- **The devotee part can crash on the quote carousel's `page.focus('.qc-track')`** (22 Oct, once): the same tree passed
  226/0 on a fresh server straight after. Treat a lone crash there as timing; rerun the part before chasing it.

- **Check who owns a port before a browser run** (22 Oct): `vite --strictPort` started in the background fails silently
  when the port is taken, and the run then tests whatever server already holds it. P's full run hit S's frozen copy on
  :5212. Ports: P 5199 and 5220–5229, S 5207–5212; `lsof -nP -iTCP:<port> -sTCP:LISTEN` shows the owner's path.
- **Never `pkill -f` by a pattern another session's process can match — kill your own pid** (22 Oct): P's freeze script
  ran `pkill -f "vite --port 5212"`, which also matched and killed S's server on that port mid-run.
- **Scripted multi-line edits must assert they matched** (S, 22 Oct): a bracket/backtick matcher broke `oversight.js`
  (backticks inside comments). Every scripted edit since asserts `count == 1` before replacing.
- **Two rules on one property: the later wins** (S, 22 Oct): `.tbl th` got a new `border-bottom` and kept its old one
  later in the same rule, which silently overrode it. Read the whole rule before adding to it.
- **A frozen test copy needs the worker sources too**: `mockweeks.js` imports `worker/src/cards.js`.

## Wired to live data, not to fixtures (the head, 22 Oct)

The head saw "ETP Batch 51" on a mock screenshot; live's training is ETP-21 ("ETP · Batch 21"). The app itself is wired:
no screen or server code names a batch (checked; only level names, comments and one input placeholder). Two steps:
the mock's training renamed to live's exact row (P, mock files), and a guard, `frontend/tests/no-hardcoded-batches.test.js`:
no shipped file may name a batch id (ETP-21, SPS2, VL2-51 …) — proved to fail on a planted id.

## Gap found on 22 Oct

Cross-checking the depth analysis against both lanes' lists found **13 items in neither lane**: B3, B5, C4, C5, D6,
D7, E1, E2, E3, E4, F4, F5 and roadmap 6.5–6.8. They are claimed by **S** below and the teammate has been told.

## A. First paint on a slow phone

| # | Item | Lane | Status |
|---|---|---|---|
| A1 | One fetch for the Welcome painting (no 480 → 960 double download) | S | ✅ one painting download at every size (was 3–4): frozen image set per layer, only the visible panel is rendered (the hidden phone hero was `eager` and downloaded on desktop), desktop panel made `eager`, hero `sizes` set to its measured width (390 px phone: 1440/152 KB → 960/73 KB). welcome 31/0, tiers 85/0 |
| A2 | Inline critical CSS, load the rest non-blocking | S | ✅ **measured, not built.** Every stored Lighthouse run (Welcome, Login, Sign-up, Forgot; `docs/perf/lh-2026-10-2*.json`) estimates the saving from removing render-blocking CSS at **0 ms**: the first paint is the splash and the largest is the painting, which waits for JS and data anyway. Inlining would also need a CSP exception (`style-src 'self'`; `size.mjs` refuses inline style on purpose). Closed on that evidence |
| A3 | Ship a small darshan catalogue, not 30 KB on every page | S | ✅ 29.8 → 5.3 KB gz; blur placeholders split into `blur.json`, fetched only where a flagship is drawn; verified at both tiers, and with paintings off nothing but the placeholder loads |
| A4 | Public / shell split of the startup chunk (phase 3) | S | ✅ **with a measured trade.** The signed-in shell + screen switch moved from `App.svelte` into `SignedIn.svelte` (`lib/signedin.js`, one shared load); a returning phone starts loading it in `main.js` before mount; the splash waits for it; the Login screen fetches it while the person types. Startup JS **57.37 → 38.55 KB** gz (target 55, budget 60); Welcome first visit 87.2 → **72.7 KiB** JS transferred (slow 4G ≈ −0.1 s, once per phone). **Cost:** a signed-in reopen draws the shell ~**13 ms later** (63–66 → 76–80 ms median, 4× CPU, 12 interleaved samples) — under one frame, but real. Kept for the first-visit gain and 18.8 KB of startup room. Client 457/457 |
| A5 | Compress the manifest icons | S | ✅ 482 → 171 KB across 5 files; palette + Floyd–Steinberg; checked by eye (the undithered pass banded) and by mean difference ≈ 1.7–2.3/255 |
| A6 | Skip the splash for a returning, signed-in person | S | ✅ a stored session marks the splash `resume` before mount (no fade); CSP-safe (main.js + CSS, no inline script). the splash lifts at 377 ms on a returning signed-in device (was 679). **Correction 22 Oct:** this times the splash only — the mock forgets its session on reload, so the screen under it became Welcome and Home's own draw time was not measured then |

## B. Speed inside the app

| # | Item | Lane | Status |
|---|---|---|---|
| B1 | Round-trip pass | S | ✅ every action named, each proved by a response-parity diff against the code before it (17 + 50 cases, refusals, a facilitator's board, a trainee, an ETP coordinator and a VL-2 intake included — all identical). `settings.get` 13 → **4** · `home.get` 11 → **6** · `devotees.get` 9 → **6** · `journals.get` 8 → **5** (not-modified: 4) · `stats.batch` 16 → **5** · `devotees.list` 11 → **5** · `card.get` 32 → **6** · `card.of` 33 → **7–8** · `board.get` 53 → **7–8** · `stages.set` 21 → **10** · `profile.get` (a trainee) 11 → **7**. Rows read went DOWN (targets/fills/measures were read 2–3× per card). Guarded by `worker/tests/round-trips.test.mjs` (red on the old code: 6 failures) |
| B2 | Optimistic saves on the Day form and attendance | S | ✅ (the §3b.1 red was check timing — the draft is removed 77 ms after the tap; weeks.test pins the order). attendance was already optimistic everywhere (Week sets the mark first and rolls back on refusal; Group and Board show marks at once as edits, one Save with Undo). Day form: the button reads "Saved ✓" the moment Save is pressed, no spinner; the leave-guard asks only while a change is still unsent (`saver.unsent()`), so a save in flight never holds navigation; a refusal brings the change back as unsaved. weeks.test 20/20 (the unsent test failed first) |
| B3 | Prefetch the next screen's data on idle | S | ✅ most of it was already true — Week/Day draw from `home.get` (held by Home), a staff Home warms each batch board under the key Batch status reads, Requests are warmed at sign-in, screen code is prefetched on idle and on press. Added: pressing a tab also warms that screen's FIRST READ under its own cache key (`lib/prefetch.js`: Report `history.list`, Group `group.list`) — ~100 ms ahead, never for screens nobody opens, skipped on data saver. `tests/prefetch-data.test.js` 3/3 (2 red before) |
| B4 | Sampled real-phone vitals, 1 in 100 → `run_log` (D-5 yes) | S | ✅ `vitals.report` (ANY, write, noReplay; `worker/src/vitals.js`): FCP/LCP/INP/CLS + screen, tier, connection type → one `run_log` row (action `vitals`), never a name or phone; numbers bounded or null, text fields cleaned; **≤ 3 rows/day/person** (counter). Client `lib/vitals.js`: ~1 open in 100 of a signed-in person, idle-loaded from `SignedIn.svelte`, never on Save-Data or against the mock, sent once (20 s or when the app is put away). ≈ 300 writes/day at 5,000 devotees. Tests: worker `vitals.test.mjs` 10/0, client `vitals.test.js` 3/3; registry/GATE/WRITES/mock/access map updated; worker 67 suites/3,230; audit:sql 0 new |
| B5 | `stats.all` | S | ✅ 12 → **5** round trips. The analysis's "one statement, not a loop per batch" was already true (audit P-1, 13 Oct); what remained was `Promise.all` sending its eight aggregates as eight requests. Now one batch: same 15 statements, same rows, identical response. In the round-trip guard |

## C. Depth and vibrancy

| # | Item | Lane | Status |
|---|---|---|---|
| C1 | Dark-mode tonal steps | S | ✅ = ladder #2: dark page/surface/raised/floating 6 L* apart (3.4 / 9.2 / 15.1 / 21.1), border `#3d3752`, top-edge shine on cards |
| C2 | Hero card material (week card, Needs-you) | S | ✅ = ladder #4: the hero card's two-stop wash, 35 % accent edge and shine (flat on Low); the Needs-you card keeps its gold edge |
| C3 | Numbers that reveal (High tier only) | S | ✅ `lib/countup.js` (native rAF, ease-out, ~0.7 s): Report's latest score counts up as it first shows — high tier only; others see the number at once; screen readers hear only the number. `countup.test.js` 3/3 |
| — | Rename `Board` → `BatchStatus`, `Board2` → `FacilitationBoard` (after P declared Board final) | S | ✅ files renamed, `coord/Batch.svelte` the only importer; `ACCESS_MAP.md` regenerated (access-map test 4/4), `FRONTEND_GUIDE.md` updated; client 463/463, build within budget. MERGE_NOTES §4: delete the two old files in live after the copy |
| C4 | Shared-element travel Home → Week → Day | S | 🧪 built, Chrome-checked; **full browser run owed** (logins, nav) and p7 day-swipe red to clear (MERGE_NOTES §3b.4, 3b.7). Home's week card travels into the Week's header (`vt-week`), Home's day chips into the Day form's strip (`vt-days`), 280 ms (`public/motion.css`; High and Balanced, never Low or reduced motion). These screens draw a moment after the route changes, so the step waits for the matching element — only when a travelling element is on screen, at most 100 ms (`lib/router.svelte.js arrived()`; was 160, lowered 22 Oct: taps drop while a transition is held). Checked in Chrome: before the wait only the old snapshot existed (the card faded, it did not travel); after, both groups run old → new, no console errors |
| C5 | Scroll-linked settle on the Home painting (High only, CSS only) | S | ✅ CSS only (`app.css`): the Home painting eases from 106 % to rest as it scrolls into view (`animation-timeline: view()`), high tier only, not with reduced motion, nothing where unsupported; `scale` so the painting crossfade is untouched |
| C6 | Report with numbers | S | ✅ Report: four month tiles under the calendar — days filled (of the days so far), average, best day (score · date), longest run — from the same day percentages the squares use (no new read); 2 across on a phone, 4 on desktop. Shot 390 light / 1280 dark |
| C7 | Staff Home uses its primitives | S | ✅ coordinator Home: each batch's week as the devotee Home's `Ring` (forms submitted of those expected, as a %) beside its strip; desktop columns were already balanced. `Ring` gained optional `label`/`text` (existing callers unchanged). The 8-week sparkline is NOT added: it needs each batch's filling-chart read on every Home open — a new read per batch. HeadHome's "Batches this week" waits (HeadHome is shared with P; patch at merge). Shot 390 light / 1280 dark |
| C8 | Desktop Day form rail | P (from S, 22 Oct) | ✅ 30bf4cf: desktop rail (score, sections, Scoring, Save, Share); Ctrl+S follows it |
| C9 | Darshan halo on devotee empty states (D-6 yes) | S | ✅ `EmptyState darshan` (opt-in): today's everyday painting in the gold-ringed halo, sized for 56 px (smallest file), icon while loading / on error / when paintings are off; on History's "No weeks yet". Seen on screen (temporarily on a Report empty state, then reverted) |
| C10 | Darshan thumbnail and count-up in the week-submitted sheet (D-6 yes) | S | ✅ the submitted sheet already showed a flagship painting; its score now counts up (`countUp`, high + balanced tiers), screen readers hear the final number; the existing browser check ("This week: N%") still matches |

## D. Fewer taps

| # | Item | Lane | Status |
|---|---|---|---|
| D1 | "Same as yesterday" (D-3 yes) | P (from S, 22 Oct) | ✅ 30bf4cf: rounds added to Same as yesterday (times, rounds, book); a visible tap |
| D2 | Right keypads, Enter moves on | P (from S, 22 Oct) | ✅ 30bf4cf: enterkeyhint=next; Enter moves to the next answer on the Day form only |
| D3 | Section jump bar on the Day form | P (from S, 22 Oct) | ✅ 30bf4cf: section bar, sticky under the day strip (offset measured); Scoring as one word |
| D4 | Nudge all via WhatsApp (D-4 yes) | P (from S, 22 Oct) | ✅ 30bf4cf: Nudge N not started — one at a time, reminder pre-written (wa.me) |
| D5 | Week picker as a strip | P (from S, 22 Oct) | ✅ 30bf4cf: week strip ‹ week ›, month/week lists in a sheet |
| D6 | Desktop keyboard: `/` search, `[` `]` week | P (from S, 22 Oct) | ✅ 30bf4cf: [ ] via data-step (lib/keys.js); / already opened search |
| D7 | Reading and Hearing remember scroll and the open canto | P (from S, 22 Oct) | ✅ 30bf4cf: Reading/Hearing remember scroll; open book and canto; data-level on books |

## E. Accessibility and inclusivity

| # | Item | Lane | Status |
|---|---|---|---|
| E1 | Stored screen-reader pass of the five flows | S | ✅ stored: `docs/perf/screenreader-2026-10-22.json` — `tools/browser/screenreader.mjs` (accessible name + role of every control and live region, as TalkBack/VoiceOver would announce it) over 60 route loads: every role, 390 and 1280. **0 blocker · 0 major · 7 minor.** The minors: Welcome's tab title is the brand (intended), and "tab order jumps back up 3×" on long pages — the fixed bottom bar comes after the content in reading order but sits higher on screen; that order (content, then navigation) is the intended one. The tool itself was broken (no puppeteer in its folder; a stored session from the previous role bounced the next one off the sign-in screen) — fixed. Tone of words and real-phone gestures stay a manual check |
| E2 | Contrast re-check after C1 | S | ✅ `contrast.test.js` re-run after every token step (C1, ladder #1–#18): every text/surface pair ≥ 4.5:1 and every control edge ≥ 3:1, light and dark, all areas — 120/120. The lighter "missing" amber was rejected on this rule |
| E3 | Charts with "Show as table" | S | ✅ **verified, already built:** every chart has its numbers as text — the score bars (`Meters`) and the batch filling chart (`ColBars`) carry "Show as table"; the weekly trend (`Trend`) prints its table under the lines; `Spark` names every value in its label; `Ring` is one "n of 7" figure |
| E4 | Hindi interface strings, lazy (≈ 6–8 KB) | S | ❎ **not in this release — the head, 22 Oct:** "only for the user login … it should appear like a Hindi app, not weird; if you aren't confident to do it to the best, leave it and stay in English." Not confident at that standard now: server-written errors and the 9 PM notification would stay English (fixing needs a per-person language column + worker changes), and devotional wording needs a fluent devotee's review. App stays English. If wanted later: its own phase — devotee screens only, server-side language, a coordinator reviews the words |

## F. Backend, data, operations

| # | Item | Lane | Status |
|---|---|---|---|
| F1 | = B1 | S | see B1 |
| F2 | Sunday write ceiling: nothing added per devotee action except B4's sample | S | rule, checked per phase |
| F3 | `week.submit` stays at 9 ms CPU: no scoring change | S + P | rule; measured on the load Worker after B1 |
| F4 | PBKDF2 10k → 25k, after a load-Worker measurement | S | 🔨 no code needed: iterations are the `pbkdf2_iterations` setting, and `auth.js` rehashes on the next sign-in. Local cost 1.84 ms/hash at 25k (`tools/perf/pbkdf2.mjs`). **Release step:** measure on the load Worker (`wrangler tail`, real CPU), then set 25000 on live — a live-data change, done at the release, not before |
| F5 | Observability: rollback runbook (roadmap 6.5), cron-failure alerts (6.6) | S | ✅ rollback runbook exists (OPERATIONS §4: `wrangler rollback`, Time Travel bookmark before every remote migration; `release.mjs` rolls back on a failed check; tag `live-2026-10-21-phase19`). **Cron-failure alerts built** (`worker/src/cronfail.js`): every scheduled job's catch records `cron_failed:<job>` (≤ 1 write / job / 10 min, none on a healthy day), `settings.get` returns `cronFailed`, the head's Home lists it and the head's Home lists it under System health ("The Monday deadline run failed · time · reason", shot at 390/1280, light + dark). `cronfail.test.mjs` 8/0, red on the old code; browser `master` 36/0 |
| 6.7 | Fixtures | S | ✅ done 14 Oct (roadmap: `tools/test/phones.mjs`, the reserved-range sweep and guard) — this tracker had it wrong |
| 6.8 | Staging | S | ✅ done 14 Oct (`[env.staging]`, roadmap) — the revamp copy of `wrangler.toml` had LOST it; restored 22 Oct (see `docs/merge-2026-10-22/MERGE_NOTES.md`). Still needs the owner to create the staging D1 and its pepper |

## Product decisions (ADRs)

| ADR | Item | Lane | Status |
|---|---|---|---|
| — | One ID system (phase 20) | P | 🔨 gate running |
| 0010 | Temporary ETP facilitation, taken back on leave and on qualifying; FTP grants the lasting one | P | ✅ built f29eb09: migration 0060 `accounts.facilitation`, take-back on removal and closing, setLasting; enrol.add bug fixed |
| 0011 | The head **and class-batch** coordinators may delete; training coordinators may not (this reverses the 17 Oct note) | P | ✅ already enforced by `managed()`; pinned by etp-facilitation.test |
| 0012 | Card cadence (weekly/monthly), groups, month scorecard, seva + goal ranking | P | ✅ built 7b7b53b/1b473ea/27d7f06: groups, seva/sadhana apart, goal from eligible, seva+goal rank, month scorecard (card.months) |
| 0013 | Sadhana leaderboard + export | P | ✅ built f29eb09: leaderboard.get/mine, staff screen + export, devotee rank on Report; follows submit_closes |
| 0014 | Facilitator rename cascade, ETP facilitators, a leaving facilitator's students as head decisions | P | ✅ built f29eb09: rename cascade, Needs a new facilitator (Facilitators + Admin Home) |
| 0015 | Staff permissions | P | 🔨 server built (grants.js, migration 0061, gate at no extra hop, 34/0); Admin › Access screen applies after the browser run |
| — | Route/action access map | P | ✅ tools/access/map.mjs → docs/ACCESS_MAP.md, drift test |
| — | `Card.svelte`, `Scoreboards.svelte` design after P's data | S after P | ✅ (phase 5b) **Card:** each part a raised card with the gold-hairline title, the net score leads with the hero wash, the five level targets as tiles (two or three to a row, not five full-width rows), figure fields beside their labels at every width (≈ 15 % shorter on a phone), "no target" as a quiet tag, two columns from 1024 px. **Scoreboards:** places 1–3 in gold, figures in serif with a thin bar in their band (100/80/50), the "Board" label screen-reader-only. Shot 390 light / 1280 dark with a filled card. **Found on the way:** `--fs-xs` was used by 7 screens and never defined (their small print rendered full size) — now defined in the theme |

## G. Found by the measured audit of 22 Oct (`OPTIMIZATION_AUDIT_2026-10-22.md`) — in neither lane before

Measured on the live app and on a read-only export of HEAD `7b7b53b`; per-action costs in `docs/perf/api-cost-2026-10-22.md`.

| # | Item | Lane | Status |
|---|---|---|---|
| G0 | Placement region hint `[placement] region = "aws:ap-southeast-1"` in place of `mode = "smart"` (live shows `cf-placement: local-*` on every call: the API is not beside D1) | S | ✅ built (revamp `worker/wrangler.toml`): `region = "aws:ap-southeast-1"` — D1 is served from **SIN** (`served_by_colo`), so that is the region; syntax checked against Cloudflare's placement page (hints and `mode` are exclusive) and accepted by `wrangler deploy --dry-run`. Live before: `cf-placement: local-MRS`. **At the release:** cf-placement must stop reading `local-…`; the page does not say whether hints are free-plan, so if the deploy refuses the key, put back `mode = "smart"` |
| G1 | Session sliding-expiry `UPDATE` through the raw binding, so it no longer clears the per-call memo (settings read twice, +1 hop) | S | ✅ a call due its hourly refresh costs what it always does + the one background UPDATE (`home.get` 8 → 7, `stats.batch` 7 → 6, `settings.get` 6 → 5); parity identical; guarded |
| G2 | Idempotency read (`replies`) inside the `scopeReads` batch: −1 hop on every write | S | ✅ −1 round trip on every replayable signed-in write; a replay answers in 2 (was 3). Every check still runs in the same order, so refusals answer as before (parity identical incl. FORBIDDEN, VALIDATION, bad request id); guarded |
| G3 | Happy-path tests for `criteria.set`, `reopen.reject`, `auth.logout`, `auth.sessionEnd` (never called successfully by any suite) | P | ✅ happy-paths.test (logout, sessions, logoutAll, reopen.reject) + criteria.set in eligible.test |
| G4 | `_headers`: long cache for `/darshan/*`, `/brand/*`, `/icons/*`; `motion.css` and `contrast.css` into the hashed build | S | ✅ `_headers`: paintings 30 days, brand + icons 7 days (+ stale-while-revalidate); NOT immutable — they are named by painting/size, not content hash, so a re-encode must still reach phones. `darshan.json`/`blur.json` stay `no-cache` (rules match by extension so they never merge). Read back from a local `wrangler dev` of the build. `motion.css`/`contrast.css` left: both are precached by revision, so a header changes nothing for the installed app |
| G5 | `worker/src/limits.js`: every per-run constant in one place, env-overridable (free → paid is then a `[vars]` edit) | S | ✅ eight caps (push, mirror rows/trim, erase, deadline/auto, retention rows/sheet) in `limits.js`; `LIMIT_<NAME> = "n"` in `[vars]` raises one, within a ceiling; junk keeps the free number; applied at every fetch/scheduled. No var set = today's numbers exactly. `tests/limits.test.mjs` 13/0 (fails without the file) |
| G6 | N+1 → one `GROUP BY login` in `eligible.list` (2 hops per member), `closingPreview` (1 per member) and both `board.get` shapes (11 per trainee) | S, after P's ADR 0012 on `board.js` | ✅ all four no longer grow with people: `eligible.list` → **4**, `closingPreview` → **5**, `board.get` → **7–8** at any size. A board of 126 cost **1,397** round trips before and bound **128** parameters in one statement (D1 refuses > 100); now the same as a board of one, IN lists chunked at 90. Pinned in the round-trip guard; `audit:sql` 0 new scans |
| G7 | `leaders.list` reads the requested batch only, not the whole level (1,898 → ≤ 625 rows at 5k) | S | ✅ **as round trips, not rows.** Reading only the requested batch would break the contract (§ group leaders, the head 3 Oct: "SPS, SPS Group 2 and SPS Online are one pool"), and every column read is on the screen, so the rows stay. The level's pool and the batch names now come from the batch list already in memory: `leaders.list` 7 → **4**, `group.list` 8 → **6**, `leaders.assign` 10 → **8**; parity identical; guarded |
| G8 | `journals.get`: client always sends `have`; unchanged answer in 1 hop (581 rows p50 today) | S | ✅ **verified, no change needed.** Every caller (`refdata.js getJournals`) already sends `have` whenever the phone holds a copy, and asks only when Home reports a newer version (live: `journals_version` j3 on both sides). A full answer goes only to a phone with no copy or an outdated one — which needs it. The not-modified answer is 4 hops because the session must be checked; 1 is not possible without skipping auth |
| G9 | "Add to home screen" sheet after the first submitted week | P | ❎ already built — Devotee Home asks to install after the first filled day (once, dismissable), Menu has Install, iPhone steps in Reminder; G9 would only move it (the head, 22 Oct) |
| G10 | Per-route Lighthouse (every role, mobile) as a gate step | P (from S, 22 Oct) | ✅ routevitals --check in gate.mjs (CLS ≤ 0.1, no blocking on repeat, repeat ready ≤ 100 ms) |
| G11 | D1 read replication + Sessions API bookmark | — | ❎ not needed — the head, 22 Oct: "our audience is mostly Delhi-based" (D1 already APAC); no read copies |
| G12 | Copy audit: remove every explanatory sentence on screens (the head, 22 Oct: "no unnecessary texts or descriptions") — list in the audit §8 | S (screens) | 🔨 **S's screens done** (per `visual-review` §5): Login byline + "New here?"; Sign-up byline, "Mobile number"; Forgot 41 → 7 words; Week: "Attendance", "One whole day needed to submit.", "Submit opens …", the auto-submit note shortened (the disabled-control explanations stay — checks guard them and they say what happens next); Report: headings screen-reader-only, legend "Missing · open" / "Missed"; Account: two sub-lines; StaffHome: two row subs, "Confirm by phone first"; SignUpCard: "ID links when the dashboard registers them.", "Class day", facilitator hint only when not chosen; batch pickers' "Batch" label screen-reader-only (Requests, Members). **Kept on purpose:** the splash tagline (the head); the trust line was then reworded by the head (via P, 22 Oct evening) to "Your details stay private. · Privacy", with "New accounts require coordinator approval." above it on Welcome and Sign in; "Śrīla Prabhupāda's translation" (the translator's credit; a check asserts it), the first-run guide itself (three cards, icons and titles; only its paragraphs were cut — removing an onboarding feature is more than copy; its placeholder now 11rem to match). **P's screens** (Profile, Batch, Leaderboard, Board, Day, Reading): listed to P |
|  | **The head, 22 Oct:** KEEP the splash tagline and "Your details stay with IYF Delhi" on sign-up — G12 leaves both | | decided |
| G13 | `lib/staff.js` is emitted as `staff-*.js` but imported by the devotee chunks `Group` and `WeekPicker`, so it is left out of the offline copy (verified on live: `Group-B2Xg3sRK.js` → `staff-BLpFaOAZ.js`, not precached). Name shared helpers by folder, not by the staff test | S | ✅ chunks are classed staff/devotee by the IMPORT GRAPH at build end (`vite.config.js` `devoteeReach`), not by name: a devotee chunk named "staff" becomes `lib-staff-*`; a module outside the graph (the bundler runtime) counts as devotee (safe side). Before: Group + WeekPicker imported a non-precached `staff-<hash>.js`; after: none. `scripts/size.mjs` now FAILS any precached file that statically imports a non-precached one (red on the old build, green on the new) |
| G14 | `release.mjs` / `gate.mjs` refuse to build when `VITE_API_URL` is unset (a clean checkout builds against the mock; only the uncommitted `.env.production.local` prevents it today) | S | ✅ `scripts/size.mjs` (run after the build by both `release.mjs` and the gate) refuses a dist carrying the in-memory mock — the mark of a build with no `VITE_API_URL` — with the fix in the message. Proved on a mock build (FAIL) and a real one (OK). `.env.example` now names the Worker URL |
| G15 | Mock parity: `devotees.promote` + `promoteOptions` handlers; `photoAt` / `photoUpdatedAt`; request id and unknown-field refusals; roles of `reopen.list`, `push.subscribe`, `push.detach` as on the server | P | ✅ 27d7f06: mock refuses unknown fields / request-id-less writes (generated lib/mockfields.js); promote; reopen.list; photoAt |
| G16 | Client sends the token to the public `auth.lookup`, `push.register`, `push.unsubscribe`: add them to the client's PUBLIC set | S | ✅ `auth.lookup`, `push.register`, `push.unsubscribe` in the client's PUBLIC set; the server never reads a session for them (checked: `register` stores `login = ''`, unsubscribe's proof is the push address) and the mock is the same. New test in `api.test.js` red → green; client suite green |
| G17 | `csv-*.js` and `exportfields-*.js` (staff export only) are in every phone's offline copy: give them the staff prefix | S | ✅ by the same graph rule as G13: `csv` → `staff-csv-*`, out of the precache (`exportfields` is folded into the export sheet's staff chunk in this build); the size check's staff list also names both |
| G18 | No screen calls `phases.open` / `phases.close`, though cards, scoreboards and training attendance need an open phase | P | ✅ Admin › Phases (add/edit/close, phases.update) — ADR 0017 |
| G19 | Dead routing: `/reopens` (unreachable after the App.svelte redirect), `/devotees`, `/groups` (redirect only), `/learn` (second address for Hearing), the signed-out path list kept twice | P | ✅ 27d7f06: REDIRECTS in routes.js, followed once in App.svelte; one PUBLIC_PATHS |
| G20 | Screenshot tool (`tools/browser/shoot.mjs`) waits for the first data row, not a fixed sleep (12 screens were captured as skeletons on 22 Oct) | S | ✅ `shoot.mjs` `go()` waits until `<main>` has no `.sk`/`.skw`/`.sk-block` and has text (15 s cap, then names the screen), then a ≤ 400 ms settle — no fixed sleep |
| G21 | Vibrancy ladder #1–#19, staff console patterns, native motion (`OPTIMIZATION_AUDIT_2026-10-22.md` §8.2–8.3): widens C1, C2, C7, C8 and E2 rather than replacing them | S | 🔨 **done:** #1 raised inputs + time fields (light inputs no longer look disabled), #2 dark steps 6 L* apart + card shine, #3 gold fills, #4 hero two-stop wash, #5 today glow by tier, #6 gold hairline under section titles, #8 dark chart chroma + heat fills, #9 deeper paper + 2-layer card shadow, #10 (cells already banded; new dark heat fills), #11 status-pill dots, #12 dark splash + dark signed-out screens in brand navy, #14 accent→gold week bars, #15 segmented = white pill on tinted track (blue kept for primary buttons), #18 gold wash stop. Contrast/design/components guards 131/131 after each step; before/after shots of Day form, Home, Report, splash, Welcome. **Deviation:** the lighter amber "missing" dot is NOT applied — its white "!" would fall to ≈ 3.9:1, under the 4.5:1 text rule. Since: #7 active nav pill in its area colour + area bar on summary tiles (the "35 % area section rule" skipped: #6's gold hairline is there), #13 avatar gradient + gold ring on the Account hero, #16 sign-up steps gold when done / blue current; console §8.3 #3 row-hover area bar and #7 table header as an area rule (CSS). #19 book level bands (gold VL, blue SPS/DPS, teal BSS/BVS) done. **Left:** #17 desktop layouts (P takes the Overview grid; Report done by C6). **Motion table done** (`public/motion.css`, lazily loaded, none with reduced motion or on Low): cards rise 6 px when inserted (`@starting-style`, never the cards already on screen), the week ring draws in (440 ms), desktop rows lift 1 px; high only: today's chip pulses once, the nav's active pill slides with the page transition. The scroll-linked header fade is left out (C5's painting settle is the one scroll effect). All rules confirmed parsed in Chrome. console §8.3 #1, #2, #5, #6, #8, #9, #10 → **handed to P** (their screens), with #17's Overview grid and HeadHome's C7 part |
| G22 | Home layout shift on every return: CLS 0.19–0.38 by role ("poor" > 0.25). The devotee's "This week" card moves 248 px down when a block renders above it after the first paint. Reserve its height or render in the same frame | S | ✅ late blocks on Home draw in the same frame once loaded (`lib/lazy.js` `loadedOnce`: staff block, painting, birthdays, first-run guide) and the guide's room is held on its first load (`.fr-wait`). Returning to Home, measured at 4× CPU: devotee 0.245 → **0.001**, coordinator/head 0.332 → **0.000**, training coordinator 0.189 → **0.000**. Browser: devotee 226/0, coord 135/0, master 36/0, etp 30/0, tiers 85/0, logins 692/0; vitest 448/448 |
| G23 | Account, Settings and the training Board ask the server on every visit, bypassing the 2-minute read cache. Use stale-while-revalidate, as the other screens do | S | ✅ all three through the shared 2-minute read cache. Second visit, measured with `routevitals.mjs` (4× CPU, slow 4G): Account 1,495 → **10 ms**, training Board 2,038 → **30 ms**, Settings 1,493 → **8 ms**. Settings shares the head's Home `settings.get` copy and a save writes its answer back; the Board writes a changed mark back into its copy; opening the device list or signing one out always asks |

## Console patterns, Home and gate parts (prompt-92, 22 Oct 2026)

| # | Item | Owner | Status |
|---|---|---|---|
| §8.3 #1 | Comfortable / Compact rows, kept on the device (`lib/density.svelte.js`; Batch status toggle, Devotees list) | P | ✅ 883c69d |
| §8.3 #2 | Sticky board header (820+ table); sticky name column on the filling chart | P / S | ✅ header · name column **not applicable**: the filling chart (`Stats.svelte`) is bar charts with no per-person table, and no screen has week columns scrolling under a name; building such a grid would be a new screen, not a style |
| §8.3 #5 | Week-on-week change + 8-week sparkline per batch (Home, Overview), no new read | P | ✅ 883c69d |
| §8.3 #6 | "All N" first in the strip's filters | P | ✅ 883c69d (`ui/ScopeStrip.svelte`) |
| §8.3 #8 | Heat bar for the week | S | ✅ 7 cells, 48 × 8 px (`styles/screens.css .strip`): Batch status, devotee detail, Fac, Group |
| §8.3 #9 | Batch colours (`lib/batchcolor.js`; tokens `--sw-*` in app.css by S) | P / S | ✅ Home, Overview, Batch setup, Leaderboard. Colour comes from the batch's **level** as the server sends it (`stats.all` rows now carry `level`, mock mirrors it), never from a hard-coded id; the no-hardcoded-batches guard enforces it |
| §8.3 #10 | List + detail from 1024 px: Staff, IYF IDs › Person records | P | ✅ · reopen requests are already self-contained cards with both actions — a pane would add a tap |
| #17 | Overview as a card grid | P | ✅ 883c69d |
| C7 (head) | One stacked bar per batch on Home | P | ✅ 883c69d |
| Phase 6 | `home.staff`: Home in one request (8 → 1), parity-tested | P | ✅ 883c69d |
| Phase 7 | Screen-reader sweep as a gate part (blocker / major / error fail) | P | ✅ 883c69d |
| G10 | `routevitals --check` in the gate | P | ✅ |
