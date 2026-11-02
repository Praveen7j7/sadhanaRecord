// The Facilitator Dashboard is no longer read (the head, 27 Oct 2026): Sadhana Record is its own source for everything.
// No scheduled run and no action may call the Google Sheets API for the dashboard — not the 30-minute Devotees/NameMap
// copy (retired), not the "unknown ID → read the tab again" fallback in checkIyfId (retired). The `registry` table stays
// as a frozen snapshot, and the reads that use it still answer from it.
import fs from 'node:fs';
import { boot, suite } from './harness.mjs';
import { ROUTES } from '../src/api.js';
import worker from '../src/index.js';

const t = suite('the dashboard is not read: no schedule or action calls it');
const SRC = new URL('../src/', import.meta.url);

/* ── the code: nothing names the dashboard's sheet or its tabs ── */
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(new URL(f, SRC), 'utf8');
  t.ok(!/REGISTRY_SHEET_ID|['"`]Devotees!|['"`]NameMap!|refreshRegistry\(|refreshFacilitators\(/.test(src), `${f}: no read of the dashboard's sheet`);
}

/* ── the running app: every minute of a day's runs, and every action ── */
const { env, DB, call, addAccount } = boot({ registry: [{ id: 'KT26-0901', name: 'Registry Person', phone: '6000000182', level: 'SPS', status: 'active' }] });
const hits = [], realFetch = globalThis.fetch;
// the harness's fake Google answers; this only records what was asked of the DASHBOARD sheet (env.REGISTRY_SHEET_ID)
globalThis.fetch = (u, o) => { if (String(u).includes('/spreadsheets/' + env.REGISTRY_SHEET_ID)) hits.push(String(u)); return realFetch(u, o); };
t.ok(!!env.REGISTRY_SHEET_ID, 'the test environment still names a dashboard sheet, so a read of it would be seen');

// minute by minute through the hours that used to read it (:00 and :30), the 9 PM deadline and the night jobs
const ctx = { waitUntil: (p) => p };
for (const hourUtc of [0, 15, 18, 19]) {
  for (let m = 0; m < 60; m++) {
    const at = Date.UTC(2026, 9, 26, hourUtc, m);
    await worker.scheduled({ cron: '* * * * *', scheduledTime: at }, env, ctx);
  }
}
t.eq(hits, [], 'no scheduled run reads the dashboard (240 runs, minutes 0 and 30 included)');

// every action, as the head, with nothing and with an ID that is not in the snapshot (which used to trigger a re-read)
await addAccount('master', 'MASTER', 'Master pass 2026');
const M = (await call('auth.login', { login: 'master', password: 'Master pass 2026' })).data.token;
let n = 0;
for (const action of Object.keys(ROUTES)) {
  if (['auth.logout', 'auth.logoutAll', 'account.delete'].includes(action)) continue;      // would end the head's session
  await call(action, {}, M); await call(action, { iyfId: 'KT26-0999', login: '6000000182', q: 'KT26' }, M); n++;
}
t.ok(n > 100, `every action was called (${n})`);
t.eq(hits, [], 'no action reads the dashboard either — an ID missing from the snapshot is simply unknown');
t.code(await call('ids.search', { q: 'KT26-0901' }, M), 'ok', 'the frozen registry still answers the ID search');
t.ok(JSON.stringify((await call('ids.search', { q: 'KT26-0901' }, M)).data).includes('Registry Person'), 'from the snapshot');
t.eq(DB.sql.prepare("SELECT COUNT(*) AS n FROM registry").get().n, 1, 'and the snapshot is kept, never dropped');
globalThis.fetch = realFetch;
t.done();
