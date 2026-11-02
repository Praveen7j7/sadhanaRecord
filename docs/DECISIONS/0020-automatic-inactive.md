# 0020 — Automatic inactive

Status: accepted (the head, 27 Oct 2026) · Phase 23 · migration 0071 · `worker/src/inactive.js`

## Context

The head: "Once a person has not filled sadhana in the app even a single day for more than a month, or hasn't logged in
to his account for more than a month, then automatically he becomes inactive and the coordinators and every admin are
notified. He becomes active as soon as he again starts filling sadhana or logs in. The admin should see how many are
active and inactive, and every month and day how many became inactive and active."

Phase 22 (I1–I3) asked a person to decide after four empty deadlines (`inactive_requests`). That flow is replaced.

## Decision

- **Inactive only when BOTH are silent for 30 days.** That means no day of sadhana saved (a draft saved, a week
  submitted, or a part week with days dropped at the deadline) **and** no use of the app (a sign-in, or a signed-in
  call). Requiring both means nobody flip-flops.
  - Not for someone whose open membership began less than 30 days ago.
  - Nothing before `settings.tracking_from`: the 30 days start at the first tracked week (the release).
- **Inactive means the open membership only.** The account stays ACTIVE, so the login and its sessions work. Counts
  read "ACTIVE membership AND ACTIVE account", as before.
- **Coming back:**
  - Filling a day or submitting brings anyone back (FILLED).
  - Using the app brings back only those the app made inactive (APP). This is told by the flag
    `accounts.auto_inactive`, which arrives with the account row on every call.
  - A coordinator's or the head's "Mark inactive" (MANUAL) stays until a filled day or "Make active again". Marking an
    auto-inactive person clears the flag, so their decision sticks.
- **The daily job** runs at 00:13 IST, at one minute of the existing per-minute cron. It is one set-based
  `INSERT … SELECT` into `activity_events`, then four statements keyed on that day's AUTO events (membership split or
  in place, and the flag), then one Activity line.
- **Events (`activity_events`)** record every change: change INACTIVE/ACTIVE × how AUTO/MANUAL/FILLED/APP. They feed:
  - **Home's notices and the bell** (in the app only; no message, no push): a coordinator sees their class batches,
    the head all of IYF Delhi.
  - **The analysis** (`activity.stats`): now, by month, and by day for a month. It sits on Batch › Filling chart for a
    coordinator and Admin › All batches for the head.
- **Requests removed:** `inactive.list` / `inactive.decide`, the Requests "Inactive?" tab and row, the facilitator's block,
  and the deadline-job raise are all gone. The 0066 table stays; 0071 closes its open rows.
- **No backfill from audit_log:** live had no inactive actions in it (checked 27 Oct 2026), so there is nothing to seed.

## Consequences

- **No new write on a normal call.** The only per-call cost is a test of a field already read.
  - Last activity is derived from what is already stored: `drafts.updated_at`, `submissions.submitted_at`,
    `missed_weeks`, `accounts.last_login_at`, and `sessions.last_used_at` (written at most hourly).
  - A save writes more only when the person is inactive.
  - App use reactivates in the background (`waitUntil`) of the call that finds the flag.
- The reactivation statements are keyed on the login and on the INACTIVE state. A sign-in, a call and a save arriving
  together therefore change the membership once.
- App use is accurate to the hour, because the session write is hourly. A deadline auto-submission counts as a fill on
  the day it is written.
- `inactive_requests` and its Activity sentences remain readable for history.

## Evidence

Live data, read-only (27 Oct 2026):
- `tracking_from = 2026-10-26`, so the first possible automatic change is the run of 26 Nov 2026.
- Every member used the app in October; Aditya never signed in but joined 12 Oct. The job would therefore mark 0
  tonight, gated or not.
- No `devotees.inactive` or `inactive.*` rows in audit_log.

Query plans: every subquery searches an index — `sessions_by_login`, the drafts / submissions / missed_weeks primary
keys, `activity_events_day_how`, `memberships_by_login`, and `activity_events_batch_day` for the analysis.

Tests:
- `worker/tests/phase23-auto-inactive.test.mjs` (47 checks).
- `frontend/tests/phase23-auto-inactive.test.js` (mock).
