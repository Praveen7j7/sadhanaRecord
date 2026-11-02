# Sadhana Record database: access guide

For people given access to the Sadhana Record database from their own computer.
Sections 1–6 cover **read access**. Section 7 covers **write access**, which is given rarely and only for a set task.
Section 8 is for the account owner who grants access.

## 1. What the database is

| | |
|---|---|
| Name | `sadhana` |
| Database id | `8b771fe4-abfd-4bd8-9a50-dfc1ae1b739a` |
| Kind | Cloudflare D1 (SQLite), region APAC |
| Role | The live system of record of the Sadhana Record app: devotees, batches, weeks, trainings, IYF IDs |
| Owner | Cloudflare account of iyfdelhi.database@gmail.com |

D1 is not a server with a host, port and password. There is no connection string, and tools such as DBeaver or
pgAdmin cannot connect to it. Every query goes through Cloudflare's API, normally with the `wrangler` command.

## 2. What you receive

From the account owner you receive two things. Keep both private, like a password.

- **An API token**, scoped to this account with permission **D1 · Read**.
- **The Account ID** of the Cloudflare account.

Never ask for, or use, the owner's Cloudflare login.

## 3. One-time setup on your computer

**Step 1.** Install Node.js 20 or later from https://nodejs.org. Check it:

```
node --version
```

**Step 2.** Set the token and account in your terminal (macOS / Linux):

```
export CLOUDFLARE_API_TOKEN=<your token>
export CLOUDFLARE_ACCOUNT_ID=<account id>
```

On Windows PowerShell:

```
$env:CLOUDFLARE_API_TOKEN="<your token>"
$env:CLOUDFLARE_ACCOUNT_ID="<account id>"
```

These last until the terminal closes. Do not save the token into a shared file, a script you send to others, or a git repository.

**Step 3.** Test the connection:

```
npx wrangler d1 execute sadhana --remote --command "SELECT COUNT(*) AS accounts FROM accounts"
```

The first run downloads `wrangler` (answer *y* if asked). A table with one number means you are connected.

## 4. Running queries

**One query:**

```
npx wrangler d1 execute sadhana --remote --command "SELECT status, COUNT(*) AS n FROM accounts GROUP BY status"
```

**A file of queries** (write your SQL into `query.sql` first):

```
npx wrangler d1 execute sadhana --remote --file query.sql
```

**Output as JSON**, for use in a spreadsheet or script:

```
npx wrangler d1 execute sadhana --remote --json --command "SELECT * FROM batches LIMIT 20" > batches.json
```

**Without wrangler**, with plain HTTP:

```
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database/8b771fe4-abfd-4bd8-9a50-dfc1ae1b739a/query" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT COUNT(*) FROM accounts"}'
```

Always keep `--remote`. Without it, wrangler queries an empty copy on your own computer and returns nothing useful.

## 5. Finding your way around

**List every table:**

```
npx wrangler d1 execute sadhana --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

**See the columns of one table:**

```
npx wrangler d1 execute sadhana --remote --command "PRAGMA table_info(accounts)"
```

The main tables:

| Table | Holds |
|---|---|
| `accounts` | Every login: devotees (login = phone), coordinators, master; status PENDING / ACTIVE / INACTIVE |
| `batches` | Class batches (SPS, DPS, BSS, BVS, TRD, Vedic intakes) and trainings (ETP) |
| `memberships` | Which devotee is in which class batch |
| `enrolments` | Who is enrolled in a training (training runs alongside the person's own batch) |
| `drafts`, `submissions` | A devotee's week in progress, and the submitted weeks |
| `attendance`, `training_attendance` | Class attendance and training attendance per week |
| `persons`, `person_identifiers`, `person_names`, `person_phones` | The identity record behind IYF IDs |
| `phases`, `targets`, `measures` | Facilitation phases and facilitators' lead-measure cards |
| `audit_log` | Who changed what, and when |

## 6. Rules for read access

- **SELECT only.** Even with a read token, never run INSERT, UPDATE, DELETE, CREATE, DROP or ALTER.
- **Use WHERE and LIMIT.** The app runs on Cloudflare's free plan, and every row read counts against a daily budget shared with the devotees using the app. `SELECT *` over a large table with no `LIMIT` spends that budget.
- **Do not run `wrangler d1 export`** against the live database. While an export runs, the database stops answering the app. For a full copy to explore offline, ask the owner for the latest weekly backup file, then:

```
sqlite3 sadhana.db < sadhana-YYYY-MM-DD.sql
sqlite3 sadhana.db
```

- **Personal data.** The database holds names, phone numbers, addresses and ages of devotees, some of them under 18. Query only what your task needs. Do not copy results to chat groups, public sheets or AI tools. Delete local copies when the task is done.
- **Password and session columns** (`pw_hash`, `pw_salt`, `token_hash`, `new_pw_hash`) are one-way hashes. Never copy them anywhere.
- **Avoid Sunday evening and Monday until 10 PM IST.** That is when devotees submit their week.

## 7. Write access

Write access is **not** given by default. Almost every change belongs in the app itself: coordinators approve,
enrol, mark attendance and reset passwords from their screens, and those screens apply the app's rules and record
who did it. A direct write skips both.

Write access is given only for a named task (for example a data repair), to one person, with a token that **expires
within days**.

### What you receive

An API token with permission **D1 · Write** (it can also read), and its expiry date. Setup is the same as section 3.

### Before every change

**Step 1.** Agree the exact change with the head in writing: which table, which rows, why.

**Step 2.** Record a restore point (a bookmark for the database as it is now):

```
npx wrangler d1 time-travel info sadhana
```

Keep the bookmark it prints. If the command is refused, ask the owner to run it and send you the bookmark.

**Step 3.** Save the rows you are about to change:

```
npx wrangler d1 execute sadhana --remote --json --command "SELECT * FROM <table> WHERE <condition>" > before.json
```

Check the file has exactly the rows you expect. If the count is not what you expect, stop.

### Making the change

- Write the change in a file (`change.sql`), with the **same WHERE** as the SELECT you saved. Run it with `--file`.
- Run it once. Then run the SELECT again and compare with `before.json`.
- Send `before.json`, `change.sql` and the bookmark to the head when done.

### Never, with a write token

- **Never change the structure** (CREATE, DROP, ALTER). Structure changes ship only as numbered migrations through the app's release. A hand-made change breaks every release after it.
- **Never DELETE devotee history.** A deleted person's weeks are anonymised by the app, not removed.
- **Never enter identity numbers** (Aadhaar or any other ID-proof number). The phone is the identity.
- **Never invent phone numbers**, even for a test. A realistic Indian number belongs to a real person. Tests use only `60000000xx` and `60000001xx`.
- **Never create IYF IDs by hand.** The app is the only issuer.

### If something goes wrong

Stop and tell the head at once, with the time it happened. The owner can put the database back to the bookmark from
step 2 with Time Travel (up to 7 days back). Everything saved after that moment is undone too, devotees' entries
included, so the sooner it is reported the less is lost.

## 8. For the account owner: granting and removing access

**Read access**

1. Sign in to dash.cloudflare.com as iyfdelhi.database@gmail.com.
2. My Profile › API Tokens › **Create Token** › Custom token.
3. Permissions: **Account · D1 · Read**. Account resources: include only this account.
4. Optional: client IP filtering (the person's office IP) and a TTL end date.
5. Create, and send the token and the Account ID to the person by a private channel. The token is shown only once.
6. **Check it cannot write.** Run, with that token set:

```
npx wrangler d1 execute sadhana --remote --command "CREATE TABLE _access_probe (x)"
```

It must be refused. If it succeeds, run `DROP TABLE _access_probe` with your own login, delete the token, and do
not hand it out.

**Write access**

Same steps with **Account · D1 · Write** and a TTL end date a few days ahead. Give it only for a task the head has
approved in writing.

**Removing access**

My Profile › API Tokens › the token › **Delete**. It stops working at once. Delete every token when the task or the
person's role ends, and keep a list of who holds which token and until when.
