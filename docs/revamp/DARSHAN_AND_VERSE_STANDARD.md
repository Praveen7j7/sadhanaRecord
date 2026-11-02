# Darshan and verse — display standard

**IYF Delhi · Sadhana Record · proposed 9 Oct 2026 for the head's approval (Phase 9, item 22)**

This standard covers how the paintings of the Lord (darshan) and the verses from Śrīla Prabhupāda's books are shown: in which places, shapes, sizes and formats, how they are chosen, and how fast they change. It applies to the web app and the store apps alike, because the store apps show the same web app.

**Three principles:**

1. **Devotional, never a slideshow.** A painting or a verse stays long enough to be looked at and read. Change is slow and calm.
2. **Only one thing moves at a time.** In any one view, the painting and the verse never change at the same moment.
3. **Never empty, never in the way.** Something always shows from the first moment. No painting ever delays the sign-in or the day form.

---

## 1. Where they appear

| Place | Screen | Painting | Verse | What moves |
|---|---|---|---|---|
| **Welcome, phone** | < 1024 px | 4:5 hero under the logo, at most 54 % of the screen height | the verse of the day, on a panel at the painting's foot | the painting only |
| **Welcome, desktop** | ≥ 1024 px | the left half, full height | the verse of the day, on a panel at its foot | the painting only |
| **Sign in, desktop** | ≥ 1024 px | the left 45 %, full height | the verse of the day (as on Welcome) | the painting only |
| **Sign in / sign-up, phone** | < 1024 px | none: the form comes first | none | nothing |
| **Devotee Home** | all | the darshan card: 3:2 on phones, 4:5 on wide screens, with its title under it | the verse carousel under the painting | the painting **or** the verse, never both at once (§4) |
| **Week submitted** | all | 3:2 thumbnail with its title | none (a thank-you line) | nothing |
| **Staff and facilitator Home** (coordinator, IYF head, facilitator; the head, 10 Oct 2026) | all | the same darshan card as the devotee Home, **last on the screen**, after the work; 480 px wide at most on a wide screen | the verse carousel under the painting | as on the devotee Home |
| **Staff work screens** (boards, lists, admin, forms) | all | none | none | nothing |

The verse of the day is the same for everyone on a given Indian date. The painting a person starts from is also chosen by the Indian date (§3), so people talking about "today's darshan" see the same one first.

## 2. Shape, size and quality

**Shapes (aspect ratios):**
- The phone hero and the wide Home card are 4:5 (portrait). This suits almost all the paintings, which are portrait (most are 2160 × 2700 or 1080 × 1350).
- The phone Home card and the success thumbnail are 3:2.
- The desktop panels fill the full height.

**Cropping:**
- Each painting has a **focal point**: the face of the Lord, set by hand. Every crop keeps it in view, so a narrow phone or a wide panel never cuts the face.
- Paintings that can't be cropped well for a shape are marked for the places they suit.

**Files per painting:**
- WebP at 480, 960, 1440 and 2160 px wide. The larger sizes are made only when the original is that large.
- AVIF where it saves 20 % or more.
- A JPEG at 960 for old browsers.
- A ~1 KB blurred preview, stored in `darshan.json`.

**Size limits:**
- 480 px ≤ 45 KB
- 960 px ≤ 120 KB
- 1440 px ≤ 220 KB
- 2160 px ≤ 400 KB

**Which file the browser picks:** each place declares how wide it shows the painting (`sizes`), so the browser picks the right file for the screen's width and sharpness:
- a 390 px phone with a 3× screen gets the 1440;
- a 1280 px laptop panel gets the 960 or 1440;
- a 4K screen gets the 2160.

Nobody downloads more than their screen can show.

**Loading order** (already in place since Phase 8, kept):
1. dominant colour;
2. blurred preview;
3. small file;
4. sharp file.

Each step paints in the same place, so nothing jumps.

**When images are left out:**
- On the Low tier, with Data Saver on, or offline with nothing kept: no images.
- The verse stays, on a calm colour panel.
- The layout is the same either way.

## 3. How a painting is chosen

**Two pools:**
- **flagship:** the finest, full-figure paintings, used on Welcome and sign-in;
- **everyday:** all paintings, used on Home and the success sheet.

**Order of the day:**
- Each day starts from a different painting, chosen by the Indian date, the same for everyone.
- The rotation then follows a fixed order through the pool from there.
- Over a month everyone sees the whole collection, and nobody sees the same painting first two days running.

**Variety:**
- A painting does not open the day if it opened any of the last 14 days. With 112+ paintings this is easy.
- Paintings of the same deity are not shown back to back.

**Data:**
- At most 6 paintings are fetched in a visit; after that, the ones already fetched go round again.
- They are never in the app's install, and the phone keeps the recent ones for 30 days.

## 4. How fast things change (the readable pace)

**Paintings:**

| Setting | Proposed | Now |
|---|---|---|
| Time on screen | **20 s** | 9 s, which reads as "moving" |
| Change | a 1.2 s cross-fade, no slide or zoom | |
| Holds still while | touched and held, under the mouse, or with keyboard focus | |
| Reduced motion | no rotation at all; today's painting stays | |

**Verses (the Home carousel):** the time on screen follows the verse's length, at a calm reading pace for scripture (about 150 words a minute):

| Setting | Proposed |
|---|---|
| Time on screen | **6 s + 0.4 s per word** |
| Minimum / maximum | 10 s / 30 s |
| Examples | 20 words → 14 s; 45 words → 24 s; 70 words → 30 s |
| Progress line | a thin line shows the time left |
| Holds still while | touched and held, under the mouse, or with keyboard focus |
| Moving by hand | swipe or the ‹ › arrows |
| Reduced motion | no auto-advance |

**Never at the same moment (Home):**
- When the verse changes, the painting waits for its next turn, and the other way round.
- A painting change is never scheduled within 4 s of a verse change.

**On Welcome and sign-in:** the verse never changes (it is the verse of the day). Only the painting turns.

## 5. The words on the painting

**The verse panel on a painting:**
- a readable panel (88 % surface colour; frosted glass on the High tier);
- serif italic text at the quote size;
- the reference in small sans text;
- always at least 4.5 : 1 contrast, checked by axe.

**Length rule for the overlay:**
- On a phone, a verse longer than about 240 characters is not laid over the painting. It shows **under** the painting instead, so it never covers more than a third of the image.
- The verse of the day for Welcome and sign-in is chosen from verses of at most 240 characters.

**Titles:** every painting has a short title, used for the line under the Home card. Its alt text gives the title and the pastime ("Darshan: Kirtan with Lord Caitanya — the Lord leads the saṅkīrtana").

## 6. Rules for every new painting (the intake standard, item 12)

1. **Source:** IYF's collection, including paintings by other artists that IYF has confirmed it may use (the head, 9 Oct 2026). No credit line.
2. **Watermarks** (the head, 9 Oct 2026): erase a mark only with a tool that leaves the painting exactly as it was; otherwise **show the painting with its mark** (adjustable later). **Never crop or edit in a way that touches the persona the painting presents.**
3. **At least 1080 px wide.** Flagship paintings at least 1440 px. No upscaling.
4. **No duplicates** (also near-duplicates at another size or crop).
5. **Recorded for each painting:**
   - a title, the deity and the pastime;
   - the focal point;
   - the dominant colour;
   - flagship or everyday;
   - the shapes it suits.
6. **Files and sizes** per §2, checked by a script. A painting that fails any limit is not added.

## 7. Constraints this works within

- **Speed:** the paintings never block the first screen. The Welcome painting is its largest paint, kept under 2.5 s on a mobile connection (Lighthouse mobile ≥ 95).
- **Data:** the free plan serves static files without a cost limit, but devotees' phone data matters. Hence the 6-a-visit cap, the size limits and Data Saver honoured.
- **Store apps:** the Play Store and App Store apps show the same web app, so this standard applies there unchanged. Splash and icons stay the emblem, never a painting.
- **Accessibility:** WCAG 2.2.2 (pause, stop, hide) is met by hold / hover / focus and reduced motion; contrast is met by the panel; alt text describes the darshan.
- **The future:**
  - New screen sizes (tablets, foldables, TVs) get the right file through `sizes` and the 2160 px files.
  - Festival paintings can join the flagship pool for a date range (an optional `from` / `to` in `darshan.json`).
  - Announcements stay the way festivals are told (decided 8 Oct).

## 8. What changes from today (to build once approved)

- **Painting rotation:** from 9 s to 20 s, with a 1.2 s cross-fade.
- **Home:** the painting and the verse are coordinated so they never change together.
- **Verse timing:** from a fixed 9 s to one based on length (10–30 s).
- **Overlay:** long verses go under the painting on phones; Welcome and sign-in use verses of at most 240 characters.
- **Variety:** the 14-day no-repeat rule, and no two paintings of the same deity back to back.
- **Files:** 1440 / 2160 sizes, AVIF and the blurred preview (with item 12).
- **Checks:** a browser test that measures the pace (no two changes at once, the times above) and that no darshan frame is ever blank.
