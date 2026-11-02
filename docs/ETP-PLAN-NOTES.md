# ETP — the head's plan, as told on 17 October 2026

Notes only. Nothing built. Written down as the head describes it so the gaps are
visible before any of it is designed.

---

## The shape

ETP (the training programme) has **two sides**:

* **the coordinator's side** — students are added to an ETP batch from people who
  are ALREADY members of the app. The head will define this side later.
* **the student's side** — what a facilitator does in the facilitator dashboard:
  when the admin starts a phase (e.g. "Kartik phase"), they fill in their
  targets, and are scored against them.

On finishing the training successfully, ETP students are **promoted to official
facilitators**, and from then on see the facilitator scoreboard.

---

## One person, many identities — and the app already works this way

The head: *"a devotee can be a group leader, a coordinator, an etp batch member,
so one person can take many identities"*, and a new tab appears for each.

This is the existing model, not a change to it. `scopesOf()`
(`frontend/src/lib/scopes.js`) returns five INDEPENDENT scopes on one account:

    { devotee, groupLeader, facilitator, coordinator[], master }

They stack. A group leader's extra tab appears because `groupLeader` is set, not
because their role changed. So **"ETP member" becomes a sixth scope**, and its
tab appears by the same mechanism. (See ADR 0005, derived roles / coarse gate.)

### Two consequences worth deciding deliberately

1. **The nav is already full.** On a 320 px phone the bottom bar carries Home,
   Requests, Admin, Batch, Account — edge to edge, as the head's screenshot of
   16 Oct shows. A sixth scope means a sixth tab for anyone holding several
   identities. Overflow, grouping, or a "More" — a design decision, not a
   blocker, but better chosen than discovered.

2. **Promotion to facilitator is a SCOPE change, not a batch move.** An ETP
   student who finishes training GAINS the `facilitator` scope; they do not stop
   being a devotee. That is a different verb from the VL-2 → VL-3 promotion
   built on 16 Oct, which MOVES a membership from one batch to another. Keeping
   the two apart in the design will save confusion later:
   * **move** — one batch to another, closes one membership and opens another
   * **gain** — a scope is added, nothing is closed

---

## What is NOT in this app, and has to be settled before building

The head said he hopes "the entire context of the score board is there already".
It is not, and saying so now is cheaper than discovering it mid-build.

`sadhanaRecord` has only:

* `facilitators.js` — the LIST OF NAMES a devotee picks from at sign-up
* `facilitator.js` — facilitator LOGINS, which view their devotees' sadhana

There is **no phases table, no targets, no scoreboard, no "Kartik phase"**. All
of that lives in `faciliatorDashboard`, the separate Google Sheets system, which
Sadhana work never modifies (the head's standing rule: keep the projects
separate; the read-only Devotees tab is the only link).

### The four questions

1. **What is a target?** Its fields, its units, how many a facilitator sets in a
   phase.
2. **How does scoring work?** What turns filled targets into a scoreboard figure.
3. **Where does this live?** If ETP students become facilitators whose scoreboard
   is in the dashboard, the boundary between the two systems has to be drawn on
   purpose — the "keep projects separate" rule makes this the important one.
4. **What does "promoted to official facilitator" mean mechanically?** A
   `facLogins` account? Their name joining the `facilitators` list devotees pick
   from at sign-up? Both?

Until (1) and (2) are answered, the student side cannot be designed, because it
is defined entirely as "the same as what facilitators do".

---

## The card, read from the dashboard (17 Oct 2026)

The head pointed at the overall sheet; its "Facilitation seva lead measures" tab
(gid 1344529216) is readable, and it defines the card both sides are to fill.

**23 facilitator cards**, one per facilitator, each headed with the phase:
`Gopinath Murari Das - September to December (Kartik Phase)`, and a running
percentage beside it (75.56% on the first).

**11 lead measures**, the same on every card:

| # | Lead measure | Frequency | Weekly target |
|---|---|---|---|
| 0 | Sadhna | Weekly | 80 |
| 1 | number of hours — Stall preaching (in hrs) | Weekly | 5 |
| 2 | Number of — Calling to the New Student | Weekly | 10 |
| 3 | Sunday VL-1 Facilitation Attendance | Weekly | Yes/No |
| 4 | Sunday VL-2/3 Facilitation Attendance | Weekly | Yes/No |
| 5 | No. of Students — One to One Meeting With devotees | Weekly | 15 |
| 6 | FTP Training Attendance | Weekly | Yes/No |
| 7 | Monthly time — Facilitator Meeting with Senior Facilitator / Area Leader | Monthly | 1 |
| 8 | no. of serious Students — one to one meeting with Senior Facilitator | Monthly | 5 |
| 9 | no. of meeting — all facilitation Students meeting with Senior Facilitator | Monthly | 1 |
| 10 | Facilitation Journal update | Monthly | Yes/No |

**Three value types**, which the app's form will have to carry:

* a **number** (hours, counts)
* a **Yes/No**
* a **per-level target block** attached to measure 5, e.g. `VL-3: 8 / SPS: 6 /
  DPS-BSS: 5` — a target that differs by the level of the student being met

Columns run as dated weeks (`7 Sep'26 to 13 Sep'26`, …) with a month column
folded in (`Sep'26`), so a card is **targets × weeks**, not a single form.

---

## Who sees the scoreboard (the head, 17 Oct 2026)

| Whose scores | Seen by |
|---|---|
| **ETP students** | the ETP coordinator, **and** the admin |
| **Official facilitators** | the admin dashboard |

Two things follow, and both are worth settling before any of it is built.

**The ETP coordinator sees a scoreboard; a batch coordinator does not.** An ETP
coordinator is not the same thing as an SPS or VL-2 coordinator — they hold a
training programme, and this is the first view that belongs to one of them and
not to the other. That is the same class/training distinction already blocking
`REPORTED-2026-10-17.md` item 4 (a class coordinator must not delete accounts,
a training one may). One distinction, now wanted by two features: it should be
built once, deliberately, rather than twice by accident.

**"Visible in the admin dashboard" needs disambiguating.** The head has used
"dashboard" for two different things in one conversation:

* the Google Sheets system (`faciliatorDashboard`), where facilitator targets,
  phases and scoring already live;
* the admin area of the Sadhana app.

For the facilitators' scoreboard it matters which, because the targets are
DEFINED in the sheets and the head wants them FILLED in the app. If the board is
also to be read in the app, then the app holds the filled values and the sheet
holds the definitions — a new link between two systems the standing rule keeps
apart. Which side owns the scores is the head's call, not an implementation
detail.

---

## DECIDED: the app is the system of record for facilitation too (17 Oct 2026)

The head: *"now we are fully building the sheet facilities in the app itself, so
sadhana will come from the app itself and training and all will be done with the
app data itself"*.

This settles the ambiguity above. There is no link to build between two systems:
targets, phases, filling and scoring all live here, and the sheet stops being
the source. The same move already made for devotee sadhana on 13 Oct, when
SHEETS_COPY was switched off and the app became the record.

### Why this is cheaper than it sounds: measure 0 is already here

The first lead measure on every card is **Sadhna**, weekly target 80 — and a
facilitator's own sadhana is ALREADY in this app, because a facilitator login is
attached to a devotee account:

    loginsLink()  →  accounts.facilitator_name is set ON A DEVOTEE'S OWN ROW
                     ("their sadhana and login stay as they are")

So a facilitator fills their week like any devotee, and measure 0 can be READ
rather than asked for again. The app should not make a facilitator type a number
it already holds — that is how two records of the same thing start disagreeing.

Whether the card's "80" is the devotee score the app already computes, or
something measured differently in the sheet, is a question for the head. The
same question applies to the three attendance measures (3, 4, 6), which may also
be derivable from attendance the app already takes.

### What this makes the app responsible for

* **phases** — a named, dated period the admin starts ("Kartik Phase",
  September to December), as the admin already starts things elsewhere
* **targets** — per person per phase, in the three value types above, set by the
  ETP coordinator (training side) and by whoever defines them for facilitators
* **filling** — weekly and monthly, by the person themselves
* **scoring** — the running percentage, whose formula is still unread (it is in
  the Apps Script, not the cells)
* **the boards** — ETP students to their coordinator and the admin;
  facilitators to the admin

### What it does not change

`faciliatorDashboard` is not modified, by the standing rule. It keeps running on
sheets until the head retires it; this is a build here, not a migration there.

---

## The dashboard's model, read from its source (17 Oct 2026)

The Apps Script is in `prompt/faciliatorDashboard/` — 25 `.gs`/`.html` files. So
nothing here is guesswork any more. What matters for the app:

### A phase

Three four-month phases on the calendar year (`MetricsService.gs:83`):

| key | name | months | span |
|---|---|---|---|
| `gaur` | Gaur Purnima Phase | 1–4 | January to April |
| `jagannath` | Jagannath Phase | 5–8 | May to August |
| `kartik` | Kartik Phase | 9–12 | September to December |

A phase can start a week early or late — the sheet's Phases tab overrides the
calendar. So **dates are data, not arithmetic**, which matches the VL intake
decision of 16 Oct (a coordinator closes, no timer).

### The score

```
net = (sadhana % + seva % + goal %) / 3        equal weights, 1 : 1 : 1
```

* **sadhana** arrives as a percent (98)
* **seva** arrives as a ratio (0.98) — the weekly lead-measure discipline
* **goal** is `capped achieved ÷ target` across the six stages

Two kinds of "nothing" are told apart deliberately, and the reasoning is worth
keeping:

* **no target set** → the goal term does not exist, so the average is over the
  two that do. Averaging a zero would punish somebody for a target nobody gave
  them. They rank after everyone who has a target.
* **not filled in** → sadhana or seva blank while the person IS measured counts
  as **zero**, because that is a gap in their own reporting.

Bands: ≥100 Exceeding · ≥80 On Track · ≥50 Progressing · else Needs Care.

### The six stages

`VL-1→VL-2 · VL-2→VL-3 · VL-3→SPS · SPS→DPS · DPS→BVS · DPS→BSS`
(`DataService.gs:41`) — the same ladder built into `closing.js` on 16 Oct, which
is a useful confirmation that the two systems already agree about the journey.

---

## Everyone sees their own figures (the head, 17 Oct 2026)

*"on the facilitator and ETP members part, all of them in their user login will
get the monthly average and all their personal analysis part"*.

So the boards are not only for the coordinator and the admin: the person
themselves opens their own. This is the same shape the app already gives a
devotee — their own report of their own weeks — extended to the facilitation
side.

### How the dashboard averages a phase, read from the source

`phaseSadhanaSeva()` (`MetricsService.gs:572`) is the whole model, and it is
simple: over the weeks of the phase, per person,

    sadhana = Σ sadhana ÷ weeks        seva = Σ seva ÷ weeks

It also returns `weeks` (how many weeks fell in the phase) and `filled` (how
many the person actually reported). Those two are the honest part: **an average
over 3 filled weeks out of 16 is not the same measurement as one over 16**, and
the screen must be able to say so. The app should carry both numbers for the
same reason it tells "no target set" apart from "not filled in".

`applyPhaseAverages_()` then replaces the live figures with the phase averages,
and **recomputes the score from them** — so a phase board is not a snapshot of
today, it is the phase's own average scored by the same formula.

### What a person's own screen should hold

Deliberately short; the dashboard's extras are listed under "leave" below.

* **this phase** — their net score, and the three parts it is made of
  (sadhana / seva / goal), since a single number nobody can take apart is not
  analysis
* **the monthly average**, with `weeks` and `filled` beside it so a thin month
  reads as thin rather than as low
* **their targets and what they filled**, measure by measure
* **their own trend across the phase** — the figure per week, which the app
  already has week by week and the sheet has to reconstruct

### Where this is cheaper here than in the sheet

The dashboard reconstructs weekly figures from a `Brahmachari Raw` tab. This app
**already stores every week** as a row, so a person's trend is a query, not a
rebuild. The same is true of attendance. That is the strongest argument for the
head's decision to move this into the app.

---

## Who is qualifying in a facilitator's own classes — computed here, no sheet

The head: the official facilitator's card also shows **who in their classes is
qualifying for the next level**, *"using the app's data, no sheet dependency"*.

This is the part the app is best placed to do, and the reason is concrete.

### How the dashboard does it today

It does **not** compute eligibility. `readEligibleDevotees_()`
(`DataService.gs:302`) READS a column from an `Eligibility` tab — someone else's
formulas decide, and the dashboard trusts the answer. So the rule lives in
spreadsheet formulas, where it cannot be tested and quietly drifts.

### The criteria, as the sheet states them

`PROMOTION_RULES` (`DataService.gs:346`) is the stated rule per route:

| Route | Criteria |
|---|---|
| **VL-2 → VL-3** | attendance ≥ 50% |
| **VL-3 → SPS** | attendance ≥ 50% **and** chanting ≥ 4 rounds (latest check) |
| **SPS → DPS** | sadhana avg ≥ 80 · night stay "Yes" ≥ 80% · class attendance avg ≥ 80 · chanting ≥ 8 rounds (latest month) · 4 regulative principles = Yes |
| **DPS → BSS** and **DPS → BVS** | the same five, with chanting ≥ 12 — officially on observation |

A missing number counts as **not yet**, never as a pass. That rule matters more
than any threshold and must survive the move.

### Why this is cheap in the app and awkward in the sheet

Every input is already a column this app owns:

* **attendance** — the `attendance` table, four tiers, already per week
* **chanting rounds** — `rounds`, asked of every SPS devotee each day, and of
  VL-3 since 16 Oct (`tracks = 'attendance,rounds'`)
* **sadhana average** — the week scores the app computes at submit
* **night stay / 4 principles** — the week-end questions already asked
* **class attendance** — the same attendance table

So the app can COMPUTE eligibility rather than read somebody's formula, and
every threshold becomes a tested rule instead of a cell. The six stages in
`DataService.gs` are already the ladder built into `closing.js` on 16 Oct, so
the two systems agree about the journey before any of this starts.

### What still needs the head's word

* **"attendance ≥ 50%" of what** — Sundays held, or weeks in the phase? The
  sheet's formula answers it and the formula is not in this repo.
* **"latest check" vs "latest month"** for chanting — two different windows in
  two different routes.
* Whether DPS → BSS/BVS stays **observation only**, i.e. the app lists them but
  never calls them eligible without a person saying so.

---

## The best bargain: what to take, and what to leave

The head: *"take only the best bargain which is required as per our changed
platform not all"*. The dashboard is 25 files and ~700 KB of script; most of it
is sheet plumbing this app does not need.

### Take

1. **The phase** — name, span, start, end, status. Dates are data.
2. **The targets card** — 11 lead measures, three value types (number, Yes/No,
   per-level block), filled weekly or monthly.
3. **The net score** — the formula above, including the no-target rule. It is
   one function; copying its *reasoning* matters more than its code.
4. **The two boards** — ETP to its coordinator and the admin, facilitators to
   the admin.

### Leave

* **PDF and Slides reports** (`buildPhaseReports_`, the print palettes, ~40 KB of
  CSS) — the app is not a report generator, and the sheet still makes these.
* **Phase close-out into Actuals / Phase Log / Phase Eligible tabs** — those
  tabs exist because the sheet needs somewhere to put things. The app has
  tables.
* **Estimate vs actual** — a second round where facilitators revise what they
  predicted. Real, but a later phase; the first version is targets and filling.
* **The whole sheet-I/O layer** (`ScoreboardService`, `ImportService`,
  `RegistryService`) — replaced by the app's own storage.

### What is NOT yet answered

* **The ETP sheet** is still unread (401). The TRAINING-side targets may differ
  from the facilitator 11; the head said the ETP coordinator and admin define
  them, so they may be configurable rather than fixed.
* **Is the card's "Sadhna 80" the app's own devotee score?** If yes, measure 0
  fills itself and must not be typed twice.

---

## A finished training stays on the contact card (the head, 17 Oct 2026)

When an ETP training finishes, the student's **performance card for that
training** shows on their contact card — the same card that today holds their
name, batch, phones and batch history.

So a training is not erased by its own ending. It becomes part of the record:
*this person went through ETP in the Kartik phase and this is how they did*,
readable long afterwards by whoever opens their card.

This matches how the app already treats a finished VL intake (16 Oct): a closed
batch keeps its devotees and its decisions, and `memberships.to_week` is set
rather than the row deleted, so "which intake was he in?" keeps its answer. A
finished training should keep its answer the same way.

**One thing to decide:** a person may do ETP once, or more than once. If more
than once, the card holds a list, not a card — and the newest should not hide
the older ones.

---

## Build everything on every route, so nothing drifts

The head's instruction for this phase: *"ensure to build everything wherever
required in all routes so things remain in sync"*.

This is a direct response to what 16–17 October turned up. Three of the defects
found were one thing built in one place and not another:

* `ids.get` returned the person record while the IYF IDs screen still showed
  the registry's old number;
* `closesAt()` worked the deadline out as 21:00 in the client while the server
  read the master's setting;
* the mock kept its own copy of the 14-day reopen rule after the server's was
  removed.

Each was invisible until somebody looked. So for this phase, when a value or a
rule is added, the places that must change together are: **the worker action ·
every screen that shows it · the export · the mock · the tests**. The mock
matters more than it looks — it is what the browser checks run against, so a
mock that disagrees with the server makes 1,800 checks prove the wrong thing.

---

## How this phase is tested (the head, 17 Oct 2026)

*"we will just build and run tests for them, and in the end we will run a full
suite and integrate"*.

So, per piece as it lands:

* **worker tests** — the suite is fast (52 suites, ~2,600 assertions, under a
  minute), so it runs on every change, not at the end
* **client tests** — likewise (415, about a second)
* **`npm run audit:sql`** — before anything touches the database, per the
  standing rule. It is what proves a new query cannot repeat the D1 exhaustion
  of 15 Oct
* **sabotage the guard** — for any rule that matters, break it and watch the
  test fail. A test that passes against broken code is worse than none, and
  this caught two false protections on 16 Oct

And once, at the end:

* **the full browser suite** (~1,800 checks, ~25 minutes) plus integration

### Why this split is right, from what 16–17 October cost

The full browser suite was run four times in one afternoon, about two hours, and
every run disagreed with the last — 1 failure, then 4 mid-crash, then a freeze.
Running the twelve parts individually found the SAME single real defect
(`#/members` overflowing at 320 px) in a fraction of the time and with a stable
answer.

So the full suite is worth its 25 minutes **once**, against finished work on a
quiet tree. Run against a tree that is still moving it mostly reports its own
flakiness, and the hours go into chasing that instead of the product.

**Two conditions for the final run**, both learned the hard way:

1. **Nothing uncommitted in `frontend/src`.** The 17 Oct run was invalidated by
   two of my own uncommitted files; worse, they would have shipped unreviewed.
2. **Nobody edits the tree while it runs** — including staging. Hot reload
   clears the mocked clock and the failure then looks like a product bug.

---

## ANSWERED by the head, 17 Oct 2026

**ETP uses the facilitator format.** *"etp list is similar to the facilitators
list as they are getting trained for becoming facilitators, so the same format
training"*. One measure list, not two — a trainee practises the real card. So
the ETP sheet being unreadable no longer blocks the build: the card is the one
already read from the dashboard.

**An ETP or training class is once a week**, the same weekly rhythm a batch has.
Migration 0051 (17 Oct) already lets a batch meet on a weekday, which is what a
training batch needs.

**Attendance % is of CLASSES ACTUALLY HELD.** 6 of 10 held is 60%. A cancelled
class or a festival week counts against nobody, which matches how the app
already treats a no-class week (`class_weeks`).

**Two different windows, for two different questions** — the head's words:
*"the scoreboard reflects the last week['s] sadhana basis possible promotion
list and the performance of everyone in that week, but at the time of promotion
we consider the whole history"*.

| | Window | Question it answers |
|---|---|---|
| **The scoreboard** | the LAST WEEK | who is doing well right now, and who is looking promotable |
| **A promotion** | the WHOLE HISTORY | has this person earned the move |

These must not be the same calculation. A weekly board is a live signal and is
allowed to move about; a promotion is a judgement on everything behind someone.
Building only one of them would have been the easy mistake.

**Promotion criteria differ by batch**, and the stored data has to support
filtering by them — in the exports, in the admin, and on the facilitator's own
tab, where each facilitator sees their expected promotion list. So the criteria
are not one hard-coded set: they are per batch (or per level), and the filter
reads them.

**Sadhna is filled by the app AND overridable.** *"no like they can fill
manually as well"*. Neither "read it" nor "they type it" — both. The app offers
the score it already computed from their own week, and the person may put a
different number over it.

That is the right shape, and it has to be built honestly: the card must show
WHICH it is holding. A figure the app worked out and a figure somebody typed
are not the same evidence, and a board that prints them identically is lying by
omission. So a measure carries its value and its source — `app` or `typed` —
the same way attendance already records whether a mark came from the devotee,
the leader, the coordinator or the head.

A facilitator whose own week is not filled simply has nothing offered, and
types it. The offer is a convenience, never a requirement.

**Promotion criteria are set per batch, from known defaults.** Admin edits any
batch; every batch starts from the dashboard's standard set, so nothing has to
be typed to keep today's behaviour and a stricter batch is possible without
changing anyone else's.

---

## Still unread, and blocking

* **The ETP sheet** (`165UBdHjeNfcQjCZ8dXbM9vfOJhBj0d19odmLg6rNGZA`) — **HTTP
  401**. Not shared with this machine, and there are no Google credentials on it
  at all (the same reason a `wrangler d1` query failed with `code: 7403` on 17
  Oct). So the TRAINING-side parameters are not known: what I have is the
  facilitator card, not the ETP one.
* **The Apps Script** — a `script.google.com` editor URL cannot be fetched. The
  project has to be exported, or the `.gs` files pasted.
* **The scoring logic** — the sheet shows percentages in cells, not the formula
  behind them. That is what the Apps Script would answer, and it is question (2)
  below.

Any one of these unblocks it: share the sheet with the service account, export
the tab as CSV, or paste it.

---

## Related, already noted elsewhere

`docs/REPORTED-2026-10-17.md` item 4 — a class-batch coordinator must not delete
accounts, while a TRAINING-batch coordinator may. ETP is a training programme,
so that rule and this plan need the same class/training distinction, which the
app does not have yet.
