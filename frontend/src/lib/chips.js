// A one-line chip row (.chiprow.one-line) that opens with its chosen chip cut off at the edge scrolls just enough to
// show it whole. Sideways only: the page itself never moves.
export function pressedInView(row) {
  const el = row.querySelector('[aria-pressed="true"]');
  if (!el) return;
  const pad = parseFloat(getComputedStyle(row).paddingInlineStart) || 0;
  const r = row.getBoundingClientRect(), e = el.getBoundingClientRect();
  const left = e.left - r.left + row.scrollLeft, right = left + e.width;
  if (right > row.scrollLeft + row.clientWidth - pad) row.scrollLeft = right - row.clientWidth + pad;
  else if (left < row.scrollLeft + pad) row.scrollLeft = left - pad;
}
