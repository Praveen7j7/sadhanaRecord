// Sadhana Record API — Cloudflare Worker entry (design §2d).
import { apiCall, API_VERSION } from './api.js';
import { refreshOneView } from './views.js';
import { runReminders, runAnnouncementPushes, runAttendanceNotices } from './push.js';
import { mirrorChanged, mirrorBacklog, trimMirrorLog, syncCopySwitch } from './mirror.js';
import { eraseSheets } from './erase.js';
import { runRetention, trimSheetLogs } from './retention.js';
import { applyMasterReset } from './setup.js';
import { runDeadline } from './weeks.js';
import { isoIst } from './util.js';
import { meterDb, skewOf } from './loadmeter.js';
import { useLimits } from './limits.js';
import { cronFailed } from './cronfail.js';
import { expireRoles } from './grants.js';
import { dailyInactive } from './inactive.js';

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return ok ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, GET, OPTIONS',
                'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'origin' } : { vary: 'origin' };
}
const json = (body, headers) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });

/**
 * The 9 PM reminder: besides the minutely run, two evening schedules (wrangler.toml, different hour sets so Cloudflare
 * cannot merge them) only send reminders. Each run claims its own chunk of phones (push.js), so it does not matter which
 * schedule fired or how many did.
 */
const REMINDER_ONLY = (cron) => cron !== '* * * * *';

export default {
  async fetch(request, env, ctx) {
    useLimits(env);                                     // per-run caps: free-plan numbers unless a LIMIT_* var says otherwise
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method === 'GET') return json({ ok: true, data: { service: 'sadhana-record', v: API_VERSION } }, cors);
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    const body = await request.text(), ip = request.headers.get('cf-connecting-ip') || '';
    if (env.LOAD_METER === '1') {                       // the load-test Worker only (src/loadmeter.js)
      const { m, db } = meterDb(env.DB), skew = skewOf(env), pend = [];
      const res = await apiCall(body, { ...env, DB: db }, p => { pend.push(p); ctx.waitUntil(p); }, () => new Date(Date.now() + skew), { ip: request.headers.get('x-load-ip') || ip });
      let action = ''; try { action = JSON.parse(body).action; } catch { /* bad body */ }
      ctx.waitUntil(Promise.allSettled(pend).then(() => console.log(JSON.stringify({ load: 1, action, ok: res.ok, code: res.ok ? '' : res.error?.code, ...m }))));
      return json(res, { ...cors, 'x-meter': JSON.stringify(m) });
    }
    const res = await apiCall(body, env, p => ctx.waitUntil(p), () => new Date(), { ip });
    return json(res, cors);
  },

  /** Every minute: the deadline, reminders, notifications, the (paused) copy to Sheets; tidy up hourly. */
  async scheduled(event, env, ctx) {
    useLimits(env);
    if (env.LOAD_METER === '1') return scheduledLoad(event, env);   // the load-test Worker: only the deadline job
    if (REMINDER_ONLY(event.cron)) {
      try { const r = await runReminders(env, env.DB, new Date(event.scheduledTime)); if (r) console.log('reminders', r); }
      catch (e) { await cronFailed(env.DB, 'reminders', e, new Date(event.scheduledTime)); }
      return;
    }
    const minute = new Date(event.scheduledTime).getUTCMinutes(), db = env.DB, now = Date.now();
    if (env.MASTER_RESET_PASSWORD) {
      try { console.log('master reset', await applyMasterReset(env, db)); } catch (e) { await cronFailed(db, 'reset', e, new Date(event.scheduledTime)); }
    }
    /* The dashboard is no longer read (the head, 27 Oct 2026): minutes 0 and 30 used to copy its Devotees tab and NameMap
     * instead of doing this run's work. Every minute now runs the deadline, the reminders and the rest. The registry
     * table stays as a frozen snapshot (src/registry.js). */
    {
      // the Monday 9 PM deadline first (it is a no-op unless a week is due); then the copy to Sheets
      let deadline = 'up to date';
      try { deadline = await runDeadline(env, db); if (deadline !== 'up to date') console.log('deadline', deadline); } catch (e) { await cronFailed(db, 'deadline', e, new Date(event.scheduledTime)); }
      // once a day, 00:07 IST: a role given in Access with an end date that has passed is taken away (ADR 0019)
      if (new Date(event.scheduledTime).getUTCHours() === 18 && minute === 37) {
        try { const r = await expireRoles(db, new Date(event.scheduledTime)); if (r) console.log('roles ended', r); } catch (e) { await cronFailed(db, 'roles', e, new Date(event.scheduledTime)); }
      }
      // once a day, 00:13 IST: devotees silent for 30 days (no day filled AND no use of the app) become inactive (ADR 0020)
      if (new Date(event.scheduledTime).getUTCHours() === 18 && minute === 43) {
        try { const r = await dailyInactive(db, new Date(event.scheduledTime)); if (r) console.log('inactive', r); } catch (e) { await cronFailed(db, 'inactive', e, new Date(event.scheduledTime)); }
      }
      // the 9 PM reminder (its own share of the run's 50 outside requests), then the copy to Sheets
      let rm = '';
      try { rm = await runReminders(env, db, new Date(event.scheduledTime)); if (rm) console.log('reminders', rm); } catch (e) { await cronFailed(db, 'reminders', e, new Date(event.scheduledTime)); }
      // announcement notifications only in a run the reminder did not use (the 50 outside requests a run are shared)
      let an = '';
      if (!rm) { try { an = await runAnnouncementPushes(env, db, new Date(event.scheduledTime)); if (an) console.log('announcements', an); } catch (e) { await cronFailed(db, 'announcements', e, new Date(event.scheduledTime)); } }
      // attendance notices (decision 41) in a run neither of those used
      if (!rm && !an) { try { const n = await runAttendanceNotices(env, db, new Date(event.scheduledTime)); if (n) console.log('notices', n); } catch (e) { await cronFailed(db, 'notices', e, new Date(event.scheduledTime)); } }
      // ───────────────────────────────────────────────────────────────────────────────────────────────────────
      // THE COPY TO GOOGLE SHEETS IS PAUSED (13 October 2026, your decision — phase 4).
      //
      // The app is now the only place internal data is read from: coordinators use the Batch board, Members and
      // Stats screens (all live), anything wanted as a file comes from the export screen, and anything unusual is
      // a query against D1. So the four jobs that WRITE to Google are switched off here. (The inbound read of the
      // dashboard is gone too, since 27 Oct 2026: the app issues IYF IDs and keeps the facilitator list itself.)
      //
      // PAUSED, NOT DELETED. Every module is untouched and still tested (mirror.test.mjs, views.test.mjs,
      // erase.test paths, retention.test.mjs all pass), so turning it back on is this one flag:
      //
      //     wrangler.toml → [vars] SHEETS_COPY = "on"      (or remove the var; "off" is the default below)
      //
      // While it is off:
      //   · nothing is queued (migration 0075, 27 Oct 2026): the mirror triggers read mirror_switch, which this run
      //     keeps equal to SHEETS_COPY, so a change writes no mirror_log row while the copy is off;
      //   · nothing is lost either: switching it back on re-copies every tab WHOLE (mirror.js syncCopySwitch), in the
      //     same batch that switches the triggers on, so a change made while it was off cannot be skipped;
      //   · the four view sheets and the store sheets simply stop changing. They are a frozen snapshot of the
      //     moment the copy stopped. Anyone reading them must be told that (docs/INTEGRATIONS.md);
      //   · mirror_status says so, so the head's Settings screen does not look like a three-day stall.
      //
      // One thing to watch when it is turned back on: the whole copies take a few runs (300 rows a minute), during
      // which the sheets are partly old and partly new. Check settings.mirror_status; the view sheets rebuild too.
      const sheetsCopy = String(env.SHEETS_COPY || 'off').toLowerCase() === 'on';
      // the triggers follow the flag (one keyed read a run; a write only when it changes). A failure is retried next
      // minute and loses nothing: the switch and the whole re-copy go together, so an "on" that failed simply starts later
      try { const sw = await syncCopySwitch(db, sheetsCopy, new Date(event.scheduledTime)); if (sw) console.log('sheets copy', sw); }
      catch (e) { console.error('copy switch', e.message); }
      if (!sheetsCopy) {
        /* ONCE AN HOUR, NOT ONCE A MINUTE (14 Oct 2026 — this took the live app down twice in one day).
         *
         * What went wrong: I added this status line on 13 Oct with the Sheets pause, and it calls
         * mirrorBacklog(), which COUNTs mirror_log. The table triggers keep queueing every change while the
         * copy is paused, so that table had grown to 8,600 rows — and counting it every minute reads about
         * 24.8 MILLION rows a day against a 5 million free-plan limit. Measured on the live database:
         * 5,127,487 rows read in 24 hours against 180 writes, i.e. essentially nobody using the app and the
         * schedule spending the entire allowance on a status nobody was reading minute by minute. Every
         * action then fails, which is how a coordinator's export came back "Please try again".
         *
         * The audit's "no new scan of a growing table" check passed this because the test database holds a
         * handful of rows, not 8,600. Cost, not shape, is what mattered here.
         *
         * While the copy is paused the number only drifts upward and nobody acts on it between hours, so
         * minute 0 is enough: ~413k rows a day instead of 24.8M. */
        // minute 1 (minutes 0 and 30 took the dashboard read until 27 Oct 2026; kept at 1). Once an hour.
        if (minute === 1) {
          console.log('sheets copy paused (SHEETS_COPY is off); the app is the system of record');
          try {
            /* No queue count any more (C1, 27 Oct 2026): since 0075 nothing is queued while paused, and switching
               on re-copies every tab whole instead of draining a queue, so the number told an operator nothing.
               (It was capped at 5,000 on 14 Oct; now it reads no rows at all.) */
            await db.prepare(`INSERT INTO settings (key, value, note, changed_by, changed_at) VALUES ('mirror_status', ?, 'Copy to Google Sheets', 'schedule', ?)
                              ON CONFLICT(key) DO UPDATE SET value = excluded.value, changed_at = excluded.changed_at`)
              .bind('paused · the app is the system of record · switching on re-copies every tab whole', isoIst(new Date())).run();
          } catch (e) { console.error('mirror status', e.message); }
        }
        /* Clean up finished log entries EVEN WHILE PAUSED (15 Oct 2026).
         *
         * The trimmer used to sit inside mirrorChanged(), the function that sends to Google, so pausing the
         * copy also paused the deletion of rows the copy had ALREADY dealt with. The log then only grew —
         * 8,616 finished entries a day later — and scanning them is what spent D1's whole daily read
         * allowance and took the app down twice. Removing rows we are done with is housekeeping on our own
         * table; it has nothing to do with Google, so it does not belong behind that switch.
         *
         * Quiet nights only, a few hundred a run, and never the entry at the copy's position. */
        try {
          const trimmed = await trimMirrorLog(db, null, new Date(event.scheduledTime));
          if (trimmed) console.log(`log trimmed ${trimmed} (copy paused)`);
        } catch (e) { await cronFailed(db, 'trim', e, new Date(event.scheduledTime)); }
      } else if (deadline === 'up to date' || deadline.endsWith('closed')) {
        let copied = ['failed'], mirrorErr = '';
        try { copied = await mirrorChanged(env, db); console.log('mirror', copied.join(', ')); } catch (e) { mirrorErr = e.message; console.error('mirror', e.message); }
        // A durable status for the copy (13 Oct 2026, audit J9 / roadmap 3.7). Until now the only sign of a
        // stalled copy was a console line in Cloudflare's logs, which is how the 7-10 Oct stall went unnoticed for
        // three days. This writes the same kind of row the registry refresh already writes, so the head's Settings
        // screen shows it: when it last succeeded, what it did, how far behind it is, and the last error if any.
        // The key is excluded from the Sheets copy (migration 0042), so it costs no sheet write.
        try {
          // bounded: the exact number past 500 is not worth a full scan (see the note on the paused branch above)
          const behind = await mirrorBacklog(db, 500);
          const what = mirrorErr ? `failed · ${String(mirrorErr).slice(0, 120)}`
            : copied.length ? `ok · ${copied.join(', ')}` : 'ok · nothing to copy';
          await db.prepare(`INSERT INTO settings (key, value, note, changed_by, changed_at) VALUES ('mirror_status', ?, 'Last copy to Google Sheets (every minute)', 'schedule', ?)
                            ON CONFLICT(key) DO UPDATE SET value = excluded.value, changed_at = excluded.changed_at`)
            .bind(`${what}${behind ? ` · ${behind} waiting` : ''}`, isoIst(new Date())).run();
        } catch (e) { console.error('mirror status', e.message); }
        // the batch view sheets only in a run with nothing left to copy (one view a run, only when it changed)
        // a deleted devotee's rows in the append-only tabs (erase.js), then the batch view sheets
        let erased = '';
        if (!copied.length) { try { erased = await eraseSheets(env, db); if (erased) console.log('erase', erased); } catch (e) { console.error('erase', e.message); } }
        if (!copied.length && !erased) {
          try { const v = await refreshOneView(env, db, new Date(event.scheduledTime)); if (v) console.log('view', v); } catch (e) { console.error('view', e.message); }
        }
      }
    }
    // logs older than the kept period (Phase 9, item 11): a few runs between 01:00 and 02:00 IST, the Sheets copy once
    const istHour = new Date(event.scheduledTime + 5.5 * 3600e3).getUTCHours();
    if (istHour === 1 && [12, 22, 42, 52].includes(minute)) {
      // paused, the period alone decides (G1, 27 Oct 2026); on, a row not copied yet is kept (retention.js)
      try { const r = await runRetention(db, new Date(event.scheduledTime), String(env.SHEETS_COPY || 'off').toLowerCase() === 'on'); if (r) console.log('retention', r); } catch (e) { await cronFailed(db, 'retention', e, new Date(event.scheduledTime)); }
      // trimming the AuditLog and RunLog TABS is a Sheets write, so it waits for the copy to be switched back on
      // (13 Oct 2026). D1's own retention above runs regardless — that is what keeps the database tidy.
      if (minute === 52 && String(env.SHEETS_COPY || 'off').toLowerCase() === 'on') {
        try { const r = await trimSheetLogs(env, db, new Date(event.scheduledTime)); if (r) console.log('retention', r); } catch (e) { console.error('retention sheets', e.message); }
      }
    }
    if (minute === 7) ctx.waitUntil(db.batch([
      db.prepare('DELETE FROM replies WHERE at < ?').bind(now - 6 * 3600000),
      db.prepare('DELETE FROM counters WHERE expires < ?').bind(now),
      // sessions that ended or expired more than 60 days ago
      db.prepare("DELETE FROM sessions WHERE (ended_at <> '' OR expires_at < ?) AND last_used_at < ?").bind(isoIst(new Date(now)), isoIst(new Date(now - 60 * 86400000)))
    // caught (12 Oct 2026): a rejected waitUntil marks the run an exception (the 04:37 IST run); the tidy-up is retried next hour anyway
    ]).catch((e) => cronFailed(db, 'tidy', e, new Date(event.scheduledTime))));
  }
};

/** Load-test Worker only: the Monday deadline job on the shifted clock, metered (no Google, no phones). */
async function scheduledLoad(event, env) {
  const { m, db } = meterDb(env.DB), now = new Date(event.scheduledTime + skewOf(env));
  let r = '';
  try { r = await runDeadline(env, db, now); } catch (e) { r = 'error ' + e.message; }
  console.log(JSON.stringify({ load: 1, action: 'cron.deadline', result: r, ...m }));
}
