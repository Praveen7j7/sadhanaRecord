// Shared helpers: errors, Indian time, input rules (API contract §0, §1).

/** An error the caller is meant to see. */
export class ApiError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.fields = extra.fields;
    this.data = extra.data;
    this.details = extra.details;      // more about the error, for the app to show (e.g. a pending sign-up's batch)
  }
}
export const apiError = (code, message, extra) => new ApiError(code, message, extra);
/** VALIDATION with one or more { path, message }. */
export function invalid(fields) {
  const list = Array.isArray(fields) ? fields : [fields];
  return new ApiError('VALIDATION', list.length === 1 ? list[0].message : 'Some answers need fixing.', { fields: list });
}

/* ---- Indian time (UTC+5:30, no daylight saving) ---- */
const IST_MS = 330 * 60000;
const pad = n => String(n).padStart(2, '0');
function ist(d) { return new Date(d.getTime() + IST_MS); }
/** 2026-10-05T21:00:00+05:30 */
export function isoIst(d = new Date()) {
  const t = ist(d);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}+05:30`;
}
export function ymd(d = new Date()) { return isoIst(d).slice(0, 10); }
/** Monday of d's week (IST), YYYY-MM-DD. */
export function mondayOf(d = new Date()) {
  const dow = (ist(d).getUTCDay() + 6) % 7;        // Monday 0 … Sunday 6
  return ymd(new Date(d.getTime() - dow * 86400000));
}
export function parseIso(s) { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
/** 'YYYY-MM-DD' → the same string if it is a real date, else ''. */
export function validYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return '';
  const d = new Date(`${s}T00:00:00+05:30`);
  return !isNaN(d.getTime()) && ymd(d) === s ? s : '';
}
export function ageOn(dob, today = new Date()) {
  const t = ymd(today);
  let a = Number(t.slice(0, 4)) - Number(dob.slice(0, 4));
  if (t.slice(5) < dob.slice(5)) a--;
  return a;
}
/** "9:15 PM" in IST */
export function clockIst(d) {
  const t = ist(d), h = t.getUTCHours();
  return `${(h % 12) || 12}:${pad(t.getUTCMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/* ---- input rules ---- */
/** 10 digits starting 6–9, after removing spaces, +91 and a leading 0; '' if not a phone. */
export function normPhone(v) {
  let d = String(v ?? '').replace(/[\s-]/g, '');
  if (d.startsWith('+91')) d = d.slice(3);
  d = d.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d[0] === '0') d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}
/** A login as typed: a phone becomes its 10 digits, anything else a lowercase username. */
export function normLogin(v) {
  const p = normPhone(v);
  if (p) return p;
  const u = String(v ?? '').trim().toLowerCase();
  return /^[a-z0-9._-]{3,30}$/.test(u) ? u : '';
}
export const validUsername = u => /^[a-z][a-z0-9._-]{2,29}$/.test(String(u || ''));
// one rule for both sides (13 Oct 2026, audit FE-2): shared/names.js
export { cleanName, validName } from '../../shared/names.js';
export const csv = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);

/** '' when the password is acceptable; otherwise the reason. NIST SP 800-63B: length, no composition rules, block common ones. */
export function passwordProblem(pw, login) {
  if (typeof pw !== 'string') return 'Please choose a password.';
  const len = Array.from(pw).length;
  if (len < 8) return 'Use at least 8 characters.';
  if (len > 64) return 'Use at most 64 characters.';
  const flat = pw.toLowerCase().replace(/[\s._-]/g, '');
  if (login && (flat === String(login).toLowerCase() || (/^\d+$/.test(login) && flat.includes(String(login))))) return 'Do not use your phone number or username.';
  if (/^(.)\1+$/.test(flat)) return 'That password is too easy to guess.';
  if ('0123456789012345678901234567890'.includes(flat) || 'abcdefghijklmnopqrstuvwxyz'.includes(flat)) return 'That password is too easy to guess.';
  if (COMMON_PASSWORDS.has(flat)) return 'That password is too common. Choose another.';
  return '';
}
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'qwerty', 'qwerty123', 'qwertyuiop',
  'iloveyou', 'iloveyou1', 'admin123', 'administrator', 'welcome', 'welcome1', 'welcome123', 'letmein', 'letmein1', 'monkey123',
  'football', 'baseball', 'cricket', 'cricket123', 'sachin', 'sachin123', 'dhoni007', 'virat18', 'india123', 'indian123',
  'bharat123', 'jaihind', 'jaihind123', 'mypassword', 'changeme', 'secret123', 'sunshine', 'princess', 'dragon123', 'master123',
  'harekrishna', 'harekrishna1', 'harekrishna108', 'harekrsna', 'harekrishnaharerama', 'krishna', 'krishna1', 'krishna108',
  'krishna123', 'krishna1234', 'radhekrishna', 'radhekrishna108', 'radheradhe', 'radhe123', 'radharani', 'radha123', 'gopal123',
  'govinda', 'govinda108', 'jaishreekrishna', 'jaishrikrishna', 'jaishreeram', 'jaishriram', 'jaisiyaram', 'sitaram', 'ram12345',
  'hanuman', 'hanuman123', 'shiva123', 'omnamahshivaya', 'harihar', 'iskcon', 'iskcon108', 'iskcon123', 'prabhupada', 'prabhupada108',
  'gauranga', 'nitaigaur', 'nityananda', 'chaitanya', 'mahaprabhu', 'vrindavan', 'vrindavan108', 'mayapur', 'jagannath', 'jagannath108',
  'bhagavadgita', 'bhakti123', 'sadhana', 'sadhana123', 'iyfdelhi', 'iyf12345', 'iyfdelhi123', 'devotee', 'devotee123', 'prabhuji',
  'abc12345', 'abcd1234', 'abcdef123', 'a1b2c3d4', '1q2w3e4r', '1qaz2wsx', 'zaq12wsx', 'asdfghjkl', 'zxcvbnm123', 'asdf1234',
  '11223344', '12341234', '12344321', '87654321', '98765432', '11111111', '00000000', '12121212', '147258369', '159753',
  '123qwe123', 'qwe12345', 'love1234', 'lovely123', 'mylove123', 'baby1234', 'computer', 'internet', 'samsung123', 'nokia123',
  'mobile123', 'google123', 'whatsapp', 'facebook', 'instagram', 'superman', 'batman123', 'pokemon', 'naruto123', 'mumbai123',
  'delhi123', 'newdelhi', 'newdelhi123', 'hindustan', 'om123456', 'ganesh123', 'ganpati', 'saibaba', 'omsairam', 'waheguru'
]);
