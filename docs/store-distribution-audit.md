# One web app, four ways in: browser, PWA, Play Store, App Store

**Audit, 5 October 2026.** Read-only: nothing was changed or deployed.

The source examined was the live tree `sadhanaRecord/` (Phase 6 live: version 9b625673, `index-NfyH9c20.js`).

**Update, 5 Oct 08:36 IST:** Phase 7, which includes the Phase 1 work, is now live (version af2ac632, `index-B3SVPkgc.js`, build 2026.10.05-0835). It doesn't touch the five blockers. Re-checked live after it: the Phase 6 entry `index-NfyH9c20.js` now returns **200 `text/html`, immutable**, and `/version.json` doesn't exist (it returns the HTML page).

## Summary

**The architecture you want is viable for this app.** It is one Svelte web app on one domain:
- the Play Store app is a Trusted Web Activity (TWA) around it;
- the App Store app is a small WKWebView shell around it.

A normal web deploy then reaches the browser, the installed PWA, the Android app and the iOS app, with no store release.

Five things stand in the way today. None of them is a reason to change the plan.

1. **Old pages can't load their screens after a deploy.**
   - Cloudflare keeps only the newest build's files.
   - A missing `/assets/*.js` is answered with **200 `text/html`**, the app page itself, marked `immutable, max-age=31536000`.
   - Verified live: `/assets/index-DEPfFmGP.js`, the Phase 5 entry, now returns HTML. After Phase 7 went live, the same holds for the Phase 6 entry `index-NfyH9c20.js`.
   - So a phone still running the previous version can't open any screen file it hasn't cached. This is the old "Could not load this screen" failure.
   - It matters more once store apps keep sessions open for days.
2. **No own domain.**
   - The app lives on `sadhana-record.iyfdelhi-sadhana.workers.dev`.
   - A store app is tied to its domain: the Android Digital Asset Links, iOS Universal Links and iOS app-bound domains are all per-domain.
   - Moving domains later means a store release for both apps, and every person signs in again, because storage is per origin.
3. **No self-service account deletion.**
   - Both stores require it when an app lets people sign up: Apple guideline 5.1.1(v); Google Play's account deletion policy needs both an in-app path and a web link.
   - Today only a coordinator can delete an account.
4. **iOS push needs a native part.**
   - Web Push on iPhone works only for a Home Screen web app opened from Safari, not inside an App Store app's WKWebView.
   - The iOS app therefore needs Apple Push (APNs), plus a small server change to send it. This is a one-time store release.
5. **No way to read the running version.**
   - The build id (e.g. `2026.10.05-0424`) is compiled into the JS and logged with every API call.
   - Nothing exposes it, so there is no reliable way to prove which web release a store app runs.

## 1. What exists today

| Part | Today |
|---|---|
| App | Svelte 5 + Vite 8. Hash routes (`/#/week`, `/#/hearing`), so every page is the one document `/`. |
| Hosting | Cloudflare Worker `sadhana-record`, static assets from `dist/`, `not_found_handling: single-page-application` (`frontend/wrangler.jsonc`) |
| API | a separate Worker, `sadhana-record-api…workers.dev`, + D1. CORS allow-list by `Origin` (`ALLOWED_ORIGINS`). |
| File names | content-hashed (`assets/index-NfyH9c20.js`); `_headers` gives `/assets/*` `max-age=31536000, immutable` |
| Always re-checked | `/`, `/index.html`, `/sw.js`, `/push-sw.js`, `/workbox-*.js`, `/manifest.webmanifest`: `no-cache` |
| Service worker | vite-plugin-pwa (Workbox) `generateSW`. Precache = every hashed file except the `staff-*` screens and the icons; `navigateFallback: /index.html`; `cleanupOutdatedCaches`; `importScripts: push-sw.js` |
| Staff screens | not precached; a runtime `CacheFirst` cache `staff-chunks` (20 files) |
| Update policy | `skipWaiting: true` + `clientsClaim: true`. `src/lib/sw.js` reloads the page once on `controllerchange`. It checks for a new version on load, every hour and whenever the app comes back on screen. **The reload waits while a day has unsaved changes** (`busy()`). |
| Sign-in | token in `localStorage` (`sr.token`), sent in the request body (no cookies); the last user kept in `localStorage` (Phase 1) |
| On-phone data | IndexedDB `sr` / store `kv`: unsent day changes, journal lists, photos, announcement images, cached screens per login (Phase 1) |
| Push | Web Push (VAPID). An empty push → the service worker asks the API what to show (`push.message`). Opening a notification goes only to `/#/…` pages. |
| Version | `BUILD_ID` (IST date-time, `frontend/build-id.js`) → `__APP_BUILD__`. Sent as `app` on every API call and stored in `run_log.app_build`. The release gate finds it by scanning the JS. |
| Release | `npm run release`: tests, build, size, deploy, then proof that an open app moves to the new build and that every lazy screen loads; phase gate + live smoke. |

## 2. Is the update model safe?

Mostly yes, and better than the brief feared:

- **Content hashing and caching are right.**
  - Files that never change are cached forever.
  - The four files that decide the version (page, `sw.js`, `workbox-*.js`, manifest) are always re-checked with the server.
- **The precache is atomic.**
  - The service worker serves `index.html` and its JS/CSS from one precache revision set.
  - So old HTML with new JS, or new HTML with old JS, cannot come from the service worker.
- **`skipWaiting` + `clientsClaim` + reload is a deliberate choice, and it is right here.**
  - Without it, an open app kept running old code that asked for screen files that no longer exist (2 Oct 2026).
  - The reload waits for unsaved day changes, so in-progress work is not lost. Those changes are also kept in IndexedDB.
- **IndexedDB, the token and the saved user survive an update.**
  - They aren't in the service-worker caches, and `cleanupOutdatedCaches` only touches Workbox's precache.
  - Store `kv` has no schema version beyond `1`. If a future release changes the shape of a stored value, that release must still read the old shape. This is noted as a rule, not a defect.

**What is not safe (blocker 1).** There is a window between "the new build is deployed" and "this page reloaded onto it":
- a page still runs the old code: unsaved changes, a slow `reg.update()`, a phone offline when the deploy happened, or a second tab;
- that page then opens a screen it hasn't stored (any `staff-*` screen, or anything after `cleanupOutdatedCaches` ran);
- the request goes to Cloudflare, which no longer has the file and answers with the HTML page;
- `nosniff` stops it from running, so the import fails and the person sees "Could not load this screen";
- the browser also caches that HTML under the JS name for a year. That doesn't affect new versions (their names differ), but it never heals the old one.

**Many tabs or windows.** `clientsClaim` + `controllerchange` reloads every open tab, so they don't stay on different versions. The exception is a tab with unsaved changes, which waits and is affected by the window above.

## 3. Every cache, and what can go stale

| Layer | Stale risk | Verdict |
|---|---|---|
| Browser HTTP cache | `no-cache` on the page and the service-worker files; hashed files immutable | OK, except for the wrong HTML cached under missing JS names (blocker 1) |
| Service-worker precache | one revision set; replaced together | OK |
| Runtime `staff-chunks` (CacheFirst) | a 200 HTML answer for a missing file would be stored as that file | Same root cause as blocker 1 |
| Cloudflare edge | static assets follow each deploy; no custom cache rules | OK |
| IndexedDB / localStorage | data, not code | OK; keep reads backward-compatible |
| API | not cached by the service worker; the app's own cache is per login | OK |

## 4. Android: Trusted Web Activity

- **Recommended: a TWA built with Bubblewrap.**
  - The Play app is a small Android package that opens the production origin in Chrome, full screen.
  - It's the same Chrome, with the same service worker, cache, IndexedDB and push, and identical update behaviour to the installed PWA.
  - There is no Kotlin app logic.
- **Required:**
  - an own domain;
  - `/.well-known/assetlinks.json` on it, listing the Play App Signing certificate SHA-256 (otherwise Chrome shows a URL bar);
  - the manifest gets `id: "/"`.
- **Push:** web push works in a TWA. Android 13+ asks for the notification permission through the TWA's notification delegation, so no native push is needed.
- **When there is no Chrome on the phone:** the TWA falls back to another browser that supports it, or to a Custom Tab. Very rare in India; acceptable.

## 5. iOS: a minimal WKWebView shell

- **Recommended: a native Swift app of about 200 lines.**
  - It holds one `WKWebView` pointed at the production origin. All screens and logic stay web.
- **The service worker inside WKWebView:**
  - it works only for **app-bound domains** (`WKAppBoundDomains` in Info.plist, iOS 14+);
  - without them the app has no offline copy and every launch re-downloads the page;
  - so the app domain must be listed. App-bound mode also forbids injected scripts, which suits a thin shell.
- **Navigation:**
  - only the app's own domain loads inside the shell;
  - every other link (Google Drive lectures and books, WhatsApp, `tel:`, `mailto:`) opens in Safari or the system handler;
  - this is the same rule the web app already follows with `target=_blank`.
- **Push:** APNs in Swift, plus one new server path that sends APNs. The server already decides *when* and *what*; the iOS app just receives it. The message wording and timing stay server-side.
- **App Review (guideline 4.2, minimum functionality):** a bare website wrapper is a real rejection risk. What lowers it, all things the app does anyway or needs anyway:
  - native push;
  - offline launch (app-bound service worker);
  - the native share sheet for "Share today";
  - account deletion inside the app (5.1.1(v));
  - a privacy policy;
  - a sign-in demo account for the reviewer.
- **Rule:** the shell must not hide that it's web, and must not be used to change native behaviour after review.
- **Login:** the token stays in the WKWebView's `localStorage` (a persistent data store). The API's CORS sees the real `https://` origin, because the shell loads the remote URL, not a local file.
- **Safe areas:** already handled in CSS (`env(safe-area-inset-*)`); the shell sets `contentInsetAdjustmentBehavior = .never`.

## 6. What needs a store release

| Change | Web deploy | Android (Play) | iOS (App Store) |
|---|:-:|:-:|:-:|
| Svelte screens, UI/UX, CSS, Tailwind | Yes | No | No |
| Hash routes, new screens, client logic | Yes | No | No |
| Sadhana / Hearing / Reading features | Yes | No | No |
| API Worker, D1, Sheets copy | Yes (API deploy) | No | No |
| Service worker, caching, offline behaviour | Yes | No | No (app-bound domain) |
| Push wording, timing, who gets what | Yes (server) | No | No |
| Web manifest name, colours, PWA icons | Yes | Only if the shell's own name/icon/colour should change too | Only for the shell's own icon/name |
| App icon / store listing / splash in the package | No | Yes | Yes |
| Native push (APNs) the first time | Server part | No (web push) | **Yes** |
| A native capability (camera API beyond `<input type=file>`, biometrics, widgets) | No | Yes | Yes |
| Domain change | Yes | **Yes** (new assetlinks/host) | **Yes** (app-bound domains, Universal Links) |
| A new domain opened *inside* the app | No | Yes (TWA scope) | Yes (app-bound list) |
| Deep-link paths | No (hash routes all live under `/`) | No | No (AASA path `/*` is on the web server) |
| Android/iOS SDK, target API level, privacy manifest | No | Yes | Yes |

## 7. Latency

There is no extra hop: device → the phone's web engine → Cloudflare → Worker → D1, the same as the browser. Startup adds only the shell's own launch, and none of it adds bytes to the web app:

| | Cold start, extra | Warm start | Network |
|---|---|---|---|
| Installed PWA | — | — | same |
| Android TWA | ≈ 100–300 ms (app process, then Chrome) | ≈ 0 | same Chrome cache and service worker |
| iOS WKWebView | ≈ 200–400 ms (WebContent process) | ≈ 0 | same, if app-bound (else no offline copy) |

**These numbers are typical published ranges, not measured on this app. Don't plan around them.** Measure cold and warm start for each shell on the emulator/simulator and on at least one real low-end Android phone and one real iPhone, as part of the §10 test. Size budgets are unaffected; the timing budgets (FCP 1.8 s, LCP 2.0 s) were over on the night of 5 Oct for both the Phase 5 and Phase 6 builds, so re-measure.

## 8. Push, deep links, security

- **Push:**
  - Web push works in the browser, Android installed PWA, Android TWA, and an iPhone Home Screen PWA (iOS 16.4+).
  - It does not work in an iOS App Store WKWebView, which needs APNs.
- **Deep links:**
  - Links are `https://domain/#/week`. Android App Links and iOS Universal Links match the host and path `/`, and the `#/week` fragment passes through untouched.
  - Notifications already open only `/#/…` pages.
  - If you want path links (`/week`) later, that is a web-only router change plus the SPA fallback for navigations only.
- **Security:**
  - The shells add no proxy and no injected scripts.
  - Same-origin only inside the shell; external links leave the app.
  - The CSP (`script-src 'self'`, `frame-ancestors 'none'`) stays as it is.
  - Sign-out already clears the token and the saved user (Phase 1).
  - There are no cookies or OAuth redirects to handle.

## 9. The changes needed (none made yet)

**Web, no store involved. Small, and best done by the session that owns `frontend/`:**
1. **Keep the previous release's files.** `scripts/release.mjs` copies the live `dist/assets` into the new build before deploying. These files are hashed, so this is harmless, about +1 MB per deploy. Old pages then load their screens until they reload.
2. **No HTML for missing JS.**
   - Routes are hash routes, so the page fallback isn't needed for `/assets/*`.
   - Set `not_found_handling` so that `/assets/*` answers 404, not 200 HTML. Either `"none"`, since every navigation is `/` anyway, or `run_worker_first` for `/assets/*`.
   - Check that a 404 isn't given the immutable header.
3. **Version you can read.**
   - The build writes `/version.json` (`no-cache`): `{ build, source, builtAt }`.
   - `index.html` gets `<meta name="app-build">`.
   - The API's `GET` already returns `v`; add its deploy id.
   - Account › About shows "App 2026.10.05-0424".
4. **Manifest and site files.**
   - The manifest gets `"id": "/"`.
   - Add `public/.well-known/assetlinks.json` and `apple-app-site-association`, served as `application/json` via `_headers`.
5. **Account deletion.**
   - Devotees: Account › Delete my account. A confirm sheet, then a server action that removes or anonymises the person, logged.
   - A public web page explaining how to delete, for Google Play.
   - What happens to past weeks in Sheets is an IYF decision (keep anonymised, or delete).

**New, outside the web app:**
6. Android: a Bubblewrap TWA project (`stores/android/`), package `org.iyfdelhi.sadhana` (example), Play App Signing.
7. iOS: an Xcode project (`stores/ios/`) with WKWebView, app-bound domains, the external-link rule, APNs, share sheet and Universal Links.
8. Server: send APNs for iOS devices next to web push. A new table `apns_devices`, copied to Sheets like every table.

## 10. Proving it: the N → N+1 → N+2 test

This was **not run.** It needs builds and deploys:
- it should run after the §9 fixes 1–3, which aren't built yet;
- the shells don't exist yet.

To prove it without touching production:

1. **A test copy of the app.**
   - Deploy it as a second Worker, e.g. `sadhana-record-test`, on its own test domain, with the same code.
   - Point the TWA and iOS test builds at it.
2. **Version N.**
   - Install the Android test package on the emulator (Android SDK is on this Mac in `tools/devices/`), and the iOS shell on the iOS 27 simulator (Xcode 27).
   - Install the PWA in Chrome and Safari, and open the browser.
   - On each, read `/version.json` and the page's `app-build`: over adb + the Chrome DevTools Protocol for Android; through the shell's Web Inspector, or a console line the shell logs, for iOS.
3. **N+1:** a web-only change (the version label). Deploy the web only; don't rebuild either app. Relaunch everything: cold, warm, offline then online. Every surface must report N+1. Repeat with the app left open, and with a day's unsaved change open (the reload must wait, then happen).
4. **N+2:** the same again, after one surface stayed offline across the deploy (it must catch up when it reconnects).
5. **The store boundary, shown:**
   - change the iOS app icon, or add APNs;
   - only a new app build shows it;
   - a web deploy does not.

The test passes only if all four surfaces report N+1 and N+2 from the server-side `version.json`, not from screenshots, **and neither store package was rebuilt between N and N+2.**

**This is a requirement, not an assumption.** The web part (browser + PWA, N → N+1 → N+2, after the §9 fixes 1–3) is the exit requirement for the next web release, now that Phase 7 is live. Each shell must pass the same test before it is submitted. Until then, "a web deploy updates the store apps" is a design claim, not a proven fact.

## 11. Decisions for IYF before any build

1. **Domain:** buy one, e.g. `sadhana.iyfdelhi.org` or similar. Every store step depends on it.
2. **Developer accounts:**
   - Google Play: US$25 once, in IYF's name;
   - Apple Developer Program: US$99 a year, which needs an organisation D-U-N-S number for an organisation account.
3. **Account deletion:** what happens to the person's past records in the dashboard sheets.
4. **Approval** to make the web changes in §9 (1–4) in the next release after Phase 7, and to run §10 on a test Worker.

## 12. Agreed order (after review, 5 Oct 2026)

No store project starts until the web update mechanism is fixed and proven.

1. Finish Phase 7 web hardening (done: live 5 Oct 08:36 IST).
2. Fix deployment and versioning (§9 items 1–4): keep the previous release's assets, 404 for missing `/assets/*`, `/version.json`, manifest `id` (done: live as phase 8, 5 Oct 11:41 IST, build 2026.10.05-1140; the two previous releases' files are kept, see `frontend/scripts/carry-assets.mjs`; `assetlinks.json` and `apple-app-site-association` wait for the package IDs and the final domain).
3. Decide the permanent production domain, then buy it and move the app to it. Don't buy a domain or start a store submission before the decision is final: a later change means two store releases and everyone signing in again.
4. Prove web + PWA N → N+1 → N+2 (§10), on a test Worker.
5. Build the Android TWA.
6. Prove Android N → N+1 → N+2 without rebuilding the Android package.
7. Build the iOS shell + APNs.
8. Prove iOS N → N+1 → N+2 without rebuilding the iOS app.
9. Submit to the stores.
10. From then on, web feature releases are web deploys only. A store release is needed only for the rows marked so in §6 (native features, icons and listing, SDK levels, domain).

**Two things to run alongside this order, not after it:**
- **Account deletion (§9 item 5)** is required by both stores. It needs IYF's decision on past records and is web work, so build it between steps 2 and 5. Otherwise it blocks step 9.
- **Developer accounts.** Apple's organisation account needs a D-U-N-S number, which can take weeks. Start it around step 3 so it doesn't hold up step 7.
