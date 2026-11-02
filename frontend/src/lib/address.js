// The postal address asked at sign-up and changed in Account (apart from contact.js, which the first screen loads).
// The same rules as the server ($shared/places.js): India; the state from the list; in Delhi the district from the list,
// else the city; a PIN code of that state.
import { addressProblems } from '$shared/places.js';

/** Errors keyed `${prefix}.line` etc., as the server names them ({} when the address is valid). */
export function addressErrors(a, prefix = 'address') {
  return Object.fromEntries(addressProblems(a).problems.map(([k, m]) => [`${prefix}.${k}`, m]));
}
/** The address as sent to the server (trimmed). */
export const cleanAddress = (a) => addressProblems(a).value;
/** One line for showing an address: "B-12, Gali no. 3, near the metro, Punjabi Bagh, West Delhi, Delhi 110026". */
export const addressLine = (a) => (a ? [a.line, a.landmark, a.area, a.city, a.state].filter(Boolean).join(', ') + ' ' + a.pin : '');
