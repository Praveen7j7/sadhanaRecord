# Sadhana Record: the IYF Delhi sadhana app

**A brief for IYF Delhi stakeholders · 3 October 2026**

Sadhana Record is IYF Delhi's own app for daily sadhana. Devotees fill in their day in about a minute on any phone. Coordinators run their batch from the same app. The IYF head sees every batch in one place. Everything lands in IYF Delhi's own database and Google Sheets, ready for the facilitator dashboard.

Link: **https://sadhana-record.iyfdelhi-sadhana.workers.dev** (open it and choose *Add to Home Screen* to install it like an app).

---

## 1. In one page

- **What it is.** One app with three views: devotees fill their sadhana, coordinators manage their batch, and the IYF head oversees all batches.
- **Why IYF Delhi needs it.** COSATOK (*Connect A Soul To Krishna*) serves devotees at the central level. IYF Delhi also needs things that are local: its own score cards, its own batches (SPS, DPS, BSS, BVS), its own coordinators, attendance at its own weekly class, its own facilitator list and IYF IDs, and data flowing into its own dashboard. Sadhana Record keeps the familiar COSATOK way of filling a day and adds that local layer.
- **Works on any device.** Android, iPhone, tablet or laptop, with nothing to download from an app store. The first screen loads about 60 KB, so it opens quickly even on low-cost phones and slow networks.
- **Better data.** Names, facilitators, batches and IDs are picked from lists, never typed. Weeks are complete or not accepted, and a submitted week can never be edited. Everything is copied to Google Sheets automatically.
- **Better analysis.** Each devotee gets daily and weekly scores, and each batch gets filling charts, missed-week lists and trends. The IYF head gets an overview of all batches, and the data feeds the eligibility pipeline (SPS → DPS and onward).
- **Cost and capacity.** Built to run **free**: comfortably up to about 4,500 devotees, with the move to US$5 a month planned as numbers approach 5,000.
  - Every database write is incremental: only changed rows are written or copied to Google Sheets.
  - A load test with 2,000 devotees and the hardening that followed (3 Oct 2026) keep the busiest day inside the free limits.
  - Cloudflare's US$5-a-month plan is the step up when usage grows. The app tracks the numbers that say when, and moving needs no change to the app. See the *Load test report*.
- **Status.** Devotee, coordinator and admin functions are live and tested, and hardening (phase 6) is done.
  - Proven on a test server: Sunday-evening weekly submission works end to end.
  - The dashboard keeps its current method for now; the nightly bridge into it follows later.
  - Next come a two-week pilot with SPS Group 2, then roll-out batch by batch once the bridge is live.

---

## 2. Why a local app, and how it builds on COSATOK

COSATOK is the central app, and the daily form here deliberately follows its pattern, so devotees find it familiar. Sadhana Record is not a replacement for the central vision. It is the **local management layer IYF Delhi needs to run its batches day to day**, with the data owned and used locally.

| What IYF Delhi needs locally | COSATOK (central) | Sadhana Record (IYF Delhi) |
|---|---|---|
| Daily sadhana form | ✓ The original pattern | ✓ Same familiar pattern |
| Scoring with IYF Delhi's own score cards (SPS card; BVS/DPS/BSS card) | Central scoring | ✓ Exactly IYF Delhi's Excel cards, checked option by option |
| IYF Delhi's batches and class day (Sunday or Saturday) | Not organised around IYF Delhi batches | ✓ SPS, SPS Group 2, SPS Online, DPS, BSS, BVS; Sunday / Saturday class |
| Batch coordinators approve sign-ups, mark attendance, manage members | Not set up for IYF Delhi coordinators | ✓ Built in, for each coordinator's own batches |
| IYF IDs and facilitator names that match the dashboard | Not linked to IYF Delhi's ID registry | ✓ Read from the dashboard's own registry; picked from lists |
| Data in IYF Delhi's own sheets and dashboard | No feed into IYF Delhi's sheets | ✓ Live copy in Google Sheets; nightly bridge to the dashboard (next phase) |
| Weekly deadline, missed weeks, reopening | Central rules | ✓ IYF Delhi's rules: Sunday 6 PM – Monday 9 PM, set by the IYF head |
| Local announcements, birthdays, 9 PM reminder | — | ✓ For IYF Delhi batches only |

*The COSATOK column describes how it fits IYF Delhi's local needs as used today. Please confirm any detail with the COSATOK team before quoting it outside IYF Delhi.*

**The result:** the devotee experience stays familiar. The facilitators, coordinators and the IYF head get local control, local data and local analysis that a central system is not designed to give.

---

## 3. A plus on any device

- **No app store.** It opens from a link. *Add to Home Screen* gives it an icon and a full-screen window like any app. Updates arrive by themselves, never in the middle of filling a day.
- **Any phone, any size.** It is designed from 320 px phones up to large screens and checked at ten screen widths. Phones get a bottom tab bar; computers get a side menu.
- **Light on cheap phones.** The first screen is about 60 KB and the rest loads only when needed. Low-memory phones automatically get a lighter look with no blur effects, which also saves battery.
- **Slow or no network.** A day being filled stays on the phone and is sent when the connection returns. Nothing typed is lost.
- **Two devices.** If the same day is filled on two phones, the app notices and keeps the data consistent.
- **9 PM reminder.** It needs one permission tap, then works daily until switched off. It goes only to devotees whose day is not yet filled (on Sunday, whose week is not yet submitted).
- **Easy to read.** Light and dark themes, large tap targets, screen-reader labels and keyboard support.
- **Holds the evening rush.** In the load test the app answered every call up to 40 a second; IYF Delhi's busiest minute needs about 12. Five phones saving the same day at once are handled safely.

---

## 4. Everything it does, by person

### Devotee

| Screen | What it does |
|---|---|
| Welcome, Sign up, Sign in, Forgot password | Sign up with phone and password. Choose batch, facilitator (from the list) and class day. Email, WhatsApp and postal address. No ID documents of any kind. |
| Home | Greeting, a verse of the day from Śrīla Prabhupāda's books, today's status, this week's progress, pinned notice, quick actions |
| Daily sadhana | Slept / woke at (simple time wheels), day rest, rounds, chanting finished, hearing and reading (minutes, lecture or book from the batch's own lists), seva, optional Chetna. A "How your day is scored" note opens the batch's score card. Day score out of 100, one Save button. |
| This week | The 7 days at a glance; Night Stay and the 4 regulative principles (open from Saturday 6 PM); own attendance mark (from Sunday, the class day for everyone), with a note if a group leader, coordinator or the IYF head marked differently; Submit (Sunday 6 PM – Monday 9 PM) |
| Report | Month calendar coloured by each day's score; activity-score bars for a day or a week (Overall, Body, Soul and each part); weekly trend |
| History | Every submitted week and its scores |
| Hearing, Reading | The batch's lecture and book lists; each opens its recording or PDF where one is linked |
| Notices | Announcements from the coordinator or the IYF head, with pictures and links |
| Share | Today or a submitted week as a WhatsApp-ready message for the facilitator |
| Account | Photo (face only), contact details (email, WhatsApp, address, emergency contact: only the devotee changes them), the 9 PM reminder (every evening), theme, password |
| My group (group leaders) | A student devotee appointed by the coordinator sees their group's week, calls or WhatsApps each member from next to the name, and marks the group's Sunday class attendance |

### Coordinator (own batches only)

| Screen | What it does |
|---|---|
| Requests | Approve or reject sign-ups (linking the IYF ID), password resets and reopen requests |
| Batch status | Any week by month and week: who submitted, who is filling, who has not started. Attendance for the Sunday class (Present / Absent) with one Save; the coordinator's mark counts over the group leader's and the devotee's own. Holiday, festival or other no-class weeks. |
| Group leaders | Appoint student devotees as group leaders, decide who is in each group, remove a leader. The coordinator marks the leaders' own attendance. |
| Members | Every devotee of the batch: active, inactive or disabled; search; filters by batch, class and blood group; call or WhatsApp in one tap; delete an inactive account |
| Devotee details | Profile, photo, tap to call, scores, inactive / reactivate, disable, facilitator and class day, fill a week on their behalf, ask to reopen a missed week |
| Filling chart | This week and the last 8 weeks, plus the missed list |
| Birthdays, Notices | Today's and this week's birthdays; post announcements to own batches |

### IYF head (master)

| Screen | What it does |
|---|---|
| Overview | All batches together: active, filled, missed and pending, with trends |
| All devotees | Every devotee, batch-wise or together, with the same actions as coordinators; filter by blood group; every batch's group leaders (Admin › Group leaders) |
| Coordinators, Batches | Create coordinators, assign batches, reset passwords, switch batches on or off |
| Facilitators | The one facilitator list used at sign-up, approval and editing: add, switch off, delete |
| IYF IDs | Look up, link or unlink IDs; review possible duplicates (same phone or same name) |
| Reopens, Attendance | Reopen a missed week; change attendance after the deadline, with a reason |
| Activity, Settings | Every important action, logged; submit window, first tracked week, reminder time |

---

## 5. Data and databases

- **Main copy: a cloud database** (Cloudflare D1, Asia-Pacific). It is fast and always on.
- **Live copy: Google Sheets**, updated every minute. Everything the app keeps is visible to the people coordinating devotees:
  - *Access:* accounts, batches, memberships, password-reset requests, facilitators, announcements, duplicate reviews, activity log, run log
  - *Profiles:* devotee profiles
  - *Rules:* settings, score cards, seva rules, Chetna options, lectures, books
  - *Submissions 2026:* every submitted week, attendance, no-class weeks, reopened weeks, missed weeks, reopen requests
  - *Batch views:* an easy-to-read sheet per batch (this week, 12 weeks of scores, daily answers, week-end answers)
- **Not copied, on purpose:** passwords (stored only as one-way hashes), sign-in tokens, photos and post pictures, phone notification addresses. Drafts (days filled but not yet submitted) and attendance marks are copied too, within about a minute, so coordinators who work in sheets see the week as it fills.
- **The dashboard stays the source of IYF IDs.** The app only reads the registry; it never creates or changes IDs. When the dashboard merges duplicate IDs, the app follows the merge automatically.
- **Next phase: the bridge.** Each night, submitted weeks are written into the sadhana-sheet tabs exactly as the dashboard import expects, so Raw, Eligibility and the dashboard keep working unchanged.

---

## 6. Analysis it makes possible

- **Per devotee:** a daily score and weekly percentages for Sleep, Wake-up, Day rest, Chanting, Reading, Hearing, Seva and Attendance, rolled up into Body, Soul and Overall. Plus a 12-week trend.
- **Per batch:** filled versus expected each week, the last 8 weeks side by side, the missed list, and who is inactive and since when.
- **Across IYF Delhi:** batch-by-batch comparison, active and pending counts, missed weeks and trends, all from one screen.
- **For promotion and eligibility:** clean weekly data (attendance, rounds, regulative principles, Night Stay) is exactly what the eligibility pipeline needs to move devotees SPS → DPS and onward.
- **In Sheets:** every table is available for pivot tables, charts or the existing Data Health checks, with no exports and no copy-paste.

---

## 7. Clean data by design

- Facilitator, batch, class day and IYF ID are always **picked from lists**, never typed.
- **One person, one login, one IYF ID.** Possible duplicates are flagged for review, and merges done in the dashboard are followed automatically.
- **A week is complete or not accepted.** After Monday 9 PM it closes, and a submitted week is never edited. Only the IYF head can reopen a missed week, and every reopen is logged.
- **Scores are always 0–100** and come from IYF Delhi's own cards, worked out by the server, not by the phone.
- **Every important action is logged:** who did what, when and why.

---

## 8. Privacy and security

- Passwords are never stored or shown. Only salted PBKDF2-SHA-256 hashes are kept.
- **No ID documents of any kind** (no Aadhaar, voter ID or similar). The phone number is the identity, and the photo is an optional face photo, seen only by the batch coordinator and the IYF head.
- Each person sees only what their role allows: a coordinator sees only their own batches.
- Repeated wrong passwords lock the account for a while. A password reset is approved by the coordinator, who first calls the devotee.
- **A coordinator cannot change, or reset the password of, anyone who also coordinates a batch or is the IYF head.** Only the IYF head can. (Found and fixed in the security review, 3 Oct 2026.)
- **Backups:** the database can be put back to any minute of the last 7 days. In the drill (3 Oct 2026) it took 4 seconds. The owner also keeps a weekly export file, and Google Sheets holds a live readable copy.
- The app sends no emails. Notifications go only to phones that allowed them.

---

## 9. Cost and reliability

- **Today: free** (Cloudflare free plan and Google Sheets).
- **Load tested with 2,000 devotees (3 Oct 2026).** At IYF Delhi's full size the app uses about a quarter of the free plan's daily requests and database reads, and about 40% of its database writes on the busiest day (Sunday / Monday).
  - It answered 100% of calls up to 40 a second (the expected peak is about 12).
  - 200 Sunday submissions at 20 a second were all accepted.
  - The Monday deadline job marked 1,795 missed weeks in about 18 minutes.
  - Three problems found during the test were fixed the same day. Details are in the *Load test report*.
- **Hardening after the load test (3 Oct 2026).** Everything that wrote a lot was made incremental.
  - Copy to Google Sheets: only changed rows.
  - Batch view sheets: a new submission becomes one inserted row.
  - The dashboard's ID list: copied only when it changes. It had been 24,000 writes a day with no users.
  - 9 PM reminder: no writes per phone; it now runs in three parallel parts.
  - Submitting a week now writes 6 rows instead of about 14.
  - Drafts and attendance reach Google Sheets within about a minute, so coordinators who work in sheets see each week as it fills. A live check compares every copied table with its sheet, row for row.
- **Free plan, and when to upgrade.** The free plan carries IYF Delhi comfortably up to about 4,500 devotees (measured costs, with drafts and attendance copied live). Its one hard edge: if a daily limit is ever crossed, the app pauses until 5:30 AM IST. Plan the move to **Workers Paid (US$5 a month, no change to the app)** when the busiest day reaches 70% of a free limit, and make it at 80% or above 5,000 devotees. The *Load test report* (§ 9b) lists the numbers to watch and where to read them; until then, nothing to pay.
- **Low-end phones:** Lighthouse, simulating a budget Android phone (4× slower processor, slow 4G), gives 96–98/100 for performance and 100/100 for accessibility. A page is under 150 KB and visible in about 2 seconds.
- **Checked before every release:** 1,330+ server checks, 136 app tests and over 1,200 browser checks (including the incremental view sheets checked cell for cell against a full rebuild, and the security attacks replayed) across phones and computers. A guarded release confirms that open apps update themselves.
- **Still to do:** the same load test with 5,000 devotees, on a fresh free-plan day (the free daily limits are shared by everything on the account).

---

## 10. Status and roadmap

| Phase | What | Status |
|---|---|---|
| 0–2 | Design, accounts and access, score cards and rules | Done |
| 3 | Weekly sadhana for devotees | Live since 2 Oct 2026 |
| 4 | Coordinator and IYF head screens | Done 3 Oct 2026 |
| 5 | Nightly bridge into the dashboard | Later; until then the dashboard keeps its current method |
| 6 | Hardening: load test, incremental writes, security review, backup drill, low-end phones | Done 3 Oct 2026 (a 5,000-devotee re-test follows on a fresh free-plan day) |
| 7 | Pilot: SPS Group 2 for 2 weeks alongside the current sheet | Planned |
| 8 | Roll-out: SPS, SPS Online, DPS, BSS, BVS, one at a time | Planned |

---

## 11. Our commitments

1. **IYF Delhi owns its data.** It lives in IYF Delhi's own database and Google Sheets, under IYF Delhi accounts.
2. **The dashboard keeps working unchanged.** The app reads the ID registry but never writes it, and the bridge writes exactly what the import expects.
3. **No ID documents, no readable passwords, no emails,** and nothing seen beyond each role's need.
4. **Any device, any network.** Every screen is checked on small, cheap phones and slow connections before release.
5. **Nothing silently lost.** Unsaved work stays on the phone, and every important action is logged.
6. **Low cost.** Free today, and at most US$5 a month if growth needs it.

---

## 12. What we ask of stakeholders

1. **Approve the pilot** with SPS Group 2 for two weeks, alongside the current sheet, comparing numbers week by week.
2. **Name coordinators** for DPS, BSS and BVS, so each batch can be rolled out.
3. **Approve Cloudflare Workers Paid (US$5 a month)** before the full roll-out (see the *Load test report*).
4. **Keep the facilitator list current:** when the IYF head adds a facilitator in the app, add the same name to the dashboard's NameMap.
5. **Brief coordinators:** approve a password reset only after calling the devotee.
6. **Encourage devotees** to add the app to their home screen and allow the 9 PM reminder.

---

*Hare Kṛṣṇa · ISKCON Youth Forum, Delhi*
