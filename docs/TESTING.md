# Testing — Sadhana Record

**12 October 2026 · both suites were run locally for this page.** What exists, what it actually asserts, what is
not covered, and the strategy to close the gaps. Evidence is file:line in this tree.

## 1. Commands and what they cost

| Command | Where | What | Measured |
|---|---|---|---|
| `node tests/run-all.mjs` (`npm test`) | `worker/` | 30 suites on an in-memory `node:sqlite` with **all 40 migrations applied from scratch**, a fake Google/DNS `fetch`, a fixed clock (2026-10-05 10:00 IST) — `tests/harness.mjs:10-11,45,107`; no `node_modules` needed (Node ≥ 22.13) | **2,080 assertions, 3.95 s** |
| `npm run audit:sql` | `worker/` | the same suites with SQL logging, then `tests/query-plans.mjs` (EXPLAIN every distinct statement; fails on a new scan of a growing table) and `tests/write-audit.mjs` (fails on a new mass write), gated by the allow-list in `tests/audit-allow.mjs` (39 entries, each with a reason) | ~5 s |
| `npx vitest run` (`npm test`) | `frontend/` | 24 files, node environment, no DOM; the mock API stands in for the Worker | **321 tests, 1.56 s** |
| `npm run build && npm run size` | `frontend/` | build + gzip budgets (JS 60 / CSS 15 / lazy 35 KB; fails on inline script/style) | ~20 s |
| `node tools/browser/verify.mjs [part]` + `components.mjs`, `back-guard.mjs`, `motion-audit.mjs` | repo root, with `vite --port 5199` | 1,809 + 219 + 17 + 27 browser checks, every screen and role, 11 widths, **against the in-app mock** | ~25 min, this Mac only |
| `node tools/release/gate.mjs checks <n>` | repo root | all of the above in order, then stamps a source fingerprint | ~30 min |

The whole local gate below the browser suites is **under six seconds**. There is **no CI**: nothing runs anywhere
but this machine.

## 2. Inventory — what the suites assert

### Worker (`worker/tests/*.test.mjs`, 30 suites)

| Suite | Rules actually asserted (from the assertion messages) | Checks |
|---|---|---|
| `weeks` | today only; tomorrow refused; STALE for an old version; coordinator fills own batch only; Saturday too early to submit; attendance only after the Sunday class; the same Submit returns the first answer; a new Submit is refused; a submitted week never changes; part week: one complete day scores ÷175; no complete day asks for one; deadline job submits / marks missed / closes / "up to date" | 63 |
| `scoring` | every option, label, mark and range boundary equals the Excel cards; a week of −5 options scores 0 %; 1 perfect day of 7 = 14 % | 323 |
| `coord` | status board, birthdays, attendance window, set inactive from this/next/last week only, membership history, members counts, disable → `ACCOUNT_DISABLED`, delete needs the phone typed again, reopen flow, override, photo | 118 (9 FORBIDDEN) |
| `phase1` | envelope; unknown action/field; Apps Script hashes still verify; **same `requestId` replays the first answer**; simultaneous approvals: one wins, exactly one membership; lockout; reset flow ends sessions; coordinator loses access at once; Sheets copy never carries hashes; queued while Sheets down | 98 |
| `security`, `security-roles`, `scopes` | 8 concurrent wrong passwords → LOCKED_OUT; per-IP BUSY; CORS, nosniff, no-store; coordinator cannot change another coordinator or the head; staff resets go to the head; onBehalfOf needs staff scope; recovery login stays master | 61 |
| `account-delete` | password + the word DELETE; staff refused; after deletion no table and no sheet cell holds the phone, name or IYF ID; weeks kept and still counted; phone can sign up again | 36 |
| `announcements`, `phase9-posts`, `phase0` | audiences, edit/remove by author or master, likes, comments, scheduled posts, moderation (report, mute, head's queue), minors' consent | 226 |
| `groups`, `facilitator`, `facilitators`, `heads`, `identity`, `appids`, `exports`, `retention`, `rules`, `about`, `address9`, `lookup`, `weeksummary`, `setup` | group leaders; facilitator logins see own students only; facilitator list; head appointment needs every other head; identity search/mint/supersede, `mintBatch` idempotent, service account scoped to one action; app IDs; exports per role, pages, rate limit, Activity line; retention never deletes uncopied rows; cards by batch; profile fields; address parts; public lookup masks the name; reading/hearing survive Submit; master recovery once | ~680 |
| `mirror`, `views`, `registry-refresh`, `registry-parity`, `push` | every changing tab equals its table after copies, edits, deletes, a Google failure and a mid-copy change; the four view sheets equal a full build cell for cell after every step; registry diff copy; the dashboard's matching keys (499 checks, **reads `../faciliatorDashboard`**); reminders: who is due, exact bodies, VAPID JWT verifies, three shards reach all 300 phones exactly once, 7th failure removes the phone | 645 |

### Frontend (`frontend/tests/*.test.js`, 24 files)

`api` (envelope, retries keep the requestId, UNAUTHENTICATED clears the token) · `weeks` (one request per Save with
the diff + version, offline queue auto-sent, STALE adoption, part-week submit, live marks = shared scoring) ·
`phase1-session` (timeout, requestId reuse, offline restore, server-ended session, per-login isolation) · `cache`,
`cache-calls` (no call within 2 min, patch after writes, cleared on log-out) · `sw` (first install never reloads;
next version reloads once; unsaved day delays it) · `deletion` (nothing of that login left on the phone) ·
`writes` (**every server `write: true` action is in the app's `WRITES` set**) · `scoring-shared` (app = server
through a JSON round-trip) · `contrast` (every text/surface pair ≥ 4.5:1, edges ≥ 3:1, light + dark × 4 areas) ·
`components` (shared components import no API/cache/session; every sheet goes through `ui/Sheet`) · `nav`,
`tier`, `design`, `ui-logic`, `wall`, `staff5`, `admin6`, `lazy`, `darshan9`, `pace9`, `phase4`, `phase5`, `mock`
(the mock's own rules).

## 3. Coverage map

| Area | Status | Evidence / gap |
|---|---|---|
| Migrations from scratch | **covered**, 30× per run | `harness.mjs:11` |
| Migrations from a mid-point / on existing data | **untested** | no test applies 0001..k, seeds rows, then k+1..41; 39 of 40 files are not re-applicable |
| Authorization gate per action | **partial** | 122 actions; 118 called somewhere; **never called:** `auth.logout`, `resets.reject`, `coordinators.resetPassword`, `batches.list`, `ids.get`, `reopen.reject`; a FORBIDDEN assertion exists for **49 of 113** non-PUBLIC actions; **a new action needs no role test** |
| Ownership narrowing (`STAFF`/`ANY`) | **partial** | read-verified sound for all handlers except `devotees.delete` (see `AUTHORIZATION.md` review notes); cross-batch tests exist in `coord`, `groups`, `security-roles`, `exports`; none for `announcements.remove/comment`, `profile.update`, `photo.upload`, `week.saveWeekEnd/submit` on behalf of another batch, `push.detach` of another endpoint |
| Core week recording | **covered** (server + client) | `weeks.test.mjs`, `frontend/tests/weeks.test.js`; real races only in the load test |
| Role features (coord, fac, leader, master) | **covered** | §2 |
| Account lifecycle | **covered**, except `resets.reject` (never called) and `requests.reject` (no FORBIDDEN case) | |
| Offline & session | **covered at unit level**; the real Workbox config is **untested** | only the live smoke checks "the service worker installs" |
| Google Sheets sync | **covered with a fake Sheets model** | 429/backoff, real column layout: only `tools/sheets/sync-audit.mjs` by hand |
| Exports | **covered** + field contract | `exports.test.mjs`, `shared/exportfields.js` |
| Concurrency / duplicate submissions | **partial** | replay cache sequential case only; 11 `noReplay` actions rely on their own idempotence; the replay-cache race (`api.js:194-198`) is not tested |
| Scoring | **covered twice** | Excel parity + app/server parity |
| Accessibility | **partial** | contrast tokens only; `screenreader.mjs` exists but is not in the gate |
| Performance | **partial** | size budget and SQL audits enforced; precache budget not; no server CPU regression test; Lighthouse by hand, nothing stored |
| Scheduled jobs | **partial** | each job tested alone; no test calls `worker.scheduled()` with one failing step |
| Mock vs server drift | **untested** | `frontend/src/lib/mock*.js` (1,970 lines) re-implements the rules; the 1,809 browser checks test the mock |

## 4. Fragile fixtures

- ~~**Real-looking phone numbers**~~ **FIXED 14 Oct 2026.** 718 occurrences of 129 dialable numbers were rewritten
  into the reserved range across 44 files, keeping the last two digits so cross-references still read. `node
  tools/test/phones.mjs` is now both the sweep (`--fix`) and a gate in `audit:sql` and CI; the mapping is in
  `tools/test/phones.map.json`. It matches numbers **inside** strings as well as standing alone — the first
  version missed `'#/requests?open=su:6000000310'`, which silently broke a browser check, and widening it found
  three more. `SAFE` accepts `6000000xxx` because `registry-refresh` needs 400 distinct fixture phones; hand-written
  fixtures should still take the next free number in `60000000xx` / `60000001xx`, which is all `slot()` allots.
- `registry-parity.test.mjs` reads the sibling dashboard tree; a checkout of this project alone fails it.
- `security.test.mjs` mutates the exported `PER_IP` object — safe only while each suite runs in its own process.
- The harness `batch()` returns rows only for SELECTs (`harness.mjs:33`): a future `RETURNING` inside `db.batch`
  would pass in tests and behave differently on D1. D1's bound-parameter and statement-size limits are not enforced.
- `verify.mjs` still has **~276 fixed `sleep()`s** against its 458 assertions. On 14 Oct 2026 six of them were
  replaced with real waits, because the run **died partway through and had been doing so for days**, so most
  checks were not running at all and the screenshots were four days stale. Each fix let the suite reach further
  and expose the next one:
  | What was asserted too early | Fix |
  |---|---|
  | a search box typed character by character while the list re-rendered, losing focus (asserted on `q=s` after typing "soul") | `typeAndSettle()` sets the value in one go and waits for the hash |
  | a day's Save, read while still "Saving…" | `saveSettles()` |
  | the sign-up Back button, clicked before the reloaded draft restored its step | `waitForSelector` |
  | a phone lookup still spinning (this one cascaded into 7 more failures) | wait for `#su-looking` to go |
  | `#/login` not yet reached after a logout (killed the whole run in its LAST section) | `typeLogin()` re-navigates, then waits |
  **Do not "fix" the remaining sleeps in bulk.** Each one that matters reveals itself as a failure; a blind rewrite
  risks changing what an assertion means. Also: never edit `frontend/src/**` while a browser run is in flight —
  Vite's hot reload re-evaluates the module, `resetWeeks()` clears the mock clock, and the board then correctly
  shows "Opens Sun" with no attendance buttons. That looks exactly like a product bug and is not one.
- `classDayIso` now defaults to **the Sunday just gone** (`weeks = -1`), not the one that ends the current week.
  Monday + 6 days is a Sunday in the FUTURE on every day but Sunday, and a week's attendance is only open between
  its own Sunday and the Monday 21:00 after it, so the old default put the board on a week whose class had not
  happened: no Present/Absent buttons at all, "Opens Sun" on every row, and a crash on a row with nothing to
  click. It passed when run on a Sunday, which is why it lasted.
- **Restart the dev server before a browser run, and do not touch the WORKING TREE while one is in flight** — not just editing `frontend/src/**`, but `git add`, `git restore --staged`, `git stash`, a checkout or a copy between trees. Anything that rewrites a watched file counts.
  Vite's hot reload re-evaluates the changed module; for `mockweeks.js` that re-runs `resetWeeks()`, which sets
  `clock = null` and throws away the pinned date. The board then correctly shows "Opens Sun" and the failure looks
  exactly like a product bug. This cost most of an afternoon on 14 Oct 2026: the coord section passed 131
  assertions on a fresh server and crashed on a reloaded one, with identical code.
  Then it happened a second time, from `git add -A` followed by `git restore --staged` on a peer session's
  files: git rewrote those paths, Vite reloaded them, the run died, and I blamed the peer before checking
  that all four files shared an mtime to the second — a bulk operation, i.e. mine. Check `tail /tmp/v<port>.log`
  for `hmr update` before concluding anything about the app.
- The gate's fingerprint excludes `tools/browser/*`, `worker/wrangler.toml`, `frontend/scripts/*`, `build-id.js`;
  the ledger was bypassed on 12 Oct by moving `release-phase.json` (recorded in `docs/releases/`).

## 5. Risk-based strategy — the tests to add, by layer

**Unit / plain node (< 10 s, every push)**
1. **Generated role matrix** (`worker/tests/roles.test.mjs`): iterate `ROUTES`; one token per scope (devotee,
   leader, facilitator, coordinator of A, coordinator of B, master, service account); call every non-PUBLIC action
   with minimal valid-shaped data; assert `FORBIDDEN` for every excluded scope and *not* `FORBIDDEN` for allowed
   ones. A new action is covered the day it is added. Closes the 64-action gap in one file.
2. **Ownership matrix for `ANY`/`STAFF`**: (action, actor, target in batch B / other author) → `FORBIDDEN`. Expect
   `FORBIDDEN` for batch scope (`requests.js:12`), `NOT_FOUND` for `fac.*`. Include `devotees.delete` of a
   facilitator-linked devotee by a coordinator (the one real gap).
3. **Never-called actions**: `auth.logout`, `resets.reject` (status guard), `coordinators.resetPassword`,
   `batches.list`, `ids.get`, `reopen.reject`.
4. **Replay-cache race**: two concurrent calls with the same `requestId` for `announcements.comment` → exactly one
   row (fails today; drives the fix in the roadmap).
5. **Precache budget** (`frontend/tests/precache.test.js` or in `size.mjs`): parse `dist/sw.js`; total ≤ 800 KB; no
   `staff-*`, no `darshan/`, no `icons/`.
6. **Mock-vs-server drift**: every action name in `mock*.js` exists in `ROUTES`; the mock's write set equals the
   server's; extend `writes.test.js`.
7. **Route-list consistency** (`frontend/tests/routes.test.js`) once `routes.js` exists.
8. **Log-out hygiene**: extend `deletion.test.js` to assert that `endHere()` leaves no `photo:`, `ann:`,
   `journals:` keys (FE-3).
9. **Validation parity**: `shared/name.js` used by both sides; a test that the client and server reject and accept
   the same sample names.

**Integration with local D1 (the harness, < 10 s)**
10. **Migration mid-point**: apply 0001..0030, seed accounts/memberships/drafts/submissions/attendance, apply
    0031..0041, run `home.get`/`week.get`/`stats.all`; same answers as from scratch. Repeat the "last 3" variant.
11. **Two-week deadline gap**: skip two Mondays, run `runDeadline` repeatedly; both weeks close (fails today).
12. **Overlapping memberships**: two open memberships for one login; `runDeadline` must not abort the batch.
13. **Scheduled-run matrix**: call `worker.scheduled()` for the minute-0/30 branch, the reminder-only crons, the
    01:xx retention minutes and minute 7, with a failing D1 in each sub-job; an exception in one job never stops
    the next.
14. **Mirror append failure between two appends**: the second `appendRows` throws; next run must not duplicate rows
    (fails today, J1).
15. **Attendance notices > 35 phones**: no row is marked sent whose phone was not delivered (fails today, J5).
16. **Harness fidelity**: `batch()` returns rows for `RETURNING`; a 100-bound-parameter / 32 KB statement guard.
17. **CPU regression guard**: time `stats.all`, `devotees.list`, `stats.batch`, `home.get` over a 2,000-devotee
    synthetic seed (reuse `tools/perf/viewcpu.mjs`); fail if wall time doubles against a stored baseline.

**Contract**
18. `registry-parity` skips with a message when the dashboard file is absent; copy the `.gs` fixture into
    `worker/tests/fixtures/` with its hash.
19. **API reference drift**: regenerate the action table from `ROUTES` and diff against `docs/API_REFERENCE.md`.

**Browser (nightly and before release)**
20. Replace the fixed sleeps in `verify.mjs` with `waitForFunction`/`waitForText`.
21. Run the suite once against the **built `dist/`** served with `_headers` (CSP, minified code, real precache).
22. One real offline check: install the SW, go offline, reload, sign-in and Home render.
23. Add `screenreader.mjs` and `space-audit.mjs` to the gate list.

**LMP (when built)** — enrolment and assessment: generated role matrix covers the new `program.*` actions on day
one; integration tests for "template change does not change a finalised report", "re-finalise writes a new row and
keeps the old", "concurrent assessment edits keep every revision", "profile summary returns no accordion for a
person with no programs"; a migration test that the LMP tables and their mirror triggers apply on a mid-point DB.

## 6. CI — the minimal pipeline that does not slow anyone down

```
fast   (every push, ~90 s, Node 24):  worker audit:sql · frontend vitest · build + size + precache check · role/ownership matrices
browser (nightly / manual, ~25 min):  vite on 5199 → verify, components, back-guard, motion-audit  (CHROME from env)
deploy (manual approval only):        migrations list/apply → wrangler deploy → npm run release
```
Prerequisites: the tree in git with a root `.gitignore` (ADR 0007); `verify.mjs:13` honours `$CHROME`; a `.nvmrc`
(Node ≥ 22.13 for `node:sqlite`); `registry-parity` tolerant of the missing sibling.

## 7. Definition of "tested" for a change

A change is tested when: the rule it adds or alters has an assertion with a human-readable message; the role matrix
is green (new actions included automatically); `audit:sql` reports `0 new`; the size and precache budgets hold; and,
for anything a person sees, the browser part for that screen is green at 320 and 1024 px.
