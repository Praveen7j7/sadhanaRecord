// Mock of the weekly-form actions (a faithful port of worker/src/weeks.js and rules.js: same validation, same
// error codes, same reply shapes) with a mutable clock so every state can be reached offline.
import { CARDS } from '../../../worker/src/cards.js';
import { weekScores, dayMarks, dayPercent } from '$shared/scoring.js';
import { windowWords } from '$shared/window.js';
import { TEMPLE_KEYS, TEMPLE_ANSWERS } from '$shared/temple.js';

const IST = 5.5 * 3600e3, DAY = 864e5;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

let clock = null;
/** Sets the mock's "now" (ISO string, e.g. '2026-10-04T19:00:00+05:30'); null = the real time. */
export function setNow(iso) { clock = iso ? new Date(iso) : null; }
export const nowD = () => (clock ? new Date(clock) : new Date());
export const ymd = (d) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
export const isoIst = (d) => new Date(d.getTime() + IST).toISOString().slice(0, 19) + '+05:30';
export function mondayOf(d) { const l = new Date(d.getTime() + IST); l.setUTCDate(l.getUTCDate() - ((l.getUTCDay() + 6) % 7)); return l.toISOString().slice(0, 10); }
export const weekStart = (w) => new Date(`${w}T00:00:00+05:30`);
export const addDays = (w, n) => ymd(new Date(weekStart(w).getTime() + n * DAY + 12 * 3600e3));
/** Today's IST month-day and the one to match with it (worker weeks.js birthdayDays): 29 Feb on 1 March of a year without one. */
export function birthdayDays(now) {
  const day = isoIst(now).slice(0, 10), y = +day.slice(0, 4), md = day.slice(5);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return [md, md === '03-01' && !leap ? '02-29' : md];
}
export const validWeekId = (w) => /^\d{4}-\d{2}-\d{2}$/.test(String(w || '')) && !isNaN(weekStart(w)) && mondayOf(weekStart(w)) === w;
/* The submit window follows the MASTER SETTING, as the server's windowOf does. It used to be arithmetic on
   18:00 / 21:00, so moving the window in the mock's own Settings screen changed nothing the mock enforced —
   and the browser checks then proved the app worked for a window nobody had set. mockadmin.js owns the
   settings and registers this reader, because it installs after this module. */
const DOW = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };
let windowSpecs = () => ({ opens: 'SUN 18:00', closes: 'MON 21:00' });
export function setWindowSpecs(fn) { windowSpecs = fn; }
/** "SUN 18:00" → ms after the week's Monday 00:00 IST; `nextWeek` for the deadline (the following Monday). */
function specOffset(spec, nextWeek, fallbackDay, fallbackHour) {
  const m = /^(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{1,2}):(\d{2})$/.exec(String(spec || '').trim().toUpperCase());
  const day = m ? DOW[m[1]] : fallbackDay, h = m ? Number(m[2]) : fallbackHour, min = m ? Number(m[3]) : 0;
  return ((nextWeek ? 7 : 0) + day) * DAY + (h * 60 + min) * 60e3;
}
const opensOf = (w) => new Date(weekStart(w).getTime() + specOffset(windowSpecs().opens, false, 6, 18));
/** One class a week, on Sunday, for everyone (decision 41): attendance can be marked from Sunday 00:00 IST. */
/*
 * Attendance opens on the BATCH'S OWN class day — the server's rule since migration 0051.
 *
 * It was day 6, Sunday, for everyone. That was right while every batch met at the weekend and wrong
 * the moment a training batch met on a weekday, because its coordinator could not mark the class
 * they had just taken.
 *
 * The mock must agree with the server: the browser checks run against it, so a mock on the old rule
 * would make 1,800 checks agree with each other and disagree with the app.
 */
const DAY_OFFSET = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };
export const DAY_NAME = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };
/*
 * An unset or unreadable day is SUNDAY, never Monday: opening early would let a class be marked
 * before it happened. Named readDay, not classDayOf — classDayOf below is a different fact (which
 * day a PERSON attends, from their membership), and one name for two things is how these drift.
 */
export const readDay = (d) => (DAY_OFFSET[String(d || '').toUpperCase()] === undefined ? 'SUN' : String(d).toUpperCase());
export const attendanceOpens = (w, classDay) => new Date(weekStart(w).getTime() + DAY_OFFSET[readDay(classDay)] * DAY);
/** Night Stay and the 4 regulative principles open on Saturday 6 PM IST. */
export const weekEndOpens = (w) => new Date(weekStart(w).getTime() + 5 * DAY + 18 * 3600e3);
/** A devotee's class day: their current membership's, else the one they chose at sign-up; Sunday when not set. */
export const classDayOf = (u) => (u?.memberships || []).find((m) => !m.toWeek)?.classDay || u?.classDay || 'SUN';
export const closesOf = (w) => new Date(weekStart(w).getTime() + specOffset(windowSpecs().closes, true, 0, 21));

// ---- reference data ----
const CHETNA = { positive: ['Helped a devotee', 'Gave charity', 'Distributed books', 'Extra programme attended'], negative: ['Anger', 'Wasted time', 'Gossip', 'Overate'] };
// Books: 0, 1, 2, 3, 6 and 12 PDFs (the server's book_files), across every level; the mock links are fake Drive files.
// Hindi (19 Oct 2026): some books also have Hindi PDFs and a Hindi title; B34 has its chapters, read on demand.
const HINDI = { B20: { titleHi: 'श्रीमद्-भगवद्-गीता यथारूप' }, B26: { titleHi: 'लीला पुरुषोत्तम भगवान् श्रीकृष्ण' },
  B30: { titleHi: 'श्रीमद्-भागवतम् (सम्पूर्ण)' }, B31: { titleHi: 'श्रीचैतन्य-चरितामृत (सम्पूर्ण)' },
  B34: { titleHi: 'श्रीमद्-भागवतम् · स्कन्ध 10', chaptersHi: 5 } };
const CHAPTERS = { 'B34|hi': [['Part 1', 'Contents'], ['Part 1', 'Introduction'], ['Part 1', '1. Bhagavan Sri Krishna ka Avatar'], ['Part 1', '2. Devataon dwara Garbhasth Krishna ki Stuti'],
  ['Part 1', '3. Sri Krishna Janma'], ['Part 2', 'Contents'], ['Part 2', '14. Brahma dwara Sri Krishna ki Stuti'], ['Part 2', '15. Dhenukasur ka Vadha']]
  .map(([part, label], i) => ({ part, label, url: `https://drive.google.com/file/d/mock-B34-c${i + 1}/view` })) };
const pdf = (id, label) => ({ label, url: `https://drive.google.com/file/d/mock-${id}/view` });
const hpdf = (id, label) => ({ ...pdf(id, label), lang: 'hi' });       // a Hindi PDF (the server marks it lang 'hi')
const vols = (id, labels) => labels.map((l, i) => pdf(`${id}-${i + 1}`, l));
const BOOKS = [
  ['B01', 'Open Eyed Meditations', 'VL-1', [pdf('B01', 'PDF')]], ['B02', 'DYS Book', 'VL-1', []], ['B03', 'Beyond Birth and Death', 'VL-1', [pdf('B03', 'PDF')]],
  ['B04', 'The Perfection of Yoga', 'VL-1', [pdf('B04', 'PDF')]], ['B05', 'Easy Journey to Other Planets', 'VL-1', [pdf('B05', 'PDF')]],
  ['B10', 'Science and Spirituality', 'VL-2', [pdf('B10', 'PDF')]], ['B11', 'Raja Vidya', 'VL-2', [pdf('B11', 'PDF')]], ['B12', 'Message of Godhead', 'VL-2', [pdf('B12', 'PDF')]],
  ['B13', 'Elevation to Krsna Consciousness', 'VL-2', [pdf('B13', 'PDF')]], ['B14', 'Perfect Questions, Perfect Answers', 'VL-3', [pdf('B14', 'PDF')]],
  ['B15', 'Teachings of Lord Kapila', 'VL-3', [pdf('B15', 'PDF')]], ['B16', 'Life Comes from Life', 'VL-3', [pdf('B16', 'PDF')]],
  ['B20', 'Bhagavad Gita', 'SPS/DPS', [pdf('B20-en', 'English'), hpdf('B20-hi', 'भगवद्-गीता यथारूप · 876 पृष्ठ'), hpdf('B20-hi2', 'मूल संस्करण 1980 (स्कैन)')]], ['B21', 'Nectar of Devotion', 'SPS/DPS', [pdf('B21', 'PDF')]],
  ['B22', 'Sri Isopanisad', 'SPS/DPS', [pdf('B22', 'PDF')]], ['B23', 'Nectar of Instruction', 'SPS/DPS', [pdf('B23', 'PDF')]],
  ['B24', 'Teachings of Lord Caitanya', 'SPS/DPS', [pdf('B24', 'PDF')]], ['B25', 'Srila Prabhupada Lilamrta', 'SPS/DPS', vols('B25', ['Volume 1', 'Volume 2', 'Volume 3', 'Volume 4', 'Volume 5', 'Volume 6'])],
  ['B26', 'Krsna, the Supreme Personality of Godhead', 'SPS/DPS', [pdf('B26', 'PDF'), hpdf('B26-hi', 'PDF')]], ['B27', 'Transcendental Diary', 'SPS/DPS', vols('B27', ['Volume 1', 'Volume 2', 'Volume 3', 'Volume 4'])],
  ['B28', 'Dharma: The Way of Transcendence', 'SPS/DPS', [pdf('B28', 'PDF')]], ['B29', 'The Journey of Self-Discovery', 'SPS/DPS', [pdf('B29', 'PDF')]],
  ['B30', 'Srimad Bhagavatam Complete', 'BSS/BVS', [...vols('B30', Array.from({ length: 12 }, (_, i) => 'Canto ' + (i + 1))),
    hpdf('B30-h1', 'Canto 1 · Part 1'), hpdf('B30-h2', 'Canto 1 · Part 2'), hpdf('B30-h3', 'Canto 2'), hpdf('B30-h4', 'Canto 10 · Part 1')]],
  ['B31', 'Caitanya-caritamrta COMPLETE', 'BSS/BVS', [...vols('B31', ['Adi-lila', 'Madhya-lila', 'Antya-lila']),
    hpdf('B31-h1', 'आदि लीला · प्रथम खण्ड (अध्याय 1–7)'), hpdf('B31-h2', 'मध्य लीला · प्रथम खण्ड (अध्याय 1–6)')]],
  ['B32', 'Brahma-samhita', 'BSS/BVS', [pdf('B32', 'PDF')]], ['B33', 'Upadesamrta', 'BSS/BVS', []],
  // a canto in Hindi: two parts and its chapters (books.chapters), as the server's B59–B70 (19 Oct 2026)
  ['B34', 'Srimad Bhagavatam Canto 10', 'BSS/BVS', [pdf('B34', 'PDF'), hpdf('B34-h1', 'Part 1'), hpdf('B34-h2', 'Part 2')]],
].map(([bookId, title, level, files], i) => ({ bookId, title, level, words: 50000 + i * 9000, language: 'English', files, ...(HINDI[bookId] || {}) }));
const SLOTS = [['SPL', 'SPL'], ['GKGML', 'GKGML'], ['LOW1', 'LOW 1'], ['LOW2', 'LOW 2']];
const TOPICS = ['The soul is eternal', 'Chanting with attention', 'Association of devotees', 'Bhagavad-gita 2.13', 'Srimad-Bhagavatam 1.2.6',
  'Humility in service', 'Controlling the mind', 'The four regulative principles', 'Prabhupada pastimes', 'Ekadashi and its glories',
  'Tolerance like a tree', 'Hearing from the right source', 'Seva as worship', 'Simple living, high thinking'];
const SPEAKERS = { SPL: 'Srila Prabhupada', GKGML: 'HH Gopal Krishna Goswami', 'LOW 1': 'Class lecture', 'LOW 2': 'Seminar' };
const journalOf = (batchId) => (batchId === 'BSS' ? 'BSS' : batchId === 'BVS' ? 'BVS' : 'SPS/DPS');
// TRD is scored on its own card since Phase 22, as on the server (migration 0065: score_card 'TRD', COSATOK's TRD scheme)
const cardNameOf = (batchId) => (batchId === 'TRD' ? 'TRD' : ['SPS', 'SPS2', 'SPSO'].includes(batchId) ? 'SPS' : 'BVS/DPS/BSS');
function lecturesFor(journal) {
  const out = [];
  // 81 weeks x 4 slots: most lectures have their own Drive file, some only a folder (inFolder), a few no recording
  let n = 0;
  for (let w = 1; w <= 81; w++) for (const [code, slot] of SLOTS) {
    const lectureId = `${journal.slice(0, 2)}-W${String(w).padStart(3, '0')}-${code}`, k = n++;
    const audioUrl = k % 41 === 7 ? '' : k % 17 === 5 ? `https://drive.google.com/drive/folders/mock-${journal.slice(0, 2)}-w${w}` : `https://drive.google.com/file/d/mock-${lectureId}/view`;
    const l = { lectureId, journal, week: w, slot, title: `${TOPICS[k % TOPICS.length]} (${SPEAKERS[slot]})`, audioUrl };
    out.push(audioUrl.includes('/folders/') ? { ...l, inFolder: true } : l);
  }
  return out;
}

// ---- state ----
let drafts, subs, atts, missed, anns, annSeq, classWeeks;
const SEED_ANNS = [
  { title: 'Ekadashi kirtan this Saturday', body: 'Join us at 6 PM in the temple hall.\nBring a friend. Details: https://example.com/ekadashi.', audience: 'ALL', pinned: true, author: 'IYF Head', login: 'master', at: '2026-10-01T09:00:00+05:30' },
  { title: 'Sunday class timing changed', body: 'This Sunday the class starts at 10 AM, not 9.', audience: ['SPS'], pinned: false, author: 'SPS Team', login: 'sps', at: '2026-10-02T08:30:00+05:30' },
  { title: 'SPS Group 2 outing', body: 'We are visiting Vrindavan on the 18th. Please confirm by Friday.', audience: ['SPS2'], pinned: false, author: 'SPS Team', login: 'sps', at: '2026-09-30T18:00:00+05:30' },
  { title: 'DPS book distribution', body: 'Meet at the metro station gate 2 at 7 AM.', audience: ['DPS'], pinned: false, author: 'Meera Devi', login: 'meera', at: '2026-10-01T20:00:00+05:30' },
];
export function resetWeeks() {
  drafts = new Map(); subs = new Map(); atts = new Map(); missed = new Map(); classWeeks = new Map(); clock = null;
  annSeq = 0; anns = SEED_ANNS.map((a) => ({ id: ++annSeq, title: a.title, body: a.body, audience: a.audience, pinned: a.pinned, expiresAt: null, author: a.author, authorLogin: a.login, createdAt: a.at, updatedAt: a.at, removed: false }));
}
resetWeeks();
const dk = (login, w) => login + '|' + w;

/** Test helper: marks a week as missed or submitted from outside. */
export const _state = () => ({ drafts, subs, atts, missed, classWeeks });

// ---- weeks with no regular class (per batch): the coordinator's mark wins, then the class default, then the devotee's ----
export const classWeekOf = (batchId, weekId) => classWeeks.get(batchId + '|' + weekId) || null;
export const classDefault = (cw) => (!cw ? null : cw.everyonePresent ? 'P' : 'A');
// the levels (decision 41): IYF head > coordinator > group leader > no-class week > the devotee's own
export const markUsed = (att, cw) => att?.master || att?.coordinator || att?.leader || classDefault(cw) || att?.devotee || null;
export const markLevel = (att, cw) => (att?.master ? 'master' : att?.coordinator ? 'coordinator' : att?.leader ? 'leader' : classDefault(cw) ? 'class' : att?.devotee ? 'devotee' : null);
/** The attendance as the app gets it (week.get › attendance, week.setAttendance). */
export const attView = (att, cw) => ({ devotee: att?.devotee || null, leader: att?.leader || null, coordinator: att?.coordinator || null, master: att?.master || null,
  used: markUsed(att, cw), by: markLevel(att, cw), notice: att?.notice && att.devotee && markUsed(att, cw) !== att.devotee ? att.notice : null });
export { stateOf, missingOf as missingOfDay, cardNameOf, CARDS, weekScores, pickScores, chantingAverage };

// ---- validation (port of cleanDay / missingOf) ----
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const REQUIRED = ['sleptAt', 'wokeAt', 'rounds', 'chantingDoneAt', 'chantingSameDay', 'dayRestMin', 'hearingMin', 'readingMin', 'serviceMin'];
const LABEL = { sleptAt: 'Sleep time (previous night)', wokeAt: 'Wake-up time', rounds: 'Chanting rounds', chantingDoneAt: 'Chanting finished at',
  chantingSameDay: 'Completed the same day', dayRestMin: 'Day rest', hearingMin: 'Hearing minutes', hearing: 'Hearing topic',
  readingMin: 'Reading minutes', reading: 'Reading topic', serviceMin: 'Service minutes' };
const FIELDS = [...REQUIRED, 'hearing', 'reading', 'serviceTopic', 'exerciseMin', 'studyJobHrs', 'chetnaPositive', 'chetnaNegative', 'comment', ...TEMPLE_KEYS];
const TEMPLE_OK = TEMPLE_ANSWERS.map(([v]) => v);

function cleanDay(h, journal, patch, temple = false) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { err: h.fail('BAD_REQUEST', 'Bad day') };
  const out = {}, problems = [], bad = (k, m) => problems.push(['day.' + k, m]);
  for (const [k, v] of Object.entries(patch)) {
    if (!FIELDS.includes(k)) return { err: h.fail('BAD_REQUEST', 'Unknown field day.' + k) };
    if (v === null) { out[k] = null; continue; }
    // the temple activities (phase 21): only a batch with the flag, one of the three answers (worker/src/weeks.js)
    if (TEMPLE_KEYS.includes(k)) {
      if (!temple) bad(k, 'Temple activities are asked only in the Temple Residents batch.');
      else if (!TEMPLE_OK.includes(v)) bad(k, 'Choose On Time, Late or Absent.');
      else out[k] = v;
      continue;
    }
    switch (k) {
      case 'sleptAt': case 'wokeAt': case 'chantingDoneAt': if (!TIME.test(String(v))) bad(k, `${LABEL[k]}: choose a time.`); else out[k] = v; break;
      case 'rounds': if (!int(v, 0, 64)) bad(k, 'Rounds: a whole number from 0 to 64.'); else out[k] = v; break;
      case 'chantingSameDay': if (typeof v !== 'boolean') bad(k, 'Choose Yes or No.'); else out[k] = v; break;
      case 'dayRestMin': case 'hearingMin': case 'readingMin': case 'exerciseMin': if (!int(v, 0, 600)) bad(k, 'Minutes: a whole number from 0 to 600.'); else out[k] = v; break;
      case 'serviceMin': if (!int(v, 0, 999)) bad(k, 'Service minutes: a whole number from 0 to 999.'); else out[k] = v; break;
      case 'studyJobHrs': if (typeof v !== 'number' || v < 0 || v > 24 || Math.round(v * 2) !== v * 2) bad(k, 'Hours: 0 to 24, in half hours.'); else out[k] = v; break;
      case 'serviceTopic': if (typeof v !== 'string' || v.trim().length > 120) bad(k, 'At most 120 characters.'); else out[k] = v.trim(); break;
      case 'comment': if (typeof v !== 'string' || v.length > 500) bad(k, 'At most 500 characters.'); else out[k] = v.trim(); break;
      case 'hearing': {
        if (!Array.isArray(v) || v.length > 8) { bad(k, 'Choose the lectures you heard.'); break; }
        const ids = new Set(lecturesFor(journal).map((l) => l.lectureId)), list = [];
        for (const x of v) {
          if (x && typeof x.lectureId === 'string') { if (!ids.has(x.lectureId)) { bad(k, 'That lecture is not in your journal.'); break; } list.push({ lectureId: x.lectureId }); }
          else if (x && typeof x.text === 'string' && x.text.trim().length >= 2 && x.text.trim().length <= 120) list.push({ text: x.text.trim() });
          else { bad(k, 'Type the topic (2–120 characters), or pick a lecture.'); break; }
        }
        out[k] = list; break;
      }
      case 'reading':
        if (v && typeof v.bookId === 'string') { if (!BOOKS.some((b) => b.bookId === v.bookId)) bad(k, 'Unknown book.'); else out[k] = { bookId: v.bookId }; }
        else if (v && typeof v.text === 'string' && v.text.trim().length >= 2 && v.text.trim().length <= 120) out[k] = { text: v.text.trim() };
        else bad(k, 'Type the book (2–120 characters), or pick one.');
        break;
      case 'chetnaPositive': case 'chetnaNegative': {
        const allowed = k === 'chetnaPositive' ? CHETNA.positive : CHETNA.negative;
        if (!Array.isArray(v) || v.some((x) => !allowed.includes(x))) bad(k, 'Choose from the list.'); else out[k] = [...new Set(v)];
        break;
      }
    }
  }
  return problems.length ? { err: h.fieldFail(problems) } : { out };
}
export function missingOf(day) {
  const d = day || {}, miss = REQUIRED.filter((k) => d[k] === undefined || d[k] === null);
  if (d.hearingMin > 0 && !(Array.isArray(d.hearing) && d.hearing.length)) miss.push('hearing');
  if (d.readingMin > 0 && !d.reading) miss.push('reading');
  return miss;
}
const stateOf = (day) => { const n = Object.keys(day || {}).filter((k) => k !== 'v').length; return !n ? 'empty' : missingOf(day).length ? 'partial' : 'complete'; };
const chantingAverage = (days) => { const r = days.filter((x) => x && Number.isInteger(x.rounds)).map((x) => x.rounds); return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null; };
const SCORE_KEYS = ['bed', 'wake_up', 'day_sleep', 'japa', 'pathan', 'sravan', 'seva', 'attendance', 'body', 'soul', 'overall'];
// morning: the Morning program column, only on the TRD card (worker/src/weeks.js pickScores)
const pickScores = (s) => ({ ...Object.fromEntries(SCORE_KEYS.map((k) => [k, s[k]])), ...(s.morning !== undefined && s.morning !== null ? { morning: s.morning } : {}) });

function openWeeks(login, now) {
  const thisWeek = mondayOf(now), lastWeek = addDays(thisWeek, -7), out = [];
  if (now < closesOf(lastWeek)) out.push(lastWeek);
  out.push(thisWeek);
  return out;
}
function status(login, weekId) {
  if (subs.has(dk(login, weekId))) return { status: 'SUBMITTED', sub: subs.get(dk(login, weekId)) };
  if (missed.has(dk(login, weekId))) return { status: 'MISSED', missed: missed.get(dk(login, weekId)) };
  const draft = drafts.get(dk(login, weekId));
  return { status: draft ? 'DRAFT' : 'NOT_STARTED', draft };
}

function weekView(login, weekId, now, batchId, user = null, classDay = 'SUN') {
  const w = status(login, weekId), today = ymd(now), att = atts.get(dk(login, weekId)), cw = classWeekOf(batchId, weekId);
  const closes = closesOf(weekId), opens = opensOf(weekId);
  const days = DAY_NAMES.map((name, i) => {
    const date = addDays(weekId, i), day = w.draft?.d[i] || null;
    return { date, name, future: date > today, state: stateOf(day), version: day?.v || 0, day: day || {} };
  });
  const we = w.draft?.we || {};
  return {
    weekId, status: w.status, opensAt: isoIst(opens), closesAt: isoIst(closes),
    canSubmit: ['DRAFT', 'NOT_STARTED'].includes(w.status) && now >= opens && now < closes,
    days,
    weekEnd: { version: we.v || 0, nightStay: we.nightStay || null, principles: we.principles || null, opensAt: isoIst(weekEndOpens(weekId)), open: now >= weekEndOpens(weekId),
      state: we.nightStay && we.principles ? 'complete' : we.nightStay || we.principles ? 'partial' : 'missing' },
    attendance: { ...attView(att, cw), locked: !!att?.locked, classWeek: cw, opensAt: isoIst(attendanceOpens(weekId, classDay)) },
  };
}

export function installWeeks(A, h) {
  const templeOf = (batchId) => !!h.templeFor?.(batchId);
  const ANY = ['DEVOTEE', 'COORDINATOR', 'MASTER'], DEV = ANY;      // a person with a devotee scope (a batch of their own) may fill the form
  const devotee = (u) => (!u.batchId ? h.fail('FORBIDDEN', 'Only devotees have a weekly form.') : null);
  const draftOf = (u, weekId) => {
    const k = dk(u.login, weekId);
    if (!drafts.has(k)) drafts.set(k, { d: Array(7).fill(null), we: null });
    return drafts.get(k);
  };
  function editable(u, weekId) {
    if (!validWeekId(weekId)) return h.fieldFail([['weekId', 'Not a week.']]);
    const w = status(u.login, weekId);
    if (w.status === 'SUBMITTED') return h.fail('ALREADY_SUBMITTED', 'This week was already submitted.');
    if (w.status === 'MISSED' || !openWeeks(u.login, nowD()).includes(weekId)) return h.fail('WINDOW_CLOSED', 'This week is closed.');
    return null;
  }
  const allowed = (d, keys) => Object.keys(d).every((k) => k === '__token' || keys.includes(k));

  A['rules.get'] = [ANY, (d, u) => {
    const version = 'r1';
    if (!d.onBehalfOf && d.have !== undefined && d.have === version) return h.ok({ notModified: true, version });
    const name = cardNameOf(u.batchId);
    return h.ok({ version, cardName: name, cards: { [name]: CARDS[name] }, chetnaOptions: CHETNA, temple: templeOf(u.batchId) });
  }];
  // lectures picked in submitted weeks (home.get progress.heard; the server works it out from submissions)
  const mockHeard = (j) => lecturesFor(j).filter((l) => l.week <= 2 || l.lectureId.endsWith('W003-SPL')).map((l) => l.lectureId);
  // a book's chapters in one language, as worker/src/rules.js booksChapters (19 Oct 2026)
  A['books.chapters'] = [ANY, (d) => {
    const lang = String(d.lang || ''), bookId = String(d.bookId || '');
    if (!['en', 'hi'].includes(lang)) return h.fieldFail([['lang', 'English or Hindi.']]);
    if (!/^B\d{2,3}$/.test(bookId)) return h.fieldFail([['bookId', 'Not a book.']]);
    if (!BOOKS.some((b) => b.bookId === bookId)) return h.fail('NOT_FOUND', 'No such book.');
    return h.ok({ bookId, lang, chapters: (CHAPTERS[bookId + '|' + lang] || []).map((c) => ({ ...c })) });
  }];
  A['journals.get'] = [ANY, (d, u) => {
    const version = 'j1';
    if (!d.onBehalfOf && d.have !== undefined && d.have === version) return h.ok({ notModified: true, version });
    if (!u.batchId) return h.fail('FORBIDDEN', 'You are not in a batch yet.');
    const j = journalOf(u.batchId);
    return h.ok({ version, journals: [j], lectures: lecturesFor(j), books: BOOKS, ownBookLevel: j === 'SPS/DPS' ? 'SPS/DPS' : 'BSS/BVS',
      bookLink: 'https://drive.google.com/drive/folders/example', bookNote: 'Please buy the books from ISKCON outlets.',
      heard: mockHeard(j), ...(d.onBehalfOf ? { batchId: u.batchId, currentBookId: null } : {}) });
  }];

  // ---- announcement wall ----
  const myBatches = (sc) => [...(sc.devotee ? [sc.devotee.batchId] : []), ...sc.coordinator];
  // posts like social media (4 Oct 2026): likes per post (Set of logins), comments (array)
  const likesOf = (a) => (a.likes ||= new Set()), commentsOf = (a) => (a.cmts ||= []);
  // moderation (8 Oct 2026), as the server: reports, and people whose comments are hidden for one viewer or for everyone ('*')
  const reports = [], mutes = []; let modSeq = 0;
  const hiddenFor = (u) => new Set(mutes.filter((m) => m.viewer === u.login || m.viewer === '*').map((m) => m.author));
  const shownCmts = (a, u) => { const hid = hiddenFor(u); return commentsOf(a).filter((c) => !c.removed && (c.login === u.login || !hid.has(c.login))); };
  const social = (a, u) => ({ likes: likesOf(a).size, liked: likesOf(a).has(u.login), comments: shownCmts(a, u).length });
  // Phase 9 (items 8, 23), as the server: a facilitator's students 'STU:<facilitator id>' (Phase 24), SHOWN as 'STU:<their
  // name now>'; a post waits for publishAt
  const stuTag = (name) => 'STU:' + (h.facIdOf?.(name) || String(name || '').replace(/,/g, ';'));
  const stuShown = (x) => (String(x).startsWith('STU:') && h.facNameOf?.(x.slice(4)) ? 'STU:' + h.facNameOf(x.slice(4)).replace(/,/g, ';') : x);
  const myFac = (u) => (u.memberships || []).find((m) => !m.toWeek)?.facilitator || u.facilitator || '';
  const waits = (a) => !!a.publishAt && a.publishAt > isoIst(nowD());
  const shownAt = (a) => (a.publishAt && a.publishAt > a.createdAt ? a.publishAt : a.createdAt);
  const canPostAnn = (sc) => !!(sc.master || sc.coordinator.length || sc.facilitator);
  // the author's name as it is now (their account), the stored one only when it is gone (worker announcements.js)
  const annView = (a, u, sc) => ({ ...social(a, u), id: a.id, title: a.title, body: a.body, audience: sc.master || sc.coordinator.length || a.authorLogin === u.login ? (a.audience === 'ALL' ? 'ALL' : a.audience.map(stuShown)) : null, pinned: a.pinned, expiresAt: a.expiresAt,
    publishAt: a.publishAt || null, shownAt: shownAt(a), scheduled: waits(a), author: h.user?.(a.authorLogin)?.name || a.author, createdAt: a.createdAt, updatedAt: a.updatedAt, canEdit: a.authorLogin === u.login || sc.master, image: a.image ? { w: a.image.w, h: a.image.h, v: a.image.v } : null,
    // the reach (item 18), for its author and the head: the mock pretends every post has finished sending
    ...((a.authorLogin === u.login || sc.master) && !waits(a) ? { reach: { done: true, tried: 24, sent: 22, gone: 1, failed: 1, doneAt: shownAt(a) } } : {}) });
  // a picture as the server takes it: JPEG base64; the size is read from the JPEG header
  const annImg = (b64) => { try { const b = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); let i = 2; while (i + 9 < b.length) { const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3]; if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { b64, h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], v: isoIst(nowD()) }; i += 2 + len; } } catch { /* not a picture */ } return null; };
  const visibleAnns = (u, withScheduled = false) => {
    // facilitator audiences (9 Oct 2026): youth (a devotee who is a facilitator) and TRD (a facilitator login, no batch)
    const sc = h.scopesOf(u), mine = [...myBatches(sc), ...(sc.facilitator ? [sc.devotee ? 'FAC_YOUTH' : 'FAC_TRD'] : []), ...(sc.devotee && myFac(u) ? [stuTag(myFac(u))] : [])], now = isoIst(nowD());
    return anns.filter((a) => !a.removed && (!a.expiresAt || a.expiresAt > now) && (waits(a) ? withScheduled && (a.authorLogin === u.login || sc.master)
      : sc.master || a.authorLogin === u.login || a.audience === 'ALL' || a.audience.some((b) => mine.includes(b))))
      .sort((x, y) => (y.pinned - x.pinned) || (shownAt(x) < shownAt(y) ? 1 : -1));
  };
  const latestAnn = (u) => visibleAnns(u).reduce((m, a) => (shownAt(a) > m ? shownAt(a) : m), '') || null;
  const annAudience = (u, audience) => {
    const sc = h.scopesOf(u), stu = sc.facilitator ? stuTag(sc.facilitator.name) : '';
    if (Array.isArray(audience) && audience.some((x) => x === 'STUDENTS' || String(x).startsWith('STU:'))) {
      if (!stu) return { err: h.fail('FORBIDDEN', 'Only a facilitator can post to their students.') };
      if (audience.length !== 1 || !(audience[0] === 'STUDENTS' || audience[0] === stu || stuShown(audience[0]) === stuShown(stu))) return { err: h.fail('FORBIDDEN', 'A facilitator posts only to their own students, on their own.') };
      return { v: [stu] };
    }
    if (!sc.master && !sc.coordinator.length) return { err: h.fail('FORBIDDEN', 'A facilitator posts to their own students.') };
    if (audience === 'ALL') return sc.master ? { v: 'ALL' } : { err: h.fieldFail([['audience', 'Only a master can post to everyone. Choose your batch.']]) };
    if (!Array.isArray(audience) || !audience.length) return { err: h.fieldFail([['audience', 'Choose who should see it.']]) };
    const known = h.batchIds(), ids = [...new Set(audience.map(String))];
    for (const id of ids) {
      if (id === 'FAC_YOUTH' || id === 'FAC_TRD') { if (!sc.master) return { err: h.fail('FORBIDDEN', 'Only the IYF head can post to facilitators.') }; continue; }
      if (!known.includes(id)) return { err: h.fieldFail([['audience', `Unknown batch ${id}.`]]) };
      if (!sc.master && !sc.coordinator.includes(id)) return { err: h.fail('FORBIDDEN', `You can post only to the batches you coordinate (${id} is not one).`) };
    }
    return { v: ids };
  };
  function annText(d, partial) {
    const out = {}, problems = [];
    if (!partial || d.title !== undefined) { const t = String(d.title ?? '').replace(/\s+/g, ' ').trim(); if (t.length < 2 || t.length > 80) problems.push(['title', 'A title of 2 to 80 characters.']); else out.title = t; }
    if (!partial || d.body !== undefined) { const b = String(d.body ?? '').replace(/\r\n/g, '\n').trim(); if (b.length < 1 || b.length > 1000) problems.push(['body', 'Write the announcement (at most 1,000 characters).']); else out.body = b; }
    if (d.pinned !== undefined) { if (typeof d.pinned !== 'boolean') problems.push(['pinned', 'Yes or no.']); else out.pinned = d.pinned; }
    if (d.publishAt !== undefined) { if (d.publishAt === null || d.publishAt === '') out.publishAt = ''; else if (isNaN(Date.parse(d.publishAt))) problems.push(['publishAt', 'Choose a date and time.']); else out.publishAt = Date.parse(d.publishAt) <= nowD().getTime() ? '' : isoIst(new Date(d.publishAt)); }
    if (out.publishAt && Date.parse(out.publishAt) - nowD().getTime() > 60 * 864e5) problems.push(['publishAt', 'Choose a start within 60 days.']);
    if (d.expiresAt !== undefined) { if (d.expiresAt === null || d.expiresAt === '') out.expiresAt = null; else if (isNaN(Date.parse(d.expiresAt))) problems.push(['expiresAt', 'Choose a date and time.']); else out.expiresAt = isoIst(new Date(d.expiresAt)); }
    return problems.length ? { err: h.fieldFail(problems) } : { out };
  }
  const STAFF = ['COORDINATOR', 'MASTER'];
  const endBad = (start, end) => { if (!end) return null; const from = Math.max(start ? Date.parse(start) : 0, nowD().getTime()); return Date.parse(end) <= from ? 'The end must be after the start.' : Date.parse(end) - from > 90 * 864e5 ? 'Show it for at most 90 days.' : null; };
  A['announcements.list'] = [ANY, (d, u) => { const l = visibleAnns(u, true), sc = h.scopesOf(u); return h.ok({ announcements: l.map((a) => annView(a, u, sc)), latestAt: latestAnn(u), canReport: true, canPost: canPostAnn(sc) }); }];
  A['announcements.create'] = [ANY, (d, u) => {
    if (!canPostAnn(h.scopesOf(u))) return h.fail('FORBIDDEN', 'You do not have access to this.');
    const t = annText(d, false); if (t.err) return t.err;
    const au = annAudience(u, d.audience); if (au.err) return au.err;
    const eb = endBad(t.out.publishAt, t.out.expiresAt); if (eb) return h.fieldFail([['expiresAt', eb]]);
    const now = isoIst(nowD()), a = { id: ++annSeq, title: t.out.title, body: t.out.body, audience: au.v, pinned: !!t.out.pinned, expiresAt: t.out.expiresAt || null, publishAt: t.out.publishAt || '', author: u.name, authorLogin: u.login, createdAt: now, updatedAt: now, removed: false };
    if (d.image) { a.image = annImg(d.image); if (!a.image) return h.fieldFail([['image', 'That is not a picture.']]); }
    anns.push(a);
    return h.ok({ announcement: annView(a, u, h.scopesOf(u)) });
  }];
  const editableAnn = (u, id) => {
    const a = anns.find((x) => x.id === Number(id) && !x.removed);
    if (!a) return { err: h.fail('NOT_FOUND', 'That announcement is not there any more.') };
    if (a.authorLogin !== u.login && !h.scopesOf(u).master) return { err: h.fail('FORBIDDEN', 'Only its author or a master can change it.') };
    return { a };
  };
  A['announcements.update'] = [ANY, (d, u) => {
    const e = editableAnn(u, d.id); if (e.err) return e.err;
    const t = annText(d, true); if (t.err) return t.err;
    const patchA = { ...t.out };
    if (patchA.publishAt !== undefined && !waits(e.a)) { if (patchA.publishAt) return h.fieldFail([['publishAt', 'This post is already on the wall.']]); delete patchA.publishAt; }
    if ((patchA.expiresAt !== undefined && patchA.expiresAt !== e.a.expiresAt) || patchA.publishAt !== undefined) { const eb = endBad(patchA.publishAt ?? e.a.publishAt, patchA.expiresAt === undefined ? e.a.expiresAt : patchA.expiresAt); if (eb) return h.fieldFail([['expiresAt', eb]]); }
    if (d.audience !== undefined) { const au = annAudience(u, d.audience); if (au.err) return au.err; patchA.audience = au.v; }
    if (!Object.keys(patchA).length && d.image === undefined) return h.fieldFail([['id', 'Nothing to change.']]);
    if (d.image === null) e.a.image = null; else if (d.image) { e.a.image = annImg(d.image); if (!e.a.image) return h.fieldFail([['image', 'That is not a picture.']]); }
    Object.assign(e.a, patchA, { updatedAt: isoIst(nowD()) });
    return h.ok({ announcement: annView(e.a, u, h.scopesOf(u)) });
  }];
  // one post by id, for a shared link to a post older than the wall's page (audit FE-17)
  A['announcements.get'] = [ANY, (d, u) => { const a = visibleAnns(u, true).find((x) => x.id === Number(d.id));
    return a ? h.ok({ announcement: annView(a, u, h.scopesOf(u)), canReport: true }) : h.fail('NOT_FOUND', 'That announcement is not there any more.'); }];
  A['announcements.image'] = [ANY, (d, u) => { const a = visibleAnns(u, true).find((x) => x.id === Number(d.id)); return a?.image ? h.ok({ jpegBase64: a.image.b64, v: a.image.v }) : h.fail('NOT_FOUND', 'No picture.'); }];
  const seenAnn = (u, id) => visibleAnns(u).find((a) => a.id === Number(id));
  A['announcements.like'] = [ANY, (d, u) => { const a = seenAnn(u, d.id); if (!a) return h.fail('NOT_FOUND', 'That post is not there any more.'); if (d.like) likesOf(a).add(u.login); else likesOf(a).delete(u.login); return h.ok(social(a, u)); }];
  const cmtView = (c, u, a) => ({ id: c.id, name: h.user?.(c.login)?.name || c.name, body: c.body, at: c.at, mine: c.login === u.login, canRemove: c.login === u.login || a.authorLogin === u.login || u.role === 'MASTER' });
  A['announcements.comments'] = [ANY, (d, u) => { const a = seenAnn(u, d.id); if (!a) return h.fail('NOT_FOUND', 'That post is not there any more.'); return h.ok({ comments: shownCmts(a, u).map((c) => cmtView(c, u, a)), canReport: true, commentsBlocked: mutes.some((m) => m.viewer === '*' && m.author === u.login) }); }];
  A['announcements.comment'] = [ANY, (d, u) => {
    const a = seenAnn(u, d.id); if (!a) return h.fail('NOT_FOUND', 'That post is not there any more.');
    if (mutes.some((m) => m.viewer === '*' && m.author === u.login)) return h.fail('COMMENTS_BLOCKED', 'Comments are turned off for your account. Contact your coordinator.');
    const body = String(d.body || '').trim(); if (!body || body.length > 500) return h.fieldFail([['body', 'Write a comment of at most 500 characters.']]);
    const c = { id: Date.now() + Math.floor(Math.random() * 1000), login: u.login, name: u.name, body, at: isoIst(nowD()) }; commentsOf(a).push(c);
    return h.ok({ comment: cmtView(c, u, a), ...social(a, u) });
  }];
  A['announcements.uncomment'] = [ANY, (d, u) => {
    for (const a of visibleAnns(u)) { const c = commentsOf(a).find((x) => x.id === Number(d.commentId) && !x.removed); if (!c) continue;
      if (!(c.login === u.login || a.authorLogin === u.login || u.role === 'MASTER')) return h.fail('FORBIDDEN', "Only its writer, the post's author or the IYF head can remove a comment.");
      c.removed = true; return h.ok(social(a, u)); }
    return h.fail('NOT_FOUND', 'That comment is not there any more.');
  }];
  A['announcements.remove'] = [ANY, (d, u) => { const e = editableAnn(u, d.id); if (e.err) return e.err; e.a.removed = true; return h.ok({ removed: e.a.id }); }];
  const findCmt = (u, id) => { for (const a of visibleAnns(u)) { const c = commentsOf(a).find((x) => x.id === Number(id) && !x.removed); if (c) return { a, c }; } return null; };
  A['announcements.report'] = [ANY, (d, u) => {
    const a = seenAnn(u, d.id); if (!a) return h.fail('NOT_FOUND', 'That post is not there any more.');
    const cid = d.commentId ? Number(d.commentId) : 0, c = cid ? commentsOf(a).find((x) => x.id === cid && !x.removed) : null;
    if (cid && !c) return h.fail('NOT_FOUND', 'That comment is not there any more.');
    if ((c ? c.login : a.authorLogin) === u.login) return h.fail('CONFLICT', 'You cannot report your own post or comment.');
    if (!['spam', 'abusive', 'inappropriate', 'other'].includes(d.reason)) return h.fieldFail([['reason', 'Choose a reason.']]);
    const note = String(d.note || '').replace(/\s+/g, ' ').trim(); if (note.length > 200) return h.fieldFail([['note', 'At most 200 characters.']]);
    if (!reports.some((r) => r.annId === a.id && r.commentId === cid && r.reporter === u.login)) reports.push({ id: ++modSeq, annId: a.id, commentId: cid, reporter: u.login, reason: d.reason, note, at: isoIst(nowD()), state: 'OPEN' });
    return h.ok({ reported: true });
  }];
  A['announcements.reports'] = [['MASTER'], () => {
    const g = new Map();
    for (const r of reports.filter((x) => x.state === 'OPEN')) {
      const key = r.commentId ? 'c' + r.commentId : 'p' + r.annId, a = anns.find((x) => x.id === r.annId), c = r.commentId ? commentsOf(a).find((x) => x.id === r.commentId) : null;
      const it = g.get(key) || { key, reportIds: [], kind: r.commentId ? 'comment' : 'post', postId: r.annId, commentId: r.commentId || null, excerpt: (c ? c.body : `${a.title} — ${a.body}`).slice(0, 140),
        authorName: c ? c.name : a.author, count: 0, reasons: [], notes: [], firstAt: r.at, lastAt: r.at, removed: !!(c ? c.removed : a.removed) };
      it.reportIds.push(r.id); it.count++; if (!it.reasons.includes(r.reason)) it.reasons.push(r.reason); if (r.note) it.notes.push(r.note); it.lastAt = r.at; g.set(key, it);
    }
    const list = [...g.values()].sort((x, y) => (x.lastAt < y.lastAt ? 1 : -1));
    return h.ok({ reports: list, total: list.length });
  }];
  A['announcements.resolve'] = [['MASTER'], (d) => {
    if (!['dismiss', 'remove'].includes(d.action)) return h.fieldFail([['action', 'Dismiss or remove.']]);
    const cid = d.commentId ? Number(d.commentId) : 0, open = reports.filter((r) => r.state === 'OPEN' && r.annId === Number(d.postId) && (cid ? r.commentId === cid : true) && (cid || d.action === 'remove' || r.commentId === 0));
    if (!open.length) return h.fail('NOT_FOUND', 'There are no open reports about that.');
    if (d.action === 'remove') { const a = anns.find((x) => x.id === Number(d.postId)); if (cid) { const c = commentsOf(a).find((x) => x.id === cid); if (c) c.removed = true; } else if (a) a.removed = true; }
    for (const r of open) r.state = d.action === 'remove' ? 'REMOVED' : 'DISMISSED';
    return h.ok({ action: d.action, closed: open.length });
  }];
  const muteView = (m) => ({ key: String(m.id), name: h.nameOf(m.author) || 'Someone', at: m.at });
  function setMute(u, d, viewer) {
    if (typeof d.mute !== 'boolean') return h.fieldFail([['mute', 'Yes or no.']]);
    let author = null;
    if (d.commentId) { const f = findCmt(u, d.commentId); if (!f) return h.fail('NOT_FOUND', 'That comment is not there any more.'); author = f.c.login; }
    else { const m = mutes.find((x) => String(x.id) === String(d.key)); if (!m) return d.mute ? h.fail('NOT_FOUND', 'Not found.') : h.ok({ muted: false, key: null, name: null }); author = m.author; }
    if (author === u.login) return h.fail('CONFLICT', 'You cannot hide your own comments.');
    const i = mutes.findIndex((x) => x.viewer === viewer && x.author === author);
    if (d.mute && i < 0) mutes.push({ id: ++modSeq, viewer, author, by: u.login, at: isoIst(nowD()) });
    if (!d.mute && i >= 0) mutes.splice(i, 1);
    const m = mutes.find((x) => x.viewer === viewer && x.author === author);
    return h.ok({ muted: d.mute, key: m ? String(m.id) : null, name: h.nameOf(author) || 'Someone' });
  }
  A['mutes.set'] = [ANY, (d, u) => setMute(u, d, u.login)];
  A['mutes.setAll'] = [['MASTER'], (d, u) => setMute(u, d, '*')];
  A['mutes.list'] = [ANY, (d, u) => h.ok({ mutes: mutes.filter((m) => m.viewer === u.login).map(muteView), ...(u.role === 'MASTER' ? { everyone: mutes.filter((m) => m.viewer === '*').map((m) => ({ ...muteView(m), by: h.nameOf(m.by) || '' })) } : {}) })];
  // B4, as the server: a sample is kept (the app never sends one to the mock, but the shape is the same)
  A['vitals.report'] = [ANY, (d) => (['fcp', 'lcp', 'inp', 'cls'].some((k) => typeof d[k] === 'number') ? h.ok({ kept: true }) : h.fieldFail([['lcp', 'No timings.']]))];
  A['books.setCurrent'] = [ANY, (d, u) => { const who = d.onBehalfOf ? h.user(d.onBehalfOf) : u; if (who) who.currentBookId = d.bookId || null; return h.ok({ currentBookId: d.bookId || null }); }];

  A['home.get'] = [DEV, (d, u) => ok0(h, {
    profile: { login: u.login, iyfId: u.iyfId || null, name: u.name, batchId: u.batchId || null },
    // the same object auth.me returns (worker weeks.js:303), so a repeat open can be one call instead of two.
    // The mock must be the server: without this the browser checks would prove the wrong thing.
    user: h.userView?.(u),
    weeks: openWeeks(u.login, nowD()).map((w) => weekView(u.login, w, nowD(), u.batchId, u, readDay(h.classDayFor?.(u.batchId)))),
    versions: { rules: 'r1', journals: 'j1', names: h.namesV?.() },
    progress: { currentBookId: null, heard: u.batchId ? mockHeard(journalOf(u.batchId)) : [] },
    latestAnnouncementAt: latestAnn(u),
    announcementTimes: visibleAnns(u).map((a) => a.createdAt).sort().reverse().slice(0, 10),   // 8 Oct 2026: the bell counts the same on every screen
    // batch-mates born today, by name only (worker homeGet, 27 Oct 2026); self: their own birthday
    birthdays: u.batchId ? (h.birthdaysIn?.(u.batchId, birthdayDays(nowD())) || []).map((r) => ({ name: r.name, self: r.login === u.login })) : [],
  })];

  A['week.get'] = [ANY, (d, u) => {
    const f = devotee(u); if (f) return f;
    if (!allowed(d, ['weekId', 'onBehalfOf'])) return h.fail('BAD_REQUEST', 'Something went wrong');
    if (!validWeekId(d.weekId)) return h.fieldFail([['weekId', 'Not a week.']]);
    const w = status(u.login, d.weekId);
    if (w.status === 'SUBMITTED') {
      const s = w.sub;
      return h.ok({ weekId: d.weekId, status: 'SUBMITTED', submittedAt: s.submittedAt, daysFilled: s.daysFilled ?? 7, days: s.days, marks: s.marks,
        weekEnd: { nightStay: s.nightStay, principles: s.principles, chantingAverage: s.avgRounds }, scores: s.scores });
    }
    if (w.status === 'MISSED') return h.ok({ weekId: d.weekId, status: 'MISSED', daysFilled: w.missed.daysFilled, overall: 0 });
    if (!openWeeks(u.login, nowD()).includes(d.weekId)) return h.fail('NOT_FOUND', 'Nothing was filled for that week.');
    return h.ok(weekView(u.login, d.weekId, nowD(), u.batchId, u, readDay(h.classDayFor?.(u.batchId))));
  }];

  A['week.saveDay'] = [ANY, (d, u) => {
    const f = devotee(u); if (f) return f;
    if (!allowed(d, ['weekId', 'date', 'version', 'day', 'onBehalfOf'])) return h.fail('BAD_REQUEST', 'Something went wrong');
    const e = editable(u, d.weekId); if (e) return e;
    const i = DAY_NAMES.findIndex((_, k) => addDays(d.weekId, k) === d.date);
    if (i < 0) return h.fieldFail([['date', 'That day is not in this week.']]);
    if (d.date > ymd(nowD())) return h.fail('FUTURE_DAY', 'A day can be filled from that day onwards.');
    if (!Number.isInteger(d.version) || d.version < 0) return h.fieldFail([['version', 'Missing version.']]);
    const c = cleanDay(h, journalOf(u.batchId), d.day, templeOf(u.batchId)); if (c.err) return c.err;
    const draft = draftOf(u, d.weekId), cur = draft.d[i] || { v: 0 };
    if (cur.v !== d.version) return h.fail('STALE', 'This day was updated on another device.', { data: { current: cur } });
    const next = { ...cur, ...c.out, v: cur.v + 1 };
    for (const k of Object.keys(next)) if (next[k] === null) delete next[k];
    draft.d[i] = next;
    return h.ok({ version: next.v, state: stateOf(next), missing: missingOf(next), marks: dayMarks(CARDS[cardNameOf(u.batchId)], next) });
  }];

  A['week.saveWeekEnd'] = [ANY, (d, u) => {
    const f = devotee(u); if (f) return f;
    if (!allowed(d, ['weekId', 'version', 'nightStay', 'principles', 'onBehalfOf'])) return h.fail('BAD_REQUEST', 'Something went wrong');
    const e = editable(u, d.weekId); if (e) return e;
    const problems = [];
    for (const k of ['nightStay', 'principles']) if (d[k] !== undefined && !['YES', 'NO'].includes(d[k])) problems.push([k, 'Choose Yes or No.']);
    if (problems.length) return h.fieldFail(problems);
    if (nowD() < weekEndOpens(d.weekId)) return h.fail('FUTURE_DAY', 'Night Stay and the 4 regulative principles open on Saturday at 6 PM.');
    if (!Number.isInteger(d.version) || d.version < 0) return h.fieldFail([['version', 'Missing version.']]);
    const draft = draftOf(u, d.weekId), cur = draft.we || { v: 0 };
    if (cur.v !== d.version) return h.fail('STALE', 'Updated on another device.', { data: { current: cur } });
    const next = { ...cur, v: cur.v + 1 };
    if (d.nightStay !== undefined) next.nightStay = d.nightStay;
    if (d.principles !== undefined) next.principles = d.principles;
    draft.we = next;
    return h.ok({ version: next.v, chantingAverage: chantingAverage(draft.d) });
  }];

  A['week.setAttendance'] = [DEV, (d, u) => {
    if (!allowed(d, ['weekId', 'mark'])) return h.fail('BAD_REQUEST', 'Something went wrong');
    if (!validWeekId(d.weekId)) return h.fieldFail([['weekId', 'Not a week.']]);
    if (!['P', 'A'].includes(d.mark)) return h.fieldFail([['mark', 'Choose Present or Absent.']]);
    const now = nowD();
    if (now >= closesOf(d.weekId) || !openWeeks(u.login, now).includes(d.weekId)) return h.fail('WINDOW_CLOSED', 'Attendance for this week is closed.');
    const cd = readDay(h.classDayFor?.(u.batchId));
    if (now < attendanceOpens(d.weekId, cd)) return h.fail('FUTURE_DAY', `Mark attendance after the ${DAY_NAME[cd]} class.`);
    const cw = classWeekOf(u.batchId, d.weekId);
    if (cw) return h.fail('CONFLICT', `No regular class this week (${cw.note}): your coordinator gives attendance.`);
    const a = atts.get(dk(u.login, d.weekId)) || {};
    if (!a.locked) a.devotee = d.mark;
    atts.set(dk(u.login, d.weekId), a);
    return h.ok(attView(a, null));
  }];

  A['week.submit'] = [ANY, (d, u) => {
    const f = devotee(u); if (f) return f;
    if (!allowed(d, ['weekId', 'onBehalfOf'])) return h.fail('BAD_REQUEST', 'Something went wrong');
    const e = editable(u, d.weekId); if (e) return e;
    const now = nowD();
    // the same sentence the server gives, from the same setting (shared/window.js); never literal text
    if (now < opensOf(d.weekId)) return h.fail('WINDOW_CLOSED', windowWords(windowSpecs()).fromSentence);
    if (now >= closesOf(d.weekId)) return h.fail('WINDOW_CLOSED', 'This week is closed.');
    const draft = drafts.get(dk(u.login, d.weekId)) || { d: Array(7).fill(null), we: null }, we = draft.we || {};
    const att = atts.get(dk(u.login, d.weekId));
    const used = markUsed(att, classWeekOf(u.batchId, d.weekId));
    const gaps = [];
    // a part week is an option (4 Oct 2026): the complete days count (at least one); a day not filled scores 0
    if (!draft.d.some((day) => stateOf(day) === 'complete')) gaps.push({ path: 'days', message: 'Fill at least one whole day' });
    if (!we.nightStay) gaps.push({ path: 'weekEnd.nightStay', message: 'Night Stay missing' });
    if (!we.principles) gaps.push({ path: 'weekEnd.principles', message: '4 regulative principles missing' });
    if (!used) gaps.push({ path: 'attendance', message: 'Attendance: mark Present or Absent' });
    if (gaps.length) return h.fail('INCOMPLETE', `${gaps.length} answer${gaps.length === 1 ? ' is' : 's are'} missing.`, { fields: gaps });
    const clean = draft.d.map((day) => { if (stateOf(day) !== 'complete') return {}; const { v, ...rest } = day; return rest; });
    const daysFilled = clean.filter((x) => Object.keys(x).length).length;
    const s = weekScores(CARDS[cardNameOf(u.batchId)], clean, used, clean.reduce((a, x) => a + (x.serviceMin || 0), 0));
    const at = isoIst(now);
    subs.set(dk(u.login, d.weekId), { submittedAt: at, days: clean, marks: s.marks, daysFilled, nightStay: we.nightStay, principles: we.principles, avgRounds: chantingAverage(clean), scores: pickScores(s) });
    drafts.delete(dk(u.login, d.weekId));
    return h.ok({ submittedAt: at, scores: pickScores(s), daysFilled });
  }];

  A['history.list'] = [ANY, (d, u) => {
    const f = devotee(u); if (f) return f;
    const limit = d.limit === undefined ? 8 : d.limit;
    if (!int(limit, 1, 26)) return h.fieldFail([['limit', '1 to 26.']]);
    if (d.before !== undefined && !validWeekId(d.before)) return h.fieldFail([['before', 'Not a week.']]);
    const before = d.before || '9999-12-31';
    const rows = [];
    // dayPct: the seven days' percentages travel with the history, so the Report calendar needs no week.get per
    // week (roadmap 5.4). The server computes this in SQL from the stored marks; here from the same marks.
    const pctOf = (s) => (s.marks || []).map((m) => (m && Object.keys(m).length ? dayPercent(m).percent : 0));
    for (const [k, s] of subs) { const [l, w] = k.split('|'); if (l === u.login && w < before) rows.push({ weekId: w, status: 'SUBMITTED', overall: s.scores.overall, body: s.scores.body, soul: s.scores.soul, attendance: s.scores.attendance, seva: s.scores.seva, daysFilled: s.daysFilled ?? 7, dayPct: pctOf(s) }); }
    // a missed week scores 0 (4 Oct 2026)
    for (const [k, m] of missed) { const [l, w] = k.split('|'); if (l === u.login && w < before) rows.push({ weekId: w, status: 'MISSED', overall: 0, body: 0, soul: 0, attendance: 0, seva: 0, daysFilled: m?.daysFilled ?? 0 }); }
    rows.sort((a, b) => (a.weekId < b.weekId ? 1 : -1));
    return h.ok({ weeks: rows.slice(0, limit), more: rows.length > limit });
  }];
}
const ok0 = (h, data) => h.ok(data);
