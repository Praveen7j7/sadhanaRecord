# Architecture Decision Records — Sadhana Record

One file per significant decision. **Accepted** records describe what the code already does and why; **proposed**
records are recommendations from the 12 October 2026 audit and bind nothing until management agrees.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-single-post-endpoint.md) | One POST endpoint with named actions, HTTP 200 envelope | accepted (kept) |
| [0002](0002-d1-record-sheets-copy.md) | D1 is the record; Google Sheets are a trigger-driven copy | accepted |
| [0003](0003-no-foreign-keys-additive-migrations.md) | No foreign keys; additive-only migrations; integrity in code | accepted, risk documented |
| [0004](0004-scores-computed-once.md) | Scores are computed once at submit and never recomputed | accepted |
| [0005](0005-derived-roles-coarse-gate.md) | Roles derived per request; coarse route gate + handler narrowing | accepted; invariant test required |
| [0006](0006-lmp-role-protected-area.md) | LMP is a role-protected area with its own shell and tables, in this app | proposed |
| [0007](0007-version-control-first.md) | Put the tree under git before structural work | proposed |
| [0008](0008-no-repository-layer.md) | Keep direct SQL in modules; add query helpers only where repeated | proposed |
| [0009](0009-vedic-levels-tracks-and-intakes.md) | One batch table, a `tracks` column, an intake per run | accepted |
| [0010](0010-temporary-facilitation-etp-ftp.md) | ETP grants a TEMPORARY facilitation role; FTP grants the real one | accepted |
| [0011](0011-who-may-delete-accounts.md) | Class coordinators may delete their own devotees; training coordinators never | accepted |
| [0012](0012-facilitation-card-cadence-and-scoring.md) | The card: 7 weekly + 4 monthly measures, grouped; month scorecard; rank on seva + goal | accepted |
| [0013](0013-sadhana-leaderboard.md) | A sadhana leaderboard: weekly and above (no daily); windows and scope by role | accepted |
| [0014](0014-facilitator-lifecycle.md) | Facilitator rename with cascade; ETP facilitators; a leaving facilitator's students go to the head as a decision | accepted |
| [0015](0015-staff-permission-management.md) | Permissions per person (any devotee or staff): give and take, enforced in the one gate at no extra round trip | accepted |
| [0016](0016-scoreboard-visibility-and-detail.md) | Head and training coordinator see whole boards; facilitator and trainee see their own place; a row opens the real card, read-only | accepted |
| [0017](0017-admin-wiring.md) | Built-but-unwired head settings get Admin screens before the release: phases (add, edit, close), promotion criteria, card unlock, and the rest | accepted |
| [0018](0018-targets-fixed-at-phase-start.md) | Targets are set at the start of a phase, then fixed; a never-set target may still be set; the head opens one person's for 7 days | accepted |
| [0019](0019-access-by-assignment.md) | Access by assignment: one screen gives a role (batch or facilitator) with chosen rights; revoking takes exactly that; the menu follows the rights | accepted |

Format: Context · Decision · Consequences · Evidence (file paths). Keep each under a page.
