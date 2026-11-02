# Icons: where they can go, what they cost — Sadhana Record

**18 October 2026. Analysis only; nothing was changed.** Every number below was measured on the live build
(`index-GViiI2CY.js`, released 17:07 IST today) or read from the source. Written for the person deciding what to
build next, and for whoever implements it.

---

## 1. The headline

The icon system is **already good and already cheap**. It is not a case of "we avoided icons to save weight" —
the whole 49-icon set costs **1.8 KB gzipped**, and a new icon costs about **11 bytes gzipped**. Weight is not
what has been holding icons back; nobody wired them into a few specific places, and one bug ships the set twice.

So the honest framing is the opposite of the usual one: **adding icons is nearly free, and the only real cost
risk is the startup budget, which is 94% full for reasons that have nothing to do with icons.**

> **CORRECTION, 18 Oct.** This document originally claimed the icon set shipped twice and that deduplicating it
> would return ~1.8 KB. **That was wrong, and the claim is withdrawn.** `index-D7qH12kY.js` is not a lazy chunk of
> the current build: it is the PREVIOUS release's startup file, which `scripts/carry-assets.mjs` deliberately
> keeps in `dist/` so phones still on the old version can load screens they have not cached. I compared two
> releases and read the overlap as duplication. Caught by prompt-95 and verified here: the current `index.html`
> loads `index-BIZcq6ff.js`, and each icon path appears in **exactly one** chunk. There is no 1.8 KB to win.
> The largest real lazy chunk is Devotee at 28.88 KB, under its 30 KB target — not 31.88 KB over it.
> Everything else below stands.

| Measured today | Value |
|---|---|
| Icons defined | 49, inline SVG, 24 px grid, stroke-drawn, no icon library |
| Whole icon component, gzipped | **1.80 KB** |
| Average icon | 64 bytes raw path data |
| **Marginal cost of one new icon** | **~11 bytes gzipped** (measured: +5 → 64 B, +10 → 112 B, +20 → 214 B) |
| Files using `<Icon>` | 65 |
| Distinct icons actually used | 41 of 49 |
| Startup JS | 56.76 KB of a 60 KB budget — **3.24 KB headroom**, already over the 55 KB target |
| Largest lazy chunk | 31.88 KB, over its 30 KB target |
| Precache | 669 KB of 800 KB — comfortable |

**No defect in how the set is bundled.** Each icon path ships in exactly one chunk (verified on a clean build).
An earlier draft of this document claimed otherwise; see the correction above.

---

## 2. What already works (do not touch)

Credit where due — these are done properly and are the reason the cost is so low:

- **No icon library.** Lucide or Feather as a dependency would be 40–100 KB for the same result. Hand-drawn
  paths on a consistent 24 px grid, 2 px stroke, round caps and joins, `currentColor` for the stroke — so every
  icon inherits the area accent and both themes for free.
- **Navigation is fully iconed.** 19 of the nav items in `lib/nav.js` carry an `icon:` field, used by the bottom
  bar, the rail and the drawer alike.
- **Empty states are iconed.** `EmptyState.svelte` takes an `icon` prop and all 12 call sites pass a meaningful
  one (`users` for no people, `ok` for nothing waiting, `clock` for a missed week).
- **Accessibility is right.** `Icon.svelte` sets `aria-hidden="true"` and `focusable="false"`, so icons are
  invisible to screen readers; `IconButton.svelte` requires a `label` that becomes the accessible name. This is
  the correct split and must be preserved in anything added.
- **Touch targets.** `IconButton` is a 44 px circle, which meets the WCAG 2.5.8 minimum.

---

## 3. Where icons are missing — by route

Sixteen screen files contain no icon at all. They are not equally worth fixing; these are ranked by what a
devotee or coordinator actually gains, not by how many icons could technically be inserted.

### Tier 1 — worth doing (clear user gain, trivial cost)

| Route(s) | File | What is missing | Suggested |
|---|---|---|---|
| `/members` (Devotees) | `coord/Members.svelte` | **This is the case you spotted.** The list draws its own `.mrow` instead of the shared `Row`, so it gets no leading icon chip. Each row is a person with a name and a status, with no visual anchor. | A lead avatar or a `user` chip per row. `Row.svelte` already renders exactly this (`.lico`, 36 px, accent-soft background) — the capability exists and is bypassed. |
| `/card` (My targets) | `screens/Card.svelte` | Eleven lead measures listed as text. The card is the most-read screen for facilitators and trainees and has no visual rhythm at all. | One icon per measure type (`chant` japa, `book` reading, `hear` hearing, `users` outreach, `heart` seva, `spark` goal). This is the single highest-value addition in the app. |
| `/history` | `devotee/History.svelte` | Uses `<Row>` twice but passes **no** `icon`, so the slot renders empty. | `check` for submitted, `clock` for missed. One-line change per row. |
| `/signup`, `/forgot` | `screens/SignUp.svelte`, `Forgot.svelte` | The first screens a new devotee sees, entirely unadorned. | `phone`, `lock`, `user` on the field groups; `shield` on the consent note. |
| `/week` | `devotee/Week.svelte` | Uses `<Row>` twice without an `icon`. | Same fix as History. |

### Tier 2 — defensible, lower priority

| Route(s) | File | Note |
|---|---|---|
| `/scoreboards` | `coord/Scoreboards.svelte` | Empty state is iconed; the board rows and rank column are not. A `spark` or rank chip would help scanning. |
| `/closing` | `coord/Closing.svelte` | Decision rows (promote / hold) would read faster with `up` and `clock`. Note `up` is currently defined but unused. |
| `/reopens` | `master/Reopens.svelte` | Request rows could take `clock` / `ok`. |
| Section headings | across `coord/`, `master/` | ~25 distinct `<h2>`/`<h3>` headings ("Needs you", "System health", "Still to submit"). A 16 px icon before a heading is a cheap, consistent lift — but only if applied as a rule, not scattered. |

### Tier 3 — deliberately leave alone

| File | Why |
|---|---|
| `devotee/Devotee.svelte`, `coord/Batch.svelte`, `master/Admin.svelte` | These are **routers**, not screens. They choose which child to render. Icons belong in the children, which mostly have them. |
| `screens/PhotoCrop.svelte`, `HowTo.svelte`, `DeleteAccount.svelte` | Single-purpose, text-led flows. `DeleteAccount` especially: a destructive confirmation should be plain words, not decorated. Adding a `trash` icon there makes a serious step look like a button. |
| `devotee/HearingPicker.svelte`, `master/Overview.svelte`, `coord/Board2.svelte` | Dense data surfaces. Icons per row would add noise, not meaning. |

---

## 4. Cost analysis, honestly

### What an icon actually costs

Measured by injecting synthetic icons into the real startup chunk and re-gzipping:

| Added | Gzipped cost | Per icon |
|---|---|---|
| 5 icons | +64 B | 12.8 B |
| 10 icons | +112 B | 11.2 B |
| 20 icons | +214 B | 10.7 B |

Gzip compresses path data well because SVG paths share vocabulary (`M`, `h`, `v`, digits), so the marginal cost
*falls* as the set grows. **Twenty new icons would cost about 214 bytes of a 3,318-byte headroom.**

### What is NOT free

Four costs that are real and must not be hand-waved:

1. **Startup budget pressure.** 56.76 KB of 60 KB, already above the 55 KB target, with three WARNs live. Icons
   are not what filled it, but they draw from the same bucket. Anything added to the startup chunk competes.
2. **Markup, not paths.** The path data is trivial; the `<span class="lico">` wrapper, the extra DOM node and
   the CSS rule around each icon cost more than the icon. A chip per row on a 300-row list is 300 extra DOM
   nodes — that is a rendering cost on a low-end phone, not a download cost.
3. **Render cost on long lists.** `/members` and `/board` can show hundreds of rows. An icon chip there should
   be measured with the browser checks on a throttled profile before it is accepted, not assumed free.

### Net recommendation on cost

Tier 1 is about **10 icons, ~110 bytes gzipped**, against 3,318 bytes of startup headroom. Several of those
icons already exist, so the true cost is lower again. The bargain stands on its own: the gain is real and the
cost is a rounding error. (It would have been better still had the deduplication been real — it was not.)

---

## 5. Design rules for anything added

As a system, not a scattering:

1. **One meaning, one icon.** `users` already means "a group of people" in six places. Never introduce a second
   people-icon for the same idea.
2. **Icons support text; they never replace it.** The only icon-only controls are `IconButton`s with an
   `aria-label` (call, WhatsApp, more). Keep it that way — an icon-only nav item is a guessing game.
3. **Never the only signal.** The app already honours this for colour; the same holds for icons. A status must
   read as a word, with the icon as reinforcement.
4. **Stroke-consistent.** 24 px viewBox, 2 px stroke, round cap and join, `currentColor`. A filled or
   differently-weighted icon will look foreign immediately.
5. **Sizes already in use:** 16 px inside buttons, 18 px in rows and `IconButton`s, 22 px default, 24 px in
   empty states. Do not invent a sixth size.
6. **Restraint.** House rule from the rotators: visuals hold still and stay quiet. No animated, spinning or
   pulsing icons; `refresh` should not spin.
7. **Prune while adding.** A first grep suggested eight unused icons; checking each one, **four of those are
   actually in use** through data rather than a literal `name="..."` — `home` (`nav.js:36`), `menu`
   (`Shell.svelte:158`), `theme` and `sun` (both `Menu.svelte:23`, the theme switcher). Only **`body`, `pause`,
   `up` and `eye`** are genuinely dead, and `up` is wanted by Tier 2 anyway. So this is worth about three icons
   — a rounding error, listed only so nobody deletes a live one on the strength of a naive grep.

---

## 6. Suggested order of work

| Step | What | Cost | Risk |
|---|---|---|---|
| 1 | ~~Fix the duplicate icon set~~ — **withdrawn, the finding was wrong** | — | — |
| 2 | `/card` measure icons (6 icons) | ~70 B | Low |
| 3 | `/members` row chips | ~0 B (reuse `Row`) | **Medium — measure render cost on a long list** |
| 4 | `History` + `Week` row icons | 0 B (icons exist) | Low |
| 5 | Sign-up / Forgot field icons | ~30 B | Low |
| 6 | Tier 2, if still wanted after seeing 2–5 | ~100 B | Low |
| 7 | Remove the 4 genuinely dead icons (`body`, `pause`, `eye`, and `up` only if Tier 2 is dropped) | ~45 B | Low |

Steps 2, 4 and 5 use icons that already exist, so they cost nothing but markup.

### Before any of it ships

- `npm run size` must stay inside budget, and ideally move the three WARNs back under target.
- Screenshots on phone and desktop, light and dark, per the standing rule for new or changed screens.
- Browser checks for any list that gains a per-row node.
- This is a **PATCH** under the release policy (fixes and additions to built screens), unless `/card` icons are
  treated as a new visual feature — then it is a BULK with a phase bump.

---

## 7. What I did not verify

- **Render cost of per-row icon chips on a real low-end phone.** I measured bytes, not frames. Step 3 above is
  the only item where the cost could turn out to matter, and it should be measured rather than assumed.
- **Carried-over release files.** I did not check, before writing the first draft, that every `index-*.js` in
  `dist/assets` belongs to the current build. It does not: `carry-assets.mjs` keeps the previous release's files
  there on purpose. Any future bundle analysis here must start from `dist/index.html` (or a clean
  `vite build --outDir /tmp/...`), never from a listing of `dist/assets`.
- **Render-cost assumptions beyond bytes.** Everything about download size is measured; nothing about frame
  time is.
- Nothing in this document has been implemented.
