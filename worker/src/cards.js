// The two Excel score cards, as data (design §7a, §7a-1). Labels and marks are exactly the cards' Sheet2
// tables; tests/scoring.test.mjs checks them against setup/data/cards-from-excel.json, read from the files.
// Each option also says which exact answers fall in it, so the app scores typed times and minutes:
//   clock options: from / to as "HH:MM" (from included, to excluded); null = open-ended
//   minute options: min / max (both included); null = open-ended
// Answers before the best option get the best option; answers after the last get the last (design §7a-1).

import { TEMPLE_KEYS } from '../../shared/temple.js';

export const CARD_SPS = 'SPS';
export const CARD_BDB = 'BVS/DPS/BSS';
export const CARD_TRD = 'TRD';
export const RULES_VERSION = 'r1';

const japa = [
  { label: 'Before 07:15 AM', marks: 25, from: null, to: '07:15' },
  { label: '07:15 - 09:30 AM', marks: 20, from: '07:15', to: '09:30' },
  { label: '09:30 - 01:00 PM', marks: 15, from: '09:30', to: '13:00' },
  { label: '01:00 - 07:00 PM', marks: 10, from: '13:00', to: '19:00' },
  { label: '07:00 - 09:00 PM', marks: 5, from: '19:00', to: '21:00' },
  { label: '09:00 - 11:00 PM', marks: 0, from: '21:00', to: '23:00' },
  { label: 'After 11:00 PM', marks: -5, from: '23:00', to: null }
];
const daySleep = [
  { label: '1 hr or less', marks: 25, min: 0, max: 60 },
  { label: '1 to 1:15 hr', marks: 20, min: 61, max: 75 },
  { label: '01:15 - 01:30 hr', marks: 15, min: 76, max: 90 },
  { label: '01:30 - 01:45 hr', marks: 10, min: 91, max: 105 },
  { label: '01:45 - 02:00 hr', marks: 5, min: 106, max: 120 },
  { label: '02:00 - 02:15 hr', marks: 0, min: 121, max: 135 },
  { label: 'After 02:15 hr', marks: -5, min: 136, max: null }
];

export const CARDS = {
  [CARD_BDB]: {
    to_bed: [
      { label: '09:45 - 10:00 PM', marks: 25, from: '21:45', to: '22:00' },
      { label: '10:00 - 10:15 PM', marks: 20, from: '22:00', to: '22:15' },
      { label: '10:15 - 10:30 PM', marks: 15, from: '22:15', to: '22:30' },
      { label: '10:30 - 10:45 PM', marks: 10, from: '22:30', to: '22:45' },
      { label: '10:45 - 11:00 PM', marks: 5, from: '22:45', to: '23:00' },
      { label: '11:00 - 11:15 PM', marks: 0, from: '23:00', to: '23:15' },
      { label: 'After 11:15 PM', marks: -5, from: '23:15', to: null }
    ],
    wake_up: [
      { label: '03:45 - 04:00 AM', marks: 25, from: '03:45', to: '04:00' },
      { label: '04:00 - 04:15 AM', marks: 20, from: '04:00', to: '04:15' },
      { label: '04:15 - 04:30 AM', marks: 15, from: '04:15', to: '04:30' },
      { label: '04:30 - 04:45 AM', marks: 10, from: '04:30', to: '04:45' },
      { label: '04:45 - 05:00 AM', marks: 5, from: '04:45', to: '05:00' },
      { label: '05:00 - 05:15 AM', marks: 0, from: '05:00', to: '05:15' },
      { label: 'After 05:15 AM', marks: -5, from: '05:15', to: null }
    ],
    day_sleep: daySleep,
    japa,
    pathan: [
      { label: '1 hr to 45 min', marks: 25, min: 45, max: null },
      { label: '45 to 35 min', marks: 20, min: 35, max: 44 },
      { label: '35 to 25 min', marks: 15, min: 25, max: 34 },
      { label: '25 to 15 min', marks: 10, min: 15, max: 24 },
      { label: '15 to 5 min', marks: 5, min: 5, max: 14 },
      { label: 'below 5 min', marks: 0, min: 0, max: 4 }
    ],
    sravan: [
      { label: '1 hr to 45 min', marks: 25, min: 45, max: null },
      { label: '45 to 35 min', marks: 20, min: 35, max: 44 },
      { label: '35 to 25 min', marks: 15, min: 25, max: 34 },
      { label: '25 to 15 min', marks: 10, min: 15, max: 24 },
      { label: '15 to 5 min', marks: 5, min: 5, max: 14 },
      { label: 'below 5 min', marks: 0, min: 0, max: 4 }
    ],
    // weekly minutes: below 90 → 0, below 120 → 20 … (the card's own formula, strict "<"; exactly 90 scores 20)
    seva: { rule: 'step', steps: [[90, 0], [120, 20], [150, 40], [180, 60], [210, 80]], top: 100 }
  },
  [CARD_SPS]: {
    to_bed: [
      { label: '10:00 - 10:15 PM', marks: 25, from: '22:00', to: '22:15' },
      { label: '10:15 - 10:30 PM', marks: 20, from: '22:15', to: '22:30' },
      { label: '10:30 - 10:45 PM', marks: 15, from: '22:30', to: '22:45' },
      { label: '10:45 - 11:00 PM', marks: 10, from: '22:45', to: '23:00' },
      { label: '11:00 - 11:15 PM', marks: 5, from: '23:00', to: '23:15' },
      { label: '11:15 - 11:30 PM', marks: 0, from: '23:15', to: '23:30' }        // later than 11:30 PM: this one (0)
    ],
    wake_up: [
      { label: '04:30 - 04:45 AM', marks: 25, from: '04:30', to: '04:45' },
      { label: '04:45 - 05:00 AM', marks: 20, from: '04:45', to: '05:00' },
      { label: '05:00 - 05:15 AM', marks: 15, from: '05:00', to: '05:15' },
      { label: '05:15 - 05:30 AM', marks: 10, from: '05:15', to: '05:30' },
      { label: '05:30 - 05:45 AM', marks: 5, from: '05:30', to: '05:45' },
      { label: '05:45 - 06:00 AM', marks: 0, from: '05:45', to: '06:00' }
    ],
    day_sleep: daySleep,
    japa,
    pathan: [
      { label: '30 to 25 min', marks: 25, min: 25, max: null },
      { label: '24 to 20 min', marks: 20, min: 20, max: 24 },
      { label: '19 to 10 min', marks: 15, min: 10, max: 19 },
      { label: '09 to 05 min', marks: 10, min: 5, max: 9 },
      { label: 'below 5 min', marks: 5, min: 1, max: 4 },
      { label: 'No Reading', marks: 0, min: 0, max: 0 }
    ],
    sravan: [
      { label: '30 to 25 min', marks: 25, min: 25, max: null },
      { label: '24 to 20 min', marks: 20, min: 20, max: 24 },
      { label: '19 to 10 min', marks: 15, min: 10, max: 19 },
      { label: '09 to 05 min', marks: 10, min: 5, max: 9 },
      { label: 'below 5 min', marks: 5, min: 1, max: 4 },
      { label: 'No Hearing', marks: 0, min: 0, max: 0 }
    ],
    // the SPS card: the week's minutes ÷ 90 × 100, capped at 100 (decision 29)
    seva: { rule: 'divide', by: 90 }
  }
};

// TRD (the temple residents; Phase 22, the head 23 Oct 2026): COSATOK's "Marking Scheme · Level: TRD", from the head's
// two screenshots. Not an Excel card: every item slides in a straight line between its two points (shared/scoring.js
// `slide`), so the card holds the points, not a table of options. Unfilled = 0; chanting not finished the same day = 0
// (its time AND its rounds). The Morning program is the four temple activities the TRD day form already asks
// (shared/temple.js, migration 0062): on time 5 · late 3 · absent 0 each.
// The day's maximum is the items' own: 7 × 25 + 10 (rounds) + 20 (Morning program) = 205 (tests/trd-scoring.test.mjs
// checks dayMax against the items, so the two can never drift).
CARDS[CARD_TRD] = {
  kind: 'linear',
  items: ['to_bed', 'wake_up', 'japa', 'rounds', 'day_sleep', 'sravan', 'pathan', 'seva', 'morning'],
  dayMax: 205,
  to_bed: { label: 'Slept at', field: 'sleptAt', clock: true, night: true, full: '22:00', zero: '22:30', marks: 25 },
  wake_up: { label: 'Woke up at', field: 'wokeAt', clock: true, full: '04:00', zero: '04:50', marks: 25 },
  japa: { label: 'Chanting finished at', field: 'chantingDoneAt', clock: true, sameDay: true, full: '07:15', zero: '17:00', marks: 25 },
  rounds: { label: 'Chanting rounds', field: 'rounds', unit: 'rounds', sameDay: true, full: 16, zero: 0, marks: 10 },
  day_sleep: { label: 'Day rest', field: 'dayRestMin', full: 60, zero: 110, marks: 25 },
  sravan: { label: 'Hearing', field: 'hearingMin', full: 60, zero: 0, marks: 25 },
  pathan: { label: 'Reading', field: 'readingMin', full: 60, zero: 0, marks: 25 },
  seva: { label: 'Service', field: 'serviceMin', full: 360, zero: 0, marks: 25 },
  morning: { label: 'Morning program', fields: TEMPLE_KEYS, answers: { ON_TIME: 5, LATE: 3, ABSENT: 0 }, marks: 20 }
};
/** A card that scores class attendance (every card but the linear one: TRD's attendance is recorded, not scored). */
export const scoresAttendance = (name) => CARDS[name]?.kind !== 'linear';
/** The cards that do not score attendance, for SQL that re-works a week's overall from a later mark (leaderboard.js). */
export const NO_ATTENDANCE_CARDS = Object.keys(CARDS).filter((n) => !scoresAttendance(n));

export { CATEGORIES } from '../../shared/scoring.js';
