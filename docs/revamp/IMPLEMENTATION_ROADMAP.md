# Sadhana Record — Implementation Roadmap (final revamp)

**IYF Delhi · plan of record · 8 October 2026**

**What it supersedes:** the phase lists in `ux-modernization-proposal.md` §11 and `pre-store-revamp-review.md` §8. Their content is merged here.

**What each item references:**
- **WHAT:** `ROUTE_BY_ROUTE_REVAMP.md` and `FINAL_FEATURE_MATRIX.md`;
- **HOW IT LOOKS:** `DESIGN_SYSTEM.md`;
- **WHY:** `UI_UX_360_REVAMP.md`;
- **LIMITS:** `PERFORMANCE_SEO_ACCESSIBILITY.md`.

---

## 1. How the order was chosen

1. **Fix trust before adding beauty:** wrong numbers and false states cost more than any visual gain.
2. **Tokens before screens:** every screen is then built once, on the final system (no double work).
3. **The shell before pages:** navigation, the bar rules and naming touch every route.
4. **Devotees before staff:** the largest group, the daily load, and the missed-week problem.
5. **Things needing outside input come later:** the Wall-comments choice, the privacy text, the domain, the store accounts (all at deploy time).
6. **Motion is layered on screens that already work:** every effect has a plain fallback.
7. **Quick checks per phase, one full test at the end** (§5). Phase 0 goes live on its own; phases 1–8 go live together after the final test.

---

## 2. Phases

| Phase | Name | Contents (headline) | Depends on | Size |
|---|---|---|---|---|
| **0** | Baseline, trust and store blockers | **Bugs:** Add batch journal names (**fixed 8 Oct**, deploy pending); board counts with inactive members; head+devotee bar; badge; bell count; "Saved ✓" untouched; pending-as-error; forced password in the full app; sidebar overflow; desktop tabs cut; facilitator deep link; query-string routes; blank history page; attendance in reopened weeks; current book on the server; audit gaps. **Other:** compact Hearing and Reading in the day form (§6); 44 px targets; privacy page (draft text); Wall report/block (or comments off in store builds); minimum age 15 with parent consent for 15–17; startup CSS split and JS under target. **Built 8 Oct 2026** (see `PHASE0_RELEASE.md`); reviewer demo data moved to Phase 9, privacy-friendly counters and the staging check to Phase 8 | None left (comments and privacy text are finalised in Phase 9) | 2 weeks |
| **1** | Design-system foundation | D1 colours (brand/action vs area marker); component tokens; status chip ("Filling" everywhere; Missing = amber); viz colours per category; spacing rhythm; radius update; tabular numbers; overline rule; `prefers-contrast`; contrast tests extended. **Built 8 Oct 2026 in `sadhanaRecord-revamp/`** (see `REVAMP_PROGRESS.md`; component tokens and spacing move to phases 4–6) | 0 (D1 decided: logo blue) | 1 week |
| **2** | Global shell and navigation | The bar rule per role; Group on the leader's bar; sidebar with its own scroll and one entry per area; desktop tab rows replaced by the sidebar (tabs stay on phones); Back only on child pages; no eyebrows on shared pages; one name per thing; dates in full; Requests as one inbox (reopens merged; old routes redirect); bell and badge correct; Account settings as rows and sheets; role-specific How to use. **Built 8–9 Oct 2026** (`REVAMP_PROGRESS.md`) | 1 | 1.5 weeks |
| **3** | Authentication experience | Welcome redesign; the sign-in split screen on desktop; pending-approval page; auth layout for the forced change; 4-step sign-up with a draft (fields regrouped; address stays required; age from 15 with parent consent under 18); Forgot explains first; locked/expired/rejected wording; trust line + privacy link; **darshan pipeline v1** (Welcome + sign-in panel). **Built 9 Oct 2026** (`REVAMP_PROGRESS.md`) | 1–2 (image rights held) | 1.5 weeks |
| **4** | Devotee core | The three-slot Home (status block with missing days in amber, needs-you if leader or facilitator, today's darshan + verse card); Day (bottom bar hidden, honest Save states, "Same as yesterday", minute steppers, section ticks, single column on desktop); Week (readiness checklist, one week-end card from Saturday, attendance neutral until Sunday); Report (insight sentence, meters, missed days on the calendar, legend, toggle first); History folded into Report (route kept); Hearing "Continue", lesson-week naming; Reading chips; offline auto-send of pressed Saves + sync states; storage persistence; Monday 6 PM deadline reminder; first-run guide. **Built 9 Oct 2026** (`REVAMP_PROGRESS.md`; migration 0031 goes live with the final release) | 2–3 | 3 weeks |
| **5** | Group leader, facilitator and coordinator | Group (one summary, full-contrast rows, P/A from Sunday, nudge everyone, mark all present). Facilitator (opens on My students, Needs you / Filling / Submitted with reasons, tappable counts, sparklines, student summary, meters, facilitator reminder). Coordinator Home (needs you, this week per batch, people to nudge). Board (needs-action first, whole-row targets, 44 px P/A, inactive collapsed, Fill in ⋯, mark all present, keyboard). Members / Leaders / Stats (filters sheet, destructive actions in ⋯ + confirm, 7-day bars). Requests list-detail with age. Devotee detail grouped (Contact · Sadhana · Manage · Danger zone). Fill pages (title, "their", honest Save). **List + detail on desktop**. **Built 9 Oct 2026** (`REVAMP_PROGRESS.md`) | 4 (shared components) | 3 weeks |
| **6** | IYF head / admin | Home: Decisions + System health + Batches table. Admin as 6 sidebar entries; merged duplicate pages (All devotees/Members, Groups/Leaders) with routes kept; Activity in plain words with names and before/after on tap; telemetry to health; Settings (configured times, wheels, Undo only when changed); Batches (no-coordinator warning, member counts); Coordinators/Facilitators/IDs polish. **Built 9 Oct 2026** (`REVAMP_PROGRESS.md`) | 5 | 2 weeks |
| **7** | Advanced interaction and motion | Shared-element transitions; direction-aware page motion; spring easing; count-ups; chart draw-ins; FLIP list changes; live board refresh + changed-row glow; hide-on-scroll bar; scroll-driven title condense; swipe between days, weeks and devotees (with buttons); long-press quick actions; app shortcuts; failed-submit haptic; sheet snap points; prefetch on press; optimistic attendance; time-of-day greeting and wash; status-tinted hero; success sheet with a darshan thumbnail. **Built 9 Oct 2026** (`REVAMP_PROGRESS.md`) | 4–6 | 2 weeks |
| **8** | Performance / accessibility / SEO hardening | axe in the suite; TalkBack and VoiceOver passes; text size; "Show as table"; `forced-colors`; long-string and 200% zoom tests; a real low-end Android run; Lighthouse ≥ 95 mobile; per-route titles; robots.txt / sitemap / canonical; copy and voice pass; privacy-friendly counters; a staging check on real-shaped data. **Built 9 Oct 2026** (`REVAMP_PROGRESS.md`; screen-reader and device passes move to Phase 9) | 7 | 1.5 weeks |
| **9** | **Web release: quotes, verse, motion and pickers** (added 9 Oct 2026) | More quotes (46 → 78: Nectar of Instruction, Bhāgavatam cantos 3/4/6/7/10/11, more Caitanya-caritāmṛta, Brahma-saṁhitā); the signed-out verse as a printed page; the one-line subline under Create an account; **every sheet really animates open** (`@starting-style` was outside its layer) and How to use waits for its content; the ± minute buttons removed from the day form; **a tap on a wheel row chooses and closes** (`TimePicker` keeps Done: three wheels). Darshan stays only where §8 allows it. **Built 9 Oct 2026** (see `PHASE9_WEB.md`) | 8 | 1 week |
| **10** | Store builds, final QA and rollout (**was Phase 9; postponed 9 Oct 2026**) | Own domain; Android TWA (asset links); iOS shell (app-bound domains, APNs, share bridge); store forms (data safety, privacy labels, age rating); reviewer demo data on a test copy; store screenshots, feature graphic and listing (name decision); support process; security review; the 10-persona route sweep; device runs; TalkBack and VoiceOver; submit; **user testing with 5 devotees + 2 coordinators** | 9; domain; Google and Apple accounts | 2–3 weeks |

**Total:** about 19–22 weeks in sequence (Phase 9 added 9 Oct 2026; the store work moved to Phase 10).
- Phases 0–4 (about 9 weeks) deliver most of what users notice.
- Phases 5 and 6 can partly overlap once Phase 4's shared components exist.

**Optional, any time after Phase 7 (if IYF wants):**
- TV hall display (`#/hall/<batch>`);
- glass hero on Home (High);
- Welcome parallax and drifting gradient;
- LMS / knowledge base (separate proposal; after Phase 5).

---

## 3. Classification

| Class | Items |
|---|---|
| **Quick wins** (S, high impact) | The Phase 0 bug fixes; 44 px targets; honest Save state; "Filling" naming; dates in full; bell/badge; no eyebrows on shared pages; sidebar scroll; Back rules; "Checking…" timeout; Settings using configured times |
| **Core redesign** | D1 colour system; role bar and sidebar rules; three-slot Homes with Needs you; status block with missing days; one Requests inbox; sign-in/pending/sign-up; Day/Week/Report redesigns; facilitator and coordinator workspaces; admin Decisions + health; list + detail on desktop |
| **Advanced enhancements** | Shared elements, springs, count-ups, draw-ins, live refresh with glow, swipe navigation, long-press, app shortcuts, offline auto-send with sync states, darshan system, time-of-day, meters and sparklines |
| **Experimental / optional** | TV hall display; Welcome parallax and drifting gradient; glass hero; evening-toned darshan preference; passkeys; contact picker |

---

## 4. IYF decisions (answered 8 Oct 2026)

| # | Decision | Answer | Effect on the plan |
|---|---|---|---|
| 1 | Minimum age (DPDP Act 2023) | **15 years** | Phase 0: sign-up accepts date of birth from age 15 (today 12–80; the upper limit stays). Under DPDP anyone under 18 is a "child", so 15–17-year-olds need a parent's or guardian's consent: sign-up step 1 adds a consent tick and the parent's name and phone for under-18s. No ID is asked (unchanged rule) |
| 2 | Wall comments in the store apps | **Later** (decide before the store build; now Phase 10) | Phase 0 still builds Report + hide-a-person (the stores ask for it); the on/off choice waits for Phase 9 |
| 3 | Privacy policy text | **At deploy time** | The privacy page and its links are built in Phase 0 with the text marked draft; the final text goes in at Phase 9 |
| 4 | Brand colour (D1) | **The logo's blue** | One brand/action colour: logo blue `#004FDC` / `#78A8FF`, navy `#002888`, the logo's gold `#F8B000` as detail; area colours become markers only. Phase 1 |
| 5 | Address at sign-up | **Stays required** | Sign-up keeps address (and the other required fields); no "add later" variant |
| 6 | Darshan image rights | **Already held by IYF** | No credit line or rights step; images can ship in Phases 3 and 4 |
| 7 | Festival calendar | **Not needed** | No festival overrides or festival banners in the app. Festival days are announced on the Wall with a push notification (exists). The daily darshan rotation stays |
| 8 | Rounds target | Not now (rounds aren't scored) | — |
| 9 | Hindi | **Not needed now** | Removed from the optional list; wording stays in plain English |
| 10 | Domain, developer accounts, store name | **At deploy time** | Phase 10 (postponed from 9 on 9 Oct 2026) |
| 11 | Optional items (hall display, glass hero, drifting gradient) | Defer | — |

**Requested on 8 Oct 2026 and added to Phase 0:**
- **Add batch journal names: fixed.** The server change and its tests are done; it goes live with the next server deploy.
- **Compact Hearing and Reading in the day form**, on every route that fills a day (see §6).

---

## 5. Regression safety and testing

**Never (every phase):**
- remove a function;
- change a business rule (scores, windows, part weeks, attendance precedence, explicit Save, weekly principles, pick-from-lists, no ID documents);
- change an API contract without need (only the additive fields in `PERFORMANCE_SEO_ACCESSIBILITY.md` §2.6);
- break sign-in, role permissions, routes (old routes redirect), data flows or the Sheets copies;
- add dependencies;
- rewrite the backend.

**Testing: build first, one full test at the end (decided 8 Oct 2026).** The full gate takes too long to run after every phase, so it runs once.

| When | What runs | Time |
|---|---|---|
| **After each phase (1–8)** | Only what that phase built. The server and unit tests (automatic, about 1–2 minutes, so they always run); the browser checks for the changed screens only; size budgets; screenshots of the changed screens (phone + desktop, light + dark) | Minutes, not hours |
| **Once, at the end of Phase 8** | **The full final test:** every server and unit test; all browser and component checks; the 10-persona route sweep (every route, every login, 4 sizes); Lighthouse mobile ≥ 95; axe; Android and iPhone device runs; TalkBack and VoiceOver; screenshot approval | One long run |
| **Phase 9 (web)** | Only what it built: the server and unit tests, the browser checks for the changed screens, size budgets, screenshots | Minutes |
| **Phase 10** | The store builds' own checks (TWA, iOS shell) + the final test again on the store builds | — |

**Releases:**
- **Phase 0 goes live on its own**, with the quick check: it fixes things users hit today and store blockers.
- **Phases 1–8 are built one after another without going live.** The live app stays on Phase 0 while they are built, and they go live together after the final test.
- If one phase is wanted live sooner (for example the devotee core), it can be released with its quick check plus the full browser suite for the routes it touched.

**The trade-off:**
- A problem that one phase causes in another phase's screen is found at the end, not at once.
- The quick per-phase checks keep that small: the server and unit tests cover all rules, and the changed screens are checked every time.
- The final test has room for one round of fixes.

**Rollback:** the previous release stays live-able (its assets are carried over, and the gate's ledger records each build). The server deploys before the frontend when both change.

---

## 6. Compact Hearing and Reading in the day form (requested 8 Oct 2026, Phase 0)

**The problem:** the Hearing and Reading sections show their pickers inside the form.
- **Hearing:** "Choose a topic" opens the typed-topic field and then the **whole journal list**, with filters, under the minutes field.
- **Reading:** "Change book" opens the **whole book list**.
- Both stay open in the page, so the day form grows by several screen heights and looks untidy.
- The same component (`devotee/Day.svelte`) is used on every route that fills a day: the devotee's own day, fill-on-behalf (`#/fill/…/day/…`), and links from Week, Home and notifications.

**The change (one component, so every route gets it):**

| Section | In the form (all that is shown) | Picking |
|---|---|---|
| **Hearing** | 1. **Topic:** one row showing the chosen topic ("SB 1.2.6 — Prabhupāda lecture"), or "Choose the topic ›" when none. If more than one topic was chosen, it reads "first topic + 1 more". 2. **Duration:** the minutes field, right below | Tapping the row opens a **Sheet** (bottom sheet on phones, centred dialog on desktop). It has the typed-topic field first, then the journal list with its filters; choosing closes it. The list never renders inside the form |
| **Reading** | 1. **Book:** one row with the current book, or "Choose the book ›". 2. **Duration:** the minutes field | The same Sheet pattern: the book list with level and search, then "Other book". The remembered book stays the default, so a normal day is zero taps |

**Kept as it is:**
- up to 8 topics per day (managed inside the Sheet);
- typed topics;
- the heard list;
- the "(required)" rule when minutes > 0;
- the remembered current book;
- explicit Save;
- the data saved and its scoring.

**The order changes from "minutes, then topic" to "topic, then duration"**, as asked: first which topic was heard, then for how long.

**Size:** it reuses the existing `Sheet`, `LectureList` and `BookList`, so there is no new code weight. The lists already render only when opened; in a Sheet they no longer push the rest of the form down.
