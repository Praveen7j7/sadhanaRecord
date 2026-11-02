// The phone's copy of the public lists (sr.meta: batch names, the facilitator wheel) as a reactive value (Phase 24,
// one name, one place, 27 Oct 2026). cachedMeta() reads it through here, so every screen that draws a batch or a
// facilitator name from the copy redraws when a fresh copy arrives — the nine screens that only read it included —
// without each of them asking the server again. Kept as the stored TEXT, so cachedMeta() still hands each caller its
// own parsed object, exactly as before.
const read = () => { try { return localStorage.getItem('sr.meta') || '{}'; } catch { return '{}'; } };
let raw = $state.raw(read());
export const metaRaw = () => raw;
export function metaChanged() { raw = read(); }
