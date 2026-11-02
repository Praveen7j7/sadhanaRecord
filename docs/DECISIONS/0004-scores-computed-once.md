# ADR 0004 — Scores are computed once at submit and never recomputed

**Status:** accepted

## Context
A week's percentages feed the batch sheets and the facilitator dashboard. If the card changed, a recomputed history
would silently change past results.

## Decision
`week.submit` (and the Monday deadline) compute the week's scores with `shared/scoring.js` and write them into
`submissions` together with the compact week JSON (`weekjson.js`). No later code recomputes them; a reopen writes a
new submission. The app computes the same marks live from the same shared module, but only for display.

## Consequences
- A scoring change affects only weeks submitted after it. State this in release notes when cards change.
- `LMP_ARCHITECTURE.md` applies the same rule to final reports: store the arithmetic (`computed_from`) with the result.
- Tests: `worker/tests/scoring.test.mjs`, `frontend/tests/scoring-shared.test.js` must stay in step.
