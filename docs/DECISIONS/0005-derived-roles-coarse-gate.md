# ADR 0005 — Roles derived per request; coarse route gate plus handler narrowing

**Status:** accepted · **invariant test required** (see `TESTING.md`)

## Context
One login can be a devotee, a group leader, a coordinator of several batches, a facilitator and a master at once.
Sessions store only the account's `role` (DEVOTEE/MASTER) to detect a role change.

## Decision
`scopesOf()` (`worker/src/db.js:77-88`) derives the scopes on every call. The route table says which scope may
*ask* (`roles:` PUBLIC/ANY/DEVOTEE/LEADER/FAC/STAFF/MASTER). Each handler then narrows to the caller's own records
(`scopeBatches`, `isStaffAccount`, `onBehalfOf` checks).

## Consequences
- The gate is cheap to read and hard to get wrong at the table level; the risk moves into the handlers. A `STAFF`
  action that forgets `scopeBatches` leaks another coordinator's batch and passes every role test.
- Therefore every `STAFF`/`ANY`/`LEADER`/`FAC` action needs a "coordinator of A against record in B" test, generated
  from the route table so a new action cannot be added without one.
- LMP must not reuse these scopes for training access; it adds `program_grants` (ADR 0006).
