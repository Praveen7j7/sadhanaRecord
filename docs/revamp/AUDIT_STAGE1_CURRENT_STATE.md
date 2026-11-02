# Sadhana Record — Stage 1/2 current-state assessment (audit brief response)

**IYF Delhi · 9 October 2026 · documentation only: no app code, styles or server logic were changed to write it**

**What this document is.** A 360° product/architecture/performance audit brief was received. Stage 1 of that brief asks for an evidence-based current-state assessment *before* any recommendations or code changes. This is that assessment.

**The headline finding is that the brief's own first deliverable already exists.** The revamp document set in this folder (8 Oct 2026) is the plan of record and already answers, against verified code, almost everything the brief asks for in Stages 1–5. This document therefore does **not** restate it. It does three things instead:

1. Records what was **independently re-verified** by running the code today (§1–§3).
2. Records the **genuinely new findings** the existing set does not cover (§5).
3. States **what the brief asks for that should be declined or deferred**, and why (§6).

> **Nothing in this document supersedes the approved revamp set.** `README.md` remains the entry point; `IMPLEMENTATION_ROADMAP.md` remains the order of work.

---

## 1. Verification run today (9 Oct 2026)

Everything below was executed in `sadhanaRecord-revamp/`, not read from a document.

| Check | Command | Result |
|---|---|---|
| Server test suite | `worker/ node tests/run-all.mjs` | **20 suites, 1,735 assertions, all passed** |
| App unit tests | `frontend/ npx vitest run` | **21 files, 311 tests, all passed** |
| Size budgets | `frontend/ npm run size` | **OK: within budget** — startup JS **54.89 KB**, CSS **13.42 KB**, largest lazy chunk (Devotee) **28.83 KB** |
| Query-plan audit | `worker/ node tests/query-plans.mjs` | 500 distinct statements, **18 scan a growing table** |
| Write audit | `worker/ node tests/write-audit.mjs` | 204 write statements: **186 keyed, 18 mass** |

**Confidence: high.** These are my own runs, not quoted figures.

**One correction to the progress document.** `REVAMP_PROGRESS.md` records Phase 4 app unit tests as **307**; the suite now reports **311**. Four tests have landed since the note was written. The document should be updated to 311 — no other discrepancy was found between the documents and the code.

---

## 2. Technology stack (verified from manifests, not assumed)

| Layer | Actual | Evidence |
|---|---|---|
| Frontend | **Svelte 5.57**, Vite 8.3, Tailwind 4.3, `vite-plugin-pwa` 1.3 | `frontend/package.json` |
| Tests / tooling | Vitest 5, `puppeteer-core` 23, Lighthouse 12.8, Wrangler 4.147 | same |
| Backend | **Cloudflare Worker**, plain JS, **no framework**, ~5,132 LOC across 30 modules | `worker/src/*.js` |
| Database | **Cloudflare D1** (SQLite), **31 migrations** (`0001`–`0031`) | `worker/migrations/` |
| Fonts / third party | **zero** web fonts, **zero** third-party scripts | `PERFORMANCE_SEO_ACCESSIBILITY.md` §2.2, confirmed in `index.html` |

**Dependency discipline is real and worth protecting.** The entire product ships with no runtime dependencies beyond Svelte itself. This is the single biggest reason the startup bundle is 55 KB rather than 500 KB, and it is why most "add a library" recommendations in the brief must be refused.

---

## 3. Where the work actually stands

| Phase | State | Verified how |
|---|---|---|
| 0 — trust + store blockers | **LIVE** (release phase 11, 8 Oct) | `PHASE0_RELEASE.md`; `sadhanaRecord/` has migrations to `0030` only |
| 1 — design-system foundation | Built, not live | `REVAMP_PROGRESS.md`; tests re-run today |
| 2 — shell and navigation | Built, not live | same |
| 3 — sign-in and sign-up | Built, not live | `frontend/src/ui/Darshan.svelte`, `public/darshan/` exist only in the revamp copy |
| 4 — devotee core | **Built 9 Oct, not live** | `ui/FirstRun.svelte` + migration **`0031_deadline_reminder.sql`** exist only in the revamp copy |
| 5–9 | **Not started** | no corresponding components or migrations |

**The two-folder split is correct and must be preserved.** `sadhanaRecord/` is byte-for-byte what is live (for urgent fixes); phases 1–8 are built in `sadhanaRecord-revamp/` and release together after one full test. This matches `REVAMP-COPY.md` and the documented testing decision.

**Confidence: high.** Phase status was checked by the presence/absence of the specific files and migrations each phase introduces, not by trusting the progress note.

---

## 4. What the existing revamp set already covers

The brief asks for 11 deliverables (A–K). These already exist, verified against code and the live build:

| Brief asks for | Already exists as |
|---|---|
| A. Executive assessment, E. Route-by-route UI/UX audit | `UI_UX_360_REVAMP.md` §15 (360° gap analysis); `ROUTE_BY_ROUTE_REVAMP.md` (179 KB, every route × every login, per screen size) |
| C. Feature and role matrix | `FINAL_FEATURE_MATRIX.md` §A–L — existing features, proposed features, route matrix, component matrix, **169 requirements** traced from older documents |
| D. World-class benchmark matrix | `UI_UX_360_REVAMP.md` §2 ("Why does Facebook feel more alive…"), §6, §7 |
| G. Performance and SEO report | `PERFORMANCE_SEO_ACCESSIBILITY.md` §1 measured baseline, §2 contract + budgets, §3 WCAG 2.2 AA, §5 SEO |
| H. Role-specific product proposals | `UI_UX_360_REVAMP.md` §10; roadmap phases 4 (devotee), 5 (leader/facilitator/coordinator), 6 (admin) |
| I. Unified implementation roadmap | `IMPLEMENTATION_ROADMAP.md` — 10 phases, dependencies, classification, regression rules |
| J. Testing and acceptance framework | `IMPLEMENTATION_ROADMAP.md` §5 + `PERFORMANCE_SEO_ACCESSIBILITY.md` §6 |

**Implication: re-running the audit from scratch would produce a second, competing set of documents** — which the brief itself forbids (rule 12, and its own §13 "do not create a competing roadmap"). The correct action is to append the few new findings below to the existing documents.

---

## 5. New findings the existing set does **not** cover

These are the audit's actual output. Each was verified today.

### 5.1 P1 — `audit_log` and `run_log` grow without bound, and are scanned

> **Resolved 9 Oct 2026 (IYF).** Retention is **6 months by default, changeable by the head in Settings**, with the Sheets log tabs trimmed to match (the one agreed exception to additive-only). It is Phase 9 Stage B item 11 in `REVAMP_PROGRESS.md`; the bounded delete is being written there. The finding below stands as the evidence; it is no longer an open question for IYF.
>
> **One correction to the proposal below:** an index on `at` is probably *not* the fix. Neither table has any index today, and the Activity query (`src/coord.js:741-749`) builds its `WHERE` dynamically and always ends `ORDER BY id DESC LIMIT ?` — on the default screen that walks the `INTEGER PRIMARY KEY` backwards and stops early. The genuinely unbounded statement is `SELECT COUNT(*) FROM audit_log` (no `WHERE`, no `LIMIT`). Retention caps all of them; if an index is still wanted, `(action)` and `(who)` match the real filters better than `(at)`.

**Evidence.** The query-plan audit flags `SCAN audit_log` for three statements, including `SELECT COUNT(*) … FROM audit_log` and `SELECT … FROM audit_log WHERE action LIKE ? ORDER BY id DESC LIMIT ?`. A search for pruning (`DELETE FROM audit_log` / `DELETE FROM run_log`) across `worker/src/*.js` returns **nothing** — only `counters` is expired (`src/index.js:94`) and only erase-on-request touches a user's rows (`src/erase.js`).

**Problem.** Every privileged action appends a row forever. The Activity screen's `LIKE` filter and the `COUNT(*)` both scan the whole table. Rows read is the free plan's 5 M/day limit, and `audit_log` is the one table that grows monotonically with *staff activity* rather than with devotee count — so it is not covered by the devotee-count thresholds in `load-test-report.md` §9b.

**Why it is not urgent today.** At current volumes the table is small, and the live Activity screen is admin-only and low-traffic. This is a slow leak, not a present outage.

**Proposed.** (a) A retention step in the existing minutely scheduled job — keep N months of `audit_log` and N weeks of `run_log`, deleting a bounded batch per run (the pattern already used for views and `mirror_log`, so it adds no new machinery). (b) Replace the `LIKE` + `COUNT(*)` on the Activity screen with a keyed/indexed filter. **Retention period is an IYF decision** (audit trails may have a policy minimum).

**Feasibility.** High — reuses the bounded-step scheduled job and the free-plan rules in the `sadhana-free-plan` skill. **Fits Phase 6** (which already rebuilds the admin Activity screen in plain words), with the retention step able to go earlier if IYF wants.

**Validation.** `node tests/query-plans.mjs` shows no `SCAN audit_log`; a test asserts rows older than the window are gone and newer rows survive.

### 5.2 P2 — eighteen mass writes and eighteen growing-table scans are accepted but undocumented

**Evidence.** Today's audits: 18 of 204 write statements are `MASS`, and 18 of 500 statements scan a growing table.

**Assessment: most are legitimate.** They fall into three groups, and the distinction matters more than the raw count:
- **Account erasure** (`post_comments`, `post_likes`, `post_mutes`, `post_reports`, `replies`, `counters`) — deliberately deletes everything for one person, is rate-limited by being user-initiated, and is required for the Play Store deletion commitment.
- **Rename/reassign cascades** (`memberships.set_by`, `leaders.appointed_by`, `attendance.changed_by`) — rare admin actions.
- **Genuinely periodic** (`drafts` cleanup, `reopens` expiry) — bounded by week.

**Problem.** Nothing records *which* mass writes are approved and why, so the audits emit 18 lines every run and a genuinely new offender would not stand out. That is how the classic `attendance (week_id, batch_id)` miss happened before.

**Proposed.** An allow-list with a one-line justification per statement, so the audits fail on anything *new*. Cheap, and it turns two noisy reports into real gates. **Fits Phase 8** (hardening), alongside the existing gate work.

### 5.3 P2 — no `robots.txt` and no sitemap exist yet

**Evidence.** `frontend/public/` contains `404.html`, `_headers`, `brand/`, `contrast.css`, `darshan/`, `delete-account.html`, `icons/`, `legal.css`, `privacy.html`, `push-sw.js` — and **no `robots.txt`, no sitemap**.

**Assessment.** Already scheduled in **Phase 8** (`robots.txt` / sitemap / canonical, per-route titles), so this is confirmation rather than a new task. **Current exposure is low, not zero:** the app is a hash-routed SPA (`#/…`), so private routes are not separately crawlable, `Referrer-Policy: no-referrer` and a strict CSP are set in `public/_headers`, and all private data sits behind the Worker API. The missing piece is the explicit directive, not an active leak.

**One correction to the brief's framing.** The brief treats SEO as a significant workstream. For this product it is close to a non-issue: there is **one** public surface (Welcome/sign-in, plus the `privacy.html` and `delete-account.html` pages the stores require). Everything else is authenticated. Phase 8's scope — robots, sitemap, canonical, per-route titles — is the right size. Server-side rendering would be unjustified.

### 5.4 Confirmed, with a caveat — the brief's 1,000 → 100,000 growth target

**Evidence.** `grep` for `100,000` / `100k` / `scalab` across the revamp set returns **nothing**: the revamp documents are silent on scale, by design. The capacity work lives in `docs/load-test-report.md`, which is measured, and in the `sadhana-free-plan` skill.

**What is actually proven** (`load-test-report.md`, 2,000 seeded test devotees):
- The ceiling is **D1, not the plan**: ~**35–38 calls/second**, because D1 answers one query at a time and each screen asks 15–17 queries. Refusals begin ~80/s.
- 5,000 devotees in the 9 PM rush may reach **15–30 calls/second** — close to that ceiling.
- Documented position: comfortable to ~**4,500** devotees, at the line at 5,000.
- One caution already recorded: test timings are pessimistic (test DB in Seoul, live in Singapore).

**The conflict to put to IYF plainly.** The brief asks to plan toward **100,000** devotees. The standing IYF decision (the head, 3 Oct 2026) is to **stay on the free plan for 2,000–5,000** and upgrade only when the numbers require it. These are not reconcilable by engineering:

- 100,000 devotees is **~20× the current ceiling target**. It cannot be reached by indexes or caching. It needs read replication or sharding, and a paid plan.
- **I recommend keeping the 5,000 target.** It is the approved decision, it is backed by measurement, and the honest next step is already written down: `load-test-report.md` §9 lists **"fewer queries on the home and week screens (15–17 each)"**, which "roughly doubles the 35–38 calls-a-second ceiling". That is the highest-value scalability work available, it needs no plan change, and it buys real margin at 5,000.
- The upgrade path is already costed and needs **no code change**: Workers Paid, US$5/month, flat to ~10,000 devotees.
- **100,000 should be treated as a separate architecture decision for IYF**, not folded into a UI revamp. Designing for it now would mean building for a 20× load that may never arrive, against an explicit instruction to stay free — the clearest case in this audit of a brief requirement that should be declined rather than silently obeyed.

**Also still open from §9:** the **5,000-devotee re-test** (the 2,000 test consumed that day's quota; it must run after the 05:30 IST reset). That is the one measurement that would confirm or refute the 5,000 position, and it is unverified today.

### 5.5 Note — a real operational risk already identified, worth restating

`load-test-report.md` §6: free-plan daily limits reset at **00:00 UTC = 05:30 IST**. The evening rush is 9–11 PM IST, late in that UTC day, so a limit crossed on an unusual day takes the app down **for the rest of the night** — precisely when devotees fill and submit. This is correctly handled by setting §9b's thresholds well below the limits. Flagging it because it is the highest-consequence operational risk in the system and it is invisible from the revamp documents.

---

## 6. What I recommend declining or deferring from the brief

Stating these explicitly, since the brief asks for a cross-functional audit and silence would imply agreement.

| Brief item | Recommendation | Why |
|---|---|---|
| Plan for 100,000 devotees (§7) | **Decline as a revamp input**; raise as a separate decision | Contradicts the 3 Oct free-plan decision; 20× the measured ceiling; needs architecture, not optimization (§5.4) |
| Significant SEO workstream (§8) | **Reduce to Phase 8's existing scope** | One public surface; everything else authenticated; SSR unjustified (§5.3) |
| Re-run the full audit and produce deliverables A–K (§15) | **Decline**; append findings to the existing set | The set exists, verified against code; a second set would create the contradictory sources of truth the brief's own rule 12 forbids (§4) |
| Benchmarking sweep across ~10 named products (§2) | **Already done** in `UI_UX_360_REVAMP.md` §2/§6/§7 | Re-doing it adds documents, not decisions |
| New observability tooling (§11) | **Defer**; keep `run_log` + telemetry-to-health (Phase 6) | Zero third-party scripts is a core budget rule; external telemetry would break it and add privacy surface |

---

## 7. Recommended next actions

In order, and all of them small:

1. **Correct `REVAMP_PROGRESS.md`** Phase 4 unit-test count: 307 → **311** (§1).
2. **Put §5.4 to IYF as a decision:** confirm the 5,000-devotee target stands, or commission a separate scaling study. *Blocking for any scale work; nothing else waits on it.*
3. **Add the new findings to the existing documents** rather than a new roadmap. **§5.1 is resolved** (6 months, head-changeable; Phase 9 Stage B). §5.2 (the mass-write allow-list) is still open and pairs naturally with that retention work. §5.3 is **closed**: `robots.txt` and `sitemap.xml` went live with release phase 12 on 9 Oct, the sitemap correctly listing only the three public URLs.
4. **Continue Phase 5** (group leader / facilitator / coordinator) as the roadmap already specifies. It is the next phase, its dependency (Phase 4's shared components) is built, and nothing in this audit changes its content.
5. **Schedule the 5,000-devotee re-test** after an 05:30 IST reset, plus the home/week query-count reduction from `load-test-report.md` §9 — the one genuine scalability win available without a plan change.

---

## 8. Evidence and confidence summary

| Finding | Confidence | Basis |
|---|---|---|
| Test suites pass; budgets within target | **High** | Run today (§1) |
| Phase 0 live, 1–4 built, 5–9 not started | **High** | File- and migration-level checks (§3) |
| Stack and zero-dependency discipline | **High** | Manifests + `index.html` (§2) |
| `audit_log` / `run_log` unbounded and scanned | **High** | Audit output + absence of any pruning statement (§5.1). **Resolved 9 Oct: 6-month retention decided** |
| Mass writes mostly legitimate | **Medium-high** | Statement-by-statement reading; not load-tested per statement (§5.2) |
| No robots/sitemap; low SEO exposure | **High** | Directory listing + `_headers` + CSP (§5.3). **Closed 9 Oct: both live, verified on production** |
| D1 ceiling ~35–38 calls/s; comfortable to ~4,500 | **Medium** | IYF's measured 2,000-devotee test; **5,000 re-test still outstanding**; timings pessimistic (§5.4) |
| Lighthouse 97–99 / LCP / FCP figures | **Medium — quoted, not re-run** | `PERFORMANCE_SEO_ACCESSIBILITY.md` §1; I did not re-run Lighthouse today |

**Explicitly unverified by me:** Lighthouse and Core Web Vitals numbers (quoted from IYF's runs); the 1,665 browser checks and the 528-screenshot route sweep (not re-run — they need a dev server and a long run); real-device Android/iOS behaviour; any production field data, which does not exist yet.
