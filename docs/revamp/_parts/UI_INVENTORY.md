# Current-state UI inventory: Sadhana Record frontend (`sadhanaRecord/frontend/src`)

I read every screen directly from the code. File paths are relative to `/Users/maclapctp409/Downloads/hpStuff/prompt/sadhanaRecord/frontend/src/`.

## 0. Shared building blocks

| Primitive | Behaviour |
|---|---|
| `ui/Sheet.svelte` | A native `<dialog>`: a bottom sheet on phones, a centred dialog from 600 px. Defaults: `dismiss=true` (a tap on the backdrop closes it), `closeButton=true` (shows ✕), `back=true` (phone Back closes it, via `backclose.js`). Escape always closes. Focus returns to whatever opened it. |
| `Banner` | Kinds are `err` (default, `role=alert`), `ok`, `info` and `warn`. With `onretry` it shows a "Try again" button (the label can be changed). |
| `toast()` (`lib/pro.svelte.js`) | Kinds are `ok`, `info` and `err`. Shown for 5 s, or 7 s for errors. At most 3 at once. Can carry an action button ("Undo"). Errors are announced assertively. |
| `Skeleton` kinds | `cards` (default), `page`, `home`, `list`, `form`, `board`, `detail`, `chart`. Screen-reader text: "Loading…". |
| `Refreshing` | Shows "Refreshing…" while loading; otherwise a "Refresh" text button. |
| `SlowHint` | After 2 s: "Still working — this can take a few seconds". |
| Generic error texts (`errorMessage`) | NETWORK "No connection, try again" · TIMEOUT "The server is not answering. Please try again in a moment." · BAD_CREDENTIALS "Phone or password is wrong" · PENDING_APPROVAL "Waiting for your coordinator's approval" · INTERNAL "Please try again" · BUSY "The server is busy, please try again" · UNAUTHENTICATED "Please log in again" · LOCKED_OUT "Too many wrong tries. Try again after …" · fallback "Something went wrong" |
| Field validation | `NumInput`: "Numbers only" / "Between {min} and {max}" / "Whole numbers only" / "In half hours (0.5, 1, 1.5 …)". `passwordProblem`: "Use at least 8 characters" / "Use at most 64 characters" / "Password cannot be your phone number". |
| Shell | Offline strip: "You're offline — changes stay on this phone". Toast "Back online" (info, 3 s). |
| App-level screens | Load failure: Banner err "Could not load this screen. Check your connection and reload." with a "Reload" button. Unknown route: EmptyState "Page not found" / "The link may be old or mistyped." with a "Go to Home" button. Wrong role: EmptyState "Not available to you" / "This page belongs to another role." with "Go to Home". |

---

## 1. Forms

### 1a. Public / auth

| Screen | Fields (component · validation) | Submit | Success / error | Guard / draft |
|---|---|---|---|---|
| Welcome `/welcome` | No form. Two links: "Login" and "Create an account". | — | — | — |
| Login `/login` (`Plain` "Login") | "Phone or username" TextInput, required ("Enter your phone or username") · "Password" TextInput password with eye button, required ("Enter your password") · link "Forgot password?" | "Login" / "Logging in…" + SlowHint | Success: goes to the saved return path, `/change-password`, or `/home`. Error: Banner err. Info Banner "You were logged out. Please log in again." when the session expired. | None |
| Forgot `/forgot` | "Phone or username" (required) · "New password" (hint "8 to 64 characters", `passwordProblem`) · "Confirm new password" ("Passwords do not match") | "Ask for reset" | Success: title becomes "Request sent", EmptyState ok "Waiting for your coordinator" / "Until then, your old password still works." with "Back to log in". Error: field error or Banner. | None |
| Sign-up `/signup` (wide `Plain`) | Section **About you**: "Mobile number (for login)" tel (`isPhone`, "Enter your 10-digit mobile number") · Seg "Is this number on WhatsApp?" Yes/No (required, "Choose Yes or No") · if No: "Your WhatsApp number" (optional) · "Full name" ("Use 2 to 60 letters and spaces") · "Email" (required, typo hint "Did you mean …?") · DateInput "Date of birth" (age 12–80) · WheelSelect "Blood group". Section **Your address**: AddressFields (Country fixed "India", WheelSelect State, WheelSelect District for Delhi or TextInput "City or town", "Area or locality", "House and street", "PIN code"). Section **Your batch and class**: WheelSelect "Batch" (hint "Coordinator: …") · Seg "Which class do you attend?" Sunday/Saturday · WheelSelect "Your facilitator". Section **Password**: "Password" + "Confirm password". Section **Emergency contact**: "Name" · WheelSelect "Relation" · "Mobile" (must differ from own number). | "Sign up" + SlowHint. Link "I already have an account". | Success: "Sign-up sent", EmptyState ok "Waiting for your coordinator's approval" / "You can log in once it is approved." Error: Banner "Please fix the marked fields." and focus moves to the first invalid field. If batch data fails to load: Banner err. | None |
| Change password (forced page, also inside Account) | "Temporary password" (forced) or "Current password" · "New password" (hint "8 to 64 characters") · "Confirm new password" | "Change password" | Success: Banner ok "Password changed."; a forced change then goes to `/home`. Wrong current password: field error "Your current password is wrong". | None |

### 1b. Devotee

| Screen | Fields | Submit | Success / error | Guard / draft |
|---|---|---|---|---|
| Day form `/day/<w>/<d>` (also `/fill/<login>/day/...`) | **Body**: TimePicker "Slept at (last night)" and "Woke up at"; NumInput "Day rest" (minutes, 0–600). **Chanting**: NumInput "Rounds chanted" (0–64); TimePicker "Chanting finished at"; Seg "Completed the same day?" Yes/No. **Hearing**: NumInput "Hearing" (minutes, 0–600); "Topic (required)" when minutes > 0, chosen with the "Choose a topic" button (HearingPicker: "Type the topic" input + "Add", 2–120 chars, at most 8 topics; or Choose/"Chosen ✓" from the lecture list). **Reading**: NumInput "Reading" (minutes); "Book (required)"; "Same book as before: …"; BookPicker "Change book" (Choose, or "Other book" + "Use", 2–120 chars). **Seva and other**: NumInput "Service" (0–999); TextInput "Service topic" (optional, 120); NumInput "Exercise (optional)"; NumInput "Study / job (optional)" (hours, half-hour steps, 0–24). **Chetna** (if offered): Positive/Negative toggle chips. **Comment**: TextArea (optional, 500, counter). Above the form: "Still needed" + the list of missing items. | Sticky action bar: "Day score" + n/100 · Share icon button (disabled while there are unsaved changes) · "Save changes" / "Saving…" / "Saved ✓" | Success: haptic buzz. Stale copy: Banner "This day was changed on another device. Your changes here were not saved." Server validation: Banner "Some answers need fixing." plus field errors. Offline: label "Not sent · no connection". Error: "Not saved". | **Yes**: an IndexedDB draft per day, a leave-guard sheet, `beforeunload`, and app updates wait for it. |
| Week `/week/<w>`: end of week | Seg "Night Stay" Yes/No · Seg "4 regulative principles followed" Yes/No. Before Saturday 6 PM, replaced by "Night Stay and the 4 regulative principles open on Saturday at 6 PM." | "Save changes" / "Saving…" / "Saved ✓" | STALE: Banner "Updated on another device. Showing the latest answers." NETWORK: "Not sent — no connection. Tap Save again when online." | **Yes**: leave-guard sheet and `beforeunload` (in memory only, no stored draft) |
| Week: attendance | Seg "Your attendance this week" Present/Absent. Disabled when locked or before Sunday ("Attendance opens on Sunday, the day of the class."). | Saves on tap (optimistic) | Error rolls back and shows a Banner. | — |
| Week: submit | Button "Submit week" or "Submit n of 7 days" (disabled while end-of-week answers are unsaved: "Save the end-of-week answers first.") | Inline confirm (§2) | Success toast "Week submitted. Hare Krishna!" (or "Submitted for {name}"). INCOMPLETE: Banner with a list of tappable gap links. | — |
| Account › name | Pencil, then "Your name" (max 60) | "Save" / "Saving…" + "Cancel" | Toast "Name saved."; error shown under the field. | — |
| Account › Profile sections (`EditSection`: read-only until the pencil is tapped; one section open at a time) | **About you**: Seg "Which class do you attend?", DateInput "Date of birth", WheelSelect "Blood group". **Contact details**: "Email" (`emailProblem`), "WhatsApp number" (optional, "Enter a 10-digit WhatsApp number, or leave it empty"). **Address**: AddressFields. **Emergency contact**: "Name", WheelSelect "Relation", "Mobile". **Facilitator** (devotees only): WheelSelect "Your facilitator" (hint "If your facilitator has changed, choose the new one."; error "Choose your facilitator from the list."). Empty values show as "Not added". | "Save" (disabled when nothing changed) + "Cancel" | Toast "{Section} saved."; Banner err inside the section. | None |
| Account › Photo | File input "Add a photo" / "Change photo" (must be image/*: "Choose a photo (JPEG or PNG).") → PhotoCrop (drag; "Zoom" range 1–4; hint "Keep your face in the circle."; "Opening the photo…") · "Remove photo" | "Use this photo" + "Cancel" | Toast "Photo saved." plus inline success. Errors: "That file could not be opened as a photo. Choose a JPEG or PNG photo." / "Could not prepare the photo. Try another one." | — |
| Account › Notifications | Reminder toggle "{9 PM} reminder and announcements". Notes: "Your browser can't show reminders." / "On iPhone: Share → Add to Home Screen, then open it from there." / "Notifications are blocked. Allow them in your browser settings." / "Checking…" | Saves on toggle | Errors: "Reminders work in the installed app or the published site, not here." / "Could not change the reminder." | — |
| Account › Delete account | Button "Delete my account…" opens the sheet: "Your password" (password) · "Type DELETE to confirm" | "Delete account" / "Deleting…" (disabled until both are filled) | Success goes to `/welcome`, toast "Your account has been deleted." Wrong password: field error. Staff instead see "You're a {role}, so your account can't be deleted yet…" | — |
| Announcements: comment | Input "Write a comment…" (max 500) | "Send" (disabled when empty) | Error toast | — |

### 1c. Group leader: My group `/group`
P/A toggle buttons on each member row (tap again to clear). An action bar appears when there are changes: "{n} attendance change(s) not saved" · "Undo" · "Save attendance". Success shows a toast with Undo; an error shows inline in the bar. No leave guard.

### 1d. Coordinator

| Screen | Fields | Submit | Success / error |
|---|---|---|---|
| Requests: sign-up approval card (`SignUpCard`) | RadioGroup "Registry match" (disabled for linked or merged IDs; warning "Phone matches, but the name is different — check this is the same person."; option "Not in the registry yet — approve with no ID") · "Pick another ID" opens TextInput "Search name, IYF ID or phone" (at least 3 chars, 400 ms debounce, "Use" per result, "No results.") · WheelSelect "Facilitator" (required) · DateInput "Level-entry date" · Seg "Class day (chose X; correct it if needed)" (required) | "Approve" · "Reject…" | Toast "Approved and linked to {id}" or "Approved; the IYF ID will be linked automatically". Validation: Banner "Choose an ID match, or approve with no ID.", "Choose the facilitator", "Choose the class day: Sunday or Saturday". |
| Reject reason (inline in the card) | "Reason for rejecting" (at least 2 chars: "Give a reason") | "Confirm reject" · "Cancel" | Toast "Rejected {name}" |
| Requests: password reset | No fields. Warning Banner "Before approving, call {name} on {login} and confirm…" | "Reject" · "Approve" (no confirm step) | Toast "Password reset approved" / "Password reset rejected"; Banner err. |
| Board attendance `/batch` | P/A per row; "Present"/"Present ✓" only in a "marked" no-class week. Filters: tappable count segments and Search "Search by name". | Action bar: "Undo" · "Save attendance" (sent in parts of 250) | Toast with Undo; inline error. |
| Class-week sheet "No regular class?" | Seg "Why" Holiday/Festival/Other · TextInput "What is it?" (placeholder "e.g. Diwali", 80) · Radio "Attendance this week": "Everyone present" / "Only those I mark present" (required, "Choose one.") · for the IYF head after the deadline: "Reason (the deadline has passed)" | "Save" · "Cancel" · "Back to a regular class" (danger) | Toasts with Undo; inline `err`. |
| Leaders: appoint `/leaders` | WheelSelect "Devotee" ("Choose a devotee") | "Appoint" | Toast "{name} is now a group leader."; Banner err. |
| Leaders: assign (sheet) | Checkbox per devotee who is in no group | "Add {n}" · "Cancel" | Toast "{n} devotee(s) added to {leader}'s group." |
| Leaders: take out / remove | IconButton ✕ per member (no confirm) · "Remove leader" (inline confirm) | — | Toasts (§3) |
| Members `/members` (filters) | Search "Name, phone or IYF ID" (300 ms) · WheelSelects Batch / Class / Blood group / Sort · Seg All/Active/Inactive/Disabled with counts | — | — |
| Devotee detail `/devotee/<login>` | **Facilitator and class**: "Change" → WheelSelect "Facilitator" + Seg "Class day", then "Save" → confirm "Yes, save". **Mark inactive / Make active again**: WheelSelect "From" (week choices). **Disable / Enable login**. **Remove photo**: "Reason". **Delete account**: "Type the phone number ({login}) to confirm". **Missed week**: coordinator "Ask to reopen" (Reason) / head "Reopen this week" (Reason + DateInput datetime "Open until (Indian time)"). **Head only**: P/A per week (Reason) and "Change attendance" (WheelSelect Week, Seg Present/Absent/Clear, Reason). Links "View" and "Fill {this week} (week of …)". | Each action opens an inline confirm (§2). | Toasts (§3); errors via ValidationMessage inside the confirm. |

### 1e. IYF head (Admin)

| Screen | Fields | Submit | Success / error |
|---|---|---|---|
| Coordinators: New/Edit sheet | "Username" (new only; `isUsername`, "Use 3 to 30 lowercase letters, digits, . _ -") · "Name" ("Enter a name") · "Phone" (optional) · Checkbox "Batches" (desc "Now with …"; legend desc "Moving a batch ends the other coordinator's access to it at once.") · "Temporary password" (new only, 8–64) | "Create coordinator" / "Save" + SlowHint | Toast "Created {u}. They must change the temporary password at first login." / "Saved"; Banner err. |
| Coordinators: Reset password sheet | "New temporary password" (8–64) | "Set password" | Toast "Temporary password set for {u}. They must change it at next login." |
| Facilitators: add (inline card form) | "Add a facilitator" (placeholder "e.g. Madhav Das Prabhuji"; Add is disabled under 3 chars) | "Add" | Toast "{name} added. It is offered at sign-up now."; field error. |
| Facilitators: list | Search "Name" · chips All / Switched on / Switched off · on/off switch per row | Saves on toggle | Toast with Undo. |
| Facilitators: Access sheet ("Give access" / "Access") | Create: Seg "Do they use the app already?" ("Yes, as a devotee" / "No, a new login"); then either "Their mobile number" → "Give access", or "Username" + "Temporary password" → "Create login". Manage: details list + "New temporary password" → "Reset password", plus "Remove access" or "Switch on"/"Switch off". | — | Toasts (§3); Banner err. |
| Batches: Add sheet | "Name" ("e.g. SPS Group 3") · "Short ID" (max 8) · Seg "Level" SPS/DPS/BSS/BVS · Toggle "Pilot batch" | "Add batch" | Toast "Added {name}. Add its coordinators with Edit." |
| Batches: Edit sheet | "Name" · Checkbox "Coordinators" · Toggle "Active" ("Shown on the sign-up page") · Toggle "Pilot batch" | "Save" | Toast "Saved {name}". |
| IYF IDs: search | "Search name, IYF ID or phone" (at least 3 chars, 400 ms) | — | — |
| IYF IDs: link/unlink (inline in the card) | Link: "Phone of the devotee's account" + "Reason". Unlink: "Reason". | "Link" / "Unlink" | Toast "{id} is now linked to {login}." / "{id} is no longer linked." |
| Reopens | "Reason (kept in the log)" + DateInput datetime "Open until (Indian time)" for Reopen; "Why not" for Reject | "Reopen" / "Reject" | Toast "{name}: the week of … is open until …." / "{name}: request rejected." |
| Activity: filters | Chips by action group · "More filters": "By (login)", "About (phone or login)", DateInput "From" / "To" | Applies as it changes | — |
| Settings | DateInput "Monday of the first week" (must be a Monday: "Choose a Monday (the first day of a week).") + "Clear" · **native `Select`** "Reminder time" · native Select "Opens on" / "Closes on" + **TextInput type=time** "at" | Action bar: "{n} change(s) not saved" / "No changes" · "Undo" · "Review and save", then confirm sheet | Banner ok "Settings saved."; Banner err with retry. |
| Announcements composer (staff) | "Title" (2–80: "A title of 2 to 80 characters.") · TextArea "Message" (1,000, counter, hint "Plain text. Links become tappable.") · head only: Checkbox "Who sees it" ("Everyone" / per batch; "Choose who should see it.") · "Picture (optional)" file input ("Add a picture" / "Change picture" / "Remove picture") · Toggle "Pin to the top" · DateInput "Show until" (optional) | "Post" / "Save" + "Cancel" | Toast "Posted" / "Saved"; field errors or Banner. |

**Leave guards and drafts exist only on the Day form (IndexedDB draft) and the Week end-of-week answers (in memory).** No other form has a guard; open sheets with `dismiss=false` are the only other protection.

---

## 2. Dialogs, sheets and inline confirms

| Where | Title | Buttons | Dismiss / Back |
|---|---|---|---|
| WheelSelect (everywhere) | The field label | "Cancel" · "Done" (custom head, no ✕) | Tap outside or Back closes without changing anything. |
| TimePicker | The field label + live preview | "Same as last time · {time}" · "Cancel" · "Done" | Same as WheelSelect. |
| Day: rules | "How your day is scored" / "{batch} · each part up to 25 marks" | ✕ | Default (dismissible, Back closes). |
| Day: leave guard | "Save changes before leaving?" | "Save" · "Leave and save later" (offline only) · "Discard changes" · "Stay". Offline line: "Not sent — no connection." | No ✕, `back=false`; a tap outside cancels the navigation. |
| Week: leave guard | Same title | "Save" · "Discard changes" · "Stay" | Same as Day. |
| Week: submit (inline `role=alertdialog`) | "Submit this week? You cannot change it afterwards." or "Submit with n of 7 days? {days} will count as not filled (0)…" | "Yes, submit" · "Cancel" | Inline only. |
| Account: Delete | "Delete your account?" ("Deleted…", "Kept, without your name, phone number or IYF ID…", "This can't be undone.") | "Cancel" · "Delete account" | `dismiss=false`; Back and Escape still close it. |
| Profile: remove photo (inline `.confirm danger`) | "Remove your photo?" | "Cancel" · "Remove" | Inline |
| PhotoZoom (custom dialog) | Full-screen photo + name | ✕ | A tap anywhere, Escape or Back closes it. |
| Shell drawer | "Menu" | "Close menu" | Backdrop tap, Escape, Back. |
| CommandSearch | "Go to" | ✕. Footer: "↑ ↓ move · Enter open · Esc close" | Default. |
| Wall: remove post (inline) | "Remove “{title}” for everyone?" | "Keep" · "Remove" | Inline. The ⋯ menu offers Edit / Pin or Unpin / Remove. |
| SignUpCard: reject (inline) | Field "Reason for rejecting" | "Cancel" · "Confirm reject" | Inline |
| Board: class week | "No regular class?" / "Week of …, {batch}" | "Cancel" · "Save" · "Back to a regular class" | Default |
| Members: delete | "Delete {name}'s account?" | "Cancel" · "Delete" (enabled once the typed phone matches) | Default |
| Leaders: add | "Add to {leader}'s group" / "Devotees of {pool} in no group" | "Cancel" · "Add n" | Default |
| Leaders: remove leader (inline) | "Remove {name} as group leader? The n devotees of the group will be in no group." | "Cancel" · "Remove" | Inline |
| DevoteeDetail `ask()` (inline, focus moves to the title) | "Change to {fac}, {day} class?" ("Yes, save") · "Mark {name} inactive?" / "Make {name} active again?" · "Disable {name}'s login?" / "Enable…" ("They are logged out…" / "They can log in again.") · "Remove their photo?" · "Delete {name}'s account?" · "Reopen the week of …?" · "Ask the master to reopen the week of …?" ("Send request"; "The master decides; the week stays missed until then.") · "Mark Present/Absent for the week of …?" · "Change attendance" | "Cancel" + action button | Inline |
| Coordinators: New/Edit | "New coordinator" / "Edit {username}" | "Cancel" · "Create coordinator"/"Save" | `wide`, `dismiss=false` |
| Coordinators: Reset | "Reset password" / {username} | "Cancel" · "Set password" | Default |
| Coordinators: Disable | "Disable {name}?" ("…is logged out at once…") | "Cancel" · "Disable". **Enable has no confirm.** | Default |
| Facilitators: Access | "Give access" / "Access" | See §1e | Default |
| Facilitators: delete | "Delete {name}?" | "Cancel" · "Delete" | Default |
| Batches: Edit | "Edit {name}" / batchId | "Cancel" · "Save" | `wide`, `dismiss=false` |
| Batches: Add | "Add a batch" / "Its level sets the score card and the hearing journal" | "Cancel" · "Add batch" | `dismiss=false` |
| IYF IDs: link/unlink (inline) | Reason fields | "Cancel" · "Link"/"Unlink" | Inline |
| Reopens (inline) | Reason fields | "Cancel" · "Reopen"/"Reject" | Inline |
| Settings: confirm | "Save these settings?" + change list + "This applies to every batch at once." | "Cancel" · "Save" | Default |

---

## 3. Toasts and banners by screen

**Global:** "A new version is ready — it will apply after you save" (info, 8 s) · "Updated to the latest version" (info) · "Back online" (info).

| Screen | Toasts | Banners (kind: text) |
|---|---|---|
| Login | — | info "You were logged out. Please log in again." · err (API) |
| Forgot / Sign-up / Change password | — | err (API) · sign-up err "Please fix the marked fields." · change password ok "Password changed." |
| Devotee Home | — | warn "Not saved yet: {Day date links}." · err + retry |
| Day | — | err "This day is not open." · err "This day opens on {date}." · info "This week is submitted. See the week" · err "This day was changed on another device…" / "Some answers need fixing." · warn "Topic lists need a connection. You can still fill in the day." · warn (coordinator filling) "Filling for {name} — saved as filled by the coordinator. Back to {name}" |
| Week | "Week submitted. Hare Krishna!" / "Submitted for {name}" | err "This week is not open." · warn "The week of … had no complete day by the deadline, so it counts as missed (score 0). Ask your coordinator to reopen it." · err (gaps list, API) · note banners "No regular class this week ({note})…", "{Who} marked you {mark}. You had marked {mark}; their mark counts. Talk to them if this is wrong.", "{n} of 7 days complete. Days not complete count as 0, so this week can score at most about {cap}%…" / "Fill at least one whole day to submit this week." |
| Report | — | err + retry "Could not load your history." |
| Hearing / Reading | — | warn "Lectures need a connection." / "Books need a connection." |
| Account / Profile | "Name saved." · "{About you / Contact details / Address / Emergency contact / Facilitator} saved." · "Photo saved." · err "Could not open this. Check your connection and try again." · "Your account has been deleted." | err + "Reload" "Could not load your profile. Check your connection and reload." · err + retry (profile load) |
| Wall | "Posted" · "Saved" · "Announcement removed" (Undo → info "Posted again") · "Pinned to the top" / "Unpinned" · info "That post is no longer on the wall." · err (API) on like, comment, uncomment, remove and pin | err (form) · err + retry |
| My group | "Attendance saved for n devotee(s)." (Undo → info "Attendance put back.") | warn "Attendance closed at {time}. Ask your coordinator to change a mark." · info "You can mark the group's attendance from {date}, the day of the class." · warn "No regular class this week ({note}). Everyone is Present unless marked Absent. / Only those marked Present count." |
| Requests | "Approved and linked to {id}" / "Approved; the IYF ID will be linked automatically" / "Rejected {name}" · "Password reset approved" / "Password reset rejected" | warn "Before approving, call {name}…" · warn "Phone matches, but the name is different…" · err (card, resets, load + retry) |
| Board | "Attendance saved for n devotee(s)." (Undo → "Attendance put back.") · "Saved: no regular class this week." / "Back to a regular class this week." (Undo → "Class week put back.") · err | warn "{Kind} · {note} — everyone marked Present / only those you mark Present count; others Absent." + "Change" · warn "Attendance closed at {time} — the master can change it." · info "Attendance opens on {day}, the day of the class." |
| Members | "{name}'s account was deleted. Their submitted weeks are kept." · err (load more) | err + retry |
| Leaders | "{name} is now a group leader." · "{name} is no longer a group leader; the group's devotees are in no group now." · "{name} is in no group now." · "{n} devotee(s) added to {leader}'s group." | err |
| Devotee detail | "Facilitator and class day saved." · "Active again from / Inactive from {week}." · "The account is now {status}." · "Photo removed." · "Account deleted." · "The week of … is open again." · "Request sent to the master." · "Attendance for the week of …: present/absent/cleared." | err + retry |
| Coordinators | "Created {u}. They must change…" · "Saved" · "Temporary password set for {u}…" · "Disabled {u}" / "Enabled {u}" (Undo) · err | err |
| Facilitators | "{name} added…" · "{name} is offered again." / "{name} is switched off. Devotees who have this name keep it." (Undo) · "{name} was deleted from the list." · "{name} now sees My students in their own login." · "Login {u} created. Tell {name} the username and the temporary password." · "New temporary password set." · "Facilitator access removed. Their own sadhana is unchanged." · "Login switched on." / "Login switched off." | err |
| Batches | "Added {name}. Add its coordinators with Edit." · "Saved {name}" | err |
| IYF IDs | "Marked as not duplicates." (Undo) · link/unlink toasts | info "IDs with the same name and the same phone are merged by the dashboard automatically… mark it Not duplicates…" · err |
| Reopens | See §1e | err + retry |
| Activity | — | err + retry |
| Settings | — | ok "Settings saved." · err + retry |

---

## 4. Loading, empty, error and success states per screen

| Screen | Loading | Empty | Error | Success / other |
|---|---|---|---|---|
| Lazy screen load | Skeleton `page` (3) | — | "Could not load this screen…" + Reload | — |
| Devotee Home | Skeleton `home` + Refreshing | — | Banner + retry | The hero card says "Today … is done ✓ / partly filled / not filled yet" |
| Staff Home | Stats show "–" until loaded | Birthdays block hidden when there are none | — | — |
| Day | Skeleton `form` (4), twice (data, then draft) | — | Banner + retry | "Saved ✓" |
| Week | Skeleton `list` (7) | — | Banner + retry | A submitted week shows ScoresView |
| ScoresView `/history/<w>` | Skeleton (2) | EmptyState clock "Week of …" / "No complete day by the deadline… Ask your coordinator to reopen it." | Banner + retry | Share hint "Copied" / "Could not share" |
| History | Skeleton `list` (4) | EmptyState week "No weeks yet" / "Submitted weeks appear here." + "Open this week" | Banner + retry | "Show earlier weeks" |
| Report | Skeleton (2) in panels | "No record for {date}" · "Not submitted in time." · "Not submitted yet" / "Choose a week" (with "Average rounds so far: n") · trend "Shown after two submitted weeks." | "Could not load your history." + retry | — |
| Hearing / LectureList | Skeleton `list` (5) | "No lectures in this week." · "No lecture matches" / "Try other filters." + "Clear filters" | warn Banner | — |
| Reading / BookList | Skeleton `list` (6) | "No book found [in {level}]" / "Try another word or level." + "{n} in all levels" | warn Banner | "No PDF yet" |
| Wall | Skeleton (3) + Refreshing; comments Skeleton (1) | "No announcements yet" (staff add: "Post one for your batch with New announcement.") · "No comments yet. Be the first." | Banner + retry | A shared post is highlighted |
| Account › Profile | Skeleton (2) | "Not added" per field | Banner + retry / Reload | — |
| My group | Skeleton `list` (5) | "No one in your group yet" / "Your coordinator adds devotees to your group. Ask them if this looks wrong." | Banner + retry | "… · everyone has submitted 🙏" |
| Batch tabs (any) | — | "No batch yet" / "No batch is assigned to you yet. The IYF head assigns batches to coordinators." | — | — |
| Board | Skeleton `board` (6) | "No one matches" / "Clear the search or the chosen status." · "No devotees" / "No devotees in this batch for that week." | Banner + retry | — |
| Members | Skeleton `list` (6) | "No one here" / "Nobody matches these filters…" or "Approved devotees of your batches appear here." | Banner + retry | — |
| Leaders | Skeleton `list` (4) | "No group leaders yet" / "Appoint a devotee above…" · "No one in this group yet." · "Everyone is already in a group." | Banner + retry | — |
| Filling chart | Skeleton `chart` | "No missed weeks" / "Everyone submitted in the last n weeks." | Banner + retry | — |
| Requests | Skeleton `list` (3) | "No sign-ups waiting" / "New sign-ups for your batches appear here for approval." · "No reset requests" / "When someone asks for a new password, it waits here for you." | Banner + retry | — |
| Devotee detail | Skeleton `detail` | "No batch yet." · "No submitted or missed weeks yet." | Banner + retry | — |
| Read-only week (WeekRead) | Skeleton (3) | "Missed · score 0" · "Hearing and reading show here once the week is submitted." | Banner (no retry) | — |
| My students (Fac) | Skeleton `list` (5) / (3) | "No students yet" / "Devotees who choose you as their facilitator appear here." · "No submitted weeks yet." | Banner + retry | — |
| Overview | Skeleton `page` (3) | "No active batches" / "Batches marked active appear here." | Banner + retry | — |
| Coordinators / Batches | Skeleton `list` | "No coordinators yet" / "Add the first coordinator…" · "No batches" / "Add the first batch with Add batch." | Banner + retry | — |
| Facilitators | Skeleton `list` (6) | "No one here" / "No name matches the search." or "Nothing in this group." | Banner + retry | — |
| IYF IDs | Spinner "Loading…" (details); Skeleton (2) (duplicates) | "No results" / "Try part of the name…" · "No possible duplicates" / "Nothing to review right now." | Banner (+ retry) | "{n} group(s) already reviewed and hidden." |
| Reopens | Skeleton `list` (2) | "No requests are waiting" / "When a coordinator asks to reopen a missed week, it appears here." | Banner + retry | — |
| Activity | Skeleton `list` (5) / (2) | "Nothing found" / "Try another type, or clear the filters." · "All calls are fast" / "Nothing slow or failed was logged." | Banner + retry | "Load more" |
| Settings | Skeleton `page` (3) | — | Banner + retry | Banner ok "Settings saved." |

---

## 5. Tables, lists, cards and dashboard blocks

| Screen | Blocks and what each row or card shows |
|---|---|
| Devotee Home | `.greet` (date, "Hare Krishna, {first}", batch) · `.hero-card` Today (icon, "Today", "{Day} is …", "n of 7 days filled this week", buttons: Fill / Continue today, Submit, Share) · Reminder card ("Get the 9 PM reminder", "Allow notifications") or install `.cblock` ("Install Sadhana Record", "Not now" / "Install" / "Got it") · `.cblock` per week ("Week of …", status "Submitted" or "Filling · closes …", "n/7 days filled", day chips ✓ ◐ ○, "Open the week" / "Submit week" / "See scores and share") · Quote carousel · `.ann-teaser` (title, author · time — body) · `.qa` Quick actions: Report, History, Hearing ("n heard"), Reading, Share today, Notices ("n new") |
| Staff Home | `.greet` · Facilitator `.list` ("My students") · `.hero-card` (staff) or `.section` (devotee) "Waiting for you" with `.stat` links (sign-ups waiting / password resets / reopen requests) + "Open requests" · `.list` batch tools · Admin `.list` (7 rows with sub-lines) · Birthdays section (Today: name · age · batch; Next 7 days) |
| Week | `.list` of `Row` per day (Day, date, "Today", Status Complete / Partly filled / Not filled / "Not yet") + sections: End of week, Attendance, Submit; Ring (n/7) in the header |
| ScoresView | `.section.today` big overall % · Bars "Activity Score" · `dl.kv` Night Stay / principles / Average rounds |
| History | `.list` Rows: "Week of …", "Body x% · Soul y% [· n of 7 days]", overall % (or Status "Missed · 0%") |
| Report | `.cblock` "Last submitted week" (big %, Body/Soul) + Trend · bar of month/year WheelSelects + Daily/Weekly seg · `.cal` grid (bands 80%+ / 50–79% / <50% / Missed) · Bars per day or week |
| Hearing / Day picker | Progress bar "n of m heard" · One week / All weeks seg · week stepper · `.list` `.lrow` (slot · week · heard, title, "Listen" / "Open folder" / "No recording linked") |
| Reading | `.cblock` "Your current book" (title, level pill, PDF buttons) · level chips · Search · `.list.bk-list` (title, level, "Open PDF" / "n PDFs" / "No PDF yet", "Choose") |
| Wall | `.feed` of `article.post` (avatar, author, time, audience for staff, "New", "Pinned", ⋯ menu, title, linkified body, image, counts, Like · Comment · Share bar, comments) |
| My group / Board / Fac | `.seg.stat-seg` counts (Submitted / Filling / Not started / Missed) · `.board` of `.brow`: name (+ Call / WhatsApp icons in the group view), Status, 7-day `.strip`, n/7, %, "by coordinator", "Leader: …", "Own: …", "Fill" link, P/A buttons or a final Status. Board has a `.board-head` (Devotee / This week / Attendance). Group splits rows into "Still to submit" and "Submitted" (greyed). Fac uses `.mb-list` `.mrow`. |
| Members | `.mb-list` `.mrow`: Photo, name, Status (Inactive / Disabled), batch, IYF ID, blood pill, "Inactive since / Last week / Nothing submitted yet", Call / WhatsApp, "Delete" (non-active only) · "Show more (n left)" |
| Leaders | Appoint `.section` · `.section` per group (leader, count, Call / WhatsApp, `.gl-list` members with Status and ✕, "Add devotees", "Remove leader") · `<details>` "In no group (n)" |
| Filling chart | `.stats.four` `.stat` tiles · Bars by day / by week · People tiles · "Missed weeks" `.rowlink` list |
| Requests | `.card` per sign-up (avatar, name, phone · batch · time, email / WhatsApp buttons, match radios…) · `.card` per reset |
| Devotee detail | Profile `.section` (Photo 80, Status, batch · IYF ID, Call / WhatsApp / Email, `dl.kv`, emergency block) · Facilitator and class · Batch history `.list` · Fill-for · "Last weeks" `.list` (%, Status, attendance + by-who, P/A for the head, reopen) · Change attendance · Account actions |
| Overview | `.section` `.stats.four` totals + "n active devotees · n waiting for approval" · one `.action` card per batch (name, waiting pill, `.wk-bar` progress, counts, `.spark` 8-week bars) |
| Coordinators | Phone: `.list.tbl-narrow` `.lrow` · wide screens: **`table.tbl.tbl-wide`** (Name / Username / Phone / Batches / Status / Actions: edit, reset, Enable/Disable) |
| Batches | `.lrow` list + **`table.tbl`** (Batch / ID / Coordinators / Status (Active/Hidden, Pilot) / Edit) |
| Facilitators | `.list` `.lrow.fac-row` (name, "n devotees · n waiting sign-ups", Offered / Switched off, login pill, "not in NameMap yet" pill, switch, lock, trash) |
| IYF IDs | `.card` grid (ID · name, merged pill, level · facilitator · phone, link dot, Details / Unlink… / Link to an account…) · duplicates `.card` with `.well` rows |
| Reopens | `.card` (name link · batch, week · asked by · time, quoted reason, Reject… / Reopen…) |
| Activity | `.list` rows (audit line, time · batch · who · reason, "Before / after" JSON `<pre>`) · `Row` list "Slow or failed requests" (Status Slow / {code} / Failed) |
| Settings | Two `.section`s with FormSections · `dl.kv.well` ("Registry refreshed", "Reminder devices") · `.actionbar` |

---

## 6. Print and CSV

**There is none.** A search of all of `frontend/` (excluding `node_modules` and `dist`) finds no `@media print`, no `window.print`, no CSV export or import, and no `text/csv`. The only tables are the two `table.tbl` views (Coordinators, Batches). Data leaves the app only through share text (Share / WhatsApp links) and the Google Sheets copy on the server.

---

## Inconsistencies worth noting for the revamp

- Confirmations use three different patterns: inline `.confirm` boxes, Sheets, and no confirm at all (approving or rejecting a password reset, enabling a coordinator, taking a member out of a group).
- Deleting a devotee is a Sheet on Members but an inline confirm on Devotee detail.
- Settings uses native `<select>` and `type=time` inputs, and the drawer's batch picker is a native `<select>`; everywhere else uses WheelSelect and TimePicker.
- Wording mixes "the master" (Board banner, reopen texts on Devotee detail) with "IYF head" elsewhere.
- Only the Day form and the Week end-of-week answers have leave guards. The long admin and coordinator sheets rely on `dismiss=false`, and the Board and My group attendance edits have no guard.