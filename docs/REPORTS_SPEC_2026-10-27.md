# Admin › Reports — a report for any period, built inside the app

*27 Oct 2026 · the head's request · Phase 23 item P14 · nothing here is built yet*

## What the head asked

> "Similar to the 360-degree report we generated yesterday … a custom-date report for the entire app: sadhana,
> facilitators, coordinators, trainers, quiz assessments … I select the range — phase-wise, a week or anything — click
> export, and it develops the report on its own, within the app. Scoreboards, leaderboards, everything the app has. The
> best version of a report: what bothers the organisation, and what gives hope for improvement."

## What it is

A **Reports** screen in Admin. Pick a period and a scope; the app builds the report on the screen in a few seconds; then
**Save as PDF** (A4, IYF cover band, page numbers) or **Download the tables (CSV)**. Nothing is generated outside the app,
and no file is stored: a report is worked out from the live data each time, so it is never out of date.

### 1. Choose

- **Period** — This week · Last week · This month · a **phase** (from the phases list, its own dates) · a **training**
  (ETP etc., its own start and end) · **Custom** (from–to, the app's calendar). Weeks are whole Monday–Sunday weeks;
  a custom range shows which weeks it covers.
- **Compared with** — the period just before, of the same length (on by default). Every number then shows its change.
- **Scope** — All of IYF Delhi · one batch · one facilitator · one training batch.
- **Sections** — all ticked by default; untick to shorten.

### 2. The report (sections, in this order)

| # | Section | What it answers | From |
|---|---|---|---|
| 1 | **Summary** (one page) | the five numbers that matter, what improved, what worries, the three things to do next | all below |
| 2 | **Reporting** | who fills their sadhana: weeks filled ÷ weeks due, never-filled people, by batch and facilitator — the first-order problem found in the 3-month analysis | `batch_weeks`, submissions, missed weeks |
| 3 | **Sadhana quality** | rounds, wake-up, bed, reading, hearing, seva, principles, night stay; Body / Soul / Overall on filled weeks; weakest and strongest practice | `batch_weeks` (sums) |
| 4 | **Attendance** | present ÷ classes held, by batch; weeks with no class | attendance, `batch_weeks` |
| 5 | **Batches compared** | every batch side by side, with its change | `batch_weeks` |
| 6 | **Facilitators** | each facilitator's students, their reporting and quality, the scorecard (sadhana and seva against target), promotions in the period | the existing scorecard / board functions |
| 7 | **Scoreboards and leaderboards** | the period's scoreboard (phase or training) and the top devotees, as the app shows them | the existing leaderboard / scoreboard functions |
| 8 | **Trainings** (ETP and others) | enrolled, attending, completing; trainer (training coordinator) view | trainings, enrolments, training attendance |
| 9 | **Coordinators' work** | sign-ups approved, requests answered and how fast, reopened weeks, resets — the service the coordinators give | requests, audit log |
| 10 | **Growth and care** | new devotees, promotions, who went inactive and who came back, birthdays reached | accounts, memberships, activity |
| 11 | **Data health** | missing profiles, duplicates waiting for review, people with no facilitator | the existing checks |
| 12 | **What to do next** | plain sentences with the numbers: "Wake-up is the weakest practice in DPS (2.1 of 5); it rose 0.3 since last month" — the good news first, then the three most useful actions | worked out from 1–11 |

**Quiz and assessments:** the app does not record any yet. When it does, they become a section here; nothing is shown
for them until then.

### 3. The method (the same as the 26 Oct 3-month analysis, so reports compare)

- A blank week is **not** a zero: quality is averaged over filled weeks, and reporting is shown on its own.
- Attendance = present ÷ classes held. A blank mark is absent, as on the dashboard before.
- Targets come only from the app's own rules (criteria, phase targets).
- Each number says how many people or weeks it rests on. Below 5, it is shown, but not called a trend.

## Who can use it

- **The head:** every scope.
- **A new right, "Reports",** given in Access like any other (ADR 0019). A coordinator with it gets the report for their
  own batches only, a facilitator for their own students, a training coordinator for their own trainings. The server
  decides the scope; the screen never offers what it would refuse.

## How it is built (the free plan and low-end phones)

- **One server call per report** (`report.get`): every query in the same `reads()` batch, mostly from `batch_weeks`
  (one row per batch per week — a year of every batch is a few hundred rows). The facilitator, scoreboard and
  leaderboard figures come from the functions those screens already use, never a second copy of their logic.
- **The phone writes the report.** It does the averages, comparisons, charts (inline SVG, no chart library) and
  sentences, as Admin › Analysis already does.
- **Staff-only screen:** loaded only when opened, never in a devotee's offline copy.
- **Save as PDF:** the browser's own print to PDF, with an A4 print style; no PDF library is downloaded. The CSV uses the
  same tables. Where printing is not available (some installed-app shells), the report opens in the browser.
- Long ranges are allowed up to a year; beyond that the screen asks for a shorter one.
