// Comfortable or Compact rows on the staff lists (console pattern #1, audit §8.3; 22 Oct 2026), kept on this device.
// One setting for every staff list, so a coordinator chooses once.
const KEY = 'sr.density';
const read = () => { try { return localStorage.getItem(KEY) === 'compact'; } catch { return false; } };
export const density = $state({ compact: read() });
export function setCompact(on) { density.compact = !!on; try { localStorage.setItem(KEY, on ? 'compact' : 'comfortable'); } catch { /* storage blocked */ } }
