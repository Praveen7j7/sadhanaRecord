// Server INCOMPLETE fields → tappable items. Paths: "days.<date>.<key>", "weekEnd.<key>", "attendance".
export function mapGaps(fields = []) {
  return fields.map((f) => {
    const m = /^days\.(\d{4}-\d{2}-\d{2})\.(\w+)$/.exec(f.path || '');
    if (m) return { message: f.message, kind: 'day', date: m[1], key: m[2] };
    if ((f.path || '').startsWith('weekEnd.')) return { message: f.message, kind: 'weekEnd', key: f.path.slice(8) };
    if (f.path === 'attendance') return { message: f.message, kind: 'attendance', key: 'attendance' };
    return { message: f.message, kind: 'other', key: f.path || '' };
  });
}
export function gapHref(weekId, g) {
  return g.kind === 'day' ? `#/day/${weekId}/${g.date}?f=${g.key}` : `#/week/${weekId}?f=${g.key}`;
}
