// A small stand-in for Google Apps Script, enough to run every src/*.gs file together in Node.
// Spreadsheets are in memory and built from setup/schema.mjs, so the tests use the real headers.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { SCHEMA } from '../../setup/schema.mjs';

const SRC = process.env.SADHANA_SRC || new URL('../src/', import.meta.url).pathname;
const IST_MS = 330 * 60000;
const signed = buf => Array.from(buf, b => (b > 127 ? b - 256 : b));
const toBuf = v => (Array.isArray(v) ? Buffer.from(v.map(b => b & 0xff)) : Buffer.from(String(v), 'utf8'));

class Range {
  constructor(sheet, r, c, nr = 1, nc = 1) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getRow() { return this.r; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sheet.cell(this.r + i, this.c + j)); out.push(row); }
    return out;
  }
  getValue() { return this.sheet.cell(this.r, this.c); }
  setValues(v) {
    if (v.length !== this.nr || v.some(row => row.length !== this.nc)) throw new Error(`setValues size mismatch on ${this.sheet.name}`);
    v.forEach((row, i) => row.forEach((x, j) => this.sheet.set(this.r + i, this.c + j, x)));
    return this;
  }
  setValue(x) { this.sheet.set(this.r, this.c, x); return this; }
  setNumberFormat() { return this; }
  setNumberFormats() { return this; }
  createTextFinder(text) {
    const range = this;
    const finder = {
      _entire: false, _case: false,
      matchEntireCell(b) { this._entire = b; return this; },
      matchCase(b) { this._case = b; return this; },
      findAll() {
        const hits = [];
        for (let i = 0; i < range.nr; i++) for (let j = 0; j < range.nc; j++) {
          let v = range.sheet.cell(range.r + i, range.c + j);
          v = v instanceof Date ? v.toISOString() : String(v);
          let t = String(text);
          if (!this._case) { v = v.toLowerCase(); t = t.toLowerCase(); }
          if (this._entire ? v === t : v.includes(t)) hits.push(new Range(range.sheet, range.r + i, range.c + j));
        }
        return hits;
      },
      findNext() { return this.findAll()[0] || null; }
    };
    return finder;
  }
}
class Sheet {
  constructor(name, headers, maxRows = 500) { this.name = name; this.rows = [headers.slice()]; this.maxRows = maxRows; this.width = headers.length; }
  cell(r, c) { const row = this.rows[r - 1]; return row && row[c - 1] !== undefined ? row[c - 1] : ''; }
  set(r, c, v) {
    if (r > this.maxRows) throw new Error(`write beyond max rows on ${this.name}`);
    // like Google Sheets (checked on a real sheet, 2 Oct 2026): a leading apostrophe marks text and is not kept
    if (typeof v === 'string' && v.startsWith("'")) { v = v.slice(1); (this.textCells ||= new Set()).add(r + ',' + c); }
    while (this.rows.length < r) this.rows.push([]);
    this.rows[r - 1][c - 1] = v;
    this.width = Math.max(this.width, c);
  }
  getLastRow() { for (let i = this.rows.length; i > 0; i--) if (this.rows[i - 1].some(v => v !== '' && v !== undefined && v !== null)) return i; return 0; }
  getLastColumn() { return this.width; }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(after, n) { this.maxRows += n; }
  getRange(r, c, nr = 1, nc = 1) {
    if (typeof r === 'string') {                       // A1 notation such as "C2:C" or "A2:Q"
      const m = /^([A-Z]+)(\d+):([A-Z]+)(\d*)$/.exec(r);
      if (!m) throw new Error('A1 range not mocked: ' + r);
      const n = s => [...s].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
      const r1 = +m[2], r2 = m[4] ? +m[4] : this.maxRows;
      return new Range(this, r1, n(m[1]), Math.max(0, r2 - r1 + 1), n(m[3]) - n(m[1]) + 1);
    }
    return new Range(this, r, c, nr, nc);
  }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), this.width); }
  appendRow(values) {
    const row = this.getLastRow() + 1;
    if (row > this.maxRows) this.maxRows = row;
    values.forEach((v, i) => this.set(row, i + 1, v));
    return this;
  }
  deleteRow(r) { this.rows.splice(r - 1, 1); }
  getName() { return this.name; }
  // test helper: rows as objects
  objects() { const h = this.rows[0]; return this.rows.slice(1).filter(r => r.some(v => v !== '' && v !== undefined)).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] === undefined ? '' : r[i]]))); }
}
class Spreadsheet {
  constructor(id, name) { this.id = id; this.name = name; this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  getName() { return this.name; }
  getId() { return this.id; }
  add(name, headers) { return (this.sheets[name] = new Sheet(name, headers)); }
}

/** A fresh world: the 9 store files (from the schema, with their seed rows) and a registry. */
export function makeWorld({ registryRows = [], files } = {}) {
  const books = {};
  const ids = files || JSON.parse(fs.readFileSync(new URL('../../setup/files.json', import.meta.url), 'utf8'));
  for (const [key, spec] of Object.entries(SCHEMA)) {
    const ss = new Spreadsheet(ids[key], spec.title);
    for (const [tab, cols] of Object.entries(spec.tabs)) {
      const sh = ss.add(tab, cols.map(c => c[0]));
      for (const row of (spec.seed || {})[tab] || []) sh.rows.push(row.slice());
    }
    books[ids[key]] = ss;
  }
  const reg = new Spreadsheet('165UBdHjeNfcQjCZ8dXbM9vfOJhBj0d19odmLg6rNGZA', 'IYF Dashboard');
  const dev = reg.add('Devotees', ['IYF ID', 'Name', 'Phone', 'Other spellings seen', 'First seen (week key)', 'First source', 'Current level',
    'Current facilitator', 'Head', 'Status', 'Recommended batch', 'Observed by', 'Observed on', 'Phone (normalised)', 'IYF ID (lookup)', 'Alias key (phone|name)', 'IYF ID']);
  dev.maxRows = 5000;
  registryRows.forEach((r, i) => { dev.rows.push([r.id, r.name, r.phone, '', '', 'Raw', r.level || '', r.facilitator || '', '', r.status || 'active', '', '', '', '', '', r.alias ? r.alias[0] : '', r.alias ? r.alias[1] : '']); });
  books[reg.id] = reg;
  return { books, ids, registry: reg };
}

/** Loads every src/*.gs into one context with Google's services mocked. Returns { g, world, call, clock }. */
export function boot(opts = {}) {
  const world = opts.world || makeWorld(opts);
  const cache = new Map(), props = new Map(Object.entries({ PW_PEPPER: 'p'.repeat(64), ...(opts.props || {}) }));
  const clock = { now: opts.now || Date.parse('2026-10-05T10:00:00+05:30') };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(clock.now); else super(...a); }
    static now() { return clock.now; }
  }
  const fmt = (d, tz, pat) => {
    const t = new RealDate(d.getTime() + IST_MS), p = n => String(n).padStart(2, '0');
    const Y = t.getUTCFullYear(), M = p(t.getUTCMonth() + 1), D = p(t.getUTCDate()), h = t.getUTCHours(), m = p(t.getUTCMinutes()), s = p(t.getUTCSeconds());
    switch (pat) {
      case 'yyyy-MM-dd': return `${Y}-${M}-${D}`;
      case "yyyy-MM-dd'T'HH:mm:ssXXX": return `${Y}-${M}-${D}T${p(h)}:${m}:${s}+05:30`;
      case 'u': return String(((t.getUTCDay() + 6) % 7) + 1);
      case 'yyyyMMddHH': return `${Y}${M}${D}${p(h)}`;
      case 'h:mm a': return `${(h % 12) || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
      default: throw new Error('formatDate pattern not mocked: ' + pat);
    }
  };
  const g = {
    console: { log() {}, error: opts.quiet === false ? console.error : () => {} },
    Date: FakeDate, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, isFinite, parseInt, parseFloat,
    SpreadsheetApp: {
      openById: id => { if (!world.books[id]) throw new Error('No access to ' + id); return world.books[id]; },
      flush() {}
    },
    CacheService: { getScriptCache: () => ({
      get: k => (cache.has(k) ? cache.get(k) : null),
      put: (k, v) => { if (String(v).length > 100000) throw new Error('cache value too large'); cache.set(k, String(v)); },
      putAll: o => Object.entries(o).forEach(([k, v]) => cache.set(k, String(v))),
      getAll: ks => Object.fromEntries(ks.filter(k => cache.has(k)).map(k => [k, cache.get(k)])),
      remove: k => cache.delete(k),
      removeAll: ks => ks.forEach(k => cache.delete(k))
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => !opts.lockBusy, waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v), deleteProperty: k => props.delete(k)
    }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => signed(crypto.createHash('sha256').update(toBuf(s)).digest()),
      computeHmacSha256Signature: (value, key) => signed(crypto.createHmac('sha256', toBuf(key)).update(toBuf(value)).digest()),
      newBlob: s => ({ getBytes: () => signed(Buffer.from(String(s), 'utf8')) }),
      base64Encode: b => toBuf(b).toString('base64'),
      base64Decode: s => signed(Buffer.from(s, 'base64')),
      formatDate: fmt,
      sleep() {}
    },
    ScriptApp: { getProjectTriggers: () => [] },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ content: s, setMimeType() { return this; }, getContent() { return s; } }) },
    Logger: { log() {} }
  };
  vm.createContext(g);
  for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.gs')).sort()) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), g, { filename: f });

  let n = 0;
  /** One API call, exactly as the app makes it. */
  const call = (action, data = {}, token, extra = {}) => {
    const body = { v: 1, action, token, requestId: extra.requestId || `req-${++n}-${Date.now()}`, app: 'test', data, ...extra.override };
    if (extra.noRequestId) delete body.requestId;
    const out = g.doPost({ postData: { contents: JSON.stringify(body) } });
    // each execution starts with empty per-run caches, as in Apps Script
    vm.runInContext('STORE_FILES_ = {}; STORE_TABLES_ = {}; LOCK_DEPTH_ = 0; PEPPER_ = null;', g);
    return JSON.parse(out.getContent());
  };
  const tab = (fileKey, name) => world.books[world.ids[fileKey]].sheets[name];
  return { g, world, call, clock, cache, props, tab };
}

/** Tiny assertion helper with a running count. */
export function suite(name) {
  let pass = 0, fail = 0;
  const t = {
    ok(cond, msg) { if (cond) pass++; else { fail++; console.log('  ✗ ' + msg); } },
    eq(a, b, msg) { const s = JSON.stringify(a) === JSON.stringify(b); if (s) pass++; else { fail++; console.log(`  ✗ ${msg}\n      got:  ${JSON.stringify(a)}\n      want: ${JSON.stringify(b)}`); } },
    code(res, code, msg) { t.eq(res.ok ? 'ok' : res.error.code, code, msg); },
    done() { console.log(`\n=== ${pass} passed, ${fail} failed\n`); process.exit(fail ? 1 : 0); }
  };
  console.log('── ' + name);
  return t;
}
