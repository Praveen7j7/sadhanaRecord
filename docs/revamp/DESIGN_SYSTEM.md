# Sadhana Record — Design System (revamp specification)

**IYF Delhi · plan of record for the revamp · 8 October 2026**

**What this is:**
- the single specification of the visual and interaction language;
- every screen is built from these tokens and components;
- no screen gets its own one-off styling.

**Where the values come from:** `frontend/src/app.css`, as built today. Each section says **NOW** (exists) → **REVAMP** (the change) → **WHY**.

**What it is judged by:** clarity + beauty + meaning + usability + performance.

**Two principles that apply throughout:**
- Visual richness comes from **hierarchy, typography, spacing, surfaces and a few purposeful accents**, not from more colours or more pictures.
- A screen without a photograph can be world-class.

**Related documents:** `UI_UX_360_REVAMP.md` (why), `ROUTE_BY_ROUTE_REVAMP.md` (where), `PERFORMANCE_SEO_ACCESSIBILITY.md` (the limits every token must respect).

---

## 1. Token architecture

```
Primitive tokens       →  Semantic tokens            →  Component tokens
(raw values, never         (meaning: --text-primary,     (--btn-primary-bg,
 used by components)        --surface-elevated, --ok)     --card-hero-wash …)
        ↑ light / dark sets          ↑ tier overrides (High / Balanced / Low)
        ↑ area marker (devotee / coordinator / admin / public)
```

**NOW:**
- Semantic tokens already exist on `:root`.
- Dark mode: `[data-theme='dark']`.
- Area accents: `[data-area]`.
- Tiers: `[data-tier]` (glass, shadows, motion speed).
- Tailwind 4 maps `--color-*` to the semantic tokens.

**REVAMP:**
1. Split the **brand accent** from the **area marker** (§2.2).
2. Add the component-token layer for buttons, cards, inputs and charts, so every component reads one place.
3. Add image tokens (§9).
4. Add a spring easing and page-motion tokens (§8).
5. Keep everything in `app.css` — one source; no CSS-in-JS, no new tooling.

**WHY:** today the area accent drives *everything* (buttons, links, focus, wordmark). When a person moves from a devotee screen to a staff screen, the whole app recolours. The reviews found this makes one app feel like three products.

---

## 2. Colour

### 2.1 Principles
1. **Every colour has a job.** The jobs are: brand, action, status, data series, selection, focus, area marker.
2. **No decorative colour on icons.** Icons take the text colour, or the accent only when the item is *active* or *the primary action*.
3. **Warm neutrals carry 90% of each screen.** Colour is reserved for what needs attention.
4. **Status is never colour alone:** always a dot or icon plus a word (NOW: exists, keep).
5. Light and dark are designed together. **Every text pair ≥ 4.5:1, every control edge ≥ 3:1** (NOW: `tests/contrast.test.js` enforces this; keep and extend it to the new tokens).

### 2.2 Brand, action and area (the main change)

| Role | NOW | REVAMP | Why |
|---|---|---|---|
| **Brand** (wordmark, splash, theme-color, sign-in) | Royal purple `#4b2a86` (sign-in, splash `#3b2270`) | **The IYF logo's blue** (measured from `brand/iyf-logo-full-original-885x280.png`): brand/action `#004FDC` (light, 6.7:1 on white, 4.7:1 or more on the page wash) / `#78A8FF` (dark, 7.8:1 on `--bg`); **deep navy** `#002888` for the splash, wordmark and brand surfaces; the logo's **cyan** `#00F0F8` only as a glow or highlight (never text on light, 1.4:1); the logo's **gold** `#F8B000` as detail (fills with navy text 6.8:1; gold *text* on light uses `#7A5300`). Sign-in uses the same brand, so the brand no longer changes after login | The IYF emblem *is* lapis and gold. One brand from the first screen to the last |
| **Action** (primary buttons, links, focus ring, selected state, active nav) | = area accent (devotee lapis / saffron / wine / purple) | **Always the brand blue**, in every area | One action colour = instant recognition; staff and devotee screens behave as one product |
| **Area marker** (where am I?) | Recolours everything | Only a **3 px marker** on the active sidebar section, the area tag in the top bar, and the page overline. Coordinator `#a14a08` / `#f2a25a` (saffron), IYF head `#7a2346` / `#e9a6c0` (wine); devotee and public use the brand | Keeps the useful "you are in staff tools" cue without three colour schemes |

> **Built 8 Oct 2026 (Phase 1):** the logo blue is used a shade deeper for text and buttons, `#004FDC` light / `#78A8FF` dark, because the measured logo blue (`#0058F8` / `#6EA0FF`) fell under 4.5:1 on the page wash and on its own soft fill. Same hue; contrast now 4.7:1 or more everywhere (checked by `tests/contrast.test.js`). The Soul chart colour is `#A5802A` for the same reason.
>
> **Decision D1 (decided by IYF, 8 Oct 2026).** The brand colour is **the logo's blue**. One brand and action colour (logo blue, with the logo's gold as detail); area colours become markers only. This replaces the 4 Oct audit's per-area accents ("identity anchor").

### 2.3 Neutral and surface tokens (keep; values already contrast-tested)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f6f2eb` sandalwood | `#110f17` indigo night | Page |
| `--surface` | `#fbf9f6` | `#1a1822` | Grouped lists, plain sections |
| `--surface-elevated` | `#ffffff` | `#24212e` | Cards that are a unit of action |
| `--surface-floating` | `#ffffff` | `#2d2a39` | Bars, sheets, menus, toasts |
| `--surface-muted` | `#efe9df` | `#1f1c28` | Stat tiles, segmented controls, inputs at rest |
| `--surface-hover` | `#e7e0d3` | `#2e2a3a` | Pressed and hover |
| `--border` / `--divider` / `--border-strong` | `#e3dbcd` / `#ece6db` / `#8c8273` | `#353041` / `#2a2734` / `#756e86` | Card edges / rows / input outlines (≥3:1) |
| `--text-primary` / `-secondary` / `-muted` | `#1e1a15` / `#4a433a` / `#655c50` | `#f1ede6` / `#c9c2b7` / `#a39c91` | 15.5 / 8.7 / 5.9 : 1 |
| `--gold-text` / `--gold-deco` | `#7a5300` / `#f8b000` | `#f8b000` / `#c99000` | Overlines on verses; rules, halos (the logo's gold; text 6.1:1 light, 10.1:1 dark) |

### 2.4 Semantic and status colours

| Meaning | Token | Light / dark | Used for |
|---|---|---|---|
| Done / submitted / saved | `--success` | `#1d7348` / `#6fd49b` | Submitted week, Saved, complete day |
| In progress / due soon / **missing day** | `--warning` | `#865400` / `#f2c46a` | Filling, deadline < 24 h, **past day not filled (NEW)** |
| Missed / error / destructive | `--danger` | `#b02e1c` / `#ff917c` | Missed week (0), errors, delete |
| Neutral notice | `--info` | `#1f6873` / `#7cc7d1` | Offline, "opens Sunday" |
| Not started / future | `--text-muted` + outline | — | Future day, not started |

**Each meaning also has a `-soft` fill (12–14% mix):** banners, chips, calendar cells.

**REVAMP rules:**
- **Past unfilled days use `--warning`**, never the neutral of future days. This fixes the most important devotee status gap.
- **"Needs you" items use an amber left edge**, never red. Red is reserved for missed and errors.

### 2.5 Data-visualisation colours

**NOW:** 8 pastel series `--b0…--b7`. The day bars and week bars give **different colours to the same category on different screens**.

**REVAMP:** fixed colour per category, the same in the app, the reports and (later) the Sheets views:

| Category group | Series | Light | Dark |
|---|---|---|---|
| Overall | brand | `#004fdc` | `#78a8ff` |
| Body (sleep, wake-up, day rest) | `--viz-body` | `#4f7fb0` | `#86aee0` |
| Soul (chanting, reading, hearing) | `--viz-soul` | `#a5802a` | `#e0c178` |
| Seva | `--viz-seva` | `#2f8576` | `#7cc7b8` |
| Attendance | `--viz-att` | `#7a5aa6` | `#c0a8e6` |

**Rules:**
- Sub-categories use the group colour at 100% / 75% / 55% opacity steps.
- Values under 50% keep the colour but add a hatch or "low" label. Never colour alone.
- Calendar bands keep `--hi` / `--mid` / `--lo` (≥80 / 50–79 / <50), plus a **dashed amber outline for "missed"** and a **solid amber dot for "missing (past, unfilled)"**.

### 2.6 High contrast, reduced transparency, low capability

| Condition | What changes |
|---|---|
| `prefers-contrast: more` (**NEW**) | Borders use `--border-strong`; `--text-muted` → `--text-secondary`; glass off; focus ring 3 px |
| `prefers-reduced-transparency` | All glass → opaque floating surface (**NOW**: done; keep) |
| Low tier / Save-Data | Opaque surfaces, 1 shadow level, flat wash band, **no imagery** (§9), fades only |
| `forced-colors` (Windows High Contrast) (**NEW**) | Rely on system colours. Status dots get a visible outline; focus uses `Highlight` |

---

## 3. Typography

**NOW:** system fonts only. Serif `'Iowan Old Style', Palatino, 'Noto Serif', Georgia`; sans `system-ui …`; a fluid clamp scale. **No web fonts.** Keep this: zero font bytes, and the serif gives the scripture character.

| Token | Size | Weight | Line height | Use |
|---|---|---|---|---|
| `--fs-display` | 28→38 px (clamp) | serif 600 | 1.15 | Greeting, Welcome title |
| `--fs-h1` | 21→26 px | serif 600 | 1.2 | Page title (top bar) |
| `--fs-h2` | 19→22 px | sans 600 | 1.25 | Block heading ("Needs you") |
| `--fs-h3` | 17→18 px | sans 650 | 1.3 | Card/section heading |
| **`--fs-status` (REVAMP: 16→17 px, 600)** | NEW | sans 600 | 1.35 | **The status line** ("3 days to fill · closes Mon 9 PM"): the second most prominent text on Home |
| `--fs-body` | 16 px | 400 | 1.5 | Body |
| `--fs-sm` | 14 px | 400 | 1.45 | Supporting text |
| `--fs-label` | 14 px | 550 | 1.3 | Field labels |
| `--fs-caption` | 12 px | 400–650 | 1.35 | Meta, overlines, chart labels (minimum for read text: 12 px) |
| `--fs-stat` | 24→28 px | serif 600, **tabular** | 1.1 | Numbers in tiles |
| `--fs-quote` | 16.5→18 px | serif italic 400 | 1.45 | Verses |

**REVAMP rules:**
- `font-variant-numeric: tabular-nums` on every number that lines up (board %, tiles, scores, times).
- **Overlines** (11.5–12 px, tracked capitals) only **once per page**, and only where they add context. Remove them from shared pages (Account, Wall, Not found).
- Headings never take the area colour; only the overline may.
- `text-wrap: balance` on headings and short taglines; `pretty` on paragraphs.
- Devanagari, if Hindi is ever added (not planned; IYF 8 Oct 2026): the system Devanagari font (Noto Sans Devanagari or Kohinoor on iOS), line height +0.1.

---

## 4. Spacing, layout and density

**NOW:** `--sp-1…8` = 4, 8, 12, 16, 20, 24, 32, 48 px; `--gutter` 16; content max 1120 / 1280.

**REVAMP: an enforced rhythm**

| Between | Space |
|---|---|
| Inside controls; icon ↔ label | 8 |
| Related items (label ↔ field, rows in a group) | 12–16 |
| Blocks on a screen | 24 |
| Page regions (status ↔ work ↔ devotional) | 32 (phone) / 48 (desktop) |

**Density modes per screen type:**
- **Comfortable:** devotee Home, Day, Report, Wall, auth. 56 px rows, 16 px gutters.
- **Compact:** staff lists, Board, Members, Activity, admin tables. **44–48 px rows**, 12 px padding, tabular numbers, sticky headers on desktop.

**Whitespace rule:**
- Whitespace **around a primary element** creates calm. Keep it on the Today status block, the Day form and the verse.
- Whitespace **because there is nothing to show** is emptiness. Fill it with context (deadline, trend, next step), or collapse the region.
- Desktop rows wider than ~760 px get extra columns (last filled, trend, rounds), not stretched gaps.

---

## 5. Radius, borders, elevation and surfaces

| Token | Value | Use |
|---|---|---|
| `--r-xs` 6 / `--r-sm` 8 | chips inside rows, tags | |
| `--r-md` 10 → **12 (REVAMP)** | buttons, inputs, segmented controls | 12 px reads more modern at 44 px height |
| `--r-lg` 14 → **16** | cards, grouped lists | |
| `--r-xl` 20 → **24** | hero, sheets (top corners), image cards | |
| `--r-full` | pills, avatars, nav pill | |

**Elevation (keep the tokens; tier-adjusted):**

| Level | Token | Used by |
|---|---|---|
| 0 | none, `--bg` | Page, plain sections |
| 1 | `--shadow-1` + border | Grouped lists, content cards |
| 2 | `--shadow-2` | Hero / status block, image card |
| 3 | `--shadow-3` | Floating: nav, sheets, toasts, menus |

**Rules:**
- **Cards never sit inside cards.**
- **One hero per screen.**
- Depth means "this floats above content" (bars, sheets) or "this is the one thing to act on" (hero). It never decorates.

---

## 6. Glass (material)

**NOW:** glass on floating surfaces, tier-set. High is 70% + 16 px blur; Balanced is 84% + 8 px; Low and reduced transparency are opaque.

| Where | Glass? | Why |
|---|---|---|
| Top bar (when scrolled), bottom nav pill, sidebar on desktop | **Yes** (High/Balanced) | Shows content passing beneath: spatial, orienting |
| Sheets, drawer, menus, toasts | **Yes**, with opaque content inside | They float above the page |
| **Text panel over a darshan image** (Welcome, sign-in panel, Home darshan card) | **Yes, High only:** 72% surface + 12 px blur behind the text block | Keeps text readable over imagery and looks premium; Balanced uses an 88% opaque panel; Low has no image |
| Cards with data, lists, tables, forms, inputs, charts | **Never** | Blur under data hurts reading and costs GPU |
| Full-page backgrounds | **Never** blur-animated | Cost and noise |

**Glass recipe** (component token `--glass`): background `color-mix(in oklab, var(--surface-floating) 72–84%, transparent)` + `backdrop-filter: blur(var(--glass-blur)) saturate(140%)` + 1 px `--glass-edge` top highlight + `--shadow-3`.

**Cost:** each blurred layer is one GPU pass. **At most 2 glass layers on screen at once** (bar + sheet).

---

## 7. Components (hierarchy and states)

### 7.1 Buttons
| Variant | Look | Use | Max per view |
|---|---|---|---|
| Primary | brand fill, on-brand text, `--shadow-1` | The one main action (Save, Submit week, Approve) | **1** |
| Secondary | brand-soft fill, brand text | Other positive actions | 2–3 |
| Outline | border-strong, text | Cancel, neutral | any |
| Text | brand text, underline on hover | Inline actions | any |
| Danger | danger-soft fill, danger text | Destructive, in menus or confirmation sheets | — |
| Danger-solid | danger fill | Only inside a confirmation sheet | 1 |

**States** (all variants, all via tokens):
- rest;
- hover (mouse only): surface-hover or brand-hover;
- **pressed:** scale 0.98 + darker fill (NOW: exists);
- focus-visible: 2 px ring + 2 px offset;
- busy: spinner replaces the icon and the label stays;
- disabled: 55% opacity + `not-allowed`; never the only signal.

**Heights:**
- 44 px (default);
- 36 px (`sm`, only in dense staff rows on desktop, **never on touch-only screens**).

### 7.2 Cards and blocks
| Type | NOW | REVAMP |
|---|---|---|
| **Status block** (Home) | Today card + Week card (duplicated counts) | **One block:** status line, 7-day strip (complete ✓, partial ◐, missing amber, future ○), deadline, one primary action. State-tinted wash (neutral / amber < 24 h / success) |
| **Needs-you card** (NEW) | — | One card per person, merging every queue they own. Rows: icon, plain sentence, count, chevron. Amber left edge. Only non-zero rows; hidden when empty ("All caught up" line) |
| **Scope strip** (NEW) | Counts spread over 3 screens | One horizontal strip: submitted / filling / not started / missed (active members only), deadline; tap → filtered list |
| **Darshan card** (NEW, §9) | — | Image + deity name + verse; one per Home; never in staff areas |
| Content card | Posts, weeks | Keep; author row, 16 px padding |
| Stat tile | Muted, serif number | Keep; tabular; optional delta ("▲ 6") |
| Grouped list | `.list` / `.lrow` | Keep; 56 px comfortable, 48 px compact; whole row tappable; trailing chevron or status |
| Notice | Banner | Keep; semantic soft background + 3 px left bar + icon + one action |

### 7.3 Inputs and forms
- **Labels:** always visible, above the field; helper text below; error replaces helper (`aria-describedby`, `aria-invalid`).
- **Field:** 44 px tall; `--surface-muted` at rest → `--surface-elevated` + 2 px brand ring on focus.
- **Optional fields** are marked "(optional)"; required fields are not starred.
- Wheel pickers for finite choices (**NOW**: keep), steppers −/+ for minutes (**NEW**), native date where a calendar helps.
- **Save states:** `Save` (disabled until there is a change) → `Saving…` → `Saved ✓` (only after a real save; it fades back to `Save` on the next change). **Fix: today it shows "Saved ✓" on untouched forms.**
- **Leave guard** for unsaved changes (**NOW**: keep).

### 7.4 Navigation
- **Phone < 600:**
  - floating glass bottom bar, max 5, labels always shown;
  - the active item is a filled pill and brand-coloured;
  - a badge only for actionable counts;
  - the drawer holds everything else, with no duplicates of the bar.
- **Tablet 600–1023:** an 88 px rail with up to 7 items and the same rules.
- **Desktop ≥ 1024:**
  - 280 px sidebar, **its own scroll**;
  - every page of every section is **always listed**, the same on every screen (10 Oct 2026, replacing "one entry per area"); on a pointer screen the rows are 36 px so all pages fit an 800 px laptop screen; Admin has no grouped pages (Staff and Facilitators apart; People's pages were the batch tools' Devotees and Group leaders);
  - pages use tabs only on phone;
  - the profile card is the link to Account.
- **Top bar:**
  - title (serif) and an area tag on staff pages;
  - Back only on *child* pages, never on tab roots;
  - search (staff), the bell (except on the Wall itself).

### 7.5 Sheets, dialogs, confirmations
- **One `Sheet` component** (NOW).
- **Size and placement:**
  - phone: from the bottom, top radius 24, drag handle;
  - wide screens: centred dialog, 560 px (620 px wide variant).
- **Snap points (NEW, P2):** half and full on phone for long sheets.
- **Destructive actions:** always a sheet with the consequence spelled out ("Deletes the account. Submitted weeks stay without the name.") and a danger-solid button. Never a row button in a list.
- **Dismissal:**
  - Back, Esc and the scrim close the sheet (**NOW**);
  - `dismiss=false` when data would be lost.

### 7.6 Toasts and alerts
- Toasts sit bottom-centre above the nav. At most 3. Info/success 5 s, errors 7 s. They carry an **Undo** for reversible actions (NOW).
- **Swipe to dismiss on touch (NEW, P3).**
- **Banners** are for page-level states (offline, deadline, error with Retry). There is **one banner per page**; the rest go to toasts.

### 7.7 Tables and lists (staff)
- **Phone:** lists with two-line rows (name + status line); actions sit in an overflow (⋯) sheet.
- **Desktop:**
  - a real `<table>` with a sticky header;
  - sortable column headers (`aria-sort`);
  - 48 px rows;
  - **list + detail** (the detail opens in a right pane) for Board, Members, Requests and My students.
- **Pagination:** "Show more" (keep). Show a count, "12 of 48".

### 7.8 Charts
- **Hand-made SVG/CSS** (NOW: keep). **No chart library.**
- **Meters (NEW):** on phones, horizontal meters, weakest first, replace the paged bar carousel; they show all categories at once with no tiny dots.
- **Labels and access:**
  - every chart has a text summary (`aria-label`) and, **NEW**, a "Show as table" toggle;
  - tap a bar or day to see its value (**NEW** for bars).
- **Sparklines (NEW):** 12-week inline SVG under 1 KB, in facilitator and coordinator rows.

### 7.9 Status chip
A dot plus a word, in its semantic colour:
- **Submitted**
- **Filling** (one word everywhere; replaces "Draft")
- **Not started**
- **Missed**
- **Reopened**
- **Missing (day)**

### 7.10 Empty, loading and error states
- **Loading:** a skeleton of the real layout, fading in after 150 ms; "Still working…" after 2 s; cached data shown first with a quiet "Refreshing…" (NOW: keep).
- **Empty states** have four parts:
  1. an icon in a halo;
  2. a title naming what is missing *in context*;
  3. one line saying when or how it fills;
  4. one action if there is one.

  **Devotee empty states may use darshan art (§9); staff empty states never do.**
- **Errors:** what happened in plain words + **Retry** + what is safe ("Your entries are kept on this phone").

---

## 8. Motion

**NOW:**
- durations `--d-1` 120 / `--d-2` 200 / `--d-3` 320 ms;
- `--ease` = `cubic-bezier(.2,.8,.2,1)`;
- a 180 ms crossfade on page change;
- press scale 0.97–0.99;
- ×0.8 on lower tiers;
- reduced motion removes movement.

**REVAMP tokens:**

| Token | Value | Use |
|---|---|---|
| `--d-1` | 120 ms | Press, hover, colour changes |
| `--d-2` | 200 ms | Sheets, toasts, chips, toggles |
| `--d-3` | 320 ms | Shared-element transitions, success moments |
| `--d-page` | 220 ms | Page slide (forward and back) |
| `--ease` | `cubic-bezier(.2,.8,.2,1)` | Default |
| `--ease-spring` | `linear(0, .36 12%, .78 26%, 1.02 42%, 1.01 58%, 1)` | Sheets, toggles, nav pill (fallback: `--ease`) |
| `--ease-exit` | `cubic-bezier(.4,0,1,1)` | Things leaving |

**Rules:**
1. Animate only `transform`, `opacity` and colours.
2. One-shot, never looping (except the splash line and, on High only, the Welcome gradient).
3. Start on visibility.
4. **Nothing moves under a finger that is typing.**
5. Entrance ≥ exit duration.
6. **Tiers:**
   - High: full;
   - Balanced: ×0.8 with no parallax;
   - Low and reduced motion: crossfades or instant, with the final states shown.

The per-moment table is in `UI_UX_360_REVAMP.md` §9.

---

## 9. Imagery tokens (darshan)

| Token | Value |
|---|---|
| `--img-radius` | `var(--r-xl)` (24 px) |
| `--img-scrim` | `linear-gradient(180deg, transparent 40%, rgb(10 8 20 / .55) 100%)`: only under overlaid text |
| `--img-panel` | the glass recipe (§6), High; 88% opaque surface on Balanced |
| `--img-focus` | per-image `object-position` (stored with the image, e.g. `50% 30%`) |
| `--img-aspect-card` / `-hero` / `-panel` | 4 / 5 · 16 / 9 · 3 / 4 |
| Placeholder | the image's dominant colour (stored), or a 16 px blurred inline preview (~300 B) |

**Usage rules are in `UI_UX_360_REVAMP.md` §8 (the image strategy and matrix).** In short:
- at most **one** devotional image per screen;
- never behind data, forms or tables;
- never on staff or admin work screens.

---

## 10. Breakpoints and layout classes

| Class | Width | Navigation | Layout |
|---|---|---|---|
| Phone | < 600 | Bottom bar + drawer | One column; sheets from the bottom |
| Tablet | 600–1023 | 88 px rail | Two columns where both help (Home, Report, Account) |
| Desktop | 1024–1439 | 280 px sidebar | List + detail for staff |
| Wide | ≥ 1440 | 300 px sidebar | Content max 1,280; text ≤ 75 characters a line |
| Ultrawide | ≥ 1600 (optional) | Sidebar | Third "context" column on staff screens |

**Container queries for components that live in several widths** (NOW for Home, the hero, quotes, the week view and Report). Extend them to the status block, the needs-you card and the darshan card.

---

## 11. Accessibility baked into tokens

- Touch targets: **44 × 44 px minimum** (NOW for most; fix the dots, "Fill", "View", "Back to…" and name links).
- Focus ring: `--ring` 2 px + 2 px offset; 3 px in high contrast.
- Text over images: ≥ 4.5:1 guaranteed by the panel or scrim, not by the image.
- Motion: every motion token collapses under reduced motion.
- Colour is never the only carrier of meaning.

---

## 12. Implementation notes

- All tokens live in `frontend/src/app.css` (`@layer theme` / `base` / `components`).
- New component tokens go next to their components.
- **Budget for the whole design-system change:** startup CSS must end ≤ 13.5 KB (target) by moving the welcome and sign-in styles into their own file (−~2.5 KB) before adding tokens (+~1.5 KB).
- **No new runtime dependencies.**
- **`tests/contrast.test.js` is extended** to the brand, action, viz and status tokens in both themes before any screen changes.
