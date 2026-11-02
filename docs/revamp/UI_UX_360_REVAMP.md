# Sadhana Record — UI/UX 360° Revamp

**IYF Delhi · the blueprint for the final revamp · 8 October 2026**

**The revamp document set (plan of record):**

| Document | What it gives |
|---|---|
| `CURRENT_FEATURES.md` | What exists today (code = truth) |
| **This document** | Philosophy, strategy, imagery, roles, navigation, wording, the gap analysis |
| `DESIGN_SYSTEM.md` | Tokens and components |
| `ROUTE_BY_ROUTE_REVAMP.md` | Every route, before → after |
| `PERFORMANCE_SEO_ACCESSIBILITY.md` | The contract every change must pass |
| `FINAL_FEATURE_MATRIX.md` | The master inventory and the route and component matrices |
| `IMPLEMENTATION_ROADMAP.md` | Phases and order |

**Older documents:** `docs/current-features.md`, `ux-modernization-proposal.md`, `pre-store-revamp-review.md` and `modernization-audit.md` remain as history and evidence. Where they differ, **this set wins**.

**Evidence base (7–8 Oct 2026):**
- the code;
- 528 screenshots (10 kinds of login × 132 routes × phone and desktop × light and dark);
- four independent visual reviews;
- Lighthouse runs;
- all 19 existing documents;
- the 32 devotional images in IYF's Drive folder (inspected and catalogued in §8).

**Facebook screenshot:** one phone screenshot of the Facebook home (top bar, tab row, composer, Stories) was shared on 8 Oct 2026. §2 is checked against it (§2.1), and against Facebook's well-known design patterns.

**Hard rule for the whole revamp:**
- no existing function, rule, route, permission, API contract or data flow is removed or changed, except where named in a separate requirement;
- Lighthouse and performance must not get worse (`PERFORMANCE_SEO_ACCESSIBILITY.md`).

---

## 1. Design philosophy

**One sentence:** *Sadhana Record should feel like a calm, warm companion that always knows where you stand, shows what needs you, and celebrates steady practice — with the polish of a modern product and the dignity of a temple.*

| It should feel | How we get there |
|---|---|
| Modern, premium, intentional | One brand colour; a strong type hierarchy (serif titles, sans UI); generous but purposeful space; depth only where something floats or acts |
| Warm, devotional, memorable | Sandalwood and indigo-night neutrals, gold detail, the verse and **one** daily darshan (§8), respectful wording |
| Trustworthy, professional | Numbers that always agree; honest states ("Saved" only when saved); clear consequences before destructive actions |
| Highly usable, information-rich | Every screen answers its person's question first; dense where staff work, comfortable where devotees reflect |
| Calm | Few colours; motion only to explain change; no badges or animation without a reason |
| Responsive, fast | Instant press feedback; cached data first; one-shot motion; tiers for weak phones |

**It must not feel like:**
- an admin template;
- a spreadsheet;
- a social app competing for attention;
- an ashram picture gallery;
- a game (no streaks, points or leaderboards).

**The judging rule for every decision:** clarity + beauty + meaning + usability + performance. If an idea adds beauty but costs clarity or performance, it is out.

---

## 2. Why does Facebook feel more alive than Sadhana Record?

*(From the shared screenshot and Facebook's well-known interface patterns; nothing is copied.)*

| Principle | What Facebook does | What Sadhana Record does now | Translate (and how far) |
|---|---|---|---|
| **Visual anchors** | Every feed unit has a face (avatar) and often a photo; the eye always has a landing point | Most screens are text rows and outlined cards; few anchors (status dot, ring) | Give each *unit* one anchor: the **status block** with its day strip on Home, **avatars/initials** in staff lists (exist on Members; extend to the Board and My students), **sparklines** on student rows, **one darshan** on Home. Not more pictures everywhere |
| **Content density** | Dense but grouped: header, content, actions in a predictable rhythm | Large empty areas on desktop; screens stack equal-weight cards | A **two-level density** (comfortable for devotees, compact for staff); fill desktop width with *useful columns*, not spacing |
| **Hierarchy** | One dominant element per unit (the post), the rest secondary | Several elements of equal weight (Today card = Week card = verse card) | **One hero per screen**; everything else visibly secondary |
| **Colour distribution** | One brand blue, used only for actions, active nav and links; everything else neutral | The accent recolours whole areas; several colours on one screen | **One action colour (the logo blue)**; area colours become markers; status colours only for status (`DESIGN_SYSTEM.md` §2) |
| **Interactive states** | Every control reacts instantly (press, hover, active tab, like) | Press feedback exists; several false or idle states ("Saved ✓" untouched, "Checking…" forever) | Every control: rest / hover / pressed / focus / busy / done. No state that isn't true |
| **Repetition without monotony** | Same card frame, varied content inside (text, photo, link, event) | Same row for everything; same card for everything | Few block types with clear roles: status, needs-you, scope strip, content, stat, grouped list, darshan |
| **Perceived activity** | Counts, "2 new", live reactions; things visibly change | Data refreshes silently | **"What changed"**: "3 submitted since you last looked", a changed-row glow on staff boards, the success moment on submit. Calm, never noisy |
| **Personalisation** | The feed is yours: your name, your friends, your groups | Home is personal for devotees; staff Homes are link lists | Every role's Home built from *their* queues and scope (§10) |
| **Navigation clarity** | Few top destinations; everything else in a menu | The same destination in 2–4 places (bar, drawer, tabs, Home links) | **One place per destination** per breakpoint (§11) |
| **Feedback** | Immediate (reactions, toasts, optimistic updates) | Good toasts with Undo; saves wait for the server | Optimistic updates for marks and likes; success moments for Save and Submit |
| **Emotional engagement** | Faces, photos, reactions | Verse of the day; a strong devotional base | The daily darshan, warm wording, the gentle celebration of a submitted week. Devotional, not social |
| **Empty space** | Rarely empty; side columns hold context | Desktop pages leave 40–60% of the width empty | Desktop gets context columns (trend, last filled, deadline); phones keep breathing room |

**What we deliberately do NOT take from Facebook:**
- infinite feeds;
- engagement loops;
- notification pressure;
- many reactions;
- ads-style density;
- Facebook's own look. Our brand is also a blue, but it is the IYF logo's blue (`#004FDC`, deeper and more violet than Facebook's `#1877F2`), with the logo's gold, warm sandalwood neutrals and serif headings. Together these keep it clearly IYF.

**The useful lesson:** Facebook feels alive because of **anchors + one action colour + instant feedback + visible change + strong hierarchy**, not because of more colours.

### 2.1 What the shared screenshot shows, and what we take

| On the Facebook screen | Why it works | Sadhana Record translation | Where / phase |
|---|---|---|---|
| **Top bar:** the wordmark, then 2 round grey icon buttons (search, Messenger) | Few actions; round buttons read as tappable | It matches our IconButton. Keep only search and the bell in the top bar | Shell, Phase 2 |
| **Icon tab row:** 6 icons; the active one is blue and underlined, the rest grey | Colour marks *where you are* and nothing else | Same rule for our bar: only the active item takes the brand blue | Shell, Phase 1–2 |
| **Composer:** your own photo + a rounded pill "What's on your mind?" | The main action is one friendly line with a face, not a button | The devotee Home's Status block action is a **pill row: your photo or initials + "Fill Wed, 7 Oct ›"**. One line, personal, and it opens today's Day | Home, Phase 4 |
| **Quick-action row:** Photo / Feeling / Location, each with a small coloured icon | Colour only on small icons, so the row is lively but calm | Home quick links (Hearing, Reading, Report) get small icons **in their category colours** (Soul gold, Body blue…). The text stays neutral | Home, Phase 4 |
| **Stories:** tall rounded cards, each with a face, scrolled sideways | Faces and photos are the anchors; sideways scroll shows "more" without length | **Not copied as Stories** (we are not a social feed). The useful idea is the **avatar ring**: on Group and My students, a sideways row of members' photos or initials with a **progress ring** (full green = submitted, part = filling, amber = missing days). Tapping one opens that person | Group / My students, Phase 5 (P2) |
| **Surfaces:** white, thin grey dividers, one blue | Content carries the colour | Our warm neutrals + one brand blue (D1) | Phase 1 |

**Not taken from the screenshot:** the Stories feature itself, the feed, the composer as free posting (devotees don't post), and the red-dot pressure on every tab.

---

## 3. Colour strategy (decisions)

The full token tables are in `DESIGN_SYSTEM.md` §2. The decisions and their reasons:

1. **One brand and action colour: the IYF logo's blue `#004FDC` / `#78A8FF` (navy `#002888` for brand surfaces), plus the logo's gold detail** (Decision D1, **decided 8 Oct 2026**).
   - **Why:** it is the logo's own colour. Users learn "blue = I can act" once, for the whole app. Today the action colour changes between areas, and the brand changes from purple to blue at sign-in.
2. **Are role colours useful? Partly.**
   - **Useful:** knowing "you are in staff tools" (coordinator saffron, IYF-head wine) prevents mistakes. A head acting as a devotee must not confuse the two.
   - **Not useful:** recolouring buttons, links and charts.
   - **Decision:** area colour shows only as a marker (the active sidebar section bar, the top-bar area tag, the page overline).
3. **Status colours mean one thing each:**
   - green: done;
   - amber: needs attention (filling, deadline close, **missing past day**, needs-you);
   - red: missed or error/destructive only;
   - teal: neutral information.
4. **Data colours mean the category, everywhere:** Body blue, Soul gold, Seva teal, Attendance violet, Overall brand blue.
5. **Icons are monochrome.** They take the text colour, or the brand only when active or the primary action. **No rainbow icon chips** (the current quick-action icon chips become neutral with the brand on press).
6. **Both themes are designed together.**
   - **Dark mode** uses tonal elevation (each surface lighter) instead of shadows.
   - **High contrast** strengthens borders and muted text.
   - **Low capability** removes glass, imagery and extra shadows but keeps every colour meaning.

---

## 4. Information density: the principle

**For each screen type:**

| Screen type | Density | Primary | Secondary | Contextual | Actionable | Optional (disclosed) |
|---|---|---|---|---|---|---|
| Devotee Home | Comfortable | Week status + next action | Needs-you (if leader or facilitator) | Deadline, consistency | Fill / Submit / Share | Quick links, verse/darshan, latest post |
| Day form | Comfortable, focused | The fields still needed | Live day score | "Same as yesterday", last values | Save | Scoring rules (sheet) |
| Report | Comfortable | This period's insight + chart | Calendar / weeks | Trend, averages | Share | History detail |
| Staff boards / lists | **Compact** | Who needs action | Counts strip | Last filled, trend, attendance | Mark, call, nudge, fill | Inactive members (collapsed) |
| Admin | **Compact** | Decisions + health | Batch table | Activity | Approve, fix | Settings |

**The rule:**
- Whitespace frames the primary element.
- Empty width is filled with context, or the layout narrows.

The per-route density judgement (too much / too little whitespace, missing context) is in `ROUTE_BY_ROUTE_REVAMP.md`.

---

## 5. The sign-in experience: every authentication surface

**What exists today** (`CURRENT_FEATURES.md` §3.2):
- **Screens:** one Welcome, one Login (phone *or* username, for every role), Sign up, Forgot password, and Change password (forced when a temporary password is in use).
- **Login states:** session-expired notice, pending approval, rejected, disabled, locked.
- **Does not exist (stated, not invented):** **no separate admin, coordinator or CSV/data login.** Every role uses the same Login. Facilitator and coordinator usernames sign in the same way.

**Design decisions:**
1. **One sign-in, with role-aware answers.** Keep a single Login: separate role logins would add confusion and a phishing surface.
   - The *responses* differ by state: pending, temporary password, session expired, locked.
2. **Sign-in belongs to the product:**
   - same brand (logo blue + gold, D1);
   - the IYF lockup;
   - the same type;
   - on wide screens, **a devotional panel** (§8).
3. **Layout per device:**
   - **Phone:** form-first. Lockup (emblem + "Sadhana Record") → one-line purpose → form → secondary links. **No image** (speed, keyboard space, LCP).
   - **Tablet:** a slim darshan band (160 px) above the card. Optional, High/Balanced only.
   - **Desktop ≥ 1024:** a **split screen**. 45% devotional panel (today's darshan + a short verse) | 55% the form card (420 px). The same image as Welcome that day (continuity).
4. **Form craft:**
   - **Autofill hints:**
     - "Phone or username": `autocomplete="username"`, `inputmode` text;
     - Password: `current-password`;
     - Sign-up: `new-password`, `tel`, `email`, `bday`.
   - **Interaction:**
     - show/hide password (exists);
     - Enter submits;
     - errors appear under the field, with focus moved there;
     - the button shows busy with no layout shift;
     - a 15 s timeout message (exists).
   - **Trust line under the form:** "Your data stays with IYF Delhi · Privacy" (link to the new privacy page).
5. **State screens:**

| State | NOW | REVAMP |
|---|---|---|
| **Pending approval** | Red error banner; form still active | A **calm status page**: "Hare Krishna, Rahul. Your coordinator for SPS will approve your sign-up." Shows batch and facilitator, "Check again", "Wrong details? Contact your coordinator". Info styling. A small darshan card (§8). No form |
| **Temporary password** (forced change) | Full app around the form | **Auth layout** (no bar, sidebar or bell). "Choose your own password to continue — your coordinator set a temporary one." Log out link |
| **Session expired** | Notice on Login | Keep, with wording: "You were signed out after 30 days without use. Sign in again — nothing you saved is lost." Return to the page they were on (exists) |
| **Locked (5 wrong tries)** | Message | "Too many tries. Wait 15 minutes, or ask your coordinator to reset your password." Shows the time left |
| **Rejected** | Message with reason | Keep the reason; add "You can sign up again with correct details" |
| **Not available to you / Page not found** | Empty state | Keep; remove the area overline; add the role's Home as the action |

6. **Sign-up** (one-time, high stakes):
   - **4 steps:** You → Batch & class → Contact & address → Password;
   - a progress indicator; **draft kept on the phone**; optional fields marked;
   - *optionally*, blood group, address and emergency contact are added later in Account (cuts about 40%). **This needs an IYF decision and a small server change:** since 3 Oct the server *requires* an address at sign-up (decision D41, `auth.signUp`). Until decided, the 4 steps keep every field and only regroup them;
   - on desktop the darshan panel shows *what happens next* (3 short steps).
   - **The privacy and consent notice**, and the **minimum-age rule** decided by IYF (DPDP Act 2023), sit on step 1.
7. **Forgot password:**
   - one screen;
   - explains first: "Your coordinator approves password resets. Choose your new password now; it works after they approve.";
   - no image (a utility moment).
8. **Splash:**
   - **First open:** keep the emblem splash.
   - **Returning, signed-in users:** skip the 1.4 s hold, showing the kept Home at once (performance §6 of the contract).

---

## 6. Depth, surfaces and glass

**What exists:**
- glass on floating chrome (High and Balanced);
- three shadow levels (tiered);
- tonal dark mode.

**Where depth goes:**
- **Floating layer:** top bar (scrolled), bottom nav, sidebar, sheets, menus, toasts. Glass + `--shadow-3`.
- **Action layer:** the one hero per screen (status block / needs-you / decisions). `--shadow-2`, gentle state wash.
- **Content layer:** grouped lists and cards. `--shadow-1` + hairline.
- **Flat:** page background, plain sections, forms, tables, charts.

**Where glass helps:** chrome and sheets (orientation: content passes beneath); the text panel over a darshan image (readability with presence).

**Where glass hurts:** data, forms, tables, charts, long text, anything on low-end phones.

**Spatial believability:** surfaces enter from where they live:
- sheets rise from the bottom;
- the drawer slides from the side;
- detail panes slide from the right on desktop;
- the shared-element transition carries a tapped day chip into the Day header.

That continuity makes depth believable without heavy effects.

---

## 7. Motion and micro-interactions (purpose-led)

**Tokens:** `DESIGN_SYSTEM.md` §8.

**Every motion must explain a change or confirm an action:**

| Moment | Motion | Purpose | Tier |
|---|---|---|---|
| Press any control | Sink 0.97 (small) / 0.99 (rows) + tint, instant | "It heard me" | All (tint only with reduced motion) |
| Hover (mouse) | Tint 120 ms | Affordance | Pointer devices |
| Focus | 2 px ring, no movement | Keyboard location | All |
| Select chip / day / tab | Fill fades 120 ms; tab indicator slides 200 ms | What is selected | All |
| Page change (forward / back) | Slide 220 ms by direction; crossfade on Low | Where I went | High/Balanced |
| Day chip → Day page; row → detail; card → board | Shared-element 320 ms | Continuity | High/Balanced (iOS 18+, Chromium) |
| Sheet open / close | Rise with spring 200 / exit 160 ms | Layering | All (fade on Low) |
| Save | Check draws in the button 320 ms + Android haptic | Done, truthfully | All (no draw with reduced motion) |
| Submit week | Ring completes + score counts up ≤ 600 ms, once; "✓ Week submitted · 82%" | A small celebration of steady practice | High/Balanced |
| Error | Field border flashes once + message slides in | Find the problem | All |
| List changes (approve, mark, sort) | Rows slide (FLIP) 200 ms, max 50 rows | What moved where | High/Balanced |
| Live update on staff boards | Changed row glows once (1.2 s) | What changed | All (no glow with reduced motion) |
| Numbers | Count-up 400 ms on first view | Perceived liveliness | High/Balanced |
| Charts | Bars grow / line draws once per session | Reading order | High/Balanced |
| Darshan image | Fades in over its colour placeholder; **no motion afterwards** | Calm arrival | High/Balanced (shown static; absent on Low) |

**Never animated:**
- while typing;
- during form submission (only the button state changes);
- scroll-jacking;
- looping decoration (except the splash line, and the Welcome gradient on High only).

---

## 8. Devotional imagery: the darshan system

### 8.1 Inventory of the 32 images in IYF's Drive folder

**Inspected 8 Oct 2026:** dimensions read from each file; composition seen from previews.

**Rights:** IYF already holds permission for these images (confirmed 8 Oct 2026). No credit line is shown in the app.

**Verdict key:**
- **E** = everyday pool;
- **F** = festival image: **not in the daily rotation**. IYF can attach it to that festival's Wall announcement (decided 8 Oct 2026: festivals are announced on the Wall, not by an in-app calendar);
- **X** = do not use;
- **S** = small sizes only (low resolution).

| # | Image (file) | Subject | Size (px) / orientation | Visual intensity | Text-safe area | Best use | Verdict |
|---|---|---|---|---|---|---|---|
| 01 | 1112.jpg | Krishna with flute, close portrait | 800×787, ~square | High (orange) | None | Janmashtami darshan card | F, S |
| 02 | Krsna_Plays_Like_An_Ordinary_Boy | Krishna standing in a garden | 3055×4119, portrait | Medium | Upper foliage (soft) | Sign-in panel, darshan card | **E** |
| 03 | Krsna_And_Balarama_Approach_Mathura | Krishna & Balarama, townsfolk | 3131×4018, portrait | Medium-high | Top palms | Darshan card | E |
| 04 | Krsna_Lifts_Goverdhan_Hill | Govardhan pastime, crowd | 6312×4460, **landscape** | High | Top (hill, busy) | Govardhan Puja hero (landscape) | **F** |
| 05 | Lord_Caitanya_Water_Pastimes_Govinda | Boat, devotees in water | 5592×7326, portrait | High | Top (sky) | Darshan card (summer, Chandan Yatra) | E |
| 06 | Lord_Caitanya_Dances_At_Ratha_Yatra_2 | Ratha Yatra kirtan | 6828×8387, portrait | Very high | Top (chariot) | Ratha Yatra | F |
| 07 | Lord_Caitanya_As_Radharani_And_Krishna | Golden, glowing, serene | 5564×7323, portrait | **Calm, luminous** | Upper dark foliage | **Sign-in panel, Welcome, darshan hero**; also Gaura Purnima | **E (flagship)** |
| 08 | Ecstatic-Kirtana-with-Lord-Chaitanya | Night kirtan, blue sky | 2123×1593, **landscape** | Medium (dark) | **Top night sky: very safe** | Welcome landscape (desktop), evening darshan, dark mode | **E (flagship)** |
| 09 | 101862588_…_o.jpg | **Photograph of a street kirtan (identifiable people)** | 1440×819 | — | — | — | **X** (people's consent; not a darshan) |
| 10 | Lord_Shiva_On_Bull | Lord Shiva | 6066×7482, portrait | High | Top sky | Shivaratri (if IYF wishes) | F (optional) |
| 11 | Lord-Chaitanya-dances-at-Jagannath-Rathayatra | Ratha Yatra | 1949×2489, portrait | Very high | Top canopy | Ratha Yatra | F |
| 12 | Panchattava-chanting-and-dancing | Pancha-tattva kirtan | 1779×1582, near-square | Medium-high, warm | Right sky | **Chanting / japa context**, darshan card; Gaura Purnima | **E** |
| 13 | Lord-Brahma-offers-prayers-to-Krishna | Brahma & Krishna, forest | 1828×2492, portrait | Medium | Top canopy | Darshan card | E |
| 14 | Lord-Chaitanya-forest-animals-dance | Jharikhanda forest, animals | 2225×1550, landscape | High (busy) | Top canopy | Darshan card (landscape) | E |
| 15 | Lord_Caitanya_Sees_Krsna_In_Asoka_Tree | Night, moonlit | 5550×7315, portrait | Medium (dark) | Top night | Evening darshan; dark mode | E |
| 16 | Lord_Caitanya_House_Of_Srivasa | Kirtan in a hall | 5088×7308, portrait | Medium | Top architecture | Darshan card | E |
| 17 | Sri-Chaitanya | Golden figure, open arms, bright sky | 1721×2330, portrait | Medium, joyful | **Upper sky: safe** | Welcome (phone band), pending-approval card | **E (flagship)** |
| 18 | KIng_Citraketu_Offends_Parvati | Narrative of an offence | 5518×7328 | — | — | Not an everyday darshan | **X** |
| 19 | 08c9…jpg | "Gaura Purnima" graphic **with baked-in text** | 630×357 | High | n/a | Gaura Purnima banner only | F, S |
| 20 | Haridas_Thakura_Tempted_By_Mayadevi | Temptation narrative | 5384×7302 | — | — | Not suitable for everyday | **X** |
| 21 | Krishna-and-gopas-lunch-Vrindavan | Krishna with cowherd boys | 1802×2448, portrait | High (busy) | Top sky | Darshan card | E |
| 22 | Aditi_Worships_Lord_Visnu | Lord Vishnu, radiant | 5586×7326, portrait | Calm, luminous | Top glow | **Sign-in panel**, darshan hero | **E (flagship)** |
| 23 | Krishna-on-swing-with-cowherd-boys | Swing pastime, forest | 1625×2441, portrait | Medium-high | Top canopy | Jhulan Yatra; darshan card | E / F |
| 24 | compress_Arjuna_Fights_Kauravas | **Battle scene** | 800×1050 | Violent | — | Not for a calm daily app | **X** |
| 25 | compress_KIng_Citraketu… | **Duplicate of #18** | 800×1062 | — | — | — | **X** |
| 26 | High-resolution-…lord-Chaitanya | Lord Chaitanya with deer, forest | 2119×2482, portrait | Vibrant | Top foliage | Darshan card | E |
| 27 | Dancing-in-ecstasy-with-Lord-Chaitanya | Kirtan in nature | 1924×2581, portrait | Medium-high | Top sky | Darshan card | E |
| 28 | 96724352_…_o.jpg | Krishna pastimes by the Yamuna | 1514×1818, portrait | High | Top foliage | Darshan card (**check for an artist signature**) | E |
| 29 | 87482249_…_o.jpg | **"Pixel Arts" watermark visible** | 1514×1818 | — | — | Watermarked | **X** |
| 30 | 107900440_…_o.jpg | Krishna seated, palace | 1080×1421, portrait | High | Top architecture | Darshan card ≤ 1080 px | E, S |
| 31 | itl.cat_hari-om-wallpaper.png | Lord Nrsimhadeva (fierce form) | 600×867 | Intense | — | Nrsimha Caturdasi only, small | F, S |
| 32 | images (2).jpeg | Krishna & Arjuna on the chariot (Gita) | 482×637 | Medium | — | Gita Jayanti only, small | F, S |

**Summary:**
- **Everyday pool: 18 images.** Flagships are #07, #08, #17 and #22.
- **Festival images: 9.** These are kept for Wall announcements, not for the rotation (#23 also stays in the everyday pool).
- **Do not use: 6** (#09 people's photo; #18, #20 narratives; #24 battle; #25 duplicate; #29 watermark).

**Do not crop through faces, hands or feet of the Lord.** Each image gets a stored focal point (§8.6).

### 8.2 Where imagery belongs: route matrix

| Route / section | Image? | Asset | Purpose | Placement & size | Static / rotating | Time-aware? | Crop | Desktop | Tablet | Mobile | Load priority | Accessibility | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Splash | **No** | — | — | — | — | — | — | — | — | — | — | — | Speed; the emblem is the brand moment |
| Welcome | **Yes** | Today's darshan (flagships preferred) | First impression: devotional identity | Desktop: left 50% panel, full height. Tablet: top band 40%. Phone: top band 200 px, below the lockup | Daily | No | Focal-point crop; never through the figure | 960w WebP, fades in | 960w band | 480w band (≤ 40 KB) | **Important** (above the fold, low priority, sized to avoid CLS) | Meaningful: `alt="Darshan: <title>"` | The one place where a visitor learns what the app is about |
| Login (incl. session expired) | **Desktop only** | Same image as Welcome that day | Continuity, warmth, trust | Split screen 45% panel + verse on a glass panel | Daily | No | Portrait focal crop | 960w | Optional slim band | **None** | Optional (lazy, low priority) | Decorative (`alt=""`); the verse is text | The form is the task; on phones the image would push it down and slow LCP |
| Sign up | **Desktop only** | Daily | "What happens next" beside the image | Split panel | Daily | No | As Login | 960w | None | **None** | Optional | Decorative | Long form; never behind fields |
| Forgot password | **No** | — | — | — | — | — | — | — | — | — | — | — | Utility moment; anxiety-reducing clarity beats decoration |
| Pending approval | **Yes, small** | #17 Sri Chaitanya (fixed) | Reassurance while waiting | 160 px card beside the message | Static | No | Upper figure | 320w | 320w | 320w | Optional | Decorative | Calm, welcoming; no task to distract from |
| Change password (forced) | **No** | — | — | — | — | — | — | — | — | — | — | — | Security step: focus |
| **Devotee Home** | **Yes** | Daily darshan (everyday pool) | Daily devotional anchor; **replaces the separate verse card** (one devotional block, not two) | "Today's darshan" card in the devotional column: image 4:5 (desktop right column) / 3:2 (phone, after status and needs-you) + the verse beneath | **Once per day** (same for everyone) | No | Stored focal point | 480w card | 480w | 480w (≤ 45 KB) | Optional (below the status block; lazy) | Meaningful alt (deity + pastime) | Adds meaning and memorability without competing with the status block |
| Staff and facilitator Home (the head's decision, 10 Oct 2026: "viewing the Supreme Personalities' photos is always good") | **Yes** | Daily darshan (everyday pool) | The same devotional block as the devotee Home, placed last, after the work | Card under the work, 480 px at most on a wide screen | Rotates as on the devotee Home | No | As the devotee Home | As the devotee Home | Low tier / Save-Data: no image (the verse alone) | — | — | — | Boards, lists, tables and admin screens stay without imagery |
| Day form, Week, Fill pages | **No** | — | — | — | — | — | — | — | — | — | — | — | Data entry: minimal distraction |
| Week submitted (success sheet) | **Optional** | Today's darshan thumbnail | Gentle celebration ("Hare Krishna! Week submitted · 82%") | 96 px round thumb | Same as Home | No | Face-safe | 192w | 192w | 192w | Optional | Decorative | Meaningful moment; tiny cost (already cached) |
| Report, History | **No** | — | — | — | — | — | — | — | — | — | — | — | Data-first |
| Hearing, Reading | **No** | — | — | — | — | — | — | — | — | — | — | — | Book covers or lecture thumbnails would be meaningful later; darshan would not |
| Devotee empty states (no weeks yet, nothing this week) | **Optional** | Fixed per state (#17, #12) | Softens the first-week experience | 120 px halo image instead of the icon | Static | No | Face-safe circle | 240w | 240w | 240w | Optional | Decorative | Only for devotees, never for staff |
| Wall | **No** darshan | — | Posts carry their own images | — | — | — | — | — | — | — | — | — | Avoid competing images |
| Account, Settings | **No** | — | — | — | — | — | — | — | — | — | — | — | Settings: minimal |
| Group, My students, Batch, Requests, Members, Stats, Admin | **No** | — | — | — | — | — | — | — | — | — | — | — | Work screens: professional and data-first |
| Not found / errors / offline | **No** | — | — | — | — | — | — | — | — | — | — | — | Never pair devotional images with errors |
| Festival days | **No in-app override** | — | — | The daily darshan stays as usual | — | — | — | — | — | — | — | — | Decided 8 Oct 2026: festivals are announced on the Wall with a push notification (exists); that post can carry the festival image |
| TV hall display (optional) | **Yes** | Daily darshan | Temple display | 40% side panel | Daily | No | Portrait | 1440w | — | — | Important there | Decorative | 10-foot context |
| Store listing / share card | **Optional** | Flagships | Store screenshots, the OG image | — | — | — | — | — | — | — | — | — | Rights held |

### 8.3 Rotation: decided

- **Once per day, deterministic, the same for everyone.** Image = `pool[(daysSinceEpoch(IST date)) mod pool.length]`.
  - **Why:** a shared "today's darshan" (devotees can talk about it); one download a day; no visual churn.
  - Faster rotation (per visit or per route) causes fatigue and wastes data; a random image every render feels arbitrary.
- **Never changes during a session or a task.** The image is chosen when Home first loads that day and kept until the next day's first load. **Never on forms, workflows, tables or admin screens.**
- **Time-of-day:** **not for images.**
  - Time-of-day changes only the static greeting and the page wash (`UI_UX_360` §9 context).
  - **Why:** familiarity, caching and calm. A dawn/day/evening/night image system would mean 4 images a day and more data, for little gain.
  - **Optional later, after user testing:** prefer the night-toned images (#08, #15) in the evening.
- **Festivals: no in-app override (decided 8 Oct 2026).** There is no calendar file, no festival image swap and no festival banner.
  - Festival days are announced the existing way: a Wall post with a push notification.
  - The festival images (F in §8.1) can be attached to those posts, e.g. Govardhan Puja → #04, Ratha Yatra → #06 / #11, Janmashtami → #01.

### 8.4 Image treatment

- **Card:**
  - rounded 24 px;
  - focal-point crop;
  - **no text on the image** in the Home card (verse and title sit below, on the surface);
  - colour-placeholder background while loading, then a 300 ms fade (static on reduced motion).
- **Panel (Welcome / sign-in, desktop):**
  - edge-to-edge in its half;
  - a soft `--img-scrim` at the bottom;
  - the verse on a **glass text panel** (High) or 88% opaque panel (Balanced);
  - **text contrast is guaranteed by the panel, never by the image.**
- **Not used:**
  - vignettes heavier than the scrim;
  - colour tints;
  - blur-extended backgrounds;
  - parallax on task screens;
  - masks through figures.
- **Optional:** subtle parallax (≤ 12 px) only on the Welcome panel, High tier, pointer devices.
- **Dignity rules:** never flipped, stretched, cropped through the Lord's form, used behind text or forms, shown next to errors, or used as a texture.

### 8.5 Responsive and performance strategy

- **Pipeline:** originals stay in IYF's Drive ("Darshan — originals").
  - A build script makes **480 / 960 / 1440 px WebP + JPEG fallbacks** (AVIF optional later).
  - These ship as static files on Cloudflare, served from the app's own address, so the CSP is unchanged.
- **Weight:**
  - 480w ≈ 30–45 KB;
  - 960w ≈ 80–120 KB;
  - 1440w only for the optional TV display.
- **Markup:**
  - `<img>` with `srcset` + `sizes`;
  - explicit `width` and `height` (no CLS);
  - `decoding="async"`;
  - `loading="lazy"` except the Welcome band;
  - `fetchpriority="low"` everywhere except the Welcome panel on desktop.
- **Caching:**
  - **Not in the precache.** Only `darshan.json` (≈ 3 KB) is precached.
  - Today's image goes into a small runtime cache (≈ 7 images).
- **Tiers:** Low tier, Save-Data or offline-first-open means no image; the verse shows on its own.
- **Priority classes:**
  - **Critical:** none. No image is ever on the critical path of a task.
  - **Important:** Welcome.
  - **Optional:** everything else.

### 8.6 Images as content (configuration)

**Justified**, because the image set will change (new paintings).

`public/darshan/darshan.json` holds one entry per image:
- `id`, `title`, `deity`, `pastime`;
- `active` (only active images are in the rotation);
- `orientation`, `focal` (`50% 30%`), `dominant` colour;
- `sizes`, `textSafe` (`top` / `none`);
- `routes` (allowed: `welcome`, `signin`, `home`, `pending`, `success`, `empty`).

**No admin screen at first:** IYF sends images and the keeper rebuilds. Later, optionally, the files move to Cloudflare R2 with an IYF-head upload screen.

### 8.7 The final question

**Where the photographs make Sadhana Record substantially more beautiful, meaningful and memorable:**
- the **Welcome** screen;
- the **desktop sign-in panel**;
- **one "Today's darshan" card on the devotee Home** (merged with the verse);
- the **pending-approval** wait;
- gently, the **week-submitted** moment.

**Where they would make it worse:**
- every work screen: Day, Week, Fill, Report, staff boards, admin, settings;
- behind any text, form or table;
- next to errors;
- **more than one image on any screen.**

**Most routes get no image, and that is the right design.**

---

## 9. Context that makes the app feel alive (without noise)

- **Time-of-day greeting and wash:**
  - before 6 AM: "Good early morning — time for japa";
  - day / evening / night: neutral greetings;
  - static gradients swap by hour (≈ 0.2 KB).
- **Status-tinted hero:** neutral while filling → amber in the last 24 h → green with a check when submitted.
- **"What changed since you last looked":** staff boards, the needs-you card, the Wall bell.
- **Festivals:** announced on the Wall with a push notification (exists); no in-app calendar or banner.
- **The devotee's own birthday:** a card on Home with the darshan.

---

## 10. Role-specific experience

**One rule for every Home: three slots, then the extras.**
1. **My day:** if a devotee.
2. **Needs you:** every queue the person owns, non-zero rows only.
3. **My scope this week:** the highest role only.

After those: the darshan and verse (devotee), birthdays (staff), the latest post (if unread). **No navigation lists on any Home.**

| Role | The question | Home | Navigation (phone bar) | Primary actions | Wording | Data density |
|---|---|---|---|---|---|---|
| Devotee | What is my status, what next? | Status block (days, missing in amber, deadline, one button) · darshan + verse · quick links (Hearing, Reading, History, Share) | Home · Week · Report · Account | Fill today, Submit week, Share | "Fill Wednesday", "3 days to fill", "Submitted ✓" | Comfortable |
| + Group leader | Who in my group still needs a nudge? | + Needs you: "1 in your group still to submit · Deepak ›" | Home · Week · **Group** · Report · Account | Call/WhatsApp, nudge all, mark attendance (Sun) | "Still to submit", "Nudge" | Comfortable |
| Facilitator (only) | Who needs me? | **Opens on My students** (grouped: Needs you / Filling / Submitted) | Students · Wall · Account | Call/Chat, open a student | "Needs you: missed last week" | Compact |
| + Facilitator (member) | Both | + Needs you: "2 students not started ›" | Home · Week · Students · Report · Account | — | — | — |
| Coordinator | How are my batches and people; what needs action? | Needs you (sign-ups, resets, reopen replies, with age) · This week per batch · People to nudge · Birthdays | Home · Batch · Requests · Account | Approve, mark attendance, fill on behalf, appoint leaders | "Waiting for approval", "Not started (active members)" | Compact |
| IYF head | Is the system healthy; what needs my decision? | Decisions (one inbox) · System health · Batches table (worst first) | Home · Requests · Admin · Batch · Account | Decide reopens and staff resets, fix health items | Plain words; names, not phone numbers | Compact |
| IYF head + devotee | Both | My day · Needs you · health strip (≈ 1,500 px, was 2,750) | Home · Week · Requests · Admin · Account | — | Greeting "IYF head · all batches" | — |
| CSV / data user | — | **Does not exist** in the app. Data users work in the **Google Sheets copies** (store sheets, 4 batch view sheets) | — | — | — | — |

---

## 11. Information architecture

| Level | Contents |
|---|---|
| **Primary** (bar / rail / sidebar top) | Role destinations only: Home, Week, Report, Group, Students, Batch, Requests, Admin, Account |
| **Secondary** | **Phone:** in-page tabs (Batch: Status · Devotees · Group leaders · Filling chart; Admin: 6 groups). **Desktop:** the same items in the sidebar under one section entry; no tab row |
| **Contextual** | Row → detail (pane on desktop); "Fill for", "Reopen", "Nudge" inside the item |
| **Settings** | Account: profile sections, notifications, theme, text size, password, How to use, delete account, log out |
| **Quick actions** | Devotee Home only: Hearing, Reading, History, Share today (no duplicates of the bar) |
| **Progressive disclosure** | Scoring rules (sheet), inactive members (collapsed), Activity before/after (expand), destructive actions (⋯ menu → confirm sheet), optional sign-up fields (later) |
| **Breadcrumbs** | **Not used.** Depth is ≤ 2; the top-bar title plus Back is enough |
| **Tabs help** | Batch and Admin on phones; Report Daily / Weekly |
| **Tabs hurt** | Desktop, when the sidebar already lists the same items |
| **Sidebar** | Desktop ≥ 1024, with its own scroll; **every page of every section always listed** (the head, 10 Oct 2026: nothing folds into an area entry; mouse-size rows so the pages fit a laptop screen) |
| **Bottom nav** | Phones; ≤ 5; ordered: Home → own daily action → queue → highest scope → Account |

**Navigation changes by role:** the *model* is one (`lib/nav.js`); the *order and contents* follow the role rule above. This fixes the IYF-head-plus-devotee losing Requests and Admin on phones.

---

## 12. Content design

**Voice:** calm, respectful, plain, warm. "Hare Krishna" greetings stay; no marketing language, no exclamation storms.

| Today | Use |
|---|---|
| "Draft" / "Filling" | **Filling** |
| "Notices" / "Announcements" | **Announcements** |
| Batch / Batch status / Status / My batch / Batch work | Bar **Batch**; page **Batch status**; section **Batches**; "My batch" only for a devotee's own batch |
| sign-ups waiting / waiting approval / 1 waiting | **waiting for approval** |
| Members / All devotees | **Devotees** / **All devotees** |
| "Students" / "My students" | **My students** (bar may say Students) |
| Admin page titles all "Admin" | The tab's own name |
| "TRD" alone | "TRD (temple resident)" on first use |
| 05 Jan 2026 / 07/10/2026 / 31/08/2026 | **7 Oct 2026**; "Wed, 7 Oct" in day contexts; never numeric-only |
| "How your day is scored" (staff filling) | "How their day is scored" |
| "Saved ✓" on an untouched form | `Save` (disabled) until changed |
| "Wednesday is not filled yet" (3 days behind) | "3 days to fill — Mon, Tue, Wed" |
| Pending approval as an error | "Your coordinator for SPS will approve your sign-up." |
| "Checking…" (forever) | After 4 s: "Couldn't check notifications — try again" |
| Developer terms in Activity ("STALE", "devotees.list") | Plain sentences: "Saving was slow 3 times today" |
| Hard-coded "Monday 9 PM" in Settings help | The configured times |

**Errors:**
- **Structure:** what happened, then what is safe, then what to do. Example: "Couldn't save — no connection. Your entries are kept on this phone. We'll send them when you're back online."
- **Confirmations name the consequence:** "Delete Sunil Kumar's account? Submitted weeks stay, without the name. This can't be undone."

---

## 13. Device capabilities (only where they help)

**Exists:**
- touch press states;
- swipe (lecture weeks, verses);
- vibration on save, submit and attendance (Android);
- keyboard shortcuts;
- reduced motion and reduced transparency;
- network-aware tiers;
- share sheet;
- push;
- badges.

**Add:**
- **swipe** between days, weeks and devotees (with ‹ › buttons);
- **long-press** on staff rows (quick actions);
- **app shortcuts** (manifest);
- **contact picker** for the emergency contact (Android);
- `prefers-contrast`;
- a **failed-submit haptic**.

**Rejected:**
- pull-to-refresh (it fights scroll, and the app already refreshes on return);
- motion sensors;
- radial pickers;
- haptics on every tap;
- wake lock (except an optional TV display).

The per-platform support table is in `PERFORMANCE_SEO_ACCESSIBILITY.md` §6.

---

## 14. Additional requirements discovered from existing documentation

The full extraction of all 19 documents (every requirement, decision and conflict, classified CURRENT / PROPOSED / REQUIRED / OPTIONAL / CONFLICTING / UNCLEAR) is in **`FINAL_FEATURE_MATRIX.md` §L**. The conflicts that change design decisions:

| Conflict | Sources | Resolution in this revamp |
|---|---|---|
| Per-area accent colours vs one product feel | Audit §16.3 (4 Oct) vs reviews (7 Oct) | **D1: one brand/action colour (the logo's blue), area markers only.** Decided by IYF 8 Oct 2026 |
| User-chosen "Look" (Rich/Simple) vs automatic tiers | Audit §16.5 vs the 4 Oct decision (always automatic) | **Automatic only** (as built); a text-size control is added instead |
| Like on the Wall (reviewer: drop) vs built at the head's request | Review vs the head's decision | **Keep Like**, styled quietly |
| History as its own page vs folded into Report | Review vs current | **Fold into Report › Weekly**; keep the `/history` route redirecting (no broken links) |
| Rounds target ("14/16") | Brief examples vs scoring (rounds not scored) | **IYF decision**; not shown until decided |
| Daily principle checkboxes (brief) vs weekly Yes/No (rule) | Brief vs business rule | **Keep weekly** (business rule unchanged) |
| Address at sign-up: required (D41, server) vs "add later" (pre-store review) | Decision D41 vs review §4.6 | **Keep required** (decided by IYF 8 Oct 2026) |
| Animation on scroll: "no animation on scroll" vs scroll-driven effects | Proposal §9 rule 3 vs §7.1 | **No JavaScript scroll handlers.** CSS scroll-driven effects (title condense, hide-on-scroll bar) are allowed, as they run off the main thread |
| Learn (LMS) area colour "deep teal" vs `--info` teal | LMS §8 vs design system | **Learn uses a different marker** (e.g. deep green `#2f6b3f` / `#8fcf9f`), and teal stays "information" |
| Drifting Welcome gradient vs "never animated gradients" | Proposal vs audit §16.6 | **Static by default.** The drift is P3, High-only and needs sign-off |
| Area colours as an "identity anchor, do not change" vs D1 | Audit §16.3, §24 vs this document §3 | **D1 replaces the anchor** (decided by IYF 8 Oct 2026: the brand is the logo's blue) |

---

## 15. What prevents the current app from feeling world-class? (360° gap analysis)

| Area | Gap today | Prioritised solution | Priority |
|---|---|---|---|
| **Visual** | Several equal-weight cards per screen; area colours recolour everything; the brand changes at sign-in; icon chips add colour noise | One hero per screen; D1 colour strategy; neutral icons; the darshan card on Home only | P1 |
| **UX** | Missing past days look like future days; untrue states ("Saved ✓", pre-selected attendance); pending approval looks like an error | Missing = amber; honest states; a calm pending page | **P0/P1** |
| **Information architecture** | The same destination in 2–4 places; desktop tabs plus sidebar; the head-plus-devotee bar loses Requests and Admin; reopens outside Requests | One place per destination; the role bar rule; one Requests inbox | **P0/P1** |
| **Interaction** | Saves wait; no "what changed"; destructive actions in rows; tiny targets | Optimistic updates; changed-row glow; ⋯ menu + confirm; 44 px targets | P0/P1 |
| **Content** | Six names for one tool; numeric dates; developer jargon; wrong pronouns | The naming table (§12); a voice guide | P1 |
| **Responsiveness** | Desktop wastes width; two floating bars over the Day form on phones; the sidebar overflows at 860 px | Context columns and list-detail; hide the nav on the Day editor; sidebar scroll | P0/P1 |
| **Accessibility** | Small targets; no screen-reader pass; dimmed text in dark mode; charts without tables | 44 px; TalkBack/VoiceOver pass; contrast via tokens; "Show as table" | P1 |
| **Performance** | Startup CSS render-blocking (0.3–0.6 s); the splash held 1.4 s; JS at 55.06 KB of a 55 KB target | Split startup CSS; skip the splash for returning users; trim | P1 |
| **SEO** | Public pages share one title and description; no robots.txt or sitemap; hash routes | Per-route titles for public pages; robots.txt; keep app routes noindex-able (contract §5) | P2 |
| **Design system** | Good tokens, but components style status, cards and charts differently | Component token layer; status chip and viz colours unified | P1 |
| **Technical architecture** | Sound (Svelte, Worker, D1, PWA). Gaps: counts computed differently per screen; the bell's fallback count; no product measurement; no job-failure alerts | One shared week-summary definition; an unread count from home.get; server-side counts; alerts | P0/P1 |
| **Trust and store** | No privacy policy page; no Wall report/block; minors' consent (DPDP); no reviewer demo | Phase 0 of the roadmap | **P0** |
