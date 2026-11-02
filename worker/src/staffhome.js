// The head's Home in one request (Phase 6, IMPLEMENTATION_PROMPTS; the 21 Oct blueprint R-07): it opened with eight
// separate reads — sign-ups, reopen requests, reported posts, new-head requests, settings, batches, the slow-call log
// and the batches' week — each a round trip from the phone. `home.staff` answers all of them at once, by calling the
// same handlers (so every part is exactly what its own action returns, and the screen caches each under its own name
// for the screens that use it), run side by side on the server.
import * as reqs from './requests.js';
import * as coord from './coord.js';
import * as ann from './announcements.js';
import * as admin from './admin.js';
import * as facs from './facilitators.js';
import { invalid } from './util.js';
import { activityNotices } from './inactive.js';

export async function homeStaff(d, ctx) {
  const weeks = d.weeks === undefined ? 8 : d.weeks;
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 8) throw invalid({ path: 'weeks', message: '1 to 8 weeks.' });
  const [requests, reopens, reports, heads, settings, batches, runlog, stats, orphans, notices] = await Promise.all([
    reqs.list({}, ctx), coord.reopenList({}, ctx), ann.reports({}, ctx), admin.headsRequests({}, ctx), coord.settingsGet({}, ctx),
    admin.batchesList({}, ctx), coord.runlogList({ limit: 100 }, ctx), coord.statsAll({ weeks }, ctx), facs.orphans({}, ctx),
    // who became inactive or came back (ADR 0020): Home's notices and the bell
    activityNotices({}, ctx)]);
  return { requests, reopens, reports, heads, settings, batches, runlog, stats, orphans, notices, weeks };
}
