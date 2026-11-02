// "You have unsaved changes" — the wiring, once (13 October 2026; audit FE-19 / roadmap 4.3).
//
// Two screens keep answers that are not sent until the person taps Save: the day form and the week-end questions.
// Both had the same fifteen lines — register a router leave guard, add a `beforeunload` listener for the tab
// closing, and remove both on teardown — written out separately, so a fix to one (the `whenSettled` dance that
// stops the held navigation being undone twice, learned on 10 Oct from the head's own phone) had to be
// remembered for the other.
//
// What stays in the screen: what "dirty" means, which path is itself (so navigating to the same screen is not a
// leave), and what the dialog does. Those genuinely differ. Only the wiring is here.
import { setLeaveGuard, whenSettled } from './router.svelte.js';

/**
 * Hold navigation while a screen has unsaved changes. Call inside `$effect` and return the result, so the guard
 * and the listener are removed when the screen goes:
 *
 *     $effect(() => holdWhileUnsaved({
 *       dirty: () => saver?.dirty(),
 *       self: () => `${pre}/day/${weekId}/${date}`,
 *       ask: (to) => { leaveTo = to; leaveDlg?.showModal(); },
 *       cleanup: () => saver?.destroy(),
 *     }));
 *
 * `ask` is called once the router has settled, never during the navigation itself: a question opened mid-flight
 * was being hidden and re-shown by the undo of the held step ("it shivers and then pops up").
 */
export function holdWhileUnsaved({ dirty, self, ask, cleanup }) {
  const bare = (p) => String(p || '').split('?')[0];
  const off = setLeaveGuard((to) => {
    // not dirty, or going to this very screen (a query change, a re-tap of the open tab): let it through
    if (!dirty() || bare(to) === bare(self())) return true;
    whenSettled(() => ask(to));
    return false;
  });
  // the tab closing or reloading: the browser's own prompt, which we can ask for but not word
  const unload = (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } };
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', unload);
  return () => {
    off();
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', unload);
    cleanup?.();
  };
}
