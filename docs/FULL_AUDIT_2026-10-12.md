# Sadhana Record — full audit and improvement plan

**12 October 2026 · read-only.** No application code, migration, database row, Cloudflare resource or
dependency was changed to produce this. Five parallel reviews (database, backend security, frontend/PWA, scheduled
jobs and integrations, tests/performance/operations) were run against this tree; every headline finding was then
re-read in the code by the coordinating session before it was written here. Both local test suites were run.

Finding classes used throughout: **Confirmed defect** · **Confirmed security risk** · **Measured performance
bottleneck** · **Probable bottleneck requiring measurement** · **Maintainability concern** · **Proposed enhancement**
· **Unverified assumption**. Ids: F (backend), B (database), J (jobs), FE (frontend), T (tests/ops).

The detail lives in the companion pages; this document is the map and the verdict:
`ARCHITECTURE.md` · `PROJECT_STRUCTURE.md` · `DATABASE.md` (+ notes) · `DATA_DICTIONARY.md` (+ notes) ·
`API_REFERENCE.md` (+ notes) · `AUTHORIZATION.md` (+ notes) · `FRONTEND_GUIDE.md` · `INTEGRATIONS.md` ·
`OPERATIONS.md` · `TESTING.md` · `PERFORMANCE.md` · `USER_FLOWS.md` · `DEFECTS_VERIFIED.md` (+ notes) ·
`LMP_ARCHITECTURE.md` (+ notes) · `IMPLEMENTATION_ROADMAP.md` · `DECISIONS/`.

---

## 1. Executive summary

The application is in **good shape for its size and age**: a 6,400-line Worker and a 15,900-line Svelte 5 app with
no runtime dependencies, one consolidated API with a strict field whitelist, idempotent writes, atomic batches,
derived roles, a triggered Sheets copy, a strong test base (30 server suites / 2,080 assertions, 24 client files /
321 tests, 2,072 browser checks, two SQL audits with an allow-list) and a release gate that proves an open phone
moves to the new version. Historical counts in the brief are stale: **122 actions, 55 tables, 40 migration files
(no 0040), 128 triggers.** Of the seven historical defects, five are fixed (one of them — the share deep link — was
wrongly reported still open earlier today), one is rebuilt and not reproducible, one is partly fixed with two
confirmed mismatches.

What is **not** in good shape is around the code, not in it:

| Severity | Finding | Where |
|---|---|---|
| **P0** | The whole app is **not under version control** (one `phase0` commit in the parent; the tree untracked); no CI; one machine holds the only copies | T F-01, F-02 |
| **P1** | The weekly D1 export has **not been happening**; Time Travel covers 7 days | T F-03 |
| **P1** | Public password reset: the requester chooses the password, a newer request supersedes the owner's, approval forces no change; the approver sees no provenance | F1 |
| **P1** | Sheets append tabs are at-least-once without idempotency — a failure between two appends duplicates rows, which also breaks deletion scrubbing | J1 |
| **P1** | The minutely cron can exceed the free plan's 50 outbound calls on a Sunday evening; nothing enforces the budget | J2 |
| **P1** | `stats.all` measured at 55–83 ms CPU / up to 27 k rows per call against a 10 ms cap; grows with devotees | T F-08 |
| **P1** | Authorization tests are not systematic: 64 of 113 non-public actions have no FORBIDDEN assertion; a new action needs none | T F-04 |
| **P2** | A batch coordinator can delete a facilitator-linked devotee (`devotees.delete` skips the staff guard) | F2 |
| **P2** | Account › Address save degrades the stored address parts every time | FE-1 |
| **P2** | Name rule differs between app and server; IAST/Devanagari names fail at the last step | FE-2 / F17 |
| **P2** | Log-out leaves other people's photos, images and a sign-up draft with DOB and parent phone on the phone | FE-3 |
| **P2** | Replay cache is read-then-run-then-async-insert; overlapping retries execute twice | F5 |
| **P2** | Only one missed Monday deadline is ever closed; two outages leave a week open for ever | J4 / F28 |
| **P2** | Attendance notices mark rows sent for phones that were never pushed | J5 |
| **P2** | The SHA-256 of the temporary master password is copied to a Google Sheet | J3 / F8 |
| **P2** | Deletion leaves the phone in `attendance.changed_by` and `app_ids`; every profile save duplicates a `person_names` row | B3, B1 |

**No P0 defect exists in the code itself.** The two P0s are process. The recommended first phase is one afternoon
of git and backup, then one small, fully tested code release (roadmap "Recommended first implementation phase").

**LMP verdict:** build it as a role-protected area inside this app with its own shell, tables and `program_grants`
(ADR 0006) — after the identity record is actually linked to accounts, which today it is not for most people (B7).

---

## 2. Verified current-state architecture

See `ARCHITECTURE.md` (diagrams, request lifecycle, scope model, week state machine, jobs, build/release) and
`DECISIONS/` for the eight recorded decisions. Facts that matter most:

- One POST endpoint, 122 named actions, HTTP 200 envelope, gate order version → action → field whitelist → session →
  forced password change → role → service-account allow-list → replay cache → handler (`worker/src/api.js:166-200`).
- D1 is the record; Sheets receive a trigger-driven copy; nothing is read back except the dashboard registry tab.
- Roles are derived on every request (`db.js:77-88`); route `roles` is coarse and each handler narrows — verified for
  every handler, with one defect (F2).
- No foreign keys; relationships and integrity live in code; migrations additive by rule (with four exceptions, B §3).
- Scores are computed once at submit / deadline and never recomputed.
- Hash-routed PWA, lazy screen files, staff chunks out of the devotee precache, draft-per-keystroke offline day form
  that never shows an offline write as successful.
- Free-plan constraints shape everything (10 ms CPU, 50 outbound calls, daily D1 rows).

---

## 3. Repository structure and responsibility map

`PROJECT_STRUCTURE.md`: the tree, every server module with its tables, every app folder, where each business rule
lives, the "I need to change…" table, and eight things a newcomer must know (untracked tree, hard-linked `docs/`,
stale READMEs, retired `backend/`, the 1,970-line mock, two routing tables kept by hand, the oversized `coord.js`,
the 118 MB of paintings in every deploy).

---

## 4. Database inventory and relationships

Computed by applying all 40 migrations to an in-memory SQLite: **55 tables, 490 columns, 38 named indexes, 128
triggers, 1 declared FK, `seva_rules` without a primary key.** Today's `DATABASE.md` was off by one table, fifteen
columns and three indexes; corrections are appended to it. The ER diagram in `DATABASE.md` §Relationships stands
with the additions listed in its notes. **Dead schema** (never read or written): six `accounts` columns, thirteen
`profiles` columns, `memberships.group_leader`, `batches.view_sheet_id`, `submissions.bridged_at`, `mirror_state.cursor`,
`group_leaders` (table), `card_ranges`/`seva_rules` (hard-coded in `cards.js`), three indexes. **The 0040 gap** is a
deleted `hobbies` migration; whether it was ever applied remotely is unverified.

---

## 5. SQL and data-access audit

- **No SQL injection**: every `${…}` inside SQL is an internal constant or whitelist (`weeks.js:254,263`,
  `coord.js:375-377,611,623`, `mirror.js:151,175`, `views.js:112`); `LIKE` inputs are bound (wildcards unescaped,
  broader match only).
- **No N+1 found** in the hot path; the per-request memo (`db.js:11-25`) removes repeated settings/batch/membership
  reads. Loops with awaits exist only in jobs with explicit row caps.
- **Full-table loads**: `registry` (~1,600 rows, no `phone` index) by four staff actions (B10); `members.list`
  text search scans `accounts` and counts before paging (B11); `stats.*` and `devotees.list` read thousands of rows
  (T F-08, measured).
- **Atomicity**: `db.batch` used for every multi-statement write except `profile.update` (up to four batches, F16)
  and approval + app-ID (F20). CAS patterns are correct for approvals, resets, heads, counters, chunk claims,
  `saveDay`/`saveWeekEnd` versions.
- **Races**: replay cache (F5); `identity.mint` check-then-write (F5b); `mintBatch` concurrent new phone (F7);
  `runDeadline` with overlapping memberships aborts the whole batch every minute (B5, probable — check production for
  two open memberships per login).
- **Deletion**: cleaned — accounts, profiles, photos, drafts, sessions, reset_requests, push_subs, post_* own rows,
  leaders, replies, counters; anonymised — memberships, submissions (+ week JSON), attendance.login, missed_weeks,
  reopens, audit_log. **Not cleaned**: `attendance.changed_by` for own marks, `app_ids`, `person_links` (dangling
  by design) (B3).
- **Timestamps** mix IST `+05:30`, UTC `Z` and epoch ms within the same columns (B9).
- **Indexes to add** (with the query each serves): `registry(phone)`; `person_names(person_id, name)` UNIQUE;
  `reopens(week_id, state)`; `audit_log(who)`, `(target)`, `(at)`; `sessions(last_used_at)`; drop
  `accounts_signup_pending`, `profiles_person`, `announcements_recent`.
- **Verdict on patterns**: keep direct SQL in the owning modules; no repository layer (ADR 0008); split `coord.js`
  by responsibility; add named helpers for the three queries repeated across modules.

---

## 6. Backend API and request flow

`API_REFERENCE.md` (+ notes) holds the registry of all 122 actions; the review notes correct thirteen statements
in it (counts, gate steps, the meaning of `write`, error codes, `dirty()`, scoring moments, in-request Google reads).
The lifecycle trace found three things to carry: the replay-cache race (F5), two un-caught `waitUntil` promises
(F14), and "read" actions that write. Input validation is thorough (sign-up, day patch, marks, images, announcements,
identity, settings) with small gaps: unbounded `q` into `LIKE` (F30), `requestId` unvalidated on reads and stored
unbounded by `exports.page` (F15), a few `Number()` binds without type checks. External calls: no timeout on Google
or push (F8/J7); DNS has 2.5 s. Module boundaries: dispatch is clean; `coord.js` is five modules in one and is
imported by the wall and the facilitator module; `weeks.js` depends on the wall for the unread badge (F27).

---

## 7. Authentication and authorization matrix

`AUTHORIZATION.md` (+ notes). Verified by reading every handler: all 25 `STAFF` handlers narrow via
`requireBatch`/`scopeBatches`/`managed()`; all 31 `ANY` handlers narrow by ownership or `target()`/`behalfBatch()`/
`managed()`; all eight `onBehalfOf` handlers scope-check; `group.mark`, `leaders.assign`, `exports.page` scope;
service accounts cannot escape `only_actions`. **One real gap:** `devotees.delete` (F2). Oracles and inconsistencies:
`auth.lookup hasAccount` (F3), `managed()` error codes by target state (F4), `LOCKED_OUT` before the password (F12),
past-week policy mismatch (F10), `batches.update` accepting a facilitator login as coordinator (F18). The reset flow
(F1) is the accepted no-OTP design but needs the cheap mitigations in the roadmap. Password hashing: PBKDF2 10 k
iterations behind an HMAC pepper, constant-time compare, dummy verify, rehash on login — sound; iterations to be
measured before raising (F13). Sessions: 32-byte tokens, SHA-256 stored, 30-day sliding; no "sign out everywhere" (F21).

Proposed LMP permission matrix: `AUTHORIZATION.md` §Proposed and `LMP_ARCHITECTURE.md` §6 + notes (per-batch
evaluator grants; no organisational role grants training access).

---

## 8. Frontend route and component map

`FRONTEND_GUIDE.md` §1 (routes, gating, chunks) and the frontend review's full table (route → purpose → roles →
components → actions → data → loading/empty/error → offline → chunk) summarised there. State: one read cache patched
after writes; one dialog; one nav model. Component splits justified for `Wall.svelte` and `Ids.svelte`; partial for
`Day` and `DevoteeDetail`. Defects FE-1…FE-20 with fix shapes; verified-sound list (CSV injection, no raw HTML, CSP,
listener cleanup, effect discipline, rotator rule, IST handling).

---

## 9. Performance baseline and bottlenecks

`PERFORMANCE.md`. **Measured:** startup JS 55.03 KB / CSS 13.77 KB gzip (both at target), precache 757 KB / 125
files, load test 3 Oct per-action CPU and rows (with the memo-vs-final discrepancy and the unrun 5,000-devotee test),
deadline job 8–16 ms CPU per run, backup drill 4 s / 7 s. **Measured bottleneck:** `stats.all` (P-1) and the staff
list actions (P-2). **Probable, to measure:** cron outbound-call budget (P-3), Monday copy pause (P-4), `registry`
scans (P-5), in-request Google read (P-6), Report month view (P-7), staff code in the devotee precache (P-8).
**Unverified:** every Lighthouse score (none stored), Smart Placement benefit from India. Budgets proposed in §3 of
that page; tiers kept as they are.

---

## 10. PWA and offline audit

`FRONTEND_GUIDE.md` §4–5 and `INTEGRATIONS.md` §3. Sound: autoUpdate with a busy-aware reload, precache excludes
staff code and paintings, the API is never cached by the service worker, offline day drafts are never shown as sent,
cold start with an expired token is handled, push lifecycle is complete, cache keys are per login and a login
mismatch clears everything. Findings: per-user data at rest after log-out (FE-3, P2), `UPGRADE_REQUIRED` bypassing
the unsaved guard (FE-9), silent IndexedDB failure (FE-12), ~75 KB of staff code precached (FE-15), the real Workbox
config untested outside the live smoke (T §2).

---

## 11. User-experience and functional-defect audit

`USER_FLOWS.md` (fourteen flows with problems and tests) and `DEFECTS_VERIFIED.md` (+ notes). Historical issues:
likes/comments **fixed**; share link **fixed** (hash query `#/wall?post=<id>`; the earlier "still open" verdict
was wrong; posts beyond the 50 newest show "no longer on the wall"); class day **fixed**; edit-name CSS **rebuilt,
not reproducible by inspection**; validation **partly fixed** with two confirmed mismatches (name rule, password
rules) and one data-loss defect found on the way (address parts); cold-start session **fixed**; responsive layout
**fixed and guarded** by 1,809 checks at eleven widths.

---

## 12. Test-suite inventory and coverage gaps

`TESTING.md`. Strong: week state machine, scoring parity with Excel and with the app, Sheets mirror and view sheets
against a fake model, account deletion end to end, push sharding, SQL plan and mass-write audits, contrast tokens,
the API-write contract test. Gaps: systematic authorization (64 actions without a FORBIDDEN assertion; six actions
never called), migrations from a mid-point, the replay-cache race, the two-week deadline gap, overlapping
memberships, a mirror append failure, notices > 35 phones, a scheduled run with one failing step, mock-vs-server
drift, the real Workbox config, Lighthouse stored, server CPU regression. Fragile: real-looking phone numbers in 28
suites, the sibling-tree dependency of `registry-parity`, 280 fixed sleeps in `verify.mjs`, the harness not
returning `RETURNING` rows in batches.

---

## 13. Proposed target architecture

Keep: the endpoint style (ADR 0001), D1 + triggered copy (0002), additive migrations (0003), scores computed once
(0004), derived roles (0005), the PWA shell, the free-plan discipline, the release gate. Change, minimally:

1. **Process**: git, backups, CI, a staging Worker (or a recorded decision not to), a Worker deploy script that
   enforces `audit:sql`, a rollback path in `release.mjs`.
2. **Backend shape**: `coord.js` split by responsibility; `codes.js`; one devotee-lookup helper with one error policy;
   `managed()` scope-first; `mirror_status`; run-scoped outbound counter; timeouts on every fetch.
3. **Data**: the six indexes; `person_names` uniqueness; identity linked at approval; a merge path; one timestamp
   format; `LOG_WHEN` guards for bookkeeping columns; `mirror_log` AUTOINCREMENT.
4. **Frontend**: `routes.js`; `wall/` and `ids/` splits; `leaveguard`; log-out hygiene; shared name rule; precache
   budget enforced; staff code fully out of the devotee precache.
5. **Jobs**: idempotent append tabs; deadline loop; notice marking; registry header check; a fourth cron reserved
   for LMP.

Not proposed: a repository layer, REST, microservices, new frameworks, web fonts, a second database.

---

## 14. LMP system-design proposal

`LMP_ARCHITECTURE.md` (+ notes) and `DECISIONS/0006`. Role-protected area, own shell (`#/lmp/…`, `lmp-*` chunks),
own tables (`programs`, `program_versions`, `criteria`, `training_batches`, `enrollments` keyed on `person_id`,
`assessments`, `assessment_revisions`, `final_reports`, `program_grants` with per-batch scope), frozen versions,
reports that store their own arithmetic, a fixed set of named scoring methods with configurable weights/bands,
summary and history actions kept apart, no accordion when empty. Prerequisites: identity linked at approval and
backfilled, the three ID series reconciled, `person_names` fixed, a merge path, J1/J2/J9 fixed, a cron reserved.

---

## 15. Proposed documentation hierarchy

```
README.md                        purpose, stack, setup, commands, tests, deploy (to be refreshed; see §6 of PROJECT_STRUCTURE)
docs/
  ARCHITECTURE.md                system, request flow, scopes, week machine, jobs, build        ✔ written
  PROJECT_STRUCTURE.md           tree, module → tables, where to change what                    ✔
  DATABASE.md + DATA_DICTIONARY.md   tables, relationships, enums, migrations (+ review notes)   ✔ (peer) + notes
  API_REFERENCE.md               every action (+ review notes; to be generated from ROUTES)     ✔ (peer) + notes
  AUTHORIZATION.md               matrix, ownership, invariants (+ notes)                         ✔ (peer) + notes
  FRONTEND_GUIDE.md              routing, state, API client, forms, PWA, findings                ✔
  TESTING.md                     inventory, coverage, strategy, CI                               ✔
  PERFORMANCE.md                 measured vs estimated, bottlenecks, budgets, procedures         ✔
  OPERATIONS.md                  environments, config, secrets, deploy, migrations, rollback, logs ✔
  INTEGRATIONS.md                Sheets, push, crons, deadline, retention, findings              ✔
  USER_FLOWS.md                  fourteen flows with problems and tests                          ✔
  DEFECTS_VERIFIED.md            the seven historical issues (+ notes)                           ✔ (peer) + notes
  LMP_ARCHITECTURE.md            the portal design (+ notes)                                     ✔ (peer) + notes
  IMPLEMENTATION_ROADMAP.md      phases 0–10 with tasks                                          ✔
  FULL_AUDIT_2026-10-12.md       this map                                                        ✔
  DECISIONS/0001–0008            ADRs                                                            ✔
  revamp/                        UI plan of record (unchanged)
  releases/, perf/ (new: stored Lighthouse and load summaries)
```
Superseded pages (`modernization-audit.md`, `phase6-route-inventory.md`, `screens-status.md`,
`sadhana-api-contract.md` as a contract) are kept for history and marked in `PROJECT_STRUCTURE.md` §5.

---

## 16. Prioritised implementation roadmap

`IMPLEMENTATION_ROADMAP.md`: phases 0–10, each task with problem, evidence, solution, alternatives, risks, tests
and "done when"; essential vs optional; the dependency graph; the recommended first phase.

---

## 17. Risk register and dependency graph

| Risk | Likelihood | Impact | Owner | Mitigation / phase |
|---|---|---|---|---|
| Source loss (no git) | medium | total | owner | 0.1 now |
| Data loss > 7 days old | low | high | owner | 0.2 weekly export |
| Reset-flow account takeover | low–medium | high | — | 1.1 |
| Duplicate Sheets rows + failed scrub of a deleted person | medium | medium (privacy) | — | 1.4 + one-off clean |
| "Too many subrequests" on Sunday evening | medium | medium (partial copy) | — | 1.5 after measurement |
| `stats.all` CPU kill at 3,000+ devotees | high at growth | medium | — | 2.1 |
| Two missed deadlines leave a week open | low | medium | — | 1.7 |
| Facilitator deleted by a coordinator | low | high | — | 1.2 |
| Identity backfill mislinks | medium | medium | head | 3.8 with review list |
| Free-plan daily limits exhausted by tests | medium (happened 12 Oct) | app stops until 05:30 | all | heavy tests early IST; staging |
| LMP copy starves the sadhana copy | medium | medium | — | 7.2 own cron |

Dependency graph: see the Mermaid chart at the top of `IMPLEMENTATION_ROADMAP.md`.

---

## 18. Decisions requiring management input

1. **Reset flow without OTP** (F1): accept the mitigations in 1.1, or introduce a verification step for resets only.
2. **`auth.lookup` revealing `hasAccount`** (F3): keep (helps a returning person) or return `{found:false}` only.
3. **Lockout order** (F12): accept the existing-login oracle, or key tries on `ip:login`.
4. **Coordinator names in public `meta.get`** (F31): keep or hide.
5. **Past weeks on behalf** (F10): may a coordinator read a devotee's past submitted weeks?
6. **Notification prompt on the first tap, signed out** (FE-14): keep or move after the first saved day.
7. **Staging environment** (T F-19): fund a third Worker + D1, or record "no staging" as a decision.
8. **Paintings in git** (0.1): LFS, excluded, or a separate bucket.
9. **LMP** (from `LMP_ARCHITECTURE.md` §9): who sees training scores (facilitator by default: no); evaluators
   correcting before finalisation; reopening a finalised batch (head only); trainee sees own report; one criteria shape
   or three; what ETP and iLS stand for, durations and evaluator roles; whether LMP gets its own cron.
10. **Dead schema columns**: mark unused now; drop later via rebuild, or keep.

---

## 19. Definition of done for the whole programme

- The tree is in git with CI running the fast job on every push and the browser job nightly.
- A weekly export file exists and a restore drill from it has been done on the load database.
- Every finding marked Confirmed defect or Confirmed security risk at P1–P2 is fixed with a test, or recorded as an
  accepted decision in `DECISIONS/`.
- The generated role and ownership matrices are green and cover every action, including `program.*`.
- `audit:sql` reports 0 new scans; startup, lazy and precache budgets hold; a stored Lighthouse report is ≤ 3 months old.
- `stats.all` and the staff list actions are under the budgets in `PERFORMANCE.md` §3 on the load Worker.
- The Sheets copy is observable (`mirror_status`), idempotent for append tabs, and `sync-audit` is clean.
- Identity: every ACTIVE account has a `person_links` row; the three ID series are recorded in `person_identifiers`.
- LMP: one real batch finalised, its report reproducible after a program edit, the profile accordion visible only to
  the permitted viewers, nothing user-visible changed for devotees who are not enrolled.
- The documentation in §15 matches the code: `API_REFERENCE.md` regenerated from `ROUTES`, `DATABASE.md` counts
  recomputed, each page dated.

---

## 20. Recommended first implementation phase

**Day 1 (no code):** 0.1 commit the tree (ignore list first, secrets checked, `docs/` un-linked), 0.2 first export
and a calendar entry, 0.5 the owner checks 0040 remotely.

**Release phase 18 (one week, all S, all additive, all with a test):** 1.2 `devotees.delete` guard · 1.6 master-reset
hash + `LOG_WHEN` exclusion · 1.8 attendance-notice marking · 1.11 address parts · 1.12 shared name rule · 1.13
log-out hygiene · 1.14 UUID fallback · 6.1 generated role matrix (so the release itself proves nothing regressed) ·
the index `registry(phone)` as migration `0042_registry_phone.sql`. Gate: `audit:sql` 0 new, size and precache
within budget, browser suites green, `sync-audit` clean, peers messaged, change copied into the revamp tree the same
day.

**Next release, on its own:** 1.1 reset-request provenance and supersession rules (changes approver UX, needs the
management answer to decision 1), then 1.4 + 1.5 (mirror idempotency and the outbound budget) after one Sunday of
log measurement.

Do not start LMP tables before 3.8 (identity linked at approval) is live.

---

## Status note — 13 October 2026

The peer session that wrote the first six docs re-verified the five corrections from source and applied them.
It also reports having implemented ten frontend findings (FE-1, 2, 3, 4, 5, 6, 8, 11, 12, 15) in the live tree —
uncommitted, unreleased, outside this audit's no-implementation rule; see `IMPLEMENTATION_ROADMAP.md` §"Status
update" for the three corrections to task text that came out of it and for the stronger fix now recommended for F1
(approval generates a temporary password; the requester supplies none).
