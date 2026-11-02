// The name a session is listed under in Account › Devices (the head, 18 Oct 2026).
//
// Sign-in used to send only "Android" or "Browser", so a person with three Android sessions could not tell their own
// phone from the others, and a Mac read as "Browser". This names the system and how the app is open — the installed
// app, or which browser — which is what someone recognises. It is a label, not an identifier: nothing here is unique
// to the device, and nothing is fingerprinted.
export function deviceLabel(nav = typeof navigator === 'undefined' ? null : navigator, win = typeof window === 'undefined' ? null : window) {
  const ua = String(nav?.userAgent || '');
  const os = /Android/i.test(ua) ? 'Android'
    : /iPad|Macintosh.*Mobile/i.test(ua) ? 'iPad'
    : /iPhone|iPod/i.test(ua) ? 'iPhone'
    : /CrOS/i.test(ua) ? 'Chromebook'
    : /Macintosh|Mac OS X/i.test(ua) ? 'Mac'
    : /Windows/i.test(ua) ? 'Windows'
    : /Linux/i.test(ua) ? 'Linux' : 'Device';
  // opened as the installed app (home-screen PWA, or the Play Store app, which runs as a trusted web activity)
  const installed = !!(win?.matchMedia?.('(display-mode: standalone)')?.matches || nav?.standalone
    || String(win?.document?.referrer || '').startsWith('android-app://'));
  if (installed) return `${os} · installed app`;
  const browser = /EdgA?\//.test(ua) ? 'Edge'
    : /SamsungBrowser\//.test(ua) ? 'Samsung Internet'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox'
    : /CriOS\/|Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : 'browser';
  return `${os} · ${browser}`;
}
