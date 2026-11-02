# Operations — Sadhana Record

**12 October 2026.** Environments, configuration, secrets, deploy, migrations, rollback, logs. Verified against
`worker/wrangler.toml`, `frontend/wrangler.jsonc`, `worker/package.json`, `frontend/scripts/release.mjs`,
`tools/release/gate.mjs` and the existing runbooks (`backup-restore.md`, `phase-gates.md`,
`../.claude/skills/sadhana-release/SKILL.md`). Nothing here was executed against production to write it.

## 1. Environments

| Name | What | Where | Data |
|---|---|---|---|
| **live app** | static assets Worker `sadhana-record` | https://sadhana-record.iyfdelhi-sadhana.workers.dev | — |
| **live API** | Worker `sadhana-record-api` | https://sadhana-record-api.iyfdelhi-sadhana.workers.dev | D1 `sadhana` (`8b771fe4-…`) |
| **load test** | `sadhana-record-api --env load` | `sadhana-record-api-load.…workers.dev` | D1 `sadhana-load` (`7617b76f-…`), no crons, no Google/Push secrets, `LOAD_METER=1` |
| **staging** | `sadhana-record-api --env staging` | `sadhana-record-api-staging.…workers.dev` | D1 `sadhana-staging`, **crons on** (`* * * * *`), no Google/Push secrets, `SHEETS_COPY=off` |
| **local dev (API)** | `wrangler dev` with `.dev.vars` (`PW_PEPPER`) | localhost | local D1 after `npm run migrate:local` |
| **local dev (app)** | `vite` with `VITE_API_URL` unset | localhost:5173 / 5199 for checks | the in-memory mock (`src/lib/mock*.js`) |
| **tests** | `node tests/run-all.mjs` | in process | SQLite in Node, all migrations applied by `harness.mjs` |

**Staging exists from 14 October 2026** (roadmap 6.8, audit T F-19). It is the only place the **scheduled** work can be
rehearsed: the load-test Worker has `crons = []` on purpose, so before this nothing anywhere ran the every-minute copy,
the Monday 21:00 deadline, retention or the reminders until production did — the jobs that touch every row and are the
hardest to undo.

It is deliberately crippled so it cannot reach a real person or a real sheet: **no `GOOGLE_SA_KEY`** (the Sheets copy and
the registry read fail closed and log), **no `VAPID_PRIVATE_JWK`** (no notification can leave it), `REGISTRY_SHEET_ID=""`,
`SHEETS_COPY="off"`, and its own database. The one secret it needs is `PW_PEPPER`, and it must be a **different value from
production**:

```sh
npx --no-install wrangler d1 create sadhana-staging        # paste the id into wrangler.toml [[env.staging.d1_databases]]
npx --no-install wrangler secret put PW_PEPPER --env staging
npx --no-install wrangler d1 migrations apply sadhana-staging --env staging --remote
npx --no-install wrangler deploy --env staging
```

**Cron budget:** 5 schedules per account on the free plan. Live uses 3, staging uses 1, leaving 1 spare. Staging does not
take the two reminder schedules, because without a VAPID key they would do nothing.

**Free-plan limits are account-wide.** The D1 daily read budget is shared by the live and load databases; heavy test runs
exhausted it on 12 Oct 2026 (it resets at 05:30 IST). Plan heavy local-to-remote reads early in the IST day.

## 2. Configuration

### API (`worker/wrangler.toml`)
| Key | Value / purpose |
|---|---|
| `compatibility_date` | 2026-09-01, `nodejs_compat` |
| `[placement] mode` | `smart` — the Worker runs near D1 (APAC), not near the caller |
| `[observability] enabled` | true — logs visible in the dashboard (Workers & Pages › sadhana-record-api › Logs) |
| `[[d1_databases]]` | binding `DB`, `migrations_dir = "migrations"` |
| `[triggers] crons` | `* * * * *` (everything) · `0-59 14-17 * * *` and `0-59 15-17 * * *` UTC (reminder-only runs) |
| `vars.TZ_OFFSET_MIN` | 330 (declared; the code hard-codes IST in `util.js`) |
| `vars.REGISTRY_SHEET_ID` | the facilitator dashboard spreadsheet (read every 30 min) |
| `vars.ALLOWED_ORIGINS` | the app origin + localhost 4173/5173 |
| `vars.VAPID_PUBLIC`, `VAPID_SUBJECT` | Web Push public half |

### App (`frontend/wrangler.jsonc`, `public/_headers`, `vite.config.js`)
- Static assets from `./dist`, `not_found_handling: "404-page"` (old builds asking for a missing chunk get a 404, never HTML).
- `_headers`: strict CSP (`script-src 'self'`, `connect-src` = the API origin), `nosniff`, `no-referrer`; `/assets/*`
  immutable for a year; `index.html`, `sw.js`, `push-sw.js`, `manifest`, `version.json`, legal pages `no-cache`.
- `VITE_API_URL` in `frontend/.env.production.local` (the only app-side variable; unset = mock).

## 3. Secrets

| Secret | Used by | Set with | Rotation |
|---|---|---|---|
| `PW_PEPPER` | `crypto.js` (HMAC key before PBKDF2) | `wrangler secret put PW_PEPPER` | **cannot rotate without re-hashing every password**; a change invalidates all logins. Treat as permanent. |
| `GOOGLE_SA_KEY` | `google.js` (service-account JSON) | `wrangler secret put GOOGLE_SA_KEY < key.json` | rotate in Google Cloud, then put the new JSON; the old token cache dies with the isolate |
| `VAPID_PRIVATE_JWK` | `push.js` | `wrangler secret put VAPID_PRIVATE_JWK` | rotating invalidates every subscription; subscribers re-register through `push.renew`/`register` |
| `MASTER_RESET_PASSWORD` | `setup.js` (recovery only) | put, wait one minute, **delete** | the value's SHA-256 is kept in `settings.master_reset_applied` so it is applied once; still delete it |
| `dashboard-cron` service token | the facilitator dashboard's hourly `identity.mintBatch` | `node tools/identity/service-token.mjs` | re-running ends the old sessions; the token lives in an Apps Script Script Property |

Rules: secrets are never in git, never printed, never in `vars`. `worker/.dev.vars` (local pepper) and
`frontend/.env.production.local` must be in `.gitignore` before the first commit (ADR 0007).

**Known weakness (confirmed by reading `setup.js:1`):** the recovery comment says "every 5 minutes"; `index.js:57` runs
it every minute. Harmless, but the comment is stale.

## 4. Deploying

### Order that is known to work (from the release skill)
1. `cd worker && npm run audit:sql` — 30 suites, then the query-plan and write audits must say `0 new`.
2. `cd frontend && npm test && npm run build && npm run size` — budget: initial JS ≤ 60 KB gzip, CSS ≤ 15 KB.
3. Browser checks green (`tools/browser/verify.mjs` against `vite --port 5199`).
4. Tell peer sessions sharing the disk (`wrangler deploy` ships whatever is on disk). `npx wrangler versions list`
   and file mtimes first: a peer may have deployed from the same tree.
5. Migrations: `npx wrangler d1 migrations list sadhana --remote`, then `apply`. **Additive only.** If a new table is
   copied to Sheets, its tab must exist first (`setup/schema.mjs`, `build-store apply`).
6. API: `npx wrangler deploy`, then the smoke call:
   ```
   curl -s -X POST https://sadhana-record-api.iyfdelhi-sadhana.workers.dev -H 'content-type: text/plain' \
     -d '{"v":1,"action":"meta.get","app":"check","data":{}}'
   ```
7. App: `npm run release` — runs the phase gate (`release-phase.json` → `gate.mjs check n`), tests, build, size,
   carries the two previous releases' assets, publishes, then opens the live app in headless Chrome and proves the open
   page reloads onto the new version and every lazy chunk loads. Records the phase as LIVE in `tools/release/phases.json`.
8. Read back what changed; only then say it is live, with the `assets/index-*.js` id and the Worker version.

### What is gated, and what is not
- **A Worker-only deploy is gated from 14 October 2026** (roadmap 6.5). `npm run deploy` in `worker/` runs
  `worker/scripts/deploy.mjs`: it runs `audit:sql` (the 45 suites, the query plans, the write audit and the fixture-phone
  check), refuses to publish if anything fails, records the version that was serving so a bad build can be undone, and
  writes `docs/deploy-log.json`. `--dry-run` runs the checks only. Bypassing it needs a written reason
  (`--skip-checks "why"`), which is logged. `npm run deploy:raw` is the bare wrangler call, for an emergency.
- **A failed release now rolls itself back** (roadmap 6.5). `frontend/scripts/release.mjs` reads the serving version
  before publishing, and if any check after the deploy fails it rolls back to it and says so. If the rollback itself
  fails it prints the manual command. Read the last lines of its output; do not assume a thrown error means nothing shipped.
- **Still not gated: migrations.** Neither script applies them — on purpose. They are ordered and irreversible and the
  owner must watch them (§5).
- **A "fix on top" of a live phase still skips the browser suites** (`release.mjs` treats gate status 3 as a fix). New
  code under an already-live phase number ships without `verify.mjs`.

## 5. Migrations

**The procedure, in order** (roadmap 2.8; the rules come from `DECISIONS/0003` and the audit's migration review):

1. **Number it next.** The next file is after the highest on disk; **never reuse 0040** (a `hobbies` migration was
   written and deleted before release — if `wrangler d1 migrations list sadhana --remote` ever shows it as applied,
   add an empty `0040_hobbies.sql` so disk and `d1_migrations` agree, and reconcile `setup/schema.mjs`).
2. **Additive only.** New tables, new columns with `NOT NULL DEFAULT`, new indexes, new triggers. Never drop or
   rename a column while any deployed Worker still reads it; a CHECK change needs a `*_v2` table and three releases.
3. **Make it re-runnable** where SQLite allows: `CREATE TABLE/INDEX IF NOT EXISTS`, `DROP TRIGGER IF EXISTS` before
   `CREATE TRIGGER`, `INSERT OR IGNORE` for seeds, and a `WHERE` on the old state for a data fix. `ADD COLUMN` has
   no `IF NOT EXISTS`, so keep column additions in their own small file.
4. **Sheets tab first, if the table is copied.** Add it to `setup/schema.mjs`, run `node setup/build-store.mjs apply`,
   add the `mirrorkeys.js` entry and generate the triggers with `setup/build-mirror-sql.mjs` — *then* the migration.
   Otherwise `mirror_log` fills with rows that have no tab to go to.
5. **Prove it locally:** `npm run migrate:local`, then `npm test` (which includes
   `tests/phase2-migrations.test.mjs` — it applies the files in two halves with real rows in between, at three
   split points, and checks a stepped database ends with a schema identical to a fresh one), then
   `npm run audit:sql` (0 new scans, 0 new mass writes; add any new table to `GROWING` in `tests/query-plans.mjs`).
6. **Note the restore point.** Record the Time Travel bookmark immediately before applying remotely:
   `npx wrangler d1 time-travel info sadhana`. Put it in the release notes — the free-plan window is 7 days.
7. **Apply remotely, then deploy:** `npm run migrate:remote`, confirm with `migrations list`, then
   `npx wrangler deploy`. Old code must tolerate the new schema, which is what "additive" buys.
8. **Data fixes go in their own file**, named for what they fix, with the expected row counts in a comment so the
   release check can confirm them.



- Files: `worker/migrations/NNNN_name.sql`, applied in file order by wrangler, recorded in `d1_migrations`.
- 40 files, `0001`–`0041`; **`0040` does not exist** and must stay absent (wrangler records names, not numbers, but a
  late `0040` would sort before `0041` on a fresh database and confuse the history).
- Local: `npm run migrate:local`. Tests apply all files from scratch on every run (`tests/harness.mjs`).
- Remote: `npm run migrate:remote` **before** deploying code that needs the change; old code must keep working on the
  new schema (that is what "additive" buys).
- A table copied to Sheets: `mirrorkeys.js` entry + triggers in the migration + tab in `setup/schema.mjs`, in that
  order, before the migration runs remotely (otherwise `mirror_log` fills with rows that have no tab).
- There are no down-migrations. Rollback is "deploy the previous Worker"; the schema stays.

## 6. Rollback and recovery

| Failure | Action |
|---|---|
| Bad Worker deploy | `npx wrangler rollback` (or `wrangler versions deploy <previous>`); schema stays, old code ignores new columns |
| Bad app build | redeploy the previous `dist/` (the release carries the two previous releases' chunks, so open pages survive) |
| Bad migration (data) | D1 Time Travel to a bookmark before it: `wrangler d1 time-travel info sadhana --timestamp=…` then `restore --bookmark=…` (7-day window on the free plan; drill took 4 s on 3 Oct 2026). Everything after the point is undone — tell coordinators |
| Lost master password | `wrangler secret put MASTER_RESET_PASSWORD`, wait a minute, delete the secret |
| Sheets out of step | `node tools/sheets/sync-audit.mjs` (read-only); a view sheet: `UPDATE view_state SET mode='build'` |
| Total loss beyond 7 days | weekly `wrangler d1 export` file → new database → repoint `wrangler.toml` (see `backup-restore.md`) |

The weekly export is a **manual** step for the owner. **Unverified:** whether it has been done since the 3 Oct drill.

## 7. Logs and incident investigation

| Where | What | Retention |
|---|---|---|
| Cloudflare Logs (observability on) | `console.log/error` from `fetch` and `scheduled`: `mirror …`, `reminders …`, `deadline …`, `internal <stack>` | Cloudflare's window (days) |
| `run_log` table | API calls that failed with `INTERNAL` or took > 1.5 s: action, ms, error code, internal message, app build; **not** written for `BUSY` or when D1 reports overload | `logRetentionMonths` setting (default 6), nightly |
| `audit_log` table | every staff/master change with before/after and reason; visible to the head in Activity (`audit.list`) | same retention |
| `settings.registry_refresh` | last registry copy status | overwritten |
| `mirror_log`, `view_state`, `reminder_progress` | job backlogs and progress | rolling |

What an operator **cannot** see today: an alert when a cron run throws, a count of `UNAUTHENTICATED`/`FORBIDDEN`
per hour (abuse), the Sheets backlog size without a query, or an HTTP-status-based error rate (every reply is 200).
Proposed additions are in `IMPLEMENTATION_ROADMAP.md` (Phase 6).

**PII in logs:** `run_log.detail` carries the internal error message (truncated to 300 chars), which may include a
login in an exception string; `audit_log` holds before/after JSON of profile changes by design. Neither is sent
outside Cloudflare. Console logs print counts and ids, not names, as far as the code reads.

## 8. Checklist before saying "live"
- [ ] `npm run audit:sql` green · `npm test` green on both sides · `npm run size` within budget
- [ ] migration applied remotely and listed
- [ ] Worker smoke `meta.get` ok · `wrangler versions list` shows the new version
- [ ] `npm run release` ended with "open app moved by itself … ok"
- [ ] peers messaged with the live ids (project rule)
- [ ] the change copied into `sadhanaRecord-revamp/` the same day (two-trees rule)

---

## Phase 0 applied — 13 October 2026

**Version control (0.1, done).** `sadhanaRecord/` is now its own git repository, independent of the parent
`prompt/` repo. Baseline commit `c44db31` "Baseline: Sadhana Record as it is live on 13 October 2026": 1,391 files,
133 MB. `.gitignore` at the app root is the single authority on what is excluded; the decisions behind it:

| Excluded | Why |
|---|---|
| `node_modules/`, `frontend/dist/`, `.wrangler/`, `frontend/.vite/` | reproducible from source |
| `.dev.vars`, `.env*`, `*.pem`, `*.key`, `service-account*.json`, `.pepper` | secrets; verified absent from the first commit |
| `docs/**/*.pdf` (27 files, 25 MB) | generated from the Markdown by `tools/docs` (skill `sadhana-docs-pdf`) |
| `tools/video/` (13 GB), `tools/devices/android-sdk|jdk|avd/` (11 GB) | local tool payloads, restore per `tools/README.md` |
| `tools/devices/results/**/*.mp4|png|jpg` (271 MB) | evidence of one device-check run; the `results.txt` logs are kept |
| `frontend/screenshots/`, `loadtest/out/` | run artefacts |

| Included deliberately | Why |
|---|---|
| `frontend/public/darshan/` (843 files, 118 MB) | a clone must be able to build a **complete** deploy; Git LFS is not installed on this machine and would add a dependency to every future clone and CI runner |

**Still to do before a remote exists:** `docs/` is hard-linked with `sadhanaRecord-revamp/docs/` (same inodes). Git
now tracks this tree's copy; an edit through either path still changes both files. If the two trees must diverge,
write a new file and delete the link — do not `cp` between them (it returns "identical file", which is not an error).

**Rollback, as of this commit.** For the first time there is a source rollback unit: `git revert` or
`git checkout c44db31 -- <path>`, in addition to the previous Cloudflare version for the Worker and re-publishing an
older `dist/` for the app.

**Backups (0.2, script ready, first run pending).** `tools/ops/export.sh` exports the live D1 database to
`~/Documents/sadhana-backups/sadhana-YYYY-MM-DD.sql`, keeps the last 8 weekly files plus the first of each month,
refuses to overwrite the same day, deletes nothing if the export comes back empty, and prints a privacy reminder
(the file holds phones, dates of birth and addresses; never passwords or tokens). Retention logic dry-tested on 13
Oct 2026. It must be run **by the account owner** (`npx wrangler d1 export … --remote` needs the Cloudflare login):

```
sh sadhanaRecord/tools/ops/export.sh
```

Weekly is the target; a monthly restore drill into a throwaway database (never the live one) is in the script's
closing note. Until the first run happens, the only protection is D1 Time Travel's 7-day window and the Sheets copy.
