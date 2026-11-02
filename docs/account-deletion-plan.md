# Self-service account deletion

**5 October 2026. Built and tested; release as phase 9 (API first, then the app).** Both stores require in-app account deletion (Apple guideline 5.1.1(v); Google Play also needs a public web page). The user's decision: **anonymise past weeks**. The account, profile, photo, unsent days, comments, sessions and push subscriptions are deleted. Submitted weeks, attendance and missed weeks stay in the batch totals, with no name or phone left, in D1 or in the Sheets copies.

## What the code review found

- The coordinator delete (`devoteesDelete`, `worker/src/coord.js`) anonymises nothing:
  - submissions, attendance, missed weeks and memberships keep the phone and the name;
  - deleting the `accounts` row also takes the person out of `statsBatch`'s trend, so **past batch numbers change**.
- The phone is in more places than the `login` columns:
  - `submissions.submission_id` (`<phone>-<week>`) and `submissions.week_json` (`login`, `name`, `iyfId`);
  - `view_keys.keys` (`name\0login`), `replies.key`, the `counters` keys `resets:<phone>:…`, and `mirror_log.k1`;
  - `attendance.changed_by` / `leader_by` (on other people's rows, when the person was a group leader);
  - `audit_log`: `who`, `target`, and inside the before/after JSON.
- **Sheets.**
  - Keyed tabs fix themselves when the key is rewritten: the `_key` triggers log the old key, `copyKeys` blanks the old row and writes the new one.
  - The **append** tabs (Submissions, AuditLog) are never rewritten.
  - In the view sheets, Scores, Week-end and Days carry the name and are only appended to.
- faciliatorDashboard and `registry` are not touched. The bridge (phase 5), when built, must skip `deleted-` rows.

## Design

- **Pseudonym.** `deleted-` + 12 random hex characters. It is random, not a hash, because a hash of a 10-digit phone can be reversed by trying every number.
  - Name → `Deleted devotee`; IYF ID → `''`.
  - All PK/UNIQUE constraints stay valid.
- **Who may delete.** Devotees only. Coordinators, the master and facilitators get "Ask the IYF head to remove your role first." A group leader may delete: the leader row is removed and their group is freed.
- **API.** `account.delete`: roles ANY, write, `noReplay`, field `password`.
  - It checks the password with `verifyPassword`, the same way `changePassword` does.
  - It allows 5 wrong tries per 15 minutes (`overLimit`).
- **`worker/src/erase.js` → `eraseDevotee(ctx, a, how)`.** One `db.batch`:
  - end the memberships;
  - rewrite `login` to the pseudonym in memberships, submissions (`submission_id`, `name`, `iyf_id`, `week_json`), attendance, missed_weeks and closed reopens / reopen_requests;
  - delete the open reopens, drafts, photos, profiles, reset_requests, sessions, post_likes, post_comments, replies and reset counters;
  - detach push_subs;
  - scrub audit_log;
  - mark the view weeks `redo:<week>`;
  - queue a sheet erase;
  - delete `accounts`;
  - write one audit entry with no phone or name.
  - `devoteesDelete` uses it as well.
  - `statsBatch` uses a LEFT JOIN, so trends don't change.
- **Sheets.**
  - **`eraseSheets` (mirror.js)**, after `mirrorChanged`:
    - find-replace the phone with the pseudonym, and the name with `Deleted devotee`, on the Submissions and AuditLog tabs;
    - then a paged rewrite of `P-…` rows. It is paged to stay within 10 ms CPU per run.
  - **`redo(v, w)` (views.js)** rewrites the week's view rows.
- **App.**
  - Account › "Delete account" section, before Log out. It's a plain section, not an `.esec`, so verify still counts 5.
  - A lazy `DeleteAccount.svelte` sheet:
    - asks for the password;
    - shows the plain-English consequences;
    - then clears the token, the saved user, the per-login IndexedDB entries and the caches;
    - then goes to Welcome.
  - Staff see the explanation, with no button.
- **Public page** `/delete-account` (`public/delete-account.html` + `legal.css`):
  - no inline script or style, because of the CSP;
  - add it to `navigateFallbackDenylist`; set no-cache in `_headers`.
  - Content: how to delete, what is deleted, what is kept, the timing (at once in the app, within an hour in the sheets, backups after their retention), and a contact for anyone who can't sign in.
- **Tests.**
  - worker `account-delete.test.mjs`, including a "no trace" scan of every table for the phone and the name;
  - the mirror test (fake sheets hold no phone or name);
  - the views test (`redo` = rebuild);
  - the coord test (updated);
  - the app's `writes` / `mock` tests;
  - `verify.mjs` checks (section, wrong password, success, wiped storage, staff see no button, public page loads with no CSP errors).
- **Release order.** API first, then `tools/sheets/sync-audit.mjs`, then the app. Then put the URL in Play Console and in the App Review notes.

## Decisions (the head, 5 Oct 2026)

1. A coordinator's delete anonymises the same way: yes, so `devotees.delete` uses `eraseDevotee` too.
2. The IYF ID is blanked in the kept weeks: yes.
3. The contact on the public page is iyfdelhi.database@gmail.com. Backups: D1 Time Travel keeps 7 days (free plan); weekly export files are kept for 8 weeks, plus one a month. **The monthly files have no end date yet: IYF should set one.**
4. Confirmation: the password **and** typing DELETE.
5. Free-text reasons about the person (audit log, attendance, reopen requests) are blanked.

## What was built

- **Worker:**
  - `src/erase.js`: `eraseDevotee` and `eraseSheets`;
  - `coord.js`: `accountDelete`; `devoteesDelete` reuses the erase; the stats trend counts deleted members' past weeks;
  - `api.js`: the `account.delete` route;
  - `views.js`: a `redo:<week>` step;
  - `index.js`: the erase step runs after the copy;
  - `google.js`: `batchValues`.
  - **Also deleted:** the change-log entries keyed by the phone, and saved replies that name it.
  - **Tests:** `tests/account-delete.test.mjs` (37 checks, including a scan of every table and every Sheets tab).
- **App:**
  - `screens/Account.svelte` (the Delete account section) and `screens/DeleteAccount.svelte` (the sheet, loaded only when used);
  - `lib/forget.js` and `endHere()` in `session.svelte.js`: this phone forgets the person;
  - the public page `public/delete-account.html` + `legal.css`, served at **`/delete-account`**, the URL for Play Console;
  - browser part `deletion` (42 checks).
- **Free-plan cost:** a deletion scans the audit log once; for a group leader, attendance too. Deletions are rare.

## The questions as asked

1. Should a coordinator's delete anonymise in the same way? (Recommended: yes.)
2. Blank the IYF ID in kept weeks? (Recommended: yes. Otherwise the dashboard can still link them to the person.)
3. Which contact email goes on the public page? How long are the weekly export files kept?
4. Is the password alone enough to confirm, or should the person also type DELETE?
5. Free-text audit reasons that mention the person: blank them, or replace only the name?
