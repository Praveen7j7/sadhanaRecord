# Route blueprint, part C: IYF head, Admin, shared routes and the App Shell

**IYF Delhi · Sadhana Record revamp · 8 October 2026 · part of `ROUTE_BY_ROUTE_REVAMP.md`**

**Evidence used:**
- the code in `frontend/src/master/*`, `devotee/Wall.svelte`, `screens/Home.svelte`, `Account.svelte`, `Profile.svelte`, `ui/Shell.svelte`, `Menu.svelte`, `CommandSearch.svelte`, `ui/Tabs.svelte`, `ui/Reminder.svelte` and `lib/nav.js`;
- the 7 Oct sweep screenshots (personas `head` and `head-devotee`, plus `coordinator` and `devotee` for the shared routes), at 390 px light and 1280 px dark;
- `current-features.md` §3.7–3.9 and §9, and `pre-store-revamp-review.md` §2–§4 and §7.

**Names used:**
- Component and token names are those in `DESIGN_SYSTEM.md`.
- "Phase N" is the roadmap phase (0–9). "P0/P1/P2" is the priority.

**Rules that apply to every route below:**
- Every app route is `noindex` in practice: hash routes are never crawled. The SEO work is `document.title` = "<Page> · Sadhana Record" (S1, Phase 8). There is no imagery on admin routes.
- Every master-only action stays master-only, and the server stays the authority.
  - The recovery `master` login can never lose IYF-head access.
  - There is always at least one active IYF head.
  - Every write keeps its audit line.

---

## C.0 The Admin information architecture (the decision that every Admin route below assumes)

**Today:**
- Admin has 10 tabs: Overview · All devotees · Group leaders · Coordinators · Facilitators · Batches · IYF IDs · Reopens · Activity · Settings.
- The desktop sidebar lists the same 10 items again, and every page is titled "Admin".

**Proposed:** six groups, following review §4.5 and 360 §11.
- Phone: page tabs. Desktop: the children of one sidebar entry, **Admin**. There is no tab row on desktop.

| Group | Routes (all kept) | Phone tabs | Top-bar title |
|---|---|---|---|
| **People** | `#/devotees`, `#/groups` | All devotees · All group leaders | the tab's name |
| **Staff** | `#/coordinators`, `#/facilitators`, + an **IYF heads** list (NEW view of the existing `masters.set` API, which has no screen today) | Coordinators · Facilitators · IYF heads | the tab's name |
| **Batch setup** | `#/batches` | — | Batch setup |
| **IYF IDs** | `#/ids` | Search · Possible duplicates (segmented control) | IYF IDs |
| **Activity** | `#/activity` | — | Activity |
| **Settings** | `#/settings` | — | Settings |

**Routes that move (the route stays and redirects, so no link breaks):**
- `#/overview` becomes the head's **Batch › "All batches"** scope; see its section.
- `#/reopens` becomes **Requests, filtered to Reopens** (`#/requests?type=reopens`), so the head has one inbox.
- For the head, `#/members` and `#/leaders` open People with the batch filter preset. Coordinators keep them as they are.

**Prerequisite:** known issue 3 (admin paths matched together with their query string) is fixed in **Phase 0**, before any `?batch=` or `?type=` link ships.

**Naming:** "Batch setup" is used instead of the review's "Batches". The sidebar already has a **Batches** area (the coordinator tools), and two entries with the same name in one sidebar would confuse. Needs IYF sign-off.

---

### `#/home` — IYF head Home (IYF head; IYF head + devotee)

**1. Current purpose.**
- Staff Home for the head: waiting requests, batch tools, admin links, the verse and birthdays.
- A head who is also a devotee sees the devotee Home first, then the same staff blocks.

**2. Current UI structure.**
- **Head only (390 px: 1,942 px tall):**
  - greeting "Hare Krishna, IYF · IYF head · All batches";
  - **Batch work:** "Waiting for you" hero with 3 stat tiles (4 sign-ups waiting / 1 password reset / 1 reopen request) and "Open requests";
  - 2 link rows (Batch status and attendance, Filling chart);
  - **Admin:** 7 link rows;
  - verse carousel;
  - Birthdays.
- **Head + devotee:** the same, below the Today card, This week, the verse, the announcement teaser and 6 quick actions. **2,750 px tall** at 390 px.

**3–10. Problems.**
- [Nav] Two navigation lists on Home: the 7-row "Admin" list and "Batch status and attendance / Filling chart". They duplicate the sidebar and the bar. 360 §10 says: "No navigation lists on any Home".
- [Hierarchy] The hero answers only "how many requests". It doesn't tell the head whether the system is healthy, or which batch is behind.
- [UX] "Reopen request" is a tile here, but outside the Requests inbox. The bar badge says **5** and the tiles add up to **6**.
- [Mobile] The head + devotee phone bar is **Home · Week · Report · Batch · Account**: Requests and Admin are lost (review P0 #3).
- [Hierarchy] For head + devotee, "Wednesday is not filled yet" and "0 of 7 days filled" repeat the This-week card. "Notices 4 new" repeats the bell.
- [Visual] The saffron hero button sits on a wine-area page. Three accent families show on one screen.
- [UX] Health facts are hidden in Settings ("Reminder devices **0**") and Batch setup (BSS and BVS have "No coordinator"), and nothing raises them.

**11. SEO.** noindex. Title "Home · Sadhana Record".

**12. Must remain unchanged.**
- Every count's source (`requests.list`, `reopen.list`, `stats.all`, `birthdays.today`).
- The birthdays block, loaded last (CLS 0).
- The devotee Home, in full, for head + devotee.

**13–21. Redesign.**
- **UI:** the three-slot model (360 §10).
  1. **My day:** head + devotee only. The devotee **Status block** (one block, missing days in amber).
  2. **Decisions:** a **Needs-you card**. Non-zero rows only, each with its age.
     - "4 sign-ups waiting for approval · oldest 3 days ›"
     - "1 password reset · call first ›"
     - "1 week to reopen · Harish Rawat ›"
     - "2 posts reported ›" (NEW, after the Wall report ships)
  3. **System health:** a **Scope strip** of plain facts, each one a link:
     - "Reminders: no phone has them on" (amber at 0);
     - "Registry refreshed 3 Oct, 4:00 am";
     - "2 batches have no coordinator";
     - "Saving was slow 2 times today";
     - "Sheets copied 10 min ago";
     - "3 possible duplicate IDs".
  4. **Batches this week:** a compact table, worst first. Columns: Batch · Submitted bar + "4 of 10" · Filling · Not started · Missed. "All batches ›" goes to `#/overview`.
  5. Birthdays. The verse appears for staff only, collapsed to one line.
- **UX:**
  - The head is never sent to a list of links. Every row says what needs a decision and goes straight to it.
  - All counts use the one shared active-members definition (Phase 0, review #2).
- **Interaction model:**
  - Tap a decision row: Requests, pre-filtered.
  - Tap a health item: the place that fixes it.
  - Tap a batch row: Batch status for that batch.
- **Motion:**
  - Count-up 400 ms on first view (High/Balanced).
  - A changed row glows once on refresh.
- **Responsive:**
  - **Phone:** one column in the slot order. Target height ≈ 1,500 px for head + devotee and ≈ 1,100 px for the head.
  - **Tablet:** Decisions and Health side by side.
  - **Desktop:** 2 columns. Left: My day, then the Batches table. Right: Decisions, Health, Birthdays.
- **States:**
  - Loading: skeletons of each slot.
  - No decisions: "All caught up — nothing waiting for you."
  - Health fully green: a single line, "Everything is running normally."
  - A slot that fails to load: "Couldn't load system health — Retry".
- **Data presentation:** tabular numbers; dates in full ("3 Oct, 4:00 am"); names, never phone numbers.
- **Components:** Status block, Needs-you card, Scope strip, staff table (sticky header), Status chip, Skeleton.
- **Micro-interactions:** press sink 0.99 on rows; the badge on a Decisions row clears optimistically when its item is handled.
- **Imagery:** none for the head. The devotee's darshan card stays in their own My-day column only (360 §8.2).
- **Density:**
  - PRIMARY: Decisions.
  - SECONDARY: My day (head + devotee) or Health.
  - CONTEXTUAL: the Batches table.
  - ACTIONABLE: the decision rows and "Fill today".
  - OPTIONAL: birthdays and the verse.

**22–25.** P0 (bar fix) / P1 · Complexity M (health needs one read-only server summary added to `stats.all`, cached 5 min) · Risk low · Benefit very high · Budget: ≤ +3 KB in the staff Home chunk, 2 API calls on open (cached first) · **Phase 0** (bar, counts) and **Phase 6** (slots).

**Before → After → Why better → Unchanged.**
- Before: a request hero plus 9 link rows, 2,750 px.
- After: Decisions, Health and a worst-first batch table, ≈ 1,500 px.
- Why better: the head's question, "is the system healthy, and what needs my decision?", is answered in the first screen.
- Unchanged: every count and its source, birthdays, and the devotee Home.

---

### `#/overview` — All batches this week (IYF head)

**1. Current purpose.** This week's totals across every batch, plus a card per batch (progress bar and 8-week sparkline). Tapping a card opens that batch's board.

**2. Current UI structure.**
- Admin tab row.
- Heading "Overview / Week of 5 Oct – 11 Oct · all batches", with Refresh.
- A section "This week, every batch" with 4 stat tiles (4/10 submitted (40%) · 3 filling · 3 not started · 0 missed) and "10 active devotees · 4 waiting for approval".
- 6 batch cards in a 1/2/3-column grid.

**3–10. Problems.**
- [Hierarchy] Four headings for one idea: the top bar "Admin", the tab "Overview", the h2 "Overview" and the h3 "This week, every batch".
- [Nav] On desktop the tab row is cut. At 1280 px "Activity" and "Settings" are off-screen, with no sign that more tabs exist (review P0 #10).
- [UX] 5 of 6 cards read "0/0 submitted 0 filling 0 not started", with flat sparkline dashes. Empty batches look like broken charts.
- [UX] The "1 waiting" pill on 4 cards duplicates Requests (review §3.1: remove the Overview pills).
- [Visual] Cards sort by batch order, not by need. A batch at 10% looks the same as one at 90%.
- [Mobile] At 390 px only about 1.5 batch cards fit above the bar.

**11. SEO.** noindex. Title "All batches · Sadhana Record".

**12. Must remain unchanged.** `stats.all` (8 weeks); a tap opens that batch's board (`batchSel` + `#/batch`); the 8-week trend.

**13–21. Redesign.**
- **UI:**
  - It becomes the **"All batches" scope of Batch status** for the head. The Batch area's batch picker gains "All batches" as its first option. The route `#/overview` is kept.
  - One **Scope strip**: Submitted · Filling · Not started · Missed (active members only) · the deadline.
  - Then a **staff table**, worst first.
- **UX:**
  - Batches with no active devotees go to a footer line: "SPS Group 2, SPS Online, DPS, BSS, BVS — no active devotees yet."
  - "Waiting for approval" is removed here; it lives in Requests.
- **Interaction model:**
  - Row → that batch's Batch status.
  - Column headers sort (`aria-sort`). The default is Submitted % ascending.
- **Motion:** bars grow once per session; a changed row glows.
- **Responsive:**
  - **Phone:** two-line rows ("SPS · 4 of 10 submitted", then a meter and "3 filling · 3 not started").
  - **Tablet:** a table with 4 columns.
  - **Desktop:** Batch · Coordinator · Submitted (meter + count) · Filling · Not started · Missed · 8-week sparkline. "No coordinator" shows as an amber chip.
- **States:**
  - Loading: a table skeleton.
  - Error: "Couldn't load this week's numbers — Retry".
  - No active batch: "No active batches. Batches marked active in Batch setup appear here."
- **Data presentation:** "4 of 10" rather than "4/10"; % in a tabular column; sparklines < 1 KB of inline SVG.
- **Components:** Scope strip, staff table, Meters, Sparklines, Status chip.
- **Micro-interactions:** hovering a sparkline bar shows "Week of 28 Sep: 70%". Tapping it on touch does the same.
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: the batches that are behind.
  - SECONDARY: the strip.
  - CONTEXTUAL: the trend and the coordinator.
  - ACTIONABLE: row → board.
  - OPTIONAL: the empty batches (footer).

**22–25.** P1 · S · Risk low · Benefit high · Budget: no new call, ≤ +1 KB · **Phase 0** (tabs, counts) and **Phase 6**.

**Before → After → Why better → Unchanged.**
- Before: six equal cards, four headings.
- After: one strip and a worst-first table inside the Batch area.
- Why better: the batch that needs help is the first row.
- Unchanged: `stats.all`, tap-to-board, the 8-week trend.

---

### `#/devotees` — All devotees (IYF head; the same component as a coordinator's `#/members`)

**1. Current purpose.** A directory of every devotee in IYF Delhi, with search, filters, call or WhatsApp, and deleting inactive members.

**2. Current UI structure.**
- Search ("Name, phone or IYF ID").
- 4 dropdowns: All of IYF Delhi · Any class · Any blood group · Sort: name.
- A status segment: All 12 · Active 10 · Inactive 1 · Disabled 1.
- "12 members", Refresh.
- Rows: avatar, name, batch, IYF ID, "Nothing submitted yet", call, chat. A red **Delete** button on inactive and disabled rows.

**3–10. Problems.**
- [Nav] A duplicate page. `#/members` (sidebar "Members") and `#/devotees` (sidebar "All devotees") are both in the head's sidebar.
- [Hierarchy] The title says "All devotees" and the count says "**12 members**".
- [Mobile] About 290 px of filters before the first row at 390 px. 5 controls are always open.
- [Interaction] "Delete" is a row button (2 rows in the screenshot). Review §4.4 says destructive actions must sit in an overflow menu.
- [Nav] The phone tab row is scrolled so the first tab reads "**w**" (Overview, cut).
- [Visual] Every row repeats "Nothing submitted yet". The useful facts (last week, status) aren't columns on desktop; the rows are stretched to 860 px with empty middles.
- [A11y] The call and chat icons are 44 px but unlabeled visually; there is no row-level target for opening the devotee.

**11. SEO.** noindex. Title "All devotees · Sadhana Record".

**12. Must remain unchanged.**
- `members.list` and every filter: batch, class, blood group, sort, status counts.
- "Show more" (50).
- Call and WhatsApp.
- Delete only for inactive members, after typing the phone number (`devotees.delete`), with the audit line.

**13–21. Redesign.**
- **UI:**
  - The head opens it as **People › All devotees**. The scope picker reads "All of IYF Delhi" or a batch name.
  - Coordinators see the same component as `#/members`.
  - Filters: Search plus a **"Filters (2)"** button that opens a Sheet (batch, class, blood group, sort), with active-filter chips below it. The status counts stay as chips.
- **UX:** the whole row opens the devotee. Delete, Disable and the call actions move into the ⋯ menu.
- **Interaction model:** desktop uses **list + detail**: DevoteeDetail opens in the right pane and the list keeps its scroll. On phone, the row opens `#/devotee/<login>` and Back returns to the same scroll position.
- **Motion:** the pane slides from the right (`--d-3`); rows FLIP on filter (≤ 50 rows).
- **Responsive:**
  - **Phone:** two-line rows (name, then "SPS · Active · Last week 82%"), with ⋯.
  - **Tablet:** the same, two columns.
  - **Desktop:** a table: Name · Batch · Status · Last week · IYF ID · Class · ⋯. Sticky header, 48 px rows.
- **States:**
  - "12 devotees" (never "members").
  - No match: "No devotee matches “ra”. Try part of the name, the phone, or the IYF ID."
  - Error: "Couldn't load devotees — Retry".
- **Data presentation:** the status chip (Active, Inactive since 7 Sep, Disabled); the last week as % plus a status chip; a dash where there is no data, not repeated prose.
- **Components:** Search, Sheet (filters), Status chip, staff table, list + detail, overflow menu, Danger-solid inside the confirm Sheet.
- **Micro-interactions:** the filter chip count updates live; an × on a chip clears that filter.
- **Imagery:** not recommended. Profile photos only.
- **Density:**
  - PRIMARY: the name and status.
  - SECONDARY: the last week.
  - CONTEXTUAL: batch, IYF ID, class.
  - ACTIONABLE: open, call, ⋯.
  - OPTIONAL: the filters (in the sheet).

**22–25.** P1 · M · Risk low (presentation only) · Benefit high · Budget: lives in the existing staff-Admin chunk (19.8 KB gzip today, cap 30) · **Phase 5** (shared with coordinators) and **Phase 6** (People group).

**Before → After → Why better → Unchanged.**
- Before: two directory pages; 5 open filters; Delete in rows.
- After: one page with a scope picker, filters in a sheet, actions in ⋯, a desktop table with a pane.
- Why better: one place per destination, and no destructive buttons in a list.
- Unchanged: every filter, search, delete-with-phone-confirm and the audit line.

---

### `#/groups` — All group leaders (IYF head; the same component as `#/leaders`)

**1. Current purpose.** Group leaders for any batch: appoint, add members, take one out, remove a leader.

**2. Current UI structure.**
- A full-width "Batch" picker.
- "1 group · 5 devotees in no group".
- An always-open "Appoint a group leader" card (devotee select plus a disabled-looking Appoint).
- A card per group: leader with call/chat, members with status and an × each, "Add devotees", "Remove leader".
- A centred, collapsed "In no group (5)".

**3–10. Problems.**
- [Nav] "Group leaders" appears **twice** in the head's sidebar: under My batch and under Admin.
- [UX] Member status shows "**Draft**". IA §12 says the word is "Filling" everywhere.
- [Interaction] The × "Take … out of the group" acts at once, with no Undo and a full refetch.
- [Hierarchy] The Appoint form (≈ 190 px) sits above the groups, though appointing is rare.
- [Visual] "In no group (5)" is centred, unlike every other disclosure.
- [Mobile] The picker plus the form push the first group down to y ≈ 485 px.

**11. SEO.** noindex. Title "All group leaders · Sadhana Record".

**12. Must remain unchanged.**
- `leaders.list`, `leaders.set` and `leaders.assign`.
- The same-level pool (SPS, SPS Group 2 and SPS Online form one pool).
- The confirm before removing a leader.
- Call and WhatsApp.

**13–21. Redesign.**
- **UI:**
  - People › All group leaders. A batch chip-picker at the top ("SPS ▾").
  - An **"Appoint a leader"** Secondary button opens a Sheet with a searchable devotee picker (pick from the list, never typed).
  - Group cards in a 2-column grid on desktop.
- **UX:**
  - × becomes a row ⋯ with "Take out of the group". It is optimistic, with an **Undo** toast.
  - "Remove leader…" moves into the group card's ⋯, then a confirm Sheet: "Remove Sunil Kumar as group leader? His 4 devotees go to In no group."
- **Interaction model:**
  - "In no group (5)" is a left-aligned Grouped list.
  - Each of its rows offers "Add to a group" (a Sheet listing the groups).
- **Motion:** rows FLIP between groups (200 ms).
- **Responsive:**
  - **Phone:** stacked cards.
  - **Tablet:** 2 columns.
  - **Desktop:** 2–3 columns, with the "In no group" panel pinned on the right.
- **States:**
  - No groups: "No group leaders in SPS yet. Appoint one to share attendance marking."
  - Everyone grouped: the panel says "Everyone in SPS is in a group."
- **Data presentation:** the Status chip "Filling / Submitted / Not started"; a leader count chip "4 devotees".
- **Components:** Sheet, Grouped list, Status chip, overflow menu, Toast with Undo.
- **Micro-interactions:** Android haptic on appoint; the moved row highlights once.
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: the groups and their members.
  - SECONDARY: "In no group".
  - CONTEXTUAL: member status.
  - ACTIONABLE: appoint, add, take out.
  - OPTIONAL: the appoint form (in a sheet).

**22–25.** P1 · S · Risk low · Benefit medium · Budget: 0 new calls · **Phase 1** ("Filling") and **Phases 5–6**.

**Before → After → Why better → Unchanged.**
- Before: duplicate sidebar entries, an always-open form, × with no Undo.
- After: one People entry, appoint in a sheet, ⋯ with Undo.
- Why better: groups come first, and mistakes are recoverable.
- Unchanged: the same-level pool, every leaders API and the confirms.

---

### `#/coordinators` — Coordinators (IYF head only)

**1. Current purpose.** Create and edit coordinator logins and their batches, reset passwords, disable or enable.

**2. Current UI structure.**
- Header "Coordinators" with **Add coordinator** (Primary).
- **Phone:** cards with avatar, name, username, "Batches: …", a Status chip, then a row of ✎, 🔒 and a red **Disable**.
- **From 900 px:** a table Name · Username · Phone · Batches · Status · actions.

**3–10. Problems.**
- [Nav] The top bar reads "**Admin**", not "Coordinators". The tab row shows "s" (the cut-off "All devotees").
- [Interaction] **Disable** is a danger button on every row. It is confirmed, but it sits in the list, against review §4.4.
- [A11y] The lock icon alone means "Reset password", which isn't obvious. The labels exist only for screen readers.
- [Visual] The Phone column is "—" for both rows: it uses width for nothing.
- [UX] There's no sign of who has never signed in, or who still has a temporary password, beyond a small chip.

**11. SEO.** noindex. Title "Coordinators · Sadhana Record".

**12. Must remain unchanged.**
- `coordinators.*`.
- The batches checklist with "Now with <name>" (moving a batch ends the other coordinator's access).
- The temporary password and the forced change.
- Disable asks first; Enable is immediate. Undo stays.
- The audit lines.

**13–21. Redesign.**
- **UI:**
  - **Staff › Coordinators**. Rows: name, then "sps · SPS, SPS Group 2, SPS Online", with Status chips (Active · "Temporary password").
  - A trailing ⋯ with Edit…, Reset password…, Disable… (Danger).
- **UX:**
  - Row tap = Edit sheet.
  - Batches show their **names**, never IDs.
  - A coordinator with no batch shows an amber chip, "No batch".
- **Interaction model:** the Sheets are unchanged (wide 620 px on desktop). Disable keeps its consequence text: "sps is logged out at once and cannot log in until you enable the account again. Their batches stay assigned."
- **Motion:** the sheet rises with a spring; the status chip crossfades on Disable/Enable.
- **Responsive:**
  - **Phone:** two-line rows plus ⋯.
  - **Desktop:** a table Name · Username · Batches · Status · ⋯. The Phone column shows only when at least one phone exists.
- **States:**
  - Empty: "No coordinators yet. Add the first coordinator and give them their batches."
  - Save error: inline in the sheet.
  - Busy: the button label stays, with a spinner.
- **Data presentation:** batches as names joined with commas; status as chips.
- **Components:** staff table, overflow menu, Sheet, Status chip, Toast with Undo.
- **Micro-interactions:** "Temporary password set for sps. They must change it at next login." stays as the toast.
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: who has which batch.
  - SECONDARY: status.
  - CONTEXTUAL: username and phone.
  - ACTIONABLE: ⋯.
  - OPTIONAL: none.

**22–25.** P1 · S · Risk low · Benefit medium · Budget: 0 KB net · **Phase 6** (title fix in **Phase 2**).

**Before → After → Why better → Unchanged.**
- Before: "Admin" title, red Disable on each row.
- After: Staff › Coordinators, a ⋯ menu, names only.
- Why better: a calm list; destructive actions are one deliberate step away.
- Unchanged: every coordinator action, the confirmations and the audit.

---

### `#/facilitators` — Facilitators and their access (IYF head only)

**1. Current purpose.**
- The canonical facilitator list offered at sign-up and approval.
- Switching names on or off.
- Deleting a switched-off name.
- Giving access (linking a devotee's phone, or creating a login), resetting it and removing it.

**2. Current UI structure.**
- An "Add a facilitator" card.
- Search and the chips "4 All / 4 Switched on / 0 Switched off"; "4 names".
- Rows: name, "No devotees · 4 waiting sign-ups", "Offered", "Login: natvar · TRD", sometimes "Added in the app · not in NameMap yet".
- A switch, a 🔒 and (when off) a 🗑 on each row.
- The access Sheet.

**3–10. Problems.**
- [Hierarchy] The Add form (≈ 95 px) sits above the list, for a rare action.
- [Interaction] Three controls per row (switch, lock, trash) with no visible labels. "Lock" here means "access", while on Coordinators it means "password".
- [UX] Linking a facilitator's own login asks for a **typed** phone ("Their mobile number"). The clean-data rule says pick from the list.
- [Visual] Two long pills wrap on phones ("Added in the app · not in NameMap yet").
- [Nav] Title "Admin"; the tab row is cut.

**11. SEO.** noindex. Title "Facilitators · Sadhana Record".

**12. Must remain unchanged.**
- `facilitators.*` and `facLogins.*`.
- Switching off keeps the name for devotees who already have it, with Undo.
- Delete only when switched off.
- The NameMap sync note.
- "Do they use the app already? Yes / No" access branches.

**13–21. Redesign.**
- **UI:**
  - **Staff › Facilitators**. A header button "Add facilitator" opens a Sheet.
  - Rows: name, then "No devotees · 4 waiting for approval", with chips (Offered · "Has the app" / "Own login: natvar" · "Not in NameMap yet").
  - The switch stays inline (the most common action). Everything else goes in ⋯: Access…, Delete… (when off).
- **UX:** "Yes, as a devotee" picks the person from a devotee search (`members.list`). The phone is never typed.
- **Interaction model:** row tap = the Access sheet. The switch is optimistic, with Undo (exists).
- **Motion:** the switch uses `--ease-spring`, 200 ms.
- **Responsive:**
  - **Phone:** rows with switch and ⋯.
  - **Desktop:** a table Name · Devotees · Waiting · Access · Offered (switch) · ⋯.
- **States:**
  - No match: "No facilitator matches “madhav”."
  - Off-filter empty: "No names are switched off."
- **Data presentation:** counts as numbers in their own columns on desktop; chips limited to 2 per row (NameMap shown as an info dot with a tooltip/sheet).
- **Components:** Sheet, Search, staff table, Toggle, overflow menu, Status chip.
- **Micro-interactions:** toast "Natvar Gopinath Prabhuji is switched off. Devotees who have this name keep it." with Undo (keep).
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: names and whether they are offered.
  - SECONDARY: access.
  - CONTEXTUAL: devotee counts.
  - ACTIONABLE: the switch and ⋯.
  - OPTIONAL: the add form.

**22–25.** P1 · S · Risk low · Benefit medium · Budget: 0 new calls (reuses `members.list`) · **Phase 6**.

**Before → After → Why better → Unchanged.**
- Before: three unlabeled icons, a typed phone.
- After: a switch plus ⋯, a picked person.
- Why better: clean data, and fewer mis-taps.
- Unchanged: the list semantics, the access flows and the Undo.

---

### `#/batches` — Batch setup (IYF head only)

**1. Current purpose.** List batches; **Add batch** (name, short ID, level SPS/DPS/BSS/BVS, pilot); **Edit** (name, coordinators, active, pilot).

**2. Current UI structure.**
- "Batches / Active batches are offered on the sign-up page."
- A small "Add batch".
- Rows "**SPS · SPS**", the coordinator name or "No coordinator", "Active".
- A table from 900 px. Sheets for Add and Edit.

**3–10. Problems.**
- [UX] **Known bug:** `worker/src/admin.js` `LEVELS` gives a new batch the old journal names ("Level 4 / Level 5 BSS / Level 5 BVS"), so the batch would have **no lectures** (current-features §9 #1; review P0 #1). The UI's level choice (SPS/DPS/BSS/BVS) is already correct.
- [Visual] "SPS · SPS", "DPS · DPS", "BSS · BSS": the name and the ID repeat.
- [UX] "No coordinator" (BSS, BVS) is plain grey text, though a batch with no coordinator can't approve sign-ups.
- [Hierarchy] There are no member counts or levels, so the head can't tell a live batch from an empty one.
- [Visual] Add batch is a small Secondary on the left, while Coordinators has a Primary on the right: an inconsistent header pattern. Inactive shows as "Hidden".

**11. SEO.** noindex. Title "Batch setup · Sadhana Record".

**12. Must remain unchanged.**
- `batches.create` and `batches.update`.
- Active = offered on sign-up.
- The pilot flag and the coordinator checklist.
- `refreshMeta` after a change.
- The batch IDs (they key every Sheets copy).

**13–21. Redesign.**
- **Phase 0 (store blocker):** fix `LEVELS`, with a test that a new batch resolves to an existing journal. Until it ships, the Add sheet shows a Notice ("Adding batches is paused until a fix ships") and the submit button is disabled.
- **UI:**
  - The header pattern matches Staff: title plus a Primary "Add batch" on the right.
  - Rows: the name, then "Level SPS · 10 active devotees · Coordinator: SPS Team".
  - The ID appears only when it differs from the name ("SPS Group 2 · SPS2"), in a muted tabular chip.
- **UX:**
  - "No coordinator" is an amber Status chip with an action, "Add a coordinator ›" (opens Edit at that field).
  - "Hidden" becomes "Not offered at sign-up".
- **Interaction model:** row tap = Edit. The Add sheet keeps Name · Short ID · Level (segmented) · Pilot, with the line "Its level sets the score card and the hearing journal".
- **Motion:** a new row slides in and glows once.
- **Responsive:**
  - **Phone:** two-line rows.
  - **Desktop:** a table Batch · ID · Level · Active devotees · Coordinators · Status · ⋯.
- **States:**
  - Empty: "No batches yet. Add the first batch."
  - Create error, for example a taken ID: inline "SPS3 is already used".
- **Data presentation:** batch **names** (never journal level names); counts in tabular figures.
- **Components:** staff table, Sheet, segmented control, Status chip, Notice.
- **Micro-interactions:** the Short ID auto-uppercases as it is typed (exists).
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: the batch and its health (coordinator, members).
  - SECONDARY: level.
  - CONTEXTUAL: ID and pilot.
  - ACTIONABLE: Add and Edit.
  - OPTIONAL: none.

**22–25.** P0 (bug) / P1 · S · Risk: medium for the bug (journal mapping; test on a copy) and low for the UI · Benefit high · Budget: member counts come from the cached `stats.all`, with no new call · **Phase 0** and **Phase 6**.

**Before → After → Why better → Unchanged.**
- Before: "SPS · SPS"; a broken Add; a silent "No coordinator".
- After: a working Add, plain rows, an amber warning with a fix link.
- Why better: no batch is created without lectures or left without a coordinator.
- Unchanged: the fields, the IDs and the active/pilot semantics.

---

### `#/ids` — IYF IDs (IYF head only)

**1. Current purpose.**
- Search the registry; see an ID's details; link it to an account or unlink it, with a reason.
- Review possible duplicates ("Not duplicates", with Undo).

**2. Current UI structure.**
- A heading with a description.
- A segmented control Search | Possible duplicates.
- One text field ("Type at least 3 characters").
- Results as 2-column cards with Details · Link to an account… · Unlink…, and inline confirm forms.
- Duplicates: an info Banner of 4 lines, count chips, group cards.

**3–10. Problems.**
- [UX] The landing state is an empty field and ≈ 400 px of blank space. "Whitespace because there is nothing to show" (DS §4).
- [UX] Link asks for a **typed** "Phone of the devotee's account". It should be a picked person.
- [Interaction] Unlink, a destructive action, confirms inline inside the card. DS §7.5 says it belongs in a confirm Sheet.
- [Hierarchy] The duplicates banner is 4 lines of policy before any data.
- [Nav] Title "Admin"; the tab row is cut.

**11. SEO.** noindex. Title "IYF IDs · Sadhana Record".

**12. Must remain unchanged.**
- `ids.search` (3+ characters), `ids.get`, `ids.link` and `ids.unlink`, with reasons.
- `ids.reviewDuplicate` with Undo.
- The rule that exact duplicates (same name and phone) are merged by the dashboard.

**13–21. Redesign.**
- **UI:**
  - The landing shows context chips, each one a link: "1,284 IDs · refreshed 3 Oct, 4:00 am", "3 accounts with no ID", "5 possible duplicates to review".
  - Search uses the standard Search field with an icon.
- **UX:**
  - Link opens a Sheet: devotee search (pick), Reason, then Link.
  - Unlink opens a confirm Sheet: "Unlink KT26-0120 from Manish Tiwari? The dashboard stops matching their weeks to this ID." with a Danger-solid button.
  - The duplicates policy becomes one line plus "How duplicates work ›" (a disclosure).
- **Interaction model:** desktop uses list + detail (Details in the right pane). On phone, Details expands in place.
- **Motion:** the pane slides; the "Not duplicates" group collapses (200 ms) with Undo.
- **Responsive:**
  - **Phone:** single-column rows.
  - **Desktop:** results list (left) and detail (right).
- **States:**
  - Typing < 3: "Type at least 3 characters."
  - No result: "No results. Try part of the name, the full IYF ID, or the last digits of the phone." (keep)
  - No duplicates: "No possible duplicates. Nothing to review right now."
- **Data presentation:** linked state as a Status chip ("Linked to Aarav Gupta" / "Not linked"); phones masked to the last 4 digits in lists (exists as `phoneEnd`).
- **Components:** Search, Sheet, list + detail, Status chip, Toast with Undo.
- **Micro-interactions:** the result count is announced politely ("3 results").
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: the search and its results.
  - SECONDARY: duplicates to review.
  - CONTEXTUAL: registry age.
  - ACTIONABLE: Link, Unlink, Not duplicates.
  - OPTIONAL: the policy text.

**22–25.** P2 · S · Risk low · Benefit medium · Budget: the context counts come from the System-health summary (Home), with no extra call · **Phase 6**.

**Before → After → Why better → Unchanged.**
- Before: a blank page, a typed phone, an inline unlink.
- After: context on arrival, a picked person, a confirm sheet.
- Why better: fewer wrong links, and clear consequences.
- Unchanged: every IDs API, the reasons and the Undo.

---

### `#/reopens` — Reopen requests (IYF head only) → merged into Requests

**1. Current purpose.** Coordinators ask to reopen a missed week. The head reopens it until a time (default: 2 days ahead, 9 PM) or rejects it, each with a reason.

**2. Current UI structure.**
- "Reopen requests [1]" with a description and Refresh.
- Cards: devotee link · batch, "Week of 28 Sep – 4 Oct · asked by **sps** on 7 Oct, 2:44 pm", the quoted reason.
- Equal-width **Reject…** (Danger) and **Reopen…** (Primary), each opening an inline form.

**3–10. Problems.**
- [Nav] A separate tab outside Requests. The Requests badge says 5 while the real total is 6 (review §3.1).
- [UX] "asked by **sps**" shows a login, not "SPS Team". There is no age ("1 day ago").
- [Interaction] Reject and Reopen carry equal visual weight, and both inline forms push the card taller.
- [UX] "Open until" is a raw date-time field. The useful choices are a few presets.
- [UX] Known issue 5: in a reopened week neither the devotee nor the coordinator can mark attendance (Phase 0 server fix).

**11. SEO.** noindex. The route redirects to `#/requests?type=reopens` (title "Requests · Sadhana Record").

**12. Must remain unchanged.**
- `reopen.list`, `weeks.reopen` (reason + `openUntil` IST) and `reopen.reject` (reason).
- The master-only decision.
- The toast "Harish Rawat: the week of 28 Sep – 4 Oct is open until …".
- The audit lines.

**13–21. Redesign.**
- **UI:**
  - The **Requests inbox** gains the type filter chips Sign-ups · Resets · **Reopens** · Reports (head).
  - A reopen row: "Harish Rawat · SPS — Week of 28 Sep – 4 Oct", then "SPS Team · 1 day ago · “He was in hospital that week.”"
- **UX:**
  - Primary **Reopen…** opens a Sheet with the Reason (prefilled with the coordinator's) and "Open until": the chips "Wed 9 PM (2 days)" · "Fri 9 PM" · "Choose…".
  - Reject… is a Text-danger button that opens a Sheet with "Why not" and Danger-solid.
- **Interaction model:** desktop shows the list and the request detail side by side (as Requests).
- **Motion:** a handled row slides out (FLIP), and the badge counts down.
- **Responsive:**
  - **Phone:** rows, then the Sheet.
  - **Desktop:** list + detail.
- **States:**
  - Empty: "No reopen requests are waiting. When a coordinator asks to reopen a missed week, it appears here." (keep)
  - Error: "Couldn't reopen — Retry. Nothing was changed."
- **Data presentation:** names, ages and full dates.
- **Components:** Requests inbox, chips, Sheet, Toast.
- **Micro-interactions:** Android haptic on Reopen.
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: who and which week.
  - SECONDARY: the reason.
  - CONTEXTUAL: who asked and when.
  - ACTIONABLE: Reopen and Reject.
  - OPTIONAL: none.

**22–25.** P1 · S · Risk low · Benefit high (one inbox, a true badge) · Budget: 0 new calls · **Phase 0** (issue 5, badge) and **Phase 6** (merge).

**Before → After → Why better → Unchanged.**
- Before: a separate tab, a login name, a raw time field.
- After: one inbox with presets.
- Why better: every decision is in one place, and the count is truthful.
- Unchanged: the reopen and reject semantics, the reasons and the audit.

---

### `#/activity` — Activity (IYF head only)

**1. Current purpose.** The audit log (who changed what), with type chips, More filters (by, about, from, to), Before/after, and Load more (30). Then "Slow or failed requests" (`runlog.list`).

**2. Current UI structure.**
- 14 filter chips in one line.
- "More filters" (two text inputs and two dates).
- Sentence rows: "sps changed the facilitator / class day of **6000000012** · Sunday class", "7 Oct, 1:44 pm · SPS". "Before / after" opens raw JSON in `<pre>`.
- Then the run log: "**devotees.list** · 2840 ms · slow · b-2026-10-02", "week.saveDay … **STALE**".

**3–10. Problems.**
- [UX] Every target is a **phone number** ("of 6000000013") and every actor a login ("sps"). Review §4.5: names.
- [UX] Developer telemetry is shown to the head: "devotees.list", "STALE", "b-2026-10-02", milliseconds.
- [Nav] The chip row is cut at 1280 px ("**Bat**…"), with no sign that more chips exist (review P0 #10).
- [UX] "IYF head reopened … · **master**": the actor is said twice.
- [Interaction] "By (login)" and "About (phone or login)" are typed. Before/after is raw JSON.
- [UX] Known issue 7: leader/coordinator attendance and on-behalf day saves are missing from the log.

**11. SEO.** noindex. Title "Activity · Sadhana Record".

**12. Must remain unchanged.**
- `audit.list` and every filter dimension (type, by, about, from, to).
- Before/after, available for every line.
- Pagination.
- `runlog.list` data, kept: it moves but is not deleted.
- The log is append-only.

**13–21. Redesign.**
- **UI:**
  - Sentences with names: "**SPS Team** changed the facilitator of **Bhavesh Jain** (SPS) · Sunday class". The phone appears only in the detail.
  - Date group headers: "Today", "Yesterday", "Mon, 5 Oct".
- **UX:**
  - Filters: 5 chips (All · Sign-ups · Attendance · Devotees · Settings) plus "More types ▾" (a Sheet with all 14).
  - "By" and "About" are person pickers (`members.list`, coordinators list).
  - The run log becomes plain sentences on the Home **System health** ("Saving was slow 3 times today"; "1 save was refused because the day changed on another phone").
  - The raw rows go to a collapsed "Technical log (for the app keeper)" at the bottom of Activity.
- **Interaction model:** tap a line to open a Sheet with a readable diff table (Field · Before · After, for example "Facilitator · Natvar Gopinath Prabhuji → Vilasa Padmanabha Prabhuji"). "Show raw" stays inside it.
- **Motion:** new pages of results fade in; no row animation.
- **Responsive:**
  - **Phone:** chips scroll with an edge fade and a "+9" hint.
  - **Desktop:** chips wrap to 2 lines, and the filters sit in a left rail.
- **States:**
  - Empty: "Nothing found. Try another type, or clear the filters." (keep)
  - End of list: "That's everything from 1 Sep."
- **Data presentation:** times as "7 Oct, 1:44 pm"; the reason in quotes; batch names.
- **Components:** Grouped list, chips, Sheet (diff), person picker, disclosure.
- **Micro-interactions:** filters apply as they change (exists, 350 ms debounce).
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: who did what to whom.
  - SECONDARY: when.
  - CONTEXTUAL: reason and batch.
  - ACTIONABLE: the filters.
  - OPTIONAL: the diff and the technical log.

**22–25.** P1 · M (`audit.list` adds display names: a server join, an additive field) · Risk low · Benefit high (trust, privacy) · Budget: 0 extra calls · **Phase 0** (issue 7, chip cut) and **Phase 6**.

**Before → After → Why better → Unchanged.**
- Before: phone numbers, JSON and developer codes.
- After: named sentences, readable diffs, telemetry in plain words.
- Why better: the head reads the log as a story of people, not of data.
- Unchanged: every audit line, filter and raw before/after.

---

### `#/settings` — Settings (IYF head only)

**1. Current purpose.**
- Set the first tracked week, the daily reminder time and the submit window.
- Show the registry refresh and the number of reminder devices (read-only).
- Review, then save after a confirm Sheet.

**2. Current UI structure.**
- Two cards.
  - First tracked week: a native date "**31/08/2026**" and Clear.
  - Daily reminder: a native select "9:00 PM".
  - Submit window: native day selects and native time inputs "06:00 PM / 09:00 PM".
- A `kv` well: "Registry refreshed 3 Oct, 4:00 am · 1,284 IDs", "Reminder devices **0**".
- A floating action bar: "No changes · Undo · Review and save".

**3–10. Problems.**
- [UX] The help text hard-codes the times: "by its **Monday 9 PM** deadline", "The time the **9 PM** reminder goes out". IA §12 says use the configured times.
- [Visual] Native selects, time inputs and a numeric date ("31/08/2026"), unlike the rest of the app's wheel pickers.
- [Mobile] At 390 px the action bar floats **over** the Submit window card, above the bottom nav: two floating bars, and "Review and save" wraps to 2 lines.
- [UX] "Reminder devices 0" is a silent zero. It should be an alert (review §4.5).
- [Visual] "Undo" looks enabled while "No changes".

**11. SEO.** noindex. Title "Settings · Sadhana Record".

**12. Must remain unchanged.**
- `settings.get` and `settings.update`; only the changed fields are sent.
- The Monday-only validation for the first week.
- `REMINDER_TIMES` (18:00–22:30).
- The confirm Sheet listing each change: "This applies to every batch at once."
- The audit line.

**13–21. Redesign.**
- **UI:**
  - Three Grouped lists of rows that open Sheets:
    - "Submit window · Sun 6:00 PM → Mon 9:00 PM ›";
    - "Daily reminder · 9:00 PM ›";
    - "First tracked week · Week of 31 Aug 2026 ›".
  - Each sheet uses the existing wheel pickers: a day picker (7 chips) and a time wheel; a week picker that offers Mondays only.
- **UX:**
  - The descriptions read the saved values: "A week not submitted by its **Mon 9:00 PM** deadline is marked missed."
  - The read-only health moves to the Home System health. "No phone has reminders on" shows as amber.
- **Interaction model:**
  - Each Sheet's Save goes to the same confirm summary.
  - After saving, a Toast "Settings saved" with **Undo**, which restores the previous values through the same API.
- **Motion:** the sheet rises (spring); the changed row glows once.
- **Responsive:**
  - **Phone:** rows. There is no floating bar: the action lives in the Sheet.
  - **Desktop:** 560 px dialogs.
- **States:**
  - Loading: a skeleton.
  - Error: "Couldn't save — nothing was changed. Retry."
  - Inline validation: "Choose a Monday (the first day of a week)." (keep)
- **Data presentation:** "Week of 31 Aug 2026", never numeric-only; 12-hour times.
- **Components:** Grouped list, Sheet, wheel pickers, Toast with Undo, Notice.
- **Micro-interactions:** the Save in a Sheet stays disabled until a value changes.
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: the three settings.
  - SECONDARY: their consequences.
  - CONTEXTUAL: the last change (from Activity).
  - ACTIONABLE: the row → its sheet.
  - OPTIONAL: none.

**22–25.** P1 · S · Risk: medium (a global effect; same API, confirm kept) · Benefit medium · Budget: 0 KB net (removes native-control CSS) · **Phase 6**. The copy fix is **Phase 1**.

**Before → After → Why better → Unchanged.**
- Before: native controls, hard-coded "9 PM", two floating bars.
- After: rows that open sheets, the real times, Undo.
- Why better: honest text, one control language, and no overlap on phones.
- Unchanged: the validation, the confirm summary, the API and the audit.

---

### `#/wall` (and `?post=<id>`) — Announcements (every signed-in role; staff post)

**1. Current purpose.**
- A feed of announcements: Like, comment, share to WhatsApp.
- Staff post, edit, pin or remove, with Undo. The head can post to everyone; coordinators post to their own batches.
- `?post=` scrolls to that post and highlights it.

**2. Current UI structure.**
- **Staff:** a "New announcement" Primary, then an inline compose form at the top of the feed.
- A single 42 rem column of posts, each with:
  - avatar, author, "6 days ago · Everyone", Pinned, "New";
  - a ⋮ (only when you can edit), opening inline Edit / Pin / Remove buttons;
  - title, body (links), picture;
  - Like · Comment · Share;
  - comments with your own 🗑.

**3–10. Problems.**
- [UX] **There is no Report and no way to hide a person.** This is an Apple 1.2 / Google UGC **store blocker** (review §7).
- [Visual] Like uses `--danger`: the liked heart and the like count are red. DS §2.1 reserves red for missed, errors and destructive actions.
- [Nav] Back (←) shows on a root page (head phone, devotee desktop). The bell still shows on the Wall itself.
- [Interaction] Compose is an inline form that scrolls the feed. Remove confirms inline ("Keep / Remove") instead of in a Sheet.
- [UX] The picture hint says "at most **1280 px**", while current-features §8 says posts allow 1,600 px. One of them is wrong; verify in `annimage.js`.
- [Hierarchy] A lone "Refresh" row (≈ 40 px) sits above the first post.

**11. SEO.** noindex. Title "Announcements · Sadhana Record". A shared `?post=` link previews with the app's OG image only, never the post text.

**12. Must remain unchanged.**
- `announcements.*`: plain text only, links made tappable.
- The audience rules (head: everyone or chosen batches; coordinators: their batches).
- Pin, show until, picture, edit, remove with Undo.
- Like (the head's decision), comments, removing your own, the WhatsApp share.
- `?post=` deep link: works after login; toast "That post is no longer on the wall."
- Opening the Wall marks posts as seen.

**13–21. Redesign.**
- **UI:**
  - **Every** post gets ⋯.
    - The author or staff see: Edit · Pin · Remove…
    - Everyone else sees: **Report post…**
  - **Every** comment gets ⋯ (long-press on touch):
    - **Report comment…**
    - **Hide comments from Rohan** (for me; reversible in Account › Hidden people).
    - **Staff:** Remove comment.
    - **Head:** "Hide this person's comments for everyone…", with a reason. This is audited.
- **UX:**
  - Reports go to Requests › **Reports** (the head, and coordinators for their batches). The reported item stays visible until a decision.
  - A one-time **community rule** Sheet appears before the first comment: "Be kind and on topic. Your batch can see comments. Report anything hurtful."
- **Interaction model:**
  - Compose and Edit open in a Sheet (full-height on phone; 620 px on desktop; `dismiss=false` when dirty).
  - Remove goes to a confirm Sheet: "Remove “Ekadashi kirtan this Saturday” for everyone?"
- **Motion:**
  - The Like heart fills in 120 ms with no bounce.
  - The `?post=` highlight ring is kept (2.6 s), using the brand ring.
- **Responsive:**
  - **Phone:** a full-width feed.
  - **Tablet/desktop:** a 42 rem column, plus a right column with "Pinned" and "Your batch's posts" on wide screens.
- **States:**
  - Empty, devotee: "No announcements yet. Your coordinator's posts will appear here."
  - Empty, staff: "… Post one for your batch with New announcement."
  - After a report: toast "Thanks — a coordinator will look at it."
  - After hiding a person: toast "You won't see Rohan's comments. Undo".
- **Data presentation:** relative time up to 6 days, then "Wed, 1 Oct"; the audience shown to staff only.
- **Components:** content card, overflow menu, Sheet, Toast with Undo, Status chip "New".
- **Micro-interactions:**
  - Like: an outline heart in `--text-muted`; liked: a filled heart in the brand colour. The count is a muted caption (quiet).
  - The comment counter appears near the 500-character limit.
- **Imagery:** only the posts' own pictures. No darshan.
- **Density:**
  - PRIMARY: the post.
  - SECONDARY: comments.
  - CONTEXTUAL: author, time, audience.
  - ACTIONABLE: Like, Comment, Share, ⋯.
  - OPTIONAL: the compose sheet.

**22–25.** P0 (report/hide) / P1 · M (new `announcements.report`, `mute.*` endpoints, a Reports queue; additive) · Risk: medium (moderation semantics need IYF sign-off: review §8 decision 1) · Benefit: a store requirement · Budget: Wall chunk 8.0 KB → ≤ 10 KB gzip · **Phase 0** (report/hide, red-heart fix) and **Phase 4** (sheets, layout).

**Before → After → Why better → Unchanged.**
- Before: no reporting, a red Like, inline forms.
- After: Report and hide everywhere, a quiet Like, sheets.
- Why better: passes store review, and the colours keep their meaning.
- Unchanged: every posting, audience, like, comment and share function, and `?post=`.

---

### `#/account` (and `?f=howto`) — Account (every role)

**1. Current purpose.**
- The profile: name, photo, roles, login, batch, and the About / Contact / Address / Emergency / Facilitator sections.
- Settings: notifications, change password, How to use, delete account, what happens to my data, log out, the app build.

**2. Current UI structure.**
- Two columns from 768 px. On phone, one column **2,701 px** (head) and **2,846 px** (head + devotee).
- The overlines "PROFILE" and "SETTINGS".
- Eight cards with pencil-edit sections.
- The full Change password form inline.
- 5 How-to accordions.
- `?f=howto` scrolls to the How-to card.

**3–10. Problems.**
- [Mobile] Very long. Review §4.7: rows that open sheets.
- [UX] Team logins ("SPS Team", "IYF Head") are asked for "Class you attend", "Date of birth", "Blood group" and "Emergency contact", all reading "Not added" (review §4.4).
- [UX] The Notifications row says "**Checking…**" for ever on some devices (`Reminder.svelte`, state `checking`).
- [UX] How to use shows devotee topics ("Filling in your day") to the head and coordinators. Keyboard shortcuts show on touch devices.
- [Visual] The head's batch line is IDs: "SPS, SPS2, SPSO, DPS, BSS, BVS". The overlines and the "ADMIN" area tag sit on a shared page (DS §3).
- [UX] There's no privacy-policy link (a store requirement, review §7).

**11. SEO.** noindex. Title "Account · Sadhana Record".

**12. Must remain unchanged.**
- `profile.*` and `photo.*` (crop, zoom, remove).
- Renaming yourself.
- The facilitator picked from the list.
- `auth.changePassword`.
- The push switch.
- `account.delete` for devotees; the staff note ("Ask the IYF head to remove your role first").
- `/delete-account.html`, Log out, and the app build line.

**13–21. Redesign.**
- **UI:**
  - A header card: photo, name ✎, "Devotee · Group leader · SPS" (names), login.
  - Then Grouped lists of 56 px rows, each opening a Sheet:
    - **Profile:** About you › · Contact details › · Address › · Emergency contact › · Facilitator › (devotee scope only).
    - **App:** Notifications (inline switch + status) · Theme › · Text size › (Phase 8) · Change password › · How to use ›.
    - **Privacy:** Hidden people › (from the Wall) · Privacy policy ↗ · What happens to my data ↗ · Delete account › (or the staff note).
    - Log out (Outline-danger) and "App 2026.10.07-1736".
- **UX:**
  - **No devotee scope:** only the name, photo, Contact and Password are shown.
  - The `checking` state times out after 4 s: "Couldn't check notifications — **Try again**".
  - How to use is **role-specific**:
    - Devotee: Fill a day, Submit the week, Share, No signal, Reminders.
    - Group leader: + Mark attendance, Nudge.
    - Facilitator: Find who needs you, Read a student's week.
    - Coordinator: Approve sign-ups, Batch status and attendance, No-class week, Fill for someone, Ask to reopen.
    - IYF head: Decisions, Reopen a week, Staff accounts, Settings, Read Activity.
    - Keyboard shortcuts appear only with `(hover: hover) and (pointer: fine)`.
- **Interaction model:**
  - `?f=howto` opens the How-to Sheet directly (half snap on phone, 620 px on desktop). Back closes it to Account.
  - Each section's Save is disabled until something changes; the leave guard stays.
- **Motion:** sheets with a spring; the "Saved ✓" check draws only after a real save.
- **Responsive:**
  - **Phone:** ≈ 1,100 px (devotee) and ≈ 800 px (staff).
  - **Tablet/desktop:** the header and Profile on the left, App and Privacy on the right.
- **States:**
  - Loading: a skeleton for the profile rows (space kept, CLS 0).
  - A row's value: "Not added" in muted italic.
  - Error: "Couldn't load your profile. Check your connection — Retry."
- **Data presentation:** batch names; dates "12 Mar 2001".
- **Components:** Grouped list, Sheet, Toggle, Notice, Danger-solid in the delete Sheet.
- **Micro-interactions:** a row's value updates in place after saving, and a toast "Address saved."
- **Imagery:** none.
- **Density:**
  - PRIMARY: who I am.
  - SECONDARY: notifications and password.
  - CONTEXTUAL: role and batch.
  - ACTIONABLE: the rows.
  - OPTIONAL: How to use and the data pages.

**22–25.** P0 ("Checking…", privacy link) / P1 · M · Risk low · Benefit high · Budget: Account 3.6 KB + Profile 5.1 KB gzip; the sheets lazy-load inside the same chunks (≤ +2 KB) · **Phase 0** (timeout, privacy) and **Phase 4** (rows, role How-to, staff fields).

**Before → After → Why better → Unchanged.**
- Before: 2,900 px of open forms, devotee fields for team logins, "Checking…" for ever.
- After: ≈ 1,100 px of rows, role-aware sections, an honest status.
- Why better: each setting is one tap away, and nothing irrelevant or false is shown.
- Unchanged: every profile field, the password change, deletion, Log out and the build.

---

### Go to… — command search (coordinator, IYF head)

**1. Current purpose.** Jump to any screen the person may open, or to a devotee by name, phone or IYF ID. Opened by 🔍, `/` or Ctrl/⌘K.

**2. Current UI structure.**
- A Sheet "Go to" with a search field ("A screen, or a devotee's name, phone or IYF ID").
- 8 screens when empty.
- Devotees after 2+ characters (250 ms debounce, `members.list` limit 8).
- Rows: an icon tile, the title, "SPS · KT26-0110 · 6000000011".
- The key hints "↑ ↓ move · Enter open · Esc close" (hidden on touch).

**3–10. Problems.**
- [Nav] The screen list mirrors today's menu: 10 admin items, "Members" and "All devotees" both. It will mis-name things after the IA change.
- [UX] There are no section headers: screens and people are mixed in one list. There are no recent items.
- [A11y] The combobox always says `aria-expanded="true"`, and each `role="option"` wraps a link (nested interactive).
- [UX] "No devotee matches “x”" shows even when screens match.
- [UX] There are no synonyms: "notices", "reopen" and "members" fail after the renames.

**11. SEO.** n/a (a sheet).

**12. Must remain unchanged.** Staff only (`canRequests`); results only within what the server lets this person see; the shortcuts; loaded only on first open.

**13–21. Redesign.**
- **UI:** the groups **Recent** (last 5, per viewer, `localStorage` with try/catch), **Screens** (from the new `nav.js` areas, named as in IA §12), **Devotees**.
- **UX:**
  - A synonym map (members→Devotees, notices→Announcements, reopen→Requests › Reopens, overview→All batches).
  - The "no match" note is scoped to its group.
- **Interaction model:** the listbox options are plain `li`s. Enter or click calls `go(href)`. `aria-expanded` follows whether results are visible.
- **Motion:** the sheet rises in 200 ms; the selection tint is 120 ms.
- **Responsive:**
  - **Phone:** full-height sheet, input at the top.
  - **Desktop:** a 620 px dialog at 20 vh.
- **States:**
  - Typing: "Searching…".
  - Error: "Couldn't search devotees — check your connection."
  - Empty: "Type a screen or a devotee's name, phone or IYF ID."
- **Data presentation:** for a devotee, the name, then "SPS · KT26-0110". The phone shows only when the query was a phone number.
- **Components:** Sheet, Search, Grouped list.
- **Micro-interactions:** the matched characters are bold; Esc clears first, then closes.
- **Imagery:** n/a.
- **Density:**
  - PRIMARY: the best match.
  - SECONDARY: the other screens and people.
  - CONTEXTUAL: batch and ID.
  - ACTIONABLE: open.
  - OPTIONAL: the key hints.

**22–25.** P2 · S · Risk low · Benefit medium · Budget: CommandSearch 2.0 KB → ≤ 2.5 KB gzip · **Phase 2** (IA names) and **Phase 8** (ARIA).

**Before → After → Why better → Unchanged.**
- Before: one mixed list, stale names.
- After: Recent / Screens / Devotees, synonyms, correct ARIA.
- Why better: faster jumps, and it keeps working after the renames.
- Unchanged: who can use it, the shortcuts and the server-scoped search.

---

### The App Shell — top bar, bottom nav, rail, sidebar, drawer, bell, offline bar, toasts (every signed-in role)

**1. Current purpose.** One navigation model (`lib/nav.js`) drawn three ways (bar < 600, rail 600–1023, sidebar ≥ 1024), plus the top bar, bell, offline bar, toasts and Go to….

**2. Current UI structure.**
- **Sidebar:** brand, area tag, profile card, then sections My Sadhana / Facilitator / My batch (+ batch select) / Admin (10 items) / You (Announcements, Account, Report issue, How to use, Install, Theme, Log out).
- **Top bar:** Back or ☰ · area tag + serif title · 🔍 + bell.

**3–10. Problems.**
- [Nav] **The sidebar overflows at 860 px.** For the head it ends at "Batches": IYF IDs, Activity, Settings and the whole You section, including **Log out**, are unreachable without page scroll (review P0 #9).
- [Nav] The head's sidebar has **19 rows**, with "Group leaders" twice and both "Members" and "All devotees".
- [Nav] Desktop shows a tab row **and** the sidebar for the same Admin items. The tab row is cut ("s", "**w**").
- [Mobile] The head + devotee bar has no Requests or Admin (`nav.js` ranks Week and Report first).
- [UX] **Bell count:** "4" on Home but "1" or "0" elsewhere. When `announcements.list` isn't cached, `unread` falls back to `latestAnnouncementAt` → 0 or 1.
- [UX] The app badge is `sc.devotee ? unread : pending`: a head who is also a devotee never sees waiting requests on the icon. `pending` leaves out reopens.
- [Nav] Back shows on root pages (`/week`, `/group`, `/wall`, `/hearing`, `/reading` → `#/home`). `/devotee/<login>` always goes Back to `#/batch`, even when opened from All devotees or Go to….
- [Visual] Every admin page is titled "Admin". The bell shows on the Wall.

**11. SEO.** `document.title` per route (S1); the landmarks are kept.

**12. Must remain unchanged.**
- One model in `nav.js`; the server is the authority.
- The skip link and the focus-to-title-on-navigate with a polite announcement.
- The drawer: native `dialog`, closed by Esc, the scrim and Back.
- The keyboard shortcuts.
- The offline bar wording: "You're offline — changes stay on this phone".
- Toasts: at most 3, with Undo.
- The forced password change never shows the app (handled in **Phase 3**: no shell around it).

**13–21. Redesign.**
- **Sidebar (desktop):**
  - The sidebar is `position: sticky; height: 100dvh`, with **its own scroll** (`overflow-y: auto`, an edge fade). The profile card is pinned at the top and links to Account.
  - **One entry per area:** Home · Requests (badge) · Batches ▸ · Admin ▸ · My students · You.
  - Only the active area expands its children (indented 40 px rows). The 3 px area marker sits on the active area.
  - The head's sidebar is about 12 rows and fits 860 px.
  - The batch select becomes a compact scope chip in the Batches area.
  - The "Announcements" row is removed: the bell is its one place.
- **Bar (phone) rule:**
  - Order: Home → own daily action → queue → highest scope → Account, max 5, labels always shown.
  - Head: Home · Requests · Admin · Batch · Account.
  - Head + devotee: Home · Week · Requests · Admin · Account. Report and Batch go to the rail and drawer.
  - Coordinator: Home · Batch · Requests · Account.
- **Rail (tablet):** 88 px, the same order, up to 7.
- **Drawer:** never repeats the bar's items (exists).
- **Badges:**
  - Requests badge = sign-ups + resets (+ reopens + reports for the head).
  - App-icon badge = that number for anyone with `canRequests`, otherwise unread posts.
- **Bell:**
  - The unread count comes **from the server**: a `home.get`/`announcements.unread` field computed from the person's stored seen-time, the same on every screen.
  - The bell is hidden on the Wall.
- **Top bar:**
  - The title is the page's own name ("Settings", not "Admin"). The area tag appears only on staff pages; none on Account and the Wall.
  - **Back only on child pages:** day, history/<week>, devotee/<login> (returns to where it was opened from, via `history.back()` when the previous entry is in-app, otherwise the area root), fill/*, my-devotees/<login>.
  - Root pages show ☰ on phones and nothing on desktop.
- **Offline bar:** a sticky Notice under the top bar. "Back online" shows for 3 s, then hides.
- **Toasts:** bottom-centre above the bar, swipe to dismiss (Phase 7).
- **Motion:**
  - The nav pill slides with `--ease-spring`, 200 ms.
  - Page slide 220 ms by direction (crossfade on Low).
  - The top bar turns to glass on scroll (exists).
- **Responsive:** as above. The desktop has no page tab rows; phone tabs scroll with an edge fade and the active tab centred.
- **States:**
  - Bell: "Announcements, 3 new" or "Announcements".
  - Badge: capped at "9+".
  - Offline: as now.
- **Components:** glass bar and sidebar (≤ 2 glass layers), Status chip, Toast, Sheet.
- **Micro-interactions:** the badge pops a 120 ms scale when its count rises (not under reduced motion).
- **Imagery:** none.
- **Density:**
  - PRIMARY: the current area.
  - SECONDARY: its children.
  - CONTEXTUAL: the badges.
  - ACTIONABLE: the items.
  - OPTIONAL: Theme, Install, Report issue (under You).

**22–25.** P0 (sidebar scroll, tab cut, head + devotee bar, badge, bell) / P1 (areas) · M · Risk: medium (navigation for every role; covered by the 10-persona sweep) · Benefit very high · Budget: startup JS stays ≤ 55 KB (`nav.js` shrinks as the admin items fold into areas) · **Phase 0** and **Phase 2**, motion **Phase 7**.

**Before → After → Why better → Unchanged.**
- Before: 19 sidebar rows that overflow, tabs plus sidebar, counts that change by screen.
- After: about 12 rows with their own scroll, one entry per area, server-true counts, Back only where there is a parent.
- Why better: every destination is visible and trustworthy on every screen.
- Unchanged: the single model, the scopes, the shortcuts, the drawer behaviour, the offline and toast semantics.

---

### NEW (proposed): `#/hall/<batch>` — TV hall display (coordinator of that batch, IYF head; optional)

**1. Current purpose.** None; this is new. It is a read-only, 10-foot board for the temple hall or a class projector (360 §8.2; proposal §8).

**2. Current UI structure.** None.

**3–10. Problems it solves / risks it must avoid.**
- [UX] On Sunday, the class can't see "how is our batch doing" without someone reading from a phone.
- [Privacy] It must never show names, personal scores or phone numbers on a shared screen.
- [Security] A TV left signed in with a staff login is a risk.
- [Perf] An always-on page must not hammer D1 on the free plan.

**11. SEO.** noindex; not linked publicly.

**12. Must remain unchanged.**
- No new data is exposed: aggregates only, from the existing `stats.batch`/`stats.all`.
- No change to scopes.

**13–21. Design.**
- **UI:**
  - No shell (no bar, sidebar or bell). The layout is a 60/40 split.
  - **Left:**
    - "SPS · Week of 5 Oct – 11 Oct";
    - a huge ring "**18 of 42** submitted";
    - a Scope strip (Filling · Not started);
    - "This Sunday's attendance: 31 present";
    - "Submit closes **Mon 9:00 PM** · 1 day 4 h".
  - **Right:** today's darshan (the 40% panel, `--img-aspect-panel`) plus the verse, credited.
- **UX:**
  - It opens from Batch status ⋯ › "Show on a TV". It goes fullscreen and requests Wake Lock (only here).
  - "Exit" is a large focusable button.
- **Interaction model:** remote arrows move a 4 px focus ring between Exit and "Next verse". Nothing else is interactive.
- **Motion:** the numbers count up on change; the verse crossfades every 60 s; the image is static. Low tier: no image, no count-up.
- **Responsive:** 1280–3840 px. Type ≥ 28 px, numbers at 96–160 px; contrast ≥ 7:1.
- **States:**
  - "Updating…" (quiet).
  - Offline: "Showing the last numbers from 7:42 PM".
  - Signed out: "Sign in on this screen to show the hall display."
- **Data presentation:** counts only; no names; no individual percentages.
- **Components:** Scope strip, ring, darshan card, Notice.
- **Micro-interactions:** none beyond the count-up.
- **Imagery:** **yes, here only**: one daily darshan, 1440w ≤ 120 KB.
- **Density:**
  - PRIMARY: submitted of total.
  - SECONDARY: the deadline.
  - CONTEXTUAL: attendance.
  - ACTIONABLE: Exit.
  - OPTIONAL: the verse and image.

**22–25.** P3 · S · Risk: low (read-only), with privacy reviewed by IYF · Benefit: community feel · Budget: its own lazy chunk ≤ 4 KB. It refreshes every 60 s only between Sun 6 PM and Mon 9 PM, otherwise every 15 min, using the cached `stats.batch`. That is ≤ 1,500 requests a day per TV, inside the free plan; check it with `sadhana-free-plan`. · **Optional, any time after Phase 7**.

**Before → After → Why better → Unchanged.**
- Before: nothing.
- After: a calm, privacy-first hall board.
- Why better: it celebrates the batch's steady practice together, without exposing anyone.
- Unchanged: every API, scope and personal view.
