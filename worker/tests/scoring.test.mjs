// Phase 2 gate: the app's scoring is the Excel cards' own. Every option of both cards is compared with the
// tables read from the files (setup/data/cards-from-excel.json, made by setup/extract-cards.py), every range
// boundary is checked, and the SPS sample week reproduces Excel's results.
import fs from 'node:fs';
import { suite } from './harness.mjs';
import { CARDS, CARD_SPS, CARD_BDB, CATEGORIES } from '../src/cards.js';
import { dayMarks, sevaScore, weekScores, clockMinutes, roundHalfAway } from '../src/scoring.js';

const t = suite('phase 2: scoring follows the Excel cards');
const excel = JSON.parse(fs.readFileSync(new URL('../../setup/data/cards-from-excel.json', import.meta.url), 'utf8'));

// ---- 1. every option: same labels, same marks, same order as the Excel files
for (const card of [CARD_BDB, CARD_SPS]) {
  for (const c of CATEGORIES) {
    t.eq(CARDS[card][c].map(o => [o.label, o.marks]), excel[card].categories[c].map(o => [o.label, o.marks]), `${card} · ${c}: options and marks as in ${excel[card].file}`);
  }
}

// ---- 2. every clock option: its first minute and last minute fall in it, its end falls in the next
const fmt = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const field = { to_bed: 'sleptAt', wake_up: 'wokeAt', japa: 'chantingDoneAt' };
let checked = 0;
for (const card of [CARD_BDB, CARD_SPS]) {
  for (const c of ['to_bed', 'wake_up', 'japa']) {
    CARDS[card][c].forEach((o, i, all) => {
      const day = v => ({ [field[c]]: v, chantingSameDay: true });
      if (o.from) { t.eq(dayMarks(card, day(o.from))[c]?.label, o.label, `${card} ${c} ${o.from} → ${o.label}`); checked++; }
      if (o.to) {
        t.eq(dayMarks(card, day(fmt(clockMinutes(o.to) - 1)))[c]?.label, o.label, `${card} ${c} ${fmt(clockMinutes(o.to) - 1)} → ${o.label}`);
        const next = all[i + 1] || all[all.length - 1];
        t.eq(dayMarks(card, day(o.to))[c]?.label, next.label, `${card} ${c} ${o.to} → ${next.label}`); checked += 2;
      }
    });
  }
  // every minute option: its smallest and largest number fall in it
  for (const c of ['day_sleep', 'pathan', 'sravan']) {
    const key = { day_sleep: 'dayRestMin', pathan: 'readingMin', sravan: 'hearingMin' }[c];
    for (const o of CARDS[card][c]) {
      t.eq(dayMarks(card, { [key]: o.min })[c]?.label, o.label, `${card} ${c} ${o.min} min → ${o.label}`); checked++;
      if (o.max !== null) { t.eq(dayMarks(card, { [key]: o.max })[c]?.label, o.label, `${card} ${c} ${o.max} min → ${o.label}`); checked++; }
    }
  }
}
console.log(`  checked ${checked} range edges`);

// ---- 3. the design's worked examples (§7a-1)
const one = (card, day, c) => { const m = dayMarks(card, { chantingSameDay: true, ...day })[c]; return `${m.label} · ${m.marks}`; };
t.eq(one(CARD_BDB, { sleptAt: '22:15' }, 'to_bed'), '10:15 - 10:30 PM · 15', 'a range includes its start: 22:15');
t.eq(one(CARD_SPS, { chantingDoneAt: '07:15' }, 'japa'), '07:15 - 09:30 AM · 20', '07:15 → 07:15–09:30 AM');
t.eq(one(CARD_SPS, { sleptAt: '21:40' }, 'to_bed'), '10:00 - 10:15 PM · 25', 'SPS sleep 21:40: earlier than the best range → the best');
t.eq(one(CARD_BDB, { sleptAt: '23:40' }, 'to_bed'), 'After 11:15 PM · -5', 'BSS sleep 23:40 → After 11:15 PM · −5');
t.eq(one(CARD_SPS, { sleptAt: '23:45' }, 'to_bed'), '11:15 - 11:30 PM · 0', 'SPS sleep 23:45 → the last option · 0 (decision 29)');
t.eq(one(CARD_SPS, { sleptAt: '00:30' }, 'to_bed'), '11:15 - 11:30 PM · 0', 'SPS sleep after midnight → 0');
t.eq(one(CARD_BDB, { sleptAt: '01:10' }, 'to_bed'), 'After 11:15 PM · -5', 'BSS sleep after midnight → −5');
t.eq(one(CARD_BDB, { wokeAt: '03:10' }, 'wake_up'), '03:45 - 04:00 AM · 25', 'woke before the best range → the best');
t.eq(one(CARD_SPS, { wokeAt: '07:30' }, 'wake_up'), '05:45 - 06:00 AM · 0', 'SPS woke after 6:00 → the last option');
t.eq(one(CARD_BDB, { hearingMin: 45 }, 'sravan'), '1 hr to 45 min · 25', 'BSS 45 min → 1 hr to 45 min · 25');
t.eq(one(CARD_SPS, { hearingMin: 20 }, 'sravan'), '24 to 20 min · 20', 'SPS 20 min → 24 to 20 min · 20');
t.eq(one(CARD_BDB, { readingMin: 75 }, 'pathan'), '1 hr to 45 min · 25', '75 min reading → the top · 25');
t.eq(one(CARD_SPS, { readingMin: 0 }, 'pathan'), 'No Reading · 0', 'SPS 0 min → No Reading');
t.eq(one(CARD_SPS, { readingMin: 3 }, 'pathan'), 'below 5 min · 5', 'SPS 3 min → below 5 min · 5');
t.eq(one(CARD_BDB, { readingMin: 0 }, 'pathan'), 'below 5 min · 0', 'BSS 0 min → below 5 min · 0');
t.eq(one(CARD_BDB, { dayRestMin: 60 }, 'day_sleep'), '1 hr or less · 25', 'day rest 60 min → 1 hr or less');
t.eq(one(CARD_BDB, { dayRestMin: 75 }, 'day_sleep'), '1 to 1:15 hr · 20', 'day rest 75 min → 1 to 1:15 hr');
t.eq(one(CARD_SPS, { dayRestMin: 200 }, 'day_sleep'), 'After 02:15 hr · -5', 'day rest 200 min → After 02:15 hr');
t.eq(dayMarks(CARD_SPS, { chantingDoneAt: '06:00', chantingSameDay: false }).japa, { label: 'After 11:00 PM', marks: -5 }, 'chanting not finished the same day → the last range');
t.eq(one(CARD_BDB, { chantingDoneAt: '00:30' }, 'japa'), 'Before 07:15 AM · 25', 'finished 00:30 on the same day → before 07:15');

// ---- 4. Seva
t.eq([89, 90, 119, 120, 149, 150, 179, 180, 209, 210, 999].map(m => sevaScore(CARD_BDB, m)), [0, 20, 20, 40, 40, 60, 60, 80, 80, 100, 100], 'BVS/DPS/BSS Seva steps (exactly 90 → 20, as the card formula)');
t.eq([0, 45, 89, 90, 2500].map(m => sevaScore(CARD_SPS, m)), [0, 50, 99, 100, 100], 'SPS Seva: minutes ÷ 90 × 100, capped at 100');

// ---- 5. the SPS sample week from the Excel file
const S = excel.spsSample, lab = (card, c, label) => CARDS[card][c].find(o => o.label === label);
for (const d of S.days) {
  for (const c of CATEGORIES) {
    if (c === 'japa' && d.japa === 'After 11:00 PM') continue;      // hand-typed over the formula in the sample
    t.eq(lab(CARD_SPS, c, d[c])?.marks, Number(d.marks[c]), `sample ${d.day} ${c}: "${d[c]}" scores ${d.marks[c]} as in Excel`);
  }
}
const pctOf = c => roundHalfAway(S.days.reduce((s, d) => s + lab(CARD_SPS, c, d[c]).marks, 0) / 175 * 100);
for (const c of ['to_bed', 'wake_up', 'day_sleep', 'pathan', 'sravan']) t.eq(pctOf(c), Number(S.percent[c]), `sample ${c}: ${S.percent[c]}% as in Excel`);
t.eq(pctOf('japa'), 31, 'sample japa from the card: 31% (Excel showed 97% only because four days were typed over)');
t.eq(sevaScore(CARD_SPS, S.days.reduce((s, d) => s + Number(d.seva_min), 0)), 100, `sample Seva: Excel ${S.percent.seva}% → capped at 100`);

// ---- 5b. the SPS PDF sample (one devotee's filled card): every day's option and marks, and the totals
const P = JSON.parse(fs.readFileSync(new URL('../../setup/data/sps-pdf-sample.json', import.meta.url), 'utf8'));
for (const d of P.days) for (const c of CATEGORIES) t.eq(lab(CARD_SPS, c, d[c].label)?.marks, d[c].marks, `PDF ${d.day} ${c}: "${d[c].label}" scores ${d[c].marks}`);
for (const c of CATEGORIES) {
  const total = P.days.reduce((s, d) => s + lab(CARD_SPS, c, d[c].label).marks, 0);
  t.eq([total, roundHalfAway(total / 175 * 100)], [P.totals[c], P.percent[c]], `PDF ${c}: total ${P.totals[c]}, ${P.percent[c]}%`);
}
t.eq([P.totals.seva_min, P.percent.seva, sevaScore(CARD_SPS, P.totals.seva_min)], [105, 58, 100], 'PDF Seva: 105 min showed 58 (÷180); the Excel card rule (÷90, capped) gives 100 — the app follows the Excel card');

// ---- 6. a whole week, typed the way the app collects it
const day = { sleptAt: '22:05', wokeAt: '04:35', dayRestMin: 30, chantingDoneAt: '06:50', chantingSameDay: true, readingMin: 30, hearingMin: 40 };
const week = [day, day, day, day, day, { ...day, chantingSameDay: false }, { ...day, readingMin: 0 }];
const s = weekScores(CARD_SPS, week, 'P', 300);
t.eq([s.bed, s.wake_up, s.day_sleep, s.japa, s.pathan, s.sravan, s.seva, s.attendance], [100, 100, 100, 83, 86, 100, 100, 100], 'SPS week percentages');
t.eq([s.body, s.soul, s.overall], [100, 90, 98], 'Body, Soul, Overall');
t.eq(weekScores(CARD_BDB, week, 'A', 89).seva, 0, 'BSS card, 89 Seva minutes → 0');
// ---- 7. every score stays between 0 and 100 (the head, 2 Oct 2026)
const late = { sleptAt: '23:50', wokeAt: '06:30', dayRestMin: 200, chantingDoneAt: '23:30', chantingSameDay: false, readingMin: 0, hearingMin: 0 };
const worst = weekScores(CARD_BDB, Array(7).fill(late), 'A', 0);
t.eq([worst.bed, worst.wake_up, worst.day_sleep, worst.japa], [0, 0, 0, 0], 'a week of −5 options (−35 marks) scores 0%, not −20%');
t.ok(['bed', 'wake_up', 'day_sleep', 'japa', 'pathan', 'sravan', 'seva', 'attendance', 'body', 'soul', 'overall'].every(k => worst[k] >= 0 && worst[k] <= 100), 'the worst possible week: every score within 0–100');
t.eq(dayMarks(CARD_BDB, late).to_bed, { label: 'After 11:15 PM', marks: -5 }, 'the option itself still carries the card\'s −5');
const best = weekScores(CARD_SPS, Array(7).fill(day), 'P', 5000);
t.ok(['bed', 'wake_up', 'day_sleep', 'japa', 'pathan', 'sravan', 'seva', 'attendance', 'body', 'soul', 'overall'].every(k => best[k] >= 0 && best[k] <= 100), 'the best possible week: every score within 0–100 (Seva 5000 min → 100)');
let threw = false; try { weekScores(CARD_SPS, [day, day], 'P', 0); } catch { threw = true; }
t.ok(threw, 'a week must have 7 days');
// ---- 8. a part week (the head, 4 Oct 2026): a day not filled adds 0 marks, so the score is capped by the days filled
const none = {};
const oneDay = weekScores(CARD_SPS, [day, none, none, none, none, none, none], 'P', 60);
t.eq([oneDay.bed, oneDay.wake_up, oneDay.day_sleep, oneDay.pathan, oneDay.sravan], [14, 14, 14, 14, 14], '1 perfect day of 7: each category 25 ÷ 175 = 14%');
const five = weekScores(CARD_SPS, [day, day, day, day, day, none, none], 'P', 300);
t.eq([five.bed, five.sravan], [71, 71], '5 perfect days: 125 ÷ 175 = 71%');
t.eq(weekScores(CARD_SPS, Array(7).fill(day), 'P', 300).bed, 100, '7 perfect days: 100%');
t.ok(oneDay.overall < five.overall && five.overall < weekScores(CARD_SPS, Array(7).fill(day), 'P', 300).overall, 'more days filled, higher week: never higher for fewer days');
t.eq(weekScores(CARD_SPS, Array(7).fill(none), 'A', 0).overall, 0, 'nothing filled and absent: 0');
const half = weekScores(CARD_SPS, [day, day, day, day, day, day, { sleptAt: '22:00' }], 'P', 0);
t.eq(half.to_bed, undefined, 'internal marks are not exposed as categories');
t.eq([half.bed, half.wake_up], [100, 86], 'an answer present on a day still counts; a missing one counts 0 (the server leaves out incomplete days before scoring)');
t.done();
