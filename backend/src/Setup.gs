/**
 * Setup.gs — run by hand from the Apps Script editor, as iyfdelhi.database@gmail.com. Never called by the app.
 *
 *   1. setupSecrets()     makes PW_PEPPER once (never changes it afterwards)
 *   2. timePbkdf2()       measures this server and stores the password-hashing strength in Rules › Settings
 *   3. createMaster()     the master login "master": first put a temporary password in Script Properties as
 *                         MASTER_SETUP_PASSWORD; this hashes it, deletes the property, and you choose your own
 *                         password at first login. Run again (resetMasterPassword) if the master password is lost.
 *   4. installTriggers()  the background jobs (today: the IYF ID registry copy, every 30 minutes)
 *   5. checkSetup()       reads every file, tab and setting and logs what is missing
 */

function installTriggers() {
  var want = { refreshRegistryJob: function (b) { return b.timeBased().everyMinutes(30); } };
  ScriptApp.getProjectTriggers().forEach(function (t) { if (want[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t); });
  Object.keys(want).forEach(function (fn) { want[fn](ScriptApp.newTrigger(fn)).create(); });
  refreshRegistryJob();
  Logger.log('Background jobs installed: ' + Object.keys(want).join(', ') + '. The registry copy is ready.');
}

function setupSecrets() {
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty('PW_PEPPER')) { Logger.log('PW_PEPPER already set; left unchanged (changing it would invalidate every password).'); return; }
  p.setProperty('PW_PEPPER', randomHex_(64));
  Logger.log('PW_PEPPER created. Keep this project\'s Script Properties private; never edit PW_PEPPER.');
}

function timePbkdf2() {
  var probe = 2000, t0 = Date.now();
  pbkdf2_(utf8_('timing-probe'), hexBytes_(randomHex_(32)), probe);
  var ms = Math.max(1, Date.now() - t0);
  var target = Math.max(1000, Math.round(probe * 400 / ms / 500) * 500);
  var t = table_('rules', 'Settings'), row = storeFindRow_(t, 'key', 'pbkdf2_iterations');
  if (!row) throw new Error('Rules › Settings has no pbkdf2_iterations row.');
  storeUpdate_(t, row, { value: String(target), changed_by: 'timePbkdf2', changed_at: new Date() });
  cacheDrop_('settings:v1');
  Logger.log(probe + ' rounds took ' + ms + ' ms here, so logins will use ' + target + ' rounds (about 0.4 s).');
}

function createMaster() { masterFromProperty_(false); }
function resetMasterPassword() { masterFromProperty_(true); }

function masterFromProperty_(reset) {
  var props = PropertiesService.getScriptProperties(), pw = props.getProperty('MASTER_SETUP_PASSWORD');
  if (!pw) throw new Error('First add a Script Property MASTER_SETUP_PASSWORD with a temporary password (8+ characters).');
  var problem = passwordProblem_(pw, 'master');
  if (problem) throw new Error('MASTER_SETUP_PASSWORD: ' + problem);
  var h = hashPassword_(pw), now = new Date(), sys = { login: 'setup', role: 'MASTER' };
  withLock_(function () {
    var a = accountFull_('master');
    if (a && !reset) throw new Error('A master account already exists. Use resetMasterPassword() to replace its password.');
    if (!a && reset) throw new Error('There is no master account yet. Use createMaster().');
    if (a) {
      accountUpdate_(a, { pw_hash: h.pw_hash, pw_salt: h.pw_salt, pw_iterations: h.pw_iterations, must_change_pw: true,
        failed_tries: 0, locked_until: '', status: 'ACTIVE', updated_by: 'setup' });
      endSessions_('master', 'reset');
    } else {
      storeAppend_(table_('access', 'Accounts'), {
        login: 'master', role: 'MASTER', status: 'ACTIVE', name: 'IYF Head', phone: '', iyf_id: '', id_source: '', requested_batch: '',
        pw_hash: h.pw_hash, pw_salt: h.pw_salt, pw_iterations: h.pw_iterations, must_change_pw: true, failed_tries: 0, locked_until: '',
        signed_up_at: now, decided_at: now, decided_by: 'setup', reject_reason: '', last_login_at: '', updated_at: now, updated_by: 'setup'
      });
    }
    audit_(sys, reset ? 'setup.resetMasterPassword' : 'setup.createMaster', 'master', '', null, null, '', '');
  });
  props.deleteProperty('MASTER_SETUP_PASSWORD');
  Logger.log('Master login ready: username "master". Log in with the temporary password and choose your own.');
}

function checkSetup() {
  var lines = [];
  var ok = function (good, text) { lines.push((good ? 'OK    ' : 'NEEDS ') + text); };
  ok(!!prop_('PW_PEPPER'), 'PW_PEPPER in Script Properties (run setupSecrets)');
  Object.keys(FILES).forEach(function (k) {
    try { var ss = SpreadsheetApp.openById(FILES[k]); ok(true, k + ': ' + ss.getName()); }
    catch (e) { ok(false, k + ': cannot open (' + e.message + ')'); }
  });
  [['access', ['Accounts', 'Batches', 'Memberships', 'ResetRequests', 'Sessions', 'AuditLog', 'RunLog']], ['profiles', ['Profiles']], ['rules', ['Settings']]].forEach(function (f) {
    f[1].forEach(function (tab) { try { table_(f[0], tab); ok(true, f[0] + ' › ' + tab); } catch (e) { ok(false, f[0] + ' › ' + tab + ': ' + e.message); } });
  });
  try { ok(true, 'IYF ID registry readable: ' + registryRows_(true).length + ' IDs'); }
  catch (e) { ok(false, 'IYF ID registry (dashboard Devotees tab): ' + e.message + ' — give this account view access to the dashboard spreadsheet'); }
  ok(parseInt(setting_('pbkdf2_iterations', ''), 10) >= 1000, 'pbkdf2_iterations set (run timePbkdf2)');
  ok(!!accountFull_('master'), 'master account (run createMaster)');
  ok(ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'refreshRegistryJob'; }), 'background jobs (run installTriggers)');
  Logger.log(lines.join('\n'));
  return lines;
}
