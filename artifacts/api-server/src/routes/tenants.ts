import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { tenants } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { requireRole } from "../middlewares/authorize";
import { badRequest, forbidden, notFound } from "../lib/http-error";
import { optionalString, requireString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route below, not via a blanket
// `router.use(authenticate)`. This app flat-mounts many single-resource
// routers onto the same `/api` path (see routes/index.ts) — a path-less
// `router.use(mw)` in ANY of them would run for every request that reaches
// the shared router chain, including requests meant for routers mounted
// after it, since Express dispatches through each mounted sub-router in
// sequence looking for a path match. A rejecting middleware with no path
// scope short-circuits that whole chain. Per-route middleware avoids it.
const HEX_RE = /^#[0-9a-f]{6}$/i;

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function joinCodeFrom(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 7).toUpperCase() || "COACHING";
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

// GET /api/tenants — every coaching, platform-owner only.
router.get("/tenants", authenticate, requireRole("platform"), async (_req, res) => {
  const rows = await db.select().from(tenants);
  res.json(rows);
});

// GET /api/tenants/by-join-code/:code — deliberately open to ANY
// authenticated role (not platform-only), unlike the full list above: a
// student mid-join-flow has no tenant yet and needs to resolve a join code
// to a tenant before they have one. Exact-match only (never lists other
// tenants' codes) — a join code is meant to be handed out by a coaching to
// its own prospective students anyway (an invite code, not a high-security
// secret), same trust level as this had in the mock/local-only version.
router.get("/tenants/by-join-code/:code", authenticate, async (req, res) => {
  const code = requireString(req.params.code, "code");
  const [row] = await db.select().from(tenants).where(eq(tenants.joinCode, code.trim())).limit(1);
  if (!row) throw notFound("No coaching found with that join code.");
  res.json(row);
});

// GET /api/tenants/search?q= — same "open to any authenticated role" reasoning
// as by-join-code above (the search-a-coaching-and-request-to-join flow needs
// this before the caller has a tenant). Matches on name/city only.
router.get("/tenants/search", authenticate, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json([]);
    return;
  }
  const rows = await db
    .select()
    .from(tenants)
    .where(or(ilike(tenants.name, `%${q}%`), ilike(tenants.city, `%${q}%`)));
  res.json(rows);
});

// GET /api/tenants/:id — platform can read any; coaching/student can read
// only their own tenant (they need this for branding/theme lookups).
router.get("/tenants/:id", authenticate, async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  if (req.auth!.role !== "platform" && req.auth!.tenantId !== id) {
    throw forbidden("You do not have access to this tenant.");
  }
  const [row] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!row) throw notFound("Tenant not found.");
  res.json(row);
});

// POST /api/tenants — platform-owner only.
router.post("/tenants", authenticate, requireRole("platform"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const name = requireString(body.name, "name");
  const primaryColor = optionalString(body.primaryColor, "primaryColor") ?? "#4f46e5";
  const secondaryColor = optionalString(body.secondaryColor, "secondaryColor") ?? "#06b6d4";
  if (!HEX_RE.test(primaryColor)) throw badRequest("primaryColor must be a #rrggbb hex color.");
  if (!HEX_RE.test(secondaryColor)) throw badRequest("secondaryColor must be a #rrggbb hex color.");

  const joinCode = optionalString(body.joinCode, "joinCode") ?? joinCodeFrom(name);

  try {
    const [row] = await db
      .insert(tenants)
      .values({
        name,
        initials: optionalString(body.initials, "initials") ?? initialsFrom(name),
        city: requireString(body.city, "city"),
        category: requireString(body.category, "category"),
        plan: optionalString(body.plan, "plan") ?? "Starter",
        primaryColor,
        secondaryColor,
        displayName: optionalString(body.displayName, "displayName"),
        logoUrl: optionalString(body.logoUrl, "logoUrl"),
        joinCode,
        owner: requireString(body.owner, "owner"),
        supportEmail: requireString(body.supportEmail, "supportEmail"),
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    if (err instanceof Error && /duplicate key.*join_code/i.test(err.message)) {
      throw badRequest(`Join code "${joinCode}" is already taken.`);
    }
    throw err;
  }
});

// PATCH /api/tenants/:id — platform can update any tenant; a coaching owner
// can update only its own tenant (e.g. branding fields).
router.patch("/tenants/:id", authenticate, requireRole("platform", "coaching"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  if (req.auth!.role !== "platform" && req.auth!.tenantId !== id) {
    throw forbidden("You do not have access to this tenant.");
  }
  const body = req.body as Record<string, unknown>;
  const patch: Partial<typeof tenants.$inferInsert> = {};
  if (body.name !== undefined) patch.name = requireString(body.name, "name");
  if (body.initials !== undefined) patch.initials = requireString(body.initials, "initials");
  if (body.city !== undefined) patch.city = requireString(body.city, "city");
  if (body.category !== undefined) patch.category = requireString(body.category, "category");
  if (body.plan !== undefined) patch.plan = requireString(body.plan, "plan");
  if (body.owner !== undefined) patch.owner = requireString(body.owner, "owner");
  if (body.supportEmail !== undefined) patch.supportEmail = requireString(body.supportEmail, "supportEmail");
  if (body.joinCode !== undefined) patch.joinCode = requireString(body.joinCode, "joinCode");
  if (body.displayName !== undefined) patch.displayName = optionalString(body.displayName, "displayName") ?? null;
  if (body.logoUrl !== undefined) patch.logoUrl = optionalString(body.logoUrl, "logoUrl") ?? null;
  if (body.primaryColor !== undefined) {
    const v = requireString(body.primaryColor, "primaryColor");
    if (!HEX_RE.test(v)) throw badRequest("primaryColor must be a #rrggbb hex color.");
    patch.primaryColor = v;
  }
  if (body.secondaryColor !== undefined) {
    const v = requireString(body.secondaryColor, "secondaryColor");
    if (!HEX_RE.test(v)) throw badRequest("secondaryColor must be a #rrggbb hex color.");
    patch.secondaryColor = v;
  }

  const [row] = await db.update(tenants).set(patch).where(eq(tenants.id, id)).returning();
  if (!row) throw notFound("Tenant not found.");
  res.json(row);
});

export default router;
