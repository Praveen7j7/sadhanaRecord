# ADR 0002 — D1 is the record; Google Sheets are a trigger-driven copy

**Status:** accepted (2 Oct 2026, when the Worker replaced Apps Script)

## Context
Coordinators and the facilitator dashboard work in Google Sheets. The first server wrote the sheets directly and
read them back; that was slow and racy.

## Decision
D1 holds every table. SQLite triggers write one `mirror_log` row per changed row (migration 0018); a minutely job
copies at most 300 rows a run to the store sheets (`worker/src/mirror.js`); reference lists use a dirty counter
(`db.dirty()`); four batch view sheets are rebuilt one per run when changed (`views.js`). Nothing is read back from
the store sheets. The only inbound read is the dashboard's Devotees tab (IYF IDs), every 30 minutes (`registry.js`).

## Consequences
- A hand edit in a store sheet is overwritten. Say so in the sheet header (it is).
- Every new table that coordinators must see needs: a `mirrorkeys.js` entry, triggers in its migration, and a tab in
  `setup/schema.mjs`. The LMP tables will need all three.
- The copy is at-least-once with a key; see `INTEGRATIONS.md` for the exact guarantees and the backlog arithmetic.
- Deleting a devotee must also erase the append-only tabs (`erase.js`).
