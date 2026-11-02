// The one route table agrees with the five lists it replaces (13 Oct 2026; audit FE-20 / roadmap 4.1).
//
// Adding a screen used to mean editing App.svelte, nav.js, Shell.svelte, area.js and prefetch.js, and nothing
// noticed if you edited four: the symptom was a screen that loaded but had no title, or was titled but answered
// "Page not found", or quietly took the signed-out brand. These assertions are what make that impossible — they
// compare src/routes.js against the behaviour the old lists produced, path by path, and then check the table is
// internally complete.
import { describe, it, expect } from 'vitest';
import { ROUTES, ADMIN_PATHS, PUBLIC_PATHS, routeOf, knownRoute, allowed, screenOf, titleOf, loaderOf, LOADERS } from '../src/routes.js';
import { knownRoute as navKnown } from '../src/lib/nav.js';
import { areaOf } from '../src/lib/area.js';

// the scopes a person can hold, as scopesOf() shapes them
const SC = {
  devotee: { devotee: { batchId: 'SPS' }, groupLeader: null, facilitator: null, coordinator: [], master: false },
  leader: { devotee: { batchId: 'SPS' }, groupLeader: { batchId: 'SPS' }, facilitator: null, coordinator: [], master: false },
  facilitator: { devotee: null, groupLeader: null, facilitator: { name: 'X' }, coordinator: [], master: false },
  coordinator: { devotee: null, groupLeader: null, facilitator: null, coordinator: ['SPS'], master: false },
  master: { devotee: null, groupLeader: null, facilitator: null, coordinator: [], master: true },
};

// one real path per entry, so "every route" means every route
const SAMPLES = [
  ['/home', 'Home'], ['/week', 'This week'], ['/week/2026-10-05', 'This week'],
  ['/day/2026-10-05/2026-10-07', 'Daily sadhana'], ['/history', 'History'], ['/history/2026-10-05', 'History'],
  ['/report', 'Report'], ['/hearing', 'Hearing'], ['/reading', 'Reading'], ['/learn', 'Hearing'],
  ['/wall', 'Announcements'], ['/account', 'Account'], ['/change-password', 'Change password'],
  ['/group', 'My group'],
  ['/my-devotees', 'My students'], ['/my-devotees/6000000181', 'Student'], ['/my-devotees/6000000181/2026-10-05', 'Week'],
  ['/requests', 'Requests'], ['/batch', 'Batch status'], ['/members', 'Devotees'], ['/stats', 'Filling chart'], ['/leaders', 'Group leaders'],
  ['/devotee/6000000181', 'Devotee'], ['/devotee/6000000181/week/2026-10-05', 'Week'],
  ['/fill/6000000181/week/2026-10-05', 'Fill for · Week'], ['/fill/6000000181/day/2026-10-05/2026-10-07', 'Fill for · Day'],
  ...ADMIN_PATHS.map((p) => [p, titleOf(p)]),
];

describe('the route table', () => {
  it('has an entry for every screen the app offers', () => {
    for (const [path] of SAMPLES) expect(knownRoute(path), path).toBe(true);
  });

  it('gives every entry a title, an area and (unless it is in the startup chunk) a loader', () => {
    const bad = ROUTES.filter((r) => !r.title || !r.area || (r.screen && !r.load));
    expect(bad.map((r) => String(r.re))).toEqual([]);
  });

  it('titles every sample path', () => {
    for (const [path, title] of SAMPLES) expect(titleOf(path), path).toBe(title);
  });

  it('names the person when filling for someone', () => {
    expect(titleOf('/fill/6000000181/week/2026-10-05?n=Deepak%20Kumar')).toBe('Deepak · Week');
    expect(titleOf('/fill/6000000181/day/2026-10-05/2026-10-07?n=Deepak')).toBe('Deepak · Day');
  });

  it('matches the first entry, so specific patterns win', () => {
    expect(routeOf('/fill/x/day/2026-10-05/2026-10-07').screen).toBe('devotee');
    expect(titleOf('/devotee/x/week/2026-10-05')).toBe('Week');
    expect(titleOf('/devotee/x')).toBe('Devotee');
  });

  it('refuses a path the app does not have', () => {
    for (const p of ['/nonsense', '/week/not-a-date', '/day/2026-10-05', '/devotee', '/fill/x/week', '/my-devotees/x/y/z']) {
      expect(knownRoute(p), p).toBe(false);
      expect(screenOf(p, SC.master), p).toBe(null);
    }
  });

  it('agrees with nav.js about which paths exist', () => {
    // nav.js is the list App.svelte used for "Page not found"; the table must admit exactly the same paths
    for (const [path] of SAMPLES) expect(navKnown(path), path).toBe(knownRoute(path));
    for (const p of ['/nonsense', '/week/not-a-date', '/devotee']) expect(navKnown(p), p).toBe(knownRoute(p));
  });

  it('agrees with area.js about the accent of each screen', () => {
    for (const [path] of SAMPLES) {
      const r = routeOf(path);
      // 'shared' in the table means "follows the person", which is exactly what areaOf() computes
      if (r.area === 'shared') continue;
      const sc = r.scope === undefined ? SC.devotee
        : r.area === 'admin' ? SC.master : r.area === 'coordinator' ? (r.screen === 'fac' ? SC.facilitator : SC.coordinator) : SC.leader;
      expect(areaOf(path, sc), path).toBe(r.area);
    }
  });

  it('lets exactly the right scopes open each screen', () => {
    expect(allowed('/week', SC.devotee)).toBe(true);
    expect(allowed('/week', SC.coordinator)).toBe(false);
    expect(allowed('/group', SC.leader)).toBe(true);
    expect(allowed('/group', SC.devotee)).toBe(false);
    expect(allowed('/my-devotees', SC.facilitator)).toBe(true);
    expect(allowed('/my-devotees', SC.devotee)).toBe(false);
    expect(allowed('/batch', SC.coordinator)).toBe(true);
    expect(allowed('/batch', SC.master)).toBe(true);           // the head coordinates every batch
    expect(allowed('/batch', SC.devotee)).toBe(false);
    expect(allowed('/settings', SC.master)).toBe(true);
    expect(allowed('/settings', SC.coordinator)).toBe(false);
    expect(allowed('/wall', SC.devotee)).toBe(true);
    expect(allowed('/wall', SC.facilitator)).toBe(true);
  });

  it('hands App.svelte a loader for every screen key it can return', () => {
    const keys = [...new Set(ROUTES.filter((r) => r.screen).map((r) => r.screen))];
    for (const k of keys) expect(typeof LOADERS[k], k).toBe('function');
    // and prefetch can find the same file from a path
    expect(typeof loaderOf('/batch')).toBe('function');
    expect(loaderOf('/home')).toBe(null);                      // in the startup chunk
    expect(loaderOf('/nonsense')).toBe(null);
  });

  it('keeps the signed-out screens out of the table', () => {
    // App.svelte picks between these before any scope exists, so they must not be matchable here
    for (const p of PUBLIC_PATHS) expect(knownRoute(p), p).toBe(false);
  });

  it('ignores the query when matching', () => {
    expect(titleOf('/members?q=raghav&sort=name')).toBe('Devotees');
    expect(screenOf('/members?q=x', SC.coordinator)).toBe('batch');
  });
});
