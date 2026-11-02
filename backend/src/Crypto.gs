/**
 * Crypto.gs — password hashing and session tokens.
 *
 * Passwords: PBKDF2-HMAC-SHA-256 (NIST SP 800-63B), 32-byte result, a random 16-byte salt per hash.
 * Before hashing, the password is keyed with a server-only "pepper" (Script Properties › PW_PEPPER), so a copy
 * of the Accounts tab alone is not enough to try guesses offline. Apps Script runs each HMAC through a slow
 * bridge, so the iteration count is tuned on the server (Setup › timePbkdf2) to about 0.4 s per login, stored
 * per hash, and raised automatically at the next login when the setting goes up.
 *
 * Tokens: 2 random v4 UUIDs (Java SecureRandom underneath) = 244 random bits, sent to the phone once;
 * only their SHA-256 is stored.
 */

function utf8_(s) { return Utilities.newBlob(String(s)).getBytes(); }
function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join(''); }
function hexBytes_(h) {
  var out = [];
  for (var i = 0; i < h.length; i += 2) { var v = parseInt(h.substr(i, 2), 16); out.push(v > 127 ? v - 256 : v); }
  return out;
}
function randomHex_(n32) { var s = ''; while (s.length < n32) s += Utilities.getUuid().replace(/-/g, ''); return s.slice(0, n32); }
function sha256Hex_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)); }

/** PBKDF2-HMAC-SHA-256, one 32-byte block. Bytes are Java-style signed (-128..127), as Apps Script returns them. */
function pbkdf2_(passwordBytes, saltBytes, iterations) {
  var u = Utilities.computeHmacSha256Signature(saltBytes.concat([0, 0, 0, 1]), passwordBytes);
  var t = u.slice();
  for (var i = 1; i < iterations; i++) {
    u = Utilities.computeHmacSha256Signature(u, passwordBytes);
    for (var j = 0; j < 32; j++) t[j] ^= u[j];
  }
  return t;
}

var PEPPER_ = null;
function pepperedBytes_(password) {
  var pepper = PEPPER_ || (PEPPER_ = prop_('PW_PEPPER'));
  if (!pepper || pepper.length < 32) throw new Error('PW_PEPPER is not set; run setupSecrets() once.');
  return Utilities.computeHmacSha256Signature(utf8_(password), utf8_(pepper));
}
function pbkdf2Iterations_() {
  var n = parseInt(setting_('pbkdf2_iterations', ''), 10);
  return n >= 1000 ? n : LIMITS.PBKDF2_FALLBACK;
}

/** { pw_hash, pw_salt, pw_iterations } for a new password. */
function hashPassword_(password) {
  var salt = hexBytes_(randomHex_(32)), n = pbkdf2Iterations_();
  return { pw_hash: Utilities.base64Encode(pbkdf2_(pepperedBytes_(password), salt, n)), pw_salt: Utilities.base64Encode(salt), pw_iterations: n };
}

/** True when password matches the stored hash. Compares in constant time. */
function verifyPassword_(password, stored) {
  if (!stored || !stored.pw_hash || !stored.pw_salt) return false;
  var salt = Utilities.base64Decode(String(stored.pw_salt));
  var got = Utilities.base64Encode(pbkdf2_(pepperedBytes_(password), salt, Number(stored.pw_iterations) || LIMITS.PBKDF2_FALLBACK));
  return sameText_(got, String(stored.pw_hash));
}

/** Burns the same time as a real check, so an unknown login cannot be told apart by speed. */
function dummyVerify_(password) {
  pbkdf2_(pepperedBytes_(password), hexBytes_('00000000000000000000000000000000'), pbkdf2Iterations_());
  return false;
}

function sameText_(a, b) {
  a = String(a); b = String(b);
  var d = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

function newToken_() { return randomHex_(64); }
function tokenHash_(token) { return sha256Hex_('session:' + token); }
