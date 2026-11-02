# 13. A sadhana leaderboard, weekly and above, with the window and the scope set by role

Date: 2026-10-22
Status: Accepted
Decided by: the IYF head

## Context

A coordinator can see who submitted and who is filling, but not **how the batch compares** — who is doing the
strongest sadhana this week and who is slipping. The head cannot see that across batches at all. Everything in
the app today shows a devotee only their own score.

The head asked for a leaderboard: devotees ordered by sadhana score, filtered by period, in the coordinator's
section for their own batches, and for the head across any batch and IYF Delhi at large.

A **daily** board was considered and **dropped** (the head, 22 Oct 2026): a day's score exists only once that day
is filled, and people fill at different hours, so a daily board ranks whoever filled earliest and puts a devotee
who fills every night at the bottom until they do. The **week** has a real deadline (Monday 9 PM) and a submitted
score, so everyone in it is measured over the same completed period.

## Decision

**A. Windows, by role**

| | Devotee | Coordinator | IYF head |
|---|---|---|---|
| Periods | **weekly** | weekly, monthly, yearly, **custom dates** | the same |
| Scope | their own rank only | their own batches | any batch, and all of IYF Delhi |
| What they see | "7th of 12 in SPS this week" — a position, never other people's names or scores | the full ranked list | the full ranked list |

**B. What it ranks on.** The stored weekly `overall` score (`submissions.overall`), highest to lowest. For a
month, a year or a custom range: the **average of the submitted weeks** in that range. A **missed** week already
scores 0 and counts as such — no special case, no silent exclusion.

**C. A devotee never sees another devotee's score or name on it.** Their own rank is a single line on their own
screens. This keeps the app's existing rule — a devotee sees their own sadhana — while giving them the one piece
of comparison the head asked for.

**D. No new writes and no schema change.** Every number already exists in `submissions`, keyed by week and batch.
The board is a read, paged like the other staff lists, and `scopeBatches` already decides which batches a
coordinator may ask about.

**E. The week is whatever the setting says it is.** The deadline is `settings.submit_closes` (today `MON 21:00`),
edited by the head in Settings and validated in `oversight.js`; the client follows the server's clock rather than
the phone's (`lib/api.js`). The leaderboard therefore ranks **submitted weeks**, and never computes a boundary of
its own: change the submit time tomorrow and the board, the month and the year follow with no code change. The
same rule binds every new screen and action in this work — **nothing re-derives a week, a deadline or a phase
boundary; it reads the one that exists.** A test asserts that moving `submit_closes` moves what the board counts.

**F. Ties.** Equal scores share a rank (two 4ths, then 6th), ordered by name within the tie, so the list is
stable and nobody is ordered ahead of an equal by accident.

## Consequences

* A new read action (`board.sadhana` or similar) with the usual registry entry, role gate, `scopeBatches`
  narrowing, and the guards (`roles.test.mjs`, `ownership.test.mjs`).
* A custom date range must be bounded (the exports path already caps a range at `MAX_DAYS`); the same cap applies,
  so one request can never scan an unbounded span.
* Rows read grow with batch size, not with the window: a month is the same rows as four weeks already stored.
* The devotee's own-rank line costs one extra count over their own batch's week — folded into an existing call
  rather than added as a new round trip.
* It is a **staff screen**: no imagery, no decoration (the imagery matrix forbids both), consistent with Board
  and Filling chart.

## Built (22 Oct 2026)

* `leaderboard.get` (STAFF) and `leaderboard.mine` (ANY), `worker/src/leaderboard.js`. One aggregated read per call:
  `submissions` UNION `missed_weeks` over `week_id BETWEEN` and `batch_id IN (…)`, re-scored where the attendance
  mark used differs (`finalScores` + `markUsed`, written in SQL), grouped by person. 0 new scans in `audit:sql`.
* The last closed week comes from `windowOf` (settings.submit_closes); `leaderboard.test.mjs` moves the deadline to
  Tuesday and the board's week moves with it.
* Staff screen `#/leaderboard` (batch picker; the head adds "All of IYF Delhi"); Week · Month · Year · Dates; Export
  as CSV of the whole ranked list. A devotee's own place is one line on Report.
* **Phase 22 F2 (26 Oct 2026):** `leaderboard.get` with no `batchId` is "All batches" for every staff caller — the
  head every class batch (as before), a coordinator every class batch they hold, ranked together (was FORBIDDEN). Trainings
  (ETP/MTP/FTP) stay out of both; a training-only coordinator is refused. The screen offers "All my batches" to a
  coordinator of two or more class batches; the head keeps "All of IYF Delhi". Reply shape unchanged (`batchId: ''`).
* **Deviation from Consequences:** the devotee's line is its own small call (`leaderboard.mine`), made only when
  Report opens, rather than folded into `home.get` — `weeks.js` is in the speed lane this release. It can be folded
  in later without changing its shape.

## Evidence

`worker/src/weeks.js` (`submissions.overall` stored once at submit, ADR 0004), `worker/src/db.js` `scopeBatches`,
`worker/src/exports.js` (`MAX_DAYS`, the bounded-range precedent), `docs/AUDIT_BLUEPRINT_2026-10-21.md`
Deliverable 3 (the coordinator and head route tables).
