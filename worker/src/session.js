// Who is calling. A session is a random token held by the phone; D1 keeps only its SHA-256. Valid for
// 30 days from the last use. Logout, a password change, an approved reset, disable and delete end it (inactive does not:
// the login is kept, ADR 0020).
import { apiError, isoIst, parseIso } from './util.js';
import { newToken, tokenHash } from './crypto.js';
import { q, one, run, setting, account, scopesOf } from './db.js';
import { mondayOf } from './util.js';
import { comeBackStatements } from './inactive.js';

const unauth = () => apiError('UNAUTHENTICATED', 'Please log in again.');

export async function sessionDays(db) { return Number(await setting(db, 'session_days', '30')) || 30; }

/** The caller, from the token; throws UNAUTHENTICATED. */
export async function sessionCtx(ctx, token, extra = []) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw unauth();
  const db = ctx.db, h = await tokenHash(token), now = ctx.now();
  /* The session and its account in ONE round trip (17 Oct 2026). They were two sequential reads — the second
   * could not start until the first had answered — on every authenticated call. A LEFT JOIN keeps the order of
   * the checks below exactly as it was: the session is still judged first (missing, ended, expired), and the
   * account is still judged after it, because a LEFT JOIN gives a row for a session whose login has no account
   * (a.login IS NULL), which is the `!acct` case. Columns are prefixed so a name in both tables (login, role,
   * created_at) cannot shadow the other's. */
  const j = await one(db, `SELECT s.token_hash AS s_token_hash, s.login AS s_login, s.role AS s_role, s.ended_at AS s_ended_at,
                                  s.expires_at AS s_expires_at, s.last_used_at AS s_last_used_at,
                                  a.login AS a_login, a.*, f."name" AS a_fac_now FROM sessions s LEFT JOIN accounts a ON a.login = s.login
                                  LEFT JOIN facilitators f ON f.id = a.fac_id
                           WHERE s.token_hash = ?`, h);
  const s = j && { token_hash: j.s_token_hash, login: j.s_login, role: j.s_role, ended_at: j.s_ended_at,
                   expires_at: j.s_expires_at, last_used_at: j.s_last_used_at };
  if (!s || s.ended_at !== '') throw unauth();
  const exp = parseIso(s.expires_at), used = parseIso(s.last_used_at);
  if (!exp || exp < now) throw unauth();
  // a.* carries the account's own columns; a session whose login has no account row gives a_login = null
  const acct = j.a_login == null ? null : j;
  if (!acct || acct.status !== 'ACTIVE' || acct.role !== s.role) {
    await run(db, "UPDATE sessions SET ended_at = ?, end_reason = 'status' WHERE token_hash = ?", isoIst(now), h);
    throw unauth();
  }
  if (!used || now - used > 3600000) {                     // sliding expiry, written at most once an hour
    /* Through the RAW binding (22 Oct 2026, G1). The per-call wrapper clears its memory of settings and batches on any
     * write, and this one is prepared before the action runs, so once an hour every call read the settings and the
     * batch list twice — a round trip or two for nothing. Nothing this call reads is changed by it: it moves only this
     * session's last-used time and expiry, which were read above and are not read again. */
    const days = await sessionDays(db);
    ctx.waitUntil(run(db.__raw || db, 'UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE token_hash = ?',
      isoIst(now), isoIst(new Date(now.getTime() + days * 86400000)), h));
  }
  /* Using the app brings back someone the APP made inactive (ADR 0020, how = APP) — never a coordinator's "Mark
   * inactive". accounts.auto_inactive came with the session's own read above, so for everyone else this is one test of
   * a field already in memory: no read, no write, no round trip. For them it is one batch, after the answer (waitUntil),
   * and set-based on the login, so a sign-in or a save doing the same at once changes it once. */
  if (acct.auto_inactive) {
    const raw = db.__raw || db;
    ctx.waitUntil(raw.batch(comeBackStatements(raw, { login: acct.login, role: acct.role }, { login: acct.login, from: mondayOf(now), how: 'APP', at: isoIst(now) }))
      .catch((e) => console.error('came back (app)', e.message)));
  }
  return { login: acct.login, role: acct.role, name: acct.name, iyfId: acct.iyf_id, mustChange: !!acct.must_change_pw, sessionHash: h, acct,
           scopes: await scopesOf(db, acct, extra) };
}

/** Statement + token for a new session. */
export async function newSession(ctx, acct, device) {
  const token = newToken(), h = await tokenHash(token), now = ctx.now();
  const exp = new Date(now.getTime() + (await sessionDays(ctx.db)) * 86400000);
  const stmt = q(ctx.db, `INSERT INTO sessions (token_hash, login, role, created_at, last_used_at, expires_at, device)
                          VALUES (?, ?, ?, ?, ?, ?, ?)`, h, acct.login, acct.role, isoIst(now), isoIst(now), isoIst(exp), String(device || '').slice(0, 60));
  return { token, expiresAt: isoIst(exp), stmt };
}

/** Statement ending every open session of a login, except `keepHash`. */
export function endSessions(ctx, login, reason, keepHash = '') {
  return q(ctx.db, "UPDATE sessions SET ended_at = ?, end_reason = ? WHERE login = ? AND ended_at = '' AND token_hash <> ?",
    isoIst(ctx.now()), reason, String(login), keepHash);
}
export const endSession = (ctx, hash, reason) =>
  run(ctx.db, 'UPDATE sessions SET ended_at = ?, end_reason = ? WHERE token_hash = ?', isoIst(ctx.now()), reason, hash);

export { one };
