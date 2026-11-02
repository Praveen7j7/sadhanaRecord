# ADR 0006 — The Leaders Management Portal is a role-protected area with its own shell and tables, inside this app

**Status:** proposed (12 Oct 2026; design in `docs/LMP_ARCHITECTURE.md`)

## Context
LMP (MTP, ETP, iLS programs: batches, enrolments, assessments, final reports) needs the same people, sign-in,
Sheets copy and audit trail as sadhana, and must not clutter the daily form.

## Options weighed
| Option | Deployment | Auth boundary | UX | Verdict |
|---|---|---|---|---|
| Separate app + shared backend | 2nd static Worker, 2nd SW, 2nd origin in CORS | same tokens across origins | second sign-in | no |
| Separate shell in the same frontend | one deploy | one session | own navigation, own chunks | **yes (adopted)** |
| Section in the current app | one deploy | one session | mixed with sadhana menus | partly: the grants model, not the screens |
| Microservice | 3rd Worker + DB | new auth | — | no evidence for it |

## Decision
Same frontend build, routes under `#/lmp/…`, lazy chunks named `lmp-*` excluded from the devotee precache like
`staff-*`; same API Worker with `program.*` actions; same D1 with new additive tables; authorization by a
`program_grants` table checked beside the existing scopes, never by organisational role alone.

## Consequences
- No new infrastructure, secrets or CORS entries. One release gate.
- The route table grows (~20 actions); the per-action authorization test (ADR 0005) must cover them from day one.
- Final reports store their own arithmetic (ADR 0004 applied); program versions are immutable once published.
- Decisions management must take are listed in `LMP_ARCHITECTURE.md` §9 and `FULL_AUDIT_2026-10-12.md` §18.
