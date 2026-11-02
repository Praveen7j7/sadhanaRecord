// A1–A3 (Phase 22): a tap, click or Enter anywhere on a date field opens the phone's or browser's own calendar, so
// nobody has to type a full date. showPicker() throws without a user gesture, on a disabled / read-only field and inside
// a cross-origin frame, and is missing on older browsers: then nothing happens and the field still takes typing.

/** Open the native picker of a date / datetime-local input. True when it opened. */
export function openPicker(el) {
  if (!el || typeof el.showPicker !== 'function' || el.disabled || el.readOnly) return false;
  try {
    el.showPicker();
    return true;
  } catch {
    return false;
  }
}

/** Enter (no modifier, not mid-composition) opens the calendar; every other key keeps typing into the field. */
export function pickerKey(e) {
  if (e.key !== 'Enter' || e.isComposing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return false;
  if (!openPicker(e.currentTarget)) return false;
  e.preventDefault();
  return true;
}
