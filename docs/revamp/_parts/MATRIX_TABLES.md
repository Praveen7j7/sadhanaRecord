
---

## Final route matrix (every route)

**Legend:**
- **Resp.** = responsive change;
- **Perf** = budget impact (L = low, M = medium) or a positive effect;
- **SEO:** "noindex" means signed-in app pages, not crawled.

**Full per-route detail:** `ROUTE_BY_ROUTE_REVAMP.md`.

| Route | Role | Current purpose | Current problems | UI changes | UX changes | Resp. | Motion | Accessibility | SEO | Perf | Priority | Phase |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Splash | all | Launch screen | Held ≥ 1.4 s even for returning users | Keep the emblem splash, brand lapis + gold | Skip for returning signed-in users | — | Fade | — | — | **+ (LCP)** | P1 | 0/8 |
| `#/welcome` | public | Entry: Login / Create account | Tiles look clickable, do nothing; footer repeats the lockup | Darshan band/panel; plain icon row; brand D1 | "Sign up in 3 minutes · your coordinator approves you" | Phone band 200 px; desktop 50/50 split | Image fade; optional parallax (High) | Image alt; contrast via panel | Title/description/OG | Image ≤ 40 KB, low priority | P2 | 3 |
| `#/login` (+ states) | all | Sign in | Pending shown as an error; tagline orphan; generic | Split screen (desktop) with darshan; trust line | Calm state messages; Enter submits; autocomplete hints | No image on phones | Button busy only | Errors under fields + focus | Title | 0 KB on phones | P1 | 3 |
| Pending approval (login answer) | pending | Tells the user to wait | Red error + live form | Status page + small darshan (#17) | "Check again", details shown | All widths | Fade | Info role | — | 320w image, optional | **P0** | 0/3 |
| `#/signup` | public | Ask to join | ~2,000 px single form; no optional marks; card width differs | 4 steps, progress, draft; desktop panel "what happens next" | Optional fields marked; consent + age rule | Steps full-screen on phones | Step slide by direction | Focus to the first error per step | Title | Lazy step code | P1 | 0/3 |
| `#/forgot` | public | Request a reset | Asks for a new password first, no context | One screen, explanation first | Says who approves and when | — | — | — | Title | — | P2 | 3 |
| `#/change-password` | signed in | Change; forced on a temporary one | Forced view shows the whole app chrome | Auth layout when forced | Reason line; Log out link | — | — | — | noindex | — | **P0** | 0/3 |
| Not found / Not available | all | Error screens | Area eyebrow; generic | No eyebrow; role Home action | — | — | — | — | — | — | P3 | 2 |
| `#/home` (devotee) | devotee | Today, week, quick links | Today and Week counts duplicated; missing days look like future days; notices ×4; verse card long | Three slots: status block, needs-you (leader/facilitator), darshan + verse card | "3 days to fill", one primary action | 1 col phone, 2 col ≥ 600 | Count-up, chip fill, Today→week shared element | Missing = amber + word | noindex | Image lazy ≤ 45 KB | P1 | 4 |
| `#/week`, `#/week/<w>` | devotee | Week: days, week-end, attendance, submit | Gaps only after Submit; attendance looks selected before Sunday; back arrow on a tab | Readiness checklist on top; one week-end card | Honest attendance state | Desktop: days left, checklist right | Ring advance; submit moment | Checklist links to fields | noindex | L | P1 | 4 |
| `#/day/<w>/<d>` | devotee | Fill one day | "Saved ✓" untouched; two floating bars cover ~150 px; desktop 2-column mismatch | Section ticks; minute steppers; single column (desktop ≤ 720) | Same as yesterday; honest Save; late-day banner | Bottom bar hidden on phones | Save check; swipe days | Focus the first error, count | noindex | ≤ 1 KB lazy | **P0**/P1 | 0/4 |
| `#/history`, `/history/<w>` | devotee | Past weeks | Blank page for open weeks; overlaps Report | Folded into Report › Weekly; route redirects | — | — | Row → week shared element | — | noindex | − (less code) | P2 (blank: P0) | 0/4 |
| `#/report` | devotee | Calendar, weekly, trend | Past days without state; tiny legend; carousel bars | Insight sentence; meters; missed days; larger legend; toggle first | Share stays | Desktop: chart beside calendar | Draw-in; month slide | Show as table | noindex | L | P1 | 4 |
| `#/hearing` | devotee | Journal | Lesson week vs calendar week confusion; wrong tab lit | "Continue" row; "lesson week" naming | — | Width aligned | Week slide | — | noindex | L | P2 | 4 |
| `#/reading` | devotee | Books | Chips run off-screen on phones | Edge fade or wrap; current book from the server | — | — | — | — | noindex | L | P2 | 4 |
| `#/learn` | devotee | Old redirect | — | Keep the redirect (future LMS area) | — | — | — | — | — | — | — | — |
| `#/group` | group leader | Group status + attendance | Count ×3; dimmed rows; P/A before Sunday; not on the bar | One summary; full-contrast rows; on the bar | Nudge everyone; mark all present | — | FLIP rows; live glow | Contrast fix | noindex | L | P1 | 2/5 |
| `#/my-devotees` | facilitator | Students list | Alphabetical, no reasons; Draft vs Filling; empty Home | Needs you / Filling / Submitted; reasons; sparklines; dot legend | Opens here for facilitator-only logins | Desktop columns (last filled, trend) | Glow; FLIP | Reasons in words | noindex | +server aggregate | **P0**/P1 | 0/5 |
| `#/my-devotees/<l>`(`/<w>`) | facilitator | One student, any week | Deep link "This week" broken; duplicate week pickers; carousel hides areas | Summary (4-week averages), sparkline, meters, misses bolded | Pickers removed (list only) | — | Row → student | Meters readable | noindex | L | P0/P1 | 0/5 |
| `#/home` (coordinator) | coordinator | Waiting + tools | Tool link lists; no batch health | Needs you (with age) · This week per batch · People to nudge · Birthdays | No navigation lists | — | Count-up | — | noindex | L | P1 | 5 |
| `#/batch` (Status) | coordinator, head | Board + attendance | Counts include inactive (P0); small targets; mixed actions per row | Needs-action first; whole row; 44 px P/A; inactive collapsed; ⋯ for Fill | Mark all present (Save + Undo); keyboard | Desktop list + detail | Live glow near the deadline | Targets 44 px | noindex | Live refresh near the deadline | **P0**/P1 | 0/5 |
| `#/members` | coordinator, head | Directory | Delete in rows; heavy filters | Filter sheet with count; ⋯ menu | Destructive actions behind confirm | List + detail | — | — | noindex | L | P1 | 5 |
| `#/leaders` | coordinator, head | Groups | ✕ without confirm; appoint above groups | Groups first; confirm/Undo for take-out | — | — | FLIP | Labelled ✕ | noindex | L | P2 | 5 |
| `#/stats` | coordinator, head | Filling chart | Paged day bars; duplicate tiles | 7 thin bars; trends only; missed weeks with actions | — | — | Draw-in | Show as table | noindex | L | P2 | 5 |
| `#/requests` | coordinator, head | Sign-ups + resets | Tall cards; no age; reopens elsewhere; cut-off names | Queue + detail; age; full dates; reason for the pre-selected match | One inbox incl. reopens; focus moves to the next | Desktop list + detail | Card leaves, next rises | — | noindex | L | P1 | 2/5 |
| `#/devotee/<l>` | coordinator, head | Devotee detail + actions | Destructive buttons stacked; contact ×3 | Contact · Sadhana · Manage · Danger zone | Consequence-stating sheets | Desktop detail pane | — | — | noindex | L | P1 | 5 |
| `#/devotee/<l>/week/<w>` | coordinator, head | Read a week | Carousel hides areas; no prev/next | Meters; prev/next week | — | — | Swipe weeks | — | noindex | L | P2 | 5/7 |
| `#/fill/<l>/week/<w>`, `/day/…` | coordinator, head | Fill on behalf | Title cut; "your"; "Saved ✓" untouched; "Back to…" tiny | Pinned devotee banner; honest Save | "their" wording | — | — | 44 px | noindex | L | P0/P1 | 0/5 |
| `#/home` (IYF head) | head | Waiting + admin links | 7-link list; no health | Decisions · System health · Batches table | — | — | Count-up | — | noindex | L | P1 | 6 |
| `#/overview` | head | All batches | Unlabelled sparkbars; empty batches equal weight | Batches table, worst first | — | Table on desktop, cards on phones | Draw-in | Table semantics | noindex | L | P1 | 6 |
| `#/devotees`, `#/groups` | head | All-batch Members / Leaders | Duplicates of `/members`, `/leaders` | Merged with a scope picker (routes kept) | — | — | — | — | noindex | − | P2 | 6 |
| `#/coordinators` | head | Staff accounts | Disable in rows; no last active | ⋯ menu; last active | — | Table/list | — | — | noindex | L | P2 | 6 |
| `#/facilitators` | head | Names + access | Offered badge = toggle; TRD cryptic | One state control; "TRD (temple resident)" | — | — | — | — | noindex | L | P2 | 6 |
| `#/batches` | head | Batches | **Add batch journal bug (P0)**; "SPS · SPS"; no-coordinator neutral | Warning for no coordinator; member counts | — | — | — | — | noindex | L | **P0**/P2 | 0/6 |
| `#/ids` | head | IYF IDs | Opens empty; no counts | Counts on the segment | — | — | — | — | noindex | L | P2 | 6 |
| `#/reopens` | head | Reopen decisions | Outside Requests | Merged into Requests (route redirects) | — | — | — | — | noindex | − | P1 | 2 |
| `#/activity` | head | Audit log | Phone numbers; telemetry jargon; before/after on every row | Names; grouped by day; expand row | Telemetry → health card | — | New entries slide in | — | noindex | L | P1 | 6 |
| `#/settings` | head | System settings | Hard-coded times; native selects; Undo enabled with no changes | Wheels/TimePicker; configured times | — | — | — | — | noindex | L | P2 | 6 |
| `#/wall` (`?post=`) | all | Announcements | No report/block (store); bell shown on its own page; eyebrow | Quiet Like; Report; hide-a-person (head) | Community rule before the first comment | — | New posts slide in | — | noindex | L | **P0** (store) | 0 |
| `#/account` (`?f=howto`) | all | Profile + settings | 2,900 px; "Checking…" stuck; devotee fields for staff | Rows → sheets; role How-to; text size | Hide irrelevant fields by role | — | Theme reveal | Switch timeout | noindex | L | P1/P2 | 2 |
| Go to… | staff | Command search | — | Recent devotees; actions | — | — | — | — | — | L | P3 | 7 |
| App shell (bars, sidebar, drawer, bell, offline bar, toasts) | all | Navigation frame | Duplicates; overflow at 860 px; desktop tabs; Back on tab roots; badge/bell wrong | One entry per area; sidebar scroll; tabs only on phones; Back on child pages only | Role bar rule | 3 nav forms | Direction slide; hide-on-scroll | Landmarks | — | L | **P0**/P1 | 0/2 |
| `/privacy.html` (NEW) | public | Privacy policy | Missing (store blocker) | Same style as delete-account | Linked from Welcome, Sign-up, Account | — | — | — | Indexable | 0 | **P0** | 0 |
| `/delete-account.html`, `/404.html` | public | Static pages | — | Brand D1 | — | — | — | — | Canonical/robots | 0 | P3 | 8 |
| `#/hall/<batch>` (NEW, optional) | staff screen in a hall | TV display | — | Read-only board + darshan + verse, 10-foot type | No personal scores | TV only | Gentle rotation | Large focus | noindex | Separate chunk | P3 | after 7 |

---

## Final component matrix

| Component | Current state | Proposed state | Reusable | Token dependencies | Interaction | Responsive | Accessibility | Perf | Priority |
|---|---|---|---|---|---|---|---|---|---|
| Top bar | Title, area tag, Back/menu, search, bell; glass on scroll | Back only on child pages; no eyebrows on shared pages; bell hidden on Wall | Yes | surface-floating, glass, area marker | Hide-on-scroll (phones) | All | Landmark, title focus | L | P1 |
| Sidebar / Menu | Sections per area, all items; overflows at 860 px | One entry per area; own scroll; profile card = Account | Yes | brand, area marker (3 px) | Keyboard | ≥ 1024 | Nav landmark | L | **P0** |
| Bottom nav / rail | ≤ 5 / ≤ 7, rank-ordered | Role bar rule; correct badges | Yes | glass, brand | Press, active pill | < 600 / 600–1023 | 48 px targets | L | **P0** |
| Drawer | Dialog; omits bar items | Keep | Yes | sheet tokens | Back closes | < 600 | Focus return | L | — |
| Tabs | Tablist, roving tabindex; cut on desktop | Phones only; overflow fade + scroll hint | Yes | brand underline | Slide indicator | Phones | ARIA tabs | L | P1 |
| Button | 6 variants, press scale | Brand action; one primary per view; busy keeps the label; disabled never the only signal | Yes | --btn-* | Press/hover/focus/busy | 44 px; 36 desktop-dense only | Focus ring | L | P1 |
| IconButton | 44 px, label required | Keep; badges only for actionable counts | Yes | — | Press | — | Label | L | — |
| **Status block (NEW)** | Today card + Week card | One block: status line, day strip (missing amber), deadline, one action; state wash | Yes | status, wash | Count-up; Today→week | Container query | Words with colours | L | P1 |
| **Needs-you card (NEW)** | — | Merged queues, non-zero rows, amber edge | Yes | warning | Row → target | All | List semantics | L | P1 |
| **Scope strip (NEW)** | Counts on 3 screens | One strip from one definition | Yes | status | Tap → filtered list | All | — | L | P1 |
| **Darshan card (NEW)** | Verse card only | Image + title + verse + credit | Devotee Home only | img tokens | Fade-in | 4:5 / 3:2 | Meaningful alt | Image ≤ 45 KB lazy | P2 |
| Hero card | Today / Waiting | Status block (devotee), Decisions (head) | Yes | shadow-2, wash | — | — | — | L | P1 |
| Content card | Posts, weeks | Keep | Yes | shadow-1 | — | — | — | — | — |
| Stat tile | Muted serif number | Tabular; optional delta | Yes | fs-stat | Count-up | 2/4 columns | — | L | P2 |
| Grouped list / Row | `.list` / `.lrow` | 56 / 48 px; whole row tappable; chevron or status | Yes | divider | Press tint | — | — | L | P1 |
| Board / member rows | `.brow` / `.mrow`; small name links | Whole row target; ⋯ menu; 44 px P/A | Yes | compact density | Long-press (phones), j/k (desktop) | List + detail | 44 px | L | **P0**/P1 |
| Table | 2 admin tables | Sticky header; sortable; `aria-sort` | Yes | compact | Sort | Desktop only | `th scope` | L | P2 |
| Search | Field + debounce | Keep; result count | Yes | — | — | — | Label | L | — |
| Filters | Chips one-line, heavy selects | Chips + a "Filters · n" sheet | Yes | chip tokens | Sheet | Phones: sheet | — | L | P2 |
| WheelSelect / TimePicker | 3D wheel, keyboard, haptic | Keep; also in Settings | Yes | — | Wheel | — | Spinbutton | L | P3 |
| Seg (segmented) | aria-pressed buttons | Keep; neutral when disabled (attendance) | Yes | surface-muted | Press | — | — | L | P1 |
| Checkbox / Radio / Toggle | Card or plain; switch | Keep | Yes | — | Spring toggle | — | Native semantics | L | P3 |
| TextInput / NumInput | Labelled, validation | + minute steppers −/+; optional marked | Yes | input tokens | Stepper press | — | Errors described | L | P2 |
| DateInput / AddressFields | Native / India-aware | Keep | Yes | — | — | — | — | L | — |
| Sheet | One dialog component | Snap points; destructive sheets with the consequence | Yes | r-xl, shadow-3, glass | Rise/spring | Bottom / centred | Focus trap and return | L | P2 |
| Inline confirm | Mixed patterns | Unified: destructive → Sheet; reversible → Undo toast | — | — | — | — | — | L | P1 |
| Toaster | ≤ 3, Undo | + swipe to dismiss | Yes | inverse surface | Rise | Above nav | Live regions | L | P3 |
| Banner | 4 kinds + Retry | One per page; plain "what is safe" text | Yes | semantic soft | — | — | role alert/status | L | P2 |
| Pagination | Show more / Load more | + "12 of 48" | Yes | — | — | — | Count announced | L | P3 |
| Bars (carousel) | Paged on phones, tiny dots | **Meters**, weakest first; tap for value | Yes | viz-* | Draw-in | All | Show as table | L | P1 |
| Trend / Sparkline | SVG lines (Report) | + 12-week sparkline (staff rows) | Yes | viz | Draw-in | — | Summary label | < 1 KB | P2 |
| Ring | Days ring | Keep | Yes | brand | Advance | — | role img | L | — |
| Calendar | Bands | + missing amber dot, missed dashed outline, larger legend | Yes | hi/mid/lo, warning | Month slide | — | Grid semantics | L | P1 |
| WeekPicker | Month + week wheels | Keep on lists; removed on the student page | Yes | — | — | — | — | L | P2 |
| Status chip | Dot + word | The new vocabulary | Yes | semantic | — | — | Word always | L | **P0** |
| EmptyState | Icon, title, text, action | Devotee variants may use a darshan thumbnail | Yes | halo | — | — | — | L | P3 |
| Skeleton / Refreshing / SlowHint | 8 kinds | Keep | Yes | — | Shimmer | — | "Loading…" | L | — |
| Photo / PhotoCrop / PhotoZoom | Exists | Keep | Yes | — | Drag, pinch | — | — | L | — |
| CommandSearch | Screens + devotees | + recent, actions | Staff | — | Keyboard | — | Combobox | L | P3 |
| QuoteCarousel | 9 s autoplay, swipe | Merged into the Darshan card (verse beneath); autoplay off when merged | Devotee | quote | Swipe | — | Pause control | L | P2 |
| Reminder switch | "Checking…" can stick | Timeout + message | Yes | — | Toggle | — | — | L | P1 |
| Splash | Held ≥ 1.4 s | Skipped for returning users | — | brand | Fade | — | — | **+** | P1 |

---

## L. Additional requirements discovered from existing documentation

*(Extracted 8 Oct 2026 from all 19 documents in `docs/` and `brand/README.md`. Read-only extraction; spot-checked against the code. Copied as delivered.)*

