/**
 * Store.gs — the data layer. The only file that reads or writes the spreadsheets (design §2c).
 * Columns are found by their header name (setup/schema.mjs), never by position.
 *
 * Speed: every SpreadsheetApp call that reads is a round trip of 0.1–0.7 s from a web app, so this file keeps
 * them few: headers come from the cache, rows are added with one atomic appendRow, neighbouring cells are
 * written together, and finding a row is one TextFinder call on an open-ended column.
 *
 * Text: every string is written with a leading apostrophe. Sheets keeps it as text and does not store or return
 * the apostrophe (checked on a real sheet, 2 Oct 2026), so "6000000310" stays text and typed input such as
 * "=IMPORTXML(...)" can never run as a formula. No per-cell number formats are needed.
 */
var STORE_FILES_ = {}, STORE_TABLES_ = {};
var HEADER_CACHE_VERSION = 'h1';          // raise when a header in setup/schema.mjs changes

/* ---- timing: each slow call's Run Log line says where the time went ---- */
var PROF_ = null;
function profStart_() { PROF_ = { t0: Date.now(), last: Date.now(), parts: [] }; }
function prof_(label) {
  if (!PROF_) return;
  var now = Date.now();
  PROF_.parts.push(label + ' ' + (now - PROF_.last));
  PROF_.last = now;
}
function profText_() { return PROF_ ? PROF_.parts.join(', ') : ''; }

function storeSpreadsheet_(fileKey) {
  if (!STORE_FILES_[fileKey]) {
    if (!FILES[fileKey]) throw new Error('Unknown file ' + fileKey);
    STORE_FILES_[fileKey] = SpreadsheetApp.openById(FILES[fileKey]);
    prof_('open ' + fileKey);
  }
  return STORE_FILES_[fileKey];
}

/** { sh, cols: { header: 1-based column }, headers: [..] } for one tab. Headers are cached for 6 hours. */
function table_(fileKey, tab) {
  var k = fileKey + '/' + tab;
  if (!STORE_TABLES_[k]) {
    var sh = storeSpreadsheet_(fileKey).getSheetByName(tab);
    if (!sh) throw new Error('Missing tab ' + tab + ' in ' + fileKey);
    var headers = cacheJson_('hdr:' + HEADER_CACHE_VERSION + ':' + k, 21600, function () {
      var h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); });
      prof_('headers ' + tab);
      return h;
    });
    var cols = {};
    headers.forEach(function (h, i) { if (h && !cols[h]) cols[h] = i + 1; });
    STORE_TABLES_[k] = { sh: sh, cols: cols, headers: headers, name: k };
  }
  return STORE_TABLES_[k];
}
function col_(t, name) {
  var c = t.cols[name];
  if (!c) throw new Error('Missing column ' + name + ' in ' + t.name);
  return c;
}
function colLetter_(c) { var s = ''; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }

/** Row numbers whose `colName` equals value exactly: one TextFinder call on that column. */
function storeFindRows_(t, colName, value) {
  if (value === '' || value === null || value === undefined) return [];
  var L = colLetter_(col_(t, colName));
  var rows = t.sh.getRange(L + '2:' + L).createTextFinder(String(value)).matchEntireCell(true).matchCase(true).findAll()
    .map(function (r) { return r.getRow(); });
  prof_('find ' + t.name.split('/')[1]);
  return rows;
}
function storeFindRow_(t, colName, value) { var rows = storeFindRows_(t, colName, value); return rows.length ? rows[0] : 0; }

function rowToObj_(t, values, row) {
  var o = { _row: row };
  t.headers.forEach(function (h, i) { if (h) o[h] = values[i] === undefined ? '' : values[i]; });
  return o;
}
function storeGet_(t, row) {
  var v = t.sh.getRange(row, 1, 1, t.headers.length).getValues()[0];
  prof_('row ' + t.name.split('/')[1]);
  return rowToObj_(t, v, row);
}
function storeFind_(t, colName, value) { var r = storeFindRow_(t, colName, value); return r ? storeGet_(t, r) : null; }

/** Every data row as an object: one read of the whole tab. */
function storeAll_(t) {
  var v = t.sh.getDataRange().getValues();
  prof_('all ' + t.name.split('/')[1]);
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var o = rowToObj_(t, v[i], i + 1);
    if (t.headers.some(function (h) { return h && o[h] !== ''; })) out.push(o);
  }
  return out;
}

/** What goes into a cell: strings always as text (leading apostrophe; see the header). */
function cellValue_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v === '' ? '' : "'" + v;
  return v;
}

/** Appends one row with a single atomic call. */
function storeAppend_(t, obj) {
  Object.keys(obj).forEach(function (k) { col_(t, k); });
  t.sh.appendRow(t.headers.map(function (h) { return cellValue_(obj[h]); }));
  prof_('append ' + t.name.split('/')[1]);
}

/** Writes only the given columns of one row; neighbouring columns go in one call. */
function storeUpdate_(t, row, obj) {
  if (!row || row < 2) throw new Error('Bad row for ' + t.name);
  var cols = Object.keys(obj).filter(function (k) { return k !== '_row'; })
    .map(function (k) { return { c: col_(t, k), v: cellValue_(obj[k]) }; })
    .sort(function (a, b) { return a.c - b.c; });
  for (var i = 0; i < cols.length;) {
    var j = i;
    while (j + 1 < cols.length && cols[j + 1].c === cols[j].c + 1) j++;
    t.sh.getRange(row, cols[i].c, 1, j - i + 1).setValues([cols.slice(i, j + 1).map(function (x) { return x.v; })]);
    i = j + 1;
  }
}

function storeDelete_(t, row) { if (row >= 2) t.sh.deleteRow(row); }

/* ------------------------------------------------------------------------ */
/* Small cached lookups                                                      */
/* ------------------------------------------------------------------------ */

function cacheJson_(key, seconds, build) {
  var c = CacheService.getScriptCache(), hit = c.get(key);
  if (hit) return JSON.parse(hit);
  var v = build(), s = JSON.stringify(v);
  if (s.length < 95000) c.put(key, s, seconds);
  return v;
}
function cacheDrop_(keys) { CacheService.getScriptCache().removeAll([].concat(keys)); }

/** Batches, cached 10 minutes; any change to Batches drops the cache. */
function batchesAll_() {
  return cacheJson_('batches:v1', 600, function () {
    return storeAll_(table_('access', 'Batches')).map(function (b) { delete b._row; return b; });
  });
}

/** Rules › Settings as { key: value }, cached 10 minutes. */
function settings_() {
  return cacheJson_('settings:v1', 600, function () {
    var out = {};
    storeAll_(table_('rules', 'Settings')).forEach(function (r) { out[String(r.key)] = String(r.value); });
    return out;
  });
}
function setting_(key, fallback) {
  var v = settings_()[key];
  return v === undefined || v === '' ? fallback : v;
}

/** Access › AuditLog. */
function audit_(ctx, action, target, batchId, before, after, reason, requestId) {
  storeAppend_(table_('access', 'AuditLog'), {
    at: new Date(), who: ctx && ctx.login ? ctx.login : 'SYSTEM', role: ctx && ctx.role ? ctx.role : 'SYSTEM',
    action: action, target: String(target || ''), batch_id: String(batchId || ''),
    before: before === undefined || before === null ? '' : JSON.stringify(before),
    after: after === undefined || after === null ? '' : JSON.stringify(after),
    reason: String(reason || ''), request_id: String(requestId || '')
  });
}
