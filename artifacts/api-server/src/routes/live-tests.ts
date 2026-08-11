import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  attempts,
  courses,
  liveTestParticipants,
  liveTests,
  liveTestStatusEnum,
  notifications,
  questions,
  type LiveTestScope,
} from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden, notFound } from "../lib/http-error";
import { optionalInt, optionalOneOf, requireInt, requireString, requireStringArray, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

type LiveTestRow = typeof liveTests.$inferSelect;
export type LiveTestPhase = "Draft" | "Upcoming" | "Live" | "Ended" | "Cancelled";

/** Pure function: the user-facing phase, always derived from the clock —
 * never stored, so it can't go stale relative to `scheduledStart`/`scheduledEnd`.
 * Mirrors services/mock.ts's liveTestService.phase(). */
function phaseOf(test: LiveTestRow): LiveTestPhase {
  if (test.status !== "Published") return test.status; // "Draft" | "Cancelled"
  const now = Date.now();
  const start = new Date(test.scheduledStart).getTime();
  const end = new Date(test.scheduledEnd).getTime();
  if (now < start) return "Upcoming";
  if (now > end) return "Ended";
  return "Live";
}

function withPhase(test: LiveTestRow) {
  return { ...test, phase: phaseOf(test) };
}

function isLiveTestScope(value: unknown): value is LiveTestScope {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.mode === "full") return true;
  if (v.mode !== "scoped") return false;
  if (!Array.isArray(v.subjects) || !v.subjects.every((x) => typeof x === "string")) return false;
  if (!Array.isArray(v.units) || !v.units.every((x) => typeof x === "string")) return false;
  if (!Array.isArray(v.topics) || !v.topics.every((x) => typeof x === "string")) return false;
  if (v.weights !== undefined) {
    if (typeof v.weights !== "object" || v.weights === null) return false;
    if (!Object.values(v.weights).every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0)) return false;
  }
  return true;
}

type QuestionRow = typeof questions.$inferSelect;

/** Fisher-Yates — used for both per-group picks and the final combine, so a
 * live test's question order is never grouped by unit/topic. */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Split `total` into `groups.length` integer buckets as evenly as possible.
 * Remainder goes to the FIRST few groups (e.g. total=50, 3 groups -> 17,17,16
 * — not 16,16,18), matching the "distribute leftover onto the first few
 * groups" convention asked for. */
function splitEqually(total: number, groupCount: number): number[] {
  if (groupCount <= 0) return [];
  const base = Math.floor(total / groupCount);
  const remainder = total - base * groupCount;
  return Array.from({ length: groupCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Given a course's full question bank, a LiveTestScope, and a target
 * questionCount, returns the final, shuffled question id list for a
 * newly-created live test.
 *
 * - `mode: "full"`: candidate pool is the entire bank, no no-repeat
 *   filtering at all (a full-syllabus test may legitimately reuse anything
 *   — this is explicit product spec, not an oversight).
 * - `mode: "scoped"`: candidate pool is every question whose subject/unit/
 *   topic matches scope.subjects/units/topics (OR across all three, mirrors
 *   PracticeScope 'custom' / poolForScope in QuizSetup.tsx and the
 *   scopedPool filter in attempts.ts's practice-questions route). No-repeat
 *   is applied PER BUCKET (see below) against every question id seen in any
 *   PAST live-test attempt on a past SCOPED (never full) live test for this
 *   course.
 *
 * Distribution: the distinct unit-or-topic "buckets" in scope each get a
 * question count — either `scope.weights[bucket]` verbatim if present, or an
 * equal share of whatever's left of `questionCount` after honoring the
 * explicit weights. Each bucket's pick is drawn from (candidates in that
 * bucket) MINUS (seen ids) — unless that leaves fewer than the bucket needs,
 * in which case the cycle "restarts": the seen-set exclusion is dropped for
 * THAT bucket only and it draws from the full bucket pool instead, so a
 * fully-cycled unit doesn't block test creation.
 */
async function pickLiveTestQuestions(
  courseId: string,
  scope: LiveTestScope,
  questionCount: number,
): Promise<string[]> {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course?.questionBankId) return [];
  const bank = await db.select().from(questions).where(eq(questions.questionBankId, course.questionBankId));

  if (scope.mode === "full") {
    return shuffle(bank)
      .slice(0, Math.min(questionCount, bank.length))
      .map((q) => q.id);
  }

  const scopedPool = bank.filter(
    (q) => scope.subjects.includes(q.subject) || scope.units.includes(q.unit) || scope.topics.includes(q.topic),
  );

  // Distinct buckets: every unit AND topic name actually present in the
  // scoped pool (a question can belong to both its unit-bucket and its
  // topic-bucket's candidate list simultaneously via the filter below —
  // that's intentional, matching "split across units/topics in scope"
  // rather than picking one hierarchy level exclusively).
  const bucketNames = Array.from(new Set([...scopedPool.map((q) => q.unit), ...scopedPool.map((q) => q.topic)])).filter(
    (name) => scope.units.includes(name) || scope.topics.includes(name),
  );

  // No-repeat history: every question id that appeared in an attempt against
  // a PAST SCOPED (not full) live test on this same course.
  const seenIds = new Set<string>();
  {
    const pastTestRows = await db
      .select({ id: liveTests.id, scope: liveTests.scope })
      .from(liveTests)
      .where(eq(liveTests.courseId, courseId));
    const scopedTestIds = pastTestRows.filter((t) => t.scope?.mode === "scoped").map((t) => t.id);
    if (scopedTestIds.length > 0) {
      const pastAttempts = await db
        .select({ questionIds: attempts.questionIds })
        .from(attempts)
        .where(inArray(attempts.liveTestId, scopedTestIds));
      for (const a of pastAttempts) for (const qid of a.questionIds) seenIds.add(qid);
    }
  }

  if (bucketNames.length === 0) {
    // Scope matched nothing recognizable as a bucket (e.g. only `subjects`
    // was set, no units/topics) — fall back to treating the whole scoped
    // pool as one bucket rather than returning nothing.
    const unseen = scopedPool.filter((q) => !seenIds.has(q.id));
    const source = unseen.length >= questionCount ? unseen : scopedPool; // cycle restart
    return shuffle(source)
      .slice(0, Math.min(questionCount, source.length))
      .map((q) => q.id);
  }

  const explicitWeights = scope.weights ?? {};
  const weighted = bucketNames.filter((n) => explicitWeights[n] !== undefined);
  const unweighted = bucketNames.filter((n) => explicitWeights[n] === undefined);
  const explicitTotal = weighted.reduce((sum, n) => sum + (explicitWeights[n] ?? 0), 0);
  const remainder = Math.max(0, questionCount - explicitTotal);
  const equalShares = splitEqually(remainder, unweighted.length);

  const countFor = new Map<string, number>();
  weighted.forEach((n) => countFor.set(n, explicitWeights[n] ?? 0));
  unweighted.forEach((n, i) => countFor.set(n, equalShares[i] ?? 0));

  const picked: QuestionRow[] = [];
  for (const bucket of bucketNames) {
    const need = countFor.get(bucket) ?? 0;
    if (need <= 0) continue;
    const bucketPool = scopedPool.filter((q) => q.unit === bucket || q.topic === bucket);
    const unseen = bucketPool.filter((q) => !seenIds.has(q.id));
    // Cycle restart: if what's left after excluding seen questions can't
    // cover this bucket's need, ignore the seen-set for this bucket only and
    // draw from its full pool instead of failing to generate the test.
    const source = unseen.length >= need ? unseen : bucketPool;
    picked.push(...shuffle(source).slice(0, Math.min(need, source.length)));
  }

  // De-dupe (a question can satisfy two buckets, e.g. its own unit AND its
  // own topic both being in scope) while preserving nothing in particular —
  // final order is reshuffled below regardless.
  const deduped = Array.from(new Map(picked.map((q) => [q.id, q])).values());
  return shuffle(deduped)
    .slice(0, Math.min(questionCount, deduped.length))
    .map((q) => q.id);
}

// Fires a `live_test_ended` notification the first time anyone reads this
// tenant's live tests AFTER a test's scheduledEnd has passed — there is no
// scheduler/cron in this pass, so "ended" is only ever noticed lazily, on
// read. De-duplication heuristic (deliberately simple, not airtight):
// for each test that has just entered the "Ended" phase, check whether a
// `live_test_ended` notification already exists for this tenant whose body
// contains that test's id. Embedding the id in the body (rather than adding
// a schema column) is what makes that lookup possible without a new table;
// it also means the check is scoped to (tenantId, testId) so unrelated tests
// ending around the same time don't stop each other's notification from
// firing. Worst case if two requests race concurrently before either insert
// lands, this could double-fire for the same test — acceptable per the task's
// own guidance ("better to occasionally miss/duplicate once than spam on
// every page load"); this only runs once per read of an already-ended test's
// list, not on every subsequent read, because after the first insert the
// "does a notification already exist" check finds it and skips.
async function notifyEndedLiveTests(tenantId: string, tests: LiveTestRow[]) {
  const ended = tests.filter((t) => phaseOf(t) === "Ended");
  if (ended.length === 0) return;

  const existing = await db
    .select({ body: notifications.body })
    .from(notifications)
    .where(and(eq(notifications.tenantId, tenantId), eq(notifications.kind, "live_test_ended")));
  const alreadyNotified = new Set(
    existing.flatMap((n) => ended.filter((t) => n.body.includes(t.id)).map((t) => t.id)),
  );

  const toNotify = ended.filter((t) => !alreadyNotified.has(t.id));
  if (toNotify.length === 0) return;

  await db.insert(notifications).values(
    toNotify.map((t) => ({
      role: "coaching" as const,
      tenantId,
      subjectProfileId: null,
      kind: "live_test_ended" as const,
      title: "Live test ended",
      body: `"${t.name}" (id: ${t.id}) has ended — results are ready to review.`,
    })),
  );
}

// GET /api/live-tests?tenantId=
router.get("/live-tests", authenticate, async (req, res) => {
  const tenantId = req.query.tenantId;
  if (typeof tenantId !== "string") throw badRequest("tenantId query parameter is required.");
  requireUuid(tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant's live tests.");
  const rows = await db.select().from(liveTests).where(eq(liveTests.tenantId, tenantId));
  await notifyEndedLiveTests(tenantId, rows);
  res.json(rows.map(withPhase));
});

// GET /api/live-tests/:id
router.get("/live-tests/:id", authenticate, async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [row] = await db.select().from(liveTests).where(eq(liveTests.id, id)).limit(1);
  if (!row) throw notFound("Live test not found.");
  if (!canAccessTenant(req.auth!, row.tenantId)) throw forbidden("You do not have access to this live test.");
  res.json(withPhase(row));
});

// POST /api/live-tests — coaching owner (own tenant) or platform.
router.post("/live-tests", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant.");
  const courseId = requireUuid(body.courseId, "courseId");
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course || course.tenantId !== tenantId) throw badRequest("courseId must reference a real course in this tenant.");

  // scope/questionCount are optional — omitting both keeps today's implicit
  // "whole course bank" behavior (mode: "full" with no stored questionIds;
  // StudentLiveTests.tsx's LiveTestAttempt falls back to the full bank read
  // whenever questionIds is null/empty, matching pre-feature behavior).
  let scope: LiveTestScope | undefined;
  if (body.scope !== undefined) {
    if (!isLiveTestScope(body.scope)) throw badRequest("scope is not a valid LiveTestScope.");
    scope = body.scope;
  }
  const questionCount = optionalInt(body.questionCount, "questionCount");
  const questionIds = scope && questionCount ? await pickLiveTestQuestions(courseId, scope, questionCount) : undefined;

  const [row] = await db
    .insert(liveTests)
    .values({
      tenantId,
      courseId,
      name: requireString(body.name, "name"),
      scheduledStart: new Date(requireString(body.scheduledStart, "scheduledStart")),
      scheduledEnd: new Date(requireString(body.scheduledEnd, "scheduledEnd")),
      durationMinutes: optionalInt(body.durationMinutes, "durationMinutes") ?? 30,
      pricePaise: optionalInt(body.pricePaise, "pricePaise") ?? 0,
      status: optionalOneOf(body.status, liveTestStatusEnum.enumValues, "status") ?? "Draft",
      scope: scope ?? null,
      questionCount: questionCount ?? null,
      questionIds: questionIds ?? null,
    })
    .returning();
  res.status(201).json(withPhase(row));
});

// PATCH /api/live-tests/:id
router.patch("/live-tests/:id", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [current] = await db.select().from(liveTests).where(eq(liveTests.id, id)).limit(1);
  if (!current) throw notFound("Live test not found.");
  if (!canAccessTenant(req.auth!, current.tenantId)) throw forbidden("You do not have access to this live test.");

  const body = req.body as Record<string, unknown>;
  const patch: Partial<typeof liveTests.$inferInsert> = {};
  if (body.name !== undefined) patch.name = requireString(body.name, "name");
  if (body.scheduledStart !== undefined) patch.scheduledStart = new Date(requireString(body.scheduledStart, "scheduledStart"));
  if (body.scheduledEnd !== undefined) patch.scheduledEnd = new Date(requireString(body.scheduledEnd, "scheduledEnd"));
  if (body.durationMinutes !== undefined) patch.durationMinutes = requireInt(body.durationMinutes, "durationMinutes");
  if (body.pricePaise !== undefined) patch.pricePaise = requireInt(body.pricePaise, "pricePaise");
  if (body.status !== undefined) patch.status = optionalOneOf(body.status, liveTestStatusEnum.enumValues, "status")!;

  const [row] = await db.update(liveTests).set(patch).where(eq(liveTests.id, id)).returning();
  res.json(withPhase(row));
});

// GET /api/live-tests/:id/participants — invited student ids (empty = open
// to every tenant student, same convention as course_assignments).
router.get("/live-tests/:id/participants", authenticate, async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [test] = await db.select().from(liveTests).where(eq(liveTests.id, id)).limit(1);
  if (!test) throw notFound("Live test not found.");
  if (!canAccessTenant(req.auth!, test.tenantId)) throw forbidden("You do not have access to this live test.");
  const rows = await db
    .select({ studentProfileId: liveTestParticipants.studentProfileId })
    .from(liveTestParticipants)
    .where(eq(liveTestParticipants.liveTestId, id));
  res.json(rows.map((r) => r.studentProfileId));
});

// PUT /api/live-tests/:id/participants — replace-all semantics.
router.put("/live-tests/:id/participants", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [test] = await db.select().from(liveTests).where(eq(liveTests.id, id)).limit(1);
  if (!test) throw notFound("Live test not found.");
  if (!canAccessTenant(req.auth!, test.tenantId)) throw forbidden("You do not have access to this live test.");

  const body = req.body as Record<string, unknown>;
  const studentProfileIds = requireStringArray(body.studentProfileIds, "studentProfileIds");
  studentProfileIds.forEach((sid) => requireUuid(sid, "studentProfileIds[]"));

  await db.transaction(async (tx) => {
    await tx.delete(liveTestParticipants).where(eq(liveTestParticipants.liveTestId, id));
    if (studentProfileIds.length > 0) {
      await tx
        .insert(liveTestParticipants)
        .values(studentProfileIds.map((studentProfileId) => ({ liveTestId: id, studentProfileId })));
    }
  });

  res.json(studentProfileIds);
});

export default router;
