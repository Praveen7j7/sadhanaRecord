# 9. Vedic levels: one batch table, a `tracks` column, and an intake per run

Date: 2026-10-16
Status: Accepted
Decided by: the IYF head

## Context

Two levels sit BEFORE SPS and were never in the app:

* **VL-1** — stays on sheets. Out of scope, deliberately.
* **VL-2** — attendance, and nothing else.
* **VL-3** — attendance and chanting rounds. Nothing else.

Everything from SPS onwards already collects the full set (rounds, reading,
hearing, service, the score card) and that path is built.

A person's journey is VL-1 → VL-2 → VL-3 → SPS → DPS → BSS or BVS, with two
sideways moves: SPS → BVS directly, and BSS → BVS (BVS is for those who will
marry; BSS is for those aspiring to brahmachari life). Nobody is moved by the
app: a coordinator promotes them.

VL-2 and VL-3 run as intakes of about three months. The run ENDS WHEN THE
COORDINATOR SAYS SO, not on a timer — three months is the shape of it, not a
rule the app enforces.

## Decision

**One `batches` table.** VL-2 and VL-3 are ordinary rows, not a parallel
system, with a new `tracks` column saying what the batch collects:

    VL2   tracks = 'attendance'
    VL3   tracks = 'attendance,rounds'
    SPS   tracks = 'full'

Membership, promotion, history and the weekly form all keep working as they do;
the form reads `tracks` and shows only those fields. A separate set of tables
for the VL levels would have meant copying records across at promotion and a
person's history living in two places.

**An intake is its own batch row, numbered the way IYF already numbers them** —
`VL2-51` is "Vedic Level 2, batch 51". The number is the identity people use
aloud, so the app takes it rather than minting one of its own.

The two levels count SEPARATELY: `VL2-51` and `VL3-51` are different batches,
which is why the level is part of the id rather than a column beside it.

**Only VL-2 and VL-3 are numbered.** SPS, DPS, BSS and BVS run with no fixed
duration — they are never given a batch number and never closed. `vedicLevel()`
is the one test for this, and the screens ask it before offering either.

A devotee sees `Vedic Level 2 · Batch 51` on their own screens: the level in
words, the number plainly, as it is said aloud. A closed intake stays readable
for ever, and "which batch was he in?" has an answer.

**At closing the coordinator decides each person**: promoted to the next level,
repeating in the next intake, or left. Nothing moves anyone automatically.

**Attendance may be marked by the devotee, their group leader, or the
coordinator; the last mark wins, and the app records who set it.** The earlier
mark is kept, so a correction is visible rather than silent. Strict rank was
considered and refused: a coordinator fixing an obvious mistake should not have
to undo someone else's mark first.

## Consequences

* The weekly form becomes track-aware. A VL-2 week has one question.
* Scores: a VL-2 or VL-3 batch has no score card, so the scoring path must not
  assume one exists. (See `0004-scores-computed-once.md`.)
* Closing an intake is a real screen, not a flag — it is where promotion
  happens, and it writes one decision per devotee.
* `tracks` is additive, so existing batches keep working untouched: a row
  without it reads as 'full'. (See `0003-no-foreign-keys-additive-migrations.md`.)
