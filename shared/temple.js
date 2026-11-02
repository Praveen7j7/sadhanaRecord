// Temple activities (phase 21, 23 Oct 2026; the head's "Update Sadhana" screenshot for TRD): a temple resident also
// answers, each day, whether they were on time for the temple programme. Optional: a day is complete without them.
// Since Phase 22 (the head, 23 Oct 2026; migration 0065) the TRD card scores them as the Morning program — on time 5 ·
// late 3 · absent 0 each (worker/src/cards.js CARD_TRD); a batch on another card would only record them.
// One list for the server (worker/src/weeks.js, rules.js), the mock and the Day form, so they cannot drift.
export const TEMPLE_ACTIVITIES = [
  { key: 'mangalAarti', label: 'Mangal Aarti' },
  { key: 'darshanAarti', label: 'Darshan Aarti' },
  { key: 'morningClass', label: 'Morning Class' },
  { key: 'prasadam', label: 'Prasadam' },
];
export const TEMPLE_ANSWERS = [['ON_TIME', 'On Time'], ['LATE', 'Late'], ['ABSENT', 'Absent']];
export const TEMPLE_KEYS = TEMPLE_ACTIVITIES.map((a) => a.key);
const LABEL = Object.fromEntries(TEMPLE_ANSWERS);
/** "On Time" for 'ON_TIME' ('' for anything else). */
export const templeAnswer = (v) => LABEL[v] || '';
