# How Sadhana Record was built

**IYF Delhi · development history, technology choices, scaling path and edge cases · 3 October 2026**

Written for IYF Delhi's leaders and for whoever maintains the app next. It records what was built, what was tried and dropped, and why. It also covers how the app can grow, including moving to a PostgreSQL database, and the cases still to handle.

---

## 1. In one page

- **What it is.** A phone-first web app (a PWA: installed from the browser, no app store) where devotees fill their daily sadhana. Coordinators run their batches in it; the IYF head oversees everything. Data flows into Google Sheets for people who work in sheets, and later into the facilitator dashboard.
- **What it runs on.**
  - A Cloudflare Worker (the server) with a Cloudflare D1 database (the main copy of the data).
  - The app itself is served by Cloudflare.
  - A Google service account copies the data into Google Sheets.
- **What it costs.** Nothing, on Cloudflare's free plan. That plan carries IYF Delhi comfortably up to **about 4,500 devotees** after the phase-6 hardening (with drafts and attendance copied to the sheets within a minute). Cloudflare's US$5-a-month plan is the step up when the numbers say so (section 7).
- **How it was built.** In phases, each tested before going live:
  - about 1,330 server checks, 136 app tests and 1,240 browser checks;
  - a load test on a separate server;
  - a security review, a backup drill and a low-end phone check.
- **What changed course.**
  - The first server (Google Apps Script) was too slow, at 1.5–12.5 seconds a call; it was replaced the same day by Cloudflare (0.1–0.3 s).
  - Google Sheets stopped being the database and became a live copy.
  - Copying to the sheets moved from "rewrite everything" to "only what changed".

---

## 2. Timeline

| Date (2026) | Step |
|---|---|
| 26 Sep | First plan: a coordinator-only entry screen writing into one Google Sheet (`sadhana-entry-sheet-plan.md`). Replaced by the devotee app. |
| 2 Oct | **Design agreed** (`sadhana-app-design.md`, decisions 1–33) and API contract written before any code (`sadhana-api-contract.md`). |
| 2 Oct | **Phase 1** live on Google Apps Script: sign-up, login, approval. Measured at 1.5–12.5 s a call, so the server moved to a **Cloudflare Worker + D1** the same day. Apps Script retired (`backend/`, kept for reference). |
| 2 Oct | **Phase 2:** the Excel score cards turned into code (`shared/scoring.js`, 313 checks against the cards). **Phase 3:** the weekly sadhana form, the submit window and the Monday deadline, live. |
| 3 Oct | **Phase 4:** coordinator and IYF-head screens, announcements, attendance, view sheets, the 9 PM reminder, the full design revamp, the official IYF logo. |
| 3 Oct | **Phase 6:** hardening (section 6). |
| 3 Oct (evening) | **Group leaders and attendance levels** (decision 41): Sunday class for all, week-end answers from Saturday 6 PM, head › coordinator › leader › devotee, conflict notifications; postal address and contact details in Account; blood-group filter; the submitted week as one compact JSON (decision 42); quotes on signed-in screens rotate per phone without repeats. |
| 4 Oct | **Facilitators, posts and wheels:** facilitator logins (read-only "My students", reports by week and day, WhatsApp chat); viewing someone's sadhana separate from filling it (facilitators view, coordinators fill only the open week, the head any week); posts with likes, comments and a WhatsApp share whose link opens that post (`#/wall?post=<id>`); valid addresses (state list, Delhi districts, PIN must match the state); class day changed in Account; "Is this number on WhatsApp?" right after the mobile number; every list choice on a 3D wheel (`ui/Wheel.svelte`, `ui/WheelSelect.svelte`, and the time picker on the same wheel). Later the same day: **part weeks** (decision 45: the complete days count, the score is capped by them, the deadline submits what is complete, a week with no complete day is missed and scores 0); Account details locked until a section's pencil is tapped (`ui/EditSection.svelte`); the typed hearing topic above the lecture list. |
| Later | **Phase 5:** the bridge into the dashboard. Until then the dashboard keeps its current method. Then **phase 7** (pilot, SPS Group 2) and **phase 8** (roll-out). |

---

## 3. The technology, and why each piece

| Part | Choice | Why |
|---|---|---|
| App | **Svelte 5 + Vite**, one app for every role; staff screens loaded only for staff | Smallest code for the speed: the first screen is about 59 KB, important on ₹6–8K phones and slow 4G |
| Installing | **PWA** (Add to Home Screen) with a service worker: works offline, updates itself | No Play Store or App Store accounts, reviews or fees; one link for every phone |
| Look | **Tailwind CSS**, the phone's own fonts, light and dark themes, a royal-purple brand before sign-in and role colours after | Small, consistent, accessible (Lighthouse accessibility 100) |
| Server | **Cloudflare Worker**, one endpoint, about 77 named actions (`worker/src/api.js`) | Fast (0.1–0.3 s), free plan, no server to maintain, runs close to India |
| Database | **Cloudflare D1** (SQLite), APAC region | Same free plan; real queries, indexes, transactions; point-in-time restore for 7 days |
| Sheets | **Google Sheets API** with a service account (`iyf-delhi@sadhanareport`) | People who work in sheets see the data; the dashboard and its import stay unchanged |
| Scoring | One file, `shared/scoring.js`, used by the server *and* the app | Live marks on the phone always equal the stored marks |
| Passwords | PBKDF2-SHA-256 with a salt and a secret pepper | Never stored or shown in readable form; a standard Web Crypto algorithm |
| Sign-in | Phone number + own password; 30-day sessions | No Google or email login (decision 1); no ID documents of any kind |
| Reminders | **Web Push** (VAPID), empty pushes; the phone asks what to show | Free, no SMS cost, no message content leaves the server |
| Tests | Node tests against a real SQLite (`worker/tests`), Vitest (`frontend/tests`), puppeteer browser checks (`tools/browser/verify.mjs`) | Every rule tested before release; browser checks at 10 screen widths |
| Releases | `wrangler deploy` (server), `npm run release` (app: tests, size budget, deploy, then a check that open apps update themselves) | One command each; nothing ships if a check fails |

---

## 4. What was tried and dropped, and why

| Tried | What happened | Settled on |
|---|---|---|
| **Coordinator-only entry into one Google Sheet** (26 Sep plan) | A sheet saves every cell as it is typed, so it can't refuse a half-filled week. Coordinators would type for everyone. | A devotee app where each person fills their own week; only complete weeks are accepted |
| **Google Apps Script as the server** | Worked, but every call took 1.5–12.5 s because of Google's own start-up time, even when our code needed under a second | Cloudflare Worker: 0.1–0.3 s |
| **Google Sheets as the database** | Slow to read, no transactions, a 10-million-cell limit per file, and hand edits could break the data | D1 is the main copy; Sheets is a read-only copy, rewritten from D1 |
| **COSATOK's marking scheme** | Did not match IYF Delhi's own Excel score cards | The Excel cards, every option checked (decision 28) |
| **Google / email sign-in** | Not everyone has or remembers one; the phone is the identity | Phone + password |
| **A phone-side 9 PM alarm** | Browsers no longer run reliable scheduled tasks | Server-sent Web Push |
| **An in-app lecture player** | Too heavy for cheap phones and slow networks | A lecture opens in Google Drive |
| **A redrawn (vector) IYF logo** | Never exactly the official logo | The official file, enlarged 4× with an AI upscaler (Real-ESRGAN): exact and sharp at every size |
| **Rewriting whole sheets on every change** | At 2,000+ devotees it would exceed the free plan's daily database limits, leave tabs half-filled, and take hours | Only changed rows: a change log kept by the database itself (triggers), and new rows inserted at their place |
| **Copying the dashboard's ID list every 30 minutes** | 24,000 database writes a day with no users | Copied only when it changes, and then only the changed IDs |
| **A nightly copy of the sheets into a backup folder** | The service account has no Drive storage of its own, so it cannot create files | D1 Time Travel (7 days) + a weekly export + the live Sheets copy |
| **Recording a row per phone for each reminder** | 5,000 writes a night at 5,000 devotees | Nothing written per phone; the reminder's words are worked out when the phone asks |

---

## 5. How the data flows

```
Phone (PWA) ──HTTPS──▶ Cloudflare Worker (API) ──▶ D1 database (the main copy)
                              │ every minute, one small step
                              ├──▶ Google Sheets: Access, Profiles, Rules, Drafts, Submissions 2026
                              │      (only changed rows, from the database's own change log)
                              ├──▶ Batch view sheets SPS / DPS / BSS / BVS
                              │      (a new submission inserted as one row; This week refreshed where it changed)
                              ├──▶ 9 PM Web Push reminders (three parallel parts)
                              └──◀ the dashboard's ID list and facilitator list (read-only, only when changed)
Later (phase 5): submitted weeks ──▶ the sadhana sheet ──▶ Raw ──▶ Eligibility ──▶ the dashboard
```

---

## 6. Tools and know-how kept in the repository

Everything learned while building is kept in the repo. Future work needs no downloads and doesn't have to work things out again.

| Kept as | Where | What for |
|---|---|---|
| Project skills (instructions Claude Code loads by itself) | `.claude/skills/sadhana-*` (9 skills) | Release, browser checks, load test, documents to PDF, logo assets, free-plan rules, backups, Sheets copy, walkthrough videos |
| Browser checks | `sadhanaRecord/tools/browser/` | About 1,270 checks of every screen and role (group leaders included); offline-logo and menu-overflow checks |
| Document builder | `sadhanaRecord/tools/docs/` | Markdown → branded A4 PDF with the IYF emblem; page previews |
| Logo tools | `sadhanaRecord/tools/brand/` | AI upscaler (Real-ESRGAN, kept on this machine, not in git), emblem cut, app icons, share image |
| Performance | `sadhanaRecord/tools/perf/` | Lighthouse low-end phone check; view-sheet timing; SQL trace |
| Sheets audit | `sadhanaRecord/tools/sheets/sync-audit.mjs` | Live check: every copied table, the database against the sheet |
| Walkthrough videos | `sadhanaRecord/tools/video/` | Narrated videos of every screen, one per type of user (devotee, group leader, coordinator, IYF head), in English and Hindi, recorded on demo data; voices and ffmpeg local. Rendered once the design is final |
| Load test | `sadhanaRecord/loadtest/` | Separate test server, seed of 2,000 devotees, ramp, conflicts, Sunday submit wave, the Sunday end-to-end submission |
| Audits | `worker/tests/query-plans.mjs`, `write-audit.mjs` | Every SQL statement checked for table scans and whole-table writes |
| Brand files | `sadhanaRecord/brand/` | The official logo at 3540×1120, the emblem at 892×892, icons, share image |

**Reports** (each as `.md` and PDF in `sadhanaRecord/docs/`):

| Report | Covers |
|---|---|
| `stakeholder-brief` | The app, its value and the asks, for IYF leaders |
| `sadhana-app-design` | The design and decisions 1–44 |
| `sadhana-api-contract` | All 95 actions, with costs per call; the compact week JSON |
| `load-test-report` | Capacity, the free plan versus US$5, when to upgrade |
| `backup-restore` | The backup runbook and the drill |
| `development-history` | This document |

---

## 7. Scaling up

| Stage | Devotees | What to do | Cost |
|---|---|---|---|
| Now | up to about 4,500 (5,000 with care) | Free plan. Watch the busiest day (`load-test-report` § 9b). | Free |
| Step 1 | 5,000–20,000 | Cloudflare Workers Paid: no daily stop, 30 s of CPU a call, all reminders at 9 PM, 25 billion rows read and 50 million written a month included. No code change. | US$5 a month (a few dollars more at the top of the range) |
| Step 2 | 20,000+ or several cities | Fewer queries per screen (one round trip for home and week); D1 read replicas for reads; one Submissions spreadsheet per quarter instead of per year; split the database per region or year if one D1 database (10 GB) gets close | Still around US$5–25 a month |
| Step 3 | When the data must feed other systems (analytics, a central ISKCON database, reports beyond Sheets) | Move to, or add, **PostgreSQL** (section 8) | Depends on the provider: Supabase / Neon have free tiers; about US$25 a month for a paid Supabase project |

**What already makes scaling easy:**
- one API with named actions, so the app never knows where data is stored;
- all SQL in a few server files;
- every write already logged as a change (the Sheets copy), so the same log can feed any other system;
- tests for every rule.

---

## 8. Connecting PostgreSQL later (for example Supabase)

There are three ways. Pick by need:

| Way | How | When |
|---|---|---|
| **A. Copy the data into PostgreSQL** (keep D1) | The database's change log already lists every changed row, and the Sheets copy uses it. A second consumer sends the same rows to PostgreSQL (Supabase's REST API, or SQL through Cloudflare Hyperdrive) every minute. | Analytics, central reporting, sharing with another system. The safest first step: the app is untouched. |
| **B. Move the main database to PostgreSQL** | Export D1 (`wrangler d1 export`), convert the SQLite schema (the table below), load it (`psql` or `pgloader`). The Worker then talks to PostgreSQL through **Cloudflare Hyperdrive** (connection pooling close to the database) instead of D1. Change the few server files that hold SQL. | If the app outgrows D1 (very large data, many cities) or must live in an existing PostgreSQL |
| **C. Let PostgreSQL read the sheets or exports** | A scheduled import of the Sheets copy or the weekly export file | Only for occasional reports; not real-time |

**Moving the schema from SQLite (D1) to PostgreSQL:**

| In D1 today | In PostgreSQL |
|---|---|
| Dates as ISO text (`2026-10-04T19:00:00+05:30`) | `timestamptz` and `date` |
| JSON as text (`days_json`, `marks_json`, `aliases`) | `jsonb` |
| Booleans as 0/1 | `boolean` |
| `INTEGER PRIMARY KEY` | `bigint generated always as identity` |
| `WITHOUT ROWID`, `INSERT OR IGNORE`, `ON CONFLICT … DO UPDATE` | Plain tables; `ON CONFLICT DO NOTHING` / `DO UPDATE` |
| Triggers that log changes (`mirror_*`, `view_dirty`) | PostgreSQL triggers (`plpgsql`), or logical replication / Supabase Realtime |
| Time Travel backups | The provider's point-in-time recovery |

Keep the **API contract** unchanged during a move: the app and the tests then show at once that nothing changed for users.

---

## 9. Edge cases already handled

- **Many devices at once:**
  - two to five phones saving the same day → exactly one save wins, and the others see the saved copy;
  - five phones pressing Submit → exactly one submission.
- **Bad network:** offline saves wait on the phone and go out later; a repeated request never applies twice.
- **Updates:** an app update waits while a day has unsaved changes.
- **The weekly cycle:**
  - Submit opens Sunday 6 PM and closes Monday 9 PM; only a complete week is accepted;
  - unsubmitted weeks become missed and their drafts are dropped (logged);
  - only the IYF head can reopen a missed week.
- **Attendance:**
  - no-class weeks (holiday, festival);
  - attendance marked after submitting counts;
  - four levels, each in its own column: IYF head › coordinator › group leader › the devotee's own, so a lower level never overwrites a higher one;
  - a devotee whose own mark was overruled is told (in the app and one notification, 5 minutes after the change, so a quick correction sends nothing);
  - one Sunday class for everyone; week-end answers open Saturday 6 PM;
  - the time locks on screen follow the server's clock, not the phone's.
- **IYF IDs:** dashboard ID merges are followed automatically; possible duplicates are flagged for review; one ID per person.
- **Staff safety:** a coordinator can't change, or reset the password of, another coordinator or the IYF head (security review).
- **Floods and dead phones:**
  - rate limits on sign-in, sign-up and resets; refusals don't cost database writes;
  - dead push subscriptions are removed.
- **Low-end phones:** a lighter look automatically, reduced motion respected, 144 KB pages.
- **Data loss:** restore to any minute of the last 7 days (drill: 4 seconds).
- **Coordinators who work in sheets:** drafts, attendance and every other table reach Google Sheets within about a minute, checked row for row by `tools/sheets/sync-audit.mjs`.

## 10. Edge cases to handle next

| Case | Why it matters | Suggested handling |
|---|---|---|
| **New year (January 2027)** | Submissions are copied to *Submissions 2026*; a spreadsheet holds at most 10 million cells | Before 1 Jan: create *Submissions 2027* (the owner creates it, the build script fills it), add it to `setup/files.json`, point the copy at it by year |
| **A devotee changes phone number** | The phone number is the login | A master action "change login number", moving all rows in one transaction, with an audit line |
| **Two devotees share one phone** | Push notifications follow the last person signed in | Already works per sign-in; document it for coordinators |
| **Free daily limit crossed** | The app stops until 5:30 AM IST | Watch § 9b of the load-test report; move to US$5 before it happens |
| **Google API outage or quota** | The Sheets copy pauses | It resumes by itself; nothing is lost (D1 is the main copy) |
| **Service-account key leaked or expired** | The Sheets copy stops | Rotate the key in Google Cloud, then `wrangler secret put GOOGLE_SA_KEY` |
| **Only one person can manage Cloudflare** | Single point of failure | Add a second trusted owner to the Cloudflare account and to the Google files |
| **iPhone reminders** | Web Push works on iPhone only when the app is on the Home Screen (iOS 16.4+) | Show the steps in the app (already in the menu); tell iPhone users in the roll-out guide |
| **Password resets** | Anyone who knows a number can ask for a reset | Coordinators call the devotee before approving (go-live checklist); a one-time code is a possible later step |
| **Old accounts approved before class day and facilitator existed** | Missing details in reports | The coordinator fills them from the Members screen (go-live checklist item 2b) |
| **Batch renamed, merged or closed** | Views and reports group by batch | Rename in Admin › Batches; a merge needs a master action and an audit line (not built) |
| **Very large batch (1,500+ devotees)** | Coordinator screens use more than 10 ms of CPU on the free plan | Already paged; at that size move to US$5 (30 s of CPU) |

---

*Hare Kṛṣṇa · ISKCON Youth Forum, Delhi*
