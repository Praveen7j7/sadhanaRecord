// A scheduled job that failed, where the head will see it (22 Oct 2026, F5 / roadmap 6.6).
//
// Until now a failing cron job — the Monday 9 PM deadline, the 9 PM reminders, the night's clean-up — wrote one line
// to Cloudflare's log and nothing else. Nobody reads that log day to day, so a deadline run that kept failing would
// have been found only when a coordinator asked why last week was still open. There is no outside channel (no email,
// SMS or WhatsApp, by decision), so the alert is in the app: the head's Home lists the failure under System health.
//
// One `settings` row per job (`cron_failed:<job>`, value `<time>|<message>`), written only when the job fails, and at
// most once per job every 10 minutes: a job failing every minute costs at most 144 writes a day, not 1,440, and a
// day without failures costs none. Writing never throws — an alert must not turn a failed job into a failed run.
import { isoIst } from './util.js';

/** Names the head reads, by job key. */
export const CRON_JOBS = {
  deadline: 'Monday deadline', reminders: '9 PM reminder', announcements: 'post notifications',
  notices: 'attendance notices', retention: 'old-log clean-up', trim: 'log trim', tidy: 'hourly tidy-up', reset: 'master reset'
};
const GAP_MS = 10 * 60000;

/** Logs the failure as before, and records it for the head's Home (throttled, never throws). */
export async function cronFailed(db, job, e, now = new Date()) {
  const message = String(e?.message || e || 'failed').replace(/\|/g, '/').slice(0, 160);
  console.error(job, message);
  try {
    await db.prepare(`INSERT INTO settings (key, value, note, changed_by, changed_at) VALUES (?, ?, 'A scheduled job failed (the head''s Home shows it)', 'schedule', ?)
                      ON CONFLICT(key) DO UPDATE SET value = excluded.value, changed_at = excluded.changed_at WHERE settings.changed_at < ?`)
      .bind('cron_failed:' + job, `${isoIst(now)}|${message}`, isoIst(now), isoIst(new Date(now.getTime() - GAP_MS))).run();
  } catch { /* the database itself is what failed: the log line above is all there is */ }
}

/** The recorded failures, newest first, from the settings map every call already holds: [{ job, name, at, message }]. */
export function cronFailures(all) {
  return Object.entries(all || {})
    .filter(([k]) => k.startsWith('cron_failed:'))
    .map(([k, v]) => { const [at, ...rest] = String(v).split('|'); const job = k.slice(12); return { job, name: CRON_JOBS[job] || job, at, message: rest.join('|') }; })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
