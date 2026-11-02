// One navigation model (Phase 4): scopes decide what is in it, the screen size only how it is drawn.
import { describe, it, expect } from 'vitest';
import { navFor, isTab, railOnly, knownRoute, BAR } from '../src/lib/nav.js';

const DEV = { devotee: { batchId: 'SPS' }, groupLeader: null, facilitator: null, coordinator: [], master: false };
const LEADER = { ...DEV, groupLeader: { group: 1 } };
const COORD = { devotee: null, groupLeader: null, facilitator: null, coordinator: ['SPS'], master: false };
const MASTER = { devotee: null, groupLeader: null, facilitator: null, coordinator: [], master: true };
const FAC = { devotee: null, groupLeader: null, facilitator: { name: 'Natvar' }, coordinator: [], master: false };
const MIXED = { ...DEV, coordinator: ['SPS'] };                       // a devotee who also coordinates
const MIXED_M = { ...DEV, master: true };                             // the head with a sadhana of their own
const ids = (l) => l.map((i) => i.id);
const bar = (p) => p.filter((_, i) => !railOnly(p, i));

describe('what each person gets (the same model on phone, tablet and desktop)', () => {
  it('devotee: Home, Week, Report, Account', () => { const n = navFor(DEV); expect(ids(n.primary)).toEqual(['home', 'week', 'report', 'account']); expect(ids(bar(n.primary))).toEqual(ids(n.primary)); });
  it('coordinator: Home, Batch, Requests, Account', () => expect(ids(navFor(COORD).primary)).toEqual(['home', 'batch', 'requests', 'account']));
  it('the IYF head: Home, Requests, Admin, Batch, Account (queue before scope, 8 Oct 2026)', () => expect(ids(navFor(MASTER).primary)).toEqual(['home', 'requests', 'overview', 'batch', 'account']));
  it('a group leader has My group on the bar: Home, Week, Group, Report, Account', () => { const p = navFor(LEADER).primary; expect(ids(p)).toEqual(['home', 'week', 'group', 'report', 'account']); expect(p.find((i) => i.id === 'group').short).toBe('Group'); });
  it('Announcements has no menu row: the bell is its one place', () => expect(navFor(DEV).sections.flatMap((s) => s.items).some((i) => i.id === 'wall')).toBe(false));
  it('facilitator: Home, My students, Account', () => expect(ids(navFor(FAC).primary)).toEqual(['home', 'students', 'account']));
  it('devotee + coordinator: one model whatever screen is open; the bar keeps Requests, the rail shows all', () => {
    const p = navFor(MIXED).primary;
    expect(ids(p)).toEqual(['home', 'week', 'requests', 'batch', 'report', 'account']);
    expect(ids(bar(p))).toEqual(['home', 'week', 'requests', 'batch', 'account']);
    expect(bar(p).length).toBeLessThanOrEqual(BAR);
  });
  it('the head with a sadhana: rail has everything (7); the bar keeps Requests and Admin (8 Oct 2026)', () => {
    const p = navFor(MIXED_M).primary;
    expect(ids(p)).toEqual(['home', 'week', 'requests', 'overview', 'batch', 'report', 'account']);
    expect(ids(bar(p))).toEqual(['home', 'week', 'requests', 'overview', 'account']);
  });
  it('items wear their own area colour; own screens follow the person', () => {
    const p = navFor(MIXED_M).primary, a = Object.fromEntries(p.map((i) => [i.id, i.area]));
    expect(a).toMatchObject({ home: 'devotee', week: 'devotee', batch: 'coordinator', overview: 'admin', account: 'devotee' });
    expect(navFor(MASTER).primary.find((i) => i.id === 'home').area).toBe('admin');
    expect(navFor(COORD).primary.find((i) => i.id === 'home').area).toBe('coordinator');
  });
  it('menu sections only for the scopes the person has; My group only for a group leader', () => {
    expect(navFor(DEV).sections.map((s) => s.id)).toEqual(['mine', 'you']);
    expect(navFor(MIXED_M).sections.map((s) => s.id)).toEqual(['mine', 'batch', 'admin', 'you']);
    expect(navFor(FAC).sections.map((s) => s.id)).toEqual(['fac', 'you']);
    expect(ids(navFor(DEV).sections[0].items)).not.toContain('group');
    expect(ids(navFor(LEADER).sections[0].items)).toContain('group');
    expect(navFor(COORD).top?.id).toBe('home');
    expect(navFor(DEV).top).toBe(null);
  });
});

describe('the lit item (aria-current) for nested screens', () => {
  const lit = (sc, path) => navFor(sc).primary.filter((i) => isTab(i, path, sc)).map((i) => i.id);
  it('devotee', () => {
    expect(lit(DEV, '/home')).toEqual(['home']);
    expect(lit(DEV, '/day/2026-09-28/2026-10-01')).toEqual(['week']);
    expect(lit(DEV, '/history/2026-09-21')).toEqual(['report']);
    expect(lit(DEV, '/hearing')).toEqual(['home']);
    expect(lit(DEV, '/change-password')).toEqual(['account']);
  });
  it('staff: batch tools and a devotee light Batch; every admin screen lights Admin', () => {
    for (const p of ['/batch', '/members', '/stats', '/devotee/6000000001', '/devotee/981/week/2026-09-28', '/fill/981/day/2026-09-28/2026-10-01']) expect(lit(MASTER, p)).toEqual(['batch']);
    for (const p of ['/overview', '/coordinators', '/settings']) expect(lit(MASTER, p)).toEqual(['overview']);
    expect(lit(MASTER, '/requests')).toEqual(['requests']);
  });
  it('exactly one item at most is lit on any screen', () => {
    for (const p of ['/home', '/week', '/report', '/batch', '/requests', '/overview', '/account', '/wall']) expect(lit(MIXED_M, p).length).toBeLessThanOrEqual(1);
  });
});

describe('known screens (anything else is "not found")', () => {
  it('every screen the app has', () => {
    for (const p of ['/home', '/week', '/week/2026-09-28', '/day/2026-09-28/2026-10-01', '/history', '/history/2026-09-21', '/report', '/hearing', '/reading', '/learn', '/wall', '/group', '/account', '/change-password',
      '/batch', '/members', '/stats', '/leaders', '/requests', '/devotee/6000000001', '/devotee/981/week/2026-09-28', '/fill/981/week/2026-09-28', '/fill/981/day/2026-09-28/2026-10-01',
      '/my-devotees', '/my-devotees/981', '/my-devotees/981/2026-09-28', '/overview', '/settings', '/reopens']) expect(knownRoute(p), p).toBe(true);
  });
  it('unknown or broken links', () => {
    for (const p of ['/nowhere', '/devotee', '/devotee/', '/week/abc', '/day/2026-09-28', '/admin', '/fill/981', '/my-devotees/981/x']) expect(knownRoute(p), p).toBe(false);
  });
});

/*
 * Every role that broke on 18 Oct 2026, written down so a nav change cannot quietly break another role.
 * A change to one gate (canRequests -> classWork) hid screens from the ETP coordinator correctly and
 * at the same time handed Scoreboards to the SPS coordinator, who has no training at all.
 */
describe('who sees what, role by role (18 Oct 2026)', () => {
  const every = (sc) => navFor(sc).sections.flatMap((s) => s.items).map((i) => i.id);
  const ETP_COORD = { devotee: null, groupLeader: null, facilitator: null, trainee: null, coordinator: ['ETP-21'], master: false };
  const SPS_COORD = { ...COORD, trainee: null };
  // enrolling grants facilitator_name, so a trainee is a facilitator too (enrol.js)
  const TRAINEE = { ...DEV, trainee: { batchId: 'ETP-21', name: 'ETP · Batch 21' }, facilitator: { name: 'Suraj Sahu' } };
  const PLAIN = { ...DEV, trainee: null };

  it('an SPS coordinator has NO Scoreboards: a class batch has nothing on them', () => {
    expect(every(SPS_COORD)).not.toContain('scoreboards');
  });
  it('...and keeps every screen a class batch needs', () => {
    expect(every(SPS_COORD)).toEqual(expect.arrayContaining(['batch', 'members', 'leaders', 'stats', 'requests']));
  });
  it('a training coordinator has Scoreboards and Batch, and none of the class-batch screens', () => {
    const e = every(ETP_COORD);
    expect(e).toEqual(expect.arrayContaining(['batch', 'scoreboards']));
    for (const gone of ['members', 'leaders', 'stats', 'requests']) expect(e).not.toContain(gone);
  });
  it('the head has Scoreboards', () => expect(every(MASTER)).toContain('scoreboards'));
  // a trainee's card sits in the sidebar under the TRAINING's name, not as a facilitator's "My targets"
  it('an enrolled student has the ETP card, in a section named after their training', () => {
    const n = navFor(TRAINEE);
    expect(every(TRAINEE)).toContain('etp');
    expect(every(TRAINEE)).not.toContain('card');
    expect(n.sections.find((s) => s.id === 'train')?.label).toBe('ETP · Batch 21');
  });
  it('...and the phone bar keeps its clean look: no extra slot for it', () => {
    expect(ids(navFor(TRAINEE).primary)).not.toContain('etp');
  });
  it('a facilitator who is in no training keeps My targets', () => {
    expect(every({ ...FAC, trainee: null })).toContain('card');
  });
  it('the training coordinator has Students in the sidebar', () => {
    expect(every(ETP_COORD)).toContain('trainees');
    expect(every(SPS_COORD)).not.toContain('trainees');
  });
  it('a devotee in no training, who does not facilitate, has no My targets', () => expect(every(PLAIN)).not.toContain('card'));
  it('a devotee never sees Scoreboards', () => {
    expect(every(PLAIN)).not.toContain('scoreboards');
    expect(every(TRAINEE)).not.toContain('scoreboards');
  });
});

