// Theme: System / Light / Dark, remembered in localStorage. The choice is resolved here and set as data-theme
// ("light" | "dark") on <html> — System follows the phone, also when it changes. The browser bar colour
// (meta theme-color) follows the page background: theme × area.
const KEY = 'sr.theme';
export function getTheme() {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}
const systemDark = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } };
/** The scheme a choice means right now: 'light' | 'dark'. */
export const resolveTheme = (t, dark = systemDark()) => (t === 'light' || t === 'dark' ? t : dark ? 'dark' : 'light');
export function applyTheme(t = getTheme()) {
  document.documentElement.setAttribute('data-theme', resolveTheme(t));
  syncBar();
}
export function setTheme(t) {
  try { if (t === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* storage blocked */ }
  applyTheme(t);
}
/** Keeps "System" in step with the phone's light / dark setting. */
export function followSystem() {
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (getTheme() === 'system') applyTheme('system'); }); } catch { /* old browser */ }
}
/** "rgb(1, 2, 3)" / "color(srgb 0.1 0.2 0.3)" → "#010203" ('' when it cannot be read). */
export function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(String(c || '').trim())) return String(c).trim().toLowerCase();
  let m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(c || '');
  let v = m ? m.slice(1, 4).map(Number) : null;
  if (!v && (m = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(c || ''))) v = m.slice(1, 4).map((x) => Number(x) * 255);
  return v ? '#' + v.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('') : '';
}
/** Sets the area (accent family) on <html> and paints the browser bar with the page background. */
export function setArea(area) {
  if (typeof document === 'undefined') return;
  if (document.documentElement.dataset.area !== area) document.documentElement.dataset.area = area;
  syncBar();
}
// light: the area's own colour (royal purple before sign-in, blue / saffron / red after); dark: the page background
export function syncBar() {
  if (typeof document === 'undefined' || !document.body) return;
  const root = document.documentElement, dark = root.getAttribute('data-theme') === 'dark';
  const hex = toHex(dark ? getComputedStyle(document.body).backgroundColor : getComputedStyle(root).getPropertyValue('--accent'));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (hex && meta && meta.content !== hex) meta.content = hex;
}

// Text size (Phase 8, 9 Oct 2026): Default · Larger (112 %) · Largest (125 %), on top of the phone's own setting. The
// app is sized in rem, so the whole page grows; remembered on this phone and applied before the first paint (main.js).
const TS = 'sr.textSize';
export const TEXT_SIZES = [['', 'Default', ''], ['lg', 'Larger', '112.5%'], ['xl', 'Largest', '125%']];
export function getTextSize() { try { const v = localStorage.getItem(TS); return v === 'lg' || v === 'xl' ? v : ''; } catch { return ''; } }
export function applyTextSize(v = getTextSize()) { document.documentElement.style.fontSize = TEXT_SIZES.find((x) => x[0] === v)?.[2] || ''; }
export function setTextSize(v) { try { if (v) localStorage.setItem(TS, v); else localStorage.removeItem(TS); } catch { /* storage blocked */ } applyTextSize(v); }
