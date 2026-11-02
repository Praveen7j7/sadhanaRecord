// C1 (COPIES_AND_SPEED_AUDIT_2026-10-27, migration 0075): while the Sheets copy is paused, a change writes NO mirror_log
// row; switching the copy back on re-copies every tab whole, so nothing changed while it was off can be skipped.
//   · every mirror trigger in force carries the switch (src/mirror.js COPY_ON) — a new one without it fails here
//   · 0075 changes nothing in any trigger but that WHEN (same event, table, body and old condition as after 0074)
//   · the rows a devotee's week writes, copy off against copy on
//   · resuming: switch on → whole copies; a change made while paused reaches the sheet; switch off → quiet again
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { boot, suite, FAC, LEAD, CONTACT } from './harness.mjs';
import { COPY_ON, syncCopySwitch, mirrorChanged, MIRRORS } from '../src/mirror.js';
import worker from '../src/index.js';

const t = suite('C1: the paused Sheets copy is quiet, and resumes by a whole copy');
const MIG = new URL('../migrations/', import.meta.url);
const files = fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort();
const build = (pick) => { const db = new DatabaseSync(':memory:'); for (const f of files.filter(pick)) db.exec(fs.readFileSync(new URL(f, MIG), 'utf8')); return db; };
const mirrorTriggers = (db) => db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND sql LIKE '%INSERT INTO mirror_log%' ORDER BY name").all();
const norm = (s) => String(s).replace(/\s+/g, ' ').trim().replace(/;$/, '').replace(/;?\s*END$/, '; END');

// ---- the schema: every mirror trigger in force reads the switch ----
const now = mirrorTriggers(build(() => true));
t.ok(now.length >= 112, `${now.length} mirror triggers in force`);
t.eq(now.filter(x => !x.sql.includes(COPY_ON)).map(x => x.name), [], 'every one of them is guarded by the copy switch');

// ---- 0075 adds the switch and nothing else ----
const before = new Map(mirrorTriggers(build(f => f < '0075')).map(x => [x.name, norm(x.sql)]));
const RE = /^CREATE TRIGGER (\w+) (AFTER (?:INSERT|UPDATE|DELETE) ON \w+)(?: WHEN ([\s\S]*?))? BEGIN ([\s\S]*) END$/;
const in75 = fs.readFileSync(new URL('0075_mirror_quiet.sql', MIG), 'utf8').split('\n').filter(l => l.startsWith('CREATE TRIGGER'));
let same = 0;
const drift = [];
for (const line of in75) {
  const m = RE.exec(norm(line)), old = before.get(m?.[1]);
  const o = old && RE.exec(old);
  const want = o ? `CREATE TRIGGER ${o[1]} ${o[2]} WHEN ${o[3] ? `(${o[3]}) AND ` : ''}${COPY_ON} BEGIN ${o[4]} END` : null;
  if (want && norm(want) === norm(line)) same++; else drift.push(m?.[1] || line.slice(0, 60));
}
t.eq(drift, [], '0075 re-creates each trigger exactly as it was after 0074, with only the switch added (re-run the generator if 0074 changed one)');
t.eq([same, in75.length], [before.size, before.size], `all ${before.size} mirror triggers in force before 0075 are re-created by it, none more`);

// ---- the duplicate indexes ----
const idx = build(() => true).prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map(r => r.name);
t.ok(!idx.includes('reset_requests_by_login') && idx.includes('idx_reset_login_status'), 'reset_requests keeps one (login, status) index, not two');
t.ok(!idx.includes('activity_events_day') && idx.includes('activity_events_day_how'), 'activity_events keeps (day, how, login), which serves every day lookup');

// ---- rows written for one devotee's week: sign-in, seven days, week-end, attendance, submit ----
async function week(copy) {
  const { DB, call, clock, addAccount } = boot({ copy });
  const at = (s) => { clock.now = Date.parse(s + '+05:30'); };
  at('2026-09-28T09:00:00');
  await addAccount('master', 'MASTER', 'Master pass 2026');
  const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
  const phone = '6000000191';
  await call('auth.signUp', { phone, name: 'Week Devotee', batchId: 'SPS', facilitator: FAC, ...CONTACT, groupLeader: LEAD.SPS, password: 'Devotee pass 2026',
    profile: { dob: '2001-01-01', bloodGroup: 'O+', emergency: { name: 'Some One', relation: 'Friend', phone: '6000000192' },
               address: { line: 'House 12, Gali 3', area: 'Punjabi Bagh', city: 'West Delhi', state: 'Delhi', pin: '110026' } } });
  await call('requests.approve', { phone, link: { noIdYet: true } }, M);
  DB.sql.exec("UPDATE settings SET value = '2026-09-21' WHERE key = 'tracking_from'");
  const tc = () => DB.sql.prepare('SELECT total_changes() AS n').get().n, ml = () => DB.sql.prepare('SELECT COUNT(*) AS n FROM mirror_log').get().n;
  const t0 = tc(), m0 = ml(), oks = [];
  const T = (await call('auth.login', { login: phone, password: 'Devotee pass 2026' })).data.token;
  const day = { sleptAt: '22:05', wokeAt: '04:35', rounds: 16, chantingDoneAt: '06:50', chantingSameDay: true, dayRestMin: 30, hearingMin: 0, readingMin: 0, serviceMin: 60 };
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.parse('2026-09-28T00:00:00Z') + i * 864e5).toISOString().slice(0, 10);
    at(d + 'T21:00:00');
    oks.push((await call('week.saveDay', { weekId: '2026-09-28', date: d, version: 0, day }, T)).ok);
  }
  at('2026-10-04T19:00:00');
  oks.push((await call('week.saveWeekEnd', { weekId: '2026-09-28', version: 0, nightStay: 'YES', principles: 'YES' }, T)).ok);
  oks.push((await call('week.setAttendance', { weekId: '2026-09-28', mark: 'P' }, T)).ok);
  oks.push((await call('week.submit', { weekId: '2026-09-28' }, T)).ok);
  return { ok: oks.every(Boolean), rows: tc() - t0, log: ml() - m0, submitted: DB.sql.prepare('SELECT COUNT(*) AS n FROM submissions').get().n };
}
const on = await week('on'), off = await week('off');
t.ok(on.ok && off.ok && on.submitted === 1 && off.submitted === 1, 'the same week is saved and submitted both ways');
t.ok(on.log > 0, `copy ON: the week queues ${on.log} change-log rows of its ${on.rows} rows written`);
t.eq(off.log, 0, 'copy OFF (live): the week queues no change-log row');
t.eq(off.rows, on.rows - on.log, `copy OFF: ${off.rows} rows written instead of ${on.rows} — exactly the queue rows fewer`);
console.log(`  rows written for a devotee's week: copy on ${on.rows} (${on.log} mirror_log) → copy off ${off.rows}`);

// ---- resuming: a change made while paused reaches the sheet; nothing is replayed from the old queue ----
{
  const { env, DB, google, rows } = boot({ copy: 'off' });
  const add = (login, name) => DB.sql.exec(`INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations, must_change_pw) VALUES ('${login}', 'DEVOTEE', 'ACTIVE', '${name}', 'h', 's', 1000, 0)`);
  DB.sql.exec("INSERT INTO mirror_log (tbl, k1, k2) VALUES ('accounts', 'old-queued', '')");          // a queue left from before 0075
  const q0 = rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n;
  add('6000000193', 'Paused Person');
  t.eq(rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n, q0, 'paused: a new account queues nothing');
  // the schedule with SHEETS_COPY on: the switch AND the whole copies, in one batch
  env.SHEETS_COPY = 'on';
  await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.parse('2026-10-07T10:05:00+05:30') }, env, { waitUntil: (p) => p });
  t.eq(rows('SELECT state FROM mirror_switch')[0].state, 'on', 'SHEETS_COPY on: the next run switches the triggers on');
  const keyed = Object.keys(MIRRORS).filter(x => MIRRORS[x][2] === 'keyed');
  const st = Object.fromEntries(rows('SELECT tbl, mode, dirty FROM mirror_state').map(r => [r.tbl, r]));
  t.ok(keyed.every(x => st[x] && (st[x].mode === 'build' || st[x].mode === 'live')), 'every row-by-row tab is being (or has been) copied whole');
  add('6000000194', 'Resumed Person');
  t.ok(rows("SELECT COUNT(*) AS n FROM mirror_log WHERE k1 = '6000000194'")[0].n > 0, 'a change after the switch is queued again');
  for (let i = 0; i < 30 && (await mirrorChanged(env, DB)).length; i++);
  const sent = JSON.stringify(google.writes.map(w => w.body));
  t.ok(sent.includes('Paused Person'), 'the account made while the copy was paused reaches the Accounts tab (whole copy)');
  t.ok(sent.includes('Resumed Person'), '… and so does the one made after it was switched on');
  t.ok(rows("SELECT last_id FROM mirror_state WHERE tbl = 'mirror_log'")[0].last_id >= rows("SELECT MAX(id) AS n FROM mirror_log WHERE k1 = 'old-queued'")[0].n,
    'the queue from before the pause was skipped, not replayed (the whole copies cover it)');
  t.ok(rows("SELECT COUNT(*) AS n FROM mirror_state WHERE mode = 'build' AND tbl IN (" + keyed.map(x => `'${x}'`).join(',') + ')')[0].n === 0, 'the whole copies finish');
  // and off again
  env.SHEETS_COPY = 'off';
  await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.parse('2026-10-07T10:06:00+05:30') }, env, { waitUntil: (p) => p });
  t.eq(rows('SELECT state FROM mirror_switch')[0].state, 'off', 'SHEETS_COPY off: the next run switches the triggers off');
  const q1 = rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n;
  add('6000000195', 'Quiet Again');
  t.eq(rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n, q1, '… and a change queues nothing again');
  t.eq(await syncCopySwitch(DB, false), '', 'a run that finds the switch already right writes nothing');
}

t.done();
