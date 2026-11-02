# 12. The facilitation card: weekly and monthly measures, grouped, and what the scoreboard ranks on

Date: 2026-10-22
Status: Accepted
Decided by: the IYF head (from the live Excel card, "Gopinath Murari Das — September to December (Kartik Phase)")

## Context

The eleven lead measures are stored and filled identically, week by week. The card the head works from makes two
distinctions the app does not:

1. **Frequency.** Four measures are **monthly**, not weekly — including the facilitation journal, which the
   dashboard's own `SEVA_MEASURES` list wrongly groups with the weekly ones (`MetricsService.gs`).
2. **Grouping.** Measures 1–4 sit under **Vedic Level 2 registration**; measures 5–10 sit under the promotion
   **Target** (VL-3: 8 · SPS: 6 · DPS/BSS: 5 · BVS: 0). On screen today all eleven are one undifferentiated list,
   so a facilitator cannot see what is due this week, what is due this month, or what each group is for.

The head also separated what a **scoreboard** is for: ranking is about **seva and goal**; sadhana is recorded and
shown but is not the objective for facilitators. The dashboard ranks on `(sadhana + seva + goal) ÷ 3`.

## Decision

**A. Frequency, from the card**

| # | Measure | Frequency | Weekly target |
|---|---|---|---|
| 0 | Sadhna | Weekly | 80 |
| 1 | Stall preaching (hours) | Weekly | 5 |
| 2 | Calling the new students | Weekly | 10 |
| 3 | Sunday VL-1 facilitation attendance | Weekly | Yes/No |
| 4 | Sunday VL-2/3 facilitation attendance | Weekly | Yes/No |
| 5 | One-to-one meetings with devotees | Weekly | 15 |
| 6 | FTP training attendance | Weekly | Yes/No |
| 7 | Meeting the senior facilitator / area leader about students | **Monthly** | 1 |
| 8 | Serious students taken one-to-one with the senior | **Monthly** | 5 |
| 9 | All-students meeting with the senior facilitator | **Monthly** | 1 |
| 10 | Facilitation journal update | **Monthly** | Yes/No |

**B. What a monthly measure does on a weekly card.** It is shown as **information**, under its own heading, and
contributes **nothing** to that week's score. It is filled when it happens (typically the fourth week).

**C. Stored week scores are never rewritten.** A week keeps the number the person saw (ADR 0004 stands). The
monthly measures feed the **month's** score only.

**D. The monthly scorecard.** After a month closes, one card per person shows:
* their **sadhana average** for the month,
* their **seva average** for the month (the weekly lead measures, plus the four monthly ones),
* their **goal**: how many of **their own students** (the devotees assigned to them) became **eligible for
  promotion** in the window, on the class ladder VL-2 → VL-3 → SPS → DPS/BSS/BVS.

**E. The goal window depends on who it is.**
* a **full-time facilitator**: from the day the **phase** started;
* an **ETP trainee**: from the day **their training batch** started.
Both run to the **previous completed week** (the app already opens boards on the finished week).

**F. The scoreboard ranks on seva and goal, not sadhana.** In this app: rank by `(seva % + goal %) ÷ 2`; sadhana is
shown on the card as information. The **Facilitator Dashboard keeps its equal-thirds rule for now** — changing it
there is a separate task needing the head's OK, because it moves live rankings (ADR to follow when that is done).
Until then the two disagree, deliberately, and the app says which rule it is using.

**G. The card shows its groups.** "Vedic Level 2 registration" (1–4) and "Target: VL-3 8 · SPS 6 · DPS/BSS 5 ·
BVS 0" (5–10), with Sadhna (0) above both, exactly as the paper card reads.

## Found while implementing (22 Oct 2026) — what already exists, and two verified defects

**Already built** (the 21 Oct audit missed it): `measures.frequency` (`WEEKLY` | `MONTHLY`) exists since migration
0052, and the live rows match the head's card exactly — seniorMeet, seriousOne, allMeet and journal are MONTHLY.
`card.get` already returns it, and `Card.svelte` already lists weekly and monthly apart. The per-level targets of
the card's "Target" block are `stage_targets` (migration 0055), and `goalPct` is computed from them. What is NOT
built: the two groups ("Vedic Level 2 registration", "Target"), the month scorecard, and the seva + goal ranking.

**Defect 1 — the net score counts seva twice and sadhana never.** `phases.js scoreOf` passes the same figure,
`phaseAverage(...).average` (the lead-measure %), as BOTH `sadhana` and `seva` to `netScore`. The dashboard's rule
is three different figures. Every net score the app has shown is therefore `(2 × seva + goal) ÷ 3`.

**Defect 2 — the seva figure mixes in sadhana and the monthly measures.** `weekPct` scores every measure every
week: it includes measure 0 **Sadhna** (sadhana, not seva — the dashboard's `SEVA_MEASURES` excludes it), and it
includes the four **monthly** measures in every week, so a facilitator scores 0 on them for three weeks of each
month. Under B and D above, a week's seva is the weekly lead measures only (1–6); the monthly four (7–10) count
once, in the month.

Both are fixed with fail-first tests in the same change as B–F.

## Built (22 Oct 2026)

* Groups (migration 0059), seva and sadhana as separate figures, monthly measures once a month, goal from eligible
  own students, rank on (seva + goal) / 2 — `phases.js`, `card-scoring.test.mjs`.
* **The month scorecard (D):** `card.months` (`worker/src/monthcard.js`, built only from what `phases.js` exports):
  one row per **ended** month of the person's window — sadhana, seva (the month's weekly measures and its monthly ones,
  averaged together), goal (own students eligible from the window's start to the month's last week), net. A month
  nobody filled reads "not filled", never 0. Shown as "Month by month" on the card, the person's own and the
  read-only one a board opens; the head reads anyone's, a training's coordinator their trainees'.

## Consequences

* `measures` gains a frequency (`weekly` | `monthly`) and a group; both are data, not code, so a change to the
  card does not need a release.
* `card.get` returns the frequency and group; `card.fill` refuses a monthly value outside its month.
* Week scoring ignores monthly measures. A new month view computes D from stored weeks — no recomputation.
* The promotion-eligibility count already exists for the class ladder (VL-3 → SPS needs 50 % attendance and ≥ 4
  rounds); the month card reads it per facilitator over the window in E.
* The dashboard's `SEVA_MEASURES` wording (journal listed as weekly) is wrong and is noted for that project.
* `docs/sadhana-api-contract.md` records the new fields; the mock mirrors them.

## Evidence

The head's card image (22 Oct 2026); `worker/src/phases.js` (`measureView`, `cardWindow`, `boardGet`),
live `measures` table (11 rows, `kind`/`unit`/`source`), `faciliatorDashboard/MetricsService.gs`
(`SCORE_WEIGHTS`, `RANK_BY`, `SEVA_MEASURES`), ADR 0004 (scores computed once).
