# Sadhana Record — the next level: UI/UX depth, speed, backend and data

**21 October 2026. Analysis only; nothing was changed.** Every figure below was measured today on the live build
(app `index-BFsEoGYS.js`, phase 19; API `be468dd6`) or read from the code, and says so where it is an estimate.
Written for the head to review before writing the implementation prompt: where the app stands, the level it can
reach inside its budget, the scope of each improvement with its cost, and the decisions only he can take.

How today's evidence was gathered: a fresh screenshot set of every route for every role at 390 (light and dark),
820, 1280 (light and dark) and 1920 px (`frontend/screenshots/ux21-*`, 120+ views); the first **stored** Lighthouse
run (`docs/perf/lh-2026-10-21-welcome.json`, `…-login.json`); a round-trip count per API action on the test
harness; the live `run_log`, `wrangler d1 info` and live row counts; the build's size table; and the earlier audits
(`APP_STATUS_MAP_2026-10-19.md`, `MERGED_UIUX_PERF_PLAN_2026-10-19.md`, `revamp/UI_UX_360_REVAMP.md` §15,
`PERFORMANCE.md`, `DB_API_EFFICIENCY_2026-10-17.md`), so nothing already done is proposed again.

---

## 1. Where the app stands today (measured)

| Area | Measured today | Source |
|---|---|---|
| Startup JS (gzip) | **56.90 KB** of a 60 KB budget (target 55: WARN) | `npm run size`, release log 21 Oct |
| Startup CSS | 13.85 KB of 15 (target 13.5: WARN) | same |
| Largest lazy chunk | Devotee 29.41 KB (target 30) · staff-Admin 28.10 · staff-Batch 13.93 | same |
| Precache | 117 entries, 678.69 KB of 800 | same |
| Lighthouse mobile (Moto G class, slow 4G), **first stored run** | **Welcome: performance 91, accessibility 100, best practices 100** — FCP 2.0 s, **LCP 3.2 s**, TBT 0 ms, CLS 0, 299 KiB. **Login: 96 / 100 / 100** — FCP 1.9 s, LCP 2.4 s, 197 KiB | `docs/perf/lh-2026-10-21-*.json` |
| What Lighthouse flags | Welcome LCP is the darshan painting, and the page fetches **two** copies of it (480 webp 42 KB, then 960 avif 50 KB); 21 KiB of the startup JS is unused on the public pages; the 16 KB stylesheet render-blocks ≈ 0.6 s on slow 4G; `icon-192.png` is 45 KB; `darshan.json` is 31 KB (gz) and preloaded on every page | same |
| Round trips per action (harness) | `auth.me` 4 · `home.get` 11 · `week.get` 9 · `journals.get` 8 · `profile.get` 11 · **`card.get` 22 · `card.of` 25** · `board.get` 13 · `settings.get` 13 · `devotees.get` 15 · `stats.batch` 16 · `stats.all` 12 · `members.list` 5 · `requests.list` 4 · `meta.get` 4 | scratch hop counter over `worker/tests/harness.mjs` |
| Slow calls on live since 14 Oct (`run_log`, > 1.5 s or failed; 116 rows) | `card.of` avg 3.9 s (7) · `board.get` 3.5 s (13) · `card.get` 2.9 s (4) · `settings.get` 2.7 s (4) · `devotees.list` 1.9 s (7) · `home.get` 1.2 s (17) | live D1 |
| Database | 3.44 MB · 35,443 rows read / 332 written in 24 h (**0.7 % / 0.3 %** of the free day) · 16 active devotees, 22 accounts, 8 open batches, 2 trainees | `wrangler d1 info`, live counts |
| Load test (3 Oct, 2,000 seeded devotees) | `week.submit` **9 ms CPU p50 against the 10 ms cap**; `stats.all` 55–74 ms CPU and 14–27 k rows; ceiling ≈ 35 calls/s | `PERFORMANCE.md` §1 |
| Tests | server 55 suites / 2,930 assertions · client 445 · browser gate 1,885 + 219 + 17 + 27 · 0 page errors | gate 19 |
| Screens and primitives | 55 screens (13 shared, 16 devotee, 15 coordinator, 10 admin, 1 facilitator) on **58 primitives**; largest files `Wall` 504, `Day` 414, `DevoteeDetail` 410, `Ids` 380 lines | `frontend/src` |
| Design system | 90 tokens; light = warm paper, dark = indigo night with four tonal steps; one brand blue, area accents as markers; system fonts; 47 inline icons; three capability tiers (`data-tier`) that gate glass, shadows, wash and motion | `app.css`, `revamp/DESIGN_SYSTEM.md` |
| Effects already in use | backdrop blur 20 rules · 16 linear / 5 radial gradients · 14 keyframe animations · 60 transitions · 71 shadows · 53 `color-mix` · 6 `@starting-style` entrances · 3 View Transition rules · **0 scroll-driven animations** | grep over `src` |
| Accessibility coverage | 211 `aria-label`, 54 `sr-only`, 51 live regions, 17 reduced-motion rules, global `:focus-visible`, 44 px controls; a11y 100 on both public pages | grep, Lighthouse |

**Plain reading.** The foundations are finished and proven: one design system, one nav model, budgets enforced,
a database at under 1 % of its free day, and a test wall most products never get. What is left is not a rebuild.
It is (a) the **first paint on a slow phone**, which has one clear waste in it; (b) the **newer screens' API calls**
(cards, boards, settings), which never had the round-trip pass the devotee path got on 17 Oct and are the only
calls that take 3–4 s on live; (c) **depth and vibrancy** in a handful of specific places, mostly dark mode and the
wide desktop layouts; and (d) **fewer taps** in the daily form and the staff loops.

---

## 2. The level scale, and where each area sits

A five-step scale, so "pinnacle" means something checkable:

| Level | Means |
|---|---|
| 1 | broken or inconsistent |
| 2 | works; looks assembled, not designed |
| 3 | solid: one system, consistent, no defects |
| 4 | refined: depth, rhythm, instant feel, details that reward attention |
| 5 | pinnacle: indistinguishable from the best consumer apps in **both** themes on **every** screen size; nothing waits, nothing jars, everyone can use it |

| Area | Today | Why (evidence) | Reachable inside the budget |
|---|---|---|---|
| Visual design, light | **4** | Warm paper, serif headings, clear hierarchy; the devotee Home is a real hero (screenshot `390-light-devotee-home-full`); staff screens on the same primitives | 4.5 |
| Visual design, dark | **3.5** | Correct and readable, but the four surface steps sit close in value (`#110f17 → #1a1822 → #24212e → #2d2a39`), so cards read flatter than in light; the accent fills (`Fill Monday`) carry it | 4.5 |
| Motion and effects | **3.5** | Purposeful and tier-gated; sheets spring, pages crossfade, rotators hold still on touch. Nothing moves with scroll, no shared-element travel between Home → Week → Day, no reveal of numbers | 4.5 |
| Interaction efficiency, devotee | **4** | Home → "Fill Monday" is one tap; part weeks count; the day form is sectioned with a floating score and Save; the book is remembered | 4.5–5 |
| Interaction efficiency, staff | **3.5** | Needs-you lists with one-tap call / WhatsApp; search; ⋯ menus on rows; but each nudge is one person at a time and the board's week picker is two selects | 4.5 |
| Information design and density | **4** | Phone boards are cards, tablets and desktops get tables; counts, bars and rings exist as primitives | 4.5 |
| Accessibility | **3.5** | Lighthouse 100 on public pages; names, live regions and targets throughout; **no stored screen-reader pass of the day form and sheets** (the tool exists: `tools/browser/screenreader.mjs`; a run is in progress today and is appended at the end) | 4.5 |
| Speed: first open on a slow phone | **3.5** | Welcome LCP 3.2 s, a double image fetch, render-blocking CSS, 21 KiB unused JS, a 45 KB icon | 4.5 |
| Speed: inside the app | **3** | Repeat open is one call; devotee screens answer in ~1 s; **cards, boards and settings take 3–4 s on live** | 4.5 |
| API and database efficiency | **3.5** | Idle database, keyed writes, audited scans; the newer actions make 13–25 round trips | 4.5 |
| Robustness and offline | **4** | Kept Home, in-flight ids, idempotent writes, failure paths driven by tests; no rollback runbook, no observability beyond `run_log` | 4.5 |
| Consistency and system | **4.5** | One route table, one nav model, one token layer, primitives everywhere | 5 |

No area is below 3; nothing needs rescuing. The gap to 5 is a set of specific, bounded pieces, listed in §5.

---

## 3. What the screens show (today's screenshots)

**Public (Welcome, Login, Sign up, Forgot).** The desktop Welcome is the app's best screen: a full-height darshan
with the verse on a glass panel beside a calm lockup. On a phone the painting becomes a top band; still strong.
Sign-up is a four-step form with a gold progress rule, section icons since phase 18, and nothing decorative behind
the fields — right. The one weakness is not visual: the painting arrives twice (small, then sharp) and is the LCP.

**Devotee Home.** A genuine hero screen: greeting in serif, a Getting-started card (1 of 3, skippable), the week card
with the seven-day strip and one primary action, a "Needs you" strip in the coordinator's amber, the darshan card
with the verse, a pinned announcement, and a "More" grid. Light mode has depth from the page wash and the raised
week card. In dark mode the same screen reads flatter: the week card's border is the only thing separating it from
the page. Desktop (1280) puts the darshan in a right column — good use of width.

**Week and Day.** Week is a clean checklist with the ring, the missing days in amber and the future days muted; the
state language is honest (Missing / Not filled / Not yet). The Day form is sectioned (Body, Chanting, Hearing …)
with a floating score-and-Save bar. On a 1280 screen the form sits in a single 720 px column and the right third of
the screen is empty; the score bar floats over the form instead of using that space.

**Report.** A calendar with a colour key and an "Activity score" ring. With no record for the chosen day the ring is
empty and, on desktop, two thirds of the screen is blank. The chart primitives (`Bars`, `ColBars`, `Trend`,
`Spark`, `Ring`) exist; the month's own numbers are not shown.

**Hearing and Reading.** Dense, useful, and now bilingual on Reading; the "Continue" card at the top is the right
hero. No change needed beyond polish.

**Wall.** Posts as cards with Like / Comment / Share; the dark version is good. It is the biggest file (504 lines)
and the only screen with user images.

**Coordinator.** Batch status on a phone is a card list with a dot-strip per devotee and an "Opens Sun" chip; on an
820 tablet it becomes a proper table with headers. The coordinator Home on desktop has a short left column (Needs
you, People to nudge) and a tall right column (three batch counters, two links, Birthdays), leaving a large empty
area bottom-left. The devotee detail screen (dark) is excellent: avatar, status, Call / WhatsApp / Email, this
week's dots, "Fill for Aarav", an eight-week sparkline.

**Admin.** All batches / Staff / Facilitators / Batch setup / IYF IDs on one tab strip; counters, progress bars and
rows on the shared primitives; the toolbar cluster fixed on 19 Oct. The head's Home has a Decisions block, System
health, and a "Batches this week" card that is mostly a sentence ("SPS Group 2, SPS Online, … — no active devotees
yet") — true today with 16 devotees, thin as a screen.

**Account.** Profile, Photo, About you (IYF ID, Connected since), Devices. Plain, correct; dark mode fine.

**Verdict on the screens:** no collisions, no misalignment, no wrong primitive — the 19 Oct sweep and today's agree.
The gains are depth (dark), use of width (desktop), the reveal of numbers (Report, staff Home), and fewer taps.

---

## 4. The budget: 60 KB now, 80 KB as a ceiling

**Today:** 56.90 KB of startup JS against a 60 KB budget, already past the 55 KB target. The head's rule: stay
inside 60; go towards 80 only once 60 is genuinely hit, since every phone can carry 80.

What 80 KB means on the phones this app is for: a Moto G-class phone parses and compiles roughly 1 MB of raw JS per
second once decompressed; 80 KB gzipped is about 250 KB raw, so ≈ 0.25–0.4 s of main-thread work on the first open,
and nothing after that (the service worker serves it from the phone). That is affordable **for the signed-in app**.
It is not affordable **for the public pages**, where every byte sits between a new devotee and the sign-in form:
Lighthouse says 21 KiB of today's startup chunk is unused on Welcome and Login — the signed-in shell (nav, menu,
theme, tier, cache, session) travelling with the public pages.

**Recommended ladder, with reasons:**

| Step | Budget / target | When | What it buys |
|---|---|---|---|
| Now | 60 / 55 | until the public split lands | nothing new |
| 1 — split the startup into **public** and **shell** | public ≤ 35 KB; shell ≤ 60 / 55 | first perf phase | Welcome and Login lose ~20 KB; the signed-in app keeps every byte it has |
| 2 — spend into the shell | shell 70 / 65 | only when a feature needs it and step 1 is live | interaction (optimistic saves, shared-element transitions, meters) — never decoration |
| 3 — the ceiling | shell 80 / 75 | the last 10 KB are reserved for things the head asks for by name | — |

The rule that keeps "80" from quietly becoming "95": the budget script (`scripts/size.mjs`) **fails** the release
at the budget, and the target stays 5 KB under it; both numbers move only in `release-phase.json`'s own commit,
with the reason in the release record. The precache budget (800 KB) and the per-chunk target (30 KB) do not move.

Bytes that are already free: lazy chunks (any screen may grow to 30 KB without touching startup), CSS gated by
tier (`data-tier='high'` rules cost nothing on low phones), and server round trips, which cost no bytes at all.

---

## 5. The scope of improvements — a menu, with costs

Each item: what, the evidence, what it costs, the risk, and the level it moves. Items marked **D** need a decision
from the head (listed again in §9). Items are grouped; order inside a group is by value for effort.

### A. First paint on a slow phone (public pages) — level 3.5 → 4.5

| # | What | Evidence | Cost | Risk |
|---|---|---|---|---|
| A1 | **One fetch for the Welcome painting.** Today `Darshan.svelte` shows the 480 webp first, then 50 ms after load switches `srcset` on, so the browser fetches the 960 avif as well (both appear in Lighthouse's byte list: 42 KB + 50 KB). Pick the final candidate once, set `fetchpriority="high"` on it, keep the blur placeholder | LCP 3.2 s; 25 KiB "responsive images" and 60 KiB "image delivery" savings flagged | code only, −40 KB on first open | low; browser checks cover Welcome |
| A2 | **Inline the critical CSS** (tokens + layout + the public pages' rules, ≈ 3–4 KB) in `index.html`; load the rest non-blocking | render-blocking ≈ 630 ms on slow 4G (both pages) | build step; no runtime bytes | medium: must not duplicate rules; measure FCP before/after |
| A3 | **Ship today's darshan entry, not the catalogue.** `darshan.json` (119 images, 31 KB gz) is preloaded on every page; the page needs one entry and the day's sequence | 31 KB on every first open | a build step that writes a ≤ 2 KB daily file, or an API field | low |
| A4 | **Public / shell split** of the startup chunk (§4 step 1) | 21 KiB unused on Welcome and Login | a second entry or a route-level `import()` for the shell | medium: the lazy loader and the gate's smoke checks |
| A5 | **Compress the manifest icons**: `icon-192.png` 45 KB → ≈ 8–12 KB, `icon-512` 213 KB → ≈ 40 KB (the browser fetches them for the install banner) | byte list on both pages | asset only | none (`sadhana-brand-logo` skill) |
| A6 | Skip the splash for a returning person who is already signed in (the kept Home is shown anyway) | 360 §15 P1, still open | small | low |

Expected result, **to be measured not assumed**: Welcome LCP from 3.2 s towards ≈ 2.3 s and performance ≥ 95;
Login ≥ 98; total bytes on Welcome from 299 KiB towards ≈ 200 KiB.

### B. Speed inside the app — level 3 → 4.5

| # | What | Evidence | Cost | Risk |
|---|---|---|---|---|
| B1 | **Round-trip pass on the newer actions**, exactly as the 17 Oct pass did for `home.get` (22 → 10): batch the independent reads with `db.js reads()`, memoise what `scopeReads` already holds. Targets: `card.get` 22 → ≤ 7, `card.of` 25 → ≤ 7, `board.get` 13 → ≤ 6, `settings.get` 13 → ≤ 4, `devotees.get` 15 → ≤ 6, `stats.batch` 16 → ≤ 6, `profile.get` 11 → ≤ 5, `journals.get` 8 → ≤ 4, `home.get` 11 → ≤ 8 | live: `card.of` 3.9 s, `board.get` 3.5 s, `card.get` 2.9 s, `settings.get` 2.7 s averages among slow calls | server only; zero bytes | medium: response-parity diff per action (the 17 Oct method), `audit:sql` 0 new; `week.submit` untouched (9 ms CPU) |
| B2 | **Optimistic saves** on the Day form and attendance: show the saved state at once, reconcile on the reply, roll back on STALE/refusal (the request id and `replies` table already make retries safe) | saves wait 0.7–2 s on live (`week.saveDay` avg 745 ms among slow calls) | ~1–2 KB in the Devotee chunk | medium: the STALE path and the browser checks for "Saved ✓" |
| B3 | **Prefetch the next screen's data on idle**: from Home, the open day's `week.get` (the chunk is already prefetched by `lib/prefetch.js`); from Batch status, the first devotee | the second tap waits a full round trip today | ≤ 0.5 KB; one extra read per open — rows read stay < 1 % | low |
| B4 | A **web-vitals beacon, sampled** (1 open in 100 → `run_log`): FCP/LCP/INP from real phones in Delhi, which no desktop Lighthouse can give | latency from India is **unverified** (load test ran Seoul→Seoul) | ~1 KB; ≈ 50 writes/day at 5,000 devotees | low; **D** (it is a write the free plan must afford on Sundays) |
| B5 | `stats.all` for the head: pre-aggregate per batch in one statement rather than per batch in a loop | 12 hops, 14–27 k rows at 2,000 devotees, 55–74 ms CPU in the load test — a figure above the 10 ms cap on paper while the live call succeeds, so **measure on live with `LOAD_METER=1` before trusting either number** | server only | medium |

### C. Depth and vibrancy, light and dark — level 3.5–4 → 4.5

All inside the existing token layer; no new colours, no libraries, every effect behind `data-tier` and reduced
motion (the rotator rule stands: visuals hold still, nothing loops).

| # | What | Evidence | Cost | Risk |
|---|---|---|---|---|
| C1 | **Dark-mode tonal steps.** Open the four surface steps so cards separate from the page without borders doing the work: raise `--surface-elevated` and `--surface-floating` ~4–6 % in lightness, add the existing 1 px `--glass-edge` top highlight to raised cards in dark, deepen `--shadow-2` under them. Re-check every contrast ratio with the tokens' own validator | dark Home, Week, Account read flat next to light | tokens only, 0 bytes | low; screenshot every route in dark |
| C2 | **The hero card gets a material.** The week card (devotee) and the Needs-you block (staff) take a soft area-accent wash inside the card header (`color-mix` ≤ 8 %) in both themes, so the one card that matters reads as the hero rather than one of four equal cards | 360 §15 "several equal-weight cards" — the week card already leads; this finishes it | ~0.3 KB CSS | low |
| C3 | **Numbers that reveal.** On High: a one-shot count-up on the day score and the ring (CSS `@property` + transition), a stroke-draw on the Report ring, bars that grow once on first view. On Balanced and Low: final state shown | 360 §7 per-moment table, not yet built | ~1 KB CSS, no JS | low |
| C4 | **Shared-element travel** Home week card → Week → Day on High (View Transitions, already used in 3 places): the week strip and the day's heading move, the rest crossfades | `--d-page` crossfade only today | ~0.5 KB CSS + `view-transition-name` on 3 elements | medium: the back-guard checks |
| C5 | **Scroll-linked reveal on Home (High only)**: the darshan card's painting settles 8–12 px as the page scrolls (CSS `animation-timeline: scroll()`, zero JS; 0 uses today) — restrained, holds still under a finger | the only "alive" motion on Home today is the quote rotator | ~0.3 KB CSS | low; reduced motion removes it |
| C6 | **Report with numbers**: beside the calendar, the month's days filled, average score, best day, streak — from `history.list` which already carries `dayPct` — and the Activity ring only when a day is chosen; on desktop the two columns fill the width | desktop Report is two-thirds empty | ~1.5 KB in the Devotee chunk; no new reads | low |
| C7 | **Staff Home uses its primitives**: batch counters as `Meters`/`Ring` with the week's trend (`Spark`), the head's "Batches this week" as one bar per batch; the coordinator's desktop columns balanced (Needs-you + nudges left, counters right, Birthdays spanning) | 1280 coordinator and head Home screenshots | ~2 KB in `staff-StaffHome` / `staff-HeadHome` (lazy) | low |
| C8 | **Desktop Day form**: a sticky right rail (score, section index, "How your day is scored") from 1024 px, the floating bar only below that | 1280 Day screenshot: right third empty | ~1 KB | low |
| C9 | Devotee empty states with a darshan halo (the first week, no record yet) — allowed by the imagery matrix (`UI_UX_360_REVAMP.md` §8.2); never on staff or error screens | by design | 240 w image, cached | low; **D** (taste) |
| C10 | Status, success and the "week submitted" moment: the darshan thumbnail in the success sheet (§8.2 allows it), a gold rule, the score counting up | the sheet is plain today | small | low |

### D. Fewer taps — level 3.5–4 → 4.5–5

| # | What | Evidence | Cost | Risk |
|---|---|---|---|---|
| D1 | **"Same as yesterday"** at the top of the Day form: one tap copies yesterday's times and rounds, then the person edits what differs | 16 fields a day; most days repeat | ~0.8 KB | low; **D** (must not look like it fills data for them — it is a visible tap) |
| D2 | **Numeric and time inputs open the right keypad** (`inputmode="numeric"`, `enterkeyhint="next"`), focus moves to the next field on Enter | to verify field by field on a phone — not checked today | ~0 | none |
| D3 | **Section jump bar** on the Day form (Body · Chanting · Hearing · Reading · Service · Mind) that scrolls, sticky under the day strip; on desktop it is the rail in C8 | the form is long; the floating bar covers the last field (360 §15, mitigated by padding) | ~0.7 KB | low |
| D4 | **Nudge all**: on Batch status, "Nudge everyone who has not started" opens WhatsApp with each number in turn (no server message channel exists and none is proposed) — one tap per person instead of three | coordinator desktop Home: three identical nudge rows | ~0.5 KB | **D**: product (it is still the coordinator sending, by hand) |
| D5 | **Week picker as a strip** on boards (← this week →) with the month select only in a sheet | two selects for the commonest move | ~0.4 KB | low |
| D6 | **Keyboard on desktop**: `/` focuses search (CommandSearch exists), `[` `]` move the week, `Esc` closes sheets (exists) | staff work on laptops | ~0.3 KB | low |
| D7 | Reading and Hearing remember the scroll position and the last open canto across visits | the chapters list is long | ~0.2 KB | low |

### E. Accessibility and inclusivity — level 3.5 → 4.5

| # | What | Evidence | Cost |
|---|---|---|---|
| E1 | **A stored screen-reader pass** of the five flows that matter (sign-up, the Day form, submit, the board, approve): `tools/browser/screenreader.mjs` exists; today's run is appended in §10. Fix what it names | no stored pass | small |
| E2 | Contrast re-check after C1 with the tokens' validator; `--text-muted` in dark is ≈ 6.5 : 1 today and must stay ≥ 4.5 | token change | none |
| E3 | Charts with a "Show as table" (Report, Filling chart) — the primitives already render tables on wide screens | 360 §15 P1 | ~0.5 KB |
| E4 | **Hindi in the UI** — the books are bilingual now; the interface is English only by decision. A Hindi string table would be ≈ 6–8 KB (lazy) and a product decision, not a technical one | — | **D** |

### F. Backend and data — level 3.5 → 4.5 (and the ceilings to watch)

| # | What | Evidence |
|---|---|---|
| F1 | B1 above is the backend item with the most user-visible effect; it needs no schema change | hops table |
| F2 | **Sunday writes at 5,000 devotees** (≈ 80–85 k of 100 k) is the first real ceiling; nothing proposed here adds a write per devotee action except B4's sample, which is bounded | `PERFORMANCE.md` |
| F3 | `week.submit` at 9 ms CPU p50: no scoring change in any item above; keep it that way, measure on the load Worker after B1 | load test |
| F4 | PBKDF2 10 k → 25 k iterations (1.84 ms on this Mac): affordable, a decision, measure on the load Worker first | `MERGED…` phase 3 |
| F5 | Observability: a rollback runbook (roadmap 6.5), alerts on cron failures (6.6), and B4's sampled vitals — the three things that turn "it feels slow" into a number | roadmap |

---

## 6. What not to do, and why

- **No re-skin, no second design language.** The system is decided (D1), consistent across 55 screens, and the
  gate proves it. Vibrancy comes from depth, material and motion in the places named above, not from new colours.
- **No libraries** for animation, charts or icons: 40–100 KB each; the primitives exist and the effects proposed
  are CSS.
- **No gradients or glass behind data, forms or tables**, no images on work screens, no looping motion, no
  auto-playing anything: the design system's own rules, and the head's "restrained visuals" rule.
- **No web fonts.** The serif/sans system stacks are part of the look and cost nothing.
- **No per-row animation on long lists**; entrance effects are for one hero element per screen.
- **No write per devotee action** for analytics; sampling only (B4), and only if the head agrees.
- **No change to scoring, scopes, routes or business rules** inside a UI/perf phase; a finding that needs one goes
  to the head first.

---

## 7. Proposed phasing (for the implementation prompt)

Each phase is a bulk release through the full gate, in its own copy, with its own check; everything in it is
measured before and after with the same tool. The order puts the measurable, zero-byte wins first.

| Phase | Contents | Check it passes with |
|---|---|---|
| **20** (prompt-8d's, done) | shared primitives' states, admin toolbar cluster, one-call open, timers | — |
| **21 — Fast first paint and fast calls** | A1 A2 A3 A5 A6 · B1 B3 · F3 | Lighthouse Welcome ≥ 95 / LCP ≤ 2.5 s, Login ≥ 98, stored; every listed action ≤ its hop target with a response-parity diff; `audit:sql` 0 new; size within 60 |
| **22 — Public/shell split and the budget ladder** | A4 · `size.mjs` public ≤ 35, shell 60/55 | gate + a stored Lighthouse pair; the gate's smoke checks on every public route |
| **23 — Depth and vibrancy** | C1–C8 (C9, C10 if decided) · E2 | screenshots of every route, both themes, 390/820/1280/1920; collision sweep 0; motion audit; contrast validator |
| **24 — Fewer taps** | B2 · D1–D7 (D1, D4 if decided) · E1 E3 | the Day form's browser part extended; screen-reader pass stored; taps per daily fill counted before/after |
| **25 — Numbers from real phones** | B4 (if decided) · B5 · F4 F5 | `run_log` sample arriving; load Worker CPU for `stats.all`, `week.submit`, login |

---

## 8. Targets — before and after

| Metric | Today | Target | Measured by |
|---|---|---|---|
| Lighthouse Welcome (mobile) | 91 · LCP 3.2 s · 299 KiB | ≥ 95 · LCP ≤ 2.5 s · ≤ 200 KiB | stored JSON |
| Lighthouse Login | 96 · LCP 2.4 s | ≥ 98 · LCP ≤ 2.0 s | stored JSON |
| Startup JS | 56.90 / 60 | public ≤ 35; shell within 60 (then the ladder) | `npm run size` |
| Largest lazy chunk | 29.41 / 30 | ≤ 30 (each screen) | same |
| Round trips | `card.of` 25, `card.get` 22, `stats.batch` 16, `devotees.get` 15, `board.get` 13, `settings.get` 13, `home.get` 11 | ≤ 7 / 7 / 6 / 6 / 6 / 4 / 8 | hop counter |
| Live slow-call averages | `card.of` 3.9 s, `board.get` 3.5 s | none above 1.5 s in `run_log` for a week | live |
| Taps for a normal day's fill | counted in phase 24, before | −30 % | browser part |
| Screens with a stored light + dark screenshot at 4 widths | ~120 views today | every route, every role | `shoot.mjs` |
| Screen-reader pass | none stored | 5 flows, stored, 0 open findings | `screenreader.mjs` |
| D1 rows read / written per day | 35 k / 332 | unchanged in order of magnitude (< 2 % of the day) | `d1 info` |
| Collisions, page errors | 0 / 0 | 0 / 0 | sweep, gate |

---

## 9. Decisions needed from the head

1. **The budget ladder** (§4): public ≤ 35 KB after the split; shell 60 → 70 → 80 only by named need. Yes/no.
2. **B4 — sampled real-phone vitals** (≈ 50 writes a day at scale): yes/no.
3. **D1 — "Same as yesterday"** on the Day form: yes/no (it is a visible tap; nothing is pre-filled silently).
4. **D4 — "Nudge all"** via WhatsApp from the board: yes/no.
5. **C9 — darshan halo on devotee empty states**; **C10 — thumbnail in the week-submitted sheet**: taste.
6. **E4 — Hindi interface strings** (a product decision; ≈ 6–8 KB lazy).
7. **F4 — PBKDF2 25,000 iterations**, after a load-Worker measurement.
8. The two **open product items** carried from the status map, which touch screens in these phases: a removed or
   left trainee keeping the facilitator scope; who may delete an account (`batches.kind`).

---

## 10. Evidence index

- Screenshots: `frontend/screenshots/ux21-<width>-<theme>-<screen>.jpg` (21 Oct).
- Lighthouse: `docs/perf/lh-2026-10-21-welcome.json`, `docs/perf/lh-2026-10-21-login.json` (the first stored run;
  `tools/perf/lighthouse.sh` reruns it).
- Round trips: a hop counter over `worker/tests/harness.mjs` (statement `first/all/run` = 1, `batch`/`reads()` = 1);
  the method is `tools/perf/sqltrace.mjs`'s, with hops counted instead of statements.
- Live: `wrangler d1 info sadhana`; `run_log` since 14 Oct (`SLOW_MS` = 1,500 ms, so the table holds slow or failed
  calls only — averages are of those, not of all calls).
- Sizes: the release log of 21 Oct 11:32 IST (`npm run release`).
- Earlier audits this builds on: `APP_STATUS_MAP_2026-10-19.md`, `MERGED_UIUX_PERF_PLAN_2026-10-19.md`,
  `revamp/UI_UX_360_REVAMP.md` §8 and §15, `revamp/DESIGN_SYSTEM.md`, `PERFORMANCE.md`, `DB_API_EFFICIENCY_2026-10-17.md`.

### Appended when today's runs finish
- Screen-reader audit (`tools/browser/screenreader.mjs`) and spacing audit (`tools/browser/space-audit.mjs`): see below.
