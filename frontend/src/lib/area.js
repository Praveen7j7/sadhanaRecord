// Which part of the app a screen belongs to. The accent colour follows the AREA, not the login:
// public (before sign-in: welcome, log in, sign up, forgot, a forced password change) = royal purple, the parent brand;
// devotee (own sadhana) = blue, coordinator (batch tools) = saffron, admin (master tools) = deep red.
// One person can be all three; their own screens are always blue.

const PUBLIC = /^\/(welcome|login|signup|forgot)(\/|$)/;
const ADMIN = /^\/(overview|devotees|groups|coordinators|facilitators|batches|ids|reopens|activity|settings)(\/|$)/;
const BATCH = /^\/(requests|batch|members|stats|leaders|devotee|fill|my-devotees)(\/|$)/;
const MINE = /^\/(week|day|history|report|learn|hearing|reading|group)(\/|$)/;
const SHARED = /^\/(home|wall|account|change-password)?(\/|$)/;

/** The area of a staff person's own screens (home, wall, account) when they have no devotee scope.
 *  A facilitator or group leader counts as staff here too: they are signed in, so never the public brand. */
export const staffArea = (sc) => (sc?.master ? 'admin' : 'coordinator');

/**
 * Area for a route. `path` may carry a ?query; `sc` is scopesOf(user) (null / undefined when signed out);
 * `forced`: the person must change a temporary password first (still the public brand).
 * @returns {'public' | 'devotee' | 'coordinator' | 'admin'}
 */
export function areaOf(path, sc, forced = false) {
  const p = (path || '/').split('?')[0];
  if (!sc || forced || PUBLIC.test(p)) return 'public';
  if (ADMIN.test(p)) return 'admin';
  if (BATCH.test(p)) return 'coordinator';
  if (MINE.test(p)) return 'devotee';
  // A facilitator or group leader with no sadhana of their own is still SIGNED IN: Home / Wall / Account must not
  // fall back to the signed-out brand (10 Oct 2026 — a facilitator's Home was reporting area 'public', so it kept
  // the narrow reading column and the public accent).
  if (SHARED.test(p)) return sc.devotee ? 'devotee' : staffArea(sc);
  return sc.devotee ? 'devotee' : staffArea(sc);
}
