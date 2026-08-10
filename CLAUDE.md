# CLAUDE.md

Guidance for Claude Code when working in this repository.

**Read `docs/PROJECT_HISTORY.md` too** — it's the dated log of *why* things are the way they are
(product decisions, architecture calls, corrections). This file (`CLAUDE.md`) is the current-state
snapshot; `PROJECT_HISTORY.md` is how it got here. **Whenever a real decision is made or changed,
append a dated entry to `docs/PROJECT_HISTORY.md` and update this file if an invariant below changes.**
This repo is meant to be picked up cold — by a future session, or by opening it fresh on a different
machine — with no memory of the chat that produced it.

## What this repo is

A pnpm workspace monorepo. The app that matters is [artifacts/quizset/](artifacts/quizset/) —
**QuizSet**, a white-label, multi-tenant examination/learning platform for Indian coaching institutes.

Tagline: _"Your Coaching. Your Brand. Your Course Platform."_

Three roles, three workspaces: **platform owner** (SaaS command center, builds question content) →
**coaching owner** (tenant business OS) → **student** (learning app, scoped to their own coaching).

**The frontend is currently mock/localStorage-only; a real backend is actively being built** (see
`docs/PROJECT_HISTORY.md`'s 2026-08-10 entries). Until that lands, everything in `artifacts/quizset/`
runs on React state + `localStorage` behind mock services — no server, no real DB, no real auth yet.
The service layer (`services/mock.ts`) was deliberately built async and per-domain specifically so the
swap to real HTTP calls doesn't require touching call sites' shapes — keep that property when you
extend it.

## The core domain model: Course, not Exam

A coaching institute runs **Courses** — exam-preparation offerings (e.g. "SSC CGL 2026 preparation"),
each the container for that goal's whole practice system. **There is no "Exam" entity and no per-course
"type."** Every course gets the exact same complete practice system: Topic-wise / Unit-wise /
Multi-unit / Custom / Full practice (via `QuizSetup.tsx`), always **untimed** and personal to each
student, with its own no-repeat question tracking per mode+scope. A timed, scheduled, one-shot
experience is a **separate `LiveTest` entity** linked to a course — that's the only "timed" thing in
the product. Don't reintroduce a course `type`/`duration` field; see `docs/PROJECT_HISTORY.md` for why
that was removed. (CSS class names like `.exam-card`/`.exam-grid`/`.exam-interface` still say "exam" —
that's a deliberate scoping choice, internal styling hooks only, not the domain model.)

A course is only visible to a student once the coaching **approves/enrolls** them (join-code or
search-and-request, see "Student join flow" below) and, if `assignedStudentIds` is non-empty, only to
the specific students listed there (empty = every student in the tenant).

## Commands

Run everything from the repo root.

```bash
pnpm install                                     # required — node_modules is not committed
pnpm --filter @workspace/quizset run dev         # dev server (see PORT gotcha below)
pnpm --filter @workspace/quizset run build       # vite build → artifacts/quizset/dist/public
pnpm --filter @workspace/quizset run typecheck   # tsc --noEmit for the app only
pnpm run typecheck                               # whole workspace (libs + artifacts)
pnpm run build                                   # typecheck + build everything
```

**PORT gotcha:** `vite.config.ts` **throws** if `PORT` or `BASE_PATH` are unset, and the `dev` script
does not set them. Locally you must supply them:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/quizset run dev
```

The production Docker image runs `pnpm build` **at container start** (`docker-entrypoint.sh`), not at
`docker build` time — Render's runtime env vars are invisible to `docker build`, so a multi-stage
`ARG`-based build would see empty `PORT`/`BASE_PATH` and ship a broken bundle. Don't revert this
without re-solving that problem first.

Package manager is pinned to pnpm (a `preinstall` hook rejects npm/yarn). `pnpm-workspace.yaml` sets
`minimumReleaseAge` as supply-chain defense — **do not disable it**.

## Repo map

| Path | Purpose |
|---|---|
| [artifacts/quizset/](artifacts/quizset/) | **The frontend.** Mock/localStorage today; will call the real API once it exists. |
| [lib/db/](lib/db/) | **Real backend schema lives here now** — Drizzle ORM (not Prisma; see `docs/PROJECT_HISTORY.md` for why), `drizzle-kit push` workflow, reads `DATABASE_URL`. Domain tables are being authored in `src/schema/`. |
| [artifacts/api-server/](artifacts/api-server/) | Express 5 scaffold — currently only a `/api/healthz` route. Real domain routes are being added on top of `lib/db`. |
| [lib/api-spec/](lib/api-spec/), [lib/api-zod/](lib/api-zod/), [lib/api-client-react/](lib/api-client-react/) | An `orval` codegen pipeline: OpenAPI YAML → zod schemas + a react-query client. Currently only the health-check path is modeled. `artifacts/quizset`'s `package.json` lists `api-client-react` as a dependency but **does not import it anywhere yet** — that wiring is a distinct, later step (swapping `services/mock.ts` for real calls), not done yet. |
| [artifacts/mockup-sandbox/](artifacts/mockup-sandbox/) | Replit's own component-preview tool. Unrelated to the product; ignore. |
| [docs/PROJECT_HISTORY.md](docs/PROJECT_HISTORY.md) | **Read this.** Dated decision log. |
| [Frontend_Prompt.txt](Frontend_Prompt.txt) | An early, superseded spec draft ("KOPI" branding). Not current — ignore for naming questions. |

### Inside `artifacts/quizset/src/`

| File | What it holds |
|---|---|
| [App.tsx](artifacts/quizset/src/App.tsx) | Every route + the `Protected` role guard, which also redirects a tenant-less student to `/student/join`. |
| [types.ts](artifacts/quizset/src/types.ts) | All domain types: `Tenant`, `Course`, `Question`, `QuestionBank`, `QuestionBankRequest`, `JoinRequest`, `LiveTest`/`LiveTestPhase`, `PracticeScope`, `Attempt`, `ChatbotConfig`, `Transaction`, `Notification`, `Toast`. |
| [data/seed.ts](artifacts/quizset/src/data/seed.ts) | Seed data: users, tenants, students, question banks (at different real review stages), questions (real MCQs, not lorem-ipsum, each carrying `unit`+`topic`), courses, live tests, question-bank requests, a join request, chatbot configs. |
| [services/storage.ts](artifacts/quizset/src/services/storage.ts) | `localStorage` wrapper, `quizset:` key prefix. |
| [services/mock.ts](artifacts/quizset/src/services/mock.ts) | `authService`, `tenantService`, `joinRequestService`, `courseService`, `questionBankService`, `questionBankRequestService`, `questionService`, `studentService`, `liveTestService`, `attemptService`, `paymentService`, `chatbotConfigService`, `aiService`, `notificationService`. Every method is `async` and fakes latency via `wait()` — keep that; real calls will be async too. All still go through `readList`/`writeList` over `storage`, seeded from `data/seed.ts`. |
| [services/branding.ts](artifacts/quizset/src/services/branding.ts) | Converts a tenant's `primaryColor`/`secondaryColor` hex into the `--primary`/`--secondary` CSS custom properties `index.css` reads everywhere. See "White-label branding" below. |
| [lib/practiceHandoff.ts](artifacts/quizset/src/lib/practiceHandoff.ts) | One-shot `sessionStorage` handoff from `QuizSetup.tsx` (what scope/questions the student picked) to `Attempt.tsx` — not wouter navigation state, since this router setup doesn't carry arbitrary state across a route change. |
| [contexts/AppContext.tsx](artifacts/quizset/src/contexts/AppContext.tsx) | `user`, `tenant` (derived, never separately switchable), `tenantId`, `hasTenant`, toasts, `login`/`logout`/`refreshTenants`. No `switchTenant`. |
| [layouts/AppShell.tsx](artifacts/quizset/src/layouts/AppShell.tsx) | Sidebar + topbar + mobile bottom tab bar (student role only). Per-role nav arrays live at the top; no global search, no tenant switcher. |
| [components/ui.tsx](artifacts/quizset/src/components/ui.tsx) | **The kit the app actually uses** — `Button`, `Badge`, `Card`, `Modal`, `PageHeader`, `Stat`, `EmptyState`, `Field`, `Checkbox`, `Alert`, `Skeleton`/`SkeletonList`, `Tabs`. |
| [components/QuizRunner.tsx](artifacts/quizset/src/components/QuizRunner.tsx) | `PracticeQuizRunner` (untimed, instant per-question feedback — what **every** course attempt uses) and `TimedQuizRunner` (palette, mark-for-review, submit confirmation, auto-submit at zero — used **only** by Live Test attempts). |
| [components/ui/](artifacts/quizset/src/components/ui/) | Full shadcn/Radix kit, essentially unused (only `toaster`, `tooltip`, `card` are imported by app code). |
| [index.css](artifacts/quizset/src/index.css) | Design tokens + all component styling as hand-written CSS classes (no Tailwind utilities, despite Tailwind v4 being installed). |

### Inside `artifacts/quizset/src/pages/`

| File | What it holds |
|---|---|
| [Public.tsx](artifacts/quizset/src/pages/Public.tsx) | Landing page, login (one-click demo buttons), signup. |
| [Dashboards.tsx](artifacts/quizset/src/pages/Dashboards.tsx) | The three role dashboards (`PlatformDashboard`, `CoachingDashboard`, `StudentDashboard`). |
| [Coachings.tsx](artifacts/quizset/src/pages/Coachings.tsx) | Platform-owner tenant list + create-coaching modal. |
| [QuestionRequests.tsx](artifacts/quizset/src/pages/QuestionRequests.tsx) | Platform-owner side of the course → question-bank pipeline: accept a request, start its bank, leave an owner note. Status filter tabs + priority filter. |
| [QuestionBanks.tsx](artifacts/quizset/src/pages/QuestionBanks.tsx) | `scope="platform"` (every coaching's banks, every stage) or `scope="coaching"` (own banks once they reach Coaching Review, + the "request a bank for this course" form — pre-fillable via `?courseId=`). Search + status filter. |
| [QuestionBankDetail.tsx](artifacts/quizset/src/pages/QuestionBankDetail.tsx) | Question CRUD for exactly one bank, stage-advance/send-back/finalize actions. Two views: **Formatted review** (quiz-paper style, default) and **Table** — both filterable by unit/topic/difficulty. |
| [Courses.tsx](artifacts/quizset/src/pages/Courses.tsx) | Course catalog list (`scope="coaching"`/`"platform"`), tabbed by status, each card showing the course's real question count. |
| [CourseEdit.tsx](artifacts/quizset/src/pages/CourseEdit.tsx) | Coaching-owner course settings — pricing, status, "restrict to specific students," links to request-a-bank / manage-questions / student-performance. |
| [CourseCreate.tsx](artifacts/quizset/src/pages/CourseCreate.tsx) | 3-step course creation wizard (details → pricing → review). No bank-selection step — a bank is always requested *for* an already-created course, never picked from a pre-existing pool. |
| [CourseStudentDashboard.tsx](artifacts/quizset/src/pages/CourseStudentDashboard.tsx) | Coaching-owner per-course analytics: attempt stats, topic/unit accuracy breakdown (filterable by unit), per-student table (filterable by search) with drill-down into any student's attempt review. |
| [Students.tsx](artifacts/quizset/src/pages/Students.tsx) | Coaching's student directory (search + status filter) + join-request approval queue, tabbed. |
| [StudentCourseLibrary.tsx](artifacts/quizset/src/pages/StudentCourseLibrary.tsx) | Student-facing `StudentCourses` (library, filtered to what this student is assigned/approved for), `CourseDetail` (buy/unlock), `Preview` (free-preview runner). |
| [QuizSetup.tsx](artifacts/quizset/src/pages/QuizSetup.tsx) | Sits between "Start practice" and the attempt: student picks Full/Topic-wise/Unit-wise/Multi-unit/Custom scope + question count, reading the bank's real unit→topic tree. Hands off via `lib/practiceHandoff.ts`. |
| [Attempt.tsx](artifacts/quizset/src/pages/Attempt.tsx) | Always renders `PracticeQuizRunner`, using whatever scope `QuizSetup` handed off (or a full-bank no-repeat pick if reached directly); saves a real `Attempt`. |
| [Results.tsx](artifacts/quizset/src/pages/Results.tsx) | `ResultsHistory` (a student's own saved attempts) + a shared `AttemptReviewBody` used by both `ResultReview` (student, own history) and `CoachingAttemptReview` (coaching owner, reached from `CourseStudentDashboard`'s drill-down — `attemptService.get()` has no ownership check, so this reuse is safe). |
| [LiveTests.tsx](artifacts/quizset/src/pages/LiveTests.tsx) | Coaching-owner live-test scheduling (question source is a published course), publish/unpublish, per-test results modal. |
| [StudentLiveTests.tsx](artifacts/quizset/src/pages/StudentLiveTests.tsx) | Student-facing live-test list (phase-aware) + `LiveTestAttempt`, the actual timed attempt experience (the only place `TimedQuizRunner` is used). |
| [Notifications.tsx](artifacts/quizset/src/pages/Notifications.tsx) | Shared by all three roles; list + mark-one-read + mark-all-read. |
| [AI.tsx](artifacts/quizset/src/pages/AI.tsx) | `StudentAI` (chat, gated by the coaching's free-message/paywall config) + `ChatbotSettings` (coaching-owner config + live preview). |
| [Payments.tsx](artifacts/quizset/src/pages/Payments.tsx) | Transaction ledger (`scope="coaching"`/`"platform"`), filterable by product (course/live_test/chatbot) and status. |
| [Branding.tsx](artifacts/quizset/src/pages/Branding.tsx) | Coaching-owner white-label settings — name, support email, primary/secondary color — repaints the live app for that coaching's own users, not just a preview card. |
| [JoinFlow.tsx](artifacts/quizset/src/pages/JoinFlow.tsx) | The student join gate: join-code (immediate enrollment) tab and search-coaching-and-request-to-join tab. |
| [GenericPage.tsx](artifacts/quizset/src/pages/GenericPage.tsx) | Minimal placeholder, used only for `/settings` and `/profile`. |
| [not-found.tsx](artifacts/quizset/src/pages/not-found.tsx) | 404 route fallback. |

## Architecture rules

**Never let a component touch `localStorage` directly.** The required chain is:

```
component → service (services/mock.ts) → storage (services/storage.ts) → localStorage
```

so that later only the service layer swaps to HTTP. Keep new work routed the same way — no page should
import `@/data/seed` directly.

**Tenant isolation.** `tenantId` is the seam where backend isolation will eventually live (real RLS or
equivalent server-side checks once the API exists). Always filter by it; never render one tenant's data
in another's workspace. **`tenant` in `AppContext` is always derived from `user.tenantId`** — there is
no `switchTenant` and no tenant `<select>` anywhere in the app. Don't reintroduce a switchable global
tenant; a coaching owner or student's view must only ever be a function of who they are logged in as.

**Routing** is [wouter](https://github.com/molefrog/wouter), not React Router. Routes are wrapped in
`<Protected roles={[...]}>`, which redirects to the role's home on a role mismatch, and additionally
redirects a student with no `tenantId` to `/student/join` for every route except `/student/join` itself.

### White-label branding

`src/services/branding.ts` converts a tenant's `primaryColor`/`secondaryColor` hex into the
`--primary`/`--secondary`/`--primary-foreground` CSS custom properties that `index.css` reads
everywhere as `hsl(var(--primary))`. `AppContext.tsx` calls `applyBranding(tenant)` whenever the
derived tenant changes, for `coaching` and `student` sessions only — the platform owner's own console
always calls `resetBranding()` and stays on QuizSet's own palette. `relativeLuminance()` (WCAG formula)
decides whether text drawn on the brand color should be black or white. `Branding.tsx`'s save handler
calls `tenantService.update()` then `refreshTenants()`, which is what makes a coaching's saved color
show up for its logged-in students too, not just in the coaching owner's own preview.

### Student join flow

A brand-new student has `tenantId: undefined` and no `Student` row. `App.tsx`'s `Protected` component
redirects any such student to `/student/join` (`JoinFlow.tsx`), backed by `joinRequestService`:

- **Join code** (`joinByCode`) — looks the code up, sets the user's `tenantId` immediately, creates a
  `Student` row if needed. No pending state.
- **Search coaching, request to join** (`requestToJoin`) — creates a `Pending` `JoinRequest`; the
  coaching approves/rejects it from `Students.tsx`'s "Join requests" tab (`joinRequestService.decide`),
  which is what actually sets `tenantId` and creates the `Student` row on approval.

### Content-review pipeline (question banks)

`QuestionBankStatus`: `Generating → Platform Review → Coaching Review → Finalized`. Generating/Platform
Review are platform-owner-only working stages (invisible to the coaching that asked for the bank).
Coaching Review makes it visible+editable to the coaching owner, but a course using it still can't
publish. Finalized is the coaching owner's explicit "approve for students" action — only then can the
course publish. `RequestStatus` (`Pending`/`In Progress`/`Finalized`) is a deliberately coarser,
separate state on the *request*, kept in sync by `syncRequestToBankStage()` rather than duplicating the
bank's own 4-way state. A request always names an already-existing `courseId` — never a bare name; see
`docs/PROJECT_HISTORY.md`'s 2026-08-10 entry for why the wizard can't offer a bank-picker at course
creation time.

## Conventions

- **`@/` aliases `src/`.** Use it, not relative climbs.
- **TypeScript throughout.** Types belong in `types.ts`.
- **Styling is hand-written CSS in `index.css`, not Tailwind utilities** — despite Tailwind v4 being
  installed and configured. Match the surrounding code: add a semantic class and a rule in `index.css`.
- **Filter bars**: the `.filter-bar` class (a `<Card className="filter-bar">` with `<select>`/`<input
  type="text">` children + a `<span className="filter-count">`) is the established pattern for any
  filterable list — see `QuestionBanks.tsx`, `QuestionRequests.tsx`, `Students.tsx`, `Payments.tsx`,
  `CourseStudentDashboard.tsx`, `QuestionBankDetail.tsx` for examples. Use it rather than inventing a
  new filter UI shape.
- **`Button` supports `size="sm"`** (adds `.btn-sm`) alongside `variant`. `Field` supports an optional
  `htmlFor`.
- **`data-testid` on interactive elements** — keep it up where the existing code does this.
- **Write new code normally formatted** — some generated pages have very long single lines; don't
  extend that pattern in new work, and reformat regions you touch.

## Responsive / mobile — a hard requirement

This product is for Indian coaching students, who are **overwhelmingly on mobile**. Every screen must
work at every size; mobile is not an afterthought. When adding or changing any UI, verify it at
~360px, ~768px, and desktop before calling it done. See `docs/PROJECT_HISTORY.md` for the dated record
of responsiveness audits/fixes.

- Two original app breakpoints (`max-width: 960px` / `max-width: 600px`) near the bottom of
  `index.css`, with further rounds of new-component breakpoints appended after — prefer adding to the
  existing blocks over scattering new ones.
- Mobile nav is an off-canvas sidebar for platform/coaching roles. Student role gets a real
  `<nav className="bottom-nav">` (first 5 nav items), fixed, hidden above 960px, with
  `env(safe-area-inset-bottom)` padding.
- `100dvh` is used. `maximum-scale=1` was removed from `index.html`'s viewport meta — pinch-zoom is not
  blocked.
- Tables scroll horizontally inside `.table-wrap` — the page body itself should never scroll sideways.
- No `prefers-reduced-motion` support yet.

## Known gaps / intentionally cut from scope

**Cut by product decision, not left unbuilt by accident** — don't rebuild these under their old names
without a fresh product conversation: cross-course/platform-wide leaderboard, AI weak-topic-detection
from attempt history (the chatbot replies from keyword-matching the current message only, not attempt
history), personalized study-plan generation, a support-ticket system, platform-wide analytics with
charts (Recharts is installed, unused — all "charts" are hand-made CSS bars), the global Ctrl+K search.

**Genuinely open, not cut:**

- The real backend (see `docs/PROJECT_HISTORY.md` — in progress as of 2026-08-10): `lib/db`'s schema,
  `artifacts/api-server`'s routes, and wiring `artifacts/quizset`'s `services/mock.ts` to call them.
- Branded virtual certificates (coaching-owner-issued, "Powered by QuizSet") — planned, not yet built.
- Student testimonials/feedback with two-stage (coaching → platform) approval before going public —
  planned, not yet built.
- 50/50 platform/coaching revenue split on payments — a schema-level decision made, not yet reflected
  anywhere in the frontend's `paymentService` (which doesn't compute or store a split today).
- `framer-motion`, `react-hook-form`, `zod`, `date-fns`, `cmdk` — installed, unused outside the shadcn
  `components/ui/` folder (which needs them to typecheck; don't prune without removing that folder).
- Route guards (`Protected` in `App.tsx`) redirect on a role mismatch instead of showing a 403 page.

## Gotchas

- `node_modules` is not committed — run `pnpm install` first.
- Set `PORT` and `BASE_PATH` for local dev (see above).
- **Brand name is settled: QuizSet.** `Frontend_Prompt.txt` says "KOPI" — that's a stale earlier draft,
  not the current direction. Don't reopen this.
- **On Windows/Git Bash in this dev environment specifically**: invoking `node` through the Bash tool
  fails outright with `stdin is not a tty`, even for a trivial `node -e "..."` — unrelated to script
  content. PowerShell doesn't have this problem; use it for any Node script that needs to actually run.
  Bash is fine for git/pnpm/read-only inspection.
- Passing `BASE_PATH=/` on a Git-Bash command line can get silently mangled into a Windows path by
  MSYS's auto path-conversion — set `MSYS_NO_PATHCONV=1` when doing a local production build from Bash.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Platform owner | `admin@quizset.demo` | `admin123` |
| Coaching owner | `owner@sunrise.demo` | `owner123` |
| Student | `rahul@student.demo` | `student123` |

One-click demo buttons on the login page cover all three. Join code for Sunrise Academy is
`SUNRISE2026`. Clear state with `storage.clear()` (removes all `quizset:`-prefixed keys).
