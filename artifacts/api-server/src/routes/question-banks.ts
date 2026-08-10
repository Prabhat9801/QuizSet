import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { questionBankRequests, questionBanks, questionBankStatusEnum } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden, notFound } from "../lib/http-error";
import { optionalOneOf, requireString, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

// The review pipeline, in order — see the long comment on question_banks.status
// in lib/db/src/schema/question-banks.ts for what each stage means.
const BANK_STAGES = questionBankStatusEnum.enumValues; // ["Generating", "Platform Review", "Coaching Review", "Finalized"]

/** Keeps a request's coarse status in sync whenever the bank it produced
 * changes its fine-grained stage — mirrors services/mock.ts's
 * syncRequestToBankStage(). */
async function syncRequestToBankStage(bankId: string, bankStatus: (typeof BANK_STAGES)[number]) {
  const [request] = await db
    .select()
    .from(questionBankRequests)
    .where(eq(questionBankRequests.questionBankId, bankId))
    .limit(1);
  if (!request) return;
  const requestStatus = bankStatus === "Finalized" ? "Finalized" : "In Progress";
  if (request.status !== requestStatus) {
    await db.update(questionBankRequests).set({ status: requestStatus }).where(eq(questionBankRequests.id, request.id));
  }
}

async function loadBankOrThrow(id: string) {
  const [bank] = await db.select().from(questionBanks).where(eq(questionBanks.id, id)).limit(1);
  if (!bank) throw notFound("Question bank not found.");
  return bank;
}

// GET /api/question-banks?tenantId= — platform sees every stage including
// Generating/Platform Review; a coaching owner only sees Coaching Review and
// Finalized (replicates listVisibleToCoaching()).
router.get("/question-banks", authenticate, async (req, res) => {
  const tenantId = req.query.tenantId;
  if (typeof tenantId !== "string") throw badRequest("tenantId query parameter is required.");
  requireUuid(tenantId, "tenantId");
  if (!canAccessTenant(req.auth!, tenantId)) throw forbidden("You do not have access to this tenant's question banks.");

  const rows = await db.select().from(questionBanks).where(eq(questionBanks.tenantId, tenantId));
  if (req.auth!.role === "platform") return res.json(rows);
  return res.json(rows.filter((b) => b.status === "Coaching Review" || b.status === "Finalized"));
});

// GET /api/question-banks/:id
router.get("/question-banks/:id", authenticate, async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const bank = await loadBankOrThrow(id);
  if (!canAccessTenant(req.auth!, bank.tenantId)) throw forbidden("You do not have access to this question bank.");
  if (req.auth!.role !== "platform" && bank.status !== "Coaching Review" && bank.status !== "Finalized") {
    throw forbidden("This question bank is not visible to your coaching yet.");
  }
  res.json(bank);
});

// POST /api/question-banks — usually created via question-bank-requests'
// start-bank action, but exposed directly too (e.g. an ad-hoc bank with no
// request behind it, which the schema explicitly allows).
router.post("/question-banks", authenticate, requireRole("platform"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const tenantId = requireUuid(body.tenantId, "tenantId");
  const [row] = await db
    .insert(questionBanks)
    .values({
      tenantId,
      name: requireString(body.name, "name"),
      subject: requireString(body.subject, "subject"),
      status: optionalOneOf(body.status, BANK_STAGES, "status") ?? "Generating",
      requestId: body.requestId ? requireUuid(body.requestId, "requestId") : null,
    })
    .returning();
  res.status(201).json(row);
});

// PATCH /api/question-banks/:id — platform can move it through any stage;
// a coaching owner may only edit a bank that's already visible to it
// (Coaching Review) — e.g. renaming, or fixing its subject label.
router.patch("/question-banks/:id", authenticate, async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const bank = await loadBankOrThrow(id);
  if (!canAccessTenant(req.auth!, bank.tenantId)) throw forbidden("You do not have access to this question bank.");
  if (req.auth!.role === "coaching" && bank.status !== "Coaching Review" && bank.status !== "Finalized") {
    throw forbidden("This question bank is not editable by your coaching yet.");
  }
  if (req.auth!.role === "student") throw forbidden("Students cannot edit question banks.");

  const body = req.body as Record<string, unknown>;
  const patch: Partial<typeof questionBanks.$inferInsert> = {};
  if (body.name !== undefined) patch.name = requireString(body.name, "name");
  if (body.subject !== undefined) patch.subject = requireString(body.subject, "subject");
  if (body.status !== undefined) {
    if (req.auth!.role !== "platform") throw forbidden("Only the platform owner can change a bank's review stage directly.");
    patch.status = optionalOneOf(body.status, BANK_STAGES, "status")!;
  }

  const [row] = await db.update(questionBanks).set(patch).where(eq(questionBanks.id, id)).returning();
  if (patch.status) await syncRequestToBankStage(id, patch.status);
  res.json(row);
});

// POST /api/question-banks/:id/advance — platform owner moves a bank
// forward one stage (Generating -> Platform Review -> Coaching Review).
router.post("/question-banks/:id/advance", authenticate, requireRole("platform"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const bank = await loadBankOrThrow(id);
  const nextIndex = Math.min(BANK_STAGES.indexOf(bank.status) + 1, BANK_STAGES.length - 1);
  const nextStatus = BANK_STAGES[nextIndex];
  const [row] = await db.update(questionBanks).set({ status: nextStatus }).where(eq(questionBanks.id, id)).returning();
  await syncRequestToBankStage(id, nextStatus);
  res.json(row);
});

// POST /api/question-banks/:id/send-back — platform owner kicks a bank back
// a stage after spotting a problem during its own review.
router.post("/question-banks/:id/send-back", authenticate, requireRole("platform"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const bank = await loadBankOrThrow(id);
  const prevIndex = Math.max(BANK_STAGES.indexOf(bank.status) - 1, 0);
  const prevStatus = BANK_STAGES[prevIndex];
  const [row] = await db.update(questionBanks).set({ status: prevStatus }).where(eq(questionBanks.id, id)).returning();
  await syncRequestToBankStage(id, prevStatus);
  res.json(row);
});

// POST /api/question-banks/:id/finalize — coaching owner's explicit
// "approve for students" action; only valid from Coaching Review.
router.post("/question-banks/:id/finalize", authenticate, requireRole("coaching", "platform"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const bank = await loadBankOrThrow(id);
  if (!canAccessTenant(req.auth!, bank.tenantId)) throw forbidden("You do not have access to this question bank.");
  if (bank.status !== "Coaching Review") {
    throw badRequest("This bank is not ready to finalize yet — it must be in Coaching Review first.");
  }
  const [row] = await db.update(questionBanks).set({ status: "Finalized" }).where(eq(questionBanks.id, id)).returning();
  await syncRequestToBankStage(id, "Finalized");
  res.json(row);
});

export default router;
