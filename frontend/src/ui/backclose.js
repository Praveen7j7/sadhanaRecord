// Shared by every dialog (ui/Sheet, the Shell drawer, the photo views). No imports: ui/ holds no app logic.
// The phone's Back closes an open dialog (Android Back, a back swipe, the browser's Back; Chrome does not route it to a
// <dialog> by itself). Opening adds an entry with the same hash, so no hashchange: screens, the leave guard and the
// history numbers never see it. Back removes it and closes the dialog; closing any other way (✕, Escape, a tap outside,
// Done) steps back over it; a link inside the dialog takes its place (lib/router.svelte.js go() does the same).
// Returns release(), called once the dialog has closed.
// Not for a dialog opened from a leave guard: the router is undoing a navigation then (that dialog keeps its own Back).
let marks = 0;
export function backCloses(dlg) {
  if (typeof history === 'undefined' || !dlg) return () => {};
  const mark = ++marks;
  history.pushState({ ...(history.state || {}), sheet: mark }, '');
  let over = false;
  const end = () => { over = true; removeEventListener('popstate', pop); dlg.removeEventListener('click', link); };
  // Back (or another dialog's release) left this dialog's entry: close it. A dialog opened over it keeps its own entry.
  function pop() { if (!over && history.state?.sheet !== mark) { end(); if (dlg.open) dlg.close(); } }
  function link(e) {
    const a = e.target.closest?.('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
    e.preventDefault(); end(); location.replace(a.getAttribute('href')); if (dlg.open) dlg.close();   // the router sees a hashchange
  }
  addEventListener('popstate', pop);
  dlg.addEventListener('click', link);
  return () => { if (over) return; end(); if (history.state?.sheet === mark) history.back(); };
}
