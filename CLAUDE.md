# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this repo is

A Replit-generated **pnpm workspace monorepo**. The only app that matters right now is
[artifacts/quizset/](artifacts/quizset/) — a **frontend-only** prototype of **QuizSet**, a white-label,
multi-tenant, AI-flavoured examination and learning OS for Indian coaching institutes.

Tagline: _"Your Coaching. Your Brand. Your Exam Platform."_

Three roles, three workspaces: **platform owner** (SaaS command center) → **coaching owner** (tenant
business OS) → **student** (learning app).

**There is no backend.** No server, no DB, no payment gateway, no AI API, no real auth. Everything is
React state + `localStorage` behind mock services. This is intentional — the backend gets connected
later, so the UI must not need rewriting when it arrives.

## Commands

Run everything from the repo root.

```bash
pnpm install                                   # required — node_modules is not committed
pnpm --filter @workspace/quizset run dev       # dev server (see PORT gotcha below)
pnpm --filter @workspace/quizset run build     # vite build → artifacts/quizset/dist/public
pnpm --filter @workspace/quizset run typecheck # tsc --noEmit for the app only
pnpm run typecheck                             # whole workspace (libs + artifacts)
pnpm run build                                 # typecheck + build everything
```

**PORT gotcha:** [vite.config.ts](artifacts/quizset/vite.config.ts#L8-L28) **throws** if `PORT` or
`BASE_PATH` are unset, and the `dev` script does not set them. On Replit they come from
[artifact.toml](artifacts/quizset/.replit-artifact/artifact.toml). Locally you must supply them:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/quizset run dev
```

Package manager is pinned to pnpm (a `preinstall` hook rejects npm/yarn). `pnpm-workspace.yaml` sets
`minimumReleaseAge` as supply-chain defense — **do not disable it**.

## Repo map

| Path | Purpose |
|---|---|
| [artifacts/quizset/](artifacts/quizset/) | **The app.** All work happens here. |
| [artifacts/api-server/](artifacts/api-server/) | Unused Express 5 scaffold. Ignore until a real backend is wanted. |
| [artifacts/mockup-sandbox/](artifacts/mockup-sandbox/) | Unused Replit mockup tool. Ignore. |
| [lib/](lib/) (`api-spec`, `api-zod`, `api-client-react`, `db`) | Unused codegen/Drizzle scaffolds. Ignore. |
| [Frontend_Prompt.txt](Frontend_Prompt.txt) | Product spec, "KOPI" branding (untracked, newer). |
| [attached_assets/Pasted-You-are-a-senior-SaaS-product-architect-*.txt](attached_assets/) | Product spec, "QuizSet" branding — **this is what was actually built from**. |
| [replit.md](replit.md) | Replit's own doc. Still unedited boilerplate; describes the API/DB scaffold, not this app. |

### Inside `artifacts/quizset/src/`

The old single 38 KB `pages/Workspace.tsx` (15 exports crammed into one file) is gone. There are now
~20 page files, each small and single-purpose — see the second table below.

| File | What it holds |
|---|---|
| [App.tsx](artifacts/quizset/src/App.tsx) | Every route + the `Protected` role guard, which also redirects a tenant-less student to `/student/join`. |
| [types.ts](artifacts/quizset/src/types.ts) | All domain types — grew well past the original 7: `Tenant`, `Exam`, `Question`, `QuestionBank`, `QuestionBankRequest`, `JoinRequest`, `LiveTest`/`LiveTestPhase`, `Attempt`, `ChatbotConfig`, `Transaction`, `Notification`, `Toast`, etc. |
| [data/seed.ts](artifacts/quizset/src/data/seed.ts) | Seed data: 3 users, 3 tenants, 4 exams, 4 students, 5 question banks, 32 real (non-lorem-ipsum) questions, 3 live tests, 3 question-bank requests, 1 join request, 3 chatbot configs. |
| [services/storage.ts](artifacts/quizset/src/services/storage.ts) | `localStorage` wrapper, `quizset:` key prefix. Unchanged. |
| [services/mock.ts](artifacts/quizset/src/services/mock.ts) | `authService`, `tenantService`, `joinRequestService`, `examService`, `questionBankService`, `questionBankRequestService`, `questionService`, `studentService`, `liveTestService`, `attemptService`, `paymentService`, `chatbotConfigService`, `aiService`, `notificationService`. All still go through `readList`/`writeList` over `storage`, seeded from `data/seed.ts`. |
| [services/branding.ts](artifacts/quizset/src/services/branding.ts) | Converts a tenant's `primaryColor`/`secondaryColor` hex into the `--primary`/`--secondary` CSS custom properties `index.css` already reads everywhere via `hsl(var(--primary))`. See "White-label branding" below. |
| [contexts/AppContext.tsx](artifacts/quizset/src/contexts/AppContext.tsx) | `user`, `tenant` (derived, never separately switchable), `tenantId`, `hasTenant`, toasts, `login`/`logout`/`refreshTenants`. No `switchTenant`. |
| [layouts/AppShell.tsx](artifacts/quizset/src/layouts/AppShell.tsx) | Sidebar + topbar + mobile bottom tab bar (student role only). Per-role nav arrays live at the top; no global search, no tenant switcher. |
| [components/ui.tsx](artifacts/quizset/src/components/ui.tsx) | **The kit the app actually uses** — hand-rolled `Button`, `Badge`, `Card`, `Modal`, `PageHeader`, `Stat`, `EmptyState`, `Field`, `Alert`, `Skeleton`/`SkeletonList`, `Tabs`. |
| [components/QuizRunner.tsx](artifacts/quizset/src/components/QuizRunner.tsx) | `PracticeQuizRunner` (untimed, instant per-question feedback) and `TimedQuizRunner` (palette, mark-for-review, submit confirmation, auto-submit at zero). Shared by exam attempts and live tests. |
| [components/ui/](artifacts/quizset/src/components/ui/) | Full shadcn/Radix kit, **~60 files, essentially unused** (only `toaster`, `tooltip`, `card` are imported by app code). |
| [index.css](artifacts/quizset/src/index.css) | ~52 KB. Design tokens + **all component styling as hand-written CSS classes**. |

### Inside `artifacts/quizset/src/pages/`

| File | What it holds |
|---|---|
| [Public.tsx](artifacts/quizset/src/pages/Public.tsx) | Landing page, login (with the one-click demo buttons), signup. |
| [Dashboards.tsx](artifacts/quizset/src/pages/Dashboards.tsx) | The three role dashboards (`PlatformDashboard`, `CoachingDashboard`, `StudentDashboard`). |
| [Coachings.tsx](artifacts/quizset/src/pages/Coachings.tsx) | Platform-owner tenant list + create-coaching modal. Loads through `tenantService`, so new coachings survive reload. |
| [QuestionRequests.tsx](artifacts/quizset/src/pages/QuestionRequests.tsx) | Platform-owner side of the syllabus → question-bank pipeline: review requests, advance them through stages, reject with a note. |
| [QuestionBanks.tsx](artifacts/quizset/src/pages/QuestionBanks.tsx) | `scope="platform"` (read-only, every coaching's banks) or `scope="coaching"` (own banks + "request a bank" form). |
| [QuestionBankDetail.tsx](artifacts/quizset/src/pages/QuestionBankDetail.tsx) | Question CRUD for exactly one bank — add/edit/delete MCQs, mark the bank Ready. |
| [Exams.tsx](artifacts/quizset/src/pages/Exams.tsx) | Exam catalog list (`scope="coaching"`/`"platform"`), tabbed by status, each card showing the exam's real question count. |
| [ExamEdit.tsx](artifacts/quizset/src/pages/ExamEdit.tsx) | Coaching-owner exam settings — editing an exam *after* it's created (pricing, duration, status, preview count). |
| [ExamCreate.tsx](artifacts/quizset/src/pages/ExamCreate.tsx) | The 5-step exam creation wizard (details → question bank → configuration → pricing → publish). |
| [Students.tsx](artifacts/quizset/src/pages/Students.tsx) | Coaching's student directory + join-request approval queue, tabbed. |
| [StudentExamLibrary.tsx](artifacts/quizset/src/pages/StudentExamLibrary.tsx) | Student-facing `StudentExams` (library), `ExamDetail` (buy/unlock), `Preview` (free-preview runner). |
| [Attempt.tsx](artifacts/quizset/src/pages/Attempt.tsx) | Renders `PracticeQuizRunner` or `TimedQuizRunner` depending on `exam.type`, using the exam's real linked questions; saves a real `Attempt`. |
| [Results.tsx](artifacts/quizset/src/pages/Results.tsx) | `ResultsHistory` (list of a student's saved attempts) + `ResultReview` (question-by-question review of one). |
| [LiveTests.tsx](artifacts/quizset/src/pages/LiveTests.tsx) | Coaching-owner live-test scheduling, publish/unpublish, and a per-test results/leaderboard-of-one-test modal. |
| [StudentLiveTests.tsx](artifacts/quizset/src/pages/StudentLiveTests.tsx) | Student-facing live-test list (phase-aware) + `LiveTestAttempt`, the actual timed attempt experience. |
| [Notifications.tsx](artifacts/quizset/src/pages/Notifications.tsx) | Shared by all three roles; list + mark-one-read + mark-all-read, now genuinely persisted. |
| [AI.tsx](artifacts/quizset/src/pages/AI.tsx) | `StudentAI` (chat, gated by the coaching's free-message/paywall config) + `ChatbotSettings` (coaching-owner config + live preview). |
| [Payments.tsx](artifacts/quizset/src/pages/Payments.tsx) | Transaction ledger (`scope="coaching"`/`"platform"`), reading from the real `Transaction` list instead of hardcoded revenue strings. |
| [Branding.tsx](artifacts/quizset/src/pages/Branding.tsx) | Coaching-owner white-label settings — name, support email, primary/secondary color — that now actually repaints the live app, not just its own preview card. |
| [JoinFlow.tsx](artifacts/quizset/src/pages/JoinFlow.tsx) | The student join gate: join-code (immediate enrollment) tab and search-coaching-and-request-to-join tab. |
| [GenericPage.tsx](artifacts/quizset/src/pages/GenericPage.tsx) | Deliberately minimal placeholder, used only for the two routes genuinely still out of scope (`/settings`, `/profile`) — not a stand-in for unfinished core features. |
| [not-found.tsx](artifacts/quizset/src/pages/not-found.tsx) | 404 route fallback. |

## Architecture rules

**Never let a component touch `localStorage` directly.** The required chain is:

```
component → service (services/mock.ts) → storage (services/storage.ts) → localStorage
```

so that later only the service layer swaps to HTTP. Every service method is `async` and fakes latency
via `wait()` — keep that, since real calls will be async too.

No page imports `@/data/seed` directly any more (this used to be a violation in `StudentExams`,
`Preview`, `Attempt`, `ExamDetail`, `Coachings` and others) — everything now goes through a service,
which itself falls back to the seed array only inside `readList()`. Keep new work routed the same way.

**Tenant isolation.** `tenantId` is the seam where backend isolation will eventually live. Always
filter by it; never render one tenant's data in another's workspace. **`tenant` in `AppContext` is
always derived from `user.tenantId`** — there is no `switchTenant` and no tenant `<select>` anywhere
in the app (verified against `AppContext.tsx` and `AppShell.tsx`). The old build let a platform owner
switch a global "current tenant" that every role's view then read from, which was the wrong source of
truth — a demo bug, not a real permission gap, but real enough that it's worth remembering not to
reintroduce it.

**Routing** is [wouter](https://github.com/molefrog/wouter), not React Router (the spec asked for
React Router — wouter is what's installed and working; don't swap it casually). Routes are wrapped in
`<Protected roles={[...]}>` which redirects to the role's home on a role mismatch, and additionally
redirects a student with no `tenantId` to `/student/join` (see "Student join flow" below) for every
route except `/student/join` itself.

### White-label branding

Branding is no longer a settings page that only repaints its own preview card. `src/services/branding.ts`
converts a tenant's `primaryColor`/`secondaryColor` hex into the `--primary`/`--secondary`/
`--primary-foreground` CSS custom properties that `index.css` already reads everywhere as
`hsl(var(--primary))` (buttons, badges, accents, charts). `AppContext.tsx` calls `applyBranding(tenant)`
in a `useEffect` keyed on `tenant.id`/`tenant.primaryColor`/`tenant.secondaryColor`/`user?.role`,
whenever the derived tenant changes — not just when `Branding.tsx` is open. Only `coaching` and
`student` sessions are branded; the platform owner's own console always calls `resetBranding()` and
stays on QuizSet's own palette. `relativeLuminance()` (WCAG formula) decides whether text drawn on the
brand color should be black or white, so an institute can't accidentally pick a color that makes its
own buttons unreadable. `Branding.tsx`'s save handler calls `tenantService.update()` then
`refreshTenants()` (an `AppContext` method), which reloads the tenant list and re-triggers the branding
effect — that's what makes a coaching's saved color show up for its logged-in students too, not just
in the coaching owner's own preview.

### Student join flow

A brand-new student (via `Signup` or a fresh `registerStudent()`) has `tenantId: undefined` and no
`Student` row. `App.tsx`'s `Protected` component redirects any such student to `/student/join`
(`JoinFlow.tsx`), which offers two flows, both backed by `joinRequestService` in `services/mock.ts`:

- **Join code** (`joinByCode`) — looks the code up via `tenantService.findByJoinCode`, sets the user's
  `tenantId` immediately, creates a `Student` row if one doesn't exist, and logs the refreshed user back
  in. No pending state.
- **Search coaching, request to join** (`requestToJoin`) — creates a `Pending` `JoinRequest` row against
  the searched tenant; the coaching approves or rejects it from the "Join requests" tab of
  `Students.tsx` (`joinRequestService.decide`), which is what actually sets `tenantId` and creates the
  `Student` row on approval.

## Conventions

- **`@/` aliases `src/`.** Use it, not relative climbs.
- **TypeScript throughout.** Types belong in `types.ts`.
- **Styling is hand-written CSS in `index.css`, not Tailwind utilities** — despite Tailwind v4 being
  installed and configured. Match the surrounding code: add a semantic class and a rule in
  `index.css`. Don't start sprinkling utility classes into files styled the other way.
- **Two overlapping systems exist** (custom kit vs shadcn; custom CSS vs Tailwind; custom toasts vs
  shadcn `Toaster` vs `sonner`). Prefer the custom kit + `useApp().toast()`, which is what the app uses.
- **`data-testid` on interactive elements** — the existing code does this; keep it up.
- **Code density:** the generated pages cram entire components onto single lines up to 6,239 characters
  long. This is a genuine maintainability problem. **Write new code normally formatted**, and reformat
  regions you edit rather than extending one-liners.

## Responsive / mobile — a hard requirement

This product is for Indian coaching students, who are **overwhelmingly on mobile**. Every screen must
work beautifully at every size; mobile is not an afterthought. When adding or changing any UI, verify
it at ~360 px, ~768 px, and desktop before calling it done.

Current state:

- Two original app breakpoints (`max-width: 960px` / `max-width: 600px`,
  [index.css:351-352](artifacts/quizset/src/index.css#L351-L352), plus landing-page ones at line 358)
  plus a further round of new-component breakpoints appended later at
  [index.css:1602 and 1633](artifacts/quizset/src/index.css#L1602).
- Mobile nav is an off-canvas sidebar for platform/coaching roles. For the student role,
  `AppShell.tsx` renders a real `<nav className="bottom-nav">` (first 5 nav items) and
  [index.css:1574-1610](artifacts/quizset/src/index.css#L1574) now styles it as a fixed bottom tab
  bar — hidden by default, shown only below 960px inside `.student-shell`, with
  `env(safe-area-inset-bottom)` padding so it clears the iPhone home indicator, and the active tab
  colored via `hsl(var(--primary))`. `.student-shell .content` gets matching bottom padding so page
  content doesn't sit underneath it.
- `100dvh` is used, and the `safe-area-inset` gap above is now closed for the bottom nav specifically
  (other fixed-position elements haven't been audited for it).
- `maximum-scale=1` has been **removed** from `index.html`'s viewport meta — pinch-zoom is no longer
  blocked.
- Tables just scroll horizontally (`.data-table { min-width: 690px }`). No card-style responsive
  fallback.
- The exam interface collapses `question-layout` to one column, pushing the question palette far below
  the question — the palette needs a genuine mobile pattern (sheet/drawer), not stacking.
- No `prefers-reduced-motion` support.

## Known gaps vs the spec

A large refactor (this pass) built out most of what used to be `GenericPage` placeholders or entirely
missing routes. Verified fixed/built, against the actual files:

- **Question-request pipeline** — real, in `QuestionRequests.tsx` (platform side) and
  `QuestionBanks.tsx` (coaching side, request form), backed by `questionBankRequestService` in `mock.ts`.
- **Live tests** — real, in `LiveTests.tsx` (coaching: schedule/publish/results) and
  `StudentLiveTests.tsx` (student: list + `LiveTestAttempt`), backed by `liveTestService`. Phase
  (`Upcoming`/`Live`/`Ended`) is always derived from the clock via `liveTestService.phase()`, never
  stored, so it can't go stale.
- **Payments page** — real, in `Payments.tsx`, reading the actual `Transaction` list via
  `paymentService.list()` for both `scope="coaching"` and `scope="platform"`.
- **AI / chatbot** — real, in `AI.tsx`: `StudentAI` (gated by the coaching's free-message limit and
  paywall) and `ChatbotSettings` (coaching-owner config + live chat preview), backed by
  `chatbotConfigService`.
- **Student results / result review / result history** — real, in `Results.tsx`
  (`ResultsHistory` + `ResultReview`), made possible by attempts now being saved at all (see Known bugs).
- **Student join flow** — real, in `JoinFlow.tsx` + `joinRequestService`. See "Student join flow" above.
- **Practice-quiz mode with immediate per-question feedback** — real, `PracticeQuizRunner` in
  `components/QuizRunner.tsx`, used by `Attempt.tsx` whenever `exam.type === 'Practice Quiz'`.
- **`questionBankService` and `liveTestService`** (named exactly as the old gaps list wanted) both
  exist in `mock.ts`. There is no `analyticsService` or `supportService` — see the scope-cut list below;
  those two were never built because the features that would have used them were cut, not because the
  service layer is incomplete.

**A specific set of spec features were intentionally cut from scope by product decision — not left
unbuilt by accident, and not planned for a future pass under their current names:**

- Leaderboard (a live test's results modal in `LiveTests.tsx` shows per-test rankings, but there is no
  cross-exam or platform-wide leaderboard page/route)
- AI performance insights / weak-topic detection (`AI.tsx`'s `aiService.reply()` matches keywords in
  the student's own message and returns a canned tip — it does not read the student's attempt history)
- Personalized study plan generation
- Support ticket system
- Platform-wide business analytics with charts (the two dashboards show `Stat` tiles only — no chart
  component is rendered anywhere in app code; see the Recharts note below)
- The global Ctrl+K command search

Verified there is no vestige of any of these in navigation or routing: `AppShell.tsx`'s `platformNav`/
`coachingNav`/`studentNav` arrays have no entries for them (the comment above `platformNav` documents
the cut explicitly), and `App.tsx`'s `<Switch>` has no matching routes. `GenericPage.tsx` is reserved
for `/settings` and `/profile` only — it is not standing in for any of the six items above.

Still genuinely open (not cut, just not done):

- **Recharts is installed but never used** by app code. All "charts" are hand-made CSS bars/lines
  (`.chart-line`, `.mini-chart` in `index.css`), or — since the analytics-with-charts feature above was
  cut — simply absent. Same for `framer-motion`, `react-hook-form`, `zod`, `date-fns`, `cmdk` —
  installed, unused outside the shadcn `components/ui/` folder (which needs them to typecheck; don't
  prune without removing that folder).
- Seed data is still modest — 3 tenants, 4 exams, 4 students, 5 question banks, 32 questions — well
  below the spec's "50+ students, 10+ exams, 100+ questions", though no longer the single 5-question
  array the whole app used to share.
- Route guards (`Protected` in `App.tsx`) still redirect on a role mismatch instead of showing a 403
  page.

## Known bugs

Every bug tracked in the previous pass is fixed. Verified against the current code:

- **Exam attempt hardcoded to 5 questions — fixed.** `Question.questionBankId` links each question to
  a bank, and `Exam.questionBankId` links each exam to exactly one bank
  (`examService.realQuestionCount()` in `mock.ts` filters `questions` by that link). `Attempt.tsx` loads
  via `questionService.listByExam(exam.id)` — the exam's real, distinct question set — and hands it to
  `PracticeQuizRunner` or `TimedQuizRunner` (`components/QuizRunner.tsx`) depending on `exam.type`. No
  more `% 5` cycling through one shared global array; every exam/bank pair now has its own genuine
  question count, visible via `ExamWithCount`/`examService.listWithCounts()`.
- **Created coachings vanish on reload — fixed.** `Coachings.tsx`'s `load()` calls
  `tenantService.list()` (which reads through `storage` with the seed array only as fallback) instead
  of rendering the seed array directly, so a newly created tenant survives a refresh.
- **"Mark all read" doesn't persist — fixed.** `notificationService.list()` in `mock.ts` now checks
  `storage.get(key, null)` first; on a genuine first read it seeds `defaultNotifications[role]` **and
  writes it to storage** before returning, so `markRead`/`markAllRead` afterward are mutating a real
  persisted array instead of nothing.
- **Publish wizard lies about status — fixed.** `ExamCreate.tsx`'s `finish(status)` is called with an
  explicit `'Draft'` or `'Published'` depending on which button was pressed (`Save as draft` vs.
  `Publish exam`), that status is passed straight into `examService.create({..., status})`, and the
  call is `await`ed before navigating. The toast text now matches what was actually saved.
- **Tenant came from a switchable global, not the logged-in user — fixed.** `AppContext.tsx`'s `tenant`
  is a `useMemo` derived solely from `user?.tenantId`, looked up in the tenant list; there is no
  `switchTenant` function and no tenant `<select>` in `AppShell.tsx`. A platform owner's console is
  never branded (`applyBranding` is only called when `user?.role` is `coaching` or `student`).
- **Attempt results never saved — fixed.** `attemptService.save()` in `mock.ts` persists a full
  `Attempt` (answers, `questionIds` snapshot, score, `totalAttempted`, `timeTakenSeconds`) to storage;
  `Attempt.tsx` and `LiveTestAttempt` (in `StudentLiveTests.tsx`) both call it and then navigate to
  `/student/results/:id`, which `ResultReview` (`Results.tsx`) reads back — a real history now backs
  `ResultsHistory` and each live test's own results list.

The previous pass's two remaining generic bullets are resolved too:

- **"Hardcoded values sprinkled through the UI" — fixed.** Coaching/platform revenue
  (`paymentService.list()` summed), exam/question-bank/student counts per tenant, and per-exam
  MRP/sale-price discount percentages are all computed from real data (`exam.mrp`/`exam.sale`, not a
  fixed "50% off"). The tenant `<select>` this bullet referenced no longer exists at all (see the
  wrong-tenant-source fix above).
- **"Fonts loaded twice" — fixed.** `index.html` no longer fetches Inter; it carries a comment noting
  DM Sans + Plus Jakarta Sans are `@import`'d from `index.css` (line 1) and are the only fonts
  `--app-font-*` actually reference.

New behavior worth knowing about, not a bug fix but touched by this pass: `attemptService.findForLiveTest()`
enforces one attempt per student per live test — revisiting the attempt URL redirects straight to the
existing result instead of allowing a retake.

## Gotchas

- `node_modules` is not committed — run `pnpm install` first.
- Set `PORT` and `BASE_PATH` for local dev (see above).
- The whole tracked tree was missing from the working copy at one point; it was restored from HEAD with
  `git restore .`. If files look absent, check `git status` before assuming they were never generated.
- **Brand name is settled: QuizSet.** `Frontend_Prompt.txt` still says **KOPI** with the tagline "Your
  Learning OS," but that is a leftover from an earlier draft spec, not the current direction — the
  actually-built spec (`attached_assets/Pasted-You-are-a-senior-SaaS-product-architect-*.txt`) and every
  line of code (including the demo email `admin@quizset.demo`) say **QuizSet**. Don't reopen this
  question or attempt a KOPI rename based on `Frontend_Prompt.txt`.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Platform owner | `admin@quizset.demo` | `admin123` |
| Coaching owner | `owner@sunrise.demo` | `owner123` |
| Student | `rahul@student.demo` | `student123` |

One-click demo buttons on the login page cover all three. Join code for Sunrise Academy is
`SUNRISE2026`. Clear state with `storage.clear()` (removes all `quizset:`-prefixed keys).
