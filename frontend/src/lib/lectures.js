// Lecture list logic shared by Hearing (Learn) and the day form's picker: filters, the open link, the hash query.
export const SLOTS = ['SPL', 'GKGML', 'LOW 1', 'LOW 2'];

/** What tapping a lecture opens: its own Drive file, its Drive folder (pick the file there), or nothing. */
export function lectureLink(l) {
  const url = l?.audioUrl || '';
  if (!/^https:\/\//.test(url)) return { kind: 'none', url: '' };
  return { kind: l.inFolder ? 'folder' : 'file', url };
}

/** The journal weeks present in the list, in order. */
export const weeksOf = (lectures) => [...new Set(lectures.map((l) => l.week))].sort((a, b) => a - b);

/**
 * Filters: week (number or ''), slot ('' or one of SLOTS), q (words in the title, all must match),
 * heard ('' | 'yes' | 'no'). With no filter the whole journal comes back, in journal order.
 */
export function filterLectures(lectures, f = {}, heard = []) {
  const h = new Set(heard);
  const week = f.week === '' || f.week === undefined || f.week === null ? null : Number(f.week);
  const terms = String(f.q || '').toLowerCase().split(/\s+/).filter(Boolean);
  return lectures.filter((l) =>
    (week === null || l.week === week) &&
    (!f.slot || l.slot === f.slot) &&
    (!f.heard || (f.heard === 'yes') === h.has(l.lectureId)) &&
    (!terms.length || terms.every((t) => String(l.title || '').toLowerCase().includes(t))));
}

export const isFiltered = (f) => !!(f.week || f.slot || f.heard || String(f.q || '').trim());

/** Filters <-> hash query: v=all (the full list; otherwise one week at a time), w week, s slot, q words, h heard. */
export function readFilters(params) {
  const w = Number(params.get('w'));
  const s = params.get('s') || '';
  const h = params.get('h') || '';
  return { all: params.get('v') === 'all', week: Number.isInteger(w) && w > 0 ? w : '', slot: SLOTS.includes(s) ? s : '', q: (params.get('q') || '').slice(0, 60), heard: ['yes', 'no'].includes(h) ? h : '' };
}
export const filterParams = (f) => ({ v: f.all ? 'all' : '', w: f.week || '', s: f.all ? f.slot : '', q: f.all ? String(f.q || '').trim() : '', h: f.all ? f.heard : '' });

/** One journal week, in slot order (SPL, GKGML, LOW 1, LOW 2). */
export const weekLectures = (lectures, week) => lectures.filter((l) => l.week === week).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
/** The next or previous journal week that exists (stays put at the ends). */
export function stepWeek(weeks, week, d) {
  const i = weeks.indexOf(week);
  if (i < 0) return weeks[0];
  return weeks[Math.min(weeks.length - 1, Math.max(0, i + d))];
}
