# 10. ETP grants a temporary facilitation role; FTP grants the real one

Date: 2026-10-22
Status: Accepted
Decided by: the IYF head

## Context

Enrolling somebody in ETP grants `facilitator_name` (decided 17 Oct 2026: "a trainee facilitates from day one"),
because the training's own card asks them to report Sunday VL-1 facilitation attendance and one-to-one meetings —
they cannot report either without students. Nothing took the role back. A person removed from the training, or
marked **Repeat** or **Left** at closing, kept facilitator access and stayed in the list devotees pick their
facilitator from, for ever. The 19 Oct status map carried this as an open product question.

The head's rule (22 Oct 2026): *"when they leave ETP the facilitation scope — the temporary one which they got
just for training — is taken back, and from here those who are promoted to the real facilitation batch, that is
FTP, gain original facilitation status."*

## Decision

1. **ETP grants a temporary facilitation role.** It exists while the enrolment is ACTIVE and for no other reason.
2. **It is taken back when the person leaves the training, however they leave**: removed by the coordinator, or
   **Repeat**, **Left** *or* **Qualified** at closing. Qualifying is not what makes somebody a facilitator.
3. **FTP grants the lasting facilitation status.** A person promoted into the FTP batch is a facilitator from then
   on, and keeps it when that training ends. (FTP does not exist on live yet; the rule is written now so the code
   has one place to add it.)
4. **A person who already held facilitation before ETP keeps it.** The role is taken back only when the training
   is what granted it — the `enrol.add` audit row records that grant, and it is the evidence used.
5. **Losing the role never deletes anything.** They remain a normal devotee of their own batch, with their weeks,
   their history and their account. If no membership of any kind remains, they are simply an account with no
   scopes; account deletion is a separate, explicit act.

## Consequences

* `enrol.remove` and `closing.close` (every decision, including `qualified`) clear `facilitator_name` when the
  training granted it, and leave it when it predates the training.
* The facilitator **pick list** (`facilitators` table) must not keep a name that no longer facilitates: the row is
  deactivated, never deleted, so old weeks still resolve the name.
* A devotee whose facilitator has just lost the role keeps the name recorded on their membership (history is not
  rewritten); the coordinator reassigns them, and the Devotees screen should make that visible.
* Scoreboards and the weekly card follow the scope, so a former trainee's card closes with the training as before.
* When FTP arrives, enrolling in it grants the lasting role; nothing in this decision needs changing then.

## Built (22 Oct 2026)

* Migration `0060_facilitation_kind.sql`: `accounts.facilitation` = '' | `temporary` | `lasting`, backfilled from the
  `enrol.add` audit rows. On live that makes Suraj Sahu and the test account Praveen (6000000303) temporary; Devesa Hari
  Prabhuji and the other Praveen account lasting. **Suraj loses facilitation when ETP-21 closes unless the head makes
  him lasting first** (Admin › Facilitators).
* `enrol.js takeBack`: on `enrol.remove`, and on closing a training whatever the decision (repeat, left, **qualified**),
  a temporary facilitator in no other running training loses `facilitator_name` and their name is switched off the
  pick list; their students appear in `facilitators.orphans` (ADR 0014 D). Conditions in SQL, same batch, no read.
* `facilitators.setLasting` (head): what FTP will grant. Facilitator logins the head creates or links are lasting.
* Found and fixed: `enrol.add` never read `facilitator_name`, so enrolling an existing facilitator overwrote their
  facilitator name with their account name and the audit claimed a grant. Not triggered on live (names equal).
* Tests: `etp-facilitation.test.mjs` (21), `phases.test.mjs` updated to the new rule.

## Evidence

`worker/src/enrol.js` (the grant, with its 17 Oct reasoning), `worker/src/closing.js` (the four decisions),
`worker/src/db.js scopesOf` (`facilitator_name` is what grants the scope), `docs/APP_STATUS_MAP_2026-10-19.md` §3
(the open question), `docs/AUDIT_BLUEPRINT_2026-10-21.md` R-34.
