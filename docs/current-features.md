# Sadhana Record — Current Feature & Functional Documentation

**IYF Delhi (ISKCON Youth Forum) · what is built and live · 7 October 2026**

> **Superseded for UI/UX planning (8 Oct 2026):** the final revamp set in `docs/revamp/` (start at `revamp/README.md`) is now the plan of record; a fuller copy (with the UI inventory) is `revamp/CURRENT_FEATURES.md`. This document is kept for history.

**Live version:** frontend build `2026.10.07-1200` (release phase 10) and API worker `86f3e05d`.

**Source of truth:** the code in `sadhanaRecord/` (`frontend/`, `worker/`, `shared/`). Where an older document says otherwise, the code wins; the gaps are listed in §9. This document describes only what exists. Ideas for the future are in the separate *UI/UX Modernization Proposal*.

**Audience:** developers, product and project managers, facilitators, coordinators, the IYF head (administrator) and future maintainers.

---

## Contents

1. Application overview
2. Roles and responsibilities
3. Complete route inventory
4. Feature inventory
5. Existing UI/UX capabilities
6. Technical architecture
7. End-to-end workflows
8. Business rules reference (scores, times, limits)
9. Known issues and documentation gaps

---

## 1. Application overview

### 1.1 Purpose

Sadhana Record is IYF Delhi's own app for **daily sadhana** (spiritual practice).

**For devotees**, it records each day in about a minute:
- sleep and wake-up time and day rest;
- chanting rounds, and the time chanting was finished;
- hearing (lectures) and reading (books);
- service (seva).

Each week they also record attendance at the weekly class, plus two week-end answers: Night Stay, and the four regulative principles.

**The server** turns those answers into scores, using the batch's score card.

**Staff use the same app:**
- coordinators run their batches;
- group leaders mark their group's attendance;
- facilitators follow their students;
- the IYF head oversees everything.

### 1.2 The problem it solves

Before the app, sadhana was gathered through forms and spreadsheets, which caused three problems:
- names, facilitators and batches were typed differently each time;
- weeks were incomplete;
- nobody could see who still had to fill in before the deadline.

The app fixes these:
- **Lists instead of typing:** batches, facilitators, IYF IDs and lectures are picked from canonical lists.
- **Weekly deadline enforced:** each week has a hard deadline, Monday 9 PM. At the deadline, weeks with at least one complete day are auto-submitted; the rest are marked missed and score 0.
- **Live progress for staff:** the board, the group view and the student view show who has submitted, who is filling, and who has not started.
- **Data in Google Sheets for IYF:** every change is copied automatically, so IYF Delhi can keep working in Sheets.

### 1.3 Primary users

| User | In the app |
|---|---|
| Devotee | a member of a batch (SPS, SPS Group 2, SPS Online, DPS, BSS, BVS) who fills their own sadhana |
| Group leader | a devotee appointed to look after a small group in their batch |
| Facilitator | the devotee's spiritual guide (from the canonical facilitators list); sees their students' sadhana, read-only |
| Coordinator | runs one or more batches: approvals, attendance, members, group leaders, filling on behalf |
| IYF head (master) | administers everything: coordinators, batches, facilitators, IYF IDs, settings, reopens, activity log |

### 1.4 Overall workflow, in one picture

```
 Sign up (phone) ──► Coordinator approves ──► Devotee fills each day ──► Week-end answers + attendance
                                                                   │
                     Monday 9 PM deadline ◄──── Submit (Sun 6 PM → Mon 9 PM) ◄──┘
                       │  ≥1 complete day → auto-submitted as it stands
                       │  nothing complete → Missed (score 0); the head may reopen
                       ▼
       Scores (server) ──► Report / History (devotee) · Board / Stats (coordinator)
                       ──► Group view (leader) · Students (facilitator) · Overview (IYF head)
                       ──► Google Sheets: store sheets + 4 batch view sheets
```

### 1.5 High-level architecture

```
 Phone / laptop browser (PWA: installable, offline-capable)
   └─ Svelte 5 single-page app, hash routes (#/home, #/week/…), static files on Cloudflare
        │  one HTTPS POST endpoint: { v, action, token, requestId, data }
        ▼
 Cloudflare Worker "sadhana-record-api" ── D1 database "sadhana" (the source of truth)
   ├─ cron every minute: deadline, 9 PM reminders, push queue, Sheets copy, view sheets, registry refresh
   ├─ Google Sheets API (service account): store sheets, batch view sheets; reads the dashboard registry
   └─ Web Push (VAPID) → FCM / Apple / Mozilla / WNS
```

### 1.6 Major modules

| Module | Frontend | Server |
|---|---|---|
| Sign-up, login, sessions, passwords | `screens/Welcome, Login, SignUp, Forgot, ChangePassword` | `auth.js`, `session.js`, `crypto.js`, `requests.js` |
| The weekly form (days, week end, attendance, submit) | `devotee/Day, Week` | `weeks.js`, `classweek.js`, `shared/scoring.js` |
| Reports and history | `devotee/Report, History, ScoresView` | `weeks.js` (`history.list`, `week.get`) |
| Hearing and reading | `devotee/Hearing, Reading, LectureList, BookList` | `rules.js` (`journals.get`) |
| Group leaders | `devotee/Group`, `coord/Leaders` | `groups.js` |
| Facilitators | `fac/Fac`, `master/Facilitators` | `facilitators.js`, `facilitator.js` |
| Coordinator tools | `coord/*` | `coord.js`, `requests.js`, `classweek.js` |
| IYF head tools | `master/*` | `admin.js`, `coord.js` |
| Announcements wall | `devotee/Wall` | `announcements.js` |
| Notifications | `lib/push.js`, `public/push-sw.js` | `push.js` |
| Account and profile | `screens/Account, Profile, DeleteAccount` | `coord.js` (`profile.*`), `erase.js` |
| Google Sheets copies | — | `mirror.js`, `views.js`, `google.js` |

### 1.7 Major data flows

1. **A day is saved:**
   - The phone keeps a draft in IndexedDB first.
   - On **Save**, only the changed fields are sent (`week.saveDay`) with a version number.
   - The server stores the draft in `drafts` and returns the day's marks.
   - If another phone saved meanwhile, the reply is `STALE` and the server's copy wins.
2. **A week is submitted:**
   - `week.submit` computes all scores on the server and writes one row to `submissions`; this row is never edited.
   - Attendance can still change later; Overall is then recomputed when shown.
3. **The deadline passes (Monday 9 PM):**
   - The minutely job auto-submits drafts that have at least one complete day.
   - It marks the rest missed, then locks the week's attendance.
4. **Copy to Google Sheets:**
   - Database triggers log each changed row, and the minutely job copies at most 300 rows per run to the store sheets.
   - It also refreshes the four batch view sheets, one step at a time.
5. **Registry refresh (every 30 minutes):**
   - The IYF ID registry and the facilitator NameMap are read from the facilitator dashboard (read-only).
   - Only changes are written.
6. **Notifications:**
   - The 9 PM reminder and announcement pushes are sent empty.
   - The phone then asks the API what to show (`push.message`).

---

## 2. Roles and responsibilities

### 2.1 How roles are built in the code

An account has one **role**: `DEVOTEE`, `COORDINATOR` or `MASTER`. The app works on **scopes**, which are computed on every request (`worker/src/db.js scopesOf`). One person can hold several scopes at once.

| Scope | Granted when |
|---|---|
| `devotee` | role DEVOTEE with an open batch membership |
| `groupLeader` | a DEVOTEE who is ACTIVE and appointed in the `leaders` table |
| `facilitator` | an ACTIVE account with `facilitator_name` set. There are two kinds: a **facilitator login** (a username created by the IYF head), or a **member**, meaning a devotee whose own phone login was linked to a facilitator name |
| `coordinator` | the login is listed as coordinator of one or more batches (any role) |
| `master` (IYF head) | role MASTER, or `is_master` set on the account |

**"Staff"** in the code means coordinator or master.

**Group leader and facilitator are two separate roles.**
- **Group leader:** a devotee who marks attendance for their small group.
- **Facilitator:** a spiritual guide who only *views* their students' sadhana.

### 2.2 Role table

| Role | Purpose | What they can see | What they can do |
|---|---|---|---|
| **Devotee** | Keep their own sadhana | Their Home (today, this week, open weeks), Week, Day, Report (daily calendar, weekly scores, trend), History, Hearing journal, Reading list, the Announcements wall, Account | Fill days; answer the week end; mark own attendance; submit; share a day or a week; like and comment on posts; edit their profile (including class day and facilitator); upload a photo; change password; switch reminders on or off; delete their own account |
| **Group leader** | Look after a small group in a batch | Everything a devotee sees, plus **My group**: each member's week status, days filled and score, any higher-level attendance mark, and the week picker | Mark P/A attendance for the group from Sunday until the Monday 9 PM deadline; call or WhatsApp a member (with a prefilled nudge) |
| **Facilitator** | Follow their students' sadhana | **My students**: every devotee whose facilitator they are, in any batch; counts by status; each student's weeks (any past week); one week in full (scores, each day in one line, day reports) | View only: call or chat on WhatsApp. They never change anyone's sadhana. A member facilitator also keeps all devotee features |
| **Coordinator** | Run their batches | Batch status board, Members, Group leaders, Filling chart (stats), Requests, a devotee's detail, any devotee's open week; the wall; birthdays | Approve or reject sign-ups and password resets (for devotees); link IYF IDs at approval; mark batch attendance; set "no regular class this week"; appoint group leaders and assign members; change a devotee's facilitator or class day; mark active or inactive; disable a login; remove a photo; delete a devotee; fill a week on a devotee's behalf; ask the head to reopen a missed week; post announcements to their batches |
| **IYF head (master)** | Administer the whole system | Everything above, for all batches; Admin: Overview, All devotees, Group leaders, Coordinators, Facilitators, Batches, IYF IDs, Reopen requests, Activity (audit log and slow/failed requests), Settings | Create and edit coordinators (reset passwords, disable); add or edit batches; manage the facilitator list and facilitator access; link or unlink IYF IDs; review possible duplicate IDs; reopen missed weeks; override attendance after the lock; change the submit window, first tracked week and reminder time; grant or remove IYF-head access; post announcements to everyone; approve staff password resets |

### 2.3 Rules that separate the roles

- A **coordinator** acts only on devotees of **their own batches**. They cannot change another staff account: that means someone who coordinates a batch, the IYF head, or a facilitator. Only the IYF head changes those.
- **Nobody** can approve their own sign-up or password reset.
- A **group leader** marks only their own group, and only in the attendance window.
- A **facilitator** never writes anything about a student.
- **Attendance precedence:** IYF head > coordinator > group leader > the week's no-class default > the devotee's own mark.
- **The `master` login is a recovery account.** It can never lose IYF-head access, and there is always at least one active IYF head.
- **First sign-in with a temporary password:** coordinator and facilitator logins created by the head start with one, and must choose their own password before anything else works.

---

## 3. Complete route inventory

All routes are hash routes (`#/…`).

### 3.1 How a screen is chosen

`App.svelte` decides in this order:
1. **Signed out:** a public screen. Any other path is remembered and the person goes to Welcome; after signing in, they return to it.
2. **Temporary password:** the person is forced to Change password.
3. **Unknown path:** "Page not found".
4. **The scope's screen** for that path.
5. **Otherwise:** "Not available to you" ("This page belongs to another role").

### 3.2 Public (signed out)

| Route | Role | Purpose | Features / information | Actions and data entered | API |
|---|---|---|---|---|---|
| `#/welcome` (also `/` and any path when signed out) | anyone | First screen | IYF lockup, "Welcome to Sadhana Record", three feature tiles, verse of the day | Login · Create an account | — |
| `#/login` | anyone | Sign in | "Phone or username", password (show/hide); notice after an expired session | Login · Forgot password? · Create an account | `auth.login` |
| `#/signup` | anyone | Ask to join a batch | **About you:** mobile, WhatsApp yes/no, name, email (typo hint), date of birth, blood group. **Address:** India; Delhi districts; PIN checked against the state. **Batch and class:** batch, Sunday or Saturday class, facilitator from the list. **Password** ×2. **Emergency contact:** name, relation, mobile | Sign up → "Waiting for your coordinator's approval" | `meta.get`, `auth.signUp` |
| `#/forgot` | anyone | Ask for a password reset | Login, new password ×2 | Ask for reset → waits for the coordinator (the head, for staff) | `auth.requestReset` |
| `#/change-password` | signed in | Change password; forced while a temporary password is in use | Current or temporary password, new password ×2 | Change password | `auth.changePassword` |

### 3.3 Devotee (requires the devotee scope)

| Route | Purpose | Features and information shown | Actions, inputs, filters | API |
|---|---|---|---|---|
| `#/home` | Today at a glance | Greeting, date and batch. **Today** card: Fill today / Continue / Submit week / Today is done ✓ with Share. Notification or install card. **This week / Your weeks:** a day strip (✓ complete, ◐ partial, ○ empty), the week's deadline, Open the week, Submit. A "Not saved yet" banner for drafts kept on the phone. Verse carousel. Latest announcement. Quick actions: Report, History, Hearing, Reading, Share today, Notices | Links only; pull or Refresh | `home.get`, `announcements.list`, `push.*` |
| `#/week` | Shortcut | Goes to the newest open week | — | `home.get` |
| `#/week/<weekId>` (`?f=submit`, `?f=days`…) | One week | Progress ring, deadline, the seven days with status. **End of week:** Night Stay and the 4 principles, Yes/No, open Saturday 6 PM. **Attendance:** Present/Absent, open on Sunday; a note when a higher mark replaced theirs, or for a no-class week. A submitted week shows its scores; a missed week a banner | Save end-of-week answers; mark attendance; **Submit week** or "Submit N of 7 days" → confirm; each gap links to the field still needed. A leave guard warns about unsaved changes | `week.get`, `week.saveWeekEnd`, `week.setAttendance`, `week.submit` |
| `#/day/<weekId>/<date>` (`?f=<field>`) | Fill one day | Sticky day chips. **Body:** slept at and woke up (wheel time pickers), day rest. **Chanting:** rounds, finished at, completed the same day? **Hearing:** minutes and topics (pick from the journal, or type; up to 8). **Reading:** minutes and book ("Same book as before", change book, or type). **Seva:** service minutes and topic, exercise, study/job hours. **Chetna:** positive and negative chips. Comment. Action bar: live day score /100, Share, Save. "How your day is scored" sheet. "Still needed" list | Save (explicit). Offline: the draft stays on the phone ("Leave and save later") | `week.saveDay`, `rules.get`, `journals.get` |
| `#/history` | Past weeks | Submitted weeks (Body, Soul and Overall %), "Missed · 0%" | Show earlier weeks (8 at a time) | `history.list` |
| `#/history/<weekId>` | One submitted week | Overall %, activity bars (11 categories), Night Stay, principles, average rounds | Share this week | `week.get` |
| `#/report` | Progress | Last submitted week; weekly trend (12-week line chart). **Daily:** a month calendar coloured 80%+ / 50–79% / below 50% / missed, plus the selected day's bars. **Weekly:** the month's weeks with bars | Month wheel (wraps around), year wheel, Daily/Weekly toggle, Share | `home.get`, `history.list`, `week.get` |
| `#/hearing` (`?v=all&w=&s=&q=&h=`) | Lecture journal | "N of 324 heard". One week at a time (4 lectures: SPL, GKGML, LOW 1, LOW 2), only the journal weeks reached so far | Week stepper ‹ › (also swipe and ← →), "Suggested" week. **All weeks** adds week, heard, slot and title-search filters. Opens the recording in Google Drive | `journals.get`, `home.get` |
| `#/reading` (`?lv=&bq=`) | Book list | Current book with its PDFs; books grouped by level, own level first | Level chips, search, Show all, Open PDF | `journals.get` |
| `#/learn` | Old link | Redirects to Hearing or Reading | — | — |

### 3.4 Group leader (requires the group-leader scope)

| Route | Purpose | Features | Actions | API |
|---|---|---|---|---|
| `#/group` | My group | Counts (Submitted, Filling, Not started, Missed), "X of Y submitted"; **Still to submit** first, then **Submitted**, greyed. Each row: status, 7-day strip, %, a coordinator's or head's mark if given | P/A attendance from Sunday until Monday 9 PM; a dashed button shows the mark in force. Save attendance (Undo); call; WhatsApp nudge with a prefilled message. Month and week picker | `group.list`, `group.mark` |

### 3.5 Facilitator (requires the facilitator scope; read-only)

| Route | Purpose | Features | Actions | API |
|---|---|---|---|---|
| `#/my-devotees` | My students | Count of students; counts by status; rows with status, day strip, %, batch | Month and week picker (up to 52 weeks back); call or chat; open a student (keeps the chosen week) | `fac.devotees` |
| `#/my-devotees/<login>` | One student | Name, batch, IYF ID; Call, Chat; Reports: "This week", any past week (month and week picker since they joined), and the list of submitted or missed weeks (up to 60) | Open a week | `fac.devotee` |
| `#/my-devotees/<login>/<weekId>` | One week of a student | Weekly score bars; each day as a row with a one-line summary (slept, woke, rounds and by when, rest, hearing, reading, service) and its %; tap a day for its bars and what was heard and read; week-end answers. A missed week shows score 0; a week still being filled shows how far each day is | Expand a day | `fac.week` |

### 3.6 Coordinator (coordinator or IYF head)

| Route | Purpose | Features and information | Actions, inputs, filters | API |
|---|---|---|---|---|
| `#/home` (staff without a devotee scope) | Staff home | "Waiting for you": sign-ups, resets, reopen requests (head); links to Batch status and Filling chart; Admin links (head); verse carousel; birthdays today and in the next 7 days; a Facilitator block if they are one | Open requests | `requests.list`, `reopen.list`, `birthdays.today` |
| `#/batch` (tab **Status**) | Batch status board | Count chips (which also filter); a row per member: status, days, %, "filled by coordinator", leader's and own marks | P/A marks with Save (in chunks of 250) and Undo; "No regular class this week?" sheet (Holiday / Festival / Other, note, everyone present or only those marked); Fill for a devotee. Batch picker, week picker, name search | `devotees.list`, `attendance.set`, `weeks.setClass` |
| `#/members` (tab) | Members directory | Total; rows with photo, status, batch, IYF ID, blood group, last week | Search (name, phone, IYF ID), batch, class, blood group, sort (name, inactive first, last submitted), status (All, Active, Inactive, Disabled, with counts); call, WhatsApp; delete an inactive member (type the phone to confirm); Show more (50) | `members.list`, `devotees.delete`, `photo.get` |
| `#/leaders` (tab) | Group leaders | Groups with their members and status; "In no group (N)" | Appoint a leader; add devotees (checkbox sheet); take one out; remove a leader (confirm); call, WhatsApp; batch picker | `leaders.list`, `leaders.set`, `leaders.assign` |
| `#/stats` (tab **Filling chart**) | Batch statistics | This week's tiles; devotees who filled each day (bars); forms submitted by week (8); active, inactive, disabled and pending counts; missed-weeks log | Batch picker; Show more | `stats.batch` |
| `#/requests` | Approvals | **New sign-ups:** IYF ID registry matches (radio buttons, or "approve with no ID"), search another ID, facilitator, level-entry date, class day. **Password resets**, with a "call first" warning | Approve, or Reject with a reason; approve or reject resets | `requests.*`, `registry.search`, `resets.*` |
| `#/devotee/<login>` | One devotee | Photo, status, batch, IYF ID; call, WhatsApp, email; birthday, blood group, address, emergency contact; facilitator and class; batch history; last weeks (%, attendance and who gave it, reopened until) | Change facilitator or class day; ask to reopen a missed week (coordinator) or reopen with a date (head); attendance override (head, with a reason); mark inactive or active (from which week); disable or enable the login; remove the photo (with a reason); delete (type the phone). Fill this week or last week | `devotees.get`, `devotees.*`, `reopen.request`, `weeks.reopen`, `attendance.override`, `photo.remove` |
| `#/devotee/<login>/week/<weekId>` | Read a devotee's week | As the facilitator's week view. A coordinator sees only open weeks; the head sees any week | — | `devotees.week` |
| `#/fill/<login>/week/<weekId>` (`?n=Name`) | Fill on behalf | Banner "Filling for X — saved as filled by the coordinator"; same as Week (attendance read-only here) | Save the week end; submit for the devotee | `week.*` with `onBehalfOf` |
| `#/fill/<login>/day/<weekId>/<date>` | Fill a day on behalf | Same as Day, without Share. The devotee's own journal, heard list, book and score card | Save | `week.saveDay`, `rules.get`, `journals.get` with `onBehalfOf` |

### 3.7 IYF head: Admin (requires the master scope)

**Admin tabs:** Overview · All devotees · Group leaders · Coordinators · Facilitators · Batches · IYF IDs · Reopens · Activity · Settings.

| Route | Purpose | Features and actions | API |
|---|---|---|---|
| `#/overview` | All batches | Totals, "N waiting for approval", a card per batch (progress bar and sparkline); tap a card to open that batch's board | `stats.all` |
| `#/devotees` | All devotees | The Members screen with "All of IYF Delhi" | `members.list` |
| `#/groups` | Group leaders, any batch | The Leaders screen with a batch picker | `leaders.*` |
| `#/coordinators` | Coordinators | List on phones, table from 900 px. Add or Edit (username, name, phone, batches, temporary password), Reset password, Disable or Enable | `admin.lists`, `coordinators.*` |
| `#/facilitators` | The facilitator list and access | Add a name; search; All, Switched on and Switched off filters; a switch per name (with Undo); "Not in NameMap yet" pill; delete a switched-off name. **Access sheet:** "Do they use the app already?" Yes → link their phone, so their own login gets Students. No → a username and temporary password. Reset password; Remove access; switch a login off or on. Each row shows "In the app · SPS" or "Login: … · TRD" | `facilitators.*`, `facLogins.*` |
| `#/batches` | Batches | List or table. **Add batch** (name, short ID, level SPS/DPS/BSS/BVS, pilot). **Edit** (name, coordinators, active, pilot) | `admin.lists`, `batches.create`, `batches.update` |
| `#/ids` | IYF IDs | **Search** (3+ characters): details, Link to an account, Unlink (with a reason). **Possible duplicates:** To review, Same phone, Same name; "Not duplicates" (with Undo) | `ids.*` |
| `#/reopens` | Reopen requests | Request cards with the coordinator's reason; Reopen (reason and "open until") or Reject | `reopen.list`, `weeks.reopen`, `reopen.reject` |
| `#/activity` | Audit log | Filter chips by type (All, Sign-ups, Attendance, Devotees, Group leaders, Facilitators, Weeks, Filled for, Coordinators, Batches, IYF IDs, Announcements, Profiles, Settings); More filters (by, about, from, to); each entry as a sentence with Before/after; Load more (30); "Slow or failed requests" | `audit.list`, `runlog.list` |
| `#/settings` | System settings | First tracked week (a Monday), reminder time, submit window; registry refresh status and the number of reminder devices (read-only). Review and save → confirm sheet; Undo | `settings.get`, `settings.update` |

### 3.8 Shared (any signed-in person)

| Route | Purpose | Features and actions | API |
|---|---|---|---|
| `#/wall` (`?post=<id>`) | Announcements | Feed: author, time, pinned, new, text with links, picture. Like, comments (add and remove your own), share a link. **Staff:** New announcement (title, message, audience — the head can choose everyone; coordinators choose their batches — picture, pin, show until); edit, pin or remove (with Undo). `?post=` jumps to that post | `announcements.*`, `meta.get` |
| `#/account` (`?f=howto`) | Profile and settings | **Profile:** name, photo (crop, zoom, remove), role pills, login, batch (or TRD). Pencil-edit sections: About you, Contact details, Address, Emergency contact, Facilitator (devotees). **Settings:** notifications switch, change password, How to use (5 topics, including keyboard shortcuts), Delete account (devotees; staff see a note), "What happens to my data", Log out, app build | `profile.*`, `photo.*`, `auth.changePassword`, `account.delete`, `push.*` |
| *Go to…* (sheet, staff) | Quick jump | Screens and devotees by name, phone or IYF ID; opened with the search button, `/` or Ctrl/⌘K | `members.list` |

### 3.9 Navigation per role

**Bottom bar on phones (< 600 px):**

| Role | Items |
|---|---|
| Devotee | Home · Week · Report · Account |
| Devotee + facilitator | Home · Week · Report · Students · Account |
| Facilitator only | Home · Students · Account |
| Coordinator | Home · Batch · Requests · Account |
| IYF head | Home · Batch · Requests · Admin · Account |

**Other widths:**
- **Rail (600–1023 px):** every primary item, up to 7.
- **Sidebar (≥ 1024 px):** every section.

**Menu (drawer or sidebar) sections:**
- profile card;
- My Sadhana;
- Facilitator;
- My batch (with a batch picker);
- Admin;
- You: Announcements, Account, Report issue (an email to the app's keeper), How to use, Install the app, Theme, Log out.

On a phone, the drawer leaves out anything already on the bar.

**Top bar:**
- Back on inner pages; otherwise the menu button.
- The page title, with the area named in words.
- Search (staff).
- The announcements bell, with an unread count.

---

## 4. Feature inventory

### 4.1 Authentication and accounts

- **Sign-up and approval:**
  - Sign-up with the phone as the identity.
  - The person stays PENDING until a coordinator approves; rejection needs a reason.
  - There is no ID document of any kind; an optional face photo is the only picture.
- **Login and sessions:**
  - Login with phone (devotees) or username (staff).
  - Sessions last 30 days, sliding; only a hash of the token is stored.
  - 5 wrong passwords lock the account for 15 minutes.
- **Password rules and resets:**
  - Passwords are 8–64 characters. The phone number, sequences and about 150 common passwords are refused.
  - A reset is requested with the new password, approved by the coordinator (the IYF head for staff), and ends all sessions.
  - Change password ends the other sessions.
- **Authorisation:** the role guard on every API action (§2.1), plus batch-level checks inside the handlers.
- **Offline sign-in:** a returning person stays signed in with no connection, and their Home is kept on the phone. The kept data is erased at log-out (Phase 1, 5 Oct 2026).

### 4.2 Sadhana: entries, scoring, submission

- **Daily form:** body, chanting, hearing, reading, seva and Chetna, with a live day score.
- **Week-end answers and attendance:**
  - Night Stay and the 4 regulative principles open Saturday 6 PM.
  - Attendance opens Sunday 00:00.
- **Submit window:** Sunday 6 PM to Monday 9 PM (settings). Part weeks are allowed: only complete days count, each category ÷ 175.
- **Deadline:**
  - At least one complete day: the week is auto-submitted.
  - Otherwise: missed, scored 0.
  - The head can reopen a missed week for up to 14 days.
- **Scores (server-side):** two score cards (SPS; BVS/DPS/BSS) with Body, Soul, Seva, Attendance and Overall (§8).
- **History, Report and sharing:**
  - Weekly and daily reports, a 12-week trend, and the month calendar.
  - Share a day or a week through the share sheet, WhatsApp, or copy.
- **Hearing journal:**
  - 324 lectures per journal (81 weeks × 4 slots), each linked to its Google Drive recording.
  - A "heard" list built from submitted weeks.
- **Reading list:** 76 books in levels, with PDF links; the current book is remembered on the phone.
- **Not built:**
  - monthly sadhana forms;
  - eligibility or level promotion: SPS → DPS and onward is decided in the facilitator dashboard, not in the app.

### 4.3 User management

- **Coordinator approvals:** coordinators approve devotees.
- **IYF head account management:** the head creates coordinator logins, facilitator logins, and facilitator access for existing devotees.
- **Active, inactive, disabled:**
  - Active/inactive is per membership, from a chosen week.
  - Disabling a login ends its sessions.
- **Deletion:**
  - By a coordinator or the head, after typing the phone to confirm.
  - Self-deletion by a devotee, with password + DELETE.
  - What is deleted and what is pseudonymised is listed in §7.6.
- **IYF IDs:** linking at approval or by the head; possible duplicates reviewed by the head; dashboard merges followed automatically.

### 4.4 Batch management

- **Batches:** 6 seeded batches: SPS, SPS Group 2 (pilot), SPS Online, DPS, BSS, BVS. The IYF head can add batches (see §9 issue 1) and edit name, coordinators, active and pilot.
- **Memberships:** a history with from-week and to-week, facilitator, class day and level-entry date.
- **Group leaders:**
  - Appointed per batch.
  - Members are drawn from the same level: SPS, SPS2 and SPSO form one pool.
- **Facilitators:**
  - A canonical list, synced every 30 minutes from the dashboard's NameMap.
  - Names added in the app are kept; switched-off names are kept by the devotees who have them.

### 4.5 Dashboards and overviews

| Who | What they get |
|---|---|
| Devotee | Home: today, this week's days, open weeks, drafts not saved, verse, latest post, quick actions |
| Group leader | My group: counts, still to submit, submitted (greyed) |
| Facilitator | My students: counts by status and a row per student |
| Coordinator | Staff Home ("Waiting for you", birthdays), the Status board and the Filling chart |
| IYF head | Overview of all batches, plus every coordinator view |

### 4.6 Reporting and exports

- **In the app:**
  - devotee Report and History;
  - batch Filling chart and missed log;
  - the IYF head's Overview;
  - the Activity log.
- **Google Sheets** is the export path. Every database table is copied to store sheets, except passwords, tokens, photos and push data. Four **batch view sheets** (SPS family, DPS, BSS, BVS) show This week, Scores (12 weeks), Days (4 weeks) and Week-end answers.
- **No file export** (CSV or PDF) inside the app.

### 4.7 Notifications

- **Web Push:**
  - **9 PM reminder** every day. Monday to Saturday it says whether today is filled; on Sunday it covers attendance and submitting.
  - **New announcement** pushes.
  - An **attendance notice** when a leader, coordinator or the head changes a devotee's mark.
- **On-off switch:** in Account; a Home card asks once (it can be dismissed for 7 days).
- **App badge:** unread posts for devotees, waiting requests for staff.
- **iPhone:** pushes work only for the Home Screen app (iOS 16.4+), as Apple allows.
- **No email or SMS** notifications.

### 4.8 PWA

- **Installable:**
  - The manifest, icons and the "Install the app" item in the menu.
  - On iPhone, a hint: Share → Add to Home Screen.
  - An install card on Home, after the first fill.
- **Service worker (Workbox):**
  - Precaches the app shell and devotee screens (about 530 KB). Staff screens are cached on first use.
  - Updates install and the page reloads itself, but never while a day has unsaved changes.
  - Old releases' files stay online, so an open old page still loads its screens.
- **Offline:**
  - Day drafts are kept in IndexedDB; nothing is lost.
  - An offline bar is shown, Home is kept per login, and sign-in works with no connection.
  - Nothing is sent automatically: the person presses Save when back online.
- **`/version.json`** and `<meta name="app-build">` show the running build.

---

## 5. Existing UI/UX capabilities

| Capability | What exists |
|---|---|
| Responsive layout | Four layout classes: phone < 600 px (bottom bar + drawer), tablet 600–1023 (88 px rail), desktop ≥ 1024 (280 px sidebar), wide ≥ 1440 (content capped at 1,280 px). Container queries for Home, the hero card, the quotes, the week view and Report |
| Device adaptation | Look tiers **High / Balanced / Low**, chosen automatically from memory, CPU cores, network, battery, Save-Data, reduced transparency, and measured scrolling smoothness. Low uses opaque surfaces, fewer shadows and no view transitions |
| Theme | Automatic / Light / Dark, one menu row that cycles on each tap. Warm neutrals with an accent colour per area: devotee lapis, coordinator saffron, admin wine, sign-in royal purple. Gold detail; serif headings |
| Navigation | One navigation model for bar, rail and sidebar; Back on inner pages; deep links; "Page not found" and "Not available to you" screens |
| Transitions and animation | View-transition crossfade (180 ms) between pages; press feedback (controls sink 0.97–0.99, rows tint); hover only where a mouse exists; splash with a progress line; skeleton shimmer |
| Dialogs, drawers, bottom sheets | One native-`<dialog>` Sheet component: bottom sheet on phones, centred dialog wider. The phone's Back button closes it. The drawer is a dialog too. Inline confirmations for risky actions |
| Pickers | 3D wheel pickers (time, month, year, lists) with keyboard support; segmented controls; a week picker (month + week) |
| Forms | Read-only sections with a pencil to edit; inline validation with server field errors; a leave guard for unsaved changes; numeric and date inputs |
| Tables | Coordinators and Batches become tables on wide screens; everything else is a grouped list |
| Charts | Hand-made: CSS bars, an SVG trend line, a progress ring, a calendar heat map. No chart library |
| Search, filter, sort | Members: search, 4 filters and a sort. Facilitators, IYF IDs, Activity: chips and search. Lectures: week, slot, heard and title. Staff "Go to…" search |
| Pagination | "Show more" or "Load more" (History 8, Lectures 30, Members 50, Activity 30) |
| Loading, empty, error | Skeletons (8 kinds), "Refreshing…", "Still working…" after 2 s; empty states with a reason; error banners with Retry; a 15 s timeout with a clear message; offline bar; Undo toasts |
| Touch | 44 px targets; swipe on the lecture week and the verse carousel; drag in photo crop and wheels; a short vibration on save, submit and attendance (Android) |
| Keyboard | Skip link; focus moves to the page title on each page; `g` then h/w/r/b/s/a/n to jump; `/` or Ctrl/⌘K for Go to… (staff); `?` for How to use; arrow keys in wheels, tabs and the week stepper |
| Accessibility | Status shown as a dot plus a word, never colour alone; the area named in words; live regions for page changes and toasts; native modal dialogs return focus; automated contrast tests (WCAG AA) across all areas, light and dark; reduced motion and reduced transparency respected |
| TV / 10-foot | **No dedicated TV layout.** Keyboard navigation works; nothing is tuned for a remote |

---

## 6. Technical architecture

| Area | Implementation |
|---|---|
| Frontend | **Svelte 5** (runes) single-page app, **Vite 8**, **Tailwind CSS 4** (tokens and utilities, with a custom compact reset). No runtime npm dependencies. System fonts only (serif: Iowan / Palatino / Noto Serif; sans: system-ui) |
| Routing | Hash router (`lib/router.svelte.js`) with view transitions, a leave guard and scroll restoration; screens are lazy-loaded per area (devotee bundle; `staff-*` chunks for coordinator and admin) |
| Components | About 50 shared components in `src/ui` (Sheet, WheelSelect, TimePicker, Bars, Trend, Status, Row, EmptyState, Skeleton, WeekPicker, WeekRead, CommandSearch…), screens in `devotee/`, `coord/`, `master/`, `fac/`, `screens/` |
| State | Svelte runes; a request cache (`lib/cache.svelte.js`): memory + sessionStorage, plus IndexedDB for Home and Profile per login; requests made at the same moment share one call |
| API layer | `lib/api.js`: one POST endpoint; a request ID on every write (safe retries); 15 s timeout (60 s for uploads); retry on BUSY; clock-skew correction; a mock API (`lib/mock*.js`) for development and tests |
| Authentication | Bearer token in the request body (no cookies). PBKDF2-SHA-256 with a server-side secret ("pepper"). Sliding 30-day sessions |
| Storage | **Cloudflare D1** (SQLite), 29 migrations, about 40 tables. Photos and post images are stored in D1 |
| PWA | vite-plugin-pwa / Workbox `generateSW`; `push-sw.js`; a hand-made update flow (`lib/sw.js`) |
| Server | **Cloudflare Worker** `sadhana-record-api`: an action registry with per-action role, fields and write flag; idempotent writes (a 6 h reply cache); rate limits; audit log; slow/failed request log |
| Scheduled jobs | Cron every minute, plus two evening crons for the reminder: deadline, reminders, announcement pushes, attendance notices, Sheets copy, view sheets, registry and facilitator sync (every 30 minutes), nightly trims |
| External services | Google Sheets API (service account); Web Push (VAPID); a DNS lookup to check email domains |
| Hosting and deploy | Cloudflare static assets (frontend worker `sadhana-record`) + the API worker; `npm run release` (tests → build → size budgets → deploy → proof that an open page updates); a phase gate (`tools/release/gate.mjs`) that only deploys a phase when the previous one is live and all browser checks pass |
| Security headers | Strict CSP (`script-src 'self'`, no inline code), `nosniff`, no referrer, `frame-ancestors 'none'`; CORS allow-list on the API |
| Quality | 271 unit tests (Vitest); 1,665 browser checks (`tools/browser/verify.mjs`) + 219 component checks; iPhone simulator and Android emulator checks (`tools/devices/phone-check.mjs`); 1,580 server assertions; size budgets (startup JS 60 KB, CSS 15 KB) |

---

## 7. End-to-end workflows

### 7.1 Devotee

1. **Sign up** (`#/signup`): fill in the form. A coordinator approves it, possibly linking an IYF ID and confirming the facilitator and class day.
2. **Log in.** Home shows **Today**.
3. **Fill today:** times on wheels, rounds, hearing (pick lectures from the journal), reading (same book with one tap), seva → **Save**. With no connection, the draft stays on the phone.
4. **Through the week:** the day strip fills up. The 9 PM reminder says whether today is filled.
5. **Saturday 6 PM:** answer Night Stay and the 4 principles.
6. **Sunday:** mark attendance (the class).
7. **Sunday 6 PM to Monday 9 PM: Submit.** The app lists anything missing, with links. Part weeks are allowed.
8. **After the deadline,** if not submitted:
   - with at least one complete day, the week is auto-submitted;
   - otherwise it is missed, scored 0, and the coordinator can ask the head to reopen it.
9. **View progress** in Report and History; share a day or a week.

### 7.2 Group leader

1. Log in. The menu or bar shows **My group**.
2. See who is still to submit; call or WhatsApp them (prefilled nudge).
3. **Sunday:** mark P/A for the class → **Save attendance** (Undo available). A coordinator's or the head's mark overrides theirs.

### 7.3 Facilitator

1. Log in with a facilitator username or their own devotee phone login (if linked by the head).
2. **My students:** counts and status per student, for this week or any past week.
3. Open a student → any past week → each day in one line; tap a day for its scores and what was heard and read.
4. Call or chat. Nothing can be changed.

### 7.4 Coordinator

1. Log in. Home shows **Waiting for you** (sign-ups and resets).
2. **Requests:** approve sign-ups, linking an IYF ID and confirming the facilitator and class day; approve resets after calling the person.
3. **Batch › Status:** watch the week fill; Fill for someone if needed; on Sunday mark attendance, or set "no regular class this week".
4. **Members / Group leaders:** appoint leaders, assign members, manage inactive members.
5. **Devotee detail:** change the facilitator or class day; ask the head to reopen a missed week; disable or delete.
6. **Filling chart:** trends and the missed-weeks log.
7. **Wall:** post announcements to their batches.

### 7.5 IYF head (master)

1. **Overview:** every batch this week.
2. **Admin tabs:**
   - coordinators;
   - batches;
   - facilitators: the list, logins, and linking members;
   - IYF IDs: linking and duplicates;
   - reopens;
   - activity;
   - settings.
3. **Everything a coordinator does,** for all batches.
4. **After the deadline:** attendance overrides, with a reason.

### 7.6 Account deletion

- **Who:** self-service (devotees) or by a coordinator or the head.
- **Deleted:**
  - the account, profile, photo and drafts;
  - comments and likes;
  - sessions and push devices;
  - open requests.
- **Kept under a pseudonym** ("Deleted devotee", `deleted-<hex>`), so batch totals stay true:
  - submitted weeks, attendance and missed weeks;
  - memberships;
  - audit lines.
- **The Google Sheets copies** are rewritten to match.

---

## 8. Business rules reference

**Times (IST, defaults; the head can change the submit window):**

| Event | When |
|---|---|
| A day can be filled | From its own date; future days are refused |
| Week-end answers open | Saturday 18:00 |
| Attendance opens | Sunday 00:00, for Saturday-class devotees too |
| Submit window | Sunday 18:00 to Monday 21:00 |
| Deadline job | After Monday 21:00 (auto-submit or missed; attendance locked) |
| 9 PM reminder | From `reminder_time` (21:00) to 23:30 |
| Registry and facilitators sync | Every 30 minutes |

**Day marks (25 per category per day; "BDB" = the BVS/DPS/BSS card):**

| Category | BDB card | SPS card |
|---|---|---|
| To bed | 21:45–22:00 = 25 … 23:00–23:15 = 0; later −5 | 22:00–22:15 = 25 … 23:15–23:30 = 0; later 0 |
| Wake-up | 03:45–04:00 = 25 … 05:00–05:15 = 0; later −5 | 04:30–04:45 = 25 … 05:45–06:00 = 0; later 0 |
| Day rest | ≤ 60 min 25; 61–75 20; 76–90 15; 91–105 10; 106–120 5; 121–135 0; ≥ 136 −5 | same |
| Chanting (by finish time) | before 07:15 25; to 09:30 20; to 13:00 15; to 19:00 10; to 21:00 5; to 23:00 0; later −5; not the same day −5 | same |
| Hearing / Reading | ≥ 45 min 25; 35–44 20; 25–34 15; 15–24 10; 5–14 5 | ≥ 25 min 25; 20–24 20; 10–19 15; 5–9 10; 1–4 5 |
| Seva (weekly minutes) | < 90 → 0, < 120 → 20 … ≥ 210 → 100 | minutes ÷ 90 × 100 (max 100) |
| Attendance | P = 100, A or none = 0 | same |

**How the scores combine:**
- Each category % = the week's marks ÷ 175 × 100.
- **Body** = average(bed, wake-up, day rest).
- **Soul** = average(chanting, reading, hearing).
- **Overall** = average(Body, Soul, Attendance, Seva).
- Part weeks: only complete days count, so 1 perfect day ≈ 14%.

**Limits:**
- rounds 0–64;
- minutes 0–600 (service 0–999);
- up to 8 hearing topics a day;
- comment up to 500 characters;
- photo ≤ 400 px and ≤ 150 KB;
- post picture shrunk on the phone to ≤ 1,280 px a side (the server accepts up to 1,600 px) and ≤ 240 KB;
- announcement title 2–80 characters, body up to 1,000.

---

## 9. Known issues and documentation gaps

**Found while preparing this document (7 Oct 2026). These are not fixed yet: this document changes no code.**

| # | Issue | Effect | Fix (size) |
|---|---|---|---|
| 1 | **Add batch uses old journal names** (fixed in the server code and tests on 8 Oct 2026; live after the next server deploy). `worker/src/admin.js` (`LEVELS`) sets "Level 4 / Level 5 BSS / Level 5 BVS"; the journals were renamed to `SPS/DPS`, `BSS`, `BVS` (migration 0002) | A batch created with Add batch would have **no lectures**. No batch has been created yet (checked on the live database). **Do not use Add batch until it is fixed** | One line + a test (small) |
| 2 | A facilitator who opens a student's page by a direct link gets a "This week" link ending in `/` | "Page not found" | Small |
| 3 | Admin and request paths are matched with the query string included | `#/overview?x=1` shows "Not available to you" | Small |
| 4 | `#/history/<week>` for a week that is neither submitted nor missed | Blank page | Small |
| 5 | In a **reopened** week, neither the devotee nor the coordinator can mark attendance (both check the original Monday 9 PM close) | Submit stays incomplete until the head overrides attendance | Medium |
| 6 | The current book is kept only on the phone (`profiles.current_book_id` is read but never written) | A new phone forgets the book | Small |
| 7 | Attendance saved by a group leader or coordinator, and days saved on someone's behalf, are not in the Activity log (the rows record who saved them) | Less traceability | Small |
| 8 | Startup size is slightly over its *target* (JS 55.06 of 55 KB; CSS 13.58 of 13.5 KB), within the hard budget (60 / 15) | None yet; little room left | — |

**Older documents that no longer match the code:**
- **`docs/sadhana-app-design.md`:**
  - decisions 6, 17, 26 and 31 (all-or-nothing weeks) were replaced by decision 45 (part weeks and auto-submit);
  - photos are in D1, not Drive;
  - attendance has five levels;
  - Saturday-class attendance opens on Sunday;
  - there is no nightly ID auto-link job;
  - coordinators also choose announcement audiences;
  - devotees can change their own facilitator and class day.
- **`docs/phase6-route-inventory.md` and `docs/screens-status.md` (4 Oct):**
  - out of date on History, Wall, Hearing, Reading, Account, Report, the rail and the staff Home;
  - they miss the Go to… search, the shortcuts, the fill-on-behalf query, `?post=`, and the not-found/not-available split.
