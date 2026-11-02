# Sadhana Record: load test report (phase 6)

**IYF Delhi · 3 October 2026 · free plan versus the US$5 Workers Paid plan**

This report covers how much the Sadhana Record app can carry on Cloudflare's free plan, what breaks first, what was fixed during the test, and what the US$5-a-month plan would change.

---

## 1. The answer in one page

**Target (the head, 3 Oct 2026): 2,000 to 5,000 devotees on the free plan, without fail and at no cost; upgrade only when scale and resources show the need (§9b).**

At 2,000 devotees the free plan already had comfortable room. To make **5,000** fit with a safe margin, these changes were made and are **live**:

| Change | What it does |
|---|---|
| **Sheets copy rebuilt** | Copies only the rows that changed, each to its own row, within about a minute. That now includes **drafts as they are filled** and **attendance as it is marked**. Tabs are never cleared or restarted. |
| **Fewer database writes per action** | A save costs 2 writes, including its log entry for the copy; a repeated save costs 0; a submit costs about 7 (was about 10). The old "table changed" marks and the per-save replay rows are gone. |
| **9 PM reminder in three parts** | Three free schedules send 105 phones a minute (was 35), so 5,000 phones are reached in under an hour. |
| **Smart Placement** | Runs the server next to the database, so screens from India should load faster. |
| **Cheaper app opening, less repeated reading** | Reads of the opening call cut 18×; CPU per call about halved. |
| **ID registry refresh** (by a second session) | Writes only changed IDs. It had been rewriting all 401 every 30 minutes (about 24,000 writes a day). |
| **Attendance index** (by a second session) | Speeds up the coordinator's batch status. |

**Where 5,000 devotees stand on the free plan** (busiest day, Sunday):

| Free-plan limit | Use at 5,000 devotees |
|---|---|
| Requests a day | about 72% (Sunday) |
| Database rows read a day | about 60% |
| Database rows written a day | about 80–85% (Sunday), with drafts and attendance copied live |
| 9 PM reminders | all sent by about 10 PM |

**Still to prove for 5,000:**
- The single database answers about **35–38 calls a second**. 5,000 devotees in the 9 PM rush may reach about 15–30 a second.
- Two things close that gap: a re-test with 5,000 devotees (runs after the daily limits reset, 5:30 AM IST), and fewer queries on the home and week screens.

**Plan.** Stay on the free plan for 2,000–5,000 devotees, watching the numbers in §9b. With drafts and attendance copied live, Sunday writes are the number to watch: comfortable to about **4,500 devotees**, close to the line at 5,000. Upgrade to US$5 a month when §9b says so.

**Five phones on the same day or week are handled.** Exactly one save wins and the others are told to refresh; exactly one submission is accepted.

---

## 2. How it was tested

- A **separate copy of the server and database** was made for the test: `sadhana-record-api-load` with the `sadhana-load` database.
  - It has no key to the Google Sheets and none to send phone notifications, so no real data, sheet or person was touched.
  - Its clock was shifted to Sunday evening and to Monday 9 PM to test submitting and the deadline.
- It was filled with **2,000 test devotees** in the six batches (SPS 600, SPS Group 2 300, SPS Online 200, DPS 400, BSS 300, BVS 200), one coordinator per batch and an IYF head, all already signed in.
- Every call was **measured three ways:**
  - the time the phone waits;
  - the server CPU time, from Cloudflare's own log stream;
  - the database rows read and written, from the database's own counters.
- **Five tests:**
  1. each screen and action alone, 12 times;
  2. a **ramp** of the 9 PM mix at 5, 10, 20, 40, 80 and 160 calls a second, 20 seconds each step;
  3. **five phones** saving the same day at the same moment, 10 times;
  4. a **Sunday wave** of 200 weeks submitted at 20 a second, plus five phones submitting the same week;
  5. the **Monday 9 PM deadline job** marking 1,795 unsubmitted weeks.
- About 14,000 calls in all.

**One caution on timings.** The test database was placed in Seoul, while the test calls ran through Singapore. The live database is in Singapore. Timings in this report are therefore **slower than live**, because each database query crosses to Korea and back. CPU, rows and the ceiling are not affected by this.

---

## 3. What IYF Delhi will actually ask of it

Assumptions, for 2,000 active devotees:

| Who | Per day |
|---|---|
| A devotee | about 11 calls: open the app, the home screen twice, the week twice, save once or twice, announcements, sometimes Report / History |
| A devotee on Sunday | 3 more: week-end answers, own attendance, Submit |
| Six coordinators and the IYF head | about 300 calls in all |
| Schedules (Sheets copy, deadline, reminders) | 1,440 runs a day (one a minute); these count as requests on the free plan |

- **The whole day:** about 24,000 calls.
- **The busiest minute:** if 70% of devotees fill between 9 and 10 PM, that is about 2–3 calls a second on average, and around **12 a second** in the busiest minute.

---

## 4. Results

### 4.1 Each action alone (after today's fixes)

Times are what the phone waits in the test (slower than live; see §2). CPU is server time; the free plan allows 10 ms.

| Action | Wait, median | CPU, median | CPU, 95th % | Queries | Rows read | Rows written |
|---|---|---|---|---|---|---|
| App opens (`meta.get`) | 0.4 s | 2 ms | 3 ms | 4 | 116 | 0 |
| Signed-in check (`auth.me`) | 0.6 s | 5 ms | 5 ms | 6 | 23 | 0 |
| Home screen (`home.get`) | 1.6 s | 8 ms | 10 ms | 15 | 25 | 0 |
| The week (`week.get`) | 1.6 s | 9 ms | 11 ms | 17 | 24 | 0 |
| Save a day (`week.saveDay`) | 1.6 s | 8 ms | 12 ms | 16 | 27 | 1–4 |
| Week-end answers | 1.4 s | 7 ms | 8 ms | 13 | 25 | 1 |
| Submit the week (`week.submit`) | 3.7 s* | 9 ms | 29 ms | 23 | 36 | 9 |
| Sign in (`auth.login`) | 0.9 s | 7 ms | 8 ms | 10 | 40 | 6 |
| Announcements | 0.6 s | 3 ms | 4 ms | 5 | 10 | 0 |
| Hearing / reading lists (`journals.get`, rarely: cached on the phone) | 1.0 s | 7 ms | 7 ms | 9 | 597 | 0 |
| History, profile, rules | 0.6 s | 3–4 ms | 4–5 ms | 5–6 | 10–59 | 0 |
| Coordinator: batch status (`devotees.list`, 600 devotees) | 1.0 s | 13 ms | 15 ms | 13 | 1,986 | 0 |
| Coordinator: filling chart (`stats.batch`) | 1.4 s | 16 ms | 18 ms | 18 | 4,392 | 0 |
| Coordinator: members list | 0.7 s | 4 ms | 5 ms | 7 | 13,334 | 0 |
| Coordinator: attendance, 50 marks | 1.3–1.8 s | 12 ms | 14 ms | 66 | 2,376 | 51 |
| Coordinator: attendance, 250 marks | 1.6–1.9 s | n/a | n/a | 268 | 2,776 | 251 |
| IYF head: overview (`stats.all`) | 5.2 s | 55 ms | 62 ms | 86 | 14,609 | 0 |
| IYF head: facilitators list | 0.5 s | 4 ms | 4 ms | 7 | 8,101 | 0 |

\* measured during the 20-a-second submit wave.

**Devotee actions now sit within the free plan's 10 ms** (median 3–9 ms). Coordinator and head screens are above it, but they are opened rarely.

### 4.2 The 9 PM ramp, before and after today's fixes

| Calls a second | Before: answered | Before: wait (median) | After: answered | After: wait (median) | After: wait (95th %) |
|---|---|---|---|---|---|
| 5 | 100% | 2.2 s | not repeated | | |
| 10 | 99.6% | 2.9 s | **100%** | 2.1 s | 2.4 s |
| 20 | 100% | 5.2 s | **100%** | 3.9 s | 6.5 s |
| 40 | 100% | 12.1 s | **100%** | 8.2 s | 15.1 s |
| 80 | 69% | 15.6 s | **96%** | 21.9 s | 28.5 s |
| 160 | 16% | 12.7 s | not repeated | | |

- **The ceiling is the database, not the plan.** Cloudflare's D1 database answers one query at a time. With each screen asking 15–17 queries, it completes about **35–38 calls a second** at most. Beyond that, calls wait in a queue, and at about 80 a second some are refused ("D1 DB is overloaded").
- At 160 a second (13× IYF Delhi's expected peak), CPU limits also started to cut calls off.
- **IYF Delhi's expected peak of about 12 a second sits well inside the 100% zone.**

### 4.3 Many phones at once

- **Five phones saving the same day at the same moment, repeated 10 times:**
  - every time, exactly 1 save was accepted;
  - the other 4 were told "this day was updated on another device", and the app shows them the saved copy;
  - nothing is overwritten, and this holds for any number of phones.
- **Five phones pressing Submit on the same week, repeated 5 times:** every time, exactly 1 submission was accepted; the others were told "already submitted".

### 4.4 Sunday and Monday

- **Sunday wave:** 200 complete weeks submitted at 20 a second, **all 200 accepted**. Each submit wrote about 9 rows.
- **Monday 9 PM deadline job:** marked 1,795 unsubmitted weeks missed at **100 a minute**, in 18 one-minute runs, finishing about 18 minutes after 9 PM.
  - Each run used **8–16 ms of CPU (median 11)** and 1.8–2.7 s in all, and wrote about 445 rows (7,972 in total).
  - Rows read per run rose from 412 to 4,186 as the missed list grew.
  - Most runs are just over the free plan's 10 ms, so a run could be cut off; the next minute's run simply continues.

---

## 5. Fixed during the test (live since 3 Oct 2026)

| Problem | Effect | Fix | Result |
|---|---|---|---|
| The app's opening call (`meta.get`) walked through every account to name the coordinators. With "AND status" in the query, the database chose a status index over the login. | 2,111 rows read per app opening. At 2,000 devotees that alone would pass the free 5 million rows a day. | Look the coordinators up by login only | **116 rows**, 18× fewer |
| Every call re-read the same settings (up to 8 times), the batch list and the person's batch membership | 30 queries for the home screen; 20 ms CPU | A small per-call memory, cleared on any write | Home 21 queries, **8 ms CPU**. Save a day 8 ms (was 15). The head's overview 55 ms (was 87). At 80 calls a second, 96% answered (was 69%). |
| Attendance for more than 300 devotees in one save was refused, with a misleading message | A coordinator of a big batch could not save | The app sends parts of 250; the message now says what happened | 600 devotees save in 3 parts, about 5 s |
| The Sheets copy cleared and rewrote whole tabs (300 rows a minute), re-reading every earlier row on each run and restarting on any change | At 2,000+ devotees the Attendance tab would sit half-empty and the re-reads could pass the free 5 M rows a day | Database triggers log each changed row (one write); only those rows are copied, to their own row, within about a minute, drafts and attendance included | Live 3 Oct; every tab checked equal to the database |
| Every save also wrote "table changed" marks (1–5 writes) and a 2-row replay entry | Writes are the free plan's tightest limit | Marks removed (the change log replaces them); replay table without row ids | Save 2 writes, submit 6 (was about 10) |
| The 9 PM reminder: 35 phones a minute (free plan: 50 outside calls a run) | 5,000 phones would take until 11:25 PM | Two extra free schedules: three parts side by side | 105 a minute; 5,000 in under an hour |
| Error rows were written while the database was overloaded | Added load at the worst moment | Not written while it is overloaded | |
| The ID registry copy rewrote all 401 IDs every 30 minutes (second session) | About 24,000 writes a day with no users | Only changed IDs are written | |

---

## 6. The free plan: limits, our use, and what happens at the edge

| Free-plan limit | 2,000 devotees | 5,000 devotees | What happens if crossed |
|---|---|---|---|
| **100,000 requests a day** (schedules included) | about 24,000 | about 57,000 on weekdays, about 72,000 on Sunday | Every call fails with Cloudflare error 1027 **until 5:30 AM IST** |
| **10 ms CPU per call** | Devotee actions 3–9 ms (95th % up to 12). Coordinator screens 13–18 ms. Head's overview about 55 ms. Deadline runs 8–16 ms (median 11). | Same per call; batch screens grow with batch size | That call fails ("exceeded CPU", error 1102). Seen in the test only at 160 calls a second. |
| **5 million database rows read a day** | about 1.3 M | about 3 M | All database calls fail **until 5:30 AM IST** |
| **100,000 database rows written a day** | about 35,000 on Sunday | about 80,000–85,000 on Sunday (drafts and attendance copied live) | All saves fail **until 5:30 AM IST** |
| **50 outside calls per run** | Reminders 105 a minute: done by about 9:20 PM | done by about 9:50 PM | Later phones are reminded later (cut off at 11:30 PM) |
| **5 schedules per account** | 3 used (one every minute, plus two evening reminder parts) | same | |
| **One database, one query at a time** (same on both plans) | Peak about 12 calls a second; ceiling about 35–38 | Peak about 15–30 a second: **to confirm in the 5,000 re-test** | Waits grow; refusals from about 80 a second |

**The serious free-plan risk is the reset time.** Daily limits reset at **00:00 UTC = 5:30 AM IST**. The evening rush (9–11 PM IST) is late in that UTC day, so a limit crossed by an unusual day would take the app down **for the rest of the night**, exactly when devotees fill and submit. That is why §9b's thresholds sit well below the limits.

---

## 7. The US$5 Workers Paid plan: what changes and what does not

| | Free | Workers Paid (US$5 / month) |
|---|---|---|
| Requests | 100,000 a day, hard stop | **No daily limit.** 10 million a month included, then US$0.30 a million. |
| CPU per call | 10 ms | **30 s** by default (up to 5 min). 30 million CPU-ms a month included. |
| Outside calls per run | 50 | **10,000**: all 9 PM reminders in one or two minutes, not an hour |
| Database rows read | 5 million a day | **25 billion a month** included |
| Database rows written | 100,000 a day | **50 million a month** included |
| Database calls per request | 50 | 1,000 |
| Database size | 500 MB | 10 GB |
| Schedules | 5 | 250 |
| When something is exceeded | The app stops until 5:30 AM IST | It keeps working; the extra is billed (a few cents at our size) |
| **Single-database ceiling** (about 35 calls a second with today's code) | Same | **Same**: this is D1, not the plan |
| **Distance to the database** (time per query) | Same | **Same**: needs Smart Placement or fewer queries (§9) |

**The cost at IYF Delhi's size:**

| Active devotees | Requests a month | CPU a month | Database | Bill |
|---|---|---|---|---|
| 2,000 | about 0.75 M (of 10 M included) | about 6 M ms (of 30 M) | far within | **US$5** |
| 5,000 | about 1.8 M | about 15 M ms | far within | **US$5** |
| 10,000 | about 3.6 M | about 29 M ms | far within | **about US$5–6** |

**What US$5 buys:**
- no 1027 / CPU stops in the evening;
- reminders that all go out at 9 PM;
- room for staff screens, the deadline job and the Sheets copy to do more per run;
- the ability to make the deadline and the copy finish in one or two minutes.

It does **not** make a single screen faster or raise the database ceiling. Those come from §9.

---

## 8. The Sheets copy (found by review, fixed and live on 3 Oct 2026)

**Before.** Changing tables (accounts, profiles, memberships, attendance, missed weeks and others) were copied by clearing the tab and rewriting it 300 rows a minute.
- Each run re-read every row before its place in the table.
- Any change part-way started the copy again.
- At 2,000+ devotees the Attendance tab would have sat half-filled on Sundays and Mondays, and the re-reading could have passed the free 5 million rows a day.

**Now** (migrations 0018, then 0022):
- **Each insert, update or delete on a changing table appends one entry to a change log** (one database write; a trigger does it, so no part of the app can forget). The copy reads the log from where it stopped and writes **only those rows, each to its own row of the tab**.
- **No tab is ever cleared or restarted.** If Google is down, the copy re-reads the log. A deleted row is blanked, and its row is given to the next new one, so tabs do not fill with gaps.
- **Drafts** (the Drafts tab) and **attendance** reach the sheets **within about a minute** of a save or a mark. The head asked for this so that the people following devotees work with current data.
- Copied log entries are trimmed at night on the week's lightest days (IST Wednesday–Saturday, 2 AM), so the trimming never adds to the Sunday or Monday load.
- A save repeated after a lost answer is recognised and costs nothing, so saves no longer need a replay row. That keeps a save at 2 writes even with its log entry.
- Reference lists (rules, lectures, books) change only with a release and are rewritten in place.

**Checked:**
- A new test replays every Google write onto a model spreadsheet. Each tab must equal its table after the first copy, edits, deletes, a Google failure, a change landing mid-copy, live attendance, drafts, a removed draft (its row reused) and the night trim (31 checks).
- On the live sheets after release, every copied tab matched the database, including Drafts and this week's Attendance (an audit script, `tools/sheets/sync-audit.mjs`, compares each table with its tab).

---

## 9. Recommendations, in order

1. **Pilot (SPS Group 2): go ahead on the free plan.**
2. **Re-run this test with 5,000 devotees** after 5:30 AM IST, when the daily limits reset. Today's quota went on the 2,000-devotee test. It confirms the 9 PM rush, the Sunday wave and the Monday deadline at full size.
3. **Fewer queries on the home and week screens** (15–17 each). Grouping them into one or two trips to the database roughly doubles the 35–38 calls-a-second ceiling, which gives 5,000 devotees a safe margin in the 9 PM rush.
4. **Confirm Smart Placement from India.** Open the API from a phone on an Indian network: the response header `cf-placement` should read `remote-…`, not `local-…`.
5. **Watch the four numbers in §9b weekly.** Upgrade only when one of them says so.

## 9b. When to upgrade to US$5 a month

The free plan is the plan, as long as these stay below the line. **Plan the upgrade** when a number reaches the first column; **upgrade** at the second. The margin matters because a crossed limit stops the app until 5:30 AM IST.

| Watch (busiest day of the week) | Plan the upgrade at | Upgrade at |
|---|---|---|
| Requests | **70,000** (of 100,000) | **80,000** |
| Database rows written | **70,000** (of 100,000) | **80,000** |
| Database rows read | **3.5 million** (of 5 million) | **4 million** |
| Errors "exceeded CPU" (1102) or "D1 overloaded" in *Logs* | seen on two evenings | repeated in one evening |
| Active devotees | **4,500** | above **5,000**, or 9 PM reminders not finished by 10:30 PM |

**Where to read the numbers** (check on a Monday, covering the Sunday rush):
- **Database rows read and written:**
  - `npx wrangler d1 info sadhana` (in `worker/`) shows `rows_read_24h` and `rows_written_24h`, over the last 24 hours.
  - Or use the dashboard: *Storage & Databases › D1 › sadhana › Metrics*.
  - The free limits count **every database in the account**. Add the `sadhana-load` test database's numbers on days a load test runs.
- **Requests:** *Workers & Pages › sadhana-record-api › Metrics* (requests per day; the minutely and evening schedules are included).
- **CPU and overload errors:** *Workers & Pages › sadhana-record-api › Logs*; filter by outcome "exceededCpu", or search "overloaded".
- **Reminder finish time:** in the same Logs at night, the last `reminders … part n/3 … (done)` line of each part.

**What US$5 then buys** (§7):
- no daily stop;
- 30 s of CPU per call;
- all reminders at 9 PM;
- 10 million requests and 50 million writes a month included.

The bill stays US$5 up to about 10,000 devotees. Upgrading is a switch in the Cloudflare dashboard, with no change to the app.

---

## 10. Phase 5 (the dashboard bridge) and what it means now

- Phase 5 is **only the nightly bridge** that writes submitted app weeks into the sadhana-sheet tabs the dashboard imports. Nothing else in phase 5 is needed if it waits.
- **While it waits, the dashboard keeps using the old method, unchanged.** Weeks filled in the app are kept in the app's database and copied to the *Submissions 2026* sheet, but they **do not reach the dashboard**.
  - The pilot can run alongside the old method and be compared week by week from that sheet.
  - The full roll-out (phase 8), where devotees stop using the old method, needs the bridge first.
- Phase 6 (this report) does not depend on phase 5.

---

## 11. What the test used, and clean-up

- **About 14,000 calls** to the test server (the free plan allows 100,000 a day for the whole account).
- **About 2 million database rows read and about 50,000 written** in the test database, within the account's daily limits; the live app was unaffected.
- The test server's schedule was switched on only for the deadline test, then off again.
- **The test server and database are kept** (no cost on the free plan) so the test can be repeated. They can be deleted with one command each.

*Sources for the plan limits: Cloudflare's published Workers limits and pricing, and the D1 limits and pricing pages (checked 3 Oct 2026).*
