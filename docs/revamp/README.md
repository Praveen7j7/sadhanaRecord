# Sadhana Record — Final revamp set (plan of record)

**IYF Delhi · 8 October 2026 · documentation only: no app code, styles or server logic were changed to write it**

This folder is the single plan for the UI/UX revamp before the app-store release. It replaces the phase lists and proposals in the older documents, which now carry a "superseded" note:
- `ux-modernization-proposal.md`
- `pre-store-revamp-review.md`
- the UI parts of `modernization-audit.md`

Every proposal here was checked against the current code, the live build (release phase 10) and our stack: Svelte 5, Vite, Tailwind 4, a PWA, and a Cloudflare Worker + D1. It adds **no new libraries and no web fonts**, and it keeps every existing function and business rule.

## Read in this order

| # | Document | What it answers | Who it's for |
|---|---|---|---|
| 1 | `UI_UX_360_REVAMP.md` | **Why:** the design thinking. Colour strategy, density, sign-in, depth and glass, motion, the darshan image system (the 32 images, where each goes, rotation, config), role experiences, the navigation plan, wording, conflicts and gaps | IYF leaders, designers |
| 2 | `DESIGN_SYSTEM.md` | **How it looks:** the tokens (colour, type, space, radius, elevation, glass, motion, imagery) and every component's states | Whoever builds it |
| 3 | `ROUTE_BY_ROUTE_REVAMP.md` | **What changes where:** every route and every login. Purpose, problems, before and after, the layout per screen size, motion, accessibility, priority and phase | Builders, testers |
| 4 | `FINAL_FEATURE_MATRIX.md` | **The checklist:** existing features (A, B); proposed features (C–K); the route matrix; the component matrix; the 169 requirements found in the older documents (L) | Everyone; tick it off in each phase |
| 5 | `PERFORMANCE_SEO_ACCESSIBILITY.md` | **The limits:** today's measurements, targets, size budgets, cost per feature, accessibility A1–A15, SEO, platform support | Builders, the release gate |
| 6 | `IMPLEMENTATION_ROADMAP.md` | **The order:** 10 phases (0–9, about 18–21 weeks), their dependencies, the decisions IYF must make, the regression rules | IYF leaders, builders |
| 7 | `CURRENT_FEATURES.md` | **What exists today:** features, the UI inventory (forms, dialogs, toasts, states), SEO and auth facts | Reference |

`_parts/` holds the working pieces the documents were assembled from. It is not needed for reading.

## The changes in one page

1. **Phase 0 — trust and store blockers first.** Wrong counts, the wrong badge and bell, "Saved ✓" on untouched days, pending approval shown as an error, the forced password change, sidebar overflow, small tap targets, the privacy page, Wall report/block, and the **Add batch journal-name bug**.
2. **One brand colour: the IYF logo's blue** (with the logo's gold as detail). Role colours become small markers. Status words are the same everywhere ("Filling"; missing past days in amber).
3. **One place for each thing:** one Requests inbox, one week count, one bell, and a role rule for the bottom bar.
4. **Every Home has three slots:** *My day*, *Needs you*, *My scope*.
5. **Devotee core:** an honest Day form, a Week readiness checklist, a Report that explains itself, and offline Saves that send themselves.
6. **Staff workspaces:**
   - "Needs you" with plain reasons;
   - a board ordered by who needs action;
   - list + detail on desktop;
   - destructive actions behind a ⋯ menu and a confirm.
7. **Darshan, used sparingly:** one image a day, the same for everyone. Shown only on Welcome, the desktop sign-in panel, the pending page and the devotee Home card; never on work screens. Images are WebP, lazy and not precached. IYF holds the rights; no credit line. Festivals are announced on the Wall, not by the app.
8. **A compact day form:** Hearing and Reading show only the topic (or book) and its duration; the lists open in a sheet. This applies on every route that fills a day (Phase 0).
9. **Motion last,** on screens that already work. Every effect has a plain fallback and follows the look tiers and Reduce Motion.

## IYF decisions (answered 8 Oct 2026)

| Question | Answer |
|---|---|
| Minimum age | **15** (15–17 need a parent's or guardian's consent under the DPDP Act) |
| Brand colour | **The logo's blue** (`#004FDC`, navy `#002888`, the logo's gold as detail) |
| Address at sign-up | **Stays required** |
| Darshan image rights | **Already held**; no credit line |
| Festival calendar | **Not needed**: festivals are announced on the Wall with a push notification |
| Hindi | **Not needed now** |
| Wall comments in the store apps · privacy text · domain, developer accounts, store name | **At deploy time** (Phase 9) |
| Add batch journal-name bug | **Fixed** in the server code and tests (8 Oct); goes live with the next server deploy |

**Testing (decided 8 Oct 2026):**
- **After each phase:** only that phase's features are tested.
- **At the end:** one full final test, before everything goes live together.
- Phase 0 goes live on its own.
- Details are in `IMPLEMENTATION_ROADMAP.md` §5.
