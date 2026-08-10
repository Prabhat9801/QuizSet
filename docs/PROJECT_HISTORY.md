# Project History

A dated log of real decisions made on QuizSet — the *why*, not the *what* (the *what* is always in the
code and in `git log`). Written so a future session (or a Claude agent opening this repo cold on a
different machine) can pick up with the same context a human collaborator would have, without needing
the original chat transcript.

**Maintenance rule: append a new dated entry here whenever a real decision is made or changed** — a
product-scope call, an architecture choice, a naming decision, anything a future session would
otherwise have to re-derive or could get wrong by guessing. Update `CLAUDE.md` too if the decision
changes one of its stated invariants.

---

## 2026-08-09 — Frontend rebuilt to match the "real idea," QuizSet brand kept

Starting point: a Replit-generated frontend-only prototype (`artifacts/quizset/`) that only loosely
matched the actual product intent — the intent being a second, independent system built on the same
mental model as an earlier Supabase-backed platform (referred to throughout as "Pallawi Di's system,"
tracked separately in the `quiz-ITI` repo/folder).

- Did a role-by-role gap analysis (platform owner / coaching owner / student) against that intent before
  touching code, per explicit instruction not to modify code until the gaps were understood and agreed.
- Decision: **keep the QuizSet name** (not the "KOPI" branding that appears in the old
  `Frontend_Prompt.txt` spec file — that file is a stale earlier draft; the actually-built spec and
  every line of shipped code says QuizSet). Don't reopen this.
- Rebuilt across most of the app: tenant isolation fixed to derive solely from `user.tenantId` (a
  switchable global "current tenant" was a real bug, not just cosmetic), real per-coaching white-label
  branding (hex → HSL → CSS custom properties, WCAG contrast check for text-on-brand-color), a
  content-review pipeline for question banks (`Generating → Platform Review → Coaching Review →
  Finalized`, deliberately not duplicated as a second state machine on the request itself), Topic-wise/
  Unit-wise/Multi-unit/Custom/Full practice modes with no-repeat question tracking (mirroring the
  original kundan_quiz/Pallawi-Di system), and a per-exam (later per-course, see 2026-08-10)
  coaching-owner student-activity dashboard.
- Used multi-agent orchestration (Workflow/parallel Agent dispatch) for genuinely disjoint file sets
  (CSS-only fixes, typecheck-only fixes, docs) — reverted to sequential single-thread work whenever
  changes rippled through interdependent files (e.g. anything touching `types.ts`), since parallel
  agents editing the same file is a real collision risk, not a hypothetical one (it happened once with
  `CLAUDE.md` itself — a docs-agent and a CSS-agent both touched the same claim about `.bottom-nav`
  mid-flight; caught and fixed by re-verifying against actual line numbers before trusting either
  agent's own report).
- Deployment: added a single-stage `Dockerfile` + `docker-entrypoint.sh` that runs `pnpm build` at
  **container start**, not at `docker build` time — Render's Web Service dashboard env vars are a
  runtime-only value, never visible to `docker build`, so a normal multi-stage `ARG`-based build sees an
  empty `VITE_*`-equivalent (here, `PORT`/`BASE_PATH`) and produces a broken bundle. Same trap, same fix
  shape as the sibling `quiz-ITI` repo hit twice already — don't revert to multi-stage without
  re-solving this first.
- Committed and pushed to `github.com/Prabhat9801/QuizSet.git` (`main` branch) once the build round was
  typecheck+build verified.

## 2026-08-10 — Supabase project repurposed from quiz-ITI to QuizSet (destructive, deliberate)

The user supplied a live Supabase `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and asked to "empty
whatever's in it" so it could be used as QuizSet's backend.

- **Investigated before touching anything** (per this project's own safety practice): read-only
  inspection via the PostgREST OpenAPI endpoint, the Storage API, and the Auth admin API revealed the
  project was **not empty** — it was the already-deployed **quiz-ITI** production Supabase project
  (matching tables `live_test_questions` etc., storage buckets `syllabus`/`logos`, and a seeded
  "Sunrise Academy" demo tenant with 5 real accounts, all documented in quiz-ITI's own `CLAUDE.md`).
- Surfaced this explicitly and got **explicit, informed re-confirmation** before proceeding — the user
  confirmed: yes, that project, wipe it, reuse it for QuizSet.
- Executed via a scratch Node script (the `service_role` key alone can't run DDL through PostgREST, so
  a direct Postgres connection via the `pg` npm package was used instead, through the connection
  pooler on port 6543 — the direct 5432 connection needs IPv6 and wasn't reachable from this network):
  `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` + restored the standard Supabase default grants
  (`anon`/`authenticated`/`service_role` usage + default privileges), then emptied and deleted both
  storage buckets, then deleted all 5 auth users via the Auth admin API. Verified empty afterward by
  re-querying all three surfaces.
- **Consequence worth remembering:** quiz-ITI no longer has a working backend on this Supabase project.
  If that platform needs to run again, it needs a *new* Supabase project with its own 6 migration files
  (`supabase/schema*.sql`) rerun against it — this one is QuizSet's now.
- Note on environment: `node` invoked through this session's Bash tool fails outright with `stdin is not
  a tty` on even a trivial `node -e "..."` — completely unrelated to any script content. PowerShell does
  not have this problem. Use PowerShell for any Node script that needs to actually run in this repo's
  environment; Bash is fine for git/pnpm/read-only inspection.

## 2026-08-10 — "Exam" renamed to "Course" everywhere; `type`/`duration` removed from the entity

Correction from the user on the domain model, in two parts:

1. A coaching institute runs a **Course** (an exam-preparation offering, e.g. "SSC CGL 2026
   preparation") for its approved/enrolled students — not a single "Exam." Renamed the concept
   end-to-end: `Exam` type → `Course`, `examService` → `courseService`, every `examId`/`examName` field
   → `courseId`/`courseName`, every route (`/coaching/exams/...` → `/coaching/courses/...`, same for
   `/platform/` and `/student/`), every page file (`ExamEdit.tsx→CourseEdit.tsx`,
   `ExamCreate.tsx→CourseCreate.tsx`, `Exams.tsx→Courses.tsx`,
   `StudentExamLibrary.tsx→StudentCourseLibrary.tsx`, `ExamStudentDashboard.tsx→CourseStudentDashboard.tsx`),
   every UI label. CSS class selectors (`.exam-card`, `.exam-grid`, `.exam-interface`, etc.) were
   deliberately **left as-is** — internal implementation hooks, not user-facing, and renaming them for
   zero functional benefit wasn't worth the risk of a silent visual regression (unlike a TS rename,
   a mismatched CSS class name doesn't fail typecheck). "Exam" as a plain English word (a student's
   real-world competitive exam, "exam strategy" chat copy, the `category: 'Competitive Exam Coaching'`
   tenant field) was correctly left alone — only the product's own entity was renamed.
2. **The `type` field (`'Practice Quiz' | 'Mock Test' | 'Live Test' | 'Previous Year' | 'Topic-wise'`)
   and `duration` field were removed from the entity entirely.** The old model forced a coaching owner
   to pick ONE mode per course at creation time, which fought directly against the practice-mode-picker
   system already built (Topic-wise/Unit-wise/Multi-unit/Custom/Full via `QuizSetup.tsx`) — every course
   now gets the exact same complete, untimed, personal practice system, unconditionally. A timed,
   scheduled, one-shot experience is a **separate `LiveTest` entity** linked to a course (already
   existed, was never actually a course "type" to begin with) — that distinction was the fix, not a new
   feature. `Attempt.tsx` now always renders `PracticeQuizRunner`; `TimedQuizRunner` is used exclusively
   by `LiveTestAttempt`.
3. `CourseCreate.tsx`'s wizard also lost its "pick a question bank" step for a structural reason, not
   just a rename: a question bank is always requested **for** an already-existing course (see the
   `questionBankRequestService` docs in `mock.ts`), so a bank can never pre-exist detached from one —
   the old wizard's "must select a Ready bank before the course can be created" gate was actually an
   impossible chicken-and-egg that would have blocked ALL course creation once no bank could ever exist
   ahead of time. Fixed by making `courseService.create()` always start a course in Draft with
   `questionBankId: ''`, applying the same finalized-bank publish-guard `update()` already had, and
   having `questionBankRequestService.startBank()` write the new bank's id back onto the course the
   moment it's created (well before Finalized — the publish-guard is what actually keeps students out
   until then, not this link).
4. Verified with `pnpm run typecheck` + `pnpm run build` after the full rename — both clean.

## 2026-08-10 — Backend build-out begins: revenue split, certificates, testimonials, real DB

Scope confirmed for the next phase, before any schema/code was written:

- **Revenue split: flat 50% platform / 50% coaching**, set once for the whole platform (not
  per-coaching-configurable) — every course/live-test payment splits this way. Store both computed
  shares (`platformSharePaise`/`coachingSharePaise`) on the payment row at write time for auditability,
  not just a percentage that could drift if the rate ever changes.
- **Virtual certificates**: issued **manually by the coaching owner** (a deliberate action from their
  dashboard, e.g. for a strong result), never auto-generated on some completion threshold. Always shown
  with the coaching's branding **snapshotted at issue time** (so a later rebrand doesn't retroactively
  change an already-issued certificate) plus a static "Powered by QuizSet" mark.
- **Testimonials**: a student submits feedback (optionally naming a real outcome, e.g. "got a job at
  X"); it only goes public — on both the coaching's own page and QuizSet's own landing page, serving
  both parties' marketing — after **two separate approvals**: the coaching owner first, then the
  platform owner.
- **ORM choice: Drizzle, not Prisma.** The user asked for "a Prisma file," but the repo already has
  `lib/db` scaffolded with Drizzle ORM (`drizzle-orm` + `drizzle-kit push` + a `DATABASE_URL`-reading
  connection helper) and zero domain tables defined yet. Introducing Prisma alongside would mean two
  competing ORMs in one repo for no benefit — used the existing Drizzle scaffold instead. If a future
  session is asked for "the Prisma schema" again, redirect to `lib/db/src/schema/`.
- Discovered while investigating where to put the schema: `artifacts/api-server` (Express 5, health-check
  only), `lib/api-spec`/`lib/api-zod`/`lib/api-client-react` (an orval OpenAPI→zod→react-query codegen
  pipeline, health-check only) are real, working scaffolding — not fake — but **100% generic
  Replit-platform boilerplate with zero quiz/course-domain content**, confirmed by grep. Also confirmed
  `artifacts/quizset`'s `package.json` lists `@workspace/api-client-react` as a dependency but **never
  actually imports it anywhere** — dead scaffold from the original generation, same as `@tanstack/react-query`.
  The plan going forward: write the real domain schema into `lib/db`, real routes into
  `artifacts/api-server`, real OpenAPI paths into `lib/api-spec` (regenerating the other two `lib/`
  packages from it), and — as a distinct, later, larger step — actually wire `artifacts/quizset`'s
  services layer to call the real API instead of `localStorage`, replacing `services/mock.ts`'s role
  without necessarily changing every call site's *shape* (the mock layer's async, service-per-domain
  structure was deliberately built to make that swap cheap — see `CLAUDE.md`'s architecture rules).
- Dispatched two parallel background agents for genuinely disjoint work: a full responsive/popup/card/
  scrolling audit across `artifacts/quizset` at mobile/tablet/desktop breakpoints, and the actual Drizzle
  schema design in `lib/db/src/schema/` covering every entity above plus the pre-existing domain
  (tenants, profiles, courses, question banks + requests, questions, course assignments, live tests +
  participants, attempts, payments, chatbot config/usage/messages, join requests). Schema-authoring was
  scoped explicitly as **compile-verified only** — no `drizzle-kit push` against the live database
  without a deliberate, separate, reviewed step (same "don't run destructive/hard-to-reverse actions
  without a clear look first" practice as the Supabase wipe above).
- **Drizzle schema landed**: 17 tables across 15 files under `lib/db/src/schema/` (one file per entity,
  `enums.ts` for the 12 `pgEnum`s, `relations.ts` for every table's `relations()`, `index.ts` as the
  barrel). Two notable implementation details worth remembering:
  - `courses.questionBankId` ↔ `question_banks.requestId` ↔ `question_bank_requests.courseId`/
    `questionBankId` is a genuine 3-table FK cycle (a course can exist before its bank; a bank knows the
    request that produced it; a request names the course it's for) — resolved with Drizzle's
    documented `(): AnyPgColumn => otherTable.id` deferred-callback form on the edges that close the
    loop, not by dropping a constraint.
  - `payments.refId` is a plain indexed `uuid`, deliberately **not** a foreign key — it points at either
    a `courses.id` or a `live_tests.id` depending on `kind`, and one column can't FK two tables.
    `platformSharePaise`/`coachingSharePaise` are stored as actual paise amounts at write time (not a
    percentage), per the flat-50/50 decision above.
  - Verified independently (not just trusting the agent's own report) via `pnpm run typecheck:libs`
    (`tsc --build`) from repo root — clean, no errors.
- **Responsive audit landed** (the other parallel agent): base responsive infrastructure (`.modal`,
  `.table-wrap`, most grids, `.mode-grid`/`.chip-grid`/`.filter-bar`) turned out already solid — only
  two genuine gaps found and fixed in `index.css`: `.form-actions`/`.card-title` had no `flex-wrap`, so
  a 2-3-button row (Cancel/Save, or `TimedQuizRunner`'s Mark-for-review/Previous/Save-&-next trio, or
  `QuestionBankDetail.tsx`'s Badge+stage-action buttons) could overflow a 320-375px card — fixed with a
  `flex-wrap:wrap` rule plus one inline-style fix on the specific row in `QuestionBankDetail.tsx` that
  needed it even after the general fix; and `.student-assign-list .task` (`CourseEdit.tsx`'s student
  checklist) didn't wrap a long name+email pair. Also added a `min-width:1280px` rule opening
  `.exam-grid` to 3 columns on wide desktop instead of staying fixed at 2 (wasted width otherwise).
  Verified independently: `pnpm --filter @workspace/quizset run typecheck` clean.
- **Schema pushed to the live (wiped) Supabase database** via `drizzle-kit push`. Hit and fixed a real
  bug first: `lib/db/drizzle.config.ts` used `path.join(__dirname, ...)` to point at the schema, but
  `lib/db` is `"type": "module"` (ESM) — `__dirname` isn't defined in ESM, and whatever shim resolved
  it produced a path drizzle-kit couldn't find anything at ("No schema files"). Fixed by pointing
  `schema` at the plain relative string `"./src/schema/index.ts"` instead (drizzle-kit's own supported
  style) rather than computing an absolute path. After that, `push` ran clean against the pooler
  connection (port 6543 — same IPv6/direct-5432 caveat as the wipe) with no confirmation prompts needed
  (a brand-new empty database has nothing ambiguous to confirm) — all 17 tables now exist, verified by
  re-querying `information_schema.tables`.
- **Docker entrypoint now applies the schema at container start too**, same "runtime env vars aren't
  visible during `docker build`" reasoning already used for the frontend build: if `DATABASE_URL` is
  set, `docker-entrypoint.sh` runs `pnpm --filter @workspace/db run push` (deliberately `push`, not
  `push-force` — an ambiguous schema change should make it hang/stop for a human to resolve by hand
  unattended against a real database, not auto-confirm a guess) before building/serving the frontend;
  if `DATABASE_URL` isn't set, it logs and skips rather than failing the whole container, since a
  frontend-only deploy with no backend configured is still a valid, currently-supported case.
- **Landing page rewritten** (`Public.tsx`'s `Landing` component, ~800 lines, now normally formatted
  instead of one giant line) into 14 sections per a reviewed, trimmed plan (cut from an earlier
  25-section draft that repeated the same "syllabus → question bank → your approval" message 3-4 times
  and the same "you give us / we build / you control" message another 2-3 times — merged into one
  strong "How It Works" section instead). Also fixed two real accuracy problems the draft had inherited:
  removed a fabricated "Rank 124/2,540" claim (no cross-course/platform leaderboard exists — deliberately
  cut from scope, see "Known gaps" in `CLAUDE.md`) and stopped implying a student's own single-result
  screen shows a personal topic-by-topic accuracy chart (that aggregate breakdown only exists on the
  *coaching's* course dashboard across all students today). Toned down fabricated big numbers in the
  hero/payments mockups (₹4.82L revenue, 2,540 students, etc. — QuizSet has no real customers yet) to
  small illustrative figures with an explicit "Example workspace · illustrative numbers" label. Removed
  a Starter/Growth/Enterprise monthly-SaaS-tier pricing section that described a subscription billing
  model with no basis anywhere in the actual product (QuizSet only has per-course/live-test/chatbot
  payments) — replaced with one real course-pricing example. Verified independently (not just the
  agent's own report): diffed the actual file and confirmed the removed claims don't reappear anywhere
  in the new content.
- **Certificates + testimonials landed** (built together, deliberately, by one agent — both features
  share `types.ts`/`services/mock.ts`/`App.tsx`/`AppShell.tsx`, and splitting them across two parallel
  agents would have guaranteed a same-file merge conflict): `certificateService`/`testimonialService`
  added to `mock.ts` following the existing `readList`/`writeList` pattern; a coaching owner issues a
  certificate manually from a per-student row on `CourseStudentDashboard.tsx` (branding + names
  snapshotted at issue time); students see their own certificates at `/student/certificates` and a
  certificate is also viewable at a bare, unauthenticated `/certificate/:code` route (for sharing); a
  student submits a story from a new card on their own `ResultsHistory` page; the coaching owner's
  approval queue is a third tab on `Students.tsx`; the platform owner's second-gate queue is a new
  `/platform/testimonials` page. Verified independently: `pnpm run build` exit 0, and confirmed by
  reading the actual files that the `CourseWithCount` import (which showed up mid-edit importing from
  the wrong module in an earlier system snapshot) was already self-corrected to import from
  `services/mock` before the agent's final report.
- **Real API routes landed** in `artifacts/api-server/src/routes/` — 14 resource route files on top of
  the live schema. Auth verifies the bearer token against Supabase's `GET /auth/v1/user` (no local JWT
  secret available in this environment) rather than local HS256 verification; authorization
  (`requireRole`, `canAccessTenant`) is entirely app-layer, since there's no Postgres RLS in this pass —
  that's the actual security boundary right now, not a placeholder. A real bug caught by the agent's own
  live sanity-check against the database: applying `authenticate` via a path-less `router.use()` in one
  resource file leaked into every *other* flat-mounted router (Express dispatches sub-routers in
  mount order on the same base path), turning routes that should be public (e.g. the testimonials
  public feed) into 401s — fixed by applying `authenticate` per-route everywhere instead. Independently
  verified: `pnpm --filter @workspace/api-server run typecheck` clean.
- **Frontend API client landed** at `artifacts/quizset/src/services/api/` — same function shapes as
  `services/mock.ts`, not wired into any page yet (deliberately — that's the next, separate step).
  Reuses `lib/api-client-react/src/custom-fetch.ts`'s existing `setBaseUrl`/`setAuthTokenGetter` seam
  rather than a new fetch wrapper. Converts paise↔rupees at this boundary so the rest of the frontend
  never has to know paise exist on the backend. Found and fixed a real gap while cross-checking against
  the actual (not planned) route code: `PATCH /api/profiles/:id` was referenced by the client
  (`studentService.update()`, used to approve/suspend a student) but never implemented server-side —
  added it myself directly (`profiles.ts`), deliberately excluding `role`/`tenantId` from what a generic
  profile PATCH can change (both are identity/security-sensitive and go through their own dedicated
  flows — join-requests decide `tenantId`; nothing changes `role` at all), the same "role/tenantId
  immutable outside a dedicated flow" invariant the sibling `quiz-ITI` repo already learned the hard way
  once. Independently verified: both packages' `typecheck` clean.
- **Frontend cut over from `services/mock` to `services/api`, page by page**, split across 3 parallel
  agents by role (platform+shared list pages / coaching pages / student pages) specifically to avoid a
  same-file collision, plus a 4th agent wiring real Supabase Auth. Every service actually switched was
  first checked against the real `services/api/*` exports — nothing was guessed. Two services were
  deliberately left on `mock.ts` everywhere, not migrated by mistake: `aiService.reply()` (a canned
  keyword-matcher standing in for an LLM call — no chat-completion endpoint exists anywhere in this pass)
  and `notificationService` (never part of the route plan at all). `authService` has no real
  counterpart either — that seam is Supabase Auth's job, not `services/api`.
  - The student-pages batch agent was killed mid-task by the user; checked its actual progress rather
    than assuming: 6 of 9 assigned files were already fully switched and left in a clean, compiling
    state before being stopped. Finished the remainder myself — `AI.tsx` was a clean split
    (`chatbotConfigService`/`paymentService` → real, `aiService` stays mock, matching the documented
    exception above); `JoinFlow.tsx` was deliberately left untouched rather than guessed at, since its
    `joinNow()` flow calls `login()` with a shape that depends on exactly how the (still in-flight)
    Supabase Auth wiring reshapes `AppContext`'s login semantics — finishing it before that agent lands
    risked building against an interface that was still moving.
  - Added `.env`/`.env.*` to the root `.gitignore` (it had no such entry at all) after creating
    `artifacts/quizset/.env` with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` — confirmed via
    `git check-ignore` that it's excluded before it could ever reach a commit.
  - Verified independently after every agent: `pnpm --filter @workspace/quizset run typecheck` clean
    across the whole batch, not just each agent's own file set.
- **Real Supabase Auth wired** (`services/supabase.ts`, `@supabase/supabase-js`, env-var based —
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, never hardcoded) alongside the existing mock demo login,
  not instead of it — `AppContext` prefers a real session when one exists but never tears down a working
  mock/demo session just because no real one exists. Added both env vars to a new, now-gitignored
  `artifacts/quizset/.env` (root `.gitignore` had **no** `.env`/`.env.*` pattern at all until this point —
  added one, with a carve-out for a future `.env.example`, and confirmed via `git check-ignore` before
  the real anon key could ever reach a commit).
- **Closed three real gaps the auth-wiring agent surfaced but correctly declined to paper over itself**
  (each verified against the actual schema/routes before fixing, not guessed):
  1. No server-side "create my profile after a real signup" endpoint existed at all — added
     `POST /api/profiles/me` (self-service, idempotent, always `role: 'student'`/no tenant — a signup
     can never grant itself coaching/platform access), and wired `AppContext`'s profile fetch to call it
     automatically on a 404 and retry once.
  2. The API client's `joinRequestService.joinByCode()` was calling `PATCH /api/profiles/:id` with a
     `tenantId` — but that route deliberately ignores `tenantId` (by design, see the PATCH route's own
     comments), so a real join-by-code would have silently done nothing. Added a dedicated
     `POST /api/profiles/me/join` (looks up the tenant by code and assigns it server-side in one step,
     only for a caller with no tenant yet) and repointed the client at it.
  3. `tenantService.findByJoinCode()`/`.search()` (used by the whole student join flow) were hitting
     `GET /api/tenants`, which is platform-owner-only — a student mid-join-flow would 403 on both. Added
     two narrow, any-authenticated-role endpoints (`GET /api/tenants/by-join-code/:code` exact-match,
     `GET /api/tenants/search?q=` name/city match) rather than opening up the full list, and repointed
     the client.
  `JoinFlow.tsx` (the one file left mid-cutover after the killed student-batch agent) was then cut over
  cleanly — its `authService` import turned out to be dead code (never referenced in the component body).
- **Final full-monorepo verification**: `pnpm run typecheck` (all 9 workspace projects: 4 libs + 4
  artifacts + scripts) and `pnpm run build` both clean. Remaining build warnings are the same pre-existing
  cosmetic dynamic/static-import chunking notices every prior phase already noted — not errors, not
  something introduced by this work.

---

## 2026-08-10 — Real end-to-end demo tenant, with the two real question banks in full

User asked for proof the backend actually works end-to-end (not just typechecks/builds), then for a
real demo: 1 demo coaching, 2 courses, real students, a Syllabus view, and a Study Plan feature
(coaching sets it manually per-unit or auto-generates evenly-spaced dates across a date range) — and
was explicit that "demo" means only the *coaching's identity* is fictional; every row, account, and
question underneath must be real, and the syllabus must reflect each source's **complete** bank, not
one sample topic file.

- Pushed `study_plans` / `study_plan_items` (already defined in `lib/db/src/schema/study-plans.ts`)
  to the live Supabase Postgres via `drizzle-kit push` — first time either table existed in the real DB.
- Created tenant **"QuizSet Demo Academy"** (`join_code` `DEMO2026`) with 2 question banks and 2 courses,
  each drawing from one of this project's two real source repos:
  - **"Kundan Bhaiya's Bank — JEE/NEET (Chemistry, Physics, Maths)"** ← every real topic file under
    `kundan_quiz/public/questions/*/*.json` (Desktop copy) → course **"JEE/NEET Complete Practice —
    Chemistry, Physics & Maths"**. 146 of 149 files loaded (excluded: 2 files with genuine JSON parse
    errors — `Maths_Unit4_Calculus/differentiation_applications.json`,
    `Physics_Unit7_Light_Optics/modern_physics_quantum.json` — and 1 file with a demonstrably-skewed
    answer distribution, `Chemistry_Unit11_Transition_Metals/inorganic_chemistry_d_block.json`, 78/80
    answers marked "0"). Result: **9,603 real questions across 48 real units**.
  - **"Pallawi Di's Bank — ITI Electronics & General Studies"** ← every real topic file under
    `quiz-ITI/public/questions/*/*.json` (Downloads copy) → course **"ITI Electronics & Trade Complete
    Practice"**. All 170 files loaded cleanly. Result: **5,100 real questions across 19 real units**.
  - Gotcha hit and fixed: the `General_Chemistry` / `General_Mathematics` / `General_Physics` folders
    use a different JSON shape than the rest of the bank — `subject`/`subjectName` instead of
    `unit`/`unitName` — which violated the `questions.unit` NOT NULL constraint on first attempt. Fixed
    by falling back to `` `General ${subjectName}` `` (or the folder name, as a last resort) when
    `unit`/`unitName` is absent, so no real file gets silently dropped for a schema quirk.
  - `practice-sets/`, `manifest.json`, `all-questions.json` at the `public/questions/` root (not inside
    a per-topic subfolder) are correctly skipped by directory-only traversal — they aren't per-topic
    MCQ files.
- **Study plans, both modes, both real**: Chemistry course got `mode: 'auto'` (start today, +90 days,
  48 real units evenly spread — 90 days chosen because 48 units need real runway, not the 14 days a
  single-unit trial plan used earlier). Electronics course got `mode: 'manual'` (19 real units, ~4 days
  apart) specifically so the demo exercises **both** halves of the feature, not just one twice.
- **3 real Supabase Auth accounts** (via the Auth admin API with the service-role key, pre-confirmed —
  not a self-serve signup) + matching `profiles` rows, reusing the tenant/courses already created:
  `owner@demo-academy.test` / `DemoOwner@123` (coaching), `student1@demo-academy.test` /
  `student2@demo-academy.test` / `DemoStudent@123` (students).
- **Verified live, not just seeded**: real password-grant login (anon key) → real JWT → real calls
  against the running `artifacts/api-server` (port 8090, pointed at the live DB) for
  `/api/profiles/me`, `/api/courses`, `/api/questions/syllabus-tree`, `/api/study-plans` — confirmed the
  full 48-unit Chemistry syllabus and the rebuilt study plan both come back correctly through the actual
  authorization path (JWT → `profiles` lookup → `{userId, role, tenantId}`), not just present in the DB.
- First pass at this (same day, same session) mistakenly seeded only one sample topic file per bank
  (80 + 30 questions) before the user caught it ("pura pura question bank and syllabus daal rahe h n?")
  — corrected by wiping those rows and reseeding from the complete directory trees above. Left here so
  a future session doesn't repeat the same shortcut.
