# Sadhana App: agreed design

Devotees submit their own weekly sadhana. Batch coordinators approve devotees and watch who has filled it in. The master (IYF head) manages coordinators and sees every batch. Data lands in a Google Sheet that feeds the existing Raw → Eligibility → dashboard chain unchanged.

Status: design agreed 2 Oct 2026. Nothing is built yet. Replaces the 26 Sep "coordinators enter the data" plan (`sadhana-entry-sheet-plan.md`). Its corrections, log and Data Health ideas carry over.

The frontend and backend are built against the API contract in `sadhana-api-contract.md`.

---

## 1. Decisions (2 Oct 2026)

| # | Decision |
|---|---|
| 1 | No Google or email sign-in. Devotees sign up with their **phone number** and a **password of their own choice**, following current password standards (NIST SP 800-63B): at least 8 characters, any characters, no forced symbols, at most 64; refused if it is a commonly used password or the phone number itself. Stored only as a salted, slow one-way hash (PBKDF2-SHA-256, tuned to about half a second on the server), with lockout after repeated failures. |
| 2 | A sign-up waits as PENDING until the **batch coordinator** approves it. Only batch coordinators approve; group leaders do not. |
| 3 | **Coordinators** mark devotees active or inactive, **and can reactivate** them. |
| 3a | Approval happens **once**, at sign-up. A coordinator change never needs re-approval. A **forgotten password** is the one exception: the reset needs the coordinator's approval again (section 3). |
| 3c | Passwords are never readable by anyone, coordinators and master included. A reset is approved; it is never handed over. |
| 8 | **Night Stay** is **Yes / No** for every batch. When weeks are copied across for Raw, "Yes" is written as "Yes Coming", so the dashboard's SPS → DPS night-stay check is unchanged. |
| 9 | **Weeks run Monday to Sunday.** |
| 10 | **Drafts live on the server.** A devotee can fill in day by day or the whole week at once, on any device, and submits from Sunday night. |
| 11 | **One response per devotee per week.** The 7 day entries and the week-end section (Night Stay, chanting, 4 regulative principles) are submitted together, once. There is no separate monthly submission. |
| 12 | **Daily form follows COSATOK (Connect A Soul To Krishna)**, the central app, and stores what was typed (times and minutes). Card marks are worked out on the server. |
| 13 | **Japa** is scored from the time chanting was actually finished. **Optional:** Exercise, Study/Job, Hearing / Reading / Service topics, Positive / Negative Chetna, Comment. |
| 14 | **Profile:** date of birth, blood group, emergency contact (name, relation, phone). **No ID of any kind** (decided 2 Oct 2026): no Aadhaar, Voter ID or other number, and no record of an ID being checked. The verified **phone number** is the identity; Indian SIMs are issued only after an ID check, and the coordinator's approval does the rest. **Optional face photo** of the devotee (never a photo of an ID), section 3a. |
| 15 | **Birthday reminders** appear in the app only: a "Today's birthdays" panel for the batch coordinator and the master. **No e-mails or other outside reminders of any kind.** |
| 16 | **KC monthly form is dropped.** No SPS → DPS rule uses it. |
| 17 | **Submit window: Sunday 6:00 PM to Monday 9:00 PM (IST).** The master can change it. After it closes, an unsubmitted week is MISSED and its draft is dropped (decision 31). Only the master can reopen it, and the devotee then fills it in again from scratch. |
| 18 | **No COSATOK export.** Everything lives in Google Sheets. Typed values are kept only because the card marks are worked out from them. |
| 19 | **Four batches, one coordinator each: SPS, DPS, BSS, BVS.** |
| 20 | **All four batches are standing categories** (SPS, DPS, BSS, BVS): no start or end date, devotees stay as long as they are at that level. Each devotee's level-entry date is set at approval. Batch type stays a setting, in case this changes. |
| 21 | **IYF IDs: one allotter, one ID per person** (section 3b). The dashboard's Devotees tab stays the only place that creates IDs; the app only reads it and never changes the dashboard. The app accepts only IDs that exist there, links existing ones at approval, and links new ones automatically once the dashboard allocates them. The master manages links from the admin screen. |
| 22 | **A password reset replaces only the password.** The devotee's data, submissions and profile are untouched. Other devices are signed out, which is the standard practice. |
| 23 | **Hearing and Reading topics are required whenever their minutes are above 0.** Pick from the batch's hearing / reading journal list, or type your own. With 0 minutes no topic is needed. |
| 24 | **The server owns the weeks:** it decides the current week, refuses a second entry for the same week, and lets a devotee work only on their **last 2 weeks**; anything older is locked. |
| 25 | **Separation of concerns is visible in Google Drive:** one file per concern (section 2a). |
| 26 | **No late weeks, no changes.** After Monday 9 PM a week is closed for good, and a submitted week can never be edited. "Last 2 weeks" means only that from Monday morning until 9 PM two weeks are open: the one just ended (to submit) and the new one (to fill). Nothing older is open. |
| 27 | **One shared SPS coordinator account** for now, used by 3 coordinators, covering the SPS, SPS Group 2 and SPS Online tabs. Coordinator accounts log in with a **username** (e.g. "sps"), not a personal phone. The design allows several coordinators per batch, so the account can be split later with no other change. |
| 28 | **Scoring uses the Excel score cards for every level, not COSATOK.** SPS uses the SPS card (DOC-20260914-WA0028.xlsx). DPS, BSS and BVS use the "BVS, DPS, BSS Sadhana Score Card". Negative marks (−5) and each card's Seva rule are kept as they are. Chanting rounds are not scored; the cards do not score them. |
| 29 | **Every score is a percentage from 0 to 100, never more and never less** (the head, 2 Oct 2026): category, Seva, attendance, Body, Soul, Overall and a day's %. Each option keeps the card's own marks (−5 included); only the percentage is held to 0–100, so a week of −5 options scores 0%, not −20%. SPS Seva ÷ 90 can no longer pass 100. An SPS sleep after 11:30 PM scores 0. |
| 30 | **Attendance.** The coordinator marks each devotee Present or Absent for the week, and the devotee can also mark it; **the coordinator's mark wins**. Present = 100, Absent = 0. **It locks with the week at the Monday 9 PM deadline.** Until then the coordinator can mark or change it, even if the devotee has already submitted. After the deadline **only the master** can change it, and the change is logged. |
| 31 | **At the Monday 9 PM deadline, an unsubmitted week's draft is dropped**, not kept, and the week shows as MISSED. Each drop is logged in AuditLog (devotee, week, days filled, time) and counted in the coordinator's and master's views. A devotee's own data can be changed only until they press Submit, and never after the deadline. |
| 32 | **Share with the facilitator (2 Oct 2026).** A **Share** button on every day card (draft or complete) and on the week summary (after Submit) builds a WhatsApp-ready message in the style the head sends from COSATOK today, and opens the phone's share sheet (WhatsApp, Telegram, …); "Copy" where sharing is not available. Built on the phone from the devotee's own data and their batch's card, so it costs no server time and sends nothing to anyone the devotee does not choose. The fields follow the batch's card: each scored answer shows its card range and marks (e.g. *Prev Night Sleep Time*: 10:15 PM (10:15–10:30 PM · 20)); chanting rounds, exercise, study/job, topics and Chetna are listed without marks (the cards do not score them). Day share: the day's answers, its marks out of 150 and as a %. Week share: the 7 category %, Seva, attendance, Body, Soul, Overall, Night Stay and the 4 regulative principles. Built in phase 3 with the weekly form. |
| 33 | **Clean data for the dashboard is the main purpose (the head, 2 Oct 2026).** Nothing the dashboard groups or matches by is ever typed: the **facilitator** is picked from the dashboard's own canonical list (NameMap › Canonical name, 42 names, copied read-only every 30 minutes like the IYF IDs; a new facilitator is added to NameMap first, then appears in the app); the **group leader (Head Name)** is **optional** (the head, 2 Oct 2026: only the facilitator is required), and when given it is picked from a clean per-batch list kept in the app (seeded from the names used in 2026 with duplicate spellings merged and placeholders such as "TBA" and "Inactive Devotee" left out; coordinators maintain it). Both are chosen at sign-up and confirmed by the coordinator at approval (facilitator required, group leader optional); only coordinators change them later (with history). The bridge (phase 5) writes each batch tab by its column names, the canonical facilitator spelling, the clean Head Name, the IYF ID in Unique Id, whole-number Chanting Round, and Night Stay / principles in the tab's own choices, so the import never meets a spelling it has to repair. |
| 34 | **One person, one login; scopes (2 Oct 2026).** Everyone logs in with their own phone and password. A person can be a **devotee** (approved into a batch: fills their own sadhana), a **coordinator** (the master assigns batches to their login) and a **master** (granted by a master) at once. The side menu shows only the sections their scopes allow. Nobody approves their own sign-up or reset; a master-scoped account's reset needs another master. The shared `sps` login retires once SPS coordinators have their own; the `master` username stays only for recovery and can never lose master scope; there is always at least one master. |
| 35 | **Announcement wall (2 Oct 2026).** Coordinators post to the batches they coordinate; masters to everyone or chosen batches. Each person sees posts for everyone, for their own batch, or for batches they coordinate (masters see all); pinned first; optional end date. Plain text, never HTML. Author or a master can edit or remove (kept, audited). In-app only, with an unread bell (decision 15). |
| 36 | **Weeks with no regular class (3 Oct 2026, the user).** Attendance is one mark per devotee per week (one class a week). A coordinator or the master can mark a week as a holiday, a festival or another reason, with a note, and choose: **everyone Present**, or **only those the coordinator marks Present** (e.g. who came to the festival), everyone else Absent. A mark for one person still wins; the master can overwrite the week or any mark, even after the deadline, with a logged reason. A mark given after the devotee submitted counts: the submitted row keeps its original scores, and the app, view sheets and bridge use Attendance and Overall worked out with the final mark. |
| 37 | **Class day, contact details, no group leader (3 Oct 2026, the head).** There is **one class a week across all batches, on Sunday or Saturday**; each devotee belongs to one (asked at sign-up, confirmed or corrected by the coordinator; the Saturday flow comes later). Attendance is the mark for that class: the coordinator sees the batch's active devotees and marks Present / Absent **from the class day** (Sunday 00:00, Saturday for the Saturday class) until the Monday 9 PM deadline; nobody can be marked before the class. Sign-up also asks for a **valid email address** (format and mail-domain checked, common misspellings pointed out; never written to, decision 15) and a **WhatsApp number** (usually the login phone). The **group leader is no longer asked for or kept**: Head Name goes to Raw blank (the dashboard import needs the column, not a value); old values stay in the store for history. |
| 38 | **The 9 PM reminder (3 Oct 2026, the head; relaxes decision 15 for this one reminder).** A devotee can turn on a daily reminder in the app (per phone, at most 5). Around 9 PM IST the server sends an empty Web Push to the phones of active devotees whose day is not filled yet (on Sunday: whose week is not submitted); the app on the phone shows the words and opens the app when tapped. No message content leaves the server, nothing is emailed, and the time is a master setting. iPhones need the app added to the Home Screen first (iOS 16.4+). On the Free plan it goes out 35 phones a minute (about 1 minute per 35 people); the Workers Paid plan would send to everyone at once. |
| 39 | **The master manages the facilitator list, and the sheets show everything (3 Oct 2026, the head).** Admin › Facilitators: every name starts switched on; the master adds a name, switches one off (no longer offered at sign-up, at the coordinator's approval or in a devotee's edit; devotees who have it keep it) and deletes one once it is off. The three places read one list, so a change shows everywhere at once. The dashboard's NameMap still feeds the list nightly but never undoes the master. A name added in the app is marked "not in NameMap yet": the dashboard owner adds it to NameMap so the import recognises it (the app never writes the dashboard). Every table the app keeps is copied to the store sheets for the people coordinating devotees (Facilitators, Announcements, DuplicateReviews, MissedWeeks and ReopenRequests added), except passwords, tokens, pictures and phone notification addresses (drafts added 3 Oct 2026: coordinators who work in sheets see the week as it fills). |
| 40 | **Every write is incremental; 2,000–5,000 devotees on the free plan (3 Oct 2026, the head).** Nothing is rewritten whole on a schedule: the store sheets copy only changed rows, drafts and open-week attendance included, within about a minute (an append-only change log kept by triggers, migration 0022); the four batch view sheets insert a new submission as one row at its place, rewrite only changed rows of This week and a week's rows when its attendance changes, and drop old weeks once a week (migration 0020; same tabs and columns); the dashboard's ID list and NameMap are copied only when they change, and then only the changed rows; the 9 PM reminder writes nothing per phone; rate-limit refusals are not logged. Measured: submit 6 rows written (was ~14), a day's save 2 (a repeated identical save 0), an attendance mark 1; a quiet day writes almost nothing; with drafts and attendance copied live the free plan is comfortable to about 4,500 devotees. Coordinators cannot change, or approve a password reset for, a person who coordinates another batch or is the IYF head (security review): only a master can. Upgrade to Workers Paid (US$5/month) when the daily usage in `load-test-report.md` § "When to upgrade" is reached. |
| 41 | **Group leaders, attendance levels and times (3 Oct 2026, the head).** One class a week on **Sunday** for everyone (Saturday-class devotees too): attendance opens Sunday 00:00 IST; **Night Stay and the 4 regulative principles open Saturday 6 PM**. The batch coordinator appoints **group leaders**, student devotees of the batch; each leads one group drawn from every batch of the same level (SPS, SPS Group 2 and SPS Online are one pool), a devotee is in at most one group, a leader in none. The leader marks the group's Sunday attendance and follows each member's week (call and WhatsApp links next to each name). Levels: **IYF head › coordinator › group leader › no-class week › the devotee's own**; each writes only its own column, within the time limits (the head also after the deadline). A leader's own attendance is marked by the coordinator. When a higher mark differs from the devotee's own, the devotee sees a note in the app and gets one notification (the marker sits on the same attendance row: no extra table). Contact details (email, WhatsApp, **address**, emergency contact) are changed only by the devotee; the address is required at sign-up from 3 Oct; coordinators and the head see them. The head filters Members by blood group. Screens: My group (leader), Batch › Group leaders (coordinator, head). The app's time locks follow the server's clock (`serverTime`), so a phone with a wrong clock shows the same locks. **Later the same evening (the head's review):** the 9 PM notification goes to every devotee every day ("filled ✓" or "not filled yet"), pops up and vibrates; a renewed push address keeps the person (`push.renew`). Status board and My group pick the week by **month and week**; the Status counts sit in one row; Members is compact (a 2×2 filter grid, one status row, one line per person with Call and WhatsApp); the IYF head has a Group leaders tab for any batch; Average rounds moved from the weekly form to the Report; Account has no explanatory notes about the system, and the unused "pages you read in an hour" field was removed from it (the value stays on the server, unused). |
| 42 | **The submitted week as one compact JSON (3 Oct 2026, the head).** `submissions.week_json` (v 1) holds the whole week (7 days with their card marks, week-end, attendance, seva minutes, scores); the daily report is read from it and the facilitator dashboard will use the same format for filtering. Older rows keep `days_json` / `marks_json` and read the same way. Format in `sadhana-api-contract.md` § 8c. |
| 43 | **Viewing and filling are two permissions; facilitator logins (4 Oct 2026, the head).** A devotee's sadhana can be **viewed** (read-only: the week day by day, scores, week-end) or **filled** for them. Facilitators view only — the devotees whose facilitator they are, any batch, with a call or WhatsApp; a coordinator views and fills only the week being filled now, in their batches; the IYF head views and fills any week. The head gives a facilitator a login from Admin › Facilitators (a staff login with no batches, tied to the facilitator's name; never among coordinators). Devotees see only a devotee's view (no audience of posts, no staff controls). |
| 44 | **Posts like social media (4 Oct 2026, the head).** Each announcement is a post: author and time, text and picture, Like, Comment and Share (WhatsApp, prepared on the phone). Comments are copied to Sheets; likes are only counted there (a nightly refresh), to spare the free plan's writes on a busy Sunday. Coordinators post to their own batches; only the head chooses or changes an audience. |
| 45 | **A part week is an option, not an exception (4 Oct 2026, the head; replaces "whole week or nothing" in decisions 17 and 31).** A week can be submitted with the days that are complete, at least one; a day not complete is left out and counts **0 marks**, so each daily category is the week's marks ÷ 175 and the score is capped by the days filled (1 perfect day ≈ 14%, 5 ≈ 71%, 7 = 100%); Attendance and Seva stay weekly, as in the sheets. The app says "3 of 7 days complete" and what the cap is before Submit, and names the days left out. **At the Monday 9 PM deadline** a draft with at least one complete day is submitted as it stands (by DEADLINE); a week with **no complete day is MISSED and scores 0** everywhere a score is shown or averaged. `submissions.days_filled` (migration 0029; blank on older Sheets rows = 7) and `week_json.daysFilled` carry the count. **The bridge** (phase 5) writes a part week as a normal row with these capped percentages plus a `Days Filled` column, and a MISSED week as a 0-score row, so skipping a week is never better than filling part of it under the dashboard's promotion rule (which averages Overall over the weeks that have a row). |
| 46 | **The server makes the reset password; shown once (14 Oct 2026, the head; replaces the requester-chosen password in decision 15's reset flow).** "I forgot my password" asks for **nothing but the phone number** — the person requesting can no longer choose the password, which is what let anyone who knew a number queue one for an account they did not own. On **approval** the server generates a temporary password, keeps only its hash, forces a change at first sign-in, ends that account's sessions, and shows the password to the approving coordinator **once, in the approval response**. It is never stored in clear and there is no second place to read it: once the coordinator closes the dialog it is gone for good. If it is lost, or not handed over in 24 hours, the **devotee sends a new request** and the coordinator approves again for a fresh one. The coordinator hands it over in person or on their own WhatsApp — the app sends no password anywhere, so decision 15 (no outside messages) and "no OTP anywhere" both stand; Web Push only says a reset was approved, never the password itself. Rejected: WhatsApp Business API (paid per message, needs Meta business verification and an approved authentication template) and email (decision 15 forbids it, and it would need a domain with SPF and DKIM). **Built 14 Oct 2026** (migration 0048): the password is 12 characters in three groups of four from a 28-symbol alphabet with 0/O, 1/l/I, 5/S and 8/B removed, because a coordinator reads it aloud; it expires in 24 hours; the owner signing in cancels a waiting request; the dialog has no backdrop tap, no Escape and no close button, only “I have shared it”. Still to come: the push notice telling the devotee a reset was approved (never the password) — all push runs through scheduled jobs, so that is its own change. |
| 47 | **Training runs ALONGSIDE the batch, not instead of it (14 Oct 2026, the head).** This is the rule for **EVERY programme the LMS runs** — MTP, ETP and iLS today, and whatever is added later; it is a property of training itself, not of those three. A programme is **sideways training a person takes while they continue their ordinary batch class**. A devotee in SPS on any programme is still in SPS: they fill their week, their attendance is marked, their sadhana scores as before, and the training is a second thing happening in parallel. It is NOT a batch they move into and NOT a level they are promoted to. So: a person has at most one sadhana membership at a time (`memberships`, unchanged), and **any number of concurrent training enrolments** (`enrollments`, one per training batch). Nothing in the LMP may change `memberships`, the score card, the class day or the weekly form — finishing a programme — any programme — does not move anyone between SPS, DPS, BSS, BVS, VL-2 or VL-3. **This is why the LMS is being built INTO the Sadhana app rather than beside it:** the person, their batch, their attendance and their sadhana are already here, and a programme is one more thing recorded against the same person, not a second system with its own copy of them. The two only meet on a person's profile, where the training summary appears beside the sadhana record. **Promotion is the separate thing**: VL-3 → SPS and the rest move a person's BATCH and are decided on attendance and chanting, not on a training programme. |
| 7 | **Backend (changed 2 Oct 2026 after measuring Apps Script on the live Phase 1 server: 1.5–12.5 s per call even when our code took well under a second):** a **Cloudflare Worker** (the API) with a **Cloudflare D1** database as the main copy; **Google Sheets are a live copy** written by the service account every few minutes (view sheets for group leaders, the store files for the head, the bridge to the dashboard). Calls take about 0.1–0.3 s. Photos still go to a private Drive folder. The Apps Script server built for Phase 1 is retired. *Earlier:* Apps Script, with Google Sheets as the store. **Frontend:** a separate installable web app (PWA) built with Svelte 5 + Vite + Tailwind CSS, uPlot charts on coordinator/master screens only, hosted free on Cloudflare Pages (section 2b). Group leaders get **view-only, easy-to-read sheets** for their batch. Built for 1–2K submissions a week (section 7b). |
| 3b | **Coordinators and the master** can both **disable** or **delete** a devotee. |
| 4 | The **master** manages coordinators from an access-management screen: create, reset password, assign or move batches, deactivate. Coordinators change over time, so batches belong to the batch, not the person. |
| 5 | The **master sees analytics for all batches**: active and inactive counts, who filled in, trends. **A coordinator sees only their own batch(es).** |
| 6 | A submission is **complete or it is not accepted**. The server enforces this, not only the page. |

## 2. Architecture

```
Phone / laptop ── static web app (free hosting) ──▶ Apps Script API (runs as owner; the only writer)
                                                      │ session → account → role → batch
                                                      │ lock → validate → score → write → audit
                                                      ▼
                                       Sadhana Store (Google Sheet, owner-only)
                                                      │ nightly: SUBMITTED weeks only
                                                      ▼
                     current sadhana-sheet columns → existing import → Raw → Eligibility → dashboard
```

### 2b. Frontend (decided 2 Oct 2026)

| Part | Choice |
|---|---|
| Framework | Svelte 5 + Vite, one single-page app for all roles; admin and chart code loaded only for coordinators and the master |
| Phone app | PWA: "Add to Home screen" / "Install" from the browser, own icon, full screen, opens instantly after the first visit; no Play Store or App Store |
| Styling | Tailwind CSS, the phone's own fonts, dark mode |
| Charts | uPlot, coordinator and master screens only |
| Hosting | Cloudflare (free; Pages now runs as Workers static assets): the app at https://sadhana-record.iyfdelhi-sadhana.workers.dev, the API at https://sadhana-record-api.iyfdelhi-sadhana.workers.dev. Deployed with `npx wrangler deploy` from `frontend/` and `worker/` |
| Talking to the server | `fetch` to the Apps Script web-app URL with `Content-Type: text/plain` (avoids the cross-site pre-check Apps Script cannot answer); JSON in and out |
| Offline | the app itself is cached on the device; only unsent draft changes are kept locally (IndexedDB) and sent when the signal returns; the server's draft is the real one |
| Budget | first visit ≈ 60–80 KB; later visits ≈ only the data |
| Low-end phones (decided 2 Oct 2026) | Built for ₹6–8K Android phones (2–3 GB RAM) on slow 4G, not only flagships. Limits checked on every build: devotee screens ≤ 60 KB of JavaScript and ≤ 15 KB of CSS (compressed); no web fonts, no images except the small profile photo; no animation libraries (only short CSS transitions, switched off when the phone asks for reduced motion); long lists drawn only as they scroll; the 324-lecture and 76-book lists searched on the phone from the cached copy. Tested on a throttled mid-range Android profile (Lighthouse mobile performance ≥ 90; first screen usable within 3 s on slow 4G) |
| Language | English only (decided 2 Oct 2026) |

### 2d. Cloudflare Worker + D1, Sheets as a copy (decided 2 Oct 2026)

```
Phone ──▶ Cloudflare Pages (the app) ──▶ Cloudflare Worker (the API, 0.1–0.3 s) ──▶ D1 database (main copy)
                                                   │ cron, every few minutes
                                                   ▼
                     Google Sheets via the service account iyf-delhi@sadhanareport (editor on the 9 files):
                     · the 9 Sadhana Record files: a readable copy (never password hashes or session tokens)
                     · reads the dashboard's Devotees tab into a local registry copy (needs Viewer access)
                     · later: the bridge into the sadhana sheet → Raw → dashboard (phase 5)
```

- **Why:** measured on the live Apps Script server, every call took 1.5–12.5 s even when our code finished in well under a second (Google's own start-up). Workers answer from Cloudflare's servers in India in about 0.1–0.3 s.
- **The main copy is D1.** A schedule every minute copies what changed to the Sheets, at most 300 rows a run (the Free plan allows 10 ms of processing per run), so the sheets lag about a minute, up to about 7 minutes at the Monday peak. Nobody edits the copies by hand; if someone does, the next copy overwrites it.
- **Security:** password hashes, salts and session tokens stay in D1 only; the sheet copies leave those columns blank. Secrets (the pepper, the service-account key) are Worker secrets, never in git.
- **Passwords:** PBKDF2-SHA-256 through Web Crypto, with the pepper. Cloudflare allows at most 100,000 rounds. On the Workers **Free** plan each request may use only 10 ms of CPU, which allows roughly 5,000–10,000 rounds; the **Workers Paid** plan (US$5 a month) allows the full 100,000.
- **Limits that matter (Free plan):** 100,000 requests a day, D1 5 GB, 5 million rows read and 100,000 rows written a day (shared by the whole Cloudflare account, reset 05:30 IST), 5 scheduled jobs, 10 ms of CPU a call. Phase 6 (3 Oct 2026) made every write incremental (decision 40) so 2,000–5,000 devotees fit; see `load-test-report.md`.
- **Backups:** D1 keeps point-in-time history (Time Travel): 7 days on the Free plan, 30 on Workers Paid; plus the Google Sheets copy (changed rows within minutes), plus a weekly full export kept by the owner. Drill done 3 Oct 2026 (restore in 4 s, export in 7 s): `backup-restore.md`.
- **Unchanged:** the API contract, the app, the 9 spreadsheets and their layout, the rules in this document.

### 2c. Built to last (reviewed 2 Oct 2026)

1. **One API, named actions.** The app calls actions such as `signUp`, `approve`, `saveDraft`, `submitWeek`, `getHome`, `getBatchStatus`, each with a version number. It never knows that Sheets is underneath.
2. **A data layer.** Only one file (`Store.gs`) reads or writes Sheets and Drive; every other file calls its functions (`getAccount`, `putSubmission` …). Moving to a real database later (Supabase / PostgreSQL) means rewriting that one file, not the app.
3. **One request per screen.** Each screen gets everything it needs in one call (for example `getHome` = profile + this week's draft + topic-list version).
4. **Corrections go through the app, not the sheet.** The master fixes data from the admin screen, so every change is checked and logged. The store stays owner-only, with no hand edits; people read the view sheets instead.
5. **Backups (changed 3 Oct 2026: see `backup-restore.md`).** *Planned, not built:* a nightly job copying the store spreadsheets into an owner-only *Sadhana Backups* Drive folder (the service account cannot create files, so it cannot make the copies). *In place instead:* D1 Time Travel (any minute of the last 7 days), the live Sheets copy, and a weekly `wrangler d1 export` kept by the owner. Original plan: the last 14 nightly copies and the first copy of each month for a year are kept, older ones are deleted. Restoring = copying one file back.
6. **Everything in git.** The frontend deploys from git to Cloudflare Pages. The Apps Script code is kept in the same repository and pushed with `clasp` (Google's command-line tool), so every server change is recorded and can be undone.

### 2a. The files, one per concern

| File | Tabs | Who can open it |
|---|---|---|
| Sadhana · Access | Accounts, Batches (6: SPS, SPS2, SPSO, DPS, BSS, BVS), Memberships, ResetRequests, Sessions, AuditLog, RunLog | Owner only |
| Sadhana · Profiles | Profiles (birthday, blood group, emergency contact, photo file id) | Owner only (coordinators see their batch in the app) |
| (no Drive folder) | Photos are kept in the app's database since 3 Oct 2026 (section 3a) | Shown only through the app |
| Sadhana · Rules | Settings (submit window, limits, versions), CardRanges, SevaRules, ChetnaOptions, Lectures, Books | Owner only |
| Sadhana · Drafts | Drafts (one row per devotee-week, one cell per day so days never overwrite each other) | Owner only |
| Sadhana · Submissions 2026 | Submissions, Attendance, Reopens (a new file each year) | Owner only |
| Sadhana View · SPS / DPS / BSS / BVS | This week, Scores, Days, Week-end. The SPS view covers SPS, SPS Group 2 and SPS Online (one shared coordinator); split it later if group leaders should see only their own group. | View-only: that level's coordinator and group leaders |

**Who makes and owns the files (decided 2 Oct 2026):** all files are new, made for this app (no existing batch sheet is reused). They are **owned by `iyfdelhi.database@gmail.com`**, a dedicated Google account (separate from the dashboard, so daily limits are not shared), not by a service account: Google gives service accounts no Drive storage (tested: 0 bytes, create refused), and files owned by a service account disappear if it is ever deleted. The owner created the 9 empty spreadsheets and shared them with the build service account `iyf-delhi@sadhanareport.iam.gserviceaccount.com` as Editor (ids in `sadhanaRecord/setup/files.json`). That service account built every tab, header, note, dropdown and protection from `setup/schema.mjs` with `setup/build-store.mjs` (2 Oct 2026). The *Sadhana Photos* and *Sadhana Backups* Drive folders are made by the backend's one-time setup, which runs as the owner. The live app never uses it: the Apps Script backend runs as the owner.

**Who sees which sheet:**
- **The store** (Accounts, Submissions …) is owner-only. Nobody edits it by hand; only the API writes to it.
- **One read-only "view" spreadsheet per batch**, refreshed by the API on every submit and rebuilt nightly, is shared view-only with that batch's coordinator and group leaders. Sheets can only share whole files, not single tabs, so separate files keep each batch's data to that batch. Each one has:
  - a *This week* tab: one row per devotee showing Submitted / Draft / Not started / Missed
  - a *Weeks* tab: day by day, in plain words ("10:00 – 10:15 PM · 25"), with the percentages, Body, Soul and Overall
  - a *Monthly* tab

  Each tab has frozen headers, names (not only IDs), status colours and the newest week first.

₹0 a month. A separate Apps Script project and spreadsheet from the dashboard, ideally under a different Google account, because daily limits are counted per account.

## 3. Accounts and sign-in

| Step | What happens |
|---|---|
| Sign up | Phone, name, **batch** (the coordinator's name is shown), password. Status PENDING; cannot log in. |
| Approve | The batch's current coordinator sees the request with the registry's suggested match (section 3b) and confirms it, picks another existing ID, or approves with no ID yet. Approve → ACTIVE (linked when an ID was chosen). Reject → REJECTED. |
| Log in | Phone + password. Remembered on that device for 30 days. |
| Forgot password | The devotee taps "Forgot password", enters their phone and chooses a **new password**. That creates a reset request for their batch coordinator. Until the coordinator approves, the old password still works and the new one does not. On approval the new one takes over and all old sessions end. No password is ever shown to anyone. The master resets coordinators' passwords the same way. |
| Inactive | Automatic (ADR 0020, Phase 23): after 30 days with no day of sadhana filled AND no use of the app (counted from the first tracked week), the daily job makes the membership inactive; filling a day or using the app makes them active again at once. A coordinator or the head can also mark someone inactive from a given week; that is not undone by using the app, only by a filled day or "Make active again". Either way the devotee drops off every count, history is kept and the login keeps working. Coordinators (their batches) and the head (all of IYF) see who became inactive and who came back on Home and in the bell, and the counts now, by month and by day (Filling chart; Admin › All batches). No outside message. Blocking the login is Disabled. |
| Disable | Coordinator or master. Login is blocked at once and any open session ends. The devotee stays on record and can be re-enabled without a new approval. |
| Delete | Coordinator or master, after a confirmation. The login is removed and the phone number is free to sign up again, which then needs a new approval. **Submitted weeks are kept**, because they are already in Raw and count towards eligibility. Drafts are discarded. The profile photo is deleted. Logged in AuditLog. |
| Coordinator change | The master moves the batch to the new coordinator, who then sees its devotees, history and pending requests. The old coordinator's access to that batch ends at once. |

**Storage:** an owner-only **Accounts** tab, not Script Properties (which holds only about 38 accounts).
- **Passwords:** salted hashes only, repeated many times. Nobody can read a password, not even the master.
- **Lockout:** after 5 wrong tries the account locks for 15 minutes.
- **Sessions:** random tokens stored as hashes, with an expiry date.

### 3a. Profile photo (optional, decided 2 Oct 2026)

- **What:** a photo of the devotee's face, to help the coordinator recognise them. Never a photo of an ID card. Optional at sign-up and any time later.
- **Consent:** one line beside the upload: "Your photo is seen only by your batch coordinator and the IYF head, and is deleted if your account is deleted."
- **Size:** any photo, of any size (a 10 MB camera photo, a screenshot, a gallery image), is shrunk on the phone to 400 × 400 px JPEG (about 30–50 KB) before sending, so uploads work on slow data and Drive use stays tiny (2,000 devotees ≈ 100 MB). The devotee drags and zooms to place their face in the square first.
  - Re-drawing the image also strips its hidden details (GPS location, phone model, date), so these never reach the server.
  - Sideways phone photos are turned upright.
  - The server checks it again: it accepts only a JPEG of at most 400 × 400 px and 150 KB, so nothing larger can be stored even if someone bypasses the app.
- **Storage (changed 3 Oct 2026):** the server keeps it in its own database (D1 table `photos`, by login), not in Drive: Google gives the service account no Drive storage, and the Worker has no other way to write to Drive. It is never copied to Sheets, never made public or link-shared, and is served only through `photo.get` to the people below. About 50 KB each, so 2,000 photos ≈ 100 MB of the free 5 GB.
- **Who sees it:** the devotee, their batch's coordinator (approval screen, devotee list) and the master. Never in the group leaders' view sheets.
- **Changes:** the devotee can replace or remove their own photo; no re-approval needed. The coordinator or master can remove an unsuitable photo (logged in AuditLog).
- **Showing it:** the app asks the server for the photo only when it is on screen, and the browser keeps a copy, so lists of devotees stay fast.
- **Delete:** deleting the account deletes the photo.

### 3b. IYF IDs (decided 2 Oct 2026; read-only since the same day)

**The app is a separate project and never changes the dashboard** (the user's instruction, 2 Oct 2026). The dashboard's Devotees tab stays the only place that creates IYF IDs; the Sadhana server only reads it (API contract §6). This needs view access for `iyfdelhi.database@gmail.com` on the dashboard spreadsheet, and nothing else on the dashboard side.

**Only allocated IDs are accepted.** An ID is accepted only if it exists in the Devotees tab, is not marked "Merged into …", and no other account has it. The format alone is never enough. Devotees never type an ID; coordinators and the master pick from registry search results, and the server re-reads the registry when linking.

**At approval** the coordinator sees the registry's matches and either confirms one, picks another existing ID (search), or approves with **no ID yet** (someone the registry does not know). Devotees are identified in the app by their login (phone), so they can use it fully before an ID exists.

**A new devotee's ID** comes from the dashboard's own hourly registration, once their first submitted week reaches Raw through the bridge (phase 5). The nightly link job then links it automatically (exactly one match by phone + name).

**No one gets two IDs:**
- one account per IYF ID, one account per phone
- a linked devotee's weeks are copied with the registry's own name and phone for that ID, so the registry always recognises them, even if they signed up with a new phone
- an unlinked devotee's weeks use their sign-up name and phone, which the registry allocates once

**Shared phones.** 18 phone numbers in the registry belong to 2 people each (36 IDs, status "CHECK"). Each devotee signs up with their own number; the coordinator links them to their existing ID, and their weeks keep using the registry's details for that ID.

**ID management in the app (master):** search; see an ID's phones, spellings and linked account; link, unlink or relink an account; a list of possible duplicates to review. **Merging** two IDs stays in the dashboard, where it is done today; the app shows "Merged into X" once the dashboard marks it.

**Already in the registry:** 45 names appear under 2 or more IDs. Some are different people with common names, some may be duplicates. They are listed for review; nothing is merged automatically.

## 4. Roles

| Role | Can | Cannot |
|---|---|---|
| MASTER | Everything: coordinators, batches, disable / delete any devotee, all analytics, reopen missed weeks, attendance after the deadline, IYF ID management, rules | — |
| COORDINATOR | Their batch(es): approve or reject sign-ups (once per devotee), active / inactive / reactivate, disable / delete, reset devotee passwords, the status list, the filling graph, view submissions, submit on someone's behalf (marked as such), request a reopen | Other batches; changing a submitted week |
| DEVOTEE | Own drafts, submit, own history, change own password | Anyone else's data |

The server applies every rule. Nothing the page sends ("I am devotee X", "batch Y") is trusted.

## 5. Data (one owner-only Google Sheet)

| Tab | Key | Holds |
|---|---|---|
| Accounts | login (phone; a username for coordinators) | name, role, iyf_id, status (PENDING / ACTIVE / INACTIVE / DISABLED / REJECTED; a deleted account is removed here and noted in AuditLog), password hash, salt, failed tries, locked until, created / approved / changed by and when |
| Batches | batch_id | name, level (SPS, DPS, BVS, BSS), coordinator account(s), active |
| Memberships | (iyf_id, batch_id, from_week) | the batch and its active / inactive periods, so past weeks keep their right "expected" list; group leader name for Raw's Head Name |
| Rules | (card, category, option, version) | the score cards' option lists and marks: SPS card and BVS/DPS/BSS card; Seva rule per level |
| Drafts | (iyf_id, week_id) | work in progress; never read downstream |
| Submissions | unique (iyf_id, week_id) | 7 days × the daily fields, the week-end answers (Night Stay, 4 regulative principles, chanting average), plus server-computed marks, %, Seva score, Body, Soul; status, version, rule version, submitted at and by, request id |
| Sessions | token hash | phone, expires, device note |
| Attendance | (iyf_id, week_id) | devotee's mark, coordinator's mark, mark used, changed by, changed at |
| AuditLog | time | who, what, before, after, reason |

One row per devotee per week. week_id is the Monday date unless Phase 0 decides otherwise.

## 6. Submitting

- **Daily fields (as in COSATOK):**
  - **Required:** previous night's sleep time, wake-up time, chanting rounds, chanting finished at (time), completed same day (Yes / No), day rest (minutes), hearing (minutes), reading (minutes), service (minutes).
  - **Optional:** exercise (min), study / job (hrs), hearing / reading / service topics, Positive and Negative Chetna (multi-select), comment.
  - **Server mapping to the level's card:**
    - sleep → To Bed
    - wake-up → Wakeup
    - day rest → Day Sleep
    - finished-at → Japa
    - reading → Pathan
    - hearing → Sravan
    - weekly service minutes → Seva
  - **Boundaries:** a time on a range boundary belongs to the range it starts (10:15 → "10:15 – 10:30").
  - **Week span:** previous night's sleep means a day's entry is complete that evening; the week's To Bed covers Sunday night to Saturday night.
- **Attendance:**
  - Kept in an **Attendance** tab, one row per devotee per week: devotee's mark, coordinator's mark, the mark used (coordinator's if set, otherwise the devotee's), and who changed it and when.
  - Changeable by the coordinator **until the Monday 9 PM deadline**; after that **master only**, and logged.
  - The nightly copy into the sheet format uses the mark in force.
- **The Monday 9 PM deadline (a scheduled job on the server):**
  - Every unsubmitted week is closed.
  - Its draft is **deleted**.
  - A "dropped without submission" line goes in AuditLog (devotee, week, days filled).
  - The week shows as MISSED.
  - Attendance for that week locks; a coordinator's mark for a missed week stays on record.
- **Week-end section, in the same response:**
  - Night Stay (Yes / No)
  - 4 regulative principles (Yes / No)
  - chanting: the week's average of the daily rounds, shown, not typed again (it fills the sheet's Chanting Round)
- **Filling in:** one screen with 7 day cards (Monday to Sunday), each showing ✓ or ⚠.
  - Each change is saved to the server a few seconds after typing stops, per day. The draft lives on the server, so any device can carry on.
  - The phone keeps only changes that have not been sent yet (weak signal) and sends them later.
  - A day can be filled from that day onwards, never in advance; the server refuses future days.
  - Filling in daily is encouraged but not required; the whole week can be done on Sunday.
- **Two devices:** each day carries a version number. If two devices edit the same day, the later save wins and the other is told "updated on another device" and reloads.
- **States:** NOT_STARTED → DRAFT → SUBMITTED. A week not submitted by the deadline becomes MISSED (draft deleted, decision 31). Only a MISSED week can be reopened, by the master with a reason and an end time; it is REOPENED and empty, and the devotee fills it again from scratch. A submitted week is never changed (decision 26).
- **Server checks on Submit:**
  - a valid session
  - an ACTIVE devotee
  - the week inside the submit window
  - not already submitted, checked under a script lock
  - every day × category present and one of the allowed options for the devotee's level
  - Seva minutes a whole number from 0 to 999, with blank not counted as 0
  - the week-end answers present (Night Stay, 4 regulative principles)
- **Scores** are computed on the server.
- **Errors** are listed field by field ("Tuesday → Sravan missing").
- **Duplicates:** a retried request returns the first result, not a duplicate.

## 7. What each person sees

| | Master | Coordinator |
|---|---|---|
| This week | Every batch: submitted, draft (days filled), not started, missed | Own batch(es) only, one row per devotee |
| Trend | Filling % per batch per week, all batches | Own batch's filling graph |
| People | Active / inactive / pending counts per batch | Own pending requests, active / inactive list |
| Monthly | Completion per batch | Own batch |

## 7a. Benchmarks: exactly as the sadhana sheets have them (decided 2 Oct 2026)

The app copies the current benchmarks unchanged, **per batch**, because the batch tabs differ. Read from "New Sadhna Updation Apr'26 Onward" on 2 Oct 2026:

| | SPS | SPS Group 2 | SPS Online | DPS | BVS | BSS |
|---|---|---|---|---|---|---|
| Score card | SPS card | SPS card | SPS card | BVS/DPS/BSS card | same | same |
| bed … sravan | −100 to 100 | (no rule; guide says −100 to 100) | (none) | (none) | (none) | (none) |
| Attendance | 0–100 | 0–100 | −100 to 100 | (none) | −100 to 100 | 0–100 |
| Service | 0–200 | 0–200 | (none) | (none) | −100 to 100 | 0–200 |
| Night Stay | **Yes / No in the app** (today: Yes Coming / No, some tabs add Not Sure). "Yes" is written as "Yes Coming" in the copy for Raw | same | same | same | same | same |
| 4 regulative principles | **no column** | Yes / No | Yes / No | Yes / No | Yes / No | Yes / No |
| KC monthly form | **no column** | Yes Online / Yes Offline / No / Pending | Filled / Will fill | Filled / Will fill | Filled / Will fill | Filled / Will fill |
| Chanting Round | **no column** | whole number 0–64 (guide) | same | same | same | same |

Applies to every batch:
- **Body** = average of bed, wake up and day sleep.
- **Soul** = average of japa, pathan and sravan.
- **Overall** = average of Body, Soul, Attendance and Service.
- The tabs' "Score" column (Attendance 100 / 80 / 50 → 25) is kept as it is. The import does not read it.

Promotion benchmarks stay on the dashboard, unchanged:
- **VL-3 → SPS:** 50% attendance and 4 rounds.
- **SPS → DPS:** average Overall ≥ 80, night stay "Yes Coming" ≥ 80%, class attendance ≥ 80, latest month's chanting ≥ 8, principles Yes.
- **DPS → BVS/BSS:** the same, with 12 rounds.

Card scoring per level:
- **Categories:** week's marks ÷ 175 × 100, rounded.
- **Seva on the BVS/DPS/BSS card:** weekly minutes in steps of 0 / 20 / 40 / 60 / 80 / 100. The strict-"<" cut-offs (exactly 90 minutes scores 20) are kept.
- **Seva on the SPS card:** the week's minutes ÷ 90 × 100, from the SPS Excel card (section 7a-1).
- **Every score is capped at 100** (decision 29), so it always fits the batch tabs' limits.

## 7a-1. Scoring: the Excel cards, applied to exact times (decided 2 Oct 2026)

The devotee enters exact times and minutes. The server places each answer in its card's range and gives that range's marks, shown live ("22:10 → 10:00–10:15 PM · 25"). Range rules, kept in the Rules file:

| Answer | Rule | Examples |
|---|---|---|
| Clock times (sleep, wake-up, chanting finished) | a range includes its start, not its end | 22:15 → "10:15–10:30 PM"; 07:15 → "07:15–09:30 AM" |
| Earlier than the best range | the best range | SPS sleep 21:40 → "10:00–10:15 PM" · 25 |
| Later than the last range | the card's last option | BSS sleep 23:40 → "After 11:15 PM" · −5. SPS sleep 23:45 → "11:15–11:30 PM" · 0 (the SPS card has no later option). |
| Hearing and reading minutes | a range includes its lower number | BSS 45 min → "1 hr to 45 min" · 25; SPS 20 min → "24 to 20 min" · 20; 0 → "No Reading" / "No Hearing" |
| More than the top range | the top range | 75 min reading → 25 |
| Day rest | a range includes its upper number | 60 min → "1 hr or less" · 25; 75 min → "1 to 1:15 hr" · 20 |
| Chanting not completed the same day | Japa takes the card's last range | → "After 11:00 PM" · −5 |

**Seva:**
- **SPS:** the week's minutes ÷ 90 × 100 (the SPS card), **capped at 100** (decision 29).
- **DPS, BSS, BVS:** the week's minutes in steps (< 90 → 0, < 120 → 20, < 150 → 40, < 180 → 60, < 210 → 80, otherwise 100), exactly as the card's formula.

## 7a-2. COSATOK's SPS marking scheme (for reference only; **not used**, decision 28)

From COSATOK's "Marking Scheme · Level: SPS" screen. Each item has 0–25 marks unless stated, with **straight-line interpolation** between two points:

| Item | Full marks | Zero marks |
|---|---|---|
| Sleep time (previous night) | at or before 22:15 → 25 | at or after 23:30 → 0 |
| Wake-up time | at or before 04:45 → 25 | at or after 06:00 → 0 |
| Chanting finished at | at or before 07:15 → 25 | at or after 23:00 → 0 |
| Chanting rounds (max 10) | 4+ rounds and completed same day → 10 | 0 rounds, or not same day → 0 (linear from 0 to 4) |
| Day rest | up to 60 min → 25 | at or above 135 min → 0 |
| Hearing | at or above 30 min → 25 | 0 min → 0 |
| Reading | at or above 30 min → 25 | 0 min → 0 |
| Service | at or above 15 min → 25 | 0 min → 0 |

**Into the sheet's columns** (week total ÷ (7 × 25) × 100, rounded, as the cards do):
- sleep → bed
- wake-up → wake up
- day rest → Day Sleep
- chanting finished → Japa
- reading → Pathan
- hearing → Sravan
- service → Service

**The SPS Excel card** ("DOC-20260914-WA0028.xlsx", read 2 Oct; option table in a hidden Sheet2; week starts Monday):

| Item | Options and marks |
|---|---|
| To Bed | 10:00–10:15 PM 25 · 10:15–10:30 20 · 10:30–10:45 15 · 10:45–11:00 10 · 11:00–11:15 5 · 11:15–11:30 0 |
| Wakeup | 04:30–04:45 AM 25 · 04:45–05:00 20 · 05:00–05:15 15 · 05:15–05:30 10 · 05:30–05:45 5 · 05:45–06:00 0 |
| Day Sleep | as the BSS card, down to "After 02:15 hr" −5 |
| Japa | as the BSS card, down to "After 11:00 PM" −5 |
| Pathan / Sravan | 30–25 min 25 · 24–20 20 · 19–10 15 · 09–05 10 · below 5 5 · No Reading / No Hearing 0 |
| Seva | week's minutes ÷ 90 × 100, no cap (J18 `=V13/90*100`) |

- **COSATOK and the Excel agree on the start and end points** for To Bed, Wakeup, Hearing and Reading.
- **They differ on:**
  - stepped vs sliding marks
  - the Excel's −5 for Day Sleep and Japa
  - Seva: Excel ÷ 90, the PDF sample ÷ 180, COSATOK 15 min a day = full
- **The sample shows hand-typed marks** over the formula (Japa "After 11:00 PM" scored 20 and 25), which server-side scoring prevents.

**It differs from the old SPS Excel card**, shown by the PDF sample:
- Service: 15 min every day is 100 here, but 58 on the card.
- Short reading: 3 min is 2.5 here, but 5 on the card.

**Settled by decision 28** (the Excel cards); kept for reference:
- (a) Score SPS by COSATOK, not the Excel card. Recommended: it is the official app's rule, fits exact times, and ends the three conflicting Seva rules and the −5s.
- (b) How the 10 rounds-marks enter the sheet: into Japa as (finished-at marks + rounds marks) ÷ 35 × 100, or kept out of the sheet's columns.
- (c) "Not completed same day" sets both the rounds marks and the finished-at marks to 0.
- (d) Does COSATOK have its own scheme for DPS, BSS and BVS? If so, use those instead of the old BVS/DPS/BSS card, for one consistent method.

## 7c. Hearing and Reading: from the IYF journals (read 2 Oct 2026)

**Sources:** in Downloads, loaded into the Rules file. A new release replaces them there.
- **Index:** "Hearing & Reading Journal for different Levels". Its rule: "share only the link for their level", so each devotee sees only their own level's list.
- **Hearing journals** ("IYF Daily Hearing Journal" Level 4, Level 5 BSS, Level 5 BVS, Release 1): an **81-week (18-month) course**. Each week has 4 lectures:
  - SPL: a Prabhupada lecture
  - GKGML: a Gopal Krishna Goswami Maharaja lecture
  - LOW 1 and LOW 2: Lectures of the Week

  That makes 324 lectures per journal, almost all linked to their audio on Google Drive. 20 cells have no link (17 in Level 4).
- **Which journal:** SPS and DPS → the **SPS/DPS** journal (the file calls it "Level 4"). BSS → **BSS** ("Level 5 BSS"). BVS → **BVS** ("Level 5 BVS"). In the app, the sheets and the data everything is named by batch, which is what devotees know (the head, 2 Oct 2026); "Level 4/5" never appears.
- **Books** ("IYF Book Reading Sequence", Draft 2): 76 books with word count, level and language.
  - **By level:** VL 1 (6), VL 2 (17), VL 3 (12), DPS / SPS / NS (13), BSS / BVS / SNS (28).
  - **Schedule maths:** a standard page is 350 words; reading speed is in pages an hour; days per book = words ÷ (words a minute × minutes a day).
  - **The draft's book-number column is empty**, so its schedule sheet shows #N/A after the first book. The intended order is taken as the list order.

**In the app**
- **Hearing, each day:**
  - **This week's 4 lectures** from the devotee's own journal, each with **Listen** (opens the audio) and a tap to choose it as today's hearing.
  - **Search** across all of their journal's lectures.
  - **"Something else"** to type a topic.
  - At least one topic is required when hearing minutes are above 0.
- **No set pace (decided 2 Oct 2026).** The app arrives when many devotees are already partway (some are already in BSS), so nobody is held to the journal's week-by-week order.
  - The journal list is a **guide**: the devotee's own level's lectures are shown first, with "Suggested next" (the first one they have not heard, in journal order) as a hint only.
  - There is no "behind" or "on track" status. Progress shows only as "heard 37 of your level's 324 lectures".
  - **SPS → DPS:** the devotee keeps the same Level 4 list and their heard history.
- **Reading, each day:**
  - **Current book** remembered, so a normal day is one tap.
  - **Changing book:** own level's books first, in sequence order; then earlier levels; then **"Other book"** to type.
  - **No barrier:** any book from the whole list can be searched and chosen, and "Other book" accepts anything a facilitator suggests.
  - The topic is required when reading minutes are above 0.
  - **Book progress estimate** from the daily reading minutes and the book's word count: "≈ 40% · about 3 weeks left". This uses the journal's own maths with the default 20 pages an hour, which the devotee can change in their profile.
  - **Book links:** the PDF folder link from the sequence file, with its note: "please buy from ISKCON outlets".
- **For coordinators and the master:** hearing and reading progress per devotee and per batch, read from what was submitted.

## 7b. Load: 1–2K submissions a week

**Expected load at 2,000 devotees:**
- **Submissions:** 2,000 a week. Even if a quarter arrive in the last hour before the deadline, that is about 8 a minute.
- **Write speed:** writes are one at a time under a lock, at about 1 second each, so about 40–60 a minute. That is 5–7 times the worst-case peak.
- **Simultaneous requests:** Apps Script runs at most 30 at once for the account. A burst above that gets a short "busy" reply, and the app retries automatically using the same request id, so nothing is ever duplicated.
- **Sheet size:** a spreadsheet holds at most 10 M cells. Submissions are kept narrow (about 65 columns), so 2,000 a week is about 6.8 M cells a year. The store therefore **rolls over to a new file every year**, and the view files keep the last 12 weeks plus the current month.

**Speed measures, built in from the start:**
1. One request per action. The rules are sent once and kept on the phone.
2. Validation runs before taking the lock. Inside the lock the only work is the duplicate check (a key index in the cache, with a TextFinder fallback), one setValues and the audit line.
3. The whole sheet is never read to answer a request. Status lists and graphs come from per-batch summaries in the cache, refreshed on every submit.
4. Draft saves go to the server a few seconds after typing stops, per day: about 7–15 per devotee a week, so 14–30K a week at 2,000 devotees, about 30 a minute at the 9–10 PM peak. Each devotee-week has its own Drafts row, found through a cached index, so draft saves never wait for each other. Only Submit takes the lock. The phone holds only the changes not yet sent.
5. Sessions are kept in the cache, with the Sessions tab as the fallback.
6. The view files are updated by a short job after each submit, never inside the user's request.
7. The backend runs under its own Google account, so its daily limits are not shared with the nightly import.
8. Response times and failures go to a Run Log, so slowdowns are seen early.

**What would break it:** hand edits to the store; saving on every keystroke without the few-second pause; skipping the yearly rollover. With the measures above, about **5,000 submissions a week** is a comfortable ceiling. Past that, the data model moves unchanged to a database such as Supabase.

## 8. Phase 0: still needed before building

1. ~~**The SPS card's option table.**~~ Received (DOC-20260914-WA0028.xlsx); scoring by the Excel cards (decision 28, section 7a-1). Earlier notes: "SPS SCORING Final-3.pdf" is one devotee's filled sample. It confirms:
   - To Bed 10:00–10:15 PM = 25 and Wakeup 04:30–04:45 AM = 25 (both later than the BSS card).
   - Japa and Day Sleep as on the BSS card.
   - Pathan below 5 min = 5 (BSS: 0); 19–10 min = 15; 09–05 min = 10.
   - Sravan 30–25 min = 25.
   - Seva 105 min → 58 (÷ 180?).

   All other ranges are unknown. **Needed:** the SPS Excel, or a photo of its option table, from the SPS coordinators. Nothing will be guessed.
2. ~~Seva per level~~: decided — each card and each batch tab keeps its own rule (section 7a).
2a. ~~SPS monthly answers~~: decided, every batch answers the week-end section. (Was: the SPS tab has **no** Chanting Round, 4 regulative principles or KC form columns. Should SPS devotees answer the monthly questions in the app? Without them, the SPS → DPS chanting and principles checks cannot pass for that batch.)
3. ~~Week start~~: decided, Monday to Sunday.
4. ~~Submit window~~: decided, Sunday 6 PM to Monday 9 PM.
5. ~~Monthly fields~~: decided, asked weekly (Night Stay, principles; chanting from daily rounds); KC form dropped.
6. ~~Coordinators~~: one shared SPS account for now (decision 27). The master adds DPS, BSS and BVS coordinators later from the admin screen.
7. ~~Attendance~~: decided (decision 30).
8. ~~Last 2 weeks~~: decided, no late weeks and no changes (decision 26).
9. ~~**The hearing / reading journals.**~~ Read; see section 7c. Earlier notes: The index file ("Hearing & Reading Journal for different Levels.xlsx", in Downloads) maps levels to journals:
   - **SPS and DPS:** the **Level 4** hearing journal. The index groups DPS, SPS and Nityananda Sabha together: 9–27 months, 8–16 rounds.
   - **BSS:** the **Level 5 BSS** hearing journal.
   - **BVS:** the **Level 5 BVS** hearing journal.
   - **Everyone:** one shared **Reading Journal**.
   - **Not needed:** Level 3 (VL-3) is not in the app; the two Google Drive links are tutorial videos.
   - **Rule from the index:** students only ever see their own level's links, so the app shows each batch only its own topic list.
   - **Still needed:** the 4 journal files (Level 4, Level 5 BSS, Level 5 BVS, Reading) are behind OneDrive sign-in and have to be downloaded by hand.

10. ~~Journal start dates~~: decided. Every batch is standing; the level-entry date is set at approval. There is no set pace.
11. ~~Reading list~~: decided. Own level first, then earlier levels, then Other book, with any book allowed.

12. ~~SPS Seva above 200~~: decided, everything is capped at 100.
13. ~~Range rules~~: confirmed; an SPS sleep after 11:30 PM scores 0.

## 8a. Later (noted, not scheduled)

- **9 PM reminder to fill today's sadhana (the head, 2 Oct 2026). Built 3 Oct 2026 (decision 38).** Not a phone-side schedule (browsers no longer offer one reliably): Web Push sent by the Worker's schedule at 9 PM IST, only to devotees who have not filled today and who allowed notifications; free (browser push services); Android, and iPhone with iOS 16.4+ when the app is on the home screen. Needs VAPID keys, a subscriptions table and the head's OK to relax decision 15 (no outside reminders). The same channel could later carry new-announcement alerts.

## 9. Build order: phases (agreed 2 Oct 2026)

Every phase ends with the same gate: its automated tests pass, Opus reviews it (security, match with the API contract, the low-end-phone limits), you try it on a phone, then you deploy it. Opus writes the security-critical server code; Sonnet helpers build screens and routine actions against the contract.

| # | Phase | Focus | Done when | You do |
|---|---|---|---|---|
| 0 | Foundations ✅ | Design, API contract, the 9 spreadsheets built | — | — |
| 1 | Accounts and access | Server skeleton (one endpoint, errors, data layer, Run Log); sign-up, login, sessions, lockout, password change and reset requests; permissions; coordinator approval with IYF ID linking read from the dashboard's Devotees tab (read-only); master: coordinators and batches; app shell (installable PWA, login, sign-up, approval and admin screens) | A devotee can sign up, be approved with a real IYF ID (or none yet), and log in; you can create the SPS coordinator | Create the Apps Script project as iyfdelhi.database@gmail.com and deploy; give that account view access to the dashboard spreadsheet; a Cloudflare account; set your master password |
| 2 | Rules and scoring ✅ | Score cards (worker/src/cards.js, checked option by option against both Excel files and the SPS PDF sample), Seva rules, Chetna options (9 + 9, as COSATOK), the SPS/DPS, BSS and BVS hearing journals (324 lectures each) and 76 books; scoring in `shared/scoring.js`, used by the server and the app | 313 scoring checks pass; Rules sheet filled | Look over the CardRanges and SevaRules tabs in the Rules sheet |
| 3 | Weekly sadhana ✅ (live 2 Oct 2026) | Home screen, the 7 day cards with live card marks, per-day saving a few seconds after typing (offline changes kept on the phone and sent later), two devices handled, week-end answers, own attendance, Submit (Sun 6 PM – Mon 9 PM, whole week or nothing, scores from the batch's card), the Monday 9 PM deadline job (missed weeks, drafts dropped and logged, attendance locked; never before `tracking_from`), history, Share with the facilitator (decision 32), facilitator and group leader at sign-up (decision 33) | Server 1,004 checks, app 67 tests; driven in Chrome against the real server; guarded release proved open apps update themselves | Fill a test week on your phone; set the pilot's first Monday (`tracking_from`) before the pilot |
| 4 | Coordinator and master views (done 3 Oct 2026) | Done 2 Oct: one-login scopes (decision 34), the side menu and bottom tabs by scope, the announcement wall (decision 35), the COSATOK-inspired redesign, the devotee Report, the time picker, Save + single Share. Done 3 Oct: batch status board with attendance marking (one Save for the batch) and no-class weeks (decision 36); filling chart and missed list; birthdays; devotee details (photo, tap-to-call, inactive/reactivate, disable, delete, facilitator and group leader from the lists, ask to reopen); group-leader list editing; master: reopen requests, reopening a missed week, attendance after the deadline, IYF IDs (details, link, unlink, possible duplicates); profile and photo (cropped and shrunk on the phone, kept in D1); the four batch view sheets (written by the schedule only when their batch changed); Hearing and Reading as two screens (week slider + All weeks with filters; level chips + search; each lecture's and book's own Drive link, `docs/links-to-check.md`); the quote carousel (46 verses copied from Vedabase); the drawer on the same side as its button; an explicit Save per day (one draft per day). Done 3–4 Oct: class day, email, WhatsApp, no group leader (decision 37); the 9 PM reminder (decision 38); master Overview, Activity and Settings; filling on someone's behalf; following dashboard ID merges; the full design-system revamp (royal-purple brand before sign-in, blue / saffron / burgundy areas, splash and welcome, glass shell, shimmer skeletons, toasts, offline bar, install, badges; 136 app tests, 1,183 browser checks, initial JS 57 KB) | Coordinators can run their batch without the sheet | Try the coordinator and master screens |
| 5 | Bridge to the dashboard (later, by decision of the head, 3 Oct 2026; until then the dashboard keeps its current method) | Submitted weeks copied nightly into the sadhana-sheet tabs, so Raw, Eligibility and the dashboard work unchanged | Copied weeks import exactly like typed ones | Deploy |
| 6 | Hardening ✅ (3 Oct 2026, except the 5,000-devotee edge re-test) | Load test with 2,000 devotees on a separate server; incremental writes everywhere (decision 40: store sheets, view sheets, ID list, NameMap, reminders); attendance index; Smart Placement; 9 PM reminder in three parallel parts; security review (2 high findings fixed, tested); backup and restore drill (Time Travel restore 4 s, export 7 s); low-end phone check (Lighthouse, 4× slower CPU, slow 4G: performance 96–98, accessibility 100); Sunday submission proven end to end on the test server | All pass | Re-run the edge load test with 5,000 devotees after 05:30 IST (free daily budget): `loadtest/README.md` |
| 7 | Pilot: SPS Group 2 | 2 weeks alongside the current sheet; numbers compared week by week | Two clean weeks | Share the link with SPS Group 2 |
| 8 | Roll-out | SPS, SPS Online, DPS, BSS, BVS one at a time; short guides for devotees and coordinators | All batches on the app | Share the link batch by batch |
