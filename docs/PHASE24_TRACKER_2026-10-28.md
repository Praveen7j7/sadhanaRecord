# Phase 24 tracker — the visual rebuild (28 Oct 2026)

*Built by session prompt-17 from `docs/VISUAL_AUDIT_2026-10-28.md` §(e), steps 0–6, as ONE phase: everything built
first, then one test pass, one gate, one release (the head, 28 Oct).*

**LIVE 28 Oct 2026, 16:27 IST** — app version `4183802c`, `index-cLJMh_AH.js` (app only: API unchanged `a3efed47`, no
migration). Rollback: `npx wrangler rollback` on the app Worker to `43da5e90` (index-C3qWFgX-). Ledger: Phase 23 recorded
live first (it was missing), then Phase 24 by `npm run release`. Gate: first run red on one speed check only (Analysis
repeat visit 1.5 s — an old fault, the pre-change code shows it too: a lazy Admin tab drew a blank panel the speed check
took as ready); fixed with a skeleton while a tab's file loads (`master/Admin.svelte`); second run green, source
`12fc5cc3c04646e4`: verify 2,595/0 · components 219/0 · back-guard 17/0 · motion 27/0 · routevitals 74 within budget ·
screen reader 0 blocker / 0 major / 3 minor · 86 worker suites / 4,025 · audit:sql 0 new. Read back live: new start-up
CSS (tokens, page widths), Songs chunk carries the song book's content hash. `sadhanaRecord-revamp/` synced (62 files).*

*Rollback of the source:
`impl/baseline/phase24-frontend-src-before-2026-10-28.tgz` (frontend/src, frontend/tests, tools/browser, taken before
the first edit). Frontend only: no worker, migration or mock change.*

Status words: **built** = in `sadhanaRecord/frontend/src`, compiles, unit tests green · **deferred** = not done, with why.

## Step 0 — shared pieces and tokens

| ID | What changed | Where | Status |
|---|---|---|---|
| V14 | Breakpoint values of `--gutter` / `--nav-space` / `--content-max` moved OUT of `@layer components` (unlayered rules always won, so they never applied) | `app.css` after the `:root` tokens | built |
| G1 / V15 | Page widths `--page-read` 720 / `--page-form` 560 as `.page-read` / `.page-form`, left-aligned under the title (never centred away from it) | `app.css`; Songs, Reading, Hearing, Wall, Share, Change password, Explorer, History, Members, Day form | built |
| G3 / V2 | One `--sticky-top` token (the top bar's real bottom: 57 px phone, 65 px desktop + safe area); every hand-written `--bar-h + n` offset replaced | `app.css` `.sticky-top` `.netbar`; BatchStatus, Day (jump bar, rail), Fac list, Coordinators, IYF IDs, Search pin | built |
| V2 | "Filling for …" bar no longer sticky (it sat at the same line as the day chips) | `devotee/Devotee.svelte` | built |
| U4 / V34 | Desktop title band spans the whole main area; its title starts exactly at the content's left edge (no 8 px push from the hidden menu cell) | `app.css` topbar ≥1024 | built |
| V9 | Sidebar "more below" fade replaced by a scroll shadow behind the items — gone when nothing is below; Log out never looks disabled | `app.css` `.sidebar` | built |
| V8 | Sidebar name and roles · batches wrap to two lines each | `ui/Menu.svelte`, `app.css` `.mp-name/.mp-role` | built |
| V6 | Fill-for title reads the full route (`?n=`), and the name remembered for day links | `ui/Shell.svelte` | built |
| V7 | Under 420 px with the search button: title left-aligned after the menu button, takes the room up to the buttons; 1.125rem under 360 | `ui/Shell.svelte` | built |
| G10 / V28 | 44 px on touch for `.btn-sm`, segments, chips, Day jump chips, Board P/A, pickers, Members chips, comment field, Admin sub-tabs; 36–40 kept for a mouse only; calendar gaps smaller under 420 | `app.css`, `styles/seg.css`, `styles/screens.css`, several screens | built |
| G4 / V27 | One card padding rule (16 → 20 from 640 for `.card` `.section` `.cblock`); ONE `.kv` key-value list drawn like a profile section (the right-aligned copy in screens.css removed) | `app.css`, `styles/screens.css` | built |
| G9 / V31 | `ui/ErrorState.svelte`: what happened + what is safe + Try again; failed is tested before empty. Used on My targets, Leaderboard (offline no longer says "No class batch"), History week, Hearing, Reading, Songs | new file + 6 screens | built |
| G2 / V26 | `ui/PageHeader.svelte`: the view's title (or a screen-reader-only one where the bar already says it), one meta line, one actions slot on the same row. Used on Batch (picker as title), Requests, New batch requests, Reopens, Leaderboard, My group, My students, the facilitation board, Close batch, All batches, Analysis, Batch setup, Coordinators, Facilitators, Access, Phases (17 headers; explanatory lines on Reopens and Phases dropped) | new file; `styles/screens.css` `.ph-*` | built (head, 28 Oct: "apply it everywhere") |

## Step 1 — devotee daily path

| ID | What changed | Status |
|---|---|---|
| V16 | Home: the four tiles join the left column (2×2, or one row of four when that column is ≥ 560 px); the news teaser and the painting + verse form the right column, the devotional block LAST on a phone | built |
| V17 | Verse box sizes to the quote on screen (`fit`) — only where it is last on the page (a devotee with no staff block below; staff Home). Elsewhere the old fixed height stays (no layout shift) | built |
| V10 | Home news teaser: title and body two lines each; tile labels wrap | built |
| V35 | Dark theme verse panel: 5 % gold over the raised surface | built |
| V23 | This week: "when" said once, in the readiness list; the cards show "Not open yet" or the action; the auto-submit paragraph folded into the Submit line; Attendance label not repeated | built (2 checks in verify.mjs moved to the readiness list) |
| V22 | Day: Chetna options in an equal-cell grid (no lone "Overate"); topic/book pickers get the field spacing | built |
| V21 | Report: Daily/Weekly + month/year start at the cards' left edge from 600 px; one column at 768–1023 | built |

## Step 2 — devotee reading and sharing

| ID | What changed | Status |
|---|---|---|
| U1 | Song data at an address that changes with its content (`/songs/en.json?v=<sha1>`, per book file), from `vite.config.js` | built |
| U3 | "Refrain" / "Invocation" as a caption above the stanza (not in the 2.25rem number gutter) | built |
| U8 | A one-song section named as its song shows the song alone; no "· 1" | built |
| U6 / V25 | Type and Composer rows stay one line; the last chip (More… / Book & category) is pinned at the row's right end, so the row never ends on a cut name | built |
| U7 | Song books: one light strip (side by side from 600 px), Download as an icon | built |
| V24 | Song page on one left axis (header, meta, headings, source lines) | built |
| U2, U4, U5 | Covered by G3 (sticky token), the full-width title band and the left-aligned reading column | built (by the shared fixes) |
| V29 (Wall) | Refresh ends where the feed ends; the post form and the head's queues share the feed's width | built |
| V27 | Account: the login/batch list now matches the profile rows | built |

## Step 3 — cards and facilitation

| ID | What changed | Status |
|---|---|---|
| V1 | My targets: a Yes/No switch row stacks when its LIST is under 30rem (container query) — the 340 px panes at 1024 included; labels may break | built |
| V20 | Number fields stay beside their label at every width (only switch rows stack) | built |
| V38 | Own card: no overline; a trainee's card does not repeat the training name under the bar | built |
| V12 | Scoreboards period switch sized to its longest label, never wrapping | built |
| V37 | My students › student: "Older weeks" opens on the week before the one shown above | built |

## Step 4 — coordinator batch screens

| ID | What changed | Status |
|---|---|---|
| V3 / V39 | Count strip: labels may take two lines in a narrow strip; five filters as 3 + 2 under 400 px (container query) | built |
| V4 | `.pair` puts two fields side by side only when each gets 9.5rem of ITS space (not the window's) | built |
| V5 | "Filling for …" name: two lines before it is cut | built |
| V11 | Group leaders: names wrap; status under the name in a narrow card | built |
| K1 / V32 | Devotees: names wrap; a list with any ⋯ reserves that column on every row | built |
| V18 | Batch header on one row with Export (icon-only on a small phone); Batch status rows: the reason follows the day dots on a phone | built |
| V13 | Tabs: 600–1023 px wrap onto a second row; a phone has ONE row and **More** — the current tab always in the row (the row starts at it when it must move), More lists every tab out of sight. All tabs stay real tabs in the one tablist, so arrow keys / Home / End still reach each (and bring it into the row) | built (head, 28 Oct) |
| — | `styles/screens.css` `.mrow-act :global(a)` was Svelte syntax in a plain stylesheet and voided the rule (call icons never accent) | built |
| V33 | The menu's batch picker removed (sidebar and drawer); the page's picker is the one picker (the head, 28 Oct). Darshan on staff Home stays — the head asked for it on 10 Oct | built |

## Step 5 — the head's admin

| ID | What changed | Status |
|---|---|---|
| V19 | Analysis tiles two to a 320 px row | built |
| V30 | Paragraphs removed from Access, Facilitators, All batches; the inactive rule moved to How to use | built |
| V13 | Admin tab strip: as step 4 (More on a phone) | built |

## Step 6 — signed-out screens

| ID | What changed | Status |
|---|---|---|
| V36 | The full-height painting panel is 8 % larger from the top centre, cropping the lower corners' watermark | built |

## Not done in this phase (say so, do not estimate)

- **V29 in full** (every toolbar as icon buttons + Seg). **V34** on Back-button screens keeps the arrow before the
  title (42–52 px) — a standard pattern. This week keeps its ring header (the page-change animation travels with it).
- **Plan item 5** (staging database) and **item 6** (U11 Share names, a decision for the head) — not part of the
  rebuild order.
- **Section (d)**: new browser part `p24` (65 checks) clicks them — Day's Set time ×2, same day No, the Seva jump chip;
  My targets Not for me; Scoreboards' second period; Batch status Not active; devotee page More actions; Devotees status
  All/Active/Disabled; Requests Resets/All; My group and My students week before/after; Explorer Qualify; Leaderboard
  Dates; Coordinators More for … (phone); Facilitators' login button; Home Previous quote; Wall Like; Reading's book
  disclosure; Songs text size Small/Medium and Clear the search; the ETP Board tab — plus the new behaviour (More on
  the admin tabs, one picker, offline My targets / Leaderboard errors, Refrain above its stanza, chip rows ending on a
  whole chip, no switch over its label at 1024+). Added after the release (28 Oct, the head): the training board's
  P / A (the head enrols a devotee into ETP-21 first; P, then A, then A again clears — each read back from board.get),
  a toast's Dismiss × (My targets saved, "Your targets are set." closed at once), and sign-up's WhatsApp No (asks for
  the number; Yes takes the field away). `p24` is now 81 checks, 81 passed. Every control in the audit's §(d) is covered.

## Budgets (build of this tree vs the live build `index-C3qWFgX-`)

| | Live (Phase 23) | Phase 24 | Budget |
|---|---|---|---|
| Start-up JS | 39.72 KB | 39.75 KB | 60 |
| Start-up CSS | 14.29 KB | 14.63 KB | 15 |
| Largest lazy chunk | 32.30 KB (staff-Admin) | 32.46 KB (staff-Admin) | 35 |
| Precache | 792.19 KB | 802.15 KB | **850** (raised from 800 by the head, 28 Oct; `scripts/size.mjs`, CLAUDE.md, PERFORMANCE.md) |

## Tests

| Run | Result |
|---|---|
| Unit (`frontend`, vitest) | 53 files, 578 passed (one source test moved to PageHeader) |
| Build | passes; Svelte warnings are the ones already there before |
| Browser suite, full (frozen copy, port 5225) | **2,512 passed, 14 failed**, no console or page errors. The 14 were 7 checks at several widths: |
| — carousel "track = tallest quote", "height unchanged after 5 slides" | the old rule, changed on purpose (V17): checks rewritten — the box is the quote's own height AND the devotional block is last in its column (nothing below can move) |
| — count strip "one row" at 320/390 | changed on purpose (V39): check rewritten — one row when the strip is > 400 px, else 3 + 2 rows, every word inside its tile |
| — songs "each chip row is one line" | my first V25 fix wrapped the rows with a mouse; replaced by a one-line row whose last chip (More… / Book & category) is pinned at the right end |
| — Report "Weekly inside its button" at 1280 / 28 px text | my V21 `flex-grow: 0` left the label 2 px short; removed (the toggle may grow to its 260 px cap and still starts at the left) |
| — day view "beside the day's scores" at 1280 | the real 32 px desktop margins (V14) left the column 538 px, under WeekRead's 560 threshold; threshold now 520 |
| Rerun of the touched parts on a restarted server | devotee 242/0 · coord 143/0 · dayview 42/0 · phase7 33/0 · songs 82/0 · pro 50/0 · share 38/0 |
| Note | a first rerun went red in unrelated places: copying the fixes into the frozen copy while its dev server ran set off ~200 hot reloads (the known HMR trap). Restarting the server cleared all of it — copy, then restart, never copy into a running copy |
