// API client for the Sadhana contract v1. One endpoint, named actions, always HTTP 200.
import { APP_BUILD as APP } from './build.js';
const TOKEN_KEY = 'sr.token';

// Routes that work with no login. meta.get is public — the sign-up screen calls it before anyone has
// an account — but it answers a SIGNED-IN caller with their staff batch list as well, so its token is
// sent when there is one. The others are stripped: a token has no meaning on them and sending it to a
// public route is a disclosure for nothing.
const PUBLIC = new Set(['auth.signUp', 'auth.login', 'auth.requestReset', 'auth.lookup', 'push.register', 'push.unsubscribe']);
const PUBLIC_WITH_TOKEN = new Set(['meta.get']);
const WRITES = new Set([
  'auth.signUp', 'auth.requestReset', 'auth.changePassword', 'auth.logoutAll', 'auth.sessionEnd', 'account.delete',
  'requests.approve', 'requests.reject', 'resets.approve', 'resets.reject',
  'coordinators.create', 'coordinators.update', 'coordinators.setDisabled', 'coordinators.resetPassword',
  // a closing promotes people between batches, so a retry must never do it twice (ADR 0009)
  'batches.update', 'batches.close', 'devotees.promote',
  // the card: a retried fill must not count twice, and a phase is opened once
  'phases.open', 'phases.update', 'phases.close', 'card.fill', 'training.attendance', 'targets.set', 'card.unlock', 'targets.unlock',
  // a batch's promotion criteria: a retry must not write them twice
  'criteria.set', 'stages.set',
  // enrolling somebody twice on a retry would double-count a training's students
  'enrol.add', 'enrol.remove',
  'week.saveDay', 'week.saveWeekEnd', 'week.setAttendance', 'week.submit',
  'announcements.create', 'announcements.update', 'announcements.remove',
  'ids.link', 'ids.unlink', 'ids.reviewDuplicate',
  'identity.link', 'identity.mint', 'identity.supersede', 'identity.merge', 'identity.mintBatch', 'identity.serviceToken', 'push.register', 'push.detach', 'profile.update', 'photo.upload', 'photo.remove',
  'devotees.setActive', 'devotees.setDisabled', 'devotees.delete', 'devotees.setPeople',
  'announcements.like', 'announcements.comment', 'announcements.uncomment', 'facilitators.add', 'facilitators.setActive', 'facilitators.delete', 'facilitators.rename', 'facilitators.setLasting', 'access.set', 'access.assign', 'access.revoke',
  'books.setCurrent', 'announcements.report', 'announcements.resolve', 'mutes.set', 'mutes.setAll',
  'facLogins.create', 'facLogins.setDisabled', 'facLogins.resetPassword', 'facLogins.link', 'facLogins.unlink', 'batches.create', 'weeks.setClass', 'masters.set',
  'attendance.set', 'attendance.override', 'group.mark', 'leaders.set', 'leaders.assign', 'push.subscribe', 'push.unsubscribe', 'vitals.report', 'settings.update', 'reopen.request', 'reopen.reject', 'weeks.reopen',
  'ids.create', 'heads.decide', 'heads.withdraw',
  // Share sadhana: a retried share, removal or leave must not be applied twice
  'share.add', 'share.remove', 'share.leave',
  // asking to start a batch (Phase 23): a retried ask, withdrawal or decline must not be applied twice
  'batchReq.create', 'batchReq.withdraw', 'batchReq.decide',
]);

// timeoutMs (Phase 1): a server that does not answer within 15 s fails the call with a clear message instead of hanging
export const config = { busyDelayMs: 2000, busyRetries: 3, timeoutMs: 15000 };

// The server's clock (every reply carries serverTime): the time gates on screen (Saturday 6 PM, the Sunday class, the
// Monday 9 PM deadline) follow it, so a phone with a wrong clock shows the same locks the server keeps.
let clockSkew = 0;
/** Now, by the server's clock (ms). */
export const serverNow = () => Date.now() + clockSkew;
function noteServerTime(t) {
  const ms = Date.parse(t || '');
  if (Number.isFinite(ms)) clockSkew = ms - Date.now();
}
export const hooks = { onUnauthenticated() {}, onMustChangePassword() {}, onForbidden() {} };

export class ApiError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    this.fields = extra.fields || [];
    this.data = extra.data || null;
  }
}

// ---- token storage (never throws) ----
export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(t) {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage blocked */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
}

// ---- input normalisation ----
export function isPhoneLike(s) {
  return /^[+\d\s()-]+$/.test(String(s).trim()) && /\d/.test(s);
}
export function normalizePhone(s) {
  let d = String(s).replace(/[\s()-]/g, '');
  if (/^\+91\d{10}$/.test(d)) d = d.slice(3);
  else if (/^91\d{10}$/.test(d)) d = d.slice(2);
  else if (/^0\d{10}$/.test(d)) d = d.slice(1);
  return d;
}
export function normalizeLogin(s) {
  const t = String(s).trim();
  return isPhoneLike(t) ? normalizePhone(t) : t.toLowerCase();
}

// ---- helpers ----
// randomUUID is missing on older iOS Safari and in any non-secure context; without a fallback every write throws
// before it is sent, because each one needs a requestId (13 Oct 2026, audit FE-8).
export const newRequestId = () => {
  try { if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID(); } catch { /* fall through */ }
  try {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;          // version 4, variant 1
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  } catch { /* no crypto at all */ }
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import { setOnline } from './pro.svelte.js';
import { reloadWhenIdle } from './sw.js';
const FRIENDLY = 'No connection, try again';
const SLOW = 'The server is not answering. Please try again in a moment.';
/** A promise that fails with TIMEOUT after config.timeoutMs (and aborts the request, when one is given). */
// a picture going up on a slow connection may need longer: those calls get a minute
const LONG = new Set(['photo.upload', 'announcements.create', 'announcements.update']);
function deadline(p, ctl, ms = config.timeoutMs) {
  let t;
  const late = new Promise((_, reject) => { t = setTimeout(() => { ctl?.abort(); reject(new ApiError('TIMEOUT', SLOW)); }, ms); });
  return Promise.race([p, late]).finally(() => clearTimeout(t));
}

// Same action + same data after a lost reply reuses the requestId, so the server never writes twice.
const inflightIds = new Map();

async function transport(body) {
  const ms = LONG.has(body.action) ? Math.max(60000, config.timeoutMs) : config.timeoutMs;
  const url = import.meta.env.VITE_API_URL;
  if (!url) {
    const { handle } = await import('./mock.js'); // dev only: dropped from builds that set VITE_API_URL
    try { return await deadline(handle(body), null, ms); } catch (e) { throw e?.code === 'TIMEOUT' ? e : new ApiError('NETWORK', FRIENDLY); }   // the mock's "offline" switch
  }
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  try {
    return await deadline(fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl?.signal }).then((res) => res.json()), ctl, ms);
  } catch (e) {
    throw e?.code === 'TIMEOUT' ? e : new ApiError('NETWORK', FRIENDLY);
  }
}

export async function call(action, data = {}) {
  const write = WRITES.has(action);
  const key = write ? action + '\n' + JSON.stringify(data) : '';
  const body = { v: 1, action, token: PUBLIC.has(action) && !PUBLIC_WITH_TOKEN.has(action) ? undefined : getToken() || undefined, app: APP, data };
  if (write) {
    if (!inflightIds.has(key)) inflightIds.set(key, newRequestId());
    body.requestId = inflightIds.get(key);
  }

  let reply;
  for (let attempt = 0; ; attempt++) {
    try { reply = await transport(body); }    // NETWORK / TIMEOUT errors propagate, requestId kept for the user's retry
    catch (e) { if (e?.code === 'NETWORK') setOnline(false); throw e; }
    setOnline(true);
    noteServerTime(reply?.serverTime);
    if (reply && !reply.ok && reply.error?.code === 'BUSY' && attempt < config.busyRetries) {
      await sleep(config.busyDelayMs);
      continue;
    }
    break;
  }

  if (reply?.ok) {
    inflightIds.delete(key);
    return reply.data ?? {};
  }
  const e = reply?.error || { code: 'INTERNAL', message: 'Please try again' };
  if (e.code !== 'BUSY' && e.code !== 'INTERNAL') inflightIds.delete(key);
  // a late answer to a request sent with an earlier sign-in (slow network: someone signed in again meanwhile) must not
  // sign out the person signed in now; only an answer about the current sign-in does
  if (e.code === 'UNAUTHENTICATED' && !(body.token && getToken() !== body.token)) {
    clearToken();
    hooks.onUnauthenticated();
  } else if (e.code === 'UPGRADE_REQUIRED') {
    // through the same busy-aware reload the service worker uses (audit FE-9): this used to call
    // location.reload() at once, throwing away a half-filled day form without asking. It also reloaded before
    // the new service worker had taken over, so the old index.html came back and sent the old version again —
    // a second reload a moment later.
    if (typeof location !== 'undefined') reloadWhenIdle();
  } else if (e.code === 'MUST_CHANGE_PASSWORD' && action !== 'auth.login') {
    hooks.onMustChangePassword();
  } else if (e.code === 'FORBIDDEN' && action !== 'auth.me') {
    hooks.onForbidden();
  }
  // the server sends extra facts as `details` (a pending sign-up's name and batch, a lock's end); older answers used `data`
  throw new ApiError(e.code, e.message || 'Something went wrong', { fields: e.fields, data: e.data || e.details || null });
}

// ---- error presentation ----
export function errorMessage(e) {
  if (!(e instanceof ApiError)) return 'Something went wrong';
  switch (e.code) {
    case 'NETWORK': return FRIENDLY;
    case 'TIMEOUT': return SLOW;
    case 'BAD_REQUEST': return 'Something went wrong';
    case 'BAD_CREDENTIALS': return 'Phone or password is wrong';
    case 'PENDING_APPROVAL': return "Waiting for your coordinator's approval";
    case 'INTERNAL': return 'Please try again';
    // the server's own words: trying again cannot help until the allowance resets, so do not say "try again"
    // the server's own sentence; the fallback says the same thing. Never the plan or the quota: that is IYF's
    // billing arrangement, not something a devotee filling their sadhana can use (the head, 15 Oct 2026)
    case 'DAILY_LIMIT': return e.message || 'The app is resting and will be back in the morning. Nothing you have filled is lost.';
    case 'BUSY': return 'The server is busy, please try again';
    case 'UNAUTHENTICATED': return 'Please log in again';
    case 'LOCKED_OUT': return e.message || (e.data?.until ? 'Too many wrong tries. Try again after ' + formatUntil(e.data.until) + '.' : 'Too many wrong tries.');
    default: return e.message || 'Something went wrong';
  }
}
export function formatUntil(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true, day: 'numeric', month: 'short' });
}
// Map contract error.fields[].path -> message
export function fieldErrors(e) {
  const out = {};
  for (const f of e?.fields || []) if (f.path && !out[f.path]) out[f.path] = f.message;
  return out;
}
