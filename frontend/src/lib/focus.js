// Focus helpers for forms (Phase 8).
/**
 * Phase 8 (9 Oct 2026): after a refused save, focus moves to the first field with a problem (its control), so a
 * keyboard or screen-reader user lands on it; the banner above says how many need fixing.
 */
export function focusFirstProblem(root) {
  const bad = root?.querySelector('[aria-invalid="true"], .field .err, [id$="-e"]');
  if (!bad) return;
  const field = bad.matches('[aria-invalid="true"]') ? bad : bad.closest('.field, fieldset, [role=group], .num, .tp') || bad.parentElement;
  const ctl = field?.matches?.('input, button, select, textarea') ? field : field?.querySelector('input, button:not([disabled]), select, textarea');
  ctl?.focus(); (ctl || bad).scrollIntoView?.({ block: 'center' });
}
