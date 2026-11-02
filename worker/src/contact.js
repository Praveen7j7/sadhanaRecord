// Contact details asked at sign-up and kept in the profile: email (checked, never written to: decision 15, no emails),
// WhatsApp number, and the class day (one class a week across all batches, on Sunday or Saturday).
import { normPhone } from './util.js';
import { addressProblems } from '../../shared/places.js';

export const CLASS_DAYS = ['SUN', 'SAT'];

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
const KNOWN = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'rediffmail.com', 'proton.me', 'protonmail.com', 'zoho.com', 'aol.com']);

/**
 * '' when the address can receive mail as far as we can tell, else a message. Checks a common misspelling, then asks
 * DNS (Cloudflare's resolver) for the domain's mail servers. A DNS failure never blocks the person.
 */
export async function emailProblem(email) {
  const domain = email.split('@')[1];
  if (TYPOS[domain]) return `Did you mean ${email.split('@')[0]}@${TYPOS[domain]}?`;
  if (KNOWN.has(domain)) return '';
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    if (j.Status === 3) return `${domain} does not exist. Check the spelling of your email.`;
    if (j.Status === 0 && !(j.Answer || []).some(a => a.type === 15)) return `${domain} cannot receive email. Check the spelling of your email.`;
  } catch { /* not reachable: accept */ }
  return '';
}

/** WhatsApp number: 10 digits, or '' when none was given. Returns null when given but not a phone. */
export function normWhatsapp(v) {
  if (v === undefined || v === null || v === '') return '';
  return normPhone(v) || null;
}

/**
 * Postal address (the head, 3–4 Oct 2026): asked at sign-up, kept in the profile, changed only by the devotee (Account);
 * coordinators and the head see it. { line, area, city, state, pin }: India; the state from the list; in Delhi the
 * district from the list, else the city; a PIN code of that state (../../shared/places.js, the same rules as the app).
 * Returns { value, problems } — `value` has the profile columns, `problems` the messages under `path`.
 */
export function checkAddress(v, path) {
  const a = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  // Phase 9 (item 13): the parts house / street / landmark, or the older one-line `line`
  for (const k of Object.keys(a)) if (!['line', 'house', 'street', 'landmark', 'area', 'city', 'state', 'pin'].includes(k)) return { value: null, problems: [{ path: `${path}.${k}`, message: 'Unknown field.' }] };
  const r = addressProblems(a);
  const problems = r.problems.map(([k, message]) => ({ path: `${path}.${k}`, message }));
  return { value: problems.length ? null : { addr_line: r.value.line, addr_area: r.value.area, addr_city: r.value.city, addr_state: r.value.state, addr_pin: r.value.pin,
    addr_house: r.value.house || '', addr_street: r.value.street || '', addr_landmark: r.value.landmark || '' }, problems };
}
/** The profile row's address for the app, or null when none was given (devotees who signed up before 3 Oct 2026).
 *  With the parts when it was given in parts (Phase 9); `line` is always there. */
export const addressView = p => (p?.addr_line ? { line: p.addr_line, ...(p.addr_house ? { house: p.addr_house, street: p.addr_street || '', landmark: p.addr_landmark || '' } : {}),
  area: p.addr_area, city: p.addr_city, state: p.addr_state || '', pin: p.addr_pin } : null);
