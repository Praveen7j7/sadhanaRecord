// Every per-run cap the plan sets, in one place (22 Oct 2026, G5 of the measured audit).
//
// They were spread over five files as constants. Each is sized for the FREE plan: 10 ms of CPU per scheduled run and
// 50 outside requests per run. On a paid plan the same Worker may do more per run, so each cap can be raised by a
// `[vars]` entry in wrangler.toml — `LIMIT_<NAME> = "<n>"` — with no code change and no new deploy of logic:
//
//   [vars]
//   LIMIT_PUSH_PER_RUN = "200"
//
// With no such entry every number is the free-plan one below, which is what the tests run on. A value that is not a
// whole number, or is above its ceiling, is ignored (the free number is used): a typo must never turn a cron run into
// one that exceeds what any plan allows. Ceilings: the paid plan's 1,000 outside requests per run, and D1's 100k
// statement batch sizes kept well clear of.
//
// A Worker's env is fixed for a deployment, so index.js applies it once at the start of each invocation (useLimits)
// and every run reads LIMITS when it runs.
export const FREE = Object.freeze({
  PUSH_PER_RUN: 35,              // push.js: phones per scheduled run (one outside request each; 50 a run on free)
  MIRROR_ROWS_PER_RUN: 300,      // mirror.js: rows copied to the Sheets per run (paused since 13 Oct)
  MIRROR_TRIM_PER_RUN: 500,      // mirror.js: copied log entries trimmed per night run
  ERASE_PER_RUN: 40,             // erase.js: sheet rows of a deleted account blanked per run
  DEADLINE_PER_RUN: 100,         // weeks.js: devotees closed at the deadline per run
  DEADLINE_AUTO_PER_RUN: 25,     // weeks.js: of those, drafts auto-submitted (scored) per run — scoring costs CPU
  RETENTION_CHUNK: 500,          // retention.js: old log rows deleted per table per night run
  RETENTION_SHEET_CHUNK: 1000    // retention.js: old log rows cleared per Sheets tab per night run
});
const CEILING = Object.freeze({
  PUSH_PER_RUN: 900, MIRROR_ROWS_PER_RUN: 3000, MIRROR_TRIM_PER_RUN: 5000, ERASE_PER_RUN: 400,
  DEADLINE_PER_RUN: 1000, DEADLINE_AUTO_PER_RUN: 250, RETENTION_CHUNK: 5000, RETENTION_SHEET_CHUNK: 10000
});

/** What the runs read. Free-plan numbers until useLimits(env) says otherwise. */
export const LIMITS = { ...FREE };

/** Applies `LIMIT_<NAME>` vars from env; an unset, malformed or out-of-range value keeps the free number. */
export function useLimits(env) {
  for (const k of Object.keys(FREE)) {
    const raw = env?.['LIMIT_' + k], n = Number(raw);
    LIMITS[k] = raw !== undefined && raw !== '' && Number.isInteger(n) && n > 0 && n <= CEILING[k] ? n : FREE[k];
  }
  return LIMITS;
}
