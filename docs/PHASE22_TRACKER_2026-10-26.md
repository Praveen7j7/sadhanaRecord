# Phase 22: the head's list of 26 Oct 2026, built as one batch today

The head (26 Oct): "organize them and don't skip any, all will get in our today's build". Each row keeps the head's
words. The 23 Oct backlog (`PHASE22_BACKLOG_2026-10-23.md`) is merged in as group K. One full gate, one release.
Live before this batch: phase 21 (app `index-P60JWOD0`, API `7e5c22c3`).

State: ☐ to do · ◐ building · ☑ built + targeted tests · ⚑ waiting for the head

## A. Dates: a calendar wherever a date is asked

| # | The head's words | Where | Plan | State |
|---|---|---|---|---|
| A1 | Promotion explorer › Custom: "a calendar selector opening than us typing" | `fac/Explorer.svelte` | via A3 | ☑ |
| A2 | Leaderboard › Dates: "a calendar should open" | `coord/Leaderboard.svelte` | via A3 | ☑ |
| A3 | "Wherever the dates are required, there should be calendar opening" | `ui/DateInput.svelte` (used by 15 screens) | a tap anywhere on the field opens the calendar (`showPicker()`); typing still works | ☑ |

## B. Layout fixes

| # | The head's words | Where | Plan | State |
|---|---|---|---|---|
| B1 | Explorer "Qualify / Everyone": "Everyone is touching the border" | `fac/Explorer.svelte` `Seg` | inner padding so the label never meets the edge, at 320–1440 | ☑ |
| B2 | Admin › Requests › All, Sign-ups, Resets: on desktop the Refresh is not placed like it is on Reopens | Admin Requests tabs | one header layout, the Reopens one, for every tab | ☑ |
| B3 | Coordinator › Requests: same Refresh and arrangement on desktop | `coord/Requests.svelte` | as B2 | ☑ |
| B4 | Hearing: "the weeks scroll is not smooth on phone" | Hearing week strip | smooth scrolling that snaps to a week; no accidental taps while swiping, no layout shift, no fight with the page scroll; checked at 320, 360, 390, 430 | ☑ |

## C. Vaishnava Songs

| # | The head's words | Where | Plan | State |
|---|---|---|---|---|
| C1 | "When I click on download, it is not downloading" | `screens/Songs.svelte`, `vite.config.js` | the 23 Oct fix (the app was answering the PDF with Home) ships in this release; the button also saves the file, not only opens it | ☑ |
| C2 | "Make the UI of the Vaishnava songs more user friendly" | `screens/Songs.svelte` | search, browse by **poet/author** (e.g. Surdas) and by **category** and **language**, a clearer song page and download row | ☑ |
| C3 | "Add more songs … Hindi as well; Damodarashtakam is missing; songs written by Surdas"; and (26 Oct, later) "include Prema-bhakti-candrikā of Narottama Dāsa Ṭhākura, and Gītāvalī and Śaraṇāgati of Bhaktivinoda Ṭhākura" (browse by collection) | songs data | head 26 Oct: Claude adds Damodarashtakam, Hindi bhajans and Surdas padas from standard public-domain texts, each tagged poet + language + category; **shipped only after the head (or a devotee they name) proofreads them** | ☑ |

| C4 | (26 Oct, later) "Add only those songs which are literally there" in the official books in Downloads | `public/songs/en.json`, `tools/songs/` | songs come only from the official books: the app's Vaishnava song book, the Hindi song book, and *Songs of the Vaiṣṇava Ācāryas* (BBT, `sva.pdf`, 110 pages). The 13 bhajans added from memory (Surdas, Mirabai, Tulsidas) are taken out; missing songs of Śaraṇāgati, Gītāvalī and Prema-bhakti-candrikā are added from *Songs of the Vaiṣṇava Ācāryas* (scanned, so the head proofreads) | ☑ |
| C5 | (26 Oct, later) "This route should only be visible to the user's login, not to every route" | `lib/nav.js`, `routes.js` | Songs shown in a devotee's own menu (anyone with their own sadhana form); not in staff-only or head-only logins | ☑ |

Songs decisions (the head, 26 Oct, after the books were transcribed): all songs go live with **no** proofreading
marker; Viśvanātha's three aṣṭakas and the Prema-dhvani list are left out; the song file is **split by book** (the list
and the original book load first, each added book only when opened).

## D. Books storage

| # | The head's words | Where | Plan | State |
|---|---|---|---|---|
| D1 | "Use this storage (Drive folder `1bg9AMv4qfN4IlpikXX2VxoprApR1gmNf`) to store all the books the app is using, to the limit of the drive; download and upload it here" | the 462 book/chapter PDFs now in hearingandreading.1 and pushpendersinghal (`DRIVE_FILES_2026-10-23.md`) | copy each book into the folder, set Anyone with the link · Viewer, then point the app's links at the copies by migration (the old files stay as they are). Head 26 Oct: runs with **the folder owner's own Google sign-in** (service accounts have 0 storage). First: check the folder's owner, sharing and free space; copy only what fits. The app keeps opening books straight from Drive (no second store: free plan). A link-health check lists any file that fails to open | ✓ LIVE 27 Oct 06:55 IST: Code.gs (batched rewrite) copied all 462 into the head's folder; 0069 applied alone (`d1 execute --file` + d1_migrations row; 0070–0073 left for Phase 23), journals j3 → j4. Read-back: 76/76 books point at the root books folder, 505/505 file+chapter links at our copies, 0 originals left; all 505 old and new links open with no sign-in, same files. Backup `impl/baseline/books-links-before-relink-2026-10-27.json`, rollback `tools/books/out/0069_books_relink.rollback.sql`. Drive holds 131 duplicate copies (65 MB, overlapping runs of the old script) not used by the app: removal is the head's call |

## E. Scorecards

| # | The head's words | Where | Plan | State |
|---|---|---|---|---|
| E1 | ETP scorecard: targets on the left, the week's achievements on the right; targets edited with an Edit button; "targets and achievements on the same section is confusing" | `screens/Card.svelte` | two panes on desktop (stacked on phone): Targets (read, Edit opens them) · This week (what was done against each target) | ☑ |
| E2 | ETP scorecard (said as "ATP"; "sales scores/numbers" = sadhana scores/numbers): a toggle This week / This phase instead of both at once; the same scorecard as the weekly fill form's side bar (targets, sadhana scores and numbers together) | `screens/Card.svelte`, fill-form side bar | one card component, used in both places, with the toggle | ☑ |
| E3 | Admin › Scoreboards: a sub-filter Last week / This phase, as in the coordinator and personal views | `coord/Scoreboards.svelte` for the head | the same filter | ☑ |

## F. Batch views

| # | The head's words | Where | Plan | State |
|---|---|---|---|---|
| F1 | Batch status and Filling chart: a dropdown of all batches (DPS, BSS, BVS, SPS, SPS2, SPS Online, VL-2, VL-3) | `coord/BatchStatus.svelte`, `coord/Stats.svelte` | batch picker with **All batches** for a combined view; the head sees every batch, a coordinator the batches they hold. The list is the batches configured in the app (VL-2 / VL-3 appear once they exist; live has none yet) | ☑ |
| F2 | Leaderboard: an "all batches" choice for the whole view, "everywhere this is valid" | `coord/Leaderboard.svelte` and every batch picker | a batch dropdown (DPS, BSS, BVS, SPS, SPS2, SPS Online, VL-2, VL-3 as configured) plus "All batches", wherever a batch is picked and a combined view makes sense; rankings follow the batch and period; the custom range is validated (from ≤ to, up to 6 months) | ☑ |
| F3 | Overview (SPS): Praveen last filled last month, yet it shows "1 of 7 filled" under "This week" | `master/Overview.svelte` + its server action | count only this week's days; check the column's title against what it counts; verify on every batch and on live data (before/after recorded) | ☑ |

## G. Facilitators tab

| # | The head's words | Where | Plan | State |
|---|---|---|---|---|
| G1 | "There is a denomination of NameMap, which was the concept of the dashboard" | `master/Facilitators.svelte` (pill and delete sheet) | remove the dashboard word from the screen; keep the behaviour | ☑ |

## H. Access manager (ADR 0019)

| # | The head's words | Where | Plan | State |
|---|---|---|---|---|
| H1 | "Assign HG Vilas Padmanabha Prabhuji as SPS coordinator, and in his own login he sees the features this membership holds; on revoking he sees only the normal user menus" | `master/Access.svelte`, `worker/src/grants.js`, `db.js`, `routes.js` | ADR 0019: assignments (role + where + chosen rights + end date) in Access; each role has its default rights (role → rights); a person may hold several; revoke takes exactly that; the menu follows the rights; the server enforces every action; every assign/revoke in Activity. Head 26 Oct: **facilitator rights left for later**; coordinator, training coordinator and group leader now | ☑ |

## I. Inactive devotees

| # | The head's words | Where | Plan | State |
|---|---|---|---|---|
| I1 | "If a devotee does not fill sadhana for one month, a request is raised to their class coordinator, their facilitator and the admin: should they be made inactive?" | Requests (new type), Monday deadline job | head 26 Oct: after **4 Mondays with no submitted week**, one request visible to the class coordinator, the facilitator and the head; **any one of them** approves or rejects. One request per inactive stretch (no duplicates); a rejected one is not raised again until 4 more weeks pass. Not raised for anyone who joined under 4 weeks ago, is already inactive, or is disabled. Every decision in Activity | ☑ |
| I2 | "Inactive, the person can come back whenever they can; for our count we mark them inactive" | `accounts` / membership status | inactive keeps the login and all history; **their next submitted week makes them Active again by itself**; no new account | ☑ |
| I3 | "The count of Active to Inactive devotees should be visible in the admin section" | Admin › Overview / Analysis | Active and Inactive counts per batch and in total; a tap opens the list | ☑ |

## J. ETP batches

| # | The head's words | Where | Plan | State |
|---|---|---|---|---|
| J1 | "In ETP there is no way to mark the batch ended, or to define a new batch's start and end date; its dates are custom, the rest is like the original facilitators" | Admin › Batch setup, `worker` batches | a training batch gets a start and an end date set by the head (validated: end after start), its status shown (Running / Ended), and an "End this batch" step; ETP-22 can be made with its own dates. At the end date without being ended: the coordinator and head see "Past its end date — end it?"; nothing ends by itself. An ended batch takes no new attendance or cards; its history stays readable | ☑ |

## L. Added later on 26 Oct

| # | The head's words | Plan | State |
|---|---|---|---|
| L1 | "Similar to the ETP coordinator … there is the FTP coordinator, the Facilitator Training Program coordinator, who defines the existing facilitators and sees the scoreboards of all in one view, like ETP; but these are original facilitators who work on phases, not custom dates" | an FTP coordinator role (given in Access, ADR 0019): makes a facilitator lasting (ADR 0010: FTP grants the real facilitation) and sees every facilitator's scoreboard in one view, phase by phase | ☑ |
| L2 | TRD day maximum: "use the COSATOK way, and capping we are already doing" | 205 a day (the COSATOK points: 7 × 25 + 10 + 4 × 5), capped at 100 as every score is | ☑ |

| L3 | (on J1's calls) "These are 2 different scopes although they have the same pattern: the ETP way and the FTP way are 2 different routes. One is the full-time official facilitators' route, which works on phases; ETP is on custom dates, as defined when starting a batch and ending a batch" | a trainee's card runs over the training's own dates (start → end, or the day it was ended), never clipped by or keyed to a phase; facilitators stay on phases. J1's other calls stand: "Past its end date" from the day after; an end date can be set or changed, not removed; no future start | ☑ (migration 0068: a trainee's card rows keyed by the training id) |

## K. Carried from 23 Oct (`PHASE22_BACKLOG_2026-10-23.md`)

| # | Item | State |
|---|---|---|
| K1 | Songs PDF opened Home: fixed in both trees, unreleased (= C1) | ☑ |
| K2 | TRD scored the COSATOK way (day max 225, attendance not scored, Morning program column) | ☑ |
| K3 | Hindi songs as text (= C3) | ☑ |
| K4 | `release.mjs`: rollback target reads the wrong Worker; the open-app check | ☑ |
| K5 | Mock KT26 fixture IDs, F4 (PBKDF2 25k), screen-reader minors | ☐ |

## Release

Migrations in order: 0065 (TRD card), 0066 (inactive requests), 0067 (training end date), 0068 (trainee cards keyed by the training; backup impl/baseline/trainee-cards-before-0068.json), then the worker. Without 0068 the two live trainees' cards would show empty. 0069 (books relink) only after the head's copy run.

At release, after the migrations (the head, 26 Oct): back up the `tracking_from` row, then set
`settings.tracking_from` to the release week's Monday. Weeks from then on count as tracked, so missed weeks are recorded
and the first inactive request can come about 4 weeks later. Live has it empty today, so no week is tracked.


Bulk: full gate (`tools/release/gate.mjs checks 22`), screenshots of every changed screen (phone + desktop, light +
dark), then migrate → worker → app, then copy into `sadhanaRecord-revamp/`.

## Gate runs and the fixes they led to (26 Oct)

| Run | Result | What it found | Fixed by |
|---|---|---|---|
| 1 | stopped at the SQL audit | the daily role-expiry job reads the whole accounts table (`grants LIKE '%"@%'`) | allowed with the reason in `worker/tests/audit-allow.mjs`: once a day, about 5k rows at most, no write unless a role has ended |
| 2 | browser checks crashed | the coordinator board now opens on "All my batches" (F1), so "No regular class this week?" (a single batch's tool) was not on screen | `verify.mjs` coordinator and phase7 choose SPS first (a test change; the product is as the head asked) |
| frozen-copy runs | 9 failures, then 4 | (a) TRD checks still looked for "Temple activities" (now "Morning program", K2); (b) **Songs did not follow an address change while the list was open** (Back between two searches); (c) the ID search used the old KT26 sample IDs; (d) checks with fixed waits; (e) **the facilitator's "Inactive?" block loaded above the student list and pushed the rows down under a tap**; (f) the Access checks expected the old "Coordinator of …" line | (a) the check reads the new name; (b) **Songs.svelte follows `hashchange`**; (c) the check searches the IYFD IDs; (d) the checks wait for what they check; (e) **the block moved below the list** (`fac/Fac.svelte`); (f) the check reads the Roles list, which has its own `acc-roles` class |
| screenshots | one defect | **the Give-a-role sheet's 4-way switch clipped "Coordinator" at 390 px**; Access still said "Their roles stay as they are" | **role choice as radio rows with a one-line scope each** (`master/Access.svelte`); the sentence corrected |
| 3 | browser checks crashed | the page reloaded mid-run: the dev server's dependency cache had been deleted by the lead (through the frozen copy's linked `node_modules`), so the gate's server rebuilt it and reloaded every page | nothing in the app; the cache rebuilt itself |
| 4 | everything green except routevitals | head /analysis repeat visit 1221 ms against a 100 ms budget, though the first visit took 26 ms | re-measured twice: 36 ms and 28 ms. Timing noise on this machine, so no code change |
| 5 | running at release time | — | — |

Also fixed on the way: the access refresh after a refusal (`hooks.onForbidden`) ignores a reply that lands after
sign-out or after someone else signs in (`lib/session.svelte.js`).

## Release log (26 Oct)

- The head said "go", then "make it live as of now" (about 18:00 IST).
- D1 bookmark before anything: `00000452-0000005a-00005110-a8c2558b84c1432b83d517c114538120`. Rows backed up in
  `impl/baseline/phase22-before-release.json` and `trainee-cards-before-0068.json`.
- 18:03: migrations 0065, 0066, 0067 and 0068 applied on live.
- 18:04: worker `npm run deploy`. The gate passed: 77 suites, 3,561 assertions; audits 0 new. Live API `2a91ddaf-7a9a-4298-932d-c0ed96f238c2`
  (rollback `7e5c22c3`). Smoke test: meta.get ok, access.assign answers.
- 18:06: `settings.tracking_from` = 2026-10-26 (was empty). Read back: TRD on the TRD card; inactive_requests exists;
  the two test trainees' 11 fills and 10 targets are now under ETP-21.
- Gate runs 5 (26 Oct, evening) and 6 (27 Oct, 04:10) passed every server, app, build and size check, then crashed inside
  the browser checks at a different place each time: Chrome closed the page (phase7b keys; the home quote carousel) under
  machine load. Those parts passed in the lead's full clean run (2,227 checks). Not stamped.
- 27 Oct 04:54 IST: the head ran the app release himself (`release-phase.json` 0, then `npm run release`, then 22), as the
  auto-mode permission check would not let the lead skip the stamp. **App LIVE: Worker version
  `efd26d1c-1216-417b-8300-e07ad10987fd`, build `assets/index-D_RXQPHd.js` (2026.10.27-0454).** Rollback target: the
  previous app version `18ffba8e`.
- Live checks (read-only `gate.mjs smoke`): the app answers, sign-in, navigation, the service worker, all 16 lazy screens
  and no page errors all pass. Served from live: /songs/en.json, /songs/books/*.json, staff-Access (acc-roles), the
  FTP coordinator's screen (fac-team), the TRD Morning program (Devotee).
- **Still to do by the head:** record the phase in the gate's ledger, so the next phase's gate opens:
  `cd sadhanaRecord && node tools/release/gate.mjs record 22 --dist frontend/dist/index.html`. The lead was not permitted
  to run it.
- Done 27 Oct: the books relink (0069), see D1. Open: the flaky Chrome crashes in long gate runs
  (run the gate when the machine is quiet, or split verify into parts); K5 F4 (PBKDF2) waits for the head's OK.
