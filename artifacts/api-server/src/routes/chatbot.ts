import { Router, type IRouter, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { chatbotConfigs, chatbotMessages, chatbotUsage, chatbotProviderEnum, chatMessageRoleEnum } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden } from "../lib/http-error";
import { optionalInt, optionalOneOf, requireInt, requireOneOf, requireString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

const DEFAULT_CONFIG = (tenantId: string) => ({
  tenantId,
  enabled: false,
  provider: "OpenAI" as const,
  priceRupeesPerMonth: 0,
  freeMessageLimit: 0,
  monthlyMessageCap: 100,
  systemPrompt: "",
});

// GET /api/chatbot/config/:tenantId — anyone with access to the tenant; a
// tenant with no row yet gets the same default shape mock.ts's get() returns
// (not written to the DB until someone actually saves a config).
router.get("/chatbot/config/:tenantId", authenticate, async (req, res) => {
  const tenantId = requireUuid(req.params.tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant's chatbot config.");
  const [row] = await db.select().from(chatbotConfigs).where(eq(chatbotConfigs.tenantId, tenantId)).limit(1);
  res.json(row ?? DEFAULT_CONFIG(tenantId));
});

// PUT /api/chatbot/config/:tenantId — coaching owner (own tenant) or
// platform. Upserts by hand (rather than `.onConflictDoUpdate`) because
// there's no partial-update semantics needed beyond "merge onto defaults",
// and tenantId is already the table's primary key.
router.put("/chatbot/config/:tenantId", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const tenantId = requireUuid(req.params.tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant.");

  const body = req.body as Record<string, unknown>;
  const [existing] = await db.select().from(chatbotConfigs).where(eq(chatbotConfigs.tenantId, tenantId)).limit(1);
  const base = existing ?? DEFAULT_CONFIG(tenantId);

  const merged = {
    tenantId,
    enabled: typeof body.enabled === "boolean" ? body.enabled : base.enabled,
    provider: optionalOneOf(body.provider, chatbotProviderEnum.enumValues, "provider") ?? base.provider,
    priceRupeesPerMonth: optionalInt(body.priceRupeesPerMonth, "priceRupeesPerMonth") ?? base.priceRupeesPerMonth,
    freeMessageLimit: optionalInt(body.freeMessageLimit, "freeMessageLimit") ?? base.freeMessageLimit,
    monthlyMessageCap: optionalInt(body.monthlyMessageCap, "monthlyMessageCap") ?? base.monthlyMessageCap,
    systemPrompt: typeof body.systemPrompt === "string" ? body.systemPrompt : base.systemPrompt,
  };

  const [row] = existing
    ? await db.update(chatbotConfigs).set(merged).where(eq(chatbotConfigs.tenantId, tenantId)).returning()
    : await db.insert(chatbotConfigs).values(merged).returning();
  res.json(row);
});

function assertSelfOrStaff(req: Request, studentProfileId: string, tenantId: string) {
  if (req.auth!.role === "student" && req.auth!.userId !== studentProfileId) {
    throw forbidden("Students can only see their own chatbot usage.");
  }
  if (req.auth!.role !== "student" && !canAccessTenant(req.auth!, tenantId)) {
    throw forbidden("You do not have access to this tenant.");
  }
}

// GET /api/chatbot/usage?studentProfileId=&tenantId=&periodMonth= — this
// student's own usage row (or a zeroed default if none exists yet).
router.get("/chatbot/usage", authenticate, async (req, res) => {
  const studentProfileId = req.query.studentProfileId;
  const tenantId = req.query.tenantId;
  const periodMonth = req.query.periodMonth;
  if (typeof studentProfileId !== "string" || typeof tenantId !== "string" || typeof periodMonth !== "string") {
    throw badRequest("studentProfileId, tenantId and periodMonth query parameters are all required.");
  }
  requireUuid(studentProfileId, "studentProfileId");
  requireUuid(tenantId, "tenantId");
  assertSelfOrStaff(req, studentProfileId, tenantId);

  const [row] = await db
    .select()
    .from(chatbotUsage)
    .where(and(eq(chatbotUsage.studentProfileId, studentProfileId), eq(chatbotUsage.periodMonth, periodMonth)))
    .limit(1);
  res.json(row ?? { studentProfileId, tenantId, periodMonth, messageCount: 0, isPaid: false });
});

// POST /api/chatbot/usage/increment — bumps this calendar month's message
// count by one, creating the row on first use. Manual select-then-write in
// a transaction rather than `.onConflictDoUpdate`, because the schema has no
// unique constraint on (studentProfileId, periodMonth) to target.
router.post("/chatbot/usage/increment", authenticate, requireRole("student"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  if (req.auth!.tenantId !== tenantId) throw forbidden("You do not have access to this tenant.");
  const periodMonth = requireString(body.periodMonth, "periodMonth");
  const studentProfileId = req.auth!.userId;

  const row = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(chatbotUsage)
      .where(and(eq(chatbotUsage.studentProfileId, studentProfileId), eq(chatbotUsage.periodMonth, periodMonth)))
      .limit(1);
    if (existing) {
      const [updated] = await tx
        .update(chatbotUsage)
        .set({ messageCount: existing.messageCount + 1 })
        .where(eq(chatbotUsage.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(chatbotUsage)
      .values({ studentProfileId, tenantId, periodMonth, messageCount: 1, isPaid: false })
      .returning();
    return created;
  });
  res.json(row);
});

// POST /api/chatbot/usage/mark-paid — flips isPaid for a (student, month);
// intended to run right after a successful 'chatbot' kind payment (wiring
// payments -> usage automatically is out of scope here, see report).
// `chatbot_usage` is deliberately not student-writable for isPaid, so a
// student can't grant themselves paid access — only coaching/platform may
// call this.
router.post("/chatbot/usage/mark-paid", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant.");
  const studentProfileId = requireUuid(body.studentProfileId, "studentProfileId");
  const periodMonth = requireString(body.periodMonth, "periodMonth");

  const row = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(chatbotUsage)
      .where(and(eq(chatbotUsage.studentProfileId, studentProfileId), eq(chatbotUsage.periodMonth, periodMonth)))
      .limit(1);
    if (existing) {
      const [updated] = await tx.update(chatbotUsage).set({ isPaid: true }).where(eq(chatbotUsage.id, existing.id)).returning();
      return updated;
    }
    const [created] = await tx
      .insert(chatbotUsage)
      .values({ studentProfileId, tenantId, periodMonth, messageCount: 0, isPaid: true })
      .returning();
    return created;
  });
  res.json(row);
});

// GET /api/chatbot/messages?studentProfileId=&tenantId= — this student's
// message log, oldest first.
router.get("/chatbot/messages", authenticate, async (req, res) => {
  const studentProfileId = req.query.studentProfileId;
  const tenantId = req.query.tenantId;
  if (typeof studentProfileId !== "string" || typeof tenantId !== "string") {
    throw badRequest("studentProfileId and tenantId query parameters are required.");
  }
  requireUuid(studentProfileId, "studentProfileId");
  requireUuid(tenantId, "tenantId");
  assertSelfOrStaff(req, studentProfileId, tenantId);

  const rows = await db.select().from(chatbotMessages).where(eq(chatbotMessages.studentProfileId, studentProfileId)).orderBy(chatbotMessages.createdAt);
  res.json(rows);
});

// POST /api/chatbot/messages — appends one message (student's own question,
// or an assistant reply logged on the student's behalf).
router.post("/chatbot/messages", authenticate, requireRole("student"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  if (req.auth!.tenantId !== tenantId) throw forbidden("You do not have access to this tenant.");

  const [row] = await db
    .insert(chatbotMessages)
    .values({
      studentProfileId: req.auth!.userId,
      tenantId,
      role: requireOneOf(body.role, chatMessageRoleEnum.enumValues, "role"),
      content: requireString(body.content, "content"),
    })
    .returning();
  res.status(201).json(row);
});

export default router;
