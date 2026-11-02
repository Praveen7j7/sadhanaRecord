// Master oversight helpers: readable activity lines, the settings form (submit window, first tracked week).

export const VERB = {
  'requests.approve': 'approved the sign-up of', 'requests.reject': 'rejected the sign-up of', 'resets.approve': 'approved a password reset for',
  'resets.reject': 'rejected a password reset for', 'attendance.set': 'marked attendance for', 'attendance.override': 'changed attendance after the deadline for',
  'devotees.setPeople': 'changed the facilitator / class day of', 'devotees.setActive': 'changed the active status of', 'devotees.setDisabled': 'changed the login of',
  'devotees.delete': 'deleted the account of', 'weeks.setClass': 'set the class of the week for', 'weeks.reopen': 'reopened a week of',
  'reopen.request': 'asked to reopen a week of', 'reopen.reject': 'turned down reopening for', 'coordinators.create': 'created the coordinator',
  'coordinators.update': 'updated the coordinator', 'coordinators.setDisabled': 'changed the access of', 'coordinators.resetPassword': 'set a temporary password for',
  'batches.update': 'updated the batch', 'ids.link': 'linked an IYF ID to', 'ids.unlink': 'unlinked the IYF ID of', 'settings.update': 'changed the settings',
  'week.submit': 'submitted the week of', 'week.saveDay': 'filled a day for', 'week.saveWeekEnd': 'filled the week-end answers of', 'photo.remove': 'removed the photo of',
  // every other logged action reads as a sentence too (the head, 7 Oct 2026: no raw "leaders.assign")
  'leaders.appoint': 'made a group leader:', 'leaders.assign': 'added devotees to the group of', 'leaders.remove': 'removed the group leader',
  'facilitators.add': 'added the facilitator', 'facilitators.setActive': 'switched the facilitator', 'facilitators.delete': 'deleted the facilitator',
  'facilitators.loginCreate': 'created the facilitator login', 'facilitators.loginResetPassword': 'set a temporary password for', 'facilitators.loginSetDisabled': 'changed the facilitator login',
  'facilitators.linkMember': 'gave facilitator access to', 'facilitators.unlinkMember': 'removed facilitator access from',
  'announcements.create': 'posted an announcement', 'announcements.update': 'edited an announcement', 'announcements.remove': 'removed an announcement', 'announcements.uncomment': 'removed a comment by',
  'devotees.reactivate': 'made active again', 'devotees.inactive': 'marked as not active', 'devotees.disable': 'switched off the login of', 'devotees.enable': 'switched on the login of',
  'profile.rename': 'changed their name', 'profile.classDay': 'changed their class day', 'profile.facilitator': 'changed their facilitator', 'auth.changePassword': 'changed their password',
  'account.delete': 'deleted their own account', 'week.autoSubmitted': 'auto-submitted at the deadline the week of', 'week.dropped': 'dropped the week of',
  'week.submit.onBehalf': 'submitted the week on behalf of', 'ids.duplicate.reopen': 'reopened the duplicate check of', 'ids.duplicate.notDuplicate': 'marked as not a duplicate:',
  'masters.set': 'changed IYF head access for', 'batches.create': 'added the batch',
  // 8 Oct 2026: attendance and filling on someone's behalf are logged too, and the wall's moderation
  'group.mark': 'marked group attendance in', 'week.saveDay.onBehalf': 'filled a day for', 'week.saveWeekEnd.onBehalf': 'filled the week-end answers for',
  'announcements.resolve': 'acted on a report about', 'mutes.hideForAll': 'hid for everyone the comments of', 'mutes.showForAll': 'showed again the comments of',
  // Phase 9 (9 Oct 2026): new IYF heads (every other head approves), IDs made in the app, exports
  'masters.create': 'appointed as IYF head', 'masters.request': 'asked the heads to approve as IYF head', 'masters.approve': 'approved as IYF head',
  // automatic inactive (Phase 23, ADR 0020): 30 days with no day filled and no use of the app; back by filling or using the app.
  // The Phase 22 request lines (raised / approve / reject) stay readable for the rows already in the log.
  'inactive.auto': 'made inactive automatically (30 days with no day filled and no use of the app)', 'inactive.cameBack': 'came back:',
  'inactive.raised': 'raised "make inactive?" requests', 'inactive.approve': 'made inactive (no week in 4 weeks):', 'inactive.reject': 'kept active (no week in 4 weeks):',
  // Phase 23: asking to start a batch (batchreq.js)
  'batchReq.create': 'asked to start a new batch:', 'batchReq.withdraw': 'withdrew their request to start a batch:',
  'batchReq.approve': 'started the batch asked for by', 'batchReq.decline': 'declined the request to start a batch from',
  'masters.decline': 'declined as IYF head', 'masters.withdraw': 'withdrew the request to make IYF head', 'ids.create': 'created an IYF ID for', 'exports.run': 'exported',
};
// an action with no sentence yet: its words ("devotees.setFoo" → "devotees set foo"), never the raw dotted name
const words = (a) => String(a).replace(/[._]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
/** The action groups offered as filter chips: [label, action prefix]. */
export const ACTION_GROUPS = [['All', ''], ['Sign-ups', 'requests.'], ['Attendance', 'attendance.'], ['Group marks', 'group.'], ['Devotees', 'devotees.'], ['Inactive', 'inactive.'], ['Group leaders', 'leaders.'],
  ['Facilitators', 'facilitators.'], ['Weeks', 'weeks.'], ['Filled for', 'week.'], ['Coordinators', 'coordinators.'], ['Batches', 'batches.'], ['New batches', 'batchReq.'], ['IYF IDs', 'ids.'],
  ['Announcements', 'announcements.'], ['Profiles', 'profile.'], ['Settings', 'settings.'], ['IYF heads', 'masters.'], ['Exports', 'exports.']];

/** The parts of an Activity line: who, what they did, about whom, and any detail (Phase 6: names, not phones). */
export function auditParts(r) {
  const verb = VERB[r.action] || words(r.action);
  const extra = [];
  const a = r.after || {};
  if (r.action === 'ids.create' && (a.iyf_id || a.iyfId)) extra.push('new ID ' + (a.iyf_id || a.iyfId));
  else if (a.iyf_id || a.iyfId) extra.push('linked ' + (a.iyf_id || a.iyfId));
  // an export: what each row was, how many fields, the range
  if (r.action === 'exports.run') extra.push([{ people: 'a row per devotee', weeks: 'a row per week', days: 'a row per day', staff: 'the staff list', batches: 'all batches', activity: 'the Activity log' }[a.rows] || a.rows,
    a.fields ? a.fields.length + ' fields' : '', a.from ? `${a.from} to ${a.to}` : '', a.personal ? 'with personal details' : ''].filter(Boolean).join(', '));
  if (a.mark !== undefined) extra.push(a.mark === 'P' ? 'Present' : a.mark === 'A' ? 'Absent' : 'cleared');
  if (Array.isArray(a.marks)) extra.push(a.marks.length + ' mark' + (a.marks.length === 1 ? '' : 's'));
  if (r.action === 'inactive.raised' && a.count) extra.push(`${a.count} devotee${a.count === 1 ? '' : 's'}, to the week of ${a.weekId}`);
  if (r.action === 'inactive.auto' && a.count) extra.push(`${a.count} devotee${a.count === 1 ? '' : 's'}`);
  if (r.action === 'inactive.cameBack' && a.how) extra.push({ FILLED: 'filled a day', APP: 'opened the app', MANUAL: 'by staff' }[a.how] || a.how);
  if (r.action === 'inactive.approve' && a.fromWeek) extra.push('from the week of ' + a.fromWeek);
  // asking to start a batch (Phase 23): the proposed dates, and the batch it became
  if (r.action === 'batchReq.create' && a.startsOn) extra.push('from ' + a.startsOn + (a.endsOn ? ' to ' + a.endsOn : ''));
  if (r.action === 'batchReq.approve' && a.batchId) extra.push('as ' + a.batchId);
  if (typeof a.marked === 'number') extra.push(`${a.marked} marked (${a.present || 0} present, ${a.absent || 0} absent${a.cleared ? `, ${a.cleared} cleared` : ''})`);
  if (a.date && r.action.endsWith('.onBehalf')) extra.push(a.date);
  if (a.action && r.action === 'announcements.resolve') extra.push(a.action === 'remove' ? 'removed' : 'kept');
  if (a.classDay) extra.push(a.classDay === 'SAT' ? 'Saturday class' : 'Sunday class');
  if (a.status) extra.push(String(a.status).toLowerCase());
  if (a.facilitator) extra.push(a.facilitator);
  if (a.leader && r.action !== 'leaders.assign') extra.push('leader ' + a.leader);
  if (typeof a.active === 'boolean') extra.push(a.active ? 'on' : 'off');
  if (a.name && r.action !== 'facilitators.add') extra.push(a.name);
  // one's own change (their name, class day, facilitator, password) names them once
  const target = r.action === 'settings.update' || !r.target || r.target === r.who ? '' : r.targetName || r.target;
  const who = r.role === 'MASTER' ? 'IYF head' : r.whoName || r.who;
  return { who, verb, target, extra: extra.join(' · ') };
}
/** "sps approved the sign-up of 6000000310 · linked KT26-0042" (names when the server sends them, Phase 6). */
export function auditLine(r) {
  const p = auditParts(r);
  return `${p.who} ${p.verb}${p.target ? ' ' + p.target : ''}${p.extra ? ' · ' + p.extra : ''}`;
}
/** The fields that changed, for the detail sheet: [{ field, before, after }] in plain words (Phase 6). */
const FIELD = { iyf_id: 'IYF ID', iyfId: 'IYF ID', classDay: 'Class day', facilitator: 'Facilitator', status: 'Status', name: 'Name', mark: 'Attendance', leader: 'Group leader',
  active: 'Active', batchId: 'Batch', batch_id: 'Batch', reason: 'Reason', title: 'Title', reminderTime: 'Reminder time', trackingFrom: 'First tracked week', submitWindow: 'Submit window',
  coordinatorLogins: 'Coordinators', pinned: 'Pinned', email: 'Email', whatsapp: 'WhatsApp', fromWeek: 'From week', openUntil: 'Open until', weekId: 'Week', date: 'Day' };
const plain = (v) => (v === null || v === undefined || v === '' ? '—' : v === true ? 'Yes' : v === false ? 'No' : v === 'P' ? 'Present' : v === 'A' ? 'Absent'
  : v === 'SAT' ? 'Saturday' : v === 'SUN' ? 'Sunday' : Array.isArray(v) ? (v.length && typeof v[0] === 'object' ? `${v.length} item${v.length === 1 ? '' : 's'}` : v.join(', ') || '—')
  : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k} ${plain(x)}`).join(', ') : String(v));
export function auditDiff(r) {
  const b = r.before || {}, a = r.after || {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k])).map((k) => ({ field: FIELD[k] || words(k).replace(/^./, (c) => c.toUpperCase()), before: plain(b[k]), after: plain(a[k]) }));
}

export const DAYS = [['MON', 'Monday'], ['TUE', 'Tuesday'], ['WED', 'Wednesday'], ['THU', 'Thursday'], ['FRI', 'Friday'], ['SAT', 'Saturday'], ['SUN', 'Sunday']];
/** "SUN 18:00" → { day: 'SUN', time: '18:00' } */
export const splitSpec = (s) => { const m = /^(MON|TUE|WED|THU|FRI|SAT|SUN) (\d{2}:\d{2})$/.exec(String(s || '').toUpperCase()); return m ? { day: m[1], time: m[2] } : { day: '', time: '' }; };
export const joinSpec = (day, time) => `${day} ${time}`;
/** Is this date (YYYY-MM-DD) a Monday? */
export const isMonday = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && new Date(iso + 'T12:00:00Z').getUTCDay() === 1;
/** Reminder times offered: every half hour from 6 PM to 10:30 PM (the server allows 18:00–22:59). */
export const REMINDER_TIMES = Array.from({ length: 10 }, (_, i) => `${String(18 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
/** Only what changed, as settings.update expects. */
export function settingsDiff(saved, form) {
  const out = {};
  const sw = { opens: joinSpec(form.opensDay, form.opensTime), closes: joinSpec(form.closesDay, form.closesTime) };
  if (sw.opens !== saved.submitWindow.opens || sw.closes !== saved.submitWindow.closes) out.submitWindow = sw;
  if ((form.trackingFrom || '') !== (saved.trackingFrom || '')) out.trackingFrom = form.trackingFrom || '';
  if (form.reminderTime !== saved.reminderTime) out.reminderTime = form.reminderTime;
  return out;
}

/** The actions whose sentence in Activity contains every word typed ("changed the facilitator of" for "facilitator"). */
export function actionsSaying(term) {
  const words = String(term || '').toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  return Object.entries(VERB).filter(([, say]) => words.every((w) => say.toLowerCase().includes(w))).map(([a]) => a).slice(0, 40);
}
