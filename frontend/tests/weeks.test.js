import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/lib/api.js', async (orig) => {
  const m = await orig();
  return { ...m, call: vi.fn(m.call) };
});

import { call, setToken, ApiError } from '../src/lib/api.js';
import { handle, reset, setLatency, setNow } from '../src/lib/mock.js';
import { createSaver, loadQueued, queuedDays, queueKey, diffDay, sendPressed } from '../src/lib/saver.js';
import { idbKeys, idbDel, idbGet } from '../src/lib/idb.js';
import { mapGaps, gapHref } from '../src/lib/gaps.js';
import { dayShareText, weekShareText } from '../src/lib/share.js';
import { dayMarks } from '$shared/scoring.js';
import * as cache from '../src/lib/cache.svelte.js';
import { homeEntry, loadHome, daySaved } from '../src/lib/weekstore.js';

const LOGIN = '6000000001';
const WEEK = '2026-10-05';
const WED = '2026-10-07';
let store;

beforeEach(async () => {
  store = {};
  const ls = {
    getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k],
    get length() { return Object.keys(store).length; }, key: (i) => Object.keys(store)[i] ?? null,
  };
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('sessionStorage', ls);
  vi.stubEnv('VITE_API_URL', '');
  reset(); setLatency(0);
  setNow('2026-10-07T10:00:00+05:30');                       // a Wednesday
  cache.clearAll(); cache.setScope(LOGIN);
  for (const k of await idbKeys('')) await idbDel(k);
  const r = await handle({ v: 1, action: 'auth.login', data: { login: LOGIN, password: 'pass-12345' } });
  setToken(r.data.token);
  call.mockClear();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const saves = () => call.mock.calls.filter((c) => c[0] === 'week.saveDay');

describe('day saver (sent only with Save)', () => {
  it('nothing is sent while typing; Save sends ONE request with only the changed fields and the version', async () => {
    const statuses = [];
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 0, saved: {}, onStatus: (x) => statuses.push(x) });
    await s.change({ rounds: 16 });
    await s.change({ sleptAt: '22:10' });
    expect(saves()).toHaveLength(0);
    expect(s.dirty()).toBe(true);
    expect(statuses.at(-1)).toBe('dirty');
    await s.save();
    expect(saves()).toHaveLength(1);
    expect(saves()[0][1]).toEqual({ weekId: WEEK, date: WED, version: 0, day: { rounds: 16, sleptAt: '22:10' } });
    expect(statuses.at(-1)).toBe('saved');
    expect(s.dirty()).toBe(false);
    await s.save();                                           // nothing differs: no request
    expect(saves()).toHaveLength(1);
    await s.change({ wokeAt: '04:50' });
    await s.save();
    expect(saves()[1][1]).toMatchObject({ version: 1, day: { wokeAt: '04:50' } });   // the new version, nothing resent
  });

  it('editing back to the saved values makes it clean again (compared with the saved copy, not a touched flag)', async () => {
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 3, saved: { rounds: 16, comment: 'ok' } });
    await s.change({ rounds: 12 });
    expect(s.pending()).toEqual({ rounds: 12 });
    await s.change({ rounds: 16 });
    expect(s.dirty()).toBe(false);
    await s.change({ comment: null });                        // a cleared field is sent as null
    expect(s.pending()).toEqual({ comment: null });
    await s.change({ comment: 'ok' });
    expect(s.dirty()).toBe(false);
    expect(diffDay({ hearing: [{ lectureId: 'a' }] }, { hearing: [{ lectureId: 'a' }] })).toEqual({});
  });

  it('keeps ONE local draft per day, written over on each change and removed after a Save', async () => {
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 0, saved: {} });
    await s.change({ rounds: 14 });
    await s.change({ rounds: 15, hearingMin: 30 });
    expect((await idbKeys(`q:${LOGIN}:`))).toEqual([queueKey(LOGIN, WEEK, WED)]);
    expect(await loadQueued(LOGIN, WEEK, WED)).toEqual({ weekId: WEEK, date: WED, version: 0, patch: { rounds: 15, hearingMin: 30 } });
    expect(await queuedDays(LOGIN)).toEqual([{ weekId: WEEK, date: WED, pressed: false }]);   // typed, Save not tapped yet
    await s.save();
    expect(await loadQueued(LOGIN, WEEK, WED)).toBeUndefined();
    expect(await queuedDays(LOGIN)).toEqual([]);
  });

  it('offline: not sent, the local copy stays, and the next Save sends it', async () => {
    const orig = call.getMockImplementation();
    call.mockImplementationOnce(async () => { throw new ApiError('NETWORK', 'No connection, try again'); });
    const statuses = [];
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 0, saved: {}, onStatus: (x) => statuses.push(x) });
    await s.change({ rounds: 9 });
    await s.save();
    expect(statuses.at(-1)).toBe('offline');
    expect(s.pending()).toEqual({ rounds: 9 });
    expect(await loadQueued(LOGIN, WEEK, WED)).toMatchObject({ patch: { rounds: 9 } });
    await s.save();
    expect(statuses.at(-1)).toBe('saved');
    expect(await loadQueued(LOGIN, WEEK, WED)).toBeUndefined();
    call.mockImplementation(orig);
  });

  it('a Save tapped offline is marked and sends by itself once back online; typing again clears the mark (8 Oct 2026)', async () => {
    const orig = call.getMockImplementation();
    call.mockImplementationOnce(async () => { throw new ApiError('NETWORK', 'No connection, try again'); });
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 0, saved: {} });
    await s.change({ rounds: 11 });
    await s.save();
    expect(await loadQueued(LOGIN, WEEK, WED)).toMatchObject({ patch: { rounds: 11 }, pressed: true });
    expect(await queuedDays(LOGIN)).toEqual([{ weekId: WEEK, date: WED, pressed: true }]);
    call.mockImplementation(orig);
    expect(await sendPressed(LOGIN)).toBe(1);
    expect(await loadQueued(LOGIN, WEEK, WED)).toBeUndefined();
    const r = await call('week.get', { weekId: WEEK });
    expect(r.days.find((d) => d.date === WED).day.rounds).toBe(11);
    // typed after the offline Save: not sent by itself (only what the person chose to save)
    call.mockImplementationOnce(async () => { throw new ApiError('NETWORK', 'No connection, try again'); });
    const s2 = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: r.days.find((d) => d.date === WED).version ?? 1, saved: { rounds: 11 } });
    await s2.change({ rounds: 12 }); await s2.save(); await s2.change({ rounds: 13 });
    call.mockImplementation(orig);
    expect(await sendPressed(LOGIN)).toBe(0);
    expect(await queuedDays(LOGIN)).toEqual([{ weekId: WEEK, date: WED, pressed: false }]);
  });

  // 22 Oct 2026: since B2 the button reads "Saved ✓" from the tap, so the browser check's done signal is the button's
  // busy state (status 'saving'). It must end only once the pressed draft is gone from the phone.
  it('an offline Save tapped again online: the draft is gone before the saving state ends', async () => {
    const orig = call.getMockImplementation();
    call.mockImplementationOnce(async () => { throw new ApiError('NETWORK', 'No connection, try again'); });
    const seen = [];
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 0, saved: {},
      onStatus: (x) => { seen.push([x, s.saving()]); if (x === 'saved') seen.push(['keys', idbKeys(`q:${LOGIN}:`)]); } });
    await s.change({ rounds: 10 });
    await s.save();
    expect(await loadQueued(LOGIN, WEEK, WED)).toMatchObject({ patch: { rounds: 10 }, pressed: true });
    call.mockImplementation(orig);
    seen.length = 0;
    await s.save();
    expect(seen.map((x) => x[0])).toEqual(['saving', 'saved', 'keys']);
    expect(await seen[2][1]).toEqual([]);           // read the moment 'saved' was announced
    expect(await idbKeys(`q:${LOGIN}:`)).toEqual([]);
  });

  it('STALE shows the other device copy, drops ours and carries on from its version', async () => {
    const other = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 0, saved: {} });   // "another device"
    await other.change({ rounds: 12 }); await other.save();
    const onStale = vi.fn();
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 0, saved: {}, onStale });
    await s.change({ rounds: 20 }); await s.save();
    expect(onStale).toHaveBeenCalledOnce();
    expect(onStale.mock.calls[0][0]).toMatchObject({ v: 1, rounds: 12 });
    expect(s.version()).toBe(1);
    expect(s.dirty()).toBe(false);
    expect(s.saved()).toMatchObject({ rounds: 12 });
    await s.change({ wokeAt: '05:00' }); await s.save();
    expect(saves().at(-1)[1]).toMatchObject({ version: 1, day: { wokeAt: '05:00' } });
  });

  it('a future day (FUTURE_DAY) is rejected and its local draft removed', async () => {
    const onRejected = vi.fn();
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: '2026-10-08', version: 0, saved: {}, onRejected });
    await s.change({ rounds: 5 }); await s.save();
    expect(onRejected.mock.calls[0][1].code).toBe('FUTURE_DAY');
    expect(await loadQueued(LOGIN, WEEK, '2026-10-08')).toBeUndefined();
  });

  it('a VALIDATION error keeps the answers (still to fix) and reports the field', async () => {
    const onRejected = vi.fn();
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 0, saved: {}, onRejected });
    await s.change({ rounds: 70, wokeAt: '04:50' }); await s.save();
    expect(onRejected.mock.calls[0][0]['day.rounds']).toBeTruthy();
    expect(s.dirty()).toBe(true);
  });

  // B2 (22 Oct 2026): the form shows "Saved ✓" the moment Save is tapped and lets the person leave; only an answer
  // changed AFTER the tap is still unsent
  it('while a Save is in flight nothing is unsent; a change made during it is', async () => {
    setLatency(40);
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 0, saved: {}, onStatus: () => {} });
    await s.change({ rounds: 16 });
    expect(s.unsent()).toBe(true);
    const p = s.save();
    expect(s.saving()).toBe(true);
    expect(s.unsent()).toBe(false);                 // what was typed is on its way: leaving loses nothing
    await s.change({ sleptAt: '22:10' });
    expect(s.unsent()).toBe(true);                  // typed after the tap: not on its way
    await p;
    expect(s.saving()).toBe(false);
    expect([s.dirty(), s.unsent()]).toEqual([true, true]);   // the later change still waits for its own Save
  });
  it('discard returns to the saved copy and removes the local draft', async () => {
    const s = createSaver({ login: LOGIN, weekId: WEEK, date: WED, version: 2, saved: { rounds: 16 } });
    await s.change({ rounds: 4 });
    expect(await s.discard()).toEqual({ rounds: 16 });
    expect(s.dirty()).toBe(false);
    expect(await loadQueued(LOGIN, WEEK, WED)).toBeUndefined();
  });
});

describe('live marks and share', () => {
  const full = { sleptAt: '22:20', wokeAt: '04:50', rounds: 16, chantingDoneAt: '07:20', chantingSameDay: true, dayRestMin: 30,
    hearingMin: 40, hearing: [{ text: 'Bhagavatam class' }], readingMin: 30, reading: { text: 'Own book' }, serviceMin: 300 };

  it('live marks are exactly the shared scoring, which is what the server returns', async () => {
    const rules = await call('rules.get', {});
    const card = rules.cards[rules.cardName];
    const r = await call('week.saveDay', { weekId: WEEK, date: WED, version: 0, day: full });
    expect(r.state).toBe('complete');
    expect(dayMarks(card, full)).toEqual(r.marks);
    expect(Object.keys(r.marks).sort()).toEqual(['day_sleep', 'japa', 'pathan', 'sravan', 'to_bed', 'wake_up']);
  });

  it('builds the share text of a sample day', async () => {
    const rules = await call('rules.get', {});
    const text = dayShareText({ ...full, exerciseMin: 20, chetnaPositive: ['Gave charity'] }, WED, { card: rules.cards[rules.cardName], batchName: 'SPS Group 2' });
    expect(text).toBe([
      'Hare Krishna!', 'Daily Sadhana: 7 Oct 2026', '*Batch*: SPS Group 2', '*Day score*: 90/100', '',
      '*Prev Night Sleep Time*: 10:20 PM (10:15 – 10:30 PM · 20)',
      '*Wake-Up Time*: 4:50 AM (04:45 – 05:00 AM · 20)', '',
      '*Chanting Rounds*: 16', '*Chanting Finished At*: 7:20 AM (07:15 – 09:30 AM · 20)', '*Completed Same Day*: Yes', '',
      '*Exercise*: 20 min', '*Day Rest*: 30 min (1 hr or less · 25)', '*Study/Job*: -', '',
      '*Hearing*: Bhagavatam class', '*Hearing Duration*: 40 min (30 to 25 min · 25)', '',
      '*Reading*: Own book', '*Reading Duration*: 30 min (30 to 25 min · 25)', '',
      '*Service*: -', '*Service Duration*: 300 min', '',
      '*Positive Chetna*: Gave charity', '*Negative Chetna*: -',
    ].join('\n'));
  });

  it('a draft day shows dashes for what is missing', async () => {
    const rules = await call('rules.get', {});
    const text = dayShareText({ rounds: 8 }, WED, { card: rules.cards[rules.cardName], batchName: 'SPS' });
    expect(text).toContain('*Day score*: 0/100');
    expect(text).toContain('*Prev Night Sleep Time*: -');
    expect(text).toContain('*Chanting Rounds*: 8');
  });

  it('week share carries the 11 scores, Night Stay, principles and average rounds', () => {
    const scores = { bed: 80, wake_up: 70, day_sleep: 90, japa: 60, pathan: 75, sravan: 85, seva: 100, attendance: 100, body: 80, soul: 73, overall: 88 };
    const t = weekShareText(WEEK, scores, { nightStay: 'YES', principles: 'YES', chantingAverage: 16.3 }, { batchName: 'DPS' });
    expect(t).toContain('*Overall*: 88%');
    expect(t).toContain('*Night Stay*: Yes');
    expect(t).toContain('*Average Rounds*: 16.3');
    expect(t.match(/%/g)).toHaveLength(11);
  });
});

describe('submit', () => {
  it('INCOMPLETE fields map to tappable items that jump to the day or section', async () => {
    setNow('2026-10-11T19:00:00+05:30');                     // Sunday 7 PM: the window is open
    await call('week.saveDay', { weekId: WEEK, date: WED, version: 0, day: { rounds: 10, hearingMin: 20 } });
    let err;
    try { await call('week.submit', { weekId: WEEK }); } catch (e) { err = e; }
    expect(err.code).toBe('INCOMPLETE');
    const gaps = mapGaps(err.fields);
    // a part week is an option (4 Oct 2026): only "no whole day yet" is asked for, not every missing answer
    const days = gaps.find((g) => g.key === 'days');
    expect(days.message).toBe('Fill at least one whole day');
    expect(gapHref(WEEK, days)).toBe(`#/week/${WEEK}?f=days`);
    expect(gaps.some((g) => g.kind === 'day')).toBe(false);
    expect(gaps.find((g) => g.kind === 'weekEnd' && g.key === 'nightStay')).toBeTruthy();
    expect(gapHref(WEEK, gaps.find((g) => g.kind === 'attendance'))).toBe(`#/week/${WEEK}?f=attendance`);
  });

  it('a part week submits with its complete days; the rest count 0 (4 Oct 2026)', async () => {
    setNow('2026-10-11T19:00:00+05:30');
    const day = { sleptAt: '22:00', wokeAt: '04:40', rounds: 16, chantingDoneAt: '07:00', chantingSameDay: true, dayRestMin: 20, hearingMin: 30, hearing: [{ text: 'Topic one' }], readingMin: 30, reading: { text: 'A book' }, serviceMin: 90 };
    await call('week.saveDay', { weekId: WEEK, date: '2026-10-05', version: 0, day });
    await call('week.saveDay', { weekId: WEEK, date: WED, version: 0, day: { rounds: 10 } });          // begun, not complete
    await call('week.saveWeekEnd', { weekId: WEEK, version: 0, nightStay: 'YES', principles: 'YES' });
    await call('week.setAttendance', { weekId: WEEK, mark: 'P' });
    const r = await call('week.submit', { weekId: WEEK });
    expect(r.daysFilled).toBe(1);
    expect(r.scores.bed).toBe(14);                                  // 25 ÷ 175
    const w = await call('week.get', { weekId: WEEK });
    expect([w.daysFilled, Object.keys(w.days[2]).length]).toEqual([1, 0]);
  });

  it('a complete week submits, shows scores, and is then locked', async () => {
    setNow('2026-10-11T19:00:00+05:30');
    const day = { sleptAt: '22:00', wokeAt: '04:40', rounds: 16, chantingDoneAt: '07:00', chantingSameDay: true, dayRestMin: 20, hearingMin: 30, hearing: [{ text: 'Topic one' }], readingMin: 30, reading: { text: 'A book' }, serviceMin: 90 };
    for (let i = 0; i < 7; i++) {
      const date = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'][i];
      await call('week.saveDay', { weekId: WEEK, date, version: 0, day });
    }
    await call('week.saveWeekEnd', { weekId: WEEK, version: 0, nightStay: 'YES', principles: 'YES' });
    await call('week.setAttendance', { weekId: WEEK, mark: 'P' });
    const r = await call('week.submit', { weekId: WEEK });
    expect(Object.keys(r.scores).sort()).toEqual(['attendance', 'bed', 'body', 'day_sleep', 'japa', 'overall', 'pathan', 'seva', 'soul', 'sravan', 'wake_up']);
    await expect(call('week.saveDay', { weekId: WEEK, date: WED, version: 1, day: { rounds: 1 } })).rejects.toMatchObject({ code: 'ALREADY_SUBMITTED' });
    await expect(call('week.submit', { weekId: WEEK })).rejects.toMatchObject({ code: 'ALREADY_SUBMITTED' });
    const h = await call('history.list', {});
    expect(h.weeks[0]).toMatchObject({ weekId: WEEK, status: 'SUBMITTED' });
  });
});

describe('home data and revisits', () => {
  it('home.get is fetched once per open; revisits within MAX_AGE cost no call', async () => {
    await loadHome();
    await loadHome();
    await loadHome();
    expect(call.mock.calls.filter((c) => c[0] === 'home.get')).toHaveLength(1);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + cache.MAX_AGE + 1000);      // back on screen after more than 2 minutes
    await loadHome();
    expect(call.mock.calls.filter((c) => c[0] === 'home.get')).toHaveLength(2);
  });

  it('a save patches the cached home with no refetch; future days are flagged', async () => {
    await loadHome();
    const e = homeEntry();
    const wk = e.data.weeks.find((w) => w.weekId === WEEK);
    expect(wk.days.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
    const reply = await call('week.saveDay', { weekId: WEEK, date: WED, version: 0, day: { rounds: 12 } });
    daySaved(WEEK, WED, reply, { rounds: 12 });
    const d = homeEntry().data.weeks.find((w) => w.weekId === WEEK).days[2];
    expect(d).toMatchObject({ state: 'partial', version: 1, day: { rounds: 12 } });
    expect(call.mock.calls.filter((c) => c[0] === 'home.get')).toHaveLength(1);
  });

  it('rules.get / journals.get are skipped when the stored version matches', async () => {
    const { getRules, getJournals } = await import('../src/lib/refdata.js');
    await getRules(LOGIN, 'r1'); await getRules(LOGIN, 'r1');
    await getJournals(LOGIN, 'j1'); await getJournals(LOGIN, 'j1');
    expect(call.mock.calls.filter((c) => c[0] === 'rules.get')).toHaveLength(1);
    expect(call.mock.calls.filter((c) => c[0] === 'journals.get')).toHaveLength(1);
    await getRules(LOGIN, 'r2');                              // the server moved on: asks again, with `have`
    expect(call.mock.calls.filter((c) => c[0] === 'rules.get').at(-1)[1]).toEqual({ have: 'r1' });
  });
});
