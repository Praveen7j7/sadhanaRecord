# Sadhana Record: frontend (Phase 1)

Svelte 5 (runes) + Vite + Tailwind CSS v4 + vite-plugin-pwa. Built against `../docs/sadhana-api-contract.md`.

## Run
```
npm install
npm run dev        # no VITE_API_URL set: runs on the in-memory mock (~300 ms latency)
npm test           # vitest: api client + mock permission rules
npm run build      # production build into dist/
npm run size       # gzip sizes; exits non-zero if the budget is exceeded
npm run preview
npm run icons      # regenerate PNG icons (pure Node)
```

## Environment
| Variable | Meaning |
|---|---|
| `VITE_API_URL` | Apps Script web-app URL (`.../exec`). Unset = mock mode. When set, `src/lib/mock.js` is not in the build. |
| `BUILD_N` | optional counter for the build id (`YYYY.MM.DD-N`, sent as `app`). |

Mock logins: `master` / `master-pass-1`, `sps` / `sps-pass-12` (SPS, SPS2, SPSO). Pending sign-ups (password `pass-12345`) exist for 6000000310, 6000000233, 6000000255 (SPS family) and 6000000411 (DPS). Registry IDs include KT26-0042.

## Performance budget (devotee-facing initial load, gzip)
JS <= 60 KB, CSS <= 15 KB. Coordinator and master screens are dynamic imports and excluded from the service-worker precache (they are cached at runtime on first use). `npm run size` counts index.html's script and modulepreload entries plus CSS, and fails on inline script/style.

## Security
`public/_headers` sets a strict CSP (no `unsafe-inline`), nosniff and no-referrer for Cloudflare Pages. The service-worker registration is a file (`registerSW.js`). Passwords and tokens are never logged. Token is kept in localStorage key `sr.token`.
