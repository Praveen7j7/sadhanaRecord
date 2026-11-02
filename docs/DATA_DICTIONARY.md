# Data dictionary — Sadhana Record

**Generated from `worker/migrations/*.sql` and `worker/src/*.js` on 12 October 2026.** Column-by-column tables are
in `docs/DATABASE.md`; this document covers what those columns *mean* — the values they may hold, the states they
move through, and the rules that are not visible in a schema.

Read this before adding a column to `profiles` (27 added so far) or `accounts` (14).

## The identity model

Three things that look like one and are deliberately separate (migration 0038):

| Concept | Table | Lasts |
|---|---|---|
| **A person** | `persons` | for ever; never renumbered, never deleted |
| **An identifier** | `person_identifiers` | for ever; superseded, never reused |
| **A name** | `person_names` | many per person; one is current |

A person may hold several IYF IDs over a lifetime — an old dashboard `KT26-0042`, a new `IYFD-2019-0044`. The old
one is marked `superseded` and still resolves, so a ten-year-old sheet keeps working. **Correcting an ID means
issuing a new one and superseding the old; it never means editing the old one.**

`accounts.iyf_id` is the app's cached copy of the current identifier. `person_links` joins a person to an account
in a named service (`sadhana`, and later others).

### The IYF ID

`IYFD-<year>-<seq>` — e.g. `IYFD-2019-0044`. The year is the year the person **connected with IYF Delhi**, not the
year the ID was issued. `%04d` is a minimum width, so a year passing 9999 produces a 5-digit sequence and nothing
breaks.

**No year of connection, no ID.** A devotee whose year is unknown is registered, listed and promotable with an
empty ID; it is minted when they sign up or when a course registration supplies the year. 493 people were in this
state at the 11 Oct import.

## State machines

### Account status — `accounts.status`

`PENDING` → `ACTIVE` → `INACTIVE` / `DISABLED`, or `PENDING` → `REJECTED`.

| Value | Can sign in | Keeps scopes |
|---|---|---|
| `PENDING` | no — "waiting for your coordinator" | — |
| `ACTIVE` | yes | yes |
| `INACTIVE` | yes | **no** — `groupLeader` and `facilitator` both require `ACTIVE` |
| `DISABLED` | no | no |
| `REJECTED` | no | — |

`INACTIVE` is the important one: the person keeps their account and history but silently loses every derived
permission.

### Account role — `accounts.role`

`DEVOTEE` · `COORDINATOR` · `MASTER` (CHECK-constrained). **Changing it ends every open session of that login** —
`sessionCtx()` compares the session's stored role with the account's and ends the session when they differ.

A facilitator is *not* a role: it is `accounts.facilitator_name` on a `COORDINATOR` row. A group leader is *not* a
role: it is a row in `leaders` belonging to a `DEVOTEE`.

### Week status — computed, not stored

`NOT_STARTED` → `DRAFT` → `SUBMITTED`, or → `MISSED`; `SUBMITTED` → `REOPENED` → `SUBMITTED`.

| Value | Means |
|---|---|
| `NOT_STARTED` | no draft row |
| `DRAFT` | being filled; `drafts` holds the days |
| `SUBMITTED` | a row in `submissions`; **the score is final and never recomputed** |
| `REOPENED` | a head reopened it; fillable again |
| `MISSED` | the deadline passed with no complete day; score 0 |

**The scoring moment is `week.submit`.** Everything afterwards reads `submissions`, so changing a score card later
never rewrites history. A part week counts its complete days (÷175 cap, decision 45).

### Sign-up approval — `accounts.signup_state`

`PENDING` → `APPROVED` / `REJECTED`. Blank for accounts created before 11 Oct 2026.

### IYF identifier state — `person_identifiers.state`

`current` → `superseded` (a correction) or `retired` (a merge). Never deleted.

### Head appointment — `head_requests.state`

`OPEN` → `DONE` / `REJECTED` / `WITHDRAWN` / `EXPIRED`. A new head needs **every other active head's approval**;
with no other heads it takes effect at once.

### Other enumerations

| Column | Values |
|---|---|
| `attendance.mark_used` | `P` present · `A` absent · `L` late (P = 100 in scoring) |
| `class_weeks.kind` | `HOLIDAY` · `FESTIVAL` · `OTHER` |
| `class_weeks.mode` | `ALL_PRESENT` · `MARKED` |
| `person_names.kind` | `given` · `initiated` · `spelling_variant` |
| `post_reports.reason` | `spam` · `abusive` · `inappropriate` · `other` |
| `post_reports.state` | `OPEN` · `DISMISSED` · `REMOVED` |
| `reopen_requests.state` | `PENDING` · `DONE` · `REJECTED` |
| `duplicate_reviews.decision` | `NOT_DUPLICATE` (the only value: a confirmed duplicate is merged, not recorded) |
| `facilitators.state` | `ACTIVE` · `RETIRED` |

## Conventions that hold everywhere

- **No `NULL` in text columns.** Almost every column is `NOT NULL DEFAULT ''`. Absence is the empty string. This is
  what makes additive migrations safe against old code.
- **Times are ISO strings in IST**, `2026-10-12T07:14:00+05:30`, via `isoIst()`. Not epoch numbers.
- **A week is identified by its Monday**, `week_id = '2026-10-05'`. Days are dates inside it.
- **`login` is the identity everywhere** — a 10-digit phone for a devotee, a username for staff.
- **Soft rather than hard deletion.** Statuses and `merged_into`/`superseded_by` columns; rows survive.
- **`dirty(...)` on a write** appends to `mirror_log` so the row is copied to Google Sheets within about a minute.
- **`mirror_switch`** (one row, migration 0075): the Sheets copy switch every mirror trigger reads. `off` while
  `SHEETS_COPY` is off, so a change writes no `mirror_log` row; the schedule keeps it equal to `SHEETS_COPY`, and
  switching it on starts a full re-copy of every tab in the same batch (`docs/INTEGRATIONS.md` › Resuming the copy).
  Never set it by hand: an `on` without the re-copy would leave the sheets missing what changed while it was off.

## Where a new developer goes wrong

1. **Adding a 28th column to `profiles`** instead of a related table. Ask whether it describes the person or a
   thing the person has.
2. **Assuming a name is stable.** It is not: `person_names` is a list, and an initiated name *attaches*, it does
   not replace.
3. **Recomputing a submitted score.** Read `submissions`. Recomputing silently rewrites history when a card changes.
4. **Writing `NULL`.** Use `''`.
5. **Forgetting `dirty(...)`** on a new write — the row never reaches the coordinators' sheet, and nothing fails.

---

## Review notes — 12 October 2026 (second pass)

Corrections found by reading the code behind each statement:

1. **`INACTIVE` "can sign in: yes" is wrong.** `auth.login` throws `ACCOUNT_DISABLED` for INACTIVE (`auth.js:216`) and
   `sessionCtx` ends any session whose account is not ACTIVE (`session.js:20-22`).
2. **`accounts.signup_state` and its `PENDING → APPROVED/REJECTED` machine are never written or read.** The real state
   is `accounts.status`.
3. **`person_identifiers.state = 'retired'`** has no producer; no merge operation exists (`persons.merged_into` is only
   read, `auth.js:68`).
4. **`attendance.mark_used`** is only ever `P`, `A` or `''`; `L` (late) and `exports.js:23`'s `N` are never written.
5. **`facilitators.state ACTIVE/RETIRED`** is not a column; `facilitators` has `active` and `deleted_at`
   (`0006:2`, `0017:5-10`). `ACTIVE/RETIRED` is `app_ids.state` (`0034:17`).
6. **"`dirty()` appends to `mirror_log`"** is wrong: `dirty()` bumps `mirror_state.dirty` for six reference tables and
   is a no-op otherwise (`db.js:37-41`); keyed tables reach the Sheets through **triggers**. What silently skips the
   sheet is a new table without a `KEYED` entry and a trigger migration.
7. **"Times are ISO strings in IST, not epoch"** has exceptions: `replies.at` and `counters.expires` are epoch ms;
   `mirror_state.synced_at`, `settings.changed_at` for `registry_sig` and `accounts.updated_at` written by
   `followMerges` (`registry.js:102,108`) are UTC `Z`. String comparison across the two formats mis-orders by 5 h 30.
8. **"No NULL in text columns"** has exceptions: `accounts.iyf_id` (on purpose, for the partial unique index),
   `registry.merged_into`, `drafts.d1…d7`, `drafts.week_end`, `books.words`.
9. **"Soft rather than hard deletion"**: `erase.js:76` hard-deletes eight tables and `:91` the account.
10. **`accounts.iyf_id`** holds dashboard ids (`KT/GP/JN`), app ids (`SR`) *and* identity ids (`IYFD`); only `IYFD` ids
    are ever recorded in `person_identifiers`, so "old IDs resolve forever" is not yet true for the other series.
11. `person_history.kind = 'email'` (`coord.js:675`) is outside the kinds enumerated at `0038:110`.

---

## Columns and tables with no reader — verified 13 October 2026 (roadmap 2.10)

Re-checked by grepping `worker/src` and `frontend/src`. **Nothing is dropped**: SQLite cannot drop a column without
rebuilding the table, old code must keep working on the new schema (ADR 0003), and several of these are copied to
the Sheets tabs, where a missing column would shift the whole row. They are recorded here so nobody reads meaning
into them, and so the next person knows what is safe to reuse.

| Table / column | State | Note |
|---|---|---|
| `accounts.signup_state`, `signup_at`, `approved_by`, `approved_at`, `phone_changed_from`, `requested_group_leader` | **never written, never read** | the real sign-up state is `accounts.status`; approval is recorded in `decided_at` / `decided_by` and in `audit_log`. The dictionary's `signup_state` state machine above describes something that does not run. |
| `profiles` — 12 of the columns added in 0038, plus `photo_file_id` and `person_id` | never written | added ahead of a feature; `profiles.person_id` in particular: LMP must join through `person_links`, not through this column (see `LMP_ARCHITECTURE.md` review notes) |
| `memberships.group_leader` | never read | the group leader lives in `leaders` (0023, decision 41) and `memberships.leader_login` |
| `batches.view_sheet_id` | never touched | the view sheets are addressed from `setup/files.json` |
| `submissions.bridged_at` | never touched | reserved for the deferred bridge (phase 5 of the modernization audit) |
| `mirror_state.cursor` | written by migrations only | the copy's position is `last_id` |
| `group_leaders` (whole table) | **no reader, no writer, not copied to Sheets** | replaced by `leaders` in 0023. `DATABASE.md`'s claim that it is still copied was wrong and is corrected in its review notes. |
| `card_ranges`, `seva_rules` (whole tables) | **copied to Sheets, never read by the app** | the two score cards are hard-coded in `worker/src/cards.js:31`; these tables exist so coordinators can see the rules in the Rules sheet. `seva_rules` also has no primary key. Changing a value here changes nothing in the app. |
| indexes `accounts_signup_pending`, `profiles_person` | serve no query | they index columns nothing reads |
| `person_identifiers.state = 'retired'`, `persons.merged_into` | enumerated, never produced | no merge operation exists; roadmap 3.9 proposes one |
| `attendance.mark_used = 'L'`, `exports.js`'s `N` | never written | only `P`, `A` and `''` occur |
| `reminder_progress` shard 2 | seeded, never claimed | `push.js` uses shards 0 and 1 |

**If you need one of these columns for something new:** do not repurpose it. Add a column with the name you mean
(additive migration, `NOT NULL DEFAULT`), add it to `setup/schema.mjs` *before* the migration if the table is
copied, and leave the dead one alone. Reusing a name that once meant something else is how a Sheets column ends up
holding two different things in different rows.
