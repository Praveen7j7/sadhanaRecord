# Performance — Sadhana Record

**12 October 2026.** Every number below is marked **measured** (with its date and source) or **estimate**. Nothing
was rebuilt or deployed to write this; the local `dist/` (build 2026.10.12-0813) is one unreleased build newer than
production (2026.10.12-0740, `index-GhbDDMJs.js`), from the same source apart from three files.

## 1. Baselines

### App (measured 12 Oct 2026, `node scripts/size.mjs` over `frontend/dist`, gzip)

| Metric | Value | Budget / target | Status |
|---|---|---|---|
| Startup JS (7 files: index, index-client, api, pro.svelte, preload-helper, runtime, disclose) | **55.03 KB** | 60 / 55 | WARN, 30 bytes over target |
| Startup CSS | **13.77 KB** (+0.88 KB `contrast.css`, conditional) | 15 / 13.5 | WARN |
| Largest lazy chunk (`Devotee`) | **28.83 KB** | 35 / 30 | OK |
| Other lazy: `staff-Admin` 27.3, `Wall` 12.1, `staff-Batch` 9.6, `ExportButton` 8.6, `staff-DevoteeDetail` 8.5, `quotes` 8.0, `staff-Requests` 7.1, `SignUp` 6.5, `WeekRead` 5.6 KB | | | |
| All JS + CSS raw / gzip | 899 KB / 279 KB in 124 files (83 js, 41 css; 8 `staff-*`) | | |
| **Precache** (`dist/sw.js`) | **125 entries, 757 KB** uncompressed; 68 non-startup JS chunks precached | 850 KB (800 until 28 Oct 2026, the head) / 700 KB target (`modernization-audit.md` §18) | under budget, **not enforced by any script** |
| `dist/` on disk | 120 MB, of which `darshan/` 118 MB (843 files, served on demand, never precached) | | copied on every build |
| Fonts | system stacks, no `@font-face` | | keep |

### App (quoted; the raw reports are **not stored** anywhere)

| Source | Date | Figures |
|---|---|---|
| `docs/modernization-audit.md:25-30` (Lighthouse mobile, Moto G, slow 4G) | 4 Oct | Welcome perf 92, a11y 100, FCP 2.1 s, LCP 2.6 s, TBT 10 ms, CLS 0, 146 KB; Login 98, FCP 1.9, LCP 1.9 |
| `sadhana-browser-checks` skill, `stakeholder-brief.md:170` | "3 Oct" | perf 96–98, a11y 100, 144 KB |
| `docs/revamp/PERFORMANCE_SEO_ACCESSIBILITY.md:18-19` | 8–11 Oct | mobile 97/97, FCP 1.9–2.0 s, LCP 2.1–2.3 s; desktop 99/100/100/100 |

Three documents, three different scores for the same days. `tools/perf/lighthouse.sh` writes `/tmp/lh.json` and
overwrites it per URL; no JSON is committed. **Treat the Lighthouse baseline as unverified until a report is stored.**

### API (measured 3 Oct 2026, load test on the separate `sadhana-load` Worker + D1 in Seoul, 2,000 seeded devotees — `docs/load-test-report.md:88-142`; raw in `loadtest/out/`)

| Action | Client wait p50 | CPU p50 / p95 | Queries | Rows read |
|---|---|---|---|---|
| `meta.get` | — | — | — | — |
| `home.get` | 1.6 s | 8 ms | 15 | 25 |
| `week.saveDay` | — | — | — | — |
| `week.submit` | 3.7 s | 9 ms | 23 | 36 (9 written) |
| `devotees.list` | — | 13 ms (final run: 19 / 27) | — | 1,986 (final: 2,880) |
| `stats.batch` | — | 16–27 ms | — | 4.4–7.9 k |
| `members.list` | — | — | — | 13.3 k per page |
| `stats.all` | 5.2 s | **55 / 62 ms** (final run three minutes later: **74 / 83 ms**) | 86 | **14,609** (final: **27,409**) |

Ramp: 10/s → 100 % ok, p50 2.1 s; 20/s → 100 %, 3.9 s; 40/s → 100 %, 8.2 s; 80/s → 96 %, 21.9 s; ceiling about
35–38 calls a second. Monday deadline job: 1,795 weeks at 100 a minute in 18 runs, **8–16 ms CPU per run (median
11)**. D1 Time Travel restore: 4 s; export 7.5 MB in 7 s.

**Caveats found in the stored data:** the published table matches `summary-profile-memo.json` (11:30); the final
`summary-profile.json` (11:33) is worse for `stats.all` and `devotees.list` (figures in brackets). The 5,000-devotee
re-test the report calls "still to prove" was never run. A 10 Oct re-run (`profile.jsonl`, 267 calls, no CPU
capture) shows client p50s of `home.get` 1.5 s, `week.get` 1.65 s, `saveDay` 1.48 s, `stats.all` 5.1 s, and every
`saveWeekEnd`/`attendance.set` call failing `FUTURE_DAY` (the load clock was not on a weekend), so those were not
re-measured. Latencies include Seoul → test DB; live uses Smart Placement, whose benefit from India is **unverified**.

### Scheduled jobs (measured / computed)

| Item | Value | Source |
|---|---|---|
| Cron invocations a day | 1,860 (1,440 + 240 + 180) | `wrangler.toml:34` |
| Idle minutely run D1 reads | ~60–80 rows → ~100 k/day of the 5 M budget | computed from the queries in `index.js`, `mirror.js`, `weeks.js` |
| Sheets copy throughput | 300 log entries a minute; a 5,000-entry burst ≥ 17 min | `mirror.js:132` |
| Monday copy pause | 10–40 minutes at 5,000 devotees while the deadline step "continues" | `index.js:85`, `weeks.js:405` (estimate from the 3 Oct run rate) |
| Worst-case outbound calls in one run | ~48 with three Sheets files touched, ~58 with five | computed (limit 50, not enforced) |

## 2. Bottlenecks

| # | Class | Where | Evidence | Fix shape |
|---|---|---|---|---|
| P-1 | **Measured bottleneck** | `stats.all` (`coord.js`) | 55–83 ms CPU, 14.6–27.4 k rows per call against a 10 ms free-plan cap; grows with devotees × weeks | the audit's own plan ("a cron keeps an overview summary") is not done; a `stats_cache` row per batch refreshed in the minutely run, or a bounded `weeks` window |
| P-2 | **Measured bottleneck** | `stats.batch`, `devotees.list`, `members.list` | 2–13 k rows per call | per-batch summary rows; `members.list` count query only on page 1; index `registry(phone)` |
| P-3 | Probable, needs measurement | the minutely run on Sunday evening | reminders + mirror in one invocation ≈ 48–58 outbound calls | run-scoped counter; see `INTEGRATIONS.md` J2 |
| P-4 | Probable, needs measurement | Monday deadline | copy paused for the whole deadline run | let the mirror run after each deadline step |
| P-5 | Probable, needs measurement | `registry` table | ~1,600 rows loaded whole by four staff actions, joined on `phone` with no index | `CREATE INDEX registry_phone ON registry(phone)` |
| P-6 | Probable, needs measurement | `requests.approve` / `ids.link` | a full Google tab read inside the request for an unknown ID (`registry.js:208-211`) | return `UNKNOWN_ID`, let the 30-minute refresh catch up |
| P-7 | Probable, needs measurement | `Report.svelte:54-59` | up to six `week.get` calls per month view | per-day percents in `history.list`, or `weeks.getMany` |
| P-8 | Probable, needs measurement | precache on devotee phones | ~75 KB raw of staff-only code (`WeekRead`, `Export*`, `Reopens`, staff CSS) | widen the `staff-` chunk test |
| P-9 | Maintainability | `mirror_*_upd` triggers | fire on `accounts.failed_tries`/`last_login_at` on every login → a Sheets row rewrite per login | `LOG_WHEN` guard for bookkeeping columns |
| P-10 | Maintainability | PBKDF2 10,000 iterations (`auth.js:21`) | below current guidance; raising it may exceed 10 ms CPU | measure `hashPassword` at 50 k / 100 k on the load Worker, then set `pbkdf2_iterations` |
| P-11 | Maintainability | startup budgets | JS 55.03 / CSS 13.77 KB, both at their targets | the next startup import flips WARN to FAIL; plan it |

## 3. Budgets (proposed; the existing ones kept)

| Surface | Budget | Enforced by |
|---|---|---|
| Startup JS / CSS (gzip) | ≤ 60 KB / ≤ 15 KB (targets 55 / 13.5) | `scripts/size.mjs` (exists) |
| Largest lazy chunk | ≤ 35 KB | `size.mjs` (exists) |
| Precache | ≤ 850 KB (the head, 28 Oct 2026; was 800), ≤ 130 files, no `staff-*`, no `darshan/` | **new** check in `size.mjs` or `tests/precache.test.js` |
| Lighthouse mobile (Welcome, Login) | perf ≥ 90, a11y 100, CLS 0, LCP ≤ 2.5 s on Moto G / slow 4G | weekly `lighthouse.sh` with the JSON committed under `docs/perf/` |
| Hot API actions (`home.get`, `week.get`, `saveDay`, `submit`, `auth.me`) | ≤ 10 ms CPU, ≤ 50 rows, ≤ 25 queries | harness timing guard + `audit:sql` |
| Staff list actions (`devotees.list`, `stats.batch`, `members.list`) | ≤ 15 ms CPU, ≤ 3,000 rows | same, after P-2 |
| `stats.all` | ≤ 15 ms CPU after P-1 | same |
| Minutely cron | ≤ 45 outbound calls, each step bounded | run-scoped counter (new) |
| D1 daily | stay under 70 % of 100 k writes / 5 M reads at 5,000 devotees | monthly usage read (manual today) |

## 4. Adaptive tiers (exists; keep)

`frontend/src/lib/tier.js` decides `high` / `balanced` / `low` from memory, cores, pointer, screen, connection,
battery and measured scroll jank (remembered 14 days). Low tier: no view transitions, no blur or glass, `motion.css`
not loaded, flat wheel, no darshan images, fewer rotator changes; reduced motion honoured everywhere. Data saver
disables idle prefetch. No change recommended beyond measuring the jank threshold on a real low-end phone.

## 5. How to measure (procedures)

1. **App size:** `cd frontend && npm run build && npm run size`; precache: `node -e` over `dist/sw.js` (to be added).
2. **Lighthouse:** `sh tools/perf/lighthouse.sh`, then copy `/tmp/lh.json` to `docs/perf/lh-<date>-<page>.json`.
3. **SQL per action:** `cd worker && npm run audit:sql` (plans and mass writes); `node tools/perf/sqltrace.mjs` for
   `auth.me`/`home.get` statement lists.
4. **CPU and rows per action:** the load Worker (`npx wrangler deploy --env load`, `loadtest/README.md`) with
   `LOAD_METER=1`; join `wrangler tail` CPU with `loadtest/analyze.py`; set `LOAD_CLOCK_SKEW_MS` to a weekend before
   measuring `saveWeekEnd`/`attendance.set`.
5. **View-sheet CPU:** `node tools/perf/viewcpu.mjs 5000`.
6. **Live usage:** Cloudflare dashboard (requests, D1 rows read/written, CPU errors); thresholds in
   `load-test-report.md` §9b (plan upgrade at 70 k requests / 70 k writes / 3.5 M reads a day).

Only run heavy load tests early in the IST day: the D1 daily read budget is account-wide and resets at 05:30 IST.

---

## Phase 5 — measured, 13 October 2026

### Precache (measured, `npm run size`)

| | Before | After |
|---|---|---|
| Entries | 118 | **111** |
| Size | 692.9 KB | **645.7 KB** |
| Staff-only files in it | 5 (33.8 KB) | **none** |

The budget is **enforced** now (800 KB, target 700 KB), and the check also fails if a staff-only file or a darshan
painting appears in the precache, naming the file and the fix. Verified by removing the rule: the build reports
`staff-only files are in the precache … assets/Reopens-*.js` and exits non-zero.

The staff rule is derived from the source folder (`coord/`, `master/`, `fac/`, the dev mock, and the three `ui/`
files only staff screens open) rather than from a list of names, which is why the earlier fix missed five files.
One case still needs the name: a chunk imported by **two** staff screens is emitted with no `facadeModuleId`.

### The Report screen's month (measured by reading the code path)

Opening a month used to cost **one `week.get` per submitted week in view** — up to six round trips, each a whole
week of answers and marks, when the calendar needed seven numbers per week. `history.list` now carries `dayPct`,
computed in SQL from the marks already in `week_json`, so a month costs **one request** and opening a week costs
one more. The percentages were checked against `shared/scoring.js` `dayPercent()` on the same week
(63,23,47,0,0,0,0 both ways) and are pinned in `worker/tests/weeks.test.mjs`.

### Password hashing (measured, `node tools/perf/pbkdf2.mjs`)

| Iterations | ms per hash (maintainer's Mac) |
|---|---|
| 10,000 (current default) | 0.78 |
| 25,000 | 1.82 |
| **50,000 (recommended)** | **3.54** |
| 100,000 (the code's cap) | 7.08 |

This is the measurement finding F13 asked for. The cost is linear. 10,000 is below current guidance for PBKDF2
alone, but every password is first keyed with a server-only pepper, which is what actually stops an offline attack
on a stolen database — without `PW_PEPPER` an attacker cannot test guesses at any iteration count. Raising the
count buys defence in depth if the pepper ever leaks.

**Recommendation: 50,000.** It triples the work per guess for ~3.5 ms, leaving room in the free plan's 10 ms
per-request CPU budget for the rest of a sign-in. Existing hashes upgrade as people sign in. It is a settings
change, not a deploy: `settings.update { pbkdf2_iterations: "50000" }`. **Re-measure on the load-test Worker
first** — a Worker is slower than a laptop, and `wrangler tail` reports the real CPU per call.

### Still unmeasured

**Lighthouse (5.5) was not run.** It measures the **live** app, and nothing from phases 1–5 is deployed, so a run
today would score the 12 October build and tell us nothing about this work. Run `sh tools/perf/lighthouse.sh` after
the release and commit the JSON under `docs/perf/`, which is what makes the three conflicting historical scores
auditable at last.
