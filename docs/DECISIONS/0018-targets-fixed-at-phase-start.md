# 18. Targets are set at the start of a phase, then fixed

Date: 2026-10-23
Status: Accepted (the head's request; the details below are the builder's calls, listed for the head to overrule)
Decided by: the IYF head (the rule), prompt-3d (the details)

## Context

The head (23 Oct 2026): *"for the facilitators phase wise targets and there fillings like the first time when they login
the same ui takes the targets and the second time we take there achievements … the targets and weekly input against
that targets can be seen as separate and defining the targets happens in the phase beginning only not afterwards."*

Before this, `targets.set` had no date check: anyone could move a target at any time while the phase was open, so a
target could be lowered in week ten to meet what was done. Also, the four Yes/No measures (VL-1 attendance, VL-2/3
attendance, FTP/ETP attendance, the journal) could not be given a target from the card screen, so they were never scored
for anyone who set targets in the app.

## Decision

1. **A set target may change until `targetsUntil`:** the phase's own date (`phases.targets_until`, set by the head in
   Admin › Phases), else the end of the first week of that person's card. A facilitator's card starts with the phase; a
   trainee's starts with their training.
2. **After it:** a target that was never set may still be set (somebody who starts mid-phase, the current Kartik phase,
   or a Yes/No measure the screen could not take before). A set one is fixed. The same rule covers the level targets
   (`stages.set`). A level left at 0 counts as not set.
3. **The head opens one person's targets** for 7 days, with a reason, from that person's read-only card (Scoreboards):
   `targets.unlock`, stored in `target_unlocks`, logged in Activity as `targets.unlock`. Modelled on `card.unlock`.
4. **The card:** a first visit opens on setting targets, with the Yes/No measures counted ("every week" / "every month",
   or "not for me"). The header says "Targets can be changed until …" or "Targets fixed after …". A fixed target is
   greyed; "Change my targets" becomes "Set the missing targets" while any are unset, and goes when all are set. Weekly
   and monthly measures stay in their own sections; a monthly row shows **the month so far** against its target
   (`monthValue`: numbers added up over the month's weeks, a Yes/No met if ticked in any week — as `monthPct` counts).

## Consequences

- `card.get` and `card.of` carry `targets: { until, open, openedUntil }`, read inside the card's existing batch (no extra
  round trip; `round-trips.test` unchanged). `targets.set` and `stages.set` cost one more read hop (rare writes).
- `card-scoring.test` changes level targets in November to test the maths; its phase sets `targetsUntil` to the end of
  the phase, so the suite still tests scoring, not the lock.
- The refusal is `WINDOW_CLOSED`, naming the date and the IYF head.

## Evidence

`worker/migrations/0063_target_lock.sql`; `worker/src/phases.js` (`targetsUntil`, `targetsLock`, `targetsSet`,
`stagesSet`, `targetsUnlock`, `cardsOf`, `cardFrom` `monthValue`, `phaseUpdate`); `worker/src/api.js`;
`frontend/src/screens/Card.svelte`; `frontend/src/master/Phases.svelte`; `frontend/src/lib/mockcard.js`;
tests `worker/tests/target-lock.test.mjs` (33), browser part `targets21` (22).
