// The per-run caps in one place (22 Oct 2026, G5): free-plan numbers by default, raised only by a well-formed
// LIMIT_<NAME> var within its ceiling, applied by the Worker's entry points and read by the runs themselves.
import { boot, suite } from './harness.mjs';
import { FREE, LIMITS, useLimits } from '../src/limits.js';
import { runRetention, CHUNK } from '../src/retention.js';
import { PER_RUN } from '../src/push.js';
import worker from '../src/index.js';

const t = suite('per-run limits (free → paid is a [vars] edit)');

// ---- the free plan is what everything runs on unless told otherwise
useLimits({});
t.eq({ ...LIMITS }, { ...FREE }, 'no LIMIT_* var: every cap is the free-plan number');
t.eq([PER_RUN, CHUNK], [35, 500], 'the numbers the modules exported before are unchanged');

// ---- a var raises one cap; a bad one is ignored, never half-applied
useLimits({ LIMIT_PUSH_PER_RUN: '200' });
t.eq(LIMITS.PUSH_PER_RUN, 200, 'LIMIT_PUSH_PER_RUN = "200" raises the push cap');
t.eq(LIMITS.RETENTION_CHUNK, FREE.RETENTION_CHUNK, '… and only that one');
for (const bad of ['abc', '0', '-5', '2.5', '', '100000']) {
  useLimits({ LIMIT_PUSH_PER_RUN: bad });
  t.eq(LIMITS.PUSH_PER_RUN, FREE.PUSH_PER_RUN, `a malformed or out-of-range value ("${bad}") keeps the free number`);
}

// ---- the runs read the cap when they run: a night's retention erases LIMITS.RETENTION_CHUNK rows a log
const { DB, clock, rows } = boot();
clock.now = Date.parse('2026-10-09T12:00:00+05:30');
DB.sql.exec('DELETE FROM audit_log');
for (let i = 0; i < 60; i++) DB.sql.exec("INSERT INTO audit_log (at, who, role, action) VALUES ('2026-01-05T10:00:00+05:30', 'x', 'MASTER', 'test.old')");
DB.sql.exec("UPDATE mirror_state SET last_id = (SELECT MAX(id) FROM audit_log) WHERE tbl = 'audit_log'");
useLimits({ LIMIT_RETENTION_CHUNK: '25' });
await runRetention(DB, new Date(clock.now));
t.eq(rows("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'test.old'")[0].n, 35, 'with LIMIT_RETENTION_CHUNK = "25", one run erases 25 old rows, not 500');

// ---- the Worker applies its env on every invocation, so a var takes effect without a code change
const { env } = boot();
const ctx = { waitUntil() {} };
await worker.fetch(new Request('https://api.example/', { method: 'GET' }), { ...env, LIMIT_ERASE_PER_RUN: '80' }, ctx);
t.eq(LIMITS.ERASE_PER_RUN, 80, 'a request applies the deployment’s LIMIT_* vars');
await worker.fetch(new Request('https://api.example/', { method: 'GET' }), env, ctx);
t.eq({ ...LIMITS }, { ...FREE }, '… and a deployment without them runs on the free numbers');

t.done();
