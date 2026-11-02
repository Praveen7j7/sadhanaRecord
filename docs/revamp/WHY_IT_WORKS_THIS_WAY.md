# Why it works this way

**IYF Delhi · Sadhana Record · for the team and anyone who works on the app · 9 Oct 2026 (Phase 9, item 20)**

Some things in the app can look odd, or like an easy improvement. Most of them were decided on purpose, by the IYF head or with the head, and changing them would break something people rely on. This page lists those rules, what each one is, and why it is so.

**How to read it:**
- **Why** gives the reason as it was recorded, with who decided and when.
- Where nobody wrote a reason down, it says **"No reason recorded"**. That does not make the rule optional. It means: ask the IYF head before changing it.
- The decisions are numbered as in `docs/sadhana-app-design.md` §1 (for example "decision 33").

**The one rule above all:** before changing any rule below, ask the IYF head. Then update this page.

---

## 1. Data the dashboard depends on

### Picked from lists, never typed
- **The rule:** devotees never type anything the facilitator dashboard groups or matches by:
  - the facilitator (from the canonical list);
  - the batch;
  - the IYF ID (from the registry).
- Lectures and books are picked from lists too. A "Something else" box is allowed there, because many devotees are already partway through a book.
- **Why:** clean data for the dashboard is the app's main purpose (decision 33, the head, 2 Oct 2026). Before the app, one facilitator appeared as "HG Natvar Gopinath Pr", "Natvar Gopinath Prabhuji", "TBA" and "zDivyanshu pr". The head asked for "no discrepancies, even in the facilitator names". With lists, the import never meets a spelling it has to repair.

### Batch names, never "Level 4 / Level 5"
- **The rule:** the app shows SPS, DPS, BSS and BVS, never the journals' level names.
- **Why:** "batches are the tag which users know" (the head, 2 Oct 2026).

### Part weeks count; skipping never pays
- **The rule:** a week can be submitted with at least one complete day.
  - A day not filled scores 0. Each daily score is the week's marks out of 175, so 1 perfect day is about 14 % and 5 days about 71 %.
  - At the Monday 9 PM deadline, a draft with a complete day is submitted as it stands. A week with no complete day is marked missed and scores 0.
- **Why:** decision 45 (the head, 4 Oct 2026). The dashboard's promotion rule averages Overall over the weeks that have a row. "Skipping a week must never beat filling part of it", so the data stays fair.

### Closed weeks stay closed
- **The rules:**
  - The submit window is Sunday 6 PM to Monday 9 PM, Indian time. The head can change it in Settings.
  - A week closes at the deadline.
  - A submitted week is never edited.
  - Only the head can reopen a missed week, and a reopened week must be submitted within 14 days.
- **Why:** decisions 17, 26 and 31. A submitted week is the record the dashboard and the batch sheets are built from, so it must not change under them.
- No reason is recorded for the 9 PM time itself.

### Coordinators fill only the open week
- **The rule:** a coordinator views and fills only the week being filled now. The head views and fills any week. A coordinator can *ask* for an earlier week to be reopened, with a reason.
- **Why:** decision 43 (the head, 4 Oct 2026). It follows "closed weeks stay closed" (decision 26).
- **No reason recorded** beyond that.

### Attendance: the higher level wins
- **The rule:** the order is IYF head › coordinator › group leader › no-class week › the devotee's own mark.
  - Each level writes only its own column.
  - After the deadline, only the head can change a mark, with a reason.
  - When a higher mark differs from the devotee's own, the devotee sees a note and gets one notification, 5 minutes later, so a quick correction sends nothing.
- **Why:** decision 41 (the head, 3 Oct 2026). Separate columns mean a lower level can never overwrite a higher one.
- No reason is recorded for the order itself.

### Every score is 0 to 100
- **Why:** decision 29 (the head, 2 Oct 2026): so a score always fits the batch tabs.

### The facilitator dashboard is never changed by the app
- **The rule:** the app only *reads* the dashboard's Devotees tab.
  - IYF IDs the app creates (the `SR26-…` series) are listed for IYF to add to the dashboard by hand.
  - The dashboard's own ID always wins.
- **Why:** the user's instruction (2 Oct 2026): the dashboard is a separate project, "don't hodgepodge" the two. One exception was approved on 3 Oct: merging exact duplicate IDs.

---

## 2. People and privacy

### No ID documents; the phone is the identity
- **The rule:**
  - The app asks for no Aadhaar, Voter ID or any other ID number, and keeps no record of an ID being checked.
  - The verified phone number is the identity.
  - A face photo is optional, and never a photo of an ID card.
- **Why:** decision 14 (2 Oct 2026):
  - an Indian SIM is issued only after an ID check, and the coordinator's approval does the rest;
  - only authorised bodies may store Aadhaar (UIDAI);
  - India's DPDP Act 2023 expects personal data to be limited to its purpose.
- Storing Aadhaar "with consent" was asked for twice and declined.

### Passwords are never readable
- **The rule:** nobody can see a password, not even the head. A forgotten password is replaced by a new one the person chooses, and their coordinator approves it (staff: the head). Nobody approves their own sign-up or reset.
- **Why:** decisions 1, 3 and 34. Anyone who knows a phone number can ask for a reset, so the coordinator calls the person before approving.

### The address is required at sign-up
- **The rule:** sign-up asks for the address, and only the devotee changes it.
- **Why:** decision 41 (3 Oct 2026), confirmed by IYF on 8 Oct 2026 when a review suggested making it optional to shorten the form.
- **No reason recorded.** Ask the head before making it optional.

### Minimum age 15; parent consent from 15 to 17
- **Why:** IYF's answer, 8 Oct 2026. Under the DPDP Act anyone under 18 is a child, and the store reviews check this. No ID is asked to prove age.

### Devotees don't see who a post is for
- **The rule:** staff see a post's audience; a devotee does not. Only the head chooses who sees a head's post.
- **Why:** decisions 43 and 44.
- **No reason recorded**, beyond the head's 3 Oct rule of "no explanatory notes that expose how the system works".

### The facilitator view is read-only
- **The rule:** a facilitator sees their own students in any batch, with call and WhatsApp links. They cannot fill or change anything.
- **Why:** decision 43 (the head, 4 Oct 2026): "viewing and filling are two permissions".
- **No reason recorded** beyond that.

### The group leader is not asked at sign-up
- **The rule:** group leaders are appointed by the coordinator from the batch's devotees (decision 41). Sign-up no longer asks for one (decision 37).
- **No reason recorded** for the removal.

---

## 3. How the app is built

### Explicit Save on the day form
- **The rule:** a day is saved only when the person presses Save.
  - Nothing is saved silently.
  - A Save pressed offline is sent when the phone is back online.
  - If another phone saved first, the newer copy wins and the person is told.
  - Submitting the week is a separate step.
- **Why:** it replaced the first design's autosave (phase 4, 2–3 Oct 2026), and is listed under "never change a business rule" in the roadmap.
- **No reason recorded** for choosing Save over autosave.
- It also costs little: a save is 2 database writes, a repeated save none.

### The free Cloudflare plan
- **The rule:** the app runs on Cloudflare's free plan for 2,000–5,000 devotees, and every write is small and incremental (decision 40, the head, 3 Oct 2026).
- **The limits:**
  - 100,000 requests a day;
  - 5 million rows read and 100,000 written a day, shared by the whole account and reset at 05:30 IST;
  - 10 ms of processing a call;
  - 50 outside calls per scheduled run.
- **Why it matters:** the daily reset falls *after* the 9–11 PM rush. Crossing a limit would take the app down for the rest of the night. The upgrade (US$5) is planned only when the load-test report's thresholds are reached.
- **What it shaped:**
  - The 9 PM reminder stores nothing per phone. A row per phone would be 5,000 writes a night.
  - Notifications go out 35 phones a run.
  - The Sheets copy goes 300 rows a run.
  - Attendance is saved in parts of 250.
  - Likes are counted at night.
  - The ID list is copied only when it changed. Copying it every 30 minutes would be 24,000 writes a day.
  - Logs are cleaned up at night, in chunks.
  - Exports are paged, capped at 6 months, and limited to 20 an hour.

### Every table is copied to Google Sheets
- **The rule:** every table goes to the Google Sheets copy, except passwords, sign-in tokens, pictures and phone notification addresses (decision 39, the head, 3 Oct 2026).
  - Tables that change are copied row by row within about a minute.
  - Logs and submissions are added at the end.
  - A tab is never cleared.
- **Why:** IYF's coordinators work in the sheets every day; "the sheets are the bridge between coordinators and the technical side". Rewriting whole sheets would break the free plan's limits and leave tabs half empty.

### Sheets changes are additive
- **The rule:** new tabs and new columns at the end only. Build a tab or column *before* the database change that fills it.
- **Why:** coordinators, the notebook and other sheets read fixed tabs and columns. A tab that isn't built yet makes the whole file's copy fail.
- **The one exception (the head, 9 Oct 2026):** old rows of the Activity and technical-log tabs are deleted after the kept period (6 months by default, set in Settings). The tabs and columns stay.

### Pictures are never in the app's install
- **The rule:**
  - The paintings of the Lord are fetched only when shown: at most 6 a visit, kept on the phone 30 days.
  - None are fetched on low-end phones, with Data Saver on, or offline.
  - A painting never delays sign-in or the day form.
- **Why:** devotees' phone data matters, and the app is built for ₹6–8K Android phones on slow 4G. The install stays under 700 KB so it opens fast (the display standard, approved 9 Oct 2026).

### One darshan, the same for everyone
- **The rule:** each day starts from the same painting for everyone, chosen by the Indian date. It then turns every 20 seconds.
- **Why:** "so people talking about today's darshan see the same one first" (the display standard).

### No pause buttons on the paintings and verses
- **The rule:**
  - Nothing that moves has a button on it.
  - A painting or verse holds still while it is pressed, under the mouse, or has keyboard focus.
  - With "reduce motion" on, nothing turns at all.
  - Only one thing changes at a time: paintings every 20 s, verses for their reading time (10–30 s), never within 4 s of each other.
- **Why:** the head (9 Oct 2026) said a button on the image "does not look good from the user's perspective". Holding still on touch, hover or focus meets the accessibility rule (WCAG 2.2.2) without one. The pace follows the display standard's "devotional, never a slideshow".

### Phone and push only, no email or outside reminders
- **The rule:** the only reminders are the app's own notifications: the 9 PM reminder, the deadline reminder, and announcements.
- **Why:** decisions 15 and 38.
- There is no Google or email sign-in. "Not everyone has or remembers one; the phone is the identity."

### English only, for now
- **The rule:** the app is in English.
- **Why:** decided 2 Oct 2026 and confirmed by IYF on 8 Oct ("not needed now").
- **No reason recorded.**

### Festivals go on the Wall, not a calendar
- **Why:** IYF, 8 Oct 2026: "festivals are announced on the Wall with a push notification". No separate calendar is kept.

---

## 4. How changes are released

### One release at the end
- **The rule:** changes are built in a copy (`sadhanaRecord-revamp/`) and released together. There are no small releases in between.
- Before the release, *everything* is tested end to end:
  - every automatic check;
  - every role's flows;
  - real phones and screen readers;
  - screenshots of every changed screen.
- Nothing is waived. A failure is fixed and the whole run repeated.
- **Why:** the head (8–9 Oct 2026): testing after every small change "takes a lot of time". The head also wants "a finished product the users get, not half-baked".
- **The trade-off:** a problem between two changes is found only in the final run, which is why that run is complete.

### Release only through the release script
- **The rule:** the app is published only with `npm run release`, which checks that an open app updates itself and that every screen file loads.
- **Why:** after early releases the head saw "Could not load this screen" and asked that it never return.

### The database audits are gates
- **The rule:** the server tests record every database statement. Two audits flag any statement that scans a growing table or writes in bulk.
  - The approved ones are listed with a one-line reason in `worker/tests/audit-allow.mjs`.
  - A new one fails the release gate until it uses an index or is added to the list with its reason.
- **Why:** a missing index once slipped through (attendance by week and batch). At 5,000 devotees a single scanning statement can use up the free plan's daily reads (Phase 9, item 19).

---

## 5. Not decided yet

- **Overall score on a part week:** daily categories are capped by the days filled; Overall is not. Whether to cap Overall too has been asked and is still open.
- **Hindi walkthrough videos:** the videos are planned in English. Hindi was mentioned earlier, and the app stays English only.
