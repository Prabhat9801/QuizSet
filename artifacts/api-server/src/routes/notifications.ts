import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { notifications } from "@workspace/db/schema";
import { authenticate, type AuthContext } from "../middlewares/auth";
import { forbidden, notFound } from "../lib/http-error";
import { requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

/** The single source of truth for "which notifications can this caller see"
 * — shared by GET (list), the single-row POST /:id/read (which must reuse
 * the exact same rule so a caller can't mark-read a row it couldn't list),
 * and POST /read-all (which batch-updates exactly this same set).
 *
 * Scoping rules, per role:
 *   - platform: role = 'platform' (tenantId is always null for these, but we
 *     don't additionally filter on it — the role column alone is authoritative).
 *   - coaching: role = 'coaching' AND tenantId = caller's own tenantId. A
 *     coaching owner never sees another tenant's notifications.
 *   - student: role = 'student' AND tenantId = caller's own tenantId AND
 *     (subjectProfileId = caller's own userId OR subjectProfileId IS NULL).
 *     The tenantId equality keeps this tenant-isolated; the subjectProfileId
 *     clause is what stops one student from reading a notification that is
 *     about a DIFFERENT specific student in the same tenant (e.g. another
 *     student's `student_weak_performance`/`student_inactive` row, which has
 *     subjectProfileId set to that other student's id, not this caller's).
 *     A null subjectProfileId is a tenant/role-wide notification (none of the
 *     "auto" triggers in this pass emit a student-role notification with a
 *     null subject, but the OR clause is here so the rule is correct even if
 *     one is added later) and is visible to every student in the tenant.
 */
function visibilityFilter(auth: AuthContext) {
  if (auth.role === "platform") {
    return eq(notifications.role, "platform");
  }
  if (auth.role === "coaching") {
    return and(eq(notifications.role, "coaching"), eq(notifications.tenantId, auth.tenantId ?? ""));
  }
  // student
  return and(
    eq(notifications.role, "student"),
    eq(notifications.tenantId, auth.tenantId ?? ""),
    or(eq(notifications.subjectProfileId, auth.userId), isNull(notifications.subjectProfileId)),
  );
}

// GET /api/notifications — the caller's own visible notifications, newest first.
router.get("/notifications", authenticate, async (req, res) => {
  const rows = await db
    .select()
    .from(notifications)
    .where(visibilityFilter(req.auth!))
    .orderBy(desc(notifications.createdAt));
  res.json(rows);
});

// POST /api/notifications/:id/read — marks ONE notification read. Re-fetches
// the row and re-runs the exact same visibility check GET uses (rather than
// trusting that "it matched some WHERE" implies access) so a student can't
// mark another student's notification read, and a coaching can't mark
// another tenant's.
router.post("/notifications/:id/read", authenticate, async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [row] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  if (!row) throw notFound("Notification not found.");

  const auth = req.auth!;
  const visible =
    auth.role === "platform"
      ? row.role === "platform"
      : auth.role === "coaching"
        ? row.role === "coaching" && row.tenantId === auth.tenantId
        : row.role === "student" &&
          row.tenantId === auth.tenantId &&
          (row.subjectProfileId === auth.userId || row.subjectProfileId === null);
  if (!visible) throw forbidden("You do not have access to this notification.");

  const [updated] = await db.update(notifications).set({ read: true }).where(eq(notifications.id, id)).returning();
  res.json(updated);
});

// POST /api/notifications/read-all — marks every notification visible to the
// caller (per the same scoping as GET) as read, in one batch update.
router.post("/notifications/read-all", authenticate, async (req, res) => {
  const rows = await db
    .update(notifications)
    .set({ read: true })
    .where(visibilityFilter(req.auth!))
    .returning();
  res.json(rows);
});

export default router;
