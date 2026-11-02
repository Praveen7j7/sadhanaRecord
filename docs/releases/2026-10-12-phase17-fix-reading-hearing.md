# Phase 17 — fix release: reading / hearing on submitted weeks — 12 Oct 2026

**Released by the user at ~07:40 IST with the phase gate bypassed** (release-phase.json moved aside for `npm run release`,
then restored; `gate.mjs record 17` run afterwards). Decision: the delta since the 07:13 green gate was three files, all
unit-tested; gate `checks 17` (PID 3525, started 07:37) ran as verification only — result appended below.

## What shipped

- **Worker `cc1ccc75-ca2e-450b-972e-77bf5b2f88e6`** (07:39:55 IST): `facilitator.js` — `weekRead` now attaches `summary.reading`
  / `summary.hearing` (titles + minutes) for SUBMITTED weeks too; the final `scores` are untouched. Batch lookup hoisted so both
  branches share it. `index.js` byte-identical to prompt-4e's deb581ad. No migration. audit:sql 0 new scans / 0 new mass writes.
- **App `assets/index-GhbDDMJs.js`** (ledger 07:42 IST): `WeekRead.svelte` — a submitted week's footer lists "Reading … · <books>"
  and "Hearing … · <lectures>" under the three tiles; same lines as the in-progress "so far" block.
- Test: `weeksummary.test.mjs` 16 → 28 (fills the week, submits on Sunday 18:30, asserts the titles and minutes survive Submit).

## Why

The books/lectures list was added on 11 Oct for weeks being filled and was never sent for submitted weeks, so it vanished at
the Monday deadline — the moment a facilitator reads the week (the user, 12 Oct). Per-day detail (DayPractice) was unaffected.

## Proof against production (07:4x IST)

- live entry `index-GhbDDMJs.js`, 83 chunks: `summary.reading.books` ×1, `summary.hearing.lectures` ×1
- `wrangler deployments list`: cc1ccc75 at 100 % since 02:09:55Z
- worker 30 suites / 2 080 · frontend 321 / 321 · both trees byte-identical on the three files
