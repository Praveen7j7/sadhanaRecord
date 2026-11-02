// Master-password recovery, run by the schedule (every 5 minutes).
// The head puts a temporary password in the secret MASTER_RESET_PASSWORD (wrangler secret put, in their own
// Terminal). The next run makes it the `master` password once, marks it "must change at next login", signs out
// open master sessions and writes AuditLog. The same value is never applied twice (only its SHA-256 is kept in
// settings), so the secret can be deleted at leisure. If there is no master account yet, it is created.
import { isoIst, passwordProblem } from './util.js';
import { hashPassword, markOf } from './crypto.js';
import { q, one, audit, dirty } from './db.js';
import { iterations } from './auth.js';

export async function applyMasterReset(env, db, now = new Date()) {
  const pw = env.MASTER_RESET_PASSWORD;
  if (!pw) return 'no reset requested';
  // Keyed with the server-only pepper (13 Oct 2026, audit J3/F8): this marker used to be a plain SHA-256 of the
  // temporary password, and `settings` is copied to the Rules sheet, so anyone who could read that sheet had an
  // offline guessing target for a password that stays live until the head signs in. An HMAC under PW_PEPPER is
  // useless without the secret. The key is also excluded from the copy now (mirrorkeys.js LOG_WHEN).
  const mark = await markOf('master-reset:' + pw, env.PW_PEPPER);
  const done = await one(db, "SELECT value FROM settings WHERE key = 'master_reset_applied'");
  if (done && done.value === mark) return 'already applied; delete the MASTER_RESET_PASSWORD secret';
  const problem = passwordProblem(pw, 'master');
  if (problem) return 'MASTER_RESET_PASSWORD not used: ' + problem;
  const h = await hashPassword(pw, await iterations(db), env.PW_PEPPER), at = isoIst(now);
  const ctx = { login: 'setup', role: 'MASTER', now: () => now };
  const exists = await one(db, "SELECT login FROM accounts WHERE login = 'master'");
  await db.batch([
    exists
      ? q(db, "UPDATE accounts SET pw_hash = ?, pw_salt = ?, pw_iterations = ?, must_change_pw = 1, failed_tries = 0, locked_until = '', status = 'ACTIVE', updated_at = ?, updated_by = 'setup' WHERE login = 'master'",
          h.pw_hash, h.pw_salt, h.pw_iterations, at)
      : q(db, `INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations, must_change_pw, signed_up_at, decided_at, decided_by, updated_at, updated_by)
               VALUES ('master', 'MASTER', 'ACTIVE', 'IYF Head', ?, ?, ?, 1, ?, ?, 'setup', ?, 'setup')`, h.pw_hash, h.pw_salt, h.pw_iterations, at, at, at),
    q(db, "UPDATE sessions SET ended_at = ?, end_reason = 'reset' WHERE login = 'master' AND ended_at = ''", at),
    q(db, `INSERT INTO settings (key, value, note, changed_by, changed_at) VALUES ('master_reset_applied', ?, 'Marker of the last MASTER_RESET_PASSWORD applied (keyed with PW_PEPPER; never copied to Sheets)', 'setup', ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, changed_at = excluded.changed_at`, mark, at),
    audit(db, ctx, exists ? 'setup.resetMasterPassword' : 'setup.createMaster', 'master', '', null, null, 'MASTER_RESET_PASSWORD secret', ''),
    dirty(db, 'accounts', 'settings', 'audit_log')
  ]);
  return exists ? 'master password reset; must change at next login' : 'master account created; must change at next login';
}
