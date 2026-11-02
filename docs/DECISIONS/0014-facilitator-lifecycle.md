# 14. The facilitator lifecycle: rename with cascade, ETP facilitators, and nobody's students left behind

Date: 2026-10-22
Status: Accepted
Decided by: the IYF head

## Context

A facilitator's **name** is the link between them and their students: it is copied, as text, onto every student's
membership (`memberships.facilitator`), onto the facilitator's own account (`accounts.facilitator_name`), onto
sign-ups still waiting (`accounts.requested_facilitator`), and it is the key in the pick list (`facilitators`).
The Facilitator Dashboard matches the same people through its own NameMap. So:

* a facilitator's name cannot be corrected today without leaving the old spelling on some of those rows, and the
  two spellings then count as two people;
* when a facilitator stops facilitating — an ETP trainee who leaves or does not continue (ADR 0010), or any
  facilitator who leaves — **their students keep a facilitator who no longer exists**, and nobody is asked to do
  anything about it.

The head (22 Oct 2026): *"give an edit button for editing the name of the facilitators from the admin route, and
that is like a cascade process — at one place changes change other linked as well"*; *"the process for enabling the
ETP facilitators as well, who the new students will be assigned to them, and the promotion way from which they
ascend to become original facilitators"*; *"when an ETP devotee discontinues and is not promoted as a facilitator,
there should be a decision for students under his facilitation, pending at the admin side … whenever some
facilitator leaves … resolved by the admin by assigning each of his devotees their new facilitator from the list
available … so things remain clear, whether the devotee gets a new facilitator or became inactive."*

## Decision

**A. Rename, once, everywhere.** The head edits a facilitator's name in **Admin › Facilitators**. One action
changes it in the pick list, on every student's open membership, on the facilitator's own account, and on every
waiting sign-up — in one atomic batch, audited with the old and the new name. Closed memberships (history) keep the
name they were recorded under. The new name must not collide with another facilitator's. The dashboard's NameMap is
the other project's: the rename is reported for it, not written there.

**B. ETP trainees facilitate while they train** (ADR 0010). Enrolling makes them a **temporary** facilitator: they
appear in the pick list, coordinators assign new students to them, and their weekly card counts those students.

**C. The way up.** An ETP trainee who **qualifies** is promoted into **FTP**; FTP is what grants **lasting**
facilitation status (ADR 0010). Until FTP exists on live, the head promotes them by name in Admin › Facilitators.

**D. When a facilitator leaves, their students are a decision, not an accident.** Whenever somebody stops
facilitating — an ETP trainee removed, marked Repeat or Left, or not continuing; a facilitator switched off or
removed by the head — every **active** student under them goes into a **"Needs a new facilitator"** list on the
head's side (Admin Home › Decisions, and Admin › Facilitators). For each student the head chooses one of two:

* **a new facilitator**, from the active list (ETP trainees included), or
* **inactive** — the devotee has left too.

Until decided, the student is flagged and keeps the old name, so nothing is silently rewritten. Each decision is
audited, and the student's membership history shows who facilitated them and when the change happened.

**E. Clear at all times.** At any moment the head can see: who facilitates whom; who is temporary (ETP) and who is
lasting; who is waiting for a new facilitator; and for any devotee, the chain of facilitators they have had.

## Consequences

* One action renames (head only), one lists the students needing a new facilitator, one resolves a student
  (assign or inactivate) — each with the registry entry, the role gate, and the guards (`roles.test.mjs`,
  `ownership.test.mjs`), and fail-first tests.
* Ending a facilitator's role (ADR 0010's take-back, `facilitators.setActive`, removal) **adds** their students to
  the decisions list rather than leaving them; it never reassigns anyone automatically.
* The facilitator pick list shows only active facilitators; a former one stays readable on old weeks.
* The scoreboard's goal (ADR 0012: "their own students who became eligible") follows the current assignment, so a
  reassigned student counts for their new facilitator from the day of the change.

## Built (22 Oct 2026)

* `facilitators.rename` (head): list, open memberships, the facilitator's login, waiting sign-ups — one batch, audited.
  The renamed row becomes the app's own and the old name stays as a removed row, so the nightly NameMap read neither
  deletes the new one nor brings the old one back. The reply tells the head to change the dashboard's NameMap.
* `facilitators.orphans` (head): derived, never stored — active devotees whose facilitator is not on the active list.
  Each is decided with the existing `devotees.setPeople` (new facilitator) or `devotees.setActive` (inactive), so the
  rules and the Activity rows are the ones already in use. Live today: none.
* `facilitators.setLasting` (head) — C, until FTP exists.
* Tests: `facilitator-lifecycle.test.mjs` (22).

## Evidence

`worker/src/facilitators.js` (`facilitators.add/delete/setActive`), `worker/src/enrol.js` (the temporary grant),
`worker/src/closing.js`, the columns named above, `faciliatorDashboard/CLAUDE.md` (NameMap is the canonical match),
ADRs 0010 and 0012.
