# IYF Learning Platform (LMS) and Knowledge Base — Proposal

**IYF Delhi · a proposal for discussion · 7 October 2026**

**What this is:** a proposal for a learning-management system (LMS) and a knowledge base for IYF Delhi's training programmes. Examples are **ETP** and **MTP**, among others.

**Status:** nothing here is built.

**Built on:** what already exists in *Sadhana Record* (`docs/current-features.md`).

> **To confirm before any design work (§10):** what ETP and MTP stand for at IYF Delhi, their modules and duration, who teaches them, how a participant passes, and whether a certificate is given. This proposal deliberately makes no assumption about their content.

---

## 1. Summary

**Recommendation:** build the LMS as a new **"Learn" area inside Sadhana Record**, not as a separate product. It would share:
- the same sign-in (phone identity);
- the same people and roles (devotees, facilitators, coordinators, the IYF head);
- the same batches;
- the same Cloudflare database and Google Sheets copy;
- the same installable app.

The knowledge base is a searchable library of articles, notes, FAQs and SOPs for trainers and staff, living in the same area.

**Why one app:**
- devotees already have it on their phones;
- staff already manage people in it;
- training progress and sadhana belong together for a facilitator;
- the cost stays near zero.

**Size:** a first version (one programme, lessons, attendance, progress, a simple quiz, a knowledge base) is about **6–8 weeks** of work.

---

## 2. What Sadhana Record already gives an LMS (CURRENTLY EXISTS)

| Existing part | Reuse for learning |
|---|---|
| Phone-based accounts, approval by a coordinator, roles and scopes | Learners, trainers and programme coordinators without new logins |
| Batches with levels (SPS, DPS, BSS, BVS) and memberships with history | Cohorts; who is enrolled in which programme and since when |
| Facilitators list and facilitator view (read-only students) | A facilitator sees their students' training progress beside their sadhana |
| **Hearing journals:** 324 lectures per journal, 81 weeks × 4 slots, Drive links, a "heard" list | The pattern for a curriculum: modules → lessons → media link → completion |
| **Books:** 76 books in levels, with PDF links | Course reading lists |
| Weekly cycle with deadlines, auto-submit, reopen | Assignment windows and late rules |
| Attendance (5 levels: devotee, group leader, coordinator, head, class-week default) | Session attendance for live classes |
| Announcements wall with images, likes, comments | Course announcements and discussion |
| Web Push (reminders, posts) | Class reminders, assignment due dates |
| Offline drafts (IndexedDB), PWA, look tiers | Lessons and notes readable offline on weak phones |
| Audit log, Google Sheets mirror, batch view sheets | Training records for IYF in Sheets, with full history |
| Release gate, browser and device test tools | The same quality bar for new screens |

---

## 3. Who uses it (roles)

| Role | New or existing | What they do |
|---|---|---|
| **Learner** | Existing devotee (or a new sign-up) | Joins a programme, studies lessons, attends sessions, submits assignments and quizzes, sees progress, downloads a certificate |
| **Trainer** | New scope, granted per programme by the head | Teaches sessions, marks attendance, reviews assignments, posts to the course |
| **Programme coordinator** | Existing coordinator, or a new per-programme scope | Enrols cohorts, schedules sessions, follows completion, handles exceptions |
| **Content editor** | New scope | Writes and updates lessons and knowledge-base articles; nothing else |
| **Facilitator** | Existing | Sees their students' training progress (read-only), as with sadhana |
| **IYF head** | Existing | Creates programmes, grants trainer and editor scopes, sees everything |

The scopes follow the existing model (§2.1 of the current-features document): one person can be a learner in MTP and a trainer in ETP.

---

## 4. LMS features (PROPOSED)

### 4.1 Programmes and curriculum

- **Programme** (e.g. ETP) → **Course** → **Module** → **Lesson**.
- **A lesson is any of:**
  - text, written in the app with a simple editor (headings, lists, quotes, verses);
  - video;
  - audio (a Drive link, as lectures are today);
  - PDF;
  - a mix of these.
- **Releasing lessons:**
  - Lessons can open on a schedule (week 1, week 2 …), like the hearing journal's weeks, or all at once.
  - **Prerequisites:** a lesson or module can require the previous one.

### 4.2 Enrolment and cohorts

- **Enrolment routes:**
  - a cohort enrols a whole batch, or a hand-picked list;
  - a learner can ask to join; the programme coordinator approves, as with sign-up today.
- **Dates and status:**
  - each cohort has start and end dates;
  - each learner has a status: enrolled, active, completed, dropped.

### 4.3 Learning experience (learner)

- **"Continue" on Home:** the next lesson in one tap, with the progress per course.
- **Completion:**
  - mark a lesson done;
  - for video or audio, done when opened and confirmed;
  - for text, after reading to the end.
- **Notes and bookmarks per lesson,** kept on the phone and synced.
- **Offline:** download a module's text and PDFs for reading without a network (videos stay online).

### 4.4 Live sessions and attendance

- **Sessions:** each has a date, time, place or online link, and a trainer.
- **Attendance:** P/A marked by the trainer, using the same precedence and lock rules as class attendance. A learner can also check in with a 4-digit session code shown by the trainer.
- **Reminders:** a push the evening before and 1 hour before.

### 4.5 Assessments

- **Quizzes:**
  - multiple choice and true/false;
  - auto-graded on the server;
  - limited attempts;
  - a time window.
- **Assignments:**
  - a written answer (text), or a photo of handwritten work (the JPEG pipeline already exists);
  - reviewed by the trainer with a mark and comment.
- **Passing rules per course:** attendance ≥ X%, quizzes ≥ Y%, assignments done.

### 4.6 Progress and reporting

| Who | What they see |
|---|---|
| Learner | Per lesson, module and course; what is next; what is overdue |
| Trainer and programme coordinator | A cohort board in the style of the sadhana status board: who is behind, attendance, quiz averages |
| Facilitator | Each student's programmes and progress |
| IYF head | All programmes: enrolments, completion and drop-off by module |
| Google Sheets | Every table copied, as today, so IYF can analyse in Sheets |

### 4.7 Certificates (if IYF gives them)

- **Generated:** on the device as a PDF or image, with the name, programme, date and a verification code.
- **Verified:** on a public page, `/verify/<code>`.
- **No paid service is needed.**

---

## 5. Knowledge base (PROPOSED)

**Purpose:** one trusted place for IYF Delhi's how-to knowledge, so it is not lost in WhatsApp chats. Contents include:
- training notes;
- SOPs for coordinators and facilitators;
- FAQs for devotees;
- class outlines;
- event checklists;
- this app's own help.

**Features:**
- **Articles:**
  - title, body (rich text), tags, programme or audience, author, last reviewed date;
  - versions with "what changed".
- **Audiences:** public, all devotees, staff only, trainers only, or a programme's learners. The same permission model as announcements.
- **Search:** full-text, using SQLite FTS5 in D1 (built in, free), over titles, bodies and tags, with Hindi and English text.
- **Collections:** e.g. "ETP trainer handbook", "Coordinator SOPs", ordered like a book.
- **Review reminders:** an article not reviewed in 6 months shows "may be out of date" and reminds its editor.
- **Helpful? Yes/No** on each article, to find weak content.
- **Offline:** pinned collections are kept on the phone.

---

## 6. Architecture options

| Option | What it means | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. A "Learn" area in Sadhana Record** | New screens and API actions in the existing app and worker; new D1 tables | One login, one app on the phone; roles and batches reused; near-zero cost; same tests and release gate | The app grows: keep the Learn screens in their own lazy chunk so sadhana stays fast | **Recommended** |
| B. A separate app sharing the login | A second Cloudflare app and API, reusing the accounts | Clean separation | Two apps to install and maintain; shared login work; duplicate UI | Only if the LMS grows very large |
| C. An off-the-shelf LMS (Moodle, Google Classroom, a paid SaaS) | Use an existing product | Rich features at once | Separate logins; no link to batches, facilitators or sadhana; data outside IYF's sheets; Moodle needs a server; SaaS costs per user | Not recommended for IYF's needs |

**Option A in detail:**

- **Frontend:**
  - a `learn/` folder of screens, lazy-loaded;
  - routes such as `#/learn`, `#/learn/<programme>/<course>`, `#/kb`, `#/kb/<article>`;
  - the old `#/learn` link (today a redirect to Hearing) moves to these screens.
- **API:** new modules `programmes.js`, `lessons.js`, `assess.js`, `kb.js`, using the same action registry, roles, request IDs and audit log.
- **Database (D1), new tables:** `programmes`, `courses`, `modules`, `lessons`, `cohorts`, `enrolments`, `lesson_progress`, `sessions`, `session_attendance`, `quizzes`, `quiz_questions`, `quiz_attempts`, `assignments`, `submissions_learn`, `certificates`, `kb_articles`, `kb_versions`, `kb_fts` (FTS5).
- **Media:**
  - **Videos:** YouTube (unlisted) or Google Drive links. No video hosting cost.
  - **PDFs and images:** Cloudflare R2. The free tier is 10 GB, with no charge for downloads.
  - Lesson text stays in D1.
- **Sheets:** every new table is added to the mirror, as the "Sheets mirror everything" rule requires.

---

## 7. Cost and capacity

**Prices are Cloudflare's published plans as of October 2026; confirm before deciding.**

- **Requests and storage:**
  - **Worker:** reading lessons and saving progress fits within the free plan, or the US$5 plan already planned for sadhana at scale.
  - **D1:** text lessons and progress are small. 2,000 learners × 100 lessons = 200,000 progress rows, well within limits if writes are incremental.
- **Media:**
  - **R2:** PDFs and images within 10 GB free.
  - **Video:** YouTube or Drive, free.
- **Push and Sheets:** the existing setup.
- **People:** the main cost is content writing and trainer time, not technology.

---

## 8. UX principles for Learn

- **The same calm design system** as the sadhana app (`docs/ux-modernization-proposal.md` §6). Learn gets its own area colour, for example a deep teal, named in words in the top bar.
- **One clear next step:** "Continue lesson 4 of 12".
- **Mobile first, readable:** 16–18 px body, 60–75 characters per line, serif headings, verses set apart.
- **Weak networks:** text first, media on tap; offline modules; the Low tier shows no images.
- **No gamification:** progress and completion, not points or leaderboards.
- **Accessible:** captions or transcripts for video lessons (from trainers), alt text, keyboard navigation, screen-reader-friendly quizzes.
- **References to study** (see `ux-modernization-proposal.md` §13):
  - **Mobbin:** real learning and course apps — lesson lists, "continue" cards, quiz screens, progress pages.
  - **Linear:** keyboard-first lists, for trainers and programme coordinators reviewing cohorts.
  - **Apple:** reading typography and progressive disclosure, for long lessons and knowledge-base articles.
  - **What not to copy from consumer learning apps:** streaks, points and leaderboards (no gamification).

---

## 9. Roadmap

| Phase | Content | Size |
|---|---|---|
| 0 — Discovery | Answer §10; collect one programme's real curriculum (ETP or MTP); decide certificates; choose video hosting | 1–2 weeks |
| 1 — Knowledge base | Articles, audiences, search (FTS5), collections, editor scope; move the app's How to use into it | 2 weeks |
| 2 — Programmes and lessons | Programme / course / module / lesson; cohorts from batches; learner Continue; progress; facilitator view | 3 weeks |
| 3 — Sessions and attendance | Schedule, reminders, trainer attendance, session code check-in | 2 weeks |
| 4 — Assessment | Quizzes (auto-graded), assignments (trainer review), passing rules | 2–3 weeks |
| 5 — Certificates and reporting | Certificates with a verification page; programme dashboards; Sheets views | 2 weeks |
| 6 — Polish | Offline modules, accessibility passes, device checks | 1–2 weeks |

Each phase goes through the existing release gate and test tools. Phases 1 and 2 are useful on their own.

**When to start:** after the Sadhana Record UX roadmap's Phase 1 (`ux-modernization-proposal.md` §11), so Learn is built on the shared state model and design.
- The knowledge base (Phase 1 here) needs only the answer to §10 question 6 (audiences), so it can begin as soon as that answer arrives.
- Programmes and lessons wait for the other answers.

---

## 10. Questions for IYF Delhi (to answer before design)

1. **ETP and MTP:**
   - their full names;
   - who they are for (which batches or levels);
   - duration;
   - modules and topics;
   - language (English, Hindi, both).
2. **Teaching:**
   - in-person classes, online, self-paced, or a mix;
   - who the trainers are;
   - is a trainer always a facilitator or coordinator?
3. **Passing:** attendance, quizzes, written work, a viva, a facilitator's recommendation? Is there a certificate, and who signs it?
4. **Link with sadhana:**
   - Should a programme require sadhana consistency to enrol or to pass?
   - Should training progress feed level promotion (SPS → DPS and onward)?
   - Promotion is decided in the facilitator dashboard today.
5. **Content:**
   - Where do ETP/MTP materials live today (Drive, WhatsApp, printed)?
   - Who may edit them?
   - Are some confidential (trainer-only)?
6. **Knowledge base audience:** which articles are public, for devotees, for staff only?
7. **Media rights:** lecture recordings, slides and photos — may they be shown in the app?
