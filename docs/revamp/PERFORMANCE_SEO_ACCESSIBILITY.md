# Sadhana Record — Performance, SEO and Accessibility Contract

**IYF Delhi · part of the revamp document set · 8 October 2026**

**What this document is:**
- the contract every visual or interaction change must pass;
- if a change breaks it, the change is cut or reworked;
- the release gate (`tools/release/gate.mjs`) enforces the measurable parts.

**Order of priority:** Functionality > Usability > Performance > Visual polish > Decorative effects.

---

## 1. Baseline (measured, 7–8 Oct 2026)

| Measure | Today | Source |
|---|---|---|
| Lighthouse desktop (sign-in page) | Performance **99**, Accessibility 100, Best practices 100, SEO 100 | IYF's own run |
| Lighthouse mobile (sign-in page) | **97 / 97** here (FCP 1.9–2.0 s, LCP 2.1–2.3 s, TBT 0, CLS 0); **78** in IYF's run (DevTools with extensions; rerun in Incognito) | `npx lighthouse` twice |
| LCP breakdown (mobile) | TTFB ~450 ms + **render delay 1.65–1.87 s**. The render-blocking startup CSS costs 0.33–0.60 s; the splash is held ≥ 1.4 s | Lighthouse |
| Startup JS / CSS (gzip) | **55.06 KB** (target 55, hard 60) / **13.58 KB** (target 13.5, hard 15) | `npm run size` |
| Largest lazy chunk | 27.65 KB (Devotee) (target 30, hard 35) | `npm run size` |
| Precache | ≈ 530 KB | Workbox |
| Browser checks | 1,665 + 219 component checks, 0 failed | release gate |
| Route sweep | 10 personas × 132 routes × 4 views = 528 screenshots: no errors, no sideways scroll | sweep, 7 Oct |

---

## 2. Performance contract

### 2.1 Targets (every release)

| Metric | Target | Hard limit | How measured |
|---|---|---|---|
| Lighthouse Performance, mobile (Incognito, 3 runs, median) | **≥ 95** | 90 | Lighthouse CLI on Welcome, Login, Home (signed in, mock) |
| Lighthouse Performance, desktop | ≥ 98 | 95 | same |
| LCP (mobile, slow 4G sim) | **≤ 2.0 s** | 2.5 s | Lighthouse |
| FCP (mobile) | ≤ 1.6 s | 1.8 s | Lighthouse |
| INP | ≤ 100 ms | 200 ms | Chrome on Android Low tier (manual) + web-vitals in dev |
| CLS | **0** | 0.05 | Lighthouse + browser checks (`__cls`) |
| TBT | ≤ 50 ms | 150 ms | Lighthouse |
| Repeat open (installed, signed in) | Home visible ≤ 1 s | 1.5 s | Device check |

### 2.2 Budgets

| Budget | Target | Hard | Rule |
|---|---|---|---|
| Startup JS (gzip) | **≤ 55 KB** | 60 KB | To add, first move something out |
| Startup CSS (gzip) | **≤ 12.5 KB after the split** | 15 KB | Split the welcome/sign-in styles into their own file (−~2.5 KB), then the design-system additions (+~1.5 KB) |
| Any lazy chunk | ≤ 30 KB | 35 KB | New features go into existing area chunks |
| Dynamic layer (motion, counters, swipe, live refresh) | +3 KB JS + 2 KB CSS total | — | All lazy |
| Fonts | **0 KB** | 0 | System fonts only |
| Icons | Inline SVG set, ≤ +1 KB for new icons | — | No icon fonts or libraries |
| Images per screen | ≤ 1 devotional image; **480w ≤ 45 KB**, 960w ≤ 120 KB | — | WebP + JPEG; lazy; never precached (only `darshan.json` ≈ 3 KB) |
| Images on the critical path | **none**, except the Welcome band (≤ 40 KB, sized, low priority) | — | The sign-in form is never blocked by an image |
| Third-party scripts | **0** | 0 | No analytics, fonts, CDNs |
| Precache | ≤ 700 KB | 800 KB | Staff chunks and images stay out |
| Network per screen | 1 API call per screen open (cached first) | — | Live refresh only on staff boards in the last 24 h before the deadline, every 60 s |

### 2.3 Cost of each visual feature

| Feature | Cost | Tier | Verdict |
|---|---|---|---|
| Design tokens, colour, type, spacing | LOW | All | Do |
| One-hero layouts, status block, needs-you, scope strip | LOW | All | Do |
| Press, hover and focus states | LOW | All | Do (exists) |
| View-transition page slide / shared elements | LOW (compositor) | High, Balanced | Do |
| CSS `linear()` spring easing | LOW | High, Balanced | Do |
| Count-up numbers, chart draw-ins | LOW (one-shot) | High, Balanced | Do |
| Scroll-driven title condense / hide-on-scroll bar | LOW (CSS, off main thread) | High (title), all (bar) | Do; ignored where unsupported |
| Glass on floating chrome | MEDIUM (blur) | High, Balanced | Keep (exists); **≤ 2 glass layers on screen** |
| Glass text panel over darshan | MEDIUM | High only | Do |
| Darshan image (Home, Welcome, sign-in desktop) | MEDIUM (network, decode) | High, Balanced | Do with the §2.2 limits |
| Live staff refresh + changed-row glow | LOW–MEDIUM (requests) | All | Only near the deadline |
| Parallax on the Welcome panel | MEDIUM | High, pointer only | Optional (P3) |
| Drifting Welcome gradient | MEDIUM (continuous paint) | High only | Optional (P3), pauses off-screen; needs sign-off |
| Blur behind data, full-page blur, animated backgrounds | HIGH | — | **Never** |
| WebGL / canvas / 3D | HIGH | — | **Never** |
| Chart, motion or UI libraries; web fonts | HIGH (bytes) | — | **Never** |

### 2.4 Adaptive strategy (exists; extended)

- **The rule:** functionality is identical in all three modes; only the visual complexity changes.
- **How a tier is chosen:**
  - automatically, from memory, cores, network, battery, Save-Data, reduced transparency and measured frame gaps;
  - smoothed: down after 3 s, up after 20 s;
  - no user choice; the "Look" choice was retired 4 Oct.

| Mode | Glass | Shadows | Motion | Imagery | Live refresh |
|---|---|---|---|---|---|
| High | 70% + 16 px blur | 3 levels | Full (shared elements, springs, count-ups, draw-ins, optional parallax) | Yes | Yes |
| Balanced | 84% + 8 px blur; top bar opaque | 2 levels | ×0.8, no parallax | Yes | Yes |
| Low (and Save-Data / reduced transparency) | Opaque | 1 level | Crossfades / instant; final states | **No images** (verse only) | Yes (less often under Save-Data) |

### 2.5 Specific fixes (from the measurements)

1. **Split the startup CSS:** sign-in and splash styles become a small first file; the rest loads straight after. This fits the CSP (no inline styles). Saves 0.3–0.6 s of render delay on mobile.
2. **Skip the 1.4 s splash for returning, signed-in users:** show the kept Home at once (it is already stored per login).
3. **Trim startup JS back under 55 KB** before any new startup code.
4. **Images:** explicit `width`/`height`, `decoding="async"`, `loading="lazy"`, `fetchpriority="low"` (Welcome band excepted). Never above the sign-in form on phones.
5. **Server:** add `unreadCount` to `home.get`, so the bell needs no extra call and always agrees; one shared week-summary query for Board, Stats and Overview (same definition, no duplicate work).

### 2.6 Server and API (audit; no rewrite)

**The current server is sound:**
- one action per screen;
- idempotent writes;
- per-request memo;
- incremental Sheets copies;
- cron batching;
- rate limits.

**Changes, only where the UX gains measurably:**

| Change | Why | Cost |
|---|---|---|
| `home.get` returns `unreadCount` (posts) | Fixes the bell disagreeing; removes a fallback | S |
| One week-summary definition (active members only) used by `devotees.list`, `stats.batch`, `stats.all` | The numbers agree on every screen | S |
| `fac.devotees` returns attention reasons (missed last week, not started by Sunday, Overall drop ≥ 15, late chanting ≥ 3 days) | "Needs you" without N extra calls | M |
| `requests.list` includes reopen requests (head) | One Requests inbox | S |
| Daily privacy-friendly counters (opened, filled, submitted, reminder tapped, sign-up step reached, browser/iOS version) | Product measurement; no third parties | S–M |
| A pending login's error adds the sign-up's first name, batch and facilitator (only after the password check) | A pending page that shows the person their own details, not a general sentence | S |
| `fac.devotees` / devotee detail add last week's Overall and a 12-week Overall series. **Loaded only on desktop and in the detail pane** (extra D1 reads on the free plan) | Sparklines and "Down 30 points" | M |
| Optional: coordinators see the IYF head's answer on reopen requests they raised | Closes the loop on reopens | S |
| Unchanged | Every API contract, every rule, every permission | — |

---

## 3. Accessibility contract (WCAG 2.2 AA)

### 3.1 Keep (exists)

- **Targets:** 44 px for controls.
- **Focus:** a visible `:focus-visible` ring; the skip link; focus moves to the page title on navigation, with the new title announced; focus returns after dialogs.
- **Dialogs:** native `<dialog>` sheets; Back and Esc close them.
- **Status:** a dot plus a word (never colour alone); the area named in words.
- **Feedback:** live regions for toasts and counts.
- **Contrast:** automated tests in both themes and every area.
- **Preferences:** reduced motion and reduced transparency.
- **Keyboard:** works in the wheels, tabs and steppers.

### 3.2 Fix and add

| # | Item | Where | Priority |
|---|---|---|---|
| A1 | 44 × 44 px minimum for: chart pager dots (7 px), verse carousel dots (~5 px), "Fill" link (19×32), name links (24 px), "View" (33×20), "Back to …" (17 px), `btn-sm` 36 px on touch | Report, Filling chart, WeekRead, Board, Leaders, DevoteeDetail, Fill pages | **P0** |
| A2 | Replace the paged bar carousel with horizontal meters (no hidden data behind tiny dots) | Report, WeekRead, ScoresView | P1 |
| A3 | "Show as table" for every chart; a text summary in `aria-label` (exists) | Charts | P1 |
| A4 | Focus the first invalid field on a failed Save/Submit; announce "3 answers need fixing" | Day, Week, forms | P1 |
| A5 | Honest states only ("Saved ✓" only after a save; attendance neutral before Sunday) | Day, Week | **P0** |
| A6 | Dimmed submitted rows → full contrast + a muted chip (opacity text fails contrast in dark mode) | My group | P1 |
| A7 | `prefers-contrast: more` and `forced-colors` support (`DESIGN_SYSTEM.md` §2.6) | Global | P2 |
| A8 | In-app text size (100 / 112 / 125%); no clipping at 200% zoom; long-string tests (60-character names, 2,000-character posts at 320 px) | Global | P1 |
| A9 | Tables: real `<th scope>`, `aria-sort` on sortable headers; list + detail panes are `region`s with headings | Staff desktop | P1 |
| A10 | `lang="sa"` / `lang="hi"` on Sanskrit and Hindi verse text | Quotes, darshan | P2 |
| A11 | Images: meaningful alt for darshan (deity + pastime); decorative `alt=""` on the sign-in panel | Imagery | P1 |
| A12 | Screen-reader passes: TalkBack and VoiceOver on 5 flows (sign in, fill a day, submit, approve a sign-up, mark attendance); results recorded in `docs/` | — | **P1 (before stores)** |
| A13 | axe-core in the browser suite (dev-only): 0 violations at every route and width | Tooling | P1 |
| A14 | Settings: replace native `<select>` / `type=time` with WheelSelect / TimePicker (consistency; same a11y) | Settings | P3 |
| A15 | The notification switch: no endless "Checking…" (time out after 4 s with a message) | Account | P1 |

### 3.3 Motion and sensitivity

- Every motion token collapses under reduced motion (crossfade or instant).
- Nothing flashes more than once.
- No parallax on task screens.
- No auto-playing motion except the splash line; on High only, the Welcome gradient (optional).
- The verse carousel already pauses on hold or tap, and stays still under reduced motion.

---

## 4. Mobile and device constraints

**Reference device:** a ₹6–10k Android (2–3 GB RAM) on slow 4G, plus an iPhone on iOS 17 (no View Transitions) and iOS 18+.

**Platform support for each dynamic pattern, with fallbacks:**

| Pattern | Android Chrome / TWA | iPhone Safari / Home Screen / WKWebView | Desktop | Fallback |
|---|---|---|---|---|
| View Transitions | Chrome 111+ ✓ | iOS 18+ ✓ | Chrome, Edge, Safari 18+, Firefox 144+ | Crossfade or instant |
| CSS `linear()` easing | ✓ | iOS 17.2+ ✓ | ✓ | Normal ease |
| Scroll-driven animations | Chrome 115+ ✓ | iOS 26+ ✓ | Chromium; Safari 26+; Firefox: no | Static |
| WebP images | ✓ | iOS 14+ ✓ | ✓ | JPEG |
| Web Share | ✓ | Safari ✓; **WKWebView needs a native bridge** | Chrome, Edge, Safari | WhatsApp link → copy |
| Vibration | ✓ | **✗** | ✗ | Visual feedback only |
| Push | ✓ (TWA too) | Home Screen iOS 16.4+; **the App Store shell needs APNs** | ✓ | In-app notices |
| App badge | ✓ | iOS 16.4+ | Chromium | Bell count |
| Contact Picker | ✓ | ✗ | ✗ | Typed field |
| Wake Lock (hall display only) | ✓ | iOS 16.4+ | ✓ | Ask the TV to stay on |

**Rules:**
- Confirm each row on real devices (`tools/devices/phone-check.mjs`) before a phase ships.
- Count browser and iOS versions for 2 weeks before investing in iPhone-only polish.

---

## 5. SEO contract

**Context:**
- Sadhana Record is a signed-in app; its routes are hash routes (`#/…`) on one document.
- Only the **public** surfaces matter for search and link previews: Welcome / the root URL, the delete-account page, the 404 page and the new privacy page.
- **Do not sacrifice SEO for visual effects:** imagery and motion never delay the public page's text.

| # | Item | Now | Proposed | Priority |
|---|---|---|---|---|
| S1 | Title and description | One title "IYF Delhi Sadhana Record", one description | Keep for `/`. Set `document.title` per route for the browser tab and history (e.g. "Report · Sadhana Record"); public static pages get their own `<title>` and description | P2 |
| S2 | Open Graph / Twitter | Present (1200×630 `og-image`) | Keep. After the darshan pipeline, consider a rights-cleared darshan OG image; update the URL when the own domain arrives | P3 |
| S3 | `robots.txt` | **Missing** | Add: allow `/`, `/privacy.html`, `/delete-account.html`; disallow nothing else (hash routes aren't crawled); point to the sitemap | P2 |
| S4 | Sitemap | Missing | `sitemap.xml` with `/`, `/privacy.html`, `/delete-account.html` | P3 |
| S5 | Canonical | Missing | `<link rel="canonical">` on public static pages; switch to the own domain when bought | P2 (with the domain) |
| S6 | Structured data | None | `Organization` (ISKCON Youth Forum, Delhi) + `SoftwareApplication` JSON-LD **as a static file** (`script-src 'self'` allows no inline JSON-LD; serve `/ld.json` linked, or skip). A low gain; only if it fits the CSP | P3 |
| S7 | Semantic structure | One `h1` per screen; landmarks (`header`, `nav`, `main`) | Keep; check no heading-level skips (an older note listed h1→h3 jumps) | P2 |
| S8 | Indexing of the signed-in app | Not indexable in practice (hash routes) | Keep. The privacy and delete pages are indexable for the stores' links | — |
| S9 | Meaningful URLs | Hash routes | Keep (no router change; deep links work in TWA/Universal Links via path `/`) | — |
| S10 | Performance for SEO | Good | The §2 contract protects Core Web Vitals | — |

---

## 6. Verification (decided 8 Oct 2026: quick checks per phase, the full gate once at the end)

**After each phase (quick check, minutes):** unit and server tests (they run in about 1–2 minutes, so always); size budgets; the browser checks for the screens that phase changed; screenshots of those screens (phone + desktop, light + dark).

**Once, at the end of Phase 8 (the full gate), and again on the store builds in Phase 9:**

1. Unit tests (271+); server tests (1,580+).
2. Size budgets (`npm run size`), with the §2.2 targets.
3. The browser suite (1,665+ checks) and component checks (219+).
4. **The route sweep:** 10 personas × every route × phone/desktop × light/dark, with automatic checks (errors, sideways scroll, clipped text, targets under 44 px).
5. Lighthouse mobile (Incognito, median of 3) on Welcome, Login and the signed-in Home: ≥ 95.
6. Device checks: Android emulator plus iPhone simulator (iOS 18 and 17).
7. Accessibility: axe 0 violations; for store phases, the TalkBack and VoiceOver passes.
8. Screenshots approved for visible changes (light/dark × phone/desktop).
