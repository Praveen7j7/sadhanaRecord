# 15. Staff permissions, managed by the head in Admin

Date: 2026-10-22
Status: Accepted (22 Oct 2026) — the head: "the auth manager should have the full scope auths, using which I can give
and take permissions from any devotee or any staff"
Decided by: the IYF head

## Context

What a staff member may do is decided today by **derived scopes** (`db.js scopesOf`): a coordinator of class
batches, a coordinator of a training, a facilitator, the head. Each API action carries a role gate in the registry
(`api.js`) and narrows by batch in its handler. This is correct and tested (`roles.test.mjs`, `ownership.test.mjs`),
but it is **fixed in code**: the head cannot let one coordinator approve sign-ups but not reset passwords, give a
trusted coordinator the personal-detail exports, or take a capability away from one person without a release.

The head (22 Oct 2026): *"in the admin section I even want an auth management system for various staff in the
organization, and even devotee-level auths, which I don't think will be required."* Devotee-level permissions are
**out of scope** by the head's own judgement: a devotee's access is their own record, and nothing varies by person.

## Decision (shape)

1. **Capabilities, not roles.** A fixed, named list of things a staff member can do (below). The head turns each
   on or off **per staff member** in **Admin › Staff**, on top of what their role already allows.
2. **The role stays the ceiling and the floor.** A capability can only be granted where the role makes sense
   (a training coordinator never gains "delete accounts" — ADR 0011); and the narrowing by batch never goes away
   (a coordinator with "approve sign-ups" approves only their own batches).
3. **Enforced on the server, in the one gate.** The registry's role check consults the person's capabilities; the
   screen only hides what the server would refuse. No capability exists only in the UI.
4. **Visible and audited.** Admin › Staff shows each person's capabilities at a glance; every change is in
   Activity with who changed it and why. The generated **access map** (every route and action → who may) becomes
   the reference this screen is built on, and a test keeps it in step with the registry.
5. **Defaults equal today.** Introducing this changes nobody's access on the day it ships: every existing staff
   member gets exactly the capabilities their role grants now.

## The capability list — to confirm with the head

| Capability | Today held by |
|---|---|
| Approve or reject sign-ups | class coordinators, head |
| Reset a devotee's password | class coordinators, head |
| Fill or correct a week on a devotee's behalf | class coordinators, head |
| Mark attendance (and after the deadline) | coordinators; after deadline: head |
| Assign group leaders | class coordinators, head |
| Delete (anonymise) an account | class coordinators, head (ADR 0011) |
| Export — standard fields | coordinators, head |
| Export — personal details | head |
| Promote / close an intake | coordinators of that intake, head |
| Enrol and remove training students | training coordinators, head |
| See scoreboards and leaderboards | training coordinators, head |
| Reopen a submitted week | head |
| Manage facilitators (add, rename, reassign students) | head |
| Manage batches, staff, settings, IYF IDs | head |

## Open questions for the head

1. Is this list right — anything missing, anything that should never be delegable (e.g. creating heads)?
2. Granted per **person** only, or also as named **templates** ("Senior coordinator") applied to several people?
3. May a capability be granted **for a period** (e.g. while the head travels), expiring by itself?

## Consequences

* A `staff_capabilities` table (additive migration), read in the same round trip as the scopes, so the gate adds
  no hop.
* `roles.test.mjs` gains the capability dimension; every action's gate is re-proven with capabilities on and off.
* Built after the access map, because the map is what the screen shows and what the test checks.

## Decided (22 Oct 2026) and built

The head answered the open questions: **per person, any devotee or any staff, both give and take.** Templates and
expiring grants were not asked for; a grant may carry an optional end date (it costs nothing and covers "while I
travel"), and nothing else.

**Where it lives — no extra round trip.** `accounts.grants` (migration 0061), a small JSON value on the person's own
row: `{ "<capability>": { "effect": "allow" | "deny", "until": "YYYY-MM-DD" | "" } }`. Every signed-in call already
reads that row with its session (`session.js sessionCtx`), so the gate reads the grants for free. Every change is
an `access.set` line in Activity, with the reason.

**The gate (api.js handle).** For each action the capability it belongs to (`grants.js CAPS`, some only with a field:
"fill a week for someone" is a week action with `onBehalfOf`). A **deny** refuses the action even when the role allows
it ("The IYF head has turned this off for you."). An **allow** lets the action past a role gate that would refuse it —
only for the capabilities marked `give`, whose handlers already narrow by batch or person (`managed()`,
`scopeBatches`), so a grant never opens another coordinator's batch. A role a person holds is still changed where it
always was (coordinator of a batch: Batch setup; group leader; facilitator; head, with the other heads' approval);
the Access screen shows them and links there.

**The capabilities.**

| Capability | Actions | Take away | Give beyond role |
|---|---|---|---|
| Approve or reject sign-ups | requests.approve / reject | ✓ | — |
| Reset passwords | resets.approve / reject | ✓ | — |
| Fill a week for a devotee | week.* with onBehalfOf | ✓ | — |
| Mark attendance and class weeks | attendance.set, weeks.setClass, training.attendance, group.mark | ✓ | — |
| Change attendance after the deadline | attendance.override | ✓ | ✓ (own batches) |
| Reopen a missed week | weeks.reopen | ✓ | ✓ (own batches) |
| Assign group leaders | leaders.set / assign | ✓ | — |
| Edit devotees (facilitator, active, disabled) | devotees.setPeople / setActive / setDisabled | ✓ | — |
| Delete (anonymise) accounts | devotees.delete | ✓ | — |
| Promote or close a batch | devotees.promote, batches.close | ✓ | — |
| Enrol in a training | enrol.add / remove | ✓ | — |
| Export | exports.run | ✓ | — |
| Export personal details | (a field rule inside exports.run) | ✓ | ✓ (own batches) |
| Post on the Wall | announcements.create / update | ✓ | — |
| Comment and like on the Wall | announcements.comment / uncomment / like | ✓ | — |
| Ask to reopen a week | reopen.request | ✓ | — |

The head's own capabilities cannot be taken from a head (a head is managed by the other heads through masters.set).

## Evidence

`worker/src/api.js` (the registry and its role gates), `worker/src/db.js` (`scopesOf`, `scopeBatches`),
`worker/tests/roles.test.mjs`, `worker/tests/ownership.test.mjs`, `worker/src/exports.js` (the personal-field
rule), ADR 0011.
