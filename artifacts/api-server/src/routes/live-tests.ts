import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { courses, liveTestParticipants, liveTests, liveTestStatusEnum } from "@workspace/db/schema";
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

// GET /api/live-tests?tenantId=
router.get("/live-tests", authenticate, async (req, res) => {
  const tenantId = req.query.tenantId;
  if (typeof tenantId !== "string") throw badRequest("tenantId query parameter is required.");
  requireUuid(tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant's live tests.");
  const rows = await db.select().from(liveTests).where(eq(liveTests.tenantId, tenantId));
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
