import { describe, it, expect, beforeEach } from 'vitest';
import { handle, reset, setLatency, setNow } from '../src/lib/mock.js';
import { linkify, relTime, sortAnns, latestOf } from '../src/lib/ann.js';
import { scopesOf, canRequests } from '../src/lib/scopes.js';

beforeEach(() => { reset(); setLatency(0); setNow('2026-10-07T10:00:00+05:30'); });
const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data;

describe('announcement wall (mock follows the server rules)', () => {
  it('a devotee sees Everyone plus their own batch, and cannot post', async () => {
    const { token } = await login('6000000001', 'pass-12345');
    const r = (await req('announcements.list', {}, token)).data;
    expect(r.announcements.map((a) => a.title)).toEqual(['Ekadashi kirtan this Saturday', 'Sunday class timing changed']);   // pinned first; SPS2 and DPS hidden
    expect(r.announcements.every((a) => !a.canEdit)).toBe(true);
    expect((await req('announcements.create', { title: 'Hi', body: 'x', audience: ['SPS'] }, token)).error.code).toBe('FORBIDDEN');
  });
  it('home.get carries the latest post time for the bell', async () => {
    const { token } = await login('6000000001', 'pass-12345');
    expect((await req('home.get', {}, token)).data.latestAnnouncementAt).toBe('2026-10-02T08:30:00+05:30');
  });
  it('a coordinator posts only to batches they coordinate; a master to everyone', async () => {
    const c = (await login('sps', 'sps-pass-12')).token;
    expect((await req('announcements.create', { title: 'To all', body: 'x', audience: 'ALL' }, c)).error.fields[0].path).toBe('audience');
    expect((await req('announcements.create', { title: 'DPS only', body: 'x', audience: ['DPS'] }, c)).error.code).toBe('FORBIDDEN');
    const ok = await req('announcements.create', { title: 'SPS news', body: 'Line one\nLine two', audience: ['SPS', 'SPS2'], pinned: true }, c);
    expect(ok.data.announcement).toMatchObject({ title: 'SPS news', audience: ['SPS', 'SPS2'], pinned: true, canEdit: true, author: 'SPS Team' });
    const m = (await login('master', 'master-pass-1')).token;
    expect((await req('announcements.create', { title: 'All hands', body: 'x', audience: 'ALL' }, m)).ok).toBe(true);
  });
  it('only the author or a master can edit or remove; removal hides it', async () => {
    const c = (await login('sps', 'sps-pass-12')).token, meera = (await login('meera', 'meera-pass-1')).token, m = (await login('master', 'master-pass-1')).token;
    const id = (await req('announcements.create', { title: 'Mine', body: 'x', audience: ['SPS'] }, c)).data.announcement.id;
    expect((await req('announcements.update', { id, title: 'Hacked' }, meera)).error.code).toBe('FORBIDDEN');
    expect((await req('announcements.update', { id, title: 'Edited' }, m)).data.announcement.title).toBe('Edited');
    expect((await req('announcements.remove', { id }, c)).data).toEqual({ removed: id });
    const l = (await req('announcements.list', {}, c)).data.announcements;
    expect(l.some((a) => a.id === id)).toBe(false);
  });
  it('validates the title and message', async () => {
    const c = (await login('sps', 'sps-pass-12')).token;
    const r = await req('announcements.create', { title: 'x', body: '', audience: ['SPS'] }, c);
    expect(r.error.fields.map((f) => f.path).sort()).toEqual(['body', 'title']);
  });
});

describe('announcement text and scopes', () => {
  it('links become anchors; everything else stays text', () => {
    expect(linkify('See https://example.com/a?b=1, then <b>bold</b>.')).toEqual([
      { t: 'text', v: 'See ' }, { t: 'url', v: 'https://example.com/a?b=1' }, { t: 'text', v: ', then <b>bold</b>.' }]);
    expect(linkify('javascript:alert(1) and no links')).toEqual([{ t: 'text', v: 'javascript:alert(1) and no links' }]);
  });
  it('relative time, ordering and latest', () => {
    const now = Date.parse('2026-10-07T10:00:00+05:30');
    expect(relTime('2026-10-07T09:58:00+05:30', now)).toBe('2 min ago');
    expect(relTime('2026-10-07T07:00:00+05:30', now)).toBe('3 h ago');
    expect(relTime('2026-10-04T10:00:00+05:30', now)).toBe('3 days ago');
    const l = [{ createdAt: '2026-10-01', pinned: false }, { createdAt: '2026-09-01', pinned: true }, { createdAt: '2026-10-05', pinned: false }];
    expect(sortAnns(l).map((a) => a.createdAt)).toEqual(['2026-09-01', '2026-10-05', '2026-10-01']);
    expect(latestOf(l)).toBe('2026-10-05');
  });
  it('scopes come from the server, else from the role', () => {
    expect(scopesOf({ scopes: { devotee: { batchId: 'SPS' }, coordinator: ['DPS'], master: false } }).coordinator).toEqual(['DPS']);
    expect(scopesOf({ role: 'MASTER' }).master).toBe(true);
    expect(scopesOf({ role: 'COORDINATOR', batchIds: ['SPS'] })).toMatchObject({ devotee: null, coordinator: ['SPS'] });
    expect(scopesOf({ role: 'DEVOTEE', batchIds: ['DPS'] }).devotee).toEqual({ batchId: 'DPS' });
    expect(canRequests(scopesOf({ role: 'DEVOTEE', batchIds: ['DPS'] }))).toBe(false);
  });
});
