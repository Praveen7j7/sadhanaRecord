# Sadhana Record — where everything stands, 19 October 2026

**Brief by design.** One line per thing, so the gaps show. Live build: app `index-B05nln63.js`, API `f1f6e579`
(phase 18, 18 Oct 20:26 IST). Sources: the route table, `docs/releases/2026-10-18-phase18.md`,
`REPORTED-2026-10-17.md`, `PERFORMANCE.md`, `store-distribution-audit.md`, the icon and DB/API audits, and the code.

**Legend:** ✅ done and proven · 🟡 works, polish or a known gap · 🔴 open, needs work · ⚪ not started / by design absent

---

## 1. The whole app in six lines

| Layer | State | One line |
|---|---|---|
| Server / API | ✅ | 144 actions in 48 modules, 55 suites · 2,913 assertions green, scan + write audits 0 new |
| Database | ✅ | 57 migrations, D1 at <1 % of the free read budget; round trips halved on the devotee path (17 Oct) |
| UI foundations | ✅ | one route table, one nav model, icon system, empty states, themes, low-end tiers, budgets enforced |
| UX per screen | 🟡 | devotee screens are finished; staff screens are functional but uneven (see §3) |
| Performance proof | 🟡 | sizes measured; **no Lighthouse JSON stored anywhere**, so the "92–98" scores are unverified |
| Distribution | 🔴 | Android TWA project exists, **no iOS shell**, no notification delegate, domain + dev accounts pending |

---

## 2. Cross-cutting status

### UI / UX system
- ✅ **Design system** — area accents (devotee / coordinator / admin), dark mode, reduced motion, system fonts, 24 px stroke icons (47, ~11 B each), `Row` / `EmptyState` / `IconButton` / `Sheet` primitives.
- ✅ **Navigation** — single model for bar (< 600 px), rail, drawer; every item iconed; titles from the route table.
- ✅ **Budgets enforced** — startup JS 56.77 KB / 60, CSS 13.85 / 15, precache 672 / 800 KB. All three **above target** (55 / 13.5 / 30): the next startup import flips WARN to FAIL. 🟡
- 🟡 **Accessibility** — `aria-label` on icon buttons, 44 px targets, screen-reader names on choices; no stored WCAG audit.
- 🔴 **Lighthouse** — three documents quote three different scores; `docs/perf/` does not exist. Run once, commit the JSON.

### Server / API
- ✅ One POST endpoint, action registry with roles and field whitelists; idempotent replies by request id; audit log.
- ✅ Round trips: `auth.me` 8→4, `home.get` 22→10, `week.get` 17→9 (live since 17 Oct, parity-proven).
- ✅ Identity: IYFD per-year issuance, legacy IDs resolve forever, approve + issue in one step (phase 18).
- 🟡 `week.submit` at **9 ms CPU p50 against the 10 ms cap** — the thinnest margin in the app; measure after any scoring change.
- 🟡 PBKDF2 at 10,000 iterations, below current guidance (P-10); raising it risks the CPU cap. Decide, then measure.

### Database / data
- ✅ Keyed writes everywhere; schema-derived scan audit; `audit-allow.mjs` with reasons; Time Travel + weekly export.
- ✅ Live usage 36.6 k rows read / 553 written a day — nowhere near limits.
- 🟡 Sheets copy **paused** since 13 Oct; sheets are frozen snapshots and nobody has been told in-sheet.
- 🟡 Write ceiling: Sunday at 5,000 devotees ≈ 80–85 k of 100 k — fine today, the first limit to hit at scale.
- ⚪ No LMS / training tables beyond `enrolments` + `training_attendance`; LMP architecture is a proposal only.

### Testing
- ✅ Server 55 suites, client 435 tests, browser gate 1,847 checks across etp / coord / master / devotee / logins, 180-view collision sweep, 11/11 live smoke.
- ✅ The dev mock now uses the batch's class day like the server (fixed before 19 Oct).

---

## 3. Route by route

### Signed-out
| Route | UI/UX | Server | Work |
|---|---|---|---|
| `/welcome` | ✅ refreshed, darshan + quotes, tiers | — | — |
| `/login` | ✅ | ✅ dummy-verify timing, lockout | — |
| `/signup` | ✅ icons added ph18; offers open intakes incl. VL | ✅ masked lookup, no probing | 🟡 verify the VL intakes actually appear on a phone (item 5 not visually confirmed) |
| `/forgot` | ✅ icons ph18 | ✅ "sent" either way | — |

### Devotee (own sadhana)
| Route | UI/UX | Server | Work |
|---|---|---|---|
| `/home` | ✅ kept on phone, 10 hops | ✅ carries `user` now | 🟡 client still calls `auth.me` + `home.get` on every open; one call is possible |
| `/week`, `/day/…` | ✅ Day is the richest screen (414 lines) | ✅ class-day gate correct | — |
| `/history` | ✅ row icons ph18 | ✅ `dayPct` in one call | — |
| `/report` | ✅ | 🟡 P-7: up to six `week.get` per month view | 🟡 batch or pre-compute the month |
| `/hearing`, `/reading` | ✅ | ✅ | — |
| `/wall` | 🟡 largest screen (504 lines); works | ✅ audience in SQL | 🟡 split the file; it is the maintenance risk |
| `/group` (leader) | ✅ | ✅ | — |
| `/card` (targets) | ✅ measure icons ph18 | ✅ | — |
| `/account`, `/change-password` | ✅ Devices list ph18 | ✅ sign out everywhere | 🟡 About shows IYF ID now; confirm superseded ID is never the headline (item 2) |

### Facilitator
| Route | UI/UX | Server | Work |
|---|---|---|---|
| `/my-devotees`, `…/:login`, `…/:week` | ✅ **corrected 19 Oct from screenshots:** grouped by Needs you / Filling / Submitted, ring row, week picker, split view from 1024 px — finished | ✅ | — |

### Coordinator (class batch)
| Route | UI/UX | Server | Work |
|---|---|---|---|
| `/requests` | ✅ approve + issue IYFD in one step | ✅ | — |
| `/batch` (status) | 🟡 router + StaffHome | ✅ | — |
| `/members` | 🟡 custom rows; icon chips added ph18 | ✅ paged, 40 rows | 🟡 render cost on long lists was to be measured — confirm it was |
| `/stats` | ✅ | ✅ 1,584 rows at 2,000 devotees, by design | — |
| `/leaders` | ✅ | ✅ | — |
| `/board` | 🟡 dense | ✅ | 🟡 **corrected 19 Oct:** `Board.svelte` (batch status) and `Board2.svelte` (facilitation board) are two different screens, both rendered from `Batch.svelte`, not a duplication. Only the names mislead; a rename is optional. |
| `/devotee/:login`, `…/week/:w` | 🟡 410-line detail screen | ✅ `devotees.get` crash fixed 17 Oct | 🟡 split the detail screen |
| `/closing` | ✅ Qualified / Repeat / Left ph18 | ✅ fail-first tests | — |

### Coordinator (training / ETP)
| Route | UI/UX | Server | Work |
|---|---|---|---|
| `/students` | ✅ icons ph18 | ✅ enrol, never memberships | — |
| `/scoreboards` | ✅ rank chip ph18 | ✅ focus on finished week | — |
| ETP sidebar section | ✅ ph17 | ✅ | 🔴 **open decision:** a removed / left trainee keeps the facilitator scope; nothing takes it back |

### IYF head (admin)
| Route | UI/UX | Server | Work |
|---|---|---|---|
| `/overview` | ✅ dense by design; same toolbar fix | ✅ `stats.all` 15 statements / 148 rows | — |
| `/devotees` | 🟡 | ✅ | 🔴 **item 4:** class-batch coordinators can still delete accounts; needs a batch `kind` first |
| `/groups`, `/coordinators`, `/facilitators` | ✅ lists/tables on the system's primitives (screenshots 19 Oct) | ✅ | 🟡 the only defect seen: Export, count, primary action and Refresh laid out as 3 separate rows per page — fixed in the revamp 19 Oct (one `.ph-tools` cluster) |
| `/batches` | ✅ Vedic intakes by number | ✅ | — |
| `/ids` | ✅ reworked ph18 (380 lines) | ✅ per-year sequence | 🟡 confirm legacy IDs never shown as headline (item 2) |
| `/reopens` | ✅ icons ph18 | ✅ | — |
| `/activity` | 🟡 | ✅ run log | — |
| `/settings` | ✅ | ✅ | — |

---

## 4. Open items, in the order I would take them

1. 🔴 **Trainee scope after removal** — a product decision, then one server line.
2. 🔴 **Item 4: who may delete** — needs `batches.kind` (class / training), additive, default `class`.
3. 🔴 **Lighthouse baseline** — one run, JSON committed under `docs/perf/`; until then the scores are hearsay.
4. 🔴 **Notification shows "Brave"** — a TWA shell change (`NotificationDelegationService`), new AAB, version code 4. Blocked on the Play upload path.
5. 🟡 **Startup budget at target** — 56.77 / 55 KB; the next feature needs a plan for what leaves the startup chunk (P-8 staff code in precache is the candidate).
6. ~~Mock class day~~ — **done before 19 Oct** (the mock keeps `classDay` on the batch and every call site passes it; item 9 of the 17 Oct report can close).
7. 🟡 **Report month** (P-7) and **one call at open** — both small, both measured, both latency not budget.
8. 🟡 **Split `Wall.svelte` and `DevoteeDetail.svelte`** — maintenance, not user-visible. (The Board/Board2 item is withdrawn: two screens, not one duplicated.)
9. ~~Polish pass on facilitator + admin list screens~~ — **withdrawn after looking (19 Oct):** the screens are on the system's primitives; the one real defect was the per-page toolbar, now one cluster. The status was assigned from line counts, not from the screens — a method error worth not repeating.
10. ⚪ **iOS shell** — does not exist; the store plan (§12 of the distribution audit) is waiting on domain and developer accounts, which are the head's.

---

## 5. Not verified by me today
- That the `/members` render cost was actually measured before the icon chips shipped.
- That item 5 (Vedic intakes at sign-up) looks right on a phone; the server filter is correct.
- Any Lighthouse figure.
