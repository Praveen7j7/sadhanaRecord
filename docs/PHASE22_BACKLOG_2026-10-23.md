# Phase 22 backlog: noted 23 Oct 2026, to be built as one batch when the head says

The head (23 Oct, 17:2x IST): "note this and together we will build as a batch when i will say".
Nothing below is deployed. Live stays at phase 21 (app `index-P60JWOD0`, API `7e5c22c3`) until then.

| # | Item | State |
|---|---|---|
| 1 | Vaishnava Songs: opening a book's PDF lands on Home | **Fixed in both trees, not released** |
| 2 | TRD scoring the COSATOK way | Scheme captured, not started |
| 3 | Hindi songs as in-app text | Waiting for the head: go-ahead and who proofreads |
| 4 | `release.mjs`: the rollback target and the open-app check | Waiting for the head's OK (prompt-53 offered) |
| 5 | Carried over: mock KT26 fixture IDs, F4 (PBKDF2 25k), screen-reader minors | As before |

## 1. Songs PDF lands on Home

- Cause: the installed app's service worker answers every navigation with `index.html` (workbox `navigateFallback`).
  Opening `/songs/vaishnava-songs-*.pdf` in a tab is a navigation, so the app answered it with itself.
- Fix: `frontend/vite.config.js` `navigateFallbackDenylist` gains `/^\/songs\//` (the same in both trees, checked with diff).
- Guard: `frontend/tests/sw-fallback.test.js` reads the denylist and fails if any `.pdf` or stand-alone `.html` in
  `public/` would be swallowed. It passes 7/7; the old list fails it (it misses the PDF).
- Proven on a built copy (vite preview, SW installed and controlling): both PDFs come back `200 application/pdf` from
  the network; an app route is still answered by the SW.
- Still to run at release: vitest, size, verify part `songs`. Tell testers to close and reopen the app once, because
  the old SW keeps swallowing the PDF until the new one takes over.

## 2. TRD scoring: COSATOK's way (the head's answers, 23 Oct)

- Overall = all of the week's day marks ÷ the week's maximum (7 × 205) × 100. Body, Soul and the per-measure columns
  are still filled; a new **Morning program** column is added (migration).
- Class attendance is **not scored** for TRD. It is still recorded and shown.
- Unfilled fields score 0. Chanting not finished the same day scores 0.

| Item | Marks |
|---|---|
| Sleep | ≤ 22:00 → 25 · ≥ 22:30 → 0 · linear between |
| Wake | ≤ 04:00 → 25 · ≥ 04:50 → 0 |
| Chanting finished by | ≤ 07:15 → 25 · ≥ 17:00 → 0 |
| Chanting rounds | linear 0 → 16; 16+ the same day → 10; 0 rounds or not the same day → 0 |
| Day rest | ≤ 60 min → 25 · ≥ 110 min → 0 |
| Hearing | 0 → 0 · ≥ 60 min → 25 |
| Reading | 0 → 0 · ≥ 60 min → 25 |
| Service (daily) | 0 → 0 · ≥ 360 min → 25 |
| Morning program | Mangal Aarti, Morning Class, Darshan Aarti, Prasadam: on time 5 · late 3 · absent 0 |

Day maximum 205 (7 × 25 + 10 rounds + 20 Morning program; "225" in the 23 Oct question was an arithmetic slip — the head
confirmed 26 Oct: "use the COSATOK way, and capping we are already doing"). Per-measure columns = week marks ÷ (7 × the
item's maximum) × 100: ÷ 175 for the 25-mark items, ÷ 140 for the Morning program. Built: `worker/src/cards.js` CARD_TRD,
migration 0065.

Needs: a linear card type in `shared/scoring.js` and `worker/src/cards.js` (a TRD card); `batches.score_card` for
TRD; live marks on the Day form; the mock mirror; tests; the Morning program in Analysis. It is a bulk change: full gate.

## 3. Hindi songs

The Hindi PDF's text uses an old font encoding, so the app shows the Hindi book only as a PDF. Converting it needs a
font-code conversion plus proofreading by a Hindi reader. Waiting for the head.
