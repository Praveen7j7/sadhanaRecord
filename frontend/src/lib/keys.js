// Phase 7 (9 Oct 2026), computers only, loaded after the app opens (ui/Shell.svelte):
//   j / k   move between the rows of a list (and focus them)
//   p / a   mark Present / Absent on the focused row (while marking is open)
//   Ctrl / ⌘ S  press the screen's Save
//   [ / ]   the previous / next day or week
// Never while a dialog is open; single keys never while typing (Ctrl / ⌘ S works while typing).
const ROWS = '.brow, .mrow, .lrow, .ov-row, .ac-row, .hh-row';
let lastG = 0;
function moveRow(d) {
  const main = document.getElementById('main'), rows = [...(main?.querySelectorAll(ROWS) || [])].filter((r) => r.getClientRects().length);
  if (!rows.length) return;
  const at = rows.findIndex((r) => r.contains(document.activeElement));
  const next = rows[Math.max(0, Math.min(rows.length - 1, at < 0 ? 0 : at + d))];
  const f = next.matches('a, button') ? next : next.querySelector('a, button:not([disabled])');
  f?.focus(); f?.scrollIntoView({ block: 'nearest' });
}
const press = (el) => { if (el && !el.disabled) { el.click(); return true; } return false; };
function onKey(e) {
  if (e.defaultPrevented || e.repeat || document.querySelector('dialog[open]')) return;
  if (e.key === 'g') { lastG = Date.now(); return; }            // Shell's g-chords (g h, g w …) own the next key
  if (Date.now() - lastG < 1500) return;
  const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
    // the floating bar, or on a desktop the Day form's rail (C8, 22 Oct 2026: the bar is hidden from 1024 px)
    const b = [...document.querySelectorAll('.actionbar button, .dayrail button')].filter((x) => x.getClientRects().length && !x.disabled && /^Save/.test(x.textContent.trim())).pop();
    if (b) { e.preventDefault(); press(b); }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || typing) return;
  if (e.key === 'j' || e.key === 'k') { e.preventDefault(); moveRow(e.key === 'j' ? 1 : -1); return; }
  if (e.key === 'p' || e.key === 'a') {
    const row = document.activeElement?.closest?.(ROWS + ', li');
    const b = row && [...row.querySelectorAll('.pa button')].find((x) => x.textContent.trim().startsWith(e.key.toUpperCase()));
    if (b) { e.preventDefault(); press(b); }
    return;
  }
  if (e.key === '[' || e.key === ']') { if (press(document.querySelector(`#main [data-step="${e.key === '[' ? 'prev' : 'next'}"]`))) e.preventDefault(); }
}
let on = false;
export function installKeys() { if (!on) { on = true; window.addEventListener('keydown', onKey); } }
