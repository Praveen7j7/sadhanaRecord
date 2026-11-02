// The app scores with the same code as the server: marks computed here from a card as rules.get sends it
// (JSON) equal the server's marks for the same answers.
import { describe, it, expect } from 'vitest';
import { dayMarks, weekScores, dayPercent } from '$shared/scoring.js';
import { CARDS } from '../../worker/src/cards.js';
import * as server from '../../worker/src/scoring.js';

const asSent = name => JSON.parse(JSON.stringify(CARDS[name]));      // what the phone receives from rules.get
const day = { sleptAt: '22:10', wokeAt: '04:40', dayRestMin: 70, chantingDoneAt: '08:00', chantingSameDay: true, readingMin: 22, hearingMin: 46 };

describe('live marks in the app equal the server', () => {
  for (const name of ['SPS', 'BVS/DPS/BSS']) {
    it(`${name}: a day`, () => { expect(dayMarks(asSent(name), day)).toEqual(server.dayMarks(name, day)); });
    it(`${name}: a week`, () => {
      const week = Array(7).fill(day);
      expect(weekScores(asSent(name), week, 'P', 130)).toEqual(server.weekScores(name, week, 'P', 130));
    });
  }
  // TRD (Phase 22): the linear card, as sent to the phone, scores exactly as the server; its marks say their maximum
  const trd = { ...day, rounds: 12, serviceMin: 120, mangalAarti: 'ON_TIME', darshanAarti: 'LATE', morningClass: 'ON_TIME', prasadam: 'ABSENT' };
  it('TRD: a day', () => { expect(dayMarks(asSent('TRD'), trd)).toEqual(server.dayMarks('TRD', trd)); });
  it('TRD: a week (attendance not scored)', () => {
    const week = [trd, trd, {}, trd, {}, {}, trd];
    expect(weekScores(asSent('TRD'), week, 'A', 0)).toEqual(server.weekScores('TRD', week, 'A', 0));
    expect(weekScores(asSent('TRD'), week, 'A', 0).overall).toBe(weekScores(asSent('TRD'), week, 'P', 0).overall);
  });
  it('TRD: the day percent is out of 205, with no card at hand (Report, WeekRead, Share)', () => {
    // sleep 22:10 → 16.67 · wake 04:40 → 5 · done 08:00 → 23.08 · 12 rounds → 7.5 · rest 70 → 20 · hearing 46 → 19.17 ·
    // reading 22 → 9.17 · service 120 → 8.33 · morning 5 + 3 + 5 + 0 = 13 → 121.92 / 205 = 59.47 % → 59
    const p = dayPercent(dayMarks(asSent('TRD'), trd));
    expect([p.total, p.outOf, p.percent]).toEqual([121.92, 205, 59]);
  });
  it('shows the card range while typing', () => {
    expect(dayMarks(asSent('SPS'), { sleptAt: '22:10' }).to_bed).toEqual({ label: '10:00 - 10:15 PM', marks: 25 });
  });
});
