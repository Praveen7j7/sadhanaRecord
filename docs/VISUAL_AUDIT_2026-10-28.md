# Visual audit of every route, every role (Phase 24 item 1)

*28 Oct 2026 · audit only, nothing in the app was changed · for the head (plain words first) and builders (file:line).
Item 1 of `docs/PHASE24_PLAN_2026-10-28.md`; section (c) is the input for item 2 (the written design system).
Known items U1–U11 and K1–K17 (`docs/PHASE23_LATER_FIXES.md`) are referenced, not re-counted.*

## For the head, in plain words

1. **The app looks unprofessional on desktop mostly because of one bug, not 50.** The settings that are meant to
   widen the margins and the page on tablets and computers are written in a place the browser ignores (a CSS
   "layer" rule). So every screen at every width uses the phone's 16 px margins and a 1,120 px page, and each screen
   then invented its own width (we found 15 different ones). That is why titles sit far left while the content
   floats in the middle, and why pages look like a phone page stretched or shrunk on a laptop.
2. **Real crossovers exist beyond the songs page.** Worst: on *My targets* at laptop width (1024 px), the
   "Every week / Not for me" switches sit **on top of their own labels** for every person who has a card
   (facilitators, trainees, coordinators, you). Sticky headers (the Batch status table header, the Day form's
   side panel, the "Filling for …" bar) slide **under the top bar** on computers, the same fault as the songs page's
   "‹ All songs" (U2).
3. **Offline, two screens say something false.** The coordinator's *Leaderboard* says "No class batch" and
   *My targets* says "No card yet" when the phone has no connection, instead of "No connection — try again".
4. **Phones are mostly fine for devotees.** Devotee screens at 320 and 390 px have no sideways scroll, no
   overlap except the known "Refrain" (U3), and their titles fit. Staff screens at 320 px cut 17 different titles
   ("Batch s…", "All bat…"), because the search button widens the top bar's sides.
5. **The same things are drawn many ways.** 33 card styles, 30 heading styles, 48 button sizes, 3 kinds of error
   message. A small written design system (section c) fixes most defects by changing about ten shared pieces, not
   60 screens.

**Counts.** 52 route patterns in `frontend/src/routes.js` plus the 4 signed-out screens, opened as 61 distinct
addresses (variants such as a past week, an empty search, the reopen inbox, "page not found") × 9 logins =
**104 route-role pairs**. **1,220 screenshots**: 1,040 full pages (104 pairs × 5 widths × light and dark) plus
180 loading and offline states. **39 new defects**: 5 crossover/overlap (S1), 8 cut text (S2), 8 wasted space (S3),
11 inconsistency (S4), 7 polish (S5). Plus 9 known items reconfirmed (U3, U5, U6, U7, U8, U9, K1, K2; U2 and U4 by cause).

## How it was done (and what it does not prove)

- **Frozen copy** of `frontend`, `shared`, `tools`, `worker` in the session scratchpad, `node_modules` linked,
  Vite on port 5671 `--strictPort` (owner proven with `lsof` before every run), the in-app mock (`lib/mock*.js`),
  Chrome headless shell (own process name), every browser context closed after each role × width.
- **Logins:** signed out; devotee `6000000001` (also the seeded group leader); TRD devotee `6000000092`; a
  **trainee** (that TRD devotee enrolled into ETP-21 by the head through `enrol.add`); facilitator `natvar`;
  an **FTP coordinator** created through `coordinators.create { ftp: true }` (the mock has none, K4); class
  coordinator `sps`; training coordinator `etp`; head `master`. Shared screens (Wall, Account, My targets, Change
  password) were taken for the main roles, not for all nine, as they draw the same component.
- **Widths** 320, 390, 768, 1024, 1440; **themes** light and dark; reduced motion on (stable frames).
- **Automatic sweep** on each screen's live page (scripts and raw data in the scratchpad: `scripts/sweep.js`,
  `data/sweep/*.json`, digest `data/agg.txt`): text-on-text and control-on-text overlaps, elements under sticky
  bars (at the top, at the end, and at ⅓ / ⅔ scroll), clipped and ellipsised text, sideways scroll, tap targets
  under 44 px at ≤ 430 px, content width as % of the space beside the menu at 1024/1440, page-title x vs content x,
  wrapping chip/button rows with a nearly empty last row, and an inventory of card/heading/button styles.
- **Looked at by eye:** 31 images, chosen for reach (devotee first) and where the sweep flagged something:
  devotee Home (320, 390 dark, 1440), Day 390, Report 768 and its loading state, Songs list 1440, a song 320 and
  1440, This week 1440, Wall 1440, Share 390, Account 1440, My targets 390 (trainee), 1024 (crop) and offline,
  History week offline; facilitator's student 390; staff Home 1024, Batch status 320 and 1024, Devotees 768 and
  its loading state, Fill-for 320 (crop), Leaderboard offline, Students and Scoreboards 1440 (ETP), All batches
  320, Analysis 320, Access 768 (crop), sign-up 1440. Every other finding in this report comes from the sweep's
  measurements and is marked with the screen it was measured on; those screenshots exist but were not each viewed.
- **Limits.** Mock data, not live (K13: recent leaderboard weeks are empty; the ETP-21 training has no students, so
  ETP screens show their empty states). Full-page images expand the window, so a sticky element covered while
  scrolling (V2) is found by the sweep, not visible in the image. Loading and offline states were captured for the
  devotee and the class coordinator at 390 and 1440 and for the signed-out screens; not for the other roles. A
  route that drew from the cache showed no loading skeleton (Report). No real phone keyboard (K3).
  "No sideways scroll" was measured on all 1,040 page images: **0 screens scroll sideways.**

**Screenshots** are at
`/private/tmp/claude-501/-Users-maclapctp409-Downloads-hpStuff-prompt/bfb96117-1af2-4f66-95d5-4bbb86028c04/scratchpad/visual-audit/shots/`
named `<route>-<role>-<width>-<theme>.png` (states: `…-light-loading.png`, `…-light-offline.png`). That folder is
session scratch space. **Kept:** the 37 screenshots this report cites, the sweep and wiring data and the capture
scripts are copied to `docs/visual-audit-2026-10-28/` (11 MB); the full 1,220 can be retaken with its `scripts/`.

---

## (a) Route × role matrix

Columns: **defects** = IDs in the register (b); **ovl** = text/control crossovers found by the sweep (all widths,
both themes, distinct); **cut** = distinct clipped texts; **<44** = tap targets under 44 px at 390 (inline links
excluded); **use** = content width as % of the space beside the menu at 1440 (≈ 97 % is a full page, 59 % is a
672 px column floating in the middle); **dx** = page title x minus content x at 1440 (negative = the title sits left
of the content). Shell-wide defects (V8, V9, V14) apply to every row and are not repeated.

| Address | Role | Worst defects | ovl | cut | <44 | use | dx | Shots |
|---|---|---|---|---|---|---|---|---|
| `/home` | devotee | V16 V17 V10 | 0 | 3 | 4 | 95% | -2 | `home-devotee-<w>-<theme>.png` |
| `/home` | trd | V17 V10 | 0 | 3 | 4 | 95% | -2 | `home-trd-<w>-<theme>.png` |
| `/home` | trainee | V17 V10 | 0 | 3 | 4 | 95% | -2 | `home-trainee-<w>-<theme>.png` |
| `/home` | natvar | V17 | 0 | 2 | 0 | 97% | +8 | `home-natvar-<w>-<theme>.png` |
| `/home` | ftp | V17 | 0 | 0 | 0 | 97% | +8 | `home-ftp-<w>-<theme>.png` |
| `/home` | sps | V3 V16 V17 V7 | 1 | 2 | 0 | 97% | +8 | `home-sps-<w>-<theme>.png` |
| `/home` | etp | V3 V7 | 1 | 1 | 0 | 97% | +8 | `home-etp-<w>-<theme>.png` |
| `/home` | master | V7 V17 | 0 | 1 | 0 | 97% | +8 | `home-master-<w>-<theme>.png` |
| `/week` | devotee | V23 | 0 | 0 | 2 | 95% | -2 | `week-devotee-<w>-<theme>.png` |
| `/week` | trd | V23 | 0 | 0 | 2 | 95% | -2 | `week-trd-<w>-<theme>.png` |
| `/week` | trainee | V23 | 0 | 0 | 2 | 95% | -2 | `week-trainee-<w>-<theme>.png` |
| `/week/2026-10-19` | devotee | — | 0 | 0 | 0 | 93% | -19 | `week-past-devotee-<w>-<theme>.png` |
| `/day/2026-10-26/2026-10-26` | devotee | V2 V22 | 0 | 0 | 15 | 95% | +42 | `day-devotee-<w>-<theme>.png` |
| `/day/2026-10-26/2026-10-26` | trd | V2 V22 | 0 | 0 | 27 | 95% | +42 | `day-trd-<w>-<theme>.png` |
| `/history` | devotee | — | 0 | 0 | 4 | 95% | -2 | `history-devotee-<w>-<theme>.png` |
| `/history/2026-10-19` | devotee | V31 (offline) | 0 | 0 | 1 | 93% | +25 | `history-week-devotee-<w>-<theme>.png` |
| `/report` | devotee | V21 V28 | 0 | 0 | 35 | 95% | -2 | `report-devotee-<w>-<theme>.png` |
| `/report` | trd | V21 V28 | 0 | 0 | 35 | 95% | -2 | `report-trd-<w>-<theme>.png` |
| `/hearing` | devotee | V15 | 0 | 0 | 10 | 59% | -210 | `hearing-devotee-<w>-<theme>.png` |
| `/learn` | devotee | V15 | 0 | 0 | 10 | 59% | -210 | `learn-devotee-<w>-<theme>.png` |
| `/reading` | devotee | V15 | 0 | 0 | 6 | 59% | -210 | `reading-devotee-<w>-<theme>.png` |
| `/songs` | devotee | U5 U6 U7 V25 | 0 | 0 | 6 | 59% | -210 | `songs-devotee-<w>-<theme>.png` |
| `/songs/s034` | devotee | U3 V24 U5 | 1 | 0 | 3 | 58% | -218 | `song-devotee-<w>-<theme>.png` |
| `/songs` | devotee | U5 | 0 | 0 | 7 | 59% | -210 | `songs-empty-devotee-<w>-<theme>.png` |
| `/wall` | devotee | V15 V29 | 0 | 0 | 0 | 77% | -210 | `wall-devotee-<w>-<theme>.png` |
| `/wall` | sps | V15 V29 V7 | 0 | 2 | 0 | 78% | -210 | `wall-sps-<w>-<theme>.png` |
| `/wall` | master | V15 V29 V7 | 0 | 1 | 0 | 78% | -210 | `wall-master-<w>-<theme>.png` |
| `/share` | devotee | V15 | 0 | 0 | 1 | 63% | -2 | `share-devotee-<w>-<theme>.png` |
| `/share/with-me` | devotee | V15 | 0 | 0 | 1 | 63% | -2 | `share-with-me-devotee-<w>-<theme>.png` |
| `/shared/shareAarav` | devotee | — | 0 | 0 | 0 | 92% | -23 | `shared-devotee-<w>-<theme>.png` |
| `/shared/shareAarav/2026-10-19` | devotee | V31 (offline) | 0 | 0 | 3 | 95% | -2 | `shared-week-devotee-<w>-<theme>.png` |
| `/group` | devotee | — | 0 | 0 | 1 | 95% | -2 | `group-devotee-<w>-<theme>.png` |
| `/account` | devotee | V27 | 0 | 0 | 0 | 95% | -2 | `account-devotee-<w>-<theme>.png` |
| `/account` | natvar | V27 | 0 | 2 | 0 | 97% | +8 | `account-natvar-<w>-<theme>.png` |
| `/account` | sps | V27 | 0 | 1 | 0 | 97% | +8 | `account-sps-<w>-<theme>.png` |
| `/account` | master | V27 | 0 | 0 | 0 | 97% | +8 | `account-master-<w>-<theme>.png` |
| `/change-password` | devotee | V15 | 0 | 0 | 0 | 39% | -322 | `change-password-devotee-<w>-<theme>.png` |
| `/no-such-page` | devotee | — | 0 | 0 | 0 | 18% | -441 | `notfound-devotee-<w>-<theme>.png` |
| `/card` | devotee | V1 V20 V38 V31 | 6 | 0 | 10 | 95% | -2 | `card-devotee-<w>-<theme>.png` |
| `/card` | trainee | V1 V20 V38 V31 | 6 | 0 | 10 | 95% | -2 | `card-trainee-<w>-<theme>.png` |
| `/card` | natvar | V1 V20 V38 V31 | 6 | 2 | 10 | 97% | +8 | `card-natvar-<w>-<theme>.png` |
| `/card` | sps | V1 V20 V38 V31 | 6 | 2 | 10 | 97% | +8 | `card-sps-<w>-<theme>.png` |
| `/card` | master | V1 V20 V38 V31 | 6 | 1 | 10 | 97% | +8 | `card-master-<w>-<theme>.png` |
| `/scoreboards` | trainee | V12 V7 | 0 | 0 | 0 | 95% | -2 | `scoreboards-trainee-<w>-<theme>.png` |
| `/scoreboards` | natvar | V12 V7 | 0 | 2 | 2 | 97% | +8 | `scoreboards-natvar-<w>-<theme>.png` |
| `/scoreboards` | ftp | V12 V7 | 0 | 0 | 2 | 97% | +8 | `scoreboards-ftp-<w>-<theme>.png` |
| `/scoreboards` | etp | V12 V7 | 0 | 1 | 0 | 97% | +8 | `scoreboards-etp-<w>-<theme>.png` |
| `/scoreboards` | master | V12 V7 | 0 | 1 | 2 | 97% | +8 | `scoreboards-master-<w>-<theme>.png` |
| `/my-devotees` | natvar | V2 | 0 | 2 | 0 | 97% | +8 | `my-devotees-natvar-<w>-<theme>.png` |
| `/my-devotees/6000000011` | natvar | V2 V37 | 0 | 2 | 0 | 57% | -408 | `my-devotees-student-natvar-<w>-<theme>.png` |
| `/my-devotees/6000000011/2026-1…` | natvar | — | 0 | 2 | 3 | 97% | +52 | `my-devotees-week-natvar-<w>-<theme>.png` |
| `/explorer` | natvar | V15 | 0 | 2 | 7 | 67% | -162 | `explorer-natvar-<w>-<theme>.png` |
| `/fac-team` | ftp | — | 0 | 0 | 3 | 97% | +8 | `fac-team-ftp-<w>-<theme>.png` |
| `/batch` | sps | V2 V18 V39 V7 V33 | 0 | 2 | 3 | 97% | +8 | `batch-sps-<w>-<theme>.png` |
| `/batch` | etp | V2 V18 V39 V7 V33 | 0 | 1 | 3 | 97% | +8 | `batch-etp-<w>-<theme>.png` |
| `/batch` | master | V2 V18 V39 V7 V33 | 0 | 1 | 3 | 97% | +8 | `batch-master-<w>-<theme>.png` |
| `/members` | sps | V32 K1 | 0 | 3 | 5 | 75% | -116 | `members-sps-<w>-<theme>.png` |
| `/members` | master | V32 K1 | 0 | 2 | 5 | 75% | -116 | `members-master-<w>-<theme>.png` |
| `/members` | sps | K1 V32 | 0 | 3 | 5 | 75% | -116 | `members-empty-sps-<w>-<theme>.png` |
| `/requests` | sps | V4 V18 | 1 | 2 | 3 | 97% | +8 | `requests-sps-<w>-<theme>.png` |
| `/requests` | etp | V4 V18 | 0 | 0 | 3 | 97% | +8 | `requests-etp-<w>-<theme>.png` |
| `/requests` | master | V4 V18 | 1 | 1 | 4 | 97% | +8 | `requests-master-<w>-<theme>.png` |
| `/requests` | master | V18 | 0 | 0 | 5 | 97% | +8 | `requests-reopen-master-<w>-<theme>.png` |
| `/stats` | sps | V18 V7 | 0 | 2 | 9 | 97% | +8 | `stats-sps-<w>-<theme>.png` |
| `/stats` | master | V18 V7 | 0 | 1 | 13 | 97% | +8 | `stats-master-<w>-<theme>.png` |
| `/leaders` | sps | V11 V18 V7 | 0 | 6 | 8 | 97% | +8 | `leaders-sps-<w>-<theme>.png` |
| `/leaders` | master | V11 V18 V7 | 0 | 5 | 8 | 97% | +8 | `leaders-master-<w>-<theme>.png` |
| `/board` | sps | V18 V28 | 0 | 1 | 21 | 97% | +8 | `board-sps-<w>-<theme>.png` |
| `/board` | etp | V18 V28 | 0 | 0 | 1 | 97% | +8 | `board-etp-<w>-<theme>.png` |
| `/board` | master | V18 V28 | 0 | 0 | 21 | 97% | +8 | `board-master-<w>-<theme>.png` |
| `/ready` | sps | V18 V7 | 0 | 2 | 3 | 97% | +8 | `ready-sps-<w>-<theme>.png` |
| `/ready` | master | V18 V7 | 0 | 1 | 3 | 97% | +8 | `ready-master-<w>-<theme>.png` |
| `/students` | sps | V18 | 0 | 1 | 1 | 97% | +8 | `students-sps-<w>-<theme>.png` |
| `/students` | etp | V18 | 0 | 0 | 1 | 97% | +8 | `students-etp-<w>-<theme>.png` |
| `/students` | master | V18 | 0 | 0 | 1 | 97% | +8 | `students-master-<w>-<theme>.png` |
| `/closing` | sps | V18 V7 | 0 | 2 | 1 | 97% | +8 | `closing-sps-<w>-<theme>.png` |
| `/closing` | master | V18 V7 | 0 | 1 | 1 | 97% | +8 | `closing-master-<w>-<theme>.png` |
| `/newbatch` | sps | V7 | 0 | 2 | 0 | 97% | +8 | `newbatch-sps-<w>-<theme>.png` |
| `/newbatch` | etp | V7 | 0 | 1 | 0 | 97% | +8 | `newbatch-etp-<w>-<theme>.png` |
| `/newbatch` | master | V7 | 0 | 1 | 0 | 97% | +8 | `newbatch-master-<w>-<theme>.png` |
| `/leaderboard` | sps | V31 (offline) V7 | 0 | 2 | 4 | 97% | +8 | `leaderboard-sps-<w>-<theme>.png` |
| `/leaderboard` | master | V31 (offline) V7 | 0 | 1 | 4 | 97% | +8 | `leaderboard-master-<w>-<theme>.png` |
| `/devotee/6000000011` | sps | V34 | 0 | 1 | 0 | 97% | +52 | `devotee-sps-<w>-<theme>.png` |
| `/devotee/6000000011` | master | V34 | 0 | 0 | 8 | 97% | +52 | `devotee-master-<w>-<theme>.png` |
| `/devotee/6000000011/week/2026-…` | sps | V34 | 0 | 1 | 2 | 97% | +52 | `devotee-week-sps-<w>-<theme>.png` |
| `/devotee/6000000011/week/2026-…` | master | V34 | 0 | 0 | 3 | 97% | +52 | `devotee-week-master-<w>-<theme>.png` |
| `/fill/6000000011/week/2026-10-…` | sps | V6 V5 | 1 | 3 | 0 | 97% | +52 | `fill-week-sps-<w>-<theme>.png` |
| `/fill/6000000011/week/2026-10-…` | master | V6 V5 | 1 | 2 | 0 | 97% | +52 | `fill-week-master-<w>-<theme>.png` |
| `/fill/6000000011/day/2026-10-2…` | sps | V6 V5 V2 | 1 | 3 | 15 | 97% | +52 | `fill-day-sps-<w>-<theme>.png` |
| `/overview` | master | V30 V13 V7 | 0 | 1 | 11 | 97% | +8 | `overview-master-<w>-<theme>.png` |
| `/analysis` | master | V19 V13 | 0 | 0 | 8 | 97% | +8 | `analysis-master-<w>-<theme>.png` |
| `/reports` | master | V13 | 0 | 0 | 10 | 94% | -13 | `reports-master-<w>-<theme>.png` |
| `/coordinators` | master | V13 V7 | 0 | 1 | 1 | 97% | +8 | `coordinators-master-<w>-<theme>.png` |
| `/access` | master | V30 V13 V15 | 0 | 0 | 0 | 61% | +8 | `access-master-<w>-<theme>.png` |
| `/facilitators` | master | V30 V13 V7 | 0 | 1 | 4 | 97% | +8 | `facilitators-master-<w>-<theme>.png` |
| `/phases` | master | V13 | 0 | 0 | 1 | 97% | +8 | `phases-master-<w>-<theme>.png` |
| `/batches` | master | V13 V7 | 0 | 1 | 1 | 97% | +8 | `batches-master-<w>-<theme>.png` |
| `/ids` | master | V13 V15 | 0 | 0 | 4 | 39% | +8 | `ids-master-<w>-<theme>.png` |
| `/activity` | master | V13 | 0 | 0 | 4 | 97% | +8 | `activity-master-<w>-<theme>.png` |
| `/settings` | master | V13 | 0 | 0 | 0 | 97% | +8 | `settings-master-<w>-<theme>.png` |
| `/welcome` | public | V36 | 0 | 0 | 0 | 27% | — | `welcome-public-<w>-<theme>.png` |
| `/login` | public | — | 0 | 0 | 0 | 27% | — | `login-public-<w>-<theme>.png` |
| `/signup` | public | V36 | 0 | 0 | 2 | 37% | — | `signup-public-<w>-<theme>.png` |
| `/forgot` | public | — | 0 | 0 | 0 | 29% | — | `forgot-public-<w>-<theme>.png` |

---

## (b) Defect register

Ranked by **who sees it** (everyone and devotees first, then facilitators/trainees, coordinators, the head) and
then by **severity**: S1 crossover/overlap > S2 cut text > S3 wasted space > S4 inconsistency > S5 polish.
Shots are relative to the screenshot folder above. "Fix" names the shared piece or token, so one change mends every
screen that uses it.

### Root cause first (every screen, every role)

| ID | Sev | What | Where | Why it looks unprofessional | Fix |
|---|---|---|---|---|---|
| **V14** | S3 | **The tablet/desktop layout tokens never apply.** Measured in the browser at 390/768/1024/1440: `--gutter` is 16 px, `--content-max` 1,120 px and `--nav-space` 74 px at every width. | `frontend/src/app.css:311` (`--gutter: 24px`), `:316` and `:327` (`--nav-space: 0px; --gutter: 32px`), `:345` (`--content-max: 1280px`) sit inside `@layer components`; the base values at `app.css:33–75` are **unlayered**, and unlayered rules always beat layered ones. | Phone margins on a laptop; the devotee page stops at 1,120 px on a 1,440 screen; every screen compensates with its own width (V15); at 768 the content keeps 74 px of empty space for a bottom bar that is not there. DESIGN_SYSTEM.md §4/§10 promise 16/24/32 and 1,120/1,280; neither is true. | Move the four overrides into the unlayered `:root` block (or put the base tokens in `@layer theme`). One edit; then re-screenshot everything, because every page width changes. |

### Everyone (devotees and staff)

| ID | Sev | What | Where (route · role · width · theme) | File:line | Why | Fix | Shot |
|---|---|---|---|---|---|---|---|
| **V2** | S1 | **Sticky elements slide under the top bar on computers** (same fault as U2): Batch status table header, the Day form's side rail under the day chips, the "Filling for …" bar under the day chips, My students' list pane, the offline bar. | `/batch` sps/master/etp ≥1024; `/day` devotee/trd ≥1024; `/fill/…/day` sps all widths; `/my-devotees/<x>` natvar ≥1024; found by the sweep at scroll 305 px and the end | Offsets hand-written per screen: `coord/BatchStatus.svelte:361` (`--bar-h`), `devotee/Day.svelte:485,501` (`--bar-h + 72px`), `devotee/Devotee.svelte:63` (`64px`), `fac/Fac.svelte:213` (`72px`), `app.css:388` `.sticky-top`, `:737` `.netbar`. The desktop top bar is `--bar-h` + 8 px padding (`app.css:338`), so anything stuck at `--bar-h` is 8+ px under it. | A header that is half hidden while scrolling looks broken. | One token `--sticky-top` (the top bar's real height per breakpoint) and a second `--sticky-2` for a layer under a sticky strip; replace all hand-written offsets. | `batch-sps-1024-light.png`, `day-devotee-1440-light.png` |
| **V9** | S2 | **"Log out" looks disabled on every desktop screen** (faded pink). | every route, every role, 1024/1440, both themes | `app.css:332` `.sidebar::after`: the "more below" fade is drawn over the last 40 px of the menu even when nothing is below. Also the cause of U9's "Log out half off". | A pale, washed-out last item reads as broken or disabled. | Show the fade only when the sidebar actually scrolls (a class set from `scrollHeight > clientHeight`), or pad the menu's end by the fade's height. | `home-devotee-1440-light.png` |
| **V8** | S2 | Sidebar profile line cut ("Coordinator · SPS, SPS Grou…", "Natvar Gopinath Prabh…" at 1024). Extends U9. | 28 route-role pairs, 1024/1440 | `ui/Menu.svelte:63` (`truncate` on name and role line) | The one place that says who you are is cut. | Two-line clamp for the role line; roles as small chips under the name. | `batch-sps-1024-light.png` |
| **V17** | S3 | **Quote carousel reserves the tallest quote's height**: 120–200 px of blank cream under short quotes on every Home. | `/home` all roles, all widths, both themes | `ui/QuoteCarousel.svelte:9` (all quotes share one grid cell) | A big empty box in the middle of the first screen. | Clamp the quote to ~6 lines with "Read more", or size the cell to the current quote with a height transition (tier-gated). | `home-devotee-320-light.png`, `home-devotee-390-dark.png` |
| **V15** | S3 | **Each screen has its own width, centred, while the title stays at the left edge.** At 1440: Songs/Reading/Hearing/Learn 672 px (59 %), Wall 880 with a lone "Refresh" pinned far right, Share 720 left-aligned, Change password 448, Explorer 768, Members 860, My students' student 648 at the right. Title 210 px left of the content on the reading screens. Extends U5 to 9 screens. | listed routes, 1024/1440 | `screens/Songs.svelte:182`, `devotee/Reading.svelte:45`, `devotee/Hearing.svelte:40` (`max-w-2xl`), `devotee/Wall.svelte:469` (42rem), `screens/Share.svelte:131,138`, `screens/ChangePassword.svelte:70`, `fac/Explorer.svelte:81`, `styles/screens.css:209` (`.members` 860), `styles/screens.css:283` (`.dform` 720), `devotee/History.svelte:51` | Three left edges on one screen (title, content, actions) is the clearest "not designed" signal on desktop. | Page-width tokens (section c, G1): `--page-read`, `--page-form`, `--page-full`; the page container holds the title on desktop so they share one left edge. | `wall-devotee-1440-light.png`, `songs-devotee-1440-light.png`, `reading-devotee-1440-light.png` |
| **V27** | S4 | Cards drawn 33 ways: padding 0 / 16 / 20, radius 12 / 15 / 16, shadow or not; two key-value styles side by side on Account (values right-aligned in the profile card, a left value column below). | all routes | `app.css:381` `.card` (16), `:382–383` `.section` (16 → 20 at 640), `.cblock` (20), `screens/Account.svelte` | Neighbouring cards that differ by 4 px look accidental. | One Card (radius 16, padding 16 phone / 20 desktop, optional header) and one key-value list. | `account-devotee-1440-light.png` |
| **V28** | S4 | Buttons in 48 size combinations (heights 36, 40, 42, 44, 52, 65; radius 12 or pill). **465 tap targets under 44 px at 390** on 73 route-role pairs: Report calendar days (35 per screen), Day form (15–27), the attendance board's P/A (40×40), Export (36 px, 24 screens), segment buttons (42), chips (40). | phones | `ui/ExportButton.svelte:18` (`btn-sm`), `styles/seg.css:8` (42), `styles/screens.css:314` `.chipbtn` (40), `styles/screens.css:50` `.cal-d` | Small, uneven buttons feel cheap and are hard to hit. | Control-height tokens: 44 on touch for every button, segment and chip; 36–40 allowed only under `(pointer: fine)`. | `report-devotee-390-light.png` |
| **V31** | S4 | **Errors shown as false "empty" states, three error patterns.** Offline: My targets says "No card yet" + "No connection, try again" (no button); History week shows a red banner + Try again over a blank page; Hearing/Reading say "Lectures/Books need a connection."; coordinator Leaderboard says "No class batch — A leaderboard is for a class batch you coordinate" (wrong: sps coordinates SPS). | `/card`, `/history/<w>`, `/hearing`, `/reading`, `/leaderboard` (sps), offline, 390/1440 | `screens/Card.svelte:218`, `coord/Leaderboard.svelte:108` (`{#if !batchId}` also true when the list failed to load) | A wrong message is worse than none; mixed patterns look unplanned. DESIGN_SYSTEM §7.10 asks for: what happened + Retry + what is safe. | One ErrorState (title, safe line, Retry) distinct from EmptyState; screens test "failed" before "empty". | `card-devotee-390-light-offline.png`, `history-week-devotee-390-light-offline.png`, `leaderboard-sps-1440-light-offline.png` |
| **V26** | S4 | Page headers drawn many ways (30 heading styles): serif h2 22 px page-head (Batch, Overview), uppercase 12 px overline h2 (Home, Account), `block-h` h2, screen-reader-only h2 with a grey paragraph (Facilitators, IYF IDs), the top-bar title then a second big title (Home "Home" + "Hare Krishna"; trainee card "ETP · Batch 21" three times). | all routes | `styles/screens.css:337` `.page-head`; h2 variants in `coord/Batch.svelte:94`, `master/Overview.svelte:37`, `master/Facilitators.svelte:144`, `screens/DevoteeHome.svelte:119,220`, `screens/Card.svelte:223` | No predictable "where am I / what can I do here" line. | One PageHeader (G2): title (from the route on desktop), one meta line, one actions slot on the same row. | `batch-etp-1440-light.png`, `card-trainee-390-light.png` |
| **V29** | S4 | Toolbars mix bordered buttons, plain-text toggles and links on different baselines (Batch status: Search · Nudge · *Compact* · *Refresh*; Wall: "Refresh" alone at the far right; All batches: Refresh + Export on a row of their own). | `/batch`, `/wall`, `/overview`, all widths | `coord/BatchStatus.svelte` (`bd-find`), `devotee/Wall.svelte`, `master/Overview.svelte` | Controls that do the same kind of thing look different. | Toolbar pattern in G2: one row, icon buttons for Refresh/Export, toggles as a Seg. | `batch-sps-1024-light.png`, `wall-devotee-1440-light.png` |
| **V34** | S5 | Title and content start 8 px apart on every staff screen at desktop (+8), 42–52 px on devotee detail, Day and Fill-for. | staff ≥1024 | `app.css:338` (top bar padding) vs `.content` children | Small misalignments add up to "slightly off". | Solved by G1/G2 (title inside the page column). | `students-etp-1440-light.png` |

### Devotees (the most users)

| ID | Sev | What | Where | File:line | Why | Fix | Shot |
|---|---|---|---|---|---|---|---|
| U3 | S1 | *(known)* "Refrain" over the first line, **at all 5 widths, both themes**. | `/songs/s034` devotee | `screens/Songs.svelte:282–283` (label column `2.25rem`) | — | Label above the stanza, or a column sized to the word. | `song-devotee-320-light.png`, `song-devotee-1440-light.png` |
| **V16** | S3 | **Home's two columns leave a hole**: at 1440 the left column ends ~500 px above the right one (darshan + quote); the "More" tiles leave "Share today" alone on a second row. | `/home` devotee/trd/trainee ≥1024 | `screens/DevoteeHome.svelte` (two-column grid, `align-items: start`), `:192` (tile grid) | A large empty patch on the first screen people see. | Dashboard layout rule (G8): the tall darshan card spans its own row, or columns that balance; tile grid with `auto-fill`. | `home-devotee-1440-light.png` |
| **V10** | S2 | Announcement teaser cut ("Ekadashi kirtan this S…", its body to one line); "Share today" cut at 320. | `/home` devotee/trd/trainee 320–1024 | `screens/DevoteeHome.svelte` (`span.at`, `span.ab`, `span.qt`) | The one news item on Home loses its point. | 2-line clamp for the title; tile labels wrap. | `home-devotee-320-light.png` |
| **V23** | S4 | This week repeats every "opens at" message twice: the status list ("Night Stay … open on Saturday at 6 PM", "Attendance opens on Sunday", "Submit opens Sun 6:00 PM") and again in the End of week / Attendance / Submit cards; the Attendance card says "Attendance" twice; a paragraph explains auto-submit (against the no-explanation rule). | `/week` devotee/trd/trainee, all widths | `devotee/Week.svelte:77–80` (status list) and `:254` (cards) | Repetition makes the page twice as long and reads as filler. | Keep the status list as the single place for "when"; the cards show only the action. | `week-devotee-1440-light.png` |
| **V24** | S4 | Song page has three alignments: centred header, right-aligned size switch, left-aligned lyrics and translation. Related to U5. | `/songs/s034` ≥768 | `screens/Songs.svelte` (`sg-head`, size Seg) | No single axis for the eye. | Left-align the header to the text column; size switch in the header row. | `song-devotee-1440-light.png` |
| **V25** | S3 | The composer chip row is a one-line scroller cut mid-name on desktop ("Visvanatha Cakravarti Thakur…"); with a mouse it is not obviously scrollable. Related to U6. | `/songs` ≥1024 | `styles/screens.css:307–311` (`.chiprow.one-line`) | Looks cut, not scrollable. | Chip-row rule (G6): on pointer devices wrap into balanced rows or show a "More…" chip. | `songs-devotee-1440-light.png` |
| **V21** | S4 | Report at 768: Daily/Weekly switch and month/year pickers sit right-aligned, away from the cards' left edge; the Activity score card is 230 px tall beside a 540 px calendar. | `/report` devotee/trd 768 | `devotee/Report.svelte:181` (`.rp-mode`), `styles/screens.css:44` | Ragged edges and a half-empty column. | Controls on the cards' left edge (G2 toolbar); empty score card spans or shrinks. | `report-devotee-768-light.png` |
| **V22** | S5 | Day form: Chetna chips wrap leaving "Overate" alone on a row (320/390); "Duration" label sits flush under the Topic/Book pickers (others have 12 px). | `/day` devotee/trd, `/fill/…/day` | `styles/screens.css:303` (`.chiprow`); the WheelSelect field's bottom margin (`ui/WheelSelect.svelte`) | Uneven rhythm on the most-used form. | Chip-row rule (G6); one field-spacing token for every field type. | `day-devotee-390-light.png` |
| **V35** | S5 | Dark theme: the quote panel's warm brown sits on cool navy cards. | `/home` dark | `ui/QuoteCarousel.svelte` (gold wash) | Slightly muddy. | Derive the panel from `--surface-elevated` with a small gold mix. | `home-devotee-390-dark.png` |
| **V36** | S5 | Sign-up / welcome: the painting's corner watermark peeks out under the "What happens next" card. | `/signup`, `/welcome` 1440 | `styles/auth.css:81,93` (`auth-side`) | Visible artefact on the first screen. | `object-position` or crop the art. | `signup-public-1440-light.png` |

### Facilitators, trainees and anyone with a card

| ID | Sev | What | Where | File:line | Why | Fix | Shot |
|---|---|---|---|---|---|---|---|
| **V1** | **S1** | **The "Every week / Not for me" switch sits on top of its own label** ("Sunday VL-2 / [hidden]", "FTP traini…", "Facilitation journal …"). 6 overlaps per card. | `/card` devotee, trainee, natvar, sps, master · **1024** · light + dark | `screens/Card.svelte:427` (two card columns from 1024 px, ~340 px each), `:440` (label and control side by side), `:444` (`seg` min 9rem), `:450` (label cannot break "facilitation"), `:454` (stacking only below a 420 px *viewport*) | Text under a control is the clearest crossover there is. | Responsive form row (G7): a container query on `.cd-row` (stack when the row is narrower than ~30rem), `overflow-wrap: anywhere` on `.cd-label`. | `card-trainee-1024-light.png`, `card-natvar-1024-dark.png` |
| **V20** | S3 | My targets is 3,900 px long at 390: every number input sits alone on its own line under its label. | `/card` all, 320/390 | `screens/Card.svelte:454–457` | Endless scrolling for a short form. | Keep the 6.5rem number input on the label's row; stack only the two-option switches (G7). | `card-trainee-390-light.png` |
| **V12** | S2 | "Whole training" wraps to two lines inside a segment. | `/scoreboards` etp/master/trainee, all widths | `styles/seg.css:8` (`min-width: 0`, wrapping allowed) | A broken-looking control. | Seg labels `white-space: nowrap` with the segment sized to its longest label (G6). | `scoreboards-etp-1440-light.png` |
| **V37** | S5 | My students › student: the "Older weeks" picker shows "26 Oct – 1 Nov · This week". | `/my-devotees/<x>` natvar | `fac/Fac.svelte` (`fd-any` WeekPicker) | Contradicts its own label. | Start the picker on the last finished week. | `my-devotees-student-natvar-390-light.png` |
| **V38** | S5 | Trainee card: "ETP · Batch 21" in the top bar, as an overline and as the h2. | `/card` trainee | `ui/Shell.svelte:58`, `screens/Card.svelte:223` | Triple title wastes the top of the screen. | PageHeader rule: the top bar owns the title (G2). | `card-trainee-390-light.png` |

### Coordinators (class and training)

| ID | Sev | What | Where | File:line | Why | Fix | Shot |
|---|---|---|---|---|---|---|---|
| **V3** | **S1** | Count strip on staff Home: "Not started" runs into "Missed". | `/home` sps/etp **320** | `ui/ScopeStrip.svelte:32` (four equal 72 px columns) | Two labels touching read as one word. | Container query: 2×2 under ~340 px, or shorter labels ("Not yet"). | `home-sps-320-light.png` |
| **V4** | **S1** | Sign-up card: the Level-entry date field covers the facilitator's name, which is cut to 51 px ("Natvar…"). | `/requests` sps/master **1024** | `coord/SignUpCard.svelte:188` (and its row grid), `coord/Requests.svelte:189` | Overlapping fields on the screen where coordinators approve people. | Responsive form row (G7). | `requests-sps-1024-light.png` |
| **V5** | S1 | "Filling for Aarav …" bar: the "Done" button's area runs 12 px over the cut name. | `/fill/…` sps/master **320** | `devotee/Devotee.svelte:63` (`.acting`) | Cramped; the name is the point of the bar. | Name on its own line at 320; button below or icon-only. | `fill-week-sps-320-light.png` |
| **V6** | S2 | **The Fill-for title never shows the person's name**: "Fill for · Week" / "Fill for · Day" at every width (cut to "Fill for …" at 320). | `/fill/…` sps/master, all widths | `ui/Shell.svelte:25` strips `?n=` from the path before `:59` calls `titleOf`; `routes.js:48–50` reads the name from `?n=` | The coordinator cannot see whose week they are editing in the title. (Also a wiring bug, not only visual.) | Pass `route.path` (with its query) to `titleOf`. | `fill-week-sps-1440-light.png` |
| **V7** | S2 | *(K2, now measured)* **17 top-bar titles cut at 320 on 32 route-role pairs**, all staff: Batch status, All batches, Batch setup, Close batch, Coordinators, Facilitators, Filling chart, Group leaders, Leaderboard, My targets, New batch, Ready to move up, Scoreboards, Announcements, Fill for, and the brand on staff Home. Devotee titles all fit. | staff, 320 | `ui/Shell.svelte:213` (`96px minmax(0,1fr) 96px` when the search button is shown), `app.css:258` (`.pagetitle` nowrap + ellipsis) | A cut title on the first line of the screen. | At ≤ 360 px: search button moves into the menu or the title area becomes left-aligned with a 48 px left column; or short titles per route. | `batch-sps-320-light.png`, `overview-master-320-light.png` |
| **V11** | S2 | Group leaders list at 320: names cut ("Aarav Gupt…", "Sunil Kum…"), same pattern as K1. | `/leaders` sps/master 320 | `coord/Leaders.svelte:105` (`truncate` beside call/message buttons) | Names are what the list is for. | List row (G5): name line gets the full width, actions on the meta line or in ⋯. | `leaders-sps-320-light.png` |
| **V13** | S2 | Tab strips hide most tabs: the head's Admin strip has 12 tabs (4–8 hidden at 320–768; at 768 the scrolled-off tabs sit behind the rail); Batch tabs read "Fillir…" at 320 and "…atus" at 768. | `/overview` … `/settings`, `/batch` …, 320–768 | `ui/Tabs.svelte:43–46`, `master/Admin.svelte:33,48`, `coord/Batch.svelte` | Navigation that looks cut. | Tabs rule (G6): at most 5 visible + "More" sheet; at 600–1023 the rail already lists the sections, so drop the duplicate strip there. | `access-master-768-light.png`, `analysis-master-320-light.png` |
| **V18** | S3 | **Batch status and its siblings waste the top and the rows**: at 1024, ~300 px of controls before the first devotee; "Export" wraps alone onto its own row (13 % filled) on 10 coordinator screens at all widths; at 320 each devotee row is ~145 px tall for three facts ("Not started / Nothing filled since Mon / Opens Sun"). | `/batch`, `/board`, `/closing`, `/leaders`, `/ready`, `/stats`, `/students` sps/master; rows at 320/390 | `coord/Batch.svelte:89–96` (`.page-head` + `ExportButton … ml-auto self-end`), `coord/BatchStatus.svelte:195–230` (`brow`) | The list people came for starts below the fold. | Toolbar row (G2): batch picker · week stepper · Export as one row; compact two-line row (G5) with the attendance pill on line 1. | `batch-sps-320-light.png`, `batch-sps-1024-light.png` |
| **V39** | S5 | Five count tiles at 320 are cramped ("Submitted", "Not started" touch the tile edges). | `/batch` sps 320 | `ui/ScopeStrip.svelte:32` (`sc-five`) | Crowded. | Same container query as V3. | `batch-sps-320-light.png` |
| **V32** | S4 | Devotees list: rows with a ⋯ button shift Call/Message left, so the action column does not line up. | `/members` sps/master ≥768 | `coord/Members.svelte:127–133` (`mrow-act`) | A ragged right edge in a table-like list. | List row (G5): the trailing slot always reserves the ⋯ width. | `members-sps-768-light.png` |
| **V33** | S4 | Two batch pickers on desktop (sidebar and page); staff Home shows the darshan painting although DESIGN_SYSTEM §7.2 says "never in staff areas". | `/batch` …, `/home` sps ≥1024 | `ui/Menu.svelte`, `coord/Batch.svelte`, `coord/StaffHome.svelte` | Duplicated controls; a rule broken silently. | Decide one picker place; the head decides on darshan for staff (it may be wanted for coordinators who are devotees). | `home-sps-1024-light.png` |

### The head

| ID | Sev | What | Where | File:line | Why | Fix | Shot |
|---|---|---|---|---|---|---|---|
| **V19** | S3 | Analysis at 320: 13 stat tiles one per row, ~1,050 px for 13 numbers. | `/analysis` master 320 | `master/Analysis.svelte:176` (`minmax(9.5rem, 1fr)` does not fit twice in 288 px) | Long scroll of nearly empty boxes. | `minmax(8.5rem, 1fr)` or two fixed columns under 420. | `analysis-master-320-light.png` |
| **V30** | S4 | Explanatory paragraphs against the project rule ("No explanatory paragraphs"): All batches ("Inactive by itself after 30 days…"), Access ("Give a person a role, and give or take away what they may do."), Facilitators ("Names switched on are offered…"), plus This week's auto-submit paragraph (V23). | `/overview`, `/access`, `/facilitators` | `master/Overview.svelte`, `master/Access.svelte`, `master/Facilitators.svelte:144` | Paragraphs make admin screens look like documentation. | Move to How to use; keep only consequences before irreversible steps. | `overview-master-320-light.png`, `access-master-768-light.png` |

### Known items, reconfirmed (not counted above)

| Known | Seen in this audit |
|---|---|
| U2 "‹ All songs" under the title bar | Not visible at the top of the page in the mock; the same mechanism is measured on 5 other screens (V2). Root: hand-written sticky offsets. |
| U3 "Refrain" overlap | Yes, all 5 widths, both themes (`song-devotee-*`). |
| U4 title band not full width | Cause in code: `app.css:338` gives the desktop top bar `max-width: var(--content-max)`, so its glass band stops at 1,120 px. |
| U5 wasted width on Songs | Yes; and the same on 8 more screens (V15). |
| U6 chips on two near-empty rows | With fresh data the type chips fill row 1; the composer row is a one-line scroller cut at the edge (V25). Day/Reports chip rows still orphan (V22). |
| U7 heavy song-books card | Yes (~200 px before the search on desktop). |
| U8 "Pranama Mantras · 1" | Yes. |
| U9 sidebar role line cut, Log out half off | Yes; the faded Log out is caused by the sidebar fade (V9). |
| K1 names cut in Members at 320 | Yes ("Lalit Ch…", "Manish Ti…"); also in Group leaders (V11). |
| K2 top-bar title cut at 320 | Yes, measured: 17 titles, 32 route-role pairs, staff only (V7). |

---

## (c) Design-system gaps the defects point to (input for Phase 24 item 2)

| # | Gap | What to write down | Screens it would fix |
|---|---|---|---|
| **G1** | **Layout tokens that apply, and page widths per breakpoint** | Fix the cascade (V14). Then three page widths: `--page-read` (≈ 720 px, prose and songs), `--page-form` (≈ 560 px, password, sign-up), `--page-full` (the content max: 1,120 → 1,280 devotee, 1,440 staff). Gutters 16 / 24 / 32. The page container, not the top bar, sets the left edge, and the desktop title sits inside it. | V14, V15, V24, V34, V21, U4, U5; every desktop screen |
| **G2** | **Page header and toolbar** | One PageHeader: title (the top bar's on phones; in the page on desktop), one meta line, one actions slot on the same row, wrapping as a whole. Toolbar: search left, icon buttons (Refresh, Export) right, toggles as Seg. No second title repeating the bar. | V26, V29, V18, V38, V30, V21; Batch, Board, Closing, Leaders, Ready, Stats, Students, Wall, Overview, Analysis, Access, Card |
| **G3** | **Sticky bars** | Token `--sticky-top` = the top bar's real height per breakpoint (+ safe area); `--sticky-2` for a second layer (day chips, pinned search); a z-index ladder (`--z-sticky` < `--z-bar` < `--z-nav`); at most one sticky strip per page on phones. The title band spans the main area (U4). | V2, U2, U4; Batch status, Day, Fill-for, My students, Songs, offline bar |
| **G4** | **Card and key-value list** | One Card: radius 16, padding 16 (phone) / 20 (≥ 640), optional header (icon + h3 + action), shadow-1. One key-value list (label column 40 %, value left-aligned, 12 px rows). | V27, Account, Devotee detail, Overview, Home |
| **G5** | **List row** | Two-line row: line 1 name (gets the width) + status pill; line 2 meta. Trailing slot of fixed width that always reserves the ⋯ even when empty. 56 px comfortable / 48 px compact. On phones, call/message move into ⋯ or line 2. | V11, K1, V32, V18 (rows), V39; Members, Group leaders, Batch status, My students, Requests |
| **G6** | **Chip row, segment, tabs** | Chip rows: wrap with balanced rows (no row under ~35 % full; use a fixed grid where options are known), or a one-line scroller with a visible "More…" on pointer devices. Segments: labels never wrap; size to the longest label. Tabs: ≤ 5 visible + "More"; no tab strip where the rail/sidebar already lists the sections. | V12, V13, V22, V25, U6; Day, Songs, Reports, Scoreboards, Admin, Batch |
| **G7** | **Responsive form row** | Label + control decide their layout from their own width (container queries), not the viewport. Long labels wrap with `overflow-wrap: anywhere`. Small inputs stay on the label's row; only wide controls stack. | V1, V20, V4, V3, V5; My targets, Requests sign-up card, staff Home strip, Fill-for bar |
| **G8** | **Dashboard (Home) layout** | Two columns from 1024 with a balancing rule (tall media spans a row; or the left column takes the status + needs + tiles, the right column the devotional block, with a shared bottom). Quote block sized to its quote. Tile grids `auto-fill` so no lone tile. | V16, V17, V10, V33; devotee Home, staff Home, head Home |
| **G9** | **Empty, loading and error states** | Three components with different looks: Loading (skeleton of the real layout), Empty (icon, title, when it fills, one action), Error (what happened, what is safe, Retry). A screen checks "failed" before "empty". One wording for "no connection". | V31; My targets, Leaderboard, History, Hearing, Reading, Share, Shared |
| **G10** | **Control sizes** | `--ctl-h` 44 on touch for every button (including `btn-sm`), segment and chip; 36–40 only under `(pointer: fine)`. Calendar day cells ≥ 44 × 44 at 320 (smaller gaps). | V28 (465 small targets on 73 pairs), Report, Day, Board, Export everywhere |
| **G11** | **Sidebar and top bar** | Profile: name + roles on two lines (chips), never ellipsis. Bottom fade only when the menu scrolls. Top bar at ≤ 360 px: one icon each side, title left-aligned, so titles fit. Fill-for title from the full route. | V8, V9, U9, V7, K2, V6 |

---

## (d) Controls no browser check exercises

Method: the visible controls of every route-role pair (light theme, 390 and 1440; 1,223 control instances) were
matched against `tools/browser/verify.mjs` by id, label, link or class selector. That is a **text match, not proof of
a click**: a name in verify.mjs means a check mentions it. The first pass flagged 140 instances; I then checked the
largest groups by hand and **removed the false alarms** (the Batch status "More for …" menu, verify.mjs:1035; the
Theme row, :1601; the song's Previous/Next, :2966; the Requests type filter `rq-types`; the Reports "Sections"
picker; the shared-week stepper `fd-any`). What remains is **unverified**. Nothing destructive was clicked; this is
a list, not a test run.

| Route · role | Unverified controls |
|---|---|
| `/day`, `/fill/…/day` · devotee, trd, sps | "Set time" for **Woke up at** and **Chanting finished at** (`#f-wokeAt-btn`, `#f-chantingDoneAt-btn`); "Completed the same day? **No**"; the jump chips **Seva** and **Chetna** (1440) |
| `/card` · devotee, trainee, natvar, sps, master | **"Not for me"** on every measure (the switch inside V1) |
| `/scoreboards` · etp, master, trainee | **"Whole training"** switch |
| `/board` · sps, master; `/devotee/<x>` · master | Attendance **P / A** buttons (`bd-mk`) |
| `/devotee/<x>` · sps, master | **"More actions — Inactive, disable, photo, delete"** disclosure |
| `/members` · sps, master | Status filter **All / Active / Disabled** (only "Inactive" is named in verify.mjs); the row **"More for …"** menu (`mrow-del`) |
| `/batch` · sps, master | **"Not active (2)"** disclosure is read, not opened |
| `/requests` · sps, master, etp | Filter **"Resets"** and **"All"**; sign-up card's IYF ID choice radios ("Not in the registry yet — approve with no ID", "KT26-0042 · …") |
| `/requests?type=reopen` · master; `/activity` · master | **Dismiss** (×) on a notice |
| `/group` · devotee (group leader) | **Week before / after** (`#gl-wk-prev/next`), the week label picker, a member's ring button ("Deepak Yadav: 2 of 7 days") |
| `/my-devotees`, `/my-devotees/<x>` · natvar | **Week before / after** (`#fc-wk-prev/next`), the "3 submitted" group disclosure (`fc-h`), the row ring links (`a.rg`) |
| `/explorer` · natvar | **"Qualify"** |
| `/leaderboard` · sps, master | Period **"Dates"** |
| `/facilitators` · master | **"Manage the login of …"** |
| `/coordinators` · master | Row **"More for …"** at 390 |
| `/home` · every role | Quote **"Previous quote"** (only "Next quote" is named) |
| `/wall` · devotee, sps, master | **Like**; **Share on WhatsApp** link in the share sheet |
| `/reading` · devotee | Book collection disclosures ("Srila Prabhupada Lilamrta · 6 PDFs", "Transcendental Diary · 4 PDFs") |
| `/songs/<id>` · devotee | Text size **Small / Medium** (only "Large" is named) |
| `/songs?q=…` · devotee | **"Clear the search"** |
| `/batch`, `/board`, `/newbatch`, `/students` · etp at 390 | The **"Board"** tab (`#bt-t2`) for the training coordinator |
| `/signup` · signed out | "Is this number on WhatsApp? **No**" |
| `/home` · sps | **Call** links in "People to nudge" (tel:) |

---

## (e) Proposed rebuild order (route groups)

One phase, one gate, one release (the project's rule); within the phase, build in this order so the most-used
screens are checked first and every later group starts from the fixed shared pieces.

| Step | Group | Why this order | Defects closed |
|---|---|---|---|
| 0 | **Shared pieces and tokens**: cascade fix (G1), sticky token (G3), control sizes (G10), sidebar/top bar (G11), Card (G4), PageHeader + toolbar (G2), ErrorState (G9) | One change reaches all 104 pairs; re-screenshot everything afterwards because every desktop width moves. | V14, V2, V8, V9, V28, V34, V6, V7, V27, V31, U4 |
| 1 | **Devotee daily path**: Home, This week, Day, Report, History | Every devotee, every day, mostly on low-end phones. | V16, V17, V10, V23, V21, V22, V35 |
| 2 | **Devotee reading and sharing**: Songs (U-list), Reading, Hearing, Wall, Share / Shared, My group, Account, Change password | Same users; mostly width (G1) and chip rows (G6). | U2–U8, V15, V24, V25 |
| 3 | **Cards and facilitation**: My targets, Scoreboards, My students, Explorer, FTP Facilitators | The worst crossover (V1) and the longest phone page (V20). | V1, V20, V12, V37, V38 |
| 4 | **Coordinator batch screens**: Batch status, Devotees, Requests, Group leaders, Filling chart, Board, Ready, Students, Close batch, New batch, Leaderboard, Devotee detail, Fill for | List row (G5) and form row (G7) applied together. | V3, V4, V5, V11, V13 (batch tabs), V18, V32, V33, V39, K1 |
| 5 | **The head's admin**: All batches, Analysis, Reports, Coordinators, Access, Facilitators, Phases, Batch setup, IYF IDs, Activity, Settings | Few users, desktop mostly; tab strip and paragraphs. | V13, V19, V30 |
| 6 | **Signed-out screens**: Welcome, Log in, Sign up, Forgot | Already the most polished; art crop only. | V36 |

Acceptance per group, as the Phase 24 plan says: its browser part green, the five widths in both themes looked at,
0 sideways scroll, 0 overlaps in the sweep (the sweep script can be moved into `tools/browser/` as a gate part), and
speed and screen-reader budgets unchanged or better. The unverified controls in (d) for that group get a check in
the same step.
