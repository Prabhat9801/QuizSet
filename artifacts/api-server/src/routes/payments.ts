import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { courses, notifications, paymentKindEnum, payments, paymentStatusEnum, profiles } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden } from "../lib/http-error";
import { optionalOneOf, requireInt, requireOneOf, requireString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

// POST /api/payments — a student pays for themselves. The platform takes a
// flat 50% commission on live_test/chatbot payments, and on course payments
// EXCEPT a tenant's very first course, which is commission-free (see the
// "BUSINESS RULE" comment below). Both shares are computed and stored as
// actual paise amounts at write time (not just a percentage) so the ledger
// stays correct even if the commission rate changes later. `Math.round` on
// the platform share, with the coaching share as the REMAINDER (not its own
// independent round), guarantees the two shares always sum back to
// totalPaise exactly — no paisa lost or gained to rounding on an odd total.
router.post("/payments", authenticate, requireRole("student"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  if (req.auth!.tenantId !== tenantId) throw forbidden("You do not have access to this tenant.");

  const totalPaise = requireInt(body.totalPaise, "totalPaise");
  if (totalPaise < 0) throw badRequest("totalPaise cannot be negative.");
  const kind = requireOneOf(body.kind, paymentKindEnum.enumValues, "kind");
  const refId = requireUuid(body.refId, "refId");

  // BUSINESS RULE: a coaching's chronologically FIRST course is
  // commission-free — the coaching keeps 100% so a brand-new coaching can
  // try the platform risk-free on its very first offering. Every course
  // after that (2nd, 3rd, ...) pays the standard flat 50% split, unchanged.
  // This only ever applies to `kind: 'course'` payments — live_test and
  // chatbot payments always keep the plain 50/50 split below regardless of
  // which course they happen to be tied to.
  //
  // Verification trace:
  //   - Tenant's 1st course (earliest createdAt) purchased -> refId equals
  //     the id returned by the "oldest course for this tenant" query below
  //     -> platformSharePaise = 0, coachingSharePaise = totalPaise.
  //   - Tenant's 2nd+ course purchased -> refId does NOT match the oldest
  //     course's id -> falls through to the standard Math.round(total/2)
  //     split, exactly as before this change.
  let platformSharePaise: number;
  let coachingSharePaise: number;
  let isFirstCourseFree = false;
  if (kind === "course") {
    const [oldestCourse] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.tenantId, tenantId))
      .orderBy(asc(courses.createdAt))
      .limit(1);
    isFirstCourseFree = !!oldestCourse && oldestCourse.id === refId;
  }
  if (isFirstCourseFree) {
    platformSharePaise = 0;
    coachingSharePaise = totalPaise;
  } else {
    platformSharePaise = Math.round(totalPaise / 2);
    coachingSharePaise = totalPaise - platformSharePaise;
  }

  const label = requireString(body.label, "label");
  const status = optionalOneOf(body.status, paymentStatusEnum.enumValues, "status") ?? "Success";
  const [row] = await db
    .insert(payments)
    .values({
      tenantId,
      studentProfileId: req.auth!.userId,
      kind,
      refId,
      label,
      totalPaise,
      platformSharePaise,
      coachingSharePaise,
      status,
    })
    .returning();

  // Notification fan-out — deliberately AFTER the insert above and never
  // allowed to affect its result: a notification is a side-effect record of
  // what just happened, not part of the payment write itself.
  if (status === "Success") {
    const [student] = await db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, req.auth!.userId)).limit(1);
    const rupees = (totalPaise / 100).toFixed(2);
    await db.insert(notifications).values({
      role: "coaching",
      tenantId,
      subjectProfileId: req.auth!.userId,
      kind: "payment_received",
      title: "New payment received",
      body: `${student?.name ?? "A student"} paid ₹${rupees} for ${label}.`,
    });

    // Safety net, not a normal-path notification — the split math itself
    // belongs to whoever owns the commission logic above; this only checks
    // that its two outputs still add up to the input.
    if (platformSharePaise + coachingSharePaise !== totalPaise) {
      await db.insert(notifications).values({
        role: "platform",
        tenantId: null,
        subjectProfileId: null,
        kind: "payment_split_issue",
        title: "Payment split mismatch",
        body: `Payment ${row.id}: platformSharePaise (${platformSharePaise}) + coachingSharePaise (${coachingSharePaise}) != totalPaise (${totalPaise}).`,
      });
    }
  }

  res.status(201).json(row);
});

// GET /api/payments?tenantId= — platform may omit tenantId for a
// platform-wide ledger, or pass one to scope it; a coaching owner is always
// scoped to its own tenant; a student sees only their own transactions.
router.get("/payments", authenticate, async (req, res) => {
  const tenantId = req.query.tenantId;
  if (tenantId !== undefined && typeof tenantId !== "string") throw badRequest("tenantId must be a string.");

  if (req.auth!.role === "student") {
    const rows = await db.select().from(payments).where(eq(payments.studentProfileId, req.auth!.userId));
    return res.json(rows);
  }

  if (req.auth!.role === "coaching") {
    if (!tenantId) throw badRequest("tenantId query parameter is required.");
    if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant's payments.");
    const rows = await db.select().from(payments).where(eq(payments.tenantId, tenantId));
    return res.json(rows);
  }

  // platform
  if (tenantId) {
    requireUuid(tenantId, "tenantId");
    return res.json(await db.select().from(payments).where(eq(payments.tenantId, tenantId)));
  }
  return res.json(await db.select().from(payments));
});

export default router;
