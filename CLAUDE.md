# Sadhana Record — context and definition of done

The app IYF Delhi devotees fill their weekly sadhana in, and the system of record for batches, trainings and IYF IDs.
Shared rules for all IYF projects (identity, no ID numbers, phones, keeping projects separate) are in `../CLAUDE.md`.
Every rule below exists because breaking it cost the head another round of testing.

## Where things are

| | |
|---|---|
| API | https://sadhana-record-api.iyfdelhi-sadhana.workers.dev — `worker/`, Worker `sadhana-record-api` |
| App | https://sadhana-record.iyfdelhi-sadhana.workers.dev — `frontend/`, Worker `sadhana-record` |
| Database | D1 `sadhana`, id `8b771fe4-abfd-4bd8-9a50-dfc1ae1b739a`, APAC. **The system of record.** |
| Account | Cloudflare of iyfdelhi.database@gmail.com (owns every Sadhana file) |
| Docs | `docs/` — design `sadhana-app-design.md`, contract `sadhana-api-contract.md`, ADRs `docs/DECISIONS/`, audit `FULL_AUDIT_2026-10-12.md`, roadmap `IMPLEMENTATION_ROADMAP.md`, `TESTING.md`, `OPERATIONS.md`, `INTEGRATIONS.md` |
| Skills | `../.claude/skills/sadhana-*` — release, browser-checks, free-plan, load-test, sheets-copy, backup-restore, docs-pdf, brand-logo, route-videos. Load the matching one before acting. |

**Two trees.** `sadhanaRecord/` is LIVE; `sadhanaRecord-revamp/` is where the next batch is built and is copied over
live at release. Any change made here must be copied into the revamp **the same day** (frontend/src, frontend/tests,
worker/src, worker/migrations, worker/tests, shared, tools/browser, setup/schema.mjs), then `diff -rq` to prove they
match — otherwise the next sync silently reverts it. Agree migration numbers with peer sessions first.
The tree is not in git: a release is identified by its Worker version id and its `index-*.js`.

## The product, as decided

**Accounts and people**
- Sign up with phone + own password (NIST: 8+ chars, PBKDF2). PENDING until the **batch coordinator** approves —
  never a group leader. Minimum age 15; parental consent for 15–17. Address required. English only.
- One person, one login, many scopes: devotee · group leader · facilitator · **trainee** · coordinator (of class
  batches or of trainings) · master. Scopes are derived (`db.js scopesOf`), sent on every `auth.me`.
- The `master` username is recovery only. A new head needs every active head's approval.
- Password reset (decision 46): the devotee asks with their **phone only**; the coordinator of their batch (or the
  head) approves; the **server** makes a temporary password, shown to the coordinator **once**; forced change at next
  login. No email, SMS or WhatsApp channel. `auth.requestReset` answers "sent" whether or not the number exists, so
  the screen cannot be used to probe who is registered — a wrong number simply produces no request.
- Coordinators reset devotees of their own batches; only the head resets staff logins.
- Delete = anonymise past weeks (`deleted-<hex>`), never drop them.

**Batches** — tag names, never "Level 4/5" (SPS/DPS, BSS, BVS; VL-2, VL-3).
- Class batches on live: SPS, SPS2 (pilot), SPSO, DPS, BSS, BVS, TRD (temple residents, scored on their own TRD card:
  COSATOK's TRD scheme, linear marks, 205 a day, Morning program scored, class attendance recorded but not scored — Phase 22, migration 0065).
- Vedic intakes are numbered (`VL2-51`), closed by a person, not a timer.
- A batch starts the day it is defined; a future start date is refused.
- **Trainings** (ETP, and MTP/FTP later): `ETP-21` = "ETP · Batch 21". Nobody signs up into one — the coordinator
  **enrols** people already in the app (`enrolments`, never `memberships`). Training runs **sideways**: the person
  stays in their own batch and keeps filling its week; finishing moves nobody. Enrolling grants `facilitator_name`
  as **temporary** facilitation (ADR 0010): taken back when the training ends for them (removed, repeat, left or
  qualified); the head makes it **lasting** in Admin › Facilitators until FTP does. Their students then go to the
  head's "Needs a new facilitator" list (ADR 0014).
  Removed ≠ finished: removal ends the card; closing the batch freezes it as a record on the profile.
- A training has no requests, members, group leaders or filling chart. Its coordinator has Batch status
  (Status · Students · Board · Close batch), Students, and Scoreboards.
- One training attendance session per student per week (`training_attendance`), separate from their own batch's.

**The week**
- Daily fields follow COSATOK; **scoring follows the Excel cards** (SPS card; BVS/DPS/BSS card), not COSATOK.
  Negative marks kept; every score capped at 100.
- Part weeks count (decision 45): ≥1 complete day to submit; missing days score 0; at the Monday 9 PM deadline a
  draft with a complete day auto-submits, otherwise MISSED.
- Attendance: the batch's own class day opens it (unset = Sunday). Coordinator's mark beats the devotee's; locks at
  the deadline; after that only the head changes it.
- 9 PM Web Push every day to every active devotee. No other outside messages.

**Facilitation (replicating the Facilitator Dashboard, `../faciliatorDashboard/`)**
- Phases are dated data (`phases`): Gaur (Jan–Apr), Jagannath (May–Aug), Kartik (Sep–Dec). Live: `kartik-2026`.
- One card of eleven lead measures for facilitators AND trainees; a trainee's FTP measure reads "ETP attendance".
  Targets are set by the person. Sadhna is offered from their last submitted week and can be typed over.
- Window: a facilitator's card runs over the phase; a trainee's over their training's dates.
- Bands and net score match the dashboard: 100 / 80 / 50; sadhana : seva : goal = 1 : 1 : 1.
- Scoreboards open on the **finished** week (`focusWeek`), not the one in progress.
- Promotion is measured VL-2 → VL-3 → SPS → DPS → BSS; TRD and BVS are not promoted from. VL-3 → SPS = 50%
  attendance AND ≥4 rounds. A batch with no criteria declares nobody ready.

**Sheets** — paused since 13 Oct (`SHEETS_COPY=off`): the app is the record. The app reads nothing from the
Facilitator Dashboard any more (head, 27 Oct 2026; the 30-min Devotees/NameMap read is retired in Phase 23 P13, the
`registry` table stays as a frozen snapshot). Never hand-fix a stale sheet; never delete the paused modules.
Paused, a change queues nothing (0075: every mirror trigger reads `mirror_switch`, which the schedule keeps equal to
`SHEETS_COPY`). **Resuming = set `SHEETS_COPY = "on"` and deploy**: the next run switches the triggers on and re-copies
every tab whole in one batch — never drain an old queue, never set `mirror_switch` by hand (`docs/INTEGRATIONS.md`).

## Platform limits — Cloudflare free plan, 2,000–5,000 devotees (`sadhana-free-plan`)

- 10 ms CPU per request and per cron run. No per-row database loops over a list.
- **Cost is round trips, not queries.** Batch reads with `db.js reads()`; `scopesOf` runs on every call, so never
  add a hop there. Rows read are the budget; don't trade more rows for fewer hops.
- D1 writes are the tightest limit (Sunday at 5k devotees ≈ 80–85k of 100k). Keep every write keyed.
- Low-end phones: startup JS ≈ 55 KB (budget 60), precache ≤ 850 KB (800 until 28 Oct 2026), no web fonts, no animation libraries.
- A new write action goes in the client `WRITES` list and in the guards (`roles.test.mjs` GATE_OF_RECORD,
  `ownership.test.mjs`). Guards failing on a new action is them working, not an obstacle.

## Building

- Restate the request as behaviour per role: who sees what, and who must NOT. Name every affected role.
- Find what exists first. Server features were complete with only the screen missing (`identity.merge`,
  `profile.trainings`), and a correct function sat uncalled (`trainingOf`).
- Changing a shared helper or gate: grep every call site; list each role it reaches. One gate change hid screens
  from the ETP coordinator and in the same stroke gave Scoreboards to the SPS coordinator.
- Check live data before designing (`npx wrangler d1 execute sadhana --remote`). Live has ETP-21, not the mock's
  ETP-51, and one Vedic intake, VL3-32 (seen 26 Oct 2026). Back up any row before changing it.
- Proving optimisation: response-parity diff against the committed code, refusal paths included.

**The mock must be the server.** Browser checks run against `frontend/src/lib/mock*.js`; a mock that differs makes
them prove the wrong thing (it hid a search matching everyone, a list that never refreshed, the whole student side).
Same shapes, filters and guards as the worker, and a fixture login for every role that uses a screen.

**Screens** (`docs/revamp/DESIGN_SYSTEM.md`)
- Professional on every route, reusing existing patterns. Brand #004fdc / #78a8ff.
- No explanatory paragraphs — the screen explains itself; prose belongs in the contract. Keep only a consequence
  before an irreversible step, or what happens next.
- Responsive at 320, 390, 768, 1024, 1440 — desktop too. Light and dark.
- Bordered lists need inner row padding; fixed columns must fit their widest text or let it wrap.
- Use a component's real API (`Seg`: `options` + `onchange`); `WheelSelect` where options grow.
- Name things for the reader: a trainee's card sits under the training's name, not "Facilitator › My targets".
- Rotating content pauses on hold/hover/focus — never an on-image pause button. Restrained visuals.
- Native browser motion only (View Transitions, CSS springs), gated by tier, lazy.

## Verifying (`sadhana-browser-checks`)

- A new test must FAIL without the fix: revert, run, see red, restore.
- **Test a frozen copy, keep building live.** Browser runs go against a copy of the tree on its own port, never the dev
  server you edit (hot reload drops the pinned clock and detaches pages). Copy `frontend`, `shared`, `tools` **and
  `worker`** (the mock imports `worker/src/cards.js`), link `node_modules`, serve on a free port, run with
  `BASE=http://localhost:<port> OUT=<copy>/frontend/screenshots`. A generator that writes into `src` (`tools/access/map.mjs`
  → `lib/mockfields.js`) is an edit too. Never sit idle waiting for a run. Wait for elements, never sleep.
- Passing checks prove only what they look at. Screenshot every new or changed screen at phone and desktop, and
  sweep for text collisions — the suite was green while the desktop scoreboard overlapped.
- Verify as the person who uses it, on live data, before saying it works.

**Mistakes that recurred (22 Oct 2026) — each cost a red run or a wrong answer:**
- *Guessed shapes.* Fixtures used invented column names, request fields, reply paths and logins (`reopen_requests.by`,
  `resets.approve { login }`, `.data.announcement`, the mock devotee `6000000001`). Read the migration, the registry
  line and the handler's `return` before writing a fixture or a check.
- *Checks that pass on nothing.* A check that passes when its subject is absent proves nothing (the Report rank line
  "passed" with no closed week). Seed what the check is about, then assert it is there.
- *The mock drifting from the server.* Every server change lands with its mock mirror in the same change; field lists
  and capabilities come from the generator, never retyped. When an old test encodes the mock's mistake, the test moves
  to the server's behaviour — never the other way. Probe the mock's real state before writing assertions.
- *Scripted edits that silently did nothing.* `str.replace` on a block that isn't there (a component with no `<style>`)
  changes nothing and says nothing. Every scripted replacement asserts it matched exactly once.
- *Repurposed variables.* Widening a flag (`head` → "head or granted") widened every other use of it in the function.
  Grep every use before changing what a name means; add a new name instead.
- *Old wording after a rule change.* When a rule changes, grep the user-visible strings for the old rule (the
  switch-off toast still said "devotees keep this name" after ADR 0014).
- *Svelte 5 binding to nothing.* `bind:value={f.x}` on an empty `{}` throws `props_invalid_value`: initialise every
  form field, and draw a sheet's contents only while it is open.
- *Budgets.* A new Admin tab inside the shared chunk pushed `staff-Admin` toward its 35 KB budget: new tabs load lazily
  (`{#await import()}`), and the build size is checked before saying done.
- *Copying across trees blindly.* Before copying live → revamp, classify each file (same / my previous version /
  diverged); three-way merge the diverged ones (`git merge-file`); a peer's file is never overwritten.
- *Somebody else's port.* A test run hit another session's server because the port was taken and the backgrounded
  `--strictPort` failure was silent; a `pkill -f "vite --port N"` killed that session's server. Prove the port's owner
  with `lsof` before running; kill only the pid you started.
- *A patch that applied nothing.* Inside `sadhanaRecord-revamp/`, `git apply` and `git apply --check` report success and
  change nothing (git resolves the paths against the prompt/ repo root). Use `patch -p1`, then grep the target.
- *A cached answer replayed as new.* home.staff fills nine cache entries; filing them stamped "now" let a kept
  home.staff overwrite a part changed since (the orphans list after a decision). File parts with the time the whole was
  asked (`seed(key, part, hs.at)`).
- *Status from memory.* Status comes from the shared tracker, and a peer's remaining work is asked, not estimated
  (an estimate of 4–6 h was 30–36 h). Update your own tracker rows as each item lands.

## Releasing (`sadhana-release`)

- **Worker: `cd worker && npm run deploy`** (gated: runs `audit:sql`). **App: `cd frontend && npm run release`**
  (tests, build, size, then proves an open page moves to the new version). Never the raw `wrangler deploy` — it
  goes around the gate, and the ledger then no longer matches production, which blocks every release after it.

**Two kinds of release (the head, 18 Oct 2026)** — the full gate takes 25–50 minutes, so it is kept for what needs it:

| | What counts | How it goes live |
|---|---|---|
| **Bulk** | a new feature, a new screen or route, a migration, anything touching many areas | the full gate: bump `frontend/release-phase.json`, `node tools/release/gate.mjs checks <n>`, then release |
| **Patch** | a fix or adjustment to something already built | targeted tests, then `npm run release` with the phase UNCHANGED — the gate treats it as a fix on top of the live phase |

A patch's targeted tests are the changed piece **plus its parent, its children and its siblings**: the unit and
server suites (fast, always), the browser parts for the screens it changes, the screens those screens open or are
opened from, and every role a shared piece reaches. A change to navigation, scopes, a route gate or a shared
component reaches every role, so it adds `logins` (every role's menu at four widths). When unsure whether
something is a patch, it is bulk.
- Order: Sheets tabs (if copying) → `migrate:remote` → worker → app. Check `wrangler versions list` first.
- On live, confirm the action answers and the screen's chunk holds the code. Lazy screens are
  `staff-<Name>-<hash>.js`; a wrong name returns the 404 page, which proves nothing.
- The first open after a release runs the cached app until it reloads itself; testers close and reopen first.
- Then message every peer session, and copy the change into `sadhanaRecord-revamp/`.

## Test accounts

Coordinator `sps` (holds SPS, SPS2, SPSO, DPS); `etp` (ETP-21); devotee Praveen `6000000303`. Mock logins are in
`frontend/src/lib/mock.js` (master, sps, etp, natvar, devotee `6000000001`). Keep until development ends.
