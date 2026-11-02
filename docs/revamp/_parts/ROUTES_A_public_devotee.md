# Route-by-route revamp — Part A: public, authentication and devotee routes

**IYF Delhi · Sadhana Record · 8 October 2026 · part of `ROUTE_BY_ROUTE_REVAMP.md`**

**Sources:**
- the code: `App.svelte`, `index.html`, `screens/*.svelte`, `devotee/*.svelte`, `ui/Plain.svelte`, `lib/api.js`, `worker/src/auth.js`;
- the sweep screenshots (personas public, pending, temp-password, devotee, devotee-gl; 390-light and 1280-dark);
- `DESIGN_SYSTEM.md` (component and token names used as written), `UI_UX_360_REVAMP.md` (§5 sign-in, §7 motion moments, §8.2 imagery, §10 Homes, §11 IA, §12 wording), `current-features.md` §3, `pre-store-revamp-review.md`.

**Reading the tags:**
- **Problems:** [UX] [Hierarchy] [Visual] [Nav] [Interaction] [Mobile] [A11y] [Perf].
- **Phases:** 0 Baseline/trust/store · 1 Design-system foundation · 2 Shell and navigation · 3 Authentication · 4 Devotee core · 5 Group leader/facilitator/coordinator · 6 IYF head/admin · 7 Motion · 8 Performance/a11y/SEO · 9 Store builds and QA.
- **D1** = the one-brand decision (lapis `#2c4b8e` / `#a3bcf2` + gold) in `DESIGN_SYSTEM.md` §2.2. Every "brand" below means D1; until IYF signs D1, read it as "the devotee accent".

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
- **Responsive:** Phone — band 200 px below the lockup (480w ≤40 KB). Tablet — top band 40% height (960w). Desktop ≥1024 — **split screen**: left 50% darshan panel full height with verse + credit on `--img-panel` (glass High / 88% Balanced), right 50% the lockup + actions column (420 px).
- **States:** loading — colour placeholder, buttons usable immediately; offline/Low/Save-Data — no image, verse alone; error (screen file fails) — Notice "Could not load this screen. Check your connection and reload." + Reload (existing).
- **Data presentation:** today's darshan title + credit under the verse: "Darshan: Sri Chaitanya — courtesy of the BBT".
- **Components:** new `AuthLayout` (shared by Welcome/Login/Sign-up; phone column, desktop split), **Darshan card** in panel variant.
- **Micro-interactions:** buttons sink 0.97; privacy link underline on hover.
- **Imagery:** **Recommended** (§8.2 "Welcome: Yes", flagships #07/#08/#17/#22; daily, deterministic; `alt="Darshan: <title> — <credit>"`). Blocked until IYF confirms BBT rights (IYF decision).
- **Density:** PRIMARY Sign in / Create · SECONDARY purpose line · CONTEXTUAL darshan + verse · ACTIONABLE 2 buttons · OPTIONAL privacy, icon row.

**22–25.** P1 · M · Low · "I understand what this is and where to tap in 3 seconds." · +0 KB startup; image 40 KB (phone) / ~100 KB (desktop) lazy, `darshan.json` 3 KB precached · Phases 3 (layout, D1), 4 (image pipeline), 8 (SEO).

**Before → After → Why better → Unchanged**
- Before: purple column with fake-button tiles and an empty desktop.
- After: lapis lockup, one purpose line, today's darshan, two clear actions, privacy line.
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
- [UX] Blood group, address and emergency contact are required at sign-up (cuts ~40% if moved to Account later).
- [UX] **P0:** no consent/privacy notice; age 12–80 accepted with no parental consent (DPDP 2023) — IYF decision on minimum age.
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
- **UI:** same composition in **D1 lapis** (`#2c4b8e → #1e3566`; dark `#16213d → #0d1220`) with gold rule and bar; `theme-color` lapis.
- **UX:** **first open:** keep the emblem splash with a shorter minimum (≈800 ms). **Returning signed-in:** no hold — fade as soon as the kept Home renders (§5.8).
- **Motion:** splash line loop (the one allowed loop); fade 300 ms; reduced motion instant.
- **Responsive:** unchanged (centred).
- **States:** script fails — the existing "Could not load this screen… Reload" Notice after fade.
- **Imagery:** **Not recommended** (§8.2: speed; the emblem is the brand moment).
- **Density:** PRIMARY emblem + name only.

**22–25.** P1 · S · Low · "The app opens instantly for people who use it daily." · −1.4 s perceived start for returning users; +0 KB · Phases 1 (colour), 8 (hold rule).

**Before → After → Why better → Unchanged**
- Before: purple, 1.8 s every time.
- After: lapis, instant for returning users.
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
- **UI (phone, top → bottom):** greeting (`--fs-display`, time-of-day line, no batch) → **Status block** (one hero, `--shadow-2`, state wash): status line in `--fs-status` "3 days to fill — Mon, Tue, Wed · closes Mon 9 PM" → **7-day strip** (complete ✓ `--success`, partial ◐, **missing amber dot + "Missing"** for past unfilled, future ○ outline) → one Primary action ("Fill Monday" = the oldest missing day; "Submit week" in the window; "Submitted ✓ · 82%" + Share) → [Not saved yet Notice, inside the block] → **Needs-you card** (group leader: "1 in your group still to submit · Deepak ›"; facilitator member: "2 students not started ›"; hidden when empty) → [reminder/install card] → **Darshan card** (image + verse beneath + credit; replaces the verse carousel) → announcement teaser **only when unread** → quick links row: Hearing · Reading · History · Share today (no Report, no Notices).
- **UX:** one hero; one count of days; the next action always names a day.
- **Interaction model:** day strip chips are links (44 px); long weeks of past open weeks shown as compact rows inside the block ("Week of 28 Sep · Submit by Mon 9 PM").
- **Motion:** Shared-element day chip → Day header (320 ms, High/Balanced); Numbers count-up on first view; Submit week moment arrives back here (ring completes, "✓ Week submitted · 82%"); Darshan fade.
- **Responsive:** Phone — single column as above. Tablet — two columns: status + needs-you | darshan. Desktop — 2/3 status + needs-you + quick links | 1/3 darshan (4:5) + teaser; no empty quarter.
- **States (exact):** loading — Skeleton of the status block; offline with cache — "Offline · showing what was kept on this phone"; error no cache — "Couldn't load your week — check your connection. Your saved days are safe." + Retry; first week empty — "Your first week starts today · Fill today's sadhana — it takes about 2 minutes." + Fill today; all done — "Today is done ✓ · Share".
- **Data presentation:** "Wed, 7 Oct" dates; deadline from `closesAt`; no rounds target (IYF decision).
- **Components changed/new:** Status block (new), Needs-you card (new), Darshan card (new), Status chip "Missing (day)", quick links row; QuoteCarousel retired on Home.
- **Micro-interactions:** the missing chip pulses once on first view (not looping; none under reduced motion); press sink 0.99 on rows.
- **Imagery:** **Recommended** — one Darshan card (§8.2 "Devotee Home: Yes", daily, festival override, lazy 480w ≤45 KB, meaningful alt). Never in the Status block.
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

**2. Current UI structure.** Back + "◎ MY SADHANA / Daily sadhana" → sticky day chips (Mon–Sun, ○ / ◐ / ✓ / ·) → "Wednesday, 07 Oct 2026" → "How your day is scored ›" → [Still needed] → sections: **Body** (Slept at, Woke up at — wheel pickers "Set time"; Day rest) → **Chanting** (Rounds, finished at, same day Yes/No) → **Hearing** (minutes, "Choose a topic") → **Reading** (minutes, "Change book") → **Seva and other** (service, topic, exercise, study/job) → **Chetna** chips → **Comment** (0/500) → floating **action bar** ("Day score 0/100", Share, **"Saved ✓"**) above the floating **bottom nav**. Desktop: two-column form; the action bar floats mid-page.

**3–10. Problems.**
- [UX] **P0:** "Saved ✓" on a day nobody touched (0/100) — a false state (review #6).
- [Mobile] Two floating bars (Save bar + nav pill) cover ~150 px at 390 px; they overlap "Completed the same day?".
- [UX] "Change book" when no book was ever chosen (should be "Choose book").
- [UX] Date "07 Oct 2026" (numeric zero-pad); chips use the same ○ for missing past days.
- [Hierarchy] Section icon chips tinted; every section equal weight; "Still needed" appears only after typing.
- [Interaction] Minutes are free number fields; no −/+ steppers; no "Same as yesterday".
- [Mobile] Desktop two-column form scatters the reading order (Body → Chanting across, then down).
- [A11y] Chips "·" for future days are not announced as disabled; action-bar status changes are polite-live (OK).

**11. SEO.** Not indexable. `document.title = "Wed, 7 Oct · Sadhana Record"`.

**12. Must remain unchanged.** **Explicit Save**, never auto-send; local draft kept on the phone; leave guard (Save / Leave and save later / Discard / Stay); STALE handling ("changed on another device"); future days refused; live score from `$shared/scoring.js`; hearing topics picked from the journal (≤8) with typed fallback; book picked (remembered); Chetna chips; comment ≤500; limits (rounds 0–64, minutes 0–600/999); `?f=` focus; the typing class hides bars while a field has focus; Share only after save; fill-on-behalf variant.

**13–21. Redesign.**
- **UI (phone):** top bar "Wed, 7 Oct" (title = the date) with Back → sticky day chips with **Missing** amber dots → "Still needed: Wake-up, Rounds, Hearing" line (shown from the start for an empty day) → sections in one column, neutral icons → **one floating action bar only** (bottom nav hidden on this editor): "Day score 62/100" · Share · Primary **Save** (`Save` disabled until changed → `Saving…` → `Saved ✓`).
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

**22–25.** P0 (Saved ✓, two bars) / P1 · M · Med (leave guard with swipe) · "I fill a day in under 2 minutes and Save means saved." · +0 KB startup; steppers + swipe ≤1.5 KB in lazy devotee chunk · Phases 0 (Save truth, hide nav), 2 (nav hiding rule), 4 (steppers, same-as-yesterday, layout), 7 (swipe, shared element).

**Before → After → Why better → Unchanged**
- Before: false "Saved ✓", two floating bars, free-typed minutes.
- After: honest Save states, one bar, steppers, missing days visible, single column.
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
- **UI:** Segmented **Daily · Weekly** first (tabs, §11) → summary row: last submitted week (Stat tile, count-up) + 12-week trend line (Overall lapis; missed points as hollow amber) → month/year pickers → Daily: calendar with bands `--hi/--mid/--lo`, **solid amber dot = missing (past, unfilled)**, dashed amber outline = missed week, today ring → selected day panel: Meters (category colours) + Share. Weekly: the month's weeks as Grouped list rows with Status chips (Submitted 82% / Filling / Missed · 0%) + selected week Meters, kv, Share (this absorbs History).
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

## IYF decisions raised in this part

1. **D1** one brand/action colour (all routes).
2. **Darshan image rights** (BBT) before Welcome, Login panel, Pending and Home imagery ship.
3. **Minimum age / parental consent** (DPDP 2023) and the consent text on sign-up step 1.
4. **Blood group, address, emergency contact later** (would change the sign-up contract).
5. **Rounds target** — not shown anywhere until decided.
6. **Hindi** — all wording above is written to be extracted to one file per language if chosen.
