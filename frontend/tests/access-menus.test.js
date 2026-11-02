// The menu follows the rights (ADR 0019): a staff screen whose right the head turned off for this person is not
// offered, and its route answers "Not available to you"; a head's own screens are never taken.
import { describe, it, expect } from 'vitest';
import { allowed } from '../src/routes.js';
import { can } from '../src/lib/scopes.js';

const coord = (rights = {}) => ({ devotee: { batchId: 'SPS' }, groupLeader: null, facilitator: null, trainee: null, coordinator: ['SPS'], master: false, rights });

describe('menus follow the rights', () => {
  it('a coordinator with every right keeps every screen', () => {
    for (const p of ['/requests', '/leaders', '/closing', '/fill/6000000151/week/2026-10-19']) expect(allowed(p, coord()), p).toBe(true);
  });
  it('a right turned off hides its screen, and only that one', () => {
    expect(allowed('/leaders', coord({ leaders: 'deny' }))).toBe(false);
    expect(allowed('/closing', coord({ promote: 'deny' }))).toBe(false);
    expect(allowed('/fill/6000000151/week/2026-10-19', coord({ fillFor: 'deny' }))).toBe(false);
    expect(allowed('/requests', coord({ leaders: 'deny' }))).toBe(true);
  });
  it('Requests goes only when both sign-ups and resets are off', () => {
    expect(allowed('/requests', coord({ signups: 'deny' }))).toBe(true);
    expect(allowed('/requests', coord({ signups: 'deny', resets: 'deny' }))).toBe(false);
  });
  it("a head's screens are never taken", () => {
    const head = { ...coord({ leaders: 'deny', exports: 'deny' }), coordinator: [], master: true };
    expect(allowed('/leaders', head)).toBe(true);
    expect(can(head, 'exports')).toBe(true);
  });
  it('revoked: back to a devotee, no staff screens', () => {
    const dev = { ...coord(), coordinator: [] };
    for (const p of ['/requests', '/leaders', '/batch']) expect(allowed(p, dev), p).toBe(false);
    expect(allowed('/week', dev)).toBe(true);
  });
});
