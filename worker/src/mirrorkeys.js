// The tables copied to Sheets row by row (they change while the app runs), with their primary-key columns.
// setup/build-mirror-sql.mjs makes the triggers from this list; src/mirror.js copies them.
export const KEYED = {
  accounts: ['login'],
  batches: ['batch_id'],
  memberships: ['id'],
  reset_requests: ['id'],
  profiles: ['login'],
  settings: ['key'],
  attendance: ['login', 'week_id'],
  reopens: ['login', 'week_id'],
  class_weeks: ['batch_id', 'week_id'],
  facilitators: ['name'],
  announcements: ['id'],
  duplicate_reviews: ['group_key'],
  missed_weeks: ['login', 'week_id'],
  reopen_requests: ['login', 'week_id'],
  // the head, 3 Oct 2026: unsent drafts too, so the people following devotees see the week as it is filled
  drafts: ['login', 'week_id'],
  // group leaders appointed by the coordinator (migration 0023)
  leaders: ['login'],
  // comments on announcements (migration 0026); likes are not copied one by one — counts on the Announcements tab
  post_comments: ['id'],
  // the wall's moderation (migration 0030): reports of posts and comments, and whose comments someone hid
  post_reports: ['id'],
  app_ids: ['id'],
  head_requests: ['id'],
  post_mutes: ['id'],
  // the IYF identity record (migration 0038): one lasting person behind every login, so a devotee
  // keeps one IYF ID through a name change, a new phone or a new app
  persons: ['id'],
  person_names: ['id'],
  person_phones: ['phone'],
  person_identifiers: ['fid'],
  person_links: ['service', 'account_ref'],
  person_history: ['id'],
  id_sequences: ['series', 'year']
};

/**
 * When a table's trigger logs a change (default: always).
 *   settings — rows that are the server's own bookkeeping, not something a coordinator reads in the Rules sheet:
 *     · reminder_cursor / reminder_day — the reminder's progress markers (older releases)
 *     · master_reset_applied — the marker of the last MASTER_RESET_PASSWORD (13 Oct 2026, audit J3): keyed with
 *       PW_PEPPER now, and kept out of the sheet as well, because a live temporary master password is involved
 *     · registry_refresh / registry_sig — written every 30 minutes by the schedule (audit J12), so an idle system
 *       made ~48 Settings-tab rewrites a day; the status is for the Settings screen, which reads D1 directly
 * Changing this list needs a regenerated trigger migration (setup/build-mirror-sql.mjs) to take effect.
 */
// The server's own bookkeeping rows never reach the Settings tab: they change on a schedule, nobody reads
// them in the sheet (the head's Settings screen reads D1), and one of them used to be a guessable hash.
// Migrations 0042 and 0047 carry the same list in the triggers themselves.
const SETTINGS_SKIP = "NEW.\"key\" NOT IN ('reminder_cursor', 'reminder_day', 'master_reset_applied', 'registry_refresh', 'registry_sig', 'refusals_forbidden', 'refusals_unauthenticated', 'refusals_stale')";
export const LOG_WHEN = {
  settings: { ins: SETTINGS_SKIP, upd: SETTINGS_SKIP }
};
