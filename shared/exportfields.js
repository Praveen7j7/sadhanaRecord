// The export fields (Phase 9, item 21), shared by the server (worker/src/exports.js gives each its value), the app's
// export sheet and the dev mock. grains: which rows offer it — p one per devotee, w per devotee per week, d per day.
// head: the IYF head only (personal details).
export const EXPORT_FIELDS = [
  ['name', 'Name', 'Person', 'pwd'], ['iyfId', 'IYF ID', 'Person', 'pwd'], ['phone', 'Phone', 'Person', 'pwd'], ['batch', 'Batch', 'Person', 'pwd'],
  ['whatsapp', 'WhatsApp', 'Contact', 'pwd'], ['email', 'Email', 'Contact', 'pwd'],
  ['classDay', 'Class day', 'Membership', 'pwd'], ['facilitator', 'Facilitator', 'Membership', 'pwd'], ['groupLeader', 'Group leader', 'Membership', 'pwd'],
  ['status', 'Status', 'Membership', 'pwd'], ['since', 'Member since (week)', 'Membership', 'pwd'],
  ['dob', 'Date of birth', 'Personal', 'pwd', true], ['bloodGroup', 'Blood group', 'Personal', 'pwd', true], ['address', 'Address', 'Personal', 'pwd', true],
  ['pin', 'PIN code', 'Personal', 'pwd', true], ['emergency', 'Emergency contact', 'Personal', 'pwd', true], ['emergencyPhone', 'Emergency phone', 'Personal', 'pwd', true],
  ['parent', 'Parent / guardian', 'Personal', 'pwd', true],
  ['weeksSubmitted', 'Weeks submitted', 'Sadhana summary', 'p'], ['weeksMissed', 'Weeks missed', 'Sadhana summary', 'p'], ['daysFilled', 'Days filled', 'Sadhana summary', 'p'],
  ['avgOverall', 'Average overall', 'Sadhana summary', 'p'], ['avgBody', 'Average body', 'Sadhana summary', 'p'], ['avgSoul', 'Average soul', 'Sadhana summary', 'p'],
  ['avgJapa', 'Average japa', 'Sadhana summary', 'p'], ['avgRounds', 'Average rounds', 'Sadhana summary', 'p'],
  ['classesPresent', 'Classes present', 'Sadhana summary', 'p'], ['classesAbsent', 'Classes absent', 'Sadhana summary', 'p'],
  ['week', 'Week (Monday)', 'Week', 'wd'], ['weekStatus', 'Week status', 'Week', 'w'], ['weekDays', 'Days filled', 'Week', 'w'],
  ['overall', 'Overall', 'Week scores', 'w'], ['body', 'Body', 'Week scores', 'w'], ['soul', 'Soul', 'Week scores', 'w'], ['bed', 'To bed', 'Week scores', 'w'],
  ['wakeUp', 'Wake-up', 'Week scores', 'w'], ['dayRest', 'Day rest', 'Week scores', 'w'], ['japa', 'Japa', 'Week scores', 'w'], ['reading', 'Reading', 'Week scores', 'w'],
  ['hearing', 'Hearing', 'Week scores', 'w'], ['seva', 'Seva', 'Week scores', 'w'], ['attendanceScore', 'Attendance score', 'Week scores', 'w'],
  ['weekRounds', 'Average rounds', 'Week totals', 'w'], ['sevaMin', 'Seva (minutes)', 'Week totals', 'w'], ['hearingMin', 'Hearing (minutes)', 'Week totals', 'w'],
  ['readingMin', 'Reading (minutes)', 'Week totals', 'w'], ['nightStay', 'Night stay', 'Week totals', 'w'], ['principles', '4 regulative principles', 'Week totals', 'w'],
  ['submittedAt', 'Submitted at', 'Week totals', 'w'], ['filledBy', 'Submitted for them by', 'Week totals', 'w'],
  ['attendance', 'Attendance', 'Attendance', 'w'], ['markedBy', 'Marked by', 'Attendance', 'w'], ['ownMark', 'Own mark', 'Attendance', 'w'],
  ['leaderMark', 'Group leader\'s mark', 'Attendance', 'w'], ['coordinatorMark', 'Coordinator\'s mark', 'Attendance', 'w'], ['headMark', 'IYF head\'s mark', 'Attendance', 'w'],
  ['date', 'Date', 'Day answers', 'd'], ['sleptAt', 'Slept at', 'Day answers', 'd'], ['wokeAt', 'Woke at', 'Day answers', 'd'], ['dayRestMin', 'Day rest (minutes)', 'Day answers', 'd'],
  ['rounds', 'Rounds', 'Day answers', 'd'], ['chantingDoneAt', 'Chanting done at', 'Day answers', 'd'], ['dayHearing', 'Hearing (minutes)', 'Day answers', 'd'],
  ['dayReading', 'Reading (minutes)', 'Day answers', 'd'], ['dayService', 'Service (minutes)', 'Day answers', 'd'],
  ['marksBed', 'To bed (marks)', 'Day marks', 'd'], ['marksWake', 'Wake-up (marks)', 'Day marks', 'd'], ['marksRest', 'Day rest (marks)', 'Day marks', 'd'],
  ['marksJapa', 'Japa (marks)', 'Day marks', 'd'], ['marksReading', 'Reading (marks)', 'Day marks', 'd'], ['marksHearing', 'Hearing (marks)', 'Day marks', 'd']
].map(([id, label, group, grains, head = false]) => ({ id, label, group, grains, head }));

export const GRAIN_CODE = { people: 'p', weeks: 'w', days: 'd' };
/** The head's fixed exports (no field choice). */
export const FIXED_EXPORTS = { staff: 'Coordinators and facilitators', batches: 'All batches', activity: 'Activity log' };

/** Ready-made choices: each sets the rows, the fields and (for weekly ones) a range; everything can be changed after. */
export const EXPORT_PRESETS = [
  { id: 'weekly', label: 'Weekly scores', grain: 'weeks', range: 'month', fields: ['week', 'name', 'iyfId', 'batch', 'facilitator', 'weekStatus', 'weekDays', 'overall', 'body', 'soul', 'japa', 'reading', 'hearing', 'seva', 'attendance'] },
  { id: 'daily', label: 'Daily details', grain: 'days', range: 'week', fields: ['date', 'name', 'iyfId', 'sleptAt', 'wokeAt', 'rounds', 'chantingDoneAt', 'dayRestMin', 'dayHearing', 'dayReading', 'dayService'] },
  { id: 'progress', label: 'Progress summary', grain: 'people', range: 'month', fields: ['name', 'iyfId', 'phone', 'batch', 'facilitator', 'weeksSubmitted', 'weeksMissed', 'daysFilled', 'avgOverall', 'avgJapa', 'avgRounds', 'classesPresent', 'classesAbsent'] },
  { id: 'contacts', label: 'Contact list', grain: 'people', fields: ['name', 'iyfId', 'phone', 'whatsapp', 'email', 'batch', 'classDay', 'facilitator', 'groupLeader', 'status'] },
  { id: 'attendance', label: 'Attendance register', grain: 'weeks', range: 'month', fields: ['week', 'name', 'iyfId', 'attendance', 'markedBy', 'ownMark', 'leaderMark', 'coordinatorMark', 'headMark'] },
  { id: 'missed', label: 'Missed weeks', grain: 'weeks', range: 'month', status: 'missed', fields: ['week', 'name', 'iyfId', 'phone', 'facilitator', 'weekDays'] }
];
