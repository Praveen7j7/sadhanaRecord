# Copies and speed: a whole-app audit

*27 Oct 2026. Written for the head (Praveen Jha) and for future builders. **Analysis only.** No app file was changed and nothing was deployed. No remote D1 or wrangler command was run, and the live app was not called.*

## What the head asked

> "If there are any more such things done in the copied format which can be fixed — for the app to store things
> efficiently and at the same time increase speed — find them by searching the entire app, all routes."

This audit leaves out the names work that is already under way: facilitator, person and post-author names (`docs/NAMES_ONE_SOURCE_2026-10-27.md`, Phase 23 P13 → Phase 24). It also leaves out the retirement of the Facilitator Dashboard read. Everything below is on top of that work.

**IDs used in this document**

- **C** = copied data
- **S** = speed
- **G** = storage growth

The 22 Oct audit's items G0–G23 are a different list. They are written **OPT-G0…OPT-G23** here.

---

## 1. Summary

1. **The paused Sheets copy still writes on every change.**
   - 112 database triggers still add a `mirror_log` row for every change to 28 tables, although the copy has been off since 13 Oct.
   - Measured over the whole server suite, **33 % of all rows written are these log rows (2,727 of 8,258)**.
   - On a devotee's week it is **12 of 35 rows (34 %)**: sign-in, seven saved days, week-end, attendance and submit.
   - Writes are the free plan's tightest limit, and nothing reads these rows while the copy is paused (C1).
2. **The night clean-up has stopped while the copy is paused.**
   - The retention job only removes Activity-log and Run-log rows that have already been copied to Sheets.
   - So since 13 Oct, `audit_log`, `run_log` and `mirror_log` all grow without end. This was proved on a copy (G1).
3. **A devotee's phone makes 3 calls to open Home: `home.get`, `announcements.list` and `meta.get`.**
   - `home.get` already reads the posts and then throws them away (S1).
   - This is the most likely source of the "2–3 calls in the same second from one phone" seen 49 times in the Cloudflare logs.
4. **The Sunday path was left out of the 22 Oct speed pass.**
   - Save a day: 13 round trips. Submit: 13. Week-end: 11. Week: 9. Attendance: 8.
   - These are the calls every devotee makes most, and no test guards them (S2).
   - `weeks.js` is not one of the names builder's files.
5. **Storage will reach the free plan's database size in under a year at 5,000 devotees.**
   - A submitted week is stored as **2,915 bytes** of JSON. 344 bytes of that repeat the row's own columns, and half of each day is the card's range text copied in.
   - Photos and post pictures are kept in D1 as base64 text. A removed post keeps its picture for ever (G2, G3).
6. **IYF ID copies have drifted.**
   - The IYF ID sits on `accounts`, `profiles`, `memberships`, `persons` and `person_identifiers`.
   - Mint-from-person, supersede, merge and link update only some of them.
   - `profiles.connected_since`, the year an IYF ID is made from, is not updated when the head supersedes a year (C2, C3).

The recommended build list is in §7.

---

## 2. How this was measured

- **Frozen copy.** The tree was copied at 07:28 IST to `scratchpad/audit-copies/tree`: worker, shared, setup, tools and frontend. The names builder kept editing the live tree after that; for example `fac_id` columns appeared in `inactive.js`. Line numbers below are from the live files as read on 27 Oct. Some may shift while P13 lands.
- **Server suite, with the existing audits.**
  - `node tests/run-all.mjs` with `SQL_LOG`, then `tests/query-plans.mjs` and `tests/write-audit.mjs` (what `npm run audit:sql` runs).
  - Results: 3,215 assertions. **913 distinct statements, 39 scans of growing tables, all on the approved list, 0 new. 343 write statements: 313 keyed and 30 mass, all approved, 0 new.**
  - Two suites were red in the copy, `phase0.test.mjs` and `rules.test.mjs`. Both expect `journals_version` `j3`, which looks like the books relink in progress. Neither belongs to this audit, and neither was investigated.
- **Cost per action.**
  - The copy's `tests/harness.mjs` was instrumented in the copy only, and the whole suite was run again: 4,969 API calls over the 182 registry actions.
  - A **round trip** (hop) is one `first()`, `all()` or `run()`, or one `db.batch()` / `reads()` list. Requests sent together with `Promise.all` count once each, as in the 22 Oct audit.
  - **Rows written** is SQLite `total_changes()`, which includes rows written by triggers. D1 also bills one extra row per index a write touches, so the real D1 figures are equal or higher.
  - The full table is in the Appendix.
- **Single-path traces.** `scratchpad/audit-copies/scripts/` holds `trace.mjs` (the statements of each hot action), `writes.mjs` (rows per table for a devotee's week) and `retention-paused.mjs` (the retention proof).
- **The screens.** A read-only pass over `frontend/src` listed what every route calls when it opens. Its main claims were checked again by hand: `DevoteeHome.svelte:45-47`, `App.svelte:61-67`, `Report.svelte:41` with `History.svelte:18`, `BatchStatus.svelte:83-87`, `lib/photos.js:22-37` and `ui/Photo.svelte:4-18`.

---

## 3. Status of the earlier lists (what is still open)

| Source | Item | Status on 27 Oct |
|---|---|---|
| OPTIMIZATION_AUDIT 22 Oct | OPT-G0 placement hint | Built. `worker/wrangler.toml` has `[placement] region = "aws:ap-southeast-1"`. **Not checked on live:** this audit made no network call. Check that the `cf-placement` header no longer reads `local-…`. Every hop count below matters about 20–50× more if it still does |
| | OPT-G1–G8, G10 | ✅ built (tracker rows 136–145) |
| | OPT-G9 / G11 | ❎ dropped by the head (already built / not needed) |
| | OPT-G12 copy audit | 🔨 S's screens done; the rest is open |
| | OPT-G13–G23 | ✅ |
| | §4.2 targets for `week.saveDay` (5) and `week.submit` (5) | **Open. Never built:** still 13 and 13 (S2) |
| BUILD_TRACKER 22 Oct | C4 shared-element travel | 🧪 built; the full browser run is still owed |
| | F4 PBKDF2 25k | ⏳ waits for the head and a load-Worker measurement |
| | 6.8 staging | Config is in `wrangler.toml`. The staging D1 was never created (`database_id = "TODO-…"`) |
| AUDIT_BLUEPRINT 21 Oct | R-26 Requests in one call | **Open.** The head's Requests still costs `requests.list` + `reopen.list` + `batchreq.list` + `announcements.reports` (S3) |
| | R-31 `SR` in `APP_MINTED` | Still there (`admin.js:613`). It looks deliberate: `ids.link` / `ids.unlink` use it to retire old SR ids (`admin.js:675,690`). Close it as intended |
| | R-33 | = F4 |
| | R-23 `stats.all` at scale | Hops are fixed (5). CPU at 2,000–5,000 devotees has not been measured on the load Worker since B5 |
| PERFORMANCE 12 Oct | P-9 the Sheets copy rewrites a row on every sign-in | **Open, and wider than written:** every sign-in, save, attendance mark and submit still writes a `mirror_log` row while the copy is paused (C1) |
| | P-1 `stats.all` CPU | as R-23 |
| | P-3 / P-4 (minutely run outbound calls, Monday copy pause) | Moot while `SHEETS_COPY=off` |
| | P-6 registry read inside a request | Being retired with the dashboard read (P13) |
| | P-10 | = F4 |
| | P-11 startup budget | Resolved: startup JS 38.6 KB (Phase 23 P12) |
| PHASE23 27 Oct | P1 | Built, **not deployed** |
| | P8, P13 | ◐ building |
| | P2, P3, P5, P9, P10, P11 | Built and tested; the browser part is pending |
| | Phase 22 left-overs | gate record 22, books relink 0069 |

---

## 4. A. Copied data: the same fact in two or more places

Each finding says which copy is the source, who keeps the others in step, and the fix. The fix is one of three: point to the source, work the value out when it is read, or keep the copy as a deliberate cache with a reason.

**"Conflict"** means the fix touches a file the names builder is changing now: facilitators.js, registry.js, profile.js, admin.js, identity.js, announcements.js, phases.js, board.js, facilitator.js, explorer.js, push.js, shares.js, enrol.js, exports.js, requests.js, auth.js, devotees.js, inactive.js, closing.js, mirrorkeys.js, frontend `mock*.js` and the nine meta screens.

### C1 — The paused Sheets copy still logs every change (highest value)

**What and where**

- 112 triggers write a `mirror_log` row on every insert, update and delete of 28 tables (accounts, drafts, attendance, memberships, profiles, settings…). They come from migrations 0018, 0022, 0024, 0027, 0030, 0034, 0035, 0039, 0042 and 0047. A further 16 view triggers on 8 tables write `view_dirty` (once per view and part; each one also reads a `batches` row on every write). That makes 128 triggers in all, counted from a database built from every migration.
- The copy has been off since 13 Oct (`wrangler.toml` `SHEETS_COPY = "off"`), on purpose: "nothing is lost — every change still queues in mirror_log" (`index.js:106-156`).
- This is the copy of the whole database that exists for a sheet nobody now reads.

**Measured: rows written for one devotee's week** (`writes.mjs`)

| Action | Rows written | of which `mirror_log` |
|---|---|---|
| sign-in | 3 | 1 |
| first day saved | 5 | 2 |
| each later day | 3 | 1 |
| week-end | 2 | 1 |
| attendance | 3 | 1 |
| submit | 4 | 1 |
| **the week** | **35** | **12 (34 %)** |

- Over the whole suite: **2,727 of 8,258 rows written (33.0 %)**.
- Staff actions are heavier: `requests.approve` writes 16 rows, 7 of them log rows. `profile.update` writes 9, 4 of them log rows.

**Why it matters**

- D1 writes are the limit that bites first: Sunday at 5,000 devotees is about 80–85k of the 100k daily writes (CLAUDE.md). About a third of that is this log.
- The log also never empties while the copy is paused (G1).
- When the copy is switched back on, the plan is to drain months of backlog at 300 entries a minute. A full re-copy (the mirror already has a `build` mode, migration 0037) would be cheaper and safer than replaying the backlog.

**Fix**

- Make the triggers write only while the copy is on. Add a new `settings` row, `sheets_copy`, that the scheduled run keeps equal to the `SHEETS_COPY` var. Then add `WHEN (SELECT value FROM settings WHERE key = 'sheets_copy') = 'on'` to each trigger. Each write then costs 1 indexed row read and **0 rows written**.
- Make the resume runbook "turn the flag on, set every `mirror_state` to `build` (full re-copy)", not "drain the log".
- Then empty the queued `mirror_log` after a backup (`impl/baseline/`).
- Before this, the mirror and views suites must set the flag on. They will go red until they do, which shows the guard is working.

| Effort | Risk | Conflict |
|---|---|---|
| M: one migration recreating the triggers, plus the runbook in `INTEGRATIONS.md` and `mirror.js` notes | Medium. The resume path must be proved by `mirror.test.mjs` and `views.test.mjs` with the flag on and off | **None.** Migrations, `mirror.js`, `index.js`. Agree the migration number with peer sessions |

### C2 — The IYF ID is stored in five places and they have drifted

**What**

- The IYF ID is on `accounts.iyf_id`, `profiles.iyf_id`, `memberships.iyf_id`, `persons.iyf_id` and `person_identifiers` (plus `submissions.iyf_id` and `week_json.iyfId`, which are history stamps and fine).

**Who keeps the copies in step**

| Path | What it updates |
|---|---|
| `admin.js:586-588` (`ids.link`) | all three app tables |
| `identity.js:88-91` (mint at approval) | all of them, but open memberships only |
| `registry.js:143-145` | all three app tables |
| `identity.js:189` (`identity.link`) | **accounts only** |
| `identity.js:206-208` (`identity.mint`) | **persons + accounts only** |
| `identity.js:232-234` (`identity.supersede`) | **persons + accounts only** |
| `identity.js:297` (`identity.merge`) | **accounts only** |

So after the head supersedes or merges, `profiles.iyf_id` and `memberships.iyf_id` still hold the old ID.

**Who reads the copies**

- Every screen reads `accounts.iyf_id`: `devotees.js`, `board.js:38,54`, `profile.js:36,41`, `explorer.js:61`.
- `memberships.iyf_id` is read only to be copied into the next membership row: `closing.js:156,234-236,294`, `devotees.js:153-154`, `inactive.js:58-59,87-88`. Each of these carries a stale value forward.
- `facilitator.js:129` selects `m.*` together with `a.iyf_id`. Which one wins depends on column order, so remove the ambiguity.
- `profiles.iyf_id` is never read by any reply. It feeds the paused Sheets copy only.

**Cost**

- One extra row written per copy on every ID change. With C1 that is two.

**Fix**

- **Point to the source.** `accounts.iyf_id` is the deliberate cache of the person's current ID ("so exports and screens agree", `identity.js:188`), kept by every ID path.
- Stop writing `profiles.iyf_id` and `memberships.iyf_id` and stop copying them forward. Leave the columns in place: never drop, by the additive rule.
- Better still, route every ID change through one statement list, as `renamePerson` will do for names.

| Effort | Risk | Conflict |
|---|---|---|
| S–M | Low. Nothing reads the copies; prove it with a reply-parity diff | **Yes**: identity.js, admin.js, requests.js, registry.js, closing.js, devotees.js, inactive.js. Build it in or right after Phase 24, with the same "one write path" pattern |

### C3 — The year a person connected is stored twice, and minting reads the copy that is not updated

**What**

- `profiles.connected_since` and `persons.connected_since`.
- `identity.mint` and `identity.supersede` (`identity.js:206,232`) write `persons` only.
- `ids.create` takes the year from `profiles` (`admin.js:616-617`), and so do approval (`requests.js:90`) and the profile screen (`profile.js:39,123-127`).

**Why it matters**

- The rule is that the IYF ID year comes from `connected_since`. After the head corrects a year by superseding, the profile still shows the old year, and the next app-side mint for that person uses it.
- This is an identity-correctness drift, not a speed issue.

**Fix**

- Read the year from `persons` through `person_links`. `profiles.connected_since` stays as what the devotee typed at sign-up, then `persons` is the record.
- Or have supersede and mint update both in the same batch, as `identity.js:88-90` already does.

| Effort | Risk | Conflict |
|---|---|---|
| S | Low | **Yes**: identity.js, admin.js, profile.js, requests.js |

### C4 — Scores are stored at submit, recomputed on read, and summed from the stored copy

**What**

- `submissions.overall` and `.attendance` (and `week_json.scores`) are written at submit (`weeks.js:552-562`).
- A later coordinator, leader or head attendance mark changes the week's score. Every screen therefore recomputes it with `finalScores(sub, mark_used)` (`classweek.js:93-100`; callers in board, devotees, facilitator, leaderboard, views, weeks).
- The Analysis summary `batch_weeks` sums the **stored** `overall` (`analysis.js:16-38`, `SUM(overall)`).
- Result: the head's Analysis average differs from Boards, History and the Leaderboard for any week whose attendance changed after it was submitted.
- `week_json.attendance` and `week_json.scores` go stale in the same way.

**Fix** (either one)

- (a) When a mark changes after submission, update `submissions.attendance` / `overall` in the same batch as the mark. This is one keyed write, and only when the week is already submitted. Then readers can drop `finalScores`.
- (b) Have `refreshWeeks` compute the overall as `finalScores` does, by joining `attendance` (already joined at `analysis.js:31`).
- (b) is the smaller change. (a) removes the copy-plus-recompute pattern.

| Effort | Risk | Conflict |
|---|---|---|
| S for (b), M for (a) | Low for (b) | None for (b): `analysis.js`. (a) touches `attendance.js`, `coord`, `groups.js`, `push.js` (conflict for push.js) |

### C5 — A submitted week is kept twice in one row

**What**

- `week_json` (decision 42, written for the dashboard bridge that is now retired) repeats `login`, `name`, `iyfId`, `batch`, `week`, `daysFilled`, `weekEnd`, `attendance`, `sevaMinutes` and `scores`. All of these are already columns of the same row: **344 bytes a week**.
- Each day also carries its card marks with the card's range text, for example `"to_bed":["10:00 - 10:15 PM",25]`. That text is `card_ranges.label` for that rules version: 182 of each day's 365 bytes.
- The old `days_json` / `marks_json` columns are empty for new weeks but still read as a fallback (`weekjson.js:41`, `DAYS_SQL`).

**Measured** (`writes.mjs`, one full 7-day week)

| Shape | Bytes |
|---|---|
| `week_json` today | 2,915 |
| without the header copies, the per-day date and the range labels (marks kept as numbers) | 1,669 (−43 %) |
| the days alone | 1,123 |
| every other column of the row | ≈ 226 |

**Fix**

- New weeks store `{v: 2, days: [...]}` with marks as numbers. The label is looked up from `card_ranges` by `rules_version` when shown; it is already versioned.
- Old rows stay as they are, and readers accept both versions, as `weekOf()` already does for v0.
- Keep the marks themselves: they record what was scored that day under the rules in force, which is history.

| Effort | Risk | Conflict |
|---|---|---|
| M: `weekjson.js`, `weeks.js` (history `day_pct` SQL reads `$.m`), board / `fac.week` / `devotees.week` readers, mock | Medium. Every week reader needs a parity test on v1 and v2 rows | Partly (board.js, facilitator.js, devotees.js); `weeks.js` / `weekjson.js` none |

Storage growth for this is G2.

### C6 — The photo time is stored twice

**What**

- `profiles.photo_updated_at` is written by `photo.upload` / `photo.remove` (`profile.js:226,262`).
- Every reader takes `photos.updated_at` instead (`auth.js`, `weeks.js:336`, `devotees.js`, `board.js`).

**Cost**

- 1 extra row written per photo change, plus a `mirror_log` row.

**Fix**

- Stop writing it. Nothing reads it.

| Effort | Risk | Conflict |
|---|---|---|
| S | None | **Yes** (profile.js). Fold it into Phase 24 |

### C7 — A group leader's batch is copied onto the leader row

**What**

- `leaders.batch_id` is set from the leader's own membership when appointed (`groups.js:125`).
- Promotion and closing (`closing.js`) and moves between batches never touch `leaders`. A grep finds no `leaders` statement in `closing.js`.
- So a promoted group leader would keep `scopes.groupLeader = { batchId: <old batch> }` (`db.js:174`).
- **Not proved with a test**: the code path was read, not run.

**Fix**

- Either have scopes take the leader's batch from their open membership (already read in the same batch, `db.js:139-148`), or have promote / close end the leadership.
- Write the failing test first.

| Effort | Risk | Conflict |
|---|---|---|
| S | Low | **Yes** (closing.js) |

### C8 — Dead copies: tables, columns and duplicate indexes nothing reads

| What | Evidence | Cost today | Fix |
|---|---|---|---|
| Table `group_leaders` | no reader, no writer in `worker/src` | none (no rows written) | Leave it; note it as retired in `DATABASE.md` |
| Table `inactive_requests` (Phase 22, replaced by ADR 0020) | no reader, no writer | 3 indexes, no writes | as above |
| Table `registry` | frozen snapshot after P13 | `ids.possibleDuplicates` reads the whole table (P13 owns this) | — |
| Table `app_ids` | the SR series is retired. Read only by `ids.appList` / `ids.nextApp` | small | keep while old SR ids resolve |
| `accounts.signup_state`, `signup_at`, `approved_by`, `approved_at` | 0 references in `worker/src`. They duplicate `status` / `signed_up_at` / `decided_*`, and carry the partial index `accounts_signup_pending` (0038:152) | none per write (the partial index matches no row) | document as unused |
| `accounts.phone_changed_from`, `requested_group_leader`; `memberships.group_leader`; `profiles.photo_file_id`, `imported_fields`; `batches.view_sheet_id`; `submissions.bridged_at` | 0 references in `worker/src` | storage only (empty defaults) | document as unused; never drop |
| **Duplicate index** `idx_reset_login_status` = `reset_requests_by_login` (both `(login, status)`; 0001:73 and 0048:29) | identical | +1 index row written on every reset-request write | `DROP INDEX idx_reset_login_status` (S, none) |
| **Redundant index** `activity_events_day (day)` is a prefix of `activity_events_day_how (day, how, login)` (0071:32) | the longer one serves every `day =` lookup | +1 index row per activity event | drop the shorter one, after `query-plans.mjs` shows the plans unchanged |
| `submissions.submission_id` = `login || '-' || week_id`, with its own UNIQUE index beside `UNIQUE(login, week_id)` | a copy of two columns | +1 index row and about 40 bytes per submitted week | keep the column (erase.js and the Sheets key use it); it is a cheap copy, flagged only |
| `card_ranges`, `seva_rules` tables | no reader in `worker/src`. Scoring uses `shared/scoring.js`; the tables are the Sheets reference copy | none | keep. C5 would give `card_ranges` a reader |

### Copies that are right as they are: keep them, with the reason written down

| Copy | Why it stays |
|---|---|
| `attendance.mark_used` (derived from four marks plus the class week) | Read by SQL aggregates (boards, eligible, `batch_weeks`). Kept right by `usedAfter()` in every write (`classweek.js:62-67`) |
| `batch_weeks` sums | A deliberate cache: a year of Analysis is about 52 × batches rows instead of every submission. Refreshed for 4 weeks back at each deadline. Fix its overall per C4(b) |
| `accounts.iyf_id` | The current ID on the account, for every screen and export (C2 keeps it as the one copy) |
| `submissions.name`, `iyf_id`, `batch_id` | History of the day it was submitted (names plan §5) |
| `memberships` rows re-written on each state change (inactive / active) | Deliberate history: one closed row and one open row. Costs 2 rows + 4 index rows + 2 log rows per change. C1 removes the log rows |
| `replies` (bodies of write replies, 6 h) | Retry safety. Trimmed hourly (`index.js:191`) |

---

## 5. B. Speed per route

Round trips are what a phone waits for. With OPT-G0 working, a hop costs about 1–3 ms. Without it, a hop costs about 50–80 ms from Delhi (22 Oct audit §3).

### S1 — Devotee Home: three calls on every open; could be one (highest value for phones)

**What happens** (verified by hand)

1. `home.get` (`session.svelte.js:72/99`).
2. Then `announcements.list` whenever any post exists (`DevoteeHome.svelte:45-47`).
3. Then `meta.get` at idle on every page load, only for the push key (`App.svelte:61-67`). The key is already in the cached `sr.meta` (`lib/meta.js:7-17`), and `ensureDevice` talks to the server only weekly.

**Waste on the server**

- `home.get` already reads up to 100 full posts with bodies in its one batch (`weeks.js:331-337`; `announcements.js:96-107`, `LIMIT 50 × 2`). It returns only their times (`weeks.js:357-361`).
- The second call then reads the same posts again, plus likes, comments and reach: 7 hops.

**Measured cost**

| Call | Hops | Rows read | Reply |
|---|---|---|---|
| `home.get` | 6 | 25 | 1.7 KB |
| `announcements.list` | 7 | 12–108 | up to 17.7 KB |
| `meta.get` | 4 | 66 | 1.9 KB |

Devotee Home shows one post and a count. This three-call pattern matches the 49 "2–3 calls in one second" seen in the logs.

**Fix**

- `home.get` returns the newest visible post (the one Home shows) and its like/comment counts. The client files it under the Wall's cache key, with the time of the whole reply, as CLAUDE.md asks for `home.staff` parts.
- The Wall then calls `announcements.list` only when opened.
- `meta.get` at start-up is skipped when `cachedMeta().push` exists. `home.get` adds a `metaVersion` (batch, facilitator and window settings changed) so the phone refreshes `sr.meta` only when something changed. This also closes the names plan's "nine screens never refresh it" point at no extra call.
- Result: 3 calls → 1 on every devotee open, which is most of the app's traffic.

| Effort | Risk | Conflict |
|---|---|---|
| M | Low–medium. A parity test on the post, and `mockweeks` must mirror it | **Yes**: DevoteeHome and Home are among the nine meta screens, and `announcements.js` (only the shared `view()` is reused). Coordinate with the names builder: P13 step 4 already plans to send names on start at no extra call. Do both in one change |

### S2 — The Sunday path: 8–13 hops each, never in the speed pass

**Measured cost**

| Action | Hops p50/max | Statements | Where the hops go (`trace.mjs`) | Floor |
|---|---|---|---|---|
| `week.saveDay` | **13 / 15** | 16 | session · scopes batch · `weekStatus` 4 sequential reads (`weeks.js:245-253`) · `openWeeks` reopens (`:55-63`) · `cardFor` re-reads the batch row although `batchesAll` is in memory (`:112`) · `INSERT OR IGNORE` · `SELECT` day · `UPDATE` | 5 |
| `week.submit` | **13 / 13** | 22 | as above, then `classWeekOf`, the `attendance` row and `cardFor`, one hop each (`:500-505`), then the write batch | 5 |
| `week.saveWeekEnd` | 11 / 14 | 14 | as saveDay | 5 |
| `week.get` (draft week) | 9 / 12 | 17 | `weekStatus` reads submissions / reopens / missed / drafts one by one, then `weekView` reads **the same four again** in a batch (`:375-391`, trace lines 7–10 and 13–16) | 4 |
| `week.setAttendance` | 8 / 9 | 11 | same front part | 4 |

**Why it matters**

- These are the actions every devotee runs daily, and all of them on Sunday.
- The 22 Oct targets (5) were set but never built.
- `round-trips.test.mjs` exercises them only to set up its world; it pins no budget for them.

**Fix**

- One `reads()` with the status rows, the reopen list and the class week, riding in the `scopeReads` batch the way the replay read does (OPT-G2, `db.js:126-148`).
- `cardFor` from `batchesAll()`.
- `weekGet` uses `weekStmts` once.
- `saveDay`: `INSERT OR IGNORE` + `SELECT` in one batch.
- Pin each budget in `round-trips.test.mjs`, with a parity diff of replies including STALE / ALREADY_SUBMITTED / WINDOW_CLOSED.
- The `weekStatus` short circuit was kept sequential on purpose ("fewer rows", `weeks.js:240-244`). The extra rows from batching are 3 keyed reads (≤ 3 rows). That is the right trade when each hop is a network crossing.

| Effort | Risk | Conflict |
|---|---|---|
| M | Medium. The STALE and replay paths must answer the same; the existing weeks, submit-window and phase2-deadline suites cover them | **None** (weeks.js, classweek.js, db.js) |

### S3 — Staff start-up: the head makes 9 calls, a coordinator 6 + one per batch

**What happens**

- **Head (not a devotee)**, cold start: `auth.me`, `requests.list`, `reopen.list`, `batchreq.list`, `announcements.list`, `home.staff`, `activity.notices`, `birthdays.today` and `meta.get`.
  - `requests.list`, `reopen.list`, `batchreq.list` come from the warm-up in `cache.svelte.js:137-139`.
  - `requests.list` and `reopen.list` are also inside `home.staff` (`staffhome.js:17-21`).
  - `activity.notices` is in the `home.staff` reply but not filed under its own key, so it is fetched again (`HeadHome:36-37`, `Shell:96`).
- **`home.staff` itself** is 10 handlers in `Promise.all`: **20 hops and 31 statements**, 7.5 KB.
  - It is the largest per-call statement count in the app. If D1's 50-queries-per-invocation limit on the free plan counts each request, it is at 20 of 50.
  - It ships 100 Run-log rows, of which Home shows today's (`staffhome.js:19`).
- **Coordinator**: `auth.me` ∥ `requests.list` ∥ `announcements.list`, then **one `devotees.list` per batch** ∥ `activity.notices` ∥ `birthdays.today`, then `meta.get`. That is 7 calls for one batch, and 10 for `sps`, who holds four batches.
- **Batch status polls** while attendance is open: every 120 s, N × `devotees.list` (`BatchStatus.svelte:83-87`). That is 30 calls an hour per batch per open screen.

**Fix**

- File every `home.staff` part under its key (the Requests / reopen / notices warm-up then becomes a cache hit).
- Add `batchreq` and `birthdays` to it, and stop the separate warm-up for the head.
- Inside `home.staff`, send the parts' statements as one `reads()` where they are independent. That is a refactor of each handler into "statements + finish", as `visibleQuery` already is.
- Give coordinators the same one-call Home: one `devotees.list` over all their batches (the SQL already takes a batch list) plus requests, notices and birthdays.
- Have the poll ask for `{since}` only, or stretch it to 5 minutes and pause it while the screen is hidden.

| Effort | Risk | Conflict |
|---|---|---|
| M–L | Medium | **Yes**: requests.js, admin.js, facilitators.js, announcements.js, inactive.js, devotees.js, and the Home meta screen. Build after Phase 24 |

### S4 — Members: one photo download per member with a photo, on every page load

**What happens**

- `members.list` returns only `hasPhoto` (`devotees.js:76-79`).
- So `Photo.svelte` cannot pass `updatedAt`. `getPhoto` then ignores the copy kept in IndexedDB and calls `photo.get` once per visible person per page load (`lib/photos.js:22-37`).
- A page of 40 members with photos = 40 calls of up to 200 KB of base64 each, every session, on mobile data.

**Fix**

- `members.list` (and `devotees.list` / `devotees.get`) return `photoAt` from `photos.updated_at`. The join is already there for `has_photo`.
- The kept copy is then used and the calls drop to 0 for unchanged photos.

| Effort | Risk | Conflict |
|---|---|---|
| S | Low | **Yes** (devotees.js). A one-line reply field; ask the names builder |

### S5 — Smaller duplicate reads (each S)

| What | Evidence | Fix | Conflict |
|---|---|---|---|
| `/history` fetches `history.list` twice: `{limit:26}` and `{limit:8}` | `Report.svelte:41`, `History.svelte:18` | History reads the first 8 from Report's reply | Report is a meta screen: coordinate |
| `ScoresView` calls `week.get` directly while Report caches the same call under `week.get:<w>` | `ScoresView.svelte:22`, `Report.svelte:67` | use the cache key | none |
| `announcements.image` and the like / comment checks read up to 400 visible posts to authorise one post | `announcements.js:162,321` (`visible(ctx, 200)` → `LIMIT 400`) | add `AND a.id = ?` to the visibility query | **yes** (announcements.js) |
| `announcements.get` reads the whole visible set (`visible(ctx, 10000)` → 400 rows) to find one post | `announcements.js:142` | same | **yes** |
| `meta.get`: three requests then a fourth sequential one | `admin.js:31-32` | one `reads()` | **yes** (admin.js) |
| `devotees.list` and `fac.*` re-read `SELECT batch_id, name FROM batches` although `batchesAll()` is in memory | `devotees.js:74`, `facilitator.js:122` | use `batchesAll` (−1 hop each) | **yes** |
| `home.get`: `openWeeks` reads reopens in its own hop before the big batch | `weeks.js:324` | ride in `scopeReads` (−1 hop on every devotee open) | none |
| Card / Scoreboards / BatchAsk / Comments always force a refetch although cached | `Card.svelte:109`, `BatchAsk.svelte:25`, `Wall.svelte:166` | stale-while-revalidate as elsewhere | none |

### What is already right (do not touch)

- The signed-in entry fee: session + scopes = 2 hops, and replay rides in the batch (OPT-G2).
- `home.get`'s single batch for the week rows.
- `board.get`, `eligible.list` and `closingPreview` no longer grow with people (OPT-G6).
- `journals.get` sends the big reply (93–223 KB) only on a version change (OPT-G8).
- No query outside the approved list scans a growing table, and no write is unkeyed (audit numbers in §2).

---

## 6. C. Storage growth

### G1 — With the copy paused, the night clean-up removes nothing (proved)

**What**

- `runRetention` deletes only Activity-log and Run-log rows whose id is ≤ `mirror_state.last_id`: "a row not copied to Sheets yet is never erased" (`retention.js:41-46`).
- With the copy off, `last_id` is frozen at 13 Oct.
- `trimMirrorLog` likewise deletes only below the frozen position (`mirror.js:350-358`).

**Proof** (`retention-paused.mjs`, 100 rows of each log dated Jan 2026, retention 6 months, run at 01:12 IST on 27 Oct)

| Copy position | What was deleted |
|---|---|
| `last_id` 0 (never copied) | nothing |
| `last_id` 40 | 40 rows of each, then nothing, however many nights it runs |

**Why it matters**

- `audit_log`, `run_log` and `mirror_log` grow without end from 13 Oct.
- `mirror_log` grows with **every write** (C1). On 14 Oct it had reached 8,600 rows in a day of light use (`index.js:115-125`).
- At 5,000 devotees that is tens of thousands of rows a day kept for ever.
- The head's 3 / 6 / 12 / 24-month log setting does nothing while the copy is paused.

**Fix**

- When `SHEETS_COPY` is off, retention ignores the copy position for `audit_log` / `run_log`. Those rows' only other copy is the frozen sheet, which already stopped.
- With C1, `mirror_log` is emptied once, after a backup.

| Effort | Risk | Conflict |
|---|---|---|
| S | Low. Changes `retention.test.mjs` expectations for the paused case only | **None** (retention.js, index.js) |

### G2 — Submitted weeks reach the free plan's database size in under a year at 5,000 devotees

**What**

- 2,915 bytes per submitted week (C5) + about 226 bytes of other columns + 3 index entries.
- 5,000 devotees × 52 weeks = 260,000 rows ≈ **0.8 GB a year**.
- 2,000 devotees ≈ 0.33 GB a year.

**Why it matters**

- Cloudflare's D1 limits page gives a free-plan database a maximum size of 500 MB, and 5 GB per account. **Confirm on the limits page before planning; this audit made no network call.**
- Weeks with hearing and reading entries are larger than the test week measured.

**Fix**

- C5: −43 %.
- Paid D1 lifts the cap to 10 GB, a billing change only (22 Oct audit §7).

| Effort | Risk | Conflict |
|---|---|---|
| M (via C5) | — | — |

### G3 — Pictures are stored inside the database as text

**What**

- Profile photos: `photos.jpeg`, 400 × 400 JPEG, up to 150 KB, stored as base64, so up to 200 KB (`profile.js:224`, `lib/crop.js:3-4`).
- Post pictures: `announcement_images.jpeg`, up to 240 KB → 320 KB base64 (`announcements.js:71`).
- `announcements.remove` only sets `removed_at` and expired posts are never cleaned, so **a removed or expired post keeps its picture for ever** (`announcements.js:327-336`; there is no `DELETE FROM announcement_images` except when a picture is replaced, `:312`).

**Size** (estimate; no live data was read)

- A 400 × 400 photo at quality 0.82 is typically a few tens of KB. At 5,000 devotees × 30–60 KB × 1.33 (base64), that is about 0.2–0.4 GB, on top of G2.

**Fix, in order of cost**

- (a) Delete a post's picture when the post is removed or has been expired for a period (S; retention.js / announcements.js).
- (b) Store new pictures as BLOB, not base64 text: −25 % (S–M; the reply can still send base64).
- (c) Move pictures to R2 (free tier 10 GB) with the D1 row keeping only the key (M–L; a new binding, a decision for the head).

| Effort | Risk | Conflict |
|---|---|---|
| (a) S | Low | yes (announcements.js) |

### G4 — Other tables that grow

| Table | Grows by | Clean-up | Verdict |
|---|---|---|---|
| `sessions` | each sign-in | hourly: ended or expired and unused for 60 days (`index.js:194`) | fine |
| `replies` | each replayable write | hourly, after 6 h (`index.js:191`) | fine |
| `counters` | rate limits | hourly, on expiry | fine |
| `push_jobs` | each post that notifies | retention, DONE and older than the period (`retention.js:48-52`); not blocked by G1 | fine |
| `activity_events` | each inactive / active change | none | small: a few rows per person per month. Add it to retention when convenient |
| `audit_log`, `run_log` | every audited action; slow calls; vitals 1 in 100 | **blocked by G1** | fix G1 |
| `mirror_log` | **every write on 28 tables** | **blocked** | fix C1 + G1 |
| `post_comments`, `post_likes`, `announcements` | use | none (removals kept) | fine, except pictures (G3) |
| `person_history`, `memberships` history | events | none, by design (history) | fine |

---

## 7. Ranked by value, and the recommended build list

### Ranking (phone on mobile data first, then the free plan's daily limits)

| # | ID | What | Gain | Effort | Conflict |
|---|---|---|---|---|---|
| 1 | **C1 + G1** | Stop logging changes for the paused Sheets copy; let retention run while paused | −33 % of all rows written (−34 % on a devotee's week); three unbounded tables stop growing | M + S | none |
| 2 | **S2** | Sunday path to its floor (`saveDay` / `submit` 13 → 5, `week.get` 9 → 4, week-end 11 → 5, attendance 8 → 4) | −8 hops on every save and submit | M | none |
| 3 | **S1** | Devotee Home in one call (newest post + meta version in `home.get`) | 3 calls → 1 on every devotee open; −7 server hops and up to 17.7 KB | M | yes (with P13 step 4) |
| 4 | **C4(b)** | Analysis sums use the final score | Analysis matches Boards and History | S | none |
| 5 | **S4** | `photoAt` in member lists | up to 40 photo downloads → 0 per Members open | S | yes (one field) |
| 6 | **C2 + C3** | One write path for IYF IDs; the year read from `persons` | removes a real drift on supersede / merge / link | S–M | yes |
| 7 | **C5 / G2** | Slim `week_json` v2 | −43 % per submitted week; keeps D1 under the free size for longer | M | partly |
| 8 | **G3(a)** | Delete pictures of removed or expired posts | storage | S | yes |
| 9 | **S3** | Staff Home: one call for head and coordinator; slower batch poll | head 9 → about 3 calls; coordinator 6 + N → about 2; −30 calls an hour per open Batch status | M–L | yes |
| 10 | **C6, C7, C8, S5** | write-only copies, leader batch, duplicate indexes, small double reads | rows and hops at the margin | S each | mixed |

### Build now (no conflict with the names builder; each is its own patch with targeted tests)

1. **G1** (retention while paused) — S, `retention.js`. Proved broken, cheap, no risk to live data. It deletes only rows already older than the head's period.
2. **C1** (triggers only while the copy is on, re-copy on resume) — M. A migration, so it is a **bulk** release through the gate; agree the migration number with peers. Back up `mirror_log` first, then empty it.
3. **S2** (Sunday path) — M, `weeks.js` / `db.js`, with round-trip budgets and a reply-parity diff. Lands before the November batches start.
4. **C4(b)** — S, `analysis.js`.
5. **C8 duplicate indexes** — S, in the same migration as C1.

### Build in or right after Phase 24 (they touch the names builder's files; same "one source" pattern)

- S1, together with P13's "fresh names on start at no extra call".
- C2 and C3 (one ID write path, like `renamePerson`).
- C6, C7, S4, the S5 rows in announcements.js / admin.js / devotees.js, and G3(a).

### Next phase, after a decision

- C5 / G2 (`week_json` v2) — it changes the stored shape of the most important table. Do it before real batches have months of weeks, but as its own bulk phase with parity tests on both versions.
- S3 (one-call staff Home) — the largest refactor here; the gain is per staff open, and staff are few.
- G3(b/c) (BLOB / R2) — only when the photo count or size calls for it. R2 is a new binding and the head's choice.

### Leave

| Item | Reason |
|---|---|
| The dead tables and columns in C8 | They cost nothing per write; the additive rule says never drop. Document them as retired in `DATABASE.md` |
| `attendance.mark_used`, `batch_weeks`, `accounts.iyf_id`, history stamps on submissions, membership history rows | Deliberate copies, with the reasons in §4 |
| R-31 (`SR` in `APP_MINTED`) | It is used to retire old SR ids |
| Anything for G11-style read replicas | The head ruled it out on 22 Oct |

---

## Appendix — cost of every action (frozen copy, whole suite, successful calls)

How to read the table:

- **hops**: round trips the call waited for. Requests sent in parallel each count once, and the hourly session refresh is included.
- **rows written**: SQLite `total_changes`, including trigger rows; D1 adds index rows on top.
- **of which `mirror_log`**: the rows C1 would remove.
- The `w 0/1` seen on many reads is the hourly session refresh.
- A suite world is small (a handful of devotees), so these are fixed costs. Growth was measured on 22 Oct (`docs/perf/api-cost-2026-10-22.md`).

| action | calls | hops p50/max | statements p50/max | rows read p50/max | rows written p50/max | of which mirror_log | reply KB p50/max |
|---|---|---|---|---|---|---|---|
| home.staff | 3 | 20 / 20 | 31 / 31 | 88 / 94 | 0 / 0 | 0 / 0 | 7.5 / 7.9 |
| identity.link | 1 | 18 / 18 | 25 / 25 | 26 / 26 | 6 / 6 | 2 / 2 | 0.8 / 0.8 |
| identity.merge | 1 | 15 / 15 | 26 / 26 | 18 / 18 | 4 / 4 | 1 / 1 | 0.8 / 0.8 |
| card.months | 3 | 14 / 14 | 35 / 35 | 98 / 99 | 0 / 0 | 0 / 0 | 0.3 / 0.3 |
| week.saveDay | 80 | 13 / 15 | 16 / 22 | 26 / 28 | 3 / 9 | 1 / 3 | 0.4 / 0.7 |
| week.submit | 10 | 13 / 13 | 22 / 22 | 26 / 27 | 4 / 4 | 1 / 1 | 0.3 / 0.3 |
| ids.create | 6 | 13 / 14 | 30 / 32 | 12 / 14 | 22 / 26 | 10 / 12 | 0.1 / 0.1 |
| facilitators.rename | 2 | 13 / 13 | 24 / 24 | 18 / 18 | 15 / 15 | 7 / 7 | 0.4 / 0.4 |
| identity.mint | 1 | 13 / 13 | 21 / 21 | 13 / 13 | 8 / 8 | 3 / 3 | 0.6 / 0.6 |
| identity.supersede | 1 | 13 / 13 | 22 / 22 | 14 / 14 | 10 / 10 | 4 / 4 | 0.7 / 0.7 |
| attendance.override | 6 | 12 / 12 | 24 / 24 | 32 / 35 | 5 / 5 | 1 / 1 | 0.1 / 0.1 |
| devotees.delete | 5 | 12 / 12 | 56 / 56 | 20 / 20 | 32 / 55 | 8 / 13 | 0.1 / 0.1 |
| fac.devotees | 3 | 12 / 12 | 15 / 15 | 31 / 32 | 1 / 1 | 0 / 0 | 0.4 / 0.7 |
| profile.update | 24 | 11 / 18 | 21 / 40 | 13 / 26 | 9 / 26 | 4 / 12 | 0.6 / 0.7 |
| week.saveWeekEnd | 12 | 11 / 14 | 14 / 17 | 25 / 28 | 2 / 5 | 1 / 2 | 0.1 / 0.1 |
| devotees.week | 3 | 11 / 12 | 14 / 15 | 25 / 27 | 1 / 1 | 0 / 0 | 0.3 / 3.5 |
| ids.get | 2 | 11 / 11 | 14 / 14 | 22 / 22 | 0 / 0 | 0 / 0 | 1 / 1 |
| announcements.comment | 9 | 10 / 12 | 14 / 16 | 23 / 36 | 3 / 4 | 1 / 1 | 0.2 / 0.2 |
| account.delete | 5 | 10 / 10 | 53 / 57 | 20 / 23 | 45 / 71 | 11 / 14 | 0.1 / 0.1 |
| announcements.uncomment | 1 | 10 / 10 | 15 / 15 | 14 / 14 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| stages.set | 10 | 10 / 10 | 27 / 28 | 42 / 57 | 3 / 4 | 0 / 0 | 0.6 / 0.7 |
| facilitators.setLasting | 2 | 10 / 10 | 16 / 16 | 18 / 18 | 4 / 4 | 1 / 1 | 0.3 / 0.3 |
| fac.week | 7 | 10 / 12 | 13 / 15 | 24 / 28 | 1 / 1 | 0 / 0 | 0.8 / 4 |
| heads.decide | 4 | 10 / 10 | 18 / 18 | 17 / 18 | 8 / 8 | 3 / 3 | 0.5 / 0.5 |
| requests.approve | 145 | 9 / 15 | 22 / 41 | 11 / 28 | 16 / 33 | 7 / 15 | 0.1 / 0.1 |
| access.assign | 5 | 9 / 16 | 16 / 24 | 20 / 38 | 6 / 8 | 2 / 2 | 2.7 / 3.5 |
| resets.approve | 7 | 9 / 9 | 17 / 17 | 26 / 27 | 7 / 8 | 2 / 2 | 0.2 / 0.2 |
| week.get | 16 | 9 / 12 | 17 / 20 | 24 / 29 | 0 / 1 | 0 / 0 | 1.1 / 3.9 |
| access.revoke | 3 | 9 / 10 | 16 / 18 | 20 / 21 | 6 / 6 | 2 / 2 | 2.2 / 2.8 |
| facilitators.add | 12 | 9 / 11 | 15 / 17 | 11 / 25 | 4 / 5 | 1 / 1 | 0.2 / 0.3 |
| ids.link | 3 | 9 / 9 | 17 / 17 | 11 / 11 | 8 / 8 | 3 / 3 | 0.1 / 0.1 |
| facilitators.setActive | 8 | 9 / 9 | 15 / 15 | 12 / 13 | 4 / 4 | 1 / 1 | 0.3 / 0.3 |
| facLogins.link | 3 | 9 / 9 | 15 / 15 | 12 / 12 | 4 / 4 | 1 / 1 | 0.3 / 0.3 |
| group.mark | 6 | 9 / 9 | 21 / 22 | 32 / 37 | 5 / 7 | 1 / 2 | 0.1 / 0.1 |
| identity.search | 8 | 9 / 9 | 12 / 12 | 17 / 18 | 0 / 0 | 0 / 0 | 0.7 / 0.8 |
| devotees.promote | 2 | 9 / 9 | 16 / 16 | 28 / 28 | 7 / 7 | 2 / 2 | 0.2 / 0.2 |
| mutes.set | 5 | 9 / 9 | 12 / 12 | 25 / 25 | 2 / 2 | 1 / 1 | 0.1 / 0.1 |
| coordinators.create | 62 | 8 / 10 | 15 / 17 | 37 / 88 | 6 / 10 | 2 / 4 | 0.2 / 0.5 |
| leaders.assign | 5 | 8 / 11 | 13 / 17 | 11 / 13 | 4 / 6 | 1 / 2 | 0.1 / 0.1 |
| week.setAttendance | 17 | 8 / 9 | 11 / 12 | 24 / 26 | 3 / 4 | 1 / 1 | 0.2 / 0.2 |
| announcements.like | 10 | 8 / 8 | 11 / 11 | 12 / 13 | 1 / 1 | 0 / 0 | 0.1 / 0.1 |
| weeks.setClass | 5 | 8 / 8 | 24 / 24 | 31 / 32 | 8 / 8 | 3 / 3 | 0.2 / 0.2 |
| weeks.reopen | 4 | 8 / 10 | 16 / 18 | 11 / 25 | 5 / 6 | 1 / 2 | 0.1 / 0.1 |
| facLogins.create | 7 | 8 / 8 | 14 / 14 | 24 / 30 | 4 / 4 | 1 / 1 | 0.3 / 0.3 |
| facLogins.resetPassword | 2 | 8 / 8 | 15 / 15 | 25 / 25 | 5 / 5 | 1 / 1 | 0.3 / 0.3 |
| access.set | 8 | 8 / 10 | 14 / 16 | 17 / 31 | 4 / 5 | 1 / 1 | 3 / 3.1 |
| masters.set | 4 | 8 / 9 | 15 / 15 | 17 / 18 | 4 / 7 | 1 / 1 | 0.3 / 0.4 |
| identity.get | 2 | 8 / 8 | 11 / 11 | 16 / 16 | 0 / 0 | 0 / 0 | 0.7 / 0.7 |
| settings.update | 13 | 8 / 9 | 14 / 18 | 38 / 40 | 4 / 11 | 1 / 4 | 0.3 / 0.4 |
| share.week | 1 | 8 / 8 | 11 / 11 | 12 / 12 | 0 / 0 | 0 / 0 | 0.7 / 0.7 |
| mutes.setAll | 4 | 8 / 8 | 13 / 13 | 24 / 25 | 3 / 3 | 1 / 1 | 0.1 / 0.1 |
| coordinators.resetPassword | 1 | 8 / 8 | 15 / 15 | 31 / 31 | 4 / 4 | 1 / 1 | 0.3 / 0.3 |
| auth.signUp | 160 | 7 / 8 | 9 / 10 | 17 / 18 | 6 / 7 | 2 / 2 | 0.1 / 0.1 |
| batches.create | 35 | 7 / 10 | 13 / 18 | 13 / 39 | 4 / 6 | 1 / 1 | 0.3 / 0.3 |
| leaders.set | 6 | 7 / 9 | 13 / 15 | 10 / 25 | 4 / 9 | 1 / 3 | 0.1 / 0.1 |
| coordinators.update | 5 | 7 / 8 | 14 / 16 | 17 / 24 | 6 / 8 | 2 / 3 | 0.3 / 0.3 |
| announcements.list | 55 | 7 / 10 | 10 / 13 | 12 / 108 | 0 / 1 | 0 / 0 | 0.8 / 17.7 |
| devotees.setActive | 8 | 7 / 8 | 14 / 15 | 24 / 25 | 5 / 7 | 1 / 2 | 0.1 / 0.1 |
| card.fill | 13 | 7 / 8 | 18 / 22 | 39 / 46 | 3 / 7 | 0 / 0 | 2.8 / 2.8 |
| enrol.add | 19 | 7 / 7 | 15 / 15 | 13 / 27 | 7 / 7 | 2 / 2 | 0.2 / 0.2 |
| board.get | 15 | 7 / 8 | 18 / 26 | 41 / 295 | 0 / 0 | 0 / 0 | 0.4 / 23.8 |
| card.of | 7 | 7 / 8 | 19 / 22 | 42 / 43 | 0 / 0 | 0 / 0 | 4.1 / 4.3 |
| attendance.set | 10 | 7 / 8 | 19 / 22 | 29 / 34 | 4 / 10 | 1 / 3 | 0.1 / 0.1 |
| reopen.request | 1 | 7 / 7 | 13 / 13 | 11 / 11 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| exports.page | 45 | 7 / 9 | 11 / 15 | 18 / 36 | 2 / 2 | 0 / 0 | 0.2 / 3.9 |
| batches.close | 5 | 7 / 7 | 17 / 29 | 27 / 42 | 11 / 20 | 3 / 5 | 0.2 / 0.2 |
| batches.closingPreview | 2 | 7 / 7 | 10 / 10 | 27 / 27 | 1 / 1 | 0 / 0 | 0.5 / 0.5 |
| share.add | 5 | 7 / 9 | 14 / 16 | 13 / 27 | 4 / 5 | 0 / 0 | 0.1 / 0.1 |
| share.devotee | 2 | 7 / 7 | 10 / 10 | 31 / 31 | 1 / 1 | 0 / 0 | 0.2 / 0.2 |
| announcements.resolve | 2 | 7 / 7 | 14 / 14 | 11 / 11 | 8 / 8 | 3 / 3 | 0.1 / 0.1 |
| batches.update | 6 | 7 / 8 | 13 / 14 | 12 / 12 | 4 / 4 | 1 / 1 | 0.3 / 0.3 |
| coordinators.setDisabled | 2 | 7 / 7 | 14 / 14 | 17 / 17 | 6 / 6 | 1 / 1 | 0.3 / 0.3 |
| resets.reject | 1 | 7 / 7 | 13 / 13 | 11 / 11 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| announcements.get | 5 | 7 / 8 | 10 / 11 | 10 / 11 | 0 / 0 | 0 / 0 | 0.4 / 0.5 |
| facilitators.list | 9 | 6 / 6 | 9 / 9 | 53 / 54 | 0 / 0 | 0 / 0 | 7.1 / 7.3 |
| targets.unlock | 1 | 6 / 6 | 14 / 14 | 10 / 10 | 3 / 3 | 0 / 0 | 0.1 / 0.1 |
| home.get | 35 | 6 / 8 | 20 / 26 | 25 / 36 | 0 / 7 | 0 / 2 | 1.7 / 3.9 |
| announcements.update | 6 | 6 / 6 | 12 / 13 | 10 / 11 | 4 / 5 | 1 / 1 | 0.4 / 0.4 |
| announcements.comments | 9 | 6 / 6 | 9 / 9 | 24 / 26 | 0 / 0 | 0 / 0 | 0.4 / 0.5 |
| ids.unlink | 2 | 6 / 6 | 15 / 15 | 10 / 10 | 10 / 10 | 4 / 4 | 0.1 / 0.1 |
| batchReq.create | 5 | 6 / 6 | 12 / 12 | 9 / 11 | 3 / 3 | 0 / 0 | 0.4 / 0.4 |
| batchReq.withdraw | 1 | 6 / 6 | 12 / 12 | 12 / 12 | 3 / 3 | 0 / 0 | 0.4 / 0.4 |
| batchReq.decide | 1 | 6 / 6 | 12 / 12 | 12 / 12 | 3 / 3 | 0 / 0 | 0.4 / 0.4 |
| devotees.setDisabled | 6 | 6 / 6 | 13 / 13 | 10 / 10 | 4 / 5 | 1 / 1 | 0.1 / 0.1 |
| targets.set | 13 | 6 / 6 | 16 / 20 | 22 / 28 | 3 / 7 | 0 / 0 | 0.1 / 0.1 |
| devotees.setPeople | 9 | 6 / 7 | 12 / 13 | 10 / 11 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| devotees.get | 16 | 6 / 9 | 12 / 16 | 12 / 29 | 0 / 1 | 0 / 0 | 0.9 / 1.1 |
| criteria.set | 4 | 6 / 6 | 13 / 14 | 10 / 11 | 4 / 4 | 0 / 0 | 0.2 / 0.2 |
| enrol.remove | 3 | 6 / 6 | 14 / 14 | 13 / 25 | 7 / 7 | 2 / 2 | 0.1 / 0.1 |
| fac.eligible | 5 | 6 / 7 | 11 / 12 | 27 / 28 | 0 / 1 | 0 / 0 | 1 / 1 |
| facLogins.setDisabled | 2 | 6 / 6 | 13 / 13 | 10 / 10 | 6 / 6 | 1 / 1 | 0.3 / 0.3 |
| group.list | 4 | 6 / 6 | 15 / 15 | 30 / 37 | 0 / 0 | 0 / 0 | 0.9 / 1 |
| push.subscribe | 10 | 6 / 8 | 10 / 12 | 24 / 38 | 2 / 3 | 0 / 0 | 0.1 / 0.1 |
| heads.requests | 4 | 6 / 6 | 9 / 9 | 13 / 14 | 0 / 0 | 0 / 0 | 0.4 / 0.8 |
| identity.serviceToken | 3 | 6 / 6 | 13 / 14 | 22 / 23 | 5 / 6 | 1 / 1 | 0.2 / 0.2 |
| training.attendance | 3 | 6 / 6 | 11 / 11 | 13 / 13 | 3 / 3 | 0 / 0 | 0.1 / 0.1 |
| share.leave | 1 | 6 / 6 | 11 / 11 | 11 / 11 | 3 / 3 | 0 / 0 | 0.1 / 0.1 |
| announcements.report | 5 | 6 / 6 | 9 / 9 | 23 / 23 | 2 / 2 | 1 / 1 | 0.1 / 0.1 |
| auth.login | 314 | 5 / 7 | 12 / 19 | 23 / 40 | 3 / 11 | 1 / 4 | 0.5 / 0.5 |
| profile.get | 21 | 5 / 6 | 8 / 12 | 10 / 29 | 0 / 0 | 0 / 0 | 0.6 / 0.8 |
| devotees.list | 17 | 5 / 6 | 14 / 15 | 25 / 34 | 0 / 1 | 0 / 0 | 1.1 / 2.2 |
| access.get | 6 | 5 / 5 | 8 / 8 | 10 / 11 | 0 / 0 | 0 / 0 | 2.5 / 3.3 |
| facilitators.delete | 1 | 5 / 5 | 11 / 11 | 9 / 9 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| card.unlock | 1 | 5 / 5 | 11 / 11 | 12 / 12 | 3 / 3 | 0 / 0 | 0.1 / 0.1 |
| announcements.create | 36 | 5 / 7 | 12 / 14 | 9 / 25 | 5 / 6 | 1 / 1 | 0.4 / 0.4 |
| stats.batch | 8 | 5 / 6 | 19 / 20 | 30 / 33 | 0 / 1 | 0 / 0 | 1.2 / 1.3 |
| announcements.remove | 4 | 5 / 5 | 12 / 12 | 9 / 9 | 5 / 5 | 1 / 1 | 0.1 / 0.1 |
| announcements.image | 1 | 5 / 5 | 8 / 8 | 12 / 12 | 0 / 0 | 0 / 0 | 0.1 / 0.1 |
| phases.open | 12 | 5 / 7 | 11 / 13 | 8 / 24 | 3 / 4 | 0 / 0 | 0.2 / 0.2 |
| phases.update | 7 | 5 / 7 | 11 / 13 | 9 / 24 | 3 / 4 | 0 / 0 | 0.2 / 0.2 |
| card.get | 25 | 5 / 6 | 17 / 20 | 28 / 41 | 0 / 1 | 0 / 0 | 4.1 / 4.2 |
| members.list | 12 | 5 / 5 | 8 / 8 | 17 / 20 | 0 / 0 | 0 / 0 | 0.5 / 1.2 |
| ids.possibleDuplicates | 6 | 5 / 5 | 8 / 8 | 15 / 16 | 0 / 0 | 0 / 0 | 0.8 / 0.8 |
| fac.devotee | 3 | 5 / 7 | 8 / 10 | 17 / 31 | 0 / 1 | 0 / 0 | 0.2 / 0.4 |
| facLogins.unlink | 1 | 5 / 5 | 11 / 11 | 9 / 9 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| journals.get | 18 | 5 / 8 | 11 / 14 | 581 / 1227 | 0 / 0 | 0 / 0 | 92.7 / 223.4 |
| requests.reject | 2 | 5 / 5 | 11 / 11 | 9 / 9 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| auth.sessionEnd | 1 | 5 / 5 | 10 / 10 | 9 / 9 | 3 / 3 | 0 / 0 | 0.1 / 0.1 |
| auth.logoutAll | 3 | 5 / 5 | 11 / 11 | 10 / 10 | 5 / 6 | 0 / 0 | 0.1 / 0.1 |
| reopen.reject | 1 | 5 / 5 | 11 / 11 | 9 / 9 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| auth.changePassword | 9 | 5 / 5 | 12 / 12 | 23 / 23 | 4 / 5 | 1 / 1 | 0.1 / 0.1 |
| stats.all | 6 | 5 / 6 | 16 / 17 | 33 / 33 | 0 / 1 | 0 / 0 | 4.4 / 4.4 |
| heads.withdraw | 1 | 5 / 5 | 11 / 11 | 9 / 9 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| devotees.promoteOptions | 2 | 5 / 5 | 8 / 8 | 13 / 13 | 0 / 0 | 0 / 0 | 0.6 / 0.6 |
| auth.requestReset | 21 | 5 / 5 | 7 / 7 | 2 / 2 | 4 / 6 | 1 / 2 | 0.1 / 0.1 |
| share.remove | 1 | 5 / 5 | 10 / 10 | 10 / 10 | 3 / 3 | 0 / 0 | 0.1 / 0.1 |
| books.setCurrent | 5 | 5 / 7 | 8 / 10 | 11 / 12 | 2 / 2 | 1 / 1 | 0.1 / 0.1 |
| phases.close | 2 | 5 / 5 | 11 / 11 | 9 / 9 | 3 / 3 | 0 / 0 | 0.1 / 0.1 |
| share.lookup | 4 | 5 / 7 | 10 / 12 | 13 / 27 | 1 / 2 | 0 / 0 | 0.1 / 0.1 |
| auth.me | 913 | 4 / 5 | 7 / 8 | 22 / 40 | 0 / 1 | 0 / 0 | 0.5 / 0.5 |
| board.list | 11 | 4 / 5 | 7 / 8 | 24 / 29 | 0 / 0 | 0 / 0 | 0.2 / 0.3 |
| audit.list | 10 | 4 / 4 | 7 / 7 | 11 / 14 | 0 / 0 | 0 / 0 | 0.3 / 0.8 |
| requests.list | 18 | 4 / 7 | 7 / 10 | 10 / 16 | 0 / 0 | 0 / 0 | 0.2 / 2.2 |
| ids.appList | 3 | 4 / 4 | 7 / 7 | 13 / 19 | 0 / 0 | 0 / 0 | 1.2 / 2.5 |
| meta.get | 26 | 4 / 6 | 4 / 9 | 66 / 70 | 0 / 1 | 0 / 0 | 1.9 / 2.6 |
| enrol.list | 3 | 4 / 4 | 7 / 7 | 11 / 24 | 0 / 0 | 0 / 0 | 0.1 / 0.3 |
| photo.upload | 2 | 4 / 4 | 10 / 10 | 9 / 9 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| photo.remove | 1 | 4 / 4 | 10 / 10 | 9 / 9 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| ids.reviewDuplicate | 2 | 4 / 4 | 10 / 10 | 8 / 8 | 4 / 4 | 1 / 1 | 0.1 / 0.1 |
| settings.get | 54 | 4 / 5 | 7 / 8 | 23 / 25 | 0 / 1 | 0 / 0 | 0.3 / 0.6 |
| eligible.list | 9 | 4 / 4 | 10 / 10 | 11 / 21 | 0 / 0 | 0 / 0 | 1.2 / 3.3 |
| facilitators.orphans | 6 | 4 / 4 | 7 / 7 | 52 / 56 | 0 / 0 | 0 / 0 | 1.1 / 1.4 |
| rules.get | 16 | 4 / 6 | 7 / 9 | 41 / 42 | 0 / 0 | 0 / 0 | 2.7 / 6.4 |
| leaders.list | 7 | 4 / 4 | 13 / 13 | 11 / 14 | 0 / 0 | 0 / 0 | 0.9 / 2 |
| identity.mintBatch | 6 | 4 / 11 | 7 / 18 | 8 / 13 | 0 / 10 | 0 / 5 | 0.2 / 0.4 |
| leaderboard.get | 15 | 4 / 5 | 7 / 8 | 26 / 28 | 0 / 1 | 0 / 0 | 0.6 / 0.7 |
| leaderboard.mine | 4 | 4 / 4 | 7 / 7 | 27 / 28 | 0 / 0 | 0 / 0 | 0.1 / 0.1 |
| enrol.search | 7 | 4 / 4 | 7 / 7 | 13 / 13 | 0 / 0 | 0 / 0 | 0.1 / 0.1 |
| admin.lists | 2 | 4 / 4 | 7 / 7 | 12 / 12 | 0 / 0 | 0 / 0 | 1.7 / 1.7 |
| registry.search | 1 | 4 / 4 | 7 / 7 | 12 / 12 | 0 / 0 | 0 / 0 | 0.4 / 0.4 |
| ids.search | 1 | 4 / 4 | 7 / 7 | 13 / 13 | 0 / 0 | 0 / 0 | 0.3 / 0.3 |
| push.register | 6 | 4 / 4 | 4 / 4 | 14 / 14 | 2 / 2 | 0 / 0 | 0.1 / 0.1 |
| push.detach | 6 | 4 / 6 | 8 / 10 | 9 / 23 | 1 / 3 | 0 / 0 | 0.1 / 0.1 |
| vitals.report | 5 | 4 / 6 | 7 / 9 | 9 / 23 | 2 / 3 | 0 / 0 | 0.1 / 0.1 |
| analysis.get | 5 | 3 / 5 | 8 / 11 | 11 / 25 | 0 / 1 | 0 / 0 | 1.1 / 1.4 |
| ids.nextApp | 4 | 3 / 3 | 6 / 6 | 9 / 9 | 0 / 0 | 0 / 0 | 0.1 / 0.1 |
| batchReq.list | 9 | 3 / 4 | 6 / 7 | 9 / 14 | 0 / 0 | 0 / 0 | 0.4 / 1.6 |
| birthdays.today | 6 | 3 / 5 | 6 / 8 | 11 / 27 | 0 / 1 | 0 / 0 | 0.3 / 0.4 |
| photo.get | 3 | 3 / 5 | 6 / 8 | 10 / 11 | 0 / 0 | 0 / 0 | 0.2 / 0.2 |
| reopen.list | 8 | 3 / 5 | 6 / 8 | 9 / 24 | 0 / 1 | 0 / 0 | 0.2 / 0.2 |
| batches.list | 6 | 3 / 5 | 6 / 8 | 10 / 24 | 0 / 1 | 0 / 0 | 1.7 / 1.7 |
| criteria.get | 4 | 3 / 3 | 7 / 7 | 9 / 11 | 0 / 0 | 0 / 0 | 0.4 / 0.4 |
| facLogins.list | 3 | 3 / 3 | 6 / 6 | 9 / 10 | 0 / 0 | 0 / 0 | 0.3 / 0.5 |
| coordinators.list | 4 | 3 / 3 | 6 / 6 | 10 / 12 | 0 / 0 | 0 / 0 | 0.3 / 0.4 |
| access.list | 2 | 3 / 3 | 6 / 6 | 11 / 11 | 0 / 0 | 0 / 0 | 2.1 / 2.1 |
| access.search | 1 | 3 / 3 | 6 / 6 | 9 / 9 | 0 / 0 | 0 / 0 | 0.4 / 0.4 |
| auth.logout | 1 | 3 / 3 | 6 / 6 | 8 / 8 | 1 / 1 | 0 / 0 | 0.1 / 0.1 |
| auth.sessions | 6 | 3 / 3 | 6 / 6 | 10 / 13 | 0 / 0 | 0 / 0 | 0.4 / 0.6 |
| announcements.reports | 4 | 3 / 5 | 6 / 8 | 8 / 12 | 0 / 0 | 0 / 0 | 0.1 / 0.7 |
| runlog.list | 3 | 3 / 3 | 6 / 6 | 8 / 8 | 0 / 0 | 0 / 0 | 0.1 / 0.1 |
| activity.stats | 5 | 3 / 5 | 8 / 10 | 10 / 29 | 0 / 1 | 0 / 0 | 1.4 / 2.1 |
| share.list | 13 | 3 / 5 | 7 / 9 | 10 / 23 | 0 / 1 | 0 / 0 | 0.2 / 0.3 |
| mutes.list | 7 | 3 / 4 | 6 / 7 | 9 / 10 | 0 / 0 | 0 / 0 | 0.1 / 0.2 |
| activity.notices | 4 | 3 / 3 | 6 / 6 | 10 / 11 | 0 / 0 | 0 / 0 | 0.4 / 0.6 |
| phases.list | 7 | 3 / 3 | 6 / 6 | 9 / 10 | 0 / 0 | 0 / 0 | 0.1 / 0.3 |
| push.unsubscribe | 7 | 3 / 3 | 3 / 3 | 0 / 0 | 1 / 2 | 0 / 0 | 0.1 / 0.1 |
| push.renew | 5 | 3 / 3 | 3 / 4 | 14 / 15 | 1 / 2 | 0 / 0 | 0.1 / 0.1 |
| books.chapters | 3 | 3 / 3 | 7 / 7 | 29 / 105 | 0 / 0 | 0 / 0 | 2.6 / 13.3 |
| history.list | 8 | 3 / 5 | 6 / 8 | 10 / 24 | 0 / 1 | 0 / 0 | 0.2 / 0.2 |
| exports.catalog | 7 | 2 / 4 | 5 / 7 | 8 / 22 | 0 / 1 | 0 / 0 | 6.6 / 7 |
| push.message | 18 | 1 / 3 | 1 / 3 | 1 / 16 | 0 / 1 | 0 / 0 | 0.2 / 0.3 |
| auth.lookup | 13 | 1 / 3 | 1 / 3 | 1 / 2 | 0 / 0 | 0 / 0 | 0.1 / 0.2 |

Never called successfully by any suite: `groupLeaders.set` (retired; it should be refused) and the test probe `nope.nothing`.
