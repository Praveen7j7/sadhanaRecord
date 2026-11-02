// One rule for a person's name, used by the app and the server (13 Oct 2026, audit FE-2).
//
// They had drifted apart and neither was a superset of the other:
//   app    /^[\p{L} ]{2,60}$/u                 — any letter, no dot or apostrophe: "O'Brien" was refused here
//   server /^[A-Za-z][A-Za-z .']{1,59}$/       — ASCII only: "कृष्ण" passed the app and was refused here
// So a devotee could fill a name the app accepted and the server rejected, and see a confusing error on a field
// that looked fine. The union of both intents is: any letter in any script, plus the spaces, dots, apostrophes
// and hyphens that real names carry.

/** Collapse the spaces a keyboard adds; never changes the letters. */
export const cleanName = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** A name as people actually write them: letters of any script, spaces, . ' - — 2 to 60 characters.
 *  \p{M} is needed beside \p{L}: Devanagari vowel signs and viramas (कृष्ण) are combining marks, not
 *  letters, so a letters-only rule rejects most Hindi names outright. */
export const validName = (n) => /^[\p{L}\p{M}][\p{L}\p{M} .'\u2019-]{1,59}$/u.test(cleanName(n));
