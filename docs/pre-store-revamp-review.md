# Sadhana Record — End-to-end review and final revamp plan before the app stores

**IYF Delhi · 7 October 2026 · review of the live app (release phase 10)**

> **Superseded for UI/UX planning (8 Oct 2026):** the final revamp set in `docs/revamp/` (start at `revamp/README.md`) is now the plan of record; its findings and phase plan were merged. This document is kept for history.

- **What this is:** an end-to-end check of every route for every kind of login, followed by the revamp plan for publishing on the Play Store and App Store.
- **The rule followed:** no app code was changed for this review.
- **How it relates to the other documents:** it builds on `current-features.md`, `ux-modernization-proposal.md` and `store-distribution-audit.md`. Where this plan reorders work, **this document is the plan of record**.

---

## 1. What was checked, and what was not

| Check | Scope | Result |
|---|---|---|
| **Screenshot sweep, every route × every login** | 10 personas: signed out, sign-up pending approval, temporary password, devotee, devotee + group leader, devotee + facilitator (linked), facilitator-only, coordinator, IYF head, IYF head + devotee. **132 persona-routes × phone/desktop × light/dark = 528 screenshots** | No page errors, no crashes, no sideways scrolling. Automatic flags for clipped text and small targets were checked by eye: some real, some false positives (§2) |
| **Visual review** | All 528 screenshots, in four parallel reviews (devotee/public, facilitator, coordinator/head, navigation across roles), against a world-class bar (Apple clarity, Linear lists, real apps on Mobbin) | Findings in §2–§5 |
| **Functional tests** (at the phase 10 release, same code) | 1,665 browser checks, 219 component checks, 271 unit tests, 1,580 server checks | All passed |
| **Real phones** (phase 9, 5 Oct; same flows) | iPhone simulator (iOS 27) and Android emulator (Android 15) | 29/29 each |
| **Performance** | Lighthouse, live sign-in page | **Desktop 99** (your run). **Mobile: your run 78, two runs here 97** (FCP 1.9–2.0 s, LCP 2.1–2.3 s, TBT 0, CLS 0). See §6 |
| **Store requirements** | Read against `store-distribution-audit.md` and the code | Two gaps not covered before (§7) |

**Not checked in this round (honest limits):**
- **Data:** the review used **test data**, not live data. A few contradictions seen in the screenshots come only from the test data (§2.3); the real server code was read to tell them apart.
- **Real phones:** not re-run after phase 10. Phase 10 added no new device APIs.
- **Design reference sites:** Mobbin, Linear and the others were **not browsed** for this review. Their patterns are cited from general knowledge.
- **Screen readers:** no TalkBack or VoiceOver pass yet. Proposed in §8.

---

## 2. Findings that must be fixed before the stores (P0)

### 2.1 Bugs and false states (verified in the code)

| # | Finding | Where | Effect | Size |
|---|---|---|---|---|
| 1 | **Add batch gives a new batch journal names that no longer exist** | `worker/src/admin.js` `LEVELS` | A new batch would have no lectures. Not used yet (checked live) | S |
| 2 | **Batch status counts inactive and disabled members as "Not started"**; Filling chart and Overview don't | `lib/staff.js boardCounts` | The same week shows 5 not started on one screen and 3 on another: staff stop trusting the numbers | S |
| 3 | **An IYF head who is also a devotee loses Requests and Admin from the phone bar** (the bar fills with Week and Report first) | `lib/nav.js` ranks | The busiest role can't see the requests badge on a phone | S |
| 4 | **The app-icon badge counts only posts for anyone with a devotee scope**, never waiting requests | `ui/Shell.svelte setBadge` | Mixed staff miss approvals | S |
| 5 | **The bell count changes by screen** (4 on Home, 1 on Account): when the post list isn't loaded, it falls back to "newest post" = 0 or 1 | `ui/Shell.svelte` | Looks broken | S |
| 6 | **"Saved ✓" shows on a day nobody touched** (empty, 0/100) | `devotee/Day.svelte saveLabel` | Tells the devotee something false | S |
| 7 | **A sign-up waiting for approval is shown as a red login error**, with the login form still active | `screens/Login.svelte` | People retry or sign up again | M |
| 8 | **The forced password change shows the whole app** (bar, sidebar, bell) around it | `App.svelte` / `Shell` | The "forced" step looks optional, or broken when links bounce back | S |
| 9 | **Desktop sidebar overflows at 860 px height** (IYF head; devotee + facilitator): Log out and the You section are off-screen | `ui/Menu.svelte` | Hidden actions on laptops | S |
| 10 | **Admin tabs and filter chips are cut on desktop** with no sign that more exist ("s", "Bat…") | `ui/Tabs.svelte`, Activity | Tabs look broken | S |
| 11 | Known issues 2–7 from `current-features.md` §9: facilitator deep link, query-string routes, blank history page, attendance in reopened weeks, current book only on the phone, audit gaps | various | as listed there | S–M |

### 2.2 Small tap targets (confirmed by eye)

- Chart page dots, 7 × 7 px: Report, Filling chart, the week view.
- The "Fill" link on Batch status (19 × 32).
- Name links on Batch status and Group leaders (24 px tall).
- "View" on the IYF head's devotee page (33 × 20).
- "Back to …" on the fill pages (17 px tall).
- The verse carousel dots (about 5 px).

**False positives (refuted by eye):**
- the "October 2026" and "Week of …" pickers: they show in full;
- radio and checkbox inputs inside full-row labels;
- the hidden photo file input.

### 2.3 Seen in the screenshots, but only because of the test data

The real server code was checked for each of these:
- **A facilitator's "No devotees":** the real server counts memberships correctly.
- **The same student shows 60% on one screen and 97% on another, with future days scored:** the test generator fills weeks without a calendar. The real list and the real detail read the same `submissions` row.
- **Members shows "Nothing submitted yet" next to Submitted rows:** test data only.

**To do before the stores:** one check on a **staging copy with real-shaped data** (§8, Phase 0), so that no contradiction survives on real data.

---

## 3. Removing duplication: one place for each thing, per role

**What the review found:** the same information or destination is offered in **two to four places at once** in several areas:
- **Announcements, on Home:** bell badge, sidebar count, pinned card, "Notices" quick action.
- **Requests:** Home card, bar badge, Filling chart, Overview, plus reopens kept separately.
- **Week counts:** Batch status, Filling chart, Overview (and they disagree).
- **Navigation:** sidebar + in-page tabs + link lists on Home.
- **Days filled:** the Today card and the This-week card, directly below each other.
- **Section names:** the "MY SADHANA" / "MY BATCH" / "FACILITATOR" eyebrows repeated on pages that aren't in that section.

### 3.1 Where each thing lives (the rule)

| Thing | Keep in | Remove from |
|---|---|---|
| Announcements | The **bell** (with one correct count); on Home **one teaser, only when unread** | Sidebar "Announcements" count, "Notices" quick action, the bell on the Wall page itself |
| Requests (sign-ups, resets, **reopens**) | **One Requests inbox** with type filters; one badge; the Home "Needs you" counts | Filling chart "People" button, Overview pills, the separate Reopens tab (merged in) |
| This week's counts | **Batch status** (as filters) and **Overview** (per batch), from **one shared definition** (active members only) | Filling chart's four tiles (it shows trends only) |
| Sub-navigation (Batch and Admin sections) | **Phone:** page tabs. **Desktop:** the sidebar | Desktop page tab rows; Home link lists ("Batch work", the 7-item Admin list) |
| Days filled this week | **One status block** on Home; the ring on the Week page | The second count in the Today card |
| Role and batch | One line in the menu profile card; full details in Account | The batch under the greeting; page eyebrows on shared pages |
| How to use | Its own sheet or page, with **role-specific topics** | The 2,900-px Account page anchor |
| Contact (staff devotee page) | Call · WhatsApp · Email buttons | The repeated value rows |
| Back | The top-bar arrow | "Back to …" banner links; Back on screens that are tab roots |

### 3.2 Navigation and Home, per role

**Bar ≤ 5 items · rail at 600–1023 px · sidebar from 1024 px.**

| Role | Phone bar | Desktop sidebar | Home answers first |
|---|---|---|---|
| Devotee | Home · Week · Report · Account | My Sadhana (Home, This week, Report, Hearing, Reading) · You | **My status:** one block ("3 days to fill · closes Mon 9 PM", missed days in amber, one button) |
| + Group leader | Home · Week · **Group** · Report · Account | + My group | + **Needs you:** "1 in your group still to submit · Deepak ›" |
| + Facilitator (member) | Home · Week · Students · Report · Account | + My students | + **Needs you:** "2 students not started ›" |
| Facilitator only | Home → **opens on Students** · Account | My students · You | "Who needs me" list, grouped |
| Coordinator | Home · Batch · Requests · Account | Home · Batches (one entry) · Requests · You | **Needs you** (requests, with age) · **This week per batch** · people to nudge · birthdays |
| IYF head | Home · Requests · Admin · Batch · Account | Home · Requests · Batches · Admin (one entry each) · You | **Decisions** · **System health** · **Batches table** (worst first) |
| IYF head + devotee | Home · Week · Requests · Admin · Account (Report, Batch on the rail) | My Sadhana · Requests · Batches · Admin · You (about 12 rows; fits 860 px) | My day · Needs you · health strip (about 1,500 px instead of 2,750) |

**The Home model for every role is three slots:**
1. **My day:** if a devotee.
2. **Needs you:** one card merging every queue the person owns, showing non-zero rows only.
3. **My scope this week:** the highest role only.

After those come the teaser (if unread), birthdays and the verse. **No navigation lists on Home.**

### 3.3 One name per thing

| Concept | Today | Use |
|---|---|---|
| A coordinator's batch tool | Batch, Batch status, Status, My batch, Batch work, "Batch status and attendance" | Bar **Batch**; page **Batch status**; section **Batches**. "My batch" only for a devotee's own batch |
| Week in progress | "Filling" (counts) vs "Draft" (rows) | **Filling** everywhere |
| Students | Students, My students, Facilitator | **My students** (bar may say Students) |
| Announcements | Notices, Announcements | **Announcements** |
| Waiting items | sign-ups waiting / waiting for approval / waiting approval / 1 waiting | **waiting for approval** |
| Members | Members, All devotees, Group leaders ×2 | **Devotees**, **All devotees**, **All group leaders** (head) |
| Admin pages | All titled "Admin" | The tab's own name (Overview, Settings …) |
| "TRD" | Shown alone | "TRD (temple resident)" on first use; plain elsewhere |
| Dates | 05 Jan 2026 / 5 Oct / 31/08/2026 / 07/10/2026 | **7 Oct 2026** (never numeric-only) |
| Batch names | SPS2 / SPS Group 2 | The batch **name**; the ID only in admin |

---

## 4. Screen-by-screen improvements (P1, after the P0 list)

### 4.1 Devotee

- **Missed days look like future days.** This affects the Home strip, This week, the Report calendar and the Day page. Fix: show past unfilled days as **amber "Missing"**, and make the Today card say "3 days to fill" instead of "Wednesday is not filled yet".
- **One status block on Home:** merge the Today and This-week cards, then drop the duplicate quick actions (Report, Notices) and shrink the verse card.
- **Day page:**
  - Hide the bottom bar on the Day editor, so only the Save bar floats; today two bars cover about 150 px of the screen.
  - Use a single column on desktop.
  - Show "Choose book" when there is no book yet.
  - Use the date format "Wed, 7 Oct".
- **Week page:**
  - Attendance should look neutral or disabled until Sunday. (Seen selected in test data; verify on real data.)
  - Collapse the end-of-week, attendance and submit parts into one "Week-end" card that opens on Saturday.
- **Report:**
  - Show missed days on the calendar.
  - Make the legend swatches larger and readable in dark mode.
  - Put the Daily/Weekly toggle first.
- **History:** fold it into Report › Weekly.
- **Hearing:**
  - Call the journal week a "lesson week", so it isn't confused with the calendar week.
  - Highlight the right bar tab.
- **Reading:** the filter chips run off-screen on phones. Add an edge fade or wrap them.

### 4.2 Group leader

- **Home:** show who still needs a nudge (§3.2).
- **Group:** add it to the phone bar.
- **My group:**
  - Keep one summary line instead of three.
  - Show submitted rows at full contrast with a muted chip, not dimmed by opacity, which reads poorly in dark mode.
  - Show P/A only from Sunday.

### 4.3 Facilitator

- **"Who needs me" first:** group the list as **Needs you / Filling / Submitted** (collapsed), with a plain reason on each row:
  - "Nothing filled since Sun";
  - "Missed last week";
  - "Down 30 points".
- **Make the counts tappable filters.**
- **Add a dot legend.**
- **Student page:**
  - Add a 12-week sparkline (inline SVG).
  - Show this week's status and score.
  - Drop the IYF ID.
  - Remove the duplicate week pickers.
- **Week view:**
  - Replace the bar carousel on phones (it hides 7 of 11 areas behind tiny dots) with **horizontal meters, weakest first**.
  - Bold the misses in the day rows.
- **Account for facilitators:**
  - Replace the 9 PM filling reminder with a "Sunday: students yet to fill" reminder.
  - Show How-to topics for facilitators.
  - Hide the devotee-only fields.

### 4.4 Coordinator

- **Home:** add the this-week strip per batch and the people to nudge.
- **Batch status:**
  - Make the whole row tappable.
  - Use 44 px P/A buttons.
  - Sort needs-action first.
  - Collapse inactive and disabled members into a footer.
  - Move "Fill" into the row menu.
- **One batch scope:** today the sidebar says "All my batches" while the page says "SPS".
- **Requests:**
  - A compact list with the request's age ("5 days ago").
  - On desktop, list beside detail.
  - Write dates in full.
  - Explain why a registry match is pre-selected.
  - Fix the cut-off facilitator name ("Natvar Gopi…").
- **Destructive actions** (Delete, Disable, ×): move them from list rows into an overflow menu, with a confirm or Undo.
- **Filling chart:**
  - Show all 7 days' bars at once.
  - Missed weeks get call, WhatsApp and ask-to-reopen actions.
- **Fill pages:**
  - The title is cut off on phones.
  - "How **their** day is scored", not "your".
  - The same "Saved ✓" fix as for devotees.
- **Account for staff:** hide date of birth, blood group, class and emergency contact for team logins such as "SPS Team".

### 4.5 IYF head

- **Home:**
  - **Decisions** (one inbox).
  - **System health:**
    - reminder devices (an alert at 0);
    - registry age;
    - batches with no coordinator;
    - slow or failed saves today, in plain words;
    - the time of the last Sheets copy;
    - unlinked IDs and possible duplicates.
  - **Batches table**, worst first.
- **Admin:** six sidebar entries:
  - People;
  - Staff (coordinators + facilitators);
  - Batches;
  - IYF IDs;
  - Activity;
  - Settings.
- **Merge duplicate pages:** All devotees and Members become one page with a scope picker; the same for Groups and Group leaders.
- **Activity:**
  - Show names instead of phone numbers.
  - "Before / after" opens on tap.
  - Developer telemetry moves to the health card, in plain words.
- **Settings:**
  - The text uses the configured times, not a hard-coded "Monday 9 PM".
  - Undo is disabled until something changes.
  - The save bar fits on one line.
- **Batches:**
  - Show "No coordinator" as a warning.
  - Show member counts.
  - Don't show "SPS · SPS".

### 4.6 Public and auth

- **Pending approval:** a calm status page, not an error. Show the person's name, batch and facilitator, "your coordinator will approve you", and a "Check again" button.
- **Sign-up:**
  - Mark the optional fields.
  - Let blood group, address and emergency contact be added later in Account; this cuts the form by about 40%.
  - Use the same card width as Login.
- **Forgot password:** one line saying who approves and how the person will know.
- **Welcome:** the three tiles look like buttons but do nothing. Make them a plain icon row, or tie them to the darshan image (Phase 4).

### 4.7 Shared

- **Colour:**
  - **Keep the area colours:** they are deliberate (audit §16.3).
  - **Change three things:**
    - the brand mark and sidebar stay one colour;
    - page eyebrows are removed from shared pages;
    - one accent per screen.
- **Notifications switch:** it says "Checking…" for ever in some cases. Add a timeout fallback.
- **Account:** settings as rows that open sheets ("Change password ›"), so the page is no longer 2,900 px long. Hide keyboard shortcuts on touch devices.
- **Refresh:** fold the separate Refresh rows into the header; the app already refreshes when it comes back on screen.

---

## 5. Constraints kept, and future scope covered

**Constraints:**
- Cloudflare free plan and incremental writes.
- Startup ≤ 55 KB JS / 13.5 KB CSS target; no new libraries, web fonts or framework change.
- Offline use on low-end phones.
- Phone number as identity; no ID documents.
- Explicit Save.
- High / Balanced / Low tiers with plain fallbacks.
- A calm devotional tone: no gamification.
- Sheets mirror everything.
- Pick-from-lists data.

Everything in §2–§4 fits inside these. Most items are **S** (under a day), using existing components.

**Future scope:**
- **Store shells (TWA, WKWebView):** §7 and the store audit.
- **Dynamic layer:** proposal §7.1–7.3, now Phase 3 here.
- **Darshan of the day:** proposal §6.6, Phase 4.
- **LMS and knowledge base:** after Phase 2.
- **The dashboard bridge:** unchanged, deferred by IYF.

The role-based Home and the "Needs you" card are designed so that later items slot in without new screens: LMS "continue lesson", trainer queues and the bridge status.

---

## 6. Performance (mobile)

**Measured on the live sign-in page:**
- **Desktop:** 99.
- **Mobile:** **97** in two runs here; **78** in your run.
- **Likely cause of the difference:** DevTools Lighthouse is sensitive to browser extensions and machine load. For a fair number, test in an Incognito window, or with PageSpeed Insights.

**What the mobile run shows as real room to improve:**
- LCP's **render delay is 1.7–1.9 s**. The page's stylesheet (13.6 KB) blocks the first paint for 0.3–0.6 s on slow 4G.
- The splash is then held for at least 1.4 s, plus a 0.4 s fade.

**Fixes:**
1. **Split the startup CSS** (P1, S): splash and sign-in styles become a small first file; the rest loads straight after. This fits the strict security policy, because no inline styles are needed.
2. **Shorten the splash hold** (P2, S): for a returning, signed-in person, show the kept Home at once (Phase 1 already keeps it on the phone). Keep the splash only on a first open.
3. **Hold the bundle:** keep the startup JS at or under 55 KB (it is 55.06 now; trim during Phase 0).

**Target:** mobile ≥ 95 consistently, measured in an Incognito window.

---

## 7. Store readiness checklist (Play Store and App Store)

| Requirement | Status | Action |
|---|---|---|
| In-app account deletion + a web page explaining it | **Done** (phase 9) | — |
| **Privacy policy page** (both stores require a public URL) | **Missing**: no privacy page exists in the app or its public files | Write and publish `/privacy.html` (same style as `/delete-account.html`); link it from Welcome, sign-up and Account. IYF approves the text |
| **User-generated content controls** (Apple guideline 1.2; Google Play UGC policy): the Wall has comments | **Missing**: no way to report a comment or block a person; removal exists only for the author, the post's author and the head | Add "Report" on comments and posts (to staff); let the head hide a person's comments; a short community rule shown before the first comment. *Or* switch comments off for the store versions |
| Reviewer demo account | Not prepared | A demo devotee and a demo coordinator with sample data on a **test copy**, never live accounts |
| Own domain (Android asset links, iOS app-bound domains and Universal Links) | Not done (`workers.dev`) | Buy and point the domain *before* building the store apps (store audit) |
| iOS push inside the App Store app | Needs APNs (native) | Store audit §5 |
| iOS share sheet inside WKWebView | Needs a small native bridge | Store audit §5 |
| Apple guideline 4.2 (minimum functionality: "just a website") | A risk for a web wrapper | Native push, offline launch, the share sheet and account deletion (done) lower it (store audit) |
| Store icons and screenshots | App icons exist in `brand/app-icons`; store screenshots and the Play feature graphic don't | Produce them from the revamped screens (Phase 4), using the existing screenshot tools |
| Data safety form (Play) / App Privacy labels (Apple) | Not filled | List what is collected: phone, name, email, DOB, blood group, address, emergency contact, optional photo, sadhana data. Nothing is sold or shared; Google Sheets is IYF's own |
| Age rating | Not set | Content questionnaire; IYF decides the minimum age (sign-up allows 12+) |
| Support contact | "Report issue" email exists in the app | Use the same address as the store support contact |
| Deity images rights (if used in the listing) | Not checked | Only images IYF has the right to publish (proposal §6.6) |

---

## 8. Final revamp plan, re-ordered

**This is the single implementation plan for the UI/UX revamp.** It supersedes the ordering in `ux-modernization-proposal.md` §11.

**How to use the documents:**
- **What to build, and in what order:** this table (with §2–§4 and §9).
- **The detailed spec** for each item: the proposal sections named in each phase (§6 visual and darshan, §7.1–7.3 dynamic layer and platform checks, §12 best-value list).

**Coverage:**
- Every feasible item from the proposal is scheduled in one of the phases below.
- The items the proposal rejects stay out: proposal §12 bucket D (framework change, offline submit queue, streaks, motion sensors, pull-to-refresh, radial pickers, glass everywhere) and the "Not recommended" list.

| Phase | What ships | Size |
|---|---|---|
| **0 — Trust and store blockers** | §2.1 items 1–11. Small targets (§2.2). Privacy policy page. Wall report/block (or comments off in store builds). Reviewer demo data on a test copy. Startup CSS split and JS back under target. A staging run on real-shaped data to clear §2.3 | ~1.5–2 weeks |
| **1 — One place for everything** (no redundancy) | §3: the role bar and sidebar rules; the three-slot Home with **Needs you** for every role; Requests as one inbox (reopens merged); desktop tabs replaced by the sidebar; one name per thing; dates in full. Devotee status block with missing days in amber; offline auto-send of pressed Saves with sync status; "Same as yesterday"; Monday 6 PM reminder (from the best-bargain list) | ~3 weeks |
| **2 — Role workspaces** | Facilitator "Needs you" list, sparklines, meters. Coordinator: needs-action board, whole-row targets, list beside detail on desktop, Requests list-detail, overflow menus for destructive actions. IYF head: Decisions + System health + Batches table, admin as 6 sidebar entries, merged duplicate pages, plain-word Activity. Pending-approval page, shorter sign-up, the auth layout for the forced password change | ~3 weeks |
| **3 — Dynamic layer** | Proposal §7.1–7.3: shared-element transitions, swipe between days, weeks and devotees, count-ups and chart draw-ins, live board refresh with a changed-row glow, hide-on-scroll bar, spring easing, direction-aware page motion. Also: long-press quick actions on staff rows, app-icon shortcuts (manifest), the failed-submit haptic (Android), sheet snap points. Platform-checked with fallbacks | ~2 weeks |
| **4 — Devotional character and store assets** | Darshan of the day + the image pipeline (originals on Drive; web versions with the app), time-of-day wash, festival banners. Store screenshots, the feature graphic and listing text from the finished screens | ~2 weeks |
| **5 — Store builds and final checks** | Own domain, the Android TWA and the iOS shell (APNs, share bridge), store forms (data safety, privacy labels, age rating), a TalkBack and VoiceOver pass, real-device runs, Lighthouse mobile ≥ 95, submission. Also: in-app text size (100 / 112 / 125%), "show as table" under charts, the Android contact picker for the emergency contact. **Optional, if IYF wants them:** the TV hall display, the glass hero (High tier) | ~2–3 weeks |

**Total:** about 13–15 weeks.

**Each phase passes before release:**
- the release gate;
- the device checks;
- light, dark and phone, desktop screenshots;
- a repeat of this sweep, the same 10 personas × all routes.

**Before Phase 0 starts, decisions only IYF can make:**
1. Wall comments in the store versions: keep them with reporting, or switch them off.
2. The privacy policy text and the **minimum age** (see §9, item 1).
3. Whether to show a rounds target ("14 / 16").
4. The domain name.
5. Image rights for the darshan photos.
6. Whether the app needs **Hindi** (see §9, item 3).

---

## 9. What this plan does not yet cover (and should, for a world-class launch)

**What §2–§8 cover:** everything found by checking the app's screens and code, and, through the UI/UX proposal, the world-class interface layer.

**What they leave out:** the items below go beyond the screens. They matter as much for a store launch, and are listed here so nothing is assumed covered.

| # | Gap | Why it matters | Proposed | When | Priority |
|---|---|---|---|---|---|
| 1 | **Minors' data (legal).** Sign-up accepts ages **12–80** (`worker/src/auth.js`). India's **Digital Personal Data Protection Act 2023** requires *verifiable parental consent* before processing the personal data of anyone under 18; the stores also ask about apps used by minors | Legal and store-rejection risk | **IYF decision, with legal advice:** raise the minimum age to 18, *or* add a parental-consent step for 12–17. Also add a consent notice at sign-up, the purpose of each field, a grievance contact and a retention period (what DPDP expects of a privacy notice) | Phase 0 | **P0** |
| 2 | **No testing with real people.** Every finding so far comes from screenshots and code. Nobody has watched devotees and coordinators use the app | World-class products are tested with their users; this is the biggest missing input | **Five devotees and two coordinators,** about 20 minutes each, with three tasks each (fill a day, submit a week, approve a sign-up). Note where they hesitate. Repeat after Phase 1 | Before and after Phase 1 | **P0** |
| 3 | **Language.** The app is English only (`<html lang="en">`); some books already come in Hindi | Many devotees may be more at ease in Hindi; this affects reach more than any visual change | **If IYF wants it:** keep the texts in one file per language, loaded as one small lazy file per language; a choice in Account. Hindi first. Scoring and data are unchanged | Phase 2–3 (after the copy settles in Phase 1) | P1 (decision) |
| 4 | **No product measurement.** The app cannot tell which screens are used, where people drop off, or how long a day takes to fill | Without numbers, each revamp phase can't be judged | **Privacy-friendly server-side counts**, no third-party trackers:; daily counts of key steps: opened, filled a day, submitted, reminder tapped;; time-to-fill;; sign-up drop-off by step;; browser/iOS versions (§7.3 of the proposal) | Phase 0 | P1 |
| 5 | **Onboarding.** A new devotee lands on Home with no first-week guide | First-week habits decide whether people keep filling | A 3-card first-run guide (fill daily · submit Sun–Mon · turn on the 9 PM reminder), shown once, skippable; a first-week checklist on Home | Phase 1 | P1 |
| 6 | **Operations and alerts.** No alert when a scheduled job fails (deadline, Sheets copy, reminders). Backups are a **manual weekly export** (`docs/backup-restore.md`) | A silent failure on a Monday night affects every batch | The System health card (§4.5); an email to the keeper when a job fails twice; an automated weekly backup (in place of the manual step) | Phase 2 | P1 |
| 7 | **Security review before the store.** Many protections exist: hashed passwords with a server secret, sessions, rate limits, CSP, an audit log. There has been no independent review | Store apps widen exposure | A checklist review (OWASP ASVS-lite for the web app; MASVS-lite for the two shells). Secrets rotation. A check that no personal data appears in logs or Sheets beyond what is needed | Phase 5 | P1 |
| 8 | **Support process.** "Report issue" emails go to one person | Store users expect replies; reviews depend on it | A named support owner, a reply target (2 working days), and FAQs in the knowledge base (LMS proposal) | Before Phase 5 | P2 |
| 9 | **Copy and tone review.** Wording was written screen by screen | Consistent, warm wording is part of a world-class feel | One pass over all texts with the naming table (§3.3); a short voice guide (calm, respectful, plain) | Phase 1 | P2 |
| 10 | **Real low-end Android.** Lighthouse simulates a slow phone; no run on an actual ₹7–10k phone yet | That is the typical devotee's phone | Test on one real low-end Android before release; use the Low tier as the reference | Phase 5 | P2 |
| 11 | **Store listing and name.** The name / short-name recommendation ("IYF Sadhana – Daily Sadhana Record") is pending | First impression in the store | Decide the name; write the listing (short description, keywords, screenshots from Phase 4) | Phase 4 | P2 |

**So, taken together:**
- **Screens and code:** this review (§2–§8);
- **The world-class interface layer:** the UI/UX proposal (§6–§7 and §12);
- **Everything beyond the screens:** the gaps above (§9).

These three cover what is known today to be upgradable before publishing. Real user testing (item 2) will surface what no review of code or screenshots can.
