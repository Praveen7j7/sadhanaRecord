# Historical defect list — verified against the code

**12 October 2026.** The audit brief lists seven defects from earlier reports and says to *verify* rather than
assume. Each is classified below with the evidence that settled it. Read-only: nothing was changed to produce this.

| # | Reported defect | Verdict |
|---|---|---|
| 1 | Likes and comments not persisting | **Fixed** |
| 2 | Announcement share link opens the app, not the post | **Fixed** (corrected 13 Oct — my first verdict was wrong) |
| 3 | Class day not editable | **Fixed** |
| 4 | Edit-name CSS breaking | **Cannot reproduce — code no longer exists** |
| 5 | Frontend/backend validation inconsistency | **Partly addressed; unverified in full** |
| 6 | Login / session restore on a cold start | **Fixed** |
| 7 | Responsive layout on narrow phones and tablets | **Fixed, and now guarded** |

---

### 1. Likes and comments not persisting — **Fixed**

Both are durable tables with real actions behind them.

- `post_likes` and `post_comments` created in `0026_facilitators_posts`.
- `announcements.like` (`roles: ANY, write, noReplay`) and `announcements.comment` in `worker/src/api.js:54,56`.
- Covered by `worker/tests/announcements.test.mjs` and `phase9-posts.test.mjs`.

`noReplay` on the like is correct: liking twice is safe to repeat by itself, so it skips the replay cache.

### 2. Share link opens the app, not the post — **Fixed** *(verdict corrected 13 Oct 2026)*

The deep link exists: `frontend/src/devotee/Wall.svelte:192-194` builds `…/#/wall?post=<id>`, and the shared
WhatsApp message carries it. Opening it scrolls to that post and highlights it; if the person must sign in first,
`sr.return` carries the destination through (`lib/session.svelte.js:30`).

**I reported this as an open defect on 12 Oct and was wrong.** I searched `lib/router.svelte.js` for a route and
`worker/src/index.js` for an `/a/<id>` path, found neither, and concluded it was missing. It is implemented as a
**hash query on an existing route**, which neither search could have found. Caught by prompt-f0's second pass.

**The lesson, kept because it will recur:** a verdict of "absent" is only as good as the shapes you thought to
look for. Of the seven defects, this was the only one judged by absence rather than by locating working code —
and it was the only one wrong.

### 3. Class day not editable — **Fixed**

`classDay` is accepted at sign-up (`auth.signUp`), at approval (`requests.approve`) and on the profile
(`profile.update`, `worker/src/api.js:121`). `coord.js` writes it to `memberships.class_day` when a membership
exists and to `accounts.requested_class_day` when it does not. The UI is in `frontend/src/screens/Profile.svelte`.

### 4. Edit-name CSS breaking — **Cannot reproduce**

No `editName` or `edit-name` class exists anywhere in `frontend/src`. The screens were rebuilt during the revamp
(`docs/revamp/`), so the reported markup is gone. **Not evidence that the symptom was fixed deliberately** — only
that the code it referred to no longer exists. If a name field still misbehaves, it needs a fresh report.

### 5. Validation inconsistency — **Partly addressed; unverified in full**

Real shared validation exists: `shared/scoring.js`, `shared/skills.js`, `shared/places.js`, `shared/exportfields.js`
are imported by both sides, so those rules cannot drift. The client also has `frontend/src/lib/validate.js` with
rules of its own.

**Unverified assumption:** that no client rule is stricter or laxer than its server counterpart. Confirming it
means reading both sides field by field. The architecture is sound — the server validates independently and the
field whitelist in `api.js` rejects unknown keys — so a client/server divergence produces a confusing message, not
a security hole.

### 6. Cold-start login / session restore — **Fixed**

`frontend/src/lib/session.svelte.js` exports `restore()`, called at start-up; the token lives in `localStorage`
under `sr.token` and every reply carries `serverTime`, from which the client derives clock skew so the time gates
agree with the server. `worker/tests/` and the browser checks both cover sign-in.

### 7. Responsive layout — **Fixed, and now guarded**

`tools/browser/verify.mjs` runs its checks at **320, 360, 375, 390, 430, 768, 820, 1024, 1280, 1440 and 1920 px**,
including a dedicated width sweep. 320 px (the narrowest phone) and 768/820 (tablet) are both covered. The suite
reported **1,809 passing checks, 0 failing** in the 07:13 gate on 12 Oct.

This is the strongest guarantee of the seven: it is not a one-time fix but a standing check that fails the release
gate if it regresses.

---

## Note on method

Defects 1, 3, 6 and 7 were verified by locating the implementing code *and* a test or check that guards it — a
defect with no guard can return. **Defect 2 was judged by absence and that judgement was wrong** (see above);
searching for a route and a server path missed an implementation that uses a hash query. Defects 4 and 5 are
reported as *unverified* rather than fixed, because that is what the evidence supports.

**Second pass, 13 Oct 2026.** prompt-f0 re-audited these and found the defect-2 error. Their review notes are
appended at the end of this file.

---

## Review notes — 12 October 2026 (second pass)

A second session re-checked the seven verdicts. Agreement on 1, 3, 6 and 7. Two change:

**2. Share link — the verdict above is wrong; the deep link exists.** `Wall.svelte:192-193` builds
`${origin}/#/wall?post=<id>`; on load an effect scrolls to `#post-<id>` and highlights it (`:195-206`); a signed-out
deep link is kept in `sessionStorage sr.return` with its query (`App.svelte:32`) and restored after sign-in
(`Login.svelte:28-29`). The first pass looked for a `#/wall/<id>` route and a Worker `/a/<id>` path and found
neither, but the feature is a hash *query*, not a route. **Residual limitation:** `announcements.list` returns the
50 newest visible posts (`announcements.js:19`), so a link to an older or expired post shows "That post is no longer
on the wall". New verdict: **Fixed (verified by code reading; not browser-tested in this audit)**, with the
50-post limit as a proposed enhancement (`announcements.get {id}`).

**4. Edit-name CSS** — the rename UI does exist (`Account.svelte:71-84`, CSS `:147`), rebuilt as a full-width row
under the photo. New verdict: **Rebuilt; not reproducible by inspection** (a 320 px screenshot is the only proof).

**5. Validation** — now checked field by field (`FRONTEND_GUIDE.md` §6). Two confirmed mismatches remain:
the **name rule** (client `/^[\p{L} ]{2,60}$/u` in `validate.js:15` vs server ASCII `/^[A-Za-z][A-Za-z .']{1,59}$/`
in `util.js:74` — IAST/Devanagari names pass the client and fail at submit; "A. Kumar" the reverse) and the
password's three extra server rules. Plus one **data-loss defect** found on the way: `Profile.svelte:42` drops
`house/street/landmark` from the server's address and `AddressFields.svelte:14-17` re-splits the one-line address at
the first comma on every Account › Address save. New verdict: **Partly fixed; two confirmed mismatches and one
confirmed defect (P2)**.
