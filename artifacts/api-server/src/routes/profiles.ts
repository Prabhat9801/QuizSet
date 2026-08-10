import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { profiles, tenants } from "@workspace/db/schema";
import { authenticate, extractBearerToken, verifySupabaseJwt } from "../middlewares/auth";
import { canAccessTenant } from "../middlewares/authorize";
import { badRequest, conflict, forbidden, notFound } from "../lib/http-error";
import { optionalOneOf, optionalString, requireString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

// GET /api/profiles/me — the caller's own profile row.
router.get("/profiles/me", authenticate, async (req, res) => {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, req.auth!.userId)).limit(1);
  if (!row) throw notFound("Profile not found.");
  res.json(row);
});

// GET /api/profiles?tenantId= — a coaching owner's own roster, or (with an
// explicit tenantId) the platform owner's view into any tenant. A student
// has no legitimate reason to list other profiles.
router.get("/profiles", authenticate, async (req, res) => {
  if (req.auth!.role === "student") {
    throw forbidden("Students cannot list profiles.");
  }
  const tenantId = req.query.tenantId;
  if (typeof tenantId !== "string") {
    throw badRequest("tenantId query parameter is required.");
  }
  requireUuid(tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) {
    throw forbidden("You do not have access to this tenant's profiles.");
  }
  const rows = await db.select().from(profiles).where(eq(profiles.tenantId, tenantId));
  res.json(rows);
});

// POST /api/profiles/me — self-service profile creation right after a real
// Supabase signup. Deliberately does NOT use `authenticate` (which 404s when
// no profile exists yet — exactly the state this route exists to fix);
// verifies the token directly instead. Always creates `role: 'student'`,
// `tenantId: null` — a self-signup can never grant itself coaching/platform
// access or a tenant, matching the same "role/tenantId are security-sensitive,
// never a generic write" invariant the PATCH route below enforces. Idempotent:
// calling it again for an already-onboarded user just returns the existing row.
router.post("/profiles/me", async (req, res) => {
  const token = extractBearerToken(req);
  const { id, email, name } = await verifySupabaseJwt(token);

  const [existing] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  if (existing) {
    res.json(existing);
    return;
  }

  const [created] = await db
    .insert(profiles)
    .values({ id, email, name, role: "student", tenantId: null })
    .returning();
  res.status(201).json(created);
});

// POST /api/profiles/me/join — the instant join-code flow. Deliberately its
// OWN endpoint rather than letting the generic PATCH below accept `tenantId`:
// this one is intentionally narrow (looks up the tenant server-side by code,
// only ever succeeds for a caller with NO tenant yet) instead of a general
// "set anyone's tenantId to anything" escape hatch.
router.post("/profiles/me/join", authenticate, async (req, res) => {
  if (req.auth!.tenantId) {
    throw conflict("This account already belongs to a coaching.");
  }
  const joinCode = requireString(req.body.joinCode, "joinCode");
  const [tenant] = await db.select().from(tenants).where(eq(tenants.joinCode, joinCode.trim())).limit(1);
  if (!tenant) throw notFound("No coaching found with that join code.");

  const [profile] = await db
    .update(profiles)
    .set({ tenantId: tenant.id })
    .where(eq(profiles.id, req.auth!.userId))
    .returning();
  res.json({ profile, tenant });
});

// PATCH /api/profiles/:id — name/email/status only. Deliberately does NOT
// accept `role` or `tenantId` here: those are identity/security-sensitive
// and change through their own dedicated flows (join-requests deciding
// tenantId, no endpoint at all changes role) — never a generic profile edit,
// mirroring the "role/tenantId are immutable via a generic update" invariant
// this project's sibling repo (quiz-ITI) already learned the hard way.
router.patch("/profiles/:id", authenticate, async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  if (!existing) throw notFound("Profile not found.");
  if (!canAccessTenant(req.auth!, existing.tenantId)) {
    throw forbidden("You do not have access to this profile.");
  }
  if (req.auth!.role === "student" && req.auth!.userId !== id) {
    throw forbidden("Students may only update their own profile.");
  }

  const name = optionalString(req.body.name, "name");
  const email = optionalString(req.body.email, "email");
  const status = optionalOneOf(req.body.status, ["Active", "Pending", "Suspended"] as const, "status");

  const patch: Partial<typeof existing> = {};
  if (name !== undefined) patch.name = name;
  if (email !== undefined) patch.email = email;
  if (status !== undefined) patch.status = status;
  if (Object.keys(patch).length === 0) throw badRequest("No updatable fields provided.");

  const [updated] = await db.update(profiles).set(patch).where(eq(profiles.id, id)).returning();
  res.json(updated);
});

export default router;
