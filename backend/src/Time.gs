/**
 * Time.gs — Indian time helpers. Weeks run Monday to Sunday; a week is named by its Monday (YYYY-MM-DD).
 */
function isoNow_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function iso_(d) { return d instanceof Date && !isNaN(d.getTime()) ? Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX") : ''; }
function ymd_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
/** Monday of d's week, as YYYY-MM-DD (IST). */
function mondayOf_(d) {
  var dow = Number(Utilities.formatDate(d, TZ, 'u'));          // 1 = Monday … 7 = Sunday
  return ymd_(new Date(d.getTime() - (dow - 1) * 86400000));
}
function addMinutes_(d, m) { return new Date(d.getTime() + m * 60000); }
function addDays_(d, n) { return new Date(d.getTime() + n * 86400000); }
function asDate_(v) {
  if (v instanceof Date) return v;
  if (v === '' || v === null || v === undefined) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
/** Years between a date of birth and today (IST). */
function ageOn_(dob, today) {
  var a = Number(ymd_(today).slice(0, 4)) - Number(ymd_(dob).slice(0, 4));
  if (ymd_(today).slice(5) < ymd_(dob).slice(5)) a--;
  return a;
}
