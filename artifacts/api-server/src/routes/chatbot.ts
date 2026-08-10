import { Router, type IRouter, type Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { chatbotConfigs, chatbotMessages, chatbotUsage, chatbotProviderEnum, chatMessageRoleEnum } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { requireRole, canAccessTenant } from "../middlewares/authorize";
import { badRequest, forbidden, HttpError } from "../lib/http-error";
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

// ---------------------------------------------------------------------------
// POST /api/chatbot/chat — the actual AI call. Student sends just a message;
// everything else (config lookup, usage limits, history, persisting both
// sides of the exchange, incrementing the counter) happens server-side in
// one request, mirroring quiz-ITI's chatbot-backend/main.py `/chat` route
// but folded into this same Express app instead of a separate Python
// service — QuizSet has no other Python deployable, so a second stack for
// one endpoint isn't worth the extra moving part.
//
// The LLM key is a single platform-wide `OPENAI_API_KEY` env var, not a
// per-tenant column (unlike the quiz-ITI original, whose `chatbot_configs`
// has its own `api_key`) — this schema's `chatbotConfigs` has no such
// column, and splitting per-coaching billing/keys is out of scope for this
// pass. A coaching's own config still controls enabled/pricing/limits/prompt.
const MAX_MESSAGE_CHARS = 2000;
const HISTORY_LIMIT = 10;
const OPENAI_MODEL = "gpt-4o-mini";

/** Opens OpenAI's SSE stream and calls `onToken` as each text chunk arrives.
 * Returns the full accumulated reply once the stream ends, so the caller
 * still has one complete string to persist — streaming only changes how the
 * client sees the response arrive, not what ultimately gets saved. */
async function streamOpenAI(
  system: string,
  history: { role: string; content: string }[],
  onToken: (chunk: string) => void,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new HttpError(503, "AI assistant is not configured on the server yet (missing OPENAI_API_KEY).");
  }
  let res: globalThis.Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "system", content: system }, ...history],
        stream: true,
      }),
    });
  } catch {
    throw new HttpError(502, "Could not reach OpenAI.");
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    console.error(`OpenAI error ${res.status}: ${text.slice(0, 500)}`);
    throw new HttpError(502, "AI se jawab nahi mil paya. Thodi der baad dobara koshish karein.");
  }

  let full = "";
  let buffer = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice("data:".length).trim();
      if (payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onToken(delta);
        }
      } catch {
        // Ignore a line that isn't valid JSON (e.g. a stray keep-alive) —
        // OpenAI's stream is otherwise well-formed, so this is defensive,
        // not expected to fire in practice.
      }
    }
  }
  return full;
}

router.post("/chatbot/chat", authenticate, requireRole("student"), async (req, res) => {
  const auth = req.auth!;
  const tenantId = auth.tenantId;
  if (!tenantId) throw badRequest("No coaching linked to this account.");

  const body = req.body as Record<string, unknown>;
  const message = requireString(body.message, "message").trim();
  if (!message) throw badRequest("message is required.");
  if (message.length > MAX_MESSAGE_CHARS) throw badRequest(`message must be at most ${MAX_MESSAGE_CHARS} characters.`);

  const [config] = await db.select().from(chatbotConfigs).where(eq(chatbotConfigs.tenantId, tenantId)).limit(1);
  if (!config || !config.enabled) {
    throw forbidden("Chatbot aapki coaching ne enable nahi kiya hai.");
  }

  // -------------------------------------------------------------- usage gate
  const periodMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM', matches chatbot.ts's other routes' convention
  const studentProfileId = auth.userId;

  const usageRow = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(chatbotUsage)
      .where(and(eq(chatbotUsage.studentProfileId, studentProfileId), eq(chatbotUsage.periodMonth, periodMonth)))
      .limit(1);
    return existing ?? { id: null as string | null, messageCount: 0, isPaid: false };
  });
  const used = usageRow.messageCount;
  const isPaid = usageRow.isPaid;

  if (used >= config.monthlyMessageCap) {
    throw new HttpError(429, `Is mahine ki limit (${config.monthlyMessageCap} messages) khatam ho gayi.`);
  }
  if (!isPaid && config.priceRupeesPerMonth > 0 && used >= config.freeMessageLimit) {
    throw new HttpError(402, `Free limit (${config.freeMessageLimit} messages) khatam. Aage chat karne ke liye payment karein.`);
  }

  // ------------------------------------------------------------------- reply
  const historyRows = await db
    .select({ role: chatbotMessages.role, content: chatbotMessages.content })
    .from(chatbotMessages)
    .where(eq(chatbotMessages.studentProfileId, studentProfileId))
    .orderBy(desc(chatbotMessages.createdAt))
    .limit(HISTORY_LIMIT);
  const history = historyRows.reverse().map((m) => ({ role: m.role, content: m.content }));
  history.push({ role: "user", content: message });

  const systemPrompt =
    (config.systemPrompt || "").trim() ||
    "Aap ek helpful exam-preparation tutor hain. Students ke doubts saral bhasha me clear karein. " +
      "Jawab Hindi (Devanagari) me dein, lekin technical terms English me hi rakhein. " +
      "Sirf padhai/exam se related sawaalon ka jawab dein. " +
      // The client renders replies as plain text, not markdown — asking for
      // markdown syntax (**bold**, `code`, # headings, etc.) would just show
      // the raw symbols to the student, so the prompt tells the model not to
      // use it rather than relying on the UI to strip it after the fact.
      "Plain text me jawab dein — koi markdown formatting (**, ##, backticks, bullet ke liye -) use na karein; " +
      "list dikhani ho to numbered lines (1., 2., 3.) ya sirf naye paragraph use karein.";

  // ------------------------------------------------------------------ stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let reply: string;
  try {
    reply = await streamOpenAI(systemPrompt, history, (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });
  } catch (err) {
    const message = err instanceof HttpError ? err.message : "AI se jawab nahi mil paya. Thodi der baad dobara koshish karein.";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
    return;
  }
  if (!reply) {
    res.write(`data: ${JSON.stringify({ error: "AI se khaali jawab aaya, dobara koshish karein." })}\n\n`);
    res.end();
    return;
  }

  // ------------------------------------------------------------ persist both
  await db.insert(chatbotMessages).values([
    { studentProfileId, tenantId, role: "user", content: message },
    { studentProfileId, tenantId, role: "assistant", content: reply },
  ]);

  const updatedUsage = await db.transaction(async (tx) => {
    if (usageRow.id) {
      const [updated] = await tx
        .update(chatbotUsage)
        .set({ messageCount: used + 1 })
        .where(eq(chatbotUsage.id, usageRow.id))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(chatbotUsage)
      .values({ studentProfileId, tenantId, periodMonth, messageCount: 1, isPaid: false })
      .returning();
    return created;
  });

  res.write(
    `data: ${JSON.stringify({
      done: true,
      usage: { used: updatedUsage.messageCount, freeLimit: config.freeMessageLimit, cap: config.monthlyMessageCap, isPaid: updatedUsage.isPaid },
    })}\n\n`,
  );
  res.end();
});

export default router;
