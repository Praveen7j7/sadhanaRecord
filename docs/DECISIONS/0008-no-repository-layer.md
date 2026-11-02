# ADR 0008 — Keep direct SQL in the modules; add query helpers only where a query is repeated

**Status:** proposed

## Context
The brief asks whether repositories, domain services or query modules are needed. The server has 33 modules,
each owning its tables, with four helpers (`q/one/all/run`) and a per-request memo in `db.js`. SQL is parameterised
throughout; the plan audit (`npm run audit:sql`) checks every statement for full scans.

## Decision
No repository layer. Three smaller moves instead:
1. Split `coord.js` (871 lines) by responsibility (profile/photo, staff tools, stats, oversight) — same SQL, smaller files.
2. Move the handful of queries that appear in more than one module (open membership, batch devotee list, week row)
   into `db.js` as named helpers, next to the ones already there.
3. Keep business rules in the module that owns the table, and keep `api.js` free of them (it already is).

## Consequences
- A newcomer finds a table's SQL by grepping the table name in one or two modules, as today.
- Tests stay integration tests on SQLite (`worker/tests/harness.mjs`), which is where the value is.
- LMP gets `program.js` (rules + SQL) and nothing else new in the backend's shape.
