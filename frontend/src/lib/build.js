// Which build is running, e.g. 2026.10.27-0706 (sent with every call as `app`, shown in Account and the problem report).
// Read from the page (<meta name="app-build">, written by vite.config.js), not compiled into the code (27 Oct 2026):
// compiled in, it changed the shared start-up file on every build, which renamed every screen that imports it, so
// each release made every phone download ~80 files again (Cloudflare logs, 16–26 Oct). The tests still define it.
export const APP_BUILD = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__
  : (typeof document !== 'undefined' && document.querySelector('meta[name="app-build"]')?.content) || 'dev';
