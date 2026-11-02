# Phase 16 — LIVE 11 Oct 2026, 20:01 IST

API `1bf0c0c6-5aaa-4b8b-a3c8-e4047fe10eb1` · App `ae129261-fc55-4317-a3c1-6d92536317ee`
`assets/index-CqIRd71J.js` · build `2026.10.11-1959`

Gate 16 green before anything shipped: verify 1,809 · components 219 · back-guard 17 · motion-audit 27
— **2,072 checks, 0 failed**. Source `3fee8fbedf37c651` stamped.
After: sync-audit 37 tables OK, accounts 17 / profiles 13 / submissions 1 unchanged.

## What went live (three sessions' work)

**prompt-34** — "With IYF Delhi since" year wheel (required, a YEAR only), profession, and
`connectedSince` read-only on `profile.update` (the year is in the IYF ID, so changing it is a
coordinator action).

**prompt-58** — `lib/area.js` fix (a signed-in facilitator with no sadhana resolved to area
'public'), staff width 1440 px, `coord.js` profile read paths.

**prompt-85** — `auth.lookup` (sign-up asks for the phone first and says we recognise them);
the facilitator week summary (a running total plus what they read, heard and did, by title, for a
week still being filled); the service-skills multi-select.

## Decisions taken during the release

- **hobbies dropped, skills kept.** The user's list is service skills, and `profiles.skills`
  already existed from 0038 — two JSON-array columns meaning the same thing was the duplication we
  had just untangled. `0040_hobbies.sql` deleted. The Sheets Profiles `hobbies` column stays, empty
  and marked unused (Sheets columns are only ever added).
- **Skills are a fixed list, never typed** (`shared/skills.js`, one copy, server-validated): free
  text cannot answer "who can lead kirtan?", which is the reason to collect it.
- **Collapsed to one row** (`ui/MultiSelect.svelte`, "3 selected") so a 15-item list does not
  stretch the form.
- **`auth.lookup` returns a masked name only** — the endpoint is public and there is no OTP, so
  whoever typed the number is not yet known to be its owner. Verified live: an existing account
  returns `{found:false, hasAccount:true}` and nothing else.
- **`readSkills` parses defensively** — one bad value in that column would otherwise take a whole
  profile page down (caught in review by prompt-34).

## Caught by the checks, not waived

The first gate run **FAILED** at 1,805/2: `verify.mjs:619` still looked for the removed `#su-hob`
field. Fixed to check the skills row, plus a new "starts with none chosen" check. The
"5 titled sections" check was also stale — the real count is **6** (a 7th, "Parent or guardian",
appears only for a minor), counted from the live DOM rather than guessed.

## Not live

The identity import has **not** run: `persons` is 0 rows. In the files:
**852 minted** (up from 838 — 14 two-digit years such as "22"/"24" recovered by matching phones
against the journals) and **493 deferred**. The user's rule: no year of connection, no ID; it is
minted at sign-up from the year they give.

Next: the walkthrough video's sign-up chapter needs the phone-lookup step, the year wheel and the
skills multi-select (`tools/video/scripts.mjs`).
