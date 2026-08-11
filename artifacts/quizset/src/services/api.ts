/**
 * Real API client — the eventual drop-in replacement for `services/mock.ts`.
 *
 * NOT wired in yet. Nothing here is imported by any page; `mock.ts` remains
 * the live implementation until a later, deliberate step swaps it in once
 * the real routes in `artifacts/api-server` are confirmed to match. This
 * file (and its `services/api/` folder) is purely additive.
 *
 * ---------------------------------------------------------------------------
 * Auth seam (read this before wiring real auth in)
 * ---------------------------------------------------------------------------
 * Real session-based login (a real Supabase JWT) is explicitly OUT OF SCOPE
 * here — `authService` from mock.ts has NO counterpart in this file on
 * purpose; inventing a fake login flow or a fake JWT would be worse than
 * leaving the seam empty. Two module-level setters are exported from
 * `services/api/http.ts` for whoever wires real auth later:
 *
 *   setApiBaseUrl(url)              // point requests at the real API server
 *   setApiAuthTokenGetter(getter)   // `() => string | null`, called per-request;
 *                                   // attaches `Authorization: Bearer <token>`
 *
 * Both are called zero times by default. Every function below builds an
 * absolute `/api/...` path and lets `customFetch` (from
 * `@workspace/api-client-react`) apply the base URL and token — see
 * `services/api/http.ts`'s top comment for why that package's fetch
 * function had to be additionally re-exported to make this possible.
 *
 * ---------------------------------------------------------------------------
 * What's implemented, matching services/mock.ts's exported shapes exactly
 * ---------------------------------------------------------------------------
 *   tenantService, courseService (+ CourseWithCount), questionBankService,
 *   questionBankRequestService, questionService, studentService,
 *   liveTestService, attemptService (+ computeTopicBreakdown/TopicBreakdown),
 *   paymentService, chatbotConfigService, chatbotUsageService,
 *   joinRequestService, certificateService, testimonialService, studyPlanService.
 *
 * Intentionally NOT implemented here, each for a specific reason:
 *   - authService        — out of scope, see the auth seam note above.
 *
 * ---------------------------------------------------------------------------
 * Field mismatches between the Drizzle schema and frontend types.ts
 * ---------------------------------------------------------------------------
 * Every mismatch below is resolved at the API-client boundary (in the
 * relevant services/api/*.ts file) with an explicit comment at the point of
 * conversion — this is just the index:
 *
 *   - PAISE vs RUPEES (see services/api/money.ts): backend stores
 *     `mrpPaise`/`salePaise` (courses), `pricePaise` (live tests),
 *     `totalPaise` (payments) as integer paise; frontend `types.ts` (`mrp`,
 *     `sale`, `price`, `amount`) treats the same values as rupees, matching
 *     mock.ts's own behavior. Converted at the boundary both ways.
 *     EXCEPTION: `chatbot_configs.priceRupeesPerMonth` is rupees on both
 *     sides already — no conversion for that one field (services/api/chatbot.ts).
 *   - `studentProfileId` (backend, every table's student FK) vs `studentId`
 *     (frontend `Attempt`/`Transaction`) — renamed at the boundary in
 *     services/api/attempts.ts and services/api/payments.ts.
 *   - `Tenant.students` / `Course.students` — no backing column on either
 *     table. `Course.students` defaults to 0 (matches mock.ts's own static
 *     0, never recomputed there either). `Tenant.students` is derived live
 *     from a `/api/profiles` count instead (documented N+1 + 403-fallback
 *     caveat in services/api/tenants.ts).
 *   - `Student.phone` / `.courses` / `.score` — `profiles` has no matching
 *     columns at all; placeholders, see services/api/students.ts.
 *   - `Course.assignedStudentIds` / `LiveTest.participantIds` — not columns
 *     on their own rows; each requires a second call to the dedicated
 *     `course-assignments` / `live-tests/:id/participants` endpoint. Handled
 *     transparently inside courseService/liveTestService (documented N+1
 *     cost in services/api/courses.ts and services/api/liveTests.ts).
 *   - `paymentService.hasPurchased()` — mock.ts's version is SYNCHRONOUS
 *     (reads localStorage); a real lookup is inherently async. This is a
 *     genuine, unresolvable signature mismatch (not units/naming) — kept as
 *     a same-signature stub returning `false`, with a real
 *     `hasPurchasedAsync()` alongside it. See services/api/payments.ts.
 *   - ACCESS-CONTROL mismatches (behavioral, not shape): `tenantService.list()`
 *     and the tenant-lookup used by `findByJoinCode()`/`search()` now hit a
 *     platform-owner-only endpoint, where mock.ts had no such restriction —
 *     see services/api/tenants.ts.
 *
 * See each services/api/*.ts file for the full reasoning behind its own
 * mismatches — this header just indexes them.
 */

export { setApiAuthTokenGetter, setApiBaseUrl, ApiError } from './api/http';

export { tenantService } from './api/tenants';
export { courseService, type CourseWithCount } from './api/courses';
export { questionBankService } from './api/questionBanks';
export { questionBankRequestService } from './api/questionBankRequests';
export { questionService } from './api/questions';
export { studentService } from './api/students';
export { liveTestService } from './api/liveTests';
export { attemptService, computeTopicBreakdown, type TopicBreakdown } from './api/attempts';
export { paymentService } from './api/payments';
export { chatbotConfigService, chatbotUsageService } from './api/chatbot';
export { joinRequestService } from './api/joinRequests';
export { certificateService } from './api/certificates';
export { testimonialService } from './api/testimonials';
export { studyPlanService } from './api/studyPlans';
export { notificationService } from './api/notifications';
export { profileService, type ProfileApiRow } from './api/profiles';
