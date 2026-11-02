// Phase 6: the batch view sheets are kept step by step (src/views.js, migration 0020). After every kind of change the
// sheet (a live model in the fake Google) must equal buildView() — the full build — cell for cell, and a step must write
// only what changed.
import { boot, suite } from './harness.mjs';
import { refreshOneView, buildView, VIEWS } from '../src/views.js';
import { focusWeek } from '../src/coord.js';
import FILES from '../../setup/files.json' with { type: 'json' };

const t = suite('batch view sheets: incremental, equal to a full build');
const { env, DB, rows, google, clock } = boot();
const s = DB.sql;
const at = (x) => { clock.now = Date.parse(x + '+05:30'); };
const wk = (w0, i) => new Date(Date.parse(w0 + 'T00:00:00Z') - i * 7 * 864e5).toISOString().slice(0, 10);
const changes = () => s.prepare('SELECT total_changes() AS n').get().n;

const day = { sleptAt: '22:15', wokeAt: '04:35', dayRestMin: 30, rounds: 16, chantingSameDay: true, chantingDoneAt: '07:10', hearingMin: 30, readingMin: 20, serviceMin: 45, hearing: [{ text: 'Bhagavad-gita class' }], reading: { text: 'Nectar of Devotion' } };
const marks = Array(7).fill({ to_bed: { label: '10:00 - 10:15 PM', marks: 25 }, wake_up: { label: '04:30 - 04:45 AM', marks: 25 }, japa: { label: '06:45 - 07:15 AM', marks: 20 }, day_sleep: { label: '1 hr or less', marks: 25 } });
let n = 0;
function devotee(name, batch) {
  const login = String(6000000075 + ++n);
  s.prepare("INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations) VALUES (?, 'DEVOTEE', 'ACTIVE', ?, 'x', 'x', 1)").run(login, name);
  s.prepare("INSERT INTO memberships (login, batch_id, state, from_week, class_day) VALUES (?, ?, 'ACTIVE', '2026-01-05', 'SUN')").run(login, batch);
  return { login, name, batch };
}
function submit(d, week, score = 80) {
  s.prepare(`INSERT INTO submissions (submission_id, login, name, batch_id, week_id, submitted_at, submitted_by, request_id, rules_version, bed, wake_up, day_sleep, japa, pathan, sravan, seva, attendance, body, soul, overall, seva_minutes, avg_rounds, night_stay, principles, hearing_minutes, reading_minutes, days_json, marks_json)
    VALUES (?, ?, ?, ?, ?, '2026-10-04T19:00:00+05:30', ?, ?, 'r1', ?, 80, 80, 80, 80, 80, 80, 100, 80, 80, 87, 300, '16', 'YES', 'NO', 210, 140, ?, ?)`)
    .run(`${d.login}-${week}`, d.login, d.name, d.batch, week, d.login, `rq-${d.login}-${week}`, score, JSON.stringify(Array(7).fill(day)), JSON.stringify(marks));
}
const mark = (d, week, m) => s.prepare(`INSERT INTO attendance (login, week_id, batch_id, coordinator_mark, mark_used, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, 'sps', '2026-10-05T10:00:00+05:30')
  ON CONFLICT(login, week_id) DO UPDATE SET coordinator_mark = excluded.coordinator_mark, mark_used = excluded.mark_used`).run(d.login, week, d.batch, m, m);

/** Runs view steps until all are current; returns the reports. */
async function settle(limit = 400) {
  const out = [];
  for (let i = 0; i < limit; i++) { const r = await refreshOneView(env, DB, new Date(clock.now)); if (!r) return out; out.push(r); }
  throw new Error('views never settled: ' + out.slice(-5).join(' | '));
}
const norm = (rowsIn) => { const r = rowsIn.map(x => x.map(v => (v === null || v === undefined ? '' : v))); while (r.length && r[r.length - 1].every(v => v === '')) r.pop(); return r; };
async function matches(label) {
  const focus = await focusWeek(DB, new Date(clock.now));
  for (const view of VIEWS) {
    const batches = rows('SELECT batch_id, name FROM batches WHERE level = ? ORDER BY rowid', view.slice(4));
    const want = await buildView(DB, batches, focus);
    for (const tab of ['This week', 'Scores', 'Days', 'Week-end']) {
      const got = norm((google.state.tab(FILES[view], tab)?.rows || [['header']]).slice(1)), exp = norm(want[tab]);
      if (JSON.stringify(got) !== JSON.stringify(exp)) {
        const i = got.findIndex((r, k) => JSON.stringify(r) !== JSON.stringify(exp[k]));
        t.ok(false, `${label}: ${view} › ${tab} differs (rows ${got.length} vs ${exp.length}; first difference at ${i}: ${JSON.stringify(got[i])} vs ${JSON.stringify(exp[i])})`);
        return;
      }
    }
  }
  t.ok(true, `${label}: all four views equal a full build`);
}

// ---- a batch history: 3 batches in the SPS view, 1 in DPS, 9 weeks of submissions with gaps
at('2026-10-14T12:00:00');                                   // Wednesday: the focus week is 12 Oct
const W = '2026-10-12';
const names = ['Madhav Das', 'Arjun Mehta', 'Bhima Rao', 'Gopal Sharma', 'Yash Verma', 'Chaitanya Jha', 'Keshav Rai', 'Nitai Sen'];
const people = names.map((nm, i) => devotee(nm, ['SPS', 'SPS2', 'SPSO'][i % 3]));
const dps = ['Hari Prasad', 'Damodar Iyer'].map(nm => devotee(nm, 'DPS'));
for (let w = 1; w <= 9; w++) people.forEach((d, i) => { if ((i + w) % 4) submit(d, wk(W, w), 60 + w + i); });
dps.forEach(d => [1, 2].forEach(w => submit(d, wk(W, w))));
mark(people[0], wk(W, 1), 'A'); mark(people[3], wk(W, 1), 'P');
s.prepare("INSERT INTO drafts (login, week_id, batch_id, d1, created_at, updated_at, updated_by) VALUES (?, ?, 'SPS', ?, '', '2026-10-13T08:00:00+05:30', 'x')").run(people[0].login, W, JSON.stringify({ ...day, v: 1 }));
let rep = await settle();
t.ok(rep.filter(r => /emptied/.test(r)).length === 4, `first run: every view emptied and rebuilt step by step (${rep.length} steps)`);
await matches('history placed');

// ---- one new submission in the middle of the alphabet: three inserts, no clear, nothing else rewritten
google.writes.length = 0;
submit(people[4], W);                                        // Yash Verma, the focus week
let c0 = changes();
clock.now += 11 * 60e3;                                      // This week: rewritten at most every 10 minutes
rep = await settle();
const reqs = google.writes.filter(w => w.url.endsWith(':batchUpdate')).flatMap(w => w.body.requests);
t.eq([reqs.filter(r => r.insertDimension).length, google.writes.some(w => w.url.endsWith('values:batchClear'))], [3, false], 'one new submission: a row inserted in Scores, Week-end and Days, nothing cleared');
t.ok(reqs.filter(r => r.updateCells).every(r => r.updateCells.rows.length <= 7 || r.updateCells.start.sheetId === 100), 'only the new rows (and changed This-week rows) are written');
t.ok(changes() - c0 <= 12, `database writes for that step: ${changes() - c0}`);
await matches('a new submission');

// ---- a late submission for an older week, an attendance mark after submitting, a new member, a name change
submit(people[5], wk(W, 3));                                 // Chaitanya Jha had skipped week 3
mark(people[1], wk(W, 2), 'P'); mark(people[5], wk(W, 1), 'A');
const late = devotee('Aarav Khanna', 'SPS2'); submit(late, W);
s.prepare("UPDATE accounts SET name = 'Gopal Krishna Sharma' WHERE login = ?").run(people[3].login);
clock.now += 11 * 60e3;
rep = await settle();
t.ok(rep.some(r => /attendance written/.test(r)) && rep.some(r => /placed/.test(r)), 'late submission placed, attendance weeks rewritten');
await matches('late submission, attendance marks, new member, renamed');

// ---- nothing changed: nothing written
google.writes.length = 0; c0 = changes();
t.eq(await refreshOneView(env, DB, new Date(clock.now)), '', 'all current: no step');
t.eq([google.writes.length, changes() - c0], [0, 0], 'and nothing written anywhere');

// ---- a new week: the oldest weeks leave (Scores / Week-end keep 12, Days keep 4)
at('2026-10-21T12:00:00');
submit(people[6], '2026-10-19');
rep = await settle();
t.ok(rep.some(r => /new week 2026-10-19/.test(r)), 'the new week rolls the views');
await matches('one week later');
at('2026-11-04T12:00:00');
rep = await settle();
await matches('three weeks later (Days trimmed)');
at('2027-01-20T12:00:00');
rep = await settle();
await matches('three months later (everything old has left)');
t.eq(google.state.tab(FILES.viewSPS, 'Scores').rows.slice(1).filter(r => r.length && r.some(v => v !== '')).length, 0, 'Scores is empty once every week is older than 12 weeks');

// ---- a repair: a view set back to build comes back the same
await refreshOneView(env, DB, new Date(clock.now));
s.prepare("UPDATE view_state SET mode = 'build' WHERE view = 'viewDPS'").run();
at('2026-10-14T12:00:00');
s.prepare("UPDATE view_state SET mode = 'build'").run();
rep = await settle();
await matches('rebuilt from empty');
t.done();
