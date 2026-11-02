# ADR 0003 — No foreign keys; additive-only migrations; integrity enforced in code

**Status:** accepted (documented risk)

## Context
Across 40 migrations there is one `REFERENCES` clause. D1 supports foreign keys, but adding them to existing tables
means table rebuilds, and the code deletes rows in a fixed order already (`erase.js`, `coord.accountDelete`).

## Decision
Relationships stay conventional (`login`, `batch_id`, `week_id`, `person_id` columns) and are enforced by the code
that writes them. Migrations are additive: new tables, `ALTER TABLE … ADD COLUMN`, new indexes, new triggers. No
column is dropped or renamed while any deployed code reads it. Each migration is a new numbered file; `0040` was
skipped and stays skipped.

## Consequences
- Orphans are possible after a partial delete. The audit lists which tables `erase.js` cleans and which it does not
  (`FULL_AUDIT_2026-10-12.md` §5). An orphan sweep belongs in the retention job, not in a constraint.
- Uniqueness **is** enforced by the schema (`PRIMARY KEY`, `UNIQUE`); check-then-insert races rely on it.
- New LMP tables should be created **with** their constraints (`UNIQUE(enrollment_id, criterion_id, evaluator)` etc.)
  — additive tables can carry constraints even though old ones cannot easily gain them.
- Rollback of the Worker never needs a down-migration: the previous code ignores the new columns.
