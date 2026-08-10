import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { paymentKindEnum, payments, paymentStatusEnum } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden } from "../lib/http-error";
import { optionalOneOf, requireInt, requireOneOf, requireString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

// POST /api/payments — a student pays for themselves. The platform takes a
// flat 50% commission: both shares are computed and stored as actual paise
// amounts at write time (not just a percentage) so the ledger stays correct
// even if the commission rate changes later. `Math.round` on the platform
// share, with the coaching share as the REMAINDER (not its own independent
// round), guarantees the two shares always sum back to totalPaise exactly —
// no paisa lost or gained to rounding on an odd total.
router.post("/payments", authenticate, requireRole("student"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  if (req.auth!.tenantId !== tenantId) throw forbidden("You do not have access to this tenant.");

  const totalPaise = requireInt(body.totalPaise, "totalPaise");
  if (totalPaise < 0) throw badRequest("totalPaise cannot be negative.");
  const platformSharePaise = Math.round(totalPaise / 2);
  const coachingSharePaise = totalPaise - platformSharePaise;

  const [row] = await db
    .insert(payments)
    .values({
      tenantId,
      studentProfileId: req.auth!.userId,
      kind: requireOneOf(body.kind, paymentKindEnum.enumValues, "kind"),
      refId: requireUuid(body.refId, "refId"),
      label: requireString(body.label, "label"),
      totalPaise,
      platformSharePaise,
      coachingSharePaise,
      status: optionalOneOf(body.status, paymentStatusEnum.enumValues, "status") ?? "Success",
    })
    .returning();
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
