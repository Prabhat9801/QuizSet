import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { testimonials } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/http-error";
import { optionalString, requireString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// GET /api/testimonials/public — no auth needed: a public landing page's
// feed. Only rows where BOTH approvals are true are ever returned.
router.get("/testimonials/public", async (_req, res) => {
  const rows = await db
    .select()
    .from(testimonials)
    .where(and(eq(testimonials.coachingApproved, true), eq(testimonials.platformApproved, true)));
  res.json(rows);
});

// POST /api/testimonials — a student submits feedback about (optionally) one course.
router.post("/testimonials", authenticate, requireRole("student"), async (req, res) => {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) throw unauthorized("Student profile has no tenant assigned.");
  const body = req.body as Record<string, unknown>;

  const [row] = await db
    .insert(testimonials)
    .values({
      studentProfileId: req.auth!.userId,
      tenantId,
      courseId: body.courseId ? requireUuid(body.courseId, "courseId") : null,
      content: requireString(body.content, "content"),
      outcome: optionalString(body.outcome, "outcome") ?? null,
    })
    .returning();
  res.status(201).json(row);
});

// POST /api/testimonials/:id/coaching-approve — coaching owner of the same tenant.
router.post("/testimonials/:id/coaching-approve", authenticate, requireRole("coaching"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [current] = await db.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
  if (!current) throw notFound("Testimonial not found.");
  if (!canAccessTenant(req.auth!, current.tenantId)) throw forbidden("You do not have access to this testimonial.");

  const [row] = await db
    .update(testimonials)
    .set({ coachingApproved: true, coachingApprovedAt: new Date(), coachingApprovedByProfileId: req.auth!.userId })
    .where(eq(testimonials.id, id))
    .returning();
  res.json(row);
});

// POST /api/testimonials/:id/platform-approve — platform owner only.
router.post("/testimonials/:id/platform-approve", authenticate, requireRole("platform"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [current] = await db.select().from(testimonials).where(eq(testimonials.id, id)).limit(1);
  if (!current) throw notFound("Testimonial not found.");

  const [row] = await db
    .update(testimonials)
    .set({ platformApproved: true, platformApprovedAt: new Date(), platformApprovedByProfileId: req.auth!.userId })
    .where(eq(testimonials.id, id))
    .returning();
  res.json(row);
});

// GET /api/testimonials?tenantId= — coaching/platform moderation queue (all
// statuses, not just the dual-approved public feed).
router.get("/testimonials", authenticate, async (req, res) => {
  const tenantId = req.query.tenantId;
  if (typeof tenantId !== "string") throw badRequest("tenantId query parameter is required.");
  requireUuid(tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant's testimonials.");
  res.json(await db.select().from(testimonials).where(eq(testimonials.tenantId, tenantId)));
});

export default router;
