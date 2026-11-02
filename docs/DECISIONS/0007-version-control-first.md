# ADR 0007 — Put `sadhanaRecord/` under git before any structural work

**Status:** proposed (P0)

## Context
The parent folder is a git repository with a single commit (`phase0`); `sadhanaRecord/` is entirely untracked
(`git ls-files` lists 29 files, none of them this app). Rollback today means a previous Cloudflare version; code
review, blame, bisecting and a CI pipeline are impossible; the `-phase5`, `-phase6` and `-revamp` sibling copies
exist because there are no branches.

## Decision
Commit this tree as is (one commit, "baseline 12 Oct 2026"), with a `.gitignore` for `node_modules`, `dist`,
`.wrangler`, `.vite`, `.env*.local`, `.dev.vars`, `loadtest/out`, `tools/brand/esr`, screenshots. Replace the sibling
copies with branches once their content is merged or discarded. The 118 MB `public/darshan/` folder goes in with
Git LFS or a documented exception; decide before the first push.

## Consequences
- Every later phase in the roadmap assumes a branch, a diff and a reviewable change.
- The hard-linked `docs/` folders must be un-linked first (write a copy, delete the link) or git will see one file.
- Secrets check: `worker/.dev.vars` and `frontend/.env.production.local` must be ignored before the first commit.
