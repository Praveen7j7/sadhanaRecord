// Phase 4 (13 Oct 2026, your decision): the copy TO Google Sheets is paused, and the read FROM the dashboard is not.
//
// The app is the system of record now. Coordinators use the Batch board, Members and Stats screens; a file comes
// from the export screen; anything unusual is a query. So the four jobs that write to Google are off behind
// `SHEETS_COPY`, while the 30-minute read of the dashboard's Devotees tab stays on, because IYF allocates IYF IDs
// and facilitator names there and the app still has to learn them.
//
// Nothing is deleted. Since migration 0075 (27 Oct 2026) the run also keeps mirror_switch equal to the flag, so a
// paused copy queues nothing, and switching the flag back on re-copies every tab whole (tests/mirror-quiet.test.mjs).
// These assertions are what stop the pause being a silent breakage, and what will stop someone "tidying up" the
// paused modules later.
import { boot, suite } from './harness.mjs';
import worker from '../src/index.js';

const t = suite('phase 4: the Sheets copy is paused, the dashboard read is not');

// Every Google call the Worker makes in a run, recorded by URL so direction can be told apart.
const run = async ({ sheetsCopy }) => {
  const { env, DB, google, rows } = boot();
  env.SHEETS_COPY = sheetsCopy;
  // something to copy: a devotee, which the triggers log for the Accounts tab
  DB.sql.exec("INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations, must_change_pw) VALUES ('6000000181','DEVOTEE','ACTIVE','Devotee Mirror','h','s',1000,0)");
  const queued = rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n;
  /* A minute that is not :00 or :30, so the branch under test is the copy and not the registry refresh.
     Then ALSO an hour boundary, because the paused status is written once an hour rather than once a minute
     (14 Oct 2026): counting the backlog every minute is what spent D1's whole daily read allowance and took
     the live app down twice. Both runs together prove the pause holds every minute AND still reports. */
  await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.parse('2026-10-07T10:05:00+05:30') }, env, { waitUntil: (p) => p });
  const statusAt05 = rows("SELECT value FROM settings WHERE key = 'mirror_status'")[0]?.value || '';
  // 11:31 IST is UTC minute 1 (the code reads getUTCMinutes, and IST is offset by 30 minutes)
  await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.parse('2026-10-07T11:31:00+05:30') }, env, { waitUntil: (p) => p });
  const urls = google.writes.map((w) => w.url);
  return {
    statusAt05,
    queued,
    stillQueued: rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n,
    status: rows("SELECT value FROM settings WHERE key = 'mirror_status'")[0]?.value || '',
    position: rows("SELECT last_id FROM mirror_state WHERE tbl = 'mirror_log'")[0]?.last_id ?? -1,
    switch: rows('SELECT state FROM mirror_switch')[0]?.state,
    writes: urls.filter((u) => /batchUpdate|:append|batchClear/.test(u)).length,
  };
};

// ---- paused (the default) ----
const off = await run({ sheetsCopy: undefined });
t.ok(off.queued > 0, `a change queues for the copy as always (${off.queued} entries)`);
t.eq(off.writes, 0, 'with the flag unset, the run makes NO write to Google');
// the queue only ever grows while the copy is paused (the deadline job in the same run writes rows too), and
// crucially nothing is consumed: the position marker does not move
t.ok(off.stillQueued >= off.queued, `… and nothing is consumed from the queue (${off.queued} → ${off.stillQueued})`);
t.eq(off.position, 0, '… the copy\'s position marker has not moved');
t.eq(off.switch, 'off', '… and the run switched the mirror triggers off (migration 0075), so nothing more is queued');
t.ok(/paused/.test(off.status), `… and mirror_status says so, on the hour: "${off.status}"`);
/* The status is NOT rewritten every minute. It reads the backlog, which means counting mirror_log, and at
   8,588 entries that one line read 102.7% of D1's free daily allowance (Cloudflare's own figures, 14 Oct
   2026). Hourly is 1/60th of that and nobody acts on the number between hours. */
t.eq(off.statusAt05, '', 'and it is NOT written at minute 5: counting the backlog every minute is what broke the live app');
t.ok(/system of record/.test(off.status), '… in words an operator can act on');

const explicitlyOff = await run({ sheetsCopy: 'off' });
t.eq(explicitlyOff.writes, 0, 'SHEETS_COPY="off" is the same as unset');

// ---- switched back on ----
const on = await run({ sheetsCopy: 'on' });
t.ok(on.writes > 0, `SHEETS_COPY="on" copies again (${on.writes} Google writes in one run)`);
// a first copy rebuilds whole tables rather than draining entries, so what proves work happened is the position
// marker moving off zero
t.ok(on.position > 0, `and the copy's position advances (${on.position})`);
t.ok(!/paused/.test(on.status), `… and the status is no longer "paused": "${on.status}"`);
t.ok(/ok/.test(on.status), '… it reports the copy');

// ---- the inbound read of the dashboard is retired (the head, 27 Oct 2026): the half-hour run reads nothing either ----
const { env, DB, google, rows } = boot({ registry: [{ id: 'KT26-0901', name: 'Registry Person', phone: '6000000182', level: 'SPS', facilitator: 'Natvar Gopinath Prabhuji', status: 'active' }] });
env.SHEETS_COPY = 'off';
const fetched = [], realFetch = globalThis.fetch;
globalThis.fetch = (u, o) => { fetched.push(String(u)); return realFetch(u, o); };
await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.parse('2026-10-07T10:30:00+05:30') }, env, { waitUntil: (p) => p });
globalThis.fetch = realFetch;
t.eq(fetched.filter((u) => /sheets\.googleapis|oauth/.test(u)), [], 'the :30 run no longer reads the dashboard (nor anything else from Google) while the copy is paused');
t.eq(rows("SELECT COUNT(*) AS n FROM registry WHERE iyf_id = 'KT26-0901'")[0].n, 1, '… and the registry snapshot stays as it is, for the ID matches');
t.ok(google.writes.every((w) => !/batchUpdate|:append|batchClear/.test(w.url)), '… and that run still writes nothing to Google');
t.eq(rows("SELECT COUNT(*) AS n FROM settings WHERE key = 'registry_refresh'")[0].n, 0, '… and no registry status is written any more');

// ---- the paused code is still live code, not a corpse ----
// If someone deletes these modules "because they are unused", these imports fail and this suite says why.
const mirror = await import('../src/mirror.js');
const views = await import('../src/views.js');
const erase = await import('../src/erase.js');
const retention = await import('../src/retention.js');
t.ok(typeof mirror.mirrorChanged === 'function', 'mirror.js is kept, ready for the flag');
t.ok(typeof mirror.mirrorBacklog === 'function', '… including the backlog count the status uses');
t.ok(typeof views.refreshOneView === 'function', 'views.js is kept');
t.ok(typeof erase.eraseSheets === 'function', 'erase.js keeps its Sheets scrub');
t.ok(typeof retention.trimSheetLogs === 'function', 'retention.js keeps its sheet trim');
t.ok(typeof retention.runRetention === 'function', '… and its D1 retention, which never paused');

/* ───────── the log is CLEANED UP even while the copy is paused (15 Oct 2026) ───────── */
//
// The trimmer used to live inside mirrorChanged(), the function that sends to Google. So pausing the copy
// also paused the deletion of rows the copy had ALREADY finished with, and the log only ever grew: 8,616
// finished entries were still there a day later, and scanning them spent D1's whole daily read allowance
// and took the live app down twice. Removing rows we are done with is housekeeping on our own table.
{
  const { env, DB, rows } = boot();
  env.SHEETS_COPY = undefined;                                   // paused, as it is live
  const { trimMirrorLog } = await import('../src/mirror.js');

  // 900 entries the copy has already dealt with, and the position past them
  DB.sql.exec("DELETE FROM mirror_log");
  for (let i = 0; i < 900; i++) DB.sql.exec(`INSERT INTO mirror_log (tbl, k1, k2) VALUES ('accounts', 'p${i}', '')`);
  const hi = rows('SELECT MAX(id) AS n FROM mirror_log')[0].n;
  DB.sql.exec(`UPDATE mirror_state SET last_id = ${hi} WHERE tbl = 'mirror_log'`);

  // a quiet night: IST Wednesday 2 AM
  const night = new Date('2026-10-14T02:30:00+05:30');
  const before = rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n;
  const cut = await trimMirrorLog(DB, null, night);
  const after = rows('SELECT COUNT(*) AS n FROM mirror_log')[0].n;
  t.ok(cut > 0, `finished entries are removed while the copy is PAUSED (${before} → ${after})`);
  t.ok(after >= 1, 'the log is never emptied: the entry at the position stays, so new ids keep rising past it');
  t.eq(rows('SELECT MIN(id) AS n FROM mirror_log')[0].n > 0, true, '… and the lowest id left is a real one');

  // and NOT on a busy night — the cost has to land where the daily budget is quietest
  const busy = new Date('2026-10-12T02:30:00+05:30');            // IST Monday
  t.eq(await trimMirrorLog(DB, null, busy), 0, 'it does not run on a Monday night');
  const day = new Date('2026-10-14T14:00:00+05:30');
  t.eq(await trimMirrorLog(DB, null, day), 0, '… nor in the middle of the day');

  /* and it is actually WIRED into the paused branch — the function working is no use if nothing calls it,
     which is exactly how this defect existed: a perfectly good trimmer behind a switch that was off. */
  const { readFileSync } = await import('node:fs');
  const idx = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const pausedBranch = /if \(!sheetsCopy\) \{[\s\S]*?\n      \} else if/.exec(idx);
  t.ok(!!pausedBranch, 'the paused branch was found in index.js');
  t.ok(/trimMirrorLog\(/.test(pausedBranch[0]),
       'the PAUSED branch calls trimMirrorLog — housekeeping must not sit behind the Google switch');
}

t.done();
