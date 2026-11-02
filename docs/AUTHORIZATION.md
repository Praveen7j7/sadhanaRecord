# Authorization — Sadhana Record

**Generated from `worker/src/api.js` and `worker/src/db.js` on 12 October 2026.** The matrix below is the route
table as it actually is, not as documentation elsewhere describes it.

## The five scopes

A role is not a column — it is **derived on every request** by `scopesOf()` in `worker/src/db.js`, from the
account, its membership and the batches it coordinates. One person can hold several at once (a devotee who also
coordinates; the head who also fills their own sadhana).

| Scope | Granted when | Reads/writes |
|---|---|---|
| `devotee` | `role = DEVOTEE` **and** a current membership | their own week, their own profile |
| `groupLeader` | a row in `leaders` **and** role `DEVOTEE` **and** status `ACTIVE` | their group of their batch |
| `facilitator` | `accounts.facilitator_name` is set **and** status `ACTIVE` | the devotees with that facilitator name |
| `coordinator` | their login is in `batches.coordinator_logins` | those batches only |
| `master` | `accounts.is_master` **or** `role = MASTER` | everything |

Two properties worth stating plainly:

- **An inactive account loses its scopes.** `groupLeader` and `facilitator` both test `status = ACTIVE`, so
  deactivating a person removes their access without any separate revocation step.
- **A changed role ends every open session.** `sessionCtx()` compares the session's stored role with the
  account's current role and ends the session if they differ (`worker/src/session.js`).

## The matrix

All **122** actions, by the role the route table requires.

| Required | Actions | Meaning |
|---|---|---|
| `PUBLIC` | **9** | anyone, signed out — sign-up, sign-in, public metadata |
| `ANY` | **31** | any signed-in account (each handler then checks ownership itself) |
| `DEVOTEE` | **2** | a devotee of a batch |
| `LEADER` | **2** | a group leader |
| `FAC` | **3** | a facilitator login |
| `STAFF` | **25** | a coordinator **or** the head |
| `MASTER` | **50** | the IYF head only |

### `PUBLIC` — the signed-out surface

These nine are the entire attack surface for someone with no account:

- `auth.login`
- `auth.lookup`
- `auth.requestReset`
- `auth.signUp`
- `meta.get`
- `push.message`
- `push.register`
- `push.renew`
- `push.unsubscribe`

### `MASTER` — head only

The largest group (44), covering every destructive and structural action:

`admin.lists`, `announcements.reports`, `announcements.resolve`, `attendance.override`, `audit.list`, `batches.create`, `batches.list`, `batches.update`, `coordinators.create`, `coordinators.list`, `coordinators.resetPassword`, `coordinators.setDisabled`, `coordinators.update`, `facilitators.add`, `facilitators.delete`, `facilitators.list`, `facilitators.setActive`, `heads.decide`, `heads.requests`, `heads.withdraw`, `identity.get`, `identity.link`, `identity.mint`, `identity.mintBatch`, `identity.search`, `identity.serviceToken`, `identity.supersede`, `ids.appList`, `ids.create`, `ids.get`, `ids.link`, `ids.nextApp`, `ids.possibleDuplicates`, `ids.reviewDuplicate`, `ids.search`, `ids.unlink`, `masters.set`, `mutes.setAll`, `reopen.reject`, `runlog.list`, `settings.get`, `settings.update`, `stats.all`, `weeks.reopen`

### `STAFF` — coordinator or head

25 actions, every one of which must then narrow to the caller's own batches:

`attendance.set`, `birthdays.today`, `devotees.delete`, `devotees.get`, `devotees.list`, `devotees.setActive`, `devotees.setDisabled`, `devotees.setPeople`, `devotees.week`, `exports.catalog`, `exports.page`, `leaders.assign`, `leaders.list`, `leaders.set`, `members.list`, `registry.search`, `reopen.list`, `reopen.request`, `requests.approve`, `requests.list`, `requests.reject`, `resets.approve`, `resets.reject`, `stats.batch`, `weeks.setClass`
## The invariant that matters most

**`STAFF` is not a permission — it is permission to *ask*.** A coordinator passing `STAFF` has proved only that
they coordinate *some* batch. Every one of those 25 handlers must then narrow to the batches they actually
coordinate, via `scopeBatches(db, ctx)` in `worker/src/db.js`, which returns every batch for a master and
`scopes.coordinator` for anyone else.

Six modules use it: `coord.js`, `exports.js`, `groups.js`, `requests.js`, `rules.js`, `db.js`.

**If a new `STAFF` action forgets `scopeBatches`, one coordinator can read another's batch.** That is the single
most likely authorization defect in this codebase, and it would pass every role check. `ANY` carries the same
burden: 31 actions where the route table only proves the caller is signed in, and the handler alone decides whether
the record is theirs.

**Unverified assumption — not checked in this audit.** I did not confirm that all 25 `STAFF` and all 31 `ANY`
handlers narrow correctly. Doing so means reading each one. `worker/tests/security-roles.test.mjs` (21 assertions)
and `scopes.test.mjs` (25) cover part of it.
**Evidence needed:** a test that, for every `STAFF`/`ANY` action, calls it as a coordinator of batch A against a
record in batch B and asserts `NOT_FOUND`. That is the highest-value test this repo does not have.

## Service accounts (migration 0041, 12 Oct 2026)

`accounts.only_actions` is an allowlist. Empty — every ordinary account — means no restriction. Non-empty means the
session may call **only** those actions, whatever its role otherwise permits. Checked in `api.js` beside the role
gate, so there is one place to pass.

The only one today is `dashboard-cron`, scoped to `identity.mintBatch`, used by the facilitator dashboard's hourly
job. It has **no password** (`pw_salt` empty, which `verifyPassword` treats as never matching), so it cannot sign
in — it exists only to carry a token. Created and rolled with `tools/identity/service-token.mjs`; re-running ends
the old sessions.

**Why it exists:** a master session token reaches 44 `MASTER` actions including `devotees.delete` and
`coordinators.resetPassword`, and the dashboard's copy has to sit in an Apps Script Property any editor can read.

## Sensitive flows

| Flow | Who | Guard |
|---|---|---|
| Sign-up | PUBLIC | lands as `PENDING`; a coordinator of that batch approves |
| Approve a sign-up | STAFF | must be a coordinator of the requested batch |
| Reset a password | PUBLIC asks, STAFF approves | **see the P1 finding below — no forced change** |
| Change a role | MASTER | ends every open session of that login |
| Delete an account | MASTER / self | `account.delete` for self; `devotees.delete` for a head |
| Appoint an IYF head | MASTER | **every other active head must approve** (`head_requests`, 0035) |
| Mint an IYF ID | MASTER or the scoped cron | never renumbers; corrections supersede |

The head appointment is the one multi-party control in the system: a single head cannot appoint another while other
heads exist.

## Proposed — LMP permissions

Not implemented. Design rationale in `docs/LMP_ARCHITECTURE.md`.

The brief's instruction is right and worth restating: **an existing organisational role must not automatically
grant training access.** A coordinator coordinates a sadhana batch; that says nothing about whether they may
assess a trainee or publish a report.

| Capability | Proposed holder | Not |
|---|---|---|
| Create/configure a program | a new `program.admin` grant | any coordinator |
| Create a batch, enrol | `program.manager` for that program | every coordinator |
| Enter an assessment | `evaluator` **on that batch** | every facilitator |
| Correct a submitted assessment | `evaluator` + audit row | silently |
| Finalise a batch's reports | `program.admin` | an evaluator |
| See a member's training history | the member; their evaluator; `program.*` | their facilitator, by default |

The last row is the one to decide with management: a facilitator seeing a devotee's sadhana is established; a
facilitator seeing their MTP assessment scores is a different question, and should be answered before it is built.

**Mechanism:** extend `only_actions` thinking — a `program_grants` table (`login`, `program_id`, `grant`) checked
beside the existing scopes, rather than new global roles. It reuses a pattern that already exists and keeps
training permissions out of the sadhana role model.

---

## Review notes — 12 October 2026 (second pass, read-only)

A second session read every handler to close the "unverified" gap above. Result and corrections:

**The gap is closed, with one exception.** All 25 `STAFF` handlers narrow via `requireBatch` / `scopeBatches` /
`managed()`; all 31 `ANY` handlers narrow by ownership or `target()` / `behalfBatch()` / `managed()`; all eight
`onBehalfOf` handlers scope-check; `group.mark`, `leaders.assign`, `exports.page` scope correctly. The one real
authorization defect: **`devotees.delete` (`coord.js:469-477`) calls `managed()` without `change: true` and its inline
guard omits `facilitator_name`, so a batch coordinator can erase a linked youth facilitator's account.** Not covered
by any test.

Corrections to the text above:

1. **Counts:** 122 actions; **MASTER is 50**, not 44 (the six `facLogins.*` actions are missing from the list).
2. **`devotees.delete` is `STAFF`**, not MASTER (`api.js:130`): any coordinator may erase a devotee of their batch.
3. **"A temporary password forces `MUST_CHANGE_PASSWORD`" is wrong for the public reset flow.** `auth.requestReset`
   stores the hash of a password *the requester chose* and a newer request **supersedes** the owner's pending one
   (`auth.js:273-291`); `resets.approve` installs it with **no** forced change (`requests.js:125-136`). Forced change
   exists only for `coordinators.resetPassword`, `facLogins.resetPassword`, `coordinators.create`, `facLogins.create`
   and `MASTER_RESET_PASSWORD`. This is the accepted no-OTP design (phone is the identity), but the approver sees no
   provenance and the owner's own request can be silently replaced. See `FULL_AUDIT_2026-10-12.md` F1.
4. **"A changed role ends every open session."** `accounts.role` is never changed by any API action; `masters.set`
   ends sessions only when *removing* master scope (`admin.js:205`), granting ends nothing, and changing a
   coordinator's batches ends nothing (scopes are recomputed per request, so nothing needs ending).
5. **Inactive accounts** are refused by `sessionCtx` (`session.js:20-23`) before scopes are computed; the
   `status = ACTIVE` tests inside `scopesOf` are redundant for API traffic.
6. **Head appointment:** the recovery login `master` is never asked (`admin.js:213-216`), and a head who is the only
   active head appoints immediately (`:100-105`).
7. **The proposed cross-batch test should expect `FORBIDDEN`**, not `NOT_FOUND` (`requests.js:12`). Partial coverage
   already exists in `tests/coord.test.mjs:50,68,85,184,191`, `tests/groups.test.mjs:68,82,91`,
   `tests/security-roles.test.mjs`. The generated-from-the-route-table version is specified in `TESTING.md`.
8. **Existence oracles** (low): `auth.lookup` returns `hasAccount` for any phone (`auth.js:64`, tested as current
   behaviour in `lookup.test.mjs:65`); `managed()`'s error code differs by target state before the scope check and is
   reachable by any devotee via `photo.get`; `LOCKED_OUT` is returned before the password is checked, so it reveals
   existing logins and lets anyone lock a phone for 15 minutes (`auth.js:196-209`).
9. **Policy inconsistency:** coordinators may read any past week through `week.get` / `history.list onBehalfOf`
   (`weeks.js:219-233`) while `devotees.week` limits them to the open week (`facilitator.js:162-163`).


---

## Confirmed security risk (P1) — the public reset flow installs a password the requester chose

**Found by prompt-f0, 12 Oct 2026; verified here 13 Oct against the source.**

`auth.requestReset` is `PUBLIC`. It takes a `newPassword` **from whoever is asking**, hashes it, and stores it on a
`PENDING` row in `reset_requests` — superseding any request the real owner already had pending
(`worker/src/auth.js`, the `UPDATE … SET status = 'SUPERSEDED'` then `INSERT`). `resets.approve` then installs that
stored hash onto the account (`worker/src/requests.js:130`) and **never sets `must_change_pw`** — zero occurrences
in that handler.

**Why it matters.** A stranger who knows a devotee's phone number can submit a reset naming a password they
choose. If a coordinator approves it — and the approval screen shows a reset request, not whose password it is —
the stranger now knows a working password for that account, and the owner is never forced to change it. The owner's
own pending request is replaced in the process, so the legitimate route is also disrupted.

**Classified:** confirmed security risk, P1. **Not fixed here** — this is an authorization-model change and needs
your decision on the flow, not a quick patch. Options, cheapest first:

1. **Force a change on approval.** Set `must_change_pw = 1` in `resets.approve`. One line; makes a stolen reset
   useless beyond the first sign-in. *Does not* stop the disruption of the owner's pending request.
2. **Do not accept a password from the requester at all.** Approval generates a temporary one shown to the
   coordinator, who passes it on through a channel they trust. Matches how `coordinators.resetPassword` already
   behaves, and is the design I would recommend.
3. **Do not supersede an existing pending request** — refuse a second one while one is open, so a stranger cannot
   displace the owner's.

(1) alone is a mitigation; (2) is the fix.

## Corrections to this document, 13 Oct 2026

- **`MASTER` is 50, not 44; 122 actions, not 116.** My extraction regex required a lowercase module name and
  dropped the six camelCase `facLogins.*` actions.
- **`devotees.delete` is `STAFF`, not `MASTER`** (`api.js:130`). The "Sensitive flows" table above said MASTER.
  The handler (`coord.js:469-477`) does guard: it refuses to delete a coordinator or master, and requires the
  phone number typed again. It does **not** check `facilitator_name`, so a facilitator login could be deleted by a
  coordinator — worth a look, flagged by prompt-f0 and not fixed here.
