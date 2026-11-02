// Every error code the API can answer with, in one place (13 October 2026; audit F26 / roadmap 3.3).
//
// They used to be string literals scattered across eleven modules, which is why the same situation could come back
// as NOT_FOUND from one path, FORBIDDEN from another and CONFLICT from a third, and why the API reference listed
// nine of them while the server threw twenty-two. This file is the list; `docs/API_REFERENCE.md` is generated from
// it (tools/docs/codes.mjs), and the app's message table is checked against it by a test.
//
// Adding a code: add it here with a one-line meaning and whether retrying helps, then use CODES.<NAME> at the
// throw site. A code that is not in this list fails the test in worker/tests/codes.test.mjs.
//
// `retry` is advice for the caller, not the server: 'never' means the same request will always fail the same way
// (the client should show the message), 'later' means the condition passes on its own (the client may retry),
// 'fix' means the request itself must change first.

/** code → { meaning, retry, http } — `http` is what the code WOULD be in a status-code API, for readers; every
 *  real reply is HTTP 200 with `ok: false` (ADR 0001). */
export const ERRORS = {
  // the envelope and the gate
  BAD_REQUEST:          { meaning: 'The call itself is malformed: unknown action, unknown field, bad JSON, a data key the action does not accept.', retry: 'fix', http: 400 },
  UPGRADE_REQUIRED:     { meaning: 'The app is older than the API contract. The app reloads itself to pick up the new build.', retry: 'fix', http: 409 },
  UNAUTHENTICATED:      { meaning: 'No usable session: the token is missing, malformed, ended, expired, or the account is no longer active.', retry: 'fix', http: 401 },
  MUST_CHANGE_PASSWORD: { meaning: 'The account must choose a new password before anything else is allowed.', retry: 'fix', http: 403 },
  FORBIDDEN:            { meaning: 'The caller is signed in but may not do this: wrong scope, another coordinator\'s batch, a staff account they may not change, or a service token outside its allow-list.', retry: 'never', http: 403 },

  // input
  VALIDATION:           { meaning: 'One or more fields are wrong. `fields[]` carries a path and a message for each.', retry: 'fix', http: 422 },

  // the record asked for
  NOT_FOUND:            { meaning: 'No such record, or none the caller may see. Used deliberately in place of FORBIDDEN where saying "it exists" would itself disclose something (facilitator.js).', retry: 'never', http: 404 },
  CONFLICT:             { meaning: 'The record is not in a state that allows this: already approved, already linked, a sign-up still pending, a duplicate.', retry: 'never', http: 409 },
  UNKNOWN_ID:           { meaning: 'An IYF ID that is not in the dashboard registry copy.', retry: 'later', http: 404 },

  // sign-in
  BAD_CREDENTIALS:      { meaning: 'Wrong password, or an unknown login (deliberately the same answer for both).', retry: 'fix', http: 401 },
  LOCKED_OUT:           { meaning: 'Too many wrong passwords. `data.until` says when it ends.', retry: 'later', http: 429 },
  ACCOUNT_DISABLED:     { meaning: 'The account is disabled or inactive; a coordinator or the head must re-enable it.', retry: 'never', http: 403 },
  PENDING_APPROVAL:     { meaning: 'The sign-up is waiting for a coordinator.', retry: 'later', http: 403 },
  // decision 46: the temporary password from an approved reset is past its 24 hours. Only ever returned
  // after the password itself matched, so it tells a guesser nothing.
  RESET_EXPIRED:        { meaning: 'The temporary password from an approved reset is past its 24 hours; the devotee asks for a new reset and the coordinator approves it again.', retry: 'fix', http: 403 },
  REJECTED:             { meaning: 'The sign-up was rejected.', retry: 'never', http: 403 },

  // the weekly form
  FUTURE_DAY:           { meaning: 'That day has not happened yet in Indian time.', retry: 'never', http: 422 },
  STALE:                { meaning: 'Another device saved this day first. `data` carries the server\'s current copy; the app adopts it.', retry: 'fix', http: 409 },
  WINDOW_CLOSED:        { meaning: 'The week is past its deadline and not reopened, or attendance is not open yet.', retry: 'never', http: 409 },
  ALREADY_SUBMITTED:    { meaning: 'This week was already submitted; a submitted week never changes.', retry: 'never', http: 409 },
  INCOMPLETE:           { meaning: 'Submit needs at least one whole day. `fields[]` lists what is missing.', retry: 'fix', http: 422 },

  // the wall
  COMMENTS_BLOCKED:     { meaning: 'The IYF head has hidden this person\'s comments for everyone.', retry: 'never', http: 403 },

  // load and faults
  BUSY:                 { meaning: 'A rate limit said no, or an ID allocation is contended. NOT a lock. The app retries three times, two seconds apart.', retry: 'later', http: 429 },
  INTERNAL:             { meaning: 'A fault on the server. The message is deliberately generic; the detail is in `run_log`.', retry: 'later', http: 500 },
  // D1's free plan stops serving reads once the day's row budget is spent; it resets at 00:00 UTC (05:30 IST).
  // Separated from INTERNAL because "try again" is wrong advice here — nothing works until the reset.
  DAILY_LIMIT:          { meaning: "The database has stopped answering for the day (D1's row budget); every action fails until it resets at 05:30 IST. The person is told only that the app is resting — the plan and the quota go to run_log, never to them.", retry: 'later', http: 503 }
};

/** Shorthand so a throw site reads `apiError(CODES.CONFLICT, '…')` and a typo is a crash, not a new code. */
export const CODES = Object.fromEntries(Object.keys(ERRORS).map(k => [k, k]));

/** Every code, for the docs generator and the tests. */
export const CODE_LIST = Object.keys(ERRORS);
