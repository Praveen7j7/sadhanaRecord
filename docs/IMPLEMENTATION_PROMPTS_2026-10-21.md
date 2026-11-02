# Sadhana Record — the phase prompts (used internally during the build)

**21 October 2026.** One prompt per phase, in build order. Each is self-contained: what it builds (by issue ID from
`AUDIT_BLUEPRINT_2026-10-21.md` Deliverable 7), what it must not touch, how it is checked, what it measures before
and after, and when it stops. The build runs them in order in one copy of the tree; nothing goes live until a
release point. Standing rules from `CLAUDE.md` apply to every phase and are not repeated: no invented phone
numbers, no ID numbers, no artifacts, `audit:sql` before any worker deploy, the mock mirrors the server, a new
test fails first, no edits during a browser run, both trees copied the same day.

**Wiring rule (the head, 22 Oct 2026): build nothing standalone.** Every screen and action added in these phases
reads the values the app already holds — `settings.submit_closes` for the week's deadline, the phases table for a
phase, the batch's own dates for a training, `scopeBatches` for who may see what, `shared/scoring.js` for a score.
Nothing re-implements a boundary, a window or a rule it could read. Verified 22 Oct: the deadline is already one
setting, front and back (`oversight.js`, `lib/api.js`, the mock), so changing the submit time moves every window
with it. Each phase's checks include one test that moving the setting moves the behaviour.

**Scope rule (the head, 22 Oct 2026): everything discussed ships in THIS revamp.** Nothing agreed in the
21–22 October conversation is parked for a later round. That means ADRs 0010–0013 in full — the temporary ETP
facilitation role, who may delete, the card's weekly/monthly split with its two groups, the month scorecard, the
seva + goal ranking, the leaderboard, the route access map — alongside the performance and design phases already
planned. If something cannot be built as agreed, it is **reported with the reason**, not quietly deferred.

**Two sessions, two lanes (the head, 22 Oct 2026: "cooperate with your other session and build all which is
discussed").** Every item agreed on 21–22 Oct is in one of two lanes. Neither lane edits the other's files; a file
both need is done in the order agreed by message first.

| | **Product lane — prompt-92** | **Speed & design lane — prompt-5b** |
|---|---|---|
| Builds | one ID system (phase 20, gate running) · ADR 0010 temporary ETP facilitation · ADR 0011 who may delete · ADR 0012 card cadence, groups, month scorecard, seva + goal ranking · ADR 0013 leaderboard + its export · ADR 0014 facilitator rename, ETP facilitators, students-of-a-leaving-facilitator decisions · ADR 0015 staff permissions (after the head confirms the list) · the route/action access map | phase 2 B1 round trips (with parity tests) and A1/A3/A5/A2/A6 first paint · phase 3 public/shell split · phase 4 tokens, dark tonal steps, card variants, reveal props, SectionBar, DayRail · phase 5 Home, Day, Report, staff Home · phase 6 Day form (Same as yesterday, keypads, optimistic save), Nudge all, week strip, desktop list-detail, focus order, sampled vitals, darshan touches |
| Tree | the live tree `sadhanaRecord/`; copies each release to the revamp the same day | `sadhanaRecord-revamp/` until a release, then syncs to live by agreement |
| Shared files, in order | `cards.js`/`board.js`/`phases.js`: prompt-92 adds ADR 0012's frequency and groups **first**; prompt-5b's B1 parity pass follows, measured against that new behaviour (prompt-5b's proposal, agreed 22 Oct). `Card.svelte`, `Scoreboards.svelte`: prompt-92's data first, prompt-5b's design after. `profile.js`, `admin.js`: prompt-92 until phase 20 is live. | |
| Releases | numbered in turn (20 = one ID system); the next free number at gate time; message before a gate run; no edits to the live `frontend/src` during the other's run | |

**Release points — ONE (the head, 22 Oct 2026):** *"we won't be deploying phase wise … first the build and the
testing for all the phases, then one final test, then deploy."* Per phase: server + client suites, `audit:sql`,
the browser parts it touches, screenshots — no gate, no deploy. At the end: merge both lanes into the live tree →
one `gate.mjs checks 20` → `npm run deploy` → `npm run release`. Every "Release A/B" and per-phase "gate" line
below now means **checkpoint**, not release.

> **Revised 22 October 2026.** Phase 0 is done (the tree was already a git repository; everything since 17 Oct is
> committed as `55faf3c`, tagged `live-2026-10-21-phase19`). Every decision below is now **answered**, and five
> pieces of work arrived with the answers that were not in the 21 Oct blueprint. They are inserted as **phase 1b**
> (rules and access) and **phase 5b** (the card, the month card, the leaderboard), both described at the end of
> this file. ADRs 0010–0013 hold the rules; this file holds the build order.
>
> **Answers of record:** D-1 head **and class** coordinators may delete (ADR 0011) · D-2 ETP grants a temporary
> facilitation role, taken back on leave *and on qualifying*; FTP grants the lasting one (ADR 0010) · D-3 yes ·
> D-4 yes · D-5 yes · D-6 yes.

**Decisions the prompts depend on** (answered once, before the build starts; an unanswered one skips its item):
D-1 who may delete accounts after `batches.kind` · D-2 a removed/left trainee's facilitator scope · D-3 "Same as
yesterday" on the Day form · D-4 "Nudge all" via WhatsApp · D-5 sampled real-phone vitals (≈ 50 writes/day at scale)
· D-6 darshan halo on devotee empty states and the thumbnail in the week-submitted sheet.

---

## Phase 0 — Recoverable baseline (R-01) · ~1 hour · no app change

**Build.** In the parent repository: add `sadhanaRecord/` (excluding `node_modules`, `dist`, `screenshots`,
`tools/store/*.jks`, `keystore-password.txt`, any `*.json` key file) and commit as `phase 19 live — baseline before
modernization`; tag `live-2026-10-21`. Do the same for `sadhanaRecord-revamp/` only if it differs (it does not
today). Record in `docs/releases/`: the tag, the live Worker ids (`9a696441`, `be468dd6`), the D1 Time Travel
bookmark taken now, and the rollback steps (checkout tag → `npm run deploy` → `npm run release`).
**Checks.** `git ls-files sadhanaRecord | wc -l` > 0; `git diff --stat` between tag and tree empty; the secret
files are NOT in the index (`git ls-files | grep -E 'jks|keystore|service-account|sadhanareport'` empty).
**Stop if** any secret would be committed.

## Phase 1 — Correctness decisions (R-08, R-34, R-25) · needs D-1, D-2

**Build.** (R-08) migration `0059_batch_kind.sql`: `batches.kind TEXT NOT NULL DEFAULT 'class'`, set `'training'`
where `batch_id` matches `^(ETP|MTP|FTP)-\d+$`; `devotees.delete` gated per D-1; `isTrainingBatch()` reads `kind`
with the regex as fallback until every row is set. (R-34) per D-2: on `enrol.remove` and on closing with
`repeat`/`left`, clear `facilitator_name` only if the person holds it from this enrolment alone (audit row says
`facilitator: name` on `enrol.add`) — never from a facilitator who was one before. (R-25) `docs/OPERATIONS.md`
gains the rollback runbook; a cron-failure line in `run_log` becomes a System-health item on the head's Home.
**Guards.** `roles.test.mjs` GATE_OF_RECORD and `ownership.test.mjs` updated with reasons; fail-first tests for
both rules; mock mirrors both.
**Checks.** server suites; `audit:sql` 0 new; browser parts `coord`, `etp`, `master`.
**Measure.** none (behaviour). **Stop if** D-1 or D-2 is unanswered → skip that item, say so.

## Phase 2 — Fast calls and fast first paint (R-02, R-03, R-05, R-06, R-11, R-16, R-28) · the first measurable phase

**Before.** Store: hop counts per action (the scratch counter in the blueprint, saved as
`tools/perf/hops.mjs`), `run_log` averages since 14 Oct, `npm run size`, Lighthouse Welcome + Login
(`docs/perf/lh-<date>-before-*.json`).
**Build, server (R-02, R-16).** For each of `card.of`, `card.get`, `stats.batch`, `devotees.get`, `board.get`,
`settings.get`, `profile.get`, `journals.get`, `home.get`: list its reads in order, mark the independent ones,
batch them with `db.js reads()`/`rows()`, memoise anything `scopeReads` already holds, never trade more rows for
fewer hops, never touch scoring or `week.submit`. `closingPreview`: one `GROUP BY login` count. Targets: ≤ 7 / 7 /
6 / 6 / 6 / 4 / 5 / 4 / 8 hops. For every action: a **response-parity test** (same fixtures, old vs new JSON,
refusal paths included) committed in `worker/tests/parity-<action>.test.mjs`.
**Build, client (R-03, R-05, R-06, R-11, R-28).** `Darshan.svelte`: choose the final candidate once (no
480-then-960 switch), `fetchpriority="high"` on the Welcome hero, keep the blur placeholder and the failure
fallback. Critical CSS: a build step inlines tokens + layout + public-page rules into `index.html` and loads the
rest non-blocking; prove no duplicated rule and no flash. Darshan catalogue: build writes `darshan-today.json`
(the day's sequence only, ≤ 2 KB) and the public pages preload that; the full catalogue loads on the signed-in Home
only. Icons: regenerate `icon-192/512` and maskables with the `sadhana-brand-logo` skill at ≤ 12 / ≤ 45 KB. Splash
skipped when a kept user exists.
**Checks.** server + client suites; `audit:sql` 0 new; browser parts `welcome`, `devotee`, `etp`, `coord`,
`master`, `phase1`, `darshan9`; collision sweep.
**After.** Same measurements; the phase record table: hops before/after per action, Lighthouse before/after,
bytes on Welcome before/after. **Accept** when every hop target is met with parity green, Welcome ≥ 95 and LCP ≤ 2.5 s,
size within 60. **Stop if** any parity diff shows a changed field — fix the batching, never the test.

## Phase 3 — Public/shell split and the budget ladder (R-04) · then **Release A**

**Build.** Two entries: `public` (Welcome, Login, Sign up, Forgot, the token/session minimum, theme + tier
bootstrap) and `shell` (Shell, nav, menu, cache, prefetch, Home) loaded only when a session exists. `routes.js`
stays the single table. `scripts/size.mjs` gains `public ≤ 35 KB` (fail) and keeps shell 60 / 55, lazy 30 / 35,
precache 800. Service worker: both entries precached; `navigateFallback` unchanged; `carry-assets` carries both.
**Checks.** `tests/sw.test.js`, `routes.test.js`, `lazy.test.js` extended; browser `logins` (every role, four
widths), `welcome`, `phase1` (offline reopen, ended session, update reload); the gate's smoke on every public
route; one manual check on a real Android phone: install, sign in, kill, reopen offline.
**Measure.** `size.mjs` public/shell; Lighthouse Welcome + Login stored.
**Release A:** `release-phase.json` → 20 (or the next free number), `gate.mjs checks`, `npm run deploy`, `npm run
release`, live smoke, record, broadcast, copy to the revamp. **Stop if** the self-reload or the offline reopen fails
on the real phone.

## Phase 4 — Tokens and themes (R-10, R-20 base, R-36)

**Build.** Dark surface steps opened (≈ `#121018 / #1b1924 / #262330 / #312d3e`, validated), `--glass-edge`
top highlight on raised cards in dark, deeper `--shadow-2`; `Card` gains `hero` (soft area wash ≤ 8 % light /
≤ 10 % dark in the header) and `raised` variants; `Ring`/`Meters`/`Bars` gain a one-shot `reveal` prop (CSS
`@property`, High only, final state on Balanced/Low and reduced motion); `SectionBar` and `DayRail` primitives;
chart primitives gain a `table` twin snippet; per-route `document.title` on public routes. No screen is changed yet.
**Checks.** `contrast.test.js` for every token pair in both themes; `components.mjs`; `motion-audit.mjs`;
screenshots of the primitives page in both themes.
**Measure.** CSS size (target ≤ 15 budget, note the delta). **Stop if** any pair drops below 4.5 : 1.

## Phase 5 — The high-frequency screens (R-12, R-13, R-14, R-15, R-35 part, D-6 if yes)

**Build.** Home: week card = `hero`, darshan card scroll-settle (CSS scroll timeline, High), number reveal on the
ring; shared-element travel Home → Week → Day (View Transitions, three `view-transition-name`s). Day (desktop):
`DayRail` from 1024 px with score, section index, "How your day is scored"; the floating bar below that. Report:
month numbers (days filled, average, best day, streak from `history.list`), two columns on desktop, ring only
when a day is chosen, "Show as table". Staff Home (coordinator, head): counters as `Meters`/`Ring` with `Spark`,
balanced columns, "Batches this week" as one bar per batch. D-6 items if yes.
**Checks.** browser parts `devotee`, `coord`, `master`, `p7`, `tiers`; screenshots every changed route at
390/820/1280/1920 light + dark; collision sweep 0; `space-audit` ≥ 70 % on Report/Day; `motion-audit`.
**Measure.** Devotee and staff chunk sizes (≤ 30 KB each); DOM nodes on Home/Report at 4× CPU.

## Phase 6 — Workflows and secondary screens (R-07, R-09, R-17, R-19, R-21, R-22, R-26, R-27, R-29, R-30, R-31,
R-32, R-35 rest, R-37) · needs D-3, D-4

**Build.** Day form: `SectionBar`, `inputmode`/`enterkeyhint` on every numeric and time field (verify on a phone),
D-3 "Same as yesterday" as a visible button that copies yesterday's times and rounds into the form (never saved
until Save). Optimistic save (B2) with the request id kept, STALE → the server's copy wins and says so, refusal →
the form shows the error and keeps the entry. Head's Home: one `home.staff` aggregate action (GATE_OF_RECORD,
ownership) replacing the 8 calls. Boards: week strip; D-4 nudge-all. Identity: the merge/unmerge sheet with both
histories side by side (`identity.merge` exists). Renames `Board` → `BatchStatus`, `Board2` → `FacilitationBoard`.
Desktop list-detail for IYF IDs, My targets, Wall, History, Scoreboards, Reopens. Keyboard `/`, `[`, `]`. Reading and
Hearing remember position. Focus order fixed on Account and the staff Homes at 390. The `SR` regex leftover, the
`WeekRead` warning, the Activity caption.
**Checks.** `writes.test.js` (every new write), `roles`/`ownership`; browser `dayview`, `devotee`, `coord`,
`master`, `heads9`, `logins`; the screen-reader sweep per persona stored (tool fixed first, R-38); taps per repeat
day counted before/after in the Day browser part.
**Measure.** head's Home requests 8 → ≤ 3; Day repeat-day entries; chunk sizes. **Stop if** the optimistic path
cannot pass the STALE and refusal tests — ship the phase without B2.

## Phase 7 — Validation, measurement and **Release B** (R-23, R-24 if D-5, R-33 measurement, R-38)

**Build.** `screenreader.mjs` fixed and added as a gate part; D-5 sampled vitals if yes (1 open in 100 →
`run_log`, counted in `read-budget.test.mjs`); load-Worker runs with `LOAD_METER=1` for `stats.all`, `week.submit`,
`auth.login` at 10 k and 25 k PBKDF2 — numbers to the head, no change.
**Checks.** full gate (`checks <n>`), 180-view collision sweep, screenshots per role both themes, Lighthouse stored,
`space-audit`, screen-reader sweep, hop table, sizes — all into `docs/perf/` and the release record's before/after
table (Deliverable 10 of the blueprint, every line filled or marked not met with the reason).
**Release B:** gate → `npm run deploy` (if the worker changed) → `npm run release` → live smoke → record →
broadcast → copy to the revamp → tag.

---

### Transition rule between phases
A phase hands the next one: its record section (what changed, measurements, what was skipped and why), green
suites, and a quiet tree. The next phase begins by re-running the previous phase's measurement once to confirm
the baseline it inherits. A regression found in a later phase is fixed in that phase and noted against the one
that caused it.

---

## Phase 1b — The rules from the card, and access made visible (ADRs 0010–0013)

Inserted 22 Oct 2026, after the head read the live Excel card and set the scoreboard rule.

**Build — the card's shape (ADR 0012).** `measures` gains `frequency` (`weekly` | `monthly`) and `group`
(`sadhana` | `vl2reg` | `target`), set from the head's card: weekly = sadhna, stall, calls, vl1att, vl23att,
oneToOne, ftp; **monthly = seniorMeet, seriousOne, allMeet, journal**. Group 1–4 under "Vedic Level 2
registration", 5–10 under "Target" with its per-level numbers (VL-3 8 · SPS 6 · DPS/BSS 5 · BVS 0). Data, not
code. `card.get` returns both fields; `card.fill` refuses a monthly value outside its month; **week scoring
ignores monthly measures entirely** and stored week scores are never rewritten (ADR 0004 stands).

**Build — the month scorecard (ADR 0012 D/E).** One card per person per closed month: sadhana average, seva
average (weekly measures plus the four monthly), and the goal — how many of **their own** students became
eligible for promotion on the class ladder, from the **phase** start for a facilitator or the **batch** start for
an ETP trainee, to the previous completed week. Computed from stored weeks; no recomputation, no new writes.

**Build — the scoreboard rule (ADR 0012 F).** This app ranks on `(seva % + goal %) ÷ 2`; sadhana is shown, not
ranked. The screen says which rule it uses. **The Facilitator Dashboard is NOT changed here** — it keeps equal
thirds until the head approves that separately; write the change up for that project rather than making it.

**Build — the leaderboard (ADR 0013).** Weekly for a devotee (their own rank only, no names); weekly, monthly,
yearly and a bounded custom range for staff; own batches for a coordinator, any batch and all of IYF Delhi for the
head. Ranks on stored `overall`, average over longer ranges, ties share a rank. A read, paged, no schema change.

**Build — the access map.** `docs/AUTHORIZATION.md` gains a table with one row per route and per action: who may
reach it, what narrows it (`scopeBatches`, `behalfBatch`, object checks), and what a refusal says. Generated from
the registry and `routes.js` so it cannot drift, and checked by a test that every action appears. **Note already
verified 22 Oct:** exports are correctly scoped today — a coordinator is served only their own batches and
non-personal fields, and head-only row kinds are refused server-side.

**Checks.** Fail-first tests for each rule; `roles`/`ownership` extended; mock mirrors every new field and action;
browser parts `coord`, `master`, `etp`, `devotee`.
**Measure.** Hops for the new reads (≤ 6 each); rows read for the leaderboard at 50 and 500 devotees.
**Stop if** the month card's goal count cannot be derived from stored data without a new write.

## Phase 5b — The card and the boards on screen

Grouped sections on the weekly card ("This week" / "This month", with the card's own two groups and the Target
numbers); the month scorecard screen; the leaderboard screen for staff and the one-line rank for a devotee; the
scoreboard's seva + goal columns. Styled with the phase-4 tokens; no imagery on staff screens.
**Checks.** Screenshots of each at 390/820/1280 light and dark; `space-audit`; collision sweep; the screen-reader
sweep; browser parts for each role.
