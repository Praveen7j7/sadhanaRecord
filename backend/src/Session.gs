/**
 * Session.gs — who is calling. A session is a random token held by the phone; the server keeps only its
 * SHA-256 (Access › Sessions), cached for speed. Valid for 30 days from the last use. Logout, a password change,
 * an approved reset, disable, inactive and delete end it.
 */
function truthy_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }

function unauth_() { return apiError_('UNAUTHENTICATED', 'Please log in again.'); }

/** The account fields a session needs, cached 5 minutes; dropped whenever the account changes. */
function accountCached_(login) {
  return cacheJson_('ac:' + login, 300, function () {
    var a = storeFind_(table_('access', 'Accounts'), 'login', login);
    return a ? { login: String(a.login), role: String(a.role), status: String(a.status), name: String(a.name),
                 iyf_id: String(a.iyf_id || ''), requested_batch: String(a.requested_batch || ''), must_change_pw: truthy_(a.must_change_pw) } : null;
  });
}
/** Updates an account row and forgets its cached copy. */
function accountUpdate_(acct, obj) {
  obj.updated_at = new Date();
  storeUpdate_(table_('access', 'Accounts'), acct._row, obj);
  cacheDrop_(['ac:' + acct.login, 'meta:v1']);
}
function accountFull_(login) { return storeFind_(table_('access', 'Accounts'), 'login', String(login)); }

function sessionDays_() { return Number(setting_('session_days', LIMITS.SESSION_DAYS)) || LIMITS.SESSION_DAYS; }

function sessionCtx_(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw unauth_();
  var h = tokenHash_(token), cache = CacheService.getScriptCache(), now = Date.now();
  var s = JSON.parse(cache.get('ss:' + h) || 'null');
  if (!s) {
    var o = storeFind_(table_('access', 'Sessions'), 'token_hash', h);
    if (!o || o.ended_at !== '') throw unauth_();
    var exp = asDate_(o.expires_at), used = asDate_(o.last_used_at);
    if (!exp) throw unauth_();
    s = { login: String(o.login), role: String(o.role), exp: exp.getTime(), touched: used ? used.getTime() : 0 };
  }
  if (s.exp < now) throw unauth_();
  if (now - s.touched > 3600000) {                        // sliding expiry, written at most once an hour
    var t = table_('access', 'Sessions'), row = storeFindRow_(t, 'token_hash', h);
    if (!row) throw unauth_();
    s.touched = now; s.exp = now + sessionDays_() * 86400000;
    storeUpdate_(t, row, { last_used_at: new Date(now), expires_at: new Date(s.exp) });
  }
  cache.put('ss:' + h, JSON.stringify(s), 21600);
  var acct = accountCached_(s.login);
  if (!acct || acct.status !== 'ACTIVE' || acct.role !== s.role) { endSession_(h, 'status'); throw unauth_(); }
  return { login: acct.login, role: acct.role, name: acct.name, iyfId: acct.iyf_id, mustChange: acct.must_change_pw, sessionHash: h };
}

/** Starts a session; returns { token, expiresAt }. */
function startSession_(acct, device) {
  var token = newToken_(), h = tokenHash_(token), now = new Date(), exp = addDays_(now, sessionDays_());
  storeAppend_(table_('access', 'Sessions'), { token_hash: h, login: String(acct.login), role: String(acct.role), created_at: now,
    last_used_at: now, expires_at: exp, device: String(device || '').slice(0, 60), ended_at: '', end_reason: '' });
  CacheService.getScriptCache().put('ss:' + h, JSON.stringify({ login: String(acct.login), role: String(acct.role), exp: exp.getTime(), touched: now.getTime() }), 21600);
  return { token: token, expiresAt: iso_(exp) };
}

function endSession_(hash, reason) {
  var t = table_('access', 'Sessions'), row = storeFindRow_(t, 'token_hash', hash);
  if (row) storeUpdate_(t, row, { ended_at: new Date(), end_reason: reason });
  cacheDrop_('ss:' + hash);
}
/** Ends every open session of a login, except `keepHash`. */
function endSessions_(login, reason, keepHash) {
  var t = table_('access', 'Sessions');
  storeFindRows_(t, 'login', String(login)).forEach(function (row) {
    var o = storeGet_(t, row);
    if (o.ended_at !== '' || o.token_hash === keepHash) return;
    storeUpdate_(t, row, { ended_at: new Date(), end_reason: reason });
    cacheDrop_('ss:' + o.token_hash);
  });
}
