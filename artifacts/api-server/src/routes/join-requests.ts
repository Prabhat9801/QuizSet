import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { joinRequests, notifications, profiles, tenants } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, conflict, forbidden, notFound } from "../lib/http-error";
import { requireString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// POST /api/join-requests — the "search a coaching, request to join" flow.
// Deliberately public/unauthenticated: `join_requests` has no FK to
// `profiles` (see the schema comment in join-requests.ts) precisely because
// the requester may not have signed up / have a profile row yet at this
// point — that's the whole reason this table exists instead of just
// updating a profile directly like the join-code path does.
router.post("/join-requests", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw badRequest("tenantId must reference a real coaching.");

  const [row] = await db
    .insert(joinRequests)
    .values({
      tenantId,
      studentName: requireString(body.studentName, "studentName"),
      studentEmail: requireString(body.studentEmail, "studentEmail"),
    })
    .returning();
  res.status(201).json(row);
});

// GET /api/join-requests?tenantId= — coaching owner (own tenant) or platform.
router.get("/join-requests", authenticate, async (req, res) => {
  const tenantId = req.query.tenantId;
  if (typeof tenantId !== "string") throw badRequest("tenantId query parameter is required.");
  requireUuid(tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant's join requests.");
  res.json(await db.select().from(joinRequests).where(eq(joinRequests.tenantId, tenantId)));
});

// POST /api/join-requests/:id/decide — coaching owner (own tenant) or
// platform approves/rejects. `join_requests` only carries the requester's
// name/email, not a profile id (see the POST handler's comment above), so
// approval can only take effect if a `profiles` row with a matching email
// already exists (profiles.email is unique) — i.e. the student has by then
// completed Supabase Auth signup. If no such profile exists yet, this
// returns 409 rather than fabricating a profile with a made-up id (which
// would never be able to log in, since profiles.id must equal the Supabase
// auth user id). This is a genuine gap in what the schema can express end
// to end — see the report for the full explanation.
router.post("/join-requests/:id/decide", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [request] = await db.select().from(joinRequests).where(eq(joinRequests.id, id)).limit(1);
  if (!request) throw notFound("Join request not found.");
  if (!canAccessTenant(req.auth!, request.tenantId)) throw forbidden("You do not have access to this join request.");

  const body = req.body as Record<string, unknown>;
  if (typeof body.approve !== "boolean") throw badRequest("approve must be a boolean.");

  if (!body.approve) {
    const [row] = await db.update(joinRequests).set({ status: "Rejected" }).where(eq(joinRequests.id, id)).returning();
    return res.json(row);
  }

  const [matchingProfile] = await db.select().from(profiles).where(eq(profiles.email, request.studentEmail)).limit(1);
  if (!matchingProfile) {
    throw conflict(
      `No account found yet for ${request.studentEmail} — the student must sign up before this request can be approved.`,
    );
  }

  const [row] = await db.transaction(async (tx) => {
    await tx.update(profiles).set({ tenantId: request.tenantId, status: "Active" }).where(eq(profiles.id, matchingProfile.id));
    await tx.insert(notifications).values({
      role: "coaching",
      tenantId: request.tenantId,
      subjectProfileId: matchingProfile.id,
      kind: "student_joined",
      title: "New student joined",
      body: `${matchingProfile.name} joined after their join request was approved.`,
    });
    return tx.update(joinRequests).set({ status: "Approved" }).where(eq(joinRequests.id, id)).returning();
  });
  return res.json(row);
});

export default router;
