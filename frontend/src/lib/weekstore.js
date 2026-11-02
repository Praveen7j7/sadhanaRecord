// Local updates of the cached open weeks after a write (no refetch). The devotee's own weeks live in the home.get
// entry; a week a coordinator fills on someone's behalf lives in its own entry ("behalf:<login>:<weekId>", from
// week.get with onBehalfOf), so the two are never mixed. Every helper takes that key (default: the devotee's own).
import { call } from './api.js';
import { entry, load, patch } from './cache.svelte.js';
import { applyPatch, stateOf, stripV } from './daylogic.js';

export const HOME = 'home.get';
export const homeEntry = () => entry(HOME);
export const loadHome = (force = false) => load(HOME, undefined, { force });

/** The cache key of a week filled on behalf of `login`. */
export const behalfKey = (login, weekId) => `behalf:${login}:${weekId}`;
/** Loads one week of `login` (for their coordinator): shaped like home.get ({ weeks: [week] }) so the screens are the same. */
export const loadBehalf = (login, weekId, force = false) =>
  load(behalfKey(login, weekId), () => call('week.get', { weekId, onBehalfOf: login }).then((w) => ({ weeks: [w], profile: { login }, versions: {}, progress: {} })), { force });

const mapWeek = (weekId, fn, key = HOME) => patch(key, (h) => ({ ...h, weeks: h.weeks.map((w) => (w.weekId === weekId ? fn(w) : w)) }));
const mapDay = (weekId, date, fn, key) => mapWeek(weekId, (w) => ({ ...w, days: w.days.map((d) => (d.date === date ? fn(d) : d)), status: w.status === 'NOT_STARTED' ? 'DRAFT' : w.status }), key);

export function findWeek(home, weekId) { return home?.weeks?.find((w) => w.weekId === weekId); }

/** A save succeeded: merge what was sent, take the new version and state. */
export function daySaved(weekId, date, reply, sent, key = HOME) {
  mapDay(weekId, date, (d) => ({ ...d, day: applyPatch(d.day, sent), version: reply.version, state: reply.state }), key);
}
/** The server's copy replaced ours (STALE). */
export function dayReplaced(weekId, date, current, key = HOME) {
  const day = stripV(current);
  mapDay(weekId, date, (d) => ({ ...d, day, version: current.v || 0, state: stateOf(day) }), key);
}
export const weekEndSaved = (weekId, patchObj, version, key = HOME) => mapWeek(weekId, (w) => {
  const we = { ...w.weekEnd, ...patchObj, version };
  return { ...w, weekEnd: { ...we, state: we.nightStay && we.principles ? 'complete' : we.nightStay || we.principles ? 'partial' : 'missing' } };
}, key);
export const attendanceSet = (weekId, a, key = HOME) => mapWeek(weekId, (w) => ({ ...w, attendance: { ...w.attendance, ...a } }), key);
export const weekSubmitted = (weekId, reply, key = HOME) => mapWeek(weekId, (w) => ({ ...w, status: 'SUBMITTED', canSubmit: false, submittedAt: reply.submittedAt, scores: reply.scores }), key);
