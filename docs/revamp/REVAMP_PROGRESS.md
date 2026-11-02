# Revamp phases 1–8 — progress (built, not live)

**IYF Delhi · Sadhana Record · started 8 October 2026**

**Where the work is:**
- **`sadhanaRecord-revamp/`**: a working copy, so `sadhanaRecord/` stays exactly what is live, for urgent fixes. See `REVAMP-COPY.md` in that folder.
- **Testing:** each phase tests only what it built. All phases go live together after the full final test (`IMPLEMENTATION_ROADMAP.md` §5).

## Phase 1 — Design-system foundation (built 8 Oct 2026)

**What changed:**
- **One brand colour (D1):**
  - The logo blue is used for every button, link, focus ring, selected item and active nav, in every area: `#004FDC` light, `#78A8FF` dark. This is the logo's `#0058F8` a shade deeper, so all text meets 4.5:1, including on the page wash.
  - The splash, browser bar and app icon colour are the logo navy `#002888`.
  - Sign-in no longer uses purple.
- **Area markers only:** coordinator saffron and admin wine now appear only on the area tag, the menu section dot and the page overline. Shared pages (Home, Account, Wall, Change password) carry no area tag above the title.
- **Gold:** the logo's gold `#F8B000` is used for decoration; gold text is `#7A5300` (light) and `#F8B000` (dark).
- **Status words:**
  - "Filling" replaces "Draft" everywhere.
  - A **past day nobody filled is amber "Missing"** (a "!" mark). This applies to the Home week strip, the Day chips, the Week list, and the staff day strips on Batch status, My group and My students.
- **Chart colours fixed per category:**
  - Body `#4F7FB0`, Soul `#A5802A`, Seva `#2F8576`, Attendance `#7A5AA6`, Overall = brand. These are the same on the day bars, the week bars and the trend lines.
  - A category under 50% is hatched in its own colour, never red alone.
- **Shape:**
  - Corner radius: 12 (controls), 16 (cards), 24 (hero, sheets).
  - New motion tokens: `--d-page`, `--ease-spring`, `--ease-exit`.
  - Numbers in pills, badges, status words and tables use tabular figures.
  - Headings and paragraphs wrap evenly.
- **Accessibility:**
  - New `contrast.css`, used when the phone or computer asks for more contrast: stronger edges, darker supporting text, no glass, a 3 px focus ring.
  - It also supports Windows high-contrast mode, using system colours with outlined dots and day marks.
  - It loads with a media query, so it is never render-blocking for others.
- **Size:**
  - Startup CSS is 13.38 KB (target 13.5): the segmented-control styles moved to `styles/seg.css`, and the unused old chart palette was removed.
  - Startup JS is 52.9 KB.

**Tests (only what Phase 1 touched):**
- App unit tests: 304, all passing. The contrast test was rebuilt for the one-brand rule and extended to area markers, chart colours, the Missing mark and the navy brand surface (33 new checks).
- Browser checks, all passing:
  - design 26, nav 102, charts 4, devotee 225
  - coord 127, groups 26, welcome 28, tiers 84
  - logins 697, today 12
  - components 219
- The theme-colour checks now expect the one brand colour, plus each area's marker colour on its tag.
- Screenshots: devotee Home, coordinator Batch status, admin Overview, sign-in.

**Moved to the phases that rebuild the screens:**
- The **component-token layer** (button, card and input tokens) and the **spacing rhythm**. They are applied as each screen is rebuilt in phases 4–6, so no screen is restyled twice and the startup CSS stays within budget.

## Phase 2 — Navigation and the app frame (built 8–9 Oct 2026)

**What changed**
- **The bar rule per role:** Home → own daily action → queue → highest scope → Account (the phone bar shows four and Account; the tablet rail shows all).
  - Group leader: Home · Week · **Group** · Report · Account.
  - IYF head: Home · Requests · Admin · Batch · Account.
  - Head with a sadhana: Home · Week · Requests · Admin · Account.
  - Coordinator: Home · Batch · Requests · Account.
- **The desktop sidebar:**
  - One entry per area; only the area of the open page shows its pages. A folded area keeps its entry, plus anything with a count waiting (Requests).
  - The head's sidebar is about 17 rows instead of 26.
  - The Announcements row is gone: the bell is its one place.
- **Tab rows only on phones and tablets.** On the desktop the sidebar lists the same pages.
- **The top bar:**
  - Each page is titled by its own name (Settings, IYF IDs, Batch setup …, never "Admin").
  - Back appears only on pages that have a parent: a day, a week in History, a devotee, filling for someone, a student. A devotee's page goes Back to where it was opened from.
  - No bell on the Wall itself.
- **One Requests inbox:**
  - The IYF head now decides reopen requests on Requests, and sees "Wall reports to review" there.
  - The Requests count (and the app-icon badge) includes them.
  - `#/reopens` redirects to `#/requests?type=reopen`. The Admin "Reopens" tab is gone.
- **Account:**
  - Settings are rows that open sheets: Change password, How to use, Privacy policy, What happens to my data, Delete my account. Notifications stay inline.
  - Logins with no sadhana of their own (team logins, facilitators, the head) no longer see the devotee fields (about, address, emergency contact, facilitator).
- **How to use is per role:**
  - Devotee: day, week, sharing, no signal, reminders.
  - Group leader: attendance, reminding the group.
  - Facilitator: finding who needs you, reading a week.
  - Coordinator or IYF head: Requests, attendance, a no-class week, filling for someone, reopening, and Admin for the head.
  - Keyboard shortcuts appear only with a mouse.
- **Naming:**
  - "Devotees" (not "Members"); "Batch setup" for the admin page, so the sidebar never shows "Batches" twice.
  - "TRD (temple resident)".
  - Dates written as "7 Oct 2026", never "07".

**Also built (requested 8 Oct, ships with the final release):**
- **Hearing in the day form:** it shows the whole allotted journal, the same as the Hearing page (all weeks, opening on the suggested week).
- **One topic a day:** a lecture from the list or a topic typed in. Choosing replaces the earlier topic and closes the list.

**Tests (only what Phase 2 touched)**
- **App unit tests:** 306, all passing.
- **Browser checks, all passing:**
  - nav 102, logins 692, master 36, coord 127, devotee 225
  - facilitator 14, groups 26, deletion 42, pro 52, back 12
  - phase8 35, oct7 16, oct8 13, facs 20
- **Tests updated to the new design:** bar orders, folded sidebar areas, no desktop tab rows, Requests holding the reopen requests, the Delete row, the head's bar.
- **Responsive screenshots:**
  - Account and the head's Requests at 390, 768 and 1280, light and dark: no sideways scroll anywhere.
  - The How to use sheet; the desktop sidebar.
- **Size:** startup JS 53.5 KB (target 55), CSS 13.4 KB (target 13.5).

## Phase 3 — Sign-in and sign-up (built 9 Oct 2026)

**What changed**
- **Darshan, first version:**
  - 18 everyday paintings from IYF's Drive folder (#09, #18, #20, #24, #25 and #29 are left out, as decided). Each is WebP at 480 and 960 px (1440 px for the three wide ones), plus a 960 px JPEG.
  - Every 480 px file is 45 KB or less.
  - The list is `public/darshan/darshan.json`: title, deity, crop point, dominant colour.
  - **One a day, the same for everyone**, chosen by the Indian date. Welcome and the sign-in panel use the 4 flagship paintings.
  - The images are never in the install. They are fetched only when shown, then kept (at most 8, for 30 days).
  - They are hidden on the Low tier and with Save-Data.
  - Each image has meaningful alt text ("Darshan: <title>"). There is no credit line (IYF holds the rights).
- **Welcome:**
  - **Phone:** logo → "Sadhana Record" → a one-line purpose → today's darshan band → Sign in / Create an account → "Sign up in a few minutes · your coordinator approves you" → the trust line "Your details stay with IYF Delhi · Privacy" → the verse.
  - **Desktop:** split screen. The darshan panel (with the verse) is on the left, the welcome on the right.
  - The three feature tiles that looked tappable are gone.
- **Sign in:**
  - "Sign in" wording throughout.
  - On the desktop, today's darshan sits beside the form; phones load no image.
  - The trust line and privacy link sit under the form.
  - A **rejected sign-up** gets a calm page with the reason and "Send a new sign-up", never a red error. The pending page was built in Phase 0.
- **Sign-up in 4 steps:**
  1. About you (with the parent or guardian section for ages 15–17).
  2. Batch and class.
  3. Address.
  4. Emergency contact, password and privacy.

  Details:
  - A progress bar and "Step n of 4".
  - **Each step is checked before Next**, and Back keeps the answers.
  - A **draft** is kept on the phone (never the passwords), so a reload or a lost signal loses nothing. It is cleared once the sign-up is sent.
  - A server message brings the person back to the step with that field.
  - On the desktop, the darshan panel explains "What happens next" (3 steps).
- **Forgot password** explains first: the coordinator (the IYF head for staff) approves the new password, and the old one works until then.

**Tests**
- App unit tests: 306, all passing.
- **Browser checks, all passing:**
  - welcome 30;
  - rules 56 (the sign-up rewritten for the 4 steps: each step's checks, ages, the parent section, the draft surviving a reload, Back, a server error returning to its step, sending, the draft cleared);
  - logins 692;
  - the new oct9 part, 7 (the sign-in panel on the desktop only, nothing downloaded on phones, the trust line, Forgot's explanation, the rejected page).
- **Responsive screenshots:** Welcome, Sign in and Sign-up at 390, 768 and 1280, light and dark. No sideways scroll anywhere.
- **Size:** startup JS 53.6 KB, CSS 13.4 KB (both under target). The images are not part of the startup.

## Phase 4 — Devotee core (built 9 Oct 2026)

**What changed**
- **Home** has three parts:
  - **The week.** One status line, for example "4 days to fill — Mon, Tue, Wed, Thu". Past days left empty in an open week are marked in amber as **missing**. One next action names the day ("Fill Monday") beside the person's photo or initial.
  - **Needs you,** only for a group leader or facilitator with someone waiting.
  - **Today's darshan with the verse.** The painting loads after the first screen.
  - The other open weeks are one row each. The Wall teaser shows only when something is unread. Four quick links sit at the foot.
- **First-run guide:** three short cards at the top of Home (fill each day, submit your week, see your progress), with Next, Back, Skip and Start.
  - It shows until the first day is filled, or until it is skipped or finished on that phone.
  - It is inline, not a dialog, and is loaded only while it shows.
- **Day:**
  - minute fields have −5 / +5 steppers;
  - each finished section shows a tick;
  - "Same as yesterday" copies the previous day;
  - on the desktop, the form is one column of 720 px;
  - the pickers load on demand;
  - offline, a hint shows, and pressed Saves go by themselves when the phone is back online.
- **Week:** a "Before you submit" checklist (days, Night Stay and principles, attendance, the submit window). Each line links to its place.
- **Report:**
  - a one-sentence insight;
  - the scores as **meters**: weakest first, each in its category colour, hatched and marked "low" under 50 %, with "Show as table";
  - missing days on the calendar;
  - the colour key in two rows (scores; empty days: "Missing (still open)" and "Missed (closed)");
  - the Daily / Weekly toggle first.
  - **History** is now the Weekly view of Report. The `#/history` link still works.
- **Hearing:** a "Continue" row; weeks are called "Lesson week".
- **Offline:** a pressed Save waits on the phone and is sent automatically. Home lists what is waiting. The app asks the browser to keep its storage.
- **Deadline reminder (server):**
  - **When:** in the three hours before last week's deadline (6 PM Monday with the usual 9 PM close; it follows the submit-window setting).
  - **Who:** one push to each signed-in, active devotee whose last week is not submitted. Staff-only phones and phones with nobody signed in get nothing.
  - **Wording:** "Your week closes tonight — Submit last week by 9 PM. Every complete day counts." Tapping it opens the week at Submit.
  - It runs before the evening reminder, and the 9 PM reminder still goes out the same evening.
  - New migration **0031** (one progress row, additive). It is not copied to Sheets, so no tab changes are needed.

**Tests**
- Server: all 20 suites pass (1,735 assertions). The push suite has 13 new checks for the deadline reminder: not before 6 PM, only devotees who have not submitted, sent once, the push expires at the deadline, the wording, "submitted ✓" for a week already in, the evening reminder unaffected.
- App unit tests: 307, all passing (a new one for sending pressed Saves automatically).
- **Browser checks, all passing:**
  - devotee 225, today 12, nav 102, pro 52, charts 4;
  - phase8 35 (the colour-key check now expects two rows);
  - oct7 16, oct8 13, oct9 7, welcome 30, rules 56, logins 692;
  - components 219;
  - the new oct10 part, 18 (the first-run guide at 320, 390 and 1280 px).
- **Test fixes:**
  - Home's main action is now the `.s-pill` row, so the selectors were updated.
  - The day-row checks are scoped to the Days list, so the new checklist rows are not counted.
  - The contrast helper ignores colours caught mid-way through a hover fade (`oklab()`), and the mouse is moved off the rows first. The real hover contrast is 4.7:1.
- **Responsive screenshots:** Home, Week and Report at 390, 768 and 1280, light and dark, plus the first-run guide. No sideways scroll anywhere.
- **Size:** startup JS 54.8 KB (target 55), CSS 13.45 KB (target 13.5); the largest lazy chunk (Devotee) is 29.2 KB (target 30).

## Phase 5 — Group leader, facilitator and coordinator (built 9 Oct 2026)

**Shared pieces**
- **Staff helpers** (`lib/staff.js`):
  - `rowReason` gives one plain line per person: "2 of 7 · Missing Tue, Wed", "Nothing filled since Mon", "Submitted · 82%", "Missed · 0 (2 of 7 begun)".
  - `needsYou`, `workOrder` (not started → filling → missed → submitted) and `band` (score pill colours).
  - New unit tests: `tests/staff5.test.js`.
- **New components:**
  - `ScopeStrip`: one row of the week's counts. On My students and the Board the counts are filters; on staff Home a strip opens that batch.
  - `RingRow`: members' initials in progress rings (green submitted, amber missing days). Hidden on the Low tier.
  - `Spark`: a 12-week sparkline with the average.
  - `ColBars`: column charts with every bar visible at once, an average line and "Show as table".
- **Attendance:** before the class day there is an "Opens Sun" chip instead of disabled P/A buttons that looked already marked.
- **List + detail from 1024 px** (`lib/wide.svelte.js`) on My students and Requests. Links keep working, and a phone gets its own page.

**Screens**
- **My group:**
  - one strip;
  - the ring row;
  - "Still to submit" with an amber edge, then "Submitted" at full contrast (no greying; folded when there are more than 8);
  - a reason on each row;
  - a row opens Call / WhatsApp;
  - "Nudge all (n)" lists who gets the WhatsApp message, one at a time.
- **My students:**
  - grouped as Needs you · Filling · Submitted (folded);
  - the counts filter;
  - a reason on each row;
  - on desktop the student opens beside the list.
- **One student:**
  - Call and Chat as secondary buttons, with a "Facilitator view" chip;
  - this week's status;
  - the 12-week sparkline;
  - banded score pills;
  - one "Older weeks" picker at the end.
- **A week, read-only (WeekRead):**
  - an "Earlier / Later" week stepper;
  - a header with the status and overall %;
  - meters, weakest first;
  - days beside the meters on desktop;
  - the week-end answers as three tiles;
  - a coordinator gets "Fill for" on an open week.
  - It now refetches when the week changes.
- **Staff Home** (a staff-only lazy file, `coord/StaffHome.svelte`, so devotees' startup got smaller):
  - **Needs you:** sign-ups with the oldest one's age, password resets, attendance still to mark, or "All caught up".
  - **This week:** one strip per batch.
  - **People to nudge:** up to five people.
  - Then birthdays and the verse.
- **Batch status:**
  - the strip as filters;
  - rows in work order with their reason;
  - "Opens Sun" before the class day;
  - "Fill for", Open, Call and WhatsApp in the row ⋯ sheet;
  - "No regular class this week?" as an outline button.
- **Requests:**
  - one inbox (All · Sign-ups · Resets · Reopens) of compact rows with their age, oldest first;
  - a row opens its card (a page on a phone, beside the list on desktop);
  - after a decision the next one opens.
  - The type row never wraps on a phone.
- **Devotee detail:**
  - Call · WhatsApp · Email in one row;
  - a "This week" card (status, day strip, "Fill for", sparkline);
  - banded score pills;
  - "Waiting for the IYF head" after asking to reopen;
  - profile facts folded under "Details";
  - the account actions folded under "More actions".
  - Wording: "Request sent to the IYF head".
- **Fill for:**
  - a sticky acting-as bar ("Filling for Deepak Yadav · Saved as filled by the coordinator · Done");
  - the title "Deepak · Week";
  - the submit confirm "Submit for Deepak Yadav? 2 of 7 days count…".
  - The batch board refetches after such a save (it used to show "Not started" until refreshed).
- **Devotees (Members):**
  - batch, class, blood group and sort in a "Filters (n)" sheet, with removable chips;
  - rows stay on one line on phones.
- **Group leaders:**
  - groups first, as a 2-column grid on wide screens;
  - "3 of 4 submitted" in each group header;
  - "Appoint a group leader" as a button and sheet.
- **Filling chart:**
  - all 7 days and all 8 weeks visible at once, with the average line;
  - the week labels are two short lines ("17 / Aug");
  - "People" is one line.

**Changes asked for during the phase (the IYF head, 9 Oct 2026)**
- **Toasts:**
  - a floating card with a colour strip and icon by kind (done · info · problem), the action in the brand colour, and a thin line that runs down over the toast's time;
  - one stack, so an error no longer covers another toast.
- **Welcome on phones:**
  - a compact lockup;
  - the painting as a 4:5 hero (at most ~54 % of the screen, framed on its focal point) with today's verse on a panel at its foot, the same as the desktop panel;
  - then the title and Sign in / Create an account, all on the first screen.
- **Paintings rotate like the quotes:**
  - every 9 s, starting from today's painting;
  - at most 6 fetched a visit, then those go round;
  - only while on screen;
  - none with reduced motion, the Low tier or Save-Data.
  - On Welcome, sign-in and the Home card.
- **No pause buttons** on the paintings or the verse: they hold still while pressed (touch and hold), under the mouse, or with keyboard focus (Enter keeps them still), and go on when let go. The image long-press menu is suppressed.
- **Phase 4 fixes found here:**
  - Report: Daily / Weekly on its own row on phones, with month and year together below it;
  - overlines always in the sans font.

**Tests**
- App unit tests: 311 passing.
- **Browser checks, all passing:**
  - coord 131, groups 28, facilitator 14, facs 20, classweek 3, master 36;
  - nav 102, deletion 42, oct7 16, oct8 13, oct9 7, oct10 18;
  - phase8 35, back 12, design 27, phase7 33, pro 52;
  - devotee 226, tiers 84, dayview 42, phase1 5;
  - welcome 31, today 12, charts 4;
  - components 219.
- **Check updates:** these follow the new design — the strip as filters, the requests inbox, the call sheet, "Fill for" in ⋯, two charts with all columns, ungreyed submitted rows, the quotes held by pressing, and the Welcome hero (Sign in on the first screen, no button on the picture).
- **Size:** startup JS 54.6 KB (target 55), CSS 13.5 KB (target 13.5); the largest lazy chunk is 28.7 KB.

**Not done in Phase 5 (kept for later):**
- Desktop tables and a detail pane for Batch status and Devotees (Devotee detail is a 2-column page instead).
- Keyboard shortcuts (Phase 7).
- "Down 30 points" reasons, which need a new server field.

## Phase 6 — IYF head and admin (built 9 Oct 2026)

**What changed**
- **The head's Home** (`master/HeadHome.svelte`, an admin-only lazy file) replaces the list of admin links:
  - **Decisions:** sign-ups with the oldest one's age, password resets, weeks to reopen (with names) and reported posts. Each row goes straight to the place to act, or the card says "All caught up — nothing waiting for you".
  - **System health:** plain facts, each a link to where it is fixed:
    - reminder phones ("No phone has reminders on" in amber);
    - the registry copy (date in words);
    - batches with no coordinator;
    - slow and refused saves today.
    - When all is fine: "Everything is running normally".
  - **Batches this week:** worst first, "4 of 10" with a bar; a row opens that batch.
  - It reads only this week's numbers and skips the heavy duplicate scan (free-plan reads).
  - Teams and role names ("IYF Head", "SPS Team") are no longer greeted as first names.
- **Admin layout:**
  - seven groups instead of nine tabs (All batches · People · Staff · Batch setup · IYF IDs · Activity · Settings);
  - People and Staff each have a two-page switch;
  - the sidebar lists the same seven;
  - every old route still works.
- **All batches** (`#/overview`):
  - one strip of totals;
  - batches worst first, with a bar, "4 of 10", filling / not started / missed, the coordinator (or an amber "No coordinator" chip) and an 8-week trend;
  - batches with nobody expected on one line underneath.
- **Settings:**
  - three rows that read the saved values (submit window, daily reminder, first tracked week);
  - each opens its own sheet with the day chips and time wheels;
  - Save shows only when something changed, and a toast offers Undo.
- **Coordinators:**
  - a row opens Edit;
  - one ⋯ per row (Edit · Reset password · Disable / Enable);
  - batch names on the row;
  - chips for "Temporary password" and "No batch".
- **Batch setup:**
  - the ID shows only when it differs from the name;
  - "Level · Coordinator" on the row;
  - "Offered / Not offered at sign-up" (not "Hidden");
  - amber "No coordinator";
  - a row opens Edit.
- **Activity:**
  - plain sentences with names ("SPS Team changed the facilitator / class day of Bhavesh Jain · Sunday class") under day headings (Today, Yesterday, Wed, 7 Oct);
  - five common types as chips, with "More types" for every type;
  - a line opens "What changed" as a Field · Before · After table, with the raw record folded inside;
  - the slow / refused call log folded at the bottom as the "Technical log (for the app keeper)".
- **Server (additive):** `audit.list` now returns `whoName` / `targetName`, looked up once per page in parts of 90.

**Tests**
- Server: 20 suites, 1,736 assertions (a new check that Activity carries names).
- App unit tests: 313 passing (new `tests/admin6.test.js`: names in lines, the plain-words diff).
- **Browser checks, all passing:**
  - master 36, coord 131, logins 692, nav 102;
  - deletion 42, oct8 13;
  - components 219.
- **Check updates:**
  - the head's Home expects Decisions / System health / Batches this week;
  - the admin tabs' arrow-key order follows the seven groups;
  - the reopen count is waited for;
  - Back after Save waits for "Saved ✓" instead of a fixed 0.6 s.
- **Responsive screenshots:** Home, All batches, Settings, Coordinators, Batch setup and Activity at 320–1280. No sideways scroll.
- **Size:** startup CSS 13.4 KB. Startup JS is 55.1 KB, 0.1 KB over its 55 KB target (budget 60): the bundler now splits three shared modules into their own startup files. To be tidied in Phase 8.

**Not done in Phase 6 (kept for later)**
- An "IYF heads" list (the `masters.set` API still has no screen).
- Desktop tables with a side pane for People.
- A searchable person picker in Activity's "By / About" fields (they take a username or phone).
- The Facilitators and IYF IDs screens are unchanged apart from the new grouping.

## Announcements to youth facilitators and TRD facilitators (the head, 9 Oct 2026)

- **What's new:** when the IYF head posts, two new audiences sit under the batches:
  - **Youth facilitators:** facilitators who are devotees of a batch.
  - **TRD facilitators:** facilitator logins with no batch.
  - Together they cover every facilitator. Either can go with batches or alone. "Everyone" still reaches everybody.
- **Rules:**
  - Only the head can choose them.
  - Each group sees only its own posts.
  - Each post's phone notifications go only to that group.
- **How it is stored:** as the tags `FAC_YOUTH` / `FAC_TRD` beside the batch IDs. No schema change; the Sheets copy shows the tags as written.
- **Tests:**
  - server: 11 new checks covering who sees what, the pushes, and coordinators refused;
  - browser: the composer offers both, and a TRD-only post is seen by the TRD facilitator and not by a devotee.

## Phase 7 — Motion and interaction (built 9 Oct 2026)

**What changed**
- **Page motion:**
  - the content slides a little in the direction of travel (in from the right going forward, from the left going Back);
  - the top bar and the nav stay still.
  - The styles live in `public/motion.css`: loaded after the app opens, kept offline, never with reduced motion or on the Low tier. Startup CSS is unchanged.
- **Counts count up** (400 ms, once per screen per session) in every scope strip. **Sparklines draw in.**
- **Batch status:**
  - rows that changed since the last load glow once;
  - while attendance is open, the board refreshes itself every 2 minutes when the screen is visible and nothing is unsaved.
- **Phones:**
  - the bottom bar steps aside while scrolling down a long page and returns on the way up (never while a save bar shows);
  - a sideways swipe on a day goes to the day before / after;
  - on a devotee's week (read-only), to the week before / after.
  - The chips and buttons stay; the swipe is a shortcut. Fields, chip rows, wheels and sheets are left alone.
- **Computers** (`lib/keys.js`, loaded after the app opens):
  - `j` / `k` move through any list's rows;
  - `p` / `a` mark Present / Absent on the focused row;
  - `Ctrl/⌘+S` presses the screen's Save (also while typing);
  - `[` / `]` go to the previous / next day or week.
  - These add to the existing `/`, `Ctrl/⌘+K`, `g h` / `g w` … and `?`.
- **Pressing a tab** starts fetching its screen at once (`lib/prefetch.js`).
- **App icon shortcuts** (long-press on Android): Fill today · This week · My report.
- **Haptics:** a failed save or submit gives a short double buzz (one tap on success, as before).
- **Week submitted:** a devotee's own submit ends on a small sheet — today's darshan, "This week: 94%", "See my report" / "Done". Filling for someone still shows a toast.
- **Fix found here:** the head's Wall always refetches its review queue on open, so a 2-minute-old copy can no longer hide a new report.

**Tests**
- App unit tests: 313 passing.
- **Browser checks, all passing:**
  - **new p7 part, 9:**
    - motion styles load;
    - the direction of travel;
    - the bar steps aside and returns;
    - a swipe to the next day;
    - j / k on the board;
    - the counts settle;
    - `[` to the week before;
    - Ctrl+S saves while typing;
    - the "Week submitted ✓" sheet.
  - devotee 226, nav 102, pro 50, coord 131, groups 28;
  - master 36, tiers 84, phase7 33, welcome 31;
  - oct8 13, oct9 7, oct10 20, dayview 42, today 12;
  - logins 692, components 219.
- **Check updates:** All batches / Settings / Activity in the oversight part follow the Phase 6 design.
- **Size:**
  - startup JS 55.6 KB (budget 60; target 55 — to be tidied in Phase 8);
  - startup CSS 13.4 KB;
  - the motion styles, the keys and prefetch are all outside the startup files.

**Not done in Phase 7 (kept or dropped)**
- Shared-element transitions.
- Sheet snap points.
- Long-press quick actions.
- A time-of-day wash.
- Swipes between devotees.
- These were left out as more motion than the screens need.

## Phase 8 — Performance, accessibility and search hardening (built 9 Oct 2026)

**Performance**
- **Startup JS back under target:** 54.7 KB, down from 55.6. The reminder card's small questions (`lib/pushask.js`) are now split from the push code, which loads only when notifications are switched.
- **Signed-in openings:** the splash only fades through (0.35 s instead of 1.4 s), because Home is kept on the phone. Signed-out visitors keep the 1.4 s launch screen.
- **Welcome's painting is no longer slow:**
  - the list of paintings starts with the page (`<link rel=preload>`, ~3 KB);
  - the first painting paints from its 480 px file at once (~28 KB), then takes the sharp one in the same place;
  - no fade on the first one;
  - the verse panel appears only once the verse has arrived (no panel that grows).
- **Lighthouse, production build (median of 3, mobile):**

| Page | Performance | Largest paint | Layout shift | Accessibility / Best practices / SEO |
|---|---|---|---|---|
| Welcome | 96 (was 93) | 2.4 s (was 3.0) | 0 (was 0.004) | 100 / 100 / 100 |
| Sign in | 98 | — | — | 100 / 100 / 100 |
| Welcome, desktop | 100 | 0.6 s | — | — |

**Accessibility**
- **axe-core (WCAG 2.2 A/AA)** now runs in the browser suite (`verify.mjs a11y`). It covers:
  - 4 signed-out screens;
  - 9 devotee, 8 coordinator, 9 head and 3 facilitator screens;
  - on a phone in light and dark, and on desktop.
  - **0 violations.** Fixed on the way: the Report calendar is now a labelled group of day buttons (the weekday letters are visual only); the admin page switch had a stray `aria-pressed`; the chart's "avg" label and the Hearing list's "heard" were too faint.
- **Text size in the app:** Default · Larger (112 %) · Largest (125 %), a row in the menu next to Theme.
  - It is remembered on the phone and applied before the first paint.
  - It is checked at 320 px with Largest: no sideways scroll on the main devotee and coordinator screens.
- **Windows high contrast (forced colours):** bars, meters, rings and dots stay visible; chosen buttons and the current page are outlined.
- **A refused save** says how many answers need fixing and moves focus to the first one. A refused submit moves focus to the first gap.
- **Painting alt text** names the pastime too ("Darshan: Aditi worships Lord Vishnu — …").

**Search and pages**
- Each screen names itself in the browser tab ("Report · Sadhana Record"; "Sign in · Sadhana Record").
- `robots.txt` and `sitemap.xml` (the root, privacy and delete-account pages). They point at the current address; switch it with the own domain (Phase 9). Canonical links wait for the domain too.
- A wording scan found no leftover "master" / "Draft" in what people see.

**Tests**
- App unit tests 313.
- **Browser checks:**
  - a11y 3 (the axe sweep, the text-size row, Largest at 320 px);
  - the 10-width route sweep 10;
  - welcome 31 (the log-out check now waits for the welcome screen, which takes about a second);
  - oct9 7.

**Not done in Phase 8 (needs devices or a decision)**
- TalkBack / VoiceOver passes and a real low-end Android run. These need devices; planned for Phase 9 with the store builds.
- Privacy-friendly counters: a new table, so a new Sheets tab and migration. Proposed for after the release, with the head's go-ahead.
- A staging check on real-shaped data.

## Release — phases 1–8 together, LIVE 9 Oct 2026 14:47 IST (release phase 12)

- **Live builds:**
  - **App:** build `2026.10.09-1445`, `assets/index-DbtPpmAE.js`, Cloudflare version `b9245bdb-433a-46b7-9142-ea6b09e1a839`.
  - **API:** version `0ed946d9-c969-4a56-b4a0-103dbb5014c8`.
  - **D1:** migration `0031_deadline_reminder` applied (one additive row; not copied to Sheets).
- **Full test before release** (gate `checks 12`, source `583589f10e376ace`):
  - browser suite 1,748 / 0;
  - component checks 219 / 0;
  - server 1,747;
  - unit 313;
  - size within budget (startup JS 55.0 KB, 0.02 over its target).
  - The first run had 5 failures, all checks still written for the old design (the Saturday board, the Wall report's timing). They were updated and the whole run repeated green.
- **How it went live:**
  - `sadhanaRecord/` was updated from `sadhanaRecord-revamp/` (164 files; nothing deleted; no other session had changed the live code);
  - the gate opened;
  - migration, then the API, then `npm run release`: an open app moved to the new build by itself and every lazy screen file loaded;
  - 11/11 live smoke checks pass;
  - `robots.txt`, `sitemap.xml`, `motion.css`, `darshan.json` and the manifest's three shortcuts are served.
- **The other session** (prompt-58) held its edits and was told the result.
- **What the release did NOT have** (noted 9 Oct, after release): the roadmap's §5 "full final test" has an automated half and a manual half, and only the automated half ran.
  - **Ran:** server, unit, browser and component suites; the 10-width route sweep; axe; Lighthouse.
  - **Did not run:** the Android and iPhone device runs, TalkBack and VoiceOver, the 10-persona sweep on real-shaped data, and the head's screenshot approval.
  - So phases 1–8 are live on automated checks only. The manual half is item 15 below, first in Phase 9.
- **Carry into Phase 9:**
  - the host serves the public pages at clean addresses (`/privacy`, `/delete-account`; the `.html` names redirect), so `sitemap.xml` should list those;
  - the canonical links and the sitemap address follow the own domain.

## Phase 9 — list so far (asked for after the 9 Oct release)

1. **Sign-in on desktop / big screens** (the head, 9 Oct 2026):
   - **Now:** the painting panel carries a fixed line, "Hare Kṛṣṇa. Your sadhana, steady and simple — every day, with your batch." (`screens/Login.svelte`, `side` snippet).
   - **Change:** show the same verse of the day as the Welcome panel instead, on its readable panel at the painting's foot, with the same quote and reference.
   - The sign-up desktop panel keeps its "What happens next" steps; those are information, not a byline.
2. **`sitemap.xml`:** list the clean addresses the host serves (`/privacy`, `/delete-account`; the `.html` names redirect). Switch the sitemap address and add canonical links when the own domain is chosen.
3. **Device passes:** TalkBack and VoiceOver on the five main flows (sign in, fill a day, submit, approve a sign-up, mark attendance), and a real low-end Android run.
4. **Store builds:** as planned (Play Store web app, iPhone app shell, privacy text, the domain and developer accounts).
5. **Pop-ups and sheets: open and close smoothly, and close every expected way** (the head, 9 Oct 2026).
   - **Seen on the head's phone:** "How to use" closed only from its ✕. Back on the phone did not close it.
   - **Checked in a test browser:** Back and a tap outside do close it there. So the phone-only cause is most likely Chrome's back-button rule: a history entry added without a tap is skipped by the phone's Back. Opened from the menu link (`#/account?f=howto`), the sheet opens on a 50 ms timer, so its Back entry has no tap behind it.
   - **Also:** Chrome 120+ closes modal dialogs on Android Back by itself (CloseWatcher), which can clash with our own history entry (`ui/backclose.js`).
   - **Plan:**
     - use CloseWatcher where the browser has it, and the history entry only where it doesn't;
     - open a sheet only from a tap (never from a timer);
     - an exit animation, so closing is as smooth as opening (`@starting-style` / `transition-behavior: allow-discrete`, and an animated close before `dialog.close()`);
     - check every sheet on a real Android and iPhone: Back, tap outside, Escape, ✕.
6. **Admin menu for the IYF head: open, not folded** (the head, 9 Oct 2026).
   - **Now:** the head's sidebar folds Admin into one "Admin" row.
   - **Change:** list its seven pages directly (All batches · People · Staff · Batch setup · IYF IDs · Activity · Settings), always open, so the head finds them at once. Coordinators, facilitators and devotees keep today's folded menu.
7. **An announcement that keeps notifying** (the head, 9 Oct 2026).
   - **Seen:** after the head posted, the phone kept popping and vibrating with it, even after opening it.
   - **What is known:** the server sends one push per registered phone row per announcement, then closes the job. A local simulation (3, 35 and 40 phones over 6 runs) showed exactly one each.
   - **Every push pops and vibrates again** (`renotify: true` in `public/push-sw.js`). For 30 minutes after a post, `push.message` answers any push to that phone with the announcement's words, so any other push in that half hour repeats it.
   - **Likely causes to check:**
     - (a) several `push_subs` rows for one phone (the app re-registers on each open; old addresses may still be valid), so one post reaches it several times — a read-only count of rows per login on the live database will show it;
     - (b) a reminder, attendance notice or second post inside the same half hour repeating the announcement's words;
     - (c) the push service redelivering when the notification is shown late.
   - **Fixes to make:**
     - one row per phone (drop older rows of the same device and login on register);
     - the phone remembers which announcements it has already shown and never shows one twice;
     - `renotify` only for a new announcement;
     - opening the Wall (or the post) clears that post's notification from the tray;
     - the half-hour window applies only to the push that carried that post.
   - A server test and a phone test for "one post → one notification".
8. **Facilitators post announcements to their own students** (the head, 9 Oct 2026).
   - **Who can post:** a facilitator (a TRD facilitator login, or a youth facilitator through their own devotee login).
   - **Who sees it:** only the devotees whose facilitator they are (any batch), the same people as "My students".
   - **How it works:**
     - the audience is fixed to "My students" (no batch choice);
     - stored as a facilitator audience tag next to the batch ids (as with `FAC_YOUTH` / `FAC_TRD`; no schema change expected);
     - the push goes only to those students' phones.
   - **On the Wall:** the post shows its author and "To: students of Natvar Gopinath Prabhuji" for staff. A devotee sees it like any post.
   - **The head can:** see and remove any facilitator post. Reports and hiding work as for every post.
   - **Facilitators can:** edit or remove only their own posts.
   - **Tests:** a facilitator's post reaches only their students (and their phones); other devotees and other facilitators' students don't see it; coordinators can't use the tag; a facilitator can't post to batches or to everyone.
9. **"Sadhana Record" on one line in the desktop sidebar** (the head, 9 Oct 2026).
   - **Seen:** with Text size "Largest" the name wraps to two lines ("Sadhana / Record"), because the sidebar keeps a fixed width while the text grows 25 %.
   - **Change:** the name never wraps (`white-space: nowrap`). The sidebar grows a little with the text size (a width in rem, capped). The name scales down slightly if it still doesn't fit.
   - Checked at every text size (Default / Larger / Largest) and at 1024–1920 px.
10. **The installed app's title bar repeats the name.**
    - **Seen:** "IYF Delhi Sadhana Record - Home · Sadhana Record". A desktop or Android app window shows the app's name, then the page title, and the page title (added in Phase 8) ends in "· Sadhana Record" too.
    - **Change:** inside the installed app (display-mode standalone) the page title is just the screen ("Home", "Report"). In a browser tab it keeps "Home · Sadhana Record".
11. **Logs are kept for 6 months, then erased; the head can change it in Settings** (the head, 9 Oct 2026).
    - **Which logs:**
      - the Activity log (`audit_log`);
      - the technical log of slow / refused calls (`run_log`);
      - the finished housekeeping rows: done notification jobs (`push_jobs`), copy-to-Sheets queue entries already copied (`mirror_log`), sent attendance notices.
      - Never sadhana, submissions, attendance, accounts or announcements.
    - **Default 6 months.** A new row in Settings, "Keep logs for · 6 months", opens a sheet with 3 · 6 · 12 · 24 months. The change is logged in Activity and can be undone, like the other settings.
    - **The clean-up** runs at night (after 1 AM IST, away from the 9–11 PM rush) in small chunks, so it stays inside the free plan's daily writes. It is safe to run any number of times, and each night notes what it erased in the technical log.
    - **The Sheets copy:** erasing in the database does not erase the rows already copied to Sheets (logs are appended there). Decide whether Sheets keeps the full history (the default) or gets the same 6 months.
    - **Server pieces:**
      - a `log_retention_months` setting (`settings.update` / `settings.get`);
      - the nightly job in the scheduled run;
      - an index on `at` where a log has none (so the clean-up never scans the whole table).
      - Additive migration only.
    - **Tests:** rows older than the limit go, newer ones stay; other tables are untouched; a changed setting takes effect the next night; the chunk size holds; the setting is head-only.
12. **More paintings of the Lord from the shared Drive folder and its subfolders** (the head, 9 Oct 2026).
    - **The folder:** `1gdnabKpZL6nVvbTRWifR1aKJ-SmS7daL`. On 9 Oct the connector saw one subfolder, "Vishnu arts" (`1jFX7R2Qp_HqZyteln62VqMtkjaQNOXOI`, owner strangerkanu21@gmail.com), but listed no images inside it. Either it is empty, or its files are not shared with this account. Before Phase 9: confirm it holds the images, and share the folder (with its contents) with the account that builds the app, or put a copy in IYF's own Drive.
    - **Source on this Mac (the head downloaded them, 9 Oct 2026):** `~/Downloads/Ramndom Hd pics/`. 112 images (81 JPG, 31 PNG), 416 MB, mostly 2160 × 2700 or 1080 × 1350 portrait:
      - 36 at the top level;
      - `Radha rani/` 17;
      - `Vishnu arts/` 59.
      - Use these; the Drive folder is no longer needed.
    - **Same pipeline as the first 18 paintings (8 Oct):**
      - every image from the folder and all its subfolders;
      - drop duplicates and any that are too small or not of the Lord;
      - for each: a title, the deity and the pastime (for the alt text);
      - the focal point (the face, so phone crops keep it);
      - its dominant colour;
      - sizes 480 / 960 (/ 1440 for the large ones) as WebP, plus a 960 JPEG;
      - the 480 px file at most 45 KB.
      - Added to `public/darshan/darshan.json`, marked flagship or everyday.
    - **No change to how they load:** they stay out of the install (fetched only when shown, at most 6 a visit, kept 30 days), so more paintings cost no extra data. The rotation simply has more to choose from.
    - **Rights:** IYF holds the rights (the head, 8 Oct 2026); no credit line.
    - **Watermarks (the head, 9 Oct 2026: "remove the watermark of Goloka Arts or ISKCON Arts if found"):**
      - Go through all 112 and list the ones with a mark.
      - Where the mark sits at an edge or corner, crop it out (keeping the face as the focal point). This is the first choice; it changes no part of the painting.
      - Retouch (fill in the mark) only where IYF's licence from the rights holder allows editing the work. On 8 Oct the head said IYF holds the rights; confirm the licence covers removing the artist's / publisher's mark, or get clean originals from them.
      - Any image that can neither be cropped clean nor is covered stays out of the rotation, listed for the head.
    - **Sharp on every screen, fitted to the device:**
      - sizes 480 / 960 / 1440 / 2160 (the large ones only from originals that big), so phones, high-DPI laptops and 4K screens each get a sharp file and never more than they need;
      - `sizes` per place (Welcome hero, the desktop panel, the Home card), so the browser picks the right one;
      - framed on the focal point for every shape (portrait phone, tall desktop panel, 3:2 card);
      - WebP (plus AVIF where it saves more), and a JPEG for old browsers.
    - **Never empty:**
      - each painting carries a tiny blurred preview (~1 KB, inside `darshan.json`) under its dominant colour, so a frame always shows something from the first moment;
      - the small file paints next, then the sharp one, in the same place (as on Welcome since Phase 8);
      - a file that fails to load is retried once, then the next painting is shown;
      - with no connection, the last paintings seen (kept 30 days) are used, else the colour panel with the verse.
      - A browser check fails if any darshan frame is ever blank or shows a broken image.
13. **Sign-up: the address easy to fill, part by part** (the head, 9 Oct 2026).
    - **Now:** one "House and street" box, then area, district / city, state, PIN (`ui/AddressFields.svelte`; the address stays required).
    - **Change:** short, labelled boxes in the order people know them:
      - **House / flat no.** (e.g. "B-12, 2nd floor")
      - **Street / gali / road** (e.g. "Gali no. 3")
      - **Area / locality / colony**
      - **Landmark** (optional)
      - **PIN code**
      - **State**
      - **District** (Delhi: from the list; elsewhere: city or town)
    - **Easier filling:**
      - an example inside each box;
      - the phone's autofill (`address-line1` / `address-line2` / `address-level3` / `postal-code`);
      - a number keypad for the PIN;
      - the PIN fills the state (and the district inside Delhi) from a small built-in table — no outside service, as the performance contract requires;
      - each box checked as the person goes, with a plain message.
    - **Storing it:** the parts are kept as they are, and the one-line address staff see ("B-12, 2nd floor, Gali no. 3, Punjabi Bagh, West Delhi, Delhi 110026") is built from them. Existing addresses stay as they are; a person edits theirs in Account the same way.
    - **The Sheets copy:** new address columns go at the end of the Profiles tab (additive; the tab is built before the migration).
    - **Tests:** sign-up, Account edit and the staff view at 320–1280 px; the old one-box addresses still show.
14. **The IYF head can create a new IYF ID while approving a sign-up** (the head, 9 Oct 2026).
    - **Now:** when nobody in the registry matches, the sign-up is approved "with no ID yet". It is linked once the dashboard registers them (`requests.approve`, `link: { noIdYet }`).
    - **Change:** a third choice for the IYF head only — **"Create a new IYF ID"**:
      - on the Requests card when approving, and on the devotee's page / IYF IDs for someone with no ID;
      - never for coordinators or any other role, never anywhere else (server-checked, head only);
      - it shows the new ID before confirming, and the creation is logged in Activity.
    - **To decide before building** (the registry's source of truth is the facilitator dashboard, which this app only reads):
      - (a) **The format:** the dashboard's own (e.g. `KT26-0421`, the next free number) or a separate app series (e.g. `SR26-0001`), so the two can never hand out the same number.
      - (b) **How the dashboard learns it:** IYF adds it there by hand from a list the app shows, or the dashboard bridge (deferred) writes it.
      - (c) **When the dashboard later registers the same person** under its own ID: which one wins.
    - **Safety:**
      - before creating, the app checks the number against the whole registry copy and every ID already given in the app;
      - two heads creating at once can never get the same ID (one atomic step on the server);
      - the "possible duplicates" review covers app-created IDs too.
15. **The full final test, both halves, on the live app** (the head, 9 Oct 2026: "add the full testing as well in phase 9").
    - **Devices:**
      - an Android emulator (Chrome, and the installed app) and the iPhone simulator (iOS 18 and 17), using `tools/devices/`;
      - one real low-end Android phone.
      - The five main flows on each: sign in, fill a day, submit a week, approve a sign-up, mark attendance. Plus Back / tap outside / ✕ on every sheet, the bottom bar, swipes, notifications and the text sizes.
    - **Screen readers:** TalkBack and VoiceOver on the same five flows. Results recorded in `docs/` (what was announced, what was missing).
    - **The 10-persona route sweep:** every route for every kind of login (devotee, group leader, facilitator TRD / youth, coordinator of one / several batches, IYF head, head + devotee, pending, rejected), at 4 sizes, light and dark. Run against real-shaped data (a copy of the live shape, never live writes), not just the test data.
    - **Screenshots for the head's approval:** each main screen, phone and desktop, light and dark.
    - **Then the automated gate again** on the Phase 9 source, and once more on the store builds.

16. **Reviewer demo data on a test copy** (moved from Phase 0; prompt-58's audit list, 9 Oct 2026).
    - Apple (and Google) review needs a working login.
    - A test copy of the API and database (never the live one) with demo accounts: a devotee with filled weeks, a coordinator with a batch, and a pending sign-up. Realistic but made-up names, no real phones.
    - Logins and steps go in the store review notes. Reset by a script before each submission.
17. **User testing: 5 devotees and 2 coordinators** (prompt-58's audit list; the roadmap wanted it before Phase 4 shipped; it didn't happen).
    - Phases 1–8 went live with no user testing, so this is the highest-value check left.
    - **IYF picks the people;** the app side prepares a short script for each role:
      - devotees: sign in, fill today, fill a missed day, submit the week, find the report, read the Wall;
      - coordinators: approve a sign-up, mark attendance, fill for a devotee, find someone who hasn't started.
    - **Plus** a one-page observation sheet (where they hesitated, what they said, what failed) and a short form for their own words.
    - The findings come back as fixes ranked by how many people hit them.
18. **How far an announcement reached** (prompt-58's audit list; asked by the head earlier).
    - **Now:** `push_jobs` records how many pushes were sent, but nothing shows it against how many phones could get it.
    - **Change:** on each of the head's posts (and in its "What changed" view), a line such as "Notifications: sent to 412 of 430 phones · 6 no longer reachable · 12 failed".
    - Built from what `push_jobs` and the delivery step already know (count failed and gone per job), plus the number of phones in the audience when it was sent.
    - No new data about people; one additive column or two on `push_jobs`. The Sheets copy gets the same columns at the end of its tab, if `push_jobs` is copied.
19. **A mass-write allow-list for the database audits** (prompt-58's audit §5.2, 9 Oct 2026).
    - Today's audits list 18 of 204 write statements as "mass" and 18 of 500 as scanning a growing table. Most are legitimate:
      - account erasure;
      - rare rename / reassign cascades;
      - week-bounded clean-ups.
    - But nothing records which are approved, so a new one wouldn't stand out.
    - **Change:** a checked-in allow-list, one line of justification per statement. The audits then fail only on a statement that is new (or changed), which turns two noisy reports into real gates.

20. **"Why it works this way": a document for the team** (the head, 9 Oct 2026).
    - Every feature kept as it is, with the reason, in plain words, so a new team member or developer doesn't "fix" a rule on purpose. For example:
      - explicit Save;
      - the Monday 9 PM deadline and part weeks (complete days count);
      - attendance precedence (head > coordinator > group leader > devotee);
      - pick-from-lists, never typed;
      - no ID documents, the phone as identity;
      - the address required;
      - one release at the end;
      - the free-plan limits;
      - the Sheets copy of every table;
      - why coordinators see only the open week;
      - why the facilitator view is read-only;
      - why images are never in the install;
      - why there are no pause buttons on the paintings and verses.
    - `docs/revamp/WHY_IT_WORKS_THIS_WAY.md` and a PDF.
21. **Exports for coordinators and the IYF head** (the head, 9 Oct 2026).
    - **Sadhana of a batch for a date range** (e.g. SPS, 1 Sep – 31 Oct): one row per devotee per week (status, days filled, the scores, attendance and who marked it). Optionally one row per day (sleep, wake-up, rounds, day rest, hearing, reading, service, the day's score).
    - **Lists:**
      - the batch's devotees (name, IYF ID, phone, WhatsApp, email, class day, facilitator, group leader, status, since);
      - group leaders and their groups;
      - missed weeks;
      - attendance by week;
      - (head) coordinators, facilitators, all batches, the Activity log for a range.
    - **Where:** an "Export" button on Batch status, Devotees, Group leaders and Filling chart (coordinators), and on All batches / People / Staff / Activity (the head). It opens one sheet: what, which batch(es), from–to, the format.
    - **Format:** CSV (opens in Excel and Google Sheets; Hindi / diacritics kept, UTF-8 with BOM), and an Excel `.xlsx` if it fits without a heavy library.
    - **Rules:**
      - a coordinator exports only their own batches, the head any batch (server-checked);
      - each export is logged in Activity (who, what, which range);
      - personal details (address, emergency contact, date of birth, blood group) only on the head's export, and only when ticked;
      - the range is capped (e.g. 6 months at a time) and exports are rate-limited, to stay inside the free plan's daily reads;
      - built on the server in pages, never one huge query.
    - **The Sheets copy:** the head already has every table in Google Sheets; the export is for a quick, filtered file without opening those.
    - **Tests:** the right rows and columns for each export; a coordinator refused for another batch; the cap and rate limit; the file opens in Excel / Sheets with names intact.

22. **A display standard for the paintings and verses** (the head, 9 Oct 2026). Written for approval: `docs/revamp/DARSHAN_AND_VERSE_STANDARD.md`. It covers:
    - where they appear and in what shape;
    - files and sharpness for every screen;
    - how a painting is chosen (14-day no-repeat);
    - the readable pace: paintings 20 s instead of 9 s, verses 10–30 s by length, never both changing at once;
    - long verses under the painting on phones;
    - the intake rules for new paintings;
    - the constraints.
    - Built once approved, with item 12.

23. **Scheduled announcements: when a post appears, and for how long** (the head, 9 Oct 2026).
    - **Who:** anyone who may post, each within their own audience:
      - the IYF head: everyone, batches, youth / TRD facilitators;
      - a coordinator: their own batches (e.g. the SPS coordinator to SPS);
      - a facilitator: their students (item 8).
    - **In the post form:**
      - **"Show from"**: now (default) or a date and time (Indian time, wheels as elsewhere);
      - **"Show for"**: until removed (default), or a length (30 min · 1 h · 3 h · 1 day · 3 days · 1 week · custom), or until a date and time.
      - Today's "ends on a date" becomes this.
    - **Until it starts:**
      - only its author (and the head) sees it, under "Scheduled" at the top of the Wall, with Edit, "Post now" and Delete;
      - devotees don't see it and no notification goes out.
    - **At the start time:** it appears on the Wall for its audience, and its notification goes out then (not when it was written). The 9–11 PM reminder rush keeps priority, as today.
    - **At the end:** it leaves the Wall (it is kept, marked ended, for the record and the Sheets copy).
    - **Rules:**
      - a start time at most 60 days ahead;
      - a length at most 90 days;
      - editing a scheduled post moves its notification with it;
      - a removed or ended post never notifies;
      - times are checked on the server (never trusting the phone's clock).
    - **Server:**
      - a `publish_at` column on announcements (additive; `expires_at` gains a time);
      - the notification job waits for `publish_at`;
      - the Wall list hides not-yet-started posts from everyone but their author and the head.
      - The Sheets copy gets `publish_at` at the end of the Announcements tab (built before the migration).
    - **Tests:**
      - nothing visible or sent before the start;
      - visible and sent at the start, to that audience only;
      - gone at the end;
      - a coordinator can schedule only for their own batches;
      - an edit moves the time;
      - "Post now" works.

24. **Appoint an IYF head directly — release-blocking** (the user, 9 Oct 2026, night, via prompt-58 and here).
    - **Why:** today a person becomes head only by being promoted from staff, or the fixed recovery login. A new head from outside IYF Delhi (e.g. someone from South India coming to lead) has no coordination history, and the workaround wrote a false "coordinators.create" line into the permanent Activity trail.
    - **The user's decisions:** a reason is required; the new head is staff-only — no sadhana ("above the system"); and **every active IYF head at the time must approve** before the new head exists (asked 9 Oct, night: "approval from all the available heads … required for him to be successfully registered").
    - In the one Phase 9 release, before the store.

**Already on the list (prompt-58's items that match):**
- TalkBack / VoiceOver, the real low-end Android run and the 10-persona sweep on the store builds → item 15 (and item 3).
- `audit_log` / `run_log` retention → item 11. The head decided on 9 Oct: 6 months, changeable in Settings. Open question: whether the Sheets copy is trimmed too.

**Proposed order for Phase 9 (to agree with the head)**
- **A — first, because devotees use the app today:**
  - item 15's device and screen-reader runs on the live app;
  - item 17 (user testing; IYF arranges the 7 people);
  - item 5 (sheets closing with the phone's Back);
  - item 7 (the repeating announcement notification).
  - Then the small fixes:
    - item 6 (the head's admin menu open);
    - item 9 (the name on one line);
    - item 10 (the title bar);
    - item 1 (the verse on the desktop sign-in);
    - item 2 (sitemap).
  - Full gate, release.
- **B — new features:**
  - item 8 (facilitator announcements);
  - item 11 (log retention);
  - item 18 (announcement reach);
  - item 19 (the audit allow-list);
  - item 22 (the display standard, once approved) with item 12 (the 112 paintings);
  - item 13 (the address parts);
  - item 14 (creating IYF IDs, after the three decisions);
  - item 21 (exports);
  - item 23 (scheduled announcements, with item 8);
  - item 20 (the "why" document, for the team).
  - Full gate, release.
- **C — the store:** item 4 (the store builds) and item 16 (reviewer demo data), with item 3 / 15's device and screen-reader passes and the persona sweep repeated on the store builds.

**The head's answers (9 Oct 2026, evening)**
- **Item 11 — logs:** the Google Sheets copy is trimmed too: the same 6 months (or whatever Settings says).
  - Old rows are deleted from the Activity and technical-log tabs only, in small batches at night, never from any other tab.
  - This is a deliberate exception to "Sheets changes are additive", for log rows only; the tabs and columns stay.
- **Item 14 — IYF IDs:**
  - A person who already has a dashboard ID keeps it; the app never replaces it.
  - A new ID is created only when the person has none, and only by the IYF head (admin), nowhere else.
  - **Defaults I will use unless the head says otherwise:**
    - **Format:** a separate app series, **`SR26-0001`, `SR26-0002`, …** (year-based). It can never collide with the dashboard's own `KT26-…` numbers, which the dashboard keeps handing out on its own.
    - **How the dashboard learns it:** the IYF IDs page gets a list "Created in the app — add these to the dashboard", with an export (item 21). The app never writes to the dashboard.
    - **Which wins:** the dashboard ID. When the registry copy later shows a dashboard ID for the same person (matched by phone and name, reviewed by the head like a possible duplicate), the app links the dashboard ID and retires the `SR` ID (kept in history and Activity).
- **Item 12 — watermarks:** touching up is allowed, using an AI smart-erase tool, only where the result keeps the full quality.
  - Each touched-up painting is compared before / after at full size, and any with a visible trace or blur is left out.
  - Crop first when the mark is at an edge.
- **Item 17 — user testing:** the people are chosen later. The scripts and observation sheet are prepared meanwhile.
- **Item 22 — the display standard:** approved as written (`DARSHAN_AND_VERSE_STANDARD.md`).

## Phase 9 — Stage A, built so far (9 Oct 2026, in `sadhanaRecord-revamp/`, not released yet)

- **Item 6:** the IYF head's sidebar always lists the seven Admin pages.
- **Item 5:** "How to use" opens straight from the tap, over the current screen (the menu row is a button now; the `?` key too). The phone's Back and a tap outside close it, on phone and desktop. Cause found: opened a moment later on another screen, its Back step was skipped by Chrome. `#/account?f=howto` links still work.
- **Item 7, the repeating announcement:**
  - the server gives a post's words once (cleared as served);
  - the phone shows an announcement it has already shown only quietly (no pop-up or vibration);
  - opening the Wall clears its notifications from the tray.
  - Server test added.
- **Items 9, 10, 1, 2:**
  - "Sadhana Record" on one line at every text size;
  - the installed app's title bar shows just the screen;
  - the desktop sign-in panel shows the verse of the day;
  - the sitemap lists the clean addresses.
- **Item 22, the pace** (approved standard):
  - paintings 20 s with a 1.2 s cross-fade (were 9 s);
  - verses stay 6 s + 0.4 s a word, 10–30 s (were a fixed 9 s), shown by their progress line;
  - a painting and a verse never change within 4 s of each other (`lib/pace.js`);
  - Welcome and sign-in use a verse of at most 240 characters.
- **The byline** (the head, 9 Oct 2026):
  - **One line per screen, never two together:**
    - Welcome and the splash: "Every Day, A Step Closer to Kṛṣṇa.";
    - Sign in: "Steady in sādhana, growing in bhakti.";
    - Create account: "Begin your journey of devotional service.";
    - Forgot / change password: none.
  - **Understated:** serif italic, regular weight, 15–16 px, the secondary text colour; no bold, no blue, no badge. One shared rule (`.by-tag`, `.byline` in `styles/auth.css`); `Plain.svelte` takes a `byline` prop.
  - "Hare Kṛṣṇa 🙏", the old lines ("Fill your daily sadhana…", "Hare Kṛṣṇa · your sadhana, steady and simple") and a second practices line were removed at the head's request.
  - The Bhagavad-gītā verse on the Welcome painting is unchanged.
  - The app and link-preview descriptions read "Every Day, A Step Closer to Kṛṣṇa. Track your spiritual practices, build consistency and grow in bhakti."
- **Splash = Welcome** (the head, 9 Oct 2026):
  - The splash is the static block in `index.html` (styles in `app.css`; `App.svelte` fades it out). It is kept, with its gold progress line, its 1.4 s minimum and its 420 ms fade; reduced motion has no animation.
  - **The name is shown as "Sādhana Record"** on the splash, Welcome, the sign-in / sign-up header and the in-app brand (sidebar, drawer, phone Home title). Page titles, the home-screen label, the manifest and the search descriptions keep "Sadhana", which is how people type it.
  - The splash tagline now has the Welcome tagline's size and weight (16 px, regular): the two read as one product.
  - Checked in the running app: phone and desktop, light and dark, the hand-over frame (a plain cross-fade, nothing jumps), and reduced motion.
- **Forgot password:** the note is one short secondary line before the fields — "Choose a new password. It starts working once your coordinator approves it (for staff, the IYF head). Until then, keep using your old one."
- **Item 17, prepared:** `docs/revamp/USER_TESTING.md` / `.pdf`, for the person who runs the sessions: the setup, 8 devotee tasks and 7 coordinator tasks read aloud (no button names), an observation sheet, four closing questions, and how findings come back (ranked by how many people hit them). The sessions run whenever IYF has chosen the 5 devotees and 2 coordinators.
- **Stage A is complete** except the device and screen-reader runs, which are part of the full end-to-end test before the release.
- **Merged from prompt-58 (9 Oct 2026, night):** it built a separate web release ("phase 13") in `sadhanaRecord/` and held it when the trees were found to have diverged. Its work is now in `sadhanaRecord-revamp/` and ships in the one Phase 9 release:
  - verses 46 → 78 (word for word from vedabase.io; none over 430 characters; 6 missing references skipped, not guessed); the book labels for Brahma-saṁhitā, Nectar of Devotion and Śrī Īśopaniṣad; the short pool for Welcome / sign-in is 49 verses;
  - every sheet opens with its animation again (`@starting-style` moved inside the layer), with a Reduce Motion branch;
  - wheel pickers: a tap on a row chooses and closes (the time picker stays open for minutes and AM/PM);
  - the ± minute buttons removed from the five duration fields of the day form;
  - the signed-out verse styled as a printed page (no mark over a painting); the Welcome footer "Your coordinator approves new accounts".
  - `sadhanaRecord/` stays frozen until the release; production is still release phase 12.

- **Tests so far:**
  - server 1,749;
  - unit 316 (new `pace9.test.js`);
  - browser checks: devotee 226 (the verse carousel now waits for each verse's own time), nav 102, welcome 31 (the splash's name and tagline), oct9 8 (the sign-in verse, the Forgot note), rules 56, logins 692.
- **Order changed (the head, 9 Oct 2026, night):** no separate Stage A release. Everything for the web goes out together; the walkthrough video moves to just before the store:
  1. **Stage B, the web features** (items 8 + 23, 18, 11, 19, 12 + the rest of 22, 13, 14, 21, 20), built in `sadhanaRecord-revamp/` on top of the Stage A fixes.
  - **The head, 9 Oct 2026 (confirmed):** "complete A, then B, then release, then videos; in the end, after the videos, we will calmly talk about the Play Store releases". And: "before releasing the app run the complete end-to-end 100% test… QA testing and everything is passed, only then the app is released — a finished product, not half-baked."
  - **Release rule from this:** the web release happens only when every check passes with nothing waived: server and unit tests, every browser-check part, the end-to-end flows of every role (sign up → approve → fill → submit → board → reports → announcements → admin), the device and screen-reader runs, the persona sweep, Lighthouse and axe, and screenshots of every changed screen. Any failure is fixed and the whole run repeated.
  2. **The full test, then ONE web release:** the device and screen-reader runs (items 3 and 15: TalkBack, VoiceOver, a low-end Android) are part of the full test, so they come before this release; then the full gate; then Stage A and Stage B go live together.
  3. **After the release, before the store builds and decisions:** the walkthrough video (every route, male Indian English voice, test data), made on the released app (the head, 9 Oct 2026: "videos you can make after the release, before the store builds").
  - **User testing (item 17)** does not hold anything up: the scripts and observation sheet are ready with the release, and it runs whenever IYF has chosen the 5 devotees and 2 coordinators.
  4. **Stage C, the store:** item 4 (Play Store and App Store builds) and item 16 (reviewer demo data), with the device and persona checks repeated on the store builds.
  - (startup JS: 55.13 KB, inside the 60 KB budget; the 55 target is watched, not a blocker — new Stage B screens load only when opened.)

## Phase 9 — Stage B, built so far (9 Oct 2026, in `sadhanaRecord-revamp/`, not released)

- **Item 8 — facilitators post to their students:**
  - a facilitator (a TRD login, or a youth facilitator through their devotee login) has "Post to my students"; the audience is fixed and shown as one line ("To your students — the devotees whose facilitator you are, in every batch");
  - stored as `STU:<facilitator name>` beside batch ids (no schema change); seen by the devotees whose open membership has that facilitator, any batch, and by the author and the head; the push reaches only those students' phones;
  - staff see "Students of Natvar Gopinath Prabhuji" on the post, its author "Your students";
  - refused: a facilitator posting to a batch, to everyone or to another facilitator's students; a coordinator or the head using the tag; a plain devotee posting. The author edits or removes; the head removes any.
  - A coordinator who is also a facilitator chooses "My batch" or "My students".
- **Item 23 — scheduled posts:**
  - the form has **Show from** (Now / Later: a day and a time on the wheels, Indian time) and **Show for** (Until removed, 30 minutes, 1 hour, 3 hours, 1 day, 3 days, 1 week, or until a day and time); the button says Schedule;
  - until it starts, only its author and the head see it, under **Scheduled** at the top of the Wall, with Edit, Post now and Delete; no notification, no badge, no likes or comments;
  - at its start it appears for its audience and its notification goes out then (the 9 PM reminder rush keeps priority); at its end it leaves the wall and is kept;
  - rules, checked on the server's clock: a start at most 60 days ahead (a past start = now), an end after the start and at most 90 days after it (checked only when the times change); a post already shown cannot be scheduled again; a removed post never notifies (its job is closed).
  - Server: migration `0032_scheduled_posts.sql` (`announcements.publish_at`, additive); the Sheets column `publish_at` at the end of Announcements (`setup/schema.mjs`; build it before the migration).
  - The bell, the menu badge and the devotee Home card count a post from when it appears.
- **Item 18 — how far a post reached:** the notification job counts the phones it tried, those that took it, those gone (the browser said the address no longer exists, or 7 failures in a row) and those that failed this time, and when it finished (migration `0033_post_reach.sql`, additive; an index on `push_jobs.ann_id`). The post's author and the head see one line under it: "Notifications reached 412 of 430 phones · 6 no longer reachable · 12 failed" (while sending: "going out · 70 so far"). Devotees and other staff don't. `push_jobs` is not copied to Sheets (an internal queue, like the phone list).
- **Item 11 — logs kept for a set time:** `worker/src/retention.js`.
  - Settings has **Keep logs for** (3 · 6 · 12 · 24 months, default 6), logged and undoable like the other settings.
  - Between 01:00 and 02:00 IST, four runs a night erase at most 500 rows each of `audit_log` and `run_log` older than the period, and finished notification jobs. The oldest row (by id) is looked at first, so nothing more is read when there is nothing to do; no index needed. A row not yet copied to Sheets is never erased. Each night notes what it erased in the technical log.
  - The Sheets copy: once a night, the oldest rows of the AuditLog and RunLog tabs older than the period are deleted from the top (at most 1,000 a tab). Deleting from the top keeps the copy's appends and a deletion's row rewrites lined up. The agreed exception to additive-only, for these log rows only.
  - Never sadhana, submissions, attendance, accounts or announcements.
- **Item 19 — the audit allow-list:** `worker/tests/audit-allow.mjs` lists every approved scan and bulk write with a one-line reason (32 entries). Both audits now print only what is new and fail on it. `npm run audit:sql` runs the server suites and both audits; the release gate (`gate.mjs checks`) now runs it too, and its source fingerprint covers `worker/src`, `migrations` and `tests`. It caught two new scans from the exports on its first day (approved: rare, head only).
- **Item 20 — "Why it works this way":** `docs/revamp/WHY_IT_WORKS_THIS_WAY.md` / `.pdf`, for the team: each rule kept on purpose with its recorded reason, who decided and when; where no reason was ever written down it says so ("ask the head before changing"). Two open questions are listed at the end.
- **Item 21 — exports (done, server and screens):** the head asked (9 Oct 2026, night) for "professional selection ways by which any data can be fetched from the sadhana to profile perspective". So an export is built, not picked from a fixed list:
  - **rows:** one per devotee, per devotee per week, or per devotee per day (the head also: staff, batches, the Activity log);
  - **fields, ticked one by one in groups:** Person, Contact, Membership, Personal (the head only), Week scores, Week totals, Attendance, Day answers, Day marks, and a **Sadhana summary** of the range per devotee (weeks submitted / missed, days filled, average overall / body / soul / japa / rounds, classes present / absent) — so one file can hold profile details beside sadhana;
  - **filters:** batches, dates (at most 6 months), the week's status, a facilitator;
  - `exports.catalog` says what the person may choose; `exports.page` sends only the chosen fields, a page at a time (a week of the batches, or a batch); one Activity line per export (rows, fields, batches, range, filters, personal); 20 an hour.
- **Item 14 — IYF IDs created in the app (done, server and screens):** the head only; the series `SR26-0001…` (the number is the new row's own id, so two at once never clash; never reused).
  - **ids.create** for an approved devotee with no ID; **requests.approve** with `link: { createId: true }` approves and creates in one step (a coordinator is refused); **ids.nextApp** shows the next ID before confirming.
  - **ids.appList**: the IDs created in the app, newest first, with a possible dashboard match by phone — to add them to the dashboard by hand (the app never writes to it).
  - **The dashboard's ID wins:** linking the dashboard ID (ids.link) retires the app ID (kept, with what replaced it); unlinking retires it too.
  - Migration `0034_app_ids.sql`; copied to the Access file's new **AppIds** tab (build it before the migration). Activity names the new ID (`ids.create`).
- **Item 24 — a new IYF head (done, server and screens):**
  - **Add staff** (`coordinators.create`) gains `master: true` + a required reason: role MASTER, head access, no batches, no sadhana, a temporary password changed at first sign-in.
  - **Every other active head approves:** with other heads, it becomes a request (`head_requests`, migration `0035`; the temporary password kept only as a hash, cleared once used); the account is made at the last approval. Alone, it takes effect at once. The recovery login is never asked (an emergency key, not a person).
  - **Promoting a staff login to head** (`masters.set`) goes through the same approval, so creating a coordinator and promoting them can't skip it. Removing head access is unchanged.
  - One "no" (with a short reason) turns it down; the head who asked can withdraw it, never approve it; an open request lapses after 14 days. `heads.requests` / `heads.decide` / `heads.withdraw`.
  - Activity tells it as it happened: `masters.request`, `masters.approve`, `masters.decline`, `masters.withdraw`, then `masters.create` (or `masters.set`) with the reason and who approved — never `coordinators.create`.
  - Copied to the Access file's new **HeadRequests** tab, without the password hash (build it before the migration).
- **The screens (9 Oct 2026, night):**
  - **Export** (`ui/ExportSheet.svelte`, loaded only when pressed; `ui/ExportButton.svelte`): on the coordinator's batch tools (Status and Filling chart start from Weekly scores, Devotees and Group leaders from the Contact list) and the head's Admin pages (All batches: Progress summary; People: Contact list; Staff: the staff list; Batch setup: all batches; Activity: the Activity log). One sheet: **Start from** (Weekly scores · Daily details · Progress summary · Contact list · Attendance register · Missed weeks), **Each row is one…** Devotee / Week / Day (the head: or the staff list, batches, Activity), **Batches**, **Dates** (This week · Last 4 weeks · This month · Last month · Last 3 months · Choose dates), **Fields** in groups with All / None (Personal marked "IYF head only · noted in Activity"), **Filters** (weeks submitted / missed; a facilitator), and **Download CSV** pinned at the foot with "Getting week 3 of 9…". The file is UTF-8 with a byte-order mark and CRLF (opens cleanly in Excel and Sheets; a cell starting = + - @ is quoted so it never runs as a formula), named like `IYF-SPS-Progress-summary-2026-10-01-to-2026-10-09.csv`; the choices are remembered on the phone. The field list is one shared file (`shared/exportfields.js`) used by the server, the screen and the dev mock; a server test checks every field has a value.
  - **Add staff** (Admin › Staff): Role Coordinator / IYF head; a head gets "Why they are being appointed" (required) instead of batches, and the button says **Ask for approval**. **Waiting for approval** at the top of Staff lists each request with who approved and who is still asked; the asked heads Approve or Decline… (with a reason); the asker can Withdraw. The asked heads see "1 new IYF head to approve" on Home and in the Requests count.
  - **Create a new IYF ID**: a third choice on a sign-up card for the IYF head only, showing the ID they will get; **IYF IDs › Created here** lists the app-made IDs (Download the list, for the dashboard), "Use KT26-0421" when the dashboard has the person, and a small form to create one for an approved devotee with no ID.
  - **The address in parts** (`ui/AddressFields.svelte`, sign-up and Account): House / flat no. · Street / gali / road (optional) · Area / locality / colony · Landmark (optional) · PIN code · State · District (Delhi) or City; each with an example, the phone's autofill, a number pad for the PIN; the PIN fills the state when only one state has it (79… is shared by several north-eastern states, so it isn't guessed); a PIN not in the chosen state is said at once; an older one-line address is split at its first comma for editing and an empty state is filled from its PIN. A district for a Delhi PIN is not guessed (PINs cross district lines and there is no verified table): it is chosen from the list. Server: migration `0036_address_parts.sql` (three columns at the end of Profiles), the older shape still accepted.
  - Activity reads every new action as a sentence ("appointed as IYF head", "created an IYF ID for … · new ID SR26-0001", "exported · a row per week, 15 fields, 2026-10-01 to 2026-10-31"), with IYF heads and Exports as filter chips.
- **Item 12 + the rest of item 22 — the paintings (9 Oct 2026, night):**
  - **Reviewed all 111** pictures from `Downloads/Ramndom Hd pics` (contact sheets, then each candidate at full size): size, near-duplicates (a perceptual hash: 6 pairs within the set, 1 already in the app), marks, subject.
  - **What the review found:**
    - most of the ISKCON Arts paintings carry, besides the corner logo, a **faint "ISKCON ARTS" watermark across the middle** of the painting (or a small "iskcon_arts" text inside it) — no crop can remove it, and no AI smart-erase tool is available here, so by the approved rule (crop a mark at an edge; retouch only without any loss; otherwise leave it out) these are **left out for now**;
    - the **"Radha rani" folder (#36–52) is by other artists** (signed "Shyama Ramani", a "fine art america" mark, "Gandharv"), five under 1080 px: left out unless IYF confirms it holds the rights (the standard: IYF's own collection);
    - a few scenes don't suit a daily darshan card (Narasimha with blood, the unborn child, battle scenes): left out by the dignity rule.
  - **Added: 19 paintings** whose only mark is the corner logo (cropped off; every corner checked at full size): #12, 21, 60, 61, 79, 80, 81, 83, 84, 85, 86, 88, 89, 90, 91, 93, 104, 110, 111 (ids `v012` …), each with a title, deity, pastime, focal point and average colour. #103 was dropped (no file fits the size limits without visible loss), #102 (the same scene as #111, smaller).
  - **The standard's files:** WebP at 480 / 960 / 1440 / 2160 (up to the original's width), **AVIF** where it is 20 %+ smaller (every new painting), a JPEG at 960, a **~250-byte blurred preview** in `darshan.json`; every file within the limits (480 ≤ 45 KB, 960 ≤ 120 KB, 1440 ≤ 220 KB, 2160 ≤ 400 KB; two older 960s re-encoded to fit). A few very detailed paintings needed WebP quality 20–25 to fit; compared with the original at 1:1 they stay clean.
  - **37 paintings** now (18 before); **15 large ones for Welcome and sign-in** (≥ 14, so no painting opens the day twice within 14 days — a unit test checks 60 days of both pools).
  - **In the app:** the browser takes AVIF when it decodes it (checked once, so a painting is never fetched twice), else WebP; a 3× phone gets the 1440 file, a laptop panel the 960; the blurred preview shows behind the first painting while it loads; the order is spread so **the same family of deity (every Vishnu form, Krishna, Lord Caitanya) never comes twice in a row**, including from the last back to the first. `darshan.json` is saved compact (15 KB, 5 KB over the network).
  - **To grow the set:** the ~55 watermarked ISKCON Arts paintings can be added the same way once cleaned with a smart-erase tool (Photoshop Generative Fill, Google Photos Magic Eraser, Canva Magic Eraser) and checked side by side — the scripts are ready (inventory, crop, build).
- **The head's answers on the paintings (9 Oct 2026, late night) — these replace the first pass above:**
  - **Scenes:** battles, Narasimha and the unborn child are fine ("no problem").
  - **The "Radha rani" set:** use it (IYF holds the rights).
  - **Watermarks:** erase them if a tool can; if not, **show the painting with the mark** ("no issue with that"; "adjustable later").
  - **No cropping, no editing that touches the painting:** "cropping or any tooling effect shouldn't affect the persona which the image is presenting"; "don't crop". So every painting is built from its untouched original, the corner logos included; the 20 built earlier with a bottom crop are rebuilt uncropped (some crops reached the Lord's dhoti or feet, or Lord Shiva's seat).
  - **Left out only as true duplicates of the same painting:** #50 (= #45), #52 (= #48), #73 (already in the app), #76 (= #4), #77 (= #60), #95 (= #92), #102 (= #111), #87 (a near copy of #86), #57 (a skewed copy of the scene in #97), #70 (= #101).
  - **The darshan card on Home shows only the painting and its words** (the head, 9 Oct 2026): no "Today's darshan" or "Darshan" line above the title.
- **The paintings, as built (9 Oct 2026, late night):** **119** in all — the 18 from 8 Oct and **101 from the HD collection, every one from its untouched original** (nothing cropped or retouched; logos and faint marks stay, adjustable later), the Radha rani set included; only the true duplicates listed above are left out. **17** are large enough for Welcome and sign-in.
  - Six very detailed paintings (#42, 43, 47, 90, 103, 104) fit no size limit at an acceptable quality: they may take up to 40 % more (marked `detailed`; the head wants every painting in). A painting narrower than 960 px (some of the Radha rani set) uses its own width as its sharp file — never upscaled.
  - The blurred preview is kept for the 17 Welcome / sign-in paintings only (the first paint there); Home falls back to the painting's colour. That keeps `darshan.json` at 6.6 KB over the network.
  - **Lighthouse** (mobile, production build): Welcome 96–97 over three runs (LCP 2.4–2.5 s, CLS 0), sign-in 97; accessibility and best practices 100.
  - **The Home card** shows just the painting, its title and what it shows — no "Today's darshan" line (the head).
- **The full end-to-end test, automated half — GREEN (10 Oct 2026, ~01:00 IST):**
  - `gate.mjs checks 13` on the Phase 9 source `4f76c4dc153ad027` (stamped): unit 321, build and size within budget, server 26 suites / 1,952 assertions, both database audits with nothing new, **browser checks 1,799 / 1,799**, components 219 / 219, no page errors.
  - Getting there, the first two runs caught **one real fault** (the new "Created here" tab had broken the IYF IDs › Duplicates view: fixed) and checks that still described older screens ("Add coordinator" → "Add staff", "Possible duplicates" → "Duplicates", the head's report queue needing longer under load): brought up to date. Nothing was waived.
  - **Real mobile browsers** (`tools/devices/phone-check.mjs`, against the Phase 9 code): **iPhone Safari (iOS 27 Simulator) 29 / 29; Android Chrome (Android 15 emulator) 29 / 29** — sign-in, Home, the bottom bar, the week, the day form, sheets closing by ✕, a tap outside, Escape and the phone's Back, the time wheel, the theme row, account deletion's sheet, the staff board and day view, no sideways scroll. (The bar check now allows the Group tab of a group leader.)
  - **Lighthouse** (mobile): Welcome 96–97, sign-in 97; accessibility 100.
  - **Still to do by a person:** TalkBack (Android) and VoiceOver (iPhone) on real phones, and a real low-end Android — `docs/revamp/DEVICE_CHECKLIST.md`.
- **Browser checks brought up to date** (each was checking an older screen, not an app fault): the sign-in verse panel on desktop, the new book labels, a verse waiting up to 4 s after a painting change, `?` opening How to use as a sheet, the week-end questions hidden until Saturday 6 PM, the address in parts, and scrolling the Account pencils above the floating bar. New parts: `posts9` (26), `logs9` (4), `heads9` (16); `rules` now 60.
- **Tests:** server `phase9-posts.test.mjs` (59, with the reach), `retention.test.mjs` (24), `exports.test.mjs` (44), `appids.test.mjs` (23), `heads.test.mjs` (41), `address9.test.mjs` (11); unit `darshan9.test.js` (5; 321 in all); all 26 suites, 1,952 assertions; both audits: nothing new. Browser parts `posts9` (26, with the reach line) and `logs9` (4).

## Phase 9 — release preparation (10 Oct 2026, night)

- **Live tree ready:** the revamp was copied into `sadhanaRecord/` (release phase 13). `gate.mjs checks 13` run **on the live tree itself**: green, the same source `4f76c4dc153ad027` — unit 321, build and size, server 26 suites / 1,952 assertions, both database audits with nothing new, **browser 1,799 / 1,799**, components 219 / 219.
- **Done ahead of the release:**
  - the load-test database has migrations 0028–0036;
  - the Google Sheets tabs are built and read back: Announcements `publish_at`, AppIds, HeadRequests, and the Profiles address columns (built before the migration, as the rule says).
- **Waiting for the go-ahead** (the deploy commands need the user's permission):
  1. the load-test Worker (`npx wrangler deploy --env load`) and its runs;
  2. production migrations 0032–0036;
  3. `npx wrangler deploy`;
  4. `npm run release`;
  5. the live checks;
  6. a message to the other sessions.
- **Walkthrough videos (English), recorded from the Phase 9 code on practice data** (`tools/video/`):
  - **Five videos:** devotee, group leader, **facilitator (new)**, coordinator, IYF head.
  - **Updated for Phase 9:**
    - sign-up in 4 steps, with the address in parts and the PIN filling the state;
    - the privacy box;
    - Forgot password (the person chooses the new one; it works once approved);
    - Home's painting and verse;
    - notices from a facilitator, scheduled for later, and their reach;
    - Export;
    - Add staff and the IYF head approval;
    - IYF IDs › Search / Duplicates / Created here;
    - Keep logs for.
  - **Two recorder fixes:**
    - a wheel now closes on a tap, so Done is pressed only if it is still open;
    - the app's own clock follows the demo clock, so "today" on screen matches the demo week.
  - **Narration and chapters:** voice Rishi (Indian English); Hindi chapters are written too, but recording them waits for the user's word.
- **English videos done (10 Oct 2026, ~01:45 IST)** in `tools/video/out/`, each with subtitles inside and a chapter list:

  | Video | Length |
  |---|---|
  | `devotee-en.mp4` | 6:11 |
  | `group-leader-en.mp4` | 1:41 |
  | `facilitator-en.mp4` | 1:26 |
  | `coordinator-en.mp4` | 4:46 |
  | `iyf-head-en.mp4` | 3:43 |

  - **Every step ran,** and a frame of each chapter was checked.
  - **Steps that still described older screens were updated:**
    - the day form's topic-first Hearing and Reading sheets;
    - "Yes, submit";
    - the leader's Group tab;
    - a scheduled notice needing its day.
  - **The recorder's frame no longer moves** when the app scrolls (a white band had shown).

## Phase 9 — LIVE 10 Oct 2026 04:27 IST (release phase 13)

- **App build:** `2026.10.10-0425` (`assets/index-Dhjm_4Vw.js`), Worker version `a3fc448e`.
- **Database:** D1 migrations 0032–0036 applied.
- **Load test, run by the user:** profile and 5 phones at once, 327 calls, **0 server failures**. The 40 STALE answers are the expected conflict replies: one phone's save wins, and the others are told to reload.
- **Live checks:**
  - gate 11 / 11;
  - the open app moved to the new build by itself;
  - all 9 staff screens load;
  - offline emblem OK.
- **Found during the live Sheets check, and older than this release:**
  - **The fault:** the Sheets copy of the changing tables stopped on **7 Oct**. The nightly trim emptied `mirror_log`; SQLite then numbered new entries from 1, below the copy's position of 354; the copy never read them, and the next trim deleted them unread.
  - **Not lost:** D1, the source, lost nothing.
  - **The fix,** in both trees:
    - the trim keeps the entry at the position;
    - a log found below its position is read from the start;
    - the backlog count is corrected;
    - 7 new test checks, which fail on the old code;
    - migration `0037_mirror_recopy.sql` recopies every keyed tab once.
  - **Tests:** server 26 suites / 1,959 checks, audits clean.
  - **Waiting for the user:** apply 0037 and run `wrangler deploy`, then `tools/sheets/sync-audit.mjs` must show every keyed tab OK.

## Release phase 14 — prepared 10 Oct 2026 (after Phase 9 went live)

- **"As soon as I want to go back it shivers and then pops up" (the head's phone recording, Android back gesture, a day form with changes not saved):**
  - **The cause, in `lib/router.svelte.js`:**
    - when a form holds Back, the router undoes the step with `history.forward()`;
    - that undo arrived as a second address change and was **shown as a page change of its own**: a view transition and slide over the same page, hiding and re-showing the open "Save changes before leaving?" question;
    - "Discard" / "Save" then **added a new Home entry** instead of going Back, so a later Back returned to the day.
  - **The fix:**
    - a change to the same page is never re-shown;
    - the question opens once the undo has landed (`whenSettled`);
    - leaving continues the person's own Back as one step (`resume`);
    - a Back the browser already animated itself (`PopStateEvent.hasUAVisualTransition`, newer Chrome on Android) is not animated a second time.
  - **Screens fixed:** Day and Week, the two screens with a leave question.
  - **Proof:**
    - the new browser test `tools/browser/back-guard.mjs` (17 checks) **fails 4 on the old code** and passes on the fix; it is now part of every gate run;
    - on the Android emulator (Chrome 124, gesture navigation), the old code opened the question before the undo arrived (the undo then replayed the page); the fixed code opens it once, after the undo, with no transition.
- **The painting and the verse on every Home** (the head: "viewing the Supreme Personalities' photos is always good"):
  - the coordinator's, the IYF head's and the facilitator's Home now end with the same block as a devotee's Home — the day's painting with its title and pastime, and the verse beneath;
  - it loads after the first screen, and on a wide screen it is 480 px wide;
  - checked at 390 and 1280 px, light and dark, with no page errors.
- **The Sheets copy fix** (above) and migration 0037 go out with this release.
- **Sizes and tests:**
  - startup JS 55.65 KB, within the 60 KB budget (its 55 KB target is only a warning);
  - unit tests 321.

## Release phase 14 — LIVE 10 Oct 2026 10:02 IST

- **Build:** `2026.10.10-1001` (`assets/index-D3q4JWju.js`).
- **Checks:** `f9231e1fb53307b9`, every gate suite green, including the new back-guard test (17 / 17).
- **Sheets:** migration 0037 is applied and the Worker deployed; `sync-audit` shows the copy has caught up, with **0 mismatches** across every tab.

## Release phase 15 — prepared 10 Oct 2026 (the head's requests that morning)

- **The painting and the verse side by side on a wide screen** ("the photo on the left, the verse on the right, using the empty space"; "the quote and the photo should not overlap"):
  - from 1024 px, the staff and facilitator Home card is two columns: the painting fills the left, and the title and verse sit on the right;
  - the painting is as tall as the verse beside it and is never drawn over it;
  - checked at 1024, 1280 and 1440 px; phones keep the stacked card.
- **The sidebar never folds** ("in admin view don't contract the sidebar options"; "if things remain under groups, finding where it is can itself become a trouble"; "I don't want redundant options"):
  - every page of every section is always listed, the same on every screen;
  - on a mouse screen the rows are 36 px, so all of the IYF head's 13 pages fit an 800 px laptop screen without scrolling;
  - **Admin › People removed:** its two pages were the batch tools' Devotees and Group leaders again (the same screens, every batch), so `#/devotees` and `#/groups` now redirect there;
  - **Staff and Facilitators** are separate entries and tabs; no switch inside a page.
- **Smoothness** ("in the wheel the smoothness is missing as soon as the option arrives"; "judge all these where a new modal pops up or closes, going backwards or forwards"):
  - **The new test:** `tools/browser/motion-audit.mjs` follows every kind of movement frame by frame, on a phone run with the CPU 4× slower and on a desktop run. It flags a pop (most of a move in one frame, or a size or weight jump while visible), a sheet vanishing mid-slide, and stutters. It is now part of every gate run.
  - **On the live code it found exactly two problems:**
    1. the wheel's middle row jumped 2 px in font size and turned bold in one frame (the head's video);
    2. the Hearing and Book picker sheets collapsed to their header before sliding shut.
  - **Fixes:**
    - the wheel's emphasis is now a scale that follows the scroll continuously (one font size and weight for every row);
    - the pickers' code is fetched once the form is up;
    - a sheet's content stays until it has slid away.
  - **Everything else passes,** with no stutters: other sheets opening and closing (✕, Escape, the phone's Back), the menu, forward and back between pages, and the trackpad on a wheel.
- **Space on desktop:**
  - **The new measurement:** `tools/browser/space-audit.mjs` measures every route for every role at 1280 and 1440 px (page height in screens, fill, the right third, and overlapping parts).
  - **It found one real overlap:** on the Batch status board, P / A and ⋯ (about 140 px) spilled over the middle column. The last column is now 148 px.
  - **Most pages are already two columns** on a wide screen.
  - **Still one column, for the head to decide:** Announcements (a centred feed, kept for newest-first reading) and the IYF IDs search.

---

## Next batch — built, held back, NOT live (from 10 October 2026)

**Where it lives:** `sadhanaRecord-revamp/` only. `sadhanaRecord/` is exactly what is live (release phase 15,
build 2026.10.10-1354). These go live together with the next batch of improvements, never on their own.

### About you at sign-up (the user, 10 Oct 2026)

**What:** three **optional** questions on sign-up step 2, after batch, class and facilitator:

| Field | Column | Form |
|---|---|---|
| With IYF Delhi since | `profiles.iyf_since` (`YYYY-MM`) | month wheel, this month back 12 years |
| What do you do | `profiles.occupation` (≤ 80) | free text — "Studying, working — and in what" |
| Hobbies and interests | `profiles.hobbies` (≤ 120) | free text — "Music, sport, cooking, reading …" |

**Why it is optional:** nobody is kept out of the app for not answering, and none of the three is scored or used in
any rule. The section says so on the form: *"Optional. It helps your facilitator know you a little before you meet."*

**Who sees them:** the devotee on their own Account page, and the facilitator, coordinator and IYF head on the
devotee detail they already open — the same scope as blood group and address, nothing wider. Editable afterwards
through `profile.update`, so a devotee who skips them at sign-up can add them later and keep them current.

**Files:** `worker/migrations/0038_about_devotee.sql` · `worker/src/auth.js` (sign-up validate + store) ·
`worker/src/coord.js` (devotee detail, own profile, update) · `worker/src/api.js` (`profile.update` fields) ·
`frontend/src/screens/SignUp.svelte` ("A little about you" section).

**Checked on 10 Oct 2026:** server 26 suites / 1,959 assertions · app unit 321 · browser `rules` **60 passed**
(was 56: the new fields are exercised) · screenshot `frontend/screenshots/signup-about-you.png`.

> **Before 0038 is applied:** build **three new columns at the END of the Profiles tab** in the Access file
> (`occupation`, `hobbies`, `iyf_since`), as with the address parts in 0036. Building the tab after the migration
> fails the whole file's copy. Empty defaults, so nothing is recopied.

### Next batch — "with IYF Delhi since" is required (the user, 11 Oct 2026)

> "In the sign-up route we ask for profession and hobbies (optional) and connected since (not optional)."

- **What changed** (in `sadhanaRecord-revamp/`, on top of prompt-58's held-back 0038 work):
  - **Profession** ("What do you do") and **hobbies** stay optional.
  - **"With IYF Delhi since"** is now **required**: Next on step 2 stops until a month is chosen. Someone just joining picks this month; the list starts with it, and the hint says so.
- **The server refuses:**
  - a sign-up from the new form with no month;
  - a month that does not exist;
  - a month still to come.
- **The older app is still accepted:** a sign-up from an older copy of the app, which sends no such field, is taken as before. It could not show the error, so it is accepted rather than refused.
- **Profile edits:** a devotee who signed up earlier can still save their profile without a month.
- **Files:**
  - `worker/src/auth.js`, `frontend/src/lib/validate.js`, `frontend/src/screens/SignUp.svelte`, `frontend/src/lib/mock.js` (the practice data mirrors the server);
  - new `worker/tests/about.test.mjs` (9 checks);
  - `tools/browser/verify.mjs` › rules: Next stops on the month; "since" is not marked optional while the other two are.
- **Checks:** server 27 suites / 1,968, unit 321, browser rules 64 / 64.
- **When this batch ships:** the walkthrough video's sign-up chapter (`tools/video/scripts.mjs`, step 2) must also pick the month, and its narration should mention it.

### Next batch — the sign-up fields reconciled with the identity schema (11 Oct 2026, later)

- **What happened:** prompt-85's migration `0038_identity_and_profile` went live on 11 Oct, 16:17 IST. It added `profiles.profession` and `profiles.connected_since`, among 15 columns. These mean the same as the held-back occupation and IYF-since fields.
- **The user's correction (via prompt-85):** "connected since" is a **year only**. The IYF ID carries the year (IYFD-2019-0044), and the old journals only ever recorded a year.
- **Migrations in `sadhanaRecord-revamp/`:**
  - prompt-85's `0038_identity_and_profile.sql` is copied in;
  - the held-back `0038_about_devotee.sql` is **removed**;
  - the new `0040_hobbies.sql` adds only `hobbies` (0039 is prompt-85's Sheets-copy triggers).
- **Sign-up:**
  - **Profession** and **hobbies:** optional.
  - **"With IYF Delhi since":** a **year** wheel (this year back to 1990), required.
  - **The server:** accepts 4 digits, from 1980 to this year.
  - **An older cached app:** a sign-up that sends no such field is still accepted.
- **The profile afterwards:**
  - profession and hobbies are editable;
  - **"connected since" is read-only:** `profile.update` does not accept it, and a change is a coordinator's action, because the year is in the ID.
- **Checks:** server 27 suites / 1,972 (`about.test.mjs`, 13 checks), audits clean, unit 321, browser rules 64 / 64.
- **When this ships:**
  - build the Profiles column for `hobbies` at the end, after prompt-85's 15 columns, before applying 0040;
  - the walkthrough video's sign-up chapter must pick the year.
