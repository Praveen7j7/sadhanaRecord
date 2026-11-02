# Sadhana Record · server (Apps Script)

One web-app endpoint that implements `../docs/sadhana-api-contract.md`. It runs as **iyfdelhi.database@gmail.com** and is the only writer of the 9 Sadhana Record spreadsheets. It only reads the dashboard's Devotees tab (IYF IDs) and never changes the dashboard.

| File | Does |
|---|---|
| `Api.gs` | the endpoint, routing table, errors, request-id replays, locking, permissions |
| `Store.gs` | the data layer: the only code that touches the spreadsheets |
| `Session.gs`, `Auth.gs` | sessions, sign-up, login, lockout, password change, reset requests |
| `Requests.gs` | coordinator approvals: sign-ups and resets |
| `Admin.gs` | meta, coordinators, batches, IYF ID links |
| `Registry.gs` | the IYF ID registry, read-only, with the dashboard's own matching rules |
| `Crypto.gs`, `Validate.gs`, `Time.gs`, `Config.gs` | hashing and tokens, input rules, Indian time, file ids |
| `Setup.gs` | one-time functions you run by hand |

## Tests

```
node tests/run-all.mjs
```
Every file runs together in Node with Google's services mocked and the real sheet headers (`../setup/schema.mjs`).

## First deployment (once)

1. **Registry access:** from the account that owns the facilitator dashboard spreadsheet, share it with `iyfdelhi.database@gmail.com` as **Viewer**. Nothing else changes on the dashboard.
2. **Create the project:** open script.google.com **signed in as iyfdelhi.database@gmail.com** and create a new project called "Sadhana Record API".
   - **Recommended, with clasp:** run `npm i -g @google/clasp`, then `clasp login` (sign in as iyfdelhi.database@gmail.com), and turn on the Apps Script API at script.google.com/home/usersettings. After that the code is pushed from git with `clasp push`.
   - **Or by hand:** in Project Settings, tick "Show appsscript.json". Paste `src/appsscript.json`, then create one script file for each `src/*.gs`, with the same names, and paste each one in.
3. **Run once, in the editor, in this order** (allow access when asked):
   1. `setupSecrets`
   2. `timePbkdf2`
   3. In Project Settings › Script properties, add `MASTER_SETUP_PASSWORD` with a temporary password, then run `createMaster`. The property is deleted automatically, and you choose your own password at first login (username `master`).
   4. `checkSetup`: every line should start with OK.
4. **Deploy:** Deploy › New deployment › Web app. Set Execute as **Me** and Who has access **Anyone**. Copy the `/exec` URL; the app is built with it as `VITE_API_URL`.

Each later change: `clasp push`, then Deploy › Manage deployments › Edit › **New version**, so the URL stays the same.

## Never

- Never edit `PW_PEPPER` in Script Properties: every password depends on it. Run `setupSecrets` only once.
- Never edit the store spreadsheets by hand. Corrections go through the app, so they are checked and logged.
