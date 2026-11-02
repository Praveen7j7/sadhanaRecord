// Actions no suite ever called SUCCESSFULLY (prompt-63's audit, 22 Oct 2026, G3): roles and security tests pinned them
// only as refusals, so a handler that threw on every call would have passed. Each is walked once here as the person who
// uses it. (criteria.set's happy path is in eligible.test.mjs.)
import { boot, suite } from './harness.mjs';

const t = suite('happy paths: reopen.reject, auth.logout, auth.sessions / auth.sessionEnd, auth.logoutAll');
const { DB, call, clock, rows, addAccount } = boot();
clock.now = Date.parse('2026-10-14T10:00:00+05:30');

await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await addAccount('6000000181', 'DEVOTEE', 'Devotee pass 2026');
const signIn = async () => (await call('auth.login', { login: '6000000181', password: 'Devotee pass 2026' })).data.token;

/* ── auth.logout: this device's session ends, and its token stops working ── */
{
  const tok = await signIn();
  t.code(await call('auth.me', {}, tok), 'ok', 'signed in, the token works');
  t.code(await call('auth.logout', {}, tok), 'ok', 'auth.logout answers');
  t.code(await call('auth.me', {}, tok), 'UNAUTHENTICATED', '… and the token no longer works');
  t.eq(rows("SELECT end_reason AS r FROM sessions WHERE login = '6000000181' AND ended_at <> ''").map(x => x.r), ['logout'],
    'the session is ended with its reason, not deleted');
}

/* ── auth.sessions / auth.sessionEnd: sign another device out from this one ── */
{
  const phone = await signIn(), laptop = await signIn();
  const list = await call('auth.sessions', {}, phone);
  t.code(list, 'ok', 'auth.sessions lists the devices');
  t.eq(list.data.devices.length, 2, 'two devices signed in');
  const other = list.data.devices.find(x => !x.thisOne);
  const r = await call('auth.sessionEnd', { id: other.id }, phone);
  t.code(r, 'ok', 'auth.sessionEnd signs the other device out');
  t.eq(r.data.thisOne, false, '… and says it was not this one');
  t.code(await call('auth.me', {}, laptop), 'UNAUTHENTICATED', 'the other device is signed out');
  t.code(await call('auth.me', {}, phone), 'ok', 'this one is not');
  t.code(await call('auth.sessionEnd', { id: other.id }, phone), 'NOT_FOUND', 'ending it twice says it is already signed out');

  /* ── auth.logoutAll: every device, this one included ── */
  const third = await signIn();
  const all = await call('auth.logoutAll', {}, phone);
  t.code(all, 'ok', 'auth.logoutAll answers');
  t.eq(all.data.devices, 2, 'it counts the devices it signed out (this phone and the third)');
  t.code(await call('auth.me', {}, phone), 'UNAUTHENTICATED', 'this device is signed out too');
  t.code(await call('auth.me', {}, third), 'UNAUTHENTICATED', '… and every other');
}

/* ── reopen.reject: the head turns down a coordinator's request ── */
{
  // a request as the coordinator files it, straight into the table: the asking is tested in coord.test.mjs
  DB.sql.exec(`INSERT INTO reopen_requests (login, week_id, batch_id, reason, by, at)
                VALUES ('6000000181', '2026-10-05', 'SPS', 'Was travelling', 'sps', '2026-10-13T10:00:00+05:30')`);
  t.eq((await call('reopen.list', {}, M)).data.requests.length, 1, 'the head sees the request');
  t.code(await call('reopen.reject', { login: '6000000181', weekId: '2026-10-05', reason: 'Filled by the coordinator instead' }, M), 'ok',
    'the head rejects it');
  t.eq((await call('reopen.list', {}, M)).data.requests, [], 'it leaves the list');
  t.eq(rows("SELECT reason FROM audit_log WHERE action = 'reopen.reject'").map(x => x.reason), ['Filled by the coordinator instead'],
    'audited, with the reason');
  t.code(await call('reopen.reject', { login: '6000000181', weekId: '2026-10-05', reason: 'again' }, M), 'NOT_FOUND',
    'rejecting it again finds nothing to reject');
}

t.done();
