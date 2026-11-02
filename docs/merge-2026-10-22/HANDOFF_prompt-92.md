# prompt-92 handoff — 22 Oct 2026, session closed

**The build is finished in both lanes. The next step is the release, done by one fresh session.** The release steps
are in `MERGE_NOTES.md` §0 and §4 (prompt-5b's file, next to this one). This note records only what prompt-92 leaves behind.

## State

- **Live tree:** `sadhanaRecord/`, commits up to `b6b3b75`. The last code is `8ff6e0a`: the sign-in lines, #10 list+detail,
  batch level from the row, and the Home cache fix.
- **Revamp:** holds all of `8ff6e0a`, copied or three-way merged, with each change confirmed by grep. Login.svelte and
  auth.css went in as patches applied by prompt-5b. The Board renames (BatchStatus, FacilitationBoard) are done in
  the revamp, and live's old `Board.svelte` and `Board2.svelte` are deleted after the copy (MERGE_NOTES §4).
- **Tests:**
  - Revamp: client 463/463; home-staff 14/0.
  - Live browser parts, after the fixes:

    | Part | Result |
    |---|---|
    | admin17 | 72/0 |
    | master | 36/0 |
    | coord | 139/0 |
    | design | 27/0 |
    | access15 | 16/0 |
    | dlane | 23/0 |
    | welcome | 33/0 |
    | oct9 | 10/0 |

- **The full browser suite was stopped on purpose.** Its frozen copy predated the last two fixes. The release gate
  (`tools/release/gate.mjs checks 20`) runs the whole suite on the merged tree, so that run is the one that counts.
  Nothing of prompt-92's is running, and every test port (5220–5229) is free.

## Before the gate: prompt-5b's open reds (MERGE_NOTES §3b)

prompt-5b closed with these still red in the revamp. Fix them on a fresh freeze BEFORE the gate:
- B2: "local draft removed after the save" (likely the check's timing; still to be proven)
- p7 day-swipe (possibly C4's router wait)
- Hearing step, Account pencil, oct7, and tiers 3D wheel: not yet diagnosed
- C4's full browser run (`logins`, `nav`) is still owed

## Release order (the head's rule: ONE gate, ONE deploy)

1. Merge the lanes per MERGE_NOTES §0–§4 (the revamp is the superset). Copy revamp → live, then delete Board.svelte and
   Board2.svelte in live.
2. Full suite + `node tools/release/gate.mjs checks 20` (release-phase.json is already 20). Run it on a frozen copy:
   `scratchpad freeze.sh` now excludes tools/devices (12 GB), tools/video and tools/store.
3. Check `npx wrangler versions list` against the file times.
4. `cd worker && npm run migrate:remote` (0059, 0060, 0061), then `npm run deploy` (gated by audit:sql), then
   `cd frontend && npm run release`.
5. Smoke test on live, write the release record, and message every peer session (ListAgents).

**CLAUDE.md:** live's `sadhanaRecord/CLAUDE.md` is newer than the revamp's. It has three more "Mistakes that recurred"
lines, so keep live's when copying.

## Traps learned today (also in sadhanaRecord/CLAUDE.md → "Mistakes that recurred")

- `git apply` (and `--check`) inside `sadhanaRecord-revamp/` reports success and changes nothing. Use `patch -p1`, then grep.
- A composite answer split into cached parts is filed with the time it was asked (`seed(key, part, hs.at)`).
- On desktop, Staff and IYF IDs show the chosen person's actions as panel buttons, not the ⋯ menu.
