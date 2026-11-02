// The reminder card's small questions, apart from the push code (Phase 8, 9 Oct 2026): Home asks them at startup, the
// rest of lib/push.js loads only when notifications are turned on or off.
const OFF = 'sr.reminderOff', DISMISS = 'sr.reminderAsk';
/** The person switched the reminder off on this phone (then it is never turned on by itself). */
export const userTurnedOff = () => { try { return localStorage.getItem(OFF) === '1'; } catch { return false; } };
/*
 * HOW THE APP ASKS ABOUT NOTIFICATIONS (the head, 14 Oct 2026; roadmap 4.6, audit FE-14).
 *
 * The rule: **a decision is permanent, a dismissal lasts the day.**
 *
 *   · they allowed it        → never ask again. There is nothing left to ask for.
 *   · they blocked it        → never ask again. The browser would not show the prompt a second time anyway.
 *   · they switched it off   → never ask again (Account, sr.reminderOff). A choice, not a "not now".
 *   · they closed the card   → gone for the rest of today, offered again tomorrow.
 *
 * WHY IT IS NOT "ask every day" in the literal sense. The BROWSER's permission prompt can be shown once and
 * once only. Tap "Block" and requestPermission() returns "denied" immediately and for ever, showing nothing,
 * and no app — ours or anyone else's — can bring it back. An app that called it daily would do exactly
 * nothing. What a well-behaved app does instead, and what this is, is two separate things:
 *   1. the system prompt, asked ONCE at a moment the person can answer: after their first saved day
 *      (main.js, lib/push.js armNotificationPrompt), not on the first tap of a link they do not recognise;
 *   2. its OWN card on Home, which it may show as often as it likes — here, once a day until they decide.
 *
 * So the person is asked daily, by us, and never nagged by the browser. Closing the card is respected for
 * the day so nobody is asked twice in one sitting.
 */
export const askDismissed = () => {
  try {
    /* A DECISION is permanent; a dismissal lasts the day (the head, 14 Oct 2026).
       · granted  — they said yes: never ask again, there is nothing left to ask for
       · denied   — the browser will not show the prompt again anyway, so the card could only taunt them
       · switched off in Account — a deliberate choice, not a "not now"
       Anything else means they have not decided, and the card returns tomorrow. */
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    if (perm === 'granted' || perm === 'denied') return true;
    if (userTurnedOff()) return true;
    return localStorage.getItem(DISMISS + 'Day') === new Date().toDateString();
  } catch { return true; }
};
export const dismissAsk = () => { try { localStorage.setItem(DISMISS + 'At', String(Date.now())); localStorage.setItem(DISMISS + 'Day', new Date().toDateString()); } catch { /* storage blocked */ } };
/** The reminder card was answered today (then the install card waits for another day). */
export const askedToday = () => { try { return localStorage.getItem(DISMISS + 'Day') === new Date().toDateString(); } catch { return false; } };
