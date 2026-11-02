/**
 * Api.gs — the one endpoint. Every call is a POST of
 *   { v, action, token, requestId, app, data }
 * and every answer is HTTP 200 with { ok, data | error, serverTime } (API contract §0).
 *
 * Order of checks for each call: version → action exists → fields allowed → session (unless public)
 * → forced password change → role → requestId replay → the action itself.
 */
var API_VERSION = 1;
var PUBLIC = 'PUBLIC';
var ANY = ['DEVOTEE', 'COORDINATOR', 'MASTER'];
var STAFF = ['COORDINATOR', 'MASTER'];
var MASTER_ONLY = ['MASTER'];

/** The routing table. `fields` lists every allowed key of `data`; `write` actions need a requestId. */
function routes_() {
  return {
    'meta.get':                 { roles: PUBLIC, fields: [], fn: metaGet_ },
    'auth.signUp':              { roles: PUBLIC, write: true, fields: ['phone', 'name', 'batchId', 'password', 'profile', 'consentPhoto'], fn: authSignUp_ },
    'auth.login':               { roles: PUBLIC, fields: ['login', 'password', 'device'], fn: authLogin_ },
    'auth.requestReset':        { roles: PUBLIC, write: true, fields: ['login', 'newPassword'], fn: authRequestReset_ },
    'auth.me':                  { roles: ANY, mustChangeOk: true, fields: [], fn: authMe_ },
    'auth.logout':              { roles: ANY, mustChangeOk: true, fields: [], fn: authLogout_ },
    'auth.changePassword':      { roles: ANY, mustChangeOk: true, write: true, fields: ['current', 'new'], fn: authChangePassword_ },
    'requests.list':            { roles: STAFF, fields: ['batchId'], fn: requestsList_ },
    'requests.approve':         { roles: STAFF, write: true, fields: ['phone', 'link', 'levelEntryDate'], fn: requestsApprove_ },
    'requests.reject':          { roles: STAFF, write: true, fields: ['phone', 'reason'], fn: requestsReject_ },
    'resets.approve':           { roles: STAFF, write: true, fields: ['login'], fn: resetsApprove_ },
    'resets.reject':            { roles: STAFF, write: true, fields: ['login'], fn: resetsReject_ },
    'registry.search':          { roles: STAFF, fields: ['q'], fn: registrySearch_ },
    'coordinators.list':        { roles: MASTER_ONLY, fields: [], fn: coordinatorsList_ },
    'coordinators.create':      { roles: MASTER_ONLY, write: true, fields: ['username', 'name', 'phone', 'batchIds', 'tempPassword'], fn: coordinatorsCreate_ },
    'coordinators.update':      { roles: MASTER_ONLY, write: true, fields: ['username', 'name', 'phone', 'batchIds'], fn: coordinatorsUpdate_ },
    'coordinators.setDisabled': { roles: MASTER_ONLY, write: true, fields: ['username', 'disabled'], fn: coordinatorsSetDisabled_ },
    'coordinators.resetPassword': { roles: MASTER_ONLY, write: true, fields: ['username', 'tempPassword'], fn: coordinatorsResetPassword_ },
    'batches.list':             { roles: MASTER_ONLY, fields: [], fn: batchesList_ },
    'batches.update':           { roles: MASTER_ONLY, write: true, fields: ['batchId', 'name', 'active', 'pilot', 'coordinatorLogins'], fn: batchesUpdate_ },
    'ids.search':               { roles: MASTER_ONLY, fields: ['q'], fn: idsSearch_ },
    'ids.get':                  { roles: MASTER_ONLY, fields: ['iyfId'], fn: idsGet_ },
    'ids.link':                 { roles: MASTER_ONLY, write: true, fields: ['login', 'iyfId', 'reason'], fn: idsLink_ },
    'ids.unlink':               { roles: MASTER_ONLY, write: true, fields: ['login', 'reason'], fn: idsUnlink_ }
  };
}

function doPost(e) {
  var t0 = Date.now(), req = null, res;
  profStart_();
  try {
    req = parseRequest_(e);
    res = { ok: true, data: handle_(req) };
  } catch (err) {
    res = errorReply_(err);
  }
  res.serverTime = isoNow_();
  logRun_(req, res, Date.now() - t0);
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

/** A plain health check, so the URL can be opened in a browser. */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: { service: 'sadhana-record', v: API_VERSION }, serverTime: isoNow_() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseRequest_(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw || raw.length > 400000) throw apiError_('BAD_REQUEST', 'Something went wrong. Please try again.');
  var req;
  try { req = JSON.parse(raw); } catch (x) { throw apiError_('BAD_REQUEST', 'Something went wrong. Please try again.'); }
  if (!req || typeof req !== 'object' || Array.isArray(req)) throw apiError_('BAD_REQUEST', 'Something went wrong. Please try again.');
  return req;
}

function handle_(req) {
  if (req.v !== API_VERSION) {
    if (typeof req.v === 'number' && req.v < API_VERSION) throw apiError_('UPGRADE_REQUIRED', 'A new version of the app is ready.');
    throw apiError_('BAD_REQUEST', 'Unknown version');
  }
  var route = typeof req.action === 'string' && Object.prototype.hasOwnProperty.call(routes_(), req.action) ? routes_()[req.action] : null;
  if (!route) throw apiError_('BAD_REQUEST', 'Unknown action');
  var data = req.data === undefined ? {} : req.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw apiError_('BAD_REQUEST', 'Bad data');
  Object.keys(data).forEach(function (k) {
    if (route.fields.indexOf(k) === -1) throw apiError_('BAD_REQUEST', 'Unknown field ' + k);
  });

  var ctx = { public: true, login: '', role: '' };
  if (route.roles !== PUBLIC) {
    ctx = sessionCtx_(req.token);
    if (ctx.mustChange && !route.mustChangeOk) throw apiError_('MUST_CHANGE_PASSWORD', 'Please choose a new password first.');
    if (route.roles.indexOf(ctx.role) === -1) throw apiError_('FORBIDDEN', 'You do not have access to this.');
  }

  if (route.write) {
    var rid = String(req.requestId || '');
    if (!/^[A-Za-z0-9-]{8,64}$/.test(rid)) throw apiError_('BAD_REQUEST', 'Missing request id');
    var key = 'rq:' + (ctx.login || 'anon') + ':' + req.action + ':' + rid;
    var cache = CacheService.getScriptCache(), seen = cache.get(key);
    if (seen) return JSON.parse(seen);
    var out = route.fn(data, ctx, req);
    var text = JSON.stringify(out === undefined ? {} : out);
    if (text.length < 90000) cache.put(key, text, 21600);
    return out === undefined ? {} : out;
  }
  var r = route.fn(data, ctx, req);
  return r === undefined ? {} : r;
}

/* ------------------------------------------------------------------------ */
/* Errors                                                                    */
/* ------------------------------------------------------------------------ */

/** An error the caller is meant to see. `extra` may carry fields (for VALIDATION / INCOMPLETE) and data. */
function apiError_(code, message, extra) {
  var e = new Error(message);
  e.api = { code: code, message: message };
  if (extra && extra.fields) e.api.fields = extra.fields;
  if (extra && extra.data) e.apiData = extra.data;
  return e;
}
/** VALIDATION with one or more { path, message }. */
function invalid_(fields) {
  var list = Array.isArray(fields) ? fields : [fields];
  return apiError_('VALIDATION', list.length === 1 ? list[0].message : 'Some answers need fixing.', { fields: list });
}
function errorReply_(err) {
  if (err && err.api) {
    var r = { ok: false, error: err.api };
    if (err.apiData) r.data = err.apiData;
    return r;
  }
  console.error('internal: ' + (err && err.stack || err));
  return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' }, _internal: String(err && err.message || err) };
}

/** Failures and slow calls go to Access › RunLog; never passwords, tokens or request bodies. */
function logRun_(req, res, ms) {
  var internal = res._internal; delete res._internal;
  console.log(JSON.stringify({ action: req && req.action, ms: ms, ok: !!res.ok, code: res.ok ? '' : res.error.code }));
  // a sheet write costs about a second, so only failures and very slow calls are written to the Run Log
  var failed = !res.ok && ['INTERNAL', 'BUSY'].indexOf(res.error.code) !== -1;
  if (!failed && ms < LIMITS.SLOW_MS) return;
  try {
    storeAppend_(table_('access', 'RunLog'), {
      at: new Date(), action: req && typeof req.action === 'string' ? req.action.slice(0, 40) : '?', ms: ms, ok: !!res.ok,
      error_code: res.ok ? '' : res.error.code, detail: ((internal ? internal + ' | ' : '') + profText_()).slice(0, 500), app_build: req && req.app ? String(req.app).slice(0, 40) : ''
    });
  } catch (x) { console.error('run log: ' + x.message); }
}

/* ------------------------------------------------------------------------ */
/* Locking                                                                   */
/* ------------------------------------------------------------------------ */

var LOCK_DEPTH_ = 0;
/** Runs fn under the script lock; nested calls reuse the lock already held. Timeout → BUSY. */
function withLock_(fn) {
  if (LOCK_DEPTH_ > 0) { LOCK_DEPTH_++; try { return fn(); } finally { LOCK_DEPTH_--; } }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LIMITS.LOCK_WAIT_MS)) throw apiError_('BUSY', 'The server is busy. Please try again.');
  LOCK_DEPTH_ = 1;
  try { return fn(); } finally { LOCK_DEPTH_ = 0; SpreadsheetApp.flush(); lock.releaseLock(); }
}

/* ------------------------------------------------------------------------ */
/* Permissions                                                               */
/* ------------------------------------------------------------------------ */

/** Batch ids the caller may act on. */
function scopeBatches_(ctx) {
  if (ctx.role === 'MASTER') return batchesAll_().map(function (b) { return b.batch_id; });
  if (ctx.role === 'COORDINATOR') return batchesAll_().filter(function (b) { return csv_(b.coordinator_logins).indexOf(ctx.login) !== -1; })
    .map(function (b) { return b.batch_id; });
  var m = currentMembership_(ctx.login);
  return m ? [m.batch_id] : [];
}
function requireBatch_(ctx, batchId) {
  if (scopeBatches_(ctx).indexOf(String(batchId)) === -1) throw apiError_('FORBIDDEN', 'That batch is not yours.');
}
function csv_(v) { return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(String); }
