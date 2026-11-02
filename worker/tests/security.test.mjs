// The security review's fixes (2 Oct 2026): atomic lockout, per-network limits, approval dates, headers.
import { boot, suite , FAC, LEAD, CONTACT } from './harness.mjs';
import { PER_IP } from '../src/auth.js';
import worker from '../src/index.js';

const t = suite('security review fixes');
const { call, clock, rows, addAccount, env } = boot();
await addAccount('master', 'MASTER', 'Master pass 2026');
await addAccount('sps', 'COORDINATOR', 'Coordinator pass 1');

// lockout: 8 wrong passwords at the same moment are all counted (was: each read the same count)
const burst = await Promise.all(Array.from({ length: 8 }, () => call('auth.login', { login: 'sps', password: 'wrong guess 1' })));
t.ok(burst.some(r => r.error?.code === 'LOCKED_OUT'), 'a burst of wrong passwords locks the account');
t.code(await call('auth.login', { login: 'sps', password: 'Coordinator pass 1' }), 'LOCKED_OUT', 'and the right one waits');
clock.now += 16 * 60000;
t.code(await call('auth.login', { login: 'sps', password: 'Coordinator pass 1' }), 'ok', 'open again after 15 minutes');

// per-network limits (lowered here so the test is short)
PER_IP.login = [3, 600];
for (let i = 0; i < 3; i++) await call('auth.login', { login: 'nobody1', password: 'x guess 123' }, undefined, { ip: '203.0.113.9' });
t.code(await call('auth.login', { login: 'master', password: 'Master pass 2026' }, undefined, { ip: '203.0.113.9' }), 'BUSY', 'too many logins from one network: told to wait');
t.code(await call('auth.login', { login: 'master', password: 'Master pass 2026' }, undefined, { ip: '198.51.100.7' }), 'ok', 'another network is not affected');
clock.now += 11 * 60000;
t.code(await call('auth.login', { login: 'master', password: 'Master pass 2026' }, undefined, { ip: '203.0.113.9' }), 'ok', 'the first network can try again after the window');
PER_IP.signUp = [1, 3600];
const su = (phone) => call('auth.signUp', { phone, name: 'Net Test', batchId: 'SPS2', facilitator: FAC, ...CONTACT, groupLeader: LEAD.SPS2, password: 'Network test 2026',
  profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000035' }, address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } }, undefined, { ip: '203.0.113.50' });
t.code(await su('6000000038'), 'ok', 'first sign-up from a network');
t.code(await su('6000000039'), 'BUSY', 'more than the limit from one network: told to wait');
t.eq(rows("SELECT COUNT(*) AS n FROM accounts WHERE login = '6000000039'")[0].n, 0, 'and nothing was written');

// approval: no level-entry date in the future
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
t.code(await call('requests.approve', { phone: '6000000038', link: { noIdYet: true }, levelEntryDate: '2026-12-01' }, M), 'VALIDATION', 'future level-entry date refused');
t.code(await call('requests.approve', { phone: '6000000038', link: { noIdYet: true }, levelEntryDate: '2026-10-01' }, M), 'ok', 'a past date is fine');

// headers and CORS on the real entry point
const env2 = { ...env, ALLOWED_ORIGINS: 'https://app.example' };
const ctx = { waitUntil() {} };
const hit = origin => worker.fetch(new Request('https://api.example/', { method: 'POST', headers: { origin, 'content-type': 'text/plain' }, body: JSON.stringify({ v: 1, action: 'meta.get', data: {} }) }), env2, ctx);
const good = await hit('https://app.example'), evil = await hit('https://evil.example');
t.eq(good.headers.get('access-control-allow-origin'), 'https://app.example', 'the app is allowed');
t.eq(evil.headers.get('access-control-allow-origin'), null, 'other websites are not');
t.eq(good.headers.get('x-content-type-options'), 'nosniff', 'nosniff header');
t.eq(good.headers.get('cache-control'), 'no-store', 'answers are never cached');
t.done();
