// The master-password recovery: applied once, forces a change, ends sessions, audited; weak values refused.
import { boot, suite } from './harness.mjs';
import { applyMasterReset } from '../src/setup.js';

const t = suite('master password recovery');
const { env, DB, call, rows, addAccount } = boot();
await addAccount('master', 'MASTER', 'Original master 1', { name: 'IYF Head' });
const T = (await call('auth.login', { login: 'master', password: 'Original master 1' })).data.token;

t.eq(await applyMasterReset(env, DB), 'no reset requested', 'nothing happens without the secret');
env.MASTER_RESET_PASSWORD = 'krishna';
t.ok((await applyMasterReset(env, DB)).startsWith('MASTER_RESET_PASSWORD not used'), 'a weak or common value is refused');
env.MASTER_RESET_PASSWORD = 'Recovery Pass 2026';
t.eq(await applyMasterReset(env, DB), 'master password reset; must change at next login', 'reset applied');
t.code(await call('auth.me', {}, T), 'UNAUTHENTICATED', 'open master sessions ended');
t.code(await call('auth.login', { login: 'master', password: 'Original master 1' }), 'BAD_CREDENTIALS', 'old password no longer works');
const r = await call('auth.login', { login: 'master', password: 'Recovery Pass 2026' });
t.ok(r.ok && r.data.user.mustChangePassword, 'temporary password works and must be changed');
t.code(await call('auth.changePassword', { current: 'Recovery Pass 2026', new: 'My own master 2026' }, r.data.token), 'ok', 'head chooses their own');
t.eq(await applyMasterReset(env, DB), 'already applied; delete the MASTER_RESET_PASSWORD secret', 'the same secret is never applied twice');
t.code(await call('auth.login', { login: 'master', password: 'My own master 2026' }), 'ok', 'so the new own password stays');
t.eq(rows("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'setup.resetMasterPassword'")[0].n, 1, 'audited once');
t.ok(!rows("SELECT value FROM settings WHERE key = 'master_reset_applied'")[0].value.includes('Recovery'), 'only a hash of the secret is kept');

// no master yet: created
const fresh = boot();
fresh.env.MASTER_RESET_PASSWORD = 'First master pass 1';
t.eq(await applyMasterReset(fresh.env, fresh.DB), 'master account created; must change at next login', 'creates the master when missing');
t.code(await fresh.call('auth.login', { login: 'master', password: 'First master pass 1' }), 'ok', 'and it can log in');
t.done();
