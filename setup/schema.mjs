// The Sadhana Record store, one entry per spreadsheet. The backend's Store.gs reads and writes exactly these
// tabs and columns (by header name, never by position). Change a column here first, then in Store.gs.
// Column: [header, note, kind]. kind: text | datetime | date | int | bool | enum:A|B|C
export const SCHEMA = {
  access: {
    title: 'Sadhana · Access',
    about: [
      'Sadhana Record · Access',
      'Who can sign in, to which batch, and what was done. Written only by the Sadhana app server; please do not edit by hand (every tab is protected with a warning).',
      'Owner: iyfdelhi.database@gmail.com. Passwords are stored only as salted PBKDF2-SHA-256 hashes; nobody can read them.',
      '',
      'Accounts: one row per login (devotee phone, or a coordinator / master username).',
      'Batches: the batches devotees sign up to, their coordinators, score card and journal.',
      'Memberships: which batch each devotee is in, and their active / inactive periods, week by week.',
      'ResetRequests: forgotten-password requests waiting for the coordinator (or, for coordinators, the master).',
      'Sessions: signed-in devices (token hashes only).',
      'AuditLog: every approval, status change, ID link, attendance override, reopen and deadline drop.',
      'RunLog: server response times and failures.',
      'Facilitators: the facilitator list offered at sign-up, approval and a devotee\'s edit. The master switches names on or off, adds and deletes them in the app; the dashboard\'s NameMap adds its names every night.',
      'Announcements: posts on the wall (text; pictures stay in the app database).',
      'DuplicateReviews: groups of IYF IDs the master marked "not duplicates".',
      'Leaders: group leaders (student devotees) appointed by the batch coordinator; Memberships › leader_login shows each devotee\'s group.',
      'PostComments: comments on the announcements (posts); the likes and comments counts are on Announcements.',
      'PostReports: posts and comments reported by members (an app-store rule); the IYF head dismisses or removes them in the app.',
      'PostMutes: people whose comments are hidden, for one person or (viewer *) for everyone by the IYF head.',
      'AppIds: IYF IDs the head created in the app (SR series) for devotees the dashboard had not registered; add them to the dashboard.',
      'HeadRequests: new IYF heads waiting for (or given) the approval of every other head (no password is copied).'
    ],
    tabs: {
      Accounts: [
        ['login', 'Devotee: 10-digit phone. Coordinator / master: username (e.g. sps). Unique.', 'text'],
        ['role', 'DEVOTEE, COORDINATOR or MASTER (a facilitator login is a COORDINATOR with facilitator_name set and no batches)', 'enum:DEVOTEE|COORDINATOR|MASTER'],
        ['status', 'PENDING until approved; REJECTED; ACTIVE; INACTIVE (by the coordinator); DISABLED (login blocked). A deleted account is removed and noted in AuditLog.', 'enum:PENDING|ACTIVE|INACTIVE|DISABLED|REJECTED'],
        ['name', 'As typed at sign-up (devotee) or set by the master (coordinator)', 'text'],
        ['phone', 'Devotee: same as login. Coordinator: optional contact.', 'text'],
        ['iyf_id', 'Linked at approval, or later by the nightly link job once the dashboard registry has allocated it. Only IDs that exist in the dashboard\'s Devotees tab. One account per IYF ID.', 'text'],
        ['id_source', 'COORDINATOR (picked at approval), AUTO (nightly link job) or MASTER', 'enum:COORDINATOR|AUTO|MASTER'],
        ['requested_batch', 'Batch chosen at sign-up (Batches › batch_id)', 'text'],
        ['pw_hash', 'PBKDF2-SHA-256 hash (base64). Never a password.', 'text'],
        ['pw_salt', 'Random salt for this hash (base64)', 'text'],
        ['pw_iterations', 'PBKDF2 rounds used for this hash', 'int'],
        ['must_change_pw', 'TRUE for a coordinator with a temporary password', 'bool'],
        ['failed_tries', 'Wrong passwords in a row; 5 locks the account for 15 minutes', 'int'],
        ['locked_until', 'Login refused until this time', 'datetime'],
        ['signed_up_at', '', 'datetime'],
        ['decided_at', 'Approved or rejected at', 'datetime'],
        ['decided_by', 'Login of the coordinator / master who approved or rejected', 'text'],
        ['reject_reason', '', 'text'],
        ['last_login_at', '', 'datetime'],
        ['updated_at', '', 'datetime'],
        ['updated_by', '', 'text'],
        ['requested_facilitator', 'Facilitator chosen at sign-up (canonical name from the dashboard NameMap)', 'text'],
        ['requested_group_leader', 'No longer asked (3 Oct 2026); kept for history', 'text'],
        ['email', 'Asked at sign-up; checked (format and mail domain), never written to', 'text'],
        ['whatsapp', 'WhatsApp number (often the login phone); blank if none', 'text'],
        ['requested_class_day', 'SUN or SAT: the weekly class the devotee attends, chosen at sign-up', 'enum:SUN|SAT'],
        ['facilitator_name', 'A facilitator login: the name of the facilitators list whose devotees it sees, read-only (empty for everyone else)', 'text'],
        // 11 Oct 2026 (migration 0038): sign-up approval and the phone-change trail
        ['signup_state', 'PENDING until a coordinator or admin approves the sign-up; then APPROVED or REJECTED (blank for accounts made before 11 Oct 2026)', 'text'],
        ['signup_at', '', 'datetime'],
        ['approved_by', 'Login of the coordinator / admin who approved the sign-up', 'text'],
        ['approved_at', '', 'datetime'],
        ['phone_changed_from', 'Their previous number, when they changed it at sign-up. The old number stays searchable so past records still find them', 'text'],
        // 11 Oct 2026 (migration 0041): a login that belongs to a machine, not a person
        ['only_actions', 'A service account: the ONLY API actions this login may call, comma-separated. Empty = no restriction (every ordinary account)', 'text'],
        ['service_note', 'Why a service account exists and who to ask about it. Empty for a person', 'text']
      ],
      Batches: [
        ['batch_id', 'Short code used everywhere (SPS, SPS2, SPSO, DPS, BSS, BVS)', 'text'],
        ['name', 'Shown at sign-up', 'text'],
        ['level', 'SPS, DPS, BSS or BVS', 'enum:SPS|DPS|BSS|BVS'],
        ['score_card', 'SPS card, or the BVS/DPS/BSS card (Rules file)', 'enum:SPS|BVS/DPS/BSS'],
        ['hearing_journal', 'Which hearing journal the batch follows: SPS/DPS, BSS or BVS', 'enum:SPS/DPS|BSS|BVS'],
        ['sheet_tab', 'The tab in "New Sadhna Updation Apr\'26 Onward" that submitted weeks are copied into for Raw', 'text'],
        ['coordinator_logins', 'Coordinator account(s) for this batch, comma-separated. Set by the master; the batch belongs to the batch, not the person.', 'text'],
        ['standing', 'TRUE: no start or end date (all batches today)', 'bool'],
        ['active', 'FALSE hides it from sign-up', 'bool'],
        ['pilot', 'TRUE for the pilot batch', 'bool'],
        ['view_sheet_id', 'The batch\'s read-only view spreadsheet', 'text'],
        ['updated_at', '', 'datetime'],
        ['updated_by', '', 'text']
      ],
      Memberships: [
        ['login', 'Devotee phone (Accounts › login); the key until and after an IYF ID is linked', 'text'],
        ['iyf_id', 'Blank until linked', 'text'],
        ['batch_id', '', 'text'],
        ['state', 'ACTIVE or INACTIVE for this period', 'enum:ACTIVE|INACTIVE'],
        ['from_week', 'Monday of the first week of this period', 'date'],
        ['to_week', 'Monday of the last week (blank = still open)', 'date'],
        ['level_entry_date', 'Set at approval', 'date'],
        ['group_leader', 'No longer used (3 Oct 2026); Head Name is left blank for Raw', 'text'],
        ['set_by', '', 'text'],
        ['set_at', '', 'datetime'],
        ['reason', '', 'text'],
        ['facilitator', 'Canonical facilitator name (dashboard NameMap), confirmed by the coordinator', 'text'],
        ['class_day', 'SUN or SAT: the weekly class, confirmed by the coordinator', 'enum:SUN|SAT'],
        ['leader_login', 'The group leader (Leaders › login) whose group this devotee is in; blank = no group', 'text']
      ],
      ResetRequests: [
        ['login', '', 'text'],
        ['requested_at', '', 'datetime'],
        ['new_pw_hash', 'Hash of the password chosen by the devotee; takes over only on approval', 'text'],
        ['new_pw_salt', '', 'text'],
        ['new_pw_iterations', '', 'int'],
        ['status', '', 'enum:PENDING|APPROVED|REJECTED|SUPERSEDED'],
        ['decided_by', '', 'text'],
        ['decided_at', '', 'datetime']
      ],
      Sessions: [
        ['token_hash', 'SHA-256 of the session token; the token itself is never stored', 'text'],
        ['login', '', 'text'],
        ['role', '', 'enum:DEVOTEE|COORDINATOR|MASTER'],
        ['created_at', '', 'datetime'],
        ['last_used_at', '', 'datetime'],
        ['expires_at', '30 days after last use', 'datetime'],
        ['device', 'e.g. Android Chrome', 'text'],
        ['ended_at', '', 'datetime'],
        ['end_reason', 'logout, password change, reset, disabled, inactive, deleted, expired', 'text']
      ],
      AuditLog: [
        ['at', '', 'datetime'],
        ['who', 'Login, or SYSTEM for scheduled jobs', 'text'],
        ['role', '', 'text'],
        ['action', 'e.g. requests.approve, ids.merge, attendance.override, week.dropped', 'text'],
        ['target', 'Login, IYF ID or week the action was about', 'text'],
        ['batch_id', '', 'text'],
        ['before', 'Value(s) before, as JSON', 'text'],
        ['after', 'Value(s) after, as JSON', 'text'],
        ['reason', '', 'text'],
        ['request_id', '', 'text']
      ],
      RunLog: [
        ['at', '', 'datetime'],
        ['action', '', 'text'],
        ['ms', 'Server time taken', 'int'],
        ['ok', '', 'bool'],
        ['error_code', '', 'text'],
        ['detail', '', 'text'],
        ['app_build', '', 'text']
      ],
      Facilitators: [
        ['name', 'As offered in the app; dashboard names are exactly the NameMap canonical names', 'text'],
        ['active', 'TRUE: offered at sign-up, approval and edit. FALSE: switched off by the master (devotees who have it keep it)', 'bool'],
        ['source', 'DASHBOARD (from NameMap) or APP (added by the master in the app; add it to NameMap for the dashboard)', 'enum:DASHBOARD|APP'],
        ['in_cohort', 'In the current cohort (NameMap)', 'bool'], ['order', 'Order in the lists', 'int'],
        ['deleted_at', 'Deleted by the master (kept so the nightly NameMap read does not bring it back)', 'datetime'],
        ['changed_by', '', 'text'], ['changed_at', '', 'datetime']
      ],
      Announcements: [
        ['id', '', 'int'], ['title', '', 'text'], ['body', '', 'text'], ['audience', 'ALL, or batch ids; FAC_YOUTH / FAC_TRD (facilitators); STU:<facilitator> (that facilitator\'s students)', 'text'], ['pinned', '', 'bool'],
        ['expires_at', '', 'datetime'], ['author_login', '', 'text'], ['author_name', '', 'text'],
        ['created_at', '', 'datetime'], ['updated_at', '', 'datetime'], ['removed_at', 'Removed from the wall', 'datetime'],
        ['likes', 'How many liked the post (counted at copy time; refreshed nightly)', 'int'], ['comments', 'How many comments it has (as likes)', 'int'],
        ['publish_at', 'Scheduled: when it appears on the wall and its notification goes out (empty = at once; Phase 9)', 'datetime']
      ],
      DuplicateReviews: [
        ['group_key', 'The IYF IDs of the group, comma separated', 'text'], ['why', 'Same phone or same name', 'text'],
        ['decision', '', 'enum:NOT_DUPLICATE'], ['by', '', 'text'], ['at', '', 'datetime']
      ],
      Leaders: [
        ['login', 'The group leader: a devotee of the batch (phone)', 'text'], ['batch_id', '', 'text'],
        ['appointed_by', 'Coordinator or IYF head who appointed them', 'text'], ['appointed_at', '', 'datetime']
      ],
      PostComments: [
        ['id', '', 'int'], ['ann_id', 'Announcements › id', 'int'], ['login', 'Who wrote it', 'text'], ['name', '', 'text'],
        ['body', 'Plain text, at most 500 characters', 'text'], ['at', '', 'datetime'], ['removed_at', 'Set when the writer or staff removed it', 'datetime']
      ],
      // 8 Oct 2026 (migration 0030): reports on the wall and hidden comments (an app-store rule)
      PostReports: [
        ['id', '', 'int'], ['ann_id', 'Announcements › id', 'int'], ['comment_id', 'PostComments › id; 0 = the post itself', 'int'],
        ['reporter', 'Who reported it (login)', 'text'], ['reason', 'spam, abusive, inappropriate or other', 'enum:spam|abusive|inappropriate|other'],
        ['note', 'Optional, at most 200 characters', 'text'], ['at', '', 'datetime'],
        ['state', 'OPEN until the IYF head acts: DISMISSED (left on the wall) or REMOVED', 'enum:OPEN|DISMISSED|REMOVED'],
        ['decided_by', '', 'text'], ['decided_at', '', 'datetime']
      ],
      PostMutes: [
        ['id', '', 'int'], ['viewer', 'Who hid the comments (login); * = the IYF head hid them for everyone (and new ones are refused)', 'text'],
        ['author', 'Whose comments are hidden (login)', 'text'], ['by', 'Who did it', 'text'], ['at', '', 'datetime']
      ],
      AppIds: [
        ['id', '', 'int'], ['iyf_id', 'An IYF ID the head created in the app (SR<yy>-0001…): add it to the dashboard', 'text'],
        ['login', 'The devotee (phone)', 'text'], ['name', '', 'text'], ['batch_id', '', 'text'], ['created_by', '', 'text'], ['created_at', '', 'datetime'],
        ['reason', '', 'text'], ['state', 'ACTIVE, or RETIRED once the dashboard gave the person its own ID', 'enum:ACTIVE|RETIRED'],
        ['replaced_by', 'The dashboard ID that replaced it', 'text'], ['retired_at', '', 'datetime']
      ],
      HeadRequests: [
        ['id', '', 'int'], ['kind', 'CREATE (a new person) or PROMOTE (a staff login)', 'enum:CREATE|PROMOTE'], ['login', 'The new head\'s username', 'text'], ['name', '', 'text'],
        ['phone', '', 'text'], ['reason', '', 'text'], ['requested_by', '', 'text'], ['requested_at', '', 'datetime'],
        ['needed', 'Every other active IYF head at the time: all must approve', 'text'], ['approved', 'Those who approved', 'text'],
        ['state', '', 'enum:OPEN|DONE|REJECTED|WITHDRAWN|EXPIRED'], ['decided_by', '', 'text'], ['decided_at', '', 'datetime'], ['note', '', 'text']
      ],
      // 11 Oct 2026 (migration 0038): the IYF identity record. One lasting person behind every login,
      // so a devotee keeps one IYF ID through a name change, a new phone or a new app.
      // Built from the two Facilitation Journals (8,800 rows → 1,345 people, 838 with an ID).
      Persons: [
        ['id', 'The person record. Internal and permanent — never shown to anyone, never reused.', 'text'],
        ['display_name', 'What they go by now. The only name shown anywhere.', 'text'],
        ['iyf_id', 'IYFD-<year>-<seq>, e.g. IYFD-2019-0044. Blank until the year is known.', 'text'],
        ['connected_since', 'The YEAR they first came to IYF Delhi (YYYY). Decides the ID, so only a coordinator may change it.', 'text'],
        ['connected_since_src', 'Where that year came from: import, app, coordinator or inferred', 'text'],
        ['status', 'Active or Inactive, from the journals or the app', 'text'],
        ['merged_into', 'Set when two records turned out to be one person: the id that survived', 'text'],
        ['import_batch', 'The import run that created this row, so one run can be undone whole', 'text'],
        ['created_at', '', 'datetime'], ['updated_at', '', 'datetime']
      ],
      PersonNames: [
        ['id', '', 'int'], ['person_id', 'Persons › id', 'text'],
        ['name', 'A name this person has held. Every one stays searchable: a facilitator who knew them by an older name must still find them, or they make a second record by mistake.', 'text'],
        ['kind', 'given, initiated, or spelling_variant', 'text'],
        ['is_current', 'The one name shown now (exactly one per person)', 'bool'],
        ['from_at', 'When this name began, when it is known', 'text'], ['added_at', '', 'datetime']
      ],
      PersonPhones: [
        ['phone', 'A number belongs to exactly one person — that is what stops two records for one devotee', 'text'],
        ['person_id', 'Persons › id', 'text'], ['is_primary', '', 'bool'],
        ['active', 'An old number stays here, inactive, so past records still find them', 'bool'],
        ['added_at', '', 'datetime']
      ],
      PersonIdentifiers: [
        ['fid', 'Every ID this person has ever had: IYFD-…, and the old dashboard GP/JN/KT or SR numbers', 'text'],
        ['person_id', 'Persons › id', 'text'], ['series', 'IYFD, GP, JN, KT or SR', 'text'],
        ['state', 'current, superseded (replaced but still resolves) or retired', 'text'],
        ['superseded_by', 'The ID that replaced this one. The old ID is never reissued and never stops resolving.', 'text'],
        ['issued_by', 'import, app or dashboard', 'text'], ['issued_at', '', 'datetime'], ['ended_at', '', 'datetime']
      ],
      PersonLinks: [
        ['service', "Which app: 'sadhana'", 'text'], ['account_ref', 'That app\'s own key — here, Accounts › login', 'text'],
        ['person_id', 'Persons › id', 'text'], ['linked_at', '', 'datetime']
      ],
      PersonHistory: [
        ['id', '', 'int'], ['person_id', 'Persons › id', 'text'],
        ['kind', 'facilitator, level, source_row or note', 'text'],
        ['value', '', 'text'], ['seq', 'Order within a kind, oldest first', 'int'],
        ['source', 'Which journal, tab and row it came from', 'text'], ['recorded_at', '', 'datetime']
      ],
      IdSequences: [
        ['series', 'IYFD', 'text'], ['year', 'The connected-since year', 'text'],
        ['next_seq', 'The next number for that year. Resets each year, so IDs stay four digits — the busiest year on record is 333 people against a 9,999 ceiling.', 'int'],
        ['updated_at', '', 'datetime']
      ]
    },
    seed: {
      Batches: [
        ['SPS', 'SPS', 'SPS', 'SPS', 'SPS/DPS', 'SPS', '', true, true, false, '', '', 'setup'],
        ['SPS2', 'SPS Group 2', 'SPS', 'SPS', 'SPS/DPS', 'SPS Group 2', '', true, true, true, '', '', 'setup'],
        ['SPSO', 'SPS Online', 'SPS', 'SPS', 'SPS/DPS', 'SPS Online', '', true, true, false, '', '', 'setup'],
        ['DPS', 'DPS', 'DPS', 'BVS/DPS/BSS', 'SPS/DPS', 'DPS', '', true, true, false, '', '', 'setup'],
        ['BSS', 'BSS', 'BSS', 'BVS/DPS/BSS', 'BSS', 'BSS', '', true, true, false, '', '', 'setup'],
        ['BVS', 'BVS', 'BVS', 'BVS/DPS/BSS', 'BVS', 'BVS', '', true, true, false, '', '', 'setup']
      ]
    }
  }
  ,
  profiles: {
    title: 'Sadhana · Profiles',
    about: [
      'Sadhana Record · Profiles',
      'Personal details given at sign-up. Owner only; coordinators see their own batch inside the app, group leaders never see this file. No ID numbers of any kind are collected.',
      '',
      'Profiles: one row per devotee login. The photo itself is in the owner-only Sadhana Photos Drive folder; only its file id is here.'
    ],
    tabs: {
      Profiles: [
        ['login', 'Devotee phone (Access › Accounts › login)', 'text'],
        ['iyf_id', 'Copied from Accounts when linked', 'text'],
        ['name', '', 'text'],
        ['dob', 'Date of birth (for the in-app birthday panel)', 'date'],
        ['blood_group', '', 'enum:A+|A-|B+|B-|AB+|AB-|O+|O-|Don\'t know'],
        ['emergency_name', '', 'text'],
        ['emergency_relation', '', 'text'],
        ['emergency_phone', '', 'text'],
        ['photo_file_id', 'Drive file id of the 400 × 400 face photo (blank = no photo)', 'text'],
        ['photo_updated_at', '', 'datetime'],
        ['reading_pages_per_hour', 'For the book-progress estimate (default 20)', 'int'],
        ['current_book_id', 'Rules › Books › book_id, or blank', 'text'],
        ['updated_at', '', 'datetime'],
        ['updated_by', '', 'text'],
        ['addr_line', 'Address: house / street', 'text'], ['addr_area', 'Area / locality', 'text'], ['addr_city', 'City', 'text'],
        ['addr_pin', 'PIN code (6 digits)', 'text'],
        ['addr_state', 'State or union territory, from the list (India); empty for an address saved before 4 Oct 2026', 'text'],
        // 8 Oct 2026 (migration 0030): consent at sign-up
        ['parent_name', "Under 18 at sign-up: the parent's or guardian's name (their consent, DPDP Act 2023)", 'text'],
        ['parent_phone', "Under 18 at sign-up: the parent's or guardian's mobile", 'text'],
        ['parent_consent_at', 'When the parent or guardian consent was given (the sign-up)', 'datetime'],
        ['privacy_consent_at', 'When the privacy notice was agreed to at sign-up (blank: an older app that did not ask)', 'datetime'],
        // 9 Oct 2026 (migration 0036, Phase 9): the address in parts; addr_line is built from house and street
        ['addr_house', 'House / flat number (empty: an address saved before 9 Oct 2026 — see addr_line)', 'text'],
        ['addr_street', 'Street / gali / road (optional)', 'text'],
        ['addr_landmark', 'Landmark (optional)', 'text'],
        // 11 Oct 2026 (migration 0038): the fields sign-up asks for, and the link to the person record.
        // All optional and all editable later from the Account page; none is scored or used in any rule.
        ['gender', '', 'text'],
        ['marital_status', '', 'text'],
        ['initiated_name', 'Initiated name, when they have one. The displayed name stays whatever they go by now', 'text'],
        ['class_level', 'SPS / DPS / BSS / BVS / VL-2 / VL-3 / TRD', 'text'],
        ['chanting_rounds', 'Rounds a day', 'text'],
        ['education', '', 'text'],
        ['education_institute', '', 'text'],
        ['profession', 'What they do — studying, working, the field', 'text'],
        ['organization', 'Company / organisation', 'text'],
        ['skills', 'Service skills they offer, from the fixed list (JSON array)', 'text'],
        ['connected_since', 'The YEAR they first came to IYF Delhi (YYYY). Year only — no month is asked for (the user, 11 Oct 2026). This decides their IYF ID, so only a coordinator may change it', 'text'],
        ['connected_area', 'Where they connected — temple, college, a programme', 'text'],
        ['connected_by', 'Who brought them (not necessarily their facilitator)', 'text'],
        ['person_id', 'persons.id — the one lasting person record behind this login', 'text'],
        ['imported_fields', 'Fields filled from the old journals and not yet confirmed by the devotee (JSON array)', 'text'],
        // migration 0040 (next batch, the user 11 Oct 2026): optional at sign-up; at the END, after 0038's fifteen
        ['hobbies', 'What they enjoy (optional at sign-up)', 'text']
      ]
    }
  },
  rules: {
    title: 'Sadhana · Rules',
    about: [
      'Sadhana Record · Rules',
      'Settings, score cards and the hearing / reading lists the app uses. Changed only through the app (master) or by the setup scripts; every change raises the version so phones refresh their copy.',
      '',
      'Settings: submit window, session and lockout limits, list versions.',
      'CardRanges: every option of the SPS card and the BVS/DPS/BSS card, with its range and marks (from the Excel cards).',
      'SevaRules: how weekly service minutes become the Seva score, per card.',
      'ChetnaOptions: the Positive / Negative Chetna choices.',
      'Lectures: the hearing journals for SPS/DPS, BSS and BVS, 81 weeks × 4 lectures each.',
      'Books: the reading sequence (76 books).',
      "BookFiles: each book's own PDF(s) in the IYF Drive folder (several for multi-volume books), English or Hindi.",
      'BookChapters: chapter-by-chapter PDFs (Srimad-Bhagavatam in Hindi), one row per chapter.'
    ],
    tabs: {
      Settings: [
        ['key', '', 'text'], ['value', '', 'text'], ['note', '', 'text'], ['changed_by', '', 'text'], ['changed_at', '', 'datetime']
      ],
      CardRanges: [
        ['card', 'SPS or BVS/DPS/BSS', 'enum:SPS|BVS/DPS/BSS'],
        ['category', 'to_bed, wake_up, japa, day_sleep, pathan, sravan', 'enum:to_bed|wake_up|japa|day_sleep|pathan|sravan'],
        ['order', 'Best option first', 'int'],
        ['label', 'As printed on the card, e.g. 10:00 – 10:15 PM', 'text'],
        ['from', 'Clock times: HH:MM, includes the start. Minutes: lower bound', 'text'],
        ['to', 'Clock times: HH:MM, excludes the end. Minutes: upper bound', 'text'],
        ['marks', 'Marks for this option (may be negative)', 'int'],
        ['version', 'Rules version this row belongs to', 'text']
      ],
      SevaRules: [
        ['card', '', 'enum:SPS|BVS/DPS/BSS'], ['rule', 'divide or step', 'text'], ['value', 'e.g. 90, or a step boundary in minutes', 'text'], ['score', 'Score for a step', 'int'], ['note', '', 'text'], ['version', '', 'text']
      ],
      ChetnaOptions: [
        ['kind', '', 'enum:POSITIVE|NEGATIVE'], ['option', '', 'text'], ['order', '', 'int'], ['active', '', 'bool']
      ],
      Lectures: [
        ['lecture_id', 'e.g. SD-W012-SPL', 'text'], ['journal', 'SPS/DPS, BSS or BVS', 'enum:SPS/DPS|BSS|BVS'], ['week', '1–81', 'int'],
        ['slot', 'SPL, GKGML, LOW 1, LOW 2', 'enum:SPL|GKGML|LOW 1|LOW 2'], ['title', '', 'text'], ['audio_url', 'Google Drive link (blank where the journal has none)', 'text'], ['order', '', 'int'],
        ['link', "What the app opens: the lecture's own Drive file, or its folder when no single file matches (setup/match-lectures.mjs)", 'text']
      ],
      Books: [
        ['book_id', 'e.g. B23', 'text'], ['title', '', 'text'], ['level', 'VL-1, VL-2, VL-3, SPS/DPS or BSS/BVS', 'text'],
        ['words', 'Word count (for the progress estimate)', 'int'], ['language', '', 'text'], ['order', 'Reading-sequence order', 'int'], ['link', 'PDF folder link from the sequence file', 'text'],
        ['title_hi', 'Hindi title, for books with a Hindi edition', 'text'], ['chapters_hi', 'How many Hindi chapter files (BookChapters)', 'int']
      ],
      BookFiles: [
        ['book_id', 'Books › book_id', 'text'], ['order', 'Volume order', 'int'], ['label', 'What the app shows, e.g. Canto 3 or English', 'text'],
        ['url', "The book's own PDF in the IYF Drive folder (setup/match-books.py, setup/build-hindi-books-sql.mjs)", 'text'],
        ['lang', 'en or hi: the English or the Hindi section', 'enum:en|hi']
      ],
      BookChapters: [
        ['book_id', 'Books › book_id', 'text'], ['lang', 'en or hi', 'enum:en|hi'], ['n', 'Order within the book', 'int'],
        ['part', 'e.g. Part 2 (Canto 10); blank when the book has no parts', 'text'], ['label', 'What the app shows, e.g. 3. Maya se Mukti', 'text'],
        ['url', "The chapter's own PDF in the IYF Drive folder", 'text']
      ]
    },
    seed: {
      Settings: [
        ['submit_opens', 'SUN 18:00', 'Week submit window opens (IST)', 'setup', ''],
        ['submit_closes', 'MON 21:00', 'Deadline: unsubmitted weeks are dropped and marked MISSED (IST)', 'setup', ''],
        ['session_days', '30', 'A session ends after this many days without use', 'setup', ''],
        ['lockout_tries', '5', 'Wrong passwords in a row before a lock', 'setup', ''],
        ['lockout_minutes', '15', '', 'setup', ''],
        ['pbkdf2_iterations', '', 'Set once the server has been timed (about half a second per login)', 'setup', ''],
        ['rules_version', 'r0', 'Raised whenever CardRanges / SevaRules / ChetnaOptions change', 'setup', ''],
        ['journals_version', 'j0', 'Raised whenever Lectures / Books change', 'setup', ''],
        ['min_app', '', 'Oldest app build allowed to keep running', 'setup', '']
      ]
    }
  },
  drafts: {
    title: 'Sadhana · Drafts',
    about: [
      'Sadhana Record · Drafts',
      'Weeks being filled in, one row per devotee per week. Each day is saved in its own cell, so saving Tuesday never touches Monday. Never read by the dashboard. At the Monday 9 PM deadline unsubmitted rows are deleted (logged in Access › AuditLog) and submitted rows are removed after copying.'
    ],
    tabs: {
      Drafts: [
        ['key', 'login|week_id', 'text'], ['login', 'Devotee phone', 'text'], ['week_id', 'Monday of the week', 'date'], ['batch_id', '', 'text'],
        ['d1_mon', 'Monday: the typed answers and version, as JSON', 'text'], ['d2_tue', '', 'text'], ['d3_wed', '', 'text'], ['d4_thu', '', 'text'],
        ['d5_fri', '', 'text'], ['d6_sat', '', 'text'], ['d7_sun', '', 'text'],
        ['week_end', 'Night Stay and principles, as JSON', 'text'], ['attendance_self', 'P or A, the devotee\'s own mark', 'enum:P|A'],
        ['created_at', '', 'datetime'], ['updated_at', '', 'datetime'], ['updated_by', '', 'text']
      ]
    }
  },
  submissions2026: {
    title: 'Sadhana · Submissions 2026',
    about: [
      'Sadhana Record · Submissions 2026',
      'Every submitted week of 2026 (a new file each year). Written once, never changed. Scores are worked out by the server from the Excel score cards.',
      '',
      'Submissions: one row per devotee per week, scores in columns as worked out at submit, the typed answers kept as JSON. A later attendance mark (Attendance tab) changes the Attendance and Overall the app shows; this row is never changed.',
      'Attendance: the devotee\'s and the coordinator\'s marks per week; the coordinator\'s wins. Locked at the Monday 9 PM deadline.',
      'Reopens: missed weeks the master reopened, and until when.',
      'ClassWeeks: weeks with no regular class (holiday, festival, other) and how attendance was given.',
      'MissedWeeks: weeks not submitted by the Monday 9 PM deadline (removed again if the week is reopened and submitted).',
      'ReopenRequests: a coordinator asking the master to reopen a missed week, and the answer.'
    ],
    tabs: {
      Submissions: [
        ['submission_id', '', 'text'], ['login', 'Devotee phone', 'text'], ['iyf_id', 'As linked at submit (blank if not yet)', 'text'], ['name', '', 'text'], ['batch_id', '', 'text'], ['week_id', 'Monday of the week', 'date'],
        ['submitted_at', '', 'datetime'], ['submitted_by', 'Login (a coordinator when on behalf)', 'text'], ['on_behalf', '', 'bool'],
        ['request_id', 'Makes a repeated Submit harmless', 'text'], ['rules_version', '', 'text'], ['reopened', 'TRUE if submitted after a master reopen', 'bool'],
        ['bed', '%', 'int'], ['wake_up', '%', 'int'], ['day_sleep', '%', 'int'], ['japa', '%', 'int'], ['pathan', '%', 'int'], ['sravan', '%', 'int'],
        ['seva', '%', 'int'], ['attendance', '% (100 present, 0 absent) at submit; the bridge uses the locked mark', 'int'],
        ['body', 'avg(bed, wake_up, day_sleep)', 'int'], ['soul', 'avg(japa, pathan, sravan)', 'int'], ['overall', 'avg(body, soul, attendance, seva)', 'int'],
        ['seva_minutes', 'Week total', 'int'], ['avg_rounds', 'Week average of daily rounds', 'text'], ['night_stay', '', 'enum:YES|NO'], ['principles', '4 regulative principles', 'enum:YES|NO'],
        ['hearing_minutes', 'Week total', 'int'], ['reading_minutes', 'Week total', 'int'],
        ['days_json', 'The 7 days exactly as typed (weeks before 3 Oct 2026; later weeks: week_json)', 'text'], ['marks_json', 'Each day\'s card option and marks (older weeks)', 'text'], ['bridged_at', 'Copied into the sadhana sheet for Raw at', 'datetime'],
        ['week_json', 'The whole week as one compact JSON: every day with its marks, week-end answers, attendance and scores (what the daily report and the dashboard read)', 'text'],
        ['days_filled', 'Days with answers at submit (1–7); a part week counts the other days as 0 marks. Blank on rows from before 5 Oct 2026 = 7', 'int']
      ],
      Attendance: [
        ['login', 'Devotee phone', 'text'], ['week_id', '', 'date'], ['batch_id', '', 'text'], ['devotee_mark', '', 'enum:P|A'], ['coordinator_mark', '', 'enum:P|A'],
        ['mark_used', 'The mark that counts: the IYF head\'s, else the coordinator\'s, else the group leader\'s, else the week\'s class setting (ClassWeeks), else the devotee\'s', 'enum:P|A'], ['locked', 'TRUE after the Monday 9 PM deadline', 'bool'],
        ['changed_by', '', 'text'], ['changed_at', '', 'datetime'], ['reason', 'Required for a master change after the deadline', 'text'],
        ['leader_mark', "The group leader's mark", 'enum:P|A'], ['leader_by', 'Who gave the group mark', 'text'],
        ['master_mark', "The IYF head's mark (wins over every other)", 'enum:P|A'],
        ['notice_at', 'When a higher mark differed from the devotee\'s own (the devotee is told)', 'datetime'], ['notice_sent', '', 'bool']
      ],
      ClassWeeks: [
        ['batch_id', '', 'text'], ['week_id', 'Monday of the week', 'date'], ['kind', 'No regular class: holiday, festival or another reason', 'enum:HOLIDAY|FESTIVAL|OTHER'],
        ['note', 'e.g. Diwali', 'text'], ['mode', 'ALL_PRESENT: everyone Present · MARKED: only those the coordinator marks Present', 'enum:ALL_PRESENT|MARKED'],
        ['by', '', 'text'], ['at', '', 'datetime']
      ],
      Reopens: [
        ['login', 'Devotee phone', 'text'], ['week_id', '', 'date'], ['reason', '', 'text'], ['open_until', '', 'datetime'], ['by', '', 'text'], ['at', '', 'datetime'],
        ['state', 'OPEN, SUBMITTED or EXPIRED', 'enum:OPEN|SUBMITTED|EXPIRED']
      ],
      MissedWeeks: [
        ['login', 'Devotee phone', 'text'], ['week_id', 'Monday of the week', 'date'], ['batch_id', '', 'text'],
        ['days_filled', 'Days filled in the unsubmitted draft', 'int'], ['at', 'When the deadline dropped it', 'datetime']
      ],
      ReopenRequests: [
        ['login', 'Devotee phone', 'text'], ['week_id', '', 'date'], ['batch_id', '', 'text'], ['reason', '', 'text'], ['by', 'Coordinator who asked', 'text'], ['at', '', 'datetime'],
        ['state', 'PENDING, DONE (reopened) or REJECTED', 'enum:PENDING|DONE|REJECTED'], ['decided_by', '', 'text'], ['decided_at', '', 'datetime']
      ]
    }
  }
};

const VIEW_TABS = {
  'This week': [
    ['Name', '', 'text'], ['IYF ID', '', 'text'], ['Batch', '', 'text'], ['Class day', 'Sunday or Saturday class', 'text'],
    ['Status', 'Submitted, Draft, Not started or Missed', 'text'], ['Days filled', 'of 7', 'text'], ['Submitted at', '', 'datetime'],
    ['Attendance', 'Present / Absent (coordinator\'s mark wins)', 'text'], ['Overall', '%', 'int']
  ],
  'Scores': [
    ['Week', 'Monday of the week', 'date'], ['Name', '', 'text'], ['IYF ID', '', 'text'], ['Batch', '', 'text'],
    ['Bed', '%', 'int'], ['Wake up', '%', 'int'], ['Day sleep', '%', 'int'], ['Japa', '%', 'int'], ['Pathan', '%', 'int'], ['Sravan', '%', 'int'],
    ['Seva', '%', 'int'], ['Attendance', '%', 'int'], ['Body', '%', 'int'], ['Soul', '%', 'int'], ['Overall', '%', 'int']
  ],
  'Days': [
    ['Week', '', 'date'], ['Name', '', 'text'], ['Batch', '', 'text'], ['Day', '', 'text'],
    ['To bed', 'e.g. 10:00 – 10:15 PM · 25', 'text'], ['Wake up', '', 'text'], ['Chanting done', '', 'text'], ['Rounds', '', 'int'],
    ['Day rest', '', 'text'], ['Hearing', 'minutes · topic', 'text'], ['Reading', 'minutes · book', 'text'], ['Service', 'minutes', 'int']
  ],
  'Week-end': [
    ['Week', '', 'date'], ['Name', '', 'text'], ['Batch', '', 'text'], ['Night stay', '', 'text'], ['4 regulative principles', '', 'text'], ['Average rounds', '', 'text']
  ]
};
const VIEW_BATCHES = { SPS: 'SPS, SPS Group 2 and SPS Online', DPS: 'DPS', BSS: 'BSS', BVS: 'BVS' };
for (const [lvl, covers] of Object.entries(VIEW_BATCHES)) {
  SCHEMA['view' + lvl] = {
    title: 'Sadhana View · ' + lvl,
    about: [
      'Sadhana View · ' + lvl,
      'Read-only view of ' + covers + ' for the coordinator and group leaders. Filled in by the Sadhana app; refreshed after every submit and rebuilt every night. Nothing typed here is kept.',
      '',
      'This week: every devotee and whether they have submitted.',
      'Scores: each submitted week\'s percentages, newest first.',
      'Days: day by day, in plain words, with the card marks.',
      'Week-end: Night Stay, the 4 regulative principles and average rounds.'
    ],
    tabs: VIEW_TABS
  };
}
