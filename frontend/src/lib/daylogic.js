// Which answers a day still needs, mirroring the server (worker/src/weeks.js missingOf / stateOf).
export const REQUIRED = ['sleptAt', 'wokeAt', 'rounds', 'chantingDoneAt', 'chantingSameDay', 'dayRestMin', 'hearingMin', 'readingMin', 'serviceMin'];
export const LABELS = {
  sleptAt: 'Sleep time (previous night)', wokeAt: 'Wake-up time', rounds: 'Chanting rounds', chantingDoneAt: 'Chanting finished at',
  chantingSameDay: 'Completed the same day', dayRestMin: 'Day rest', hearingMin: 'Hearing minutes', hearing: 'Hearing topic',
  readingMin: 'Reading minutes', reading: 'Reading topic', serviceMin: 'Service minutes',
};

export function missingOf(day) {
  const d = day || {};
  const miss = REQUIRED.filter((k) => d[k] === undefined || d[k] === null);
  if (d.hearingMin > 0 && !(Array.isArray(d.hearing) && d.hearing.length)) miss.push('hearing');
  if (d.readingMin > 0 && !d.reading) miss.push('reading');
  return miss;
}
export function stateOf(day) {
  const n = Object.keys(day || {}).filter((k) => k !== 'v').length;
  return !n ? 'empty' : missingOf(day).length ? 'partial' : 'complete';
}
export const stripV = (day) => { const { v, ...rest } = day || {}; return rest; };

// Applies a saved patch (null clears) to a day object.
export function applyPatch(day, patch) {
  const out = { ...day };
  for (const [k, v] of Object.entries(patch)) { if (v === null) delete out[k]; else out[k] = v; }
  return out;
}
