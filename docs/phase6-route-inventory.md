# Phase 6 route migration inventory

Prepared during Phase 5 (core components), 4 Oct 2026. Read-only survey of `frontend/src` on branch `phase5`; **nothing here was redesigned in Phase 5.** Line numbers are from that branch.

## What Phase 6 can use

| Need | Use | Not |
|---|---|---|
| Any dialog, confirm, picker, form-in-a-sheet | `ui/Sheet.svelte` (bottom sheet < 600 px, centred above; tap outside, Escape, focus return; `dismiss={false}` for long forms) | inline `.confirm` boxes, new `<dialog>` |
| A row in a list | `ui/Row.svelte` inside `<ul class="list">` (`icon`/`lead`, `title`, `sub`, `end` snippet, chevron when `href`) | `.action`, `.rowlink`, `.card` per row, hand-built `li.lrow` |
| A state ("Submitted", "Missed", "Inactive") | `ui/Status.svelte` (dot + word) | `.pill` (keep pills for counts, scores, tags) |
| Counts | `.stats` / `.stat` tiles | `.seg.stat-seg` spans that look like buttons |
| The one key thing on a screen | `.hero-card` (one per screen) | a `.section` with a big number |
| A unit of content | `.cblock`; plain headed section when no box is needed | `.section` around everything; cards in cards |
| Notices | `ui/Banner.svelte` | hand-built `<p class="banner">` |
| Empty / loading | `ui/EmptyState`, `ui/Skeleton` | `EmptyState class="card"` |

## Cross-cutting problems (fix as each route is touched)

- **`.section` is still the default page body.** Only DevoteeHome uses `.hero-card`/`.cblock`.
- **36 px targets:** `btn-sm`. Used in Board, Members, Leaders, Wall, LectureList, BookList, BookFiles, SignUpCard, Ids, Settings, Coordinators and Batches.
- **40 px segments and filters:** Members `.mb-seg` and `.mb-row .input`; Report `.rp-mode`.
- **`min-h-8`/`min-h-9` links:** Board Fill (175), LectureList (52), Activity (51).
- **Inline confirms nested in cards:** DevoteeDetail, Reopens, Ids, Leaders, Wall, Week (213), Profile (133). Move these into `Sheet`.
- **Heading skips (h1 → h3):** ScoresView, Report, Wall, ChangePassword, WeekRead, Stats, admin Groups, and the multi-batch Batch shell (no h2).
- **Hover-only:** `title` tooltips (Board strip 168, Wall Pinned 219, Facilitators 122, Overview sparkline 45). Ungated `:hover` rules: Wall `.post-bar` (286) and WeekRead `.wr-day` (87).
- **`aria-label` on non-interactive elements:** Welcome (15), Plain (14), DevoteeHome (147). Also `aria-disabled` on a span (Day 188) and a `span.btn` used as a fake button (DevoteeDetail 135).
- **Hard-coded colours** (CSS only, not in markup): `controls.css:19`, `screens.css:13, 86, 89, 207, 209`. Most are photo-crop and lightbox blacks, which is acceptable. Check the gold fallback in `screens.css:13`.

## Routes, in the Phase 6 order

### Devotee

| Route | Current UI | Legacy patterns | Reusable now | Responsive / a11y | Recommended approach |
|---|---|---|---|---|---|
| `#/home` devotee (`DevoteeHome`) | greeting, hero, week cblocks, quotes, teaser, quick actions | none: the reference screen | — | a non-interactive `aria-label` (147) | keep; use as the pattern for others |
| `#/home` staff (`Home`) | Row list + `.section` of stats | `.section` around stats (53) | stat tiles, hero | — | "Waiting for you" as hero + stat tiles |
| `#/week/<id>` (`Week`) | ring header, 4 `.section`s in `.grid2` | list inside a box (160); hand-built banners (191, 198, 206); inline alertdialog confirm (213) | Row/Status (done), Banner, Sheet | — | Submit as hero; Days a bare `.list`; end-of-week and attendance as cblocks; confirm → Sheet |
| `#/history` (`History`) | 2-column `.action` cards | `.action` per row (33, 39) | Row + Status | no heading | one grouped list |
| `#/history/<w>` (`ScoresView`) | `section today` + 2 sections | two box classes on one element (41) | hero, cblock | h1 → h3 (48, 52) | score + Share as hero, bars in cblocks |
| `#/report` (`Report`) | seg bar, `.grid2` of sections | `.action` per week (153); 40 px `.rp-wsel` | Row, Seg, cblock | `role=grid` with no rows (115); % only in aria-label (128); calendar cells ~33 px at 320 | calendar cblock; selected day as hero; weeks as `.list` |
| `#/hearing` (`Hearing`, `LectureList`) | one section: progress + `.action` stack | `.action` per lecture (48/58/68); arbitrary-value chip state; hand-made progress bar; Suggested as pill | Row, hero, Status | `min-h-9` link; `btn-sm` Choose | progress as hero; lectures as Row list |
| `#/reading` (`Reading`, `BookList`, `BookFiles`) | current-book section + `.bk` boxes | arbitrary chip (Reading 37); `.rowlink` volumes; `.bk` per book | hero, Row, Sheet | `btn-sm` Choose | current book as hero; books as Row list; volumes in a Sheet |
| `#/wall` (`Wall`) | compose `form.section`, `.section.post` cards in `.grid2` | Pinned as pill (219); raw comment input (255); `btn-sm` post menu; nested `.confirm` | Sheet, TextInput, Status | 2-column feed at ≥ 768 hurts long posts; 42 px input; h1 → h3 | single-column cblock posts; compose, edit and remove in Sheets |
| `#/group` (`Group`) | page head, stat-seg, board, action bar | `.stat-seg` spans (88) | `.stats` | dashed border alone = "their own mark" | stat tiles + board (already close) |
| `#/day/<w>/<d>` (`Day`, pickers) | chip nav, `.dform` (already unboxed), action bar, 2 Sheets | `.rowlink` per topic (242); raw inputs in BookPicker (27) and HearingPicker (23); `.well` book (261) | Row, TextInput, IconButton | identical `aria-label="Remove topic"` (243); `btn-sm`; label paragraphs not tied to groups | topics as Row list; TextInput; 44 px remove buttons named per topic |
| `#/account` (`Account`, `Profile`, `EditSection`) | ~8 stacked `.section`s | `.section` everywhere | hero, Row list, Sheet | — | settings-style grouped list; edits open Sheets |
| `#/change-password` | one `.section` | — | cblock | h1 → h3 (63) | cblock |

### Staff

| Route | Current UI | Legacy patterns | Reusable now | Responsive / a11y | Recommended approach |
|---|---|---|---|---|---|
| `#/batch` (`Batch` › `Board`) | WeekPicker, stat-seg filters, Search, board, Sheet | hand-built banner (139) | Banner (Status done) | Fill `min-h-8` (175); `btn-sm` (142, 147); hover-only strip titles | 44 px links; Banner; otherwise keep |
| `#/members` / `#/devotees` (`Members`) | filters, `.mrow` list, Sheet | — | Row with Photo lead | 2×2 filters at 320; 40 px filters | Row-ify `.mrow`; 44 px filters |
| `#/leaders` / `#/groups` (`Leaders`) | appoint section + a section per group | `.gl-n` count pill (150); inline confirm (116) | Row list, Sheet | member links text-height (101); `btn-sm` | grouped lists under headers; remove in Sheet |
| `#/stats` (`Stats`) | 4 sections | `.rowlink` missed weeks (66) | hero, Row | h1 → h3 | this week as hero tiles; lists as Row |
| Birthdays (on staff Home) | section + rowlinks | `.rowlink` (20) | Row | — | Row list |
| `#/requests` (`Requests`, `SignUpCard`) | `.grid2` of `.card` | card per request; card in `.well` in card (SignUpCard 144); "No email" as pill; `EmptyState class="card"` | Row, Sheet, Status | `btn-sm` contact buttons | **biggest staff win**: Row summaries; approval form in a Sheet |
| `#/devotee/<login>` (`DevoteeDetail`) | 7 sections | `.well` per membership/week with `.confirm` inside (3 deep); score as pill | hero, `.kv`, Row, Sheet | fake `span.btn` (135) | hero (photo, name, call) + 2-column cblocks; every action in a Sheet |
| `#/devotee/<l>/week/<w>`, `#/my-devotees/<l>/<w>` (`WeekRead`) | one section | `.cal-pill` (92) | hero, Row | h1 → h3 (62); ungated hover (87) | hero + list |
| `#/fill/...` (`Devotee` → Week/Day) | reuses Week/Day | hand-built banner (44) | Banner | — | Banner |
| `#/my-devotees` (`Fac`) | stat-seg, `.mrow` list; detail: 2 sections with Row in a gapped `ul` | stat-seg (86) | `.stats`, `.list` | — | stat tiles; detail as hero + `.list` |

### Admin (`#/overview` … `#/settings`, one Tabs shell)

| Route | Current UI | Legacy patterns | Reusable now | Responsive / a11y | Recommended approach |
|---|---|---|---|---|---|
| `#/overview` | stats section + `.action` per batch | `.action` (41) | hero, cblock / Row | sparkline tooltips (45) | stats as hero; batches as Row list |
| `#/coordinators` | `.list.tbl-narrow` + table ≥ 900, 3 Sheets (done) | hand-built `li.lrow` + avatar (134) | Row | `size="sm"` buttons | Row for the narrow view |
| `#/facilitators` | `form.card`, list | state pills (120–121); raw `role=switch` input (125) | Status, `ui/Toggle`, Sheet | hover title (122) | Status + Toggle; Add in a Sheet |
| `#/batches` | narrow list + table, Sheet (done) | hand-built `li.lrow` (76); `EmptyState class="card"` | Row | `btn-sm` (90) | Row |
| `#/ids` | Seg, `.card` per result | `.well`/`.kv` in card; inline confirm; hand-made dot (98); state pill (96) | Row, Status, Sheet | `btn-sm` | Row list; details/link/unlink in a Sheet |
| `#/reopens` | `.card` per request + `.confirm` | card + confirm | Row, Sheet | — | Row + Sheet |
| `#/activity` | chips, details, list (Row done for runs) | hand-built `li` (47) | Row | `min-h-9` summary (51) | Row for audit lines |
| `#/settings` | 2 sections, action bar, Sheet (done) | `ui/Select` and `type=time` instead of WheelSelect/TimePicker; `.well` list in Sheet | WheelSelect, TimePicker, cblock | — | cblocks; time via TimePicker |

### Public (already on the design system: polish only)

| Route | Notes |
|---|---|
| `#/welcome` | feature tiles fixed at 3 columns (~85 px each at 320); `aria-label` on a plain div (15) |
| `#/login`, `#/signup`, `#/forgot` | `bg-[var(--border)]` arbitrary value (Login 57); Plain's `aria-label` on a div |
| Not found / not available | EmptyState (`App.svelte` 130, 153): fine |

## Already done in Phase 5 (don't redo)

- Every sheet now goes through `Sheet`: Board, Leaders, Members, Batches, Coordinators ×3, Facilitators ×2, Settings, Week, Day ×2, WheelSelect, TimePicker.
- States are now `Status` in Board, Group, Leaders, Members, Fac, Coordinators, Batches, Week, WeekRead, DevoteeDetail, Activity, History and Report.
- `Row` is now used in staff Home, Week days, Fac weeks and Activity runs.
- `ui/Mark.svelte` has been removed.
