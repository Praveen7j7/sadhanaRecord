import { emailProblem } from './contact.js';
import { addressErrors } from './address.js';
// Client-side checks that mirror the contract's rules. The server stays the authority.
export const BLOOD_GROUPS = [
  ['A+', 'A+'], ['A-', 'A−'], ['B+', 'B+'], ['B-', 'B−'],
  ['AB+', 'AB+'], ['AB-', 'AB−'], ['O+', 'O+'], ['O-', 'O−'], ["Don't know", "Don't know"],
];
// one copy of the service-skill list, shared with the server
export { SKILLS } from '$shared/skills.js';

// No 'Other' (the head, 18 Oct 2026): an emergency contact is called in a crisis, and "Other" tells
// whoever is calling nothing about who they are reaching. Profile.svelte still SHOWS a saved value
// that is not on this list, so nobody who already chose Other loses their contact.
export const RELATIONS = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Son', 'Daughter', 'Friend'];

export const isPhone = (p) => /^[6-9]\d{9}$/.test(p);
export const isUsername = (u) => /^[a-z0-9._-]{3,30}$/.test(u);
/* The same rule the server applies (13 Oct 2026, audit FE-2): neither side was a superset of the other, so a
   name could pass here and be refused there. One rule now, in shared/names.js.

   IMPORTED and then re-exported, not `export … from`. A bare re-export does NOT create a local binding, so
   `isName` was undefined INSIDE this module and signUpErrors() threw a ReferenceError at its second line —
   every sign-up step, every time. The screen showed no validation at all and the browser checks failed on
   eight assertions that looked like wrong wording. */
import { validName as isName } from '$shared/names.js';
export { isName };

export function ageOn(dob, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || '');
  if (!m) return null;
  let age = today.getFullYear() - +m[1];
  const before = today.getMonth() + 1 < +m[2] || (today.getMonth() + 1 === +m[2] && today.getDate() < +m[3]);
  if (before) age--;
  return age;
}

export function passwordProblem(pw, phone = '') {
  if (pw.length < 8) return 'Use at least 8 characters';
  if (pw.length > 64) return 'Use at most 64 characters';
  if (phone && pw === phone) return 'Password cannot be your phone number';
  return '';
}

// f: { phone, name, email, whatsapp, batchId, classDay, facilitator, password, confirm, dob, bloodGroup, emName, emRelation, emPhone }
// (phone already normalised; whatsapp '' = none, null = not a mobile number)
/** The youngest age that can sign up (IYF, 8 Oct 2026). Existing younger members are not affected. */
export const MIN_AGE = 15;
/** Under 18 at sign-up: a parent or guardian must agree. */
export const isMinor = (dob, today = new Date()) => { const a = ageOn(dob, today); return a !== null && a >= MIN_AGE && a < 18; };
export function signUpErrors(f, today = new Date()) {
  const e = {};
  if (!isPhone(f.phone)) e.phone = 'Enter your 10-digit mobile number';
  if (!isName(f.name)) e.name = 'Use 2 to 60 letters and spaces';
  const em = emailProblem(f.email);
  if (em) e.email = em;
  if (f.waSame !== true && f.waSame !== false) e.waSame = 'Choose Yes or No';
  if (f.whatsapp === null) e.whatsapp = 'Enter a 10-digit WhatsApp number, or leave it empty';
  if (!f.batchId) e.batchId = 'Choose your batch';
  if (!['SUN', 'SAT'].includes(f.classDay)) e.classDay = 'Choose Sunday or Saturday';
  if (!f.facilitator) e.facilitator = 'Choose your facilitator';
  // required (11 Oct 2026); profession and skills stay optional
  if (!/^\d{4}$/.test(f.connectedSince || '')) e['profile.connectedSince'] = 'Choose the year you first came to IYF Delhi (this year if you are new)';
  const pp = passwordProblem(f.password, f.phone);
  if (pp) e.password = pp;
  else if (f.password !== f.confirm) e.confirm = 'Passwords do not match';
  const age = ageOn(f.dob, today);
  if (age === null) e['profile.dob'] = 'Enter your date of birth';
  else if (age < MIN_AGE) e['profile.dob'] = `You must be at least ${MIN_AGE} to sign up`;
  else if (age > 80) e['profile.dob'] = 'Check your date of birth';
  // 15–17: a parent or guardian agrees (DPDP Act 2023); their name and number are kept with the sign-up
  if (age !== null && age >= MIN_AGE && age < 18) {
    if (!isName(f.parentName || '')) e['parentConsent.name'] = 'Use 2 to 60 letters and spaces';
    if (!isPhone(f.parentPhone || '')) e['parentConsent.phone'] = 'Enter a 10-digit mobile number';
    else if (f.parentPhone === f.phone) e['parentConsent.phone'] = "Use your parent's or guardian's own number";
    if (!f.parentAgreed) e['parentConsent.agreed'] = 'Your parent or guardian must agree';
  }
  if (!f.privacy) e.privacy = 'Agree to the privacy policy to sign up';
  if (!f.bloodGroup) e['profile.bloodGroup'] = 'Choose a blood group';
  if (!isName(f.emName)) e['profile.emergency.name'] = 'Use 2 to 60 letters and spaces';
  if (!f.emRelation) e['profile.emergency.relation'] = 'Choose the relation';
  if (!isPhone(f.emPhone)) e['profile.emergency.phone'] = 'Enter a 10-digit mobile number';
  else if (f.emPhone === f.phone) e['profile.emergency.phone'] = 'Use a different number from your own';
  Object.assign(e, addressErrors(f.addr, 'profile.address'));
  return e;
}

// Preselect a registry match only when it is the single match, the name agrees and it is free.
export function defaultChoice(matches) {
  return matches.length === 1 && matches[0].nameMatches === true && !matches[0].linked && !matches[0].mergedInto ? matches[0].iyfId : '';
}

// today in India: kept in dates.js (Home needs it at startup, without the sign-up checks)
export { todayIST } from './dates.js';
export function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}
