# 19. Access by assignment: one screen gives a role with chosen rights; revoking takes exactly that; the menu follows

Date: 2026-10-26
Status: Accepted and built 26 Oct 2026 (phase 22, not yet deployed). Builds on ADR 0015.
Asked by: the IYF head (26 Oct 2026): *"I select a person and give him some rights of SPS and some rights of
facilitator, from a unique list, from the admin; when I revoke, it gets revoked; and based on the access, their
normal screens' sidebars get those added."*

## Context — what is true today

* **A role comes from where it is stored**, worked out on every call (`db.js scopesOf`): coordinator of a batch
  (`batches.coordinator_logins`), group leader (`leaders`), facilitator (`accounts.facilitator_name`), trainee
  (`enrolments`), head (`is_master`). Removing one already removes only what it gave.
* **Roles are given in three screens** (Batch setup, Staff, Facilitators). Admin › Access only shows them and links.
* **Per-person changes** (ADR 0015, `accounts.grants`) sit on the *person*, not on a role: 16 rights may be taken
  away, 3 may be given (own batches only). A "give" left behind when a role is removed does nothing, but comes back
  silently if the person gets a batch again.
* **The menu ignores those changes.** `routes.js` decides every screen from the roles alone (`staff`, `facilitator`,
  `master`); the client never reads `grants`. A right taken away still shows its screen and the server refuses the
  tap; a right given never shows a screen.

## Decision (proposed)

1. **An assignment** = one person + one role + where it applies + which rights + optional end date + reason.

   | Role | Applies to | Example |
   |---|---|---|
   | Coordinator | one batch | Coordinator of SPS-Nov26 |
   | Training coordinator | one training | Coordinator of ETP-22 |
   | Facilitator | one name from the canonical facilitator list (picked, never typed) | Facilitator — Radha Raman Das |
   | Group leader | one batch | Group leader in DPS-Jun26 |

   The head is not assigned here; heads stay managed by the heads (Staff, `masters.set`).
2. **Rights from one fixed list** (`grants.js CAPS`, extended). Each right says which roles it can belong to —
   "Mark attendance" fits a coordinator, not a facilitator. When the head adds an assignment, the role's usual rights
   are ticked; the head unticks what this person should not have. A person may hold many assignments at once
   (SPS with three rights, a facilitator name with two).
3. **Revoke = remove the assignment.** The role and every right it carried go with it, at the next call; the
   person's other assignments are untouched. Because rights live on the assignment, nothing is left dormant. The
   ADR 0015 person-wide "take away" stays as an over-all switch.
4. **The menu follows the rights.** The session reply carries `user.access` (each assignment: role, where, rights).
   Each route in `routes.js` names the rights that use it; a screen is in the sidebar only if the person holds at
   least one of them for some batch, and buttons inside a screen show only for a held right. The server still
   checks every call in the one gate — the menu only hides what would be refused.
5. **No extra round trip.** One additive table, `assignments`, read in the same batch as the role reads
   (`db.js scopeReads`). The stores existing handlers read (`coordinator_logins`, `leaders`, `facilitator_name`) are
   written by the same action, in the same batch, so every existing handler and test keeps working unchanged.
6. **Defaults equal today.** The migration turns every current coordinator, group leader and facilitator into an
   assignment with exactly the rights their role gives now. Nobody's access or menu changes on release day.
7. **End dates** are checked when read — no scheduled job. An ended assignment shows as "(ended)" in Access.
8. **Every add, change and revoke** is an `access.assign` / `access.revoke` line in Activity, with the reason.
9. **Not in this decision:** giving head-only (Admin) screens to a non-head. They act on all of IYF, not one batch,
   so a grant would make a second head. If wanted later, it is its own decision, a few named powers at most.

## Open questions for the head

1. **Facilitator rights:** does a person get their *own* facilitator name, or should they also be able to see
   *another* facilitator's students (a helper)? Today one name has one login (`facilitators.js`).
2. Should the old places (Batch setup's coordinator field, Staff, Facilitators) still change roles, or become
   read-only with a link to Access, so there is truly one place?
3. Which rights does each role start with? (Proposed: exactly what it gives today — decision 6.)

## Consequences

* Access becomes the one place to give and revoke; the person's card lists their assignments, each with its rights.
* `routes.js` scope functions change from role tests to right tests; `routes.test.js`, `roles.test.mjs` and
  `ownership.test.mjs` gain the assignment dimension (each right on and off, each revoke). The mock (`mock.js`,
  `mockadmin.js`) mirrors the server so browser checks see the same menus.
* Medium-to-large: one migration, `grants.js` + `session.js` + `db.js` on the server, Access + `routes.js` + Menu on
  the client. Belongs in the Phase 22 batch, released once.

## Evidence

`worker/src/db.js` (`scopesOf`, `scopeReads`), `worker/src/grants.js` (`CAPS`, `gate`), `worker/src/session.js`,
`frontend/src/routes.js` (scope functions), `frontend/src/lib/scopes.js`, `frontend/src/master/Access.svelte`,
`worker/src/facilitators.js`, ADR 0015.

## Decided and built (26 Oct 2026)

The head's answers:
- **Facilitator rights:** left for later.
- **Old screens:** they keep working. A role is stored where it always was, so Batch setup and Staff still change it, and Access shows the same thing.
- **Default rights:** a role starts with exactly what it gives today.
- **FTP coordinator (added the same day):** "defines the existing facilitators and sees the scoreboards of all in one view", for the original facilitators, phase by phase.

What was built:
- **Actions:** `access.assign` and `access.revoke` (head only). The roles are coordinator, training coordinator, group leader and FTP coordinator.
- **Where it is stored:** the rights left out are denies and the extra rights are allows, both in `accounts.grants`. The end date is `@<role>` in the same value, so the gate costs no extra round trip.
- **End dates:**
  - `grants.withAccess` drops an ended role from the scopes on the very next call.
  - `expireRoles` takes the role away for good, daily at 00:07 IST.
- **Revoke:** removes the role and every right that came only with it. A right the other batch role also uses stays while that role is held.
- **The app follows the rights:**
  - `scopes.rights` and `scopes.ftp` are sent on every `auth.me` and sign-in.
  - `routes.js` uses `staffCan`; `nav.js`, ExportButton and the Delete account button use `can()`.
  - After a refusal, the app reads `auth.me` again, at most once a minute.
- **FTP coordinator:**
  - api.js has a new `FTP` gate (the head or an FTP coordinator) on `facilitators.list/add/setActive/rename/setLasting` and on `targets.unlock`. For a non-head, `targets.unlock` works on facilitators only.
  - Its rights are `facBoard` (the whole facilitators' board), `facManage` (add, rename, switch off, make facilitation lasting) and `targetsOpen`.
  - `card.unlock`, deleting a facilitator, facilitator logins and the "needs a new facilitator" list stay the head's.
  - Its screen is `#/fac-team`.
- **Tests:** `worker/tests/access-roles.test.mjs` and `frontend/tests/access-menus.test.js`. `roles.test.mjs` knows the FTP gate.
