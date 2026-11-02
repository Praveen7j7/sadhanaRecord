# 17. Every head setting that is built gets its Admin screen before the release

Date: 2026-10-22
Status: Accepted
Decided by: the IYF head

## Context

The head (22 Oct 2026): *"I can even set the phases on which the organisation functions — add, edit and all — from
the app itself, which the facilitators and all the batches work under: the Kartik and all"*; *"once this app is
deployed, the major settings should be able to be done from the admin itself, for features which are already there
but just require wiring with the admin."*

A sweep of the registry against every screen (22 Oct 2026; every action in `worker/src/api.js` with no caller in
`frontend/src` outside the mock and the WRITES list) found these built on the server with **no screen**:

| Action | What it does | Who |
|---|---|---|
| `phases.list` · `phases.open` · `phases.close` | the phases (Gaur Purnima · Jagannath · Kartik) | head |
| — *(missing)* | **editing** a phase's name or dates | head |
| `criteria.set` | a batch's promotion rules (VL-3 → SPS: 50 % attendance + 4 rounds, …) | head |
| `eligible.list` | who in a batch is ready to move up | coordinators, head |
| `card.unlock` | reopen ONE finished training card for 7 days, with a reason | head |
| `identity.get` · `identity.merge` · `identity.link` | one person's identifiers side by side; merge two people | head |
| `masters.set` | make a staff member a head (with the other heads' approval) or remove head access | head |
| `auth.logoutAll` | sign out of every device | anyone |

`push.message`, `push.renew` (the service worker's), `identity.mintBatch` and `identity.serviceToken` (machines and the
CLI) are not screens and stay so.

## Decision

All of the table is wired in this release, through the one gate, each with its browser check:

1. **Admin › Phases** (new): the list with the current one marked; **Add** offers the next phase of the dashboard's
   cycle with its name and dates filled in (after Kartik 2026 → Gaur Purnima 2027, 1 Jan – 30 Apr), editable;
   **Edit** name and dates with a reason — a new `phases.update` (head only; a closed phase's dates are a record and
   only its name may be corrected; audited old → new); **Close** with its consequence stated.
2. **Admin › Batch setup → a batch → Promotion rules**: the batch's criteria (or the standard set for its level),
   editable, "Back to the standard set" = an empty list.
3. **Batch status → Ready to move up**: `eligible.list` for the coordinator's own batch.
4. **Scoreboards → a finished trainee's card → Let them correct it**: `card.unlock`, reason required.
5. **Admin › IYF IDs → Merge**: two people side by side (`identity.get` each), the head confirms with a reason —
   nothing auto-merges.
6. **Admin › Staff → a person → Make head / Remove head access**: `masters.set`.
7. **Account → Sign out of every device**: `auth.logoutAll`.

## Consequences

* A test lists every registry action and fails when one has no screen and is not on the machine-only list, so a
  feature cannot again be built without its wiring.
* The 11 lead measures (labels, targets, weekly/monthly, groups) remain data; editing them is not an action today
  and is not part of this ADR.

## Evidence

`worker/src/api.js`, `worker/src/phases.js` (`phaseOpen`, `phaseUpdate`, `phaseClose`, `cardUnlock`),
`worker/src/eligible.js`, `worker/src/identity.js`, `worker/src/admin.js` (`mastersSet`),
`faciliatorDashboard/MetricsService.gs` (`PHASES`).
