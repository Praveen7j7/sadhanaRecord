# Sadhana Entry: build plan

A new Google Sheet that holds all sadhana and attendance data for every batch, filled through a simple entry screen that works on laptops, iPhones and Android phones. An entry is saved only when every required field is filled and the person entering is on the approved list. Everything downstream (Raw, Eligibility, the dashboard, the web app, the weekly e-mails) imports from this sheet and so gets only complete data.

Status: plan for approval, revised 26 September 2026 with your decisions. Nothing has been built.

---

## 1. Decisions taken (26 September)

| # | Decision | Effect on the design |
|---|---|---|
| 1 | The IYF Overall Follow up workbook (Facilitator Kartik Phase, Raw KP, Target …) is **out of scope** | It keeps working exactly as today |
| 2 | **Coordinators** enter the data. The owner writes the **authorised e-mail addresses** in the sheet; only those can enter | An *Access* tab in the sheet; every entry is checked against it |
| 3 | Coordinators use **laptops and phones (iOS and Android)** | The entry screen is built mobile-first and also works as a wide table on a laptop |
| 4 | A **partly filled row is never saved**; it disappears if not completed | Entry is a form, not typing into the sheet (section 2) |
| 5 | **Only the sheet owner** can approve a correction to a saved entry | Corrections are requests; the owner approves or rejects them |

## 2. Why the entry is a form, and the sheet still holds everything

A Google Sheet saves every cell the moment it is typed, so a sheet cannot refuse a half-filled row. To meet decision 4, coordinators do not type into the sheet at all. They use an **entry screen** (a web page linked to the sheet, opened from a bookmark or home-screen icon):

1. Sign in with their Google account. The screen checks the e-mail against the Access tab. Anyone not on the list sees "not authorised" and nothing else.
2. Pick the batch and week. Their devotees for that week appear, pre-filled from the Roster (name, contact, head, facilitator).
3. Open a devotee, fill the answers with dropdowns and number pickers, then press **Save**. **Save stays disabled until every required field is filled**, and the screen says what is still missing. Nothing is written until Save succeeds.
4. The saved devotee drops off the "to do" list for that week. Leaving the page before saving discards what was typed, as decided.

**The sheet** holds the data, the Roster, the Access list, the correction requests and the log. Coordinators have **no edit access** to it (at most view-only); the entry screen writes on the owner's behalf after its checks pass. So nothing incomplete, and nothing from an unapproved person, can reach the sheet.

## 3. Principles

| Principle | In practice |
|---|---|
| Same features, nothing lost | Every column, dropdown, colour meaning, formula and report of the current sheets is listed first (Phase 0) and rebuilt, or consciously dropped with your sign-off |
| The barrier is at entry | Completeness and authorisation are checked before a row is saved |
| Downstream unchanged | Saved rows use the column names the notebook already reads, so Raw, the dashboard and the app need no rewrite |
| Nothing is lost | Old sheets stay as read-only history after cutover; every save and correction is logged |
| Small, reversible steps | One batch piloted alongside the old sheet before the rest move |

## 4. Scope

| In scope | Out of scope |
|---|---|
| Sadhana: SPS (SPS, SPS Group 2, SPS Online), DPS, BSS, BVS | IYF Overall Follow up workbook (all tabs) |
| Monthly answers: chanting rounds, 4 regulative principles, KC form | The dashboard itself (it only changes where it imports from) |
| VL-2 and VL-3 attendance (each session fully marked before it is saved), and VL-3 monthly chanting | |
| VL-2 registrations (to confirm in Phase 0) | |

## 5. Phase 0: understand the current sheets

For every link you share, each workbook and tab is read and written up:

| Captured | How |
|---|---|
| Tabs, columns, header wording and order, batch-specific differences | Sheets API read, side-by-side comparison |
| Typed cells vs formulas, and what each formula does | Formula read |
| Dropdown lists and number rules | Validation audit |
| Colours and their meaning | Conditional-format audit, **plus asking coordinators**, since some colours are applied by hand |
| Who enters, how often, when in the week, on what device | Drive edit history, plus the coordinators |
| How the week's rows are created (copied, pre-filled, typed) | Edit history and row patterns |
| Everything that reads the data (notebook, IMPORTRANGE, Summary tabs, web app) | Formula and notebook search |

**Deliverables:** a feature inventory (each feature: keep / change / drop), a field dictionary (each field: meaning, allowed values, weekly or monthly, required for which level), and a consumer map.

**Already known** (to be completed with your links): the sadhana workbook (SPS, SPS Group 2, SPS Online, DPS, BVS, BSS, Summary, App: weekly row per devotee; Date / Month / Week / Class Tag / Body / Soul / Overall are formulas; owners' dropdowns; column order differs per tab; hand colouring on names), VL-2 Batch 51 and VL-3 (attendance grids with PRESENT/ABSENT; their own Raw formulas unroll the grid), VL-3 Monthly Chanting (new), VEDIC_LEVEL_2 registrations.

**Exit:** you sign off the feature inventory and the required fields per level.

## 6. Phase 1: design

| Area | Design |
|---|---|
| **The sheet (store)** | One *Saved* tab per level (SPS, DPS, BSS, BVS), *Monthly*, *VL-2 Attendance*, *VL-3 Attendance*, *Roster*, *Access*, *Corrections*, *Log*, *Data Health*. All protected: only the owner edits |
| **Access tab** | E-mail, name, role (coordinator), batches they may enter, active yes/no. The owner edits this list; changes apply immediately |
| **Entry screen, phone** | One devotee per card, large touch targets, dropdowns and number steppers, a progress bar ("12 of 30 saved this week"), and a clear list of missing fields |
| **Entry screen, laptop** | The same data as a table with one row per devotee and a Save button per row, enabled only when the row is complete |
| **Required fields** | From the signed-off field dictionary. Starting point: sadhana six (bed, wake up, day sleep, japa, pathan, sravan) for every level; night stay and attendance for SPS and DPS. Monthly: chanting and principles once per month. Attendance: every devotee of the session marked PRESENT or ABSENT |
| **Allowed values** | The owners' current dropdown lists and number ranges (sadhana −100 to 100, chanting 0 to 64 whole numbers) |
| **Formulas kept** | Body, Soul and Overall computed exactly as today, so scores do not change |
| **One entry per devotee per week** | A second save for the same devotee and week is refused; changes go through a correction |
| **Corrections** | The coordinator taps "Request correction" on a saved entry and gives the new values and a reason. The request waits in the *Corrections* tab. **Only the owner** approves (the saved row is replaced and logged) or rejects it |
| **Roster** | Devotees per batch, with IYF ID from the existing registry; new joiners, level changes (VL-3 → SPS, SPS-2 → SPS-1) and leavers handled here by the owner |
| **Colour meanings** | Where colours follow data, they are rebuilt as rules; where they were hand-applied, a proper field replaces them after asking the coordinators |
| **Log** | Who saved or corrected what, and when |

**How the sign-in and the barrier work (technical note).** The entry screen runs as an Apps Script web page. It reads the Google-verified e-mail of the person signed in and checks it against the Access tab, then writes to the sheet as the owner. Coordinators never get edit rights, so the checks cannot be bypassed by opening the sheet. A consumer Gmail account does not reveal its e-mail to an app that runs as its owner, so the sign-in uses Google's signed identity token for the check. The feasibility of this with your accounts is confirmed in the first days of the build.

**Exit:** clickable mock-ups (phone and laptop) approved by you and one or two coordinators.

## 7. Phase 2: build

1. Create the sheet: tabs, columns, protections, the Access and Roster tabs; seed the Roster from the current sheets and the IYF ID registry.
2. The entry screen (phone and laptop), sign-in and Access check, completeness check, Save.
3. Corrections: request (coordinator) and approve / reject (owner only).
4. Data Health for the new sheet (entries due vs saved per coordinator, batch and week), linked from the dashboard's central Data Health.
5. A one-page guide for coordinators with screenshots (English, and Hindi if wanted), and an "add to home screen" guide for iOS and Android.

## 8. Phase 3: connect downstream

- Saved tabs use exactly the column names the notebook reads (Date, From Date, To Date, Month, Week, Class Tag, Head Name, Name, Contact Number, Facilitator, Chanting Round, Calling Response, Night Stay, 4 regulatives principles, KC monthly form, Remarks, bed … Sravan, Body, Soul, Attendance, Service, Overall).
- Notebook: `SHEET_ID` and `SHEET_NAMES` point at the new sheet; monthly answers are read from the Monthly tab.
- The dashboard's VL-2 and VL-3 imports point at the new attendance tabs, in the same layout the dashboard reads today.
- The notebook's completeness check (written and parked) is switched on as a second safety net.
- SPS History (the 6-month flag) reads the old sheets for history and the new sheet for new weeks.

## 9. Phase 4: testing

| Test | Pass means |
|---|---|
| Each required field left empty, one at a time | Save stays disabled; nothing is written |
| E-mail not on the Access list; removed from the list; marked inactive | Refused immediately |
| A coordinator opens the sheet directly | Cannot edit |
| Same devotee and week saved twice | Second save refused |
| Correction requested by a coordinator | Waits; applied only when the owner approves; logged |
| Phone (iOS Safari, Android Chrome) and laptop (Chrome, Safari) | Every screen usable; no sideways scrolling on phone |
| Parity: the same week entered in the old and new sheets | Identical Body / Soul / Overall and identical Raw rows |
| Dashboard | Same Eligibility, Facilitator Wise and app results as from the old sheet for the same complete data |
| Existing test suite | All suites still pass |

## 10. Phase 5: pilot, then rollout

1. **Pilot:** SPS Group 2 enters through the new screen for 2 weeks while the old sheet keeps working; both are compared every week.
2. **Fix** what coordinators found awkward, especially on phones.
3. **Rollout:** the other sadhana batches, then VL-2 / VL-3 attendance, one or two per week.
4. **Cutover:** the notebook and the dashboard imports switch to the new sheet; the old sheets become read-only history.

## 11. Still to decide

| # | Question | Suggestion |
|---|---|---|
| 1 | Links to every sheet in use (all batches) except the follow-up workbook | Share them; Phase 0 starts from those |
| 2 | Include VL-2 / VL-3 attendance and VL-2 registrations in this sheet? | Yes (attendance); registrations to confirm in Phase 0 |
| 3 | Required fields per level | Confirm the starting list in section 6 |
| 4 | Which Google accounts the coordinators use (Gmail or a Workspace domain) | Needed for the sign-in check |
| 5 | Pilot batch | SPS Group 2 |
| 6 | Hindi on the entry screen and guide? | Optional |

## 12. Risks

| Risk | Handling |
|---|---|
| Losing a half-typed entry annoys coordinators | Short forms, pre-filled names, and a warning before leaving a page with unsaved answers |
| A devotee's week can never be completed (e.g. night stay unknown) | Stays in the to-do list and on Data Health; not counted, as intended |
| Poor mobile signal while saving | Save shows success or failure clearly and can be retried; nothing half-saved |
| Consumer Gmail sign-in limits | Checked first in the build; fallback is the dashboard's existing login system with accounts per coordinator |
| Data lost at cutover | Old sheets kept read-only; parity tests before switching |

## 13. Rough timeline

| Phase | Effort |
|---|---|
| 0 Discovery | 1 to 2 days after links are shared, plus coordinator questions |
| 1 Design and mock-ups | 1 to 2 days, plus your review |
| 2 Build (store, entry screen, access, corrections) | 4 to 5 days |
| 3 Connect downstream | 1 day |
| 4 Testing (including phones) | 1 to 2 days |
| 5 Pilot and rollout | 2 weeks pilot, then 2 to 3 weeks |
