// What a batch COLLECTS (ADR 0009, the head, 16 Oct 2026).
//
// VL-2 takes attendance and nothing else; VL-3 takes attendance and chanting rounds; SPS onwards
// takes the full day. The danger in a change like this is not the new levels — it is the 1,300
// devotees already in SPS, DPS, BSS and BVS, whose weeks must behave EXACTLY as they did. So the
// first thing these tests pin is that 'full' and an unset track are the same thing.
import { suite } from './harness.mjs';
import { requiredFor, missingOf, stateOf } from '../src/weeks.js';

const t = suite('batch tracks: what each level asks for');

// a day that is genuinely complete: the topics are here because the minutes are above nought, which
// is the rule a full batch has always enforced
const FULL_DAY = { sleptAt: '22:00', wokeAt: '04:30', rounds: 16, chantingDoneAt: '07:00',
  chantingSameDay: true, dayRestMin: 30, hearingMin: 30, readingMin: 30, serviceMin: 60,
  hearing: ['SB 1.1.1'], reading: 'Bhagavad-gita' };

/* ── the batches that already exist must not move ───────────────────────── */
t.eq(requiredFor('full').length, 9, 'a full batch asks the nine questions it always has');
t.eq(requiredFor(undefined), requiredFor('full'), 'a batch with no track set is a full batch');
t.eq(requiredFor(''), requiredFor('full'), 'and so is an empty one (the column default before a backfill)');
t.eq(requiredFor('nonsense'), requiredFor('full'), 'an unrecognised track falls back to full, never to nothing');
t.eq(missingOf({}), requiredFor('full'), 'an empty day for a full batch is missing all nine');
t.eq(stateOf(FULL_DAY), 'complete', 'a full day is still complete');
t.eq(stateOf({ rounds: 16 }), 'partial', 'and a day with only rounds is still partial for them');

/* ── VL-3: rounds, and nothing else ─────────────────────────────────────── */
const VL3 = 'attendance,rounds';
t.eq(requiredFor(VL3), ['rounds'], 'VL-3 asks for rounds alone');
t.eq(stateOf({ rounds: 16 }, VL3), 'complete', 'so rounds alone completes a VL-3 day');
t.eq(missingOf({ rounds: 16 }, VL3), [], 'with nothing outstanding');
t.eq(missingOf({}, VL3), ['rounds'], 'an empty VL-3 day wants rounds and only rounds');
t.eq(stateOf({}, VL3), 'empty', 'an untouched day is empty, not partial');
t.eq(stateOf({ rounds: 0 }, VL3), 'complete', 'nought rounds is an ANSWER, not a blank — a day they did not chant still counts');

/* ── VL-2: attendance only, so there is no daily form at all ────────────── */
const VL2 = 'attendance';
t.eq(requiredFor(VL2), [], 'VL-2 asks for nothing daily');
t.eq(missingOf({}, VL2), [], 'so a VL-2 day is never missing anything');

/* ── the follow-up questions must not escape their track ────────────────── */
// hearing/reading topics are asked only when the MINUTES were asked for. A VL-3 devotee has no
// hearingMin field, but a stray value must not conjure a question their level does not ask.
t.eq(missingOf({ rounds: 16, hearingMin: 30 }, VL3), [],
  'a stray hearing figure does not make VL-3 demand a hearing topic');
t.eq(missingOf({ rounds: 16, readingMin: 30 }, VL3), [],
  'nor a reading topic');
t.ok(missingOf({ ...FULL_DAY, hearing: [] }).includes('hearing'),
  'while a full batch still demands the hearing topic when minutes were logged');

/* ── the batch number (ADR 0009, the head, 16 Oct 2026) ─────────────────── */
// IYF numbers its Vedic batches: "Vedic Level 2, batch 51". The number is the identity people
// already use, so the app takes it rather than minting one. VL-2 and VL-3 count SEPARATELY — VL2-51
// and VL3-51 are two different batches — and nothing from SPS onwards is numbered at all, because
// those run with no fixed duration.
{
  const { vedicLevel } = await import('../src/admin.js');
  t.eq(vedicLevel('VL2-51'), 'VL2', 'VL2-51 is a Vedic Level 2 intake');
  t.eq(vedicLevel('VL3-51'), 'VL3', 'and VL3-51 a Level 3 one: the same number in both levels');
  t.eq(vedicLevel('VL2-1'), 'VL2', 'a one-digit batch number is a batch number');
  t.eq(vedicLevel('VL2-9999'), 'VL2', 'and so is a four-digit one');

  // the batches that run without end must never be mistaken for an intake: they are never offered
  // a closing, and a closing is what promotes people
  t.eq(vedicLevel('SPS'), null, 'SPS is not an intake');
  t.eq(vedicLevel('SPS2'), null, 'nor SPS2');
  t.eq(vedicLevel('DPS'), null, 'nor DPS');
  t.eq(vedicLevel('BSS'), null, 'nor BSS');
  t.eq(vedicLevel('BVS'), null, 'nor BVS');

  // near-misses, so a typo becomes an error rather than a batch nobody can close
  t.eq(vedicLevel('VL2'), null, 'VL2 with no number is not a batch');
  t.eq(vedicLevel('VL2-'), null, 'nor VL2 with an empty number');
  t.eq(vedicLevel('VL4-51'), null, 'there is no Vedic Level 4 here');
  t.eq(vedicLevel('VL2-51A'), null, 'a batch number is digits only');
  t.eq(vedicLevel(''), null, 'and nothing is not a batch');
  t.eq(vedicLevel(null), null, 'nor is null');
}

t.done();
