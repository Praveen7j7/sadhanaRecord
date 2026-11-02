# Sadhana Record · server (Cloudflare Worker + D1)

Implements `../docs/sadhana-api-contract.md`. D1 is the main copy of the data; every 5 minutes a schedule copies changed tables to the 9 Google Sheets (never password hashes or tokens), and every 30 minutes it copies the IYF ID registry from the dashboard's Devotees tab. Design §2d.

| File | Does |
|---|---|
| `src/index.js` | entry: the API (POST), health (GET), CORS, the schedule |
| `src/api.js` | routing table, envelope, request-id replays, Run Log |
| `src/auth.js`, `src/session.js`, `src/crypto.js` | sign-up, login, lockout, password change and resets, sessions, PBKDF2 + pepper |
| `src/requests.js`, `src/admin.js` | coordinator approvals; master: coordinators, batches, ID links |
| `src/registry.js` | the IYF ID registry copy, with the dashboard's own matching rules |
| `src/google.js`, `src/mirror.js` | Sheets API as the service account; the sheet copies |
| `migrations/` | the D1 tables |

Tests: `npm test` (D1 is SQLite in Node; Google is faked).

## First deployment (once)
1. `npx wrangler login` (your Cloudflare account)
2. `npx wrangler d1 create sadhana`, then put the printed `database_id` into `wrangler.toml`
3. `npx wrangler d1 migrations apply sadhana --remote`
4. Secrets (typed at the prompt, never stored in git):
   - `npx wrangler secret put PW_PEPPER`: the **same value** as the Apps Script project's Script Property PW_PEPPER, so existing passwords keep working
   - `npx wrangler secret put GOOGLE_SA_KEY < <service-account key file>`
5. `npx wrangler deploy`
6. Move the Phase 1 data: `node ../setup/migrate-to-d1.mjs /tmp/m.sql && npx wrangler d1 execute sadhana --remote --file /tmp/m.sql && rm /tmp/m.sql`
7. Share the dashboard spreadsheet with `iyf-delhi@sadhanareport.iam.gserviceaccount.com` as **Viewer** (registry copy).

Later changes: `npm test && npx wrangler deploy`.

## Forgotten master password
In your own Terminal (so the password never appears anywhere else):
1. `cd ~/Downloads/hpStuff/prompt/sadhanaRecord/worker && npx wrangler secret put MASTER_RESET_PASSWORD`, then type a temporary password (8+ characters, not a common one).
2. Within 5 minutes the schedule makes it the `master` password, signs out open master sessions and writes AuditLog.
3. Log in as `master` with it; the app makes you choose your own.
4. `npx wrangler secret delete MASTER_RESET_PASSWORD`. The same value is never applied twice, so this can wait, but tidy it up.
