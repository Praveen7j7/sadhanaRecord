// Password hashing and session tokens, with Web Crypto.
//
// Passwords: PBKDF2-HMAC-SHA-256 (NIST SP 800-63B), 32-byte result, random 16-byte salt per hash. The password
// is first keyed with a server-only pepper (secret PW_PEPPER): P = HMAC-SHA-256(key = pepper, message = password).
// This is the same scheme the Apps Script server used, so hashes made there still verify here; they are
// re-hashed with the current round count at the next login.
// Tokens: 32 random bytes from crypto.getRandomValues, sent to the phone once; only their SHA-256 is stored.

const enc = new TextEncoder();
const subtle = crypto.subtle;
export const toHex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const hmacKeys = new Map();
async function pepperKey(pepper) {
  if (!pepper || pepper.length < 32) throw new Error('PW_PEPPER secret is not set');
  if (!hmacKeys.has(pepper)) hmacKeys.set(pepper, await subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']));
  return hmacKeys.get(pepper);
}
async function derive(password, salt, iterations, pepper) {
  const peppered = await subtle.sign('HMAC', await pepperKey(pepper), enc.encode(password));
  const key = await subtle.importKey('raw', peppered, 'PBKDF2', false, ['deriveBits']);
  return subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

/** { pw_hash, pw_salt, pw_iterations } for a new password. */
export async function hashPassword(password, iterations, pepper) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { pw_hash: toB64(await derive(password, salt, iterations, pepper)), pw_salt: toB64(salt), pw_iterations: iterations };
}

/** True when password matches the stored hash; compares in constant time. */
export async function verifyPassword(password, stored, pepper) {
  if (!stored || !stored.pw_hash || !stored.pw_salt) return false;
  const got = toB64(await derive(password, fromB64(String(stored.pw_salt)), Number(stored.pw_iterations), pepper));
  return sameText(got, String(stored.pw_hash));
}

/** Burns the same time as a real check, so an unknown login cannot be told apart by speed. */
export async function dummyVerify(password, iterations, pepper) {
  await derive(password, new Uint8Array(16), iterations, pepper);
  return false;
}

export function sameText(a, b) {
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

export function newToken() { return toHex(crypto.getRandomValues(new Uint8Array(32))); }
export async function sha256Hex(s) { return toHex(await subtle.digest('SHA-256', enc.encode(s))); }
export const tokenHash = token => sha256Hex('session:' + token);

/**
 * A "have I already done this?" marker for a value that must not be guessable from the marker — keyed with the
 * server-only pepper, so the stored string is useless to anyone without the secret (13 Oct 2026, audit J3/F8).
 * Used for the one-shot MASTER_RESET_PASSWORD marker in `settings`, which the Sheets copy can reach.
 * Falls back to a plain digest only when no pepper is configured (local tests), where there is no secret to protect.
 */
export async function markOf(value, pepper) {
  if (!pepper) return sha256Hex(value);
  return toHex(await subtle.sign('HMAC', await pepperKey(pepper), enc.encode(value)));
}

/**
 * A temporary password the server makes, for decision 46 (the coordinator reads it out or sends it from
 * their own WhatsApp, so it has to survive being spoken and retyped).
 *
 *   · no 0/O, 1/l/I, 5/S, 8/B — the pairs people mishear and mistype
 *   · lower case only, so nobody has to say "capital"
 *   · three groups of four separated by '-', which is how a person reads a code without losing their place
 *   · crypto.getRandomValues, never Math.random
 *
 * 12 characters from a 28-symbol alphabet is about 57 bits. It only has to survive the 24 hours before it
 * expires and the one sign-in it is good for (must_change_pw forces a change immediately), and the login
 * path locks an account after 5 wrong tries, so this is far more than enough.
 *
 * The rejection sampling matters: `byte % 28` alone would make the first 4 symbols of the alphabet likelier
 * than the rest, because 256 is not a multiple of 28.
 */
const TEMP_ALPHABET = 'abcdefghjkmnpqrtuvwxyz234679';      // 28 symbols
export function newTempPassword() {
  const n = TEMP_ALPHABET.length, limit = Math.floor(256 / n) * n;       // 252
  const out = [];
  while (out.length < 12) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b >= limit) continue;                                           // biased tail: draw again
      out.push(TEMP_ALPHABET[b % n]);
      if (out.length === 12) break;
    }
  }
  return `${out.slice(0, 4).join('')}-${out.slice(4, 8).join('')}-${out.slice(8).join('')}`;
}
