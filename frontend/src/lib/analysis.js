// Admin › Analysis (phase 21): the head's measures, worked out from the weekly SUMS analysis.get sends (batch_weeks).
// Pure: no I/O. A measure's figure over any set of rows is its summed numerator over its summed denominator, so a
// period, a batch, or all of IYF is the same sum — never an average of averages.

const avg = (n, d) => (d > 0 ? n / d : null);
/** Each measure: its label, its unit, how many digits, and its figure from summed rows (null when nothing to measure). */
export const METRICS = [
  { key: 'rounds', label: 'Chanting', unit: ' rounds', digits: 1, of: (s) => avg(s.rounds, s.nRounds), word: 'chanting', what: 'rounds a day' },
  { key: 'reading', label: 'Reading', unit: ' min', digits: 0, of: (s) => avg(s.reading, s.submitted * 7), word: 'reading', what: 'minutes a day' },
  { key: 'hearing', label: 'Hearing', unit: ' min', digits: 0, of: (s) => avg(s.hearing, s.submitted * 7), word: 'hearing', what: 'minutes a day' },
  { key: 'seva', label: 'Seva', unit: ' min', digits: 0, of: (s) => avg(s.seva, s.submitted * 7), word: 'seva', what: 'minutes a day' },
  { key: 'night', label: 'Night stay', unit: '%', digits: 0, pct: true, of: (s) => avg(s.night * 100, s.submitted), word: 'night stay', what: 'of weeks' },
  { key: 'principles', label: '4 principles', unit: '%', digits: 0, pct: true, of: (s) => avg(s.principles * 100, s.submitted), word: 'the four principles', what: 'of weeks' },
  { key: 'overall', label: 'Sadhana score', unit: '%', digits: 0, pct: true, of: (s) => avg(s.overall, s.submitted), word: 'the sadhana score', what: '' },
  { key: 'body', label: 'Body', unit: '%', digits: 0, pct: true, of: (s) => avg(s.body, s.submitted), word: 'body', what: '' },
  { key: 'soul', label: 'Soul', unit: '%', digits: 0, pct: true, of: (s) => avg(s.soul, s.submitted), word: 'soul', what: '' },
  { key: 'bed', label: 'To bed', unit: '%', digits: 0, pct: true, of: (s) => avg(s.bed, s.submitted), word: 'the to-bed score', what: '' },
  { key: 'wake', label: 'Wake-up', unit: '%', digits: 0, pct: true, of: (s) => avg(s.wake, s.submitted), word: 'the wake-up score', what: '' },
  // the Morning program (TRD, Phase 22): Mangal Aarti, Morning Class, Darshan Aarti, Prasadam, as a score; only a batch
  // scored on it has a figure (`optional`: its tile shows only then)
  { key: 'morning', label: 'Morning program', unit: '%', digits: 0, pct: true, optional: true, of: (s) => avg(s.morning, s.nMorning), word: 'the morning program', what: '' },
  { key: 'attendance', label: 'Class attendance', unit: '%', digits: 0, pct: true, of: (s) => avg(s.present * 100, s.held), word: 'class attendance', what: '' },
  { key: 'filling', label: 'Submitted', unit: '%', digits: 0, pct: true, of: (s) => avg(s.submitted * 100, s.submitted + s.missed), word: 'weeks submitted', what: '' },
];
/** The measures with a tile for these rows: an optional one (the Morning program) only where some row has it. */
export const metricsFor = (rows) => METRICS.filter((m) => !m.optional || m.of(sumRows(rows)) !== null);
export const metric = (key) => METRICS.find((m) => m.key === key) || METRICS[0];
const FIELDS = ['submitted', 'missed', 'overall', 'body', 'soul', 'bed', 'wake', 'nRounds', 'rounds', 'reading', 'hearing', 'seva', 'night', 'principles', 'present', 'held', 'nMorning', 'morning'];
/** The rows' sums added together. */
export function sumRows(rows) {
  const s = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  for (const r of rows) for (const f of FIELDS) s[f] += Number(r[f]) || 0;
  return s;
}
/** A measure's figure over these rows. */
export const figureOf = (key, rows) => metric(key).of(sumRows(rows));
export const fmtFig = (key, v) => { const m = metric(key); return v === null || v === undefined ? '—' : (m.digits ? v.toFixed(m.digits) : Math.round(v)) + m.unit; };

const plusDays = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

/**
 * The period's weeks [from, to] (Mondays) and the previous period of the same length, from a choice:
 *   4w / 12w / 52w  the last N closed weeks · phase: a phase's weeks so far · custom: from–to dates
 */
export function periodOf(choice, lastClosed, { phase = null, from = '', to = '' } = {}) {
  let a, b = lastClosed;
  if (choice === 'phase' && phase) { a = mondayOf(phase.startsOn); b = phase.endsOn < lastClosed ? mondayOf(phase.endsOn) : lastClosed; }
  else if (choice === 'custom' && from && to) { a = mondayOf(from); b = mondayOf(to) < lastClosed ? mondayOf(to) : lastClosed; }
  else { const n = choice === '52w' ? 52 : choice === '12w' ? 12 : 4; a = plusDays(lastClosed, -7 * (n - 1)); }
  const n = Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / (7 * 864e5)) + 1);
  return { from: a, to: b, weeks: n, prevFrom: plusDays(a, -7 * n), prevTo: plusDays(a, -7) };
}
export const mondayOf = (ymd) => { const d = new Date(ymd + 'T00:00:00Z'); return plusDays(ymd, -((d.getUTCDay() + 6) % 7)); };

/** One series per batch (and all of IYF first) of a measure, week by week, over the period. */
export function seriesOf(key, rows, weeks, batchIds) {
  const by = (pred) => weeks.map((w) => figureOf(key, rows.filter((r) => r.weekId === w && pred(r))));
  const all = { key: 'all', label: batchIds.length > 1 ? 'All' : '', values: by((r) => batchIds.includes(r.batchId)) };
  return batchIds.length > 1 ? [all, ...batchIds.map((id) => ({ key: id, values: by((r) => r.batchId === id) }))] : [{ ...all, key: batchIds[0] || 'all' }];
}

/**
 * The plain-sentence report (as the facilitator dashboard's "Going well / Needs attention"): for each batch and each
 * of the measures, this period against the previous one; the biggest moves first. A measure needs figures in both.
 */
export function movements(rows, batches, period, keys = ['rounds', 'reading', 'hearing', 'night', 'principles', 'morning', 'attendance', 'filling', 'overall']) {
  const cur = rows.filter((r) => r.weekId >= period.from && r.weekId <= period.to), prev = rows.filter((r) => r.weekId >= period.prevFrom && r.weekId <= period.prevTo);
  const out = [];
  for (const b of batches) {
    for (const k of keys) {
      const a = figureOf(k, prev.filter((r) => r.batchId === b.batchId)), z = figureOf(k, cur.filter((r) => r.batchId === b.batchId));
      if (a === null || z === null) continue;
      const m = metric(k), change = z - a, rel = m.pct ? change / 100 : a ? change / a : 0;
      // a move smaller than this is noise: a tenth of a round, 2 minutes, 3 percentage points
      const floor = k === 'rounds' ? 0.3 : m.pct ? 3 : 2;
      if (Math.abs(change) < floor) continue;
      out.push({ batchId: b.batchId, name: b.name, key: k, from: a, to: z, change, rel, up: change > 0,
        text: `${b.name}: ${m.word} ${change > 0 ? 'rose' : 'fell'} from ${fmtFig(k, a)} to ${fmtFig(k, z)}` });
    }
  }
  return out.sort((x, y) => Math.abs(y.rel) - Math.abs(x.rel));
}
