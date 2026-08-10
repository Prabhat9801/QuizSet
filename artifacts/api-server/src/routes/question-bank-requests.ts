import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { courses, questionBankRequests, questionBanks, requestPriorityEnum } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden, notFound } from "../lib/http-error";
import { optionalOneOf, optionalString, requireInt, requireString, requireStringArray, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

// GET /api/question-bank-requests?tenantId=
router.get("/question-bank-requests", authenticate, async (req, res) => {
  const tenantId = req.query.tenantId;
  if (typeof tenantId !== "string") throw badRequest("tenantId query parameter is required.");
  requireUuid(tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant's requests.");
  res.json(await db.select().from(questionBankRequests).where(eq(questionBankRequests.tenantId, tenantId)));
});

// POST /api/question-bank-requests — a coaching's ask for a new/extended
// bank. Must reference a real, already-existing course in the same tenant.
router.post("/question-bank-requests", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant.");

  const courseId = requireUuid(body.courseId, "courseId");
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) throw badRequest("courseId must reference a real, existing course.");
  if (course.tenantId !== tenantId) throw badRequest("That course does not belong to this tenant.");

  const [row] = await db
    .insert(questionBankRequests)
    .values({
      tenantId,
      courseId,
      courseName: course.name,
      subjects: requireStringArray(body.subjects, "subjects"),
      questionsRequired: requireInt(body.questionsRequired, "questionsRequired"),
      difficulty: requireString(body.difficulty, "difficulty"),
      priority: optionalOneOf(body.priority, requestPriorityEnum.enumValues, "priority") ?? "Medium",
      notes: optionalString(body.notes, "notes"),
      unitsTopics: optionalString(body.unitsTopics, "unitsTopics"),
      syllabusFileName: optionalString(body.syllabusFileName, "syllabusFileName"),
    })
    .returning();
  res.status(201).json(row);
});

// POST /api/question-bank-requests/:id/start-bank — platform owner accepts a
// Pending request: creates its bank (stage: Generating), moves the request
// to In Progress, AND links the new bank onto the course it was requested
// for — the 3-way side effect from services/mock.ts's startBank(), kept
// atomic in a transaction.
router.post("/question-bank-requests/:id/start-bank", authenticate, requireRole("platform"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");

  const result = await db.transaction(async (tx) => {
    const [request] = await tx.select().from(questionBankRequests).where(eq(questionBankRequests.id, id)).limit(1);
    if (!request) throw notFound("Request not found.");
    if (request.questionBankId) return request; // already started

    const [bank] = await tx
      .insert(questionBanks)
      .values({
        tenantId: request.tenantId,
        name: request.courseName,
        subject: request.subjects.join(", "),
        status: "Generating",
        requestId: request.id,
      })
      .returning();

    const [updated] = await tx
      .update(questionBankRequests)
      .set({ status: "In Progress", questionBankId: bank.id })
      .where(eq(questionBankRequests.id, id))
      .returning();

    await tx.update(courses).set({ questionBankId: bank.id }).where(eq(courses.id, request.courseId));

    return updated;
  });

  res.json(result);
});

// PATCH /api/question-bank-requests/:id — currently just the owner-note
// field (platform's note back to the coaching).
router.patch("/question-bank-requests/:id", authenticate, requireRole("platform"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const body = req.body as Record<string, unknown>;
  if (body.ownerNote === undefined) throw badRequest("ownerNote is required.");
  const [row] = await db
    .update(questionBankRequests)
    .set({ ownerNote: optionalString(body.ownerNote, "ownerNote") ?? null })
    .where(eq(questionBankRequests.id, id))
    .returning();
  if (!row) throw notFound("Request not found.");
  res.json(row);
});

export default router;
