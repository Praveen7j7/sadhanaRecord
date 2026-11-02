# Phase 21: build tracker (started 23 Oct 2026, prompt-3d)

The head asked, on 23 Oct 2026, for six pieces, built in `sadhanaRecord-revamp/` as **one phase**: build all of it,
then one full test pass, then one release. Fixes found in testing go to a support session. The head opted out of
further questions ("ok go ahead"), so the decisions marked **my call** below were made by the builder. The head can
overrule any of them.

Live before this phase: phase 20, app `index-5ecRWMrU.js`, API `01c62ce8` (see
`docs/releases/2026-10-22-phase20-RELEASE_AND_FIXES.md`). Migration numbers from **0062** are claimed for this phase
(prompt-53 confirmed it holds none).

**LIVE 23 Oct 2026, 14:58 IST** — app `index-P60JWOD0.js`, API `7e5c22c3`, migrations 0062–0064. Record:
`docs/releases/2026-10-23-phase21.md`.

Status: ✅ built and checked · 🔨 in progress · ⬜ not started

| # | Piece | Status |
|---|---|---|
| 1 | TRD temple activities on the Day form | ✅ built; server 14/0 (`temple.test`), browser `temple` 12/0 |
| 2 | Hearing: week slider instead of ‹ ›, search over the lectures | ✅ built; browser `devotee` 238/0, `pro` 50/0, `oct7` 16/0, `oct8` 13/0 |
| 3 | Facilitator targets: set at the phase start, locked after; achievements by week and month | ✅ built (ADR 0018); server `target-lock` 33/0, `card-scoring` 59/0; browser `targets21` 22/0, `facCard` 36/0 |
| 4 | Promotion explorer for facilitators | ✅ built; server `explorer` 18/0, round trips 6 at any size; browser `explorer` 29/0 |
| 5 | Admin › Analysis for the head (sadhana AND training, one screen) | ✅ built; server `analysis` 14/0 (3 round trips a year); vitest `analysis` 8/0; browser `analysis` 25/0 |
| 6 | Vaishnava Songs in the side menu | ✅ built; vitest `songs` 7/0, browser `songs` 46/0 |

## 1. TRD temple activities

The head's reference screenshot ("Update Sadhana"): a **Temple Activities** block with Mangal Aarti, Darshan Aarti,
Morning Class and Prasadam, each **On Time / Late / Absent**. The person also lives in the temple, so these are asked.
- Shown only to members of a batch whose level is **TRD** (Temple Residents). Other batches never see it.
- **My call: recorded, not scored.** The SPS card that TRD is scored on stays as the head's Excel card defines it.
- **My call: optional.** A day is complete without them.
- Visible wherever a staff member reads that devotee's day (facilitator, coordinator, head) and in the export.

## 2. Hearing

- The lesson weeks (1–81) become a horizontal strip of week chips: snapped, the chosen week kept in view, ←/→ keys and
  the swipe on the list kept. The ‹ › buttons go. It lives in the shared `devotee/LectureList.svelte`, so the Day
  form's hearing-topic picker gets the same strip.
- A search box over the lecture titles, in both the one-week and all-weeks views; typing switches to all weeks. It
  keeps its focus while typing.

## 3. Facilitator targets

- The first visit in a phase opens on **setting targets** (the eleven measures **and** the level targets, as one step).
  Later visits open on **this week's achievements**.
- Weekly and monthly measures shown separately, each row as *target · achieved*. Monthly rows show the
  **month-to-date** total against the target (not only this week's figure).
- **Lock (my call):** targets can be changed until the end of the phase's first week (`starts_on` + 6 days, or a date
  the head sets per phase in Admin › Phases). After that, someone who has **never** set targets may set them once
  (a facilitator who starts mid-phase, or the current Kartik phase). Any later change needs the head to **unlock**
  that person's targets (7 days, with a reason, logged in Activity, modelled on `card.unlock`).
- Fixes a live bug: the Yes/No measures (VL-1 attendance, VL-2/3 attendance, FTP/ETP, journal) could not get a
  target from the screen, so they were never scored.

## 4. Promotion explorer (facilitators)

- A facilitator's own students who are eligible for promotion, **across batches**. It opens with the batch promotion
  criteria applied (e.g. VL-3 → SPS = 50% attendance AND ≥ 4 rounds). The facilitator can change the parameters and
  the period (last week, last month, last year, phase, custom from–to), as the Spiritual Dashboard's Explorer tab does.

## 5. Admin › Analysis (head only)

- Batch-wise trends over a period (week, month, year, phase, custom): rounds, reading, hearing, seva, scores, night
  stay, the four principles, attendance, submission rate. Charts plus an increase/drop report in plain sentences
  (the facilitator dashboard's "Needs attention / Worth watching / Going well" pattern).
- **Data path (my call):** a new `batch_weeks` summary table, one row per batch per week, written by the Monday
  deadline job (~10 writes a week) and back-filled once by its migration. A year then reads ~500 rows, not ~260k.
  Only the head's tab reads it. The unfinished current week is not in it.

## 6. Vaishnava Songs

- A **Songs** entry in the side menu for every signed-in person.
- English: the in-app reader built from the English song book (ISKCON Desire Tree, compiled by ISKCON Chowpatty):
  170 entries in 23 sections, a search over title, verses and author, a song page with verses and translation.
  Data: `frontend/public/songs/en.json` (445 KB, 161 KB gzipped), made by `tools/songs/import.mjs` from the PDF's
  text (`tools/songs/pdftext.swift`). Loaded only when the screen opens; kept on the phone after the first open.
- Hindi: the book's text is in an old font encoding (it extracts as gibberish), so it is offered as its **PDF**.
  A searchable Hindi view needs a converted copy that a Hindi reader has proofread.
- Both PDFs are downloadable from the screen (`/songs/vaishnava-songs-en.pdf`, `-hi.pdf`).
- Assumes IYF is happy to share the compilation inside the app (the translations are likely BBT's).

## What was built (files)

**1. TRD:** `shared/temple.js` (the four activities, the three answers); migration `0062_temple_activities.sql`
(`batches.temple_activities`, TRD = 1; `rules_version` → r3); `worker/src/weeks.js` (allow-list + check, refused
outside a flagged batch); `worker/src/rules.js` (`temple: true|false`); `frontend/src/devotee/Day.svelte` (the block
after Service, a "Temple" jump chip, ✓ when all four are answered); `lib/report.js` (staff's one-line day summary),
`lib/share.js` (WhatsApp text, only when answered); mock: `mock.js` (TRD flag, fixture **6000000092 / trd-pass-12**
Raman Das, IYFD-2021-0092), `mockweeks.js` (same rules; TRD now on the SPS card as on the server). Tests:
`worker/tests/temple.test.mjs`, `rules.test.mjs` (r2 → r3), verify part `temple`. Not done: the export columns.
**6. Songs:** `tools/songs/{pdftext.swift,import.mjs}`, `frontend/public/songs/{en.json,*.pdf}`, `public/_headers`,
`frontend/src/{lib/songs.js,screens/Songs.svelte}`, `routes.js`, `lib/nav.js`, `SignedIn.svelte`, `ui/Icon.svelte`
(music), `vite.config.js` (runtime cache for en.json). Tests: `frontend/tests/songs.test.js`, verify part `songs`.
**2. Hearing:** `frontend/src/devotee/LectureList.svelte` (a strip of the 81 lesson weeks replaces ‹ ›, the chosen week
kept in view, the suggested one dotted, ←/→ moves focus with it; one search box above both views, typing switches to
All weeks). Shared with the day form's hearing picker. verify.mjs: the Hearing checks moved to the strip, plus "keeps
its focus while typing and searches every week".
**3. Targets:** migration `0063_target_lock.sql` (`phases.targets_until`, `target_unlocks`); `worker/src/phases.js`
(lock in `targets.set`/`stages.set`, `targets.unlock`, `targets` + monthly `monthValue` on card.get/card.of,
`phases.update/list` targetsUntil); `api.js`, `roles.test.mjs`, client WRITES; `screens/Card.svelte`;
`master/Phases.svelte` (date field); `lib/mockcard.js`; ADR `docs/DECISIONS/0018-targets-fixed-at-phase-start.md`.
**4. Explorer:** `worker/src/explorer.js` (`fac.eligible`: students by `memberships.facilitator`, ladder levels only,
every figure over the period via `eligible.js figureReads`, each batch's rule; only IYFD IDs shown); `api.js`;
`frontend/src/fac/Explorer.svelte` (period chips, routes, the sheet's criteria table: tick, rule, own threshold,
"N meet · M have data"; criteria outside the rule can be added; Qualify / Everyone); route `/explorer`, menu
"Promotion explorer"; mock `mockstaff.js` (`fac.eligible`, NEXT_LEVELS as the server's ladder), `mockcard.js`
(`ruleOf`). Tests `worker/tests/explorer.test.mjs`, round-trips line, verify part `explorer`.
**5. Analysis:** migration `0064_batch_weeks.sql` (summary + back-fill); `worker/src/analysis.js` (`refreshWeeks` in
the deadline job's closing batch, `analysis.get` with the trainings' live figures); `weeks.js`; `api.js`;
`audit-allow.mjs` (two lines); `frontend/src/{lib/analysis.js, ui/LineChart.svelte, master/Analysis.svelte}`; Admin tab
`/analysis` (lazy chunk 7.4 KB); mock `mockstaff.js` + `mockcard.js` (`trainingsSummary`). Tests
`worker/tests/analysis.test.mjs`, `frontend/tests/analysis.test.js`, round-trips line, verify part `analysis`.
**Speed check:** `tools/perf/routevitals.mjs` now visits `/songs` (devotee), `/explorer` (facilitator), `/analysis` (head).
**Build:** startup JS 39.1 KB of 60; CSS 14.3 of 15; precache 746 of 800; staff-Admin 34.4 of 35 (the next Admin
tab must be lazy). Phase set to 21 (`frontend/release-phase.json`).
**Generated:** `docs/ACCESS_MAP.md` + `frontend/src/lib/mockfields.js` (`node tools/access/map.mjs`). Note: the
revamp's `docs` IS live's `docs` (a symlink), so live's own access-map test is red until the merge.

## Notes for later
- The mock's sample devotees carry old KT26 fixture IDs, so screenshots of other screens show them; live shows IYFD
  ones (migration 0056, and phase 20 issues an IYFD at the next open). Modernising the fixtures touches many checks.
- From the head's Spiritual Dashboard sheet (read-only, not changed): its Promotion Explorer's sadhana "In use" cell
  E10 holds a typed 60 instead of its formula, and the principles tick is off against the official rule.

## Test plan (once everything is built)

1. Unit + server suites, `audit:sql`, the access-map generator, build + size.
2. ONE frozen copy, the full browser suite plus each piece's new checks, run with nothing else heavy on the machine.
3. Reds go to the support session; one re-freeze; targeted reruns; then the gate (`gate.mjs checks 21`).
4. Release: migrations → `npm run deploy` → `npm run release`, then smoke, then broadcast.

## Log

- 23 Oct 12:00 Research done for pieces 2, 3 and 5 (subagents); 1 and 4 in progress.
- 23 Oct 12:15 Songs data imported (`en.json`), PDFs copied, `_headers` rule for `/songs/*`.
- 23 Oct 13:15 Promotion explorer and Analysis built and checked; worker 72 suites / 3327 green, audits 0 new.
- 23 Oct 13:18 Full test pass started on a frozen copy (port 5260); 14:03 green.
- 23 Oct 14:08 merged into live; gate 21 green 14:48; migrations, API 7e5c22c3, app index-P60JWOD0; recorded live 14:58.
- 23 Oct 12:50 Hearing strip + search built and checked; targets lock (ADR 0018) built and checked.
- 23 Oct 12:30 Songs screen built and checked (46/0). TRD temple activities built and checked (server 14/0, browser 12/0); vitest 471/471.
