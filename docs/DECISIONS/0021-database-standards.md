# ADR 0021 — Database standards: every new table and column, from migration 0074 on

**Status:** accepted 27 Oct 2026 (the head: "not only foreign keys but the best practices and all"). Narrows ADR 0003:
old tables keep their shape (a foreign key or CHECK cannot be added to an existing SQLite table without rebuilding it,
which is not done on live data inside a feature release); everything new follows the rules below, and a test
(`worker/tests/schema-standards.test.mjs`) fails the build if a migration from 0074 on breaks one.

## The rules

| # | Rule | Why |
|---|---|---|
| 1 | **One fact, one place.** A name, a total, an ID number is stored on the row it belongs to; everything else points to that row by its key and reads it. A copy is allowed only as a deliberate cache or a historical snapshot, and its comment says which and who refreshes it | a rename or a correction is one change; nothing drifts (docs/NAMES_ONE_SOURCE_2026-10-27.md) |
| 2 | **Keys are permanent and meaningless.** A key never changes and is never reused; a name, phone or label is never a key | names and phones change; keys must not |
| 3 | **Every table has a primary key**; natural uniqueness (one row per person per week, etc.) is a `UNIQUE` constraint, not a check in code | the database refuses duplicates, even in a race |
| 4 | **Every link is a real foreign key** (`REFERENCES parent(key)`), declared with the table or the added column. "No link" is `NULL`, never `''`. No `ON DELETE CASCADE` on people's data: deletes are soft or explicit (erase.js) | a reference can never point to nothing |
| 5 | **Every foreign key column is the first column of an index** | the parent's deletes and the joins stay fast; the query-plan audit expects it |
| 6 | **Closed sets are checked**: a status, role, kind or type column carries `CHECK (col IN (…))`; numbers with a range carry `CHECK` | a typo cannot become data |
| 7 | **Required means `NOT NULL`**, with a default only when the default is a true value (not a placeholder) | an empty field is a decision, not an accident |
| 8 | **Dates are ISO text** (`YYYY-MM-DD`, IST timestamps `YYYY-MM-DDTHH:MM:SS+05:30` as `isoIst()` writes) and week ids keep their one format | text sorts and compares correctly in SQLite |
| 9 | **Who and when**: rows people change carry `updated_at` / `updated_by` (or `created_*`); changes that matter also write `audit_log` | every change can be traced |
| 10 | **Migrations stay additive and safe on live data**: new tables, added columns, new indexes, backfills keyed by primary key; nothing dropped or renamed while deployed code reads it; `PRAGMA defer_foreign_keys` when a backfill must order around a foreign key | the previous Worker keeps working; rollback never needs a down-migration |
| 11 | **Growth is bounded**: a log-like table names its retention in the nightly job when it is created | the free plan's storage and row budgets |
| 12 | **Integrity is checked, not assumed**: the nightly job and a test look for orphans and out-of-set values in the old tables that cannot carry constraints | ADR 0003's documented risk, now measured |

## Exceptions

A rule may be broken only with a reason written in the migration and listed in the test's allow-list
(`ALLOW` in `schema-standards.test.mjs`) — for example a column that holds a week code, which is a value, not a link.
