/**
 * Requests.gs — what coordinators approve: sign-ups and password resets (API contract §4).
 * A coordinator sees and acts on their own batches only; the master on all, plus coordinators' resets.
 */

/** The devotee's open membership (to_week blank), or null. */
function currentMembership_(login) {
  var t = table_('access', 'Memberships'), open = null;
  storeFindRows_(t, 'login', String(login)).forEach(function (row) {
    var m = storeGet_(t, row);
    if (m.to_week === '') open = m;
  });
  return open;
}
/** The batch a devotee belongs to: the open membership, else the batch chosen at sign-up. */
function devoteeBatch_(acct) {
  var m = currentMembership_(acct.login);
  return m ? String(m.batch_id) : String(acct.requested_batch || '');
}

function requestsList_(d, ctx) {
  var scope = scopeBatches_(ctx);
  if (d.batchId !== undefined) { requireBatch_(ctx, d.batchId); scope = [String(d.batchId)]; }
  var accounts = storeAll_(table_('access', 'Accounts'));
  var byLogin = {}, linked = {};
  accounts.forEach(function (a) { byLogin[String(a.login)] = a; if (a.iyf_id) linked[String(a.iyf_id)] = true; });

  var pending = accounts.filter(function (a) { return a.role === 'DEVOTEE' && a.status === 'PENDING' && scope.indexOf(String(a.requested_batch)) !== -1; });
  var rows = pending.length ? registryRows_(false) : [];
  var profiles = table_('profiles', 'Profiles');
  var signUps = pending.map(function (a) {
    var p = storeFind_(profiles, 'login', String(a.login)) || {};
    return {
      phone: String(a.login), name: String(a.name), batchId: String(a.requested_batch), at: iso_(asDate_(a.signed_up_at)),
      profile: { dob: p.dob instanceof Date ? ymd_(p.dob) : '', bloodGroup: String(p.blood_group || ''),
                 emergency: { name: String(p.emergency_name || ''), relation: String(p.emergency_relation || ''), phone: String(p.emergency_phone || '') } },
      matches: registryMatches_(rows, a.login, a.name).map(function (m) { m.linked = !!linked[m.iyfId]; return m; })
    };
  }).sort(function (x, y) { return x.at < y.at ? -1 : 1; });

  var resets = [];
  storeAll_(table_('access', 'ResetRequests')).forEach(function (r) {
    if (r.status !== 'PENDING') return;
    var a = byLogin[String(r.login)];
    if (!a) return;
    var ok = a.role === 'DEVOTEE' ? scope.indexOf(devoteeBatch_(a)) !== -1 : (a.role === 'COORDINATOR' && ctx.role === 'MASTER' && d.batchId === undefined);
    if (ok) resets.push({ login: String(a.login), name: String(a.name), role: String(a.role), at: iso_(asDate_(r.requested_at)) });
  });
  return { signUps: signUps, resets: resets };
}

/** The PENDING sign-up the caller may decide on. */
function pendingSignUp_(ctx, phoneIn) {
  var phone = normPhone_(phoneIn);
  var acct = phone ? accountFull_(phone) : null;
  if (!acct || acct.role !== 'DEVOTEE') throw apiError_('NOT_FOUND', 'That sign-up was not found.');
  requireBatch_(ctx, acct.requested_batch);
  if (acct.status !== 'PENDING') throw apiError_('CONFLICT', 'That sign-up was already decided.');
  return acct;
}

function requestsApprove_(d, ctx, req) {
  var acct = pendingSignUp_(ctx, d.phone);
  var levelEntry = d.levelEntryDate === undefined ? parseYmd_(ymd_(new Date())) : parseYmd_(d.levelEntryDate);
  if (!levelEntry) throw invalid_({ path: 'levelEntryDate', message: 'Choose the date they joined this level.' });
  var link = d.link && typeof d.link === 'object' ? d.link : {};
  var iyfId = null;
  if (link.iyfId !== undefined) iyfId = String(link.iyfId).trim().toUpperCase();
  else if (link.noIdYet !== true) throw invalid_({ path: 'link', message: 'Choose an IYF ID, or approve with no ID yet.' });

  return withLock_(function () {
    acct = pendingSignUp_(ctx, d.phone);                  // again, inside the lock
    if (iyfId) checkIyfId_(iyfId, acct.login);
    var now = new Date(), batchId = String(acct.requested_batch);
    accountUpdate_(acct, { status: 'ACTIVE', iyf_id: iyfId || '', id_source: iyfId ? 'COORDINATOR' : '',
      decided_at: now, decided_by: ctx.login, updated_by: ctx.login });
    var prof = table_('profiles', 'Profiles'), prow = storeFindRow_(prof, 'login', String(acct.login));
    if (prow && iyfId) storeUpdate_(prof, prow, { iyf_id: iyfId, updated_at: now, updated_by: ctx.login });
    storeAppend_(table_('access', 'Memberships'), {
      login: String(acct.login), iyf_id: iyfId || '', batch_id: batchId, state: 'ACTIVE', from_week: parseYmd_(mondayOf_(now)),
      to_week: '', level_entry_date: levelEntry, group_leader: '', set_by: ctx.login, set_at: now, reason: 'approved'
    });
    audit_(ctx, 'requests.approve', acct.login, batchId, { status: 'PENDING' }, { status: 'ACTIVE', iyf_id: iyfId || '' }, '', req.requestId);
    return { iyfId: iyfId, linked: !!iyfId };
  });
}

function requestsReject_(d, ctx, req) {
  var reason = cleanName_(d.reason);
  if (reason.length < 2 || reason.length > 200) throw invalid_({ path: 'reason', message: 'Give a short reason.' });
  return withLock_(function () {
    var acct = pendingSignUp_(ctx, d.phone);
    accountUpdate_(acct, { status: 'REJECTED', reject_reason: reason, decided_at: new Date(), decided_by: ctx.login, updated_by: ctx.login });
    audit_(ctx, 'requests.reject', acct.login, acct.requested_batch, { status: 'PENDING' }, { status: 'REJECTED' }, reason, req.requestId);
    return {};
  });
}

/** The account and its PENDING reset request, if the caller may decide it. */
function pendingReset_(ctx, loginIn) {
  var login = normLogin_(loginIn), acct = login ? accountFull_(login) : null;
  if (!acct) throw apiError_('NOT_FOUND', 'That request was not found.');
  if (acct.role === 'DEVOTEE') requireBatch_(ctx, devoteeBatch_(acct));
  else if (!(acct.role === 'COORDINATOR' && ctx.role === 'MASTER')) throw apiError_('FORBIDDEN', 'You cannot decide this request.');
  var t = table_('access', 'ResetRequests'), req = null;
  storeFindRows_(t, 'login', login).forEach(function (row) { var r = storeGet_(t, row); if (r.status === 'PENDING') req = r; });
  if (!req) throw apiError_('NOT_FOUND', 'There is no open reset request for this account.');
  return { acct: acct, req: req, t: t };
}

function resetsApprove_(d, ctx, request) {
  return withLock_(function () {
    var x = pendingReset_(ctx, d.login), now = new Date();
    accountUpdate_(x.acct, { pw_hash: x.req.new_pw_hash, pw_salt: x.req.new_pw_salt, pw_iterations: x.req.new_pw_iterations,
      failed_tries: 0, locked_until: '', updated_by: ctx.login });
    storeUpdate_(x.t, x.req._row, { status: 'APPROVED', decided_by: ctx.login, decided_at: now });
    endSessions_(x.acct.login, 'reset');
    audit_(ctx, 'resets.approve', x.acct.login, x.acct.role === 'DEVOTEE' ? devoteeBatch_(x.acct) : '', null, null, '', request.requestId);
    return {};
  });
}

function resetsReject_(d, ctx, request) {
  return withLock_(function () {
    var x = pendingReset_(ctx, d.login);
    storeUpdate_(x.t, x.req._row, { status: 'REJECTED', decided_by: ctx.login, decided_at: new Date() });
    audit_(ctx, 'resets.reject', x.acct.login, '', null, null, '', request.requestId);
    return {};
  });
}

function registrySearch_(d) {
  var linked = linkedLogins_();
  return { results: registrySearchRows_(registryRows_(false), d.q).map(function (r) { r.linked = !!linked[r.iyfId]; return r; }) };
}
