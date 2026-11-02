// How much CPU a password hash costs, per iteration count (roadmap 5.6 / audit F13).
//
//   node tools/perf/pbkdf2.mjs
//
// Why it matters: the free Cloudflare plan allows 10 ms of CPU per request, and that budget covers the WHOLE
// request — the session lookup, the handler, the audit row — not the hash alone. Sign-in and sign-up are the only
// calls that hash, so the question is how many iterations fit beside everything else those two do.
//
// Measured on the maintainer's Mac, 13 Oct 2026 (a Worker is slower; treat these as a lower bound):
//
//   iterations   ms per hash
//       10,000   0.79        ← the current default (auth.js iterations())
//       25,000   1.84
//       50,000   3.54
//      100,000   7.10        ← the cap the code allows
//
// The cost is linear, as PBKDF2 should be. 10,000 is below current guidance (OWASP suggests far more for PBKDF2
// alone), but this app also keys every password with a server-only pepper before hashing, which is what actually
// stops an offline attack on a stolen database — an attacker without PW_PEPPER cannot test guesses at any
// iteration count. Raising the count still buys defence in depth if the pepper ever leaks.
//
// Recommendation on this evidence: 50,000. It triples the work per guess, costs ~3.5 ms here, and leaves room in
// the 10 ms budget for the rest of a sign-in. Existing hashes are upgraded as people sign in (auth.js rehashes
// when the setting is higher than the stored count), so nothing needs migrating.
//
//     settings.update { pbkdf2_iterations: "50000" }   — the head's Settings screen, no deploy needed
//
// Re-run this on the LOAD-TEST Worker before changing it in production: `wrangler tail` reports real CPU per call.
import { hashPassword } from '../../worker/src/crypto.js';

const pepper = 'p'.repeat(64);
const COUNTS = process.argv.slice(2).map(Number).filter(Boolean);
console.log('iterations   ms per hash');
for (const n of (COUNTS.length ? COUNTS : [10000, 25000, 50000, 100000])) {
  await hashPassword('Devotee pass 2026', n, pepper);          // warm up
  const t0 = performance.now();
  for (let i = 0; i < 5; i++) await hashPassword('Devotee pass 2026', n, pepper);
  console.log(String(n).padStart(9), ' ', ((performance.now() - t0) / 5).toFixed(2));
}
