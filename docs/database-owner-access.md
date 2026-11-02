# Sadhana Record database: owner's terminal guide

For the account owner, signed in to Cloudflare as **iyfdelhi.database@gmail.com**. This login has full access: read, write, export and restore. It works from any computer, with or without the project folder.

Every command below was run against the live database on 26 Oct 2026 with wrangler 4.149.0. **Keep this document to yourself**: it describes owner access. For sharing read access with others, use `database-access.pdf`.

## 1. What you connect to

| | |
|---|---|
| Database | `sadhana` (Cloudflare D1, SQLite), region APAC |
| Database id | `8b771fe4-abfd-4bd8-9a50-dfc1ae1b739a` |
| Cloudflare account | Iyfdelhi.database@gmail.com's Account |
| Account ID | `f60a3fb811b84bf911cb2fce3b21c09a` |
| Tool | `wrangler`, Cloudflare's command-line tool (runs through `npx`, nothing to install globally) |

D1 has no host, port or password. There is no connection string. You sign in once with your browser, and wrangler then sends every query to Cloudflare for you.

## 2. Set up any new computer (about 5 minutes)

**Step 1. Install Node.js** 20 or later from https://nodejs.org, then check it in a terminal:

```
node --version
```

**Step 2. Sign in from the terminal.** First make sure the browser is signed in to Cloudflare as iyfdelhi.database@gmail.com, not another Cloudflare account. Then:

```
npx wrangler login
```

Answer *y* if npx asks to download wrangler. A browser tab opens. Check that it names the IYF account, then click **Allow**. The terminal prints "Successfully logged in".

**Step 3. Confirm the account:**

```
npx wrangler whoami
```

It must show `Iyfdelhi.database@gmail.com's Account` and the Account ID `f60a3fb811b84bf911cb2fce3b21c09a`. If it shows any other account, run `npx wrangler logout` and repeat step 2.

**Step 4. Test the database:**

```
npx wrangler d1 execute sadhana --remote --command "SELECT status, COUNT(*) AS n FROM accounts GROUP BY status"
```

A small table of account counts means you are connected. You can run this from any folder.

### Sign-in options

| Situation | Command |
|---|---|
| Your own laptop (safer: keeps the login in the macOS Keychain, not a plain file) | `npx wrangler login --use-keyring` |
| A computer with no browser, or reached over SSH | `npx wrangler login --device`, then open the link it prints on any device and enter the code |
| The browser page hangs at `localhost:8976` | Use `--device` as above |
| `whoami` lists more than one account | `export CLOUDFLARE_ACCOUNT_ID=f60a3fb811b84bf911cb2fce3b21c09a` before other commands |

## 3. Reading data

**One query:**

```
npx wrangler d1 execute sadhana --remote --command "SELECT login, name, status FROM accounts ORDER BY signed_up_at DESC LIMIT 10"
```

**Several queries from a file:**

```
npx wrangler d1 execute sadhana --remote --file query.sql
```

**Save results as JSON** (open in a spreadsheet or a script):

```
npx wrangler d1 execute sadhana --remote --json --command "SELECT * FROM batches" > batches.json
```

**Always keep `--remote`.** Without it, wrangler reads an empty copy on your own computer and shows nothing useful.

**See what is there:**

```
npx wrangler d1 execute sadhana --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
npx wrangler d1 execute sadhana --remote --command "PRAGMA table_info(accounts)"
```

**Which migrations are applied** (the latest is the current shape of the database):

```
npx wrangler d1 execute sadhana --remote --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id DESC LIMIT 5"
```

Main tables:

| Table | Holds |
|---|---|
| `accounts` | Every login: devotees (login = phone), coordinators, master; PENDING / ACTIVE / INACTIVE |
| `batches` | Class batches (SPS, DPS, BSS, BVS, TRD, Vedic intakes) and trainings (ETP) |
| `memberships` | Which devotee is in which class batch |
| `enrolments` | Who is enrolled in a training |
| `drafts`, `submissions` | Weeks in progress, and submitted weeks |
| `attendance`, `training_attendance` | Class and training attendance per week |
| `persons`, `person_identifiers`, `person_names`, `person_phones` | The identity record behind IYF IDs |
| `phases`, `targets`, `measures` | Facilitation phases and facilitators' cards |
| `settings` | App switches (for example `SHEETS_COPY`) |
| `audit_log` | Who changed what, and when |

### A shortcut for your terminal

Add this line to `~/.zshrc` (macOS) and open a new terminal:

```
d1() { npx wrangler d1 execute sadhana --remote --command "$*"; }
```

Then:

```
d1 "SELECT COUNT(*) FROM submissions"
```

Keep the SQL inside double quotes, and use single quotes inside the SQL.

## 4. A full copy to browse like a workbench

wrangler has no interactive SQL shell for a remote database. For point-and-click browsing, take a copy and open it locally.

**Step 1. Export.** The database **stops answering the app while an export runs**, so never do this on Sunday evening or Monday before 10 PM IST.

```
npx wrangler d1 export sadhana --remote --output sadhana.sql
```

Smaller exports:

```
npx wrangler d1 export sadhana --remote --no-data --output schema.sql
npx wrangler d1 export sadhana --remote --table batches --table memberships --output part.sql
```

On the main Mac, `sh sadhanaRecord/tools/ops/export.sh` does the full export and keeps dated copies in `~/Documents/sadhana-backups/`.

**Step 2. Turn it into a database file:**

```
sqlite3 sadhana.db < sadhana.sql
```

**Step 3. Open `sadhana.db`** in DB Browser for SQLite (free), DBeaver or TablePlus, or use `sqlite3 sadhana.db` in the terminal. Nothing you do there touches live data.

The file holds every devotee's personal data. Keep it on your own computer only and delete old copies.

## 5. Changing data

Your login can change anything, and a change takes effect immediately for every devotee. Most changes belong in the app's own screens, which apply the rules and record who did it. Use the terminal only for a repair the app cannot do.

**Step 1. Record a restore point:**

```
npx wrangler d1 time-travel info sadhana
```

Copy the bookmark it prints.

**Step 2. Save the rows you will change:**

```
npx wrangler d1 execute sadhana --remote --json --command "SELECT * FROM <table> WHERE <condition>" > before.json
```

Check the count is what you expect. On the main Mac, keep the file in `impl/baseline/`.

**Step 3. Make the change from a file**, using the same WHERE:

```
npx wrangler d1 execute sadhana --remote --file change.sql
```

**Step 4. Run the SELECT from step 2 again** and compare with `before.json`.

Rules that hold even with full access:

- **Structure changes only as migrations**, from the main Mac: `cd sadhanaRecord/worker && npm run migrate:remote`. A table or column added by hand breaks the next release.
- **Never DELETE devotee history.** Deleting a person anonymises their weeks; it does not remove them.
- **No ID numbers** (Aadhaar or any other), **no invented phone numbers** (tests use only `60000000xx` and `60000001xx`), **no IYF IDs typed by hand**.
- **Live test data:** ETP-21, Suraj Sahu and the login `6000000303` are test records until real batches start in November.

## 6. Undoing a mistake: Time Travel

D1 keeps a timeline of the database for the last **7 days** on the free plan.

**Find the restore point** for a moment before the damage (IST time shown):

```
npx wrangler d1 time-travel info sadhana --timestamp=2026-10-26T10:15:00+05:30
```

**Restore** (it asks you to confirm):

```
npx wrangler d1 time-travel restore sadhana --bookmark=<bookmark>
```

It prints a second bookmark; restoring to that undoes the restore. **Everything saved after the restore point is lost too**, devotees' entries included, so tell coordinators which hours to re-check. The full runbook is `docs/backup-restore.pdf`.

## 7. Health and usage

```
npx wrangler d1 info sadhana
```

Shows the database size and the last 24 hours of reads and writes. On 26 Oct 2026: 3.49 MB, about 249,000 rows read and 523 rows written in a day.

Free plan limits per day: **5 million rows read** and **100,000 rows written**. Writes are the tight one (a Sunday at 5,000 devotees uses most of it).

```
npx wrangler d1 insights sadhana
```

Lists the heaviest queries (experimental).

## 8. The Workers, from the terminal

| Worker | What it is |
|---|---|
| `sadhana-record` | The app devotees open (screens only, no data) |
| `sadhana-record-api` | The API: all rules, the only thing that reads and writes `sadhana`, the scheduled jobs |
| `sadhana-record-api-load` | Load-test copy, on its own test database `sadhana-load` |

Look, without changing anything:

```
npx wrangler versions list --name sadhana-record-api
npx wrangler tail sadhana-record-api --format pretty
npx wrangler tail sadhana-record-api --status error --format pretty
npx wrangler secret list --name sadhana-record-api
```

`tail` shows live requests and errors until you press Ctrl+C. `secret list` shows names only, never values.

**Never deploy from a new computer.** Releases go out only from the `sadhanaRecord/` folder on the main Mac (`npm run deploy` for the API, `npm run release` for the app). Those scripts run the checks; a plain `wrangler deploy` skips them.

## 9. Security

- **Leaving a borrowed computer:** run `npx wrangler logout`. It removes the login from that machine.
- **Never log out on the main Mac.** The Claude sessions that build and release the app use the same login; logging out stops them mid-task.
- **Never share the output of `npx wrangler auth token`.** It is a live key to the whole account.
- **Where the login is stored:** `~/.wrangler/config/default.toml`, or the Keychain if you used `--use-keyring`.
- **A lost or stolen laptop:** change the Cloudflare password at dash.cloudflare.com at once, and sign out other sessions.

## 10. Troubleshooting

| You see | Do this |
|---|---|
| "Couldn't find a D1 DB with the name sadhana" | Wrong account: `npx wrangler whoami`, then log out and in again |
| An authentication error (code 10000) | `npx wrangler login` again; logins expire |
| An empty result where data should be | You left out `--remote` |
| "More than one account available" | `export CLOUDFLARE_ACCOUNT_ID=f60a3fb811b84bf911cb2fce3b21c09a` |
| The login page never finishes | `npx wrangler login --device` |
| "D1_ERROR: no such table" | Check the name with the table-list query in section 3 |
