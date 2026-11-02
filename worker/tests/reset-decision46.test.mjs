// Decision 46 (the head, 14 Oct 2026) · audit finding F1 (P1) · roadmap 1.1.
//
// THE BUG. "I forgot my password" used to carry the NEW PASSWORD, chosen by whoever filled in the form. So
// anyone who knew a devotee's phone number could queue a password of their own against that account and wait
// for a coordinator to approve it — and nothing afterwards forced the real owner to change it. A coordinator
// saw a name and a number with no way to tell a real request from an impostor's.
//
// THE FLOW NOW. The request carries the phone number only. The SERVER makes the password at approval, keeps
// only its hash, forces a change at first sign-in, and returns the password ONCE in the approval response.
// It expires in 24 hours. Losing it means the DEVOTEE sends a fresh request — there is no second read.
//
// Each assertion below is the attack or the mistake it rules out, not a restatement of the code.
import { boot, suite, FAC, CONTACT } from './harness.mjs';
import { TEMP_PW_HOURS } from '../src/requests.js';
import { ROUTES } from '../src/api.js';

const t = suite('decision 46: the server makes the reset password, shown once');
const { call, addAccount, DB, rows, env } = boot();

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'sps', name: 'SPS Coordinator', batchIds: ['SPS'], tempPassword: 'Temp-sps-2026' }, M);
DB.sql.exec(`UPDATE accounts SET must_change_pw = 0 WHERE login = 'sps'`);
const C = (await call('auth.login', { login: 'sps', password: 'Temp-sps-2026' })).data.token;

const PW = 'Devotee pass 2026';
const profile = { dob: '2000-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000199' },
  address: { line: 'House 12, Gali No 3, Punjabi Bagh', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } };
const join = async (phone, name) => {
  await call('auth.signUp', { phone, name, batchId: 'SPS', facilitator: FAC, ...CONTACT, password: PW, profile });
  const r = await call('requests.approve', { phone, link: { noIdYet: true } }, C);
  if (!r.ok) throw new Error(`approve ${phone}: ${JSON.stringify(r.error)}`);
  return phone;
};
const ARJUN = await join('6000000150', 'Arjun Das');
const BHIMA = await join('6000000151', 'Bhima Das');

const pending = (login) => rows(`SELECT * FROM reset_requests WHERE login = '${login}' AND status = 'PENDING' ORDER BY id DESC`);
const acct = (login) => rows(`SELECT * FROM accounts WHERE login = '${login}'`)[0];

/* ───────── 1. the requester cannot choose a password any more ───────── */

/* `newPassword` is still ACCEPTED and completely IGNORED. It is not removed from the whitelist because an
   unknown field is BAD_REQUEST, so removing it would break "I forgot my password" in every app already
   installed on a phone. What matters is that nothing the sender puts there has any effect — proved below. */
t.ok(ROUTES['auth.requestReset'].fields.includes('newPassword'),
     'an old app may still send newPassword, so it does not break the moment this ships');
t.ok(!/newPassword/.test(String(ROUTES['auth.requestReset'].fn)),
     'but the handler never reads it: the word does not appear in its source');

// the attack: somebody who knows Arjun's number asks for a reset and names the password they want
const attack = await call('auth.requestReset', { login: ARJUN, newPassword: 'Attacker picked 2026' });
t.code(attack, 'ok', 'the request is still accepted (the answer must never reveal whether a number has an account)');
t.eq(attack.data, { status: 'RESET_REQUESTED' }, 'and says only that much');
let req = pending(ARJUN)[0];
t.ok(!!req, 'a request is queued');
t.eq([req.new_pw_hash, req.new_pw_salt, req.new_pw_iterations], ['', '', 0],
     "NOTHING of the attacker's password is stored — this is the finding: the row used to hold their hash");
t.eq(req.pw_source, 'SERVER', 'the row records that the server will make the password');

/* ───────── 2. the same answer for a number with no account ───────── */

const unknown = await call('auth.requestReset', { login: '6000000190' });
t.eq(unknown.data, { status: 'RESET_REQUESTED' }, 'an unknown number gets the identical answer, so nobody can enumerate accounts');
t.eq(rows(`SELECT COUNT(*) AS n FROM reset_requests WHERE login = '6000000190'`)[0].n, 0, '… and no row is written for it');

/* ───────── 3. the owner signing in cancels the request ───────── */

t.code(await call('auth.login', { login: ARJUN, password: PW }), 'ok', 'Arjun still knows his password and signs in');
t.eq(pending(ARJUN).length, 0, 'his own sign-in CANCELS the waiting request: he plainly did not ask for it');
t.eq(rows(`SELECT status, decided_by FROM reset_requests WHERE login = '${ARJUN}' ORDER BY id DESC`)[0],
     { status: 'SUPERSEDED', decided_by: 'SYSTEM' }, 'recorded as superseded by the system, not silently deleted');

/* ───────── 4. approval: the server makes it, and shows it once ───────── */

await call('auth.requestReset', { login: BHIMA });                       // Bhima really has forgotten his
const before = acct(BHIMA).pw_hash;
const ok = await call('resets.approve', { login: BHIMA }, C);
t.code(ok, 'ok', 'the coordinator approves');
const temp = ok.data.tempPassword;
t.ok(typeof temp === 'string' && /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(temp),
     `the server returns a password it made, in groups a person can read out (${temp})`);
t.ok(!/[01lio5s8]/.test(temp), 'with no characters anyone mishears over a phone call');
t.eq(ok.data.shownOnce, true, 'flagged as shown once, so the app knows not to offer a second look');
t.eq(ok.data.expiresInHours, TEMP_PW_HOURS, `and says how long it lasts (${TEMP_PW_HOURS} h)`);
t.eq(ok.data.name, 'Bhima Das', 'with the name, so the coordinator knows who to hand it to');
t.ok(acct(BHIMA).pw_hash !== before && acct(BHIMA).pw_hash !== '', 'the account password changed');

/* the password exists in readable form in that response and NOWHERE else */
const anywhere = rows(`SELECT 'reset' AS t, new_pw_hash AS v FROM reset_requests
                       UNION ALL SELECT 'acct', pw_hash FROM accounts
                       UNION ALL SELECT 'acct', pw_salt FROM accounts
                       UNION ALL SELECT 'audit', "before" FROM audit_log
                       UNION ALL SELECT 'audit', "after" FROM audit_log
                       UNION ALL SELECT 'audit', reason FROM audit_log
                       UNION ALL SELECT 'session', token_hash FROM sessions
                       UNION ALL SELECT 'settings', value FROM settings`)
  .filter(r => String(r.v).includes(temp));
t.eq(anywhere, [], 'the password itself is in no table at all — not the request, the account, or the audit log');

/* ───────── 5. there is no second read, by decision ───────── */

const again = await call('resets.approve', { login: BHIMA }, C);
t.code(again, 'NOT_FOUND', 'approving again does NOT re-show it: the request is decided and there is no open one');
t.ok(!String(JSON.stringify(again)).includes(temp), 'and the refusal carries no trace of the password');
/* No action anywhere can read a temporary password back. The devotee reset flow is the three below.
   `coordinators.resetPassword` and `facLogins.resetPassword` also exist, but they are a different thing:
   MASTER-only, for a STAFF login, and the master TYPES the password there — so there is nothing generated
   for them to disclose. Listed explicitly so a new reset action added later fails this and has to be
   thought about rather than quietly inheriting the name. */
const resetActions = Object.keys(ROUTES).filter(a => /reset/i.test(a)).sort();
t.eq(resetActions, ['auth.requestReset', 'coordinators.resetPassword', 'facLogins.resetPassword', 'resets.approve', 'resets.reject'],
     'the reset actions are exactly the five known ones — a new one must be reviewed against this decision');
for (const a of ['coordinators.resetPassword', 'facLogins.resetPassword']) {
  t.eq(ROUTES[a].roles, 'MASTER', `${a} is master-only`);
  t.ok(ROUTES[a].fields.includes('tempPassword'), `${a} takes a password typed by the master, so it generates nothing to leak`);
}

/* ───────── 6. it gets him in, once ───────── */

t.code(await call('auth.login', { login: BHIMA, password: PW }), 'BAD_CREDENTIALS', 'his old password no longer works');
const inNow = await call('auth.login', { login: BHIMA, password: temp });
t.code(inNow, 'ok', 'the temporary password signs him in');
t.eq(inNow.data.user.mustChangePassword, true, 'and the app is told he MUST change it before anything else');
t.eq(acct(BHIMA).must_change_pw, 1, 'the account carries the same flag, so a different app cannot skip it');

const B = inNow.data.token;
t.code(await call('auth.changePassword', { current: temp, new: 'Bhima new pass 2026' }, B), 'ok', 'he changes it');
t.eq(acct(BHIMA).must_change_pw, 0, 'the flag clears');
t.code(await call('auth.login', { login: BHIMA, password: temp }), 'BAD_CREDENTIALS',
       'and the temporary password is dead — overheard or forwarded, it is good for nothing now');

/* ───────── 7. expiry: an approval nobody collected ───────── */

await call('auth.requestReset', { login: ARJUN });
const old = await call('resets.approve', { login: ARJUN }, C);
t.code(old, 'ok', 'Arjun gets an approval the coordinator then forgets to hand over');
t.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(old.data.expiresAt), `with an expiry time (${old.data.expiresAt})`);
t.code(await call('auth.login', { login: ARJUN, password: old.data.tempPassword }), 'ok', 'inside the window it works');
// a day and a half later
DB.sql.exec(`UPDATE reset_requests SET temp_expires_at = '2026-10-04T10:00:00+05:30' WHERE login = '${ARJUN}' AND status = 'APPROVED'`);
t.code(await call('auth.login', { login: ARJUN, password: old.data.tempPassword }), 'RESET_EXPIRED',
       'past its 24 hours it is refused, with a message telling him to ask again');
t.code(await call('auth.login', { login: ARJUN, password: 'Some other guess' }), 'BAD_CREDENTIALS',
       'and a WRONG password on the same account still says BAD_CREDENTIALS — the expiry never tells a guesser they were close');

/* ───────── 8. a devotee cannot approve their own reset ───────── */

await call('auth.requestReset', { login: BHIMA });
const B2 = (await call('auth.login', { login: BHIMA, password: 'Bhima new pass 2026' })).data.token;
t.code(await call('resets.approve', { login: BHIMA }, B2), 'FORBIDDEN', 'a devotee cannot approve anything');
t.code(await call('resets.approve', { login: BHIMA }), 'UNAUTHENTICATED', 'and neither can a stranger with no token');

/* ───────── 9. rejecting changes nothing ───────── */

const held = acct(BHIMA).pw_hash;
await call('auth.requestReset', { login: BHIMA });
t.code(await call('resets.reject', { login: BHIMA }, C), 'ok', 'the coordinator rejects a request instead');
t.eq(acct(BHIMA).pw_hash, held, 'the password is untouched by a rejection');
t.eq(acct(BHIMA).must_change_pw, 0, 'and no forced change is imposed');

t.done();
