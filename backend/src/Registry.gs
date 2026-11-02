/**
 * Registry.gs — the IYF ID registry, READ-ONLY (API contract §6, design §3b).
 *
 * The registry is the dashboard's Devotees tab. The Sadhana app never writes there and never creates IDs; the
 * dashboard's own hourly registration does. This file only reads columns A–Q and matches people the same way
 * the dashboard does. The four matching helpers below are copies of RegistryService.gs (regNormPhone_,
 * regNameParts_, regTokenKey_, regAliasKey_); tests/registry-parity.test.js checks they give identical keys.
 */
var REGISTRY_SHEET_ID = '165UBdHjeNfcQjCZ8dXbM9vfOJhBj0d19odmLg6rNGZA';
var REGISTRY_TAB_NAME = 'Devotees';
var ID_PATTERN_ = /^(GP|JN|KT)\d{2}-\d{4}$/;
var REG_HONORIFICS_ = ['hg', 'h', 'g', 'pr', 'prji', 'prabhuji', 'prabhu', 'ji', 'das', 'dasa', 'sri', 'srila'];

/* ---- copies of the dashboard's matching rules (do not change one without the other) ---- */
function idNormPhone_(v) {
  if (v === '' || v === null || v === undefined) return '';
  var d = String(typeof v === 'number' ? Math.round(v) : v).replace(/\D/g, '');
  if (d.length > 10) return d.slice(-10);
  if (d.length === 10) return d;
  if (d.length === 9) return '0' + d;
  return '';
}
function idNameParts_(name) {
  return String(name == null ? '' : name).toLowerCase().replace(/[^a-z ]/g, ' ')
    .split(/\s+/).filter(function (w) { return w && REG_HONORIFICS_.indexOf(w) === -1; });
}
function idTokenKey_(part) {
  var t = String(part || '').replace(/w/g, 'v').replace(/h/g, '').replace(/[aeiou]/g, '');
  return t || String(part || '');
}
function idAliasKey_(name, phone) {
  var p = idNormPhone_(phone);
  if (!p) return '';
  var parts = idNameParts_(name);
  return p + '|' + (parts.length ? idTokenKey_(parts[0]) : '');
}
/* ------------------------------------------------------------------------------------------ */

/**
 * Every registry row { id, name, phone, level, facilitator, status, mergedInto, aliases[] }.
 * The dashboard spreadsheet is large and slow to open (10+ s), so requests use a copy kept in the cache by
 * refreshRegistryJob (every 30 minutes, kept 6 hours). `fresh` reads the dashboard now; only the job, setup
 * checks and an ID missing from the copy do that.
 */
function registryRows_(fresh) {
  var build = function () {
    var sh = SpreadsheetApp.openById(REGISTRY_SHEET_ID).getSheetByName(REGISTRY_TAB_NAME);
    prof_('open registry');
    if (!sh) throw new Error('The dashboard\'s Devotees tab is missing.');
    var v = sh.getRange('A2:Q').getValues(), rows = [], byId = {}, aliases = [];
    prof_('read registry');
    v.forEach(function (r) {
      var id = String(r[0] || '').trim().toUpperCase();
      if (ID_PATTERN_.test(id) && !byId[id]) {
        var status = String(r[9] || '').trim(), m = /^Merged into\s+(\S+)/i.exec(status);
        byId[id] = { id: id, name: String(r[1] || '').trim(), phone: idNormPhone_(r[2]), level: String(r[6] || '').trim(),
                     facilitator: String(r[7] || '').trim(), status: status, mergedInto: m ? m[1].toUpperCase() : null, aliases: [] };
        rows.push(byId[id]);
      }
      var k = String(r[15] || '').trim(), kid = String(r[16] || '').trim().toUpperCase();
      if (k && kid) aliases.push([k, kid]);
    });
    aliases.forEach(function (a) { if (byId[a[1]]) byId[a[1]].aliases.push(a[0]); });
    return rows;
  };
  if (fresh) { var rows = build(); cacheBigPut_('registry:v1', rows, 21600); return rows; }
  var hit = cacheBigGet_('registry:v1');
  if (hit) return hit;
  var built = build();
  cacheBigPut_('registry:v1', built, 21600);
  return built;
}

/** Time-driven (every 30 minutes, installed by installTriggers): keeps the registry copy warm. */
function refreshRegistryJob() {
  try { registryRows_(true); } catch (e) { console.error('registry refresh: ' + e.message); }
}

/** The public view of a registry row. */
function registryPublic_(r, why) {
  return { iyfId: r.id, name: r.name, level: r.level, facilitator: r.facilitator,
           phoneEnd: r.phone ? '…' + r.phone.slice(-4) : '', mergedInto: r.mergedInto, why: why || '' };
}

/** Likely IDs for a sign-up, using the registry's own matching. */
function registryMatches_(rows, phone, name) {
  var p = idNormPhone_(phone), keys = idNameParts_(name).map(idTokenKey_), out = [], seen = {};
  var add = function (r, why) { if (!seen[r.id]) { seen[r.id] = 1; out.push(registryPublic_(r, why)); } };
  var key = p ? p + '|' + (keys[0] || '') : '';
  rows.forEach(function (r) { if (key && r.aliases.indexOf(key) !== -1) add(r, 'phone + name'); });
  rows.forEach(function (r) {
    if (!p || r.phone !== p) return;
    var parts = idNameParts_(r.name).map(idTokenKey_);
    add(r, keys.some(function (k) { return parts.indexOf(k) !== -1; }) ? 'phone + name' : 'phone');
  });
  if (keys.length >= 2) {
    var n = 0;
    rows.forEach(function (r) {
      if (n >= 5 || seen[r.id]) return;
      var parts = idNameParts_(r.name).map(idTokenKey_);
      if (keys.every(function (k) { return parts.indexOf(k) !== -1; })) { add(r, 'name'); n++; }
    });
  }
  return out;
}

function registrySearchRows_(rows, q) {
  q = String(q || '').trim();
  if (q.length < 3) throw invalid_({ path: 'q', message: 'Type at least 3 characters.' });
  var qId = q.toUpperCase(), qDigits = q.replace(/\D/g, ''), qKeys = idNameParts_(q).map(idTokenKey_), out = [];
  rows.forEach(function (r) {
    if (out.length >= 20) return;
    var hit = r.id.indexOf(qId) !== -1 || (qDigits.length >= 4 && r.phone.indexOf(qDigits) !== -1) ||
      (qKeys.length > 0 && qDigits.length === 0 && (function () {
        var parts = idNameParts_(r.name).map(idTokenKey_);
        return qKeys.every(function (k) { return parts.some(function (p) { return p.indexOf(k) === 0; }); });
      })());
    if (hit) out.push(registryPublic_(r, ''));
  });
  return out;
}

/**
 * The four ID checks (API contract §0). Returns the registry row, or throws UNKNOWN_ID / CONFLICT.
 * Uses the registry copy (a merge shows within 30 minutes). `forLogin`: the account being linked (its own current link is fine).
 */
function checkIyfId_(iyfId, forLogin) {
  var id = String(iyfId || '').trim().toUpperCase();
  if (!ID_PATTERN_.test(id)) throw apiError_('UNKNOWN_ID', 'That is not an IYF ID.');
  // the copy first; IDs are never renumbered or deleted, so only a very new ID needs the slow fresh read
  var find = function (rows) { return rows.filter(function (x) { return x.id === id; })[0]; };
  var r = find(registryRows_(false)) || find(registryRows_(true));
  if (!r) throw apiError_('UNKNOWN_ID', id + ' was never allocated in the registry.');
  if (r.mergedInto) throw apiError_('UNKNOWN_ID', id + ' was merged into ' + r.mergedInto + '. Use ' + r.mergedInto + ' instead.');
  var other = storeFindRows_(table_('access', 'Accounts'), 'iyf_id', id)
    .map(function (row) { return storeGet_(table_('access', 'Accounts'), row); })
    .filter(function (a) { return String(a.login) !== String(forLogin || ''); })[0];
  if (other) throw apiError_('CONFLICT', id + ' already belongs to another account (' + other.name + ').');
  return r;
}

/** { iyfId: login } for every linked account. */
function linkedLogins_() {
  var out = {};
  storeAll_(table_('access', 'Accounts')).forEach(function (a) { if (a.iyf_id) out[String(a.iyf_id)] = { login: String(a.login), name: String(a.name) }; });
  return out;
}

/* ---- CacheService holds at most 100 KB a value, so big values go in pieces ---- */
function cacheBigPut_(key, value, seconds) {
  var s = JSON.stringify(value), size = 90000, parts = {}, n = Math.ceil(s.length / size) || 1;
  for (var i = 0; i < n; i++) parts[key + ':' + i] = s.slice(i * size, (i + 1) * size);
  parts[key + ':n'] = String(n);
  CacheService.getScriptCache().putAll(parts, seconds);
}
function cacheBigGet_(key) {
  var c = CacheService.getScriptCache(), n = Number(c.get(key + ':n') || 0);
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push(key + ':' + i);
  var got = c.getAll(keys), s = '';
  for (var j = 0; j < n; j++) { if (got[keys[j]] === undefined || got[keys[j]] === null) return null; s += got[keys[j]]; }
  return JSON.parse(s);
}
