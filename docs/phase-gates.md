# Releasing the modernization phases in order

Phases go live one at a time: **4 → 5 → 6**. A phase may deploy only after the phase before it has been deployed **and verified live**. The rule is enforced by `tools/release/gate.mjs`, and `npm run release` calls the gate itself, so it cannot be skipped by accident.

The gate is not on a timer. It never assumes a phase is live: it checks what production actually serves, every time.

## What "live" means

`tools/release/phases.json` records a phase as `live` only when all of these were true at the same moment:

1. Production serves exactly that phase's build. The `assets/index-*.js` of `https://sadhana-record.iyfdelhi-sadhana.workers.dev/` matches the phase's `dist/index.html`.
2. All the live smoke checks pass:
   - the app answers;
   - the manifest loads;
   - the API answers `meta.get`;
   - sign-in, Welcome, Forgot and Sign-up render;
   - the service worker installs;
   - every lazy screen file loads;
   - there are no page errors.

The record keeps the release id (`index-*.js`), the build id (for example `2026.10.04-2158`), the time and the smoke results.

## When a phase may deploy

Phase *n* may deploy only when all of the following hold:

- phase *n − 1* is recorded `live`;
- production **still** serves that recorded release (nothing else was published in between);
- the live smoke checks pass **now**;
- phase *n*'s own checks passed on **this exact source**. `gate.mjs checks n` runs the unit tests, the build, the size budgets, the whole browser suite (`verify.mjs`) and the phase's own browser checks. It then stamps a fingerprint of `frontend/src`, `public`, `tests`, `shared` and the config. Any later edit makes the stamp stale.

If any condition fails, the gate prints the reason, for example:

```
Phase 5 deployment blocked:
Phase 4 production gate has not been satisfied.
```

It then exits with code 2. It never retries.

## Commands (run from `sadhanaRecord/`)

| Command | What it does |
|---|---|
| `node tools/release/gate.mjs status` | What is recorded, and what is live now |
| `node tools/release/gate.mjs smoke` | The live smoke checks only (read-only) |
| `node tools/release/gate.mjs record 4 --dist frontend/dist/index.html` | Records phase 4 as live, but only if production serves that build and the smoke checks pass |
| `node tools/release/gate.mjs checks 5` | Runs phase 5's checks on this tree; stamps the source if everything is green |
| `node tools/release/gate.mjs check 5` | May phase 5 deploy now? Exit 0 = open, 2 = blocked |

`frontend/release-phase.json` (`{ "phase": 5 }`) tells `npm run release` which phase this tree is:

- **Before publishing**, it runs `check`. If the gate is blocked, nothing is published.
- **After the guarded release** (the open app moves to the new version, and every lazy screen loads), it runs `record` for that phase. The next phase's gate can open only after this.

## Phase 5, step by step

1. **Phase 4 goes live.** Session prompt-c0 releases it from `sadhanaRecord/`. Then, without rebuilding:
   `node tools/release/gate.mjs record 4 --dist ../sadhanaRecord/frontend/dist/index.html`.
   - If this refuses, stop: phase 4 is not verified.
2. **Move Phase 5 onto the released Phase 4.** In `sadhanaRecord-phase5/`:
   - commit the released `sadhanaRecord/` files as a new baseline on a branch;
   - rebase the `phase5` commits onto it;
   - resolve any conflicts;
   - re-check the bundle sizes.
3. **Run the phase 5 checks.** `node tools/release/gate.mjs checks 5`. Everything must be green: 0 failed in `verify.mjs` and in `components.mjs`.
4. **Tell the other sessions** (`ListAgents`, then message each one): Phase 5 is about to be copied into `sadhanaRecord/` and released, so hold edits.
5. **Copy and check again.** Copy the rebased tree into `sadhanaRecord/`, then run `check 5` there. It must say `OPEN`.
6. **Release.** `cd sadhanaRecord/frontend && npm run release`. This runs the gate, publishes, verifies the update and records phase 5 as `LIVE`.
7. **Report** the live `index-*.js`, the build id and the smoke results to every session.
8. **Stop.** Phase 6 follows the same steps with `{ "phase": 6 }`. Its gate stays closed until phase 5 is recorded live.

## Never

- Deploy phase 5 while phase 4 is unverified, or phase 6 while phase 5 is unverified.
- Edit `phases.json` by hand to open a gate. Only `record` (live checks) and `checks` (green suites) write it.
- Rebuild `dist/` between a release and its `record`: the record compares production to that exact build.
