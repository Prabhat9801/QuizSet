import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  courses,
  questions,
  studyPlanItems,
  studyPlanModeEnum,
  studyPlans,
} from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden, notFound } from "../lib/http-error";
import { optionalOneOf, requireString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

async function loadCourseOrThrow(courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) throw notFound("Course not found.");
  return course;
}

/** The course's real unit list, in the same "first seen" order the
 * syllabus-tree endpoint (questions.ts) would produce — read straight off
 * the linked bank's questions, never hand-typed. */
async function loadCourseUnits(questionBankId: string | null): Promise<string[]> {
  if (!questionBankId) return [];
  const rows = await db
    .select({ unit: questions.unit })
    .from(questions)
    .where(eq(questions.questionBankId, questionBankId));
  const seen = new Set<string>();
  for (const row of rows) seen.add(row.unit);
  return Array.from(seen);
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Evenly distributes `units` across [startDate, endDate] inclusive — e.g. 5
 * units over 20 days gives roughly one unit every 4 days. With N units the
 * i-th unit (0-indexed) lands at start + round(i * span / (N-1)) days, so the
 * first unit targets startDate and the last targets endDate exactly; a single
 * unit targets endDate. */
function distributeAcrossRange(units: string[], startDate: string, endDate: string): { unit: string; targetDate: string }[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const spanMs = end.getTime() - start.getTime();
  if (spanMs < 0) throw badRequest("endDate must be on or after startDate.");
  const n = units.length;
  if (n === 0) return [];
  if (n === 1) return [{ unit: units[0], targetDate: toDateOnly(end) }];

  return units.map((unit, i) => {
    const offsetMs = Math.round((i * spanMs) / (n - 1));
    const target = new Date(start.getTime() + offsetMs);
    return { unit, targetDate: toDateOnly(target) };
  });
}

async function loadPlanWithItems(courseId: string) {
  const [plan] = await db.select().from(studyPlans).where(eq(studyPlans.courseId, courseId)).limit(1);
  if (!plan) return null;
  const items = await db
    .select()
    .from(studyPlanItems)
    .where(eq(studyPlanItems.studyPlanId, plan.id))
    .orderBy(asc(studyPlanItems.targetDate));
  return { ...plan, items };
}

// GET /api/study-plans?courseId= — the plan + its items for one course, or
// `null` if no plan has been set yet (not an error — a real empty state).
router.get("/study-plans", authenticate, async (req, res) => {
  const courseId = req.query.courseId;
  if (typeof courseId !== "string") throw badRequest("courseId query parameter is required.");
  requireUuid(courseId, "courseId");

  const course = await loadCourseOrThrow(courseId);
  if (!canAccessTenant(req.auth!, course.tenantId)) throw forbidden("You do not have access to this course.");

  res.json(await loadPlanWithItems(courseId));
});

type ManualItemInput = { unit: string; targetDate: string };

// PUT /api/study-plans — coaching-owner-only upsert with replace-all item
// semantics (matches course-assignments.ts / live-tests.ts's participants
// pattern: delete existing items for the plan, insert the current set).
router.put("/study-plans", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const courseId = requireUuid(body.courseId, "courseId");
  const course = await loadCourseOrThrow(courseId);
  if (!canAccessTenant(req.auth!, course.tenantId)) throw forbidden("You do not have access to this course.");

  const mode = optionalOneOf(body.mode, studyPlanModeEnum.enumValues, "mode") ?? "manual";

  let items: ManualItemInput[];
  let startDate: string | null = null;
  let endDate: string | null = null;

  if (mode === "auto") {
    startDate = requireString(body.startDate, "startDate");
    endDate = requireString(body.endDate, "endDate");
    const units = await loadCourseUnits(course.questionBankId);
    if (units.length === 0) {
      throw badRequest("This course has no units yet — add questions to its bank before setting an auto study plan.");
    }
    items = distributeAcrossRange(units, startDate, endDate);
  } else {
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw badRequest("items is required (a non-empty array of { unit, targetDate }) for a manual plan.");
    }
    items = (body.items as Record<string, unknown>[]).map((raw, i) => ({
      unit: requireString(raw.unit, `items[${i}].unit`),
      targetDate: requireString(raw.targetDate, `items[${i}].targetDate`),
    }));
  }

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(studyPlans).where(eq(studyPlans.courseId, courseId)).limit(1);

    const [plan] = existing
      ? await tx
          .update(studyPlans)
          .set({ mode, startDate, endDate })
          .where(eq(studyPlans.id, existing.id))
          .returning()
      : await tx
          .insert(studyPlans)
          .values({ tenantId: course.tenantId, courseId, mode, startDate, endDate })
          .returning();

    await tx.delete(studyPlanItems).where(eq(studyPlanItems.studyPlanId, plan.id));
    const insertedItems = items.length
      ? await tx
          .insert(studyPlanItems)
          .values(items.map((item) => ({ studyPlanId: plan.id, unit: item.unit, targetDate: item.targetDate })))
          .returning()
      : [];

    return { ...plan, items: insertedItems };
  });

  res.json(result);
});

export default router;
