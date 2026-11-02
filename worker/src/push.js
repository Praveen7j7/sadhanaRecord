// Notifications (Web Push), a default of the app on every phone that allows them, signed in or not (the head, 3 Oct 2026).
//   · a phone that allows notifications registers itself (push.register, no login needed); signing in attaches the person
//     (push.subscribe), logging out detaches them (push.detach), "off" on the phone removes it (push.unsubscribe)
//   · the 9 PM reminder, every day (the head, 3 Oct 2026): every signed-in devotee — "not filled yet" or "filled ✓"
//     (Sunday: "mark attendance and submit" or "submitted ✓") — and every phone with nobody signed in (general)
//   · a phone whose push address the browser renews (pushsubscriptionchange) moves its row to the new address
//     (push.renew; knowing the old address is the proof), so the person stays attached
//   · an announcement to everyone reaches every phone; one to batches reaches the signed-in members of those batches;
//     one to youth / TRD facilitators reaches those facilitators' phones (9 Oct 2026); one from a facilitator to their
//     students reaches those students' phones; a scheduled one waits for its start (Phase 9, items 8 and 23)
//   · attendance changed over the devotee's own mark (decision 41): the devotee's phones, once per change
//   · the deadline reminder (Phase 4): three hours before last week's deadline, devotees who have not submitted it
// The push itself is EMPTY (nothing to encrypt, almost no processing on the Free plan); the phone then asks
// push.message what to show. High urgency, so it is delivered on time even in battery saver.
// Free plan: at most 50 outside requests per scheduled run, so phones are reached PER_RUN at a time.
import { apiError, invalid, isoIst, ymd, mondayOf, csv } from './util.js';
import { q, one, all, run, setting } from './db.js';
import { stateOf, windowOf, addDays, COLS } from './weeks.js';
import { overLimit } from './auth.js';
import { FREE, LIMITS } from './limits.js';

/** The free-plan number; a run reads LIMITS.PUSH_PER_RUN, which a `LIMIT_PUSH_PER_RUN` var may raise (limits.js). */
export const PER_RUN = FREE.PUSH_PER_RUN;
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uText = (s) => b64u(new TextEncoder().encode(s));

/* ---- the phone ---- */
// exactly the browsers' push services (security review, 3 Oct 2026): Chrome / Edge / Samsung / Opera (FCM), Firefox,
// Safari (iPhone home-screen apps), and old Edge (WNS) — not any host under those companies' domains
const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//;
function device(d) {
  const ep = String(d.endpoint || ''), k = d.keys && typeof d.keys === 'object' ? d.keys : {};
  if (!PUSH_HOSTS.test(ep) || ep.length > 600) throw invalid({ path: 'endpoint', message: 'Not a push address from a known browser.' });
  if (!/^[A-Za-z0-9_-]{60,120}$/.test(String(k.p256dh || '')) || !/^[A-Za-z0-9_-]{12,40}$/.test(String(k.auth || ''))) throw invalid({ path: 'keys', message: 'Bad keys.' });
  return { ep, k };
}
/** A phone that allowed notifications, nobody signed in (or keep whoever is attached). */
export async function register(d, ctx) {
  const { ep, k } = device(d);
  if (ctx.ip && await overLimit(ctx, 'ip:push:' + ctx.ip, 60, 3600)) throw apiError('BUSY', 'Too many attempts from this network. Please try again later.');
  await run(ctx.db, `INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at) VALUES (?, '', ?, ?, ?)
                     ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, fails = 0`, ep, k.p256dh, k.auth, isoIst(ctx.now()));
  return { on: true, time: await setting(ctx.db, 'reminder_time', '21:00') };
}
/** The signed-in person on this phone (any role; the 9 PM reminder goes to devotees). */
export async function subscribe(d, ctx) {
  const { ep, k } = device(d);
  const n = await one(ctx.db, 'SELECT COUNT(*) AS n FROM push_subs WHERE login = ? AND endpoint <> ?', ctx.login, ep);
  if (n.n >= 5) throw apiError('CONFLICT', 'Notifications are on for 5 devices already. Turn them off on one first.');
  await run(ctx.db, `INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(endpoint) DO UPDATE SET login = excluded.login, p256dh = excluded.p256dh, auth = excluded.auth, fails = 0`,
    ep, ctx.login, k.p256dh, k.auth, isoIst(ctx.now()));
  return { on: true, time: await setting(ctx.db, 'reminder_time', '21:00') };
}
/** Logging out: the phone keeps its notifications, without that person. */
export async function detach(d, ctx) {
  await run(ctx.db, "UPDATE push_subs SET login = '' WHERE endpoint = ? AND login = ?", String(d.endpoint || ''), ctx.login);
  return { on: true };
}
/** Notifications off on this phone (having the push address is the proof). */
export async function unsubscribe(d, ctx) {
  await run(ctx.db, 'DELETE FROM push_subs WHERE endpoint = ?', String(d.endpoint || ''));
  return { on: false };
}
const GENERAL = { title: "Hare Krishna! Today's sadhana", body: 'Fill your daily sadhana in a minute. Tap to open the app.', url: '/#/home', tag: 'sadhana-reminder' };
/** What the phone shows for the push it just got. */
export async function message(d, ctx) {
  const r = await one(ctx.db, 'SELECT login, pending FROM push_subs WHERE endpoint = ?', String(d.endpoint || ''));
  // an announcement stores its words (with when): shown if it was sent in the last half hour
  // Phase 9 (9 Oct 2026): the words are given ONCE — cleared as they are served, so a later push to this phone (a
  // reminder, a notice) within the half hour shows its own words, never the announcement again
  try {
    const p = r?.pending ? JSON.parse(r.pending) : null;
    if (p && p.at && ctx.now().getTime() - p.at < 30 * 60e3) {
      await run(ctx.db, "UPDATE push_subs SET pending = '' WHERE endpoint = ?", String(d.endpoint || ''));
      const { at, ...m } = p; return m;
    }
  } catch { /* old row */ }
  // the 9 PM reminder stores nothing per phone (phase 6: ~5,000 writes a night saved): its words come from the day
  if (!r?.login) return GENERAL;
  // the three hours before last week's deadline: the deadline reminder's words (or "submitted ✓" if it was just sent)
  const dl = await deadlineWindow(ctx.db, ctx.now());
  if (dl) {
    const done = await one(ctx.db, 'SELECT 1 AS x FROM submissions WHERE login = ? AND week_id = ?', r.login, dl.weekId);
    return done ? DEADLINE_DONE : deadlineMsg(dl);
  }
  const now = ctx.now(), today = ymd(now), dow = (new Date(`${today}T12:00:00+05:30`).getUTCDay() + 6) % 7, weekId = mondayOf(now);
  const row = await one(ctx.db, `SELECT d.${COLS[dow]} AS draft_day, EXISTS (SELECT 1 FROM submissions x WHERE x.login = ? AND x.week_id = ?) AS submitted
                                 FROM (SELECT 1) LEFT JOIN drafts d ON d.login = ? AND d.week_id = ?`, r.login, weekId, r.login, weekId);
  return reminderFor(dow, due(row || {}, dow), (await windowOf(ctx.db, weekId)).words.closesText);
}

/** A phone's push address was renewed by the browser: the row (and the person on it) moves to the new address. */
export async function renew(d, ctx) {
  const { ep, k } = device(d), old = String(d.oldEndpoint || '');
  if (ctx.ip && await overLimit(ctx, 'ip:push:' + ctx.ip, 60, 3600)) throw apiError('BUSY', 'Too many attempts from this network. Please try again later.');
  // the person always comes from the old row, never from the request; the reply is the same either way (no probing)
  if (old && old !== ep && await one(ctx.db, 'SELECT 1 AS x FROM push_subs WHERE endpoint = ?', old)) {
    await ctx.db.batch([
      // the app may have registered the new address first (with nobody): it takes the old row's person
      q(ctx.db, `INSERT INTO push_subs (endpoint, login, p256dh, auth, created_at) SELECT ?, login, ?, ?, ? FROM push_subs WHERE endpoint = ?
                 ON CONFLICT(endpoint) DO UPDATE SET login = CASE WHEN push_subs.login = '' THEN excluded.login ELSE push_subs.login END,
                   p256dh = excluded.p256dh, auth = excluded.auth, fails = 0`, ep, k.p256dh, k.auth, isoIst(ctx.now()), old),
      q(ctx.db, 'DELETE FROM push_subs WHERE endpoint = ?', old)]);
    return { on: true, time: await setting(ctx.db, 'reminder_time', '21:00') };
  }
  return register({ endpoint: ep, keys: k }, { ...ctx, ip: '' });
}

/* ---- VAPID (RFC 8292): one signed token per push service, reused for 12 hours ---- */
const jwtCache = new Map();
async function vapidAuth(env, endpoint, now) {
  const aud = new URL(endpoint).origin, hit = jwtCache.get(aud);
  if (hit && hit.exp - 3600 > now / 1000) return hit.header;
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const key = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const exp = Math.floor(now / 1000) + 12 * 3600;
  const unsigned = b64uText(JSON.stringify({ typ: 'JWT', alg: 'ES256' })) + '.' + b64uText(JSON.stringify({ aud, exp, sub: env.VAPID_SUBJECT }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  const header = `vapid t=${unsigned}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
  jwtCache.set(aud, { exp, header });
  return header;
}

/**
 * Sends the empty pushes and records only what changed (phase 6: a database write is the scarcest thing on the free
 * plan). store: keep the words for push.message (announcements; the reminder's words are worked out when asked).
 * A phone that answered is not written to unless it had failures to clear; a phone failing 7 times in a row, or one the
 * push service no longer knows, is removed by its own key.
 */
async function deliver(env, db, list, now, ttl, store = false) {
  if (!list.length) return { sent: 0, gone: 0, failed: 0, retry: 0 };
  if (store) await db.batch(list.map(x => q(db, 'UPDATE push_subs SET pending = ? WHERE endpoint = ?', JSON.stringify({ ...x.msg, at: now.getTime() }), x.endpoint)));
  let sent = 0, gone = 0, failed = 0, retry = 0;   // retry: failed this time, the phone kept for the next push
  const stmts = [];
  for (const x of list) {
    let status = 0;
    try {
      const res = await fetch(x.endpoint, { method: 'POST', headers: { Authorization: await vapidAuth(env, x.endpoint, now.getTime()), TTL: String(ttl), Urgency: 'high', 'Content-Length': '0' } });
      status = res.status;
    } catch { status = 0; }
    if (status === 404 || status === 410) { gone++; stmts.push(q(db, 'DELETE FROM push_subs WHERE endpoint = ?', x.endpoint)); }
    else if (status >= 200 && status < 300) { sent++; if (x.fails) stmts.push(q(db, 'UPDATE push_subs SET last_sent = ?, last_status = ?, fails = 0 WHERE endpoint = ?', isoIst(now), status, x.endpoint)); }
    else if ((x.fails || 0) + 1 >= 7) { failed++; gone++; stmts.push(q(db, 'DELETE FROM push_subs WHERE endpoint = ?', x.endpoint)); }
    else { failed++; retry++; stmts.push(q(db, 'UPDATE push_subs SET last_status = ?, fails = fails + 1 WHERE endpoint = ?', status, x.endpoint)); }
  }
  if (stmts.length) await db.batch(stmts);   // every phone fine and none had failed before: nothing to write (D1 refuses an empty batch)
  return { sent, gone, failed, retry };
}

/* ---- the 9 PM reminder ---- */
/** Whether today still needs doing: today's day is not complete (Sunday: the week is not submitted). Picks the words. */
export function due(row, dow) {
  if (row.submitted) return false;
  if (dow === 6) return true;
  return stateOf(row.draft_day ? JSON.parse(row.draft_day) : null) !== 'complete';
}
/* `closesText` is the deadline the head has actually set, not the words "Monday 9 PM" (shared/window.js).
   It used to be literal here, so moving the window changed the lock and not the reminder. */
const reminderFor = (dow, pending = true, closesText = 'Monday 9 PM') => (dow === 6
  ? pending
    ? { title: 'Attendance and your week', body: `Mark today's class attendance and submit your week. It closes ${closesText}.`, url: '/#/week', tag: 'sadhana-reminder' }
    : { title: 'Your week is submitted ✓', body: 'Hare Krishna! Tap to see your report for the week.', url: '/#/report', tag: 'sadhana-reminder' }
  : pending
    ? { title: "Hare Krishna! Today's sadhana", body: "Today isn't filled yet. It takes a minute — tap to fill it.", url: '/#/home', tag: 'sadhana-reminder' }
    : { title: "Hare Krishna! Today's sadhana", body: 'Today is filled ✓. Tap to review it before you rest.', url: '/#/home', tag: 'sadhana-reminder' });

/**
 * From the reminder time until 23:30 IST: the next PER_RUN phones of today's run. Every evening run (the minutely one and
 * the extra evening schedules, index.js) claims its own chunk from one shared position in a single atomic UPDATE, so
 * any number of runs side by side reach every phone exactly once. Returns a short report or ''.
 */
export async function runReminders(env, db, now = new Date()) {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC) return '';
  const today = ymd(now), hm = isoIst(now).slice(11, 16), at = await setting(db, 'reminder_time', '21:00');
  // the deadline reminder first (its own progress row); once all its phones are claimed, the evening one as usual
  const dl = await deadlineWindow(db, now);
  if (dl) { const d = await runDeadlineReminder(env, db, now, dl); if (d) return d; }
  if (hm < at || hm > '23:30') return '';
  const claim = await claimChunk(db, 0, today);
  if (!claim) return '';                                              // today's phones are all claimed
  const range = `phones ${claim.prev + 1}–${claim.cursor < 0 ? 'end' : claim.cursor}`;
  try {
    const weekId = mondayOf(now), dow = (new Date(`${today}T12:00:00+05:30`).getUTCDay() + 6) % 7, col = COLS[dow];
    const subs = await all(db, `
      SELECT s.rowid AS id, s.endpoint, s.login, s.fails, a.status, m.id AS mid, d.${col} AS draft_day,
             EXISTS (SELECT 1 FROM submissions x WHERE x.login = s.login AND x.week_id = ?) AS submitted
      FROM push_subs s LEFT JOIN accounts a ON a.login = s.login
      LEFT JOIN memberships m ON m.login = s.login AND m.to_week = '' AND m.state = 'ACTIVE'
      LEFT JOIN drafts d ON d.login = s.login AND d.week_id = ?
      WHERE s.rowid > ? AND (? < 0 OR s.rowid <= ?) ORDER BY s.rowid`, weekId, weekId, claim.prev, claim.cursor, claim.cursor);
    const closesText = (await windowOf(db, weekId)).words.closesText;   // once per run, not per phone
    const list = [];
    for (const s of subs) {
      if (!s.login) list.push({ endpoint: s.endpoint, fails: s.fails, msg: GENERAL });                    // nobody signed in on this phone
      // every active devotee, every day: "not filled yet" or "filled ✓" (the head, 3 Oct 2026)
      else if (s.status === 'ACTIVE' && s.mid) list.push({ endpoint: s.endpoint, fails: s.fails, msg: reminderFor(dow, due(s, dow), closesText) });
    }
    const r = await deliver(env, db, list, now, 10800);
    return `${today} ${range}: ${r.sent} sent, ${r.gone} gone, ${r.failed} failed${claim.cursor < 0 ? ' (done)' : ' (continues)'}`;
  } catch (e) {
    // the chunk is claimed, so it is not retried tonight: say so in the logs (a short night shows here)
    console.error(`reminders: ${today} ${range} NOT SENT (claimed, skipped tonight): ${e.message}`);
    throw e;
  }
}

/**
 * Claims the next PER_RUN phones of today's run from one progress row (shard): [prev, cursor] — on a new day start from 0;
 * cursor -1 = this chunk runs to the end (nothing left after it). null when today's phones are all claimed.
 */
const claimChunk = (db, shard, today) => one(db, `UPDATE reminder_progress
      SET prev = CASE WHEN day = ?1 THEN cursor ELSE 0 END,
          cursor = COALESCE((SELECT s.rowid FROM push_subs s WHERE s.rowid > (CASE WHEN reminder_progress.day = ?1 THEN reminder_progress.cursor ELSE 0 END)
                             ORDER BY s.rowid LIMIT 1 OFFSET ?2), -1),
          day = ?1
    WHERE shard = ?3 AND NOT (day = ?1 AND cursor < 0)
    RETURNING prev, cursor`, today, LIMITS.PUSH_PER_RUN - 1, shard);

/* ---- the deadline reminder (Phase 4, 9 Oct 2026) ---- */
// The three hours before last week's deadline (Monday 6 PM with the usual 9 PM close; it follows the submit_closes
// setting): one push to each signed-in active devotee whose last week is not submitted yet. Complete days count, the
// deadline submits the rest. Progress in reminder_progress shard 1 (migration 0031).
const DEADLINE_AHEAD = 3 * 3600e3;
/** { weekId, closes } while last week's deadline is less than three hours away, else null. */
export async function deadlineWindow(db, now) {
  const weekId = addDays(mondayOf(now), -7), closes = (await windowOf(db, weekId)).closes, t = now.getTime();
  return t >= closes.getTime() - DEADLINE_AHEAD && t < closes.getTime() ? { weekId, closes } : null;
}
const clock12 = (d) => { const [h, m] = isoIst(d).slice(11, 16).split(':').map(Number); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; };
const deadlineMsg = ({ weekId, closes }) => ({ title: 'Your week closes tonight', url: `/#/week/${weekId}?f=submit`, tag: 'sadhana-deadline',
  body: `Submit last week by ${clock12(closes)}. Every complete day counts — tap to check it and submit.` });
const DEADLINE_DONE = { title: 'Last week is submitted ✓', body: 'Hare Krishna! Tap to see your report.', url: '/#/report', tag: 'sadhana-deadline' };

async function runDeadlineReminder(env, db, now, dl) {
  const today = ymd(now), claim = await claimChunk(db, 1, today);
  if (!claim) return '';
  const range = `phones ${claim.prev + 1}–${claim.cursor < 0 ? 'end' : claim.cursor}`;
  try {
    // signed in, active, a member since that week or before, the week not submitted (staff-only phones are left out)
    const subs = await all(db, `
      SELECT s.endpoint, s.fails FROM push_subs s JOIN accounts a ON a.login = s.login AND a.status = 'ACTIVE'
      JOIN memberships m ON m.login = s.login AND m.to_week = '' AND m.state = 'ACTIVE' AND m.from_week <= ?
      WHERE s.rowid > ? AND (? < 0 OR s.rowid <= ?) AND s.login <> ''
        AND NOT EXISTS (SELECT 1 FROM submissions x WHERE x.login = s.login AND x.week_id = ?) ORDER BY s.rowid`,
      dl.weekId, claim.prev, claim.cursor, claim.cursor, dl.weekId);
    const msg = deadlineMsg(dl), ttl = Math.max(60, Math.floor((dl.closes.getTime() - now.getTime()) / 1000));
    const r = await deliver(env, db, subs.map(s => ({ endpoint: s.endpoint, fails: s.fails, msg })), now, ttl);
    return `deadline ${dl.weekId} ${range}: ${r.sent} sent, ${r.gone} gone, ${r.failed} failed${claim.cursor < 0 ? ' (done)' : ' (continues)'}`;
  } catch (e) {
    console.error(`deadline reminder: ${today} ${range} NOT SENT (claimed, skipped): ${e.message}`);
    throw e;
  }
}

/* ---- announcements ---- */
/** Queues a new announcement for notifications (statement for the announcement's own batch). */
export const queueAnnouncement = (db, audience, title, at) =>
  q(db, 'INSERT INTO push_jobs (ann_id, audience, title, created_at) VALUES (last_insert_rowid(), ?, ?, ?)', audience, title, at);

/** The next PER_RUN phones of the oldest announcement still being sent. Returns a short report or ''. */
export async function runAnnouncementPushes(env, db, now = new Date()) {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC) return '';
  // the oldest job whose post has started (a scheduled post's notifications wait for its start, Phase 9 item 23)
  const at = isoIst(now);
  const job = await one(db, `SELECT j.* FROM push_jobs j LEFT JOIN announcements a ON a.id = j.ann_id
                             WHERE j.state = 'OPEN' AND (a.id IS NULL OR a.publish_at = '' OR a.publish_at <= ?) ORDER BY j.id LIMIT 1`, at);
  if (!job) return '';
  // a removed or ended post never notifies
  const ann = await one(db, "SELECT id FROM announcements WHERE id = ? AND removed_at = '' AND (expires_at = '' OR expires_at > ?)", job.ann_id, at);
  // batches: their signed-in active members; FAC_YOUTH / FAC_TRD: active facilitators who are devotees / have no batch;
  // STU:<facilitator id>: the active members whose facilitator that is (any batch), as "My students" (Phase 9, item 8;
  // by id since Phase 24, so a rename never loses the facilitator's students)
  const parts = job.audience === 'ALL' ? null : csv(job.audience);
  const batches = parts ? parts.filter(p => !p.startsWith('FAC_') && !p.startsWith('STU:')) : [], youth = parts?.includes('FAC_YOUTH'), trd = parts?.includes('FAC_TRD');
  const stu = parts ? parts.filter(p => p.startsWith('STU:')).map(p => p.slice(4)) : [];
  const fac = (role) => `EXISTS (SELECT 1 FROM accounts a WHERE a.login = s.login AND a.status = 'ACTIVE' AND a.facilitator_name <> '' AND a.role ${role} 'DEVOTEE')`;
  const who = parts ? [...(batches.length ? [`EXISTS (SELECT 1 FROM memberships m WHERE m.login = s.login AND m.to_week = '' AND m.state = 'ACTIVE' AND m.batch_id IN (${batches.map(() => '?').join(',')}))`] : []),
    ...(stu.length ? [`EXISTS (SELECT 1 FROM memberships m WHERE m.login = s.login AND m.to_week = '' AND m.state = 'ACTIVE' AND m.fac_id IN (${stu.map(() => '?').join(',')}))`] : []),
    ...(youth ? [fac('=')] : []), ...(trd ? [fac('<>')] : [])] : [];
  const subs = !ann || (parts && !who.length) ? [] : parts
    ? await all(db, `SELECT s.rowid AS id, s.endpoint, s.fails FROM push_subs s WHERE s.rowid > ? AND s.login <> '' AND (${who.join(' OR ')}) ORDER BY s.rowid LIMIT ?`, job.cursor, ...batches, ...stu, LIMITS.PUSH_PER_RUN)
    : await all(db, 'SELECT rowid AS id, endpoint, fails FROM push_subs WHERE rowid > ? ORDER BY rowid LIMIT ?', job.cursor, LIMITS.PUSH_PER_RUN);
  const msg = { title: 'New from IYF Delhi', body: job.title, url: '/#/wall', tag: 'ann-' + job.ann_id };
  const r = await deliver(env, db, subs.map(s => ({ endpoint: s.endpoint, fails: s.fails, msg })), now, 86400, true);
  const done = subs.length < LIMITS.PUSH_PER_RUN;
  // the reach (Phase 9, item 18): counts only
  await run(db, 'UPDATE push_jobs SET cursor = ?, sent = sent + ?, tried = tried + ?, gone = gone + ?, failed = failed + ?, state = ?, done_at = ? WHERE id = ?',
    done ? job.cursor : subs[subs.length - 1].id, r.sent, subs.length, r.gone, r.retry, done ? 'DONE' : 'OPEN', done ? at : '', job.id);
  return `announcement ${job.ann_id}: ${r.sent} sent${done ? ' (done)' : ' (continues)'}`;
}

/* ---- attendance changed over the devotee's own mark (decision 41) ---- */
const WHO = { master: 'the IYF head', coordinator: 'your coordinator', leader: 'your group leader' };
const MARK_WORD = { P: 'Present', A: 'Absent' };
const weekLabel = (weekId) => new Date(`${weekId}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
/** The words of the notice for one attendance row (the higher mark that differs from the devotee's own), or null. */
export function noticeText(row) {
  const level = row.master_mark ? 'master' : row.coordinator_mark ? 'coordinator' : row.leader_mark ? 'leader' : '';
  if (!level || !row.devotee_mark || row.mark_used === row.devotee_mark) return null;
  return { title: 'Attendance updated', url: '/#/week/' + row.week_id, tag: 'att-' + row.week_id,
           body: `Your Sunday class attendance for the week of ${weekLabel(row.week_id)} was marked ${MARK_WORD[row.mark_used] || row.mark_used} by ${WHO[level]}. You had marked ${MARK_WORD[row.devotee_mark] || row.devotee_mark}.` };
}

/**
 * Notices waiting (attendance.notice_at set, notice_sent 0, the partial index attendance_notices): each devotee's phones
 * get one push; the note also shows in the app (week.get › attendance.notice) whether or not a phone is signed up.
 * A notice is sent 5 minutes after the change, so a mark corrected at once sends nothing; the row is read again then.
 * Returns a short report or ''.
 */
export async function runAttendanceNotices(env, db, now = new Date()) {
  const before = isoIst(new Date(now.getTime() - 5 * 60e3));
  const rows = await all(db, `SELECT login, week_id, notice_at, devotee_mark, leader_mark, coordinator_mark, master_mark, mark_used FROM attendance
                              WHERE notice_at <> '' AND notice_sent = 0 AND notice_at <= ? ORDER BY notice_at LIMIT ?`, before, LIMITS.PUSH_PER_RUN);
  if (!rows.length) return '';
  const texts = new Map(rows.map(r => [r.login + '|' + r.week_id, noticeText(r)]));
  const send = rows.filter(r => texts.get(r.login + '|' + r.week_id)), logins = [...new Set(send.map(r => r.login))];
  const all_subs = !logins.length || !env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC ? []
    : await all(db, `SELECT endpoint, login, fails FROM push_subs WHERE login IN (${logins.map(() => '?').join(',')})`, ...logins);
  // One person can have several phones, so PER_RUN endpoints cover fewer than PER_RUN people. Cut at a PERSON
  // boundary and mark only those people done (13 Oct 2026, audit J5): the old code sliced the endpoint list to 35
  // and then marked ALL rows sent, so with more than 35 phones in one run the people past the cut were recorded as
  // notified and never were. The rest keep notice_sent = 0 and go out on the next run a minute later.
  const subsByLogin = new Map();
  for (const s of all_subs) { if (!subsByLogin.has(s.login)) subsByLogin.set(s.login, []); subsByLogin.get(s.login).push(s); }
  const list = [], notified = new Set();
  for (const login of logins) {
    const mine = subsByLogin.get(login) || [];
    if (!mine.length) { notified.add(login); continue; }          // no phone signed up: the in-app note is enough
    if (list.length + mine.length > LIMITS.PUSH_PER_RUN) break;               // whole person or nobody
    // the latest notice of the person (several weeks changed at once: one push, about the latest week)
    const r = send.filter(x => x.login === login).sort((a, b) => (a.week_id < b.week_id ? 1 : -1))[0];
    for (const sub of mine) list.push({ endpoint: sub.endpoint, fails: sub.fails, msg: texts.get(r.login + '|' + r.week_id) });
    notified.add(login);
  }
  const res = await deliver(env, db, list, now, 86400, true);
  // marked done only for the people whose phones were all in this run's list, and only if no newer change came in meanwhile
  const done = rows.filter(r => notified.has(r.login));
  if (done.length) await db.batch(done.map(r => q(db, 'UPDATE attendance SET notice_sent = 1 WHERE login = ? AND week_id = ? AND notice_at = ? AND notice_sent = 0', r.login, r.week_id, r.notice_at)));
  const left = rows.length - done.length;
  return `attendance notices: ${done.length}${left ? ` (${left} left for the next run)` : ''} (${res.sent} pushes)`;
}
