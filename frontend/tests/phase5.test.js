import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { handle, reset, setLatency, setNow } from '../src/lib/mock.js';
import { b64urlToBytes, iosNeedsInstall } from '../src/lib/push.js';

const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data.token;
const EP = 'https://fcm.googleapis.com/fcm/send/abc';
const KEYS = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };

describe('filling on behalf of a devotee (coordinator)', () => {
  beforeEach(() => { reset(); setLatency(0); setNow('2026-10-07T10:00:00+05:30'); });
  afterEach(() => setNow(null));
  it('the coordinator saves and submits for an active devotee of their batch; the board shows it', async () => {
    const t = await login('sps', 'sps-pass-12');
    const w = (await req('week.get', { weekId: '2026-10-05', onBehalfOf: '6000000013' }, t)).data;
    expect(w.weekId).toBe('2026-10-05');
    const day = { sleptAt: '22:00', wokeAt: '04:30', dayRestMin: 0, rounds: 16, chantingDoneAt: '07:00', chantingSameDay: true, hearingMin: 0, readingMin: 0, serviceMin: 0 };
    const s = await req('week.saveDay', { weekId: '2026-10-05', date: '2026-10-05', version: 0, day, onBehalfOf: '6000000013' }, t);
    expect(s.ok).toBe(true);
    const b = (await req('devotees.list', { batchId: 'SPS' }, t)).data;
    expect(b.rows.find((r) => r.login === '6000000013').status).toBe('DRAFT');
    const audit = (await req('audit.list', { what: 'week.saveDay' }, await login('master', 'master-pass-1'))).data.rows;
    expect(audit[0]).toMatchObject({ who: 'sps', action: 'week.saveDay', target: '6000000013' });
  });
  it('refuses devotees outside the batch, inactive devotees, and devotees acting for others', async () => {
    const t = await login('sps', 'sps-pass-12');
    expect((await req('week.get', { weekId: '2026-10-05', onBehalfOf: '6000000088' }, t)).error.code).toBe('CONFLICT');    // still pending: not active yet
    expect((await req('week.get', { weekId: '2026-10-05', onBehalfOf: 'nobody' }, t)).error.code).toBe('NOT_FOUND');
    expect((await req('week.get', { weekId: '2026-10-05', onBehalfOf: '6000000020' }, t)).error.code).toBe('CONFLICT');   // inactive
    const d = await login('6000000001', 'pass-12345');
    expect((await req('week.get', { weekId: '2026-10-05', onBehalfOf: '6000000013' }, d)).error.code).toBe('FORBIDDEN');
  });
});

describe('the 9 PM reminder', () => {
  beforeEach(() => { reset(); setLatency(0); });
  it('meta.get gives the public key and time; a devotee subscribes and unsubscribes', async () => {
    const m = (await req('meta.get')).data;
    expect(m.push.time).toBe('21:00');
    expect(b64urlToBytes(m.push.publicKey)).toHaveLength(65);
    const d = await login('6000000001', 'pass-12345');
    expect((await req('push.subscribe', { endpoint: EP, keys: KEYS }, d)).data).toEqual({ on: true, time: '21:00' });
    expect((await req('push.subscribe', { endpoint: 'https://evil.example/x', keys: KEYS }, d)).error.code).toBe('VALIDATION');
    expect((await req('push.unsubscribe', { endpoint: EP }, d)).data).toEqual({ on: false });
    expect((await req('push.subscribe', { endpoint: EP + 'staff', keys: KEYS }, await login('sps', 'sps-pass-12'))).data.on).toBe(true);   // staff phones too
    expect((await req('push.register', { endpoint: EP + 'anon', keys: KEYS })).data.on).toBe(true);                                        // signed out
    expect((await req('push.detach', { endpoint: EP + 'staff' }, await login('sps', 'sps-pass-12'))).data.on).toBe(true);
    for (let i = 0; i < 5; i++) await req('push.subscribe', { endpoint: EP + i, keys: KEYS }, d);
    expect((await req('push.subscribe', { endpoint: EP + 9, keys: KEYS }, d)).error.code).toBe('CONFLICT');
  });
  it('iPhone needs the app on the Home Screen first', () => {
    expect(iosNeedsInstall('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', false)).toBe(true);
    expect(iosNeedsInstall('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', true)).toBe(false);
    expect(iosNeedsInstall('Mozilla/5.0 (Linux; Android 13)', false)).toBe(false);
  });
  it('the service worker shows the words itself for the empty push, and opens Home on tap', async () => {
    const listeners = {}, shown = [], opened = [];
    const self = { addEventListener: (t, f) => (listeners[t] = f), registration: { showNotification: (t, o) => { shown.push([t, o]); return Promise.resolve(); } },
      clients: { matchAll: async () => [], openWindow: async (u) => opened.push(u) } };
    vm.runInNewContext(readFileSync(new URL('../public/push-sw.js', import.meta.url), 'utf8'), { self, Date, setTimeout, Promise, Error, JSON });
    expect(self.__sadhanaReminder(new Date('2026-10-04T21:05:00+05:30')).title).toBe('Attendance and your week');       // Sunday
    expect(self.__sadhanaReminder(new Date('2026-10-05T21:05:00+05:30'))).toEqual({ title: "Hare Krishna! Today's sadhana", body: "Time to update today's sadhana. Tap to open it." });
    let wait; listeners.push({ waitUntil: (p) => (wait = p) }); await wait;
    expect(shown[0][1]).toMatchObject({ tag: 'sadhana-reminder', renotify: true, silent: false, vibrate: [180, 90, 180], data: { url: '/#/home' }, icon: '/icons/icon-192.png' });   // pops up even over an older one
    let w2; listeners.notificationclick({ notification: { close() {}, data: { url: '/#/home' } }, waitUntil: (p) => (w2 = p) }); await w2;
    expect(opened).toEqual(['/#/home']);
    // with a connection the phone asks the server what to show (an announcement here); a URL outside the app is refused
    self.registration.pushManager = { getSubscription: async () => ({ endpoint: 'https://fcm.googleapis.com/x' }) };
    const ctx2 = { self, Date, setTimeout, Promise, Error, JSON, fetch: async () => ({ json: async () => ({ ok: true, data: { title: 'New from IYF Delhi', body: 'Janmashtami', url: '/#/wall', tag: 'ann-7' } }) }) };
    const l2 = {}; self.addEventListener = (t, f) => (l2[t] = f);
    vm.runInNewContext(readFileSync(new URL('../public/push-sw.js', import.meta.url), 'utf8'), ctx2);
    let w3; l2.push({ waitUntil: (p) => (w3 = p) }); await w3;
    expect(shown.at(-1)).toEqual(['New from IYF Delhi', expect.objectContaining({ body: 'Janmashtami', tag: 'ann-7', data: { url: '/#/wall' } })]);
    let w4; l2.notificationclick({ notification: { close() {}, data: { url: 'https://evil.example' } }, waitUntil: (p) => (w4 = p) }); await w4;
    expect(opened.at(-1)).toBe('/#/home');
  });
});

describe('master oversight and settings', () => {
  beforeEach(() => { reset(); setLatency(0); setNow('2026-10-07T10:00:00+05:30'); });
  afterEach(() => setNow(null));
  it('stats for every batch with totals; staff other than the master are refused', async () => {
    const m = await login('master', 'master-pass-1');
    const s = (await req('stats.all', { weeks: 4 }, m)).data;
    expect(s.batches.map((b) => b.batchId)).toContain('SPS');
    expect(s.batches[0].trend).toHaveLength(4);
    expect(s.totals.expected).toBe(s.batches.reduce((a, b) => a + b.thisWeek.expected, 0));
    expect((await req('stats.all', {}, await login('sps', 'sps-pass-12'))).error.code).toBe('FORBIDDEN');
  });
  it('the activity log records writes (never passwords), newest first, filtered and paged', async () => {
    const t = await login('sps', 'sps-pass-12');
    await req('requests.approve', { phone: '6000000087', link: { noIdYet: true }, levelEntryDate: '2026-10-02', facilitator: 'Natvar Gopinath Prabhuji', classDay: 'SUN' }, t);
    const m = await login('master', 'master-pass-1');
    const a = (await req('audit.list', { limit: 2 }, m)).data;
    expect(a.rows[0]).toMatchObject({ who: 'sps', action: 'requests.approve', target: '6000000087' });
    expect(a.more).toBe(true);
    const next = (await req('audit.list', { limit: 2, before: a.rows[1].id }, m)).data.rows;
    expect(next[0].id).toBeLessThan(a.rows[1].id);
    expect((await req('audit.list', { who: 'master' }, m)).data.rows.every((r) => r.who === 'master')).toBe(true);
    await req('coordinators.resetPassword', { username: 'meera', tempPassword: 'secret-temp-1' }, m);
    expect(JSON.stringify((await req('audit.list', {}, m)).data.rows)).not.toContain('secret-temp-1');
    expect((await req('runlog.list', {}, m)).data.rows.length).toBeGreaterThan(0);
  });
  it('settings: submit window, the first tracked week (a Monday), reminder time 18:00–22:59', async () => {
    const m = await login('master', 'master-pass-1');
    expect((await req('settings.get', {}, m)).data).toMatchObject({ submitWindow: { opens: 'SUN 18:00', closes: 'MON 21:00' }, reminderTime: '21:00' });
    expect((await req('settings.update', { trackingFrom: '2026-10-06', reminderTime: '23:30', submitWindow: { opens: 'X', closes: 'MON 21:00' } }, m)).error.fields.map((f) => f.path).sort()).toEqual(['reminderTime', 'submitWindow', 'trackingFrom']);
    const s = (await req('settings.update', { trackingFrom: '2026-10-05', reminderTime: '20:30' }, m)).data;
    expect(s).toMatchObject({ trackingFrom: '2026-10-05', reminderTime: '20:30' });
    expect((await req('meta.get')).data.push.time).toBe('20:30');
  });
});
