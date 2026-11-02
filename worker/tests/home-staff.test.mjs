// The head's Home in one request (Phase 6): `home.staff` must answer, part for part, exactly what the eight actions it
// replaces answer on their own — the screen caches each part under that action's name, so any difference would show
// a different screen depending on which way you came in. Parity first, then the gate.
import { boot, suite } from './harness.mjs';

const t = suite('home.staff: the head\'s Home in one request, the same answers as its eight reads');
const { DB, call, clock, addAccount } = boot();
clock.now = Date.parse('2026-10-14T10:00:00+05:30');
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
await call('coordinators.create', { username: 'spshs', name: 'Sps Home', batchIds: ['SPS'], tempPassword: 'Temp-spshs-2026' }, M);
DB.sql.exec("UPDATE accounts SET must_change_pw = 0 WHERE login = 'spshs'");
const C = (await call('auth.login', { login: 'spshs', password: 'Temp-spshs-2026' })).data.token;
// something in the lists: a devotee with a membership and a missed week, a reopen request
DB.sql.exec(`INSERT INTO accounts (login, role, status, name, phone, pw_hash, pw_salt, pw_iterations, signed_up_at, updated_at, updated_by)
  VALUES ('6000000251', 'DEVOTEE', 'ACTIVE', 'Vasu Dev', '6000000251', 'x', 'y', 1, '2026-09-01', '2026-09-01', 'test')`);
DB.sql.exec(`INSERT INTO memberships (login, batch_id, state, from_week, set_by, set_at) VALUES ('6000000251', 'SPS', 'ACTIVE', '2026-09-07', 'test', '2026-09-01')`);
DB.sql.exec(`INSERT INTO missed_weeks (login, week_id, batch_id, days_filled, at) VALUES ('6000000251', '2026-10-05', 'SPS', 0, '2026-10-12T21:00:00+05:30')`);
DB.sql.exec(`INSERT INTO reopen_requests (login, week_id, batch_id, reason, by, at) VALUES ('6000000251', '2026-10-05', 'SPS', 'was ill', 'spshs', '2026-10-13T09:00:00+05:30')`);

const r = await call('home.staff', {}, M);
t.code(r, 'ok', 'the head opens Home in one request');
const one = async (a, d = {}) => (await call(a, d, M)).data;
const strip = (x) => JSON.parse(JSON.stringify(x));
t.eq(strip(r.data.requests), strip(await one('requests.list')), 'sign-ups and resets: the same as requests.list');
t.eq(strip(r.data.reopens), strip(await one('reopen.list')), 'reopen requests: the same as reopen.list');
t.eq(r.data.reopens.requests.length, 1, '(and there is one to see)');
t.eq(strip(r.data.reports), strip(await one('announcements.reports')), 'reported posts: the same as announcements.reports');
t.eq(strip(r.data.heads), strip(await one('heads.requests')), 'new-head requests: the same as heads.requests');
t.eq(strip(r.data.settings), strip(await one('settings.get')), 'settings: the same as settings.get');
t.eq(strip(r.data.batches), strip(await one('batches.list')), 'batches: the same as batches.list');
t.eq(strip(r.data.runlog), strip(await one('runlog.list', { limit: 100 })), 'the slow-call log: the same as runlog.list');
t.eq(strip(r.data.stats), strip(await one('stats.all', { weeks: 8 })), "the batches' weeks: the same as stats.all over 8 weeks");
t.eq(strip(r.data.orphans), strip(await one('facilitators.orphans')), 'students who need a facilitator: the same as facilitators.orphans');
t.ok(r.data.stats.batches.every((b) => b.trend.length === 8), 'eight weeks of trend per batch, for the bars and week-on-week change');
t.code(await call('home.staff', { weeks: 9 }, M), 'VALIDATION', 'at most eight weeks');
t.code(await call('home.staff', {}, C), 'FORBIDDEN', "it is the head's Home");
t.done();
