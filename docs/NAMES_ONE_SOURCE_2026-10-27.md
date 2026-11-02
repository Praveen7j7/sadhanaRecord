# One name, one place — why a rename does not reach every screen, and the plan to fix it

*27 Oct 2026 · for the head (Praveen Jha) and every session that works on Sadhana Record · nothing here is built yet*

## What the head asked

> "If my name is changed from the admin, as a facilitator login, every screen where the facilitator's name appears —
> the start-up screen, the scroller, the wheel, everywhere — should show it. Not that ten places copy the same thing.
> And this applies to everything."

The rule this asks for: **a name is stored once, on the person or facilitator it belongs to. Every other place
points to that record by a permanent id and reads the name from it when it shows it.** A rename is then one change,
and every screen, list, picker, post and count follows on its own.

## How it works today

| Kind of name | How other records point to it | Follows a rename? |
|---|---|---|
| Batch | by `batch_id`; the name is read when shown | ✅ already right |
| Coordinator, group leader (ADR 0019 roles) | by login | ✅ already right |
| Person (devotee, coordinator) | `accounts.name`, but also copied to `profiles.name` and `persons.display_name` | ⚠️ partly |
| **Facilitator** | **the name text itself is the key.** `facilitators` is keyed on the name, and six other places store the name again | ❌ only where `facilitators.rename` remembers to copy it |

`facilitators.rename` (`worker/src/facilitators.js:96`) tries to keep the copies in step. That is the "ten places copying
the same thing" the head described, and it already misses places.

### What a facilitator rename misses today (checked in the code, 27 Oct)

1. **Posts to "my students".** They are addressed `STU:<name>` (`announcements.js:31`). After a rename, the
   facilitator's earlier posts no longer reach their students, and the scheduled reminders in `push_jobs` miss too.
2. **The promotion count on the phase card.** It counts students through *closed* membership rows by the old name
   (`phases.js:633-639`), so the renamed facilitator's earlier promotions drop out.
3. **Past weeks on the board and the facilitator's own list.** These read memberships by name (`board.js:41,57`,
   `facilitator.js:130`). A past week then lists the renamed facilitator's former students under nobody.
4. **A linked devotee or trainee.** `facilitators.rename` leaves a devotee's own name alone, and a devotee renaming
   themselves (`profile.update`) leaves the facilitator list alone. One person ends up with two names.

### What a person's own rename misses today

`profile.update` and the admin's coordinator edit update `accounts.name` (and `profiles.name`), but not:
- `persons.display_name` (the IYF identity record, used for the masked name at sign-up);
- the author name on their posts and comments (`announcements.author_name`, `post_comments.name`);
- the facilitator list, if they are a facilitator or trainee.

### Copies kept on the phone

| Copy | What it holds | Refreshed |
|---|---|---|
| `sr.user` | your name, your facilitator's name | on every start (`home.get` / `auth.me`); stays old while offline |
| `sr.meta` | batch names, **the facilitator wheel** | only when a screen asks; **nine screens read it and never refresh it** (Home, Devotee Home, Account, Activity, Birthdays, Reopens, Report, Sign-up card, Export sheet) |
| home / profile / wall caches | names inside the last replies | shown first, then re-fetched |

The splash screen shows no name. The Login greeting reads the live name from the server.

## The design

1. **Every facilitator gets a permanent id**, e.g. `F014`, which never changes and is never reused. The name becomes
   a field on that row, not its key.
2. **A facilitator who has a login is the same record as that login.** The name lives in one place, so renaming
   Devesa Hari in Admin › Facilitators and renaming his account are the same change.
3. **Every reference stores the id:** memberships (open *and* closed), the account's facilitator, a pending sign-up's
   choice, `STU:<id>` post audiences, push jobs. Counts and past weeks then follow the person, not the spelling.
4. **The name is read when a screen is drawn.** The facilitator table is about 60 rows. It is read inside the same
   `reads()` batch each action already makes, so there is no extra round trip and only a few rows read.
5. **History is kept as it was.** The audit log, closed weekly records and the Sheets snapshots record the name as it
   was on that day; that is what they are for. Live screens always show the current name through the id.
6. **Old names still resolve.** A `facilitator_names` list keeps every earlier spelling, so an old link, an import or
   a name typed in an older record still finds the right facilitator. This is the identity rule already in force: person ≠
   identifier ≠ name, and old ones resolve forever.
7. **One rename action per kind.** A single `renamePerson(login)` updates the account and the identity record together.
   `profile.update`, the coordinator edit and the facilitator rename all go through it. No other code writes a name.
8. **The phone follows the server.** The facilitator wheel and batch names come with the first reply on start, at no
   extra call, and the nine screens read that. Anything the phone saved is replaced by the fresh reply, as `sr.user`
   already is.

## How we get there without risking live data

Additive steps, each backed up first (`impl/baseline/`), each with tests that fail before the change:

| Step | What changes | Can be rolled back by |
|---|---|---|
| 1 | Add the id columns, give every facilitator an id, fill the new columns from today's names (a migration) | ignoring the new columns |
| 2 | Every write stores both the name and the id | the old reads, which still work |
| 3 | Every read uses the id. The four misses above are fixed by this step | switching the reads back |
| 4 | Rename becomes one row; `renamePerson` for people; the phone gets fresh names on start | the previous release |
| 5 | After one clean week, stop writing the name copies. Columns are kept, never dropped | — |

It is its own phase (Phase 24), after the Phase 23 release, with one gate and one deploy as usual. Roughly 30 server
files read facilitators by name. Each read gets a test proving that its reply is unchanged before and after.

## What stays outside it

- **The Facilitator Dashboard is no longer part of the picture** (the head, 27 Oct 2026: the app is fully self-contained
  and searches only itself). The app stops reading its Devotees tab and NameMap, and the rename reply no longer asks you
  to change the NameMap. The `registry` table stays as a frozen snapshot for the IYF ID matches it already holds.
- **The Sheets copy** is paused. Its keys follow the ids when it is switched back on.
- **Free-text fields** (who connected you, emergency contact, parents) are not references and stay as typed.
