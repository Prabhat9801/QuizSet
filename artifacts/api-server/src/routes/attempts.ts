import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  attemptModeEnum,
  attempts,
  courses,
  liveTests,
  profiles,
  questions,
  type PracticeScope,
} from "@workspace/db/schema";
import { authenticate, type AuthContext } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, conflict, forbidden, notFound } from "../lib/http-error";
import { optionalInt, requireInt, requireOneOf, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

/** Two scopes count as "the same" for no-repeat purposes only if the mode
 * AND the exact topic/unit set match — ported 1:1 from services/mock.ts's
 * sameScope() so each mode+scope combination keeps its own independent
 * seen-question history. */
function sameScope(a: PracticeScope, b: PracticeScope): boolean {
  if (a.mode !== b.mode) return false;
  const sameSet = (x: string[], y: string[]) =>
    x.length === y.length && new Set(x).size === new Set(y).size && x.every((v) => y.includes(v));
  switch (a.mode) {
    case "full":
      return true;
    case "topic":
      return b.mode === "topic" && sameSet(a.topics, b.topics);
    case "unit":
    case "multi-unit":
      return b.mode === a.mode && sameSet(a.units, (b as typeof a).units);
    case "custom":
      return b.mode === "custom" && sameSet(a.topics, b.topics) && sameSet(a.units, b.units);
  }
}

function isPracticeScope(value: unknown): value is PracticeScope {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!["full", "topic", "unit", "multi-unit", "custom"].includes(v.mode as string)) return false;
  if ((v.mode === "topic" || v.mode === "custom") && !Array.isArray(v.topics)) return false;
  if ((v.mode === "unit" || v.mode === "multi-unit" || v.mode === "custom") && !Array.isArray(v.units)) return false;
  return true;
}

function assertCanSeeStudent(auth: AuthContext, studentProfileId: string, studentTenantId: string) {
  if (auth.role === "student" && auth.userId !== studentProfileId) {
    throw forbidden("Students can only see their own attempts.");
  }
  if (auth.role !== "student" && !canAccessTenant(auth, studentTenantId)) {
    throw forbidden("You do not have access to this student's data.");
  }
}

// POST /api/attempts — save a finished practice/live-test run. `score` is
// always recomputed here from the actual question answers rather than
// trusted from the client, so a tampered request body can't self-report a
// higher score. Live-test attempts are one-shot: a second submission for the
// same (student, liveTestId) pair is rejected rather than silently allowed.
router.post("/attempts", authenticate, requireRole("student"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const studentProfileId = req.auth!.userId;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  if (req.auth!.tenantId !== tenantId) throw forbidden("You do not have access to this tenant.");

  const courseId = requireUuid(body.courseId, "courseId");
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course || course.tenantId !== tenantId) throw badRequest("courseId must reference a real course in this tenant.");

  const mode = requireOneOf(body.mode, attemptModeEnum.enumValues, "mode");
  const liveTestId = body.liveTestId ? requireUuid(body.liveTestId, "liveTestId") : null;
  if (liveTestId) {
    const [test] = await db.select().from(liveTests).where(eq(liveTests.id, liveTestId)).limit(1);
    if (!test || test.tenantId !== tenantId) throw badRequest("liveTestId must reference a real live test in this tenant.");
    const [existing] = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.studentProfileId, studentProfileId), eq(attempts.liveTestId, liveTestId)))
      .limit(1);
    if (existing) throw conflict("This live test has already been attempted — it cannot be retaken.");
  }

  let practiceScope: PracticeScope | undefined;
  if (body.practiceScope !== undefined) {
    if (!isPracticeScope(body.practiceScope)) throw badRequest("practiceScope is not a valid PracticeScope.");
    practiceScope = body.practiceScope;
  }

  const questionIds = (body.questionIds as unknown[] | undefined) ?? [];
  if (!Array.isArray(questionIds) || questionIds.some((q) => typeof q !== "string")) {
    throw badRequest("questionIds must be an array of strings.");
  }
  const answersRaw = (body.answers as Record<string, unknown>) ?? {};
  if (typeof answersRaw !== "object" || answersRaw === null) throw badRequest("answers must be an object.");

  // Recompute score server-side from the real questions, not the client's claim.
  const questionRows = questionIds.length
    ? await db.select().from(questions).where(inArray(questions.id, questionIds as string[]))
    : [];
  const byId = new Map(questionRows.map((q) => [q.id, q]));
  let score = 0;
  const answers: Record<number, number> = {};
  for (const [key, value] of Object.entries(answersRaw)) {
    const index = Number(key);
    if (!Number.isInteger(index) || typeof value !== "number") continue;
    answers[index] = value;
    const q = byId.get((questionIds as string[])[index]);
    if (q && q.answer === value) score += 1;
  }

  const [row] = await db
    .insert(attempts)
    .values({
      studentProfileId,
      tenantId,
      courseId,
      liveTestId,
      mode,
      practiceScope: practiceScope ?? null,
      answers,
      questionIds: questionIds as string[],
      score,
      totalAttempted: optionalInt(body.totalAttempted, "totalAttempted") ?? Object.keys(answers).length,
      timeTakenSeconds: requireInt(body.timeTakenSeconds, "timeTakenSeconds"),
    })
    .returning();
  res.status(201).json(row);
});

// GET /api/attempts/student/:studentProfileId — a student's own history, or
// (for coaching/platform) any student's history within an accessible tenant.
router.get("/attempts/student/:studentProfileId", authenticate, async (req, res) => {
  const studentProfileId = requireUuid(req.params.studentProfileId, "studentProfileId");
  const [student] = await db.select().from(profiles).where(eq(profiles.id, studentProfileId)).limit(1);
  if (!student) throw notFound("Student not found.");
  assertCanSeeStudent(req.auth!, studentProfileId, student.tenantId ?? "");

  const rows = await db
    .select()
    .from(attempts)
    .where(eq(attempts.studentProfileId, studentProfileId))
    .orderBy(attempts.createdAt);
  res.json(rows.reverse());
});

// GET /api/attempts/course/:courseId — every attempt on one course, any
// student — the coaching-owner student-tracking dashboard.
router.get("/attempts/course/:courseId", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const courseId = requireUuid(req.params.courseId, "courseId");
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) throw notFound("Course not found.");
  if (!canAccessTenant(req.auth!, course.tenantId)) throw forbidden("You do not have access to this course.");

  const rows = await db.select().from(attempts).where(eq(attempts.courseId, courseId)).orderBy(attempts.createdAt);
  res.json(rows.reverse());
});

// GET /api/attempts/:id
router.get("/attempts/:id", authenticate, async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [row] = await db.select().from(attempts).where(eq(attempts.id, id)).limit(1);
  if (!row) throw notFound("Attempt not found.");
  if (req.auth!.role === "student" && req.auth!.userId !== row.studentProfileId) {
    throw forbidden("You do not have access to this attempt.");
  }
  if (req.auth!.role !== "student" && !canAccessTenant(req.auth!, row.tenantId)) {
    throw forbidden("You do not have access to this attempt.");
  }
  res.json(row);
});

// POST /api/attempts/practice-questions — no-repeat practice-question
// picker. Prefers questions this student hasn't seen yet in this EXACT
// mode+scope; once every question in scope has been seen, it cycles back
// through the seen ones rather than blocking further practice. Ported from
// services/mock.ts's attemptService.pickForPractice().
router.post("/attempts/practice-questions", authenticate, requireRole("student", "coaching", "platform"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const studentProfileId = requireUuid(body.studentProfileId, "studentProfileId");
  if (req.auth!.role === "student" && req.auth!.userId !== studentProfileId) {
    throw forbidden("Students can only request practice questions for themselves.");
  }
  const courseId = requireUuid(body.courseId, "courseId");
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) throw notFound("Course not found.");
  if (!canAccessTenant(req.auth!, course.tenantId)) throw forbidden("You do not have access to this course.");
  if (!course.questionBankId) throw badRequest("This course has no question bank yet.");

  if (!isPracticeScope(body.scope)) throw badRequest("scope is not a valid PracticeScope.");
  const scope = body.scope;
  const count = requireInt(body.count, "count");

  const pool = await db.select().from(questions).where(eq(questions.questionBankId, course.questionBankId));

  // Scope filtering: which of the bank's questions are even in-play for this
  // pick, before no-repeat logic narrows it further. "custom" mixes a
  // specific topic list AND a specific unit list (a question qualifies if it
  // matches either) — the schema/mock don't spell this out since pool
  // filtering happens client-side there; this is this server's own,
  // documented interpretation.
  const scopedPool = pool.filter((q) => {
    switch (scope.mode) {
      case "full":
        return true;
      case "topic":
        return scope.topics.includes(q.topic);
      case "unit":
      case "multi-unit":
        return scope.units.includes(q.unit);
      case "custom":
        return scope.topics.includes(q.topic) || scope.units.includes(q.unit);
    }
  });

  const pastAttempts = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.studentProfileId, studentProfileId), eq(attempts.courseId, courseId), eq(attempts.mode, "practice")));
  const seenIds = new Set<string>();
  for (const a of pastAttempts) {
    if (a.practiceScope && sameScope(a.practiceScope, scope)) {
      for (const qid of a.questionIds) seenIds.add(qid);
    }
  }

  const unseen = scopedPool.filter((q) => !seenIds.has(q.id));
  const ordered = unseen.length >= count ? unseen : [...unseen, ...scopedPool.filter((q) => seenIds.has(q.id))];
  res.json(ordered.slice(0, count));
});

export default router;
