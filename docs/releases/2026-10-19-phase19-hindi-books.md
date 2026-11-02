# 19 October 2026 — phase 19: Hindi books

**Live:** server half on 19 Oct, 15:12 IST: migration `0058` applied, then API Worker `be468dd6` (through `npm run deploy`).
D1 Time Travel bookmark taken just before the migration, to restore if ever needed:
`000003cd-00000004-00005109-b2b8fc63c3bcab89bbdb8f9f2ab0faa2`. Checked on live after it: 60 Hindi files, 96 English,
349 chapters, 19 books with a Hindi title, `journals_version` j3; `books.chapters` answers (login required).
App half LIVE 21 Oct 2026, 11:32 IST: `index-BFsEoGYS.js` (build 2026.10.21-1131, app Worker `9a696441`), through
`npm run release`, recorded by the gate as phase 19. Released together with prompt-8d's phase-20 UI/performance work, as
the head asked. Confirmed on live: the Reading switch, the remembered section and the हिन्दी label are in the served files;
the chapters list is its own file (`BookChapters-*.js`, loaded only when opened); `books.chapters` answers (login required).

The head's request: "English section for English books, Hindi section for Hindi books. And map them according to the
cantos, to the volumes ... and wire them to wherever the reading is getting rendered."

## The source

Drive folder `1W232SB2ZRMJzYTPt_Id3oSgHrm1v7Xhq`, read with **every** folder and subfolder by
`setup/list-drive-folder.mjs` (read-only, build service account): **19 folders, 384 PDFs**, saved as
`setup/data/book-files-hindi.json`.

| Folder | Files | Where it went |
|---|---|---|
| Śrīmad-Bhāgavatam (Hindi) Cantowise | 19 (12 cantos; 1, 3, 4, 11 in two parts, 10 in four) | each canto's book (B59–B70); all of them under the complete set (B58) |
| Śrīmad-Bhāgavatam (Hindi) Chapterwise / Canto-1 … Canto-12 (Canto-10 / Part-1 … Part-4) | 349 (335 chapters + 13 Contents + 1 Introduction) | each canto's chapters (`book_chapters`), grouped by part; counts match the Bhāgavatam: 19, 10, 33, 31, 26, 19, 15, 24, 24, 90, 31, 13 |
| Śrī Caitanya-caritāmṛta (Hindi) | 9 volumes (khaṇḍa) | Ādi 1–2 → B72, Madhya 3–7 → B73, Antya 8–9 → B74; all nine → B71 |
| `KRSNA_Book(Hindi).pdf` | 1 | Krishna: The Supreme Personality of Godhead (B31) |
| `श्रीमद्-भगवद्-गीता यथारूप.pdf` (678 pages), `…1980_ORIGINAL_EDITION.pdf` | 2 | Bhagavad Gita As It Is (B55), beside the 876-page Hindi PDF already linked |

Every file was matched by a fixed rule from its folder and name (`setup/build-hindi-books-sql.mjs`), never by
similarity; the generator stops if a canto's chapter count, the volume count or a file name is not what it expects.
Files whose name did not say what they were were opened (first page) before deciding.

## Left out — for the head to decide

| File | Why |
|---|---|
| `upadeshamrta_4th_ed_hindi.pdf` | Gauḍīya Vedānta Prakāśana's edition (Śrī Śrīmad Bhaktivedānta Nārāyaṇa Gosvāmī Mahārāja), not Śrīla Prabhupāda's *Nectar of Instruction*. Not linked to B51. |
| `Bhagavad-gita_Yatharupa.pdf` | The same 876-page Hindi edition already linked to B55 (same preface, same page count). Not added twice. |
| `The_Nectar_of_Devotion-1970_ISKCON_Press_edition-Hardcover-SCAN.pdf` | English (the 1970 first edition), not Hindi. |
| `Rupa_Goswami_Bhakti_rasamrta_sindhu.pdf` | English translation of Rūpa Gosvāmī's text; not a book on the reading list. |

## What changed

| | |
|---|---|
| Migration `0058_book_languages.sql` (generated) | additive: `book_files.lang` (default `en`, so every existing file stays English), `books.title_hi`, `books.chapters_hi`, new table `book_chapters`; 59 Hindi volume/part rows, 349 chapter rows; the Hindi Gītā already linked moves to the Hindi section; `journals_version` j2 → j3 so phones fetch the new list once |
| `journals.get` | a Hindi file carries `lang: "hi"`; a book with a Hindi edition carries `titleHi`, a canto `chaptersHi`. Books without a Hindi edition keep exactly their old shape (tested) |
| `books.chapters` (new, read-only, any signed-in person) | one canto's chapters, read by key only when opened — the 349 rows are never in the book list, so the free-plan rows-read budget is untouched by them |
| Reading | **English / हिन्दी** switch above the levels. English is every book, as before. हिन्दी lists only the 19 books with a Hindi PDF, under the Hindi title with the English one beneath; level chips follow the books present; search finds either title. A canto opens to its parts and a **Chapters** list (grouped by part, loaded on tap). The choice is kept in the address (`bl=hi`) and on the phone. The current book shows the chosen section's PDFs (English when it has no Hindi one). |
| Day form book picker | unchanged (English files, every book) |
| Sheets copy (paused) | `BookChapters` tab and the new columns defined in `setup/schema.mjs`; `book_chapters` registered with the mirror |

## Also in this release — phase 20: UI/UX modernization and performance (prompt-8d)

The head asked for both builds in one release. This half is **frontend only**; it needs no migration and no worker
change. Built in `sadhanaRecord-revamp/`, phases 1–4 of `docs/MERGED_UIUX_PERF_PLAN_2026-10-19.md`, then copied
into this tree for the single gate run below.

| Area | Change |
|---|---|
| Admin toolbar | Export sat in its own row above every admin page, the page put its count and primary action in a second row, and Refresh in a third — three lines of chrome before the list on a phone, each aligned differently. `Admin.svelte` now passes Export to the page as a `tools` snippet and Overview, Staff, Facilitators, Batch setup and Reopens lay Refresh · Export · primary action in one `.ph-tools` cluster in their own head. Batch setup's explanatory sentence became the batch count (the head's rule: the screen explains itself). |
| **A real bug — "Opens Sun" for every batch** | Both attendance boards printed a hard-coded "Opens Sun" on a row that cannot be marked yet. The 17 Oct class-day change moved the gates to each batch's own day but missed these two screens — the **third** place it was missed, after the gates themselves and the devotee's week view (fixed 17 Oct). Both now read the batch's own day from `attendanceOpensAt` (new `dowShort()` in `lib/dates.js`). No weekday batch exists yet, so nobody saw it; the first training batch would have. |
| Screen-reader names | Sweep over 60 route loads: 0 blocker, 0 major, 12 minor (6 distinct). Three fixed: eight buttons all called "Edit" on the batch table, and "Present"/"Absent" announced 14× on one board — each now carries the person's or batch's name. Two accepted with reasons (the signed-out `document.title`, read before the title effect runs; Account's two-column tab order, which is the reading order by design). |
| **One call on a devotee's repeat open** | Every open asked twice: `auth.me` for identity, `home.get` for the weeks. `home.get` already carried the same `user` object (`weeks.js:303`), so for a devotee this phone has shown before the first answer serves both. Gated narrowly on `kept && scopesOf(kept).devotee`; a cold open, staff, a changed role and a different person all still ask `auth.me`, and a missing `user` falls back. **The mock was fixed first** — the worker returned `user`, the mock did not, so the browser checks would have proved the wrong thing. |
| Timer cleanup | `Darshan.svelte`: a painting's `decode()` and an `<img>` `onload` set timers that wrote component state on their own clock, so they could fire after the screen was gone — the same shape as the wheel picker's settle timer, which reached a devotee as a page error in phase 18. All tracked and cleared on unmount. |

**Measured, not assumed.** Startup JS 56.87 KB of a 60 KB budget — **+0.11 KB for a whole round trip removed**.
One regression caught in the same pass: importing a constant from `weekstore.js` pulled the week store and
`daylogic` into the startup chunk, +1.63 KB, the entire remaining headroom; the constant is declared locally
instead. Long lists were measured rather than feared: `/members` is paged at 50 and renders 12 rows at ~635 DOM
nodes with forced layout under 0.1 ms on a 4× throttled CPU, so the icon-chip worry that blocked that screen does
not survive contact with a measurement. PBKDF2 was measured (10k = 0.78 ms, 25k = 1.84, 50k = 3.62, 100k = 7.29 on
a Mac) and **not changed**: the 10 ms cap covers the whole request, and the number that matters comes from the
load Worker, not a laptop. Recorded for the head to decide.

**Withdrawn after looking.** Two items in the 19 Oct status map were assigned from line counts rather than from
the screens: the facilitator and admin lists are finished, not "plain", and `Board.svelte` / `Board2.svelte` are
two different screens, not a duplication. Both corrected there.

## Tests

| | |
|---|---|
| Gate (`gate.mjs checks 19`, combined tree, source `2970418d6e61c68a`, 19 Oct 16:29 IST) | verify 1,885 · components 219 · back-guard 17 · motion 27 — 0 failed, 0 page errors |
| Server | 55 suites · 2,930 assertions · 0 failed; `audit:sql` 0 new scans, 0 new mass writes, phones clean |
| Client | 445 tests · 0 failed (incl. `booklang.test.js`, and a same-tab reload test that is red on the old session code) |
| Sizes | startup JS 56.90 KB of 60; largest lazy chunk Devotee 29.41 KB, under its 30 KB target (BookChapters loads on demand) |
| Release | the open page moved to the new build by itself; every staff screen loads; 11/11 live smoke |

Gate runs before the green one, each fixed at its cause:
1. Devotee chunk 30.13 KB, over target → the chapters component is imported on demand (29.40 KB).
2. "the menu drawer opens" crashed: leaving the day before its save landed rightly asked "Save changes before leaving?",
   which covered the menu → the check now waits for the save (30 s) and cannot crash the run.
3. "swipe to the next day" failed every Monday (tomorrow is the future, which never opens) → it expects that on Mondays.
4. Combined tree: the tiers check waited for Login in vain after a reload — a real regression in the one-call-at-open
   change (a tab's cached Home stood in for the server's answer, so an ended session stayed open). Fixed by prompt-8d
   (`session.svelte.js`: fresh home.get at open, its error re-raised); guarded by a fail-first unit test. The Hearing
   count check was intermittent and now waits for the count itself.
