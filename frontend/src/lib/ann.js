// Announcement helpers (pure): safe links, relative time, ordering.
const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/** Text → [{ t: 'text' | 'url', v }]. Rendered as text nodes and anchors only, never as HTML. */
export function linkify(text) {
  const out = [];
  let last = 0, m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    let url = m[1];
    const trail = /[.,;:!?)\]]+$/.exec(url);
    if (trail) url = url.slice(0, -trail[0].length);
    if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
    out.push({ t: 'url', v: url });
    last = m.index + url.length;
    URL_RE.lastIndex = last;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function relTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (isNaN(t)) return '';
  const min = Math.round((now - t) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 1440) return `${Math.round(min / 60)} h ago`;
  if (min < 10080) { const d = Math.round(min / 1440); return `${d} day${d === 1 ? '' : 's'} ago`; }
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${+m[2]} ${MON[+m[1] - 1]}` : '';
}

/** When a post shows: its start (a scheduled post, Phase 9) or when it was written. */
export const shownOf = (a) => a.shownAt || a.createdAt;
/** New since `seen`: a post on the wall (not one still scheduled) shown after it. */
export const isNew = (a, seen) => !a.scheduled && shownOf(a) > (seen || '');
/** Pinned first, then newest first. */
export const sortAnns = (list) => [...list].sort((a, b) => (b.pinned - a.pinned) || (shownOf(a) < shownOf(b) ? 1 : shownOf(a) > shownOf(b) ? -1 : 0));
export const latestOf = (list) => list.reduce((m, a) => (!a.scheduled && shownOf(a) > m ? shownOf(a) : m), '') || null;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Mon 6 Oct, 6:00 pm" in Indian time, for a scheduled post's start or end. */
export function whenText(iso) {
  const t = Date.parse(iso);
  if (isNaN(t)) return '';
  const d = new Date(t + 5.5 * 3600e3), h = d.getUTCHours(), m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}
/** An ISO time → Indian date and 24 h time ("2026-10-06", "18:00"), for the pickers. */
export function istParts(iso) {
  const t = Date.parse(iso);
  if (isNaN(t)) return { date: '', time: '' };
  const s = new Date(t + 5.5 * 3600e3).toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}
