import { describe, it, expect } from 'vitest';
import { areaOf, staffArea } from '../src/lib/area.js';
import { categoryOf, QUOTE_MS } from '../src/lib/carousel.js';
import { QUOTES } from '../src/lib/quotes.js';

const DEV = { devotee: { batchId: 'SPS' }, coordinator: [], master: false };
const COORD = { devotee: null, coordinator: ['SPS', 'SPS2'], master: false };
const MASTER = { devotee: null, coordinator: [], master: true };
const MIXED = { devotee: { batchId: 'SPS' }, coordinator: ['DPS'], master: false };
const MIXED_M = { devotee: { batchId: 'SPS' }, coordinator: [], master: true };

describe('route → area (accent colour follows the area, not the login)', () => {
  it('before sign-in: the royal public brand (welcome, log in, sign up, forgot, a forced password change)', () => {
    for (const p of ['/welcome', '/login', '/signup', '/forgot', '/login?x=1']) { expect(areaOf(p, null)).toBe('public'); expect(areaOf(p, MASTER)).toBe('public'); }
    expect(areaOf('/', null)).toBe('public');
    expect(areaOf('/change-password', COORD, true)).toBe('public');
    expect(areaOf('/home', DEV, true)).toBe('public');
  });
  it("a devotee's own screens are devotee", () => {
    for (const p of ['/home', '/week', '/week/2026-09-28', '/day/2026-09-28/2026-10-01?f=rounds', '/history', '/history/2026-09-21', '/report', '/hearing?v=all', '/reading', '/account', '/change-password', '/wall'])
      expect(areaOf(p, DEV)).toBe('devotee');
  });
  it('batch tools are coordinator, admin tools are admin — for every login', () => {
    for (const sc of [COORD, MASTER, MIXED, MIXED_M]) {
      for (const p of ['/requests', '/batch', '/stats', '/leaders', '/devotee/6000000011', '/devotee/98?x']) expect(areaOf(p, sc)).toBe('coordinator');
      for (const p of ['/overview', '/coordinators', '/batches', '/ids', '/reopens', '/activity', '/settings']) expect(areaOf(p, sc)).toBe('admin');
      // filling a devotee's week on their behalf is batch work, even for a person who is a devotee too
      for (const p of ['/fill/6000000013/week/2026-09-28', '/fill/6000000013/day/2026-09-28/2026-10-01?f=rounds']) expect(areaOf(p, sc)).toBe('coordinator');
    }
  });
  it('home, wall and account follow the person: devotee first, else their staff role', () => {
    expect(areaOf('/home', COORD)).toBe('coordinator');
    expect(areaOf('/home', MASTER)).toBe('admin');
    expect(areaOf('/home', MIXED)).toBe('devotee');
    expect(areaOf('/home', MIXED_M)).toBe('devotee');
    expect(areaOf('/wall', COORD)).toBe('coordinator');
    expect(areaOf('/wall', MASTER)).toBe('admin');
    expect(areaOf('/account', MASTER)).toBe('admin');
    expect(areaOf('/change-password', COORD)).toBe('coordinator');
    expect(areaOf('/unknown', COORD)).toBe('coordinator');
    expect(staffArea(MASTER)).toBe('admin');
    expect(staffArea(COORD)).toBe('coordinator');
  });
});

describe('quote carousel', () => {
  it('derives the book from the reference', () => {
    expect(categoryOf('Bhagavad-gītā As It Is 2.40')).toBe('Bhagavad-gītā');
    expect(categoryOf('Śrīmad-Bhāgavatam 3.25.21')).toBe('Śrīmad-Bhāgavatam');
    expect(categoryOf('Śrī Caitanya-caritāmṛta Madhya 22.54')).toBe('Caitanya-caritāmṛta');
    expect(categoryOf('Śrī Caitanya-caritāmṛta Ādi 17.21')).toBe('Caitanya-caritāmṛta');
    expect(categoryOf('The Nectar of Instruction 1')).toBe('Nectar of Instruction');
    expect(categoryOf('Some other book 1.1')).toBe('');
    expect(categoryOf(undefined)).toBe('');
  });
  it('every quote in the app has a category', () => {
    for (const [, ref] of QUOTES) expect(categoryOf(ref), ref).not.toBe('');
  });
  it('turns slowly (about 9 s)', () => { expect(QUOTE_MS).toBe(9000); });
});

import { fmtLong } from '../src/lib/dates.js';
import { toHex } from '../src/lib/theme.js';
describe('home greeting date and browser bar colour', () => {
  it('formats the long date in Indian English order', () => {
    expect(fmtLong('2026-10-03')).toBe('Saturday, 3 October');
    expect(fmtLong('2026-01-01')).toBe('Thursday, 1 January');
    expect(fmtLong('')).toBe('');
  });
  it('reads computed colours as hex for meta theme-color', () => {
    expect(toHex('rgb(244, 245, 248)')).toBe('#f4f5f8');
    expect(toHex('rgba(0, 0, 0, 0.5)')).toBe('#000000');
    expect(toHex('color(srgb 1 0.5 0)')).toBe('#ff8000');
    expect(toHex('nonsense')).toBe('');
    expect(toHex(' #4B2A86')).toBe('#4b2a86');
  });
});

import { resolveTheme } from '../src/lib/theme.js';
describe('theme: System follows the phone', () => {
  it('resolves the choice to light or dark', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

import { normEmail, emailProblem, normWhatsapp, waLink, mailLink, classDayName, CLASS_DAYS } from '../src/lib/contact.js';
describe('contact details (same rules as the server)', () => {
  it('checks email format and names common typos', () => {
    expect(normEmail(' Rahul@Gmail.com ')).toBe('rahul@gmail.com');
    expect(normEmail('a..b@gmail.com')).toBe('');
    expect(emailProblem('')).toBe('Enter your email address');
    expect(emailProblem('rahul@')).toMatch(/valid email/);
    expect(emailProblem('rahul@gmial.com')).toBe('Did you mean rahul@gmail.com?');
    expect(emailProblem('a@yahooo.com')).toBe('Did you mean a@yahoo.com?');
    expect(emailProblem('a@hotmial.com')).toBe('Did you mean a@hotmail.com?');
    expect(emailProblem('a@outlok.com')).toBe('Did you mean a@outlook.com?');
    expect(emailProblem('devotee@iskcon.org')).toBe('');
  });
  it('WhatsApp: empty allowed, 10 digits, +91 removed, anything else refused', () => {
    expect(normWhatsapp('')).toBe('');
    expect(normWhatsapp('+91 60000 00001')).toBe('6000000001');
    expect(normWhatsapp('12345')).toBe(null);
    expect(waLink('6000000001')).toBe('https://wa.me/916000000001');
    expect(waLink('')).toBe('');
    expect(mailLink('a@b.co')).toBe('mailto:a@b.co');
  });
  it('class days: Sunday or Saturday', () => {
    expect(CLASS_DAYS.map((c) => c[0])).toEqual(['SUN', 'SAT']);
    expect(classDayName('SAT')).toBe('Saturday');
    expect(classDayName(null)).toBe('');
  });
});

import { auditLine, splitSpec, isMonday, REMINDER_TIMES, settingsDiff } from '../src/lib/admin.js';
describe('master oversight helpers', () => {
  it('activity lines read like sentences', () => {
    expect(auditLine({ who: 'sps', action: 'requests.approve', target: '6000000087', after: { status: 'ACTIVE', iyf_id: 'KT26-0042' } })).toBe('sps approved the sign-up of 6000000087 · linked KT26-0042 · active');
    expect(auditLine({ who: 'master', action: 'settings.update', target: 'settings', after: { reminder_time: '20:30' } })).toBe('master changed the settings');
    expect(auditLine({ who: 'sps', action: 'devotees.setPeople', target: '981', after: { classDay: 'SAT' } })).toBe('sps changed the facilitator / class day of 981 · Saturday class');
    // an action with no sentence yet reads as words, never the raw dotted name (7 Oct 2026)
    expect(auditLine({ who: 'x', action: 'something.new', target: 't' })).toBe('x something new t');
    expect(auditLine({ who: 'master', role: 'MASTER', action: 'leaders.assign', target: '6000000194', after: { leader: '6000000194' } })).toBe('IYF head added devotees to the group of 6000000194');
    expect(auditLine({ who: '6000000001', action: 'profile.facilitator', target: '6000000001', after: { facilitator: 'Natvar Gopinath Prabhuji' } })).toBe('6000000001 changed their facilitator · Natvar Gopinath Prabhuji');
  });
  it('settings form: window specs, Monday check, reminder times, only changes sent', () => {
    expect(splitSpec('sun 18:00')).toEqual({ day: 'SUN', time: '18:00' });
    expect(isMonday('2026-10-05')).toBe(true);
    expect(isMonday('2026-10-06')).toBe(false);
    expect(REMINDER_TIMES[0]).toBe('18:00');
    expect(REMINDER_TIMES.at(-1)).toBe('22:30');
    const saved = { submitWindow: { opens: 'SUN 18:00', closes: 'MON 21:00' }, trackingFrom: null, reminderTime: '21:00' };
    expect(settingsDiff(saved, { opensDay: 'SUN', opensTime: '18:00', closesDay: 'MON', closesTime: '21:00', trackingFrom: '', reminderTime: '21:00' })).toEqual({});
    expect(settingsDiff(saved, { opensDay: 'SAT', opensTime: '18:00', closesDay: 'MON', closesTime: '21:00', trackingFrom: '2026-10-05', reminderTime: '20:30' }))
      .toEqual({ submitWindow: { opens: 'SAT 18:00', closes: 'MON 21:00' }, trackingFrom: '2026-10-05', reminderTime: '20:30' });
  });
});
