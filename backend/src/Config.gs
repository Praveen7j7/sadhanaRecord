/**
 * Config.gs — where everything lives. File ids are not secrets; secrets live in Script Properties:
 *   PW_PEPPER        random, made by setupSecrets(); never change it (every password depends on it)
 *   REGISTRY_SECRET  random, made by setupSecrets(); the same value goes into the dashboard's Script Properties
 *   REGISTRY_URL     the dashboard web app's /exec URL
 * Owner of every file and of this project: iyfdelhi.database@gmail.com.
 */
var TZ = 'Asia/Kolkata';
var FILES = {
  access: '1WoxJzM3DDL3eErlraVnMu8bgV4chbjQFyq3mZZBUBiE',
  profiles: '1adyq4oRscn1D4ix-5yNNSiipL_86HvsafWA16k3Vv8E',
  rules: '1ntt_60RELoggelUmdBmPQouLYmGQqRL4yD8fAdcs71Y',
  drafts: '1p2yU21rEfPT4AIDplVfswA9IYet-s2zrs1TYeW9fvQ8',
  submissions2026: '122By7qxjNy4TdAbuFWJI7bXTydM00z3VmK0dgwx-itU',
  viewSPS: '1Zc_iqVJM2XaPfi9I03Ob7ziTq0JP2wepGdCuP3z_p4A',
  viewDPS: '1v939aUkHTMElwPp32bvA9I0JveoAtWexONLY5u2b8VA',
  viewBSS: '1Ted2gOYmnQCOhMbedrCRYCRfh9HM3qnGDzpKtKGTDE4',
  viewBVS: '1knHisiBjcpHmiZLM4Z4Ybr54Gku52sNs0KbggcWmaPE'
};
var LIMITS = {
  PBKDF2_FALLBACK: 3000,        // used only until timePbkdf2() has written Rules › Settings › pbkdf2_iterations
  SESSION_DAYS: 30,
  LOCKOUT_TRIES: 5,
  LOCKOUT_MINUTES: 15,
  SIGNUPS_PER_HOUR: 200,        // across everyone; Apps Script cannot see the caller's address
  RESETS_PER_DAY: 3,            // per login
  LOCK_WAIT_MS: 10000,
  SLOW_MS: 5000                 // slower requests also go to the Run Log, with where the time went
};
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
