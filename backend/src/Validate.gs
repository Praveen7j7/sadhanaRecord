/**
 * Validate.gs — input rules shared by every action (API contract §0, §1).
 */

/** 10 digits starting 6–9, after removing spaces, +91 and a leading 0; '' if not a phone. */
function normPhone_(v) {
  var d = String(v === null || v === undefined ? '' : v).replace(/[\s-]/g, '');
  if (/^\+91/.test(d)) d = d.slice(3);
  d = d.replace(/\D/g, '');
  if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
  if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}
/** A login as typed: a phone becomes its 10 digits, anything else a lowercase username. */
function normLogin_(v) {
  var p = normPhone_(v);
  if (p) return p;
  var u = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  return /^[a-z0-9._-]{3,30}$/.test(u) ? u : '';
}
function validUsername_(u) { return /^[a-z][a-z0-9._-]{2,29}$/.test(String(u || '')) && !/^\d+$/.test(u); }

function cleanName_(v) { return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim(); }
function validName_(n) { return /^[A-Za-z][A-Za-z .']{1,59}$/.test(n); }

/** '' when the password is acceptable; otherwise the reason. NIST SP 800-63B: length, no composition rules, block common ones. */
function passwordProblem_(pw, login) {
  if (typeof pw !== 'string') return 'Please choose a password.';
  var len = Array.from(pw).length;
  if (len < 8) return 'Use at least 8 characters.';
  if (len > 64) return 'Use at most 64 characters.';
  var flat = pw.toLowerCase().replace(/[\s._-]/g, '');
  if (login && (flat === String(login).toLowerCase() || flat.indexOf(String(login)) !== -1 && /^\d+$/.test(login))) return 'Do not use your phone number or username.';
  if (/^(.)\1+$/.test(flat)) return 'That password is too easy to guess.';
  if ('0123456789012345678901234567890'.indexOf(flat) !== -1 || 'abcdefghijklmnopqrstuvwxyz'.indexOf(flat) !== -1) return 'That password is too easy to guess.';
  if (COMMON_PASSWORDS_.indexOf(flat) !== -1) return 'That password is too common. Choose another.';
  return '';
}

/** Common passwords, lower-cased with spaces, dots, dashes and underscores removed. */
var COMMON_PASSWORDS_ = [
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
];

/** 'YYYY-MM-DD' → Date at midnight IST, or null. */
function parseYmd_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  var d = new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T00:00:00+05:30');
  return isNaN(d.getTime()) || ymd_(d) !== s ? null : d;
}
