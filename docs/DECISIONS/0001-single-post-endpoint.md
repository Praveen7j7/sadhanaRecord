# ADR 0001 — One POST endpoint with named actions, HTTP 200 envelope

**Status:** accepted (in force since the Apps Script server; kept by the 12 Oct 2026 audit)

## Context
The API began on Apps Script, which offers one `doPost`. The Worker kept the shape: `POST /` with
`{ v, action, token, app, requestId, data }` and a reply `{ ok, data | error, serverTime }`, always HTTP 200
(`worker/src/api.js`, `worker/src/index.js:31-46`). 122 actions exist today.

## Decision
Keep the consolidated endpoint. Do not convert to resource paths or REST status codes. Organise the route table by
module (it already is: each `fn` points at one module) and keep the per-action field whitelist as the first validation.

## Why not REST
- The field whitelist, replay cache and role gate live in one function (`handle()`); a path-based API would need the
  same three things re-expressed per route with no gain.
- `text/plain` bodies avoid CORS preflight on every call — one round trip saved on Indian mobile networks.
- Every caller (app, service worker, dashboard cron, load test) already speaks it; the contract has a version field.

## Consequences
- Monitoring must read `ok`/`error.code`, not HTTP status. The Run Log does.
- The frontend keeps a hand-maintained `WRITES` set that must match `write: true` routes
  (`frontend/src/lib/api.js:6-21`) — a test should enforce it (see `TESTING.md`).
- New domains (LMP) add `program.*` actions to the same table; no new transport.
