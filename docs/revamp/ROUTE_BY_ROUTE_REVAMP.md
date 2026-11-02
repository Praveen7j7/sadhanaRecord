# Sadhana Record — Route-by-route revamp

**IYF Delhi · plan of record · 8 October 2026 · documentation only (no app code changed)**

Every route, for every kind of login, with: its current purpose and structure; the problems found (from the code and the 7 Oct sweep, 528 screenshots across 10 personas at 390 px and 1280 px); the redesign (layout per screen size, components, motion, imagery, density); priority, size and phase; and a **Before → After → Why better → Unchanged** close.

**How it fits the set:**
- the component and token names come from `DESIGN_SYSTEM.md`;
- the reasoning is in `UI_UX_360_REVAMP.md`;
- the one-line-per-route summary is the route matrix in `FINAL_FEATURE_MATRIX.md`;
- the order is `IMPLEMENTATION_ROADMAP.md`.

**Phases:** 0 Baseline, trust and store blockers · 1 Design-system foundation · 2 Shell and navigation · 3 Authentication · 4 Devotee core · 5 Group leader / facilitator / coordinator · 6 IYF head / admin · 7 Motion and interaction · 8 Performance / accessibility / SEO · 9 Store builds and QA.

**Priority:** P0 critical · P1 major · P2 enhancement · P3 polish.

**What every route keeps:** every function, rule, permission and API contract stays as it is. Old routes redirect, and nothing is removed.
- explicit Save;
- the weekly windows and deadline;
- part weeks;
- attendance precedence;
- picking from lists;
- no ID documents.

**Server additions the routes depend on.** All of them only add; nothing changes. See `PERFORMANCE_SEO_ACCESSIBILITY.md` §2.6:
- `unreadCount` in `home.get`;
- one week-summary definition;
- facilitator attention reasons;
- reopens in `requests.list`;
- details on the pending-login answer;
- last week's Overall + a 12-week series (desktop and detail pane only).

## Contents

- **A** · `#/welcome` — Welcome (signed out; also `/` and any path while signed out)
- **A** · `#/login` — Sign in, with its states (everyone; one login for all roles)
- **A** · `#/signup` — Create your account (signed out)
- **A** · `#/forgot` — Forgot password (signed out)
- **A** · `#/change-password` — Change password (forced and voluntary; any signed-in person)
- **A** · "Page not found" and "Not available to you" (signed in, any role)
- **A** · Splash (every full load; `index.html` + `App.svelte`)
- **A** · `#/home` — Devotee Home (devotee; + group leader, + facilitator member)
- **A** · `#/week` (redirect) and `#/week/<weekId>` (`?f=submit|days|attendance|nightStay…`) — This week (devotee)
- **A** · `#/day/<weekId>/<date>` (`?f=<field>`, `?f=share`) — Daily sadhana (devotee)
- **A** · `#/history` and `#/history/<weekId>` — History (devotee)
- **A** · `#/report` — Report (devotee)
- **A** · `#/hearing` (`?v=all&w=&s=&q=&h=`) — Hearing (devotee)
- **A** · `#/reading` (`?lv=&bq=`) — Reading (devotee)
- **A** · `#/learn` — old link (redirect)
- **B** · `#/group` — My group (group leader)
- **B** · `#/my-devotees` — My students (facilitator; login-only and member)
- **B** · `#/my-devotees/<login>` — One student (facilitator)
- **B** · `#/my-devotees/<login>/<weekId>` — One student's week (facilitator; `WeekRead`)
- **B** · `#/home` — Staff Home (coordinator without a devotee scope)
- **B** · `#/batch` — Batch status (coordinator; tab "Status")
- **B** · `#/members` — Devotees (coordinator; tab, page title "Devotees")
- **B** · `#/leaders` — Group leaders (coordinator; tab)
- **B** · `#/stats` — Filling chart (coordinator; tab)
- **B** · `#/requests` — Requests inbox (coordinator; reopens merged)
- **B** · `#/devotee/<login>` — Devotee detail (coordinator)
- **B** · `#/devotee/<login>/week/<weekId>` — A devotee's week, read-only (coordinator; `WeekRead`, `devotees.week`)
- **B** · `#/fill/<login>/week/<weekId>` and `#/fill/<login>/day/<weekId>/<date>` — Fill on behalf (coordinator)
- **C** · `#/home` — IYF head Home (IYF head; IYF head + devotee)
- **C** · `#/overview` — All batches this week (IYF head)
- **C** · `#/devotees` — All devotees (IYF head; the same component as a coordinator's `#/members`)
- **C** · `#/groups` — All group leaders (IYF head; the same component as `#/leaders`)
- **C** · `#/coordinators` — Coordinators (IYF head only)
- **C** · `#/facilitators` — Facilitators and their access (IYF head only)
- **C** · `#/batches` — Batch setup (IYF head only)
- **C** · `#/ids` — IYF IDs (IYF head only)
- **C** · `#/reopens` — Reopen requests (IYF head only) → merged into Requests
- **C** · `#/activity` — Activity (IYF head only)
- **C** · `#/settings` — Settings (IYF head only)
- **C** · `#/wall` (and `?post=<id>`) — Announcements (every signed-in role; staff post)
- **C** · `#/account` (and `?f=howto`) — Account (every role)
- **C** · Go to… — command search (coordinator, IYF head)
- **C** · The App Shell — top bar, bottom nav, rail, sidebar, drawer, bell, offline bar, toasts (every signed-in role)
- **C** · NEW (proposed): `#/hall/<batch>` — TV hall display (coordinator of that batch, IYF head; optional)

---

## Part A — Public, authentication and devotee routes


**IYF Delhi · Sadhana Record · 8 October 2026 · part of `ROUTE_BY_ROUTE_REVAMP.md`**

**Sources:**
- the code: `App.svelte`, `index.html`, `screens/*.svelte`, `devotee/*.svelte`, `ui/Plain.svelte`, `lib/api.js`, `worker/src/auth.js`;
- the sweep screenshots (personas public, pending, temp-password, devotee, devotee-gl; 390-light and 1280-dark);
- `DESIGN_SYSTEM.md` (component and token names used as written), `UI_UX_360_REVAMP.md` (§5 sign-in, §7 motion moments, §8.2 imagery, §10 Homes, §11 IA, §12 wording), `current-features.md` §3, `pre-store-revamp-review.md`.

**Reading the tags:**
- **Problems:** [UX] [Hierarchy] [Visual] [Nav] [Interaction] [Mobile] [A11y] [Perf].
- **Phases:** 0 Baseline/trust/store · 1 Design-system foundation · 2 Shell and navigation · 3 Authentication · 4 Devotee core · 5 Group leader/facilitator/coordinator · 6 IYF head/admin · 7 Motion · 8 Performance/a11y/SEO · 9 Store builds and QA.
- **D1** = the one-brand decision (**decided 8 Oct 2026**): the IYF logo's blue `#004FDC` / `#78A8FF`, navy `#002888`, gold `#F8B000` detail, in `DESIGN_SYSTEM.md` §2.2. Every "brand" below means D1.

**Rules every section keeps (not repeated per route):**
- explicit Save (nothing sent by itself); the leave guard;
- part weeks (complete days count, each category ÷ 175); deadline Mon 9 PM (configured, read from the server, never hard-coded); auto-submit / missed = 0;
- week-end Night Stay + 4 principles as **weekly Yes/No**, open Sat 6 PM; attendance opens **Sunday 00:00**;
- the phone is the identity, **no ID documents**; facilitator, batch, books and lectures **picked from lists**, never typed (except the existing free-text fallbacks for hearing topic and book);
- **no new libraries or web fonts; startup JS/CSS unchanged** (sign-in styles already sit in the lazy `auth.css`); images per `UI_UX_360` §8.5 (480/960 WebP, lazy, `fetchpriority="low"`, never precached, none on Low tier/Save-Data).

**Summary:**

| Route | Priority | Size | Phase(s) |
|---|---|---|---|
| `#/welcome` | P1 | M | 3, 4 (image), 8 |
| `#/login` + states | **P0** (pending) / P1 | M | 0, 3 |
| `#/signup` | **P0** (consent, age) / P1 | L | 0, 3 |
| `#/forgot` | P1 | S | 3 |
| `#/change-password` | **P0** (forced layout) | S | 0, 3 |
| Not found / Not available | P2 | S | 2 |
| Splash | P1 | S | 1, 8 |
| `#/home` (devotee) | **P0/P1** | L | 0, 4, 5, 7 |
| `#/week`, `#/week/<id>` | **P0/P1** | M | 0, 2, 4 |
| `#/day/<id>/<date>` | **P0** | M | 0, 2, 4, 7 |
| `#/history`, `#/history/<id>` | P1 | M | 0, 4 |
| `#/report` | P1 | M | 4, 7, 8 |
| `#/hearing` | P2 | S | 2, 4 |
| `#/reading` | P2 | S | 0, 4 |
| `#/learn` | P3 | S | — |

---

### `#/welcome` — Welcome (signed out; also `/` and any path while signed out)

**1. Current purpose.** First screen for a visitor: what the app is, verse of the day, Login / Create an account. Any deep link while signed out lands here and is remembered (`sr.return`).

**2. Current UI structure.** Phone: IYF lockup (56 px emblem) → "Welcome to Sadhana Record" (serif display, 2 lines) → three tiles (Daily sadhana · Hearing & reading · Your batch) → **Login** (purple primary) → **+ Create an account** → "ISKCON Youth Forum, Delhi" → verse card (gold left bar, loads lazily, last). Desktop: the same 420 px column centred on a dark gradient; ~65% of the 1280 width is empty.

**3–10. Problems.**
- [UX][Interaction] The three tiles look like buttons (filled cards, icon halos) but do nothing.
- [Visual] Purple brand (`#4b2a86`); after sign-in the app turns lapis — the brand changes at the door.
- [Hierarchy] Lockup, title, tiles, two buttons, footer and verse all carry similar weight; nothing says *why* (no one-line purpose).
- [Visual] Desktop: one narrow column in a 1280 px void; no devotional presence beyond the verse.
- [UX] "ISKCON Youth Forum, Delhi" repeats the lockup sub-line directly above.
- [UX] No privacy link (store blocker, review §7).
- [UX] "Login" (noun) vs "Back to log in" elsewhere.

**11. SEO.** The only indexable page (served at `/`). Title "IYF Delhi Sadhana Record — daily sadhana for ISKCON Youth Forum", description (≤155 chars) from `index.html`; canonical `/`; OG image stays. Add `robots.txt` (allow `/`, `/privacy.html`, `/delete-account.html`) and a 3-URL sitemap (Phase 8).

**12. Must remain unchanged.** Deep-link return after sign-in; the verse loads after the screen and moves nothing (CLS 0); the Toaster on Welcome ("Your account has been deleted."); offline open from precache.

**13–21. Redesign.**
- **UI (phone, top → bottom):** lockup → `--fs-display` title "Sadhana Record" → one purpose line "Fill your daily sadhana, see your progress, stay with your batch." → **darshan band** 200 px (`--img-aspect-hero` crop, `--img-radius`) → Primary "Sign in" → Secondary "Create an account" → verse (quote style, no card) → trust line "Your data stays with IYF Delhi · Privacy". Tiles become a plain **icon row** (monochrome icons, no fill) or are dropped if the band is present.
- **UX:** one decision on screen (sign in / join); everything else is context.
- **Interaction model:** two links; no carousel, no autoplay.
- **Motion:** Darshan image fades over its dominant colour (§7 "Darshan image"); optional ≤12 px pointer parallax, High tier only (§8.4); Press on buttons.
- **Responsive:** Phone — band 200 px below the lockup (480w ≤40 KB). Tablet — top band 40% height (960w). Desktop ≥1024 — **split screen**: left 50% darshan panel full height with the verse on `--img-panel` (glass High / 88% Balanced), right 50% the lockup + actions column (420 px).
- **States:** loading — colour placeholder, buttons usable immediately; offline/Low/Save-Data — no image, verse alone; error (screen file fails) — Notice "Could not load this screen. Check your connection and reload." + Reload (existing).
- **Data presentation:** today's darshan title under the verse: "Darshan: Sri Chaitanya" (no credit line; IYF holds the rights).
- **Components:** new `AuthLayout` (shared by Welcome/Login/Sign-up; phone column, desktop split), **Darshan card** in panel variant.
- **Micro-interactions:** buttons sink 0.97; privacy link underline on hover.
- **Imagery:** **Recommended** (§8.2 "Welcome: Yes", flagships #07/#08/#17/#22; daily, deterministic; `alt="Darshan: <title>"`). Rights held by IYF (8 Oct 2026).
- **Density:** PRIMARY Sign in / Create · SECONDARY purpose line · CONTEXTUAL darshan + verse · ACTIONABLE 2 buttons · OPTIONAL privacy, icon row.

**22–25.** P1 · M · Low · "I understand what this is and where to tap in 3 seconds." · +0 KB startup; image 40 KB (phone) / ~100 KB (desktop) lazy, `darshan.json` 3 KB precached · Phases 3 (layout, D1), 4 (image pipeline), 8 (SEO).

**Before → After → Why better → Unchanged**
- Before: purple column with fake-button tiles and an empty desktop.
- After: logo-blue lockup, one purpose line, today's darshan, two clear actions, privacy line.
- Why: one brand from first to last screen; meaning without clutter; store-ready.
- Unchanged: actions, deep-link return, verse, offline open.

---

### `#/login` — Sign in, with its states (everyone; one login for all roles)

**1. Current purpose.** Sign in with phone (devotees) or username (staff); answers expired-session, pending, rejected, locked and disabled states.

**2. Current UI structure.** Phone: glass Back (top-left) → lockup 40 px → "Sadhana Record" → italic "Hare Kṛṣṇa · your sadhana, steady and simple" → card: "Login" h2 → [notice] → "Phone or username" → "Password" (eye) → "Forgot password?" (right) → **Login** → "New here?" rule → **+ Create an account**. Desktop: same 420 px card centred. States all render as a **Banner** above the form:
- expired: info "You were logged out. Please log in again.";
- pending: **red** error "Waiting for your coordinator's approval" with the filled form still active (screenshot `pending__login-answer`);
- rejected: "Your sign-up was not approved: <reason>. Please speak to your coordinator.";
- locked: "Too many wrong tries. Try again after 4:35 PM.";
- disabled / inactive: "This account is switched off…" / "…marked inactive…".

**3–10. Problems.**
- [UX] **P0:** pending approval shown as a red error with the form live → people retry or sign up twice (review §2.1 #7).
- [UX] Locked shows a clock time, not time left; no "ask your coordinator to reset".
- [UX] Expired notice doesn't reassure that nothing saved is lost.
- [Visual] Purple brand; card has a gold top edge plus a shadow plus a tinted page — three decorations on one card.
- [Hierarchy] Lockup + name + tagline (≈200 px) before the first field on a 390 px phone; on a small phone the keyboard hides the Login button.
- [UX] Wording: "Login" (button), "log in" (links), "logged out" — three spellings.
- [A11y] Server message replaces field errors; focus does not move to the banner.
- [UX] No privacy/trust line.

**11. SEO.** Hash route, same document as `/`: not separately indexable. Set `document.title = "Sign in · Sadhana Record"` for tabs and screen readers.

**12. Must remain unchanged.** One login for every role (no role logins, §5.1); `autocomplete="username"`/`current-password`; show/hide; Enter submits; 15 s timeout + SlowHint; return to the remembered page; lock after 5 wrong tries for 15 min (server); state is revealed only after the right password (server rule).

**13–21. Redesign.**
- **UI (phone):** `AuthLayout` compact header (emblem 32 px + "Sadhana Record", one line) → h1 "Sign in" → fields (44 px, `--surface-muted` → brand ring) → "Forgot password?" (Text button, 44 px target) → Primary "Sign in" → Outline "Create an account" → trust line "Your data stays with IYF Delhi · Privacy".
- **State pages** (new `StatePage`: icon/halo, title, body, actions; **no form**):
  - **Pending:** title "Hare Krishna, Rahul" · "Your coordinator for SPS will approve your sign-up." · batch + facilitator rows · Primary "Check again" (re-sends the credentials held in memory only) · Text "Wrong details? Contact your coordinator". `--info` styling; small Darshan card (#17, 160 px).
  - **Locked:** "Too many tries. Wait 15 minutes, or ask your coordinator to reset your password." + live "Try again in 12 min" (from `data.until`) · "Reset password" link.
  - **Rejected:** keep the server reason; add "You can sign up again with correct details." + Secondary "Sign up again".
  - **Disabled / inactive:** keep the two server texts; `--warning` notice, "Contact your coordinator".
  - **Expired:** info Notice above the form: "You were signed out after 30 days without use. Sign in again — nothing you saved is lost."
- **UX:** the person's name/batch/facilitator for Pending needs an **additive** `data` on `PENDING_APPROVAL` (sent only after the password check) or the name kept on the phone after sign-up; fall back to "Your coordinator will approve your sign-up." if neither.
- **Interaction model:** errors under the field with focus moved there; banner errors get focus + `role="alert"`; busy button keeps its width.
- **Motion:** Error moment (field border flashes once); Press; Page change crossfade into the app (`withTransition`, kept).
- **Responsive:** Phone — form-first, no image. Tablet — optional 160 px darshan band (High/Balanced). Desktop — split: 45% panel (same darshan as Welcome that day + verse on glass) | 55% form card 420 px.
- **States (exact):** loading "Signing in…" · slow "Still working…" (existing SlowHint) · wrong password "Phone or password is wrong" under Password · offline "No connection. Check your internet and try again."
- **Data presentation:** times as "4:35 PM"; durations "12 min".
- **Components:** `AuthLayout`, new `StatePage`, Notice, Darshan card (small).
- **Micro-interactions:** eye toggle keeps the caret; Caps Lock hint under Password (`getModifierState`).
- **Imagery:** Login form — **Not recommended** on phone; **Optional** desktop panel (decorative `alt=""`, lazy). Pending state — **Recommended** small #17 card. Locked/rejected/disabled — **Not recommended** (never next to errors).
- **Density:** PRIMARY the two fields + Sign in · SECONDARY Forgot · CONTEXTUAL state notice · ACTIONABLE Sign in / Check again · OPTIONAL Create, privacy.

**22–25.** P0 (pending) / P1 · M · Med (error-code mapping; additive server field) · "I know exactly where I stand, and I don't sign up twice." · +0 KB startup; `StatePage` ≤1.5 KB inside lazy auth chunk; panel image lazy ~100 KB desktop only · Phases 0 (pending page), 3 (layout, states, D1).

**Before → After → Why better → Unchanged**
- Before: every state is a banner over a live form; pending is red.
- After: calm state pages with the next step; form-first sign-in with a desktop darshan panel.
- Why: honest states (§1 trust), fewer duplicate sign-ups, one brand.
- Unchanged: one login, lockout rules, session return, server messages' meaning.

---

### `#/signup` — Create your account (signed out)

**1. Current purpose.** Ask to join a batch; the account stays PENDING until a coordinator approves.

**2. Current UI structure.** Phone (2,005 px tall): Plain header → card "Create your account" → **About you** (mobile, "Is this number on WhatsApp?" Yes/No, full name, email with typo hint, date of birth + blood group) → **Your address** (Country India, State, District, Area, House and street, PIN) → **Your batch and class** (batch wheel with "Coordinator: …" hint, Sunday/Saturday, facilitator wheel) → **Password** ×2 → **Emergency contact** (name, relation, mobile) → **Sign up** → "I already have an account". Success: Empty state "Waiting for your coordinator's approval · You can log in once it is approved." Desktop: a 560 px card (wider than Login's 420), same single column.

**3–10. Problems.**
- [UX] One 2,000 px form, 17+ fields, all required; no progress, no draft — a dropped connection or a back-tap loses everything.
- [UX] Blood group, address and emergency contact are required at sign-up. **IYF decided 8 Oct 2026: they stay required**, so the 4 steps regroup them instead of removing them.
- [UX] **P0:** no consent/privacy notice; age 12–80 accepted with no parental consent (DPDP 2023). **IYF decided 8 Oct 2026: minimum age 15.** Ages 15–17 are "children" under DPDP, so step 1 adds a parent/guardian consent tick with the parent's name and phone, shown only when the date of birth is under 18. Server: `dob` range 15–80 and a `parentConsent` object required when under 18 (additive).
- [Hierarchy] Section headings (sans 17 px) barely differ from labels (14 px); "Your address" before "Your batch", though batch is what the coordinator needs.
- [Mobile] Two half-width pairs (DOB + blood group, Relation + Mobile) cramp at 390 px; `dd/mm/yyyy` native date.
- [Visual] Card width differs from Login; purple brand.
- [A11y] On submit, focus jumps to the first invalid field with no summary of how many need fixing.

**11. SEO.** Not indexable (hash). `document.title = "Create your account · Sadhana Record"`.

**12. Must remain unchanged.** Phone as login; WhatsApp question right after the number (the head, 4 Oct); facilitator **picked** from the canonical list; batch from `meta.get` (cached, refreshed); class Sun/Sat; password rules (8–64, no phone/sequences/common); PIN checked against the state; pending → coordinator approval; **no ID documents**; `consentPhoto: false`.

**13–21. Redesign.**
- **UI:** `AuthLayout` with a **4-step Stepper**: (1) You — mobile, WhatsApp, name, email, date of birth, **privacy & consent notice** + age rule; (2) Batch & class — batch, class, facilitator; (3) Contact & address; (4) Password → Primary "Send sign-up". Progress "Step 2 of 4" + bar. Optional fields marked "(optional)".
- **UX:** draft kept on the phone (localStorage, never the password) and restored with "Continue where you left off?"; blood group, address, emergency contact become **"Add later in Account"** only if IYF agrees (IYF decision; the server currently requires them — a contract change, so keep them required until decided).
- **Interaction model:** Next validates only the current step; Back keeps values; final step shows an error summary "2 answers need fixing" with links.
- **Motion:** Page change slide between steps (220 ms, by direction; crossfade on Low); Error moment.
- **Responsive:** Phone — one column, sticky step bar. Tablet — same, 560 px card. Desktop — split: left panel = darshan + **"What happens next"** (1 Send your sign-up · 2 Your coordinator approves · 3 Sign in and fill your first day), right = the step card.
- **States (exact):** batches loading "Loading batches…" (skeleton wheel); meta failed "Couldn't load the batch list — check your connection and try again." + Retry; success page = `StatePage` "Sign-up sent. Your coordinator for <batch> will approve it. You can sign in once it is approved." + Primary "Back to sign in".
- **Data presentation:** batch rows show name + coordinator ("SPS · Coordinator: Amit Prabhu"); never "Level 4/5" (batch names rule).
- **Components:** new `Stepper`, `AuthLayout`, existing WheelSelect, Seg (segmented control), DateInput, AddressFields.
- **Micro-interactions:** email typo hint as a tappable chip "Use …@gmail.com"; step chip turns ✓ when valid.
- **Imagery:** **Desktop only, Optional** (decorative, beside "What happens next"); **Not recommended** on phone/tablet or behind fields.
- **Density:** PRIMARY current step's fields · SECONDARY progress · CONTEXTUAL coordinator name, what happens next · ACTIONABLE Next / Send · OPTIONAL optional fields.

**22–25.** P0 (consent + age) / P1 (steps) · L · Med (validation per step; possible contract change for later fields) · "I can join in 2 minutes on a phone without losing my answers." · +0 KB startup; Stepper ≤1 KB in lazy sign-up chunk · Phases 0 (consent, age — IYF decision), 3 (steps, draft, layout).

**Before → After → Why better → Unchanged**
- Before: one 2,000 px form, no consent, no draft.
- After: 4 short steps, consent on step 1, draft kept, "what happens next".
- Why: fewer abandoned sign-ups; legal/store compliance.
- Unchanged: every field's rules, pick-from-list facilitator, approval flow.

---

### `#/forgot` — Forgot password (signed out)

**1. Current purpose.** Request a reset with the new password; it works after the coordinator (the head, for staff) approves.

**2. Current UI structure.** Plain header → card "Forgot password" → Phone or username → New password ("8 to 64 characters") → Confirm → **Ask for reset** → "Back to log in". Done: Empty state "Waiting for your coordinator · Until then, your old password still works." + "Back to log in". Desktop: same centred card.

**3–10. Problems.**
- [UX] Nothing explains *before* the form that a person approves the reset — users expect an SMS/email.
- [UX] Done state doesn't say how they'll know it was approved.
- [UX] Back icon *and* "Back to log in" link (two backs).
- [Visual] Purple; 200 px header before the first field.

**11. SEO.** Not indexable. `document.title = "Reset password · Sadhana Record"`.

**12. Must remain unchanged.** Coordinator (head for staff) approves; new password set at request time; password rules; old password works until approval; approval ends all sessions.

**13–21. Redesign.**
- **UI:** `AuthLayout` compact → h1 "Reset your password" → Notice (info): "Your coordinator approves password resets. Choose your new password now; it works after they approve." → fields → Primary "Ask for reset" → Text "Back to sign in" (the only back on phone; the glass icon stays only on desktop).
- **UX:** done = `StatePage`: "Request sent · Your coordinator will approve it, usually within a day. Until then, your old password still works. Try signing in with the new one after they tell you." + Primary "Back to sign in".
- **Interaction model / Motion:** Press, Error moment; no other motion.
- **Responsive:** one column at every width (utility moment; no split panel).
- **States (exact):** busy "Sending…"; error "Couldn't send — no connection. Nothing was changed. Try again."
- **Components:** Notice, `StatePage`.
- **Micro-interactions:** password strength line reuses `passwordProblem` live after blur.
- **Imagery:** **Not recommended** (§8.2: utility, anxiety-reducing clarity).
- **Density:** PRIMARY three fields · SECONDARY who approves · ACTIONABLE Ask for reset · OPTIONAL back link.

**22–25.** P1 · S · Low · "I know a person approves it and when to try again." · +0 KB · Phase 3.

**Before → After → Why better → Unchanged**
- Before: silent form, ambiguous done.
- After: explains first, honest done page.
- Why: fewer calls to coordinators and repeat requests.
- Unchanged: the approval flow and rules.

---

### `#/change-password` — Change password (forced and voluntary; any signed-in person)

**1. Current purpose.** Forced while a temporary password is in use (every other route redirects here); voluntary from Account.

**2. Current UI structure.** Inside the **full Shell**: top bar "Change password" + bell, bottom bar (Home · Students · Account, Account active) on phone, full sidebar on desktop (Announcements, Report issue, Theme, Log out…) → card "Choose your password" (lock icon) → Temporary password → New password ("8 to 64 characters") → Confirm → **Change password**. Success: green "Password changed." then (forced) go to Home. Screenshot persona is a facilitator: orange area accent around a purple button.

**3–10. Problems.**
- [UX][Nav] **P0:** the forced step shows the whole app; every bar/sidebar link bounces back here, so it looks broken or optional (review §2.1 #8).
- [UX] No reason given ("your coordinator set a temporary one").
- [Nav] No visible Log out on phone (only in the drawer).
- [Visual] Area accent (orange) + purple button + lapis elsewhere: three colours for one form.
- [Hierarchy] Desktop: 400 px card in a 1000 px pane, left-aligned under a page title.

**11. SEO.** App route: not indexable. `document.title = "Choose your password · Sadhana Record"`.

**12. Must remain unchanged.** Forced redirect while `mustChangePassword`; current/temporary password check; password rules; changing ends other sessions; voluntary use from Account.

**13–21. Redesign.**
- **UI (forced):** **`AuthLayout`** (no bar, sidebar or bell) → lockup compact → h1 "Choose your own password" → "Choose your own password to continue — your coordinator set a temporary one." → fields → Primary "Save password" → Text "Log out".
- **UI (voluntary):** a **Sheet** from Account ("Change password ›" row), not a page; the route stays and opens the same form in the Shell for old links.
- **UX:** success (forced) → Home with Toast "Password saved. Hare Krishna!"; (voluntary) Toast "Password changed. Other devices are signed out."
- **Motion:** Sheet open/close (spring 200/160 ms); Save moment (check draws in the button).
- **Responsive:** forced — centred 420 px card at every width; voluntary — bottom Sheet on phone, 560 px dialog on desktop.
- **States (exact):** wrong current "Your temporary password is wrong" / "Your current password is wrong"; offline "Couldn't save — no connection. Your password is unchanged."
- **Components:** `AuthLayout`, Sheet.
- **Imagery:** **Not recommended** (§8.2: security step, focus).
- **Density:** PRIMARY new password · SECONDARY reason line · ACTIONABLE Save · OPTIONAL Log out.

**22–25.** P0 (forced layout) · S · Low · "The required step looks required and finishes cleanly." · +0 KB (reuses lazy auth chunk) · Phases 0, 3.

**Before → After → Why better → Unchanged**
- Before: a forced form inside an app whose links don't work.
- After: a focused auth step with a reason and a way out.
- Why: no dead links, no confusion.
- Unchanged: the forced rule and password rules.

---

### "Page not found" and "Not available to you" (signed in, any role)

**1. Current purpose.** Unknown path → "Page not found · The link may be old or mistyped." Known path outside the person's scopes → "Not available to you · This page belongs to another role." Both offer "Go to Home". Signed out, any unknown path goes to Welcome (remembered).

**2. Current UI structure.** Shell with top bar overline "◎ MY SADHANA" + title "Not found" → Empty state (info icon in gold halo, 17 px bold title, 14 px line) → Secondary "Go to Home" → empty page; bottom bar with no item active.

**3–10. Problems.**
- [Nav] The overline "MY SADHANA" claims an area the page isn't in (also on staff routes).
- [Hierarchy] Content in the top 30%, 70% empty; no hint of what to do besides Home.
- [UX] Known bugs land here: `#/overview?x=1` shows "Not available" (query string matched; features §9 #3).
- [UX] "This page belongs to another role" can feel like an accusation for mixed-role people.

**11. SEO.** App surfaces; not indexable. `document.title = "Page not found · Sadhana Record"`.

**12. Must remain unchanged.** Never a silent Home; never reveal whether someone else's record exists; the not-found vs not-available split.

**13–21. Redesign.**
- **UI:** no overline; top-bar title "Not found" / "Not available"; Empty state centred at 30% height: icon halo → title → line → Primary "Go to <role Home name>" (e.g. "Go to My students" for a facilitator-only login) → Text "Report a broken link" (the existing Report issue email, prefilled with the path).
- **Wording:** "Not available to you · This page is for another role. If you think you should see it, ask your coordinator."
- **Motion:** Page change only.
- **Responsive:** same at every width; max 420 px text column.
- **Components:** Empty state (four parts, §7.10).
- **Imagery:** **Not recommended** (§8.2: never pair devotional images with errors).
- **Density:** PRIMARY what happened · ACTIONABLE Home · OPTIONAL report link.

**22–25.** P2 · S · Low · "A dead end always has a way back." · +0 KB · Phase 2 (with the query-string route fix in 0).

**Before → After → Why better → Unchanged**
- Before: wrong area overline, generic Home.
- After: neutral title, role Home, report option.
- Why: honest orientation.
- Unchanged: the two rules and privacy of records.

---

### Splash (every full load; `index.html` + `App.svelte`)

**1. Current purpose.** Plain-HTML launch screen before scripts run; fades when the first screen is ready.

**2. Current UI structure.** Full-screen purple radial gradient (`#563899 → #3b2270`; dark `#2a1c4d → #140d26`) → 72 px emblem lockup → "Sadhana Record" (34–48 px serif) → italic tagline → 120 × 2 px gold looping bar 56 px above the bottom. Held **≥1.4 s** from navigation start, then a 420 ms fade. `theme-color #3b2270`.

**3–10. Problems.**
- [Perf] A returning, signed-in person waits 1.4 s + 0.4 s even though Home is already kept on the phone (LCP render delay 1.7–1.9 s on mobile Lighthouse).
- [Visual] Purple ≠ the in-app lapis (brand jump on every open).
- [A11y] `role="status"` label is fine; the looping bar has no reduced-data variant (it is CSS only; acceptable).

**11. SEO.** n/a (covers `/`); must not delay LCP for the Welcome page more than needed.

**12. Must remain unchanged.** Plain HTML (no script dependency), safe areas, reduced motion = no animation, never shown on in-app navigation, waits for the first public screen file (never fades onto an empty page).

**13–21. Redesign.**
- **UI:** same composition in **D1 brand** (navy `#002888 → #004FDC`; dark `#0b1640 → #050b22`) with the gold rule and bar; `theme-color` `#002888`.
- **UX:** **first open:** keep the emblem splash with a shorter minimum (≈800 ms). **Returning signed-in:** no hold — fade as soon as the kept Home renders (§5.8).
- **Motion:** splash line loop (the one allowed loop); fade 300 ms; reduced motion instant.
- **Responsive:** unchanged (centred).
- **States:** script fails — the existing "Could not load this screen… Reload" Notice after fade.
- **Imagery:** **Not recommended** (§8.2: speed; the emblem is the brand moment).
- **Density:** PRIMARY emblem + name only.

**22–25.** P1 · S · Low · "The app opens instantly for people who use it daily." · −1.4 s perceived start for returning users; +0 KB · Phases 1 (colour), 8 (hold rule).

**Before → After → Why better → Unchanged**
- Before: purple, 1.8 s every time.
- After: brand navy, instant for returning users.
- Why: speed is respect for a daily habit.
- Unchanged: plain-HTML splash on first open.

---

### `#/home` — Devotee Home (devotee; + group leader, + facilitator member)

**1. Current purpose.** Today at a glance: what to fill, this week's days, deadline, verse, latest announcement, quick links.

**2. Current UI structure.** Phone (390): overline "WEDNESDAY, 7 OCTOBER" → "Hare Krishna, Bhavesh" → "SPS" → **Today** hero ("Wednesday is not filled yet · 0 of 7 days filled this week" + **Fill today**) → [reminder or install card] → "This week" + Refresh → **week card** ("Week of 5 Oct – 11 Oct · Filling · closes Mon 9:00 PM · 0/7 days filled", day strip Mon–Sun with ○ / · , Open the week) → **verse carousel** (dots ≈5 px, ‹ ▶ ›) → announcement teaser → "Quick actions" 6 tiles (Report, History, Hearing "9 heard", Reading, Share today, Notices "2 new"). Desktop: two columns (Today + week | verse + teaser), quick actions 3-up below. Group leader Home is identical — no group information at all.

**3–10. Problems.**
- [UX] **Past unfilled days look like future days**: Mon and Tue show the same ○ as Wed; the hero says "Wednesday is not filled yet" while 3 days are open (review §4.1).
- [Hierarchy] "0 of 7 days filled" twice (hero meta + "0/7 days filled") — two equal-weight cards.
- [Nav] Quick actions duplicate the bar/bell: Report (bar), Notices (bell + sidebar + teaser — four places).
- [Visual] Hero (shadow + tint) and verse card (gold bar, cream fill) compete; icon chips tinted.
- [UX] Group leader: no "who still needs a nudge"; Group missing from the phone bar (Phase 5 item).
- [A11y] Carousel dots ~5 px; autoplay control; Refresh as a separate row though Home refreshes on return.
- [Mobile] The verse card is 340 px tall on phone, pushing the teaser and actions below the fold.
- [UX] Batch "SPS" under the greeting repeats the menu profile card.

**11. SEO.** App route; not indexable. `document.title = "Home · Sadhana Record"`.

**12. Must remain unchanged.** `home.get` once on open, again after 2 min away; drafts "Not saved yet" banner with day links; reminder asked once after the first saved day (never on load), install never on the same day; Submit appears once per screen; the deadline from the server; Share today.

**13–21. Redesign.**
- **UI (phone, top → bottom):** greeting (`--fs-display`, time-of-day line, no batch) → **Status block** (one hero, `--shadow-2`, state wash): status line in `--fs-status` "3 days to fill — Mon, Tue, Wed · closes Mon 9 PM" → **7-day strip** (complete ✓ `--success`, partial ◐, **missing amber dot + "Missing"** for past unfilled, future ○ outline) → one Primary action, shown as a **pill row with your photo or initials** (the composer idea, `UI_UX_360_REVAMP.md` §2.1) ("Fill Monday" = the oldest missing day; "Submit week" in the window; "Submitted ✓ · 82%" + Share) → [Not saved yet Notice, inside the block] → **Needs-you card** (group leader: "1 in your group still to submit · Deepak ›"; facilitator member: "2 students not started ›"; hidden when empty) → [reminder/install card] → **Darshan card** (image + verse beneath; replaces the verse carousel) → announcement teaser **only when unread** → quick links row: Hearing · Reading · History · Share today (no Report, no Notices), each with a small icon in its category colour while the text stays neutral.
- **UX:** one hero; one count of days; the next action always names a day.
- **Interaction model:** day strip chips are links (44 px); long weeks of past open weeks shown as compact rows inside the block ("Week of 28 Sep · Submit by Mon 9 PM").
- **Motion:** Shared-element day chip → Day header (320 ms, High/Balanced); Numbers count-up on first view; Submit week moment arrives back here (ring completes, "✓ Week submitted · 82%"); Darshan fade.
- **Responsive:** Phone — single column as above. Tablet — two columns: status + needs-you | darshan. Desktop — 2/3 status + needs-you + quick links | 1/3 darshan (4:5) + teaser; no empty quarter.
- **States (exact):** loading — Skeleton of the status block; offline with cache — "Offline · showing what was kept on this phone"; error no cache — "Couldn't load your week — check your connection. Your saved days are safe." + Retry; first week empty — "Your first week starts today · Fill today's sadhana — it takes about 2 minutes." + Fill today; all done — "Today is done ✓ · Share".
- **Data presentation:** "Wed, 7 Oct" dates; deadline from `closesAt`; no rounds target (IYF decision).
- **Components changed/new:** Status block (new), Needs-you card (new), Darshan card (new), Status chip "Missing (day)", quick links row; QuoteCarousel retired on Home.
- **Micro-interactions:** the missing chip pulses once on first view (not looping; none under reduced motion); press sink 0.99 on rows.
- **Imagery:** **Recommended** — one Darshan card (§8.2 "Devotee Home: Yes", daily, lazy 480w ≤45 KB, meaningful alt). Never in the Status block.
- **Density:** PRIMARY status line + next action · SECONDARY needs-you · CONTEXTUAL deadline, part-week cap · ACTIONABLE Fill / Submit / Share / Nudge · OPTIONAL darshan + verse, teaser, quick links.

**22–25.** P0 (missing = amber, one count) / P1 · L · Med (shared week-summary definition) · "In 5 seconds I know which days I owe and the one thing to tap." · +0 KB startup (Home is in main chunk: status block replaces two cards, net ≈0); Needs-you ≤1.5 KB lazy; image 45 KB lazy · Phases 0 (amber missing, honest counts), 4 (block, darshan), 5 (needs-you for leaders/facilitators), 7 (motion).

**Before → After → Why better → Unchanged**
- Before: two cards repeat the count, missed days look future, six quick actions, a tall carousel.
- After: one status block with amber missing days and one named action, needs-you for leaders, one darshan.
- Why: the devotee's question answered first; one place per thing.
- Unchanged: data sources, refresh rule, reminder/install rules, drafts banner.

---

### `#/week` (redirect) and `#/week/<weekId>` (`?f=submit|days|attendance|nightStay…`) — This week (devotee)

**1. Current purpose.** `#/week` jumps to the newest open week. The week page: days and their status, end-of-week answers, attendance, submit; a submitted week shows its scores; a missed week a banner. `?f=` scrolls to and focuses a part (gap links, Home's Submit).

**2. Current UI structure.** Top bar **Back** + "◎ MY SADHANA / This week" → ring 0/7 + "Week of 5 Oct – 11 Oct · Closes Mon 9:00 PM · 3 days to finish" → **Days** grouped list (Mon–Wed "● Not filled ›", today with a 3 px bar; Thu–Sun dimmed "Not yet") → **End of week** card ("…open on Saturday at 6 PM.") → **Attendance** card (Present/Absent, **Present shown selected** though disabled; "Attendance opens on Sunday, the day of the class.") → **Submit** card (amber "Fill at least one whole day…", window line, deadline rule). Desktop: days left | three cards right.

**3–10. Problems.**
- [Nav] Back on a **bar tab root** (Week is in the bar); bell badge present on `#/week` but absent on `#/week/<id>` in the same session (bell fallback bug, review #5).
- [UX] Past unfilled days use the same grey "Not filled" dot as nothing-urgent; should be amber "Missing".
- [UX] Attendance looks chosen (Present filled) before Sunday — verify on real data (review §4.1); a disabled control must look neutral.
- [Hierarchy] Three cards (End of week, Attendance, Submit) are all closed until Sat/Sun but take ~600 px on Wednesday.
- [UX] Week-end Save shows "Saved ✓" before anything was saved (same false state as Day).
- [Mobile] The bottom bar covers the Attendance title at 390 px.
- [UX] Submit confirmation is inline `alertdialog`, not the Sheet pattern.

**11. SEO.** Not indexable. `document.title = "Week of 5 Oct · Sadhana Record"`.

**12. Must remain unchanged.** Redirect to newest open week; `?f=` focus; Night Stay + 4 principles **weekly Yes/No**, open Sat 6 PM, explicit Save with version (STALE handling); attendance from **Sunday 00:00**, higher mark wins with the "X marked you…" notice; no-class week note; part-week submit "Submit N of 7 days" with the cap text; confirm before submit; gaps link to fields; leave guard; server clock gates; fill-on-behalf reuse (`behalf`).

**13–21. Redesign.**
- **UI (phone):** title "This week" (no Back; Back appears only when opened from Home/History) → summary row: ring + "3 days to fill — Mon, Tue, Wed · closes Mon 9 PM" (`--fs-status`) → **Days** grouped list with Status chips: Complete / Partly filled / **Missing** (amber) / Not yet (muted) → **Week-end card** (one card): before Sat 6 PM collapsed to one line "Opens Sat 6 PM: Night Stay, 4 principles · Sun: attendance · Sun 6 PM: submit"; from Sat 6 PM it expands into three parts with their own gates → Primary "Submit week" / "Submit 4 of 7 days" opens a **confirm Sheet** with the consequence ("Wed, Thu, Fri will count as not filled (0). You can't change it afterwards.").
- **UX:** attendance segmented control shows **no selection** and muted styling until opensAt; week-end Save = `Save` (disabled) → `Saving…` → `Saved ✓` only after a real save.
- **Interaction model:** rows are 56 px links; `?f=` keeps working (scroll + focus; collapsed card auto-expands).
- **Motion:** Select chip/tab (fill fade 120 ms); Sheet open; Submit week moment (ring completes + score count-up ≤600 ms, once; haptic); failed-submit haptic (Android).
- **Responsive:** Phone — one column, bottom bar visible. Tablet — two columns. Desktop — days (with a per-day score column when filled) | week-end card + submit; content max 1,120 px.
- **States (exact):** loading Skeleton list; not open "This week isn't open yet." ; missed "Week of 28 Sep — missed (0). No complete day by the deadline. Ask your coordinator to reopen it."; submitted → scores view (see History detail) with "✓ Submitted · 82%"; error "Couldn't load this week — your saved days are safe." + Retry.
- **Data presentation:** day names "Mon, 5 Oct"; deadline from server; cap "at most about 43% in each daily part".
- **Components:** Status chip (Missing), Grouped list, Week-end card (new composite), Sheet (confirm), Stat ring.
- **Micro-interactions:** Yes/No toggles spring (`--ease-spring`); gap links pulse the target field once.
- **Imagery:** **Not recommended** (§8.2 Week/Fill: no). Optional 96 px darshan thumb only in the submitted success Sheet.
- **Density:** PRIMARY days to fill + Submit · SECONDARY week-end status · CONTEXTUAL deadline, part-week cap · ACTIONABLE open day, Save, Submit · OPTIONAL rules text (collapsed).

**22–25.** P0 (neutral attendance, honest Save) / P1 · M · Med (gates and `?f=` with collapsed card) · "I see what's missing and when each part opens without scrolling past locked cards." · +0 KB startup; ≤1 KB in lazy devotee chunk · Phases 0 (honest states), 2 (no Back on tab root, bell count), 4 (layout), 7 (submit moment).

**Before → After → Why better → Unchanged**
- Before: three locked cards, grey missing days, pre-selected attendance.
- After: missing in amber, one week-end card that opens on time, confirm Sheet.
- Why: honest, shorter, the next step obvious.
- Unchanged: every time gate, part-week rule, submit and attendance logic.

---

### `#/day/<weekId>/<date>` (`?f=<field>`, `?f=share`) — Daily sadhana (devotee)

**1. Current purpose.** Fill one day: body, chanting, hearing, reading, seva, Chetna, comment; live score; explicit Save; Share.

**2. Current UI structure.** Back + "◎ MY SADHANA / Daily sadhana" → sticky day chips (Mon–Sun, ○ / ◐ / ✓ / ·) → "Wednesday, 07 Oct 2026" → "How your day is scored ›" → [Still needed] → sections: **Body** (Slept at, Woke up at — wheel pickers "Set time"; Day rest) → **Chanting** (Rounds, finished at, same day Yes/No) → **Hearing** (minutes, the chosen topics, "Choose a topic", which opens the typed field **and the whole journal list with filters inside the form**) → **Reading** (minutes, the book, "Change book", which opens **the whole book list inside the form**) → **Seva and other** (service, topic, exercise, study/job) → **Chetna** chips → **Comment** (0/500) → floating **action bar** ("Day score 0/100", Share, **"Saved ✓"**) above the floating **bottom nav**. Desktop: two-column form; the action bar floats mid-page.

**3–10. Problems.**
- [UX] **P0:** "Saved ✓" on a day nobody touched (0/100) — a false state (review #6).
- [Mobile] Two floating bars (Save bar + nav pill) cover ~150 px at 390 px; they overlap "Completed the same day?".
- [UX] "Change book" when no book was ever chosen (should be "Choose book").
- [UX] **(Raised by the IYF head, 8 Oct 2026; P0.)** The Hearing and Reading pickers open **inside the form**: the journal list and the book list push the rest of the day down by several screen heights. The form looks untidy and the Save context is lost. The same happens on every route that fills a day (own day, fill-on-behalf).
- [UX] Date "07 Oct 2026" (numeric zero-pad); chips use the same ○ for missing past days.
- [Hierarchy] Section icon chips tinted; every section equal weight; "Still needed" appears only after typing.
- [Interaction] Minutes are free number fields; no −/+ steppers; no "Same as yesterday".
- [Mobile] Desktop two-column form scatters the reading order (Body → Chanting across, then down).
- [A11y] Chips "·" for future days are not announced as disabled; action-bar status changes are polite-live (OK).

**11. SEO.** Not indexable. `document.title = "Wed, 7 Oct · Sadhana Record"`.

**12. Must remain unchanged.** **Explicit Save**, never auto-send; local draft kept on the phone; leave guard (Save / Leave and save later / Discard / Stay); STALE handling ("changed on another device"); future days refused; live score from `$shared/scoring.js`; hearing topics picked from the journal (≤8) with typed fallback; book picked (remembered); Chetna chips; comment ≤500; limits (rounds 0–64, minutes 0–600/999); `?f=` focus; the typing class hides bars while a field has focus; Share only after save; fill-on-behalf variant.

**13–21. Redesign.**
- **UI (phone):** top bar "Wed, 7 Oct" (title = the date) with Back → sticky day chips with **Missing** amber dots → "Still needed: Wake-up, Rounds, Hearing" line (shown from the start for an empty day) → sections in one column, neutral icons → **one floating action bar only** (bottom nav hidden on this editor): "Day score 62/100" · Share · Primary **Save** (`Save` disabled until changed → `Saving…` → `Saved ✓`).
- **Hearing and Reading, compact (Phase 0; `IMPLEMENTATION_ROADMAP.md` §6):** each section shows only two things, **topic first, then duration**.
  - Hearing: a one-line **Topic** row ("SB 1.2.6 — lecture", or "first topic + 1 more", or "Choose the topic ›"), then the **minutes** field.
  - Reading: a one-line **Book** row (the remembered book, or "Choose the book ›"), then the **minutes** field.
  - Tapping a row opens a **Sheet** (bottom sheet on phones, dialog on desktop) holding the typed field and the journal or book list with filters. The lists never render inside the form.
  - Kept: ≤ 8 topics, typed topics, heard list, remembered book, "(required)" when minutes > 0, the data and scoring.
- **UX:** "Same as yesterday" Secondary button at the top for times/book (fills, does not save); minutes get **−/+ steppers** (5-min steps) beside the field; "Choose book" when none.
- **Interaction model:** swipe left/right between days with ‹ › buttons in the chip row (leave guard still applies); ← → on desktop.
- **Motion:** Shared-element chip → header; Save moment (check draws 320 ms + Android haptic); Error moment on rejected fields; nothing moves while typing.
- **Responsive:** Phone — one column, nav hidden, action bar docked to safe area. Tablet — one column 640 px, rail visible. Desktop — **single 720 px column** + right context column (score breakdown per category as Meters, "How your day is scored" inline).
- **States (exact):** loading form skeleton; future "Thu, 8 Oct opens that day."; submitted "This week is submitted. See the week ›"; offline "Not sent — no connection. Your entries are kept on this phone. Tap Save when you're back online."; stale "This day was changed on another device. Showing the latest — your changes here were not saved."; lists offline "Topic lists need a connection. You can still fill in the day."
- **Data presentation:** times 12-hour ("10:15 PM"); score tabular; Meters use `--viz-body` / `--viz-soul` / `--viz-seva`.
- **Components:** Stepper −/+ (new), Status chip Missing, action bar (changed), Meters (context column).
- **Micro-interactions:** wheel picker detents; Chetna chips fill 120 ms; Save button never shows ✓ unless a save returned.
- **Imagery:** **Not recommended** (§8.2 Day form: minimal distraction).
- **Density:** PRIMARY the fields still needed · SECONDARY live score · CONTEXTUAL last values, still-needed line · ACTIONABLE Save · OPTIONAL scoring rules (sheet), exercise/study.

**22–25.** P0 (Saved ✓, two bars) / P1 · M · Med (leave guard with swipe) · "I fill a day in under 2 minutes and Save means saved." · +0 KB startup; steppers + swipe ≤1.5 KB in lazy devotee chunk · Phases 0 (Save truth, hide nav, **compact Hearing/Reading**), 2 (nav hiding rule), 4 (steppers, same-as-yesterday, layout), 7 (swipe, shared element).

**Before → After → Why better → Unchanged**
- Before: false "Saved ✓", two floating bars, free-typed minutes.
- After: honest Save states, one bar, steppers, missing days visible, single column; Hearing and Reading are two lines each (topic/book, then duration) with lists in a Sheet.
- Why: trust and speed on the most-used screen.
- Unchanged: explicit Save, drafts, scoring, pick-from-lists, limits.

---

### `#/history` and `#/history/<weekId>` — History (devotee)

**1. Current purpose.** List of past weeks (Body/Soul/Overall %, "Missed · 0%"), 8 at a time; detail of one submitted week (Overall %, 11 activity bars, Night Stay, principles, average rounds, Share).

**2. Current UI structure.** List: Back + "◎ MY SADHANA / History" → grouped list rows "Week of …" · "Body 72% · Soul 64% · 5 of 7 days" · **81%** (serif, brand) → "Show earlier weeks". Empty (screenshot): Empty state "No weeks yet · Submitted weeks appear here." + "Open this week". Detail: overline "Week of … · submitted ✓" → big 81% "Overall" → "Activity Score" bars | "End of week" kv + **Share this week**. Phone bar highlights **Report** on History.

**3–10. Problems.**
- [Nav] A separate page duplicating Report › Weekly (resolved in §14: fold into Report, keep the route redirecting).
- [UX] `#/history/<week>` for a week neither submitted nor missed → **blank page** (features §9 #4).
- [UX] Empty state says nothing about *when* the first week appears.
- [Hierarchy] Desktop: 44 rem list in a wide empty pane; detail bars carousel hides categories on phone (7 × 7 px dots).
- [UX] Missed-week detail says "Ask your coordinator to reopen it" with no way to do it.

**11. SEO.** Not indexable. `document.title = "History · Sadhana Record"` / "Week of 28 Sep · Sadhana Record".

**12. Must remain unchanged.** `history.list` paging (8), `week.get` for detail, missed = 0, part-week "N of 7 days", Share this week; old links keep working.

**13–21. Redesign.**
- **UI:** `#/history` → **redirect** to `#/report?v=weekly` (Report › Weekly holds the list). `#/history/<weekId>` stays a child page: summary (Overall in `--fs-stat`, "Body 72 · Soul 64 · Seva 80 · Attendance 100" Stat tiles) → **Meters** (11 categories, weakest first, category colours) → End of week kv → Primary "Share this week".
- **UX:** an open (not submitted) week id → redirect to `#/week/<id>`; unknown → "This week has no record." + "Back to Report".
- **Motion:** Charts — meters grow once per session; Numbers count-up.
- **Responsive:** Phone — stacked. Tablet/Desktop — summary + kv left, meters right; "Show as table" toggle under the meters.
- **States (exact):** empty (in Report) "No weeks yet · Your first week appears here after Monday 9 PM." + "Open this week"; missed detail "Missed (0) · No complete day by the deadline. Your coordinator can ask to reopen it within 14 days."; error "Couldn't load this week." + Retry.
- **Components:** Meters (new), Stat tile, kv list.
- **Imagery:** **Not recommended** (§8.2 Report/History: data-first). Empty state **Optional** halo image (#17) for a devotee's first week.
- **Density:** PRIMARY overall + weakest category · SECONDARY category meters · CONTEXTUAL days filled, rounds · ACTIONABLE Share · OPTIONAL table view.

**22–25.** P1 (P0 for the blank page) · M · Low · "One place for my past weeks, never a blank page." · +0 KB; meters ≤1 KB · Phases 0 (blank-page fix), 4 (fold + meters).

**Before → After → Why better → Unchanged**
- Before: a duplicate list page, a blank page, hidden categories.
- After: list in Report › Weekly, a detail page with all categories visible.
- Why: one place per thing; honest edge cases.
- Unchanged: the data, paging, Share, old links.

---

### `#/report` — Report (devotee)

**1. Current purpose.** Progress: last submitted week + 12-week trend; Daily (month calendar coloured 80%+/50–79%/<50%/missed + the selected day's bars); Weekly (month's weeks + bars, average rounds, Night Stay, principles); Share.

**2. Current UI structure.** Phone: menu + "◎ MY SADHANA / Report" → [Last submitted week + trend, only when one exists] → "Day by day" → month wheel · year wheel → Daily/Weekly segmented → calendar card (M–S, today filled) → legend (tiny 10 px swatches) → "Activity score" card ("No record for 07 Oct 2026"). Desktop: calendar | activity side by side; toggle far right.

**3–10. Problems.**
- [UX] Calendar shows no missing past days (only "missed" weeks); Mon/Tue look like future days.
- [Hierarchy] With no submitted week the page opens on "Day by day" and a selected-day empty state — no summary of the current week.
- [A11y] Legend swatches ~10 px and low-contrast in dark mode; bar pages use 7 × 7 px dots.
- [Nav] The Daily/Weekly toggle sits below the pickers on phone (review: put it first).
- [UX] "In progress" (weekly list) vs "Filling" elsewhere; "07 Oct 2026" format.
- [Hierarchy] Desktop: right card mostly empty for a day with no record.

**11. SEO.** Not indexable. `document.title = "Report · Sadhana Record"`.

**12. Must remain unchanged.** Month wheel wraps; year wheel; missed weeks count 0 in the trend; drafts shown as "not submitted yet"; `history.list` (26) + `week.get` per submitted week in view (once); Share day/week; rounds average for open weeks.

**13–21. Redesign.**
- **UI:** Segmented **Daily · Weekly** first (tabs, §11) → summary row: last submitted week (Stat tile, count-up) + 12-week trend line (Overall brand blue; missed points as hollow amber) → month/year pickers → Daily: calendar with bands `--hi/--mid/--lo`, **solid amber dot = missing (past, unfilled)**, dashed amber outline = missed week, today ring → selected day panel: Meters (category colours) + Share. Weekly: the month's weeks as Grouped list rows with Status chips (Submitted 82% / Filling / Missed · 0%) + selected week Meters, kv, Share (this absorbs History).
- **UX:** `?v=weekly&w=<weekId>` deep links (History redirects here).
- **Motion:** Charts draw once per session; Select chip/tab indicator slides 200 ms; Numbers count-up.
- **Responsive:** Phone — stacked. Tablet — calendar | day panel. Desktop — summary across the top; calendar | panel; panel shows the week context (that week's 7 days as mini-meters) when the day is empty.
- **States (exact):** no record "Nothing filled on Wed, 7 Oct." + (if open and past) "Fill it ›"; missing day "Missing · not filled. Fill it before Mon 9 PM ›"; missed "Not submitted in time (0)."; loading skeleton calendar; error "Couldn't load your history." + Retry; first-time "Your report starts after your first submitted week."
- **Data presentation:** legend chips 16 px with words; "Show as table" under every chart.
- **Components:** Segmented control, Meters, Status chip, Sparkline/trend, calendar cell tokens.
- **Imagery:** **Not recommended** (§8.2 Report: data-first).
- **Density:** PRIMARY this period's result + chart · SECONDARY calendar / weeks · CONTEXTUAL trend, averages · ACTIONABLE Share, Fill missing day · OPTIONAL table view.

**22–25.** P1 · M · Low · "I see my trend and my gaps on one screen." · +0 KB startup; ≤2 KB lazy (meters, table toggle) · Phases 4 (layout, missing, fold History), 7 (chart motion), 8 (table view, contrast).

**Before → After → Why better → Unchanged**
- Before: calendar without gaps, tiny legend, History elsewhere.
- After: toggle first, amber missing days, meters, weeks list inside.
- Why: insight first; one place for the past.
- Unchanged: the calculations, sources and Share.

---

### `#/hearing` (`?v=all&w=&s=&q=&h=`) — Hearing (devotee)

**1. Current purpose.** The lecture journal: "N of 324 heard", one journal week at a time (SPL, GKGML, LOW 1, LOW 2), or All weeks with filters; opens recordings in Google Drive.

**2. Current UI structure.** Back + "◎ MY SADHANA / Hearing" → 6 px progress bar + "9 of 324 heard" → One week / All weeks segmented → stepper "‹ Week 3 of 3 ›" → "Suggested" pill → grouped list rows (slot · week · heard, title, "Listen ↗"). Phone bar highlights **Home**. Desktop: 672 px column centred.

**3–10. Problems.**
- [UX] "Week 3" reads as a calendar week; call it **"Lesson week 3"**.
- [Nav] Phone bar highlights Home with no hint why (Hearing is a child of Home per IA §11); Back label unclear.
- [Visual] 6 px progress bar with a 1% fill is nearly invisible; heard state is a green tick chip + green word (two signals, fine) but un-heard rows use a tinted headphone chip (decorative colour).
- [Interaction] "Listen" link 36 px tall.

**11. SEO.** Not indexable. `document.title = "Hearing · Sadhana Record"`.

**12. Must remain unchanged.** Only journal weeks reached so far (no stepping ahead, the head 7 Oct); suggested week; swipe and ← →; filters in the address; recordings open in Drive (no player); heard list from submitted weeks.

**13–21. Redesign.**
- **UI:** top bar Back labelled "Home" → progress as a Stat line "9 of 324 heard · 3%" with a 8 px bar → segmented One week / All weeks → stepper "‹ Lesson week 3 of 3 ›" + "Suggested" chip → grouped list (neutral headphone icon; heard = ✓ + "Heard" chip).
- **UX:** the active nav item stays Home on phone (IA §11), the sidebar marks Hearing on desktop.
- **Motion:** Select tab; list crossfade on week step (no slide on Low).
- **Responsive:** Phone one column; Tablet/Desktop 720 px column + (desktop) a right context card "This week's lessons heard: 1 of 4".
- **States (exact):** offline "Lectures need a connection." (existing); empty filter "No lectures match. Clear filters"; loading skeleton list.
- **Components:** Segmented control, Grouped list, Status chip (Heard).
- **Micro-interactions:** "Listen" 44 px target with external-link icon.
- **Imagery:** **Not recommended** (§8.2: lecture thumbnails maybe later; darshan no).
- **Density:** PRIMARY this lesson week's 4 lectures · SECONDARY progress · ACTIONABLE Listen · OPTIONAL All-weeks filters.

**22–25.** P2 · S · Low · "I know which lecture to hear next." · +0 KB · Phases 2 (nav label), 4 (wording, rows).

**Before → After → Why better → Unchanged**
- Before: "Week 3" confusion, invisible progress.
- After: "Lesson week 3", readable progress, neutral icons.
- Why: clearer meaning, calmer list.
- Unchanged: journal rules, filters, Drive links.

---

### `#/reading` (`?lv=&bq=`) — Reading (devotee)

**1. Current purpose.** The current book with its PDFs, then books by level (own first) with search; 8 rows then "Show all".

**2. Current UI structure.** Back + "◎ MY SADHANA / Reading" → [Your current book card, if any] → "Books" → level chips (VL-1, VL-2, VL-3, ✓ SPS/DPS (yours), BSS/BVS, All) → search → grouped list ("2 PDFs ⌄" / "Open PDF ↗") → "Show all 10" → "Please buy the books from ISKCON outlets." Phone bar highlights Home.

**3–10. Problems.**
- [Mobile] Level chips run off-screen at 390 px (BSS/BVS and All hidden, no edge cue).
- [UX] With no current book the page has no hero and no prompt to choose one.
- [Mobile] The note "Please buy the books…" sits under the floating nav.
- [Hierarchy] "Books" heading + chips + search + list all equal weight.

**11. SEO.** Not indexable. `document.title = "Reading · Sadhana Record"`.

**12. Must remain unchanged.** Own level first; level + search in the address; one PDF opens / several expand; current book remembered (and, per features §9 #6, also to be saved to the profile — Phase 0 fix); batch names (SPS/DPS/BSS/BVS), never "Level 4/5".

**13–21. Redesign.**
- **UI:** current book card (Content card: title, level chip, PDF buttons) or, if none, prompt "Choose the book you're reading — it fills in your day form." → level chips **wrapping** (or edge fade + scroll on one line) → search → grouped list → "Show all 10" → note with bottom padding = nav space.
- **Motion:** Select chip fill; `<details>` expand 200 ms.
- **Responsive:** Phone one column; Tablet/Desktop 720 px column; desktop current-book card beside the list.
- **States (exact):** offline "Books need a connection."; no match "No books match "gita" in SPS/DPS. 3 in other levels — Show all."
- **Components:** Content card, chips, Grouped list.
- **Imagery:** **Not recommended** now; book covers **Optional** later (§8.2).
- **Density:** PRIMARY current book · SECONDARY level list · ACTIONABLE Open PDF · OPTIONAL search, other levels.

**22–25.** P2 · S · Low · "My book is one tap away; every level is reachable on a phone." · +0 KB · Phases 0 (save current book to profile), 4.

**Before → After → Why better → Unchanged**
- Before: hidden chips, no prompt, note under the nav.
- After: wrapping chips, current-book prompt, clear spacing.
- Why: nothing hidden on small phones.
- Unchanged: levels, search, PDF links, address params.

---

### `#/learn` — old link (redirect)

**1. Current purpose.** Old address: `#/learn?f=reading` → `#/reading`; any other `#/learn` → `#/hearing` (replace, no history entry).

**2. Current UI structure.** A 2-row skeleton for one frame, then the redirect.

**3–10. Problems.** [Perf] none material; [UX] the skeleton flashes.

**11. SEO.** n/a.

**12. Must remain unchanged.** The redirect (old WhatsApp links and bookmarks).

**13–21. Redesign.** Keep. Render nothing (no skeleton) during the redirect. No imagery (**Not recommended**). Density: n/a.

**22–25.** P3 · S · Low · "Old links still land in the right place." · +0 KB · Phase — (any).

**Before → After → Why better → Unchanged**
- Before: redirect with a skeleton flash. After: silent redirect. Why: no flicker. Unchanged: both targets.

---

### IYF decisions for this part (answered 8 Oct 2026)

1. **D1:** the brand colour is the logo's blue (all routes).
2. **Darshan image rights:** already held by IYF; no credit line.
3. **Minimum age:** 15, with parent/guardian consent for 15–17 on sign-up step 1.
4. **Blood group, address, emergency contact:** stay required at sign-up.
5. **Rounds target:** not now; not shown anywhere.
6. **Hindi:** not needed now; English only.


---

## Part B — Group leader, facilitator and coordinator routes


**IYF Delhi · 8 October 2026 · part of `ROUTE_BY_ROUTE_REVAMP.md`**

**Evidence used:**
- the code: `devotee/Group.svelte`, `fac/Fac.svelte`, `ui/WeekRead.svelte`, `screens/Home.svelte`, `coord/*.svelte`, `devotee/Devotee.svelte` (behalf), `lib/staff.js`, `ui/Shell.svelte`;
- the sweep screenshots (390 light, 1280 dark) for the devotee-gl, devotee-fac, facilitator and coordinator personas;
- `DESIGN_SYSTEM.md` (DS), `UI_UX_360_REVAMP.md` (360), `current-features.md` §3, `pre-store-revamp-review.md` (review).

**Phases:**

| Phase | Name |
|---|---|
| 0 | Baseline, trust and store blockers |
| 1 | Design-system foundation |
| 2 | Global shell and navigation |
| 3 | Authentication experience |
| 4 | Devotee core |
| 5 | Group leader / facilitator / coordinator |
| 6 | IYF head / admin |
| 7 | Advanced interaction and motion |
| 8 | Performance / accessibility / SEO hardening |
| 9 | Store builds and final QA |

---

### B.0 Shared staff patterns (used by every section below)

| Pattern | Spec | Phase |
|---|---|---|
| **One week-summary definition** | `weekSummary(rows)` in `lib/staff.js` replaces `boardCounts`. It counts **active members only**, and Group, My students, Batch status, Filling chart and staff Home all use it. Inactive and disabled rows go into a collapsed footer, "Not active (2)". Fixes review P0 #2 | **0** |
| **Status chip** (DS §7.9) | **Submitted · Filling · Not started · Missed · Reopened**. "Draft" is retired everywhere (it comes from `STATUS` in `lib/staff.js`) | 1 |
| **Day strip** | 7 cells. Complete ✓, partial ◐, **past and unfilled = amber "Missing"**, future = outline. It has a tap-to-open legend: "✓ filled · ◐ part · amber missing · ○ not yet" | 1 |
| **Staff row** (DS §7.2 grouped list, compact) | Phone: 2 lines in 56 px, and the **whole row is the target** (name link no longer 24 px tall). Desktop: a `<table>` with 48 px rows, a sticky header, `aria-sort` and tabular numbers | 5 |
| **Row menu ⋯** | All destructive and secondary actions (Fill for, Delete, Take out of group, Disable) move into a ⋯ Sheet; destructive ones open a confirm Sheet with a danger-solid button (DS §7.5). **No destructive button in a row** | **0** (move) / 5 (polish) |
| **List + detail pane** (DS §7.7) | ≥ 1024 px: the list is 420–480 px and the detail pane fills the rest. The URL stays the child route, so deep links keep working; on a phone the child route is a full page | 5 |
| **P/A control** | Segmented 2 × 44 px. Before Sunday 00:00 it is **not shown**; a chip "Opens Sun" sits in its place, with no dashed pre-marks that look selected. Dashed "implied" marks appear only while marking is open | 5 |
| **Keyboard (desktop staff)** | `j`/`k` move row focus · `Enter` opens (in the pane) · `p`/`a` mark Present/Absent on the focused row (only while open) · `Ctrl/⌘+S` saves attendance · `/` and `Ctrl/⌘K` open Go to… (exists) · `Esc` closes the pane. Single keys are ignored while typing, when a dialog is open, or within 1.5 s of `g` (the existing `g`-chord in `Shell.svelte`) | 7 |
| **Dates** | "Wed, 7 Oct" in day contexts and "7 Oct 2026" elsewhere; never "05 Jan 2026" or "07/10/2026" | 1 |
| **Wording** | "the IYF head", never "the master" (seen in Board's closed banner and DevoteeDetail's reopen texts) | 1 |
| **Imagery** | None on any route in this part (360 §8.2: "Group, My students, Batch, Requests, Members, Stats, Admin: No — work screens") | — |
| **SEO** | Every route here is a signed-in hash route: `noindex` (contract §5) and no per-route meta. Nothing to add | — |

---

### `#/group` — My group (group leader)

**1. Current purpose.** The leader sees each group member's week, nudges those still to submit (Call, or WhatsApp with a prefilled message), and marks P/A for the group from Sunday 00:00 until Monday 9 PM. A coordinator's or the head's mark overrides theirs.

**2. Current UI structure.**
- Phone: top bar ("MY SADHANA" overline, "My group", Back) → overline "MY GROUP" + "4 devotees" + Refresh → two week pickers → 4-cell count strip → info banner → "3 of 4 submitted · 1 still to submit" → "Still to submit 1" list → "Submitted 3" list (55% opacity) → hint → action bar.
- Desktop: the same in one column; the status sits about 280 px right of the names.

**3–10. Problems.**
- [Hierarchy] Three summaries of one fact: the count strip, "3 of 4 submitted", and the section counts.
- [Visual][A11y] Submitted rows use `opacity: .55`, which reads poorly in dark mode (the 1280-dark capture).
- [Interaction] On a Wednesday the disabled P/A already shows **dashed P**, which looks like a mark.
- [Nav] Back arrow on what is a destination; "My group" appears three times (overline, title, block); the area overline says "MY SADHANA". Group is missing from the phone bar (Home · Week · Report · Account).
- [UX] Status says "Draft"; past unfilled days are not amber.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `group.list`/`group.mark`, the window (Sun 00:00 → Mon 21:00), precedence (head > coordinator > leader > week default > own);
- tap-again-to-clear, the Undo toast, explicit Save, the prefilled WhatsApp text, the week picker;
- the leader marks **only their group**.

**13–21. Redesign.**
- **Avatar ring row (P2, Phase 5; from the shared Facebook screenshot, `UI_UX_360_REVAMP.md` §2.1):** above the list, a sideways row of members' photos or initials, each with a **progress ring**: full green = submitted, part = filling, amber = missing days. Tap opens that person. It is a quick visual scan; the list below stays the full record. Not shown on Low tier.
- **UI:**
  - A Scope strip (DS §7.2) carries the counts plus "Closes Mon 9 PM".
  - Then **Still to submit** (full contrast, amber left edge), then **Submitted** (full contrast, muted chip; no opacity).
  - Top bar title "My group" (no overline); Back removed.
- **UX:** status line per row: "2 of 7 · Missing Mon, Tue". "Nudge all (1)" opens WhatsApp one by one from a Sheet listing who gets the message.
- **Interaction:** whole row = call sheet (Call / WhatsApp); P/A trailing; keyboard per B.0.
- **Motion:** a saved mark tints in 120 ms; rows **never re-sort while marking**; the action bar rises 200 ms.
- **Responsive:**
  - Phone: list.
  - Tablet: the same at 600 px max width.
  - Desktop: table (Name · Week · Days · Score · Higher mark · Attendance); no pane is needed (rows have no detail route).
- **States:**
  - "Attendance opens Sun, 11 Oct — the class day."
  - "Attendance closed Mon, 12 Oct, 9 PM. Ask your coordinator to change a mark."
  - "Everyone in your group has submitted. Hare Krishna."
  - Empty: "No one in your group yet — your coordinator adds devotees to your group."
  - Error: "Couldn't load your group — no connection. Showing the copy from 8:40 PM." + Retry.
- **Data:** list/table; day strip; % only when submitted.
- **Components:** Scope strip, Status chip, Staff row, P/A control, Sheet, Toast (Undo), Notice.
- **Micro-interactions:** Android haptic on Save (exists); the "N changes not saved" counter.
- **Imagery:** Not recommended (a work screen; the faces are the members' initials).
- **Density:**
  - PRIMARY: still to submit.
  - SECONDARY: the strip.
  - CONTEXTUAL: higher mark, deadline.
  - ACTIONABLE: call, nudge, P/A.
  - OPTIONAL: submitted list (collapsible when > 8).

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 (P0: shared counts) |
| Complexity | S–M |
| Risk | Low (UI only) |
| Benefit | High on Sundays |
| Performance budget | ≤ +1 KB gz to the devotee chunk; no new calls |
| Phase(s) | 0 (counts), 1 (chip, amber), 2 (bar item, no Back), 5 (layout), 7 (keys, motion) |

**Before → After → Why better → Unchanged.**
- **Before:** greyed list, triple counts, pre-dashed P on Wednesday.
- **After:** one strip, needs-nudge first at full contrast, P/A only when real.
- **Why better:** the leader sees who to call in one glance, and no false states remain.
- **Unchanged:** the API, the window, precedence, Undo.

---

### `#/my-devotees` — My students (facilitator; login-only and member)

**1. Current purpose.** A read-only list of every devotee whose facilitator this is (any batch), for any of the last 52 weeks, with Call and Chat.

**2. Current UI structure.**
- Phone: "MY STUDENTS / 7 students" + Refresh → week pickers → count strip → alphabetical rows (name; chip + strip + %; batch on a 3rd line) with Call and Chat.
- Desktop: the same rows stretched to 970 px, with about 600 px empty between strip and icons.

**3–10. Problems.**
- [UX] Alphabetical order hides who needs help (Ishaan, Manish and Sunil are "Not started" mid-list); there are no reasons.
- [Interaction] The counts are not filters.
- [Visual] No dot legend; "Draft".
- [Mobile] "SPS" wraps to its own line.
- [Nav] The facilitator-only Home is a one-link list ("My students") instead of opening here (360 §10).
- [Perf] Fine.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `fac.devotees`; read-only (no write controls ever);
- the 52-week picker; the chosen week carries to the student page; Call/Chat.

**13–21. Redesign.**
- **Avatar ring row (P2, Phase 5; from the shared Facebook screenshot, `UI_UX_360_REVAMP.md` §2.1):** above the list, a sideways row of members' photos or initials, each with a **progress ring**: full green = submitted, part = filling, amber = missing days. Tap opens that person. It is a quick visual scan; the list below stays the full record. Not shown on Low tier.
- **UI:** grouped list:
  - **Needs you** (amber edge): Not started, Missing ≥ 2 days, Missed;
  - **Filling**;
  - **Submitted** (collapsed, "5 submitted ›").
- **UX:** each row has a plain reason: "Nothing filled since Sun", "Missed last week", "Down 30 points" (needs an additive `prevOverall` field on `fac.devotees`), plus a 12-week **sparkline** (DS §7.8; additive `trend[12]`, desktop and pane only, so phones read no more rows).
- **Interaction:**
  - Scope-strip cells filter (`aria-pressed`).
  - Row → student. On desktop the student opens in the pane.
  - Keyboard: `j`/`k`/`Enter`/`/` (no `p`/`a`: read-only).
- **Motion:** group collapse 200 ms; pane slides from the right 220 ms; changed-row glow on refresh.
- **Responsive:**
  - Phone: grouped list.
  - Tablet: the same, 2-line rows.
  - Desktop: table (Name · Batch · Status · Days · Score · 12-week trend · Call/Chat) + detail pane.
- **States:**
  - "No students yet — devotees who choose you as their facilitator appear here."
  - "Everyone has submitted this week."
  - Filter empty: "No one is Filling — clear the filter."
- **Data:** table on desktop; sparkline ≤ 1 KB inline SVG; % tabular.
- **Components:** Scope strip, Grouped list, Status chip, Sparkline, Staff row, Empty state.
- **Micro-interactions:** pressed row sink 0.99; the filter chip fill fades 120 ms.
- **Imagery:** Not recommended (a data screen).
- **Density:**
  - PRIMARY: Needs you.
  - SECONDARY: strip.
  - CONTEXTUAL: reason, trend, batch.
  - ACTIONABLE: Call/Chat.
  - OPTIONAL: Submitted group.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 |
| Complexity | M (two additive fields) |
| Risk | Low–medium: D1 reads for `trend` must be budgeted (skill `sadhana-free-plan`); serve it from `submissions` in one query |
| Benefit | High |
| Performance budget | No startup change; fac chunk ≤ +2 KB gz; one call |
| Phase(s) | 0 (counts), 1 (chip, legend), 2 (facilitator-only Home opens here), 5 (grouping, reasons, pane), 7 (keys) |

**Before → After → Why better → Unchanged.**
- **Before:** an alphabetical list.
- **After:** "who needs me" first, with reasons and a trend.
- **Why better:** it answers the facilitator's one question.
- **Unchanged:** read-only, weeks, contacts.

---

### `#/my-devotees/<login>` — One student (facilitator)

**1. Current purpose.** Shows one student: their contacts, and any week since they joined.

**2. Current UI structure.**
- Phone: top bar "Student" → a centred card (name, "SPS · KT26-0110", Call primary filled, Chat) → "Reports" card with two week pickers + "This week ›" + up to 60 week rows ("Week of 28 Sep – 4 Oct  66% ›").
- Desktop: the same at 970 px; Call and Chat are 460 px wide each.

**3–10. Problems.**
- [UX] **P0 known issue 2:** on a direct link, "This week" ends in `/` (`focusW` not loaded), which gives "Page not found".
- [Hierarchy] Week pickers + "This week" + the list are three ways to the same week. "This week" has no status or score.
- [Visual] Scores in the accent colour, not banded; IYF ID shown (review: drop); generic title "Student".
- [Mobile] 1,276 px tall for 13 weeks; no trend.

**11. SEO.** noindex.

**12. Must remain unchanged.** `fac.devotee`; any week since joining (156 back); read-only; Call/Chat.

**13–21. Redesign.**
- **UI:**
  - Title = the student's name.
  - Header row: initials avatar · batch · "Facilitator view" chip · Call (Secondary) · Chat (Secondary). No Primary: there is no main action here.
  - **This week** summary: status chip, day strip, %.
  - **12-week sparkline + average**.
  - **Weeks** list, 48 px rows, banded % pills (`--hi/--mid/--lo`), Missed in red "Missed · 0".
  - One "Older weeks…" picker at the end, replacing the two at the top.
- **UX:** "This week" always resolves (it falls back to `mondayIST()`).
- **Interaction:** a row opens the week (pane on desktop); `j`/`k`/`Enter`; swipe ‹ › between students in list order (Phase 7).
- **Motion:** sparkline draws once per session (High/Balanced).
- **Responsive:**
  - Phone: page.
  - Tablet: page.
  - Desktop: it is the **pane** of My students; a direct link shows the list + pane.
- **States:**
  - "No submitted weeks yet — their first week appears after Monday 9 PM."
  - "Not active since 7 Sep" chip.
  - Error with Retry.
- **Data:** list, sparkline, banded pills.
- **Components:** Grouped list, Status chip, Sparkline, Stat tile (average), Button Secondary.
- **Micro-interactions:** the row chevron nudges 2 px on press.
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: this week.
  - SECONDARY: trend.
  - CONTEXTUAL: batch.
  - ACTIONABLE: Call/Chat.
  - OPTIONAL: older weeks.

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (link) / P1 |
| Complexity | S |
| Risk | Low |
| Benefit | Medium-high |
| Performance budget | No new call (`fac.devotee` already lists weeks) |
| Phase(s) | 0 (link fix), 1 (bands, dates), 5 (layout, pane), 7 (swipe) |

**Before → After → Why better → Unchanged.**
- **Before:** a broken direct link, duplicate pickers, a flat list.
- **After:** this week + trend + weeks.
- **Why better:** the student's direction is visible in 2 s.
- **Unchanged:** data, range, read-only.

---

### `#/my-devotees/<login>/<weekId>` — One student's week (facilitator; `WeekRead`)

**1. Current purpose.** A read-only week: score bars, each day in one line, a tap-to-open day report, and the week-end answers.

**2. Current UI structure.**
- Phone: name overline + "Week of 5 Oct – 11 Oct" → a bar carousel (4 of 11 bars visible, 3 dots of 7 × 7 px) → 7 day rows (3-line summaries + "93%" pill + chevron) → the key–value list (Average rounds, Night Stay, 4 regulative principles).
- Desktop: all 11 bars; rows 950 px wide.

**3–10. Problems.**
- [Mobile] The carousel hides 7 of 11 areas.
- [A11y] Dots of 7 × 7 px (review §2.2).
- [Visual] Every non-overall bar is the same brown, not the category colour.
- [UX] Misses are not bold; there is no ‹ › to the previous or next week; title "Week" is generic.
- [Hierarchy] The 3-line summaries wrap unevenly.
- **Test-data only:** future days scored (review §2.3).

**11. SEO.** noindex.

**12. Must remain unchanged.** `fac.week`; the part-week rules ("the other days count 0"); the day expand with `DayPractice`; read-only.

**13–21. Redesign.**
- **UI:**
  - Header: name + "Week of 5–11 Oct" + status chip + overall %.
  - **Meters (DS §7.8), weakest first**, coloured Body / Soul / Seva / Attendance, with hatch under 50%.
  - Day rows with **misses bolded** ("**Woke 6:10 AM**").
  - Week-end answers as 3 Stat tiles.
- **UX:** ‹ › week stepper in the header (bounded by `since` and the current week).
- **Interaction:** a day row expands (exists); `j`/`k` move between days; `[`/`]` move between weeks; "Show as table" toggle under the meters.
- **Motion:** the expand height animates 200 ms (instant with reduced motion); meters grow once.
- **Responsive:**
  - Phone: meters stacked.
  - Tablet: meters in 2 columns.
  - Desktop: meters left (360 px) | day list right.
- **States:**
  - "Missed · score 0 — no complete day by the deadline (2 of 7 days begun)." (exists; keep)
  - "Being filled · not submitted yet"
  - "Not started yet"
- **Data:** meters; day list; table toggle.
- **Components:** Meter, Status chip, Stat tile, Grouped list.
- **Micro-interactions:** chevron rotate 200 ms (exists).
- **Imagery:** Not recommended (360 §8.2: Report/History/Week: data-first).
- **Density:**
  - PRIMARY: overall + weakest areas.
  - SECONDARY: days.
  - CONTEXTUAL: week-end.
  - ACTIONABLE: none (read-only).
  - OPTIONAL: day detail.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 (P0: targets) |
| Complexity | M (Meter is shared with Report) |
| Risk | Low |
| Benefit | High |
| Performance budget | Meter CSS-only, ≤ 0.8 KB |
| Phase(s) | 0 (dots → targets ≥ 24 px, or removed), 1 (viz colours), 4 (Meter built for Report), 5 (adopt here), 7 (stepper keys) |

**Before → After → Why better → Unchanged.**
- **Before:** a carousel with tiny dots.
- **After:** all areas at once, weakest first.
- **Why better:** the guidance conversation starts from the weak area.
- **Unchanged:** data and rules.

---

### `#/home` — Staff Home (coordinator without a devotee scope)

**1. Current purpose.** The coordinator's start screen: waiting requests, links to batch tools, the verse, birthdays.

**2. Current UI structure.**
- Phone: date overline + "Hare Krishna, SPS" + "Batch coordinator · SPS, SPS Group 2, SPS Online" → "Batch work" → hero "Waiting for you" (two tiles, "3 sign-ups waiting", "1 password reset", both to `#/requests`) + "Open requests" → a 2-row link list ("Batch status and attendance", "Filling chart") → verse carousel (~330 px, 5 px dots) → Birthdays.
- Desktop: hero at half width; the right column holds 2 link rows; about 40% is empty.

**3–10. Problems.**
- [Content] "Hare Krishna, **SPS**": the first word of the team login "SPS Team".
- [IA] Navigation lists on Home (360 §10: none); two tiles open the same page.
- [UX] No this-week view of the batches and no people to nudge.
- [A11y] Carousel dots of about 5 px.
- [Visual] Reopen status is missing for coordinators.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `requests.list`, `reopen.list`, `birthdays.today`;
- birthdays last on the page (CLS 0);
- a devotee-scoped coordinator still gets `DevoteeHome` first.

**13–21. Redesign** (three slots, 360 §10):
1. **Needs you** card (amber edge; only non-zero rows; age shown):
   - "3 waiting for approval · oldest 6 days ›"
   - "1 password reset — call first ›"
   - "2 reopen requests waiting for the IYF head" (info, opens Requests › Reopens)
   - Sun–Mon only: "Attendance open — SPS not marked yet ›"
   - Empty: "All caught up."
2. **This week**: one **Scope strip per batch** (active only): Submitted / Filling / Not started / Missed + "Closes Mon 9 PM". A tap opens `#/batch` filtered (query-string matching fixed first: known issue 3).
3. **People to nudge** (top 5 not started, Call/WhatsApp), then Birthdays, then **one static verse** (no carousel).

- **Greeting:** a team login (name ends "Team" or no personal name) gets "Hare Krishna" + the batch names.
- **Interaction:** rows are links; `g b`, `g h` and `/` (exist).
- **Motion:** counts count up 400 ms once (High/Balanced); changed strips glow on refresh.
- **Responsive:**
  - Phone: stacked.
  - Tablet: Needs you | This week, 2 columns.
  - Desktop: 2 columns (Needs you + People | per-batch strips + Birthdays); no empty half.
- **States:** skeleton of the 3 slots; "Couldn't load requests — Retry. The other cards still work."
- **Data:** strips; short lists.
- **Components:** Needs-you card, Scope strip, Grouped list, Stat tile, Toast.
- **Micro-interactions:** chevron press; badge only for actionable counts.
- **Imagery:** Not recommended: the darshan card is "never in staff areas" (DS §7.2).
- **Density:**
  - PRIMARY: Needs you.
  - SECONDARY: This week.
  - CONTEXTUAL: deadline.
  - ACTIONABLE: rows, nudge.
  - OPTIONAL: verse, birthdays.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 |
| Complexity | M (strips reuse `devotees.list` per batch; ≤ 3 batches, cached) |
| Risk | Medium: extra reads on Home; load the strips lazily after Needs you |
| Benefit | High |
| Performance budget | Home stays in the startup chunk only as a shell; the strips are a lazy staff chunk ≤ 3 KB gz |
| Phase(s) | 0 (shared counts), 2 (remove link lists), 5 (slots), 7 (count-up) |

**Before → After → Why better → Unchanged.**
- **Before:** tiles + links + carousel.
- **After:** what needs me, how my batches stand, whom to call.
- **Why better:** a decision screen, not a menu.
- **Unchanged:** data sources, birthdays.

---

### `#/batch` — Batch status (coordinator; tab "Status")

**1. Current purpose.** The weekly board: status per member, P/A attendance (saved in chunks of 250, Undo), "No regular class this week", Fill for, batch/week/name filters.

**2. Current UI structure.**
- Phone: tabs (Status · Members · Group leaders · Filling chart) → Batch select → week pickers → count chips ("4 / 3 / **5** / 0") → search → "No regular class this week?" + Refresh → banner → rows (name; chip, strip, "2/7", **"Fill"**; P/A).
- Desktop: the same plus a "DEVOTEE / THIS WEEK / ATTENDANCE" header with about 280 px gaps.

**3–10. Problems.**
- [UX] **P0 #2:** "5 Not started" counts Lalit (inactive) and Manish (disabled); the Filling chart says 3.
- [A11y] **P0:** "Fill" link 19 × 32; name links 24 px tall.
- [Interaction] Before Sunday, dashed P/A look chosen.
- [Hierarchy] Alphabetical, not needs-action first; inactive rows sit mid-list.
- [Nav] Desktop tabs duplicate the sidebar; the sidebar says "All my batches" while the page shows "SPS".
- [Content] "Draft"; "by coordinator"; "the master can change it".
- [Mobile] 1,784 px for 12 people.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `devotees.list`, `attendance.set` (≤ 250 per call), `weeks.setClass` and its Sheet (Holiday/Festival/Other, everyone or only marked);
- precedence; Undo; the lock;
- Fill only for active rows in an open week;
- a coordinator sees only their batches.

**13–21. Redesign.**
- **UI:**
  - Page head: batch name (picker only if > 1, synced with the sidebar) · week stepper · Scope strip (active only, tappable filters).
  - Rows sorted **Not started → Filling → Missed → Submitted**.
  - "Not active (2)" footer, collapsed.
- **UX:**
  - "Fill for…" and "Open devotee" move to the row ⋯.
  - A class-week Notice: "Diwali · everyone Present" + Change.
  - "No regular class this week?" becomes an Outline button in the head.
- **Interaction:** whole row → devotee (pane on desktop); P/A trailing; keyboard `j`/`k`/`p`/`a`/`Ctrl+S`/`Enter`; long-press → ⋯ (Phase 7).
- **Motion:** no re-sort while marking; FLIP re-sort ≤ 50 rows on refresh; changed-row glow 1.2 s.
- **Responsive:**
  - Phone: list.
  - Tablet: list, 2-line.
  - Desktop: table (Name · Status · Days · Score · Leader/own mark · Attendance) + DevoteeDetail pane.
- **States:**
  - "Attendance opens Sun, 11 Oct — the class day."
  - "Attendance closed Mon, 12 Oct, 9 PM — the IYF head can change it."
  - "3 attendance changes not saved"
  - "No one matches — clear the search or the status."
- **Data:** table / 2-line list; day strip; %.
- **Components:** Scope strip, Staff row, P/A control, Row menu, Sheet, Notice, Toast (Undo).
- **Micro-interactions:** "Saved for 9 devotees · Undo".
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: who has not started.
  - SECONDARY: strip.
  - CONTEXTUAL: leader/own marks, filled by coordinator.
  - ACTIONABLE: P/A, fill.
  - OPTIONAL: not-active footer.

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (counts, targets) / P1 |
| Complexity | M |
| Risk | Low (UI; the same API) |
| Benefit | Very high |
| Performance budget | coord chunk ≤ +3 KB gz; render 300 rows < 16 ms per frame (no virtualisation needed under 300) |
| Phase(s) | 0, 1, 2 (tabs → sidebar on desktop; one batch scope), 5, 7 |

**Before → After → Why better → Unchanged.**
- **Before:** inflated counts, tiny Fill links, alphabetical order.
- **After:** true counts, needs-action first, ⋯ actions.
- **Why better:** staff trust the numbers.
- **Unchanged:** every attendance rule and API.

---

### `#/members` — Devotees (coordinator; tab, page title "Devotees")

**1. Current purpose.** A directory of a coordinator's batches (the head: all), with search, filters, paging, call/WhatsApp, and delete for inactive or disabled members.

**2. Current UI structure.**
- Phone: search → 4 wheel selects (batch, class, blood group, sort) → status segment "All 12 / Active 10 / Inactive 1 / Disabled 1" → "12 members" → rows (photo, name, batch, IYF ID, last week) + Call/WA + a **red "Delete" button** on inactive and disabled rows.
- Desktop: the list is centred at about 860 px.

**3–10. Problems.**
- [Interaction] **P0:** a destructive Delete button sits in the row (DS §7.5).
- [Mobile] The filters take about 230 px before the first row.
- [Content] "Members" vs "Devotees" (360 §12).
- [Visual] Active rows get no chip; the IYF ID adds noise.
- **Test-data only:** "Nothing submitted yet" on every row.
- [Nav] Desktop tabs duplicate the sidebar.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `members.list` (server paging 50, "Show more"); the filters, including blood group;
- type-the-phone delete confirm; Call/WhatsApp; the head's "All of IYF Delhi" scope.

**13–21. Redesign.**
- **UI:**
  - Search + a "Filters (2)" button → Sheet holding batch / class / blood group / sort.
  - Status segment kept, with counts.
  - Applied filters shown as removable chips.
- **UX:** Delete moves to row ⋯ → the existing confirm Sheet, with the consequence: "Deletes Lalit Chauhan's account. Submitted weeks stay without the name. This can't be undone."
- **Interaction:** row → devotee pane; `j`/`k`/`Enter`/`/`; Esc closes the pane.
- **Motion:** a deleted row collapses 200 ms; the pane slides 220 ms.
- **Responsive:**
  - Phone: list.
  - Tablet: list.
  - Desktop: sortable table (Photo · Name · Batch · Status · Last submitted · Blood group when filtered) + pane.
- **States:**
  - "Nobody matches these filters — clear them."
  - "Approved devotees of your batches appear here."
  - "12 of 48 · Show more"
- **Data:** a table with `aria-sort`.
- **Components:** Search, Sheet, Status chip, Staff row, Row menu, Photo.
- **Micro-interactions:** chip × fades 120 ms.
- **Imagery:** Not recommended (avatars only).
- **Density:**
  - PRIMARY: name + status.
  - SECONDARY: last submitted.
  - CONTEXTUAL: batch, blood group.
  - ACTIONABLE: call, ⋯.
  - OPTIONAL: IYF ID (pane only).

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (row Delete) / P1 |
| Complexity | S–M |
| Risk | Low |
| Benefit | Medium |
| Performance budget | Unchanged calls; ≤ +1 KB |
| Phase(s) | 0, 1 (naming), 2, 5 |

**Before → After → Why better → Unchanged.**
- **Before:** filter wall + red row buttons.
- **After:** compact filters, safe ⋯.
- **Why better:** fewer accidents, faster scanning.
- **Unchanged:** server filters and the delete rule.

---

### `#/leaders` — Group leaders (coordinator; tab)

**1. Current purpose.** Appoint leaders, add or take out members (in at most one group, own batch pool), remove a leader, contact a leader.

**2. Current UI structure.**
- Phone: Batch select → "1 group · 5 devotees in no group" → "Appoint a group leader" card (select + disabled Appoint) → a card per group (leader + Call/WA; members with chip and **× button**; "Add devotees"; "Remove leader") → "In no group (5)" disclosure.
- Desktop: the same at full width; "In no group" is centred.

**3–10. Problems.**
- [Interaction] **P0:** × "Take out" acts **immediately**, with no confirm and no Undo.
- [A11y] Member name links are 24 px tall (review §2.2).
- [Hierarchy] The rare action (Appoint) is the first card; groups come second.
- [Content] "Draft".
- [Visual] A disabled Appoint is shown as a faded primary.

**11. SEO.** noindex.

**12. Must remain unchanged.** `leaders.list/set/assign`; one group per devotee; a leader is in no group; removing a leader frees the members; the checkbox Sheet.

**13–21. Redesign.**
- **UI:**
  - Groups first: header = leader, count, this-week mini strip ("3 of 4 submitted"), Call/WA, ⋯ (Add devotees, Remove leader).
  - Members as 48 px rows: chip + ⋯ "Take out of group".
  - "In no group (5)" as a list with "Add to a group ›".
  - "Appoint a group leader" becomes an Outline button → Sheet.
- **UX:** Take out → Toast "Aarav Gupta is in no group now · Undo" (re-assign with `leaders.assign`).
- **Interaction:** `j`/`k`/`Enter`; drag is not added (no library).
- **Motion:** a moved member slides out (FLIP 200 ms).
- **Responsive:**
  - Phone: stacked groups.
  - Tablet: 2-column grid of groups.
  - Desktop: groups grid (2–3) + "In no group" side column.
- **States:**
  - "No group leaders yet — appoint a devotee, then add devotees to their group."
  - "Everyone is already in a group."
  - "Every active devotee of SPS, SPS Group 2 and SPS Online is already a group leader."
- **Data:** cards per group (a real unit of action), lists inside.
- **Components:** Grouped list, Sheet, Row menu, Toast (Undo), Status chip.
- **Micro-interactions:** the count badge updates with a 120 ms tint.
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: groups.
  - SECONDARY: unassigned.
  - CONTEXTUAL: status.
  - ACTIONABLE: add, take out.
  - OPTIONAL: appoint.

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (Take out) / P1 |
| Complexity | S |
| Risk | Low (Undo uses the existing API) |
| Benefit | Medium |
| Performance budget | ≤ +1 KB |
| Phase(s) | 0, 1, 5, 7 |

**Before → After → Why better → Unchanged.**
- **Before:** one-tap removal.
- **After:** ⋯ + Undo, groups first.
- **Why better:** safe and scannable.
- **Unchanged:** all group rules.

---

### `#/stats` — Filling chart (coordinator; tab)

**1. Current purpose.** Trends for one batch: this week by day, the last 8 weeks' submission share, people counts, and the missed-weeks log.

**2. Current UI structure.**
- Phone: Batch → Refresh → "Week of 5 Oct – 11 Oct" with 4 tiles ("4/10 submitted…") + a day-bar carousel (4 of 7 days, dots) → "Forms submitted, by week" carousel → People tiles (active / inactive / disabled / "waiting approval") + "Open requests" → Missed weeks (name, week, "1 of 7 days").
- Desktop: a 2 × 2 grid.

**3–10. Problems.**
- [IA] The four tiles duplicate Batch status (review §3.1: the chart shows **trends only**). "Open requests" duplicates Requests.
- [A11y] Dots of 7 × 7 px; carousels hide 3 days and 3 weeks.
- [UX] Missed weeks have no actions (review: call, WhatsApp, ask to reopen).
- [Content] "waiting approval".

**11. SEO.** noindex.

**12. Must remain unchanged.** `stats.batch`; 8 weeks; the missed log with Show more; batch picker.

**13–21. Redesign.**
- **UI:**
  - **Day bars: all 7 at once** (a 7-column CSS grid, 28 px bars).
  - **8-week line/bar** fully visible, with the average line.
  - People becomes one line: "10 active · 1 inactive · 1 disabled".
  - **Missed weeks** rows: name · week · days · ⋯ (Call, WhatsApp, Ask to reopen → the DevoteeDetail flow).
- **UX:** "Show as table" under each chart; tap a bar to show its value (DS §7.8).
- **Interaction:** `j`/`k` in the missed list; `Enter` opens the devotee pane.
- **Motion:** bars grow once per session; none on Low.
- **Responsive:**
  - Phone: stacked.
  - Tablet: 2 columns.
  - Desktop: charts row (day | trend) + missed table.
- **States:**
  - "No missed weeks — everyone submitted in the last 8 weeks." (keep)
  - Chart empty: "No submissions yet for this batch."
- **Data:** bars (mono brand, Overall series), table toggle.
- **Components:** Bars (no carousel), Grouped list, Row menu, Notice.
- **Micro-interactions:** bar tap shows its value tooltip for 120 ms.
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: trend.
  - SECONDARY: day bars.
  - CONTEXTUAL: people line.
  - ACTIONABLE: missed-week actions.
  - OPTIONAL: tables.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 (P0: dots) |
| Complexity | S |
| Risk | Low |
| Benefit | Medium |
| Performance budget | Removes carousel JS; net ≤ 0 KB |
| Phase(s) | 0 (dots/targets), 1, 5, 7 |

**Before → After → Why better → Unchanged.**
- **Before:** duplicate counts + carousels.
- **After:** trends you can read whole, missed weeks you can act on.
- **Why better:** one purpose per screen.
- **Unchanged:** data and the API.

---

### `#/requests` — Requests inbox (coordinator; reopens merged)

**1. Current purpose.**
- Approve or reject sign-ups (registry match, "pick another ID", facilitator, level-entry date, class day).
- Approve or reject password resets ("call first").
- Reopens live elsewhere: `#/reopens` (head) and DevoteeDetail (coordinator's "Ask to reopen", whose status is never shown back).

**2. Current UI structure.**
- Phone: Batch select → Refresh → "New sign-ups 3" → full cards (~600 px each: contacts, radio matches, search, facilitator, date "07/10/2026", class day, Reject… / Approve) → "Password resets 1" card.
- Desktop: 2 columns; the resets column is 1 card and ~1,700 px of empty space.

**3–10. Problems.**
- [Mobile] 3,118 px for 4 requests.
- [Visual] **4 Primary "Approve" buttons per view** (DS: max 1).
- [Content] "07/10/2026"; "Batch SPSO" (an ID, not the name); "Natvar Gopi…" truncated; "1 Oct, 9:10 am" with no age.
- [UX] A pre-selected match (Ankit) is unexplained; reopens are split (review §3.1).
- [Nav] Desktop has no list + detail.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `requests.*`, `registry.search`, `resets.*`, `reopen.list` (STAFF, pending, own batches);
- nobody approves their own; the "call first" warning; reject needs a reason;
- `defaultChoice` logic; routes `#/requests` and `#/reopens` both keep working (`#/reopens` → `#/requests?type=reopen`);
- **coordinators never decide reopens** (head only).

**13–21. Redesign.**
- **UI:**
  - Type filter **All · Sign-ups (3) · Resets (1) · Reopens (2)**.
  - Compact rows: avatar initial · name · type chip · batch **name** · age "6 days ago" · chevron.
  - A row opens the **detail** (the existing SignUpCard / reset card) as a phone page or desktop pane.
  - Coordinator reopen rows are read-only: "Week of 21–27 Sep · waiting for the IYF head · asked 2 days ago".
- **UX:**
  - The match explains itself: "Pre-selected: phone and name match".
  - Facilitator shown in full (wrap).
  - Level-entry date "7 Oct 2026".
- **Interaction:** `j`/`k`/`Enter`; Approve via button or `Ctrl/⌘+Enter` inside the pane; **no single-key approve** (it changes accounts).
- **Motion:** an approved row slides out (FLIP 200 ms) and the next one opens in the pane.
- **Responsive:**
  - Phone: list → page.
  - Tablet: list → page.
  - Desktop: list 440 px | pane.
- **States:**
  - "No requests waiting — new sign-ups, password resets and reopen requests for your batches appear here."
  - Per filter: "No sign-ups waiting."
  - Reset: "Before approving, call Sunil Kumar on 60000 00001 and confirm they asked for a new password."
- **Data:** a list with ages; a form in the pane.
- **Components:** Seg filter, Grouped list, Status chip, Sheet (reject reason), Button (1 Primary per pane), Toast.
- **Micro-interactions:** the badge decrements with a tint.
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: oldest waiting.
  - SECONDARY: type counts.
  - CONTEXTUAL: age, batch.
  - ACTIONABLE: Approve/Reject.
  - OPTIONAL: registry search.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 |
| Complexity | M |
| Risk | Medium: the approve form moves; keep its tests |
| Benefit | High |
| Performance budget | One extra cached call (`reopen.list`), ≤ +2 KB |
| Phase(s) | 0 (query-string route fix), 1 (dates, names), 2 (one inbox, one badge), 5 (list-detail), 6 (head decides reopens here), 7 |

**Before → After → Why better → Unchanged.**
- **Before:** a 3,118 px wall of forms.
- **After:** an inbox with ages and one form at a time.
- **Why better:** faster and safer approvals.
- **Unchanged:** every rule and API.

---

### `#/devotee/<login>` — Devotee detail (coordinator)

**1. Current purpose.** One devotee's profile, contacts, emergency contact, facilitator/class, batch history, last weeks, fill on behalf, ask to reopen, and the account actions.

**2. Current UI structure.**
- Phone (2,461 px): profile card (Call 6000000011 primary, WhatsApp, Email, then **the same contacts again** as rows; "05 Jan 2026") → Facilitator and class (Change) → Batch history → "Fill for Aarav" (View + "Fill this week") → Last weeks (8 × "Attendance: not marked") → Account (Mark inactive + **three red buttons**: Disable login, Remove photo, Delete account).
- Desktop: 2 columns.

**3–10. Problems.**
- [Interaction] Destructive actions stacked as row buttons; inline confirms instead of a Sheet.
- [Hierarchy] Contacts are repeated; generic title "Devotee".
- [UX] "Fill this week" is offered for a submitted week (Aarav, 60%).
- [Content] "05 Jan 2026"; "Ask the master".
- [A11y] "View" 33 × 20 (review §2.2).
- [Visual] No trend.

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `devotees.get` and every action with its confirm and reason;
- coordinator: own batches only, "ask to reopen" (head decides); fill only open weeks;
- delete by typing the phone; `fixRow` board sync.

**13–21. Redesign.**
- **UI:**
  - Title = name.
  - Header: photo, status chip, batch; **Call · WhatsApp · Email** (one row, no repeats).
  - **This week** card: chip, strip, and **"Fill for Aarav"** Primary, shown only if the week is open and not submitted.
  - 12-week sparkline.
  - **Weeks** list: banded pill, attendance + who, "Ask to reopen" on Missed.
  - Profile facts in a disclosure ("Details: birthday, blood group, address, emergency").
  - **"More actions ⋯"** Sheet: Mark inactive, Disable login, Remove photo, Delete account; each opens a confirm Sheet with the consequence.
- **UX:** an asked reopen shows "Waiting for the IYF head" on that week.
- **Interaction:** `[`/`]` previous/next devotee in board order; `Esc` closes the pane.
- **Motion:** pane 220 ms; Sheets spring 200 ms.
- **Responsive:**
  - Phone: page (about 1,300 px).
  - Tablet: 2 columns.
  - Desktop: the pane of Batch/Devotees, or a 2-column page.
- **States:**
  - "Not active since 7 Sep — they are not expected that week."
  - "Waiting for approval — open Requests."
  - "No submitted or missed weeks yet."
- **Data:** list, sparkline.
- **Components:** Photo, Status chip, Sparkline, Grouped list, Sheet, Row menu, Toast.
- **Micro-interactions:** the Call button press haptic (Android).
- **Imagery:** Not recommended (profile photo only).
- **Density:**
  - PRIMARY: this week + Fill.
  - SECONDARY: weeks.
  - CONTEXTUAL: facilitator/class.
  - ACTIONABLE: contact, reopen.
  - OPTIONAL: details, account actions.

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (destructive, target) / P1 |
| Complexity | M |
| Risk | Medium: many actions; keep the existing test IDs |
| Benefit | High |
| Performance budget | No new calls |
| Phase(s) | 0, 1, 5, 7 |

**Before → After → Why better → Unchanged.**
- **Before:** 2,461 px, three red buttons.
- **After:** the status and the fill first, risk behind ⋯.
- **Why better:** fewer mistakes.
- **Unchanged:** permissions and actions.

---

### `#/devotee/<login>/week/<weekId>` — A devotee's week, read-only (coordinator; `WeekRead`, `devotees.week`)

**1. Current purpose.** The facilitator's week view, for staff. A coordinator sees only open weeks; the head sees any week.

**2. Current UI structure.** Identical to the facilitator week (bar carousel, 7 day rows, week-end list); top bar "MY BATCH / Week".

**3–10. Problems.**
- Every problem listed for `#/my-devotees/<login>/<weekId>` applies.
- [UX] There is no path to "Fill for…" when the week is open and not submitted.
- [A11y] The entry point "View" is 33 × 20 px.

**11. SEO.** noindex.

**12. Must remain unchanged.** `devotees.week` scope rules (coordinator: open weeks only); read-only.

**13–21. Redesign.**
- Same as the facilitator week: meters (weakest first), bold misses, ‹ › stepper limited to weeks the role may see.
- **Addition:** if the week is open and unsubmitted, a Secondary "Fill for Aarav ›" in the header (the same rule as the Board).
- **Keyboard:** `[`/`]`, `j`/`k`.
- **Responsive:** as the facilitator week; on desktop it opens inside the DevoteeDetail pane.
- **States:** "This week is not open to coordinators — only open weeks can be viewed." (the server's refusal, in plain words).
- **Components:** as the facilitator week.
- **Imagery:** Not recommended.
- **Density:**
  - PRIMARY: overall + weakest.
  - SECONDARY: days.
  - CONTEXTUAL: week-end.
  - ACTIONABLE: Fill.
  - OPTIONAL: tables.

**22–25.**

| Item | Value |
|---|---|
| Priority | P1 |
| Complexity | S (shared component) |
| Risk | Low |
| Benefit | Medium |
| Performance budget | 0 (shared `WeekRead`) |
| Phase(s) | 0 (target), 5, 7 |

**Before → After → Why better → Unchanged.**
- **Before:** a carousel with a dead end.
- **After:** meters + a Fill link.
- **Why better:** read → act in one step.
- **Unchanged:** visibility rules.

---

### `#/fill/<login>/week/<weekId>` and `#/fill/<login>/day/<weekId>/<date>` — Fill on behalf (coordinator)

**1. Current purpose.** A coordinator fills days, saves the week end and submits for a devotee. Saved as "filled by the coordinator"; attendance is read-only here; Share is hidden.

**2. Current UI structure.**
- **Week, phone:** title "**Filling for a de…**" (cut) → amber banner "Filling for Deepak Yadav — saved as filled by the coordinator. **Back to Deepak Yadav**" → ring "0/7" + "Closes Mon 9:00 PM · 3 days to finish" → days (Mon, Tue "Not filled" in **grey**) → End of week → Attendance ("now Present") → Submit.
- **Day:** day chips → "Monday, **05 Oct 2026**" → "How **your** day is scored" → the form → a floating bar "0/100 · **Saved ✓**" on an untouched day, stacked on the bottom nav (phone). On desktop the bar covers "Choose a topic".

**3–10. Problems.**
- [A11y] **P0:** "Back to …" is 17 px tall.
- [UX] **P0 #6:** "Saved ✓" on an untouched day.
- [Content] "your" → "their"; numeric date; truncated title.
- [Visual] Past unfilled days are grey, not amber "Missing".
- [Mobile] Two floating bars (~150 px).
- [Layout] The desktop day form uses 2 columns (review: single column).
- [Trust] Behalf saves are missing from Activity (known issue 7). Attendance in reopened weeks is blocked (issue 5).

**11. SEO.** noindex.

**12. Must remain unchanged.**
- `week.*` with `onBehalfOf`; open weeks only; explicit Save; the leave guard;
- the devotee's own journals, book and rules; attendance read-only here; `?n=` name memory;
- submit with the same part-week rules.

**13–21. Redesign.**
- **Hearing and Reading, compact (Phase 0):** the fill-for day uses the same day form, so it gets the same two-line Hearing and Reading (topic or book first, then duration; lists in a Sheet). It uses the devotee's own journal, heard list and book, as since 7 Oct.
- **UI:**
  - A sticky **Acting-as bar** (surface-floating, coordinator area marker 3 px): avatar · "Filling for Deepak Yadav" · "Saved as filled by the coordinator" · **Done** (44 px; back to the devotee).
  - Top-bar title "Deepak Yadav · Week" / "Deepak Yadav · Mon, 5 Oct".
  - Days show amber **Missing** for past unfilled.
  - On the day page the bottom nav is hidden; only the Save bar floats.
- **UX:**
  - "How their day is scored".
  - Save states `Save` (disabled) → `Saving…` → `Saved ✓`.
  - Submit confirm: "Submit for Deepak Yadav? 2 of 7 days count; the rest count 0."
- **Interaction:** `Ctrl/⌘+S` saves; `[`/`]` previous/next day; Esc → leave guard.
- **Motion:** the check draws in the button 320 ms; nothing moves while typing.
- **Responsive:**
  - Phone: one column.
  - Tablet: one column, 600 px.
  - Desktop: one column of 720 px, with the score and "Still needed" in a right rail.
- **States:**
  - "This week is closed — fill on behalf is for open weeks only."
  - "Couldn't save — no connection. Deepak's entries are kept on this device; tap Save again."
- **Data:** form; live day score.
- **Components:** Acting-as bar (Notice variant), Status chip, Buttons (1 Primary), Sheet (scoring), Toast.
- **Micro-interactions:** Android haptic on Save and Submit (exists).
- **Imagery:** Not recommended (360 §8.2: "Day form, Week, Fill pages: No").
- **Density:**
  - PRIMARY: fields still needed.
  - SECONDARY: score.
  - CONTEXTUAL: acting-as, deadline.
  - ACTIONABLE: Save/Submit.
  - OPTIONAL: scoring Sheet.

**22–25.**

| Item | Value |
|---|---|
| Priority | **P0** (Saved ✓, target, audit) / P1 |
| Complexity | S–M (Day/Week are shared with devotees) |
| Risk | Medium: shared devotee components; the behalf checks must pass |
| Benefit | High trust |
| Performance budget | 0 KB net (hide nav, CSS only) |
| Phase(s) | 0 (Saved ✓, target, audit lines, reopened-week attendance), 1 (amber, dates), 4 (Day/Week revamp shared), 5 (acting-as bar), 7 |

**Before → After → Why better → Unchanged.**
- **Before:** a cut title, a false "Saved ✓", grey misses.
- **After:** a clear acting-as bar, honest saves, amber gaps.
- **Why better:** no confusion about whose record this is.
- **Unchanged:** the behalf API and rules.


---

## Part C — IYF head, admin, shared routes and the app shell


**IYF Delhi · Sadhana Record revamp · 8 October 2026 · part of `ROUTE_BY_ROUTE_REVAMP.md`**

**Evidence used:**
- the code in `frontend/src/master/*`, `devotee/Wall.svelte`, `screens/Home.svelte`, `Account.svelte`, `Profile.svelte`, `ui/Shell.svelte`, `Menu.svelte`, `CommandSearch.svelte`, `ui/Tabs.svelte`, `ui/Reminder.svelte` and `lib/nav.js`;
- the 7 Oct sweep screenshots (personas `head` and `head-devotee`, plus `coordinator` and `devotee` for the shared routes), at 390 px light and 1280 px dark;
- `current-features.md` §3.7–3.9 and §9, and `pre-store-revamp-review.md` §2–§4 and §7.

**Names used:**
- Component and token names are those in `DESIGN_SYSTEM.md`.
- "Phase N" is the roadmap phase (0–9). "P0/P1/P2" is the priority.

**Rules that apply to every route below:**
- Every app route is `noindex` in practice: hash routes are never crawled. The SEO work is `document.title` = "<Page> · Sadhana Record" (S1, Phase 8). There is no imagery on admin routes.
- Every master-only action stays master-only, and the server stays the authority.
  - The recovery `master` login can never lose IYF-head access.
  - There is always at least one active IYF head.
  - Every write keeps its audit line.

---

### C.0 The Admin information architecture (the decision that every Admin route below assumes)

**Today:**
- Admin has 10 tabs: Overview · All devotees · Group leaders · Coordinators · Facilitators · Batches · IYF IDs · Reopens · Activity · Settings.
- The desktop sidebar lists the same 10 items again, and every page is titled "Admin".

**Proposed:** six groups, following review §4.5 and 360 §11.
- Phone: page tabs. Desktop: the children of one sidebar entry, **Admin**. There is no tab row on desktop.

| Group | Routes (all kept) | Phone tabs | Top-bar title |
|---|---|---|---|
| **People** | `#/devotees`, `#/groups` | All devotees · All group leaders | the tab's name |
| **Staff** | `#/coordinators`, `#/facilitators`, + an **IYF heads** list (NEW view of the existing `masters.set` API, which has no screen today) | Coordinators · Facilitators · IYF heads | the tab's name |
| **Batch setup** | `#/batches` | — | Batch setup |
| **IYF IDs** | `#/ids` | Search · Possible duplicates (segmented control) | IYF IDs |
| **Activity** | `#/activity` | — | Activity |
| **Settings** | `#/settings` | — | Settings |

**Routes that move (the route stays and redirects, so no link breaks):**
- `#/overview` becomes the head's **Batch › "All batches"** scope; see its section.
- `#/reopens` becomes **Requests, filtered to Reopens** (`#/requests?type=reopens`), so the head has one inbox.
- For the head, `#/members` and `#/leaders` open People with the batch filter preset. Coordinators keep them as they are.

**Prerequisite:** known issue 3 (admin paths matched together with their query string) is fixed in **Phase 0**, before any `?batch=` or `?type=` link ships.

**Naming:** "Batch setup" is used instead of the review's "Batches". The sidebar already has a **Batches** area (the coordinator tools), and two entries with the same name in one sidebar would confuse. Needs IYF sign-off.

---

### `#/home` — IYF head Home (IYF head; IYF head + devotee)

**1. Current purpose.**
- Staff Home for the head: waiting requests, batch tools, admin links, the verse and birthdays.
- A head who is also a devotee sees the devotee Home first, then the same staff blocks.

**2. Current UI structure.**
- **Head only (390 px: 1,942 px tall):**
  - greeting "Hare Krishna, IYF · IYF head · All batches";
  - **Batch work:** "Waiting for you" hero with 3 stat tiles (4 sign-ups waiting / 1 password reset / 1 reopen request) and "Open requests";
  - 2 link rows (Batch status and attendance, Filling chart);
  - **Admin:** 7 link rows;
  - verse carousel;
  - Birthdays.
- **Head + devotee:** the same, below the Today card, This week, the verse, the announcement teaser and 6 quick actions. **2,750 px tall** at 390 px.

**3–10. Problems.**
- [Nav] Two navigation lists on Home: the 7-row "Admin" list and "Batch status and attendance / Filling chart". They duplicate the sidebar and the bar. 360 §10 says: "No navigation lists on any Home".
- [Hierarchy] The hero answers only "how many requests". It doesn't tell the head whether the system is healthy, or which batch is behind.
- [UX] "Reopen request" is a tile here, but outside the Requests inbox. The bar badge says **5** and the tiles add up to **6**.
- [Mobile] The head + devotee phone bar is **Home · Week · Report · Batch · Account**: Requests and Admin are lost (review P0 #3).
- [Hierarchy] For head + devotee, "Wednesday is not filled yet" and "0 of 7 days filled" repeat the This-week card. "Notices 4 new" repeats the bell.
- [Visual] The saffron hero button sits on a wine-area page. Three accent families show on one screen.
- [UX] Health facts are hidden in Settings ("Reminder devices **0**") and Batch setup (BSS and BVS have "No coordinator"), and nothing raises them.

**11. SEO.** noindex. Title "Home · Sadhana Record".

**12. Must remain unchanged.**
- Every count's source (`requests.list`, `reopen.list`, `stats.all`, `birthdays.today`).
- The birthdays block, loaded last (CLS 0).
- The devotee Home, in full, for head + devotee.

**13–21. Redesign.**
- **UI:** the three-slot model (360 §10).
  1. **My day:** head + devotee only. The devotee **Status block** (one block, missing days in amber).
  2. **Decisions:** a **Needs-you card**. Non-zero rows only, each with its age.
     - "4 sign-ups waiting for approval · oldest 3 days ›"
     - "1 password reset · call first ›"
     - "1 week to reopen · Harish Rawat ›"
     - "2 posts reported ›" (NEW, after the Wall report ships)
  3. **System health:** a **Scope strip** of plain facts, each one a link:
     - "Reminders: no phone has them on" (amber at 0);
     - "Registry refreshed 3 Oct, 4:00 am";
     - "2 batches have no coordinator";
     - "Saving was slow 2 times today";
     - "Sheets copied 10 min ago";
     - "3 possible duplicate IDs".
  4. **Batches this week:** a compact table, worst first. Columns: Batch · Submitted bar + "4 of 10" · Filling · Not started · Missed. "All batches ›" goes to `#/overview`.
  5. Birthdays. The verse appears for staff only, collapsed to one line.
- **UX:**
  - The head is never sent to a list of links. Every row says what needs a decision and goes straight to it.
  - All counts use the one shared active-members definition (Phase 0, review #2).
- **Interaction model:**
  - Tap a decision row: Requests, pre-filtered.
  - Tap a health item: the place that fixes it.
  - Tap a batch row: Batch status for that batch.
- **Motion:**
  - Count-up 400 ms on first view (High/Balanced).
  - A changed row glows once on refresh.
- **Responsive:**
  - **Phone:** one column in the slot order. Target height ≈ 1,500 px for head + devotee and ≈ 1,100 px for the head.
  - **Tablet:** Decisions and Health side by side.
  - **Desktop:** 2 columns. Left: My day, then the Batches table. Right: Decisions, Health, Birthdays.
- **States:**
  - Loading: skeletons of each slot.
  - No decisions: "All caught up — nothing waiting for you."
  - Health fully green: a single line, "Everything is running normally."
  - A slot that fails to load: "Couldn't load system health — Retry".
- **Data presentation:** tabular numbers; dates in full ("3 Oct, 4:00 am"); names, never phone numbers.
- **Components:** Status block, Needs-you card, Scope strip, staff table (sticky header), Status chip, Skeleton.
- **Micro-interactions:** press sink 0.99 on rows; the badge on a Decisions row clears optimistically when its item is handled.
- **Imagery:** none for the head. The devotee's darshan card stays in their own My-day column only (360 §8.2).
- **Density:**
  - PRIMARY: Decisions.
  - SECONDARY: My day (head + devotee) or Health.
  - CONTEXTUAL: the Batches table.
  - ACTIONABLE: the decision rows and "Fill today".
  - OPTIONAL: birthdays and the verse.

**22–25.** P0 (bar fix) / P1 · Complexity M (health needs one read-only server summary added to `stats.all`, cached 5 min) · Risk low · Benefit very high · Budget: ≤ +3 KB in the staff Home chunk, 2 API calls on open (cached first) · **Phase 0** (bar, counts) and **Phase 6** (slots).

**Before → After → Why better → Unchanged.**
- Before: a request hero plus 9 link rows, 2,750 px.
- After: Decisions, Health and a worst-first batch table, ≈ 1,500 px.
- Why better: the head's question, "is the system healthy, and what needs my decision?", is answered in the first screen.
- Unchanged: every count and its source, birthdays, and the devotee Home.

---

### `#/overview` — All batches this week (IYF head)

**1. Current purpose.** This week's totals across every batch, plus a card per batch (progress bar and 8-week sparkline). Tapping a card opens that batch's board.

**2. Current UI structure.**
- Admin tab row.
- Heading "Overview / Week of 5 Oct – 11 Oct · all batches", with Refresh.
- A section "This week, every batch" with 4 stat tiles (4/10 submitted (40%) · 3 filling · 3 not started · 0 missed) and "10 active devotees · 4 waiting for approval".
- 6 batch cards in a 1/2/3-column grid.

**3–10. Problems.**
- [Hierarchy] Four headings for one idea: the top bar "Admin", the tab "Overview", the h2 "Overview" and the h3 "This week, every batch".
- [Nav] On desktop the tab row is cut. At 1280 px "Activity" and "Settings" are off-screen, with no sign that more tabs exist (review P0 #10).
- [UX] 5 of 6 cards read "0/0 submitted 0 filling 0 not started", with flat sparkline dashes. Empty batches look like broken charts.
- [UX] The "1 waiting" pill on 4 cards duplicates Requests (review §3.1: remove the Overview pills).
- [Visual] Cards sort by batch order, not by need. A batch at 10% looks the same as one at 90%.
- [Mobile] At 390 px only about 1.5 batch cards fit above the bar.

**11. SEO.** noindex. Title "All batches · Sadhana Record".

**12. Must remain unchanged.** `stats.all` (8 weeks); a tap opens that batch's board (`batchSel` + `#/batch`); the 8-week trend.

**13–21. Redesign.**
- **UI:**
  - It becomes the **"All batches" scope of Batch status** for the head. The Batch area's batch picker gains "All batches" as its first option. The route `#/overview` is kept.
  - One **Scope strip**: Submitted · Filling · Not started · Missed (active members only) · the deadline.
  - Then a **staff table**, worst first.
- **UX:**
  - Batches with no active devotees go to a footer line: "SPS Group 2, SPS Online, DPS, BSS, BVS — no active devotees yet."
  - "Waiting for approval" is removed here; it lives in Requests.
- **Interaction model:**
  - Row → that batch's Batch status.
  - Column headers sort (`aria-sort`). The default is Submitted % ascending.
- **Motion:** bars grow once per session; a changed row glows.
- **Responsive:**
  - **Phone:** two-line rows ("SPS · 4 of 10 submitted", then a meter and "3 filling · 3 not started").
  - **Tablet:** a table with 4 columns.
  - **Desktop:** Batch · Coordinator · Submitted (meter + count) · Filling · Not started · Missed · 8-week sparkline. "No coordinator" shows as an amber chip.
- **States:**
  - Loading: a table skeleton.
  - Error: "Couldn't load this week's numbers — Retry".
  - No active batch: "No active batches. Batches marked active in Batch setup appear here."
- **Data presentation:** "4 of 10" rather than "4/10"; % in a tabular column; sparklines < 1 KB of inline SVG.
- **Components:** Scope strip, staff table, Meters, Sparklines, Status chip.
- **Micro-interactions:** hovering a sparkline bar shows "Week of 28 Sep: 70%". Tapping it on touch does the same.
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: the batches that are behind.
  - SECONDARY: the strip.
  - CONTEXTUAL: the trend and the coordinator.
  - ACTIONABLE: row → board.
  - OPTIONAL: the empty batches (footer).

**22–25.** P1 · S · Risk low · Benefit high · Budget: no new call, ≤ +1 KB · **Phase 0** (tabs, counts) and **Phase 6**.

**Before → After → Why better → Unchanged.**
- Before: six equal cards, four headings.
- After: one strip and a worst-first table inside the Batch area.
- Why better: the batch that needs help is the first row.
- Unchanged: `stats.all`, tap-to-board, the 8-week trend.

---

### `#/devotees` — All devotees (IYF head; the same component as a coordinator's `#/members`)

**1. Current purpose.** A directory of every devotee in IYF Delhi, with search, filters, call or WhatsApp, and deleting inactive members.

**2. Current UI structure.**
- Search ("Name, phone or IYF ID").
- 4 dropdowns: All of IYF Delhi · Any class · Any blood group · Sort: name.
- A status segment: All 12 · Active 10 · Inactive 1 · Disabled 1.
- "12 members", Refresh.
- Rows: avatar, name, batch, IYF ID, "Nothing submitted yet", call, chat. A red **Delete** button on inactive and disabled rows.

**3–10. Problems.**
- [Nav] A duplicate page. `#/members` (sidebar "Members") and `#/devotees` (sidebar "All devotees") are both in the head's sidebar.
- [Hierarchy] The title says "All devotees" and the count says "**12 members**".
- [Mobile] About 290 px of filters before the first row at 390 px. 5 controls are always open.
- [Interaction] "Delete" is a row button (2 rows in the screenshot). Review §4.4 says destructive actions must sit in an overflow menu.
- [Nav] The phone tab row is scrolled so the first tab reads "**w**" (Overview, cut).
- [Visual] Every row repeats "Nothing submitted yet". The useful facts (last week, status) aren't columns on desktop; the rows are stretched to 860 px with empty middles.
- [A11y] The call and chat icons are 44 px but unlabeled visually; there is no row-level target for opening the devotee.

**11. SEO.** noindex. Title "All devotees · Sadhana Record".

**12. Must remain unchanged.**
- `members.list` and every filter: batch, class, blood group, sort, status counts.
- "Show more" (50).
- Call and WhatsApp.
- Delete only for inactive members, after typing the phone number (`devotees.delete`), with the audit line.

**13–21. Redesign.**
- **UI:**
  - The head opens it as **People › All devotees**. The scope picker reads "All of IYF Delhi" or a batch name.
  - Coordinators see the same component as `#/members`.
  - Filters: Search plus a **"Filters (2)"** button that opens a Sheet (batch, class, blood group, sort), with active-filter chips below it. The status counts stay as chips.
- **UX:** the whole row opens the devotee. Delete, Disable and the call actions move into the ⋯ menu.
- **Interaction model:** desktop uses **list + detail**: DevoteeDetail opens in the right pane and the list keeps its scroll. On phone, the row opens `#/devotee/<login>` and Back returns to the same scroll position.
- **Motion:** the pane slides from the right (`--d-3`); rows FLIP on filter (≤ 50 rows).
- **Responsive:**
  - **Phone:** two-line rows (name, then "SPS · Active · Last week 82%"), with ⋯.
  - **Tablet:** the same, two columns.
  - **Desktop:** a table: Name · Batch · Status · Last week · IYF ID · Class · ⋯. Sticky header, 48 px rows.
- **States:**
  - "12 devotees" (never "members").
  - No match: "No devotee matches “ra”. Try part of the name, the phone, or the IYF ID."
  - Error: "Couldn't load devotees — Retry".
- **Data presentation:** the status chip (Active, Inactive since 7 Sep, Disabled); the last week as % plus a status chip; a dash where there is no data, not repeated prose.
- **Components:** Search, Sheet (filters), Status chip, staff table, list + detail, overflow menu, Danger-solid inside the confirm Sheet.
- **Micro-interactions:** the filter chip count updates live; an × on a chip clears that filter.
- **Imagery:** not recommended. Profile photos only.
- **Density:**
  - PRIMARY: the name and status.
  - SECONDARY: the last week.
  - CONTEXTUAL: batch, IYF ID, class.
  - ACTIONABLE: open, call, ⋯.
  - OPTIONAL: the filters (in the sheet).

**22–25.** P1 · M · Risk low (presentation only) · Benefit high · Budget: lives in the existing staff-Admin chunk (19.8 KB gzip today, cap 30) · **Phase 5** (shared with coordinators) and **Phase 6** (People group).

**Before → After → Why better → Unchanged.**
- Before: two directory pages; 5 open filters; Delete in rows.
- After: one page with a scope picker, filters in a sheet, actions in ⋯, a desktop table with a pane.
- Why better: one place per destination, and no destructive buttons in a list.
- Unchanged: every filter, search, delete-with-phone-confirm and the audit line.

---

### `#/groups` — All group leaders (IYF head; the same component as `#/leaders`)

**1. Current purpose.** Group leaders for any batch: appoint, add members, take one out, remove a leader.

**2. Current UI structure.**
- A full-width "Batch" picker.
- "1 group · 5 devotees in no group".
- An always-open "Appoint a group leader" card (devotee select plus a disabled-looking Appoint).
- A card per group: leader with call/chat, members with status and an × each, "Add devotees", "Remove leader".
- A centred, collapsed "In no group (5)".

**3–10. Problems.**
- [Nav] "Group leaders" appears **twice** in the head's sidebar: under My batch and under Admin.
- [UX] Member status shows "**Draft**". IA §12 says the word is "Filling" everywhere.
- [Interaction] The × "Take … out of the group" acts at once, with no Undo and a full refetch.
- [Hierarchy] The Appoint form (≈ 190 px) sits above the groups, though appointing is rare.
- [Visual] "In no group (5)" is centred, unlike every other disclosure.
- [Mobile] The picker plus the form push the first group down to y ≈ 485 px.

**11. SEO.** noindex. Title "All group leaders · Sadhana Record".

**12. Must remain unchanged.**
- `leaders.list`, `leaders.set` and `leaders.assign`.
- The same-level pool (SPS, SPS Group 2 and SPS Online form one pool).
- The confirm before removing a leader.
- Call and WhatsApp.

**13–21. Redesign.**
- **UI:**
  - People › All group leaders. A batch chip-picker at the top ("SPS ▾").
  - An **"Appoint a leader"** Secondary button opens a Sheet with a searchable devotee picker (pick from the list, never typed).
  - Group cards in a 2-column grid on desktop.
- **UX:**
  - × becomes a row ⋯ with "Take out of the group". It is optimistic, with an **Undo** toast.
  - "Remove leader…" moves into the group card's ⋯, then a confirm Sheet: "Remove Sunil Kumar as group leader? His 4 devotees go to In no group."
- **Interaction model:**
  - "In no group (5)" is a left-aligned Grouped list.
  - Each of its rows offers "Add to a group" (a Sheet listing the groups).
- **Motion:** rows FLIP between groups (200 ms).
- **Responsive:**
  - **Phone:** stacked cards.
  - **Tablet:** 2 columns.
  - **Desktop:** 2–3 columns, with the "In no group" panel pinned on the right.
- **States:**
  - No groups: "No group leaders in SPS yet. Appoint one to share attendance marking."
  - Everyone grouped: the panel says "Everyone in SPS is in a group."
- **Data presentation:** the Status chip "Filling / Submitted / Not started"; a leader count chip "4 devotees".
- **Components:** Sheet, Grouped list, Status chip, overflow menu, Toast with Undo.
- **Micro-interactions:** Android haptic on appoint; the moved row highlights once.
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: the groups and their members.
  - SECONDARY: "In no group".
  - CONTEXTUAL: member status.
  - ACTIONABLE: appoint, add, take out.
  - OPTIONAL: the appoint form (in a sheet).

**22–25.** P1 · S · Risk low · Benefit medium · Budget: 0 new calls · **Phase 1** ("Filling") and **Phases 5–6**.

**Before → After → Why better → Unchanged.**
- Before: duplicate sidebar entries, an always-open form, × with no Undo.
- After: one People entry, appoint in a sheet, ⋯ with Undo.
- Why better: groups come first, and mistakes are recoverable.
- Unchanged: the same-level pool, every leaders API and the confirms.

---

### `#/coordinators` — Coordinators (IYF head only)

**1. Current purpose.** Create and edit coordinator logins and their batches, reset passwords, disable or enable.

**2. Current UI structure.**
- Header "Coordinators" with **Add coordinator** (Primary).
- **Phone:** cards with avatar, name, username, "Batches: …", a Status chip, then a row of ✎, 🔒 and a red **Disable**.
- **From 900 px:** a table Name · Username · Phone · Batches · Status · actions.

**3–10. Problems.**
- [Nav] The top bar reads "**Admin**", not "Coordinators". The tab row shows "s" (the cut-off "All devotees").
- [Interaction] **Disable** is a danger button on every row. It is confirmed, but it sits in the list, against review §4.4.
- [A11y] The lock icon alone means "Reset password", which isn't obvious. The labels exist only for screen readers.
- [Visual] The Phone column is "—" for both rows: it uses width for nothing.
- [UX] There's no sign of who has never signed in, or who still has a temporary password, beyond a small chip.

**11. SEO.** noindex. Title "Coordinators · Sadhana Record".

**12. Must remain unchanged.**
- `coordinators.*`.
- The batches checklist with "Now with <name>" (moving a batch ends the other coordinator's access).
- The temporary password and the forced change.
- Disable asks first; Enable is immediate. Undo stays.
- The audit lines.

**13–21. Redesign.**
- **UI:**
  - **Staff › Coordinators**. Rows: name, then "sps · SPS, SPS Group 2, SPS Online", with Status chips (Active · "Temporary password").
  - A trailing ⋯ with Edit…, Reset password…, Disable… (Danger).
- **UX:**
  - Row tap = Edit sheet.
  - Batches show their **names**, never IDs.
  - A coordinator with no batch shows an amber chip, "No batch".
- **Interaction model:** the Sheets are unchanged (wide 620 px on desktop). Disable keeps its consequence text: "sps is logged out at once and cannot log in until you enable the account again. Their batches stay assigned."
- **Motion:** the sheet rises with a spring; the status chip crossfades on Disable/Enable.
- **Responsive:**
  - **Phone:** two-line rows plus ⋯.
  - **Desktop:** a table Name · Username · Batches · Status · ⋯. The Phone column shows only when at least one phone exists.
- **States:**
  - Empty: "No coordinators yet. Add the first coordinator and give them their batches."
  - Save error: inline in the sheet.
  - Busy: the button label stays, with a spinner.
- **Data presentation:** batches as names joined with commas; status as chips.
- **Components:** staff table, overflow menu, Sheet, Status chip, Toast with Undo.
- **Micro-interactions:** "Temporary password set for sps. They must change it at next login." stays as the toast.
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: who has which batch.
  - SECONDARY: status.
  - CONTEXTUAL: username and phone.
  - ACTIONABLE: ⋯.
  - OPTIONAL: none.

**22–25.** P1 · S · Risk low · Benefit medium · Budget: 0 KB net · **Phase 6** (title fix in **Phase 2**).

**Before → After → Why better → Unchanged.**
- Before: "Admin" title, red Disable on each row.
- After: Staff › Coordinators, a ⋯ menu, names only.
- Why better: a calm list; destructive actions are one deliberate step away.
- Unchanged: every coordinator action, the confirmations and the audit.

---

### `#/facilitators` — Facilitators and their access (IYF head only)

**1. Current purpose.**
- The canonical facilitator list offered at sign-up and approval.
- Switching names on or off.
- Deleting a switched-off name.
- Giving access (linking a devotee's phone, or creating a login), resetting it and removing it.

**2. Current UI structure.**
- An "Add a facilitator" card.
- Search and the chips "4 All / 4 Switched on / 0 Switched off"; "4 names".
- Rows: name, "No devotees · 4 waiting sign-ups", "Offered", "Login: natvar · TRD", sometimes "Added in the app · not in NameMap yet".
- A switch, a 🔒 and (when off) a 🗑 on each row.
- The access Sheet.

**3–10. Problems.**
- [Hierarchy] The Add form (≈ 95 px) sits above the list, for a rare action.
- [Interaction] Three controls per row (switch, lock, trash) with no visible labels. "Lock" here means "access", while on Coordinators it means "password".
- [UX] Linking a facilitator's own login asks for a **typed** phone ("Their mobile number"). The clean-data rule says pick from the list.
- [Visual] Two long pills wrap on phones ("Added in the app · not in NameMap yet").
- [Nav] Title "Admin"; the tab row is cut.

**11. SEO.** noindex. Title "Facilitators · Sadhana Record".

**12. Must remain unchanged.**
- `facilitators.*` and `facLogins.*`.
- Switching off keeps the name for devotees who already have it, with Undo.
- Delete only when switched off.
- The NameMap sync note.
- "Do they use the app already? Yes / No" access branches.

**13–21. Redesign.**
- **UI:**
  - **Staff › Facilitators**. A header button "Add facilitator" opens a Sheet.
  - Rows: name, then "No devotees · 4 waiting for approval", with chips (Offered · "Has the app" / "Own login: natvar" · "Not in NameMap yet").
  - The switch stays inline (the most common action). Everything else goes in ⋯: Access…, Delete… (when off).
- **UX:** "Yes, as a devotee" picks the person from a devotee search (`members.list`). The phone is never typed.
- **Interaction model:** row tap = the Access sheet. The switch is optimistic, with Undo (exists).
- **Motion:** the switch uses `--ease-spring`, 200 ms.
- **Responsive:**
  - **Phone:** rows with switch and ⋯.
  - **Desktop:** a table Name · Devotees · Waiting · Access · Offered (switch) · ⋯.
- **States:**
  - No match: "No facilitator matches “madhav”."
  - Off-filter empty: "No names are switched off."
- **Data presentation:** counts as numbers in their own columns on desktop; chips limited to 2 per row (NameMap shown as an info dot with a tooltip/sheet).
- **Components:** Sheet, Search, staff table, Toggle, overflow menu, Status chip.
- **Micro-interactions:** toast "Natvar Gopinath Prabhuji is switched off. Devotees who have this name keep it." with Undo (keep).
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: names and whether they are offered.
  - SECONDARY: access.
  - CONTEXTUAL: devotee counts.
  - ACTIONABLE: the switch and ⋯.
  - OPTIONAL: the add form.

**22–25.** P1 · S · Risk low · Benefit medium · Budget: 0 new calls (reuses `members.list`) · **Phase 6**.

**Before → After → Why better → Unchanged.**
- Before: three unlabeled icons, a typed phone.
- After: a switch plus ⋯, a picked person.
- Why better: clean data, and fewer mis-taps.
- Unchanged: the list semantics, the access flows and the Undo.

---

### `#/batches` — Batch setup (IYF head only)

**1. Current purpose.** List batches; **Add batch** (name, short ID, level SPS/DPS/BSS/BVS, pilot); **Edit** (name, coordinators, active, pilot).

**2. Current UI structure.**
- "Batches / Active batches are offered on the sign-up page."
- A small "Add batch".
- Rows "**SPS · SPS**", the coordinator name or "No coordinator", "Active".
- A table from 900 px. Sheets for Add and Edit.

**3–10. Problems.**
- [UX] **Known bug:** `worker/src/admin.js` `LEVELS` gives a new batch the old journal names ("Level 4 / Level 5 BSS / Level 5 BVS"), so the batch would have **no lectures** (current-features §9 #1; review P0 #1). The UI's level choice (SPS/DPS/BSS/BVS) is already correct.
- [Visual] "SPS · SPS", "DPS · DPS", "BSS · BSS": the name and the ID repeat.
- [UX] "No coordinator" (BSS, BVS) is plain grey text, though a batch with no coordinator can't approve sign-ups.
- [Hierarchy] There are no member counts or levels, so the head can't tell a live batch from an empty one.
- [Visual] Add batch is a small Secondary on the left, while Coordinators has a Primary on the right: an inconsistent header pattern. Inactive shows as "Hidden".

**11. SEO.** noindex. Title "Batch setup · Sadhana Record".

**12. Must remain unchanged.**
- `batches.create` and `batches.update`.
- Active = offered on sign-up.
- The pilot flag and the coordinator checklist.
- `refreshMeta` after a change.
- The batch IDs (they key every Sheets copy).

**13–21. Redesign.**
- **Phase 0 (store blocker):** fix `LEVELS`, with a test that a new batch resolves to an existing journal. Until it ships, the Add sheet shows a Notice ("Adding batches is paused until a fix ships") and the submit button is disabled.
- **UI:**
  - The header pattern matches Staff: title plus a Primary "Add batch" on the right.
  - Rows: the name, then "Level SPS · 10 active devotees · Coordinator: SPS Team".
  - The ID appears only when it differs from the name ("SPS Group 2 · SPS2"), in a muted tabular chip.
- **UX:**
  - "No coordinator" is an amber Status chip with an action, "Add a coordinator ›" (opens Edit at that field).
  - "Hidden" becomes "Not offered at sign-up".
- **Interaction model:** row tap = Edit. The Add sheet keeps Name · Short ID · Level (segmented) · Pilot, with the line "Its level sets the score card and the hearing journal".
- **Motion:** a new row slides in and glows once.
- **Responsive:**
  - **Phone:** two-line rows.
  - **Desktop:** a table Batch · ID · Level · Active devotees · Coordinators · Status · ⋯.
- **States:**
  - Empty: "No batches yet. Add the first batch."
  - Create error, for example a taken ID: inline "SPS3 is already used".
- **Data presentation:** batch **names** (never journal level names); counts in tabular figures.
- **Components:** staff table, Sheet, segmented control, Status chip, Notice.
- **Micro-interactions:** the Short ID auto-uppercases as it is typed (exists).
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: the batch and its health (coordinator, members).
  - SECONDARY: level.
  - CONTEXTUAL: ID and pilot.
  - ACTIONABLE: Add and Edit.
  - OPTIONAL: none.

**22–25.** P0 (bug) / P1 · S · Risk: medium for the bug (journal mapping; test on a copy) and low for the UI · Benefit high · Budget: member counts come from the cached `stats.all`, with no new call · **Phase 0** and **Phase 6**.

**Before → After → Why better → Unchanged.**
- Before: "SPS · SPS"; a broken Add; a silent "No coordinator".
- After: a working Add, plain rows, an amber warning with a fix link.
- Why better: no batch is created without lectures or left without a coordinator.
- Unchanged: the fields, the IDs and the active/pilot semantics.

---

### `#/ids` — IYF IDs (IYF head only)

**1. Current purpose.**
- Search the registry; see an ID's details; link it to an account or unlink it, with a reason.
- Review possible duplicates ("Not duplicates", with Undo).

**2. Current UI structure.**
- A heading with a description.
- A segmented control Search | Possible duplicates.
- One text field ("Type at least 3 characters").
- Results as 2-column cards with Details · Link to an account… · Unlink…, and inline confirm forms.
- Duplicates: an info Banner of 4 lines, count chips, group cards.

**3–10. Problems.**
- [UX] The landing state is an empty field and ≈ 400 px of blank space. "Whitespace because there is nothing to show" (DS §4).
- [UX] Link asks for a **typed** "Phone of the devotee's account". It should be a picked person.
- [Interaction] Unlink, a destructive action, confirms inline inside the card. DS §7.5 says it belongs in a confirm Sheet.
- [Hierarchy] The duplicates banner is 4 lines of policy before any data.
- [Nav] Title "Admin"; the tab row is cut.

**11. SEO.** noindex. Title "IYF IDs · Sadhana Record".

**12. Must remain unchanged.**
- `ids.search` (3+ characters), `ids.get`, `ids.link` and `ids.unlink`, with reasons.
- `ids.reviewDuplicate` with Undo.
- The rule that exact duplicates (same name and phone) are merged by the dashboard.

**13–21. Redesign.**
- **UI:**
  - The landing shows context chips, each one a link: "1,284 IDs · refreshed 3 Oct, 4:00 am", "3 accounts with no ID", "5 possible duplicates to review".
  - Search uses the standard Search field with an icon.
- **UX:**
  - Link opens a Sheet: devotee search (pick), Reason, then Link.
  - Unlink opens a confirm Sheet: "Unlink KT26-0120 from Manish Tiwari? The dashboard stops matching their weeks to this ID." with a Danger-solid button.
  - The duplicates policy becomes one line plus "How duplicates work ›" (a disclosure).
- **Interaction model:** desktop uses list + detail (Details in the right pane). On phone, Details expands in place.
- **Motion:** the pane slides; the "Not duplicates" group collapses (200 ms) with Undo.
- **Responsive:**
  - **Phone:** single-column rows.
  - **Desktop:** results list (left) and detail (right).
- **States:**
  - Typing < 3: "Type at least 3 characters."
  - No result: "No results. Try part of the name, the full IYF ID, or the last digits of the phone." (keep)
  - No duplicates: "No possible duplicates. Nothing to review right now."
- **Data presentation:** linked state as a Status chip ("Linked to Aarav Gupta" / "Not linked"); phones masked to the last 4 digits in lists (exists as `phoneEnd`).
- **Components:** Search, Sheet, list + detail, Status chip, Toast with Undo.
- **Micro-interactions:** the result count is announced politely ("3 results").
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: the search and its results.
  - SECONDARY: duplicates to review.
  - CONTEXTUAL: registry age.
  - ACTIONABLE: Link, Unlink, Not duplicates.
  - OPTIONAL: the policy text.

**22–25.** P2 · S · Risk low · Benefit medium · Budget: the context counts come from the System-health summary (Home), with no extra call · **Phase 6**.

**Before → After → Why better → Unchanged.**
- Before: a blank page, a typed phone, an inline unlink.
- After: context on arrival, a picked person, a confirm sheet.
- Why better: fewer wrong links, and clear consequences.
- Unchanged: every IDs API, the reasons and the Undo.

---

### `#/reopens` — Reopen requests (IYF head only) → merged into Requests

**1. Current purpose.** Coordinators ask to reopen a missed week. The head reopens it until a time (default: 2 days ahead, 9 PM) or rejects it, each with a reason.

**2. Current UI structure.**
- "Reopen requests [1]" with a description and Refresh.
- Cards: devotee link · batch, "Week of 28 Sep – 4 Oct · asked by **sps** on 7 Oct, 2:44 pm", the quoted reason.
- Equal-width **Reject…** (Danger) and **Reopen…** (Primary), each opening an inline form.

**3–10. Problems.**
- [Nav] A separate tab outside Requests. The Requests badge says 5 while the real total is 6 (review §3.1).
- [UX] "asked by **sps**" shows a login, not "SPS Team". There is no age ("1 day ago").
- [Interaction] Reject and Reopen carry equal visual weight, and both inline forms push the card taller.
- [UX] "Open until" is a raw date-time field. The useful choices are a few presets.
- [UX] Known issue 5: in a reopened week neither the devotee nor the coordinator can mark attendance (Phase 0 server fix).

**11. SEO.** noindex. The route redirects to `#/requests?type=reopens` (title "Requests · Sadhana Record").

**12. Must remain unchanged.**
- `reopen.list`, `weeks.reopen` (reason + `openUntil` IST) and `reopen.reject` (reason).
- The master-only decision.
- The toast "Harish Rawat: the week of 28 Sep – 4 Oct is open until …".
- The audit lines.

**13–21. Redesign.**
- **UI:**
  - The **Requests inbox** gains the type filter chips Sign-ups · Resets · **Reopens** · Reports (head).
  - A reopen row: "Harish Rawat · SPS — Week of 28 Sep – 4 Oct", then "SPS Team · 1 day ago · “He was in hospital that week.”"
- **UX:**
  - Primary **Reopen…** opens a Sheet with the Reason (prefilled with the coordinator's) and "Open until": the chips "Wed 9 PM (2 days)" · "Fri 9 PM" · "Choose…".
  - Reject… is a Text-danger button that opens a Sheet with "Why not" and Danger-solid.
- **Interaction model:** desktop shows the list and the request detail side by side (as Requests).
- **Motion:** a handled row slides out (FLIP), and the badge counts down.
- **Responsive:**
  - **Phone:** rows, then the Sheet.
  - **Desktop:** list + detail.
- **States:**
  - Empty: "No reopen requests are waiting. When a coordinator asks to reopen a missed week, it appears here." (keep)
  - Error: "Couldn't reopen — Retry. Nothing was changed."
- **Data presentation:** names, ages and full dates.
- **Components:** Requests inbox, chips, Sheet, Toast.
- **Micro-interactions:** Android haptic on Reopen.
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: who and which week.
  - SECONDARY: the reason.
  - CONTEXTUAL: who asked and when.
  - ACTIONABLE: Reopen and Reject.
  - OPTIONAL: none.

**22–25.** P1 · S · Risk low · Benefit high (one inbox, a true badge) · Budget: 0 new calls · **Phase 0** (issue 5, badge) and **Phase 6** (merge).

**Before → After → Why better → Unchanged.**
- Before: a separate tab, a login name, a raw time field.
- After: one inbox with presets.
- Why better: every decision is in one place, and the count is truthful.
- Unchanged: the reopen and reject semantics, the reasons and the audit.

---

### `#/activity` — Activity (IYF head only)

**1. Current purpose.** The audit log (who changed what), with type chips, More filters (by, about, from, to), Before/after, and Load more (30). Then "Slow or failed requests" (`runlog.list`).

**2. Current UI structure.**
- 14 filter chips in one line.
- "More filters" (two text inputs and two dates).
- Sentence rows: "sps changed the facilitator / class day of **6000000012** · Sunday class", "7 Oct, 1:44 pm · SPS". "Before / after" opens raw JSON in `<pre>`.
- Then the run log: "**devotees.list** · 2840 ms · slow · b-2026-10-02", "week.saveDay … **STALE**".

**3–10. Problems.**
- [UX] Every target is a **phone number** ("of 6000000013") and every actor a login ("sps"). Review §4.5: names.
- [UX] Developer telemetry is shown to the head: "devotees.list", "STALE", "b-2026-10-02", milliseconds.
- [Nav] The chip row is cut at 1280 px ("**Bat**…"), with no sign that more chips exist (review P0 #10).
- [UX] "IYF head reopened … · **master**": the actor is said twice.
- [Interaction] "By (login)" and "About (phone or login)" are typed. Before/after is raw JSON.
- [UX] Known issue 7: leader/coordinator attendance and on-behalf day saves are missing from the log.

**11. SEO.** noindex. Title "Activity · Sadhana Record".

**12. Must remain unchanged.**
- `audit.list` and every filter dimension (type, by, about, from, to).
- Before/after, available for every line.
- Pagination.
- `runlog.list` data, kept: it moves but is not deleted.
- The log is append-only.

**13–21. Redesign.**
- **UI:**
  - Sentences with names: "**SPS Team** changed the facilitator of **Bhavesh Jain** (SPS) · Sunday class". The phone appears only in the detail.
  - Date group headers: "Today", "Yesterday", "Mon, 5 Oct".
- **UX:**
  - Filters: 5 chips (All · Sign-ups · Attendance · Devotees · Settings) plus "More types ▾" (a Sheet with all 14).
  - "By" and "About" are person pickers (`members.list`, coordinators list).
  - The run log becomes plain sentences on the Home **System health** ("Saving was slow 3 times today"; "1 save was refused because the day changed on another phone").
  - The raw rows go to a collapsed "Technical log (for the app keeper)" at the bottom of Activity.
- **Interaction model:** tap a line to open a Sheet with a readable diff table (Field · Before · After, for example "Facilitator · Natvar Gopinath Prabhuji → Vilasa Padmanabha Prabhuji"). "Show raw" stays inside it.
- **Motion:** new pages of results fade in; no row animation.
- **Responsive:**
  - **Phone:** chips scroll with an edge fade and a "+9" hint.
  - **Desktop:** chips wrap to 2 lines, and the filters sit in a left rail.
- **States:**
  - Empty: "Nothing found. Try another type, or clear the filters." (keep)
  - End of list: "That's everything from 1 Sep."
- **Data presentation:** times as "7 Oct, 1:44 pm"; the reason in quotes; batch names.
- **Components:** Grouped list, chips, Sheet (diff), person picker, disclosure.
- **Micro-interactions:** filters apply as they change (exists, 350 ms debounce).
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: who did what to whom.
  - SECONDARY: when.
  - CONTEXTUAL: reason and batch.
  - ACTIONABLE: the filters.
  - OPTIONAL: the diff and the technical log.

**22–25.** P1 · M (`audit.list` adds display names: a server join, an additive field) · Risk low · Benefit high (trust, privacy) · Budget: 0 extra calls · **Phase 0** (issue 7, chip cut) and **Phase 6**.

**Before → After → Why better → Unchanged.**
- Before: phone numbers, JSON and developer codes.
- After: named sentences, readable diffs, telemetry in plain words.
- Why better: the head reads the log as a story of people, not of data.
- Unchanged: every audit line, filter and raw before/after.

---

### `#/settings` — Settings (IYF head only)

**1. Current purpose.**
- Set the first tracked week, the daily reminder time and the submit window.
- Show the registry refresh and the number of reminder devices (read-only).
- Review, then save after a confirm Sheet.

**2. Current UI structure.**
- Two cards.
  - First tracked week: a native date "**31/08/2026**" and Clear.
  - Daily reminder: a native select "9:00 PM".
  - Submit window: native day selects and native time inputs "06:00 PM / 09:00 PM".
- A `kv` well: "Registry refreshed 3 Oct, 4:00 am · 1,284 IDs", "Reminder devices **0**".
- A floating action bar: "No changes · Undo · Review and save".

**3–10. Problems.**
- [UX] The help text hard-codes the times: "by its **Monday 9 PM** deadline", "The time the **9 PM** reminder goes out". IA §12 says use the configured times.
- [Visual] Native selects, time inputs and a numeric date ("31/08/2026"), unlike the rest of the app's wheel pickers.
- [Mobile] At 390 px the action bar floats **over** the Submit window card, above the bottom nav: two floating bars, and "Review and save" wraps to 2 lines.
- [UX] "Reminder devices 0" is a silent zero. It should be an alert (review §4.5).
- [Visual] "Undo" looks enabled while "No changes".

**11. SEO.** noindex. Title "Settings · Sadhana Record".

**12. Must remain unchanged.**
- `settings.get` and `settings.update`; only the changed fields are sent.
- The Monday-only validation for the first week.
- `REMINDER_TIMES` (18:00–22:30).
- The confirm Sheet listing each change: "This applies to every batch at once."
- The audit line.

**13–21. Redesign.**
- **UI:**
  - Three Grouped lists of rows that open Sheets:
    - "Submit window · Sun 6:00 PM → Mon 9:00 PM ›";
    - "Daily reminder · 9:00 PM ›";
    - "First tracked week · Week of 31 Aug 2026 ›".
  - Each sheet uses the existing wheel pickers: a day picker (7 chips) and a time wheel; a week picker that offers Mondays only.
- **UX:**
  - The descriptions read the saved values: "A week not submitted by its **Mon 9:00 PM** deadline is marked missed."
  - The read-only health moves to the Home System health. "No phone has reminders on" shows as amber.
- **Interaction model:**
  - Each Sheet's Save goes to the same confirm summary.
  - After saving, a Toast "Settings saved" with **Undo**, which restores the previous values through the same API.
- **Motion:** the sheet rises (spring); the changed row glows once.
- **Responsive:**
  - **Phone:** rows. There is no floating bar: the action lives in the Sheet.
  - **Desktop:** 560 px dialogs.
- **States:**
  - Loading: a skeleton.
  - Error: "Couldn't save — nothing was changed. Retry."
  - Inline validation: "Choose a Monday (the first day of a week)." (keep)
- **Data presentation:** "Week of 31 Aug 2026", never numeric-only; 12-hour times.
- **Components:** Grouped list, Sheet, wheel pickers, Toast with Undo, Notice.
- **Micro-interactions:** the Save in a Sheet stays disabled until a value changes.
- **Imagery:** not recommended.
- **Density:**
  - PRIMARY: the three settings.
  - SECONDARY: their consequences.
  - CONTEXTUAL: the last change (from Activity).
  - ACTIONABLE: the row → its sheet.
  - OPTIONAL: none.

**22–25.** P1 · S · Risk: medium (a global effect; same API, confirm kept) · Benefit medium · Budget: 0 KB net (removes native-control CSS) · **Phase 6**. The copy fix is **Phase 1**.

**Before → After → Why better → Unchanged.**
- Before: native controls, hard-coded "9 PM", two floating bars.
- After: rows that open sheets, the real times, Undo.
- Why better: honest text, one control language, and no overlap on phones.
- Unchanged: the validation, the confirm summary, the API and the audit.

---

### `#/wall` (and `?post=<id>`) — Announcements (every signed-in role; staff post)

**1. Current purpose.**
- A feed of announcements: Like, comment, share to WhatsApp.
- Staff post, edit, pin or remove, with Undo. The head can post to everyone; coordinators post to their own batches.
- `?post=` scrolls to that post and highlights it.

**2. Current UI structure.**
- **Staff:** a "New announcement" Primary, then an inline compose form at the top of the feed.
- A single 42 rem column of posts, each with:
  - avatar, author, "6 days ago · Everyone", Pinned, "New";
  - a ⋮ (only when you can edit), opening inline Edit / Pin / Remove buttons;
  - title, body (links), picture;
  - Like · Comment · Share;
  - comments with your own 🗑.

**3–10. Problems.**
- [UX] **There is no Report and no way to hide a person.** This is an Apple 1.2 / Google UGC **store blocker** (review §7).
- [Visual] Like uses `--danger`: the liked heart and the like count are red. DS §2.1 reserves red for missed, errors and destructive actions.
- [Nav] Back (←) shows on a root page (head phone, devotee desktop). The bell still shows on the Wall itself.
- [Interaction] Compose is an inline form that scrolls the feed. Remove confirms inline ("Keep / Remove") instead of in a Sheet.
- [UX] The picture hint says "at most **1280 px**", while current-features §8 says posts allow 1,600 px. One of them is wrong; verify in `annimage.js`.
- [Hierarchy] A lone "Refresh" row (≈ 40 px) sits above the first post.

**11. SEO.** noindex. Title "Announcements · Sadhana Record". A shared `?post=` link previews with the app's OG image only, never the post text.

**12. Must remain unchanged.**
- `announcements.*`: plain text only, links made tappable.
- The audience rules (head: everyone or chosen batches; coordinators: their batches).
- Pin, show until, picture, edit, remove with Undo.
- Like (the head's decision), comments, removing your own, the WhatsApp share.
- `?post=` deep link: works after login; toast "That post is no longer on the wall."
- Opening the Wall marks posts as seen.

**13–21. Redesign.**
- **UI:**
  - **Every** post gets ⋯.
    - The author or staff see: Edit · Pin · Remove…
    - Everyone else sees: **Report post…**
  - **Every** comment gets ⋯ (long-press on touch):
    - **Report comment…**
    - **Hide comments from Rohan** (for me; reversible in Account › Hidden people).
    - **Staff:** Remove comment.
    - **Head:** "Hide this person's comments for everyone…", with a reason. This is audited.
- **UX:**
  - Reports go to Requests › **Reports** (the head, and coordinators for their batches). The reported item stays visible until a decision.
  - A one-time **community rule** Sheet appears before the first comment: "Be kind and on topic. Your batch can see comments. Report anything hurtful."
- **Interaction model:**
  - Compose and Edit open in a Sheet (full-height on phone; 620 px on desktop; `dismiss=false` when dirty).
  - Remove goes to a confirm Sheet: "Remove “Ekadashi kirtan this Saturday” for everyone?"
- **Motion:**
  - The Like heart fills in 120 ms with no bounce.
  - The `?post=` highlight ring is kept (2.6 s), using the brand ring.
- **Responsive:**
  - **Phone:** a full-width feed.
  - **Tablet/desktop:** a 42 rem column, plus a right column with "Pinned" and "Your batch's posts" on wide screens.
- **States:**
  - Empty, devotee: "No announcements yet. Your coordinator's posts will appear here."
  - Empty, staff: "… Post one for your batch with New announcement."
  - After a report: toast "Thanks — a coordinator will look at it."
  - After hiding a person: toast "You won't see Rohan's comments. Undo".
- **Data presentation:** relative time up to 6 days, then "Wed, 1 Oct"; the audience shown to staff only.
- **Components:** content card, overflow menu, Sheet, Toast with Undo, Status chip "New".
- **Micro-interactions:**
  - Like: an outline heart in `--text-muted`; liked: a filled heart in the brand colour. The count is a muted caption (quiet).
  - The comment counter appears near the 500-character limit.
- **Imagery:** only the posts' own pictures. No darshan.
- **Density:**
  - PRIMARY: the post.
  - SECONDARY: comments.
  - CONTEXTUAL: author, time, audience.
  - ACTIONABLE: Like, Comment, Share, ⋯.
  - OPTIONAL: the compose sheet.

**22–25.** P0 (report/hide) / P1 · M (new `announcements.report`, `mute.*` endpoints, a Reports queue; additive) · Risk: medium (moderation semantics need IYF sign-off: review §8 decision 1) · Benefit: a store requirement · Budget: Wall chunk 8.0 KB → ≤ 10 KB gzip · **Phase 0** (report/hide, red-heart fix) and **Phase 4** (sheets, layout).

**Before → After → Why better → Unchanged.**
- Before: no reporting, a red Like, inline forms.
- After: Report and hide everywhere, a quiet Like, sheets.
- Why better: passes store review, and the colours keep their meaning.
- Unchanged: every posting, audience, like, comment and share function, and `?post=`.

---

### `#/account` (and `?f=howto`) — Account (every role)

**1. Current purpose.**
- The profile: name, photo, roles, login, batch, and the About / Contact / Address / Emergency / Facilitator sections.
- Settings: notifications, change password, How to use, delete account, what happens to my data, log out, the app build.

**2. Current UI structure.**
- Two columns from 768 px. On phone, one column **2,701 px** (head) and **2,846 px** (head + devotee).
- The overlines "PROFILE" and "SETTINGS".
- Eight cards with pencil-edit sections.
- The full Change password form inline.
- 5 How-to accordions.
- `?f=howto` scrolls to the How-to card.

**3–10. Problems.**
- [Mobile] Very long. Review §4.7: rows that open sheets.
- [UX] Team logins ("SPS Team", "IYF Head") are asked for "Class you attend", "Date of birth", "Blood group" and "Emergency contact", all reading "Not added" (review §4.4).
- [UX] The Notifications row says "**Checking…**" for ever on some devices (`Reminder.svelte`, state `checking`).
- [UX] How to use shows devotee topics ("Filling in your day") to the head and coordinators. Keyboard shortcuts show on touch devices.
- [Visual] The head's batch line is IDs: "SPS, SPS2, SPSO, DPS, BSS, BVS". The overlines and the "ADMIN" area tag sit on a shared page (DS §3).
- [UX] There's no privacy-policy link (a store requirement, review §7).

**11. SEO.** noindex. Title "Account · Sadhana Record".

**12. Must remain unchanged.**
- `profile.*` and `photo.*` (crop, zoom, remove).
- Renaming yourself.
- The facilitator picked from the list.
- `auth.changePassword`.
- The push switch.
- `account.delete` for devotees; the staff note ("Ask the IYF head to remove your role first").
- `/delete-account.html`, Log out, and the app build line.

**13–21. Redesign.**
- **UI:**
  - A header card: photo, name ✎, "Devotee · Group leader · SPS" (names), login.
  - Then Grouped lists of 56 px rows, each opening a Sheet:
    - **Profile:** About you › · Contact details › · Address › · Emergency contact › · Facilitator › (devotee scope only).
    - **App:** Notifications (inline switch + status) · Theme › · Text size › (Phase 8) · Change password › · How to use ›.
    - **Privacy:** Hidden people › (from the Wall) · Privacy policy ↗ · What happens to my data ↗ · Delete account › (or the staff note).
    - Log out (Outline-danger) and "App 2026.10.07-1736".
- **UX:**
  - **No devotee scope:** only the name, photo, Contact and Password are shown.
  - The `checking` state times out after 4 s: "Couldn't check notifications — **Try again**".
  - How to use is **role-specific**:
    - Devotee: Fill a day, Submit the week, Share, No signal, Reminders.
    - Group leader: + Mark attendance, Nudge.
    - Facilitator: Find who needs you, Read a student's week.
    - Coordinator: Approve sign-ups, Batch status and attendance, No-class week, Fill for someone, Ask to reopen.
    - IYF head: Decisions, Reopen a week, Staff accounts, Settings, Read Activity.
    - Keyboard shortcuts appear only with `(hover: hover) and (pointer: fine)`.
- **Interaction model:**
  - `?f=howto` opens the How-to Sheet directly (half snap on phone, 620 px on desktop). Back closes it to Account.
  - Each section's Save is disabled until something changes; the leave guard stays.
- **Motion:** sheets with a spring; the "Saved ✓" check draws only after a real save.
- **Responsive:**
  - **Phone:** ≈ 1,100 px (devotee) and ≈ 800 px (staff).
  - **Tablet/desktop:** the header and Profile on the left, App and Privacy on the right.
- **States:**
  - Loading: a skeleton for the profile rows (space kept, CLS 0).
  - A row's value: "Not added" in muted italic.
  - Error: "Couldn't load your profile. Check your connection — Retry."
- **Data presentation:** batch names; dates "12 Mar 2001".
- **Components:** Grouped list, Sheet, Toggle, Notice, Danger-solid in the delete Sheet.
- **Micro-interactions:** a row's value updates in place after saving, and a toast "Address saved."
- **Imagery:** none.
- **Density:**
  - PRIMARY: who I am.
  - SECONDARY: notifications and password.
  - CONTEXTUAL: role and batch.
  - ACTIONABLE: the rows.
  - OPTIONAL: How to use and the data pages.

**22–25.** P0 ("Checking…", privacy link) / P1 · M · Risk low · Benefit high · Budget: Account 3.6 KB + Profile 5.1 KB gzip; the sheets lazy-load inside the same chunks (≤ +2 KB) · **Phase 0** (timeout, privacy) and **Phase 4** (rows, role How-to, staff fields).

**Before → After → Why better → Unchanged.**
- Before: 2,900 px of open forms, devotee fields for team logins, "Checking…" for ever.
- After: ≈ 1,100 px of rows, role-aware sections, an honest status.
- Why better: each setting is one tap away, and nothing irrelevant or false is shown.
- Unchanged: every profile field, the password change, deletion, Log out and the build.

---

### Go to… — command search (coordinator, IYF head)

**1. Current purpose.** Jump to any screen the person may open, or to a devotee by name, phone or IYF ID. Opened by 🔍, `/` or Ctrl/⌘K.

**2. Current UI structure.**
- A Sheet "Go to" with a search field ("A screen, or a devotee's name, phone or IYF ID").
- 8 screens when empty.
- Devotees after 2+ characters (250 ms debounce, `members.list` limit 8).
- Rows: an icon tile, the title, "SPS · KT26-0110 · 6000000011".
- The key hints "↑ ↓ move · Enter open · Esc close" (hidden on touch).

**3–10. Problems.**
- [Nav] The screen list mirrors today's menu: 10 admin items, "Members" and "All devotees" both. It will mis-name things after the IA change.
- [UX] There are no section headers: screens and people are mixed in one list. There are no recent items.
- [A11y] The combobox always says `aria-expanded="true"`, and each `role="option"` wraps a link (nested interactive).
- [UX] "No devotee matches “x”" shows even when screens match.
- [UX] There are no synonyms: "notices", "reopen" and "members" fail after the renames.

**11. SEO.** n/a (a sheet).

**12. Must remain unchanged.** Staff only (`canRequests`); results only within what the server lets this person see; the shortcuts; loaded only on first open.

**13–21. Redesign.**
- **UI:** the groups **Recent** (last 5, per viewer, `localStorage` with try/catch), **Screens** (from the new `nav.js` areas, named as in IA §12), **Devotees**.
- **UX:**
  - A synonym map (members→Devotees, notices→Announcements, reopen→Requests › Reopens, overview→All batches).
  - The "no match" note is scoped to its group.
- **Interaction model:** the listbox options are plain `li`s. Enter or click calls `go(href)`. `aria-expanded` follows whether results are visible.
- **Motion:** the sheet rises in 200 ms; the selection tint is 120 ms.
- **Responsive:**
  - **Phone:** full-height sheet, input at the top.
  - **Desktop:** a 620 px dialog at 20 vh.
- **States:**
  - Typing: "Searching…".
  - Error: "Couldn't search devotees — check your connection."
  - Empty: "Type a screen or a devotee's name, phone or IYF ID."
- **Data presentation:** for a devotee, the name, then "SPS · KT26-0110". The phone shows only when the query was a phone number.
- **Components:** Sheet, Search, Grouped list.
- **Micro-interactions:** the matched characters are bold; Esc clears first, then closes.
- **Imagery:** n/a.
- **Density:**
  - PRIMARY: the best match.
  - SECONDARY: the other screens and people.
  - CONTEXTUAL: batch and ID.
  - ACTIONABLE: open.
  - OPTIONAL: the key hints.

**22–25.** P2 · S · Risk low · Benefit medium · Budget: CommandSearch 2.0 KB → ≤ 2.5 KB gzip · **Phase 2** (IA names) and **Phase 8** (ARIA).

**Before → After → Why better → Unchanged.**
- Before: one mixed list, stale names.
- After: Recent / Screens / Devotees, synonyms, correct ARIA.
- Why better: faster jumps, and it keeps working after the renames.
- Unchanged: who can use it, the shortcuts and the server-scoped search.

---

### The App Shell — top bar, bottom nav, rail, sidebar, drawer, bell, offline bar, toasts (every signed-in role)

**1. Current purpose.** One navigation model (`lib/nav.js`) drawn three ways (bar < 600, rail 600–1023, sidebar ≥ 1024), plus the top bar, bell, offline bar, toasts and Go to….

**2. Current UI structure.**
- **Sidebar:** brand, area tag, profile card, then sections My Sadhana / Facilitator / My batch (+ batch select) / Admin (10 items) / You (Announcements, Account, Report issue, How to use, Install, Theme, Log out).
- **Top bar:** Back or ☰ · area tag + serif title · 🔍 + bell.

**3–10. Problems.**
- [Nav] **The sidebar overflows at 860 px.** For the head it ends at "Batches": IYF IDs, Activity, Settings and the whole You section, including **Log out**, are unreachable without page scroll (review P0 #9).
- [Nav] The head's sidebar has **19 rows**, with "Group leaders" twice and both "Members" and "All devotees".
- [Nav] Desktop shows a tab row **and** the sidebar for the same Admin items. The tab row is cut ("s", "**w**").
- [Mobile] The head + devotee bar has no Requests or Admin (`nav.js` ranks Week and Report first).
- [UX] **Bell count:** "4" on Home but "1" or "0" elsewhere. When `announcements.list` isn't cached, `unread` falls back to `latestAnnouncementAt` → 0 or 1.
- [UX] The app badge is `sc.devotee ? unread : pending`: a head who is also a devotee never sees waiting requests on the icon. `pending` leaves out reopens.
- [Nav] Back shows on root pages (`/week`, `/group`, `/wall`, `/hearing`, `/reading` → `#/home`). `/devotee/<login>` always goes Back to `#/batch`, even when opened from All devotees or Go to….
- [Visual] Every admin page is titled "Admin". The bell shows on the Wall.

**11. SEO.** `document.title` per route (S1); the landmarks are kept.

**12. Must remain unchanged.**
- One model in `nav.js`; the server is the authority.
- The skip link and the focus-to-title-on-navigate with a polite announcement.
- The drawer: native `dialog`, closed by Esc, the scrim and Back.
- The keyboard shortcuts.
- The offline bar wording: "You're offline — changes stay on this phone".
- Toasts: at most 3, with Undo.
- The forced password change never shows the app (handled in **Phase 3**: no shell around it).

**13–21. Redesign.**
- **Sidebar (desktop):**
  - The sidebar is `position: sticky; height: 100dvh`, with **its own scroll** (`overflow-y: auto`, an edge fade). The profile card is pinned at the top and links to Account.
  - **One entry per area:** Home · Requests (badge) · Batches ▸ · Admin ▸ · My students · You.
  - Only the active area expands its children (indented 40 px rows). The 3 px area marker sits on the active area.
  - The head's sidebar is about 12 rows and fits 860 px.
  - The batch select becomes a compact scope chip in the Batches area.
  - The "Announcements" row is removed: the bell is its one place.
- **Bar (phone) rule:**
  - Order: Home → own daily action → queue → highest scope → Account, max 5, labels always shown.
  - Head: Home · Requests · Admin · Batch · Account.
  - Head + devotee: Home · Week · Requests · Admin · Account. Report and Batch go to the rail and drawer.
  - Coordinator: Home · Batch · Requests · Account.
- **Rail (tablet):** 88 px, the same order, up to 7.
- **Drawer:** never repeats the bar's items (exists).
- **Badges:**
  - Requests badge = sign-ups + resets (+ reopens + reports for the head).
  - App-icon badge = that number for anyone with `canRequests`, otherwise unread posts.
- **Bell:**
  - The unread count comes **from the server**: a `home.get`/`announcements.unread` field computed from the person's stored seen-time, the same on every screen.
  - The bell is hidden on the Wall.
- **Top bar:**
  - The title is the page's own name ("Settings", not "Admin"). The area tag appears only on staff pages; none on Account and the Wall.
  - **Back only on child pages:** day, history/<week>, devotee/<login> (returns to where it was opened from, via `history.back()` when the previous entry is in-app, otherwise the area root), fill/*, my-devotees/<login>.
  - Root pages show ☰ on phones and nothing on desktop.
- **Offline bar:** a sticky Notice under the top bar. "Back online" shows for 3 s, then hides.
- **Toasts:** bottom-centre above the bar, swipe to dismiss (Phase 7).
- **Motion:**
  - The nav pill slides with `--ease-spring`, 200 ms.
  - Page slide 220 ms by direction (crossfade on Low).
  - The top bar turns to glass on scroll (exists).
- **Responsive:** as above. The desktop has no page tab rows; phone tabs scroll with an edge fade and the active tab centred.
- **States:**
  - Bell: "Announcements, 3 new" or "Announcements".
  - Badge: capped at "9+".
  - Offline: as now.
- **Components:** glass bar and sidebar (≤ 2 glass layers), Status chip, Toast, Sheet.
- **Micro-interactions:** the badge pops a 120 ms scale when its count rises (not under reduced motion).
- **Imagery:** none.
- **Density:**
  - PRIMARY: the current area.
  - SECONDARY: its children.
  - CONTEXTUAL: the badges.
  - ACTIONABLE: the items.
  - OPTIONAL: Theme, Install, Report issue (under You).

**22–25.** P0 (sidebar scroll, tab cut, head + devotee bar, badge, bell) / P1 (areas) · M · Risk: medium (navigation for every role; covered by the 10-persona sweep) · Benefit very high · Budget: startup JS stays ≤ 55 KB (`nav.js` shrinks as the admin items fold into areas) · **Phase 0** and **Phase 2**, motion **Phase 7**.

**Before → After → Why better → Unchanged.**
- Before: 19 sidebar rows that overflow, tabs plus sidebar, counts that change by screen.
- After: about 12 rows with their own scroll, one entry per area, server-true counts, Back only where there is a parent.
- Why better: every destination is visible and trustworthy on every screen.
- Unchanged: the single model, the scopes, the shortcuts, the drawer behaviour, the offline and toast semantics.

---

### NEW (proposed): `#/hall/<batch>` — TV hall display (coordinator of that batch, IYF head; optional)

**1. Current purpose.** None; this is new. It is a read-only, 10-foot board for the temple hall or a class projector (360 §8.2; proposal §8).

**2. Current UI structure.** None.

**3–10. Problems it solves / risks it must avoid.**
- [UX] On Sunday, the class can't see "how is our batch doing" without someone reading from a phone.
- [Privacy] It must never show names, personal scores or phone numbers on a shared screen.
- [Security] A TV left signed in with a staff login is a risk.
- [Perf] An always-on page must not hammer D1 on the free plan.

**11. SEO.** noindex; not linked publicly.

**12. Must remain unchanged.**
- No new data is exposed: aggregates only, from the existing `stats.batch`/`stats.all`.
- No change to scopes.

**13–21. Design.**
- **UI:**
  - No shell (no bar, sidebar or bell). The layout is a 60/40 split.
  - **Left:**
    - "SPS · Week of 5 Oct – 11 Oct";
    - a huge ring "**18 of 42** submitted";
    - a Scope strip (Filling · Not started);
    - "This Sunday's attendance: 31 present";
    - "Submit closes **Mon 9:00 PM** · 1 day 4 h".
  - **Right:** today's darshan (the 40% panel, `--img-aspect-panel`) plus the verse.
- **UX:**
  - It opens from Batch status ⋯ › "Show on a TV". It goes fullscreen and requests Wake Lock (only here).
  - "Exit" is a large focusable button.
- **Interaction model:** remote arrows move a 4 px focus ring between Exit and "Next verse". Nothing else is interactive.
- **Motion:** the numbers count up on change; the verse crossfades every 60 s; the image is static. Low tier: no image, no count-up.
- **Responsive:** 1280–3840 px. Type ≥ 28 px, numbers at 96–160 px; contrast ≥ 7:1.
- **States:**
  - "Updating…" (quiet).
  - Offline: "Showing the last numbers from 7:42 PM".
  - Signed out: "Sign in on this screen to show the hall display."
- **Data presentation:** counts only; no names; no individual percentages.
- **Components:** Scope strip, ring, darshan card, Notice.
- **Micro-interactions:** none beyond the count-up.
- **Imagery:** **yes, here only**: one daily darshan, 1440w ≤ 120 KB.
- **Density:**
  - PRIMARY: submitted of total.
  - SECONDARY: the deadline.
  - CONTEXTUAL: attendance.
  - ACTIONABLE: Exit.
  - OPTIONAL: the verse and image.

**22–25.** P3 · S · Risk: low (read-only), with privacy reviewed by IYF · Benefit: community feel · Budget: its own lazy chunk ≤ 4 KB. It refreshes every 60 s only between Sun 6 PM and Mon 9 PM, otherwise every 15 min, using the cached `stats.batch`. That is ≤ 1,500 requests a day per TV, inside the free plan; check it with `sadhana-free-plan`. · **Optional, any time after Phase 7**.

**Before → After → Why better → Unchanged.**
- Before: nothing.
- After: a calm, privacy-first hall board.
- Why better: it celebrates the batch's steady practice together, without exposing anyone.
- Unchanged: every API, scope and personal view.
