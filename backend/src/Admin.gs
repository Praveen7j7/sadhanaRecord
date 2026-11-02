/**
 * Admin.gs — public meta, and the master's screens: coordinators, batches, IYF ID links (API contract §1, §5).
 */

function metaGet_() {
  return cacheJson_('meta:v1', 300, function () {
    var names = coordinatorNames_();
    var parseWin = function (s) { return String(s || '').trim().toUpperCase(); };
    return {
      batches: batchesAll_().filter(function (b) { return truthy_(b.active); }).map(function (b) {
        return { batchId: String(b.batch_id), name: String(b.name),
                 coordinatorName: csv_(b.coordinator_logins).map(function (l) { return names[l]; }).filter(String).join(', ') };
      }),
      submitWindow: { opens: parseWin(setting_('submit_opens', 'SUN 18:00')), closes: parseWin(setting_('submit_closes', 'MON 21:00')) },
      minApp: setting_('min_app', '')
    };
  });
}

/** { username: name } for ACTIVE coordinators. */
function coordinatorNames_() {
  var out = {};
  storeAll_(table_('access', 'Accounts')).forEach(function (a) {
    if (a.role === 'COORDINATOR' && a.status === 'ACTIVE') out[String(a.login)] = String(a.name);
  });
  return out;
}

function coordinatorRow_(username) {
  var u = String(username || '').trim().toLowerCase();
  var a = u ? accountFull_(u) : null;
  if (!a || a.role !== 'COORDINATOR') throw apiError_('NOT_FOUND', 'No coordinator called ' + u + '.');
  return a;
}
function checkBatchIds_(ids) {
  if (!Array.isArray(ids)) throw invalid_({ path: 'batchIds', message: 'Choose the batches.' });
  var known = batchesAll_().map(function (b) { return String(b.batch_id); });
  ids.forEach(function (id) { if (known.indexOf(String(id)) === -1) throw invalid_({ path: 'batchIds', message: 'Unknown batch ' + id + '.' }); });
  return ids.map(String);
}
/** Makes `username` the coordinator of exactly `batchIds` (adds or removes it from each batch's list). */
function setCoordinatorBatches_(username, batchIds) {
  var t = table_('access', 'Batches');
  storeAll_(t).forEach(function (b) {
    var list = csv_(b.coordinator_logins), has = list.indexOf(username) !== -1, want = batchIds.indexOf(String(b.batch_id)) !== -1;
    if (has === want) return;
    list = want ? list.concat([username]) : list.filter(function (l) { return l !== username; });
    storeUpdate_(t, b._row, { coordinator_logins: list.join(','), updated_at: new Date(), updated_by: 'master' });
  });
  cacheDrop_(['batches:v1', 'meta:v1']);
}

function coordinatorView_(a, batches) {
  return { username: String(a.login), name: String(a.name), phone: String(a.phone || ''), status: String(a.status),
           batchIds: batches.filter(function (b) { return csv_(b.coordinator_logins).indexOf(String(a.login)) !== -1; }).map(function (b) { return String(b.batch_id); }),
           mustChangePassword: truthy_(a.must_change_pw), lastLogin: iso_(asDate_(a.last_login_at)) };
}
/** The coordinator as the list shows it, read fresh after a change, so the app can update without reloading. */
function coordinatorFresh_(username) { return coordinatorView_(accountFull_(username), batchesAll_()); }

function coordinatorsList_() {
  var batches = batchesAll_();
  return storeAll_(table_('access', 'Accounts')).filter(function (a) { return a.role === 'COORDINATOR'; })
    .map(function (a) { return coordinatorView_(a, batches); });
}

function coordinatorsCreate_(d, ctx, req) {
  var problems = [], username = String(d.username || '').trim().toLowerCase(), name = cleanName_(d.name);
  if (!validUsername_(username)) problems.push({ path: 'username', message: 'Use 3–30 lowercase letters, digits, dots or dashes, starting with a letter.' });
  if (!validName_(name)) problems.push({ path: 'name', message: 'Enter the coordinator\'s name.' });
  var phone = d.phone === undefined || d.phone === '' ? '' : normPhone_(d.phone);
  if (d.phone !== undefined && d.phone !== '' && !phone) problems.push({ path: 'phone', message: 'Enter a 10-digit mobile number, or leave it empty.' });
  var pw = passwordProblem_(d.tempPassword, username);
  if (pw) problems.push({ path: 'tempPassword', message: pw });
  if (problems.length) throw invalid_(problems);
  var batchIds = checkBatchIds_(d.batchIds || []);
  var h = hashPassword_(d.tempPassword), now = new Date();
  return withLock_(function () {
    if (accountFull_(username)) throw apiError_('CONFLICT', 'The username ' + username + ' is taken.');
    storeAppend_(table_('access', 'Accounts'), {
      login: username, role: 'COORDINATOR', status: 'ACTIVE', name: name, phone: phone, iyf_id: '', id_source: '', requested_batch: '',
      pw_hash: h.pw_hash, pw_salt: h.pw_salt, pw_iterations: h.pw_iterations, must_change_pw: true, failed_tries: 0, locked_until: '',
      signed_up_at: now, decided_at: now, decided_by: ctx.login, reject_reason: '', last_login_at: '', updated_at: now, updated_by: ctx.login
    });
    setCoordinatorBatches_(username, batchIds);
    audit_(ctx, 'coordinators.create', username, batchIds.join(','), null, { name: name, batchIds: batchIds }, '', req.requestId);
    return { coordinator: coordinatorFresh_(username) };
  });
}

function coordinatorsUpdate_(d, ctx, req) {
  return withLock_(function () {
    var a = coordinatorRow_(d.username), change = { updated_by: ctx.login };
    if (d.name !== undefined) { var n = cleanName_(d.name); if (!validName_(n)) throw invalid_({ path: 'name', message: 'Enter the coordinator\'s name.' }); change.name = n; }
    if (d.phone !== undefined) { var p = d.phone === '' ? '' : normPhone_(d.phone); if (d.phone !== '' && !p) throw invalid_({ path: 'phone', message: 'Enter a 10-digit mobile number, or leave it empty.' }); change.phone = p; }
    accountUpdate_(a, change);
    if (d.batchIds !== undefined) setCoordinatorBatches_(String(a.login), checkBatchIds_(d.batchIds));
    audit_(ctx, 'coordinators.update', a.login, '', null, d, '', req.requestId);
    return { coordinator: coordinatorFresh_(String(a.login)) };
  });
}

function coordinatorsSetDisabled_(d, ctx, req) {
  if (typeof d.disabled !== 'boolean') throw invalid_({ path: 'disabled', message: 'Choose on or off.' });
  return withLock_(function () {
    var a = coordinatorRow_(d.username);
    accountUpdate_(a, { status: d.disabled ? 'DISABLED' : 'ACTIVE', updated_by: ctx.login });
    if (d.disabled) endSessions_(a.login, 'disabled');
    audit_(ctx, 'coordinators.setDisabled', a.login, '', { status: a.status }, { status: d.disabled ? 'DISABLED' : 'ACTIVE' }, '', req.requestId);
    return { coordinator: coordinatorFresh_(String(a.login)) };
  });
}

function coordinatorsResetPassword_(d, ctx, req) {
  var a0 = coordinatorRow_(d.username), problem = passwordProblem_(d.tempPassword, String(a0.login));
  if (problem) throw invalid_({ path: 'tempPassword', message: problem });
  var h = hashPassword_(d.tempPassword);
  return withLock_(function () {
    var a = coordinatorRow_(d.username);
    accountUpdate_(a, { pw_hash: h.pw_hash, pw_salt: h.pw_salt, pw_iterations: h.pw_iterations, must_change_pw: true,
      failed_tries: 0, locked_until: '', updated_by: ctx.login });
    endSessions_(a.login, 'reset');
    audit_(ctx, 'coordinators.resetPassword', a.login, '', null, null, '', req.requestId);
    return { coordinator: coordinatorFresh_(String(a.login)) };
  });
}

function batchView_(b, names) {
  var logins = csv_(b.coordinator_logins);
  return { batchId: String(b.batch_id), name: String(b.name), level: String(b.level), active: truthy_(b.active), pilot: truthy_(b.pilot),
           standing: truthy_(b.standing), coordinatorLogins: logins, coordinatorNames: logins.map(function (l) { return names[l] || l; }) };
}
function batchesList_() {
  var names = coordinatorNames_();
  return batchesAll_().map(function (b) { return batchView_(b, names); });
}

function batchesUpdate_(d, ctx, req) {
  return withLock_(function () {
    var t = table_('access', 'Batches'), b = storeFind_(t, 'batch_id', String(d.batchId || ''));
    if (!b) throw apiError_('NOT_FOUND', 'No such batch.');
    var change = { updated_at: new Date(), updated_by: ctx.login };
    if (d.name !== undefined) { var n = cleanName_(d.name); if (n.length < 2 || n.length > 40) throw invalid_({ path: 'name', message: 'Give the batch a name.' }); change.name = n; }
    ['active', 'pilot'].forEach(function (k) {
      if (d[k] === undefined) return;
      if (typeof d[k] !== 'boolean') throw invalid_({ path: k, message: 'Choose yes or no.' });
      change[k] = d[k];
    });
    if (d.coordinatorLogins !== undefined) {
      if (!Array.isArray(d.coordinatorLogins)) throw invalid_({ path: 'coordinatorLogins', message: 'Choose the coordinators.' });
      var logins = d.coordinatorLogins.map(function (l) { return String(l).trim().toLowerCase(); });
      logins.forEach(function (l) { var a = accountFull_(l); if (!a || a.role !== 'COORDINATOR') throw invalid_({ path: 'coordinatorLogins', message: 'No coordinator called ' + l + '.' }); });
      change.coordinator_logins = logins.join(',');
    }
    storeUpdate_(t, b._row, change);
    cacheDrop_(['batches:v1', 'meta:v1']);
    audit_(ctx, 'batches.update', b.batch_id, b.batch_id, null, d, '', req.requestId);
    return batchView_(storeGet_(t, b._row), coordinatorNames_());
  });
}

/* ---- IYF ID links (the registry itself is read-only) ---- */

function idsSearch_(d) {
  var linked = linkedLogins_();
  return { results: registrySearchRows_(registryRows_(false), d.q).map(function (r) {
    r.linked = !!linked[r.iyfId]; r.linkedAccount = linked[r.iyfId] || null; return r; }) };
}

function idsGet_(d) {
  var id = String(d.iyfId || '').trim().toUpperCase();
  var r = ID_PATTERN_.test(id) ? registryRows_(false).filter(function (x) { return x.id === id; })[0] : null;
  if (!r) throw apiError_('UNKNOWN_ID', id + ' is not in the registry.');
  var phones = {};
  if (r.phone) phones[r.phone] = 1;
  r.aliases.forEach(function (k) { var p = k.split('|')[0]; if (p) phones[p] = 1; });
  var out = registryPublic_(r, '');
  out.phones = Object.keys(phones);
  out.linkedAccount = linkedLogins_()[id] || null;
  var acct = out.linkedAccount ? accountFull_(out.linkedAccount.login) : null;
  out.batchHistory = acct ? storeFindRows_(table_('access', 'Memberships'), 'login', String(acct.login)).map(function (row) {
    var m = storeGet_(table_('access', 'Memberships'), row);
    return { batchId: String(m.batch_id), state: String(m.state), fromWeek: m.from_week instanceof Date ? ymd_(m.from_week) : '',
             toWeek: m.to_week instanceof Date ? ymd_(m.to_week) : '' };
  }) : [];
  return out;
}

function devoteeAccount_(login) {
  var p = normPhone_(login), a = p ? accountFull_(p) : null;
  if (!a || a.role !== 'DEVOTEE') throw apiError_('NOT_FOUND', 'No devotee with that phone.');
  if (a.status === 'PENDING' || a.status === 'REJECTED') throw apiError_('CONFLICT', 'Approve the sign-up first.');
  return a;
}
/** Writes the link on the account, its profile and its memberships. */
function setLink_(a, iyfId, source, ctx) {
  accountUpdate_(a, { iyf_id: iyfId, id_source: source, updated_by: ctx ? ctx.login : 'SYSTEM' });
  var prof = table_('profiles', 'Profiles'), prow = storeFindRow_(prof, 'login', String(a.login));
  if (prow) storeUpdate_(prof, prow, { iyf_id: iyfId, updated_at: new Date(), updated_by: ctx ? ctx.login : 'SYSTEM' });
  var mt = table_('access', 'Memberships');
  storeFindRows_(mt, 'login', String(a.login)).forEach(function (row) { storeUpdate_(mt, row, { iyf_id: iyfId }); });
}

function idsLink_(d, ctx, req) {
  var reason = cleanName_(d.reason);
  if (reason.length < 2) throw invalid_({ path: 'reason', message: 'Give a short reason.' });
  return withLock_(function () {
    var a = devoteeAccount_(d.login), id = String(d.iyfId || '').trim().toUpperCase();
    checkIyfId_(id, a.login);
    var before = String(a.iyf_id || '');
    setLink_(a, id, 'MASTER', ctx);
    audit_(ctx, 'ids.link', a.login, devoteeBatch_(a), { iyf_id: before }, { iyf_id: id }, reason, req.requestId);
    return {};
  });
}

function idsUnlink_(d, ctx, req) {
  var reason = cleanName_(d.reason);
  if (reason.length < 2) throw invalid_({ path: 'reason', message: 'Give a short reason.' });
  return withLock_(function () {
    var a = devoteeAccount_(d.login), before = String(a.iyf_id || '');
    if (!before) throw apiError_('CONFLICT', 'This account has no IYF ID linked.');
    setLink_(a, '', '', ctx);
    audit_(ctx, 'ids.unlink', a.login, devoteeBatch_(a), { iyf_id: before }, { iyf_id: '' }, reason, req.requestId);
    return {};
  });
}
