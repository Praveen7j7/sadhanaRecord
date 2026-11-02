# Sadhana Record — Final Feature Matrix (single source of truth for the redesign)

**IYF Delhi · plan of record · 8 October 2026**

**Phases:** see `IMPLEMENTATION_ROADMAP.md`:
- 0 trust and store blockers
- 1 design system
- 2 shell and navigation
- 3 authentication
- 4 devotee core
- 5 leader / facilitator / coordinator
- 6 admin
- 7 motion and interaction
- 8 hardening
- 9 store and rollout

**Priority:** P0 critical · P1 major · P2 enhancement · P3 polish.

---

## A. Existing functional features (CURRENTLY EXISTS)

Full detail: `CURRENT_FEATURES.md`.

- **Accounts:**
  - phone-number sign-up with coordinator approval;
  - login (phone or username) for every role;
  - 30-day sliding sessions; lockout after 5 wrong tries;
  - password reset approved by the coordinator (the head for staff);
  - change password; forced change on a temporary password;
  - self-deletion (devotees) and deletion by staff, pseudonymised.
- **Roles and scopes:** devotee, group leader, facilitator (username login or a linked member), coordinator (per batch), IYF head (master; recovery login).
- **Sadhana:**
  - day form (body, chanting, hearing from a journal, reading from a book list, seva, Chetna, comment);
  - live day score;
  - week-end answers from Sat 18:00; attendance from Sun 00:00;
  - submit Sun 18:00 – Mon 21:00;
  - part weeks (÷ 175); deadline auto-submit or missed (0);
  - reopen by the head (≤ 14 days);
  - fill on behalf (staff, open weeks).
- **Scoring:** two cards (SPS; BVS/DPS/BSS); Body / Soul / Seva / Attendance / Overall; server-side.
- **Reports:** Report (daily calendar, weekly, 12-week trend), History, a week's scores, share a day or week.
- **Hearing and reading:**
  - 324 lectures per journal with Drive links, a heard list, the week stepper bounded to weeks reached;
  - 76 books with PDFs.
- **Group leaders:** a group per batch level; attendance marks; the still-to-submit list.
- **Facilitators:**
  - the canonical list (NameMap sync, on/off, delete);
  - read-only My students, any past week, a day summary per row;
  - TRD for no batch.
- **Coordinators:** requests (registry match, facilitator, class day), board with attendance and the no-class week, members directory, group leaders, filling chart, devotee detail (facilitator/class, inactive, disable, photo, delete, ask to reopen), fill on behalf.
- **IYF head:** overview, all devotees, coordinators, facilitators and access, batches (add/edit), IYF IDs and duplicates, reopens, activity log + slow/failed requests, settings, attendance override, master access.
- **Communication:** the announcements wall (posts, images, pin, expiry, like, comment, share); Web Push (9 PM reminder, new posts, attendance notice); app badge.
- **Data:** D1 is the source of truth; every table copied to Google Sheets (store sheets) + 4 batch view sheets; registry and facilitator sync every 30 min; audit log.
- **There is no:** CSV import or export, print or PDF features, separate role logins, server-side rendering, or monthly forms.

## B. Existing UX features (CURRENTLY EXISTS)

- **Layout:** phone bottom bar + drawer, tablet rail, desktop sidebar, wide cap; container queries.
- **Look and theme:**
  - look tiers High / Balanced / Low (automatic);
  - Automatic / Light / Dark theme (one tap-to-cycle row);
  - warm neutrals, area accents, gold, serif headings; verse carousel;
  - glass on floating chrome by tier.
- **Motion and interaction:**
  - view-transition crossfade;
  - press feedback;
  - hover only on mouse devices;
  - focus rings; skip link; focus on the page title;
  - live regions; native dialog sheets; the phone's Back closes them.
- **Controls:** wheel pickers; time picker with "same as last time"; segmented controls.
- **Feedback and data safety:**
  - skeletons, Refreshing, "Still working…", the 15 s timeout;
  - empty states with reasons;
  - error banners with Retry;
  - Undo toasts;
  - leave guard on the Day and Week;
  - offline drafts in IndexedDB; the offline bar;
  - kept Home and sign-in offline;
  - honest STALE handling.
- **Navigation:** keyboard shortcuts (g + key, `/`, Ctrl/⌘K, `?`); Go to… search (staff).
- **App behaviour:** install prompt; update without losing unsaved work; old release files kept online; share sheet with WhatsApp and copy fallbacks; vibration on save, submit and attendance (Android).
- **Quality:** automated contrast tests; the release gate; 1,665+ browser checks; device checks.

## C. Proposed UI improvements

1. **D1 colour system:** one brand/action colour (lapis + gold); area markers only. **P1**, phase 1. *(IYF sign-off.)*
2. **Component token layer;** radius update; spacing rhythm; tabular numbers; one overline per page. P1, phase 1.
3. **Status chip vocabulary:** Submitted / **Filling** / Not started / Missed / Reopened / **Missing (day, amber)**. **P0/P1**, phases 0–1.
4. **Viz colours fixed per category** (Body, Soul, Seva, Attendance, Overall) everywhere. P1, phase 1.
5. **One hero per screen;** new blocks: Status block, **Needs you** card, Scope strip, **Darshan card**. P1, phases 4–6.
6. **Horizontal meters** replace the paged bar carousel; sparklines in staff rows. P1, phases 4–5.
7. **Sign-in:** desktop split screen with darshan; calm pending page; auth layout for the forced change. P1, phase 3.
8. **Darshan system:** Welcome, sign-in panel (desktop), Home card merged with the verse, festival overrides, pending card; WebP pipeline; rights first. P2, phases 3–4 and 7.
9. **Desktop list + detail** for Board, Members, Requests and My students; context columns instead of empty width. P1, phase 5.
10. **Destructive actions** in a ⋯ menu with consequence-stating sheets; "Danger zone". P1, phase 5.
11. **Account as rows that open sheets** (not a 2,900 px page); role-specific How to use. P2, phase 2.
12. **Admin:** Decisions + System health + Batches table; 6 sidebar entries. P1, phase 6.

## D. Proposed UX improvements

1. **The Phase 0 trust fixes** (see `IMPLEMENTATION_ROADMAP.md` §2, phase 0). **P0**.
2. **Role bar rule;** Group on the leader's bar; head+devotee keeps Requests and Admin. **P0/P1**, phase 2.
3. **One place for each thing:** bell + one teaser; one Requests inbox; one week-summary definition; no navigation lists on Home; no duplicate quick actions. P1, phase 2.
4. **Three-slot Home for every role.** P1, phases 4–6.
5. **Missing past days in amber;** "3 days to fill"; Week readiness checklist. P1, phase 4.
6. **Day form:** bottom bar hidden; honest Save states; "Same as yesterday"; minute steppers; section ticks. P1/P2, phase 4.
7. **Offline auto-send of pressed Saves** with sync states; "Send all now". P1, phase 4.
8. **Facilitator "Needs you" with plain reasons;** opens on My students. P1, phase 5.
9. **Coordinator needs-action board;** mark all present; people to nudge; Requests with age. P1, phase 5.
10. **Sign-up in 4 steps with a draft;** a Forgot page that explains; consent and privacy at sign-up. P1, phases 0 and 3.
11. **First-run guide;** Monday 6 PM deadline reminder. P2, phase 4.
12. **Wording:** the naming table, dates in full, plain errors, configured times. P1, phases 2 and 8.

## E. Proposed interaction features

- Shared-element transitions; direction-aware page motion; spring easing. P2, phase 7.
- Count-ups; chart draw-ins; FLIP list changes; changed-row glow on live refresh. P2, phase 7.
- Swipe between days, weeks and devotees (with ‹ › buttons); long-press quick actions on staff rows. P2, phase 7.
- Optimistic attendance; prefetch on press. P1, phase 7 (could be earlier).
- Keyboard: `j/k/p/a/Enter` on boards; a shortcuts sheet on `?`; `a/r` with confirm on Requests. P2, phases 5 and 7.
- Hide-on-scroll bar; scroll-driven title condense (CSS). P2, phase 7.
- Success moments (Save check; Submit ring); a failed-submit haptic (Android). P2, phase 7.
- Sheet snap points; swipe-to-dismiss toasts. P3, phase 7.

## F. Proposed accessibility features

44 px everywhere (**P0**) · meters instead of hidden-data carousels · "Show as table" · focus the first invalid field + a count · full-contrast submitted rows · `prefers-contrast` + `forced-colors` · text size 100/112/125% · 200% zoom and long-string tests · table semantics + `aria-sort` · `lang` on verses · darshan alt text · TalkBack and VoiceOver passes · axe in the suite · notification-switch timeout. Phases 0, 1, 4, 5 and 8.

## G. Proposed performance features

Startup CSS split · skip the splash for returning users · JS back under 55 KB · images lazy, sized and low priority, never critical-path (except the Welcome band) · `unreadCount` in `home.get` · one shared week summary · privacy-friendly counters · `navigator.storage.persist` · live refresh only near the deadline · Lighthouse mobile ≥ 95. Phases 0, 4 and 8.

## H. Proposed SEO features

Per-route `document.title` · `robots.txt` · `sitemap.xml` · canonical (with the domain) · public privacy page · titles and descriptions for the public static pages · optional JSON-LD as a static file. Phases 0 and 8.

## I. Proposed mobile features

Bottom bar hidden on the Day editor · thumb-reach primary actions in sticky bars · swipe navigation · long-press · app shortcuts (manifest) · contact picker (Android) · keyboard-aware layout (exists; keep) · no orientation lock · haptics on completion and error only. Phases 4 and 7.

## J. Proposed advanced features

Darshan system with festival calendar overrides · time-of-day greeting and wash · status-tinted hero · "what changed since you last looked" · facilitator attention reasons (server aggregate) · coordinator batch health · IYF head system health · offline sync states. Phases 4–7.

## K. Optional / experimental features

TV hall display `#/hall/<batch>` · glass hero (High) · Welcome parallax · drifting Welcome gradient · evening-toned darshan preference · Hindi · passkeys · contact picker · a ≥ 1600 px context column · the LMS / knowledge base (separate proposal).
