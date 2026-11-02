import { registerServiceWorker } from './lib/sw.js';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { applyTheme, followSystem, applyTextSize } from './lib/theme.js';
import { startTier } from './lib/tier.js';
import { nav } from './lib/router.svelte.js';
import { toast } from './lib/pro.svelte.js';
import { signedIn } from './lib/signedin.js';

applyTheme();
applyTextSize();
followSystem();
// Automatic: the richest look (glass, shadows, motion) this phone and its connection can comfortably sustain, set before
// the first screen and followed while the app is open (connection, battery, measured slowness; lib/tier.js)
startTier();

/*
 * A returning, signed-in person (A6, 22 Oct 2026): the splash goes at once instead of fading for 420 ms.
 *
 * The splash is plain HTML so it shows before any script runs — without it a slow phone would show a blank page
 * until this file loads, so it STAYS until here. But for somebody already signed in on this phone, their Home is
 * kept here too (session.svelte.js) and is drawn the moment the app mounts, so the fade only made them watch the
 * brand dissolve over a screen that was already there. `resume` takes the fade away; App.svelte still decides WHEN
 * the splash leaves, unchanged. Read-only and guarded: blocked storage simply keeps today's behaviour.
 */
try {
  if (localStorage.getItem('sr.token') && localStorage.getItem('sr.user')) {
    document.getElementById('splash')?.classList.add('resume');
    signedIn();   // A4: the signed-in app's file starts loading now, beside this one, not after mount
  }
} catch { /* storage blocked: the ordinary fade */ }
mount(App, { target: document.getElementById('app') });

/*
 * Notifications are a default of the app (the head, 3 Oct 2026): the 9 PM daily reminder (decision 38),
 * announcements, and the notice when a coordinator changes an attendance mark all ride on this one system
 * permission.
 *
 * WHEN IT IS ASKED (roadmap 4.6, audit FE-14; the head, 14 Oct 2026): after the devotee's FIRST SAVED DAY,
 * not on the first tap after opening the app.
 *
 * It used to fire on the first tap anywhere, signed in or not. So a devotee opening the shared link for the
 * first time — before signing in, before seeing what the app is for — was asked by their phone to allow
 * notifications from a site they did not yet recognise. The honest answer at that moment is "Block", and a
 * browser treats Block as permanent: the prompt never appears again, and nothing in the app can bring it
 * back. One tap in the wrong second cost that devotee the daily reminder for good.
 *
 * Asking after a saved day means they have signed in, filled a day and pressed Save, so "would you like a
 * reminder to do this each day?" is a question they can actually answer. The cost is that the reminder
 * starts a day later for anyone who allows it, which is the right trade for not losing it permanently.
 *
 * Browsers only show the prompt from a user gesture, so the save is not enough on its own: the flag below
 * arms it and the next tap asks. In practice that is the tap that leaves the day.
 *
 * Never asked again once answered, or if switched off by hand (sr.reminderOff), or after a Block.
 */
const ARMED = 'sr.askNotify';   // lib/push.js › ASK_FLAG, set after the first saved day
try {
  if ('PushManager' in window && window.Notification?.permission === 'default'
      && localStorage.getItem('sr.reminderOff') !== '1' && localStorage.getItem(ARMED) === '1') {
    const ask = () => {
      document.removeEventListener('click', ask, true);
      if (Notification.permission !== 'default') return;
      Notification.requestPermission().then((p) => {
        // asked and answered, either way: do not arm it again
        try { localStorage.removeItem(ARMED); } catch { /* storage blocked */ }
        if (p === 'granted') window.dispatchEvent(new Event('sr-notify'));
      }).catch(() => {});
    };
    document.addEventListener('click', ask, true);
  }
} catch { /* storage or notifications blocked */ }

// a new version never interrupts a day being filled: it applies once the changes are saved (or left)
registerServiceWorker({ busy: () => nav.unsaved, onWait: () => toast('A new version is ready — it will apply after you save', { kind: 'info', ms: 8000 }) });
try { if (sessionStorage.getItem('sr.updated')) { sessionStorage.removeItem('sr.updated'); setTimeout(() => toast('Updated to the latest version', { kind: 'info' }), 800); } } catch { /* storage blocked */ }
