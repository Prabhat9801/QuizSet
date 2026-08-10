import { Router, type IRouter } from "express";
import { eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  courseAssignments,
  courses,
  courseStatusEnum,
  questionBanks,
  questions,
} from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden, notFound } from "../lib/http-error";
import { optionalInt, optionalOneOf, optionalString, requireInt, requireString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.
const courseCols = getTableColumns(courses);

/** Every course for a tenant with its REAL question count joined from the
 * linked bank's questions — never a hand-typed number. Grouping by
 * `courses.id` (the primary key) lets Postgres select the other course
 * columns from the same table without listing them all in GROUP BY
 * (functional dependency on the PK). */
async function listCoursesWithCounts(tenantId: string) {
  return db
    .select({
      ...courseCols,
      questionCount: sql<number>`count(${questions.id})`.mapWith(Number),
    })
    .from(courses)
    .leftJoin(questionBanks, eq(questionBanks.id, courses.questionBankId))
    .leftJoin(questions, eq(questions.questionBankId, questionBanks.id))
    .where(eq(courses.tenantId, tenantId))
    .groupBy(courses.id);
}

// GET /api/courses?tenantId= — coaching/platform view, with question counts.
router.get("/courses", authenticate, async (req, res) => {
  const tenantId = req.query.tenantId;
  if (typeof tenantId !== "string") throw badRequest("tenantId query parameter is required.");
  requireUuid(tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant's courses.");
  res.json(await listCoursesWithCounts(tenantId));
});

// GET /api/courses/for-student?tenantId=&studentId= — respects course_assignments:
// a course with zero assignment rows is visible to the whole tenant; a
// course WITH assignment rows is visible only to the students listed.
router.get("/courses/for-student", authenticate, async (req, res) => {
  const tenantId = req.query.tenantId;
  const studentId = req.query.studentId;
  if (typeof tenantId !== "string") throw badRequest("tenantId query parameter is required.");
  if (typeof studentId !== "string") throw badRequest("studentId query parameter is required.");
  requireUuid(tenantId, "tenantId");
  requireUuid(studentId, "studentId");

  // A student may only ever ask for their own visible-course list; coaching/platform may ask for any student in a tenant they can access.
  if (req.auth!.role === "student" && req.auth!.userId !== studentId) {
    throw forbidden("Students can only list their own visible courses.");
  }
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant's courses.");

  const all = await listCoursesWithCounts(tenantId);
  if (all.length === 0) return res.json(all);

  const assignmentRows = await db
    .select({ courseId: courseAssignments.courseId, studentProfileId: courseAssignments.studentProfileId })
    .from(courseAssignments)
    .where(inArray(courseAssignments.courseId, all.map((c) => c.id)));

  const assignedByCourse = new Map<string, Set<string>>();
  for (const row of assignmentRows) {
    if (!assignedByCourse.has(row.courseId)) assignedByCourse.set(row.courseId, new Set());
    assignedByCourse.get(row.courseId)!.add(row.studentProfileId);
  }

  const visible = all.filter((c) => {
    const assigned = assignedByCourse.get(c.id);
    return !assigned || assigned.size === 0 || assigned.has(studentId);
  });
  return res.json(visible);
});

// GET /api/courses/:id
router.get("/courses/:id", authenticate, async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [row] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  if (!row) throw notFound("Course not found.");
  if (!canAccessTenant(req.auth!, row.tenantId)) throw forbidden("You do not have access to this course.");
  const [[{ questionCount }]] = await Promise.all([
    db
      .select({ questionCount: sql<number>`count(${questions.id})`.mapWith(Number) })
      .from(questions)
      .where(eq(questions.questionBankId, row.questionBankId ?? "00000000-0000-0000-0000-000000000000")),
  ]);
  res.json({ ...row, questionCount });
});

async function assertBankFinalized(questionBankId: string | null) {
  if (!questionBankId) {
    throw badRequest("This course has no finalized question bank yet — it cannot be published.");
  }
  const [bank] = await db.select().from(questionBanks).where(eq(questionBanks.id, questionBankId)).limit(1);
  if (!bank || bank.status !== "Finalized") {
    throw badRequest("This course’s question bank has not been finalized yet — it cannot be published until the coaching owner approves it.");
  }
}

// POST /api/courses — coaching owner (own tenant) or platform. Defaults to
// Draft with no bank; publishing at creation time still goes through the
// same finalized-bank guard as update().
router.post("/courses", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant.");

  const status = optionalOneOf(body.status, courseStatusEnum.enumValues, "status") ?? "Draft";
  const questionBankId = body.questionBankId ? requireUuid(body.questionBankId, "questionBankId") : null;
  if (status === "Published") {
    await assertBankFinalized(questionBankId);
  }

  const [row] = await db
    .insert(courses)
    .values({
      tenantId,
      questionBankId,
      name: requireString(body.name, "name"),
      description: optionalString(body.description, "description"),
      mrpPaise: optionalInt(body.mrpPaise, "mrpPaise") ?? 0,
      salePaise: optionalInt(body.salePaise, "salePaise") ?? 0,
      previewCount: optionalInt(body.previewCount, "previewCount") ?? 0,
      status,
      subject: optionalString(body.subject, "subject") ?? "General",
    })
    .returning();
  res.status(201).json({ ...row, questionCount: 0 });
});

// PATCH /api/courses/:id — enforces the publish-guard: setting
// status: 'Published' fails unless the linked bank is Finalized.
router.patch("/courses/:id", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [current] = await db.select().from(courses).where(eq(courses.id, id)).limit(1);
  if (!current) throw notFound("Course not found.");
  if (!canAccessTenant(req.auth!, current.tenantId)) throw forbidden("You do not have access to this course.");

  const body = req.body as Record<string, unknown>;
  const patch: Partial<typeof courses.$inferInsert> = {};
  if (body.name !== undefined) patch.name = requireString(body.name, "name");
  if (body.description !== undefined) patch.description = optionalString(body.description, "description") ?? null;
  if (body.mrpPaise !== undefined) patch.mrpPaise = requireInt(body.mrpPaise, "mrpPaise");
  if (body.salePaise !== undefined) patch.salePaise = requireInt(body.salePaise, "salePaise");
  if (body.previewCount !== undefined) patch.previewCount = requireInt(body.previewCount, "previewCount");
  if (body.subject !== undefined) patch.subject = requireString(body.subject, "subject");
  if (body.questionBankId !== undefined) {
    patch.questionBankId = body.questionBankId === null ? null : requireUuid(body.questionBankId, "questionBankId");
  }
  if (body.status !== undefined) {
    const status = optionalOneOf(body.status, courseStatusEnum.enumValues, "status")!;
    if (status === "Published" && current.status !== "Published") {
      const bankId = patch.questionBankId !== undefined ? patch.questionBankId : current.questionBankId;
      await assertBankFinalized(bankId);
    }
    patch.status = status;
  }

  const [row] = await db.update(courses).set(patch).where(eq(courses.id, id)).returning();
  res.json(row);
});

export default router;
