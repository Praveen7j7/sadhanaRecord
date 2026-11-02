# Phase 0 — what was built, and how to release it

**IYF Delhi · Sadhana Record · 8 October 2026 · LIVE since 19:52 IST** (app build 2026.10.08-1950, `index-BJsI6KRT.js`, frontend version 73167f75; API worker 8fc3f2ab; D1 migration 0030 applied; Sheets columns and tabs built). Release checks: browser 1,688 + components 219, live smoke 11/11.

**Also on release day:** the old Google key of `iyf-delhi@sadhanareport` was deleted in Cloud Console, which stopped the Sheets copy from 15:21 to 19:24 IST. A new key was made; it is at `~/Documents/ticketSystem/secrets/sadhanareport.json` (setup tools) and in the server secret `GOOGLE_SA_KEY`. The copy caught up with nothing lost.

Phase 0 of `IMPLEMENTATION_ROADMAP.md`: trust fixes and store blockers. It goes live on its own (phases 1–8 go live together later).

## 1. What changed for people

**Devotees**
- **Day form:**
  - Hearing and Reading show only the topic (or book), then the duration. The lecture and book lists open in a sheet and no longer push the form down. This applies on every route that fills a day.
  - A day nobody has filled shows **Save** (disabled), not a false "Saved ✓".
  - On a phone the bottom tabs are hidden while a day is open, so only the Save bar floats.
  - Filling for someone reads "How *their* day is scored".
- **Current book:** the chosen book is saved to the server, so a new phone remembers it.
- **Week page:** attendance shows nothing chosen before Sunday.
- **History:** a week that isn't submitted shows "not submitted yet · Open the week", not a blank page.
- **Pending approval:** the login screen shows a calm "Waiting for approval" page with the person's name, batch, facilitator and send date. There is no red error and no second sign-up.
- **Forced password change:** opens on its own sign-in style page, with no app bars around it and a Log out link.
- **Sign-up:**
  - The minimum age is **15**.
  - For ages 15–17, a parent or guardian section appears: their name, their mobile, and an "agrees" tick.
  - Everyone ticks the privacy policy (linked) before signing up.
- **Privacy policy:** new public page `/privacy.html`, linked from Welcome, Sign-up and Account. The text is marked **draft** for IYF to approve.
- **Wall:**
  - Report a post or comment (spam, abusive, not suitable, other).
  - Hide a person's comments for yourself, with a "Hidden comments" list and **Show again**.
  - The liked heart uses the brand colour, not the error red.
- **Bell:** the bell count is the same on every screen. The app icon badge shows waiting requests plus unread posts.
- **Notifications switch:** no longer stays on "Checking…" forever; after 4 seconds it says what to do.

**Group leaders, coordinators, facilitators**
- **Batch status:**
  - Counts only active members.
  - Inactive and disabled members fold into **Not active (n)** at the end.
  - Name rows and the Fill link are full-size tap targets.
- **Reopened weeks:** in a week the IYF head reopened, attendance can be marked until the reopen deadline (Board and My group).
- **Group leaders tab:** taking someone out of a group has **Undo**.
- **Members:** Delete moved behind **⋯** (then the existing confirm sheet).
- **Devotee page:**
  - Doesn't offer "Fill" for a week already submitted.
  - "View" and "Back to …" are full-size targets.
  - Says "the IYF head", never "the master".
- **Requests:**
  - Shows the batch name.
  - For an under-18 sign-up, shows the parent or guardian who agreed (name and number).
- **Facilitators:** "This week" from a direct link works (it used to end in "/").
- **Team logins:** greeted "Hare Krishna", not "Hare Krishna, SPS".
- **Activity:** now also logs attendance saves (coordinator and group leader), days filled on someone's behalf, and moderation, in plain sentences.

**IYF head**
- **Phone bar:** a head who is also a devotee keeps **Requests** and **Admin** on the phone bar. Report and Batch move to the rail and the menu. Same for a coordinator who is also a devotee.
- **Wall moderation:**
  - **Reports to review** (what was reported, never who reported it): **Remove** or **Keep it**.
  - Hide a person's comments **for everyone** (new comments from them are refused), with **Show again**.
- **Desktop:**
  - Admin tabs and the Activity filter chips that run off the edge now fade at that edge and show a thin scrollbar.
  - The sidebar scrolls on its own with a fade at the bottom.
  - Links with `?…` (e.g. `#/overview?x=1`, `#/requests?type=…`) no longer say "Not available to you".
- **Add batch:** new batches get the right journal (SPS/DPS, BSS or BVS) and the right score card.

**Performance**
- **Startup JS** 55.32 → **52.72 KB** (target 55): the sign-up checks no longer load at startup.
- **Startup CSS** 13.64 → **13.40 KB** (target 13.5): the sheet styles load with the first sheet.

## 2. Moved out of Phase 0

Each of these goes with the phase that needs it:
- **Privacy-friendly usage counters:** moved to Phase 8 (they need a design for what is counted).
- **Store reviewer demo data on a test copy:** moved to Phase 9 (needed only for store submission).
- **Staging check on real-shaped data:** part of the final test (Phase 8).
- **Wall comments on or off in the store builds, and the final privacy text:** IYF decides at deploy (Phase 9).

## 3. Tests run

| What | Result |
|---|---|
| Server tests | 20 suites, 1,722 assertions, all pass (127 new for Phase 0) |
| App unit tests | 271, all pass |
| Size budgets | JS 52.72 KB, CSS 13.40 KB: both under target |
| Browser checks for the changed screens (the parts these changes touch) | devotee 225 · coord 127 · nav 102 · logins 697 · oct7 16 · welcome 28 · groups 26 · master 36 · phase8 35 · facilitator 14 · **new oct8 (Wall moderation) 9** · all pass, no page errors. Tests updated for the new behaviour: the honest Save, the phone bar for staff who are devotees, the pending page, the forced change, the sign-up age and consent |
| Screenshots | Day form, topic sheet, pending page, under-18 sign-up, Batch status (phone and desktop, light and dark); Wall reports queue and hidden comments; forced change |
| Found and fixed while testing | Messages from the last person ("You won't see …") stayed on screen after log-out and log-in: log-out now clears them |

## 4. Release order (the database change needs it)

The server now reads two new tables on every Wall load, so the order matters.

**Step 1. Google Sheets: add these columns and tabs, header in row 1.**
- *Profiles* file › *Profiles* tab: add columns **T** `parent_name`, **U** `parent_phone`, **V** `parent_consent_at`, **W** `privacy_consent_at`.
- *Access* file › new tab **PostReports**: `id, ann_id, comment_id, reporter, reason, note, at, state, decided_by, decided_at`.
- *Access* file › new tab **PostMutes**: `id, viewer, author, by, at`.
- `setup/schema.mjs` already has them, so `node setup/build-store.mjs` can build them.

**Step 2. Apply the migration:** `npx wrangler d1 migrations apply sadhana --remote` from `worker/` (migration `0030_phase0.sql`: 4 profile columns, 2 tables, their Sheets-copy triggers).

**Step 3. Deploy the server:** `npx wrangler deploy` from `worker/`.

**Step 4. Release the app** through the gate (`tools/release/gate.mjs`, phase 11), which builds and deploys the frontend.

**Step 5. Check live:**
- open the Wall;
- sign in with a test account;
- check the bell and Batch status;
- open `/privacy.html`.

**Rollback:**
- The previous server version (`86f3e05d`) and frontend (`e8b4e624`) can be restored with `wrangler rollback`.
- The migration only adds columns and tables, so the old code ignores them.

## 5. Open points

- The privacy policy text is a **draft**. IYF approves the wording before the store release.
- Members already under 15 are not affected; the age rule applies to new sign-ups only.
- A reopen whose deadline has passed still shows "Reopened" until the next deadline run. Marking and filling are correctly refused in that time (server note).
