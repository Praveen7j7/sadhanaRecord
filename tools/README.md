# Tools (kept so nothing has to be fetched or rebuilt again)

Each folder has a matching project skill in `../../.claude/skills/` (Claude Code loads them by itself in this repo).

| Folder | Tool | Run |
|---|---|---|
| `browser/` | `verify.mjs`: 1,240 browser checks, every screen and role, 10 widths, against the mock API on a vite dev server (port 5199) | `cd frontend && npx vite --port 5199 &` then `node ../tools/browser/verify.mjs [part]` (skill `sadhana-browser-checks`) |
| `browser/` | `offline-logo.mjs` (live app offline, emblem still shows), `probe-drawer.mjs` (side menu fits at 360 px), `shoot.mjs` (screenshots) | `node tools/browser/<file>` |
| `docs/` | `md2html.py` + `html2pdf.mjs`: Markdown to a branded A4 PDF; `page-preview.mjs`: PNG strips of the print layout | skill `sadhana-docs-pdf` |
| `brand/` | `upscale.sh` (Real-ESRGAN 4× AI upscale, offline), `emblem-cut.py`, `icons-emblem.mjs`, `og-render.mjs` | skill `sadhana-brand-logo` |
| `brand/esr/` | The Real-ESRGAN program for macOS and its models (66 MB, **not in git**). If missing: download `realesrgan-ncnn-vulkan-20220424-macos.zip` from github.com/xinntao/Real-ESRGAN releases (v0.2.5.0) and put the program and `models/realesrgan-x4plus*` here | — |
| `perf/` | `lighthouse.sh` (low-end phone check, uses frontend's local lighthouse), `viewcpu.mjs` (view-sheet build time at N devotees), `sqltrace.mjs` (SQL statements per call) | `sh tools/perf/lighthouse.sh` · `node tools/perf/viewcpu.mjs 1650` |
| `sheets/` | `sync-audit.mjs`: live, read-only, every copied table, database vs sheet | `node tools/sheets/sync-audit.mjs` (skill `sadhana-sheets-copy`) |

Related: `../loadtest/` (separate test server, skill `sadhana-load-test`), `../worker/tests/query-plans.mjs` and `write-audit.mjs` (skill `sadhana-free-plan`).
