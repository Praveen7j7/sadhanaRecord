# Sadhana Record — visual review of the ux22 screenshot set (22 Oct 2026)

Reviewed: every `ux22-<width>-<scheme>-<screen>.jpg` in `scratchpad/shots/` (134 files: 390 light/dark for 37 screens, 1280 light/dark for 29). Tokens read from `frontend/src/app.css` lines 1–170 (read only).

**Capture caveat.** These screenshots were taken mid-load and show skeletons instead of content: `coord-home` (390 both), `coord-stats` (all four), `coord-leaders` (all four), `coord-devotee` (dark 390, both 1280), `coord-onbehalf` (dark 390, both 1280), `master-overview` (390 both, dark 1280), `master-activity` (all), `master-settings` (all), `guru-home` (all), `mixed-home` (390 both, light 1280), `account` (dark 390), `master-home` (dark 1280 partly). Scores for those rows are for the frame and skeleton only and are marked `(sk)`. The shot runner should wait for the first data row (`waitForText`) before capturing, as the browser-checks memory already says.

---

## 1. Screen-by-screen

Scale 1–5 (5 = excellent). "Desktop" = use of the 1280 width; "—" = no desktop shot exists.

| Screen | Light 390 | Dark 390 | Desktop width | Hierarchy | Advanced feel | What is dull or flat | The one change that lifts it most |
|---|---|---|---|---|---|---|---|
| splash | 5 | 3 | — | 4 | 3 | Light is the one truly vibrant frame (navy `#002888` → `#004fdc` sweep, gold loader). Dark drops the brand entirely: a muddy violet `#1a1430` → `#0d0b14` with the cyan emblem as the only colour (`ux22-390-dark-splash.jpg`). | Dark splash: a navy radial (`#002888` at 40 %) behind the emblem over the indigo, so both themes carry the brand blue. |
| welcome | 4 | 3 | 5 | 5 | 4 | The painting carries everything. Dark page below the card is a flat `#141219`; the secondary button is grey-blue `#2e3550` with no edge; the quote glass is the only glass on the screen (`ux22-390-dark-welcome.jpg`). Desktop split (`ux22-1280-light-welcome.jpg`) is excellent. | Dark: page gradient `#0f1a3a` (navy-indigo) → `#110f17` at 45 vh so the painting sits on brand night, not on grey. |
| login | 3 | 3 | 4 | 4 | 3 | Light inputs are filled `#e9e3dc` with no border and read as *disabled* (`ux22-390-light-login.jpg`); dark inputs are hairline-only on the card. The gold top rule on the card is the single brand touch; the card itself is white-on-paper with a 0.06 shadow, so it barely lifts. | Inputs: `--surface-elevated` fill + 1 px `--border-strong` + 3 px `--halo` on focus; card gets `--shadow-2`. |
| signup | 3 | 3 | — | 4 | 3 | Stepper is four grey bars with one blue; Yes/No segmented control is a grey slab `#e9e3dc`; the "About you" icon is the only accent (`ux22-390-light-signup.jpg`). Same disabled-looking inputs. | Stepper: done segments gold `#f8b000`, current blue, rest `--border`; segmented control gets white pill + shadow-1 on the selected side. |
| forgot | 2 | 2 | — | 3 | 2 | A 41-word paragraph, one field, one button, then 45 % empty page (`ux22-390-light-forgot.jpg`). Nothing on the card is coloured except the button. | Remove the paragraph (section 5); card height drops and the gold rule + button become the composition. |
| devotee-home | 4 | 3 | 4 | 4 | 4 | Light: Mon/Tue/Wed "!" badges are mud-brown `#7a5300` discs (`ux22-390-light-devotee-home.jpg`); the hero "This week" card is white with a faint blue border, so it is not a hero. Dark: cards `#1a1822` on `#110f17` are 4 L* apart, edges vanish, the border `#353041` is the only separator (`ux22-390-dark-devotee-home.jpg`). The painting + cream quote panel with gold rule is excellent (`ux22-390-light-devotee-home-full.jpg`). | Hero card gets a 2-stop accent gradient and a glow ring on today's day; "!" badges become `#f8b000` with a `#3a2a00` glyph. |
| devotee-drawer | 4 | 3 | — | 4 | 4 | Light glass over the blurred page is lovely (`ux22-390-light-devotee-drawer.jpg`). Dark sheet has no edge highlight; the section dot is 6 px and almost invisible (`ux22-390-dark-devotee-drawer.jpg`). | Dark sheet: `inset 0 1px 0 var(--shine)` top edge + 8 px area dot with a 3 px halo. |
| week | 3 | 2 | 3 | 3 | 3 | Every row has the same weight: the 4-row checklist and the 7-row Days list are both white rows with hairlines; "Today" is a 3 px left bar only (`ux22-390-light-week.jpg`). The 0/7 ring is pale blue on paper. Dark rows are `#1a1822` on `#110f17` — the list is a dark slab (`ux22-390-dark-week.jpg`). Desktop right column (End of week / Attendance / Submit) repeats the checklist in prose (`ux22-1280-light-week.jpg`). | Today's row: accent-tinted fill (`color-mix(accent 10 %, surface)`) + 3 px `--halo` ring; ring track becomes gold. |
| day | 3 | 3 | 3 | 4 | 3 | Ten grey-filled inputs in light look disabled (`ux22-390-light-day.jpg`, `ux22-1280-light-day.jpg`); section icons in `--accent-soft` discs are the only colour; desktop leaves the right 25 % empty and the Save bar floats over the form. | Inputs raised + bordered (as login); section titles get the gold hairline; desktop: 300 px right rail holding the day score ring and the week strip. |
| report | 3 | 3 | 2 | 3 | 3 | Calendar cells: missing days are brown outlines, today is a blue square, every other day is bare text (`ux22-390-light-report.jpg`); the legend promises green/amber/red fills that do not appear. Desktop: calendar + empty Activity score, bottom 45 % dead (`ux22-1280-light-report.jpg`). | Fill scored days with `--hi/--mid/--lo` tints and a 2 px ring for today; desktop 3-column (calendar · weekly bars · streak tiles). |
| hearing | 4 | 3 | 2 | 4 | 3 | Progress is a 2 px bar at 3 % blue on grey; list icon tiles are pale `--accent-soft`; desktop content is a 670 px column with ~300 px dead gutters each side (`ux22-1280-light-hearing.jpg`). | Desktop 2-column: Continue card + list left (720 px), week pager + "9 of 324" ring + heard-this-week sparkline right. |
| reading | 3 | 3 | 2 | 3 | 2 | A plain title list with "Open PDF" links; chips are grey outlines; `English / हिन्दी` seg is a grey slab (`ux22-390-light-reading.jpg`). Desktop identical, centred, 300 px gutters (`ux22-1280-dark-reading.jpg`). | Book rows → cover tiles (2-up phone, 4-up desktop) with a level colour band (VL-1 teal, VL-2 blue, VL-3 violet, SPS/DPS gold); active chip gold. |
| wall | 3 | 3 | 2 | 4 | 3 | White cards, blue avatar discs, "Pinned" chip is the only tint; dark cards are flat `#1a1822` (`ux22-390-dark-wall.jpg`). Desktop centred 670 px, two cards, 60 % empty (`ux22-1280-light-wall.jpg`). | Pinned card: 3 px accent top band + `--accent-soft` header; desktop 2-column (feed · filters/pinned list). |
| account | 3 | 3 (sk) | 3 | 4 | 3 | Avatar is a flat blue disc; chips `--accent-soft`; cards white (`ux22-390-light-account.jpg`). Dark 390 captured as skeleton. Desktop two columns is fine (`ux22-1280-dark-account.jpg`). | Profile card: avatar with a 2 px gold ring and a `#004fdc → #2a6cf0` gradient; card header 2-stop gradient. |
| history | 3 | 3 | 3 | 3 | 3 | All five week rows show an identical blue check tile — the in-progress week looks "done" (`ux22-390-light-history.jpg`); the "Choose a week" gold ring is a nice touch. Desktop bottom is a skeleton (`ux22-1280-light-history.jpg`). | Week rows: score pill per week (`--hi/--mid/--lo`) and an amber ring for in progress, no generic check. |
| coord-home | 3 (sk) | 2 (sk) | 4 | 4 | 3 | Desktop light: "This week" KPI numbers sit on a grey `#efe9df` band; the Needs-you card has a brown left border (`ux22-1280-light-coord-home.jpg`). Dark desktop: KPI band is `#1f1c28` on `#1a1822`, invisible (`ux22-1280-dark-coord-home.jpg`). 390 skeletons. | KPI band → four tiles, each with a 3 px top colour bar, serif number, delta vs last week. |
| coord-drawer | 4 | 3 | — | 4 | 3 | Saffron appears only as the 6 px section dot and the "MY BATCH" overline (`ux22-390-light-coord-drawer.jpg`). | Saffron hairline under the section header + `color-mix(area 10 %)` on the active item. |
| coord-board | 3 | 3 | 3 | 3 | 3 | KPI band grey; the 7-dot day progress is 6 px dots; the teal info banner is the strongest colour on the page; desktop table header is a grey band and rows have no hover (`ux22-1280-light-coord-board.jpg`, `ux22-390-light-coord-board.jpg`). | Status chips with coloured dots + sticky name column + row hover with area-colour inset bar (section 4). |
| coord-stats | 2 (sk) | 2 (sk) | 2 (sk) | 2 | 2 | Skeleton only in all four shots (`ux22-1280-light-coord-stats.jpg`). | Re-capture; apply the dark chart chroma tokens (ladder #8). |
| coord-leaders | 2 (sk) | 2 (sk) | 2 (sk) | 2 | 2 | Skeleton only (`ux22-1280-dark-coord-leaders.jpg`). | Re-capture. |
| coord-requests | 4 | 3 | 4 | 4 | 4 | Every avatar is the same brand-blue disc; the type dot is the only differentiator; dark detail panel is a flat `#1a1822` (`ux22-1280-dark-coord-requests.jpg`). The desktop master-detail is the best staff layout in the set. | Registry-match radio cards: selected = accent-tinted fill + check; avatar hue by request type (sign-up blue, reset saffron). |
| coord-devotee | 4 | 2 (sk) | 2 (sk) | 4 | 4 | Light 390 is good: Call/WhatsApp/Email, 8-week sparkline, "avg 74 %" (`ux22-390-light-coord-devotee.jpg`). Dark + desktop are skeletons. | Sparkline with gradient fill + score pill; re-capture dark/desktop. |
| coord-onbehalf | 3 | 2 (sk) | 3 (sk) | 3 | 3 | Saffron-bordered "Filling for" banner is right; the rest is the week screen (`ux22-390-light-coord-onbehalf.jpg`). | Same as week. |
| master-home | 3 | 3 | 3 | 4 | 3 | Decisions card with gold left border is good; System health is an empty block; desktop puts the painting below the fold (`ux22-1280-light-master-home.jpg`). | Decisions rows → count tiles (4 · 1 · 1) with wine top bars; System health → status chips. |
| master-drawer | 4 | 3 | — | 4 | 3 | Wine shows only as the dot, and in dark it reads pink `#e9a6c0` (`ux22-390-dark-master-drawer.jpg`). | Wine hairline + tinted active item; dark wine `#d98cab` (less pink, same contrast). |
| master-overview | 2 (sk) | 2 (sk) | 3 | 3 | 3 | Desktop light: one batch row, a progress bar, a sparkline, then a sentence and 70 % empty (`ux22-1280-light-master-overview.jpg`). | Batch rows → 3-up cards with progress ring + sparkline; zero-devotee batches as muted cards, not a sentence. |
| master-coordinators | 3 | 3 | 2 | 3 | 2 | Table with three rows; "Active" green dot is the only colour; 60 % empty below (`ux22-1280-light-master-coordinators.jpg`). | Avatar + batch chips in the row; density toggle; sticky name column. |
| master-batches | 3 | 3 | 3 | 3 | 3 | Grey header band, uniform Edit buttons, status dots green/amber (`ux22-1280-dark-master-batches.jpg`). Every row says "Level SPS", echoing the journals’ "Level" naming that the batch-names rule avoids. | Status chips; a batch colour swatch per row; drop "Level". |
| master-ids | 2 | 2 | 1 | 3 | 2 | A 4-way seg (wraps to two rows at 390), one input, then nothing; desktop content is 450 px wide at top-left with 70 % empty (`ux22-1280-light-master-ids.jpg`). | Below the search: three count tiles (minted this month · duplicates to review · person records) so the page has a body. |
| master-reopens | 3 | 3 | 2 | 4 | 3 | Explanatory paragraph; the request card with the serif quote is good; Reject is a pale pink slab; desktop 70 % empty (`ux22-1280-light-master-reopens.jpg`). | Desktop list + detail like requests; a week chip ("12–18 Oct") instead of prose. |
| master-activity | 2 (sk) | 2 (sk) | 2 (sk) | 3 | 2 | Outlined chips, accordion label, skeleton (`ux22-1280-light-master-activity.jpg`). | Timeline rows with a type-coloured dot on a hairline spine. |
| master-settings | 2 (sk) | 2 (sk) | 2 (sk) | 2 | 2 | Sentence + skeleton. | Re-capture; remove sentence. |
| guru-home | 2 (sk) | 2 (sk) | 2 (sk) | — | — | Skeleton only (`ux22-390-light-guru-home.jpg`). | Re-capture. |
| guru-drawer | 4 | 3 | — | 4 | 3 | The one place all three area colours sit together (blue · saffron · wine dots) — the clearest proof the area system can work (`ux22-390-light-guru-drawer.jpg`). | Same as the other drawers. |
| mixed-home | 3 (sk) | 3 (sk) | 3 / 4 (dark full) | 4 | 3 | Dark desktop has full content and is a good composite (`ux22-1280-dark-mixed-home.jpg`); light desktop and 390 are skeletons; `-full` shows "My batch" KPI numbers on the grey band (`ux22-390-light-mixed-home-full.jpg`). | Same as devotee-home + coord KPI tiles. |
| mixed-drawer | 4 | 3 | — | 4 | 3 | As coord-drawer. | As coord-drawer. |

---

## 2. Cross-cutting findings

### Why dark reads flatter than light
- **Surface steps are 4 L\* apart.** `--bg-n #110f17` (L\* ≈ 5) → `--surface-n #1a1822` (L\* ≈ 9) → `--surface-elevated #24212e` (L\* ≈ 14) → `--surface-floating #2d2a39` (L\* ≈ 18). A card on the page is a 4 L\* step; the eye needs ≈ 6–7 to read an edge without a border. Every dark list (`ux22-390-dark-week.jpg`, `ux22-390-dark-reading.jpg`) becomes a slab.
- **Dark relies on borders, light on shadows.** Dark shadows are black on near-black (0.4–0.75 alpha, invisible), so the 1 px `#353041` border does all the work. There is no top-edge highlight (`--shine` exists at 0.06 but is not applied to cards), so nothing reads as "lit from above".
- **Accent chroma is fine, accent *use* is thin.** `#78a8ff` is bright enough; it appears only on buttons, links and the active nav. Area colours (`#f2a25a`, `#e9a6c0`) appear as 6 px dots. The wash (`--mix-wash 13 %`) is visible only in the top 100 px (`ux22-390-dark-devotee-home.jpg`).
- **Gold is the dark theme's best asset and is under-used.** `--gold-text #f8b000` makes the "!" badges and "In progress" chip the liveliest pixels in dark (`ux22-390-dark-history.jpg`), while `--gold-decorative` is reduced to `#c99000`. Reverse that: decorative gold in dark should be the bright one.
- **Splash and welcome lose the brand.** Light splash is navy; dark splash is violet-black. The first second of dark mode has no `#004fdc`.

### Why light feels "paper but plain"
- **Muted fills look disabled.** `--muted-n #efe9df` is the fill for inputs, segmented controls, KPI bands and table headers. Every login/day/signup field looks greyed out (`ux22-390-light-login.jpg`, `ux22-1280-light-day.jpg`). This is the single biggest light-theme problem.
- **White on paper is a 2.5 L\* step** (`#fbf9f6` on `#f6f2eb`), plus a 0.06 shadow — cards float only by their hairline.
- **Gold in light is brown.** `--gold-text #7a5300` is correct for words but it is also used as the fill of the "!" badges, the "Missing" dot and the calendar outlines — all become mud (`ux22-390-light-report.jpg`, `ux22-390-light-devotee-home.jpg`). Fill elements that are not text should use `--gold-decorative #f8b000`.
- **The wash fades at 42 vh**, so below the greeting the page is uniform paper.

### Where colour does no work
- Area colours: only dot + overline. Nav active item, section rules, KPI bars and card accents are brand blue in every area, so coordinator and admin pages are indistinguishable from devotee pages beyond the overline.
- `--viz-*` tokens: appear once (sparklines). Report calendar legend promises `--hi/--mid/--lo` fills that are not drawn on the cells.
- Status: "Active", "Offered at sign-up", "Not started", "Filling" are coloured words with a 6 px dot; no fill, no chip.

### Dead whitespace on desktop
- Centred 670 px columns with 300 px gutters: hearing, reading, wall.
- Half-empty pages: report (bottom 45 %), master-overview (70 %), master-ids (70 %), master-coordinators (60 %), master-reopens (70 %), forgot.
- Day form: right 25 % empty with a floating save bar.

### Where the staff side looks like generic admin tables
- `coord-board`, `master-coordinators`, `master-batches`: grey header band, uniform rows, kebab menus, no hover, no density control, "Export" top-right. They would pass for any Bootstrap table.
- `coord-home` / `master-overview`: the KPI "band" (four numbers on a grey strip) is the only summary; no deltas, no sparklines on the coordinator side.

### What already looks excellent and must be kept
- The painting + quote composition everywhere it appears: welcome/login desktop split (`ux22-1280-light-login.jpg`), the home painting card with the cream quote panel and gold rule (`ux22-390-light-devotee-home-full.jpg`).
- Light splash (`ux22-390-light-splash.jpg`).
- The light glass drawer (`ux22-390-light-devotee-drawer.jpg`).
- The gold top rule on auth cards.
- Serif greeting + blue date overline (`ux22-1280-light-devotee-home.jpg`).
- Requests master-detail on desktop (`ux22-1280-light-coord-requests.jpg`).
- The "Needs you / Decisions" gold-left-border card and the saffron "Filling for" banner.
- The glass bottom nav.
- Gold "In progress" chip and "Choose a week" ring in dark.

---

## 3. Vibrancy ladder (ranked by lift ÷ cost)

All CSS unless noted. "Tier" = which `data-tier` gets it (high / balanced / low). Byte costs are for the minified CSS added.

| # | Change | Token / component | Example values | Tier | Cost |
|---|---|---|---|---|---|
| 1 | **Raised, bordered inputs in light** — kill the disabled look | `input, select, textarea, .seg` background | `background: var(--surface-elevated); border: 1px solid color-mix(in srgb, var(--accent) 10%, var(--border-strong)); &:focus-visible { box-shadow: 0 0 0 3px var(--halo) }`. Keep `--muted-n` for genuinely disabled fields only. | all | ≈ 180 B |
| 2 | **Dark surface steps 6 L\* apart + top-edge shine** | `--bg-n --surface-n --surface-elevated --surface-floating --border-n` (dark) | `#0d0b13` (L\* 3) → `#1b1826` (9) → `#272339` (15) → `#352f49` (21) — 6 L\* per step, computed; border `#3d3752`. Card: `box-shadow: inset 0 1px 0 var(--shine), var(--shadow-1)` with `--shine` raised to `rgb(255 255 255 / 0.08)`. | all (shine: high + balanced) | ≈ 120 B |
| 3 | **Gold for fills, brown only for words** | `.badge-missing, .dot-missing, .cal-missing` | Fill `var(--gold-decorative)` (`#f8b000` light, make dark `#f8b000` too and demote `--gold-text` dark to `#f2c46a`); glyph `#3a2a00` (7.4:1). Missing dot `#c06e00` (3.4:1 on paper, passes the 3:1 non-text rule). | all | ≈ 90 B |
| 4 | **Hero card 2-stop gradient** ("This week", profile header, batch KPI card) | `.card--hero` | light `background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 14%, #fff), #fff 62%)`; dark `linear-gradient(160deg, color-mix(in srgb, var(--accent) 20%, var(--surface-elevated)), var(--surface-elevated) 62%)`; `border-color: color-mix(in srgb, var(--accent) 35%, var(--border))`. | all (low: flat `--accent-soft` fill) | ≈ 220 B |
| 5 | **Glow ring on the active day / today row** | `.day[aria-current="date"], .row--today` | high: `box-shadow: 0 0 0 3px var(--halo), 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent)`; balanced: 3 px halo only; low: `border: 2px solid var(--accent)`. Today's row fill `color-mix(in srgb, var(--accent) 10%, var(--surface))`. | tiered | ≈ 160 B |
| 6 | **Gold hairline under section titles** | `h2.section::after` | `content:''; display:block; width:40px; height:2px; margin-top:6px; border-radius:1px; background: linear-gradient(90deg, var(--gold-decorative), transparent)`. | all | ≈ 110 B |
| 7 | **Area colour does work** — nav, section rules, KPI bars | `.nav-item[aria-current]`, `.section-head`, `.kpi` | active item `background: color-mix(in srgb, var(--area) 12%, transparent); color: var(--area)` (dark coordinator `#f2a25a` ≥ 8:1 on the dark page, admin `#d98cab`); section header `border-bottom: 1px solid color-mix(in srgb, var(--area) 35%, transparent)`; KPI tile `border-top: 3px solid var(--area)`. Buttons stay brand blue. | all | ≈ 200 B |
| 8 | **Chart colours with more chroma in dark** | `--viz-*` (dark) | body `#86aee0` → `#8fb8ff`, soul `#e0c178` → `#f2c75c`, seva `#7cc7b8` → `#5fd6bd`, att `#c0a8e6` → `#c9a6ff`; semantic `--hi/--mid/--lo` dark `#1f3d1a` / `#4a3a10` / `#4d2420` so calendar tints read. | all | ≈ 100 B |
| 9 | **Light paper one step deeper, cards one shadow higher** | `--bg-n`, `--shadow-1` (light) | `--bg-n #f3eee5` (L\* 94: white `--surface-elevated` cards become a ~6 L\* step, `--surface-n #fbf9f6` cards ~3.6); `--shadow-1: 0 1px 2px rgb(60 40 10 / 0.08), 0 2px 6px -2px rgb(60 40 10 / 0.08)`. Check muted text on wash stays ≥ 4.5:1 (it does: wash peak unchanged). | all | ≈ 80 B |
| 10 | **Calendar heat tints** (report) | `.cal-day[data-band]` | `[data-band=hi] { background: var(--hi) } [data-band=mid] { background: var(--mid) } [data-band=lo] { background: var(--lo) }` + today ring from #5. Legend finally matches the cells. | all | ≈ 120 B, 0 JS (band already computed for the legend) |
| 11 | **Status chips with coloured dots** | `.chip[data-state]` | `background: color-mix(in srgb, var(--c) 12%, var(--surface-elevated)); color: var(--c); border: 1px solid color-mix(in srgb, var(--c) 30%, transparent); &::before { content:''; width:7px; height:7px; border-radius:50%; background: var(--c) }` with `--c` = success / warning / danger / info. | all | ≈ 200 B |
| 12 | **Dark splash + dark welcome carry the brand** | `.splash`, `.welcome` (dark) | splash `background: radial-gradient(80% 60% at 50% 40%, #002888 0%, #110f17 70%)`; welcome page `linear-gradient(#0f1a3a, #110f17 45vh)`. | all | ≈ 140 B |
| 13 | **Avatar gradient + gold ring** | `.avatar` | `background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #fff))`; profile hero avatar `outline: 2px solid var(--gold-decorative); outline-offset: 2px`. Request avatars: hue by type (`--accent` sign-up, `--area` coordinator for resets). | all | ≈ 150 B |
| 14 | **Progress bars as gradients** (hearing, overview) | `.bar > i` | `background: linear-gradient(90deg, var(--accent), var(--gold-decorative))`; track `color-mix(in srgb, var(--accent) 12%, var(--surface-muted))`; height 4 px → 6 px. | all | ≈ 90 B |
| 15 | **Segmented control: white pill on tinted track** | `.seg` | track `color-mix(in srgb, var(--accent) 8%, var(--surface-muted))`; selected `background: var(--surface-elevated); box-shadow: var(--shadow-1); color: var(--accent)` instead of the solid blue pill (keeps the solid pill for primary buttons only). | all | ≈ 140 B |
| 16 | **Stepper with gold done-segments** (signup) | `.stepper > i` | done `var(--gold-decorative)`, current `var(--accent)`, rest `var(--border)`; current segment `box-shadow: 0 0 0 2px var(--halo)`. | all | ≈ 90 B |
| 17 | **Desktop layouts that use the width** | hearing, reading, wall, report, master-ids, master-overview | `@media (min-width: 1024px)` two-column grids (`grid-template-columns: minmax(0, 1fr) 360px`) for hearing/wall/report; reading as a 4-up tile grid; overview as `repeat(auto-fill, minmax(300px, 1fr))` cards; ids with three count tiles under the search. | all | ≈ 600 B CSS; ids needs 1 small read (counts already exist in `identity.*` responses) |
| 18 | **Wash extends as a flat band on scroll, gold stop stronger at the top-right** | `--wash` | add a third stop `radial-gradient(40% 24vh at 100% 0, color-mix(in srgb, var(--gold-decorative) 14%, transparent), transparent)`; keep the accent stop at 10 % (contrast note in app.css). | high + balanced | ≈ 100 B |
| 19 | **Book tiles with level colour band** (reading) | `.book` | `border-top: 4px solid var(--lvl)`; `--lvl` per chip: VL-1 `--info`, VL-2 `--accent`, VL-3 `--viz-att`, SPS/DPS `--gold-decorative`, BSS/BVS `--viz-seva`. | all | ≈ 160 B |

### Native-only motion (separate, all gated by `prefers-reduced-motion` and tier)

| What moves | Trigger | Duration / curve | Tier |
|---|---|---|---|
| Route change: old page fades + slides 8 px, new page slides in (`::view-transition-old/new(root)`) | navigation (View Transitions API, already a dependency of the shell) | `--d-page` 220 ms, `--ease` | high + balanced |
| Cards enter: `@starting-style { opacity: 0; translate: 0 6px }` → rest | first paint of a list/card | 200 ms, `--ease` | high + balanced |
| Bottom-nav active pill slides between tabs (`view-transition-name: nav-pill`) | tab change | 200 ms, `--ease-spring` | high |
| Header wash parallax: `.wash { animation: fade linear both; animation-timeline: scroll(); animation-range: 0 40vh }` | scroll | scroll-driven, no time | high |
| Week ring draws in (`stroke-dashoffset` transition from full) | data arrives | 440 ms, `--ease` | high + balanced |
| Today glow pulses once on mount (`@starting-style` box-shadow spread 0 → 16 px) | mount | 440 ms | high |
| Painting rotator crossfade via `@starting-style` opacity on the incoming `<img>` | rotation tick (already exists) | `--d-quote` 560 ms | high + balanced |
| Row hover lift (desktop): `translate: 0 -1px` + `--shadow-1` | `:hover` on `@media (hover: hover)` | `--d-1` | high + balanced |
| Drawer sheet (already 440 ms spring) — unchanged | | | |

---

## 4. Staff screens as a modern console (within the constraints)

Applies to `coord-board`, `coord-leaders`, `coord-requests`, `master-coordinators`, `master-batches`, `master-overview`, `master-activity`. Evidence: `ux22-1280-light-coord-board.jpg`, `ux22-1280-dark-master-batches.jpg`, `ux22-1280-light-master-coordinators.jpg`.

1. **Density toggle** — a two-option `Seg` (Comfortable / Compact) in the toolbar next to Export. Sets `data-density` on the table; CSS `[data-density=compact] { --row-h: 40px; --fs-cell: 0.875rem }` vs default 56 px. Remember in `localStorage`. ≈ 150 B CSS, ≈ 200 B JS (one attribute write).
2. **Sticky first column + sticky header** — `th:first-child, td:first-child { position: sticky; left: 0; background: inherit; z-index: 1 }`, `thead th { position: sticky; top: var(--bar-h) }`, wrapper `overflow-x: auto`. On 390 the name column stays while the week dots and attendance scroll. ≈ 160 B, 0 JS.
3. **Row hover lift with area bar** — `@media (hover: hover) { tr:hover { background: var(--surface-hover); box-shadow: inset 3px 0 0 var(--area) } }`. Rows become addressable without buttons. ≈ 100 B.
4. **Status chips with coloured dots** (ladder #11) replace the coloured word + dot: Submitted (success), Filling (warning), Not started (muted), Missed (danger), Active (success), No coordinator (warning), Offered at sign-up (info).
5. **KPI tiles with delta + sparkline** — replace the grey band on coord-home / coord-board / master-overview with four tiles: 3 px top bar in the state colour, serif `--fs-stat` number, label, `▲2 vs last week` in success/danger, and a 7-point inline SVG sparkline (the sparkline component already exists on master-overview and coord-devotee). Deltas need last week's counts — already in the 8-week filling data the chart fetches, so no new hop.
6. **Segmented filters above tables** — `Seg` with count pills: `All 10 · Not started 3 · Filling 3 · Submitted 4 · Missed 0`, each option carrying its state dot; filtering is client-side on the loaded rows (0 extra reads).
7. **Table header** — drop the grey band; `thead th { background: transparent; border-bottom: 2px solid color-mix(in srgb, var(--area) 35%, var(--border)); font: 650 0.75rem/1 var(--font-sans); letter-spacing: 0.06em; color: var(--text-muted) }` so the area colour marks the console.
8. **Week dots → 7-segment bar** — the 6 px dots (`ux22-1280-light-coord-board.jpg`) become a 7-cell bar 48 × 8 px with `--hi/--mid/--lo/--border` cells; readable at 390 and in compact density.
9. **Batch colour swatch** — a 10 px rounded square per batch (SPS blue, DPS gold, BSS teal, BVS violet, TRD saffron, ETP wine) in master-batches, overview cards, requests list and the batch select; one `--batch-c` custom property set inline.
10. **Empty right side on desktop** — master-ids, reopens, coordinators: use a list + detail split like requests (`grid-template-columns: 440px minmax(0, 1fr)`), the detail panel showing the selected row's record/actions. Reuses the requests pattern, no new component.

Everything above is CSS plus at most ~300 B of JS (density attribute + localStorage); startup JS stays under the 60 KB budget and the low tier gets flat fills, no shadows and no hover motion.

---

## 5. Copy to remove

Rule applied: text stays only if it (a) states a consequence before an irreversible step, or (b) says what happens next. Everything else that explains rather than acts is listed. Word counts are of the text removed (shortened = old − new).

### splash
- "Every Day, A Step Closer to Kṛṣṇa." — brand tagline; by the rule it is neither (a) nor (b). **Head's call**: keep on splash only as the brand mark, remove everywhere else (see welcome/login/signup). Counted as 0 here.
- **Removed: 0**

### welcome (`ux22-390-light-welcome.jpg`)
- "Every Day, A Step Closer to Kṛṣṇa." — remove (7); the splash already carries it.
- "Your coordinator approves new accounts" — keep (b: what happens after Create an account).
- "Your details stay with IYF Delhi · Privacy" — shorten to "Privacy" (removed 6).
- **Removed: 13**

### login (`ux22-390-light-login.jpg`)
- "Steady in sādhana, growing in bhakti." — remove (6).
- "New here?" — remove (2); the button below says "Create an account".
- "Your details stay with IYF Delhi · Privacy" — shorten to "Privacy" (removed 6).
- **Removed: 14**

### signup (`ux22-390-light-signup.jpg`)
- "Begin your journey of devotional service." — remove (6).
- "Mobile number (for login)" — shorten to "Mobile number" (removed 2).
- "Step 1 of 4" — keep (state, not explanation).
- "Is this number on WhatsApp?" — keep (it is the field).
- **Removed: 8**

### forgot (`ux22-390-light-forgot.jpg`)
- "Your coordinator approves the reset and gives you a temporary password — in person or on WhatsApp. You then choose your own password as soon as you log in. For staff, the IYF head approves it." (41) — shorten to "Your coordinator gives you a temporary password." (7; b). Removed 34.
- **Removed: 34**

### devotee-home (`ux22-390-light-devotee-home-full.jpg`)
- "GETTING STARTED · 1 OF 3 / Fill each day / Tap a day and fill it in about a minute: sleep, rounds, hearing, reading and service. Partly filled is fine; finish it later." — remove the whole onboarding card (30). "Fill Monday" is the action and explains itself.
- "0 of 7 days filled · closes Mon 9:00 PM" — keep (b: deadline).
- "3 days to fill — Mon, Tue, Wed" — keep (state).
- "Get the 9 PM reminder" + "Allow notifications" — keep (action).
- "Many four-armed forms of the Lord" (painting sub-caption) — remove (6).
- "Śrīla Prabhupāda's translation" — remove (3); the source line "Bhagavad-gītā As It Is 6.17" is the attribution.
- **Removed: 39**

### devotee-drawer — nothing to remove ("AUTOMATIC", "DEFAULT" are values). **Removed: 0**

### week (`ux22-390-light-week.jpg`, `ux22-1280-light-week.jpg`)
- "Closes Mon 9:00 PM · 4 days to finish" — keep (b).
- "Days to complete: Mon, Tue, Wed, Thu" — keep (state).
- "Night Stay and the 4 principles open on Saturday at 6 PM" — shorten to "Night Stay + 4 principles · Sat 6 PM" (b; removed 4).
- "Attendance opens on Sunday, the day of the class" — shorten to "Attendance · Sun" (b; removed 6).
- "Submit opens Sun 6:00 PM" — keep (b).
- Desktop only: "Night Stay and the 4 regulative principles open on Saturday at 6 PM." — remove (13), duplicate of the checklist row.
- Desktop only: "Your attendance this week" — remove (4); the card is titled Attendance.
- Desktop only: "Attendance opens on Sunday, the day of the class." — remove (8), duplicate.
- Desktop only: "Fill at least one whole day to submit this week." — shorten to "One whole day needed to submit." (a; removed 4).
- Desktop only: "You can submit from Sun 6:00 PM until Mon 9:00 PM." — remove (11), duplicate of the checklist rows.
- Desktop only: "Not submitted by Mon 9:00 PM? The days complete by then…" (truncated in the shot) — shorten to "Mon 9 PM: complete days auto-submit, the rest score 0." (a; removed ≈ 6).
- **Removed: 56 (10 on phone, 46 more on desktop)**

### day (`ux22-390-dark-day.jpg`)
- "How your day is scored ›" (dark shot only) — remove (5); scoring belongs in the contract / Report.
- "Slept at (last night)", "Day rest (minutes)", "Completed the same day?" — keep (field labels/units).
- **Removed: 5**

### report (`ux22-390-light-report.jpg`)
- "Day by day" — remove (3); the "Daily" segment says it.
- Legend "Missing (still open) · Missed (closed)" — shorten to "Missing · open" and "Missed" (removed 3).
- **Removed: 6**

### hearing — "9 of 324 heard", "CONTINUE · LESSON WEEK 3", "Suggested" are state. **Removed: 0**

### reading (`ux22-390-light-reading.jpg`)
- "Books" (icon heading) — remove (1); page title is Reading.
- "Language" — remove (1); the English / हिन्दी segment is self-evident.
- **Removed: 2**

### wall — "Pinned", "New" are state. **Removed: 0**

### account (`ux22-390-light-account.jpg`, `ux22-1280-light-account.jpg`)
- "Face photo only." — remove (3); enforce in the picker.
- "Where you are signed in" (under Devices) — remove (5).
- "For your role: devotee, group leader" (under How to use) — remove (6).
- "Your submitted weeks stay in your batch's totals without your name." (under Delete my account) — keep (a).
- "9 PM reminder and announcements" — keep (the setting's name).
- "App 2026.10.22-1501" — keep (state).
- **Removed: 14**

### history (`ux22-390-light-history.jpg`)
- "Week by week" — remove (3); the "Weekly" segment says it.
- "Choose a week" (empty state) — keep (b, 3 words).
- **Removed: 3**

### coord-home (`ux22-1280-light-coord-home.jpg`)
- "Oldest 1 Oct" — keep (state).
- "Call them first to confirm they asked" — shorten to "Confirm by phone first" (a: before approving a reset; removed 3).
- "Closes Mon 9:00 PM" — keep (b).
- "Who submitted, who is filling" (under Batch status and attendance) — remove (5).
- "This week and the last 8 weeks" (under Filling chart) — remove (7).
- **Removed: 15**

### coord-drawer — nothing. **Removed: 0**

### coord-board (`ux22-390-light-coord-board.jpg`)
- "Batch" (label over the select) — remove (1).
- "Current week · Closes Mon 9:00 PM" — keep (b).
- "No regular class this week?" — keep (it is the action).
- "Attendance opens Sunday, 25 October — the class day." — remove (8).
- "Nothing filled since Mon", "2 of 7 filled", "Opens Sun" — keep (state).
- **Removed: 9**

### coord-stats (`ux22-390-light-coord-stats.jpg`) — "Batch" label: remove (1). **Removed: 1**

### coord-leaders (`ux22-390-light-coord-leaders.jpg`) — "Batch" label: remove (1). **Removed: 1**

### coord-requests (`ux22-390-light-coord-requests.jpg`, `ux22-1280-light-coord-requests.jpg`)
- "Batch" (label over the select) — remove (1).
- "Registry match" — keep (section name).
- "Not in the registry yet — approve with no ID" — keep (option label).
- "The ID will be linked automatically once the dashboard registers them." — shorten to "ID links when the dashboard registers them." (b; removed 4).
- "Chosen by the devotee; correct it if needed" (under Facilitator) — remove (8).
- "Class day (chose Sunday; correct it if needed)" — shorten to "Class day" (removed 6).
- **Removed: 19**

### coord-devotee (`ux22-390-light-coord-devotee.jpg`)
- "Details · birthday, blood group, address, emergency" — shorten to "Details" (removed 6).
- "When Aarav cannot fill the form, fill it for them. It is saved as filled by the coordinator." — shorten to "Saved as filled by the coordinator." (a; removed 11).
- "Last 8 weeks … avg 74%" — keep (state).
- **Removed: 17**

### coord-onbehalf (`ux22-390-light-coord-onbehalf.jpg`)
- "Saved as filled by the coordinator" — keep (a).
- Week rows as in `week` (phone portion: removed 10).
- **Removed: 10**

### master-home (`ux22-390-light-master-home.jpg`)
- "Oldest 1 Oct", "Harish Rawat" — keep (state).
- "Call them first to confirm they asked" — shorten to "Confirm by phone first" (removed 3).
- **Removed: 3**

### master-drawer — nothing. **Removed: 0**

### master-overview (`ux22-1280-light-master-overview.jpg`)
- "4 of 10 submitted · 10 active devotees" — keep (state).
- "SPS Group 2, SPS Online, DPS, BSS, BVS, Temple Residents, ETP Batch 51 — no active devotees yet." — replace with muted zero cards per batch (removed 16).
- **Removed: 16**

### master-coordinators — "3 coordinators" keep (count). **Removed: 0**

### master-batches (`ux22-390-light-master-batches.jpg`, `ux22-1280-light-master-batches.jpg`)
- "Level SPS · Coordinator: SPS Team" (×8 rows, phone) — shorten to "SPS Team"; "Level" also echoes the journals’ naming the batch-names rule avoids. Removed 2 × 8 = 16.
- Desktop LEVEL column "Level SPS" … — drop the word "Level" (8) or the column entirely (it duplicates ID).
- "add a coordinator in Edit" (×3) — remove (5 × 3 = 15); the "No coordinator" chip already says it.
- **Removed: 39**

### master-ids (`ux22-390-light-master-ids.jpg`)
- "IYF IDs" (h2 under the page title "IYF IDs") — remove (2).
- "Search name, IYF ID or phone" — move into the input as placeholder, remove the label (6).
- "Type at least 3 characters" — remove (5); show only as inline validation when fewer are typed.
- **Removed: 13**

### master-reopens (`ux22-390-light-master-reopens.jpg`)
- "Reopen requests (1)" — remove (2); the "Reopens 1" tab is selected.
- "Coordinators ask to reopen a missed week. Reopen it until a time, or reject it." — remove (16).
- "He was in hospital that week.", "Week of 12 Oct – 18 Oct · asked by sps on 22 Oct, 12:04 pm" — keep (data).
- **Removed: 18**

### master-activity (`ux22-390-light-master-activity.jpg`)
- "By, about, dates" — shorten to "Filters" (removed 2).
- "Technical log (for the app keeper)" — shorten to "Technical log" (removed 4).
- **Removed: 6**

### master-settings (`ux22-390-light-master-settings.jpg`)
- "For every batch. Changes are logged in Activity, and each can be undone right after." — shorten to "Logged in Activity · undo right after" (a/b; removed 9).
- **Removed: 9**

### guru-home / guru-drawer — skeleton / nothing. **Removed: 0**

### mixed-home (`ux22-390-light-mixed-home-full.jpg`, `ux22-1280-dark-mixed-home.jpg`)
- Same onboarding card as devotee-home — remove (30).
- "Oldest 2 Oct", "Closes Mon 9:00 PM" — keep.
- Painting sub-caption — remove (6).
- **Removed: 36**

### mixed-drawer — nothing. **Removed: 0**

**Total removed across the set: ≈ 406 words** (phone-visible ≈ 310; desktop-only duplicates ≈ 96). The largest single wins: forgot (34), master-batches (39), devotee-home (39), mixed-home (36), week desktop (46).
