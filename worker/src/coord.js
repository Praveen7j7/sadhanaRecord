// Coordinator and master tools — the one name the rest of the server imports.
//
// This used to be a single 967-line module holding the status board, attendance, reopening, devotee management,
// profiles and photos, duplicate IDs, and the head's oversight and settings. Split on 13 October 2026 (audit F27,
// roadmap 3.1) by responsibility, not by line count: each of the files below is one thing a person does, and the
// one gate that keeps a coordinator inside their own batches (`managed()`) now sits in a small file of its own
// where it can be read at a glance.
//
//   staff.js       focusWeek(), managed(), and the three helpers every staff tool needs
//   board.js       the status board (one row per devotee per week), the batch list, a batch's filling chart
//   attendance.js  the coordinator's marks, the head's override, declaring a week's class
//   reopening.js   a coordinator asks to reopen a missed week; the head decides
//   devotees.js    the member list, one devotee's record, active/inactive/disable/delete, birthdays
//   profile.js     a person's own profile and photo
//   image.js       is a JPEG really a JPEG, and within its limits (used by profiles AND the wall)
//   oversight.js   every batch at a glance, Activity, the run log, settings, possible duplicate IDs
//
// Nothing moved in or out of a function and no behaviour changed: the diff for that commit was section moves plus
// the import lines each new file needs. This file re-exports everything, so api.js (which imports it as
// `* as coord`) and the modules that reach for boardRows, focusWeek, managed, reopenOpen and markSummary keep
// working untouched. (The wall used to import jpegSize from here too; it now shares image.js instead, so a
// "coordinator" file is no longer a dependency of announcements.js.)
//
// Adding a staff action: put it in the file that matches what it does, export it here, and add the route in
// api.js. If none of them fits, that is a sign it is a new responsibility — give it its own file rather than
// growing one of these back to 967 lines.

export { focusWeek, managed, COLS, parse, reasonOf } from './staff.js';
export { boardRows, devoteesList, statsBatch, reopenOpen } from './board.js';
export { attendanceSet, markSummary, attendanceOverride, weeksSetClass } from './attendance.js';
export { reopenRequest, reopenList, weeksReopen, reopenReject } from './reopening.js';
export { membersList, devoteesGet, devoteesSetActive, devoteesSetDisabled, devoteesDelete, accountDelete, devoteesSetPeople, birthdaysToday } from './devotees.js';
export { consentView, profileGet, profileUpdate, photoUpload, photoGet, photoRemove } from './profile.js';
export { idsPossibleDuplicates, idsReviewDuplicate, statsAll, auditList, runlogList, settingsGet, settingsUpdate } from './oversight.js';
