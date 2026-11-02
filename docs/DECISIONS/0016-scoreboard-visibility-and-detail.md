# 16. Who sees which scoreboard, and what a row opens

Date: 2026-10-22
Status: Accepted
Decided by: the IYF head

## Context

The scoreboards were staff-only: the head saw every board, a training's coordinator saw their own. A facilitator or
an ETP trainee had no way to see where they stand. A tapped row opened a thin list of the eleven numbers, not the
card the person actually fills, so the head could not see the detail the Facilitator Dashboard shows when a
facilitator is opened from its scoreboard (rank, net score with its parts, levels, who is ready to move up, the weeks).

The head (22 Oct 2026): *"I hope I will get the scorecards section visible when I log in as a facilitator"* →
**"Own card + own rank"**; *"with just FTP meeting in place of ETP, and the phases are real, rest of it remains
same"*; *"the admin scoreboard and the coordinator for ETP see the entire board, and when they click any it opens the
detailing which the facilitator sees — take the context from the facilitator dashboard."*

## Decision

| Who | Sees | Taps a row → |
|---|---|---|
| The head | every running training's board and the facilitators' board, whole | that person's card, read-only |
| A training's coordinator | their training's board, whole | that trainee's card, read-only |
| A facilitator (not in a training) | the facilitators' board — **their own row only**, with "Rank #N of M" | their own card, read-only |
| An ETP trainee | their training's board — **their own row only**, with their place | their own card, read-only |
| Anyone else | no board | — |

* **The detail is the card itself** (`Card.svelte`, read-only), not a copy of it: the same groups, weekly and
  monthly apart, net score with sadhana · seva · goal, the levels with eligible and promoted counts, the students
  eligible to move up by name, and a sparkline of their recorded weeks. A facilitator's card reads "FTP training
  attendance" and runs over the real phase; a trainee's reads "ETP attendance" and runs over the training's dates —
  the server already decides both (`measureView`, `cardWindow`).
* **The place** is the board's own order (ADR 0012 F: seva + goal, no target ranks last). Somebody with no target
  has **no place**, not a last one. `of` is everybody on the board.
* **Others' figures never leave the server** for a person seeing their own place: `board.get` filters to their row
  after ranking. The Facilitator Dashboard's facilitator login shows the whole team's numbers; the head chose own
  rank only for the app.
* A facilitator who is also in a training sees their place on the **training's** board (their card runs over it).

## Consequences

* `board.list`, `board.get`, `card.of` are `ANY` in the registry; each handler narrows (whole board / own row /
  FORBIDDEN). `card.of` admits the caller's own login. Guards: `roles.test.mjs` (GATE_OF_RECORD, HANDLER_REFUSES),
  `ownership.test.mjs`; behaviour in `card-scoring.test.mjs`.
* `board.get` rows carry `place`; the reply carries `self` and `of`. `card.of` returns the `card.get` shape
  (`name` = phase, `person` = whose card, `groups`, `state`). `score.ready` lists the eligible students
  (name, IYF ID, batch, level they would move to).
* Menu: "Scoreboard" under Facilitator (facilitators) and under the training's name (trainees); staff keep
  "Scoreboards".
* Cost: a board computes every row to rank one person, as the head's board always has. Batching `phaseAverage` /
  `stagesOf` across the board is the speed lane's B1 item on `phases.js`.

## Evidence

`worker/src/phases.js` (`boardList`, `boardScope`, `boardGet`, `cardOfPerson`, `stagesOf`), `worker/src/api.js`,
`frontend/src/coord/Scoreboards.svelte`, `frontend/src/screens/Card.svelte`, `frontend/src/lib/nav.js`,
`faciliatorDashboard/Scripts.html` (`personHeroHtml`, `personPageHtml`, `readyListHtml`), ADRs 0010, 0012.
