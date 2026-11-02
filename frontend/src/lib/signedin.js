// The signed-in half of the app (22 Oct 2026, A4): the shell — bars, menu, navigation — and the screen switch, in its own
// file. A first visit to the Welcome or sign-in screen no longer downloads code it cannot use yet; a returning person's
// phone starts loading it before the app even mounts (main.js), from the copy installed on the phone, so their open
// does not wait for it. One shared load: every caller gets the same module, drawn in the same frame once loaded.
import { lazy, loadedOnce } from './lazy.js';
export const signedIn = () => loadedOnce('signedIn', () => lazy(() => import('../SignedIn.svelte')));
