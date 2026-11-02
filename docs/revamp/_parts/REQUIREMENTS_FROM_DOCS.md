## ADDITIONAL REQUIREMENTS DISCOVERED FROM EXISTING DOCUMENTATION

I read all 19 docs and `brand/README.md` in full. I did not change any files. I spot-checked a few claims in `frontend/src`: `lib/tier.js`, `lib/nav.js`, `ui/Menu.svelte`, `devotee/Wall.svelte`, `lib/push.js`, `screens/DevoteeHome.svelte`, `app.css`, `index.html`, `package.json` and `public/`. Every other "CURRENT" row comes from the documents only. Rows marked "verify in code" were not checked.

**Abbreviations**
- **MA** = modernization-audit (4 Oct)
- **UXP** = ux-modernization-proposal (7 Oct)
- **PSR** = pre-store-revamp-review (7 Oct evening). Its §8 is the **plan of record** and replaces the order in UXP §11.
- **CF** = current-features (7 Oct; says the code wins over older docs)
- **SAD** = sadhana-app-design (decisions, 2–4 Oct)
- **API** = sadhana-api-contract
- **SDA** = store-distribution-audit (5 Oct)
- **ADP** = account-deletion-plan (5 Oct)
- **SB** = stakeholder-brief (3 Oct)
- **SS** = screens-status (4 Oct; older)
- **P6** = phase6-route-inventory (4 Oct; older)
- **LMS** = lms-knowledge-base-proposal
- **DH** = development-history
- **LTR** = load-test-report
- **LTC** = links-to-check
- **GLC** = go-live-checklist
- **PG** = phase-gates
- **BR** = backup-restore
- **ESP** = sadhana-entry-sheet-plan (26 Sep; replaced)
- **BRAND** = brand/README
- **D##** = a numbered decision in SAD §1

| # | Item | Source (file §) | Classification | Notes |
|---|---|---|---|---|
| **A** | **Visual and brand rules** | | | |
| 1 | Warm neutrals: sandalwood/ivory light (`--bg #f6f2eb`), indigo-night dark (`#110f17`); full token table for surfaces, borders and text | MA §16.2; SS §1; CF §5 | CURRENT | Built in phase 2; check exact hex values in `app.css` |
| 2 | Four area accents stay exactly as they are: devotee lapis `#2c4b8e/#a3bcf2`, coordinator saffron `#a14a08/#f2a25a`, admin wine `#7a2346/#e9a6c0`, sign-in royal `#4b2a86/#c3aef2`; on-accent text ≥ 6:1 | MA §16.3, §24; SS §2 | REQUIRED | An "identity anchor": do not change. `app.css` has the four families |
| 3 | Where the accent may go: active nav, primary button, page overline, icon chips, selected/focus, first chart series, avatar initials, top wash. Never on whole screens, every heading, default card borders or body text | MA §16.3 | REQUIRED | |
| 4 | Neutrals carry at most 2–3% of the accent, so it stays one app | MA §16.3 | CURRENT | `app.css` comment says "at most 3%" |
| 5 | Gold is the shared second accent (rules, quote marks, "today", halo). Gold text only on base surfaces (≥ 4.6:1); `--gold-deco` is decorative only | MA §16.1–16.2 | CURRENT | Verify in code |
| 6 | Semantic colours success/warning/danger/info, each with a 10–14% `-soft` fill. Info is teal, deliberately not blue | MA §16.2 | CURRENT | Clashes with the proposed LMS teal (see conflicts) |
| 7 | Red only for missed and errors. Exception lists get a warm amber left edge, never red | UXP §6.3 | PROPOSED | |
| 8 | Dark mode has 3 tonal steps (1.07 / 1.09 / 1.11) for hierarchy without borders; light-mode shadows are warm-tinted | MA §16.2; SS §4 | CURRENT | |
| 9 | Surfaces: at most **one hero card per screen**; **never a card inside a card**; grouped lists instead of a card per row; plain sections where nothing needs a box | MA §16.4; P6; SS §6 | REQUIRED | The browser checks enforce "≤ 1 main card, no box in a box" |
| 10 | Block types: Hero, Content, Stat tile, Grouped list, Devotional (parchment + gold rule), Notice (soft fill + 3 px bar), Plain section | MA §16.8; P6 | CURRENT (partial) | Staff/admin screens still use old boxes (SS §5); verify in code |
| 11 | Status is shown as dot + word (`Status.svelte`), never colour alone; pills only for counts, scores and tags | MA §16.8; P6; CF §5 | CURRENT | |
| 12 | System fonts only (serif Iowan/Palatino/Noto Serif; sans system-ui); no web fonts | MA §16.7, §24; UXP §6.1, §9; CF §6 | REQUIRED | Serif headings are an identity anchor |
| 13 | Type roles: greeting clamp 28–38; title clamp 21–26 with an 11 px overline; section 17–18/650; body 16/1.5; ≥ 14 px for anything a person must read; ≤ 13 px only for overlines, nav and chips; stats in serif tabular 24–28 | MA §16.7 | CURRENT | Verify in code |
| 14 | `tabular-nums` on aligned numbers; a new 16/22 semibold "status line" style | UXP §6.1 | PROPOSED | |
| 15 | Enforce 8-pt spacing rhythm (8/16/24/32) and remove 12/14/18 | UXP §6.2 | PROPOSED | MA says 4 px tokens already exist |
| 16 | Radii: controls 12, cards/groups 18–20, chips and nav fully round | MA §16.11 | CURRENT | Verify in code |
| 17 | Glass only on floating chrome (top bar, nav, sheets, drawer) and only by tier. Never on lists, forms, charts or data cards; no "glass everywhere" | MA §16.5; UXP §6.4, §11, §12D | REQUIRED | |
| 18 | Optional glass hero: Today card over the darshan image, High tier only, text on an 85%-opaque layer | UXP §6.4; PSR §8 phase 5 | OPTIONAL | Sits uneasily with "no glass on data cards" |
| 19 | Gradients are static and purposeful (page wash, hero diagonal, selected day, parchment quote). Never on every card or button, never animated, never rainbow | MA §16.6 | REQUIRED | The built wash is 10%, not 14–16%, for legibility (SS §5) |
| 20 | Empty states have 4 parts: haloed icon with gold ring, a title in context (never "Nothing here"), when/how it fills, one action | MA §16.9 | CURRENT (partial) | 4 empty states had no reason line; verify they were fixed |
| 21 | Identity anchors to keep: serif headings, gold-ruled login card, IYF emblem, verse quotes, floating bottom nav, admin overview tiles | MA §9.9, §24 | REQUIRED | |
| 22 | Emblem/logo: only the official file (4× Real-ESRGAN upscale), never a redrawn vector. App uses WebP 64–512 px picked by screen sharpness, never shown above its real resolution | BRAND; DH §4 | REQUIRED | Use the `sadhana-brand-logo` skill for any new size |
| 23 | Installed-app icons are the emblem on a royal-purple tile (192/512, maskable); `og-image` 1200×630 for WhatsApp previews | BRAND | CURRENT | Store icons are a package release (SDA §6) |
| 24 | Royal purple before sign-in, role colours after | DH §3; SAD phase 4 | CURRENT | |
| 25 | Brand mark and sidebar stay one colour; no page eyebrows on shared pages; one accent per screen | PSR §4.7 | PROPOSED | Today each sidebar section has its own area colour (`nav.js`) |
| 26 | Deity image rules: never behind text, under blur, cropped through face or feet, flipped or tinted; never on error/missed/delete/warning screens; alt text names the deity; only rights-cleared, credited images | UXP §6.6; PSR §7 | REQUIRED (if built) | |
| 27 | Darshan of the day (Home), Welcome hero image, devotee empty states, share card | UXP §6.6; PSR §8 phase 4 | PROPOSED | Blocked on IYF image rights |
| 28 | Image pipeline: 480/960/1440 WebP + JPEG; not precached; lazy, low priority, after first paint; runtime cache of about 7; none on Low/Save-Data. Originals on Drive, web copies served from the app origin (`img-src 'self'`). Not Drive links, not D1; R2 only later | UXP §6.6 | PROPOSED | |
| 29 | Time-of-day greeting and static wash (dawn gold / day / evening / night) | UXP §7.1; PSR phase 4 | PROPOSED | |
| 30 | Festival / Ekādaśī banners from a yearly IYF calendar file; birthday card on Home | UXP §7.1 | PROPOSED / OPTIONAL | Needs IYF's calendar file |
| 31 | Verse carousel: 46 Vedabase verses, rotated per phone without repeats; parchment card, gold source line. PSR: make the verse card smaller | SAD phase 4; DH §2; PSR §4.1 | CURRENT + PROPOSED | |
| 32 | Status-coloured Today hero: neutral while filling, amber in the last 24 h, green ✓ when submitted | UXP §7.1 | PROPOSED | |
| **B** | **Tiers and performance budgets** | | | |
| 33 | Three look tiers (High / Balanced / Low), chosen automatically from memory, cores, network, battery, Save-Data, reduced transparency and measured frame gaps; smoothed (down after 3 s, up after 20 s) | MA §16.5; CF §5; `lib/tier.js` | CURRENT | |
| 34 | Per-tier treatment: High = glass 70% + blur 16; Balanced = 84% + blur 8, top bar opaque, durations ×0.8; Low = opaque, 1 shadow, flat band, fades only, no view transitions, flat wheel | MA §16.5 | CURRENT | Verify exact values in code |
| 35 | Reduced motion and reduced transparency always win; the Low tier must still look finished | MA §16.5; CF §5 | REQUIRED | |
| 36 | Startup bundle: JS ≤ 55 KB target (60 hard), CSS ≤ 13.5 KB target (15 hard). Now 55.06 / 13.58, just over target. To add to startup, move something out first (welcome/login styles) | CF §9 #8; UXP §9; PSR §5–6 | REQUIRED | |
| 37 | Other budgets: largest lazy chunk ≤ 30 (35 hard); precache ≤ 700 KB (800); FCP ≤ 1.8 s; LCP ≤ 2.0 s; repeat open ≤ 1 s; INP ≤ 100 ms; CLS 0; TBT ≤ 50 ms; 1 call per screen; server CPU ≤ 8 ms; staff board heap ≤ 40 MB | MA §18 | REQUIRED | |
| 38 | Lighthouse mobile ≥ 95 every time (measured in Incognito). Split the startup CSS; returning users go straight to the saved Home with no splash | PSR §6 | REQUIRED / PROPOSED | |
| 39 | Dynamic-layer budget: +3 KB JS / +2 KB CSS, all lazy, nothing in startup. Animate only transform/opacity/colour; run once, only when visible; cut anything over 16 ms/frame on Android Low | UXP §7.1–7.2, §9 | REQUIRED (if built) | |
| 40 | Do NOT adopt Next.js/React/SvelteKit/TypeScript, a motion library, a chart library or web fonts | UXP §7.1, §9, §12D; MA §24 | REQUIRED (not to do) | JSDoc + `svelte-check` is the cheap alternative |
| 41 | Dynamic/static targets per screen (High tier): Home 50/50, Day 25/75, Requests 25/75, Activity 10/90; about 40/60 for a devotee's week. Balanced keeps about 80%, Low about 30% | UXP §7.2 | PROPOSED | Measure on released screens, not assume |
| 42 | Form rule: nothing moves under a finger that is typing or choosing | UXP §7.2 rule 8 | REQUIRED | |
| 43 | Free plan: UI must add no per-request server work. Live refresh every 60 s only on staff boards near the deadline | PSR §5; UXP §7.1 #11; LTR | REQUIRED | |
| 44 | Reference phone is a ₹6–10K Android (2–3 GB) on slow 4G; one real low-end device run before the stores | SAD §2b; PSR §9 #10; MA §19 | REQUIRED | |
| **C** | **Motion** | | | |
| 45 | Motion tokens 120/200/320 ms, one easing curve; press sink 0.97/0.99 + tint; 180 ms page crossfade; sheet 200/160 ms | UXP §7; CF §5 | CURRENT | |
| 46 | Shared-element transitions (day chip→Day, row→devotee, card→board, Today→week); direction-aware slides; spring `linear()` | UXP §7.1 #4–6, §12 B6; PSR phase 3 | PROPOSED | High/Balanced only; crossfade on Low |
| 47 | Count-ups, charts that draw in, staggered entrance (first 8 rows), FLIP on reorder (≤ 50 rows), check drawn on Save, one submit "moment" (≤ 600 ms, once) | UXP §7, §12 B3/B8 | PROPOSED | |
| 48 | No confetti; nothing loops except the splash line (and the hall display); an error flashes once | UXP §7, §7.2 | REQUIRED | |
| 49 | Check each pattern on real devices first (`tools/devices/phone-check.mjs`). iOS ≤ 17 keeps crossfades; Firefox has no scroll-driven effects; every effect needs a fallback | UXP §7.3 | REQUIRED | |
| 50 | Count browser and iOS versions per day for 2 weeks before investing in iPhone-only polish | UXP §7.3, §11; PSR §9 #4 | PROPOSED | Small server change |
| **D** | **Interaction rules** | | | |
| 51 | Explicit Save per day; nothing saved silently. "Same as yesterday" fills a draft that the person still Saves | SAD phase 4; UXP §3.2; PSR §5 | REQUIRED | Replaces SAD §6 autosave |
| 52 | Offline auto-send of Saves the person already pressed (Saved on this phone → Sending → Saved ✓), plus "Send all now" | UXP §12 B4; PSR phase 1 | PROPOSED | Conflicts with today's "nothing sent automatically" |
| 53 | Submit stays online-only; never queue a submit offline | UXP §12D | REQUIRED | |
| 54 | Submit-readiness checklist at the top of Week, each item linked to its field. Before Submit, say "N of 7 days complete", the score cap, and which days are left out | UXP §3.2; SAD D45 | REQUIRED (D45) / PROPOSED (layout) | Today the gaps show only after pressing Submit |
| 55 | Leave guard on unsaved changes; app updates wait while a day is unsaved | CF §3.3, §4.8; SDA §2 | CURRENT | |
| 56 | Fix "Saved ✓" on an untouched day (Day and fill-on-behalf) | PSR §2.1 #6, §4.4 | REQUIRED (P0) | |
| 57 | Never swipe-to-approve. After Approve, focus moves to the next request; `a`/`r` keys with confirm | UXP §3.4 | REQUIRED / PROPOSED | |
| 58 | Every gesture has a button (‹ › for swiping days, weeks and devotees; long-press actions also as buttons) | UXP §4, §12 B7; MA §16.11 | REQUIRED | |
| 59 | Not to build: pull-to-refresh, floating action button, radial pickers, drag-and-drop (except maybe leaders on desktop), breadcrumbs, right-click menus, motion/tilt/magnetic effects, custom pull gestures | MA §17; UXP §4, §12D | REQUIRED (not to do) | |
| 60 | Destructive actions move out of list rows into overflow / a "Manage" disclosure, with a red "Danger zone"; confirm or Undo; inline Undo where reversible | PSR §4.4; UXP §3.4, §12 B12; MA §17 | PROPOSED | |
| 61 | Typed confirmations: deleting a devotee = type the phone; self-delete = password + DELETE | CF §4.3; ADP D4 | CURRENT | |
| 62 | One Sheet component (bottom sheet < 600 px, centred above); tap outside, Esc and Back close it; focus returns; `dismiss={false}` for long forms; no new `<dialog>` or inline confirms | P6; CF §5 | REQUIRED | |
| 63 | 3D wheel pickers for every finite choice (keyboard, reduced motion, haptics), not for content lists. Refine, don't rebuild | MA §17, §24; DH §2 | REQUIRED | |
| 64 | Keyboard today: skip link, focus to title, `g`+key jumps, `/` or Ctrl/⌘K for Go to…, `?` for How to use. Proposed: `j/k/p/a/Enter` on boards, `?` for a shortcuts sheet, hide shortcuts on touch | CF §5; UXP §3.4, §4; PSR §4.7 | CURRENT + PROPOSED | |
| 65 | Haptics only on completion and error (save, submit, attendance; failed submit = double pulse). Never on every tap; iPhone has none, so visuals must stand alone | UXP §4, §5 | REQUIRED | |
| 66 | Hover styles only under `(hover:hover)`; no information that exists only in a `title` tooltip | MA §16.11; P6; SS §4 | REQUIRED | |
| 67 | Optimistic updates with a rollback message (likes already; extend to attendance and toggles); changed numbers count to the new value | UXP §7.1 #3, §12 B5 | PROPOSED | |
| 68 | Filters and chosen week kept in the URL (Members, Board, My students) | UXP §12 B11 | PROPOSED | Hearing and Reading already do this |
| 69 | Refresh on return to the app for boards too; changed rows glow once ("just submitted") | UXP §4, §7.1 #11 | PROPOSED | Home already does this |
| 70 | Hide the bottom bar on the Day editor (only the Save bar floats); hide-on-scroll bar on long lists; move Refresh rows into the header | PSR §4.1, §4.7; UXP §12 B9 | PROPOSED | |
| 71 | 15 s timeout with a clear banner; "Still working…" after 2 s; STALE shows "Updated on another device" | CF §5; API §0 | CURRENT | |
| 72 | Time locks follow the server clock, not the phone | SAD D41; DH §9 | CURRENT | |
| **E** | **Information architecture and roles** | | | |
| 73 | One navigation model: bar < 600 (≤ 5), rail 600–1023 (≤ 7), sidebar ≥ 1024. The phone drawer leaves out what the bar already shows (head, 5 Oct) | CF §3.9; `ui/Menu.svelte` | CURRENT | |
| 74 | Phone bar per role: devotee Home·Week·Report·Account; +group leader adds Group; coordinator Home·Batch·Requests·Account; head Home·Requests·Admin·Batch·Account; head+devotee Home·Week·Requests·Admin·Account | PSR §3.2 | PROPOSED | Today: My group has no bar slot; head+devotee loses Requests and Admin (P0 #3, matches `nav.js`) |
| 75 | Home for every role has three slots: My day / **Needs you** (every queue, non-zero rows only) / My scope this week; then unread teaser, birthdays, verse; **no navigation lists on Home** | PSR §3.2 | REQUIRED (plan of record) | Designed so LMS "continue" can slot in later |
| 76 | One place per thing: announcements in the bell + one teaser when unread; one Requests inbox (with reopens); one shared count definition (active members only); Back only in the top bar | PSR §3.1 | REQUIRED (plan of record) | |
| 77 | Merge the Today and This-week cards into one status block; drop duplicate quick actions | PSR §4.1; UXP §2.1 | PROPOSED | Code still has 6 quick actions incl. History and Notices |
| 78 | One name per thing: Batch status, Filling, My students, Announcements, "waiting for approval"; dates as "7 Oct 2026" / "Wed, 7 Oct", never numeric; batch name, not ID; "TRD (temple resident)" on first use | PSR §3.3 | REQUIRED | |
| 79 | Batch names (SPS/DPS/BSS/BVS), never "Level 4/5". Hearing week called "lesson week" | SAD §7c; API; PSR §4.1 | REQUIRED | |
| 80 | "Page not found" / "Not available to you" screens. Fix query-string admin paths and the facilitator "This week" deep link | CF §3.1, §9 #2–3 | CURRENT + REQUIRED fix | |
| 81 | Admin becomes 6 sidebar entries (People, Staff, Batches, IYF IDs, Activity, Settings); merge All devotees + Members, and Groups + Group leaders | PSR §4.5 | PROPOSED | Overrides UXP's 4-group idea |
| 82 | Coordinators never see the system/admin area | UXP §2.5 | REQUIRED | |
| 83 | UI must follow the role rules: facilitator read-only; coordinator only own batches and can't change staff; nobody approves themselves; group leader only own group, in the window; attendance precedence head › coordinator › leader › no-class › devotee; `master` is the recovery login | CF §2.3; API §8 | REQUIRED | Server enforces; UI must not suggest otherwise |
| 84 | Viewing and filling are separate permissions: facilitator views; coordinator views and fills only the open week; head any week; devotees see no audience or staff controls | SAD D43; API | REQUIRED | |
| 85 | Forced password change uses an auth-only layout (no bar, sidebar or bell) | PSR §2.1 #8 | REQUIRED (P0) | |
| 86 | Pending approval is a calm status page (name, batch, facilitator, "Check again"), not a red login error | PSR §2.1 #7, §4.6 | REQUIRED (P0) | |
| 87 | Hide fields by role: staff Account hides DOB, blood group, class and emergency for team logins; facilitators get no devotee-only fields and a "Sunday: students yet to fill" reminder | PSR §4.3–4.4 | PROPOSED | |
| 88 | How to use: role-specific topics in its own sheet or page; Account settings as rows that open sheets (instead of a 2,900 px page) | PSR §3.1, §4.7 | PROPOSED | D41: no explanatory notes in Account |
| 89 | Facilitator: "Who needs me" grouped Needs you / Filling / Submitted, with plain reasons ("Missed last week", "Down 30 points"); tappable counts; dot legend; drop IYF ID; horizontal meters, weakest first | PSR §4.3; UXP §2.3 | PROPOSED | Needs one server aggregate |
| 90 | Coordinator board: needs-action first; whole row tappable; 44 px P/A; inactive in a footer; Fill in a row menu; "Mark all present" (keeps Save + Undo); batch health strip on Home | PSR §4.4; UXP §2.4, §3.4 | PROPOSED | |
| 91 | Head Home: Decisions inbox + System health (reminder devices with alert at 0, registry age, batches with no coordinator, failed saves, last Sheets copy, duplicates) + batches table, worst first | PSR §4.5; UXP §2.5 | PROPOSED | Data exists (`settings.get`, `runlog.list`) |
| 92 | Group leader: one summary line; submitted rows at full contrast with a muted chip (not dimmed); P/A only from Sunday; "Nudge everyone remaining" via share | PSR §4.2; UXP §2.2 | PROPOSED | |
| 93 | Requests: queue + detail on desktop, request age, full dates, explain why a registry match is pre-selected, no cut-off names | PSR §4.4; UXP §3.4 | PROPOSED | |
| 94 | Status counts must agree everywhere (inactive/disabled must not count as Not started) | PSR §2.1 #2 | REQUIRED (P0) | |
| 95 | App badge includes waiting requests for mixed staff; bell count the same on every screen | PSR §2.1 #4–5 | REQUIRED (P0) | |
| 96 | Desktop sidebar fits at 860 px height; tabs and chips show when more exist | PSR §2.1 #9–10 | REQUIRED (P0) | |
| 97 | 44 px targets everywhere. Known offenders: chart dots (7 px), carousel dots (~5 px), Fill link, name links, "Back to…", `btn-sm` (36 px), 40 px segments; day chips 44 px at 320 | PSR §2.2; P6; UXP §10 | REQUIRED | |
| 98 | No gamification (streaks, points, leaderboards, flames). "Your consistency" bars and "submitted 7 of 8" are fine | UXP §2.1, §12D; PSR §5; LMS §8 | REQUIRED (not to do) | |
| 99 | Wall posts: Like, Comment, Share; no reactions beyond Like; pinch-zoom; Mark all read; one column | SAD D44; UXP §3.6; P6 | CURRENT + PROPOSED | Like is live in `Wall.svelte` |
| 100 | Store UGC controls: Report on posts/comments, head can hide a person's comments, community rule before first comment — or comments off in store builds | PSR §7, §8 Q1 | UNCLEAR | IYF decision |
| 101 | Posts are plain text (links shown as links), never HTML; removed posts are kept and audited | SAD D35; API | CURRENT | |
| 102 | Report: one-sentence insight computed on the phone (no AI); missed days on the calendar; larger legend; Daily/Weekly toggle first | UXP §3.2; PSR §4.1 | PROPOSED | |
| 103 | Hearing "Continue" row; Reading chips must not run off-screen (fade or wrap) | UXP §3.2; PSR §4.1 | PROPOSED | |
| **F** | **Data rules that shape the UI** | | | |
| 104 | Pick from lists, never typed: facilitator (switched-on canonical list), batch, class day, IYF ID (registry search only; devotees never type IDs), lectures and books (typed "Something else" / "Other book" allowed) | SAD D33, §3b, §7c; SB §7; API | REQUIRED | Clean data is the main purpose |
| 105 | No ID of any kind (Aadhaar, voter ID, any number, ID photo, record of an ID check). Phone is the identity; optional face photo with its consent line | SAD D14, §3a; SB §8 | REQUIRED | |
| 106 | Photo: cropped/zoomed on the phone to 400 px JPEG ≤ 150 KB, location data stripped; loaded only when on screen; seen only by the devotee, their coordinator and the head; never in Sheets or group-leader views | SAD §3a; API | CURRENT | |
| 107 | Part weeks (D45): only complete days count (÷ 175); 1 day ≈ 14%; at the deadline ≥ 1 complete day auto-submits; no complete day = Missed, scored 0 everywhere | SAD D45; CF §4.2; API | REQUIRED | Older "all or nothing" text is outdated |
| 108 | Windows: no future days; week-end answers from Sat 18:00; attendance from Sun 00:00 (Saturday class too); submit Sun 18:00 – Mon 21:00. The head can change times, so UI text must use the configured times | CF §8; PSR §4.5 | REQUIRED | Settings text still hard-codes "Monday 9 PM" |
| 109 | Only 2 weeks open, and only Mon before 9 PM; a submitted week is never editable; only the head reopens a missed week (≤ 14 days, starts empty) | SAD D24/26; API | REQUIRED | |
| 110 | Attendance looks neutral/disabled until Sunday; a note when a higher mark replaced the devotee's own; one notification 5 min after a change | PSR §4.1; SAD D41 | REQUIRED | PSR says verify on real data |
| 111 | Field limits: topic required when minutes > 0; ≤ 8 hearing topics; rounds 0–64; minutes 0–600; service 0–999; comment ≤ 500; post 2–80 / 1,000 chars; picture ≤ 240 KB | CF §8; API | REQUIRED | |
| 112 | Hearing has no set pace: no "behind / on track"; only "heard N of 324"; "Suggested" is a hint | SAD §7c | REQUIRED | |
| 113 | Lectures open in Drive (no in-app player). The UI must handle 3 link states: own file, folder ("Open folder" + hint, 53 cases), no link (20). One book has no PDF | DH §4; LTC; API | CURRENT | |
| 114 | Current book saved on the server, so a new phone remembers it | CF §9 #6; UXP §3.2 | REQUIRED (P1 fix) | |
| 115 | Name rule mismatch: app accepts any script, server only ASCII. Allowing Devanagari is undecided | MA §4, §19 | UNCLEAR | Head's decision |
| 116 | Sign-up today: mobile, WhatsApp y/n, name, email (typo hint, never emailed), DOB (age 12–80), blood group, address (required; Delhi districts; PIN checked against state), batch, class day, facilitator, password ×2, emergency contact | CF §3.2; API | CURRENT | Two competing redesigns (see conflicts) |
| 117 | Contact details (email, WhatsApp, address, emergency) are changed only by the devotee; staff can see them | SAD D41; API | REQUIRED | |
| 118 | Password rules: 8–64; refuse phone number, sequences, ~150 common passwords. Proposed: strength hint using the server's own rule list | CF §4.1; UXP §3.1 | CURRENT + PROPOSED | |
| 119 | Resets: approvers see "call first"; Forgot page should say who approves and how the person will know | CF §3.6; PSR §4.6; GLC #5 | REQUIRED | |
| 120 | Every score is 0–100; a missed week shows "Missed · 0%"; fix the blank `#/history/<open week>` page | SAD D29; CF §9 #4 | REQUIRED | |
| 121 | Attendance not markable in reopened weeks (bug) | CF §9 #5; UXP §3.4 | REQUIRED (P0) | |
| 122 | Rounds target ("14 / 16") — rounds are recorded but not scored | UXP §12C; PSR §8 Q3 | UNCLEAR | IYF decision |
| 123 | Night Stay and the 4 principles stay one weekly Yes/No, not daily checkboxes | UXP §12D; SAD D41 | REQUIRED | Changing it is a scoring decision |
| **G** | **Accessibility and responsive** | | | |
| 124 | Automated contrast tests (text 4.5:1, controls 3:1) for every area and both themes; every new token must pass | MA §22; SS §4 | REQUIRED | |
| 125 | axe-core with zero violations at every route and width; TalkBack and VoiceOver passes on the 5 main flows, results recorded in `docs/` | UXP §10; PSR §1, §8 phase 5 | PROPOSED (P1) | Not done yet |
| 126 | In-app text size 100/112/125%; no clipping at 200% zoom | UXP §3.6, §10; PSR phase 5 | PROPOSED | |
| 127 | Focus the first invalid field on a failed Save/Submit and announce the count; "Show as table" under charts; `lang` on Sanskrit/Hindi verse text | UXP §10 | PROPOSED | |
| 128 | Markup fixes: no h1→h3 skips, no `aria-label` on plain divs, no fake `span.btn`, calendar `role=grid` needs rows, % not only in aria-label | P6 | REQUIRED | Older list; verify in code |
| 129 | Area named in words; live regions; native dialogs return focus | CF §5 | CURRENT | |
| 130 | Long-strings check (60-char names, 2,000-char posts at 320 px); no sideways scroll at 10 widths; landscape 740×360 | MA §19 phase 0; SS §6 | REQUIRED | |
| 131 | Layout classes: < 600 / 600–1023 (88 px rail, 2-column Home/Report/Account) / ≥ 1024 (280 px sidebar) / ≥ 1440 (1,280 px cap, ≤ 75 chars per line) | MA §16.10; CF §5; UXP §8 | CURRENT | UXP also proposes a ≥ 1600 third column (P3) |
| 132 | List beside detail on desktop (Board, Members, Requests, My students); tablet side sheet | MA §16.10; UXP §2.4, §8; PSR phase 2 | PROPOSED | Not built |
| 133 | TV hall display `#/hall/<batch>`: read-only, no personal scores, type ≥ 28 px, fullscreen and wake lock allowed only here | UXP §8; PSR phase 5 | OPTIONAL | MA §10 said defer |
| **H** | **Store and PWA** | | | |
| 134 | Privacy policy page `/privacy.html`, linked from Welcome, Sign-up and Account. Must cover consent, purpose of each field, grievance contact and retention (DPDP) | PSR §7, §9 #1 | REQUIRED | Missing: `public/` has only `delete-account.html` |
| 135 | Minimum age: sign-up allows 12+. DPDP needs parental consent under 18 → raise to 18 or add a consent step | PSR §9 #1, §8 Q2 | UNCLEAR (P0) | Legal decision for IYF |
| 136 | Reviewer demo accounts with sample data on a test copy, never live | PSR §7; SDA §5 | REQUIRED | |
| 137 | Own domain before any store build. Manifest `id`/`shortcuts`/`screenshots`; never lock orientation; `assetlinks.json` and AASA; HSTS; Permissions-Policy | SDA §4, §9, §12; MA §10–11 | REQUIRED | `id` done (phase 8); domain not bought |
| 138 | iOS shell: app-bound domains; external links (Drive, WhatsApp, tel, mailto) open outside; shell must not hide that it is web; APNs + native share bridge | SDA §5; UXP §7.3 | REQUIRED (iOS) | |
| 139 | Apple 4.2 mitigation: native push, offline launch, share sheet, in-app deletion, privacy policy, demo account | SDA §5; PSR §7 | REQUIRED | |
| 140 | Store screenshots, feature graphic, listing text from the revamped screens; store name pending ("IYF Sadhana – Daily Sadhana Record") | PSR §7, §9 #11 | UNCLEAR | |
| 141 | Data-safety / privacy labels: phone, name, email, DOB, blood group, address, emergency contact, optional photo, sadhana. Nothing sold | PSR §7 | REQUIRED | |
| 142 | Updates: one web deploy reaches all 4 surfaces; previous release files kept; `/version.json` and an "App <build>" line in Account; N→N+1→N+2 proof before each shell ships; stored IndexedDB shapes must stay readable | SDA §2, §9–10, §12 | REQUIRED | |
| 143 | Notifications: ask once at the first tap + a Home card (dismissible 7 days); install card after first fill; iPhone Add-to-Home hint. The switch's endless "Checking…" needs a timeout | CF §4.7–4.8; API; PSR §4.7 | CURRENT + REQUIRED fix | `push.js` confirms both asks |
| 144 | Proposed: a Monday 6 PM deadline reminder; app shortcuts (Fill today, This week, Report); `navigator.storage.persist` for drafts | UXP §5, §11; PSR phase 1 | PROPOSED | |
| 145 | Device APIs not to use: geolocation, speech, wake lock (except hall display), fullscreen (except photo/hall), orientation lock. Background Sync and Web OTP "not now"; Android contact picker optional | UXP §5 | REQUIRED (not to do) / OPTIONAL | |
| **I** | **Privacy and deletion** | | | |
| 146 | Self-delete for devotees only: section before Log out; lazy sheet (password + DELETE, plain consequences) → clears token, saved user, IndexedDB and caches → Welcome. Staff see an explanation and no button | ADP; API `account.delete` | CURRENT | |
| 147 | Public `/delete-account` page (no inline code; contact iyfdelhi.database@gmail.com); "What happens to my data" in Account; past weeks kept as "Deleted devotee" | ADP; CF §3.8, §7.6 | CURRENT | |
| 148 | Saved data is per login, cleared at logout, never shown to the next person on a shared phone; stale offline screens show "Saved at 8:42 PM · offline" | MA §21; CF §4.1 | REQUIRED | Verify the stale label in code |
| 149 | No emails or SMS; pushes carry no content (the phone asks what to show) | SAD D15, D38; SB §8 | REQUIRED | |
| 150 | Product measurement only as privacy-friendly server counts; no third-party trackers | PSR §9 #4 | REQUIRED (if built) | |
| 151 | Activity log shows names, not phone numbers; before/after on tap; developer telemetry moves to the health card in plain words | PSR §4.5 | PROPOSED | |
| 152 | End date for monthly backup files not set | ADP D3; BR | UNCLEAR | IYF to set |
| **J** | **Sheets mirroring** | | | |
| 153 | Every new table is copied to the store sheets (except password hashes, tokens, photos, push addresses). Build the Sheets tab before the migration; schema changes only add | SAD D39; MA §23; LMS §6 | REQUIRED | Applies to UGC reports, analytics counts, any saved UI preference |
| 154 | Likes counted nightly, not copied row by row; all writes incremental | SAD D40, D44 | REQUIRED | |
| 155 | Corrections go through the app, never by editing the sheet | SAD §2c | REQUIRED | |
| **K** | **Head/owner decisions with dates, and process** | | | |
| 156 | 2 Oct: phone + own password (no Google/email sign-in); no ID documents; English only; pick from lists; batch names; no outside reminders | SAD D1, D14, D15, D33, §2b, §7c | REQUIRED | English-only is now in question (Hindi) |
| 157 | 3 Oct: 9 PM reminder to every devotee every day; Sunday class; attendance levels; contact details only by the devotee; Sheets mirror everything; incremental writes; group leader no longer asked at sign-up (D37) | SAD D37–D41 | CURRENT | |
| 158 | 4 Oct: view vs fill; posts like social media; part weeks; Account sections locked until the pencil is tapped; look always Automatic | SAD D43–45; DH §2; `tier.js` | CURRENT | |
| 159 | 5 Oct: deletion anonymises; drawer leaves out bar items | ADP; `Menu.svelte` | CURRENT | |
| 160 | 7 Oct owner asks: the most dynamic UI that is achievable (Next.js feel) inside the compact app; about 100 deity photos; references = "Apple polish + Linear + Mobbin + Godly + devotional, not flashy" | UXP §6.6, §7.1, §13 | REQUIRED (intent) | Borrowing limits: no Linear dark-only look, no scroll-jacking, custom cursors, preloaders or WebGL |
| 161 | Decisions IYF must make before Phase 0: Wall comments in store builds, privacy text + minimum age, rounds target, domain, image rights, Hindi | PSR §8 | UNCLEAR | |
| 162 | Release gate for every phase: unit tests, size budgets, 1,665+ browser checks, device checks, light/dark × phone/desktop screenshots, the 10-persona route sweep; phases released in order via `gate.mjs`; screenshot approval before visible changes | PSR §8; PG; MA §19 phase 2 | REQUIRED | |
| 163 | Staging run on real-shaped data before the stores | PSR §2.3 | REQUIRED | |
| 164 | Real user testing: 5 devotees + 2 coordinators, 3 tasks each, before and after Phase 1 | PSR §9 #2 | PROPOSED (P0) | |
| 165 | First-run guide (3 skippable cards) + first-week checklist; copy/voice pass with a short voice guide | PSR §9 #5, #9 | PROPOSED | |
| 166 | Narrated walkthrough videos (EN + HI) are re-rendered only once the design is final | DH §6 | REQUIRED (dependency) | |
| 167 | LMS "Learn" area: same app, own lazy chunk, after UX Phase 1–2; KB takes over How to use; ETP/MTP content unknown | LMS §1, §6, §9–10; PSR §5 | PROPOSED | Needs IYF answers (LMS §10) |
| 168 | The dashboard bridge is deferred: no UI should promise that app weeks reach the dashboard | SB §10; LTR §10 | REQUIRED | |
| 169 | No CSV/PDF export in the app; Google Sheets is the export path | CF §4.6 | CURRENT | |

### CONFLICTS BETWEEN DOCUMENTS

| # | Conflict | Source A | Source B | Which is supported (newer doc / code) |
|---|---|---|---|---|
| 1 | **One accent per area vs one accent per screen / one-colour sidebar** | MA §16.3, SS §2, CF §5: four area accents; each nav section in its area colour | PSR §4.7: keep area colours, but brand mark and sidebar one colour, one accent per screen, no eyebrows on shared pages | **Code** follows A (`nav.js` gives each section its own area). **PSR is newer and the plan of record**: keep the four accents, limit to one per screen, make the sidebar one colour |
| 2 | **User "Look" choice vs automatic tiers** | MA §16.5, §19 phase 3: Account › Look = Automatic / Rich / Simple | CF §5 (automatic only); `lib/tier.js`: "the earlier Rich / Simple choice is gone: the look is always Automatic" (head, 4 Oct) | **Code + CF**: Automatic only. Do not bring the choice back without the head |
| 3 | **History folded into Report** | CF §3.3: separate History routes; UXP §3.2: keep History, fix blank page, add 4-bar glyph; UXP §2.1: History as a quick action | PSR §4.1: fold History into Report › Weekly | **PSR (plan of record)**. Code still has `History.svelte`, a History quick action, and Report's nav item lit for `/history` |
| 4 | **Like on the Wall vs no gamification and store UGC rules** | SAD D44 (head, 4 Oct): Like, Comment, Share; UXP §3.6: "no reactions beyond Like"; UXP §7.2: like burst | UXP/PSR/LMS: no gamification; PSR §7: report/block or comments off in store builds | **Code has Like with counts.** Like stays (head's decision; it is not gamification). Comments in store builds wait for IYF. No reactions beyond Like |
| 5 | **Drawer and navigation duplicates** | CF §3.9 and `Menu.svelte` (head, 5 Oct): phone drawer leaves out bar items; desktop sidebar keeps everything | PSR §3: duplication remains across bell, sidebar Announcements count, Notices/Report quick actions, Home link lists, desktop page tabs | **Both stand.** The drawer fix is done; **PSR** removes the remaining duplicates. Code still has 6 quick actions |
| 6 | **Sending saves automatically when back online** | CF §4.8: nothing sent automatically; UXP §5: Background Sync "not now", conflicts with explicit Save | UXP §12 B4; PSR phase 1: auto-send Saves the person already pressed, while the app is open, with visible states | **PSR (newer)**: only pressed Saves, never silent drafts. Earlier SAD §6/§2b autosave-after-typing was replaced by explicit Save |
| 7 | **"Complete week or not accepted" vs part weeks** | SB §1, §7; DH §9; SAD D6/17/26/31; ESP | SAD D45 (4 Oct), CF §4.2, API `week.submit` | **D45 + code**: part weeks; deadline auto-submits ≥ 1 complete day. SB and DH are out of date |
| 8 | **Colour for missed** | MA §16.2: danger = missed; UXP §6.3: red only for missed and errors | PSR §4.1: past unfilled days in amber "Missing" | Compatible if **missed week = red, missing day = amber**. Decide this explicitly in the state model (UXP §12 B1) |
| 9 | **How to group admin** | UXP §2.5: 4 groups (People / Structure / Decisions / System), tabs as second level | PSR §4.5: 6 sidebar entries (People, Staff, Batches, IYF IDs, Activity, Settings) | **PSR** |
| 10 | **Where reopens go** | UXP §3.5: into a Decisions inbox, keep the route | PSR §3.1: merged into one Requests inbox; separate Reopens tab removed | **PSR**. Code still has `#/reopens` |
| 11 | **Phone bar per role** | CF §3.9 / `nav.js`: group leader not on the bar; head+devotee bar = Home·Week·Report·Batch·Account | PSR §3.2: Group on the bar; head = Home·Requests·Admin·Batch·Account; head+devotee = Home·Week·Requests·Admin·Account | **PSR** (P0 #3 is a bug in today's code) |
| 12 | **Sign-up length and required fields** | UXP §3.1: 4 steps including address and emergency, draft saved on the phone | PSR §4.6: mark optional fields; blood group, address and emergency later in Account (about 40% shorter). D41 / API: address required at sign-up since 3 Oct | **Unresolved**: the server requires address. PSR's shortening needs a head decision and an API change |
| 13 | **Day form on desktop and tablet** | UXP §3.2: two columns of sections; SS §1: day form two columns on tablet (built) | PSR §4.1: single column on desktop | **PSR (newer)**. Verify in code what tablet shows today |
| 14 | **Facilitator sparkline length** | UXP §2.3: 6 weeks | PSR §4.3: 12 weeks | **PSR** |
| 15 | **Home quick actions** | UXP §2.1: trim to 4 (Report, History, Hearing, Share today) | PSR §3.2, §4.1: drop duplicates; no navigation lists on Home | **PSR**. Code has 6 including History and Notices |
| 16 | **TV / hall display** | MA §1, §10: no TV use case, defer | UXP §8: hall display (P3); PSR §8: optional in phase 5 | **OPTIONAL**, only if IYF wants it |
| 17 | **Animation on scroll** | UXP §9 rule 3: "No animation on scroll" | UXP §7.1 #9 and §12C: scroll-driven title condense, reveals, parallax; PSR phase 3: hide-on-scroll bar | Same document disagrees with itself. **PSR schedules hide-on-scroll**; scroll-driven effects are "later" and CSS-only. Treat rule 3 as "no JS scroll handlers" |
| 18 | **Moving gradients and wash strength** | MA §16.6: never animated or moving gradients; wash 14–16% | UXP §7.1 #18: drifting Welcome gradient (High only); SS §5: built wash is 10% | **Built: 10%, static.** Drifting gradient is P3, High-only and needs sign-off against MA's rule |
| 19 | **Chart library** | SAD §2b (2 Oct): uPlot for staff screens | MA, CF §5, UXP §9: hand-made charts, no chart library | **Code**: no uPlot in `package.json`; hand-made charts |
| 20 | **Language** | SAD §2b (2 Oct): English only; `index.html` is `lang="en"` | PSR §9 #3: Hindi as an IYF decision; DH §6: walkthrough videos in English and Hindi; LMS: Hindi search | **UNCLEAR**: needs IYF. Code is English only |
| 21 | **Teal clash** | MA §16.2: `--info` is teal, "deliberately not blue" | LMS §8: Learn area accent "deep teal" | Unresolved. Pick another Learn accent or change info |
| 22 | **Who gets the 9 PM reminder** | SB §3: only devotees whose day is not filled | SAD D41 (evening) and API: every active devotee every day ("filled ✓ / not filled") | **API / D41 (newer)** |
| 23 | **Group leader at sign-up** | SAD D33: optional, picked from a list | SAD D37: no longer asked; API ignores it | **D37 + API** |
| 24 | **Book progress estimate** | SAD §7c and API `home.get`: "≈ 40% · about 3 weeks left" using pages/hour from the profile | D41: pages-per-hour field removed from Account (value kept unused); UXP §3.2: estimate is a P3 proposal | **UNCLEAR**: verify in code whether the estimate shows |
| 25 | **Notification permission prompt** | API: asked once at the first tap after opening | CF §4.7: a Home card asks once, dismissible for 7 days | **Not a conflict**: `push.js` does both |
| 26 | **Where photos are stored** | SAD D7, §2a: private Drive folder | SAD §3a (3 Oct), API, CF §6: D1 `photos` table | **Code / CF**: D1 |
| 27 | **Glass hero vs no glass on data cards** | UXP §6.4: glass hero on the Today card (High only) | UXP §6.4 / MA §16.5: no glass on cards that hold data | Only allowed as specified (85%-opaque text layer); optional in PSR phase 5 |
| 28 | **Order of the roadmap** | UXP §11 phases 0–5; MA §19 phases 0–11 | PSR §8: Phase 0 trust/store blockers → 1 one place for everything → 2 role workspaces → 3 dynamic layer → 4 devotional + store assets → 5 store builds | **PSR**. UXP §11 itself marks its order as superseded |
| 29 | **Older screen inventories** | P6 and SS (4 Oct): History, Wall, Hearing, Reading, Account, Report, rail, staff Home | CF §9 (7 Oct): those two are out of date | **CF and the code** |

**Points worth flagging upstream:**
- Three P0 items are confirmed in code by the spot checks:
  - head+devotee loses Requests and Admin from the phone bar (`nav.js` ranks);
  - there is no privacy page (`public/` has only `delete-account.html`);
  - the user Look choice is retired in code (`tier.js`).
- A decision is still needed on whether address stays required at sign-up. It blocks both sign-up redesigns.
- Four items are blocked on IYF: image rights, the festival calendar, minimum age, and whether Hindi is wanted.