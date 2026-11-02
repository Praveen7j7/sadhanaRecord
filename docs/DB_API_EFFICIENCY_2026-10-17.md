# Database hits, API calls and "deadlocks" — the honest view, 17 October 2026

**Scope:** Sadhana Record (the Worker API on D1, the Svelte app) with the training batches that are now part of
it. **Question asked:** are there joins, GROUP BYs or heavy queries where one row would do; is anything called
again that was already fetched; are there deadlocks; and what is the best bargain for this build.
**Method:** the project's own audits over the full suite (`SQL_LOG=… npm test`, `query-plans.mjs`,
`write-audit.mjs`, `tools/perf/sqltrace.mjs`, `statscost.mjs`), the live database's own numbers (`wrangler d1
info`, `run_log`, `batches`), and the code. Every number says where it came from. Nothing was changed.

---

## 1. Where the app stands (measured today)

| What | Value | Source |
|---|---|---|
| Live devotees in a batch | 15, in 6 class batches (SPS, SPS2, SPSO, DPS, BSS, BVS) | `batches` + `memberships`, live, 17 Oct |
| Training batches live | none yet; `tracks` exists (0050 applied), `class_day` does **not** (0051 and commit `ee9fed4` are not deployed; last deploy 15 Oct 22:19 UTC) | `d1_migrations`, `docs/deploy-log.json` |
| D1 reads / writes in the last 24 h | 36,576 rows read · 553 written · 15,647 read queries · 339 write queries | `wrangler d1 info sadhana` |
| Share of the free daily budget | 0.7 % of 5 M reads · 0.6 % of 100 k writes | same |
| Database size | 3.21 MB, 57 tables | same |
| Full-suite SQL audit | 714 distinct statements, **0 new scans** of a growing table (28 approved); 285 writes, **0 new mass writes** (20 approved); 52 suites, 2,632 assertions green | `audit:sql` run today |
| `run_log` since 10 Oct, "overloaded / queued" entries | **0** | live `run_log` |
| `run_log` since 10 Oct, INTERNAL errors | 13–14 Oct: the daily read-limit outage (`mirror_log` count every minute; fixed, hourly now). 17 Oct: **16 × `devotees.get` "finalScores is not defined"** — a live bug, fixed in `8120dac`, not yet deployed | live `run_log` |
| Slow calls (> 1.5 s in the Worker) since 10 Oct | `home.get` 11 (max 4.4 s), `auth.me` 4 (2.4 s), `stats.all` 4 (4.5 s), `group.list` 3, one each of 5 others | live `run_log` |

**Plain reading:** the database is idle by any measure, the audits that guard the free plan are green, and
there is no overload. The costs that are real today are (a) one live crash on the devotee card, (b) seconds of
waiting on a few calls that use almost no CPU and read almost no rows, which means the time goes to **round trips**,
not to SQL.

---

## 2. SQL shape: joins, GROUP BY, heavy queries

I looked for the pattern you named — a join or an aggregate where a single-row lookup would do — on every path.

**Devotee hot path (`home.get`, `week.get`, `week.saveDay`, `week.submit`, `auth.me`).** No joins except the
announcement image join (one LEFT JOIN, indexed) and the `json_each` that lists lectures already heard. Every
other statement is a primary-key or `(login, week_id)` lookup. Nothing to remove here. The load test (3 Oct) put
`home.get` at 8 ms CPU and 25 rows read.

**Staff screens.** The joins and GROUP BYs live where they belong: `board.js`, `oversight.js`
(`stats.all` was rebuilt on 13 Oct from 85 statements / 7,318 rows to **15 statements / 148 rows**; measured
again today: 148 rows at 2,000 seeded devotees, 196 at 26 weeks), `exports.js`, `facilitators.js`. These
aggregate per batch; a single-row query cannot answer them. `stats.batch` (19 statements, 1,584 rows) and
`devotees.list` (14 statements, 1,024 rows) grow with the batch by design because they list every devotee.

**Reference data per call.** `settings` (whole table) and `batches` (whole table) are read once per call and
memoised for that call (`db.js remember()`); both are fixed-size tables and on the audit's FIXED list. The new
class-day check (`classOpensFor`) rides on that memo and costs no extra statement — confirmed by the audit.

**Verdict:** there is no case of an unnecessary join, GROUP BY or heavy query on the paths that run per devotee.
I would not touch any SQL for shape.

---

## 3. Repeated calls and caching

**Client (already good).** `lib/cache.svelte.js`: every read is shown from memory or `sessionStorage` at once and
re-fetched only when older than **2 minutes** or on Refresh; concurrent loads of one key share one request;
writes `patch()` the cache instead of refetching; `home.get` and `profile.get` are also kept in IndexedDB per
login so a repeat open paints before the network answers; `meta.get` is kept in `localStorage` and refreshed
once per page load; prefetch warms only the first screen each role opens. `api.js` keeps one request id per
in-flight action so a retried write is answered from the server's `replies` table instead of being applied
twice. An app open for a devotee costs **two** calls, `auth.me` and `home.get`.

**Server, inside one call (good, one gap).** The per-call memo stops `settings`, `batches` and the open membership
from being read twice. The gap: `auth.me` computes `scopesOf()` twice — once in `session.js:29` for the session,
again in `auth.js:257` for `userInfo` — so `SELECT batch_id FROM leaders WHERE login = ?` runs twice (statements
5 and 6 in the trace). One statement per `auth.me`; trivial to remove by passing `ctx.scopes` into `userInfo`.

**Server, across calls (none, and that is right for now).** Nothing is cached between requests. An isolate-level
cache of `settings`/`batches` would make the submit window and the batch list stale for its TTL after the head
changes them, and Workers isolates are many and short-lived, so the hit rate is uncertain. Not worth it at
15,000 read queries a day. Revisit only when `rows_read_24h` passes about 3.5 M.

**The two calls at app open.** `home.get` already returns `versions`; it could also return `user`, and
`session.restore()` could skip `auth.me` when a kept user exists and `home.get` answers. That is one round trip
less at every open for devotees. Worth doing after §5 item 2, not before.

---

## 4. Deadlocks

There are none, and there cannot be any in this design. D1 is SQLite with one writer; the Worker never holds an
open transaction; `db.batch([...])` is one atomic unit sent in one request; uniqueness is enforced by the schema,
so check-then-write races cannot duplicate a row. The four failure classes that *do* exist here, with their status:

| Class | What it looks like | Status today |
|---|---|---|
| D1 overloaded / "queued for too long" | INTERNAL on a call; deliberately not written to `run_log` to avoid adding load | 0 occurrences since 10 Oct |
| 10 ms CPU cap (`exceededCpu`) | the isolate is killed; **never reaches `run_log`**, only Workers metrics/logs | not measurable from the database; the load test has `week.submit` at **9 ms p50** against the 10 ms cap, the thinnest margin in the app. Nothing in this build touches scoring. |
| Daily read budget | every call fails until 05:30 IST | happened 13–14 Oct; fixed (hourly backlog count; the scan audit now derives growing tables from the schema) |
| Cron and user writes at the same moment | a write waits milliseconds behind the other | not an issue at this size; every cron step is bounded |

---

## 5. The best bargain for this build, in order

1. **Deploy what is already fixed.** The devotee card crashes live 16 times today; the fix is committed
   (`8120dac`). Migration 0051 and the class-day change ship with it. Zero new code. (Release is your call;
   this is the only item that changes what a user sees.)

2. **Batch the reads inside `home.get` and the session preamble.** Today `home.get` runs **22 statements one
   after another** (16 when only this week is open); `auth.me` runs 8. Each statement is a Worker→D1 round trip.
   The load test's `home.get` was 8 ms of CPU for 1.6 s of wall time, and the slow log shows 4.4 s — that gap is
   round trips. D1's `batch()` sends N statements in one request and returns results for each; the test harness
   already executes SELECT batches (`tests/harness.mjs:31`). Concretely:
   - session: `sessions` + `accounts` in one statement (a join on `login`), then `memberships`, `leaders`,
     `batches`, `settings` as one batch → **2 round trips instead of 6** on every authenticated call;
   - `weekView`: the six lookups per open week (`submissions`, `reopens`, `missed_weeks`, `drafts`,
     `class_weeks`, `attendance`) for both weeks as **one batch of 12**;
   - the `home.get` tail (`profiles`, heard lectures, announcements) as one batch.
   Result: `home.get` about **5 round trips instead of 22**, `auth.me` 2–3 instead of 8; rows read and CPU
   unchanged, so it is free-plan neutral. One care point: `requestDb.batch()` clears the memo because it assumes
   writes; add a read-only `readBatch()` that fills the memo instead. Measure before and after with
   `tools/perf/sqltrace.mjs` (count statements) and the load Worker (`LOAD_METER=1`, `week.submit` CPU must stay
   where it is). I did not measure the per-hop latency live; that is the one assumption here, and the load
   Worker settles it in an hour.

3. **Remove the duplicate `scopesOf()` in `auth.me`** (§3). One line, one statement saved per call.

4. **Then, optionally:** `home.get` carries `user`, so a repeat open makes one call instead of two (§3).

5. **Watch, do not change:** `week.submit` CPU at 9 ms. Any future change to scoring or `week_json` must be
   measured on the load Worker before release.

**Not worth doing now:** rewriting the staff-screen joins; cross-request caches; paging `devotees.list`;
anything on the Sheets copy (paused); upgrading the plan (0.7 % of the read budget in use).

---

## 6. Training (management training) in this build

The training batches are ordinary rows in `batches` with `tracks` (0050) and `class_day` (0051); there is no
LMS table, action or query in the Worker yet — `LMP_ARCHITECTURE.md` and `lms-knowledge-base-proposal.md` are
proposals. So for this build the training scope adds **no** database cost: the class-day gate reads the batch
from the per-call memo. Two things to carry forward when LMS tables arrive:
- the schema-derived scan audit guards a new table the day it is created, as long as it is not added to the
  FIXED list by mistake;
- the head's rule from 17 Oct (a class-batch coordinator must not delete accounts, a training-batch one may)
  needs a `kind` on `batches` — additive, default `class`, one column.

---

## 7. What was implemented (17 October 2026)

Items 2, 3 and 4 of §5 are **done, measured and tested**. Item 1 is a deploy and stays the head's call.

### Measured, same scenario, before and after

| Action | Round trips before | after | Statements before | after |
|---|---|---|---|---|
| `auth.me` | 8 | **4** | 8 | **6** |
| `home.get` (one open week) | 22 | **10** | 22 | 22 |
| `week.get` | 17 | **9** | 17 | **16** |

A round trip is one request to D1; a batch counts as one however many statements it carries. Statements did not
rise, so nothing about the free-plan budget got worse, and the duplicate scopes read made it slightly better.

### What changed

1. **`reads()` and `rows()` in `worker/src/db.js`** — several READS in one round trip. It is a separate door from
   `db.batch()` on purpose: it does not clear the per-call memo (a read that forgot the settings and the batch
   list would cost more queries than it saved), and it reaches the binding underneath `requestDb` so the memo
   survives. It falls back to running the statements one by one when a binding has no `batch()`.
2. **`scopeReads()` in `db.js`** — the membership, the batch list and the group-leader row in one hop instead of
   three. Anything already memoised is not asked for again, and what it reads is memoised for the rest of the call,
   so `classOpensFor` and the week screens stay free.
3. **`sessionCtx` in `session.js`** — the session and its account in one `LEFT JOIN` instead of two sequential
   reads. The order of the checks is unchanged: the session is judged first (missing, ended, expired), the account
   after it, and a session whose login has no account still gives `a_login = null`. Columns are prefixed so
   `login` and `role`, which exist in both tables, cannot shadow each other.
4. **`weekView` in `weeks.js`** — the six rows the view always needs in one hop (the four `weekStatus` reads, the
   class week, the attendance row). `weekStatus` itself stays sequential, because a submitted week answers on the
   first read and batching it would read three tables the short circuit skips.
5. **`userInfo` in `auth.js`** — takes the scopes the caller already has. `auth.me` computed them twice, which is
   why `SELECT batch_id FROM leaders` appeared twice in one call.
6. **`home.get` now carries `user`** — the same object `auth.me` returns, so a repeat open can be one call instead
   of two. Added, never substituted: `auth.me` is unchanged and is still the authority on a cold start, at sign-in
   and after a role change. The client change is not made yet; the field is there for it.

### A bug found and fixed on the way

The class-day change (commit `ee9fed4`, 17 Oct) moved the three attendance **gates** onto the batch's own day but
left the devotee's own week view on the old Sunday-for-everyone helper. A Wednesday batch's devotee was shown
"attendance opens Sunday" while the server had already been accepting their mark since the Wednesday. `weekView`
now uses `classOpensFor` like every other surface. It costs no query (the batch list is memoised). A test in
`vedic-attendance.test.mjs` pins it from the API, and it was confirmed to fail on the old code and pass on the new.

### Still open: the dev mock says Sunday too

The same miss exists in the **dev mock**, and is wider than the server one: `frontend/src/lib/mockweeks.js:35`
still holds the day-6 helper and six call sites across `mockweeks.js` and `mockstaff.js` use it, three printing
"the Sunday class" in so many words (`mockweeks.js:459`, `mockstaff.js:316`, `:444`). Confirmed by a peer session
and recorded as item 9 of `REPORTED-2026-10-17.md`.

It is **not** fixed here, deliberately. The mock keeps `classDay` on the MEMBERSHIP (`mockstaff.js:49`) while the
server now keeps it on the BATCH (migration 0051), so aligning them means moving a fixture field and updating
every reader; a quick attempt broke three client suites. The mock is dev-only — `api.js:110` drops it from any
build that sets `VITE_API_URL` — so no devotee is affected, and no weekday batch exists yet. The peer session that
found it is doing it deliberately before the release.

**The lesson, which is the point:** one helper changed and its call sites did not, in two codebases at once. When
the server's shape changes, the fixture should mirror that shape rather than keep its own, or the next change has
two places to miss again.

### How it was proved safe

- **Response parity:** 18 scenarios (devotee and master `auth.me`, `home.get` fresh / with a draft / after
  attendance, `week.get` on two weeks, `saveDay`, `setAttendance`, batch board, `devotees.list`, `devotees.get`,
  `stats.all`, `history.list`, `profile.get`, `meta.get`, a bad token and a malformed token) captured against the
  committed code and against the new code. **Zero lines removed, zero changed; the only difference is the added
  `user` object.**
- **Tests:** every suite passes. The free-plan audits report **0 new scans and 0 new mass writes** for these files.
- **Load meter:** verified that statements inside a read batch are still counted, so capacity measurement stays true.

**Not verified:** the per-hop latency against the live database. The round-trip counts above are exact; what each
saved hop is worth in milliseconds is the one open number, and the load Worker settles it in an hour.

**Note on the shared tree:** a peer session is editing `phases.js`, `phases.test.mjs` and migration 0052 in this
same working tree. Its suite fails and it adds one new scan on the `phases` table; both were confirmed to be
present with my changes fully reverted, so they belong to that work, not to this one.

---

## 8. How to check any of this yourself

```
cd sadhanaRecord/worker
npm run audit:sql                       # scans + mass writes over the full suite
node ../tools/perf/sqltrace.mjs         # statements per call for auth.me and home.get
node ../tools/perf/statscost.mjs 2000   # staff screens: statements and rows read
npx wrangler d1 info sadhana            # rows read / written in the last 24 h
```
