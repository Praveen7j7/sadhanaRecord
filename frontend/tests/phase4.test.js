import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { filterLectures, lectureLink, readFilters, filterParams, weeksOf, weekLectures, stepWeek, isFiltered } from '../src/lib/lectures.js';
import { levelsOf, levelIn, filterBooks } from '../src/lib/books.js';
import { wrap, swipeDir, countdown } from '../src/lib/carousel.js';
import { coverScale, clampOffset, sourceRect, fitWithin, encodeUnder } from '../src/lib/crop.js';
import { markOpen, attendanceDiff, applyMarks, applyClass, effectiveMark, classDefault, boardCounts, boardFilter, dayCells, fromWeekChoices, defaultOpenUntil, istIso, mondayIST, closesAt, closesSpec } from '../src/lib/staff.js';
import { QUOTES, quoteIndex, quoteFor, shuffled, openDeck, seen } from '../src/lib/quotes.js';
import { handle, reset, setLatency, setNow } from '../src/lib/mock.js';

const L = (week, slot, title, extra = {}) => ({ lectureId: `W${week}-${slot}`, journal: 'SPS/DPS', week, slot, title, audioUrl: 'https://drive.google.com/file/d/x/view', ...extra });
const LECTURES = [L(1, 'SPL', 'The soul is eternal'), L(1, 'GKGML', 'Chanting with attention'), L(1, 'LOW 1', 'Seva'), L(1, 'LOW 2', 'Humility'),
  L(2, 'LOW 2', 'Tolerance like a tree'), L(2, 'SPL', 'Hearing from the right source'), L(2, 'GKGML', 'The holy name', { inFolder: true, audioUrl: 'https://drive.google.com/drive/folders/f' }),
  L(2, 'LOW 1', 'No link here', { audioUrl: '' })];

describe('lecture list', () => {
  it('no filter = the whole journal; each filter narrows it', () => {
    expect(filterLectures(LECTURES, {})).toHaveLength(8);
    expect(filterLectures(LECTURES, { week: 2 })).toHaveLength(4);
    expect(filterLectures(LECTURES, { slot: 'SPL' }).map((l) => l.week)).toEqual([1, 2]);
    expect(filterLectures(LECTURES, { q: 'the HOLY' }).map((l) => l.lectureId)).toEqual(['W2-GKGML']);
    expect(filterLectures(LECTURES, { heard: 'yes' }, ['W1-SPL', 'W2-SPL'])).toHaveLength(2);
    expect(filterLectures(LECTURES, { heard: 'no', week: 1 }, ['W1-SPL'])).toHaveLength(3);
    expect(isFiltered({ week: '', slot: '', q: '  ', heard: '' })).toBe(false);
  });
  it('the open action: own file, a folder (pick the file), or nothing', () => {
    expect(lectureLink(LECTURES[0]).kind).toBe('file');
    expect(lectureLink(LECTURES[6])).toEqual({ kind: 'folder', url: 'https://drive.google.com/drive/folders/f' });
    expect(lectureLink(LECTURES[7]).kind).toBe('none');
    expect(lectureLink({ audioUrl: 'javascript:alert(1)' }).kind).toBe('none');
  });
  it('one week at a time in slot order, stepping stops at the ends', () => {
    expect(weekLectures(LECTURES, 2).map((l) => l.slot)).toEqual(['SPL', 'GKGML', 'LOW 1', 'LOW 2']);
    const weeks = weeksOf(LECTURES);
    expect(weeks).toEqual([1, 2]);
    expect(stepWeek(weeks, 1, -1)).toBe(1);
    expect(stepWeek(weeks, 1, 1)).toBe(2);
    expect(stepWeek(weeks, 2, 1)).toBe(2);
  });
  it('filters round-trip through the hash query; bad values are dropped', () => {
    const f = readFilters(new URLSearchParams('v=all&w=12&s=LOW%201&q=gita&h=no'));
    expect(f).toEqual({ all: true, week: 12, slot: 'LOW 1', q: 'gita', heard: 'no' });
    expect(filterParams(f)).toEqual({ v: 'all', w: 12, s: 'LOW 1', q: 'gita', h: 'no' });
    expect(readFilters(new URLSearchParams('w=-3&s=XYZ&h=maybe'))).toEqual({ all: false, week: '', slot: '', q: '', heard: '' });
    expect(filterParams({ all: false, week: 5, slot: 'SPL', q: 'x', heard: 'no' })).toEqual({ v: '', w: 5, s: '', q: '', h: '' });   // one-week view keeps only the week
  });
});

describe('book list', () => {
  const B = [{ bookId: 'a', title: 'Bhagavad Gita', level: 'SPS/DPS' }, { bookId: 'b', title: 'Raja Vidya', level: 'VL-2' }, { bookId: 'c', title: 'Gita Mahatmya', level: 'BSS/BVS' }, { bookId: 'd', title: 'Odd', level: 'X' }];
  it('levels in course order, the own level by default, search within the level', () => {
    expect(levelsOf(B)).toEqual(['VL-2', 'SPS/DPS', 'BSS/BVS', 'X']);
    expect(levelIn('', 'SPS/DPS', levelsOf(B))).toBe('SPS/DPS');
    expect(levelIn('', null, levelsOf(B))).toBe('all');
    expect(levelIn('VL-2', 'SPS/DPS', levelsOf(B))).toBe('VL-2');
    expect(filterBooks(B, 'SPS/DPS', 'gita').map((b) => b.bookId)).toEqual(['a']);
    expect(filterBooks(B, 'all', 'gita').map((b) => b.bookId)).toEqual(['a', 'c']);
  });
});

describe('quotes on signed-in screens: a shuffled order per phone', () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
  it('every quote once per round, in a random order', () => {
    const o = shuffled(QUOTES.length);
    expect([...o].sort((a, b) => a - b)).toEqual(QUOTES.map((_, i) => i));
    const firsts = new Set(Array.from({ length: 30 }, () => shuffled(QUOTES.length)[0]));
    expect(firsts.size).toBeGreaterThan(5);
  });
  it('each open starts at a quote not shown yet', () => {
    const st = mem(), starts = [];
    for (let k = 0; k < 10; k++) { const d = openDeck(QUOTES.length, st); starts.push(d.order[d.at]); seen(d, d.at, st); }
    expect(new Set(starts).size).toBe(10);
  });
  it('quotes swiped past count as shown; going back does not skip ahead', () => {
    const st = mem();
    let d = openDeck(QUOTES.length, st); seen(d, 0, st); seen(d, 1, st); seen(d, 2, st); seen(d, 1, st);
    d = openDeck(QUOTES.length, st);
    expect(d.at).toBe(3);
  });
  it('a used-up round reshuffles, never starting with the quote just shown', () => {
    const st = mem(), n = 5;
    for (let k = 0; k < 40; k++) {
      const d = openDeck(n, st), last = d.order[n - 1];
      seen(d, n - 1, st);
      const e = openDeck(n, st);
      expect(e.at).toBe(0);
      expect(e.order[0]).not.toBe(last);
    }
  });
  it('a stored order from another quote list, broken data or no storage: a fresh random order', () => {
    const st = mem();
    st.setItem('sr.quotes', JSON.stringify({ order: [0, 1], at: 1 }));
    expect(openDeck(QUOTES.length, st).order.length).toBe(QUOTES.length);
    st.setItem('sr.quotes', '{bad');
    expect(openDeck(QUOTES.length, st).at).toBe(0);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(openDeck(QUOTES.length, blocked).order.length).toBe(QUOTES.length);
  });
});

describe('quote carousel', () => {
  it('the Welcome screen: today\'s quote; the carousel wraps both ways', () => {
    expect(QUOTES[quoteIndex('2026-10-03')]).toEqual(quoteFor('2026-10-03'));
    expect(wrap(QUOTES.length, QUOTES.length)).toBe(0);
    expect(wrap(-1, QUOTES.length)).toBe(QUOTES.length - 1);
    expect(wrap(47, 46)).toBe(1);
  });
  it('a horizontal swipe turns, a tap or a vertical scroll does not', () => {
    expect(swipeDir(-80, 5)).toBe(1);
    expect(swipeDir(80, 10)).toBe(-1);
    expect(swipeDir(20, 0)).toBe(0);
    expect(swipeDir(-60, 70)).toBe(0);
  });
  it('the countdown pauses with the time left and resumes from there', () => {
    vi.useFakeTimers();
    let now = 0;
    const done = vi.fn();
    const c = countdown(8000, done, () => now);
    c.run(); now = 3000; vi.advanceTimersByTime(3000);
    c.pause();
    expect(c.left).toBe(5000);
    now = 20000; vi.advanceTimersByTime(17000);
    expect(done).not.toHaveBeenCalled();
    c.run(); now = 25000; vi.advanceTimersByTime(5000);
    expect(done).toHaveBeenCalledOnce();
    expect(c.left).toBe(8000);
    c.reset(); vi.useRealTimers();
  });
  it('quotes are kept exactly (78 after Phase 9, the longest under 430 characters)', () => {
    expect(QUOTES).toHaveLength(78);
    // the carousel sizes its card to the tallest slide, so a very long verse would make a wall of text:
    // Phase 9 (9 Oct 2026) keeps every quote at or under 430 characters
    expect(Math.max(...QUOTES.map((q) => q[0].length))).toBeLessThanOrEqual(430);
    // every verse carries its reference, so anyone can check it against the book
    expect(QUOTES.every(([text, ref]) => text.trim() && ref.trim())).toBe(true);
    expect(new Set(QUOTES.map((q) => q[1])).size).toBe(QUOTES.length);   // no duplicate reference
  });
});

describe('photo crop', () => {
  it('the image covers the square view; moving is clamped so no gap shows', () => {
    expect(coverScale(4000, 3000, 300)).toBeCloseTo(0.1);
    expect(clampOffset(4000, 3000, 300, 1, 500, 40)).toEqual({ x: 50, y: 0 });     // 400 x 300 shown: 50 px each side, none up/down
    expect(clampOffset(4000, 3000, 300, 2, -500, 500)).toEqual({ x: -250, y: 150 });
  });
  it('the source square is centred at zoom 1 and follows the offset', () => {
    expect(sourceRect(4000, 3000, 300, 1, 0, 0)).toEqual({ sx: 500, sy: 0, size: 3000 });
    const r = sourceRect(4000, 3000, 300, 2, 50, 0);                                 // moved right 50 view px = 250 image px
    expect(r.size).toBe(1500);
    expect(r.sx).toBeCloseTo(4000 / 2 - 750 - 250);
  });
  it('big photos are shrunk first; encoding lowers quality until under 150 KB', async () => {
    expect(fitWithin(4000, 3000)).toEqual({ w: 1600, h: 1200, scaled: true });
    expect(fitWithin(800, 600).scaled).toBe(false);
    const sizes = { 0.82: 300e3, 0.72: 200e3, 0.62: 120e3 };
    const r = await encodeUnder(async (q) => ({ size: sizes[q] ?? 1 }));
    expect(r.quality).toBe(0.62);
    expect((await encodeUnder(async () => ({ size: 999e3 }))).blob).toBe(null);
  });
});

describe('attendance and board logic', () => {
  const row = (login, a, status = 'DRAFT') => ({ login, name: login, status, days: [], attendance: { devotee: null, coordinator: null, used: null, locked: false, ...a } });
  const rows = [row('a', { devotee: 'P' }), row('b', { coordinator: 'A', used: 'A' }), row('c', { locked: true }), row('d', {})];
  it('one call with only the marks that changed (a cleared mark is null; locked rows never)', () => {
    expect(attendanceDiff(rows, { a: 'P', b: 'A', c: 'P', d: null })).toEqual([{ login: 'a', mark: 'P' }]);
    expect(attendanceDiff(rows, { b: null, d: 'A' })).toEqual([{ login: 'b', mark: null }, { login: 'd', mark: 'A' }]);
    expect(attendanceDiff(rows, {})).toEqual([]);
  });
  it('the mark that counts: coordinator, then a no-class week, then the devotee', () => {
    expect(effectiveMark(rows[0])).toBe('P');
    expect(effectiveMark(rows[0], { a: 'A' })).toBe('A');
    expect(effectiveMark(rows[0], {}, { everyonePresent: false })).toBe('A');            // own mark ignored in a marked-only week
    expect(effectiveMark(rows[3], {}, { everyonePresent: true })).toBe('P');
    expect(classDefault(null)).toBe(null);
    const after = applyMarks(rows, [{ login: 'b', mark: null }]);
    expect(after[1].attendance).toMatchObject({ coordinator: null, used: null });
    expect(applyClass(rows, { everyonePresent: true }).map((r) => r.attendance.used)).toEqual(['P', 'A', 'P', 'P']);
  });
  it('summary counts, chip filter, day cells', () => {
    const r = [row('x', {}, 'SUBMITTED'), row('y', {}, 'REOPENED'), row('z', {}, 'MISSED')];
    expect(boardCounts(r)).toEqual({ SUBMITTED: 1, DRAFT: 1, NOT_STARTED: 0, MISSED: 1, INACTIVE: 0 });
    expect(boardFilter(r, 'DRAFT').map((x) => x.login)).toEqual(['y']);
    expect(dayCells(r[0])).toEqual(Array(7).fill('complete'));
    expect(dayCells(r[2])).toEqual(Array(7).fill('empty'));
  });
  it('attendance is the weekly class: only active devotees, from the Sunday class (one for everyone)', () => {
    const d = { attendanceOpen: false, attendanceOpensAt: '2026-10-11T00:00:00+05:30', closesAt: '2026-10-12T21:00:00+05:30' };
    const row = (o) => ({ membership: 'ACTIVE', accountStatus: 'ACTIVE', classDay: 'SUN', attendance: { locked: false }, ...o });
    const at = (iso) => Date.parse(iso);
    expect(markOpen(row(), d, at('2026-10-10T10:00:00+05:30'))).toBe(false);                  // Saturday: the Sunday class has not happened
    expect(markOpen(row({ classDay: 'SAT' }), d, at('2026-10-10T10:00:00+05:30'))).toBe(false); // one Sunday class for Saturday-class devotees too
    expect(markOpen(row({ classDay: 'SAT' }), d, at('2026-10-11T00:00:00+05:30'))).toBe(true);  // Sunday 00:00
    expect(markOpen(row(), { ...d, attendanceOpen: true }, at('2026-10-11T10:00:00+05:30'))).toBe(true);
    expect(markOpen(row({ membership: 'INACTIVE' }), { ...d, attendanceOpen: true }, at('2026-10-11T10:00:00+05:30'))).toBe(false);
    expect(markOpen(row({ accountStatus: 'DISABLED' }), { ...d, attendanceOpen: true }, at('2026-10-11T10:00:00+05:30'))).toBe(false);
    expect(markOpen(row({ attendance: { locked: true } }), { ...d, attendanceOpen: true }, at('2026-10-11T10:00:00+05:30'))).toBe(false);
    expect(markOpen(row({ classDay: 'SAT' }), d, at('2026-10-12T22:00:00+05:30'))).toBe(false);  // after the Monday 9 PM deadline
  });
  it('weeks in Indian time: from-week choices, default open-until, ISO with +05:30', () => {
    expect(mondayIST(new Date('2026-10-04T20:00:00+05:30'))).toBe('2026-09-28');           // Sunday
    expect(fromWeekChoices(new Date('2026-10-05T10:00:00+05:30')).map((c) => c.label)).toEqual(['This week', 'Next week', 'Last week']);   // Monday morning
    expect(fromWeekChoices(new Date('2026-10-05T21:30:00+05:30')).map((c) => c.label)).toEqual(['This week', 'Next week']);
    expect(defaultOpenUntil(new Date('2026-10-03T23:30:00+05:30'))).toBe('2026-10-05T21:00');
  });
  it('the deadline follows the master setting (submit_closes), not a built-in 21:00', () => {
    // the head moved the close to Monday 2 PM: last week is no longer offered on Monday afternoon, and the reopen default keeps 14:00
    expect(fromWeekChoices(new Date('2026-10-05T13:00:00+05:30'), 'MON 14:00').map((c) => c.label)).toEqual(['This week', 'Next week', 'Last week']);
    expect(fromWeekChoices(new Date('2026-10-05T14:30:00+05:30'), 'MON 14:00').map((c) => c.label)).toEqual(['This week', 'Next week']);
    expect(defaultOpenUntil(new Date('2026-10-03T23:30:00+05:30'), 'MON 14:00')).toBe('2026-10-05T14:00');
    // the close is a moment in the FOLLOWING week, as the server's windowOf reads it: "TUE 10:00" closes the week of 5 Oct on 13 Oct
    expect(closesAt('2026-10-05', 'TUE 10:00').toISOString()).toBe(new Date('2026-10-13T10:00:00+05:30').toISOString());
    expect(closesAt('2026-10-05', 'MON 21:00').toISOString()).toBe(new Date('2026-10-12T21:00:00+05:30').toISOString());
    // an unreadable spec (or none yet: meta not loaded) falls back to the shipped default, as the server does
    expect(closesSpec('garbage')).toEqual({ day: 0, hm: '21:00' });
    expect(closesSpec(undefined)).toEqual({ day: 0, hm: '21:00' });
    expect(istIso('2026-10-05T21:00')).toBe('2026-10-05T21:00:00+05:30');
    expect(istIso('bad')).toBe('');
  });
});

describe('mock coordinator and master actions', () => {
  beforeEach(() => { reset(); setLatency(0); setNow('2026-10-07T10:00:00+05:30'); });   // a Wednesday
  afterEach(() => setNow(null));
  const req = (action, data = {}, token) => handle({ v: 1, action, token, requestId: crypto.randomUUID(), app: 't', data });
  const login = async (l, p) => (await req('auth.login', { login: l, password: p })).data.token;

  it('the board has a batch of 12 in mixed states; attendance saves in one call; no-class weeks change the marks', async () => {
    const t = await login('sps', 'sps-pass-12');
    const b = (await req('devotees.list', { batchId: 'SPS' }, t)).data;
    expect(b.weekId).toBe('2026-10-05');
    // one class a week: attendance opens on the class day (Sunday); Wednesday is too early
    expect(b.attendanceOpen).toBe(false);
    expect(b.attendanceOpensAt).toBe('2026-10-11T00:00:00+05:30');
    expect(b.rows.length).toBe(12);
    expect(b.rows.find((r) => r.login === '6000000015').classDay).toBe('SAT');
    expect(b.rows.some((r) => 'groupLeader' in r)).toBe(false);
    expect(new Set(b.rows.map((r) => r.status))).toEqual(new Set(['SUBMITTED', 'DRAFT', 'NOT_STARTED']));
    const marks = [{ login: '6000000014', mark: 'A' }, { login: '6000000015', mark: null }];
    expect((await req('attendance.set', { batchId: 'SPS', weekId: b.weekId, marks }, t)).error.code).toBe('FUTURE_DAY');
    setNow('2026-10-10T10:00:00+05:30');                                                  // Saturday: one Sunday class for everyone
    expect((await req('attendance.set', { batchId: 'SPS', weekId: b.weekId, marks: [{ login: '6000000015', mark: 'P' }] }, t)).error.code).toBe('FUTURE_DAY');
    setNow('2026-10-11T10:00:00+05:30');                                                  // Sunday
    expect((await req('devotees.list', { batchId: 'SPS', weekId: b.weekId }, t)).data.attendanceOpen).toBe(true);
    expect((await req('attendance.set', { batchId: 'SPS', weekId: b.weekId, marks: [{ login: '6000000020', mark: 'P' }] }, t)).error.code).toBe('VALIDATION');   // not active
    const s = await req('attendance.set', { batchId: 'SPS', weekId: b.weekId, marks }, t);
    expect(s.ok).toBe(true);
    const c = await req('weeks.setClass', { batchId: 'SPS', weekId: b.weekId, kind: 'FESTIVAL', note: 'Diwali', everyonePresent: false }, t);
    expect(c.data.classWeek).toMatchObject({ kind: 'FESTIVAL', note: 'Diwali', everyonePresent: false });
    const b2 = (await req('devotees.list', { batchId: 'SPS' }, t)).data;
    expect(b2.classWeek.note).toBe('Diwali');
    expect(b2.rows.find((r) => r.login === '6000000011').attendance.used).toBe('A');     // own P ignored
    expect(b2.rows.find((r) => r.login === '6000000013').attendance.used).toBe('P');     // the coordinator's mark wins
    expect((await req('weeks.setClass', { batchId: 'SPS', weekId: b.weekId, kind: 'HOLIDAY', note: 'x', everyonePresent: true }, t)).error.code).toBe('VALIDATION');
    // the devotee's own mark is refused in such a week
    const d = await login('6000000001', 'pass-12345');
    expect((await req('week.setAttendance', { weekId: b.weekId, mark: 'P' }, d)).error.code).toBe('CONFLICT');
    expect((await req('home.get', {}, d)).data.weeks.at(-1).attendance.classWeek.note).toBe('Diwali');
  });

  it('stats, devotee detail, inactive / disable, delete with the phone typed again', async () => {
    const t = await login('sps', 'sps-pass-12');
    const st = (await req('stats.batch', { batchId: 'SPS', weeks: 8 }, t)).data;
    expect(st.trend).toHaveLength(8);
    expect(st.missedLog.length).toBeGreaterThan(0);
    expect(st.thisWeek.byDay).toHaveLength(7);
    const g = (await req('devotees.get', { login: '6000000016' }, t)).data;
    expect(g.lastWeeks.some((w) => w.status === 'MISSED')).toBe(true);
    expect(g.profile.emergency.phone).toMatch(/^\d{10}$/);
    expect((await req('devotees.setActive', { login: '6000000016', active: false }, t)).data).toEqual({ status: 'INACTIVE', fromWeek: '2026-10-05' });
    expect((await req('devotees.setDisabled', { login: '6000000016', disabled: true }, t)).data.status).toBe('DISABLED');
    expect((await req('devotees.delete', { login: '6000000016', confirmPhone: '6000000000' }, t)).error.code).toBe('VALIDATION');
    expect((await req('devotees.delete', { login: '6000000016', confirmPhone: '6000000016' }, t)).ok).toBe(true);
    expect((await req('devotees.get', { login: '6000000016' }, t)).error.code).toBe('NOT_FOUND');
    expect((await req('devotees.get', { login: '6000000088' }, t)).error.code).toBe('FORBIDDEN');   // a DPS devotee: not this coordinator's batch
  });

  it('reopen: the coordinator asks, the master reopens or rejects', async () => {
    const t = await login('sps', 'sps-pass-12');
    const m = await login('master', 'master-pass-1');
    // any staff reads the pending requests of their own batches, as on the server (G15, 22 Oct 2026); the head decides
    expect((await req('reopen.list', {}, t)).data.requests.every((x) => ['SPS', 'SPS2', 'SPSO', 'DPS'].includes(x.batchId))).toBe(true);
    const list = (await req('reopen.list', {}, m)).data.requests;
    expect(list).toHaveLength(1);
    const r = list[0];
    expect((await req('weeks.reopen', { login: r.login, weekId: r.weekId, reason: 'ok', openUntil: '2026-10-09T21:00:00+05:30' }, m)).data.openUntil).toBe('2026-10-09T21:00:00+05:30');
    expect((await req('reopen.list', {}, m)).data.requests).toHaveLength(0);
    const g = (await req('devotees.get', { login: '6000000018' }, t)).data;
    const missed = g.lastWeeks.find((w) => w.status === 'MISSED');
    expect((await req('reopen.request', { login: '6000000018', weekId: missed.weekId, reason: 'Was travelling' }, t)).ok).toBe(true);
    expect((await req('reopen.reject', { login: '6000000018', weekId: missed.weekId, reason: 'Too late' }, m)).ok).toBe(true);
  });

  it('class day (no group leaders), birthdays, profile with email and WhatsApp, photo, duplicates', async () => {
    const t = await login('sps', 'sps-pass-12');
    expect((await req('groupLeaders.set', { batchId: 'SPS', names: ['X Pr'] }, t)).error.code).toBe('BAD_REQUEST');
    const meta = (await req('meta.get')).data;
    expect(meta.classDays).toEqual([{ id: 'SUN', name: 'Sunday' }, { id: 'SAT', name: 'Saturday' }]);
    expect(meta.batches.some((b) => 'groupLeaders' in b)).toBe(false);
    expect((await req('devotees.setPeople', { login: '6000000014', classDay: 'SAT' }, t)).data).toEqual({ facilitator: 'Vilasa Padmanabha Prabhuji', classDay: 'SAT' });
    expect((await req('devotees.setPeople', { login: '6000000014', classDay: 'MON' }, t)).error.code).toBe('VALIDATION');
    const g = (await req('devotees.get', { login: '6000000011' }, t)).data;
    expect(g).toMatchObject({ classDay: 'SUN', email: 'aarav.gupta@gmail.com', whatsapp: '6000000011' });
    expect(g.memberships[0].classDay).toBe('SUN');
    const bd = (await req('birthdays.today', {}, t)).data;
    expect(bd.today.length + bd.upcoming.length).toBeGreaterThan(0);
    const d = await login('6000000001', 'pass-12345');
    expect((await req('profile.update', { bloodGroup: 'O+' }, d)).data.bloodGroup).toBe('O+');
    expect((await req('profile.get', {}, d)).data).toMatchObject({ email: 'sunil.kumar@gmail.com', whatsapp: '6000000001', classDay: 'SUN' });
    expect((await req('profile.update', { email: 'sunil@gmial.com' }, d)).error.fields[0].message).toBe('Did you mean sunil@gmail.com?');
    expect((await req('profile.update', { email: 'sunil@iskcon.org', whatsapp: '' }, d)).data).toMatchObject({ email: 'sunil@iskcon.org', whatsapp: '' });
    expect((await req('photo.upload', { jpegBase64: 'not-a-jpeg' }, d)).error.code).toBe('VALIDATION');
    const up = (await req('photo.upload', { jpegBase64: '/9j/4AAQSkZJRg==' }, d)).data;
    expect(up.hasPhoto).toBe(true);
    expect((await req('photo.get', { login: '6000000001' }, t)).data.updatedAt).toBe(up.photoUpdatedAt);
    expect((await req('photo.remove', { login: '6000000001' }, t)).error.code).toBe('VALIDATION');           // someone else's: a reason
    const m = await login('master', 'master-pass-1');
    const dup = (await req('ids.possibleDuplicates', {}, m)).data;
    expect(dup.groups.map((g) => g.why).sort()).toEqual(['same name', 'same phone']);
  });
});
