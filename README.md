# Sadhana Record

The devotee sadhana app: devotees submit their own weekly sadhana, batch coordinators approve and follow their batch, the master manages coordinators and IYF IDs. Separate from the facilitator dashboard (`../faciliatorDashboard`), which it feeds through the existing sadhana sheet → Raw chain.

| Folder | Holds |
|---|---|
| `docs/` | `sadhana-app-design.md` (design, decisions 1–40), `sadhana-api-contract.md` (API contract v1), `stakeholder-brief`, `load-test-report`, `backup-restore`, `development-history` (each also as PDF), `go-live-checklist.md`, `sadhana-entry-sheet-plan.*` (the superseded 26 Sep plan) |
| `tools/` | Browser checks, Markdown→PDF, logo tools (offline AI upscaler), performance and Sheets-sync audits — see `tools/README.md`; matching Claude Code skills in `../.claude/skills/sadhana-*` |
| `loadtest/` | The load test on a separate Worker + database (never live): seed, ramp, conflicts, Sunday submit, deadline — `loadtest/README.md` |
| `brand/` | The official IYF Delhi logo and emblem at full resolution, icons, share image — `brand/README.md` |
| `shared/` | `scoring.js`: the card scoring used by both the server and the app (live marks), so they always agree |
| `setup/` | `schema.mjs` (every tab and column), `build-store.mjs` (builds a file from the schema with the build service account; `check` first), `files.json` (file ids), `extract-cards.py` and `extract-journals.py` (read the Excel cards and journals from ~/Downloads into `data/`), `build-rules-sql.mjs` (makes the rules migration) |
| `worker/` | **The server**: Cloudflare Worker + D1, live at https://sadhana-record-api.iyfdelhi-sadhana.workers.dev. `npm test`, `npx wrangler deploy`. Steps in `worker/README.md` |
| `backend/` | The retired Apps Script server (Phase 1, replaced by `worker/` on 2 Oct 2026); kept for reference |
| `frontend/` | Svelte 5 PWA, live at https://sadhana-record.iyfdelhi-sadhana.workers.dev (`npx wrangler deploy` after build): Phase 1 screens. `npm test`, `npm run build`, `npm run size` (budget 60 KB JS). Runs offline against a mock when `VITE_API_URL` is unset |

## Documentation for developers (12 Oct 2026 audit)

Start with `docs/FULL_AUDIT_2026-10-12.md` (the map and the verdict), then `docs/ARCHITECTURE.md` and
`docs/PROJECT_STRUCTURE.md`. The rest of the set: `DATABASE.md`, `DATA_DICTIONARY.md`, `API_REFERENCE.md`,
`AUTHORIZATION.md` (each with review notes appended), `FRONTEND_GUIDE.md`, `INTEGRATIONS.md`, `OPERATIONS.md`,
`TESTING.md`, `PERFORMANCE.md`, `USER_FLOWS.md`, `DEFECTS_VERIFIED.md`, `LMP_ARCHITECTURE.md`,
`IMPLEMENTATION_ROADMAP.md`, `DECISIONS/`. Note: this tree is not under version control yet (roadmap phase 0).
