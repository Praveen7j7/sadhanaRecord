# Sadhana Record — Whole-app optimization audit (measured) and the work it adds

**22 October 2026. Analysis only.** Nothing in the application was changed. Everything below was measured today on
the live app and API, or on a read-only export of the committed tree (`git archive` of HEAD `7b7b53b`, built and served
on a port of its own), so the two build lanes' uncommitted edits are not in these numbers. This is the **BEFORE** half
of the final before/after table (blueprint Deliverable 10) and the list of work that was in neither lane.

Builds on, and does not repeat: `AUDIT_BLUEPRINT_2026-10-21.md` (R-01…R-38), `UX_PERF_DEPTH_ANALYSIS_2026-10-21.md`
(A1…F5), `IMPLEMENTATION_PROMPTS_2026-10-21.md` (the two lanes, one release), `BUILD_TRACKER_2026-10-22.md`.
Corrections already made by the lanes are accepted: the tree **is** a git repository (R-01 withdrawn); phases 20 work
is in progress on the live tree (prompt-92) and phase 2 speed work in the revamp (prompt-5b).

Raw evidence (this session's scratchpad, copied under `docs/perf/` where small): per-action cost table `api-cost.md`
+ `api-cost.json`; Lighthouse JSON for every public page on live (`lh-live/`) and for every signed-in route per role
on the HEAD build (`lh-routes/`); 131 screenshots (`shots/`); `wiring.md`; `visual-review.md`.

---

## 1. Executive summary

**What is already excellent and must not be disturbed.** Public pages score 92–96 performance and 100 / 100 / 100
(accessibility, best practices, SEO) on the Moto-G mobile profile; the two legal pages 100 / 100 / 100 / 100. Startup JS
is 57.0 KB gzip (budget 60), startup CSS 13.85 KB, the largest lazy chunk 29.4 KB, precache 682 KB / 119 entries. Every
authenticated call pays a fixed, small entry fee (session + scopes = 2 round trips, ≈ 10 rows). The free-plan safety net
(DAILY_LIMIT wording, BUSY retries, keyed writes, SQL audits) is sound and plan-agnostic.

**The five things that decide whether the app feels "instant" or "slow", in order of weight (all measured):**

1. **Where the API runs.** `cf-placement: local-MRS` on every live call today: Smart Placement has **not** moved the
   Worker next to its database in Singapore, because it needs steady traffic from several locations and a 16-devotee
   app never provides it. Every D1 round trip therefore crosses continents. From here: `meta.get` (4 hops) = 0.78–0.90 s;
   `auth.lookup` (1–3 hops) ≈ 1.0 s. A devotee in Delhi pays ≈ 50–80 ms per hop to Singapore. **Fix: a placement
   region hint** (`[placement] region = "aws:ap-southeast-1"`), one line, no code. See §3.
2. **Round trips per action.** Measured over all 150 actions (3,887 calls): the signed-in entry fee is 2 hops, but
   `board.get` is **31 hops for one trainee and 11 more per trainee** (338 for 30; the facilitators' board 551 → 851
   from 2,000 to 5,000 devotees), `card.get` 24, `card.of` 26, `settings.update` 26, `settings.get` 13,
   `group.mark` 17, `stats.batch` 16, `week.saveDay` 13, `week.submit` 13, `home.get` 11. `batches.closingPreview`
   is **1 hop per member** and `eligible.list` **2 hops per member** (629 and 1,255 hops for a 625-member intake). §4.
3. **First paint.** Welcome LCP 2.9 s today (was 3.2 s on 21 Oct): the hero painting is still fetched twice
   (480 webp 44 KB + 960 avif 74 KB), the 30 KB catalogue is preloaded on every page, a 44 KB icon rides along,
   21 KB of the startup JS is unused before sign-in, the stylesheet render-blocks ≈ 150 ms. A1–A6 cover this
   (prompt-5b has A1, A3, A5 built in the revamp already). §5.
4. **Caching of the unhashed files.** `/darshan/*`, `/brand/*`, `/icons/*`, `/motion.css`, `/contrast.css` are served
   with `max-age=0, must-revalidate`: every open of a page that shows them makes a conditional request per file. One
   `_headers` block gives them a day (paintings a year — their names are content-numbered). §6.
5. **Look and copy.** Light reads as clean paper but plain; dark reads flatter than light (the surface steps are
   ≈ 4 L* apart, cards separate by border alone, the accent desaturates). Screens still carry explanatory sentences the
   head has ruled out. The visual review (§8) gives a ranked ladder of token-level changes inside the no-fonts /
   no-libraries / native-motion rules.

**Free → Paid: nothing is wired to the plan.** Every limit the code knows is a constant (`PER_RUN 35`, `ROWS_PER_RUN
300`, the DAILY_LIMIT text match, 3 cron schedules) or a budget the tier system reads from the phone, never from the
plan. Switching to Workers Paid changes behaviour in exactly one place: the three N+1 actions above stop failing on
the per-invocation CPU / query caps and merely stay slow. The fix for them is the same on both plans. §7 lists every
constant and what to lift into one `limits.js`.

**New work found (neither lane had it).** §9 adds items **G1–G12** to the build tracker with an owner each, inside
the existing two lanes (prompt-92 product, prompt-5b speed & design); nothing is started on the live tree.

---

## 2. Live state today (read-only)

| | Measured | Source |
|---|---|---|
| Live app | `index-BFsEoGYS.js`, build `2026.10.21-1131`, phase 19 | `<meta name="app-build">`, `/version.json` |
| Live API | Worker `sadhana-record-api`, last version 18 Oct 06:16 UTC; placement `local-MRS` on every call | `wrangler versions list`, response headers |
| D1 `sadhana` | 67 tables, 3.43 MB; last 24 h: 12,949 read queries, 73 writes, **29,510 rows read**, 119 rows written | `wrangler d1 info` |
| People | 22 accounts, 16 active devotees, 3 submissions, 7 push subscriptions, 343 session rows | `SELECT COUNT(*)` |
| Slow-call log (10 days, > 1.5 s or failed) | `home.get` 69 × avg 2.24 s (max 4.4 s) · `stats.all` 19 × 3.84 s (**max 10.9 s**) · `board.get` 13 × 3.50 s · `card.of` 7 × 3.86 s · `card.get` 4 × 2.88 s · `week.saveDay` 17 × 2.03 s · `settings.get` 9 × 1.95 s · `journals.get` 5 × 2.16 s · `group.list` 16 × 1.25 s · `devotees.list` 11 × 1.70 s | `run_log` |
| API from Marseille | `meta.get` 0.78–0.90 s (TCP connect 0.13–0.18 s, the rest is Worker→D1); `auth.lookup` 0.97–1.00 s | `curl -w` ×5 |
| Public pages, mobile Lighthouse | Welcome **93** / 100 / 100 / 100, FCP 1.6 s, **LCP 2.9 s**, TBT 0, CLS 0, 323 KiB · Login 96 / 100 / 100 / 100, LCP 2.5 s, 197 KiB · Sign-up 93, LCP 2.9 s, 228 KiB · Forgot 92, LCP 2.9 s, 202 KiB · Privacy 100 / 100 / 100 / 100 · Delete-account 100 / 100 / 100 / 100 | `docs/perf/lh-2026-10-22-*.json` |
| Build sizes (HEAD) | startup JS 57.00 KB gz (7 files; target 55 WARN), CSS 13.85 KB (target 13.5 WARN), largest lazy Devotee 29.41 KB, precache 119 entries 682 KB | `npm run size` |
| Security headers | CSP strict (`script-src 'self'`, no inline), `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'`; API `cache-control: no-store`, CORS allow-list with `vary: origin`, preflight cached 24 h | `curl -I` |
| Compression | Brotli on HTML/JS/CSS/JSON from Cloudflare; images already AVIF/WebP | `content-encoding` |

Sessions table: 343 rows for 22 accounts — the trim (60 days after last use) is correct; the count is the sign-in
tests of the last weeks, not a leak. `replies` (idempotency) holds 0 rows because entries are trimmed after 6 h;
correct.

---

## 3. Placement: the API is not next to its database (measured, highest value per line changed)

**Evidence.** Every live response carries `cf-placement: local-MRS` (and `cf-placement: local-…` is what a phone in
Delhi gets too: "local" = the Worker ran at the caller's colo, not where D1 is). `wrangler.toml` has
`[placement] mode = "smart"`, and the 3 Oct load test expected the header to read `remote-…` "once Cloudflare has
moved it". Nineteen days later it has not, and the Cloudflare docs say why: Smart Placement "requires consistent
traffic to the Worker from multiple locations to make a placement decision" and "only considers locations where the
Worker has previously run"; 1 % of requests are always left unrouted as a baseline. Sixteen devotees in one city do
not qualify, and 5,000 devotees in one city may not either.

**Cost today.** `meta.get` = 4 hops → 0.78–0.90 s from Europe; TCP connect is only 0.13–0.18 s of that, so ≈ 0.65 s
is four Worker→Singapore round trips at ≈ 160 ms. From Delhi the per-hop cost is lower (≈ 50–80 ms) but the arithmetic
is the same: `card.get` at 24 hops ≈ 1.2–1.9 s of pure network before any work, which is exactly the 2.9 s the live log
shows; `home.get` at 11 hops ≈ 0.6–0.9 s (log: 2.2 s avg among slow calls).

**Fix (one line, no code, both plans).** Cloudflare added explicit placement hints on 22 Jan 2026:

```toml
[placement]
region = "aws:ap-southeast-1"     # the Worker runs in the data centre with the lowest latency to Singapore, where D1 `sadhana` (APAC) lives
```

The hint **replaces** `mode = "smart"` (the docs list the options as mutually exclusive). Verification: `cf-placement`
on live changes from `local-<caller>` to a Singapore-side value; `meta.get` from Europe drops to ≈ TCP + 4 × local
hop; the `run_log` averages fall across the board. Free-plan availability of hints is **not stated** in the docs —
if the deploy is refused, fall back to `mode = "smart"` and accept that it will not trigger at this traffic.
Static assets are unaffected (always served from the nearest colo). The frontend Worker needs nothing.

This is the one change that speeds up **every** action, including the ones the round-trip pass never touches. It is
also why the round-trip pass matters so much: with the Worker beside D1, a hop costs ≈ 1–3 ms and 24 hops ≈ 50 ms;
without it, 24 hops is two seconds. Do both.

Also worth switching on with it: **D1 read replication** (`read_replication.mode = "auto"`, free of charge, needs the
Sessions API `env.DB.withSession(bookmark)`). It does not help a Delhi caller much today (the primary is already APAC)
but it is what makes a second city or the Vrindavan centre cheap later, and the bookmark header is a 10-line change in
`api.js` + `lib/api.js`. **Not for this release** (it changes every read's consistency contract); logged as G11.

---

## 4. API cost — every action measured (hops, statements, rows read, rows written)

Method: the whole server suite (56 suites, 3,887 calls, every one of the 150 registry actions) on the HEAD export,
with the D1 shim instrumented so that one `first()/all()/run()` = 1 hop and one `db.batch()`/`reads()` list = 1 hop;
rows read = rows returned (D1 bills rows **scanned**, so full-scan statements are flagged separately); rows written =
SQLite `changes`. Growth measured on a seeded database at 2,000 and 5,000 devotees. Full table: `docs/perf/api-cost-2026-10-22.md`.

### 4.1 The entry fee (every signed-in call)

| | hops | statements | rows |
|---|---|---|---|
| session + account (one join) | 1 | 1 | 1 |
| `scopeReads` (open membership, batch list, leader row, enrolment) | 1 | 4 | 8–10 |
| `auth.me` total | 4 | 7 | 23–25 |

Identical for devotee, leader, trainee, facilitator, coordinator and master. `scopeReads` rows grow with the number of
batches, not devotees. **Keep.**

### 4.2 Fixed-cost actions above 10 hops (p50 over the suite; these do not grow with the batch)

| action | hops | after-hops | stmts | rows read | why (hop sequence read) | target |
|---|---|---|---|---|---|---|
| `board.get` (one trainee) | **31** | 0 | 34 | 76 | `measures` read 3×, `phases` 4×, enrolment row 4×, targets/fills 2×, per person | ≤ 8 + 1 per 25 people |
| `settings.update` | **26** | 1 | 33 | 19 | `SELECT value FROM settings WHERE key=?` one key per hop, **twice over** (raw binding, no memo) | 4 |
| `card.of` | **26** | 0 | 29 | 61 | cardOf → phaseAverage → scoreOf each re-read measures / phases / enrolment | 6 |
| `card.get` | **24** | 0 | 27 | 61–95 | same | 6 |
| `identity.link` | 18 | 1 | 25 | 26 | person read 6 statements before and 6 after the write, one hop each | 5 |
| `group.mark` | 17 | 2 | 24 | 50 | settings read twice (memo cleared by the session write, §4.5), 9 week-board reads one by one | 7 |
| `attendance.override` | 17 | 2 | 24 | 32 | same shape as group.mark | 7 |
| `stats.batch` | 16 | 0 | 19 | 33 (+0.42 rows per devotee) | 13 independent reads, one per hop | 5 |
| `stages.set` | 15 | 1 | 22 | 32 | re-reads the card after the write, one hop per read | 6 |
| `identity.merge` | 15 | 1 | 26 | 18 | same as identity.link | 5 |
| `group.list` | 14 | 0 | 17 | 34 | week board for the leader's batches, one read per hop | 5 |
| `weeks.setClass` | 14 | 1 | 24 | 29 | week board + class week read, then re-read | 6 |
| `week.submit` | 13 | 1 | 22 | 27 | 9 single reads before the 6-statement write batch | 5 |
| `week.saveDay` | 13 | 1 | 17 | 40 | settings ×2, 5 single reads, INSERT OR IGNORE + SELECT + UPDATE | 5 |
| `attendance.set` | 13 | 1 | 19 | 28 | week board one read per hop | 6 |
| `settings.get` | 13 | 0 | 16 | 13 | one key per hop (raw binding) | 3 |
| `leaders.list` | 13 | 0 | 16 | 24 (**1,875 at 5k**: reads every member of every batch of the same level) | 5, and only this batch |
| `stats.all` | 12 | 0 | 15 | 29 (flat, 193 at 5k) | fine on rows; 10.9 s max on live is hops × distance | 6 |
| `fac.devotees` | 12 | 1 | 16 | 45 (+0.12 per devotee) | | 6 |
| `home.get` | 11 | 0–1 | 24 | 27 (flat) | settings read twice when the hourly session write fires | 7 |
| `devotees.list` | 11 | 0 | 14 | 25 (+0.29 per devotee) | | 6 |
| `devotees.get` | 9–15 | 0 | 12–18 | 12–32 | | 6 |
| `profile.get` | 5–11 | 0 | 8–14 | 10–31 | | 4 |
| `journals.get` | 8 | 0 | 11 | **581 (1,227 max)** — the largest devotee-facing reader: 324 lectures + 156 files + 76 books when `have` is stale | 4; ETag-style `have` is already there, make the client always send it |

Targets are the blueprint's where it had one (card 7 / 6, stats.batch 6, devotees.get 6, board 6, settings 4,
profile 5, journals 4, home 8) and tightened where today's hop list shows the floor is lower.

### 4.3 Actions whose hops grow with the batch (N+1) — the only ones that can fail on a cap

| action | hops 2k → 5k | rows 2k → 5k | repeated statement |
|---|---|---|---|
| `eligible.list` (one batch of 625) | **505 → 1,255** | 761 → 1,886 | 2 per member: weeks/averages + attendance held/present |
| `batches.closingPreview` (VL2-51, 625) | **254 → 629** | 511 → 1,261 | 1 per member: `COUNT(*) FROM attendance WHERE login=? … mark_used='P'` |
| `board.get` (facilitators, head) | **551 → 851** | 861 → 1,311 | 2 per devotee of each facilitator + 11 per facilitator card |
| `board.get` (ETP-51, 30 trainees) | 338 → 338 | 532 | 11 per trainee |

On the **free** plan these hit the 10 ms CPU cap and the per-invocation query cap (the D1 limits page lists a
per-invocation query limit, 50 free / 1,000 paid; the Workers page lists 1,000 internal subrequests) **long before
5,000 devotees** — a 60-member intake is already 120 hops in `eligible.list`. On the **paid** plan the same calls
merely take seconds. The fix is identical on both plans and is one `GROUP BY login` each (the blueprint's
`closingPreview` line, extended to `eligible.list` and the two boards). **Nothing else in the API grows in hops.**

### 4.4 Rows that grow by design (one row per listed devotee) — fine, but know the slope

`stats.batch` 1,084 → 2,334 (0.42 rows/devotee), `devotees.list` 608 → 1,483, `leaders.list` 773 → **1,898 for one
batch** (reads the whole level), `exports.page` first page 270–520 → 645–1,270, `fac.devotees` 267 → 617,
`ids.possibleDuplicates` reads the whole registry copy (2,010 → 5,010 rows). `home.get`, `week.get`, `history.list`,
`announcements.list`, `card.get`, `members.list`, `stats.all` are flat. Budget check at 5,000 devotees on a Sunday
(5,000 × home.get 38 rows + 5,000 × submit 27 + 100 staff × stats.batch 2,334 + boards) ≈ 0.6 M of the 5 M free rows
read: safe; writes stay the tighter limit as documented.

### 4.5 Two cross-cutting defects found in the hop sequences

- **The hourly sliding-session `UPDATE` clears the per-call memo** (`requestDb.prepare()` clears on any non-SELECT,
  including the `waitUntil` write), so the full settings table (14 rows) is read **twice** in the same call, +1 hop,
  on every call that lands on the hour: visible in `home.get`, `week.saveDay`, `fac.devotees`, `group.mark`. Fix: issue
  that `UPDATE` through the raw binding (`db.__raw`), not through `ctx.db`. One line. (G1)
- **`settings.get` / `settings.update` bypass the memo** (they are handed the raw binding): 13 and 26 hops for a
  table of ~10 rows. Fix: read `settings(ctx.db)` once. (part of B1)
- **Every write pays one extra hop for the idempotency read** (`SELECT body FROM replies WHERE key=?`) before the
  handler runs. It could ride in the `scopeReads` batch (the key is known once the session is read) — −1 hop on every
  save, submit, attendance mark and approval. (G2)
- **`measures` is full-scanned 3× per card** (no index on `active`; 11 rows today, grows with ADR 0012's groups). One
  read, memoised per call. (part of B1, after prompt-92's ADR 0012 change lands)

### 4.6 Writes

No action writes per devotee. Largest: `account.delete` 54 rows max (35 p50) and `devotees.delete` 42 (25 p50) in one
batch; `requests.approve` 9–18; `ids.create` 12–14; everything else ≤ 7. Sunday at 5,000 devotees stays ≈ 80–85 % of
the free day as documented; B4's sampled vitals (1 in 100) adds ≈ 50 rows a day. **Keep.**

### 4.7 Never exercised successfully by any suite

`criteria.set`, `reopen.reject`, `auth.logout`, `auth.sessionEnd` are called only to pin their roles (refusals). Four
happy-path tests to add. (G3)

---

## 5. Front end: first paint, bundles, per-route Lighthouse

### 5.1 Public pages on live (mobile profile, slow 4G, 4× CPU) — the "before" row

| page | perf | a11y | BP | SEO | FCP | LCP | TBT | CLS | SI | bytes |
|---|---|---|---|---|---|---|---|---|---|---|
| Welcome | 93 | 100 | 100 | 100 | 1.6 s | **2.9 s** | 0 | 0 | 4.1 s | 323 KiB |
| Login | 96 | 100 | 100 | 100 | 1.8 s | 2.5 s | 0 | 0 | 2.6 s | 197 KiB |
| Sign-up | 93 | 100 | 100 | 100 | 1.9 s | 2.9 s | 0 | 0 | 2.7 s | 228 KiB |
| Forgot | 92 | 100 | 100 | 100 | 2.1 s | 2.9 s | 0 | 0 | 3.1 s | 202 KiB |
| Privacy | 100 | 100 | 100 | 100 | — | 1.2 s | 0 | 0 | — | — |
| Delete account | 100 | 100 | 100 | 100 | — | 1.4 s | 0 | 0 | — | — |

What Lighthouse flags on Welcome (all already A1–A6, confirmed today with numbers): LCP element = the hero painting;
`uses-responsive-images` 43 KiB wasted (480 webp **and** 960 avif both downloaded: 44 + 74 KB); `unused-javascript`
21.5 KiB of `index-*.js` (63 % unused before sign-in); render-blocking CSS 150 ms; `prioritize-lcp-image` (the
painting is discovered late, after `darshan.json`); 44 KB `icon-192.png` requested by the page; 30 KB catalogue on
every page. Speed Index 4.1 s is the carousel settling. Server response 170 ms; TBT 0; DOM 47 elements.

### 5.2 Every signed-in route, every role (HEAD build, mock API, mobile profile)

**Lighthouse cannot measure the signed-in screens** of a mock build. Each audit opens a fresh tab, the mock API lives inside the page, and the tab lands on Welcome. Two attempts were discarded for this reason, and the 21 Oct blueprint listed the same gap.

The replacement, `tools/perf/routevitals.mjs`, measures what a signed-in person actually does. It signs in once per role through the real Login screen and throttles the page like Lighthouse mobile (4× CPU, 1.6 Mbps, 150 ms round trip). It then moves to each route in the app and times it until real content replaces the loading placeholders, recording layout shift, main-thread blocking and bytes along the way.

The mock adds a fixed 1.5 s to every API call. So a screen that is ready in under 50 ms was served from the read cache, and one that takes about 1.5 s asked the server. 41 routes over 5 roles were measured, each on a first and a second visit.

| Result | Routes |
|---|---|
| **Instant (≤ 50 ms), first visit included** | devotee: week, day, history, hearing, reading, wall, card, home · facilitator: card, home · coordinator: requests, batch, members, board, home · training coordinator: students, scoreboards, home · head: overview, coordinators, batches, IDs, activity, home |
| **First visit waits for the server, repeat is instant** | report (0.6 s), My students, filling chart, group leaders, devotee detail, facilitators |
| **Waits for the server on every visit** | **Account** (profile read each time), **Settings**, **training Board**. Each costs a full API round trip, which is 13 hops for Settings today. With G0 + B1 they become fast; with a stale-while-revalidate read they become instant (G23) |
| **Main-thread blocking** | 0 ms on every route except a single 47 ms on the first open of Reading. No long task anywhere |
| **Bytes per screen change** | 0–3 KiB. Lazy chunks are precached, staff chunks cached at first use |
| **Layout shift** | 0.000–0.002 on every route **except Home** |

**Home shifts its layout on every return** (G22, verified). The shift scores are:

| Role | Layout shift |
|---|---|
| Devotee | 0.384 |
| Coordinator | 0.333 |
| Head | 0.333 |
| Training coordinator | 0.189 |

Above 0.25 counts as "poor" on Core Web Vitals. On the devotee's Home, the "This week" card (`section.hero-card`) moves 153 → 401 px, and the "Needs you" card moves with it. The cause is a 248 px block that renders above them after the first paint. Reserve its space or render it in the same frame. This is the one visible jank in the signed-in app.

The public-page cold load is in §5.1. After a release, the first open from cache measured 0.15–0.2 s to first paint on the same throttled profile.

### 5.3 What makes up the 57 KB startup bundle, and the wiring audit

See §10: startup bundle by source, and the wiring discrepancies.

---

## 6. Caching, delivery and the service worker

| file class | today | wanted | why |
|---|---|---|---|
| `/assets/*` (hashed) | `max-age=31536000, immutable` ✓ | keep | |
| `/`, `index.html`, `sw.js`, `workbox-*.js`, `manifest`, `version.json` | `no-cache` ✓ | keep | self-update proven |
| `/darshan/*.avif|webp` (content-numbered `v092-960.avif`) | `max-age=0, must-revalidate` (cf-cache HIT, but the phone revalidates every open) | `max-age=31536000, immutable` | the name is the version |
| `/darshan/darshan.json`, `blur.json` | `max-age=0, must-revalidate` | `max-age=86400, stale-while-revalidate=604800` | catalogue changes rarely; the SW's SWR already covers the signed-in path |
| `/brand/*.webp|png`, `/icons/*.png` | `max-age=0, must-revalidate` | `max-age=604800, stale-while-revalidate=2592000` | regenerated with a new name when they change (A5) |
| `/motion.css`, `/contrast.css`, `/legal.css`, `/push-sw.js` | `max-age=0` / `no-cache` | move `motion.css` and `contrast.css` into the hashed build (import them so Vite names them) or `max-age=86400` | fetched on every open after the splash |
| API responses | `no-store` ✓ | keep | |

One `_headers` edit (G4). Also: `103 Early Hints` is not needed (the page already modulepreloads); `Speculation Rules`
do not apply to a hash router; HTTP/3 is on (`alt-svc: h3`).

Service worker: precache 119 entries / 682 KB, staff chunks CacheFirst at first use, darshan SWR 8 entries, old
releases' assets kept — correct. Two refinements: (a) `navigateFallback` serves `index.html` for unknown paths, so a
typo URL inside the scope loads the whole app before showing "not found" — acceptable; (b) the **install prompt** is
never offered on Welcome/Login (no `beforeinstallprompt` capture) — a one-screen "Add to home" sheet after the first
successful week would lift installs (G9, product lane, needs the head's yes).

---

## 7. Free → Paid: what is wired to the plan (everything found, with the verdict)

| where | constant / branch | free | paid | code change needed? |
|---|---|---|---|---|
| `push.js` | `PER_RUN = 35` phones per minute-run | 10 ms CPU | 30 s CPU | no; could rise to 200 (one setting) |
| `mirror.js` | `ROWS_PER_RUN = 300`, `TRIM_PER_RUN = 500` | same | same | no; paused anyway |
| `erase.js` | `PER_RUN = 40`, `WINDOW = 25` | same | same | no |
| `api.js` | `DAILY_LIMIT` = regex on D1's error text | fires | never fires | no (dead branch, harmless) |
| `api.js` | BUSY never logged; refusal counter sampled | same | same | no |
| `wrangler.toml` | 3 of 5 cron schedules | 5 max | 250 max | no |
| `wrangler.toml` | `[placement] mode = "smart"` | ineffective at this traffic | same | yes — region hint (§3), both plans |
| `wrangler.toml` | no `[limits] cpu_ms` | n/a | default 30 s | no |
| `frontend/lib/api.js` | `busyDelayMs 2000`, `busyRetries 3`, `timeoutMs 15000` | plan-independent | same | no |
| `frontend/lib/tier.js` | tiers from the phone, never from the plan | same | same | no |
| `tests/query-plans.mjs`, `write-audit.mjs` | SQL audits | keep | keep | no |
| N+1 actions (§4.3) | `eligible.list`, `closingPreview`, `board.get` | fail at a few hundred members (CPU / query cap) | slow but succeed | yes — the same aggregation on both plans |

**Verdict: the app is plan-agnostic.** Upgrading is a billing action (the D1 docs: limits lift "typically within
minutes"); no deploy, no config, no code. The only thing that "behaves differently" is which failure mode the N+1
actions show, and those must be fixed regardless. Recommended tidy-up (G5): one `worker/src/limits.js` exporting
`PUSH_PER_RUN`, `MIRROR_ROWS_PER_RUN`, `ERASE_PER_RUN`, `CPU_BUDGET_MS`, read from `env` with the free-plan defaults,
so the day the plan changes is one `wrangler.toml` `[vars]` edit and the tests still run on the free numbers.

---

## 8. Look, feel and copy — every screen, light and dark

Full review: `docs/perf/visual-review-2026-10-22.md`. It covers 36 screens, each at 390 px and 1280 px in light and dark (134 screenshots). Each screen is scored for vibrancy, use of width, hierarchy and "advanced feel". It also gives a ranked ladder, a motion table, the staff-console patterns and the copy to remove. The colour figures below were recomputed independently (CIE L\*, WCAG contrast).

About 12 screens were captured while still loading: coord-stats, coord-leaders, master-activity, master-settings, guru-home, and some dark and desktop shots. Their rows are provisional. The screenshot tool must wait for the first data row before capturing (G20).

### 8.1 Why each theme reads the way it does

**Dark reads flatter than light. There are four measured causes.**
- **Surface steps are too close.** Page, surface, raised and floating are L\* 4.7 / 8.9 / 13.6 / 18.0, about 4.4 apart. The eye needs about 6 to see an edge without a border, so every dark list becomes a slab.
- **Shadows vanish on near-black.** The 1 px border does all the separating work. The `--shine` token (top-edge highlight) exists but no card applies it.
- **The accent is used thinly.** `#78a8ff` appears only on buttons, links and the active nav. Area colours are 6 px dots.
- **Gold is underused.** Gold is the liveliest pixel in dark, yet the decorative gold there is dimmed to `#c99000`. The dark splash and dark Welcome carry no brand blue at all.

**Light reads "paper but plain". There are three measured causes.**
- **Fields look disabled.** Inputs, segmented controls and table headers are filled with the muted `#efe9df` (L\* 92.6, below the paper's 95.6). This is the single biggest light-theme problem.
- **White on paper is a 2.4 L\* step** with a 0.06 shadow, so cards float only by their hairline border.
- **Gold-as-fill turns brown.** Badge and "missing" fills use the text gold `#7a5300`.

**Dead width on desktop.** Hearing, reading and wall are 670 px columns with about 300 px gutters. Report, overview, IYF IDs, coordinators and reopens are 45–70 % empty.

**Must keep.** These parts are excellent today and must not change:
- the painting and quote compositions;
- the light splash;
- the glass drawer and bottom nav;
- the gold rule on the sign-in cards;
- the serif greeting;
- the Requests list-and-detail layout on desktop;
- the "Needs you" / "Decisions" cards.

### 8.2 The vibrancy ladder (ranked by lift ÷ cost; CSS only unless noted)

| # | Change | Values | Tier | Cost |
|---|---|---|---|---|
| 1 | Raised, bordered inputs in light | `--surface-elevated` fill, 1 px `--border-strong` tinted 10 % accent, 3 px `--halo` on focus. Muted fill only for truly disabled fields | all | ≈ 180 B |
| 2 | Dark surface steps 6 L\* apart, plus a top-edge shine | `#0d0b13` / `#1b1826` / `#272339` / `#352f49` = L\* 3.4 / 9.2 / 15.1 / 21.1 (recomputed); border `#3d3752`; cards `inset 0 1px 0 rgb(255 255 255 / .08)` | all (shine on high and balanced) | ≈ 120 B |
| 3 | Gold for fills, brown only for words | fills use `--gold-decorative #f8b000` in both themes; glyph `#3a2a00` (7.4:1); "missing" dot `#c06e00` (3.44:1 on paper, passes 3:1; `#d17a00` fails at 2.9:1) | all | ≈ 90 B |
| 4 | Hero card two-stop gradient (This week, profile header, batch summary) | light `linear-gradient(160deg, accent 14 % over #fff, #fff 62%)`; dark the same at 20 % over the raised surface; border 35 % accent | all (low: flat `--accent-soft`) | ≈ 220 B |
| 5 | Glow ring on today / the active day | high: 3 px halo plus 16 px accent glow; balanced: halo only; low: 2 px solid border | tiered | ≈ 160 B |
| 6 | Gold hairline under section titles | 40 × 2 px, gold to transparent | all | ≈ 110 B |
| 7 | Area colour does real work | active nav item tinted 12 % `--area`; section rule 35 % `--area`; summary tiles get a 3 px `--area` top bar; buttons stay brand blue | all | ≈ 200 B |
| 8 | More chroma for charts in dark | `--viz-*` dark: `#8fb8ff` `#f2c75c` `#5fd6bd` `#c9a6ff`; heat fills `#1f3d1a` / `#4a3a10` / `#4d2420` | all | ≈ 100 B |
| 9 | Light paper one step deeper, cards one shadow higher | `--bg-n #f3eee5`; two-layer `--shadow-1` at 0.08 | all | ≈ 80 B |
| 10 | Report calendar heat tints | cells get `--hi/--mid/--lo`, so the legend finally matches the cells (the band is already computed) | all | ≈ 120 B |
| 11 | Status chips with coloured dots | tinted chip, 7 px dot, `--c` set per state | all | ≈ 200 B |
| 12 | Dark splash and dark Welcome carry the brand | navy radial `#002888` behind the emblem; page `#0f1a3a` fading to the night colour by 45 vh | all | ≈ 140 B |
| 13 | Avatar gradient, gold ring on the profile hero | | all | ≈ 150 B |
| 14 | Progress bars as accent-to-gold gradients, 6 px | | all | ≈ 90 B |
| 15 | Segmented control: white pill on a tinted track (the solid blue pill stays for primary buttons only) | | all | ≈ 140 B |
| 16 | Sign-up stepper: gold done segments, blue current | | all | ≈ 90 B |
| 17 | Desktop layouts that use the width | two columns for hearing, wall and report; 4-up tile grid for reading; card grid for overview; list and detail for IDs, coordinators and reopens (reuses the Requests pattern) | all | ≈ 600 B |
| 18 | Stronger gold stop at the top right of the wash | | high and balanced | ≈ 100 B |
| 19 | Book tiles with a level colour band | | all | ≈ 160 B |

Total: about 3 KB of CSS, no JS, no fonts, no libraries. Contrast must be re-checked after #2, #3 and #9, which is item E2.

**Native-only motion.** Every item is gated by `prefers-reduced-motion` and by tier.
- **Route change:** the old page fades and slides 8 px through View Transitions, 220 ms. High and balanced.
- **Cards entering:** `@starting-style` opacity plus a 6 px rise, 200 ms. High and balanced.
- **Bottom-nav active pill:** slides between tabs with a spring (`view-transition-name`). High only.
- **Header wash:** a scroll-driven fade (`animation-timeline: scroll()`). High only.
- **Week ring:** draws in over 440 ms. High and balanced.
- **Today glow:** pulses once on mount. High only.
- **Desktop row hover:** lifts 1 px. High and balanced.

### 8.3 Staff screens as a modern console (CSS plus about 300 B JS)

1. Density toggle (Comfortable / Compact), remembered on the device.
2. Sticky name column and header, so week columns scroll under the name on a phone.
3. Row hover with an `--area` left bar.
4. Status chips (ladder #11) in place of coloured words.
5. Summary tiles with a week-on-week change and a 7-point sparkline. The last 8 weeks are already in the filling-chart data, so this needs no new request.
6. Segmented filters with counts (All 10 · Not started 3 · Filling 3 · Submitted 4 · Missed 0), filtered on the device with no new request.
7. Table header without the grey band: a 2 px area-tinted rule instead.
8. The week's six dots become a 7-cell heat bar of 48 × 8 px.
9. A colour swatch per batch: SPS blue, DPS gold, BSS teal, BVS violet, TRD saffron, ETP wine.
10. List and detail on desktop for IYF IDs, reopens and coordinators.

### 8.4 Copy to remove (the head, 22 Oct: "no unnecessary texts or descriptions")

Every sentence that explains instead of acting is quoted per screen in the review §5. The only sentences kept are:
- a consequence stated before an irreversible step;
- what happens next.

About **406 words** come off the screens. The largest cuts:

| Screen | Words removed |
|---|---|
| Week (desktop) | 46 |
| Batch setup | 39 |
| Devotee Home | 39 |
| Mixed-role Home | 36 |
| Forgot | 34 |

Examples:
- Devotee Home, the Getting-started card: *"Tap a day and fill it in about a minute: sleep, rounds, hearing, reading and service. Partly filled is fine; finish it later."*
- Forgot: a 41-word paragraph.

Two items are the head's call:
- **The splash tagline** "Every Day, A Step Closer to Kṛṣṇa." The recommendation is to keep it on the splash only.
- **"Your details stay with IYF Delhi"** on sign-up. The recommendation is to replace it with a "Privacy" link.

Separately, Batch setup shows "Level SPS" on every row, which goes against the batch-names rule. Drop the word "Level".

---

## 9. Work this audit adds (neither lane had it) — G1…G12, with an owner

| # | item | lane | release | why / evidence |
|---|---|---|---|---|
| **G0** | **Placement region hint** `[placement] region = "aws:ap-southeast-1"` replacing `mode = "smart"`; verify `cf-placement` on live; record before/after `meta.get` timing and `run_log` averages | S (prompt-5b; `worker/wrangler.toml`) | this one | §3 — every action, one line |
| G1 | Session sliding-expiry `UPDATE` through the raw binding so it does not clear the per-call memo (settings read twice, +1 hop on the hour) | S | this one | §4.5 |
| G2 | The idempotency read (`replies`) rides in the `scopeReads` batch: −1 hop on every write | S | this one | §4.5 |
| G3 | Happy-path tests for `criteria.set`, `reopen.reject`, `auth.logout`, `auth.sessionEnd` | P (prompt-92; tests only) | this one | §4.7 |
| G4 | `_headers`: long cache for `/darshan/*`, `/brand/*`, `/icons/*`; `motion.css`/`contrast.css` into the hashed build | S | this one | §6 |
| G5 | `worker/src/limits.js` — every per-run constant in one place, env-overridable | S | this one | §7 |
| G6 | N+1 aggregation extended beyond `closingPreview` to `eligible.list` and both `board.get` shapes (1 `GROUP BY login` each); parity tests; measured on the load Worker at 625 members | S, **after** P's ADR 0012 on `board.js` | this one | §4.3 — the only calls that can fail on a cap |
| G7 | `leaders.list` reads only the requested batch, not the level (1,875 → ≤ 625 rows) | S | this one | §4.4 |
| G8 | `journals.get`: the client always sends `have`, the server answers `{ unchanged: true }` in 1 hop; `books.chapters` paged | S | this one | §4.2 |
| G9 | "Add to home screen" sheet after the first submitted week (`beforeinstallprompt`, iOS instructions) | P | next (needs the head's yes) | §6 |
| G10 | Per-route Lighthouse in the gate (`tools/perf/lhflow.mjs` from this audit, mobile, every role): budget perf ≥ 90 per route, CLS 0 | S | this one | §5.2 |
| G11 | D1 read replication + Sessions API bookmark header | — | later (needs a second region to matter) | §3 |
| G12 | Copy audit: remove every explanatory sentence listed in §8.4 | S (screens) / P (where the sentence belongs to a product rule) | this one | the head, 22 Oct |

The visual ladder (§8.3) maps onto the existing C1–C10 and is **not** new work; where it widens an item the row in the
tracker says so.

---

## 10. Wiring audit (client ↔ server ↔ mock ↔ routes ↔ chunks ↔ scopes)

Full report: `docs/perf/wiring-2026-10-22.md`, read from the export of `7b7b53b` with a source-mapped build.

**What is sound.**
- Every action the client calls exists on the server.
- Every server write is in the client's write list. The one exception is `push.renew`, which the service worker sends with its own request id.
- Role gates on shared screens hold. For example, a coordinator filling in for a devotee cannot set attendance.
- The startup bundle carries no staff-only code beyond the nav entries (under 1 KB).

**Discrepancies, ranked by impact on people, each now in the tracker with an owner.**

| # | Finding | Verified | Item |
|---|---|---|---|
| 1 | A group leader's My group and the week picker import `lib/staff.js`, which is emitted as `staff-*.js` and so left out of the offline copy. On live, `Group-B2Xg3sRK.js` imports `staff-BLpFaOAZ.js`, which is not precached. The first open after a release with no signal fails; later opens are cached | yes, on live | G13 |
| 2 | No screen opens or closes a phase; cards and scoreboards depend on one | prompt-92: being wired by ADR 0017 (Admin › Phases) | G18 |
| 3 | Promote sheet: the mock has no `devotees.promote` / `promoteOptions` handlers, so the browser checks cannot reach it | — | G15 |
| 4 | A clean checkout builds against the mock (41.6 KB `staff-mock` chunk). Only an uncommitted `.env.production.local` prevents it; release and gate never check `VITE_API_URL` | yes, on disk | G14 |
| 5 | The token is sent to the public `auth.lookup`, `push.register` and `push.unsubscribe` (ignored by the server) | — | G16 |
| 6 | Mock shape and guard drift: no `photoAt` / `photoUpdatedAt`; no request-id or unknown-field refusals | — | G15 |
| 7 | Staff export code (`csv`, `exportfields`) is in every phone's offline copy | — | G17 |
| 8 | Mock roles differ from the server: `reopen.list`, `push.subscribe`, `push.detach` | — | G15 |
| 9 | Dead routing: `/reopens` (unreachable), `/devotees`, `/groups` (redirect only), `/learn` (second address); the signed-out path list is kept twice. Server actions with no screen are being wired by ADR 0017 (prompt-92), and a new test will fail on any action that has no screen and is not on the machine list | partly | G19 |
| 10 | Plan caps are spread over nine files | — | G5 |

**Startup bundle, by source.** Total 58.9 KB gz on HEAD (the release log showed 57.0 KB on 21 Oct; the difference is this tree's newer commits).

| Part | KB gz |
|---|---|
| Svelte runtime | 20.4 |
| `index` | 33.2 |
| `api` | 3.1 |
| Glue | 2.2 |

About **17 KB of `index` is needed only after sign-in**: DevoteeHome 3.3, Shell 2.6, Menu 1.8, nav 1.6, Skeleton 1.4, Home 1.2, pushask 1.1, and the rest. A4's public/shell split could therefore make a signed-out first load about **42 KB**. The single `Devotee` chunk (30.2 KB) serves 7 routes and is the next split candidate after A4.
