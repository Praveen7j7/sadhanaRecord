// Contact details asked at sign-up and kept in the profile (the same rules as the server, worker/src/contact.js):
// email (format + common typos here; the server also checks the mail domain), WhatsApp number, and the class day
// (one class a week for everyone, on Sunday or Saturday).

export const CLASS_DAYS = [['SUN', 'Sunday'], ['SAT', 'Saturday']];
export const classDayName = (id) => (id === 'SAT' ? 'Saturday' : id === 'SUN' ? 'Sunday' : '');

/** Lower-case email if it looks valid, else ''. */
export function normEmail(v) {
  const e = String(v ?? '').trim().toLowerCase();
  if (e.length > 120 || e.includes('..')) return '';
  return /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(e) ? e : '';
}
// common misspellings of the big providers: told, never silently changed
const TYPOS = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com',
  'gmail.in': 'gmail.com', 'gmal.com': 'gmail.com', 'gnail.com': 'gmail.com', 'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'rediffmail.con': 'rediffmail.com',
  'icloud.con': 'icloud.com' };
/** '' when the address looks right; otherwise what to tell the person (a typo of a big provider is named). */
export function emailProblem(v) {
  if (!String(v ?? '').trim()) return 'Enter your email address';
  const e = normEmail(v);
  if (!e) return 'Enter a valid email address, like name@gmail.com';
  const [user, domain] = e.split('@');
  return TYPOS[domain] ? `Did you mean ${user}@${TYPOS[domain]}?` : '';
}
/** WhatsApp number: 10 digits, or '' when none was given; null when given but not a mobile number. */
export function normWhatsapp(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const d = s.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
/** Tap-to-chat link (WhatsApp) and tap-to-write link for a person's contact details. */
export const waLink = (n) => (/^\d{10}$/.test(n || '') ? 'https://wa.me/91' + n : '');
export const mailLink = (e) => (e ? 'mailto:' + e : '');
/** A tap-to-call link for an Indian mobile number. */
export const telLink = (p) => (/^\d{10}$/.test(p || '') ? 'tel:+91' + p : 'tel:' + (p || ''));

