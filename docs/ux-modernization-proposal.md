# Sadhana Record — UI/UX Modernization Proposal

**IYF Delhi · a proposal, not a plan of record · 7 October 2026**

> **Superseded for UI/UX planning (8 Oct 2026):** the final revamp set in `docs/revamp/` (start at `revamp/README.md`) is now the plan of record; its proposals were reviewed and the feasible ones merged. This document is kept for history.

This document proposes how Sadhana Record could evolve. **Nothing in it is built.**

- **What exists today** is described in *Sadhana Record — Current Feature & Functional Documentation* (`docs/current-features.md`).
- **Labels:** every section separates **CURRENTLY EXISTS** (short, for context) from **PROPOSED**.
- **Each proposal states:** what exists → the problem → the improvement → why → the expected benefit → complexity (S / M / L) → priority:
  - **P0** — critical;
  - **P1** — major;
  - **P2** — enhancement;
  - **P3** — polish.

**Order of priorities, applied to every idea:** Functionality > Usability > Performance > Visual polish > Decorative effects.

**Relation to the 4 October audit (`docs/modernization-audit.md`).** Much of that audit is now built and live:
- warm neutrals and area colours;
- the High / Balanced / Low look tiers;
- the bar / rail / sidebar navigation;
- the offline launch;
- the Sheet component;
- press feedback.

This proposal does not repeat those. It starts from what is live on 7 October 2026 (release phase 10).

---

## Contents

1. Design vision
2. Role-specific future experience
3. Route-by-route proposal
4. Advanced cross-platform UX
5. Sensor and device capability matrix
6. Visual design proposal (including devotional imagery)
7. Motion and microinteraction proposal (7.1 dynamic interface · 7.2 dynamic/static ratio per screen · 7.3 platform check)
8. Responsive and adaptive strategy
9. Performance constraints
10. Accessibility
11. Roadmap
12. Best-bargain selection from the advanced UI/UX brief
13. Design references: what to borrow, and where

---

## 1. Design vision

Sadhana Record should feel like **a calm daily companion**, not an office tool:

- **Quick to fill:** a day in under a minute, with one hand, on a low-cost phone, with patchy network.
- **Honest about status:** every screen answers its person's one question first (§2).
- **Devotional, not decorative:** scripture, deities and gold detail are used with care and meaning, never as wallpaper.
- **Tactile:** every tap is acknowledged at once. Important moments (saved, submitted) are felt, not only seen.
- **Quiet:** a few colours, few cards, and no badges or animation without a reason.

**CURRENTLY EXISTS (foundation to build on):**
- warm sandalwood and indigo-night neutrals;
- one accent per area;
- serif headings and gold details;
- verse of the day;
- High / Balanced / Low tiers;
- press feedback;
- one navigation model.

---

## 2. Role-specific future experience

### 2.1 Devotee — "What is my sadhana status, and what do I need to do?"

**CURRENTLY EXISTS:**
- The Home **Today** card, which offers the one next action.
- The day strip for the week.
- Open-weeks cards; drafts not saved; the 9 PM reminder.

**Problem:** Home is long. Below Today it stacks several more blocks:
- the notification or install card;
- the weeks card;
- verses;
- the latest post;
- six quick actions.

A devotee who opens the app at 9:30 PM must read the Today card *and* the week card to know whether the week is on track.

**PROPOSED:**

1. **One status line under the greeting (P1, S).** For example: "This week: 5 of 7 days · submit Sun 6 PM – Mon 9 PM". It turns amber in the last 24 hours, and becomes "Submitted ✓ 82%" after submit.
   - Why: answers the role question in one glance.
   - Benefit: fewer missed weeks.
2. **Today card states for "late" (P1, S).** After 9 PM, if today is empty, the card's primary action is "Fill today (2 min)". On Monday before 9 PM with the week unsubmitted, the primary action is "Submit week — closes 9 PM".
   - The data already exists in `home.get`.
3. **Consistency, gently (P2, S).** "Submitted 7 of the last 8 weeks" in Report. **No streak flames, points or leaderboards.**
   - Why: sadhana is personal. Comparison and gamification work against its spirit, and push people to fill falsely.
4. **Quick actions trimmed to four on phones (P2, S):** Report, History, Hearing, Share today.
   - Reading and Notices are already on the bar or bell; they go into "More".

### 2.2 Group leader — "Who in my group still needs a nudge?"

**CURRENTLY EXISTS:**
- My group, with Still to submit first and Submitted greyed.
- Call and a WhatsApp nudge per person; P/A attendance.

**PROPOSED:**

1. **"Nudge everyone remaining" (P1, S).** One button opens the share sheet with a single message naming the people still to submit, for the group's WhatsApp group (Web Share; WhatsApp link as fallback).
   - Why: WhatsApp cannot message many people at once, but a group chat already exists.
   - Benefit: one action instead of N.
2. **Deadline countdown in the header (P2, S):** "Closes in 3 h 20 min" from Monday noon.
3. **Attendance in one pass (P2, M).** "Mark all Present", then tap the few absent.
   - Why: most of a class is present.
   - Benefit: about 10 taps saved per week.
   - Keeps the explicit Save and Undo.

### 2.3 Facilitator — "Who needs my attention?"

**CURRENTLY EXISTS:**
- My students with status per week; any past week; each day summarised in one line.
- Read-only by design.

**PROPOSED:**

1. **A "Needs attention" section on top (P1, M).** It lists students who:
   - missed last week;
   - have not started this week by Sunday;
   - had their Overall fall ≥ 15 points over 3 weeks;
   - have chanting finished after 9 PM on 3 or more days.

   Each gets a reason chip ("Missed last week", "Falling: 78 → 54").
   - Why: a facilitator has 10–40 students and limited time; status alone does not say who is struggling.
   - Benefit: earlier personal care.
   - Server: one aggregate per student; one query in `fac.devotees`.
2. **A 6-week sparkline per student (P2, S).** Reuses the existing Trend component, in miniature.
3. **Student page summary (P2, S).** Averages over the last 4 weeks: sleep, wake-up, rounds, hearing, reading, before the week list.
4. **Fix: the deep-link "This week" (P0, S)**, known issue 2.

### 2.4 Coordinator — "How are my batches and people doing this week?"

**CURRENTLY EXISTS:**
- Staff Home ("Waiting for you").
- Status board with counts and attendance.
- Members; Group leaders; Filling chart; Requests.

**PROPOSED:**

1. **A batch health strip on staff Home (P1, S).** One line per batch: submitted / expected, attendance marked or not, and missed last week, each linking to the board filtered.
   - Why: a coordinator with three SPS batches must open each board today.
   - Benefit: Monday-evening triage in one screen.
2. **Exceptions first on the board (P1, S).** Default sort: not started → filling → missed → submitted, as Group already does. Add a "Needs attendance" filter on Sunday.
3. **List beside detail on desktop (P1, M).** Board, Members and Requests show the selected devotee on the right at ≥ 1024 px, instead of navigating away. The audit proposed this; it is not built yet.
4. **Group-leader coverage (P2, S):** "3 groups · 12 devotees in no group", linking to Leaders.

### 2.5 IYF head — "Is the whole system healthy, and what needs a decision?"

**CURRENTLY EXISTS:**
- Overview of batches; 10 admin tabs; Activity; Settings.

**PROPOSED:**

1. **Group the admin tabs (P1, M).** Ten tabs are too many to scan. Group them into four areas, with the tabs as a second level:
   - **People:** All devotees, Coordinators, Facilitators, Group leaders;
   - **Structure:** Batches, IYF IDs;
   - **Decisions:** Reopens, Requests;
   - **System:** Activity, Settings.
2. **A "Decisions" inbox on Overview (P1, S):** reopen requests, staff password resets and possible duplicates, as one list with counts.
3. **System health card (P2, S):**
   - last Sheets copy;
   - last registry refresh;
   - number of slow or failed requests today;
   - reminder devices.

   All this data exists already (`settings.get`, `runlog.list`).
4. **Keep administrative complexity out of other roles:** coordinators never see the System area. This already holds, and the grouping keeps it that way.

---

## 3. Route-by-route proposal

**Format for each route:**
- **Now:** what the route does today.
- **Limits:** its current UX limitations.
- **Proposed:** the redesign.
- **Interaction.**
- **Hierarchy:** first / second / third.
- **Devices:** M = phone, T = tablet, D = desktop, TV.
- **Priority:** P0–P3, with complexity S / M / L.

### 3.1 Public

**`#/welcome`**
- **Now:** lockup, three feature tiles, verse.
- **Limits:** static; nothing tells a newcomer how long sign-up takes or that approval is needed.
- **Proposed:**
  - one line: "Sign up in 3 minutes · your coordinator approves you";
  - a deity darshan image (§6.6) as the hero on High and Balanced tiers; a solid colour on Low.
- **Hierarchy:** 1 Login / Create account; 2 what to expect; 3 verse.
- **Devices:** M one column. T/D split: image left, actions right. TV not applicable.
- **Priority:** P2, S.

**`#/login`**
- **Now:** phone or username, password, notices.
- **Limits:** none serious.
- **Proposed:**
  - `autocomplete="username"` and `current-password` hints checked;
  - "Show password" already exists;
  - optional passkeys later (P3, L; needs server WebAuthn).
- **Priority:** P3.

**`#/signup`**
- **Now:** one long form in five sections (about 20 fields).
- **Limits:**
  - on a phone it is a long scroll;
  - an error near the top is found only after Submit;
  - nothing is saved if the app closes.
- **Proposed:**
  - **a 4-step flow:** You → Address → Batch and facilitator → Password and emergency contact;
  - a step indicator; Back and Next; per-step validation;
  - **the draft kept on the phone** (IndexedDB) until submitted.
- **Interaction:** Enter moves to the next field; the wheel pickers stay.
- **Hierarchy:** 1 the current step's fields; 2 progress; 3 help text.
- **Devices:** M full screen. T/D a centred 560 px card.
- **Priority:** **P1, M**. Benefit: fewer abandoned sign-ups, fewer wrong entries.

**`#/forgot`, `#/change-password`**
- **Now:** fine.
- **Proposed:** a password-strength hint that uses the server's own rules (shared list) before submit.
- **Priority:** P3, S.

### 3.2 Devotee

**`#/home`** — see §2.1.
- **Interaction:** pull-to-refresh is not needed (Refresh exists); keep it.
- **Hierarchy:** 1 status line + Today; 2 this week's days; 3 devotional (verse, darshan), post, quick actions.
- **Devices:** M one column. T/D two columns (exists): work left, devotional right. TV: read-only "today" board (see §8).
- **Priority:** P1.

**`#/week/<weekId>`**
- **Now:** ring, days, end of week, attendance, submit.
- **Limits:**
  - what blocks Submit is shown only after pressing it;
  - three separate blocks must be scrolled.
- **Proposed:** a **submit-readiness checklist** at the top: ✓ 5 of 7 days complete · ✓ Night Stay · ✗ Attendance (opens Sunday). Each item links to its field. Submit is enabled when ready.
- **Hierarchy:** 1 readiness and deadline; 2 days; 3 week-end answers.
- **Devices:** M one column. D: days list left, readiness and answers right.
- **Priority:** **P1, S**.

**`#/day/<weekId>/<date>`**
- **Now:**
  - a long form: body, chanting, hearing, reading, seva, Chetna, comment;
  - live score; "Still needed";
  - wheel time pickers that suggest the last value.
- **Limits:**
  - most days are nearly the same as yesterday, yet every field is entered again;
  - the form is long on small phones;
  - the keyboard hides the action bar (handled), but numeric entry still needs several taps.
- **Proposed:**
  1. **"Same as yesterday" (P1, S):** copies yesterday's times, rounds, book and minutes into today as a draft. The person adjusts, then Saves; nothing is saved silently.
  2. **Section progress in the sticky header (P2, S):** small ticks for Body · Chanting · Hearing · Reading · Seva.
  3. **Steppers on minute fields (P2, S):** −5 / +5 buttons beside the number. Big targets; fewer keyboard opens.
  4. **On Save success:** a short check animation + a light haptic on Android (§7). Exists as a toast and buzz today; refine only.
- **Hierarchy:** 1 what is still needed; 2 the fields; 3 the score.
- **Devices:** M one column, sticky action bar. T/D two columns of sections; keyboard Tab order kept.
- **Priority:** **P1** (1), P2 (2–3).

**`#/history`, `#/history/<weekId>`**
- **Now:** list, and one week's scores.
- **Limits:** a blank page for an open week (known issue 4).
- **Proposed:**
  - **fix the blank page (P0, S)**;
  - each row shows a tiny 4-bar glyph (Body, Soul, Seva, Attendance) beside the %.
- **Priority:** P2.

**`#/report`**
- **Now:** last week, trend, a daily calendar, weekly bars, month and year wheels.
- **Limits:**
  - two views behind one toggle;
  - the trend shows Overall, Body and Soul, but there is no plain-language summary.
- **Proposed:** a one-sentence insight above the chart, computed on the phone from history. For example: "Your wake-up has improved for 3 weeks; hearing dipped last week." No AI service and no server change.
- **Hierarchy:** 1 insight; 2 chart; 3 calendar or weeks.
- **Devices:** D/T: calendar and chart side by side (exists from 640 px).
- **Priority:** P2, M.

**`#/hearing`**
- **Now:** a one-week journal view, bounded to the weeks reached; filters in All weeks.
- **Proposed:** a **"Continue"** row at the top: the next unheard lecture, with Listen.
- **Priority:** P2, S.

**`#/reading`**
- **Now:** current book, PDFs, list.
- **Proposed:**
  - **store the current book on the server (P1, S; known issue 6)**, so a new phone remembers it;
  - optional pages-read estimate (the profile already has pages per hour).
- **Priority:** P1 (server), P3 (estimate).

### 3.3 Group leader, facilitator

- **`#/group`** — see §2.2. Priority P1–P2.
- **`#/my-devotees` and sub-routes** — see §2.3. Priority P0 (fix), P1–P2.

### 3.4 Coordinator

**`#/batch` (Status)**
- **Now:** count chips, rows, attendance, no-class sheet.
- **Limits:**
  - many devotees means long scrolling;
  - attendance one tap per row.
- **Proposed:**
  - exceptions first (§2.4);
  - "Mark all Present" (as for Group);
  - **list beside detail** on desktop;
  - keyboard: `j`/`k` to move, `p`/`a` to mark, `Enter` to open.
- **Devices:** M one column. T rows + a bottom sheet for detail. D list + detail pane. TV read-only board (§8).
- **Priority:** P1, M.

**`#/members`**
- **Now:** search, 4 filters, sort, status, Show more.
- **Limits:** the filters take vertical space on phones.
- **Proposed:**
  - filters in a "Filter" sheet with a count badge ("Filters · 2");
  - search stays visible;
  - list beside detail on desktop.
- **Priority:** P2, S.

**`#/leaders`**
- **Now:** groups, members, appoint, assign.
- **Proposed:**
  - an "In no group" count on top with "Assign…";
  - drag-and-drop between groups on desktop only, with the existing buttons kept as the accessible path.
- **Priority:** P3, M.

**`#/stats` (Filling chart)**
- **Now:** tiles, bars, missed log.
- **Proposed:** a "this week vs. the last 4 weeks' average" delta on each tile ("submitted 78% · ▲ 6").
- **Priority:** P2, S.

**`#/requests`**
- **Now:** sign-up cards with registry matches; resets.
- **Limits:** cards are long. On desktop, one card at a time fills the page.
- **Proposed:**
  - **a queue + detail layout** on desktop;
  - after Approve, focus moves to the next request;
  - a keyboard `a` / `r` with confirm.
  - **Never swipe-to-approve.** Approval links IDs and creates memberships, so it must stay deliberate.
- **Priority:** P1, M.

**`#/devotee/<login>`**
- **Now:** details, history, many inline actions.
- **Limits:** dangerous actions (disable, delete) sit near everyday ones.
- **Proposed:**
  - three groups: **Contact** · **Sadhana** (weeks, fill, reopen) · **Manage** (facilitator, class, active, disable, delete) behind a "Manage" disclosure;
  - a red-tinted "Danger zone" at the end.
- **Priority:** P1, S.

**`#/devotee/<login>/week/<w>`, `#/fill/…`**
- **Now:** read view; on-behalf form with the devotee's own lists (built 7 Oct).
- **Proposed:**
  - the on-behalf banner gets the devotee's photo and name pinned at the top while scrolling;
  - **fix attendance in reopened weeks (P0, M; known issue 5).**

### 3.5 IYF head (Admin)

| Route | Now | Proposed | Priority |
|---|---|---|---|
| `#/overview` | Batch cards | Decisions inbox + health card (§2.5) | P1, S |
| `#/devotees`, `#/groups` | Reused screens | Same as the coordinator proposals | P2 |
| `#/coordinators` | List or table, sheets | Last sign-in shown per coordinator; batches as chips | P3, S |
| `#/facilitators` | List, switch, access sheet (7 Oct) | Number of students per facilitator; a filter "Has access / no access" | P2, S |
| `#/batches` | Add and edit | **Fix the journal bug first (P0, S; known issue 1).** Then show member counts and the coordinators' names in the list | P0 / P2 |
| `#/ids` | Search, duplicates | Keep; side-by-side compare for a duplicate pair on desktop | P3, M |
| `#/reopens` | Cards | Move into the Decisions inbox; keep the route | P2, S |
| `#/activity` | Chips, sentences, filters | Group entries by day ("Today", "Yesterday"); link the target name to its devotee page | P2, S |
| `#/settings` | Selects and time fields | Use the same wheel time picker as the day form; keep the confirm sheet | P3, S |

### 3.6 Shared

**`#/wall`**
- **Now:** posts, likes, comments, pin, images.
- **Proposed:**
  - a picture opens in the existing full-screen view, with pinch-zoom;
  - "Mark all read".
  - **No reactions beyond Like.**
- **Priority:** P3, S.

**`#/account`**
- **Now:** profile and settings in two columns.
- **Proposed:**
  - move Theme and Notifications into a "Preferences" group;
  - add "Text size" (100 / 112 / 125%), applied with a root font-size token.

  Why: many devotees use large system text. An in-app control helps on desktops and shared phones.
- **Priority:** P2, S.

**Go to… (staff)**
- **Now:** screens and devotees.
- **Proposed:** recent devotees opened; actions ("Approve requests").
- **Priority:** P3, S.

---

## 4. Advanced cross-platform UX

**CURRENTLY EXISTS:**
- press states;
- hover only where hover exists;
- `:focus-visible` rings;
- keyboard shortcuts;
- swipe on two screens;
- Back closes sheets;
- safe-area insets;
- `dvh`/`svh` in places;
- online/offline;
- Web Share with WhatsApp and copy fallbacks;
- Notifications and Badging;
- vibration on 4 actions.

**PROPOSED:**

- **Touch (P2):**
  - swipe between days in the Day form (left/right), with the existing chips as the visible control;
  - long-press on a board row opens its quick actions (call, WhatsApp, fill) as a sheet.

  Gestures always have a button equivalent.
- **Mouse (P3):**
  - hovering a student or devotee row on desktop shows a small preview card (this week's strip, last 3 scores);
  - a right-click menu is **not** proposed, because it is not discoverable.
- **Keyboard (P2):**
  - the board and list shortcuts (§3.4);
  - `Esc` to close sheets (exists);
  - a visible "Keyboard shortcuts" sheet on `?` (today it opens How to use).
- **Large screens / TV (P3):** a read-only **Hall display** (§8).
- **Device signals:**
  - `pointer`/`hover` media queries (exist) choose between hover previews and tap sheets;
  - `orientation`: landscape phone shows Report's chart full width;
  - `visibilitychange` refreshes Home and boards when the app returns (exists for Home; extend to boards, P2).
- **Haptics:**
  - only for **completion and error**: day saved, week submitted, attendance saved (exist), and a failed submit (new, a distinct double pulse);
  - **not** for every tap, scroll or toggle;
  - iPhone Safari has no vibration API, so the visual feedback must stand alone.

---

## 5. Sensor and device capability matrix

| Capability | Possible use in Sadhana | Platforms | UX benefit | Risk / limitation | Recommendation |
|---|---|---|---|---|---|
| Push notifications | 9 PM reminder, posts, attendance notice | Android, desktop; iPhone only as a Home Screen app | Fewer missed weeks | iPhone users who don't install miss it | **Exists.** Add a deadline-day reminder Monday 6 PM for unsubmitted weeks (P1) |
| Badging API | Unread posts, waiting requests | Chrome/Edge installed, iOS Home Screen | Glanceable | Not in Firefox | **Exists.** Keep |
| Web Share | Share a day, week, post; group nudge | Android, iOS, desktop Chrome/Safari | Native share sheet | Desktop Firefox lacks it | **Exists**; extend to the group nudge (P1) |
| Clipboard | Copy fallback for share | All modern | Works without a share sheet | Needs a user gesture | **Exists.** Keep |
| Vibration | Saved / submitted / error | Android only | Felt confirmation | iOS none; overuse is annoying | **Exists** on 4 actions; add only "failed submit" (P2) |
| Storage persistence (`navigator.storage.persist`) | Protect unsent day drafts from eviction | Chrome, Edge, Firefox; Safari partial | No lost days on a full phone | The browser may refuse | **Add** after the first draft is saved (P1, S) |
| Background Sync | Send saved-offline days when the network returns | Chrome/Edge Android only | Fewer forgotten saves | Not on iOS; conflicts with the "explicit Save" rule | **Not now.** Keep explicit Save; revisit with a visible "Send when online" opt-in (P3) |
| App shortcuts (manifest) | Long-press icon: "Fill today", "This week", "Report" | Android, desktop | One tap into the task | iOS ignores them | **Add** (P2, S; manifest only) |
| Screen Wake Lock | Keep the screen on while… | Most | — | Battery; no task in the app needs it | **Do not add.** No screen requires a long, hands-free view. Revisit only for the TV hall display |
| Fullscreen | Photo view; hall display | All | Immersion | Exiting confuses some users | **Only** for the TV hall display (P3) |
| Screen orientation | Landscape charts | All | Wider charts | Locking orientation annoys | Respond to orientation; **never lock** (P3) |
| Network Information / Save-Data / Battery | Choose the look tier, skip prefetch and images | Chrome Android | Faster on weak phones | Not in Safari/Firefox | **Exists.** Keep |
| Contact Picker | Fill the emergency contact | Chrome Android | Fewer typos | Android only; privacy prompt | **Add** as an optional button on Android (P3, S) |
| Camera (file input) | Profile photo | All | — | — | **Exists.** Keep; no live camera API needed |
| Geolocation | — | — | — | Privacy; no purpose | **Do not use** |
| Web OTP / SMS | Verify phone at sign-up | Chrome Android | Fewer fake numbers | Needs a paid SMS provider; iOS differs | **Not now** (coordinator approval already verifies) |
| WebAuthn / passkeys | Sign-in without a password | All modern | Fewer resets | Server work; shared phones | P3, L |
| Speech recognition | — | Partial | — | Unreliable; privacy | **Do not use** |
| Gamepad / remote (spatial navigation) | Hall display on a TV | TV browsers | Remote-friendly | Varies by TV | Arrow-key focus model for the hall display only (P3) |

Every capability is optional. The app must behave fully without it, as it does today.

---

## 6. Visual design proposal

**CURRENTLY EXISTS:**
- **Tokens:** sandalwood/indigo neutrals, area accents (lapis, saffron, wine, royal), gold for detail, semantic colours with soft fills.
- **Type:** serif headings and system sans body.
- **Surfaces:** hero card, content card, stat tile, grouped list, notice; glass on floating surfaces by tier.
- **Status:** dot + word.
- **Charts:** CSS bars and an SVG trend.

### 6.1 Typography (P2)

- Keep system fonts: no web-font download.
- **Add `font-variant-numeric: tabular-nums`** wherever numbers line up: board %, tiles, the day score.
- **One extra size for "status line" text** (16/22 semibold), so §2.1's line reads as the most important text after the greeting.

### 6.2 Spacing and layout rhythm (P2)

- **An 8-pt rhythm, enforced:**
  - 8 inside controls;
  - 16 between related items;
  - 24 between sections;
  - 32 between page regions.
- **Today:** some screens mix 12/14/18. Normalising removes visual noise.

### 6.3 Colour (P3)

- **Keep the current tokens:** they pass WCAG AA in tests.
- **Add one "attention" treatment for the facilitator and coordinator exception lists:** a warm amber left edge, never red. Red stays for missed and errors only.

### 6.4 Surfaces and depth — restrained "liquid glass"

**Glass stays where it belongs:**
- floating chrome: top bar, nav, sheets, drawer;
- High and Balanced tiers only, as today.

**PROPOSED:**
- **A single, optional "glass hero":** the Home Today card, over the darshan image (§6.6), on the High tier only. It gets a 1 px light edge, and its text sits on an 85%-opaque layer, so contrast never depends on the image.
- **No glass on lists, forms, charts or cards that hold data.**
- Cost: one extra blurred layer on one screen, removed on Balanced and Low.

### 6.5 Components

| Component | Now | Proposed | Priority |
|---|---|---|---|
| Buttons | 5 variants, press scale | Keep; add a 3-dot busy state for long saves (exists as a spinner); one primary per screen, enforced by review | P3 |
| Forms | Labels above, wheel pickers | Steppers for minute fields; inline "same as yesterday" chips | P1–P2 |
| Tables | Two admin tables | Sticky header and first column on the desktop board and members | P2 |
| Status | Dot + word | Add a reason chip in exception lists | P1 |
| Icons | Inline SVG set | Keep one stroke weight; add 6 icons (attention, insight, darshan, decisions, health, filter) | P3 |
| Charts | Bars, trend, ring, calendar | Mini sparklines in lists; a consistent bar colour per category across Report, WeekRead and the view sheets | P2 |
| Empty states | Icon + reason + action | Add darshan art to the devotee empty states only (§6.6) | P3 |
| Loading | Skeletons, Refreshing, Still working | Keep | — |
| Dialogs and sheets | One Sheet component | Snap points for long sheets (half / full) on phones | P3, M |

### 6.6 Devotional imagery — deity photographs

**Context:** about 100 high-quality deity photographs are available (offered by the app's owner, 7 Oct 2026).

**Where they serve a purpose (PROPOSED):**
1. **Darshan of the day (P2, M).** One deity image a day on Home, beside the verse in the devotional column, with the deity's name and the temple. The image changes daily and the same photo is shown to everyone that day.
2. **Welcome screen (P2, S).** One image as the hero, giving a newcomer the devotional context at once.
3. **Devotee empty states (P3, S).** For example "No sadhana for today yet": a small, calm image instead of an icon.
4. **The share card (P3, M).** Optional deity image on the "Share my day" picture.

**Rules (non-negotiable):**
- **Never** behind text that must be read, under blur, cropped through the face or feet, flipped, or tinted.
- **Never** on error, missed, delete or warning screens.
- **Always** with respectful alt text naming the deity: "Śrī Śrī Rādhā-Pārthasārathi, ISKCON Delhi".
- **Permission:** use only images IYF Delhi has the right to publish, and credit the temple or photographer where required.

**Performance:**
- Each image is resized at build time to 3 widths (480, 960, 1440 px) in **WebP with a JPEG fallback**, about 40–90 KB at 480 px.
  - Both can be made on the existing Mac with no new installs: the local Chrome encodes WebP; `sips` makes JPEG.
  - AVIF, about 20% smaller, is optional later if an encoder is added.
- **Not** in the precache. Only today's image is fetched, after first paint (`loading="lazy"`, `fetchpriority="low"`), and cached for the day.
- **Low tier or Save-Data:** no image; show the verse only.
- 100 images × 3 sizes is about 15 MB of static files on Cloudflare (free), with none in the startup bundle.

**Where to store the images:**

| What | Where | Why |
|---|---|---|
| **Original HD photos** (masters) | IYF Delhi's **Google Drive**: a folder "Darshan — originals", with a sheet listing for each file the deity, temple, photographer or credit, and permission | The archive and the record of rights. **Not** in the app's code folder: HD originals (several MB each) would bloat every release |
| **Web versions** (made by the build script) | The app's static files: `frontend/public/darshan/<id>-480.webp` and `-960`, `-1440`, plus `.jpg` fallbacks and a small `darshan.json` index (date or rotation → image id, deity name, temple, alt text, credit). Deployed with the app on Cloudflare's static hosting | Free. Served from Cloudflare's edge on the **same address as the app**, so the strict security policy (`img-src 'self'`) needs no change. Cached forever (hashed or versioned names). About 600 files and 30 MB, far inside the static-hosting limits |
| **On the phone** | Only `darshan.json` is in the offline precache. Each day's image goes into a small runtime cache (kept for about 7 images) after first view | Offline Home still shows the verse; the image appears when online. Nothing heavy is precached |

**Not recommended for images:**
- **Google Drive links shown directly in the app:** slow, not built for serving images, rate-limited, and they would need the security policy loosened.
- **The database (D1):** fine for small profile photos, wrong for HD images.

**Later, if IYF wants to add or change images without an app release:** move the web versions to **Cloudflare R2** (10 GB free, no download charges), with an IYF-head upload screen. That is a Phase 5+ option, not needed to start.

**Complexity:** M (build script, a daily index, alt texts).

**Benefit:** a devotional, welcoming identity that no generic tracker has, at no cost to speed.

---

## 7. Motion and microinteraction proposal

**CURRENTLY EXISTS:**
- **Durations:** `--d-1` 120 ms, `--d-2` 200 ms, `--d-3` 320 ms; ease `cubic-bezier(.2,.8,.2,1)`; ×0.8 on lower tiers.
- **Press:** scale 0.97 / 0.99 + row tint.
- **Page change:** a 180 ms crossfade.
- **Elsewhere:** sheet slide-up, toasts rise, skeleton shimmer.
- **Reduced motion:** removes movement but keeps tints.

**PROPOSED system (one table, applied everywhere):**

| Moment | Motion | Duration | Notes |
|---|---|---|---|
| Tap / press | Sink 0.97 (controls), 0.99 (rows) + tint | instant down, 120 ms up | Exists |
| Hover (mouse) | Tint only | 120 ms | Exists |
| Focus | 2 px ring, no movement | 0 | Exists |
| Selection (chip, day) | Fill fades in | 120 ms | Exists for most |
| Page change | Crossfade | 180 ms | Exists |
| Week → day (P2) | **Shared-element**: the tapped day chip grows into the day header (View Transitions with `view-transition-name`) | 240 ms | High and Balanced only; a crossfade on Low |
| Sheet open/close | Slide up + backdrop fade | 200 / 160 ms | Exists |
| Save success (P2) | A check draws in the button (stroke-dashoffset), then "Saved" | 320 ms | + Android haptic 10 ms |
| Week submitted (P2) | One calm moment: the ring completes and the score counts up | ≤ 600 ms, once | No confetti. Skipped with reduced motion |
| Error (P2) | The field's border flashes once; the message slides in | 200 ms | + a distinct haptic on Android (failed submit only) |
| List change (P3) | Rows that move (board sort, approvals) slide with FLIP | 200 ms | Max 50 rows animated |
| Progress | Determinate bars only where progress is known; otherwise "Still working…" text | — | Exists |

**Principles:**
- One easing curve.
- Never animate layout properties (width, height, top): only `transform`, `opacity` and colour.
- Nothing loops except the splash progress line.
- Reduced motion turns movement into fades or nothing.
- The Low tier shortens or removes it all.

---

### 7.1 Dynamic, living interface: the feel of advanced Next.js apps, in the compact app

**What the app's owner asked for (7 Oct 2026):**
- the most dynamic UI that is actually achievable, with the feel of advanced Next.js applications;
- a dynamic-to-static ratio that suits each screen's purpose;
- grounded in the app's current structure;
- inside the compact app.

It must work, not just look good on paper, in every way the app is used:
- the browser;
- the installed web app on Android and iPhone;
- the planned Play Store (TWA) and App Store (WKWebView) apps.

Every pattern below uses a browser feature that ships today, has a stated fallback, and is checked in §7.3.

**The answer in one line:** that feel does not come from Next.js itself. It comes from a set of interaction patterns, and modern browsers now do almost all of them natively. Sadhana Record can have the same feel for **about 3 KB of extra JavaScript and 2 KB of CSS**, loaded lazily, without a rewrite.

#### Why not move to Next.js / React

| | Next.js app | Sadhana Record today |
|---|---|---|
| Framework runtime | React + Next router: about 85–100 KB compressed before any screen | Svelte compiles away: the **whole** startup is 55 KB |
| Motion library usually added | framer-motion: about 30–50 KB | none needed (native View Transitions, CSS) |
| Hosting | Server rendering needs Node or an edge adapter | Static files + one Worker (free plan) |
| Offline / PWA | Extra work | Built in |
| Cost of switching | A rewrite of about 40 screens and all the tests | — |

**Verdict:**
- Moving to Next.js would roughly **double what each phone downloads** before the first screen.
- It would also cost the offline and low-end-phone strengths.
- **Keep Svelte; adopt the patterns.**

#### The patterns that make advanced apps feel alive, and their compact equivalents

| # | What it feels like | How Next.js apps usually do it | Compact equivalent here | Status | Cost | Tiers | Priority |
|---|---|---|---|---|---|---|---|
| 1 | **Pages appear instantly** | `<Link>` prefetch on hover or in view | Prefetch the screen's code on idle (exists), plus the **data** on `pointerdown` / hover of a row or link, so it is ready before the tap ends | Partly exists | ~0.3 KB | All except Save-Data | P1 |
| 2 | **Content never blanks while loading** | Suspense `loading.tsx` + SWR / React Query | Skeletons + cached data shown at once, refreshed in the background | **Exists** | — | All | — |
| 3 | **Taps take effect immediately** | `useOptimistic`, server actions | Show the result at once (attendance mark, like, toggle, Save state), confirm in the background, roll back with a message if refused. Exists for likes, Undo toasts and switches; extend to attendance and day Save | Partly exists | ~0.5 KB | All | P1 |
| 4 | **Elements fly between screens** | framer-motion `layoutId` | **View Transitions API** with `view-transition-name`: a day chip grows into the Day header; a board row expands into the devotee page; a batch card into its board; the Today card into the week | Proposed | ~0.3 KB + CSS | High, Balanced (crossfade on Low) | P1 |
| 5 | **Direction-aware page motion** | AnimatePresence slide in/out | Forward slides from the right, Back from the left, using the router's history direction. Today: a 180 ms crossfade | Proposed | CSS only | High, Balanced | P2 |
| 6 | **Springy, physical motion** | framer-motion springs | CSS `linear()` easing (a spring curve as CSS) for sheets, toggles, chips, the nav pill, the wheel snap | Proposed | CSS only | High, Balanced | P2 |
| 7 | **Numbers that count up** | "Number ticker" components | A 20-line count-up helper (`requestAnimationFrame`, 400 ms, once when the number enters the screen): day score, week %, board counts, tiles | Proposed | ~0.3 KB | High, Balanced; others show the final number | P2 |
| 8 | **Charts that draw themselves** | Recharts / visx animations | Bars grow from 0 and the trend line draws in (`stroke-dashoffset`), once per session per chart | Proposed | CSS + ~0.2 KB | High, Balanced | P2 |
| 9 | **Scroll that feels responsive** | framer `useScroll`, parallax | **CSS scroll-driven animations** (`animation-timeline: scroll() / view()`): a large page title that condenses into the top bar, cards that fade up as they enter, a gentle parallax on the darshan image. Zero JS, off the main thread, ignored where unsupported | Proposed | CSS only | High (title condense on Balanced too) | P2 |
| 10 | **Staggered list entrance** | AnimatePresence + stagger | The first 8 rows fade and rise 20 ms apart on first load only | Proposed | CSS only | High, Balanced | P3 |
| 11 | **Live data without refreshing** | revalidation, websockets | Refresh when the app returns to screen (exists for Home; extend to boards), and every 60 s on staff boards in the last 24 h before the deadline. **Changed rows glow once** (1.2 s accent fade): "Deepak just submitted" | Proposed | ~0.6 KB | All (glow off with reduced motion) | P1 |
| 12 | **Stacked, swipeable toasts** | sonner | Existing toasts stack and can be swiped away; Undo kept | Partly exists | ~0.4 KB | All | P3 |
| 13 | **Command palette** | cmdk | "Go to…" with screens and devotees | **Exists** | — | — | — |
| 14 | **Hover previews** | Radix HoverCard | Desktop: hovering a devotee or student shows this week's strip and last 3 scores | Proposed | ~0.8 KB lazy | Mouse only | P3 |
| 15 | **Images that sharpen in** | `next/image` blur placeholder | Darshan images: a 16-px blurred placeholder (~300 bytes) or the dominant colour, then the WebP image (JPEG fallback) fades in | Proposed | build step | High, Balanced; none on Low | P2 |
| 16 | **Smooth theme switch** | next-themes | The theme row's tap cross-fades the page through a View Transition (a circular reveal from the tap point on High) | Proposed | ~0.1 KB | High, Balanced | P3 |
| 17 | **Bento dashboards** | grid dashboards | Staff Home and Overview as a bento grid: one large "Waiting for you" tile, then batch health tiles; a single column on phones | Proposed | CSS | All | P2 |
| 18 | **Ambient, living backgrounds** | animated mesh / aurora gradients | A **static** time-of-day wash everywhere; on the Welcome screen only, a slow drifting gradient on High, paused off-screen. **Never behind data** | Proposed | CSS | High only for motion | P3 |

#### Context that makes it feel alive (not just motion)

| Idea | What changes | Data | Cost | Priority |
|---|---|---|---|---|
| **Time of day** | Greeting and accent wash follow the day: soft dawn gold before 6 AM (brahma-muhūrta: "Good early morning — time for japa"), neutral by day, warm evening after 6 PM, deep night after 10 PM. Static gradients, swapped by one hour check | Phone clock (server-corrected) | ~0.2 KB | P2 |
| **Status-coloured hero** | The Today card's wash follows the week: neutral while filling, amber in the last 24 h before the deadline, green with a check when submitted | `home.get` | CSS | P1 |
| **Darshan and verse of the day** | A new deity image (§6.6) and verse each day | Static files | see §6.6 | P2 |
| **Festival and Ekādaśī days** | A small banner and a gold accent on Ekādaśī and major festivals, from a yearly calendar file IYF provides | JSON per year | ~0.3 KB + data | P2 |
| **The devotee's own birthday** | A birthday card with the darshan image on their Home | profile | ~0.2 KB | P3 |
| **Progress that moves** | After Save, today's chip fills and the week ring advances; after Submit, the ring completes once | existing | CSS | P2 |
| **Live staff boards** | "3 submitted in the last hour" on the board on Sunday evening | `devotees.list` diff | ~0.3 KB | P2 |

### 7.2 The dynamic-to-static ratio, screen by screen (target)

#### How to read the ratio

- **"Dynamic"** means the share of a screen's visible elements that are **live** (update without a reload), **in motion** (enter, move, count, draw) or **contextual** (change with time, status or the person).
- **"Static"** means calm, still content: text to read, fields to type in, lists to scan, devotional words.

**The rule behind every number:**
- **dynamic where it informs or rewards:** status, progress, navigation, live staff data, completed moments;
- **static where the person reads, types or reflects:** forms, lists, scripture, settings.

A screen that is all motion is tiring and slow. A screen that is all static feels dead. The numbers below are **estimates of the maximum dynamism that still serves each screen's purpose**, on the High tier. They will be measured by counting elements on the released screens, not assumed. Balanced keeps about 80% of it and Low about 30% (crossfades and final states only).

**Current state (counted from the code, 7 Oct 2026):**
- most screens are about 5–15% dynamic;
- the dynamic parts today are press feedback, the page crossfade, the verse carousel, skeleton shimmer, the wheel pickers, sheets sliding, the live day score and toasts.

| Screen (route) | Purpose | Now (est.) | Target (High, est.) | What becomes dynamic | What deliberately stays static |
|---|---|---|---|---|---|
| Welcome `#/welcome` | First impression | 15% (splash, verse) | **60 / 40** | Drifting time-of-day gradient; darshan image sharpening in with gentle parallax; lockup entrance; feature tiles rising in stagger | The verse text, the two buttons |
| Login, Forgot, Change password | Get in | 5% | **20 / 80** | Field focus glow; error shake once; success transition into Home (Today card grows from the button) | Fields and labels |
| Sign-up (4 steps) | Join | 5% | **25 / 75** | Step progress that fills; steps slide by direction; the batch and facilitator wheels | Every field; the privacy text |
| Devotee Home `#/home` | "What is my status, what next?" | 15% | **50 / 50** | Time-of-day greeting and wash; status-coloured Today hero; count-up of the day score and week %; day strip filling; darshan of the day; verse carousel; live post teaser; festival / Ekādaśī banner; Today card flies into the week or day on tap | The status line's words, quick-action labels, verse text |
| Week `#/week/…` | Get the week ready to submit | 10% | **40 / 60** | Readiness checklist ticking as items complete; ring advancing; deadline countdown in the last 24 h; Submit "moment" (ring completes, score counts up); day chips fly into Day | Day rows, week-end questions, attendance buttons |
| Day `#/day/…` | Fill one day fast | 15% (live score, wheels) | **25 / 75** | Live score counting; section ticks in the header; Save check-draw + haptic; swipe between days with a direction slide; "same as yesterday" filling fields in a quick cascade | **The form itself stays calm**: fields never move while typing |
| Report `#/report` | See progress | 15% | **55 / 45** | Trend line drawing in; bars growing; calendar days fading in by week; insight sentence; tap a day → its bars morph; month change slides | Numbers once drawn; legend; text |
| History, one week | Look back | 5% | **30 / 70** | Rows rising in stagger; mini 4-bar glyphs growing; row → week shared transition | Week labels and % |
| Hearing, Reading | Choose and open | 10% (swipe) | **30 / 70** | Week slide on swipe; "Continue" card; heard ticks animating; book cover → PDF list transition | Lecture titles, book list |
| Wall `#/wall` | Read posts | 10% | **35 / 65** | New posts sliding in live; like burst (small, once); comment count tick; image sharpen-in; pinned glow | Post text |
| Account | Settings | 5% | **15 / 85** | Theme switch circular reveal; switch springs; photo crop | Everything else |
| Group leader `#/group` | Nudge and mark | 15% | **45 / 55** | Live refresh with "just submitted" glow; rows moving from "Still to submit" to "Submitted" with a FLIP slide; "X of Y" count-up; deadline countdown; P/A spring | Names, contact buttons |
| Facilitator `#/my-devotees…` | "Who needs me?" | 10% | **45 / 55** | "Needs attention" cards rising first; sparklines drawing; reason chips; row → student shared transition; week bars growing; day rows expanding with spring | Names, reasons' wording, day summary text |
| Coordinator Home / Overview (bento) | Triage | 10% | **50 / 50** | Bento tiles counting up; batch health bars filling; live "waiting" count; birthdays carousel; tiles → board shared transition | Labels |
| Batch Status `#/batch` | Run the week | 15% | **45 / 55** | Live refresh near the deadline with glow on changes; count chips ticking; exception rows rising first; "Mark all Present" ripple down the list; row → detail pane slide (desktop) | Names, marks once saved |
| Members, Group leaders, Stats | Manage and analyse | 10% | **30 / 70** | Filter sheet spring; result count tick; charts drawing; FLIP when sorting | The directory itself |
| Requests `#/requests` | Decide | 10% | **25 / 75** | After Approve the card leaves with a slide and the next one rises; registry match highlight | The person's details: decisions need calm |
| Devotee detail | Act on one person | 5% | **20 / 80** | Photo → detail shared transition; week bars; Manage disclosure spring | Every fact and action |
| Admin (Coordinators, Facilitators, Batches, IDs, Reopens, Settings) | Administer | 5% | **15 / 85** | Tab group slide; Decisions inbox counts; health card live dots; Undo toasts | Tables, forms, settings |
| Activity (audit) | Trace | 5% | **10 / 90** | New entries slide in at the top; day group headers stick | The log: it must read like a record |
| Hall display (TV, proposed) | Show the batch's week in the temple | — | **70 / 30** | Live submitted count ticking; attendance bar filling; darshan and verse rotating every 60 s; gentle background drift | The batch name, the date |

**Overall, across a typical devotee week:** about **40% dynamic / 60% static** on the High tier, from about 10% today. Staff screens sit at 30–50% where live data matters; admin at 10–15%.

The aim is a screen that responds and shows what changed, without slowing the one-minute day entry.

#### How "dynamic" stays fast — the rules

1. **Animate only `transform`, `opacity` and colours.** Never width, height, top, or filters on large areas.
2. **One-shot, not continuous.** Counters, draw-ins and entrances run once. The only continuous motion:
   - the Welcome gradient (High, visible only);
   - the hall display;
   - the existing splash line.
3. **Start on visibility.** IntersectionObserver or `view()` timelines; nothing animates off-screen.
4. **Tier-gated:**
   - **High** gets the full target.
   - **Balanced** gets about 80%, shortened by 20%.
   - **Low**, Save-Data and reduced motion get final states with crossfades, which is still clear and finished.
5. **Lazy:** every helper lives in the screen chunks that use it. **Nothing is added to the startup bundle**, which is already at its target.
6. **Budget:**
   - +3 KB JS and +2 KB CSS in total for §7.1–7.2;
   - checked by `npm run size` and a frame-time check in the browser suite;
   - anything over 16 ms per frame on the Android Low tier is cut.
7. **Respectful:** devotional images move only with the gentle Welcome parallax; no confetti; errors flash once, nothing more.
8. **The form rule:** nothing moves under a finger that is typing or choosing.

### 7.3 Will it work everywhere? Platform check

**Platforms:**
- Android browser, installed web app and Play Store app (TWA): all run Chrome.
- iPhone: Safari, the Home Screen web app, and the planned App Store shell (WKWebView). All use the iPhone's WebKit version.
- Desktop browsers.

Support is as published by the browser makers (as of October 2026). **Before building, confirm each row on the real devices with `tools/devices/phone-check.mjs`.**

| Pattern (§7.1) | Android (Chrome / TWA) | iPhone (Safari / Home Screen / WKWebView) | Desktop | Fallback when missing |
|---|---|---|---|---|
| View Transitions (shared elements, direction slide, theme reveal) | Chrome 111+ ✓ | iOS 18+ ✓ | Chrome, Edge, Safari 18+, Firefox 144+ ✓ | Instant change or today's crossfade; nothing breaks |
| CSS `linear()` spring easing | ✓ | iOS 17.2+ ✓ | ✓ | Normal ease curve |
| CSS scroll-driven animations (title condense, reveals, parallax) | Chrome 115+ ✓ | iOS 26+ ✓ (not on older iPhones) | Chrome, Edge ✓; Safari 26+ ✓; Firefox: not by default | No effect: the page simply scrolls |
| Count-up numbers, chart draw-ins, stagger | ✓ | ✓ | ✓ | Final value shown |
| Optimistic updates, prefetch on press, live refresh with glow | ✓ | ✓ | ✓ | (plain JavaScript, works everywhere) |
| WebP images with blur placeholder | ✓ | iOS 14+ ✓ | ✓ | JPEG |
| Web Share (group nudge, share day) | ✓ (TWA too) | Safari and Home Screen ✓; **WKWebView needs the shell's native share bridge** | Chrome, Edge, Safari ✓; Firefox ✗ | WhatsApp link, then copy (exists) |
| Vibration (save, submit, error) | ✓ | **✗ none** | ✗ | Visual feedback only (already the design) |
| Push (reminders, posts) | ✓ (TWA too) | Home Screen app iOS 16.4+ ✓; **App Store shell needs APNs** (planned in the store audit) | ✓ | In-app notices on Home |
| App badge | ✓ installed | Home Screen iOS 16.4+ ✓ | Chrome, Edge installed ✓ | Bell count in the app (exists) |
| Wake lock (hall display only) | ✓ | iOS 16.4+ ✓ | ✓ | Screen may sleep; set the TV to stay on |

**Honest limits:**
- **iPhones on iOS 17 and below:** no shared-element or scroll effects; they keep today's calm crossfades.
  - Today the app does not record which iOS versions its users have: the API receives the app build with each call, but not the browser version.
  - Counting browser versions per day would be a small server change. Measure for two weeks before deciding how much to invest in iPhone-only polish.
- **iPhone gives web apps no haptics.** The save and submit moments must be clear visually.
- **The App Store shell** needs two small native pieces to match the web app: APNs for push, and a share bridge (`store-distribution-audit.md` §5). Everything else in §7 runs in WKWebView unchanged.
- **Firefox on desktop** has no scroll-driven animations; it stays fully usable.

**Why this holds up:**
- every effect is an addition on top of a screen that already works without it;
- removing or not supporting it never removes a function;
- the release gate's browser checks already run with reduced motion and on the Low tier, so the plain version is tested on every release.

## 8. Responsive and adaptive strategy

**CURRENTLY EXISTS:**
- phone bottom bar and drawer;
- tablet rail;
- desktop sidebar;
- wide content cap;
- container queries on key components.

**PROPOSED: change the information architecture by class, not only the widths.**

| Class | Navigation | Primary pattern | What changes |
|---|---|---|---|
| Phone < 600 | Bottom bar + drawer | One column, sheets from the bottom | One task per screen; filters in a sheet; gestures with buttons |
| Tablet 600–1023 | Rail | Two columns where both are useful (Home, Report, Account — exists) | Staff detail opens in a **side sheet** over the list instead of a new page (P2) |
| Laptop / desktop ≥ 1024 | Sidebar | **List beside detail** for Board, Members, Requests, My students (P1) | Keyboard shortcuts; hover previews; sticky table headers |
| Ultrawide ≥ 1600 | Sidebar | List + detail + a third "context" column (this devotee's last 8 weeks) on staff screens (P3) | Content stays ≤ 75 characters per text line |
| TV (P3) | None (remote arrows) | **Hall display** (`#/hall/<batch>`): a read-only, auto-refreshing board of this week's submission count, attendance and the darshan + verse of the day, at 10-foot type sizes (min 28 px), with a large focus ring | For the temple hall or class projector; no personal scores shown, privacy-first; fullscreen and wake lock allowed only here |

---

## 9. Performance constraints

**Today:**
- Startup JS is 55.06 KB of a 60 KB budget (target 55); CSS is 13.58 of 15 KB (target 13.5).
- The precache is about 530 KB; there are no runtime dependencies.

**Every proposal must fit:**

| Proposal | Bundle cost | Rendering / GPU | Battery / network | Verdict |
|---|---|---|---|---|
| Status line, readiness checklist, exceptions first | ~0.5 KB, in existing lazy screens | None | None | Do (P1) |
| Same as yesterday, steppers | ~1 KB lazy (Day chunk) | None | None | Do (P1–P2) |
| Needs attention (facilitator) | Server query + ~1 KB lazy | None | One query | Do (P1) |
| List beside detail | ~3 KB lazy (staff chunks) | None | Fewer page loads | Do (P1) |
| Darshan images | 0 KB JS; images lazy, not precached | One image decode per day | ~60 KB a day on Balanced, 0 on Low | Do (P2) with the rules in §6.6 |
| Shared-element transitions | ~0.3 KB | Compositor only | Negligible | Do on High and Balanced (P2) |
| Glass hero | CSS only | One blur layer | Small on High only | P3, High tier only |
| Sparklines | Reuse Trend (SVG) | Small | None | Do (P2) |
| Hall display | ~4 KB, a separate lazy chunk | Low | Refresh every 60 s | P3 |
| Dynamic layer (§7.1–7.2) | ~3 KB JS + ~2 KB CSS, lazy | Compositor-only, one-shot | Live refresh every 60 s only on staff boards near the deadline | Do, tier-gated and platform-checked (§7.3) |
| Next.js / React migration | +85–100 KB runtime; full rewrite | — | — | **Do not**: the same feel comes from §7.1 at a fraction of the size |
| Motion library (framer-motion etc.) | 30–50 KB | — | — | **Do not add**: View Transitions and CSS cover it |
| Charting library | 30–80 KB | — | — | **Do not add**; current hand-made charts are enough |
| Web fonts | 40–120 KB | — | Extra download | **Do not add** |

**Rules:**
1. Before adding to the startup bundle, move something out of it. The welcome and login styles are the next candidates.
2. New features go into existing lazy chunks.
3. No animation on scroll.
4. Measure on the Android emulator's Low tier before release (the tools exist in `tools/devices`).

---

## 10. Accessibility

**CURRENTLY EXISTS:**
- 44 px targets;
- skip link and focus to the page title;
- live regions;
- native dialogs;
- dot + word status;
- contrast tests (AA) in both themes and all areas;
- reduced motion and reduced transparency;
- keyboard wheels and tabs.

**PROPOSED:**

1. **Automated axe-core checks in the browser suite (P1, S)**, as a dev-only test dependency: zero violations at each route and width.
2. **Real screen-reader passes (P1, M):** TalkBack (Android) and VoiceOver (iPhone) on the five main flows. Record the findings in `docs/`.
3. **Text size (P2):** the in-app 100 / 112 / 125% control (§3.6), plus testing at 200% browser zoom, where no text may be cut off. The Daily/Weekly toggle fix of 5 Oct is the model.
4. **Day strip targets (P2):** the 7 chips on a 320 px phone are about 40 px wide; give them 44 px with less gap.
5. **Form errors (P2):** on a failed Save or Submit, move focus to the first invalid field and announce the count.
6. **Charts (P2):** a "Show as table" toggle under each chart, for screen readers and for printing.
7. **Language (P3):** `lang` on Sanskrit and Hindi text in verses, so screen readers pronounce them better.

---

## 11. Roadmap: one plan, re-ordered for value and feasibility (revised 7 Oct 2026)

> **Superseded, 7 Oct 2026 evening:** after the end-to-end review of every route for every login, the order of work is set by `pre-store-revamp-review.md` §8 (Phase 0 trust and store blockers → 1 one place for everything → 2 role workspaces → 3 dynamic layer → 4 devotional and store assets → 5 store builds). The phase contents below remain the reference for each item.

**This replaces the earlier phase list.** It merges five sources into one ordered plan:
- the known issues (current-features §9);
- the best-bargain list (§12);
- the dynamic layer (§7.1–7.3);
- the role proposals (§2–3);
- the references (§13).

**Ordering rules:**
1. **Fix before you add:** a broken feature costs more trust than a new one earns.
2. **Devotees first:** they are most of the users and the daily load. Missed weeks are the main problem.
3. **Things that need no outside input come before things that do.** Image rights, IYF's festival calendar and a rounds-target decision come later, when the input arrives.
4. **The plain version ships first; motion is layered on top.** So every phase is useful even if the next is never done.
5. **Startup bundle:** each phase must leave it at or under its target.

| Phase | What ships | Why in this order | Depends on | Size |
|---|---|---|---|---|
| **0 — Fix and measure** | **Add-batch journal names (first)**; facilitator deep link; query-string routes; blank history page; attendance in reopened weeks; current book saved on the server; audit gaps. Trim the startup back under target (move welcome/login styles out). Count browser and iOS versions per day (§7.3). `navigator.storage.persist` for drafts. axe checks in the browser suite | Live bugs and blind spots first; the version count decides how much iPhone-only polish is worth | nothing | ~1 week |
| **1 — Status at a glance, and no lost days** (devotee) | §12 B1 state model; B2 status summary + "Your consistency" bars; B4 offline auto-send of pressed Saves with *Saved on this phone → Sending → Saved*; B5 optimistic updates and smooth value changes; B3 success moments; Week submit-readiness checklist; "Same as yesterday" in the Day form; prefetch on press; the Monday 6 PM deadline reminder | Biggest effect on missed weeks and lost days, for the biggest group of users; all plain UI on existing data | Phase 0 | ~2–3 weeks |
| **2 — Staff flow** (Linear-style) | Coordinator: exceptions-first board, live refresh near the deadline with a changed-row glow, batch health strip on Home, "Mark all present", list beside detail on desktop, keyboard `j`/`k`/`p`/`a`. Requests as a queue with focus moving to the next. Devotee detail grouped (B12). Filters kept in the URL (B11). Facilitator: "Needs attention", sparklines, student summary. Group leader: nudge everyone, mark all present. IYF head: admin grouped, Decisions inbox, health card | Staff time is the next bottleneck; list-detail and keyboard flows are where Linear's lessons pay off | Phase 1 state model | ~3 weeks |
| **3 — Motion and navigation layer** | B6 shared-element transitions (day chip → day, row → devotee, card → board, Today → week); direction-aware page motion; B7 swipe between days, weeks and devotees (‹ › buttons too); B8 count-ups and chart draw-ins; B9 hide-on-scroll bar; B10 interactive charts; spring easing; staggered first entrance | Layered on screens that already work; every effect falls back cleanly (§7.3) | Phases 1–2 | ~2 weeks |
| **4 — First impression and devotional character** | Image pipeline + darshan of the day (§6.6); Welcome with image; 4-step sign-up with a saved draft; time-of-day wash; status-coloured Today hero; scroll-driven title condense (iOS 26+ / Chromium); festival and Ekādaśī banners | Needs outside inputs: image rights, the calendar file. Sign-up is used once per person, so it follows daily-use work | Image rights; IYF calendar file | ~2–3 weeks |
| **5 — Hardening and extras** | TalkBack and VoiceOver passes; in-app text size; charts as tables; app shortcuts (manifest); long-press quick actions; failed-submit haptic (Android); contact picker (Android); sheet snap points; optional hall display (TV) | Polish and reach; nothing here blocks daily use | Phases 1–4 | ~2 weeks |

**Total:** about 12–14 weeks if done in sequence. Phases 0–1 alone (about 3–4 weeks) deliver most of the user-visible gain.

**After each phase:**
- the release gate (tests, size budgets, 1,600+ browser checks);
- the Android and iPhone device checks (`tools/devices`);
- light, dark and phone, desktop screenshots;
- one release.

**LMS ordering (separate proposal):** start the LMS's knowledge base after UX Phase 1, so it is built on the shared state model and design. The programmes and lessons wait for the answers to the LMS proposal's §10.

**Not recommended (unchanged):**
- gamification (streaks, points, leaderboards);
- a chart library, web fonts or a motion library;
- a framework change;
- silently sending drafts the person never saved. (Re-sending a Save they pressed while offline is fine, and is in Phase 1.)
- geolocation;
- glass on data surfaces;
- haptics on every tap.

---

## 12. Best-bargain selection from the "advanced UI/UX" brief (7 Oct 2026)

**The brief:** the app's owner shared a 15-layer brief for an advanced UI and asked to **choose the best bargain for our stack**:
- Svelte 5 + Vite SPA (not SvelteKit, not React);
- Tailwind 4 tokens;
- Cloudflare Worker + D1;
- installable PWA;
- 55 KB startup;
- Android and iPhone, including the planned store shells.

**Each item is placed in one of four buckets:**
- **A — Already live:** do not redo; polish only.
- **B — Do next:** highest value per KB and per day of work.
- **C — Later:** worth it after B.
- **D — Skip:** the reason is given.

**Costs** are lazy-loaded KB and working days.

### A — Already live (from the brief, nothing to build)

- **Visual:** typography hierarchy (serif headings), design tokens, adaptive light/dark/automatic, contextual area accents, glass on floating surfaces (tiered), ambient washes, responsive phone / rail / sidebar.
- **Navigation:**
  - bottom bar on phones and an adaptive sidebar on desktop;
  - deep links;
  - the phone's Back closes sheets;
  - scroll position restored;
  - keyboard-aware layout (the bar hides while typing);
  - page crossfade (View Transitions).
- **Micro-interactions:**
  - press feedback;
  - skeleton loading;
  - toggle animation;
  - progress ring;
  - Undo toasts;
  - haptics on save, submit and attendance (Android).
- **Touch:** bottom sheets, wheel pickers, swipe between lecture weeks, photo crop drag, photo zoom.
- **Device awareness:**
  - touch vs mouse (hover guards);
  - reduced motion and reduced transparency;
  - system theme;
  - safe areas;
  - network, battery and memory (look tiers);
  - offline bar;
  - installable.
- **Loading:** cached data first, refreshed in the background (stale-while-revalidate); idle prefetch of the next screen.
- **Offline:** drafts kept per day on the phone; sign-in and Home without a connection.
- **Personalisation by role:** one navigation model per scope (devotee, group leader, facilitator, coordinator, IYF head).
- **Accessibility:** 44 px targets, focus rings, live regions, contrast tests, semantic dialogs.

### B — Do next: the best bargain (about 3–4 weeks, ≈ 4 KB JS + 2 KB CSS, all lazy)

| # | Item from the brief | What it becomes in Sadhana Record | Why it is a bargain | Cost |
|---|---|---|---|---|
| 1 | **"UI that understands state"** | One state model drives every visual: day empty / partial / complete; week not started / filling / ready / submitting / submitted / missed / reopened. Each state has one colour, icon, copy and action, used by the Today card, the ring, the day strip, the board and the group list | The states already exist in the data; today each screen styles them by itself. One table removes inconsistencies, and every later animation hooks into it | 2 days · 0.5 KB |
| 2 | **Intelligent dashboard** | Devotee Home leads with one block: *"Week of 6–12 Oct · 5 of 7 days · avg 15.2 rounds · Night Stay ✓ · principles ✓ · submit Sun 6 PM"*, then one action. Below it, **"Your consistency"**: last 6 weeks as small bars (from History) | Answers "what is my status" in one glance; the data is in `home.get` and `history.list` | 3 days · 1 KB |
| 3 | **Success states** | After Submit: *"✓ Week submitted · 82% · week of 6–12 Oct"* with the ring completing once. After Save: a check drawn in the button. Android: one haptic | Rewards the key action; CSS + existing ring | 1 day · 0.3 KB |
| 4 | **Offline sync status** | A pending Save is **sent automatically when the connection returns while the app is open**: the person already pressed Save, so this is not silent auto-saving. States: *Saved on this phone* → *Sending…* → *Saved ✓*. Home's "Not saved yet" gets **Send all now** | Today the person must remember to press Save again; this removes a common cause of lost days. It reuses the existing saver and IndexedDB | 2 days · 0.6 KB |
| 5 | **Optimistic updates + values updating smoothly** | Attendance marks, likes and toggles show at once and roll back with a message if refused. When fresh data arrives after cached data, changed numbers count to the new value | Removes the last waits users feel | 2 days · 0.6 KB |
| 6 | **Shared-element transitions** | Day chip → Day page; board row → devotee; batch card → board; Today card → week (View Transitions) | Native API, no library; makes navigation feel connected | 3 days · 0.3 KB + CSS |
| 7 | **Swipe between related views** | Swipe between **days** (Day), **weeks** (Week, Report), and **devotees** on a staff devotee page and a facilitator's student page (with ‹ › buttons too). This is the brief's *Dashboard → Sadhana → swipe →* idea, in our routes | Staff review is next-person-next-person; no return to the list each time | 3 days · 0.8 KB |
| 8 | **Numbers counting up, charts that draw in** | Day score, week %, board counts; Report bars and trend | Cheap, high perceived quality; final value on Low tier | 1 day · 0.4 KB |
| 9 | **Hide-on-scroll navigation that comes back on intent** | On phones, the bottom bar slides away while scrolling down long lists (Members, Wall, Activity) and returns on the first scroll up or at the end | More room on small phones; ~30 lines | 1 day · 0.3 KB |
| 10 | **Interactive charts** | Tap a bar or calendar day → its value and the day (exists for the calendar); hover on desktop shows the exact value | Small extension of what exists | 1 day · 0.3 KB |
| 11 | **Persistent navigation state** | Filters and the chosen week on Members, Board and My students live in the URL (as Hearing and Reading already do), so Back and reload keep them | Fewer re-selections for staff | 1 day · 0.2 KB |
| 12 | **Progressive disclosure** | Devotee detail: Contact · Sadhana · *Manage* (behind a disclosure) · Danger zone; admin tabs grouped (§2.5) | Less clutter where staff take risky actions | 2 days · CSS |

### C — Later (after B, if wanted)

- **Scroll-driven effects** (large title condensing, reveals): CSS only. iOS 26+ and Chromium only, so they fall back gracefully (§7.3).
- **Spring easing** with CSS `linear()` on sheets, toggles and the nav pill.
- **Darshan of the day** and the Welcome image (§6.6). Needs image rights and the image build step.
- **Time-of-day wash** and **festival / Ekādaśī banners** (needs the yearly calendar file from IYF).
- **Long-press quick actions** on staff rows (call, WhatsApp, fill); buttons stay.
- **"Same as yesterday"** in the Day form (§3.2).
- **A rounds target** (e.g. "14 / 16 rounds"). This needs an IYF decision: rounds are recorded but **not scored** today (chanting is scored by finishing time), and no target exists in the data.

### D — Skip, and why

| Item from the brief | Why we skip it |
|---|---|
| Moving to **SvelteKit, React or TypeScript** | No user-visible gain. Server rendering adds hosting complexity on Workers. React would more than double the startup download. TypeScript is a rewrite of every file. (A cheap middle step if wanted: JSDoc types + `svelte-check` in CI.) |
| **Queueing week submissions offline** | Submit is scored by the server against the Monday 9 PM deadline. A submit queued at 8:59 PM and sent at 9:05 PM would fail. Submit stays online-only, with a clear message |
| **Daily checkboxes for the 4 regulative principles** (as in the brief's form example) | IYF's rule is one weekly Yes/No for the principles and for Night Stay (opens Saturday 6 PM). Changing it is a scoring-rule decision for IYF, not a UI choice |
| **Submission streaks** | Encourages filling for the streak's sake. "Your consistency" bars show the same facts without pressure |
| **Device motion / orientation sensors, magnetic hover, perspective tilt, physics dragging, elastic scrolling** | No task needs them. iPhone asks permission for motion. The phones already scroll elastically. They cost battery and look gimmicky |
| **Pull-to-refresh gesture** | The app already refreshes when it comes back on screen and has Refresh buttons. A custom gesture fights the page scroll and iOS's own pull. Not worth ~1 KB and the bugs |
| **Radial / circular selectors, a 2-D week cross** | The wheel pickers and week stepper already work with touch, keyboard and screen readers. A radial control is harder to make accessible |
| **Drag & drop** (except possibly group leaders on desktop, §3.4) | Phones are the main device; buttons are faster and accessible |
| **Breadcrumbs** | Routes are at most two levels deep; the top bar's Back and title already say where you are |
| **Glass everywhere, more blur and dynamic shadows** | Blur is the costliest effect on low-end Android. Glass stays on floating chrome only, by tier |

### Expected result

**The aim:** after B, the app shows each person's state at a glance, responds to every tap, and keeps working offline. The things the brief calls "Apple-level" (connected transitions, success moments, counting numbers, swipe between related views, offline sync status) are all in B.

**What B costs:**
- about 4 KB of lazy JavaScript;
- nothing added to the 55 KB startup;
- no new libraries;
- no change of framework.

**Before each item ships, it must:**
- work on Android, iPhone (old and new iOS) and desktop (§7.3);
- pass the existing release gate.

---

## 13. Design references: what to borrow, and where

The app's owner shared a list of design references (7 Oct 2026). The aim, in their words: *Apple's polish + Linear's application UX + Mobbin's real-world patterns + Godly's visual creativity + devotional character, without becoming flashy.*

Each reference below is mapped to **one concrete thing** to study and **the screen it applies to**, inside the stack and budget of §7.3 and §9. References are for study, not copying: their layouts and assets belong to their owners.

| Reference | Study it for | Apply to | Do not borrow |
|---|---|---|---|
| **Mobbin** (real app screens) | How habit, health and form-heavy apps do daily entry, weekly summaries, onboarding steps, empty states, settings | Day form, Week readiness (§3.2), 4-step sign-up (§3.1), Account | Flows that rely on native-only controls |
| **Linear** | Keyboard-first lists, command menu, quick status changes in place, dense but calm rows, side peek of an item without leaving the list, optimistic updates | Coordinator board, Members, Requests queue, list beside detail (§2.4, §8), Go to… | Its dark-only look; desktop-only assumptions |
| **Raycast** | Designing around an interaction model (type → act), not screens; extending the existing Go to… with actions | Go to… (§3.6: actions like "Approve requests"), staff shortcuts | Anything that needs a native app |
| **Apple product pages** | Progressive disclosure, whitespace, typography scale, one message per screen-height, scroll-linked reveals done with restraint | Welcome, devotee Home status block, Report insight | Long scroll storytelling on task screens; heavy video |
| **Vercel** | Status timelines, precise small type, subtle borders and depth in dark mode, crisp loading states | IYF head health card (§2.5), Activity, sync status (§12 B4) | Web fonts (we stay on system fonts, §9) |
| **Godly, Land-book, SiteInspire** | Typography pairings, layout rhythm, colour restraint, hero compositions | Welcome, darshan card (§6.6), Report, empty states | Experimental layouts on task screens |
| **Awwwards (filter by microinteractions, transitions, data visualisation, gestures)** | Specific interactions to recreate with View Transitions and CSS (§7.1) | Shared-element transitions, chart draw-ins, swipe between days and devotees | Scroll-jacking, custom cursors, preloaders |
| **Lusion, Active Theory, The FWA** (3D / WebGL) | Understanding what is possible | **Nothing in the app.** At most a static image idea for the hall display (§8) | WebGL, 3D, continuous animation: too heavy for low-end Android and battery, and against the calm devotional tone |

**How to study, by priority:**
1. **Mobbin and Linear first:** application UX for the screens used daily.
2. **Then Apple and Vercel:** polish, type and states.
3. **Then Godly and Awwwards:** visual and motion ideas.

**Turning a reference into work:** each idea taken from a reference is written up as a §12 bucket B or C item, with its screen, cost, tier and platform check, before any build.
