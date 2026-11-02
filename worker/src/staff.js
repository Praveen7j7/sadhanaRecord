// What every coordinator and master tool needs: the week they are looking at, the "may I act on this devotee"
// check, and three small helpers. Split out of coord.js on 13 October 2026 (audit F27 / roadmap 3.1); the code is
// unchanged, only its home.
//
// Why this file exists separately: `managed()` is the single gate that keeps one coordinator out of another's
// batch, and it is called from five modules (devotees, profile, reopening, oversight, facilitator). Keeping it in
// one small file makes it obvious what that gate does, and means a new staff action has one import to reach for
// rather than a 1,000-line module to read.
import { apiError, invalid, mondayOf, normPhone, cleanName } from './util.js';
import { account, currentMembership, isStaffAccount } from './db.js';
import { requireBatch } from './requests.js';
import { addDays, windowOf } from './weeks.js';
import { SKILLS } from '../../shared/skills.js';

// the day columns live with the week (weeks.js); re-exported here so a staff module has one import to reach for
export { COLS } from './weeks.js';

/** A day column's JSON, or null for an unfilled day. */
export const parse = s => (s ? JSON.parse(s) : null);

/** A reason a staff action must give, 2–200 characters. Throws VALIDATION with the field's own path. */
export const reasonOf = (v, path = 'reason') => {
  const r = cleanName(v);
  if (r.length < 2 || r.length > 200) throw invalid({ path, message: 'Give a short reason.' });
  return r;
};

/** The week coordinators look at: last week until its Monday 9 PM deadline, then this week. */
export async function focusWeek(db, now) {
  const thisWeek = mondayOf(now), lastWeek = addDays(thisWeek, -7);
  return now < (await windowOf(db, lastWeek)).closes ? lastWeek : thisWeek;
}

/**
 * A devotee the caller may manage (own batch for a coordinator; anyone for a master). Never the caller. change: the
 * caller is about to change them; a person who also coordinates a batch or is the IYF head is changed only by a master.
 */
export async function managed(ctx, loginIn, { allowPending = false, change = false } = {}) {
  const login = normPhone(loginIn), a = login ? await account(ctx.db, login) : null;
  // The codes below differ by the TARGET's state (NOT_FOUND / CONFLICT / FORBIDDEN), which is what a coordinator
  // working through their batch needs. That is safe because every caller who reaches here is staff: the STAFF
  // routes are gated in api.js, and the two ANY routes that take someone else's `login` (photo.get, photo.remove)
  // check for staff themselves before calling this — see photoOwner() in profile.js and audit finding F4.
  if (!a || a.role !== 'DEVOTEE') throw apiError('NOT_FOUND', 'No devotee with that phone.');
  if (!allowPending && (a.status === 'PENDING' || a.status === 'REJECTED')) throw apiError('CONFLICT', 'Approve or reject the sign-up first.');
  if (a.login === ctx.login) throw apiError('FORBIDDEN', 'You cannot change your own account here.');
  const m = await currentMembership(ctx.db, a.login);
  const batchId = m ? m.batch_id : a.requested_batch;
  await requireBatch(ctx, batchId);
  if (change && !ctx.scopes.master && await isStaffAccount(ctx.db, a)) throw apiError('FORBIDDEN', 'This person also coordinates a batch or is the IYF head; only the IYF head can change them.');
  return { a, m, batchId };
}

/** profiles.skills, read safely: one bad value must never take a whole profile page down.
 *  A hand edit in the Sheets copy, or a future import, could leave anything in that column —
 *  so parse defensively and keep only the values still on the list. */
export const readSkills = (v) => {
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a.filter((x) => SKILLS.includes(x)) : []; }
  catch { return []; }
};
