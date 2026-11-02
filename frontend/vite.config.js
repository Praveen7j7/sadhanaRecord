import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { BUILD_ID } from './build-id.js';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// The scoring shared with the server (../shared): the app shows exactly the marks the server will give.
const SHARED = fileURLToPath(new URL('../shared', import.meta.url));


// Lazy chunks (coordinator / master / mock) must never be pre-downloaded by devotees' phones.
// the JS of a staff chunk and the CSS Vite emits beside it (audit FE-15: the CSS kept its own name and was precached)
const LAZY = 'assets/staff-*.{js,css}';

// Which emitted files are staff-only (see the output options below for why this is by folder, not by name).
// `ui/` holds the design system, which devotees need — except these three, which only staff screens open.
const STAFF_UI = ['WeekRead', 'ExportButton', 'ExportSheet'];
const STAFF_SOURCE = new RegExp(`/(coord|master|fac)/|/mock\\.js$|/ui/(${STAFF_UI.join('|')})\\.svelte$`);
// the asset side sees only a base name, so every staff screen's file name comes from the folders themselves
const staffNames = () => {
  const names = [...STAFF_UI];
  for (const d of ['coord', 'master', 'fac']) {
    try {
      for (const f of readdirSync(new URL(`./src/${d}/`, import.meta.url))) {
        if (/\.(svelte|js)$/.test(f)) names.push(f.replace(/\.(svelte|js)$/, ''));
      }
    } catch { /* a folder that does not exist yet */ }
  }
  return names;
};
const STAFF_NAMES = new RegExp(`^(${staffNames().join('|')})[-.]`);

/*
 * Which modules a DEVOTEE's phone can reach (22 Oct 2026, G13/G17 of the wiring audit): every module reachable from the
 * entry without opening a staff screen. Computed from the import graph when the build ends, so a chunk with no single
 * source (code shared by several screens) is judged by what is IN it, not by its name:
 *   · a chunk none of whose modules a devotee can reach is staff-only → `staff-`, out of the precache. That caught
 *     lib/csv.js and shared/exportfields.js, which only the export sheet and IYF IDs open but every phone installed.
 *   · a chunk a devotee can reach is never `staff-`. lib/staff.js is imported by My group and the week picker, and its
 *     chunk was emitted as `staff-<hash>.js` just because it is NAMED staff — so it was left out of the precache and
 *     My group failed to open offline right after a release.
 */
let devoteeReach = null, known = null, startup = null;
// a screen, or the signed-in shell: the files whose names change with almost every release
const SCREEN = /\/src\/(screens|devotee|coord|master|fac)\/|\/src\/SignedIn\.svelte$/;
const reach = () => ({
  name: 'devotee-reach',
  buildEnd() {
    const seen = new Set(), todo = [...this.getModuleIds()].filter((id) => this.getModuleInfo(id)?.isEntry);
    while (todo.length) {
      const id = todo.pop();
      if (seen.has(id) || STAFF_SOURCE.test(id)) continue;      // a staff screen: what only it opens is staff-only
      seen.add(id);
      const m = this.getModuleInfo(id);
      if (m) todo.push(...m.importedIds, ...m.dynamicallyImportedIds);
    }
    devoteeReach = seen;
    // The start-up code a phone loads anyway (the entry's STATIC imports), as its own `app` file (27 Oct 2026). In the
    // entry it shared a file with the screen list, which names every screen file by its hash: change one screen and the
    // entry was renamed, and with it every file that imports a helper from it — one changed word renamed 78 of 174
    // files, so each release made every phone download most of the app again (Cloudflare logs, 16–26 Oct: the error
    // message file had 15 names in 10 days). The entry keeps only the modules that lead to a screen's import(), so a
    // screen change now renames that screen, the entry and the few files that link to it (5 files). See manualChunks.
    const st = new Set(), q = [...this.getModuleIds()].filter((id) => this.getModuleInfo(id)?.isEntry);
    while (q.length) { const id = q.pop(); if (st.has(id)) continue; st.add(id); q.push(...(this.getModuleInfo(id)?.importedIds || [])); }
    const toScreens = new Set(), up = [...st].filter((id) => this.getModuleInfo(id)?.dynamicallyImportedIds.some((d) => SCREEN.test(d)));
    while (up.length) { const id = up.pop(); if (toScreens.has(id) || !st.has(id)) continue; toScreens.add(id); up.push(...(this.getModuleInfo(id)?.importers || [])); }
    startup = new Set([...st].filter((id) => !toScreens.has(id) && !this.getModuleInfo(id)?.isEntry));
    known = new Set(this.getModuleIds());
  },
});
const staffChunk = (c) => {
  if (STAFF_SOURCE.test(c.facadeModuleId || '')) return true;
  // staff only when EVERY module in it is a known one no devotee reaches. A module outside the graph (the bundler's own
  // runtime helper, a virtual module) proves nothing, so it keeps the chunk a devotee one — the safe side: a staff file
  // precached costs bytes, a devotee file left out breaks a screen offline.
  if (devoteeReach && c.moduleIds?.length) return c.moduleIds.every((id) => known.has(id) && !devoteeReach.has(id));
  return STAFF_NAMES.test(`${c.name || ''}-`);                  // no graph (never in a build): the name lists, as before
};

// Which build is running, readable from outside (the store apps, the release checks): /version.json (never cached,
// never in the offline copy) and <meta name="app-build"> in the page. `index` is this build's start file.
const version = () => ({
  name: 'app-version',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'app-build', content: BUILD_ID }, injectTo: 'head' }],
  generateBundle(_, bundle) {
    const index = Object.values(bundle).find(f => f.type === 'chunk' && f.isEntry)?.fileName || '';
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID, index, builtAt: new Date().toISOString() }) + '\n' });
  },
});

// The songs' data files get an address that changes with their content (Phase 24, U1): a phone kept yesterday's
// /songs/en.json for a day (max-age + the service worker's stale-while-revalidate), and the new screen drew nothing from
// its old shape. Each file's own hash, so only the screen that reads songs changes when a song file does.
const songsV = () => {
  const out = {}, dir = new URL('./public/songs/', import.meta.url);
  const h = (u) => createHash('sha1').update(readFileSync(u)).digest('hex').slice(0, 10);
  try { out.en = h(new URL('en.json', dir)); } catch { /* no song book */ }
  try { for (const f of readdirSync(new URL('books/', dir))) if (f.endsWith('.json')) out[f.slice(0, -5)] = h(new URL('books/' + f, dir)); } catch { /* no added books */ }
  return out;
};

export default defineConfig({
  define: { __SONGS_V__: JSON.stringify(songsV()) },
  // no __APP_BUILD__ here (27 Oct 2026): the code reads the build from the page's <meta name="app-build"> (lib/build.js),
  // so a release with no code change renames no file
  plugins: [svelte(), tailwindcss(), version(), reach(), VitePWA({
    includeManifestIcons: false,         // the home-screen icons are fetched by the phone at install, not kept offline
    registerType: 'autoUpdate',
    injectRegister: false,    // registered in src/lib/sw.js (reloads once when a new version takes over); no inline script, CSP stays strict
    manifest: {
      // the app's identity for browsers and the Play Store app (Trusted Web Activity); same as start_url, so phones
      // that installed it before keep the same app
      id: '/',
      name: 'IYF Delhi Sadhana Record',
      short_name: 'Sadhana',
      description: 'Every Day, A Step Closer to Kṛṣṇa. Track your spiritual practices, build consistency and grow in bhakti.',
      // the installed app's launch screen matches the splash in index.html
      theme_color: '#002888',
      background_color: '#002888',
      display: 'standalone',
      start_url: '/',
      scope: '/',
      // Phase 7: long-press the app icon (Android) for these
      shortcuts: [
        { name: 'Fill today', short_name: 'Today', url: '/#/home', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        { name: 'This week', short_name: 'Week', url: '/#/week', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        { name: 'My report', short_name: 'Report', url: '/#/report', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      ],
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // a new version takes over at once (no waiting for every tab to close); src/lib/sw.js then reloads the open page
      skipWaiting: true,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
      // webp: the IYF emblem (splash, sign-in, menu) must show offline too
      globPatterns: ['**/*.{js,css,html,svg,png,webp,webmanifest}'],
      // the 9 PM reminder: shows the notification for the server's empty push (public/push-sw.js, not hashed)
      importScripts: ['push-sw.js'],
      // Phase 1: the install keeps only what the screens need offline. The home-screen and tab icons (the phone fetches
      // those itself when it installs the app) and the 512 px emblem (no screen shows it that large) stay out: ~600 KB less.
      // the public account-deletion page (and its styles) is for people outside the app: never in the offline copy
      globIgnores: [LAZY, 'icons/**', 'brand/*.png', 'brand/og-image.jpg', 'brand/iyf-emblem-512.webp', '404.html', 'delete-account.html', 'privacy.html', 'legal.css',
        // the darshan paintings (8 Oct 2026): never in the install; one a day is fetched when a screen shows it, then kept
        'darshan/**'],
      navigateFallback: '/index.html',
      // …and an installed app opening it (Account › What happens to my data) gets the real page from the server, not the app
      // …and a song book opened from Vaishnava Songs (phase 21): a PDF opened in a tab is a navigation too, and the
      // installed app answered it with itself, landing on Home (the head, 23 Oct 2026). Every non-app page is listed here.
      navigateFallbackDenylist: [/^\/delete-account/, /^\/privacy/, /^\/404/, /^\/songs\//],
      runtimeCaching: [
        {
          // today's darshan (and the list of paintings): kept after the first view, at most 8 files, for 30 days
          urlPattern: ({ url }) => url.pathname.startsWith('/darshan/'),
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'darshan', expiration: { maxEntries: 8, maxAgeSeconds: 30 * 86400 }, cacheableResponse: { statuses: [200] } },
        },
        {
          // Vaishnava Songs (phase 21): the song book's data, kept after the first open so it works offline; the PDFs
          // (1.3 and 2.2 MB) are never kept by the app — the phone's own download keeps them. Phase 22 (split by book): the
          // list (en.json) and each added book's texts (books/<book>.json, fetched when one of its songs opens), never precached
          urlPattern: ({ url }) => /^\/songs\/(en|books\/[a-z-]+)\.json$/.test(url.pathname),
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'songs', expiration: { maxEntries: 12 }, cacheableResponse: { statuses: [200] } },
        },
        {
          urlPattern: ({ url }) => /\/assets\/staff-.*\.js$/.test(url.pathname),
          handler: 'CacheFirst',
          // only a real file is kept: a 404 for a file a newer release no longer has is never stored as that file
          options: { cacheName: 'staff-chunks', expiration: { maxEntries: 20 }, cacheableResponse: { statuses: [200] } },
        },
      ],
    },
  })],
  resolve: { alias: { $shared: SHARED } },
  server: { fs: { allow: ['.', SHARED] } },
  build: {
    target: 'es2020',
    // the first page carries only the shared styles; screens that load on demand bring their own (src/styles/screens.css)
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // A devotee's phone must never pre-download coordinator or master code. Anything whose name starts
        // "staff-" is excluded from the service-worker precache (globIgnores above) and fetched on first use
        // instead, so the question here is only: which emitted files are staff-only?
        //
        // Derived from the SOURCE FOLDER rather than from a list of names (13 Oct 2026, audit FE-15): everything
        // in coord/, master/ and fac/ is staff-only by definition, plus the dev-only mock, plus three files that
        // live in ui/ but are opened from staff screens alone. The earlier fix listed names by hand in two places
        // and missed five files — Requests.css, HeadHome.css, DevoteeDetail.css, Reopens.js and ExportButton.js,
        // 33.8 KB that every devotee still downloaded at install. A list that has to be extended per screen is
        // the wrong shape for this; a folder test covers the next screen for free.
        //
        // CSS and facade-less chunks are named by assetFileNames, not chunkFileNames, so BOTH need the test —
        // that asymmetry is what let the stylesheets through last time. STAFF_NAMES carries the base names for
        // the asset side, where the source path is not available.
        // A chunk imported by TWO staff screens is emitted without a facadeModuleId (Reopens, used by both
        // Requests and Admin; ExportButton, by both Batch and Admin), so the folder test cannot see where it came
        // from. Fall back to its name for exactly that case — the same list the asset side uses.
        // …and since 22 Oct the import graph decides it for every chunk (devoteeReach above). A devotee chunk whose own
        // name begins "staff" (lib/staff.js) is given a `lib-` prefix so the precache's `staff-*` rule cannot catch it.
        // the start-up code without the screen list (reach() above); nothing in it names a screen file
        manualChunks: (id) => (startup?.has(id) ? 'app' : undefined),
        chunkFileNames: (c) => (staffChunk(c) ? 'assets/staff-[name]-[hash].js'
          : /^staff/i.test(c.name || '') ? 'assets/lib-[name]-[hash].js' : 'assets/[name]-[hash].js'),
        assetFileNames: (a) => {
          const base = String((a.names?.[0] || a.name || '')).split('/').pop() || '';
          return STAFF_NAMES.test(base) ? 'assets/staff-[name]-[hash][extname]' : 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});