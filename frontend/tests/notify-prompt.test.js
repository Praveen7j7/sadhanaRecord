// WHEN the phone asks permission for notifications — roadmap 4.6, audit FE-14, the head 14 Oct 2026.
//
// One system permission carries the 9 PM daily reminder (decision 38), announcements, and the notice when a
// coordinator changes an attendance mark. It used to be asked on the FIRST TAP after opening the app, signed
// in or not. So a devotee opening the shared link for the first time — before signing in, before seeing what
// the app is for — was asked by their phone to allow notifications from a site they did not recognise. The
// honest answer in that moment is "Block", and a browser makes Block PERMANENT: the prompt never returns and
// nothing in the app can bring it back. One tap in the wrong second cost that devotee the reminder for good.
//
// Now it waits for their first saved day. These check the three things that must hold: nothing asks before a
// save, a devotee's own save arms it, and a coordinator filling for somebody else never does.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const main = src('../src/main.js');
const push = src('../src/lib/push.js');
const day = src('../src/devotee/Day.svelte');
const app = src('../src/App.svelte');

describe('nothing asks before the devotee has done anything', () => {
  it('the load-time handler is armed only by the flag, never by a bare first tap', () => {
    // the bug: a click listener added unconditionally at startup
    const guard = /if \('PushManager' in window[\s\S]*?\{/.exec(main);
    expect(guard, 'the startup guard was not found').toBeTruthy();
    expect(guard[0]).toMatch(/sr\.askNotify|ARMED/);
  });

  it('and it still respects a hand switch-off and an already-answered permission', () => {
    expect(main).toMatch(/sr\.reminderOff/);
    expect(main).toMatch(/permission === 'default'/);
  });

  it('once answered, it is not armed again — a Block must not be re-asked on every load', () => {
    expect(main).toMatch(/removeItem\((?:ARMED|'sr\.askNotify')\)/);
  });
});

describe('the first saved day arms it', () => {
  it('Day.svelte arms the prompt when a devotee saves', () => {
    expect(day).toMatch(/armNotificationPrompt/);
    expect(day).toMatch(/import \{ armNotificationPrompt \} from '\.\.\/lib\/push\.js'/);
  });

  it('but NOT when a coordinator is filling for someone else', () => {
    /* `behalf` is the coordinator-filling case. Their phone must not be asked about a reminder for a
       devotee who is not them — and it is their own notifications the permission would govern. */
    const saved = /onSaved: \([\s\S]*?\n      \},/.exec(day);
    expect(saved, 'the onSaved handler was not found').toBeTruthy();
    expect(saved[0]).toMatch(/if \(behalf\)/);
    expect(saved[0]).toMatch(/else armNotificationPrompt\(\)/);
  });

  it('arming is a one-shot flag, not a prompt — browsers only show it from a tap', () => {
    expect(push).toMatch(/export function armNotificationPrompt/);
    expect(push).toMatch(/localStorage\.setItem\(ASK_FLAG/);
    // it must not try to prompt directly: outside a gesture the browser refuses and the chance is spent
    const fn = /export function armNotificationPrompt[\s\S]*?\n\}/.exec(push)[0];
    expect(fn).not.toMatch(/requestPermission/);
  });

  it('and it declines to arm when the permission is already decided or reminders are off', () => {
    const fn = /export function armNotificationPrompt[\s\S]*?\n\}/.exec(push)[0];
    expect(fn).toMatch(/permission !== 'default'/);
    expect(fn).toMatch(/sr\.reminderOff/);
  });
});

describe('it works within the same session, not only on the next visit', () => {
  it('App.svelte listens for the arm and puts the one-shot tap handler in place', () => {
    // main.js reads the flag only at load; without this the devotee would wait until their next visit
    expect(push).toMatch(/sr-ask-notify/);
    expect(app).toMatch(/sr-ask-notify/);
    const live = /window\.addEventListener\('sr-ask-notify'[\s\S]{0,80}/.exec(app);
    expect(live).toBeTruthy();
  });

  it('and that handler removes itself, so one save cannot queue several prompts', () => {
    const block = /const arm = \(\) => \{[\s\S]*?\n    \};/.exec(app);
    expect(block, 'the live arm block was not found').toBeTruthy();
    expect(block[0]).toMatch(/removeEventListener\('click', ask, true\)/);
  });
});

describe('a decision is permanent, a dismissal lasts the day', () => {
  /* The rule the head set on 14 Oct 2026. Exercised against the real module with the permission and the
     stored day swapped underneath it, so these are not source greps — askDismissed() is what Home calls to
     decide whether the card appears at all. */
  const load = async () => {
    const m = await import('../src/lib/pushask.js?t=' + Math.random());
    return m;
  };
  const setPerm = (p) => { globalThis.Notification = { permission: p }; };
  const store = {};
  beforeAll(() => {
    globalThis.localStorage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    };
  });
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

  it('undecided and never dismissed: the card shows', async () => {
    setPerm('default');
    const { askDismissed } = await load();
    expect(askDismissed()).toBe(false);
  });

  it('allowed: never asked again', async () => {
    setPerm('granted');
    const { askDismissed } = await load();
    expect(askDismissed()).toBe(true);
  });

  it('blocked: never asked again — the browser would show nothing anyway', async () => {
    setPerm('denied');
    const { askDismissed } = await load();
    expect(askDismissed()).toBe(true);
  });

  it('switched off in Account: never asked again, that is a choice not a "not now"', async () => {
    setPerm('default');
    store['sr.reminderOff'] = '1';
    const { askDismissed } = await load();
    expect(askDismissed()).toBe(true);
  });

  it('closed today: gone for the rest of today', async () => {
    setPerm('default');
    const { askDismissed, dismissAsk } = await load();
    dismissAsk();
    expect(askDismissed()).toBe(true);
  });

  it('…and offered again tomorrow', async () => {
    setPerm('default');
    const { askDismissed, dismissAsk } = await load();
    dismissAsk();
    // the same dismissal, read on the next day
    store['sr.reminderAskDay'] = new Date(Date.now() - 864e5).toDateString();
    expect(askDismissed()).toBe(false);
  });

  it('a week-long hide is gone: yesterday no longer silences it', async () => {
    setPerm('default');
    const { askDismissed } = await load();
    store['sr.reminderAskAt'] = String(Date.now() - 2 * 864e5);   // the old 7-day timer
    store['sr.reminderAskDay'] = new Date(Date.now() - 2 * 864e5).toDateString();
    expect(askDismissed()).toBe(false);
  });
});

describe('the same rule in the installed app, not only the browser tab', () => {
  /* The store builds are a TWA on Android and a WKWebView shell on iOS (docs §12). Neither changes this:
     the decision is read from Notification.permission, which the shell shares with the page, so "allowed
     once, never asked again" holds whether the app was opened from a link or from the home screen. These
     guard against a future shortcut that keys the behaviour off display-mode instead of the permission. */
  const pushSrc = readFileSync(new URL('../src/lib/push.js', import.meta.url), 'utf8');
  const askSrc = readFileSync(new URL('../src/lib/pushask.js', import.meta.url), 'utf8');

  it('the decision comes from the permission, never from how the app was opened', () => {
    const fn = /export const askDismissed[\s\S]*?\n\};/.exec(askSrc)[0];
    expect(fn).toMatch(/Notification\.permission/);
    // display-mode / standalone must not decide whether to ask: that would differ between the tab and the shell
    expect(fn).not.toMatch(/standalone|display-mode/);
  });

  it('iPhone still gets told to install first, because web push needs it there', () => {
    // iOS only delivers web push to a home-screen app, so the card says so rather than asking for nothing
    expect(pushSrc).toMatch(/ios-install/);
    expect(pushSrc).toMatch(/iosNeedsInstall/);
  });

  it('and a blocked permission reads as blocked in every shell', () => {
    expect(pushSrc).toMatch(/Notification\.permission === 'denied'/);
  });
});
