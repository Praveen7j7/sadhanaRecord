# Copying the app's books into the "books" folder (Phase 22 D1)

The head (26 Oct 2026): store every book the app uses in the Drive folder
[books](https://drive.google.com/drive/folders/1bg9AMv4qfN4IlpikXX2VxoprApR1gmNf), owned by
**iyfdelhireadinghearing@gmail.com**.

## What is copied

| | |
|---|---|
| Files | 462 PDFs (81 English, 381 Hindi), 0.54 GB, so it fits in the free 15 GB |
| From | hearingandreading.1@gmail.com (83) and pushpendersinghal@gmail.com (380), shared by link |
| Into | `books/English/<book>` and `books/Hindi/<book>`, 77 book folders |
| Sharing | every copy and the folder are set to **Anyone with the link · Viewer** |

The folder was shared as **Anyone with the link · Editor**. With that setting, anyone who has a book link could
replace or rename the book. The script sets it to Viewer.

The original files are not changed. Nothing in the app changes until the relink migration is applied at release.

## The head's step (about 10 minutes)

1. Sign in to Google as **iyfdelhireadinghearing@gmail.com**, open <https://script.google.com>, and choose **New project**.
2. Delete what is in the editor. Paste the whole of `sadhanaRecord/tools/books/out/Code.gs` and save.
3. Choose `copyBooks` in the function list and press **Run**. Allow the Drive permission it asks for. Google shows
   "unverified app" because this is your own script: choose Advanced, then Go to the project.
4. It copies for about 5 minutes, then sets itself to carry on a minute later, until all 462 are done. Open
   **Executions** to watch: the last line says `Finished: 462 of 462 copied`.
5. Tell Claude. Claude runs `node tools/books/relink-sql.mjs 0069`. That checks every file has a copy and writes the
   migration that points the app at the copies. The rollback is written beside it.

## Afterwards

- Keep iyfdelhireadinghearing@gmail.com safe: 2-step verification, a recovery phone, and a sign-in at least once a
  year (`DRIVE_FILES_2026-10-23.md` checklist).
- Never move these copies to another account. Moving them changes their ids and breaks the app's links.
- `app-links.json` in the folder records which original became which copy. Leave it there.
