# 11. A class-batch coordinator may delete their own devotees; a training coordinator may not

Date: 2026-10-22
Status: Accepted
Decided by: the IYF head

## Context

`devotees.delete` is open to any coordinator for people in their own batches. Since ETP arrived, a **training**
coordinator holds a batch too — one whose people are *enrolled*, not members, and who belong to somebody else's
class batch. A training coordinator could therefore delete (anonymise) a devotee who is not theirs in any lasting
sense. Reported by the head on 17 Oct 2026 (item 4) and carried as R-08.

The app has no way to tell the two kinds of batch apart except by the id pattern `^(ETP|MTP|FTP)-\d+$`, which is a
convention, not data.

## Decision

1. Add `batches.kind` — `'class'` (default) or `'training'` — as an additive column, set from the id pattern at
   migration time. The pattern stays as a fallback only until every row is set.
2. **Who may delete an account:** the IYF head, and the coordinator of the person's own **class** batch.
3. **A training coordinator may never delete an account**, not even of a student enrolled in their training.
4. Deletion continues to mean anonymise, never drop: the weeks stay, the person becomes `deleted-<hex>`.

## Consequences

* `devotees.delete` checks the batch kind, not only membership; the refusal says who to ask.
* The Devotees screen hides the action for a training coordinator rather than letting it fail.
* `roles.test.mjs` and `ownership.test.mjs` gain the case; a fail-first test proves the old code allowed it.
* Other `kind`-dependent rules (no requests, no group leaders, no filling chart for a training) can stop guessing
  from the id pattern over time; this decision does not require that change, it enables it.

## Found while implementing (22 Oct 2026)

The rule already holds: a trainee's membership is in their own class batch, which a training coordinator does not
hold, so `managed()` refuses the delete (FORBIDDEN). Pinned by `etp-facilitation.test.mjs`. `batches.kind` is not needed
for this rule and is left for when the other id-pattern checks move to data.

## Evidence

`worker/src/admin.js` (`devotees.delete`), `worker/src/db.js` (`scopesOf`, coordinator batches),
`docs/REPORTED-2026-10-17.md` item 4, `docs/AUDIT_BLUEPRINT_2026-10-21.md` R-08.
