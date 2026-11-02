# Backups and restore: runbook

**Sadhana Record · IYF Delhi · drill done 3 Oct 2026**

The app's data lives in one Cloudflare D1 database, `sadhana`. Three things protect it, and none of them costs anything on the free plan.

| Protection | What it covers | How far back | Who acts |
|---|---|---|---|
| **D1 Time Travel** | The whole database, as it was at any minute | 7 days on the free plan (30 on Workers Paid) | The owner (`iyfdelhi.database@gmail.com`), with one command |
| **Google Sheets copy** | Every table except passwords, sign-in tokens, photos and phone notification addresses | Always the latest; changed rows arrive within minutes | Nobody: it is automatic. A readable copy, and a last resort |
| **Weekly export file** | The whole database as one `.sql` file | As many weeks as the owner keeps | The owner, once a week (below) |

## The drill (3 Oct 2026, on the test database `sadhana-load`)

1. **Recorded the restore point:** `npx wrangler d1 time-travel info sadhana-load --env load`.
2. **Simulated an accident:** deleted 6 submitted weeks (211 → 205 submissions).
3. **Restored to the point from step 1:** took **4 seconds**. All 211 submissions were back, and the 2,007 accounts were unchanged.
4. **Exported the whole database to a file:** 7.5 MB in **7 seconds**.

**Lesson:** the restore asks for confirmation. There is no `-y` flag; in a script, pipe `yes` into it (below).

## If data is lost or damaged on the live app

**Step 1.** **Stop and note the time.** When did it go wrong, as closely as known? Time Travel restores the database to just before that.

**Step 2.** **Find the restore point** for a moment before the damage. Run this from `sadhanaRecord/worker`, signed in as the owner:

```
npx wrangler d1 time-travel info sadhana --timestamp=2026-10-03T10:15:00+05:30
```

It prints a bookmark.

**Step 3.** **Restore:**

```
npx wrangler d1 time-travel restore sadhana --bookmark=<bookmark>
```

Answer *yes*. The command prints a second bookmark that undoes the restore if it was the wrong moment.

**Step 4.** **Check** a few counts before and after, for example:

```
npx wrangler d1 execute sadhana --remote --command "SELECT COUNT(*) FROM submissions"
```

**Step 5.** **Know what a restore undoes.** Everything after the restore point is undone too: saves and submissions made since then. Tell coordinators which hours to check.

**Step 6.** **The Sheets catch up by themselves.** Changed rows are copied in the next minutes. The batch view sheets correct themselves; set one back with `UPDATE view_state SET mode = 'build'` if it looks wrong.

## Weekly export (the owner, any day; takes a minute)

```
cd sadhanaRecord/worker
npx wrangler d1 export sadhana --remote --output ~/Documents/sadhana-backups/sadhana-$(date +%F).sql
```

- **Keep** the last 8 weekly files, plus one a month. Store them somewhere private: the files hold phone numbers, though never passwords.
- **Free-plan cost:** an export reads every row once, under 1% of the daily read allowance at 5,000 devotees.

**To rebuild from a file** into a new, empty database:

```
npx wrangler d1 create sadhana-restore
npx wrangler d1 execute sadhana-restore --remote --file sadhana-YYYY-MM-DD.sql
```

Then point `worker/wrangler.toml` at the new database and deploy. This is only for a total loss beyond 7 days.

## Not used

The original plan was a nightly copy of the store spreadsheets into a *Sadhana Backups* Drive folder. It was not built: the service account has no Drive storage of its own, so it cannot create files. Time Travel plus the weekly export cover the same need with less to maintain.
