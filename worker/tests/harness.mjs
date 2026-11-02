// Runs the Worker's API in Node: D1 is SQLite (node:sqlite) behind D1's API, Google is a fake that records writes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { apiCall } from '../src/api.js';
import { hashPassword } from '../src/crypto.js';
import { idNormPhone } from '../src/registry.js';

/** D1's API over node:sqlite: prepare().bind().first/all/run, and an atomic batch(). */
export function makeD1() {
  const sql = new DatabaseSync(':memory:');
  for (const f of fs.readdirSync(new URL('../migrations/', import.meta.url)).sort()) sql.exec(fs.readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
  const exec = (s, args, mode) => {
    if (args.some(a => a === undefined)) throw new Error('D1_TYPE_ERROR: undefined bound in: ' + s);
    if (process.env.SQL_LOG) fs.appendFileSync(process.env.SQL_LOG, JSON.stringify(s) + '\n');   // query-plan audit (tests/query-plans.mjs)
    const st = sql.prepare(s);
    if (mode === 'first') return st.get(...args) ?? null;
    if (mode === 'all') return { results: st.all(...args) };
    const r = st.run(...args);
    return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  };
  const stmt = (s, args = []) => ({
    s, args,
    bind: (...a) => stmt(s, a),
    first: async () => exec(s, args, 'first'),
    all: async () => exec(s, args, 'all'),
    run: async () => exec(s, args, 'run')
  });
  return {
    sql,
    prepare: s => stmt(s),
    batch: async list => {
      if (!list.length) throw new Error('D1_ERROR: No SQL statements detected.');   // as the real D1 does (9 PM run, 29 Oct 2026)
      sql.exec('BEGIN');
      try { const out = list.map(x => /^\s*(select|with)\b/i.test(x.s) ? exec(x.s, x.args, 'all') : exec(x.s, x.args, 'run')); sql.exec('COMMIT'); return out; }
      catch (e) { sql.exec('ROLLBACK'); throw e; }
    }
  };
}

/** A fake Google: a token endpoint, the dashboard's Devotees tab, and recorded sheet writes. */
/** The dashboard Devotees tab's header row (A…Q), as registry.js expects to find it. */
export const DEVOTEES_HEADER = ['IYF ID', 'Name', 'Phone', 'Email', 'Area', 'Source', 'Level', 'Facilitator',
  'Class day', 'Status', 'Joined', 'Notes', 'Updated', 'By', 'Spare', 'Alias key', 'Alias ID'];

export function fakeGoogle(registryValues = []) {
  const writes = [];
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { client_email: 'test@sa.example', token_uri: 'https://oauth.test/token', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const state = { registryValues, failSheets: false, dns: {}, nameMap: [['HG Natvar Pr', 'Natvar Gopinath Prabhuji', 'TRUE'], ['natvar', 'Natvar Gopinath Prabhuji', 'TRUE'], ['Ankit', 'Ankit Narula Prabhuji', 'FALSE'], ['New spelling', 'Brand New Prabhuji', 'TRUE']] };
  globalThis.fetch = async (url, opt = {}) => {
    const u = String(url), body = opt.body ? (typeof opt.body === 'string' ? opt.body : String(opt.body)) : '';
    const reply = (j, status = 200) => ({ ok: status < 300, status, json: async () => j });
    if (u === key.token_uri) return reply({ access_token: 'tok', expires_in: 3600 });
    if (u.includes('cloudflare-dns.com/dns-query')) {                 // the email domain check: state.dns[domain] or "has mail servers"
      const name = decodeURIComponent(/name=([^&]+)/.exec(u)[1]);
      return reply(state.dns[name] ?? { Status: 0, Answer: [{ type: 15, data: '10 mx.' + name }] });
    }
    if (state.failSheets) return reply({ error: { message: 'down' } }, 503);
    // reads of a test's own model of the spreadsheets (state.read(url, range) → row arrays), e.g. erase.js
    if (u.includes('values:batchGet') && state.read) return reply({ valueRanges: new URL(u).searchParams.getAll('ranges').map(r => ({ range: r, values: state.read(u, r) })) });
    // The Devotees tab, with its header row: registry.js reads A1:Q and refuses a tab whose columns have moved
    // (audit J8), so the fake must carry a header like the real sheet. A test can override it with
    // state.devoteesHeader to exercise the shifted-column guard.
    if (u.includes('/values/Devotees')) {
      const wantsHeader = /A1(?::|%3A)/i.test(u);
      const head = state.devoteesHeader ?? DEVOTEES_HEADER;
      return reply({ values: wantsHeader ? [head, ...state.registryValues] : state.registryValues });
    }
    if (u.includes('/values/NameMap')) return reply({ values: state.nameMap });
    if (u.includes('?fields=sheets(')) {                       // tab sizes: every tab has 500 rows, like the built sheets
      const tabs = ['Accounts', 'Batches', 'Memberships', 'ResetRequests', 'Sessions', 'AuditLog', 'RunLog', 'Profiles', 'Settings', 'CardRanges', 'SevaRules', 'ChetnaOptions', 'Lectures', 'Books', 'BookFiles'];
      const book = state.book(u);                               // + the four batch-view tabs, kept as a live model (views.test.mjs)
      return reply({ sheets: [...tabs.map((title, i) => ({ properties: { sheetId: i, title, gridProperties: { rowCount: 500 } } })),
        ...Object.entries(book).map(([title, t]) => ({ properties: { sheetId: t.sheetId, title, gridProperties: { rowCount: t.grid } } }))] });
    }
    const parsed = body ? JSON.parse(body) : null;
    writes.push({ url: u, body: parsed });
    if (u.endsWith(':batchUpdate') && parsed?.requests) state.apply(u, parsed.requests);
    if (u.endsWith('values:batchClear')) state.clear(u, parsed.ranges);
    return reply({});
  };
  // a tiny model of the view spreadsheets: rows[0] is the header; inserts, deletes and cell updates applied in order
  const books = {};
  const VIEW_TABS = ['This week', 'Scores', 'Days', 'Week-end'];
  state.book = (u) => {
    const id = /spreadsheets\/([^/?:]+)/.exec(u)[1];
    return (books[id] ||= Object.fromEntries(VIEW_TABS.map((t, i) => [t, { sheetId: 100 + i, rows: [['header']], grid: 1000 }])));
  };
  state.tab = (id, title) => books[id]?.[title];
  const bySheet = (book, sheetId) => Object.values(book).find(t => t.sheetId === sheetId);
  const value = c => (c.userEnteredValue ? ('numberValue' in c.userEnteredValue ? c.userEnteredValue.numberValue : c.userEnteredValue.stringValue) : '');
  state.apply = (u, requests) => {
    const book = state.book(u);
    for (const r of requests) {
      if (r.insertDimension) { const x = r.insertDimension.range, t = bySheet(book, x.sheetId); if (!t) continue;
        while (t.rows.length < x.startIndex) t.rows.push([]);
        t.rows.splice(x.startIndex, 0, ...Array.from({ length: x.endIndex - x.startIndex }, () => [])); t.grid += x.endIndex - x.startIndex; }
      else if (r.deleteDimension) { const x = r.deleteDimension.range, t = bySheet(book, x.sheetId); if (!t) continue;
        t.rows.splice(x.startIndex, x.endIndex - x.startIndex); t.grid -= x.endIndex - x.startIndex; }
      else if (r.appendDimension) { const t = bySheet(book, r.appendDimension.sheetId); if (t) t.grid += r.appendDimension.length; }
      else if (r.updateCells) { const x = r.updateCells, t = bySheet(book, x.start.sheetId); if (!t) continue;
        x.rows.forEach((row, k) => { const at = x.start.rowIndex + k; if (at >= t.grid) throw new Error('updateCells beyond the grid');
          while (t.rows.length <= at) t.rows.push([]); t.rows[at] = row.values.map(value); }); }
    }
  };
  state.clear = (u, ranges) => {
    const book = state.book(u);
    for (const r of ranges || []) { const m = /^'([^']+)'!A2/.exec(r); if (m && book[m[1]]) book[m[1]].rows.length = 1; }
  };
  return { key: JSON.stringify(key), writes, state };
}

/** Rows for the fake Devotees tab (A..Q). */
export const devoteeRow = r => [r.id, r.name, r.phone, '', '', 'Raw', r.level || '', r.facilitator || '', '', r.status || 'active', '', '', '', '', '', r.alias ? r.alias[0] : '', r.alias ? r.alias[1] : ''];

/**
 * The `registry` table as a frozen snapshot (the dashboard is no longer read, 27 Oct 2026): rows in devoteeRow's
 * shape go straight into the table, parsed exactly as the retired refreshRegistry parsed the Devotees tab.
 */
export function seedRegistry(DB, list) {
  const byId = new Map(), aliases = [];
  for (const r of list.map(devoteeRow)) {
    const id = String(r[0] || '').trim().toUpperCase();
    if (/^(GP|JN|KT)\d{2}-\d{4}$/.test(id) && !byId.has(id)) {
      const status = String(r[9] || '').trim(), m = /^Merged into\s+(\S+)/i.exec(status);
      byId.set(id, { iyf_id: id, name: String(r[1] || '').trim(), phone: idNormPhone(r[2]), level: String(r[6] || '').trim(),
                     facilitator: String(r[7] || '').trim(), status, merged_into: m ? m[1].toUpperCase() : null, aliases: [] });
    }
    if (r[15] && r[16]) aliases.push([String(r[15]).trim(), String(r[16]).trim().toUpperCase()]);
  }
  for (const [k, id] of aliases) if (byId.has(id)) byId.get(id).aliases.push(k);
  const ins = DB.sql.prepare('INSERT OR REPLACE INTO registry (iyf_id, name, phone, level, facilitator, status, merged_into, aliases) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  for (const r of byId.values()) ins.run(r.iyf_id, r.name, r.phone, r.level, r.facilitator, r.status, r.merged_into, JSON.stringify(r.aliases));
  return byId.size;
}

export function boot({ registry = [], copy = 'on' } = {}) {
  const DB = makeD1(), google = fakeGoogle(registry.map(devoteeRow));
  /* The Sheets copy switch the mirror triggers read (migration 0075, src/mirror.js COPY_ON). Live it is OFF (the copy
     is paused, so a change queues nothing); the suites test the copy and use its queue as a probe of what a call wrote,
     so a test database starts with it ON. A test of the live, paused state asks for boot({ copy: 'off' }). */
  DB.sql.prepare('UPDATE mirror_switch SET state = ? WHERE id = 1').run(copy === 'off' ? 'off' : 'on');
  if (registry.length) seedRegistry(DB, registry);
  /* REFUSAL_SAMPLE_OFF by default: the refusal counter samples with Math.random(), which made any suite that
     compares the settings table flaky — about one run in ten wrote a counter row mid-test (mirror.test.mjs,
     15 Oct 2026). A test must not depend on a coin toss. The suite that tests the counter itself clears this. */
  const env = { DB, PW_PEPPER: 'p'.repeat(64), GOOGLE_SA_KEY: google.key, REGISTRY_SHEET_ID: 'dash', ALLOWED_ORIGINS: '',
                REFUSAL_SAMPLE_OFF: '1' };
  const clock = { now: Date.parse('2026-10-05T10:00:00+05:30') };
  const pending = [];
  let n = 0;
  const call = async (action, data = {}, token, extra = {}) => {
    const body = { v: 1, action, token, requestId: extra.requestId || `req-${++n}-0000`, app: 'test', data, ...extra.override };
    const res = await apiCall(JSON.stringify(body), env, p => pending.push(p), () => new Date(clock.now), { ip: extra.ip || '' });
    await Promise.all(pending.splice(0));
    return res;
  };
  const rows = (sql, ...a) => DB.sql.prepare(sql).all(...a);
  /** Inserts an account directly (for the master, which setup creates outside the API). */
  const addAccount = async (login, role, password, extra = {}) => {
    const h = await hashPassword(password, 1000, env.PW_PEPPER);
    DB.sql.prepare(`INSERT INTO accounts (login, role, status, name, pw_hash, pw_salt, pw_iterations, must_change_pw) VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?, ?)`)
      .run(login, role, extra.name || login, h.pw_hash, h.pw_salt, h.pw_iterations, extra.mustChange ? 1 : 0);
  };
  return { env, DB, call, clock, rows, addAccount, google };
}

/** A valid facilitator and a group leader of each batch (decision 33: both come from lists). */
export const FAC = 'Natvar Gopinath Prabhuji';
/** The contact fields sign-up asks for (3 Oct 2026). */
export const CONTACT = { classDay: 'SUN', email: 'devotee@gmail.com' };
export const LEAD = { SPS: 'Divyanshu Pr', SPS2: 'Raj pr', SPSO: 'Rajat Gupta Pr', DPS: 'Nitin Gupta pr', BSS: 'Sagar Bansal Pr', BVS: 'Arun Ojha Pr' };

export function suite(name) {
  let pass = 0, fail = 0;
  const t = {
    ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } },
    eq(a, b, m) { if (JSON.stringify(a) === JSON.stringify(b)) pass++; else { fail++; console.log(`  ✗ ${m}\n      got:  ${JSON.stringify(a)}\n      want: ${JSON.stringify(b)}`); } },
    code(r, c, m) { t.eq(r.ok ? 'ok' : r.error.code, c, m); },
    done() { console.log(`\n=== ${pass} passed, ${fail} failed\n`); process.exit(fail ? 1 : 0); }
  };
  console.log('── ' + name);
  return t;
}
