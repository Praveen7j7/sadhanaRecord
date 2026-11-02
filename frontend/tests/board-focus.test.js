// Phase 22 (E3): the boards, and a card opened from one, stand on the server's focusWeek — last week until its Monday
// 9 PM deadline, then this week (worker/src/staff.js). The mock stood on this week at every hour, so the Last week /
// This phase filter would have been checked against a week the server never shows.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handle, reset, setLatency, setNow } from '../src/lib/mock.js';

beforeEach(() => { reset(); setLatency(0); });
afterEach(() => setNow(null));
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
async function login(l, p) { const r = await req('auth.login', { login: l, password: p }); return r.data?.token; }

describe('boards open on the finished week until its deadline (focusWeek)', () => {
  for (const [at, want, when] of [
    ['2026-10-26T10:00:00+05:30', '2026-10-19', 'Monday morning: last week'],
    ['2026-10-26T22:00:00+05:30', '2026-10-26', 'Monday after the 9 PM deadline: this week'],
    ['2026-10-29T12:00:00+05:30', '2026-10-26', 'mid-week: this week']]) {
    it(when, async () => {
      setNow(at);
      const m = await login('master', 'master-pass-1');
      expect((await req('board.list', {}, m)).data.weekId).toBe(want);
      expect((await req('board.get', {}, m)).data.weekId).toBe(want);
      expect((await req('card.of', { login: 'natvar' }, m)).data.weekId).toBe(want);
      // a person's own card stays on the week in progress (card.get: mondayOf(now)), as on the server
      expect((await req('card.get', {}, m)).data.weekId).toBe('2026-10-26');
    });
  }
});
