# Sadhana Record database: KT for reports and custom reports

*27 Oct 2026 · database at migration 0075 (Phase 23 live) · every query in section 9 was run against the live database on this date*

This is the hand-over for anyone who builds reports from the Sadhana Record database. It covers how to connect,
what each table means, the rules that make a number come out the same as the app, and a set of tested queries to
start from.

Two kinds of reader use it:

| Reader | Access | Connects with |
|---|---|---|
| **The head** (Praveen Jha) | Full: read, write, export, restore | The owner login (`npx wrangler login`), set up as in `database-owner-access.pdf` |
| **A report builder** | **Read only** | A Cloudflare API token with **D1 · Read**, plus the Account ID, both sent by the head |

Everything from section 3 onward is the same for both. Where the two differ, it says so.

## 1. Five things to know first

1. **The database is the system of record.** It is Cloudflare D1 (SQLite) named `sadhana`. Google Sheets copies are paused (since 13 Oct), and the app reads nothing from the Facilitator Dashboard (since 27 Oct). A report from this database is the truth. A sheet is an old snapshot.
2. **Live data is still mostly test data.** On 27 Oct there are 22 logins, 4 submitted weeks and 1 training (`ETP-21`). Real batches start in **November 2026**. Build and check your reports now, and expect the volumes to grow to 2,000–5,000 devotees. `persons` already holds 1,348 imported identities.
3. **A blank week is not a zero.** Quality (scores, rounds, night stay) is averaged over the weeks people **submitted**. Reporting (who submitted at all) is a separate measure. Mixing the two produced misleading figures in the past.
4. **Two reports are already built into the app.** **Admin › Analysis** shows trends from the weekly sums, and **Admin › Reports** (`report.get`, Phase 23) builds a report for any period. Check those first. Write SQL for what they do not cover. Your numbers must agree with theirs (section 10 lists which screen to check each against).
5. **Every row you read is shared budget.** The app runs on Cloudflare's free plan: 5 million rows read a day, for the whole app. Start from the weekly-sums table (`batch_weeks`), always filter by week, and do not run anything heavy on Sunday evening or Monday before 10 PM IST.

## 2. Connecting

D1 has no host, port or password, so tools such as DBeaver cannot connect to it directly. Every query goes through
Cloudflare: either with the `wrangler` command or over HTTPS.

### 2.1 The head (owner login)

Follow `docs/database-owner-access.pdf` once on each computer (`npx wrangler login`, then `npx wrangler whoami`).
After that, every command in this document works as written. The owner login can also write, so keep the rules in
section 11 in mind.

### 2.2 A report builder (read-only token)

You receive two values from the head. Keep both private, like a password:

- an **API token** with permission *Account · D1 · Read*
- the **Account ID**

**Step 1.** Install Node.js 20 or later (https://nodejs.org). Python 3 is also useful for the CSV script.

**Step 2.** Set the two values in your terminal (macOS / Linux):

```
export CLOUDFLARE_API_TOKEN=<your token>
export CLOUDFLARE_ACCOUNT_ID=<account id>
```

On Windows PowerShell, use `$env:CLOUDFLARE_API_TOKEN="<your token>"` and `$env:CLOUDFLARE_ACCOUNT_ID="<account id>"`.
Never save the token in a script, a shared folder or a git repository.

**Step 3.** Test the connection:

```
npx wrangler d1 execute sadhana --remote --command "SELECT COUNT(*) AS accounts FROM accounts"
```

A table with one number means you are connected. The token can only read. If a write is ever accepted with it,
stop and tell the head, because the token was made wrongly.

The full setup and rules for read access are in `docs/database-access.pdf`.

### 2.3 Three ways to run a query

**One query with wrangler:**

```
npx wrangler d1 execute sadhana --remote --command "SELECT batch_id, name, level FROM batches"
```

**A file of SQL, with JSON output** (for a spreadsheet or a script):

```
npx wrangler d1 execute sadhana --remote --json --command "$(grep -v '^--' r02_period_by_batch.sql)" > out.json
```

Always keep `--remote`. Without it, wrangler queries an empty local copy and returns nothing useful.

**Straight to CSV with the script** in `docs/reporting-sql/d1_to_csv.py` (Python standard library only, read
queries only). It uses the HTTP API and can fill `?1`, `?2` placeholders, so one SQL file serves any period:

```
python3 d1_to_csv.py my_report.sql out.csv 2026-11-01 2026-11-30
```

The plain HTTP call it makes, if you want to call it from another tool (Apps Script, Power BI, n8n):

```
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database/8b771fe4-abfd-4bd8-9a50-dfc1ae1b739a/query" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM batch_weeks WHERE week_id BETWEEN ?1 AND ?2","params":["2026-11-01","2026-11-30"]}'
```

The rows are in `result[0].results`, and `result[0].meta.rows_read` shows what the query cost.

### 2.4 A full copy for heavy work

For work that would read a lot (a year of day-level data, trying many query drafts), ask the head for the latest
weekly backup file and load it locally:

```
sqlite3 sadhana.db < sadhana-YYYY-MM-DD.sql
```

Then use DB Browser for SQLite, DBeaver or `sqlite3` freely: nothing you do touches live data, and nothing counts
against the budget. **Never run `wrangler d1 export` yourself**: while an export runs, the database stops answering
the app. Only the head runs it, at a quiet time. The copy holds personal data; delete it when the work is done.

## 3. How the system fits together

```
 devotees' phones / staff screens
            │  (one API call per screen)
            ▼
 sadhana-record-api  (Cloudflare Worker: every rule, every score, the scheduled jobs)
            │
            ▼
 D1 database "sadhana"  ◄── you read here (read-only)
            │
            └─ Google Sheets copy: PAUSED since 13 Oct (SHEETS_COPY = off)
```

- **All scores are worked out by the API when a week is submitted** and stored in `submissions`. Reports read the stored scores. They never recompute a week from its days.
- **Scheduled jobs write the derived tables.** The most useful one for reports: every Monday after the 9 PM deadline, the job closes the week, marks missed weeks, and writes `batch_weeks` (the weekly sums) for that week and the three before it.
- **The database is changed only by numbered migrations** (`worker/migrations/0001…0075`). A new table or column appears only through a release. Check what is applied with:

```
npx wrangler d1 execute sadhana --remote --command "SELECT id, name, applied_at FROM d1_migrations ORDER BY id DESC LIMIT 3"
```

## 4. The ideas behind the data

### 4.1 People: login, account, person

- **`login`** is the key you join on everywhere. For a devotee it is their 10-digit phone number. For staff it is a username (`sps`, `etp`).
- **`accounts`** holds one row per login: name, role, status.
- **`persons`** is the IYF identity record behind the IYF ID. It is separate from the account: one person may have had several IDs and several names. The link is `person_links (service = 'sadhana', account_ref = login)`.
- **Show `accounts.name` in reports.** That is the name the app shows. The identity record can hold a different spelling, or an initiated name next to the given one.
- **The IYF ID** has the format `IYFD-<year connected>-NNNN`. Old IDs (`GP26-`, `JN26-`, `KT26-`, `SR26-`) are superseded but still resolve. When joining `person_identifiers`, pick `state = 'current' AND series = 'IYFD'`; 5 old `GP` rows are also still marked current (a known data-health item).

### 4.2 Roles and status

| `accounts.role` | Who |
|---|---|
| `DEVOTEE` | Everyone who fills sadhana, including group leaders, trainees and devotees who are also facilitators |
| `COORDINATOR` | Staff login of a batch or training coordinator (facilitators who log in are coordinators too) |
| `MASTER` | The head and the recovery `master` login |

| `accounts.status` | Means |
|---|---|
| `PENDING` | Signed up, waiting for the batch coordinator |
| `ACTIVE` | Can use the app |
| `INACTIVE`, `DISABLED`, `REJECTED` | Cannot sign in |

**"Inactive" for reporting is usually NOT the account status.** Since Phase 23 the app marks a devotee inactive
after 30 days with no sadhana and no use of the app. It does this on the **membership** (`memberships.state =
'INACTIVE'`), and the account stays `ACTIVE`. Every change is logged in `activity_events` (`how`: `AUTO`, `MANUAL`,
`FILLED`, `APP`).

**Status is current, not historic.** `accounts.status` and the open membership describe today. To know who was
in a batch in a past week, use the membership's `from_week` / `to_week` (section 8, rule 4).

### 4.3 Batches and trainings (`batches`)

| Kind | Examples | Scored with | Notes |
|---|---|---|---|
| Class batch | `SPS`, `SPS2` (SPS Group 2), `SPSO` (SPS Online), `DPS`, `BSS`, `BVS` | SPS card or BVS/DPS/BSS card | Full week: 6 daily items + seva + attendance |
| Temple residents | `TRD` | TRD card (linear, 205 marks a day) | Attendance recorded but **not scored**; has a Morning program column |
| Vedic intake | `VL2-nn`, `VL3-32` | none | `tracks` = `attendance` (VL-2) or `attendance,rounds` (VL-3); Overall has no meaning here |
| Training | `ETP-21` ("ETP · Batch 21"); later MTP, FTP | own card | People are **enrolled** (`enrolments`), not members. A training runs alongside the person's own batch |

Always name batches by their tag (SPS, DPS, BSS, BVS, VL-2, VL-3), never "Level 4 / Level 5".
`batches.started_on`, `ends_on` and `closed_at` give a training's dates. `coordinator_logins` is a comma list.

### 4.4 The week

- **A week is identified by its Monday**: `week_id = '2026-10-19'` is Monday 19 to Sunday 25 October.
- **Filling window:** from Sunday 1 PM to **Monday 9 PM** IST (`settings.submit_opens` / `submit_closes`).
- **At the Monday deadline** a draft with at least one complete day is submitted automatically (`submitted_by = 'DEADLINE'`); a week with no complete day becomes a **missed** row (`missed_weeks`, scored 0).
- **Part weeks count** (decision 45): each category is the week's marks ÷ 175 (7 days × 25). A day not filled adds 0, so one perfect day scores 14% and seven score 100%. `submissions.days_filled` says how many days were filled.
- **`settings.deadline_done`** is the Monday of the last closed week. Anything after it is still open, so do not report it as final.
- **`settings.tracking_from` = `2026-10-26`.** Missed weeks are recorded only from this week on. Before it, someone who did not submit simply has no row. Do not count them as "missed" for September and October.
- A week can be **reopened** by the head (`reopens`, `reopen_requests`); it is then submitted again.

### 4.5 Scores (`submissions`)

All scores are percentages from 0 to 100, rounded half away from zero.

| Column | What it is |
|---|---|
| `bed`, `wake_up`, `day_sleep` | Body items: to-bed time, wake-up time, day rest |
| `japa`, `pathan`, `sravan` | Soul items: chanting finished by (time), reading, hearing |
| `body` | Average of bed, wake_up, day_sleep |
| `soul` | Average of japa, pathan, sravan |
| `seva` | Seva score from the week's seva minutes |
| `attendance` | 100 if marked present at class that week, else 0 (as it stood when the week was scored) |
| `overall` | Average of body, soul, attendance, seva. On the TRD card: all marks ÷ (7 × 205) |
| `morning` | TRD only: Morning program score; NULL on other cards |
| `avg_rounds` | Rounds a day (text; `''` when not given) |
| `night_stay`, `principles` | `YES` / `NO` / `''` (the four regulative principles) |
| `reading_minutes`, `hearing_minutes`, `seva_minutes` | The week's total minutes |
| `days_filled` | Complete days counted, 1–7 |
| `score_card` | The card used (`''` on weeks scored before 23 Oct: the batch's own card) |
| `submitted_by`, `on_behalf` | Who submitted: the devotee, a coordinator on their behalf (`on_behalf = 1`), or `DEADLINE` |
| `week_json` | The whole week as JSON: every day's answers and marks (section 4.8) |

**The stored `overall` is not always the final one.** If class attendance is marked or changed after the week was
submitted, the app re-works Overall with the attendance that now counts. The Board, History, Leaderboard, Analysis
and Reports all use this **final Overall**. Use the same SQL (it is in queries R4 and R7):

```
CASE WHEN s.score_card IN ('TRD') THEN s.overall ELSE
  CASE COALESCE(NULLIF(at.master_mark,''), NULLIF(at.coordinator_mark,''), NULLIF(at.leader_mark,''),
                CASE WHEN cw.batch_id IS NULL THEN NULL WHEN cw.mode = 'ALL_PRESENT' THEN 'P' ELSE 'A' END,
                NULLIF(at.devotee_mark,''), '')
    WHEN 'P' THEN CASE WHEN s.attendance = 100 THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + 100 + s.seva) / 4.0))) END
    WHEN 'A' THEN CASE WHEN s.attendance = 0   THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + s.seva) / 4.0))) END
    ELSE s.overall END END
-- with: LEFT JOIN attendance at ON at.login = s.login AND at.week_id = s.week_id
--       LEFT JOIN class_weeks cw ON cw.batch_id = s.batch_id AND cw.week_id = s.week_id
```

`batch_weeks.sum_overall` already holds the final Overall.

### 4.6 Class attendance (`attendance`)

One row per devotee per week. Several people can mark it, and the first non-empty mark in this order counts:
**head** (`master_mark`) → **coordinator** (`coordinator_mark`) → **group leader** (`leader_mark`) → the class week's
default (`class_weeks`: a holiday marked "all present") → the **devotee's own** (`devotee_mark`). The result is
stored in `mark_used`: `P`, `A`, or `''` (not marked). It locks at the deadline (`locked = 1`).

- **Attendance % = present ÷ classes held**, where held = rows with `mark_used <> ''`. A week with no class counts for nobody. This is how the app measures it, including for promotion.
- `class_weeks` marks weeks that were holidays or festivals.
- Training attendance is separate: `training_attendance` (one row per person, training and week; `mark` `P`/`A`/`''`).

### 4.7 Membership and facilitators

- **`memberships`** says which class batch a devotee is in, from `from_week` to `to_week` (`''` = still open). `state` is `ACTIVE` or `INACTIVE`. A promotion closes one membership and opens another.
- **Who was in batch B in week W:** `m.batch_id = B AND m.from_week <= W AND (m.to_week = '' OR m.to_week >= W)`.
- **Facilitators have permanent ids since today (migration 0074):** `facilitators.id` = `F001`, `F002`… Join `memberships.fac_id → facilitators.id`, and show `facilitators.name` (always the current spelling). The old text column `memberships.facilitator` is kept for one release; do not join on it. `facilitator_names` holds every past spelling, for matching old sheets.
- **Group leaders:** `memberships.leader_login` → the leader's login; `leaders` lists who leads which batch.
- **Promotions and closings:** `batch_closings.decision` = `promoted` (with `to_batch`), `repeat`, `left`, or, for a training, `qualified`.

### 4.8 Day-level data (`week_json`)

Each submitted week holds its seven days as JSON. Days not filled are `{}`. The fields of a day:

| Field | Meaning |
|---|---|
| `date` | The day (`YYYY-MM-DD`) |
| `sleptAt`, `wokeAt` | Clock times `HH:MM` (24 h) |
| `rounds` | Rounds chanted |
| `chantingSameDay`, `chantingDoneAt` | Finished the same day, and when |
| `dayRestMin`, `readingMin`, `hearingMin`, `serviceMin` | Minutes |
| `reading`, `hearing` | What was read (`bookId`) and heard (`lectureId`) |
| `m` | The marks each item earned: `{ "wake_up": ["04:30 - 04:45 AM", 25], … }` (TRD adds the maximum as a third value) |

The week level holds `weekEnd` (`nightStay`, `principles`, `avgRounds`), `attendance`, `sevaMinutes` and `scores`.
Weeks submitted before decision 42 keep their days in `days_json` / `marks_json` instead. Read days with:

```
json_each(CASE WHEN s.week_json <> '' THEN json_extract(s.week_json, '$.days') ELSE s.days_json END)
```

Day-level queries are the most expensive kind. Keep them to a few weeks or one batch at a time, or run them on a
local copy (section 2.4).

### 4.9 Facilitation cards (phases, measures, targets, fills)

Facilitators and ETP trainees fill a weekly card of eleven lead measures.

- **`phases`** are dated: Gaur (Jan–Apr), Jagannath (May–Aug), Kartik (Sep–Dec). Live: `kartik-2026`, 1 Sep – 31 Dec.
- **`measures`** lists the eleven measures: `sadhna` (filled from their own week score), stall preaching, calls, VL-1 and VL-2/3 facilitation attendance, one-to-one meetings, FTP (for a trainee: ETP) attendance, and four **monthly** measures (senior meetings, serious students, all-students meeting, journal).
- **`targets`** holds what each person committed to; **`fills`** holds what they reported each week.
- **The card key (`phase_id` column) is the phase id for a facilitator** (`kartik-2026`), **but the training batch id for a trainee** (`ETP-21`). Filter on both when you want everyone.
- **How the app scores a card** (`worker/src/phases.js`):
  - Seva % for a week = average over the weekly measures that have a target: a number is `min(100, filled ÷ target × 100)`, a Yes/No is 100 or 0. A measure with no target is left out, not counted as 0.
  - Monthly measures are scored once a month: numbers added across the month, Yes/No met if ticked in any week.
  - Sadhana % = the average of the `sadhna` measure over the weeks it was filled.
  - **Net score = (sadhana + seva + goal) ÷ 3.** Goal = their students who became eligible for promotion, against `stage_targets`. With no goal target, the average is over the terms that exist. Bands are 100 / 80 / 50.
- For an exact net score, compare with the facilitator's Scoreboard in the app rather than re-deriving it. Use SQL for the parts (targets, fills, students), as in query R11.

### 4.10 Promotion criteria

Promotion is measured along VL-2 → VL-3 → SPS → DPS → BSS. TRD and BVS are not promoted from. A batch's own rows in
`promotion_criteria` replace the standard set below:

| Level | Criteria (over the window) |
|---|---|
| VL-2 | attendance ≥ 50% |
| VL-3 | attendance ≥ 50% and ≥ 4 rounds |
| SPS | Overall avg ≥ 80, night stay ≥ 80% of weeks, class attendance avg ≥ 80, ≥ 8 rounds, principles YES every week |
| DPS, BSS | the same, with ≥ 12 rounds |

A figure with nothing to measure (no weeks, no classes held) never passes.

## 5. Table map

### 5.1 Tables you will use

| Group | Table | One row per | Join on |
|---|---|---|---|
| **Weekly sums** | `batch_weeks` | batch × closed week | `batch_id`, `week_id` |
| **Weeks** | `submissions` | devotee × submitted week | `login`, `week_id`, `batch_id` |
| | `missed_weeks` | devotee × missed week (from 26 Oct) | `login`, `week_id` |
| | `drafts` | week being filled now (deleted at the deadline) | `login`, `week_id` |
| | `reopens`, `reopen_requests` | reopened week / request to reopen | `login`, `week_id` |
| **Attendance** | `attendance` | devotee × week | `login`, `week_id` |
| | `class_weeks` | batch × holiday/festival week | `batch_id`, `week_id` |
| | `training_attendance` | person × training × week | `login`, `batch_id`, `week_id` |
| **People** | `accounts` | login | `login` |
| | `profiles` | login (personal details) | `login` |
| | `memberships` | devotee × class batch period | `login`, `batch_id`, `fac_id` |
| | `enrolments` | person × training | `login`, `batch_id` |
| | `leaders` | group leader | `login` |
| | `activity_events` | change to inactive/active | `login`, `batch_id` |
| **Structure** | `batches` | batch or training | `batch_id` |
| | `batch_closings` | decision when a batch closes | `batch_id`, `login` |
| | `promotion_criteria` | batch × criterion | `batch_id` |
| | `facilitators`, `facilitator_names` | facilitator / spelling | `id` (`F001`) |
| **Cards** | `phases`, `measures`, `targets`, `fills`, `stage_targets` | see 4.9 | `phase_id`, `login`, `measure_id` |
| **Identity** | `persons`, `person_links`, `person_identifiers`, `person_names`, `person_phones` | person / ID / name / phone | `person_id` |
| **History** | `audit_log` | every change: who, what, when | `who`, `target`, `at` |
| **Content** | `books`, `lectures`, `announcements`, `post_likes`, `post_comments` | reading/hearing catalogue, posts | `book_id`, `lecture_id`, `ann_id` |
| **Settings** | `settings` | app setting (`deadline_done`, `tracking_from`, …) | `key` |

### 5.2 Tables to ignore for reports

`mirror_*`, `view_*` (the paused Sheets copy) · `sessions`, `counters`, `replies`, `push_subs`, `push_jobs`,
`reminder_progress` (sign-in and notifications) · `registry` (a frozen snapshot of the old dashboard list) ·
`group_leaders` (replaced by `leaders`) · `card_ranges`, `seva_rules` (shown in sheets only; the real cards are in
`worker/src/cards.js`) · `inactive_requests` (replaced by `activity_events`) · `run_log` (API timings, kept 3 months:
useful only for usage reports) · `app_ids`, `id_sequences` (ID issuing).

Columns known to be empty or unused (never read meaning into them): `accounts.signup_state`, `signup_at`,
`approved_by`, `approved_at`, `requested_group_leader`; `memberships.group_leader`; `submissions.bridged_at`;
12 of the newer `profiles` columns. The full list is in `docs/DATA_DICTIONARY.md`.

## 6. Data conventions

- **Empty text is `''`, not NULL.** Write `col <> ''`, not `col IS NOT NULL`. Exceptions: `accounts.iyf_id`, the `fac_id` columns, `submissions.morning`, `drafts.d1…d7`.
- **Dates and times are text.** Dates are `YYYY-MM-DD`; times are ISO strings in IST, e.g. `2026-10-12T07:14:00+05:30`. A few columns are UTC (`…Z`) and two are epoch numbers. Compare times as text only within one column.
- **`audit_log.before` and `after`** are JSON text. Read them with `json_extract(after, '$.field')`.
- **Deleted people** are anonymised, not removed: their past weeks stay with a login like `deleted-<hex>`. Leave them out of named lists (`login NOT LIKE 'deleted-%'`) and keep them in totals.

## 7. Test records to leave out

Until real batches start in November, these are test data: training **ETP-21**, devotee **Suraj Sahu**, and the login
**6000000303** (Praveen). Test phone numbers are in the ranges `60000000xx` and `60000001xx`. Filter them out of any
report shown to others. After November, the head will say which test records are removed.

## 8. Rules that make the numbers right

These are the method of the 26 Oct three-month analysis and of Admin › Reports. Use them, so that reports compare.

1. **Quality is averaged over submitted weeks only.** A missed or blank week is not a 0 in averages of Overall, rounds, night stay and so on. (The leaderboard is the exception: there a missed week counts 0, by design.)
2. **Report reporting on its own:** weeks submitted ÷ weeks due, plus the count of people who never submitted. This was the biggest problem found in the analysis (29.5% of devotee-weeks scored).
3. **Use the final Overall** (section 4.5), not the stored `overall`, whenever attendance could have changed.
4. **Who was due a week** = an `ACTIVE` membership covering that week, of an `ACTIVE` `DEVOTEE` account. If a person has two memberships covering the same week, count them once (`MIN(batch_id)`, as the deadline job does).
5. **Weighted averages over periods.** Average across a period with `SUM(sum_x) ÷ SUM(submitted)`. Never average the weekly averages.
6. **Rounds are averaged over those who gave them** (`n_rounds` in `batch_weeks`; `avg_rounds <> ''` in `submissions`).
7. **Attendance = present ÷ held**, held = marked weeks only.
8. **Only closed weeks are final:** `week_id <= settings.deadline_done`.
9. **Missed weeks exist only from 26 Oct 2026** (`tracking_from`). Before that, "no record" is all you can say.
10. **TRD and Vedic batches are different.** TRD does not score attendance and is out of 205 a day. VL-2/VL-3 track attendance (and rounds), not the six-item card. Do not rank them against class batches.
11. **Trainings are not class batches.** Training figures come from `enrolments`, `training_attendance` and `batch_closings`, never from `memberships`, and trainings never appear on a class leaderboard.
12. **Say how many people a number rests on.** Below 5 people or weeks, show the number but do not call it a trend.
13. **Targets come only from the app's own rules** (promotion criteria, card targets), never invented for a report.

## 9. Query library

The files are in `docs/reporting-sql/`. Each one was run on the live database on 27 Oct 2026; the rows-read
figure shows what it cost then, on the small test data. Change the dates (`'2026-09-01'` / `'2026-12-31'`) to your
period, or replace them with `?1` / `?2` and pass the dates to `d1_to_csv.py`.

| File | Report | Reads from | Rows read (27 Oct) |
|---|---|---|---|
| `r01_batch_trend.sql` | Every batch, week by week: reporting, Overall/Body/Soul, wake and bed scores, rounds, minutes, night stay, principles, attendance | `batch_weeks` | 8 |
| `r02_period_by_batch.sql` | One line per batch for a whole period (weighted) | `batch_weeks` | 14 |
| `r03_reporting.sql` | Per batch and week: due, submitted, missed, no record, reporting % | `memberships`, `submissions`, `missed_weeks` | 231 |
| `r04_devotee_period.sql` | Each devotee over a period: weeks, final Overall, Body, Soul, rounds, night stay, principles, days filled | `submissions`, `attendance` | 18 |
| `r05_facilitator.sql` | Each facilitator: current students, their weeks and scores in the period | `memberships`, `facilitators`, `submissions` | 115 |
| `r06_days.sql` | Day by day for one batch-week: wake, bed, rounds, minutes, marks | `submissions.week_json` | 16 |
| `r07_leaderboard.sql` | The leaderboard, as the app ranks it | `submissions`, `missed_weeks` | 19 |
| `r08_trainings.sql` | Each training: enrolled now, ended, training attendance | `batches`, `enrolments`, `training_attendance` | 15 |
| `r09_coord_work.sql` | Coordinators' work by person and action in a month | `audit_log` | 146 |
| `r10_growth.sql` | Sign-ups per month and where they stand now | `accounts` | 38 |
| `r11_card.sql` | Lead-measure card: target against filled, per person and measure | `targets`, `fills`, `measures` | 58 |
| `r12_identity.sql` | Devotee with IYF ID, year connected, identity name | `accounts`, `person_*` | 145 |
| `r13_health.sql` | Active devotees with no facilitator, no batch or an unfinished profile | `accounts`, `memberships`, `profiles` | 69 |

### R1 — Batch trend by week (start here)

```
SELECT bw.week_id, bw.batch_id, b.name AS batch,
       bw.submitted, bw.missed,
       ROUND(bw.sum_overall * 1.0 / NULLIF(bw.submitted, 0), 1) AS avg_overall,
       ROUND(bw.sum_body    * 1.0 / NULLIF(bw.submitted, 0), 1) AS avg_body,
       ROUND(bw.sum_soul    * 1.0 / NULLIF(bw.submitted, 0), 1) AS avg_soul,
       ROUND(bw.sum_wake    * 1.0 / NULLIF(bw.submitted, 0), 1) AS avg_wake_score,
       ROUND(bw.sum_bed     * 1.0 / NULLIF(bw.submitted, 0), 1) AS avg_bed_score,
       ROUND(bw.sum_rounds  * 1.0 / NULLIF(bw.n_rounds, 0), 1)  AS avg_rounds_a_day,
       ROUND(bw.sum_reading * 1.0 / NULLIF(bw.submitted, 0))    AS reading_min_a_week,
       ROUND(bw.sum_hearing * 1.0 / NULLIF(bw.submitted, 0))    AS hearing_min_a_week,
       ROUND(bw.sum_seva    * 1.0 / NULLIF(bw.submitted, 0))    AS seva_min_a_week,
       ROUND(100.0 * bw.night_yes      / NULLIF(bw.submitted, 0)) AS night_stay_pct,
       ROUND(100.0 * bw.principles_yes / NULLIF(bw.submitted, 0)) AS principles_pct,
       bw.present, bw.held,
       ROUND(100.0 * bw.present / NULLIF(bw.held, 0))           AS attendance_pct
  FROM batch_weeks bw JOIN batches b ON b.batch_id = bw.batch_id
 WHERE bw.week_id BETWEEN '2026-09-01' AND '2026-12-31'
 ORDER BY bw.week_id, bw.batch_id;
```

`batch_weeks` holds sums, not averages, so any period and any grouping of batches can be built from it. A year of
every batch is a few hundred rows. Use it for anything at batch level. Its columns: `submitted`, `missed`,
`sum_overall` (final), `sum_body`, `sum_soul`, `sum_bed`, `sum_wake` (scores), `n_rounds` / `sum_rounds`,
`sum_reading` / `sum_hearing` / `sum_seva` (week minutes), `night_yes`, `principles_yes`, `present` / `held`,
`n_morning` / `sum_morning` (TRD).

### R2 — One line per batch for a period

```
SELECT bw.batch_id, b.name AS batch, COUNT(*) AS weeks_closed,
       SUM(bw.submitted) AS weeks_submitted, SUM(bw.missed) AS weeks_missed,
       ROUND(SUM(bw.sum_overall) * 1.0 / NULLIF(SUM(bw.submitted), 0), 1) AS avg_overall,
       ROUND(SUM(bw.sum_rounds)  * 1.0 / NULLIF(SUM(bw.n_rounds), 0), 1)  AS avg_rounds_a_day,
       ROUND(100.0 * SUM(bw.night_yes) / NULLIF(SUM(bw.submitted), 0))   AS night_stay_pct,
       ROUND(100.0 * SUM(bw.present)   / NULLIF(SUM(bw.held), 0))        AS attendance_pct
  FROM batch_weeks bw JOIN batches b ON b.batch_id = bw.batch_id
 WHERE bw.week_id BETWEEN '2026-09-01' AND '2026-12-31'
 GROUP BY bw.batch_id ORDER BY avg_overall DESC;
```

### R3 — Reporting: who was due, who submitted

```
WITH weeks AS (SELECT DISTINCT week_id FROM batch_weeks WHERE week_id BETWEEN '2026-09-01' AND '2026-12-31'),
due AS (
  SELECT w.week_id, m.login, MIN(m.batch_id) AS batch_id
    FROM weeks w
    JOIN memberships m ON m.state = 'ACTIVE' AND m.from_week <= w.week_id AND (m.to_week = '' OR m.to_week >= w.week_id)
    JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
   GROUP BY w.week_id, m.login)
SELECT d.week_id, d.batch_id, COUNT(*) AS due,
       SUM(s.login IS NOT NULL) AS submitted,
       SUM(x.login IS NOT NULL) AS missed,
       SUM(s.login IS NULL AND x.login IS NULL) AS no_record,
       ROUND(100.0 * SUM(s.login IS NOT NULL) / COUNT(*)) AS reporting_pct
  FROM due d
  LEFT JOIN submissions  s ON s.login = d.login AND s.week_id = d.week_id
  LEFT JOIN missed_weeks x ON x.login = d.login AND x.week_id = d.week_id
 GROUP BY d.week_id, d.batch_id ORDER BY d.week_id, d.batch_id;
```

The memberships and account status used here are today's (section 4.2), so a person who has since left or gone
inactive drops out of past weeks too. For weeks from 26 Oct on, `batch_weeks.submitted + missed` gives the count the
deadline job itself recorded; prefer it where it is enough.

### R4 — Each devotee over a period (final Overall)

```
SELECT s.login, a.name, s.batch_id,
       COUNT(*) AS weeks_submitted,
       ROUND(AVG(CASE WHEN s.score_card IN ('TRD') THEN s.overall ELSE
         CASE COALESCE(NULLIF(at.master_mark,''), NULLIF(at.coordinator_mark,''), NULLIF(at.leader_mark,''),
                       CASE WHEN cw.batch_id IS NULL THEN NULL WHEN cw.mode = 'ALL_PRESENT' THEN 'P' ELSE 'A' END,
                       NULLIF(at.devotee_mark,''), '')
           WHEN 'P' THEN CASE WHEN s.attendance = 100 THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + 100 + s.seva) / 4.0))) END
           WHEN 'A' THEN CASE WHEN s.attendance = 0   THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + s.seva) / 4.0))) END
           ELSE s.overall END END), 1) AS avg_overall,
       ROUND(AVG(s.body), 1) AS avg_body, ROUND(AVG(s.soul), 1) AS avg_soul,
       ROUND(AVG(NULLIF(s.avg_rounds, '') + 0), 1) AS avg_rounds_a_day,
       SUM(s.night_stay = 'YES') AS nights_yes, SUM(s.principles = 'YES') AS principles_yes,
       ROUND(AVG(s.days_filled), 1) AS avg_days_filled
  FROM submissions s
  JOIN accounts a ON a.login = s.login
  LEFT JOIN attendance  at ON at.login = s.login AND at.week_id = s.week_id
  LEFT JOIN class_weeks cw ON cw.batch_id = s.batch_id AND cw.week_id = s.week_id
 WHERE s.week_id BETWEEN '2026-09-01' AND '2026-12-31' AND s.login NOT LIKE 'deleted-%'
 GROUP BY s.login ORDER BY avg_overall DESC;
```

### R5 — By facilitator

```
SELECT COALESCE(f.name, '(no facilitator)') AS facilitator, f.id AS fac_id,
       COUNT(DISTINCT m.login) AS students,
       COUNT(s.login) AS weeks_submitted,
       ROUND(AVG(s.overall), 1) AS avg_overall_stored,
       ROUND(AVG(NULLIF(s.avg_rounds, '') + 0), 1) AS avg_rounds_a_day
  FROM memberships m
  JOIN accounts a ON a.login = m.login AND a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
  LEFT JOIN facilitators f ON f.id = m.fac_id
  LEFT JOIN submissions s ON s.login = m.login AND s.week_id BETWEEN '2026-09-01' AND '2026-12-31'
 WHERE m.state = 'ACTIVE' AND m.to_week = ''
 GROUP BY f.id ORDER BY students DESC;
```

This groups by the **current** facilitator. For "students under each facilitator at the time", join submissions to
the membership that covered the week instead (`m.from_week <= s.week_id AND (m.to_week = '' OR m.to_week >= s.week_id)`).
Swap `AVG(s.overall)` for the final-Overall expression from R4 when attendance may have changed.

### R6 — Day by day (from week_json)

```
SELECT s.login, s.batch_id, s.week_id,
       json_extract(d.value, '$.date')       AS day,
       json_extract(d.value, '$.wokeAt')     AS woke_at,
       json_extract(d.value, '$.sleptAt')    AS slept_at,
       json_extract(d.value, '$.rounds')     AS rounds,
       json_extract(d.value, '$.readingMin') AS reading_min,
       json_extract(d.value, '$.hearingMin') AS hearing_min,
       json_extract(d.value, '$.serviceMin') AS seva_min,
       json_extract(d.value, '$.m.wake_up[1]') AS wake_marks
  FROM submissions s, json_each(CASE WHEN s.week_json <> '' THEN json_extract(s.week_json, '$.days') ELSE s.days_json END) d
 WHERE s.week_id = '2026-10-05' AND s.batch_id = 'SPS2'
   AND json_extract(d.value, '$.wokeAt') IS NOT NULL
 ORDER BY s.login, day;
```

### R7 — Leaderboard for a period

```
WITH w AS (
  SELECT s.login, s.batch_id,
         CASE WHEN s.score_card IN ('TRD') THEN s.overall ELSE
           CASE COALESCE(NULLIF(at.master_mark,''), NULLIF(at.coordinator_mark,''), NULLIF(at.leader_mark,''),
                         CASE WHEN cw.batch_id IS NULL THEN NULL WHEN cw.mode = 'ALL_PRESENT' THEN 'P' ELSE 'A' END,
                         NULLIF(at.devotee_mark,''), '')
             WHEN 'P' THEN CASE WHEN s.attendance = 100 THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + 100 + s.seva) / 4.0))) END
             WHEN 'A' THEN CASE WHEN s.attendance = 0   THEN s.overall ELSE MAX(0, MIN(100, ROUND((s.body + s.soul + s.seva) / 4.0))) END
             ELSE s.overall END END AS score, 0 AS missed
    FROM submissions s
    LEFT JOIN attendance  at ON at.login = s.login AND at.week_id = s.week_id
    LEFT JOIN class_weeks cw ON cw.batch_id = s.batch_id AND cw.week_id = s.week_id
   WHERE s.week_id BETWEEN '2026-09-01' AND '2026-12-31'
  UNION ALL
  SELECT x.login, x.batch_id, 0, 1 FROM missed_weeks x
   WHERE x.week_id BETWEEN '2026-09-01' AND '2026-12-31'
     AND NOT EXISTS (SELECT 1 FROM submissions s2 WHERE s2.login = x.login AND s2.week_id = x.week_id)
     AND NOT EXISTS (SELECT 1 FROM reopens r WHERE r.login = x.login AND r.week_id = x.week_id AND r.state = 'OPEN'))
SELECT w.login, a.name, MAX(w.batch_id) AS batch_id, COUNT(*) AS weeks, SUM(w.missed) AS missed,
       ROUND(SUM(w.score) * 1.0 / COUNT(*)) AS score
  FROM w JOIN accounts a ON a.login = w.login
 WHERE w.login NOT LIKE 'deleted-%'
 GROUP BY w.login ORDER BY score DESC, a.name;
```

Equal scores share a place (two 4ths, then 6th). Add `AND s.batch_id IN (…)` and `AND x.batch_id IN (…)` for one
batch, and leave trainings out.

### R8 — Trainings

```
SELECT b.batch_id, b.name, b.started_on, b.ends_on, b.closed_at,
       (SELECT COUNT(*) FROM enrolments e WHERE e.batch_id = b.batch_id AND e.state = 'ACTIVE') AS enrolled_now,
       (SELECT COUNT(*) FROM enrolments e WHERE e.batch_id = b.batch_id AND e.state = 'ENDED')  AS ended,
       (SELECT SUM(mark = 'P') FROM training_attendance t WHERE t.batch_id = b.batch_id) AS present_marks,
       (SELECT SUM(mark <> '') FROM training_attendance t WHERE t.batch_id = b.batch_id) AS marks_given
  FROM batches b WHERE b.level = 'ETP' OR b.batch_id GLOB '[EMF]TP-*';
```

How each enrolment ended is in `batch_closings` (`qualified`, `repeat`, `left`). An ended enrolment with no closing
row was removed by the coordinator.

### R9 — Coordinators' work

```
SELECT who, action, COUNT(*) AS n, MIN(at) AS first, MAX(at) AS last
  FROM audit_log
 WHERE at >= '2026-10-01' AND at < '2026-11-01'
   AND action IN ('requests.approve','requests.reject','resets.approve','resets.reject','weeks.reopen','reopen.reject',
                  'attendance.set','attendance.override','week.submit.onBehalf','group.mark','enrol.add','enrol.remove',
                  'training.attendance','devotees.promote','batches.close','leaders.assign')
 GROUP BY who, action ORDER BY who, n DESC;
```

To list every action name that exists: `SELECT action, COUNT(*) FROM audit_log GROUP BY action`.

### R10 — Growth

```
SELECT substr(signed_up_at, 1, 7) AS month, COUNT(*) AS signed_up,
       SUM(status = 'ACTIVE') AS active_now, SUM(status = 'PENDING') AS still_pending, SUM(status = 'REJECTED') AS rejected
  FROM accounts WHERE role = 'DEVOTEE' AND signed_up_at <> ''
 GROUP BY month ORDER BY month;
```

Also useful: approvals by `decided_at` / `decided_by`; promotions from `batch_closings` (`decision = 'promoted'`);
went inactive and came back from `activity_events` by `day`.

### R11 — Lead-measure card

```
SELECT t.phase_id AS card, t.login, a.name, m.seq, m.label, m.frequency, m.kind, t.target,
       COUNT(fl.id) AS weeks_filled,
       SUM(CASE WHEN m.kind = 'YESNO' THEN fl.value = 'YES' ELSE 0 END) AS yes_weeks,
       SUM(CASE WHEN m.kind <> 'YESNO' THEN fl.value + 0 ELSE 0 END)     AS total_filled
  FROM targets t
  JOIN measures m ON m.measure_id = t.measure_id
  JOIN accounts a ON a.login = t.login
  LEFT JOIN fills fl ON fl.phase_id = t.phase_id AND fl.login = t.login AND fl.measure_id = t.measure_id
 WHERE t.phase_id IN ('kartik-2026', 'ETP-21')   -- a facilitator's card: the phase id; a trainee's: the training batch id
 GROUP BY t.login, t.measure_id ORDER BY a.name, m.seq;
```

### R12 — Devotee with IYF ID

```
SELECT a.login, a.name AS app_name, a.status, m.batch_id,
       pi.fid AS iyf_id, p.connected_since, pn.name AS identity_name
  FROM accounts a
  LEFT JOIN memberships m ON m.login = a.login AND m.state = 'ACTIVE' AND m.to_week = ''
  LEFT JOIN person_links pl ON pl.service = 'sadhana' AND pl.account_ref = a.login
  LEFT JOIN persons p ON p.id = pl.person_id
  LEFT JOIN person_identifiers pi ON pi.person_id = p.id AND pi.state = 'current' AND pi.series = 'IYFD'
  LEFT JOIN person_names pn ON pn.person_id = p.id AND pn.is_current = 1
 WHERE a.role = 'DEVOTEE'
 ORDER BY a.name LIMIT 50;
```

A devotee with no year of connection has no IYF ID yet (empty `iyf_id`). That is expected, not an error.

### R13 — Data health

```
SELECT a.login, a.name,
       COALESCE(m.batch_id, '') AS batch_id,
       m.fac_id IS NULL AS no_facilitator,
       m.login IS NULL AS no_batch,
       (p.login IS NULL OR p.dob = '' OR p.addr_city = '') AS profile_incomplete
  FROM accounts a
  LEFT JOIN memberships m ON m.login = a.login AND m.state = 'ACTIVE' AND m.to_week = ''
  LEFT JOIN profiles p ON p.login = a.login
 WHERE a.role = 'DEVOTEE' AND a.status = 'ACTIVE'
   AND (m.login IS NULL OR m.fac_id IS NULL OR p.login IS NULL OR p.dob = '' OR p.addr_city = '');
```

## 10. Building a custom report, step by step

**Step 1. Write the question as a sentence**, with its period, scope and the people it is for:
"For Kartik 2026, per DPS facilitator, how many students submitted at least 3 of 4 weeks, and their average wake-up
score."

**Step 2. Check whether the app already answers it.** Admin › Analysis (trends by batch), Admin › Reports (any
period: reporting, quality, attendance, batches, facilitators, leaderboards, trainings, coordinators' work, growth,
data health), the Leaderboard and the Scoreboards. If it does, use the app's report, or match it.

**Step 3. Pick the smallest source** that holds the answer:

| Level of the answer | Read from |
|---|---|
| Batch × week, or any total of batches | `batch_weeks` |
| Person × week | `submissions` (+ `attendance`, `missed_weeks`) |
| Person × day | `submissions.week_json` (few weeks at a time, or a local copy) |
| Who did what | `audit_log` |
| People, structure | `accounts`, `memberships`, `batches`, `facilitators` |

**Step 4. Write the SQL from the closest query in section 9**, and apply the rules in section 8.

**Step 5. Prove it before you share it.** Check one batch and one week against the app:

| Your number | Must equal, in the app |
|---|---|
| A batch's average Overall, reporting, rounds for a week or period | Admin › Analysis for the same batch and dates |
| A person's score for a week | The batch Board for that week, and the person's History |
| A ranking | Leaderboard, same batch and dates |
| A facilitator's card or net score | Facilitator › Scoreboard |
| A training's figures | The training's Batch status |

If they differ, the report is wrong until you know why.

**Step 6. Save the query as a `.sql` file** with a comment line saying what it answers and which rules it uses.
Share the SQL with the team; share results only as section 12 allows.

## 11. Cost and timing

- **Free-plan budget:** 5 million rows read and 100,000 rows written a day, for the whole app and every report. Writes are the tight one, and a read token cannot write.
- **Look at the cost of every query** you will run often: `meta.rows_read` in the JSON, or the "rows read" line of `d1_to_csv.py`. At 5,000 devotees, one year of `submissions` is about 260,000 rows; the same year in `batch_weeks` is a few hundred.
- **Filter on indexed columns.** Indexes exist on: `submissions (week_id, batch_id)` and `(login, week_id)`; `attendance (week_id, batch_id)`; `missed_weeks (batch_id, week_id)`; `batch_weeks (week_id)`; `memberships (batch_id, to_week)`, `(fac_id, to_week)`, `(login)`; `enrolments (batch_id, state)`; `audit_log (at)`, `(who)`, `(target)`; `fills (login, phase_id, week_id)`; `targets (login, phase_id)`. A filter on a column without an index reads the whole table.
- **No `SELECT *` without `WHERE` and `LIMIT`** on the large tables (`submissions`, `audit_log`, `attendance`, `persons`).
- **Quiet hours only for anything heavy:** never Sunday evening or Monday until 10 PM IST (devotees submitting, the deadline job running).
- **Repeat reports:** for a dashboard that refreshes, read `batch_weeks` once a day, not every few minutes.

## 12. Personal data

The database holds names, phone numbers, addresses, dates of birth and parents' details of devotees, some under 18.

- Select only the columns a report needs. Most reports need `login`, `accounts.name`, `batch_id` and scores, nothing more.
- **Never select** `pw_hash`, `pw_salt`, `token_hash`, `new_pw_hash` or `photos.jpeg`.
- Phone, email, WhatsApp, address, date of birth, parent and emergency details stay out of any report that leaves the head's hands, unless the head asks for them for that report.
- Do not paste results into chat groups, public sheets or AI tools. Delete local copies and CSVs when the task is done.
- The database holds no ID-proof numbers (Aadhaar or other) and never will. Do not add such columns to any report or sheet built from it.

## 13. When something looks wrong

| You see | Likely reason |
|---|---|
| A week's numbers changed after you reported them | A late attendance mark or a reopened week. `batch_weeks` re-sums the last four weeks every Monday |
| No missed weeks before 26 Oct | Correct: tracking starts at `tracking_from` |
| A person in two batches in one week | Two memberships overlap; count once (rule 4) |
| A facilitator's name differs from an old sheet | Renamed; match through `facilitator_names` |
| A person has two IYF IDs | An old series ID still marked current; use `series = 'IYFD'` |
| Overall differs from the app by a few points | You used the stored `overall`; use the final Overall |
| "no such table" / "no such column" | Check the migration level (section 3) and `PRAGMA table_info(<table>)` |
| Empty results | `--remote` missing, or wrong account (`npx wrangler whoami`) |
| Authentication error | Token expired or removed; ask the head |

## 14. Glossary

| Term | Meaning |
|---|---|
| Sadhana | The daily spiritual practice a devotee reports weekly |
| Japa / rounds | Chanting on beads; one round = 108 names; the day's count is `rounds` |
| Pathan / reading | Reading the batch's books (minutes) |
| Sravan / hearing | Hearing the batch's lectures (minutes) |
| Seva | Service, in minutes a week |
| Night stay | The week-end YES/NO question "Night Stay", opened on Saturday 6 PM; a promotion criterion (≥ 80% of weeks) |
| Four principles | The four regulative principles followed all week (YES/NO) |
| Morning program | TRD only: attending the temple morning program |
| Batch tags | SPS, DPS, BSS, BVS (class batches), TRD (temple residents), VL-2 / VL-3 (Vedic intakes), ETP (training) |
| Facilitator | A senior devotee who looks after a group of students (`facilitators`, `F001`…) |
| Coordinator | Staff who run a batch or training: approve sign-ups, mark attendance, close batches |
| Phase | A four-month facilitation period: Gaur, Jagannath, Kartik |
| Card | A facilitator's or trainee's weekly lead-measure sheet |

## 15. Where to look next

| Need | Document |
|---|---|
| Read-only access, full rules | `docs/database-access.pdf` |
| The head's full access, export, restore | `docs/database-owner-access.pdf` (the head only) |
| Every column of every table | `docs/DATABASE.md` (12 Oct; newer tables in the migrations) |
| What values mean, states, known unused columns | `docs/DATA_DICTIONARY.md` |
| The exact table definitions | `worker/migrations/*.sql`, or `PRAGMA table_info(<table>)` |
| What Admin › Reports contains | `docs/REPORTS_SPEC_2026-10-27.md` |
| How a score is worked out | `shared/scoring.js`, `worker/src/cards.js` |
| Leaderboard, analysis, cards, promotion in code | `worker/src/leaderboard.js`, `analysis.js`, `phases.js`, `eligible.js` |
| The 3-month analysis method | `reports/sadhana-analysis-2026-10/` |
