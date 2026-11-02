// Places for the postal address (the head, 4 Oct 2026: "a valid address — country India, state Delhi, then a place in
// Delhi"). Shared by the app (the choices) and the server (the same checks). Country: India. State or union territory
// from the list; in Delhi the district from the list, elsewhere the city typed; the PIN code must belong to the state —
// its first two digits are the postal region (Delhi 11, Haryana 12–13, Uttar Pradesh 20–28 …).

export const COUNTRY = 'India';

/** [state or UT, the first two digits of its PIN codes] */
export const STATES = [
  ['Andaman and Nicobar Islands', ['74']], ['Andhra Pradesh', ['50', '51', '52', '53']], ['Arunachal Pradesh', ['79']], ['Assam', ['78']],
  ['Bihar', ['80', '81', '82', '83', '84', '85']], ['Chandigarh', ['16']], ['Chhattisgarh', ['49']],
  ['Dadra and Nagar Haveli and Daman and Diu', ['39']], ['Delhi', ['11']], ['Goa', ['40']], ['Gujarat', ['36', '37', '38', '39']],
  ['Haryana', ['12', '13']], ['Himachal Pradesh', ['17']], ['Jammu and Kashmir', ['18', '19']], ['Jharkhand', ['81', '82', '83', '85']],
  ['Karnataka', ['56', '57', '58', '59']], ['Kerala', ['67', '68', '69']], ['Ladakh', ['19']], ['Lakshadweep', ['68']],
  ['Madhya Pradesh', ['45', '46', '47', '48']], ['Maharashtra', ['40', '41', '42', '43', '44']], ['Manipur', ['79']], ['Meghalaya', ['79']],
  ['Mizoram', ['79']], ['Nagaland', ['79']], ['Odisha', ['75', '76', '77']], ['Puducherry', ['53', '60', '67']], ['Punjab', ['14', '15', '16']],
  ['Rajasthan', ['30', '31', '32', '33', '34']], ['Sikkim', ['73']], ['Tamil Nadu', ['60', '61', '62', '63', '64']], ['Telangana', ['50']],
  ['Tripura', ['79']], ['Uttar Pradesh', ['20', '21', '22', '23', '24', '25', '26', '27', '28']], ['Uttarakhand', ['24', '26']],
  ['West Bengal', ['70', '71', '72', '73', '74']]
];
export const STATE_NAMES = STATES.map(s => s[0]);

/** Delhi's districts (the place chosen in Delhi). */
export const DELHI_DISTRICTS = ['Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 'North West Delhi', 'Shahdara',
  'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'];

/** Whether a 6-digit PIN code belongs to the state (by its first two digits). */
export function pinInState(pin, state) {
  const s = STATES.find(x => x[0] === state);
  return !!s && /^[1-9]\d{5}$/.test(String(pin || '')) && s[1].includes(String(pin).slice(0, 2));
}
/** The state a PIN code most likely belongs to (the first in the list), for an address saved without a state. */
export const stateOfPin = (pin) => (STATES.find(s => s[1].includes(String(pin || '').slice(0, 2))) || [''])[0];

/** Every state a PIN code may belong to (one, or several where a PIN region is shared, as 79 in the north-east). */
export const pinStates = (pin) => (/^[1-9]\d{5}$/.test(String(pin || '')) ? STATES.filter(s => s[1].includes(String(pin).slice(0, 2))).map(s => s[0]) : []);

/**
 * Problems with an address as [field, message] pairs (empty when valid); the cleaned address comes back too.
 * Phase 9, item 13 (the head, 9 Oct 2026): the address in parts — { house, street, landmark, area, city, state, pin };
 * `line` (shown to staff and copied to Sheets) is built from house and street. An address in the older shape
 * { line, area, city, state, pin } is still accepted as it is. In Delhi the city is one of its districts.
 */
export function addressProblems(a) {
  const t = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();
  const parts = a && (a.house !== undefined || a.street !== undefined || a.landmark !== undefined);
  const house = t(a?.house), street = t(a?.street), landmark = t(a?.landmark);
  const line = parts ? [house, street].filter(Boolean).join(', ') : t(a?.line);
  const area = t(a?.area), pin = String(a?.pin ?? '').replace(/\s/g, '');
  const state = t(a?.state) || stateOfPin(pin) || 'Delhi', city = t(a?.city);
  const out = [];
  if (parts) {
    if (house.length < 1 || house.length > 60) out.push(['house', 'Enter your house or flat number']);
    if (street.length > 80) out.push(['street', 'At most 80 characters']);
    if (landmark.length > 60) out.push(['landmark', 'At most 60 characters']);
  } else if (line.length < 5 || line.length > 120) out.push(['line', 'Enter your house number and street']);
  if (area.length < 2 || area.length > 60) out.push(['area', 'Enter your area or locality']);
  if (!STATE_NAMES.includes(state)) out.push(['state', 'Choose your state']);
  else if (state === 'Delhi' ? !DELHI_DISTRICTS.includes(city) : city.length < 2 || city.length > 40) out.push(['city', state === 'Delhi' ? 'Choose your district' : 'Enter your city or town']);
  if (!/^[1-9]\d{5}$/.test(pin)) out.push(['pin', 'Enter the 6-digit PIN code']);
  else if (STATE_NAMES.includes(state) && !pinInState(pin, state)) out.push(['pin', `This PIN code is not in ${state}`]);
  return { problems: out, value: { line, ...(parts ? { house, street, landmark } : {}), area, city, state, pin } };
}
