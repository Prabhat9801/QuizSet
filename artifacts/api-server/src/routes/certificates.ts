import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { certificates, courses, profiles, tenants } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { forbidden, notFound, unauthorized } from "../lib/http-error";
import { optionalString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

function randomCode(): string {
  return `QS-CERT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// POST /api/certificates — coaching-owner only, snapshots the tenant's
// CURRENT branding onto the row at issue time so it stays visually correct
// even if the coaching rebrands later. `coachingThemeColorSnapshot` maps to
// `tenants.primaryColor` — the schema has primary/secondary colors, not a
// single "theme color" field, so primaryColor is the closest match (see
// report for this judgment call).
router.post("/certificates", authenticate, requireRole("coaching"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = req.auth!.tenantId;
  if (!tenantId) throw unauthorized("Coaching profile has no tenant assigned.");
  const studentProfileId = requireUuid(body.studentProfileId, "studentProfileId");
  const courseId = requireUuid(body.courseId, "courseId");

  const [student] = await db.select().from(profiles).where(eq(profiles.id, studentProfileId)).limit(1);
  if (!student || student.tenantId !== tenantId) throw notFound("Student not found in this coaching.");
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course || course.tenantId !== tenantId) throw notFound("Course not found in this coaching.");
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw notFound("Tenant not found.");

  let row: typeof certificates.$inferSelect | undefined;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    try {
      [row] = await db
        .insert(certificates)
        .values({
          studentProfileId,
          courseId,
          tenantId,
          issuedByProfileId: req.auth!.userId,
          certificateCode: randomCode(),
          coachingNameSnapshot: tenant.displayName ?? tenant.name,
          coachingLogoUrlSnapshot: tenant.logoUrl,
          coachingThemeColorSnapshot: tenant.primaryColor,
          note: optionalString(body.note, "note") ?? null,
        })
        .returning();
    } catch (err) {
      if (!(err instanceof Error) || !/duplicate key.*certificate_code/i.test(err.message)) throw err;
      // Extremely unlikely collision on the random code — retry with a new one.
    }
  }
  if (!row) throw new Error("Could not generate a unique certificate code after several attempts.");
  res.status(201).json(row);
});

// GET /api/certificates/student/:studentProfileId — the student themself, or
// coaching/platform staff who can access that student's tenant.
router.get("/certificates/student/:studentProfileId", authenticate, async (req, res) => {
  const studentProfileId = requireUuid(req.params.studentProfileId, "studentProfileId");
  if (req.auth!.role === "student") {
    if (req.auth!.userId !== studentProfileId) throw forbidden("Students can only see their own certificates.");
  } else {
    const [student] = await db.select().from(profiles).where(eq(profiles.id, studentProfileId)).limit(1);
    if (!student) throw notFound("Student not found.");
    if (!canAccessTenant(req.auth!, student.tenantId)) throw forbidden("You do not have access to this student's certificates.");
  }
  res.json(await db.select().from(certificates).where(eq(certificates.studentProfileId, studentProfileId)));
});

// GET /api/certificates/code/:code — public, no auth: what a shareable
// certificate link resolves to.
router.get("/certificates/code/:code", async (req, res) => {
  const code = req.params.code;
  const [row] = await db.select().from(certificates).where(eq(certificates.certificateCode, code)).limit(1);
  if (!row) throw notFound("Certificate not found.");
  res.json(row);
});

export default router;
