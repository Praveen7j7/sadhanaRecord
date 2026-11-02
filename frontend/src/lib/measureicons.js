// One icon per lead measure, shared by the card (screens/Card.svelte) and the scoreboard's card sheet
// (coord/Scoreboards.svelte) so the two never disagree (docs/ICON_SCOPE_AUDIT_2026-10-18.md §3, step 2).
// One meaning, one icon: `users` is a group of people everywhere in the app, so both class facilitations and the
// all-students meeting take it; `user` is one person. A measure not listed here falls back to a plain tick.
export const MEASURE_ICON = { sadhna: 'chant', stall: 'pin', calls: 'phone', vl1att: 'users', vl23att: 'users',
  oneToOne: 'user', ftp: 'book', seniorMeet: 'msg', seriousOne: 'spark', allMeet: 'users', journal: 'edit' };
export const measureIcon = (id) => MEASURE_ICON[id] || 'check';
