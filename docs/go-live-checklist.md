# Go-live checklist (before the SPS Group 2 pilot, phase 7)

Things to undo or confirm before real devotees use the app. Add to this list whenever something temporary is created.

| # | Item | Created | Action at go-live |
|---|---|---|---|
| 1 | Test coordinator account `sps` (name entered as "name") | 2 Oct 2026, by the head, during phase 1 testing | Keep the login, but set the real name and batches (SPS, SPS Group 2, SPS Online) and reset its password; or remove it and create the real one |
| 2 | Test devotee account "Praveen", 6000000303, batch SPS, linked to **JN26-0033** (HG Pundrika Vidhyanidhi Pr) | 2 Oct 2026, phase 1 testing | Remove the account. While it is linked, the real JN26-0033 cannot be linked to anyone else (one account per ID): unlink it earlier if that devotee signs up first |
| 2b | Accounts approved before decision 33 (2 Oct 2026) have no facilitator: today only the test devotee Praveen | Set it from the coordinator screen (phase 4) or remove the account |
| 3 | Test rows in AuditLog, Sessions, Memberships, Profiles, RunLog from phase 1–6 testing | phases 1–6 | Remove rows belonging to the test accounts |
| 4 | `master` password | set by the head | Confirm it is the head's own password, not a shared one |
| 5 | Coordinator briefing | phase 1 security review | Tell every coordinator: approve a password reset only after calling the devotee and confirming they asked (anyone who knows a number can request one) |
| 6 | Service-account key file | 2 Oct 2026, in ~/Downloads | Move it to a private folder (e.g. ~/Documents/ticketSystem/secrets/); it is already a Cloudflare secret |
| 8 | Monthly usage check (ongoing) | free-plan decision, 2 Oct 2026 | Workers & Pages › sadhana-record-api › Metrics: if a normal day passes ~50,000 requests, or Logs show "exceeded CPU", move to Workers Paid (US$5/month; no code change) |
| 7 | Source code in git | phases 1–8 | Commit `sadhanaRecord/` (secrets and keys are excluded by .gitignore) |
