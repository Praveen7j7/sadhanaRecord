// How the submit window is SAID, in one place, on both sides.
//
// WHY THIS EXISTS. The window itself has always been two master settings (`submit_opens`, `submit_closes`,
// default "SUN 18:00" / "MON 21:00"), and every lock the server enforces reads them. What did NOT read them
// was the wording: about fifteen messages said "Sunday 6 PM" or "Monday 9 PM" as literal text, in server
// error messages, the daily notification and five screens. So the head moving the window to Sunday 2 PM
// changed what the app ALLOWED and not a single thing it SAID — devotees were told the wrong time by the
// app that was enforcing the right one.
//
// Anything adjustable from Admin has to arrive as a value wherever it is shown. These helpers turn a
// setting into the words, so a new message has no excuse to hardcode a time.
//
// Used by: worker/src/weeks.js, attendance.js, groups.js, push.js (error messages and the notification),
// and the app via `meta.get`'s submitWindow (frontend/src/lib/windowtext.js re-exports these).

/** Day names as the app writes them, keyed by the setting's three-letter form. */
const DAYS = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };
const SPEC = /^(MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{1,2}):(\d{2})$/;

/**
 * "SUN 14:00" → { day: 'Sunday', time: '2 PM', text: 'Sunday 2 PM' }.
 *
 * The clock is 12-hour with no leading zero and no ":00", because that is how the rest of the app writes a
 * time to a devotee ("9 PM", not "21:00" or "9:00 PM"). A half past shows as "2:30 PM". Midnight and noon
 * are named, since "12 AM" is read wrongly by about half of everyone.
 *
 * An unparseable setting returns null rather than throwing: a caller shows its own fallback. The server
 * refuses to STORE a bad spec (settings.update), so this only guards against a hand-edited row.
 */
export function windowPart(spec) {
  const m = SPEC.exec(String(spec || '').trim().toUpperCase());
  if (!m) return null;
  const h = Number(m[2]), min = Number(m[3]);
  if (h > 23 || min > 59) return null;
  const day = DAYS[m[1]];
  const time = h === 0 && min === 0 ? 'midnight'
    : h === 12 && min === 0 ? 'noon'
    : `${h % 12 === 0 ? 12 : h % 12}${min ? ':' + String(min).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`;
  return { day, time, text: `${day} ${time}` };
}

/** Just the words, with a fallback for an unreadable setting. `windowText('SUN 14:00')` → 'Sunday 2 PM'. */
export const windowText = (spec, fallback = '') => windowPart(spec)?.text ?? fallback;

/**
 * The two sentences that carry the window to a devotee, from the pair of settings.
 *
 * Callers pass whatever they hold: the worker passes the two raw settings, the app passes
 * `meta.submitWindow`. Both end up with the same words, which is the whole point.
 */
export function windowWords({ opens, closes } = {}) {
  const o = windowPart(opens), c = windowPart(closes);
  return {
    opensText: o?.text ?? 'Sunday 6 PM',
    closesText: c?.text ?? 'Monday 9 PM',
    /** "You can submit from Sunday 2 PM." */
    fromSentence: `You can submit from ${o?.text ?? 'Sunday 6 PM'}.`,
    /** "From Sunday 2 PM until Monday 9 PM." */
    rangeSentence: `From ${o?.text ?? 'Sunday 6 PM'} until ${c?.text ?? 'Monday 9 PM'}.`,
    /** "…closed at its Monday 9 PM deadline." — the phrase the refusals are built from. */
    deadlinePhrase: `${c?.text ?? 'Monday 9 PM'} deadline`
  };
}
