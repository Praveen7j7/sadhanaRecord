// Date and time wording (all Indian time).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const fmtDate = (iso) => { const [y, m, d] = iso.split('-'); return `${+d} ${MONTHS[+m - 1]} ${y}`; };   // "7 Oct 2026", never "07" (8 Oct 2026)
export const fmtShort = (iso) => { const [, m, d] = iso.split('-'); return `${+d} ${MONTHS[+m - 1]}`; };
export function addDaysIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const weekLabel = (weekId) => `${fmtShort(weekId)} – ${fmtShort(addDaysIso(weekId, 6))}`;
export function fmt12(t) {
  const m = /^(\d{2}):(\d{2})$/.exec(t || '');
  if (!m) return '-';
  const h = +m[1];
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
/** "2026-10-05T21:00:00+05:30" → "Mon 9:00 PM" (read from the +05:30 text, so it never depends on the phone's zone). */
export function fmtClose(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso || '');
  if (!m) return '';
  const [y, mo, d] = m[1].split('-').map(Number);
  return `${DOWS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]} ${fmt12(m[2])}`;
}
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOWS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** The weekday of a date, short ("Wed") — for a narrow cell that cannot take the whole date. */
export function dowShort(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y && m && d ? DOWS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] : '';
}
/** "2026-10-03" → "Saturday, 3 October" (the home greeting). */
export function fmtLong(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${DOWS_LONG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MONTHS_LONG[m - 1]}`;
}

/** Today's date in India, YYYY-MM-DD. */
export function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** A past day nobody filled: amber "Missing" (8 Oct 2026), never the grey of a day still to come. today: YYYY-MM-DD. */
export const isMissing = (d, today) => !!d && !d.future && d.state === 'empty' && !!today && d.date < today;
