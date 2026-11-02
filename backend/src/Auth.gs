/**
 * Auth.gs — sign-up, login, logout, password change and reset requests (API contract §1, §2).
 */
var BLOOD_GROUPS_ = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', "Don't know"];

function authSignUp_(d) {
  var problems = [];
  var phone = normPhone_(d.phone);
  if (!phone) problems.push({ path: 'phone', message: 'Enter a 10-digit mobile number.' });
  var name = cleanName_(d.name);
  if (!validName_(name)) problems.push({ path: 'name', message: 'Enter your name (letters and spaces).' });
  var batch = batchesAll_().filter(function (b) { return b.batch_id === d.batchId && truthy_(b.active); })[0];
  if (!batch) problems.push({ path: 'batchId', message: 'Choose your batch.' });
  var pwProblem = passwordProblem_(d.password, phone);
  if (pwProblem) problems.push({ path: 'password', message: pwProblem });
  var p = d.profile || {};
  if (typeof p !== 'object' || Array.isArray(p)) p = {};
  Object.keys(p).forEach(function (k) { if (['dob', 'bloodGroup', 'emergency'].indexOf(k) === -1) throw apiError_('BAD_REQUEST', 'Unknown field profile.' + k); });
  var dob = parseYmd_(p.dob);
  if (!dob) problems.push({ path: 'profile.dob', message: 'Enter your date of birth.' });
  else { var age = ageOn_(dob, new Date()); if (age < 12 || age > 80) problems.push({ path: 'profile.dob', message: 'Check your date of birth.' }); }
  if (BLOOD_GROUPS_.indexOf(p.bloodGroup) === -1) problems.push({ path: 'profile.bloodGroup', message: 'Choose your blood group (or "Don\'t know").' });
  var em = p.emergency && typeof p.emergency === 'object' ? p.emergency : {};
  var emName = cleanName_(em.name), emRel = cleanName_(em.relation), emPhone = normPhone_(em.phone);
  if (!validName_(emName)) problems.push({ path: 'profile.emergency.name', message: 'Enter the emergency contact\'s name.' });
  if (!emRel || emRel.length > 30) problems.push({ path: 'profile.emergency.relation', message: 'Enter how they are related to you.' });
  if (!emPhone) problems.push({ path: 'profile.emergency.phone', message: 'Enter their 10-digit mobile number.' });
  else if (emPhone === phone) problems.push({ path: 'profile.emergency.phone', message: 'Use someone else\'s number, not your own.' });
  if (problems.length) throw invalid_(problems);

  var hourKey = 'signups:' + Utilities.formatDate(new Date(), TZ, 'yyyyMMddHH'), cache = CacheService.getScriptCache();
  if (Number(cache.get(hourKey) || 0) >= LIMITS.SIGNUPS_PER_HOUR) throw apiError_('BUSY', 'Many people are signing up right now. Please try again in an hour.');

  var hash = hashPassword_(d.password);                 // slow; done before taking the lock
  var now = new Date();
  withLock_(function () {
    if (storeFindRow_(table_('access', 'Accounts'), 'login', phone)) {
      throw apiError_('CONFLICT', 'This number already has an account. Log in, or use Forgot password.');
    }
    storeAppend_(table_('access', 'Accounts'), {
      login: phone, role: 'DEVOTEE', status: 'PENDING', name: name, phone: phone, iyf_id: '', id_source: '',
      requested_batch: batch.batch_id, pw_hash: hash.pw_hash, pw_salt: hash.pw_salt, pw_iterations: hash.pw_iterations,
      must_change_pw: false, failed_tries: 0, locked_until: '', signed_up_at: now, decided_at: '', decided_by: '',
      reject_reason: '', last_login_at: '', updated_at: now, updated_by: phone
    });
    storeAppend_(table_('profiles', 'Profiles'), {
      login: phone, iyf_id: '', name: name, dob: dob, blood_group: p.bloodGroup, emergency_name: emName,
      emergency_relation: emRel, emergency_phone: emPhone, photo_file_id: '', photo_updated_at: '',
      reading_pages_per_hour: 20, current_book_id: '', updated_at: now, updated_by: phone
    });
  });
  cache.put(hourKey, String(Number(cache.get(hourKey) || 0) + 1), 3700);
  return { status: 'PENDING' };
}

function authLogin_(d) {
  var login = normLogin_(d.login), pw = typeof d.password === 'string' ? d.password : '';
  var bad = function () { return apiError_('BAD_CREDENTIALS', 'Phone or password is wrong.'); };
  if (!login || !pw || pw.length > 256) { dummyVerify_(pw || 'x'); throw bad(); }
  var acct = accountFull_(login);
  if (!acct) { dummyVerify_(pw); throw bad(); }

  var now = new Date(), lockedUntil = asDate_(acct.locked_until);
  if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
    throw apiError_('LOCKED_OUT', 'Too many wrong tries. Try again after ' + Utilities.formatDate(lockedUntil, TZ, 'h:mm a') + '.', { data: { until: iso_(lockedUntil) } });
  }
  if (!verifyPassword_(pw, acct)) {
    var tries = (Number(acct.failed_tries) || 0) + 1, maxTries = Number(setting_('lockout_tries', LIMITS.LOCKOUT_TRIES)) || LIMITS.LOCKOUT_TRIES;
    if (tries >= maxTries) {
      var until = addMinutes_(now, Number(setting_('lockout_minutes', LIMITS.LOCKOUT_MINUTES)) || LIMITS.LOCKOUT_MINUTES);
      accountUpdate_(acct, { failed_tries: 0, locked_until: until, updated_by: 'SYSTEM' });
      throw apiError_('LOCKED_OUT', 'Too many wrong tries. Try again after ' + Utilities.formatDate(until, TZ, 'h:mm a') + '.', { data: { until: iso_(until) } });
    }
    accountUpdate_(acct, { failed_tries: tries, updated_by: 'SYSTEM' });
    throw bad();
  }
  // the password is right: only now say anything about the account's state
  var st = String(acct.status);
  if (st === 'PENDING') throw apiError_('PENDING_APPROVAL', 'Your sign-up is waiting for your coordinator\'s approval.');
  if (st === 'REJECTED') throw apiError_('REJECTED', 'Your sign-up was not approved' + (acct.reject_reason ? ': ' + acct.reject_reason : '.') + ' Please speak to your coordinator.');
  if (st === 'DISABLED') throw apiError_('ACCOUNT_DISABLED', 'This account is switched off. Please speak to your coordinator.');
  if (st === 'INACTIVE') throw apiError_('ACCOUNT_DISABLED', 'Your account is marked inactive. Please ask your coordinator to make it active again.');
  if (st !== 'ACTIVE') throw bad();

  var change = { failed_tries: 0, locked_until: '', last_login_at: now, updated_by: String(acct.login) };
  if ((Number(acct.pw_iterations) || 0) < pbkdf2Iterations_()) {       // a stronger setting since this hash was made
    var h = hashPassword_(pw); change.pw_hash = h.pw_hash; change.pw_salt = h.pw_salt; change.pw_iterations = h.pw_iterations;
  }
  accountUpdate_(acct, change);
  var s = startSession_(acct, d.device);
  var fresh = { login: String(acct.login), role: String(acct.role), status: 'ACTIVE', name: String(acct.name), iyf_id: String(acct.iyf_id || ''),
                requested_batch: String(acct.requested_batch || ''), must_change_pw: truthy_(acct.must_change_pw) };
  CacheService.getScriptCache().put('ac:' + fresh.login, JSON.stringify(fresh), 300);   // saves re-reading the row
  return { token: s.token, expiresAt: s.expiresAt, user: userInfo_(fresh) };
}

/** The user object every login and auth.me returns. */
function userInfo_(a) {
  var ctx = { login: a.login, role: a.role };
  return { login: a.login, role: a.role, name: a.name, iyfId: a.iyf_id || null, batchIds: scopeBatches_(ctx), mustChangePassword: !!a.must_change_pw };
}

function authMe_(d, ctx) {
  return { user: userInfo_(accountCached_(ctx.login)),
           versions: { rules: setting_('rules_version', 'r0'), journals: setting_('journals_version', 'j0') },
           today: ymd_(new Date()), openWeeks: [] };
}

function authLogout_(d, ctx) { endSession_(ctx.sessionHash, 'logout'); return {}; }

function authChangePassword_(d, ctx, req) {
  var acct = accountFull_(ctx.login);
  if (typeof d.current !== 'string' || !verifyPassword_(d.current, acct)) throw apiError_('BAD_CREDENTIALS', 'Your current password is wrong.');
  var problem = passwordProblem_(d['new'], ctx.login);
  if (problem) throw invalid_({ path: 'new', message: problem });
  if (d['new'] === d.current) throw invalid_({ path: 'new', message: 'Choose a password different from the current one.' });
  var h = hashPassword_(d['new']);
  accountUpdate_(acct, { pw_hash: h.pw_hash, pw_salt: h.pw_salt, pw_iterations: h.pw_iterations, must_change_pw: false, updated_by: ctx.login });
  endSessions_(ctx.login, 'password change', ctx.sessionHash);
  audit_(ctx, 'auth.changePassword', ctx.login, '', null, null, '', req.requestId);
  return {};
}

/** Always the same answer, so nobody can find out which numbers have accounts. */
function authRequestReset_(d, ctx, req) {
  var login = normLogin_(d.login);
  var problem = passwordProblem_(d.newPassword, login);
  if (problem) throw invalid_({ path: 'newPassword', message: problem });
  var h = hashPassword_(d.newPassword);                  // computed even for unknown logins: same time either way
  var done = { status: 'RESET_REQUESTED' };
  if (!login) return done;
  var cache = CacheService.getScriptCache(), dayKey = 'resets:' + login + ':' + ymd_(new Date());
  var n = Number(cache.get(dayKey) || 0);
  if (n >= LIMITS.RESETS_PER_DAY) return done;
  cache.put(dayKey, String(n + 1), 90000);
  var acct = accountFull_(login);
  if (!acct || ['ACTIVE', 'INACTIVE', 'DISABLED'].indexOf(String(acct.status)) === -1 || acct.role === 'MASTER') return done;
  withLock_(function () {
    var t = table_('access', 'ResetRequests');
    storeFindRows_(t, 'login', login).forEach(function (row) {
      if (storeGet_(t, row).status === 'PENDING') storeUpdate_(t, row, { status: 'SUPERSEDED', decided_at: new Date(), decided_by: 'SYSTEM' });
    });
    storeAppend_(t, { login: login, requested_at: new Date(), new_pw_hash: h.pw_hash, new_pw_salt: h.pw_salt,
      new_pw_iterations: h.pw_iterations, status: 'PENDING', decided_by: '', decided_at: '' });
  });
  return done;
}
