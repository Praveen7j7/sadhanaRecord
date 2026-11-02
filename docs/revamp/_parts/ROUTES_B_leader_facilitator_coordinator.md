# Route-by-route revamp: group leader, facilitator and coordinator routes (Part B)

**IYF Delhi · 8 October 2026 · part of `ROUTE_BY_ROUTE_REVAMP.md`**

**Evidence used:**
- the code: `devotee/Group.svelte`, `fac/Fac.svelte`, `ui/WeekRead.svelte`, `screens/Home.svelte`, `coord/*.svelte`, `devotee/Devotee.svelte` (behalf), `lib/staff.js`, `ui/Shell.svelte`;
- the sweep screenshots (390 light, 1280 dark) for the devotee-gl, devotee-fac, facilitator and coordinator personas;
- `DESIGN_SYSTEM.md` (DS), `UI_UX_360_REVAMP.md` (360), `current-features.md` §3, `pre-store-revamp-review.md` (review).

**Phases:**

| Phase | Name |
|---|---|
| 0 | Baseline, trust and store blockers |
| 1 | Design-system foundation |
| 2 | Global shell and navigation |
| 3 | Authentication experience |
| 4 | Devotee core |
| 5 | Group leader / facilitator / coordinator |
| 6 | IYF head / admin |
| 7 | Advanced interaction and motion |
| 8 | Performance / accessibility / SEO hardening |
| 9 | Store builds and final QA |

---

## B.0 Shared staff patterns (used by every section below)

| Pattern | Spec | Phase |
|---|---|---|
| **One week-summary definition** | `weekSummary(rows)` in `lib/staff.js` replaces `boardCounts`. It counts **active members only**, and Group, My students, Batch status, Filling chart and staff Home all use it. Inactive and disabled rows go into a collapsed footer, "Not active (2)". Fixes review P0 #2 | **0** |
| **Status chip** (DS §7.9) | **Submitted · Filling · Not started · Missed · Reopened**. "Draft" is retired everywhere (it comes from `STATUS` in `lib/staff.js`) | 1 |
| **Day strip** | 7 cells. Complete ✓, partial ◐, **past and unfilled = amber "Missing"**, future = outline. It has a tap-to-open legend: "✓ filled · ◐ part · amber missing · ○ not yet" | 1 |
| **Staff row** (DS §7.2 grouped list, compact) | Phone: 2 lines in 56 px, and the **whole row is the target** (name link no longer 24 px tall). Desktop: a `<table>` with 48 px rows, a sticky header, `aria-sort` and tabular numbers | 5 |
| **Row menu ⋯** | All destructive and secondary actions (Fill for, Delete, Take out of group, Disable) move into a ⋯ Sheet; destructive ones open a confirm Sheet with a danger-solid button (DS §7.5). **No destructive button in a row** | **0** (move) / 5 (polish) |
| **List + detail pane** (DS §7.7) | ≥ 1024 px: the list is 420–480 px and the detail pane fills the rest. The URL stays the child route, so deep links keep working; on a phone the child route is a full page | 5 |
| **P/A control** | Segmented 2 × 44 px. Before Sunday 00:00 it is **not shown**; a chip "Opens Sun" sits in its place, with no dashed pre-marks that look selected. Dashed "implied" marks appear only while marking is open | 5 |
| **Keyboard (desktop staff)** | `j`/`k` move row focus · `Enter` opens (in the pane) · `p`/`a` mark Present/Absent on the focused row (only while open) · `Ctrl/⌘+S` saves attendance · `/` and `Ctrl/⌘K` open Go to… (exists) · `Esc` closes the pane. Single keys are ignored while typing, when a dialog is open, or within 1.5 s of `g` (the existing `g`-chord in `Shell.svelte`) | 7 |
| **Dates** | "Wed, 7 Oct" in day contexts and "7 Oct 2026" elsewhere; never "05 Jan 2026" or "07/10/2026" | 1 |
| **Wording** | "the IYF head", never "the master" (seen in Board's closed banner and DevoteeDetail's reopen texts) | 1 |
| **Imagery** | None on any route in this part (360 §8.2: "Group, My students, Batch, Requests, Members, Stats, Admin: No — work screens") | — |
| **SEO** | Every route here is a signed-in hash route: `noindex` (contract §5) and no per-route meta. Nothing to add | — |

---

### `#/group` — My group (group leader)

**1. Current purpose.** The leader sees each group member's week, nudges those still to submit (Call, or WhatsApp with a prefilled message), and marks P/A for the group from Sunday 00:00 until Monday 9 PM. A coordinator's or the head's mark overrides theirs.

**2. Current UI structure.**
- Phone: top bar ("MY SADHANA" overline, "My group", Back) → overline "MY GROUP" + "4 devotees" + Refresh → two week pickers → 4-cell count strip → info banner → "3 of 4 submitted · 1 still to submit" → "Still to submit 1" list → "Submitted 3" list (55% opacity) → hint → action bar.
- Desktop: the same in one column; the status sits about 280 px right of the names.

**3–10. Problems.**
- [Hierarchy] Three summaries of one fact: the count strip, "3 of 4 submitted", and the section counts.
- [Visual][A11y] Submitted rows use `opacity: .55`, which reads poorly in dark mode (the 1280-dark capture).
- [Interaction] On a Wednesday the disabled P/A already shows **dashed P**, which looks like a mark.
- [Nav] Back arrow on what is a destination; "My group" appears three times (overline, title, block); the area overline says "MY SADHANA". Group is missing from the phone bar (Home · Week · Report · Account).
- [UX] Status says "Draft"; past unfilled days are not amber.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `group.list`/`group.mark`, the window (Sun 00:00 → Mon 21:00), precedence (head > coordinator > leader > week default > own);
- tap-again-to-clear, the Undo toast, explicit Save, the prefilled WhatsApp text, the week picker;
- the leader marks **only their group**.

**13–21. Redesign.**
- **UI:**
  - A Scope strip (DS §7.2) carries the counts plus "Closes Mon 9 PM".
  - Then **Still to submit** (full contrast, amber left edge), then **Submitted** (full contrast, muted chip; no opacity).
  - Top bar title "My group" (no overline); Back removed.
- **UX:** status line per row: "2 of 7 · Missing Mon, Tue". "Nudge all (1)" opens WhatsApp one by one from a Sheet listing who gets the message.
- **Interaction:** whole row = call sheet (Call / WhatsApp); P/A trailing; keyboard per B.0.
- **Motion:** a saved mark tints in 120 ms; rows **never re-sort while marking**; the action bar rises 200 ms.
- **Responsive:**
  - Phone: list.
  - Tablet: the same at 600 px max width.
  - Desktop: table (Name · Week · Days · Score · Higher mark · Attendance); no pane is needed (rows have no detail route).
- **States:**
  - "Attendance opens Sun, 11 Oct — the class day."
  - "Attendance closed Mon, 12 Oct, 9 PM. Ask your coordinator to change a mark."
  - "Everyone in your group has submitted. Hare Krishna."
  - Empty: "No one in your group yet — your coordinator adds devotees to your group."
  - Error: "Couldn't load your group — no connection. Showing the copy from 8:40 PM." + Retry.
- **Data:** list/table; day strip; % only when submitted.
- **Components:** Scope strip, Status chip, Staff row, P/A control, Sheet, Toast (Undo), Notice.
- **Micro-interactions:** Android haptic on Save (exists); the "N changes not saved" counter.
- **Imagery:** Not recommended (a work screen; the faces are the members' initials).
- **Density:**
  - PRIMARY: still to submit.
  - SECONDARY: the strip.
  - CONTEXTUAL: higher mark, deadline.
  - ACTIONABLE: call, nudge, P/A.
  - OPTIONAL: submitted list (collapsible when > 8).

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 (P0: shared counts) |
| Complexity | S–M |
| Risk | Low (UI only) |
| Benefit | High on Sundays |
| Performance budget | ≤ +1 KB gz to the devotee chunk; no new calls |
| Phase(s) | 0 (counts), 1 (chip, amber), 2 (bar item, no Back), 5 (layout), 7 (keys, motion) |

**Before → After → Why better → Unchanged.**
- **Before:** greyed list, triple counts, pre-dashed P on Wednesday.
- **After:** one strip, needs-nudge first at full contrast, P/A only when real.
- **Why better:** the leader sees who to call in one glance, and no false states remain.
- **Unchanged:** the API, the window, precedence, Undo.

---

### `#/my-devotees` — My students (facilitator; login-only and member)

**1. Current purpose.** A read-only list of every devotee whose facilitator this is (any batch), for any of the last 52 weeks, with Call and Chat.

**2. Current UI structure.**
- Phone: "MY STUDENTS / 7 students" + Refresh → week pickers → count strip → alphabetical rows (name; chip + strip + %; batch on a 3rd line) with Call and Chat.
- Desktop: the same rows stretched to 970 px, with about 600 px empty between strip and icons.

**3–10. Problems.**
- [UX] Alphabetical order hides who needs help (Ishaan, Manish and Sunil are "Not started" mid-list); there are no reasons.
- [Interaction] The counts are not filters.
- [Visual] No dot legend; "Draft".
- [Mobile] "SPS" wraps to its own line.
- [Nav] The facilitator-only Home is a one-link list ("My students") instead of opening here (360 §10).
- [Perf] Fine.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `fac.devotees`; read-only (no write controls ever);
- the 52-week picker; the chosen week carries to the student page; Call/Chat.

**13–21. Redesign.**
- **UI:** grouped list:
  - **Needs you** (amber edge): Not started, Missing ≥ 2 days, Missed;
  - **Filling**;
  - **Submitted** (collapsed, "5 submitted ›").
- **UX:** each row has a plain reason: "Nothing filled since Sun", "Missed last week", "Down 30 points" (needs an additive `prevOverall` field on `fac.devotees`), plus a 12-week **sparkline** (DS §7.8; additive `trend[12]`, desktop and pane only, so phones read no more rows).
- **Interaction:**
  - Scope-strip cells filter (`aria-pressed`).
  - Row → student. On desktop the student opens in the pane.
  - Keyboard: `j`/`k`/`Enter`/`/` (no `p`/`a`: read-only).
- **Motion:** group collapse 200 ms; pane slides from the right 220 ms; changed-row glow on refresh.
- **Responsive:**
  - Phone: grouped list.
  - Tablet: the same, 2-line rows.
  - Desktop: table (Name · Batch · Status · Days · Score · 12-week trend · Call/Chat) + detail pane.
- **States:**
  - "No students yet — devotees who choose you as their facilitator appear here."
  - "Everyone has submitted this week."
  - Filter empty: "No one is Filling — clear the filter."
- **Data:** table on desktop; sparkline ≤ 1 KB inline SVG; % tabular.
- **Components:** Scope strip, Grouped list, Status chip, Sparkline, Staff row, Empty state.
- **Micro-interactions:** pressed row sink 0.99; the filter chip fill fades 120 ms.
- **Imagery:** Not recommended (a data screen).
- **Density:**
  - PRIMARY: Needs you.
  - SECONDARY: strip.
  - CONTEXTUAL: reason, trend, batch.
  - ACTIONABLE: Call/Chat.
  - OPTIONAL: Submitted group.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 |
| Complexity | M (two additive fields) |
| Risk | Low–medium: D1 reads for `trend` must be budgeted (skill `sadhana-free-plan`); serve it from `submissions` in one query |
| Benefit | High |
| Performance budget | No startup change; fac chunk ≤ +2 KB gz; one call |
| Phase(s) | 0 (counts), 1 (chip, legend), 2 (facilitator-only Home opens here), 5 (grouping, reasons, pane), 7 (keys) |

**Before → After → Why better → Unchanged.**
- **Before:** an alphabetical list.
- **After:** "who needs me" first, with reasons and a trend.
- **Why better:** it answers the facilitator's one question.
- **Unchanged:** read-only, weeks, contacts.

---

### `#/my-devotees/<login>` — One student (facilitator)

**1. Current purpose.** Shows one student: their contacts, and any week since they joined.

**2. Current UI structure.**
- Phone: top bar "Student" → a centred card (name, "SPS · KT26-0110", Call primary filled, Chat) → "Reports" card with two week pickers + "This week ›" + up to 60 week rows ("Week of 28 Sep – 4 Oct  66% ›").
- Desktop: the same at 970 px; Call and Chat are 460 px wide each.

**3–10. Problems.**
- [UX] **P0 known issue 2:** on a direct link, "This week" ends in `/` (`focusW` not loaded), which gives "Page not found".
- [Hierarchy] Week pickers + "This week" + the list are three ways to the same week. "This week" has no status or score.
- [Visual] Scores in the accent colour, not banded; IYF ID shown (review: drop); generic title "Student".
- [Mobile] 1,276 px tall for 13 weeks; no trend.

**11. SEO.** noindex.

**12. Must remain unchanged.** `fac.devotee`; any week since joining (156 back); read-only; Call/Chat.

**13–21. Redesign.**
- **UI:**
  - Title = the student's name.
  - Header row: initials avatar · batch · "Facilitator view" chip · Call (Secondary) · Chat (Secondary). No Primary: there is no main action here.
  - **This week** summary: status chip, day strip, %.
  - **12-week sparkline + average**.
  - **Weeks** list, 48 px rows, banded % pills (`--hi/--mid/--lo`), Missed in red "Missed · 0".
  - One "Older weeks…" picker at the end, replacing the two at the top.
- **UX:** "This week" always resolves (it falls back to `mondayIST()`).
- **Interaction:** a row opens the week (pane on desktop); `j`/`k`/`Enter`; swipe ‹ › between students in list order (Phase 7).
- **Motion:** sparkline draws once per session (High/Balanced).
- **Responsive:**
  - Phone: page.
  - Tablet: page.
  - Desktop: it is the **pane** of My students; a direct link shows the list + pane.
- **States:**
  - "No submitted weeks yet — their first week appears after Monday 9 PM."
  - "Not active since 7 Sep" chip.
  - Error with Retry.
- **Data:** list, sparkline, banded pills.
- **Components:** Grouped list, Status chip, Sparkline, Stat tile (average), Button Secondary.
- **Micro-interactions:** the row chevron nudges 2 px on press.
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: this week.
  - SECONDARY: trend.
  - CONTEXTUAL: batch.
  - ACTIONABLE: Call/Chat.
  - OPTIONAL: older weeks.

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (link) / P1 |
| Complexity | S |
| Risk | Low |
| Benefit | Medium-high |
| Performance budget | No new call (`fac.devotee` already lists weeks) |
| Phase(s) | 0 (link fix), 1 (bands, dates), 5 (layout, pane), 7 (swipe) |

**Before → After → Why better → Unchanged.**
- **Before:** a broken direct link, duplicate pickers, a flat list.
- **After:** this week + trend + weeks.
- **Why better:** the student's direction is visible in 2 s.
- **Unchanged:** data, range, read-only.

---

### `#/my-devotees/<login>/<weekId>` — One student's week (facilitator; `WeekRead`)

**1. Current purpose.** A read-only week: score bars, each day in one line, a tap-to-open day report, and the week-end answers.

**2. Current UI structure.**
- Phone: name overline + "Week of 5 Oct – 11 Oct" → a bar carousel (4 of 11 bars visible, 3 dots of 7 × 7 px) → 7 day rows (3-line summaries + "93%" pill + chevron) → the key–value list (Average rounds, Night Stay, 4 regulative principles).
- Desktop: all 11 bars; rows 950 px wide.

**3–10. Problems.**
- [Mobile] The carousel hides 7 of 11 areas.
- [A11y] Dots of 7 × 7 px (review §2.2).
- [Visual] Every non-overall bar is the same brown, not the category colour.
- [UX] Misses are not bold; there is no ‹ › to the previous or next week; title "Week" is generic.
- [Hierarchy] The 3-line summaries wrap unevenly.
- **Test-data only:** future days scored (review §2.3).

**11. SEO.** noindex.

**12. Must remain unchanged.** `fac.week`; the part-week rules ("the other days count 0"); the day expand with `DayPractice`; read-only.

**13–21. Redesign.**
- **UI:**
  - Header: name + "Week of 5–11 Oct" + status chip + overall %.
  - **Meters (DS §7.8), weakest first**, coloured Body / Soul / Seva / Attendance, with hatch under 50%.
  - Day rows with **misses bolded** ("**Woke 6:10 AM**").
  - Week-end answers as 3 Stat tiles.
- **UX:** ‹ › week stepper in the header (bounded by `since` and the current week).
- **Interaction:** a day row expands (exists); `j`/`k` move between days; `[`/`]` move between weeks; "Show as table" toggle under the meters.
- **Motion:** the expand height animates 200 ms (instant with reduced motion); meters grow once.
- **Responsive:**
  - Phone: meters stacked.
  - Tablet: meters in 2 columns.
  - Desktop: meters left (360 px) | day list right.
- **States:**
  - "Missed · score 0 — no complete day by the deadline (2 of 7 days begun)." (exists; keep)
  - "Being filled · not submitted yet"
  - "Not started yet"
- **Data:** meters; day list; table toggle.
- **Components:** Meter, Status chip, Stat tile, Grouped list.
- **Micro-interactions:** chevron rotate 200 ms (exists).
- **Imagery:** Not recommended (360 §8.2: Report/History/Week: data-first).
- **Density:**
  - PRIMARY: overall + weakest areas.
  - SECONDARY: days.
  - CONTEXTUAL: week-end.
  - ACTIONABLE: none (read-only).
  - OPTIONAL: day detail.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 (P0: targets) |
| Complexity | M (Meter is shared with Report) |
| Risk | Low |
| Benefit | High |
| Performance budget | Meter CSS-only, ≤ 0.8 KB |
| Phase(s) | 0 (dots → targets ≥ 24 px, or removed), 1 (viz colours), 4 (Meter built for Report), 5 (adopt here), 7 (stepper keys) |

**Before → After → Why better → Unchanged.**
- **Before:** a carousel with tiny dots.
- **After:** all areas at once, weakest first.
- **Why better:** the guidance conversation starts from the weak area.
- **Unchanged:** data and rules.

---

### `#/home` — Staff Home (coordinator without a devotee scope)

**1. Current purpose.** The coordinator's start screen: waiting requests, links to batch tools, the verse, birthdays.

**2. Current UI structure.**
- Phone: date overline + "Hare Krishna, SPS" + "Batch coordinator · SPS, SPS Group 2, SPS Online" → "Batch work" → hero "Waiting for you" (two tiles, "3 sign-ups waiting", "1 password reset", both to `#/requests`) + "Open requests" → a 2-row link list ("Batch status and attendance", "Filling chart") → verse carousel (~330 px, 5 px dots) → Birthdays.
- Desktop: hero at half width; the right column holds 2 link rows; about 40% is empty.

**3–10. Problems.**
- [Content] "Hare Krishna, **SPS**": the first word of the team login "SPS Team".
- [IA] Navigation lists on Home (360 §10: none); two tiles open the same page.
- [UX] No this-week view of the batches and no people to nudge.
- [A11y] Carousel dots of about 5 px.
- [Visual] Reopen status is missing for coordinators.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `requests.list`, `reopen.list`, `birthdays.today`;
- birthdays last on the page (CLS 0);
- a devotee-scoped coordinator still gets `DevoteeHome` first.

**13–21. Redesign** (three slots, 360 §10):
1. **Needs you** card (amber edge; only non-zero rows; age shown):
   - "3 waiting for approval · oldest 6 days ›"
   - "1 password reset — call first ›"
   - "2 reopen requests waiting for the IYF head" (info, opens Requests › Reopens)
   - Sun–Mon only: "Attendance open — SPS not marked yet ›"
   - Empty: "All caught up."
2. **This week**: one **Scope strip per batch** (active only): Submitted / Filling / Not started / Missed + "Closes Mon 9 PM". A tap opens `#/batch` filtered (query-string matching fixed first: known issue 3).
3. **People to nudge** (top 5 not started, Call/WhatsApp), then Birthdays, then **one static verse** (no carousel).

- **Greeting:** a team login (name ends "Team" or no personal name) gets "Hare Krishna" + the batch names.
- **Interaction:** rows are links; `g b`, `g h` and `/` (exist).
- **Motion:** counts count up 400 ms once (High/Balanced); changed strips glow on refresh.
- **Responsive:**
  - Phone: stacked.
  - Tablet: Needs you | This week, 2 columns.
  - Desktop: 2 columns (Needs you + People | per-batch strips + Birthdays); no empty half.
- **States:** skeleton of the 3 slots; "Couldn't load requests — Retry. The other cards still work."
- **Data:** strips; short lists.
- **Components:** Needs-you card, Scope strip, Grouped list, Stat tile, Toast.
- **Micro-interactions:** chevron press; badge only for actionable counts.
- **Imagery:** Not recommended: the darshan card is "never in staff areas" (DS §7.2).
- **Density:**
  - PRIMARY: Needs you.
  - SECONDARY: This week.
  - CONTEXTUAL: deadline.
  - ACTIONABLE: rows, nudge.
  - OPTIONAL: verse, birthdays.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 |
| Complexity | M (strips reuse `devotees.list` per batch; ≤ 3 batches, cached) |
| Risk | Medium: extra reads on Home; load the strips lazily after Needs you |
| Benefit | High |
| Performance budget | Home stays in the startup chunk only as a shell; the strips are a lazy staff chunk ≤ 3 KB gz |
| Phase(s) | 0 (shared counts), 2 (remove link lists), 5 (slots), 7 (count-up) |

**Before → After → Why better → Unchanged.**
- **Before:** tiles + links + carousel.
- **After:** what needs me, how my batches stand, whom to call.
- **Why better:** a decision screen, not a menu.
- **Unchanged:** data sources, birthdays.

---

### `#/batch` — Batch status (coordinator; tab "Status")

**1. Current purpose.** The weekly board: status per member, P/A attendance (saved in chunks of 250, Undo), "No regular class this week", Fill for, batch/week/name filters.

**2. Current UI structure.**
- Phone: tabs (Status · Members · Group leaders · Filling chart) → Batch select → week pickers → count chips ("4 / 3 / **5** / 0") → search → "No regular class this week?" + Refresh → banner → rows (name; chip, strip, "2/7", **"Fill"**; P/A).
- Desktop: the same plus a "DEVOTEE / THIS WEEK / ATTENDANCE" header with about 280 px gaps.

**3–10. Problems.**
- [UX] **P0 #2:** "5 Not started" counts Lalit (inactive) and Manish (disabled); the Filling chart says 3.
- [A11y] **P0:** "Fill" link 19 × 32; name links 24 px tall.
- [Interaction] Before Sunday, dashed P/A look chosen.
- [Hierarchy] Alphabetical, not needs-action first; inactive rows sit mid-list.
- [Nav] Desktop tabs duplicate the sidebar; the sidebar says "All my batches" while the page shows "SPS".
- [Content] "Draft"; "by coordinator"; "the master can change it".
- [Mobile] 1,784 px for 12 people.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `devotees.list`, `attendance.set` (≤ 250 per call), `weeks.setClass` and its Sheet (Holiday/Festival/Other, everyone or only marked);
- precedence; Undo; the lock;
- Fill only for active rows in an open week;
- a coordinator sees only their batches.

**13–21. Redesign.**
- **UI:**
  - Page head: batch name (picker only if > 1, synced with the sidebar) · week stepper · Scope strip (active only, tappable filters).
  - Rows sorted **Not started → Filling → Missed → Submitted**.
  - "Not active (2)" footer, collapsed.
- **UX:**
  - "Fill for…" and "Open devotee" move to the row ⋯.
  - A class-week Notice: "Diwali · everyone Present" + Change.
  - "No regular class this week?" becomes an Outline button in the head.
- **Interaction:** whole row → devotee (pane on desktop); P/A trailing; keyboard `j`/`k`/`p`/`a`/`Ctrl+S`/`Enter`; long-press → ⋯ (Phase 7).
- **Motion:** no re-sort while marking; FLIP re-sort ≤ 50 rows on refresh; changed-row glow 1.2 s.
- **Responsive:**
  - Phone: list.
  - Tablet: list, 2-line.
  - Desktop: table (Name · Status · Days · Score · Leader/own mark · Attendance) + DevoteeDetail pane.
- **States:**
  - "Attendance opens Sun, 11 Oct — the class day."
  - "Attendance closed Mon, 12 Oct, 9 PM — the IYF head can change it."
  - "3 attendance changes not saved"
  - "No one matches — clear the search or the status."
- **Data:** table / 2-line list; day strip; %.
- **Components:** Scope strip, Staff row, P/A control, Row menu, Sheet, Notice, Toast (Undo).
- **Micro-interactions:** "Saved for 9 devotees · Undo".
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: who has not started.
  - SECONDARY: strip.
  - CONTEXTUAL: leader/own marks, filled by coordinator.
  - ACTIONABLE: P/A, fill.
  - OPTIONAL: not-active footer.

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (counts, targets) / P1 |
| Complexity | M |
| Risk | Low (UI; the same API) |
| Benefit | Very high |
| Performance budget | coord chunk ≤ +3 KB gz; render 300 rows < 16 ms per frame (no virtualisation needed under 300) |
| Phase(s) | 0, 1, 2 (tabs → sidebar on desktop; one batch scope), 5, 7 |

**Before → After → Why better → Unchanged.**
- **Before:** inflated counts, tiny Fill links, alphabetical order.
- **After:** true counts, needs-action first, ⋯ actions.
- **Why better:** staff trust the numbers.
- **Unchanged:** every attendance rule and API.

---

### `#/members` — Devotees (coordinator; tab, page title "Devotees")

**1. Current purpose.** A directory of a coordinator's batches (the head: all), with search, filters, paging, call/WhatsApp, and delete for inactive or disabled members.

**2. Current UI structure.**
- Phone: search → 4 wheel selects (batch, class, blood group, sort) → status segment "All 12 / Active 10 / Inactive 1 / Disabled 1" → "12 members" → rows (photo, name, batch, IYF ID, last week) + Call/WA + a **red "Delete" button** on inactive and disabled rows.
- Desktop: the list is centred at about 860 px.

**3–10. Problems.**
- [Interaction] **P0:** a destructive Delete button sits in the row (DS §7.5).
- [Mobile] The filters take about 230 px before the first row.
- [Content] "Members" vs "Devotees" (360 §12).
- [Visual] Active rows get no chip; the IYF ID adds noise.
- **Test-data only:** "Nothing submitted yet" on every row.
- [Nav] Desktop tabs duplicate the sidebar.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `members.list` (server paging 50, "Show more"); the filters, including blood group;
- type-the-phone delete confirm; Call/WhatsApp; the head's "All of IYF Delhi" scope.

**13–21. Redesign.**
- **UI:**
  - Search + a "Filters (2)" button → Sheet holding batch / class / blood group / sort.
  - Status segment kept, with counts.
  - Applied filters shown as removable chips.
- **UX:** Delete moves to row ⋯ → the existing confirm Sheet, with the consequence: "Deletes Lalit Chauhan's account. Submitted weeks stay without the name. This can't be undone."
- **Interaction:** row → devotee pane; `j`/`k`/`Enter`/`/`; Esc closes the pane.
- **Motion:** a deleted row collapses 200 ms; the pane slides 220 ms.
- **Responsive:**
  - Phone: list.
  - Tablet: list.
  - Desktop: sortable table (Photo · Name · Batch · Status · Last submitted · Blood group when filtered) + pane.
- **States:**
  - "Nobody matches these filters — clear them."
  - "Approved devotees of your batches appear here."
  - "12 of 48 · Show more"
- **Data:** a table with `aria-sort`.
- **Components:** Search, Sheet, Status chip, Staff row, Row menu, Photo.
- **Micro-interactions:** chip × fades 120 ms.
- **Imagery:** Not recommended (avatars only).
- **Density:**
  - PRIMARY: name + status.
  - SECONDARY: last submitted.
  - CONTEXTUAL: batch, blood group.
  - ACTIONABLE: call, ⋯.
  - OPTIONAL: IYF ID (pane only).

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (row Delete) / P1 |
| Complexity | S–M |
| Risk | Low |
| Benefit | Medium |
| Performance budget | Unchanged calls; ≤ +1 KB |
| Phase(s) | 0, 1 (naming), 2, 5 |

**Before → After → Why better → Unchanged.**
- **Before:** filter wall + red row buttons.
- **After:** compact filters, safe ⋯.
- **Why better:** fewer accidents, faster scanning.
- **Unchanged:** server filters and the delete rule.

---

### `#/leaders` — Group leaders (coordinator; tab)

**1. Current purpose.** Appoint leaders, add or take out members (in at most one group, own batch pool), remove a leader, contact a leader.

**2. Current UI structure.**
- Phone: Batch select → "1 group · 5 devotees in no group" → "Appoint a group leader" card (select + disabled Appoint) → a card per group (leader + Call/WA; members with chip and **× button**; "Add devotees"; "Remove leader") → "In no group (5)" disclosure.
- Desktop: the same at full width; "In no group" is centred.

**3–10. Problems.**
- [Interaction] **P0:** × "Take out" acts **immediately**, with no confirm and no Undo.
- [A11y] Member name links are 24 px tall (review §2.2).
- [Hierarchy] The rare action (Appoint) is the first card; groups come second.
- [Content] "Draft".
- [Visual] A disabled Appoint is shown as a faded primary.

**11. SEO.** noindex.

**12. Must remain unchanged.** `leaders.list/set/assign`; one group per devotee; a leader is in no group; removing a leader frees the members; the checkbox Sheet.

**13–21. Redesign.**
- **UI:**
  - Groups first: header = leader, count, this-week mini strip ("3 of 4 submitted"), Call/WA, ⋯ (Add devotees, Remove leader).
  - Members as 48 px rows: chip + ⋯ "Take out of group".
  - "In no group (5)" as a list with "Add to a group ›".
  - "Appoint a group leader" becomes an Outline button → Sheet.
- **UX:** Take out → Toast "Aarav Gupta is in no group now · Undo" (re-assign with `leaders.assign`).
- **Interaction:** `j`/`k`/`Enter`; drag is not added (no library).
- **Motion:** a moved member slides out (FLIP 200 ms).
- **Responsive:**
  - Phone: stacked groups.
  - Tablet: 2-column grid of groups.
  - Desktop: groups grid (2–3) + "In no group" side column.
- **States:**
  - "No group leaders yet — appoint a devotee, then add devotees to their group."
  - "Everyone is already in a group."
  - "Every active devotee of SPS, SPS Group 2 and SPS Online is already a group leader."
- **Data:** cards per group (a real unit of action), lists inside.
- **Components:** Grouped list, Sheet, Row menu, Toast (Undo), Status chip.
- **Micro-interactions:** the count badge updates with a 120 ms tint.
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: groups.
  - SECONDARY: unassigned.
  - CONTEXTUAL: status.
  - ACTIONABLE: add, take out.
  - OPTIONAL: appoint.

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (Take out) / P1 |
| Complexity | S |
| Risk | Low (Undo uses the existing API) |
| Benefit | Medium |
| Performance budget | ≤ +1 KB |
| Phase(s) | 0, 1, 5, 7 |

**Before → After → Why better → Unchanged.**
- **Before:** one-tap removal.
- **After:** ⋯ + Undo, groups first.
- **Why better:** safe and scannable.
- **Unchanged:** all group rules.

---

### `#/stats` — Filling chart (coordinator; tab)

**1. Current purpose.** Trends for one batch: this week by day, the last 8 weeks' submission share, people counts, and the missed-weeks log.

**2. Current UI structure.**
- Phone: Batch → Refresh → "Week of 5 Oct – 11 Oct" with 4 tiles ("4/10 submitted…") + a day-bar carousel (4 of 7 days, dots) → "Forms submitted, by week" carousel → People tiles (active / inactive / disabled / "waiting approval") + "Open requests" → Missed weeks (name, week, "1 of 7 days").
- Desktop: a 2 × 2 grid.

**3–10. Problems.**
- [IA] The four tiles duplicate Batch status (review §3.1: the chart shows **trends only**). "Open requests" duplicates Requests.
- [A11y] Dots of 7 × 7 px; carousels hide 3 days and 3 weeks.
- [UX] Missed weeks have no actions (review: call, WhatsApp, ask to reopen).
- [Content] "waiting approval".

**11. SEO.** noindex.

**12. Must remain unchanged.** `stats.batch`; 8 weeks; the missed log with Show more; batch picker.

**13–21. Redesign.**
- **UI:**
  - **Day bars: all 7 at once** (a 7-column CSS grid, 28 px bars).
  - **8-week line/bar** fully visible, with the average line.
  - People becomes one line: "10 active · 1 inactive · 1 disabled".
  - **Missed weeks** rows: name · week · days · ⋯ (Call, WhatsApp, Ask to reopen → the DevoteeDetail flow).
- **UX:** "Show as table" under each chart; tap a bar to show its value (DS §7.8).
- **Interaction:** `j`/`k` in the missed list; `Enter` opens the devotee pane.
- **Motion:** bars grow once per session; none on Low.
- **Responsive:**
  - Phone: stacked.
  - Tablet: 2 columns.
  - Desktop: charts row (day | trend) + missed table.
- **States:**
  - "No missed weeks — everyone submitted in the last 8 weeks." (keep)
  - Chart empty: "No submissions yet for this batch."
- **Data:** bars (mono brand, Overall series), table toggle.
- **Components:** Bars (no carousel), Grouped list, Row menu, Notice.
- **Micro-interactions:** bar tap shows its value tooltip for 120 ms.
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: trend.
  - SECONDARY: day bars.
  - CONTEXTUAL: people line.
  - ACTIONABLE: missed-week actions.
  - OPTIONAL: tables.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 (P0: dots) |
| Complexity | S |
| Risk | Low |
| Benefit | Medium |
| Performance budget | Removes carousel JS; net ≤ 0 KB |
| Phase(s) | 0 (dots/targets), 1, 5, 7 |

**Before → After → Why better → Unchanged.**
- **Before:** duplicate counts + carousels.
- **After:** trends you can read whole, missed weeks you can act on.
- **Why better:** one purpose per screen.
- **Unchanged:** data and the API.

---

### `#/requests` — Requests inbox (coordinator; reopens merged)

**1. Current purpose.**
- Approve or reject sign-ups (registry match, "pick another ID", facilitator, level-entry date, class day).
- Approve or reject password resets ("call first").
- Reopens live elsewhere: `#/reopens` (head) and DevoteeDetail (coordinator's "Ask to reopen", whose status is never shown back).

**2. Current UI structure.**
- Phone: Batch select → Refresh → "New sign-ups 3" → full cards (~600 px each: contacts, radio matches, search, facilitator, date "07/10/2026", class day, Reject… / Approve) → "Password resets 1" card.
- Desktop: 2 columns; the resets column is 1 card and ~1,700 px of empty space.

**3–10. Problems.**
- [Mobile] 3,118 px for 4 requests.
- [Visual] **4 Primary "Approve" buttons per view** (DS: max 1).
- [Content] "07/10/2026"; "Batch SPSO" (an ID, not the name); "Natvar Gopi…" truncated; "1 Oct, 9:10 am" with no age.
- [UX] A pre-selected match (Ankit) is unexplained; reopens are split (review §3.1).
- [Nav] Desktop has no list + detail.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `requests.*`, `registry.search`, `resets.*`, `reopen.list` (STAFF, pending, own batches);
- nobody approves their own; the "call first" warning; reject needs a reason;
- `defaultChoice` logic; routes `#/requests` and `#/reopens` both keep working (`#/reopens` → `#/requests?type=reopen`);
- **coordinators never decide reopens** (head only).

**13–21. Redesign.**
- **UI:**
  - Type filter **All · Sign-ups (3) · Resets (1) · Reopens (2)**.
  - Compact rows: avatar initial · name · type chip · batch **name** · age "6 days ago" · chevron.
  - A row opens the **detail** (the existing SignUpCard / reset card) as a phone page or desktop pane.
  - Coordinator reopen rows are read-only: "Week of 21–27 Sep · waiting for the IYF head · asked 2 days ago".
- **UX:**
  - The match explains itself: "Pre-selected: phone and name match".
  - Facilitator shown in full (wrap).
  - Level-entry date "7 Oct 2026".
- **Interaction:** `j`/`k`/`Enter`; Approve via button or `Ctrl/⌘+Enter` inside the pane; **no single-key approve** (it changes accounts).
- **Motion:** an approved row slides out (FLIP 200 ms) and the next one opens in the pane.
- **Responsive:**
  - Phone: list → page.
  - Tablet: list → page.
  - Desktop: list 440 px | pane.
- **States:**
  - "No requests waiting — new sign-ups, password resets and reopen requests for your batches appear here."
  - Per filter: "No sign-ups waiting."
  - Reset: "Before approving, call Sunil Kumar on 60000 00001 and confirm they asked for a new password."
- **Data:** a list with ages; a form in the pane.
- **Components:** Seg filter, Grouped list, Status chip, Sheet (reject reason), Button (1 Primary per pane), Toast.
- **Micro-interactions:** the badge decrements with a tint.
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: oldest waiting.
  - SECONDARY: type counts.
  - CONTEXTUAL: age, batch.
  - ACTIONABLE: Approve/Reject.
  - OPTIONAL: registry search.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 |
| Complexity | M |
| Risk | Medium: the approve form moves; keep its tests |
| Benefit | High |
| Performance budget | One extra cached call (`reopen.list`), ≤ +2 KB |
| Phase(s) | 0 (query-string route fix), 1 (dates, names), 2 (one inbox, one badge), 5 (list-detail), 6 (head decides reopens here), 7 |

**Before → After → Why better → Unchanged.**
- **Before:** a 3,118 px wall of forms.
- **After:** an inbox with ages and one form at a time.
- **Why better:** faster and safer approvals.
- **Unchanged:** every rule and API.

---

### `#/devotee/<login>` — Devotee detail (coordinator)

**1. Current purpose.** One devotee's profile, contacts, emergency contact, facilitator/class, batch history, last weeks, fill on behalf, ask to reopen, and the account actions.

**2. Current UI structure.**
- Phone (2,461 px): profile card (Call 6000000011 primary, WhatsApp, Email, then **the same contacts again** as rows; "05 Jan 2026") → Facilitator and class (Change) → Batch history → "Fill for Aarav" (View + "Fill this week") → Last weeks (8 × "Attendance: not marked") → Account (Mark inactive + **three red buttons**: Disable login, Remove photo, Delete account).
- Desktop: 2 columns.

**3–10. Problems.**
- [Interaction] Destructive actions stacked as row buttons; inline confirms instead of a Sheet.
- [Hierarchy] Contacts are repeated; generic title "Devotee".
- [UX] "Fill this week" is offered for a submitted week (Aarav, 60%).
- [Content] "05 Jan 2026"; "Ask the master".
- [A11y] "View" 33 × 20 (review §2.2).
- [Visual] No trend.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `devotees.get` and every action with its confirm and reason;
- coordinator: own batches only, "ask to reopen" (head decides); fill only open weeks;
- delete by typing the phone; `fixRow` board sync.

**13–21. Redesign.**
- **UI:**
  - Title = name.
  - Header: photo, status chip, batch; **Call · WhatsApp · Email** (one row, no repeats).
  - **This week** card: chip, strip, and **"Fill for Aarav"** Primary, shown only if the week is open and not submitted.
  - 12-week sparkline.
  - **Weeks** list: banded pill, attendance + who, "Ask to reopen" on Missed.
  - Profile facts in a disclosure ("Details: birthday, blood group, address, emergency").
  - **"More actions ⋯"** Sheet: Mark inactive, Disable login, Remove photo, Delete account; each opens a confirm Sheet with the consequence.
- **UX:** an asked reopen shows "Waiting for the IYF head" on that week.
- **Interaction:** `[`/`]` previous/next devotee in board order; `Esc` closes the pane.
- **Motion:** pane 220 ms; Sheets spring 200 ms.
- **Responsive:**
  - Phone: page (about 1,300 px).
  - Tablet: 2 columns.
  - Desktop: the pane of Batch/Devotees, or a 2-column page.
- **States:**
  - "Not active since 7 Sep — they are not expected that week."
  - "Waiting for approval — open Requests."
  - "No submitted or missed weeks yet."
- **Data:** list, sparkline.
- **Components:** Photo, Status chip, Sparkline, Grouped list, Sheet, Row menu, Toast.
- **Micro-interactions:** the Call button press haptic (Android).
- **Imagery:** Not recommended (profile photo only).
- **Density:**
  - PRIMARY: this week + Fill.
  - SECONDARY: weeks.
  - CONTEXTUAL: facilitator/class.
  - ACTIONABLE: contact, reopen.
  - OPTIONAL: details, account actions.

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (destructive, target) / P1 |
| Complexity | M |
| Risk | Medium: many actions; keep the existing test IDs |
| Benefit | High |
| Performance budget | No new calls |
| Phase(s) | 0, 1, 5, 7 |

**Before → After → Why better → Unchanged.**
- **Before:** 2,461 px, three red buttons.
- **After:** the status and the fill first, risk behind ⋯.
- **Why better:** fewer mistakes.
- **Unchanged:** permissions and actions.

---

### `#/devotee/<login>/week/<weekId>` — A devotee's week, read-only (coordinator; `WeekRead`, `devotees.week`)

**1. Current purpose.** The facilitator's week view, for staff. A coordinator sees only open weeks; the head sees any week.

**2. Current UI structure.** Identical to the facilitator week (bar carousel, 7 day rows, week-end list); top bar "MY BATCH / Week".

**3–10. Problems.**
- Every problem listed for `#/my-devotees/<login>/<weekId>` applies.
- [UX] There is no path to "Fill for…" when the week is open and not submitted.
- [A11y] The entry point "View" is 33 × 20 px.

**11. SEO.** noindex.

**12. Must remain unchanged.** `devotees.week` scope rules (coordinator: open weeks only); read-only.

**13–21. Redesign.**
- Same as the facilitator week: meters (weakest first), bold misses, ‹ › stepper limited to weeks the role may see.
- **Addition:** if the week is open and unsubmitted, a Secondary "Fill for Aarav ›" in the header (the same rule as the Board).
- **Keyboard:** `[`/`]`, `j`/`k`.
- **Responsive:** as the facilitator week; on desktop it opens inside the DevoteeDetail pane.
- **States:** "This week is not open to coordinators — only open weeks can be viewed." (the server's refusal, in plain words).
- **Components:** as the facilitator week.
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: overall + weakest.
  - SECONDARY: days.
  - CONTEXTUAL: week-end.
  - ACTIONABLE: Fill.
  - OPTIONAL: tables.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 |
| Complexity | S (shared component) |
| Risk | Low |
| Benefit | Medium |
| Performance budget | 0 (shared `WeekRead`) |
| Phase(s) | 0 (target), 5, 7 |

**Before → After → Why better → Unchanged.**
- **Before:** a carousel with a dead end.
- **After:** meters + a Fill link.
- **Why better:** read → act in one step.
- **Unchanged:** visibility rules.

---

### `#/fill/<login>/week/<weekId>` and `#/fill/<login>/day/<weekId>/<date>` — Fill on behalf (coordinator)

**1. Current purpose.** A coordinator fills days, saves the week end and submits for a devotee. Saved as "filled by the coordinator"; attendance is read-only here; Share is hidden.

**2. Current UI structure.**
- **Week, phone:** title "**Filling for a de…**" (cut) → amber banner "Filling for Deepak Yadav — saved as filled by the coordinator. **Back to Deepak Yadav**" → ring "0/7" + "Closes Mon 9:00 PM · 3 days to finish" → days (Mon, Tue "Not filled" in **grey**) → End of week → Attendance ("now Present") → Submit.
- **Day:** day chips → "Monday, **05 Oct 2026**" → "How **your** day is scored" → the form → a floating bar "0/100 · **Saved ✓**" on an untouched day, stacked on the bottom nav (phone). On desktop the bar covers "Choose a topic".

**3–10. Problems.**
- [A11y] **P0:** "Back to …" is 17 px tall.
- [UX] **P0 #6:** "Saved ✓" on an untouched day.
- [Content] "your" → "their"; numeric date; truncated title.
- [Visual] Past unfilled days are grey, not amber "Missing".
- [Mobile] Two floating bars (~150 px).
- [Layout] The desktop day form uses 2 columns (review: single column).
- [Trust] Behalf saves are missing from Activity (known issue 7). Attendance in reopened weeks is blocked (issue 5).

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `week.*` with `onBehalfOf`; open weeks only; explicit Save; the leave guard;
- the devotee's own journals, book and rules; attendance read-only here; `?n=` name memory;
- submit with the same part-week rules.

**13–21. Redesign.**
- **UI:**
  - A sticky **Acting-as bar** (surface-floating, coordinator area marker 3 px): avatar · "Filling for Deepak Yadav" · "Saved as filled by the coordinator" · **Done** (44 px; back to the devotee).
  - Top-bar title "Deepak Yadav · Week" / "Deepak Yadav · Mon, 5 Oct".
  - Days show amber **Missing** for past unfilled.
  - On the day page the bottom nav is hidden; only the Save bar floats.
- **UX:**
  - "How their day is scored".
  - Save states `Save` (disabled) → `Saving…` → `Saved ✓`.
  - Submit confirm: "Submit for Deepak Yadav? 2 of 7 days count; the rest count 0."
- **Interaction:** `Ctrl/⌘+S` saves; `[`/`]` previous/next day; Esc → leave guard.
- **Motion:** the check draws in the button 320 ms; nothing moves while typing.
- **Responsive:**
  - Phone: one column.
  - Tablet: one column, 600 px.
  - Desktop: one column of 720 px, with the score and "Still needed" in a right rail.
- **States:**
  - "This week is closed — fill on behalf is for open weeks only."
  - "Couldn't save — no connection. Deepak's entries are kept on this device; tap Save again."
- **Data:** form; live day score.
- **Components:** Acting-as bar (Notice variant), Status chip, Buttons (1 Primary), Sheet (scoring), Toast.
- **Micro-interactions:** Android haptic on Save and Submit (exists).
- **Imagery:** Not recommended (360 §8.2: "Day form, Week, Fill pages: No").
- **Density:**
  - PRIMARY: fields still needed.
  - SECONDARY: score.
  - CONTEXTUAL: acting-as, deadline.
  - ACTIONABLE: Save/Submit.
  - OPTIONAL: scoring Sheet.

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (Saved ✓, target, audit) / P1 |
| Complexity | S–M (Day/Week are shared with devotees) |
| Risk | Medium: shared devotee components; the behalf checks must pass |
| Benefit | High trust |
| Performance budget | 0 KB net (hide nav, CSS only) |
| Phase(s) | 0 (Saved ✓, target, audit lines, reopened-week attendance), 1 (amber, dates), 4 (Day/Week revamp shared), 5 (acting-as bar), 7 |

**Before → After → Why better → Unchanged.**
- **Before:** a cut title, a false "Saved ✓", grey misses.
- **After:** a clear acting-as bar, honest saves, amber gaps.
- **Why better:** no confusion about whose record this is.
- **Unchanged:** the behalf API and rules.
