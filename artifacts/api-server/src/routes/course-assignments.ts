import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { courseAssignments, courses } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { forbidden, notFound } from "../lib/http-error";
import { requireStringArray, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

async function loadCourseOrThrow(courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) throw notFound("Course not found.");
  return course;
}

// GET /api/course-assignments/:courseId — current assignment list, for
// prefilling the coaching owner's student-checklist UI.
router.get("/course-assignments/:courseId", authenticate, async (req, res) => {
  const courseId = requireUuid(req.params.courseId, "courseId");
  const course = await loadCourseOrThrow(courseId);
  if (!canAccessTenant(req.auth!, course.tenantId)) throw forbidden("You do not have access to this course.");

  const rows = await db
    .select({ studentProfileId: courseAssignments.studentProfileId })
    .from(courseAssignments)
    .where(eq(courseAssignments.courseId, courseId));
  res.json(rows.map((r) => r.studentProfileId));
});

// PUT /api/course-assignments/:courseId — replace-all semantics: body is the
// complete new set of assigned student ids (empty array = open to whole
// tenant, matching the course_assignments convention).
router.put("/course-assignments/:courseId", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const courseId = requireUuid(req.params.courseId, "courseId");
  const course = await loadCourseOrThrow(courseId);
  if (!canAccessTenant(req.auth!, course.tenantId)) throw forbidden("You do not have access to this course.");

  const body = req.body as Record<string, unknown>;
  const studentProfileIds = requireStringArray(body.studentProfileIds, "studentProfileIds");
  studentProfileIds.forEach((id) => requireUuid(id, "studentProfileIds[]"));

  await db.transaction(async (tx) => {
    await tx.delete(courseAssignments).where(eq(courseAssignments.courseId, courseId));
    if (studentProfileIds.length > 0) {
      await tx
        .insert(courseAssignments)
        .values(studentProfileIds.map((studentProfileId) => ({ courseId, studentProfileId })));
    }
  });

  res.json(studentProfileIds);
});

export default router;
