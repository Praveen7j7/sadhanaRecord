# Release phase 13 — quotes, verse presentation, sheet motion, simpler fields, wheel pickers

**IYF Delhi · Sadhana Record · built 9 October 2026 in `sadhanaRecord/` · NOT RELEASED (held)**

**Naming.** This is **release phase 13** (the deploy ledger's numbering, after phase 12 of 9 Oct). It is *one contribution to* the revamp's **Phase 9**, whose full list is owned by `REVAMP_PROGRESS.md` ("Phase 9 — Stage A/B"). It is not a phase of its own.

**Status: held, not deployed (9 Oct 2026).** A peer session has been building the rest of Phase 9 in `sadhanaRecord-revamp/`, and that work includes **worker changes** (`announcements.js`, `api.js`, `push.js`, `weeks.js`) and a **new migration `0032_scheduled_posts.sql`**. Releasing this frontend alone could put UI live against server behaviour that is not. The two trees differ in 26 files under `frontend/src`, and `lib/pace.js` exists only in the revamp copy. **These changes go live as part of the single Phase 9 release, after the two trees are merged by hand.**

**What changed in the plan.** The roadmap's Phase 9 was "Store builds, final QA and rollout". On 9 Oct 2026 IYF **postponed everything to do with the domain, the Android/Play Store and the iOS/App Store to Phase 10**; those contents are unchanged, only renumbered.

**Scope rule applied throughout:** the smallest maintainable change, no new dependencies, every existing function and business rule kept.

---

## 1. More quotes (46 → 78)

**What.** `setup/fetch-quotes.py` gained ~50 references and was re-run; `frontend/src/lib/quotes.js` was rebuilt from its output.

| Source | Before | After |
|---|---|---|
| Śrīmad-Bhāgavatam | 15 | **34** |
| Bhagavad-gītā As It Is | 28 | 28 |
| Śrī Caitanya-caritāmṛta | 3 | **9** |
| The Nectar of Instruction | 0 | **4** |
| Śrī Brahma-saṁhitā | 0 | **3** |
| **Total** | **46** | **78** |

**How they were chosen.** Books the devotees are already allotted (the `books` table), weighted to Bhāgavatam cantos 3, 4, 6, 7, 10 and 11 and to Caitanya-caritāmṛta Madhya 8 and 22, as these speak to daily practice.

**Rules kept.** Every verse is Śrīla Prabhupāda's translation, word for word from vedabase.io, with its reference so anyone can check it. No verse was typed or paraphrased.

**Two limits found while building, both deliberate:**
- **6 references were skipped, not guessed.** `sb/11/11/29`, `sb/11/19/20`, `sb/11/19/21`, `cc/madhya/20/108` and `iso/mantra-1` are not at those paths on vedabase.io, and `nod/1` has no verse translation to take. The fetch script now **skips a missing reference and reports it** instead of stopping.
- **23 verses were left out for being too long** (over 430 characters). The carousel sizes its card to its tallest slide, so one very long verse would make every slide a wall of text. The longest kept is 423 characters; the median is 214.

**Also fixed (found in a screenshot, not by a test):** 7 Caitanya-caritāmṛta verses arrived carrying their own `“ ”` marks, and the component adds its own — so the Welcome screen read `““Whether one is a brāhmaṇa…””`. The outer pair is now stripped on merge, as the file header already required. A balanced *inner* single-quote pair (Antya 20.29, where Lord Caitanya quotes a prayer) is correctly kept.

**Cost.** The quotes are in a lazy chunk, never in the startup bundle. Startup JS and CSS are unchanged.

---

## 2. The verse at sign-in reads like a printed page

`styles/auth.css`, signed-out screens only (Welcome, sign in, sign up, forgot):
- a large serif opening mark in the logo's gold at 26 % opacity, behind the first line;
- the verse in the serif face, with `hanging-punctuation` and even wrapping;
- the source on one baseline after a short gold rule, in a slightly heavier weight;
- the verse and its source fade and rise in (450 ms), the source 80 ms behind, so they arrive as one thing.

**Over the painting the card styling and the quote mark are dropped** (`.wl-in-panel`): the panel guarantees the contrast, and a decorative glyph over the Lord's form is not allowed (`UI_UX_360_REVAMP.md` §8 dignity rules). Reduce Motion removes the animation.

**Wording.** The line under *Create an account* was two lines of "Sign up in a few minutes · your coordinator approves you". It is now one line: **"Your coordinator approves new accounts"** — it states the fact, names a person rather than a policy, and sets up the pending screen that follows.

---

## 3. Sheets open smoothly (the "How to use" jank)

Two separate causes, both fixed:

**a. The animation never ran.** In `styles/sheet.css` the `@starting-style` rules sat **outside** `@layer components` while `.sheet[open]` sat inside it. An unlayered rule loses to a layered one, so the browser had no start value and the sheet simply appeared. Moving `@starting-style` inside the layer makes the open genuinely animate. `will-change` keeps it on the compositor, and a Reduce Motion branch shows it at once.

*This affected **every** sheet in the app, not only How to use.*

**b. How to use opened before its content existed.** `screens/Account.svelte` called `showModal()` while `HowTo.svelte` was still being imported, so the sheet animated and then resized around the arriving content. Opening now awaits the import and one `tick()`.

**Measured after the fix** (Chrome, 390 px): at the first frame after opening, the dialog already holds 916 characters and is 608 px tall; after it settles it is still 608 px. `transition-property` includes `transform`. So: content in before the animation, no resize during it, and the open really animates.

---

## 4. The ± minute buttons are gone

Removed from all five duration fields in `devotee/Day.svelte` (day rest, hearing, reading, service, exercise) and the now-unused code deleted from `ui/NumInput.svelte`.

**Why.** Stepping 5 minutes at a time takes many taps where the numeric keypad takes a few, and the `− [field] +` row doubled the height of every duration field. The field keeps its numeric keypad, its validation and its 44 px target.

---

## 5. Wheel pickers: a tap chooses and closes

**Asked for:** scrolling should highlight, but a deliberate tap on a row should select *and* confirm, without also needing Done.

**What was inspected.** `Wheel.svelte` is the one wheel in the app. Its users:

| Component / route | Uses | Behaviour now |
|---|---|---|
| `ui/WheelSelect.svelte` | `Wheel` ×1, with Cancel / Done | **Tap commits and closes** |
| `ui/WeekPicker.svelte` | `WheelSelect` ×2 (month, week) | inherits the fix |
| `screens/Profile.svelte`, `screens/SignUp.svelte`, `ui/AddressFields.svelte` | `WheelSelect` | inherits (blood group, state, class day, batch …) |
| `coord/` Members, Requests, Batch, Leaders, DevoteeDetail, SignUpCard | `WheelSelect` | inherits |
| `master/Admin.svelte`, `master/Settings.svelte` | `WheelSelect` | inherits |
| `devotee/LectureList.svelte`, `devotee/Report.svelte` | `WheelSelect` / `WeekPicker` | inherits |
| **`ui/TimePicker.svelte`** | **`Wheel` ×3** (hour, minute, AM/PM) | **unchanged on purpose** |

**The change.** `Wheel.svelte` gained an **optional** `oncommit(value)`. A tap on a row clears the pending scroll-settle timer (so no second `onchange` fires), moves to that row, and calls `oncommit` when the picker asked for one. `WheelSelect.svelte` passes `oncommit` and routes it through the same `commit()` as Done, guarded by a `closing` flag against a double commit.

**`TimePicker` deliberately does not pass `oncommit`.** It has three wheels: if tapping an hour closed the sheet, the minutes and AM/PM could never be set. Done stays required there — verified, not assumed.

Scrolling alone still never commits. Cancel, Escape and the phone's Back still discard the temporary value.

---

## 6. Darshan images — what was *not* done, and why

The request was for images on all routes at full quality. On inspection this was **narrowed to the devotee routes where an image belongs**, on IYF's instruction ("only where they should be, not like we have a feature so will place it everywhere"), which is also the standing rule in `UI_UX_360_REVAMP.md` §8: *never on forms, workflows, tables or admin screens*, and never behind data or beside errors.

**The finding: the devotee routes that should carry imagery already do.** Welcome, the desktop sign-in panel, the pending page, devotee Home (the darshan + verse block) and the week-submitted celebration all show today's darshan. Adding more would have meant paintings behind staff tables and admin screens — against the dignity rule, worse for legibility, and a real cost on cheap phones.

**Quality and smoothness.** The adaptive tiers were kept (IYF's choice): full-resolution WebP where the device can take it; on the Low tier or with Save-Data the image is skipped and the verse shows alone. This is what keeps the app smooth on low-end Androids. No image is on the critical path or in the precache.

---

## 7. Tests (Phase 9 only, per `IMPLEMENTATION_ROADMAP.md` §5)

All run on 9 Oct 2026 against this build.

| Suite | Result |
|---|---|
| Server (`worker/`) | **20 suites, 1,747 assertions, all pass** |
| App unit (`frontend/`) | **22 files, 313 tests, all pass** |
| Browser — devotee | 226 pass, 0 fail |
| Browser — logins (10 personas) | 692 pass, 0 fail |
| Browser — coord | 131 pass, 0 fail |
| Browser — nav | 102 pass, 0 fail |
| Browser — rules, dayview, design, phase8 | 56 / 42 / 27 / 35 pass, 0 fail |
| Browser — welcome, master, oct8, oct9, oct10, p7 | 31 / 36 / 13 / 7 / 20 / 9 pass, 0 fail |
| Components | **219 pass, 0 fail** |
| Page / console errors | **none** in every run |

**Purpose-written checks for this phase** (run in Chrome, then removed):
- **Wheel picker, 7 checks, all pass** — on the real blood-group field: the picker opens; a tap closes it with no Done; the tapped row reaches the field; reopening shows the saved value; Cancel keeps the saved value; Done closes; Done commits the highlighted row.
- **Time picker, 2 checks, all pass** — three wheels present; tapping one wheel does **not** close the sheet.
- **How to use, 3 checks, all pass** — content present before the animation; height stable at 608 px; `transform` transitioned.

**Test updated:** `tests/phase4.test.js` pinned the quote count at 46 and the longest at exactly 344 characters. It now expects 78, asserts the longest is **≤ 430**, and additionally checks every verse has a reference and no reference repeats.

**Bug caught by an existing test:** `tests/design.test.js` requires every quote to carry a category label. The new Brahma-saṁhitā verses had none, so `lib/carousel.js` gained Brahma-saṁhitā (plus Nectar of Devotion and Īśopaniṣad, for later). Every one of the 78 quotes now has a category.

**Screenshots:** 160 at 390 / 820 / 1280 / 1920 px, light and dark, across devotee, coordinator and head logins. No sideways scroll anywhere.

**Size (clean build):**

| Budget | Now | Target | Hard |
|---|---|---|---|
| Startup JS | **55.03 KB** | 55 | 60 |
| Startup CSS | **13.43 KB** | 13.5 | 15 |
| Largest lazy chunk | **28.47 KB** | 30 | 35 |
| Precache | **687.85 KB** | 700 | 800 |

Startup JS is 0.03 KB over its target and well inside the hard limit. **It was already 55.02 KB in the live Phase 12 build**, so this phase did not cause it: the quotes, the wheel change and the sheet fix are all outside the startup bundle, and removing the steppers gave a little back.

---

## 8. Files changed

| File | Why |
|---|---|
| `setup/fetch-quotes.py` | ~50 new references; a missing reference is skipped and reported, not guessed |
| `setup/data/quotes-vedabase.json` | regenerated (81 fetched) |
| `frontend/src/lib/quotes.js` | 46 → 78 verses; outer quote marks stripped; header updated |
| `frontend/src/lib/carousel.js` | Brahma-saṁhitā, Nectar of Devotion and Īśopaniṣad categories |
| `frontend/src/ui/Quotes.svelte` | comment: 46 → 78 verses |
| `frontend/src/styles/auth.css` | the printed-page verse; no quote mark over the painting |
| `frontend/src/screens/Welcome.svelte` | the one-line subline under *Create an account* |
| `frontend/src/styles/sheet.css` | `@starting-style` inside the layer; `will-change`; Reduce Motion branch |
| `frontend/src/screens/Account.svelte` | How to use opens only once its content is in |
| `frontend/src/devotee/Day.svelte` | the 5 `stepper={5}` props removed |
| `frontend/src/ui/NumInput.svelte` | the ± buttons and their styles removed |
| `frontend/src/ui/Wheel.svelte` | optional `oncommit`; `tap()` cancels the settle timer |
| `frontend/src/ui/WheelSelect.svelte` | `oncommit` → one guarded `commit()` shared with Done |
| `frontend/tests/phase4.test.js` | the quote test updated to the new facts |

**Not changed:** the server, any migration, any API contract, the Sheets copies, any business rule. No dependency added.

---

## 9. Merge notes for the Phase 9 release

The peer session is porting these changes into `sadhanaRecord-revamp/` by hand. Points that matter when merging:

- **`lib/carousel.js`** (Brahma-saṁhitā category) must come across, or the new verses render a blank label — an existing test catches this.
- **`sheet.css`**: the one thing that matters is `@starting-style` ending up **inside** `@layer components`.
- **How to use**: the peer's `Shell.openHowTo` routing is the better architecture (it also fixes phone Back). Only the *property* "await the import before `showModal()`" needs to survive, however it is routed.
- **The subline under *Create an account*** collides with the same day's byline brief. The peer's version wins unless IYF says otherwise.
- **`shortQuoteIndex` (≤ 240 chars for Welcome / sign-in)**: with 78 verses, 52 are over 240, so that short pool is about 26 verses. Worth checking the rotation is still wide enough.

---

## 10. Still open

- **Phase 10** (was 9): own domain, TWA and asset links, iOS shell and APNs, store forms, reviewer demo data, listing and screenshots, submission.
- **The manual QA that automation cannot do** — TalkBack and VoiceOver, a real low-end Android run, and **user testing with 5 devotees + 2 coordinators**. Phases 1–8 went live on automated checks alone, so this is the gap where unknown breakage would hide.
- **`audit_log` / `run_log` retention** (`AUDIT_STAGE1_CURRENT_STATE.md` §5.1) — awaiting a retention period from IYF.
- **Hindi book marker** — 50 of the 76 books are flagged `'Both'`, but no Hindi PDFs are linked, so the marker would promise what the app cannot deliver. Needs the files first.
- **6 vedabase references** that returned 404 — worth re-checking by hand if those specific verses are wanted.
