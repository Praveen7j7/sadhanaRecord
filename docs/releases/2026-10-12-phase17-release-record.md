# Phase 17 release record — 12 Oct 2026

Gate `checks 17` started 06:40 IST · exit `GATE_EXIT=0` · all 30 suites passed · 2068 assertions

Browser suites: Phase 17 checks green (verify

## Failures recorded

_none — green_

## Carried by this release

- Week view: Body/Soul grouping with indented parts (report.js, Meters.svelte)
- Sign-up consent checkbox centred (controls.css) · sheet/drawer motion --d-3 440/352 ms, desktop dialog on --d-3 (app.css, sheet.css) · Day.svelte sheet teardown follows --d-3
- Darshan: loads once the tier settles; at low battery/data saver a 64 px inline thumbnail shows with zero requests (Darshan.svelte, 17 blurs in darshan.json, tools/brand/darshan-blur.mjs)
- Router: hashchange back to the page being left no longer takes the same-page shortcut mid-transition (router.svelte.js pendingTo; regression test back-guard §2)
- Checks: motion-audit waits for triggers (waitForText); verify fakes a charged battery
- Worker already live: 762fb37b (06:27) then deb581ad (06:36, prompt-4e scheduled() guards); migration 0041 applied

## Published

- live entry `assets/index-5cNJXIF5.js`
- proof: chunks 83 · 'the three below' x1 · 'm-part' x1 · 'dv-off' x1 · darshan blurs x17
- css: the proof grepped `440ms`/`352ms` (x0) but the minifier serves `--d-3:.44s` and `--d-3:.352s` — confirmed present in `index-kwwetzFp.css` at 07:19; the motion change is live


## Ledger

- `npm run release` recorded phase 17 LIVE: `assets/index-5cNJXIF5.js` · build 2026.10.12-0713 · 07:14 IST (gate b751cfd8). The phase 18 gate may open.
