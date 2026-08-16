import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { chatbotConfigs, chatbotUsage, courses, liveTests, notifications, paymentKindEnum, payments, profiles } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden, notFound } from "../lib/http-error";
import { requireOneOf, requireUuid } from "../lib/validate";
import { createRazorpayOrder, verifyRazorpaySignature } from "../lib/razorpay";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

// ---------------------------------------------------------------------------
// Real Razorpay flow: create-order -> (client completes checkout with
// Razorpay's widget) -> verify. There used to be a route that just accepted
// a client-asserted totalPaise/status="Success" outright — removed here,
// since that is exactly the hole a payment system can't have. Every amount
// below is looked up server-side from the tenant's own course/live-test/
// chatbot price row; the only way `status` becomes "Success" is a signature
// that verifies against Razorpay's own key secret (see lib/razorpay.ts).
//
// A "Success" row in `payments` for (studentProfileId, kind, refId) IS the
// access grant — this app has no separate course_assignments-as-purchase or
// live_test_participants.isPaid concept (those two tables gate VISIBILITY —
// which students can even see a restricted course/test, not who's paid for
// it). The frontend's hasPurchasedAsync() already reads it this way; the
// eligibility checks below just query the same table for the same thing
// server-side, before trusting a create-order request to make a real charge.
// ---------------------------------------------------------------------------

async function alreadyPaid(studentId: string, kind: (typeof paymentKindEnum.enumValues)[number], refId: string) {
  const [row] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.studentProfileId, studentId), eq(payments.kind, kind), eq(payments.refId, refId), eq(payments.status, "Success")))
    .limit(1);
  return !!row;
}

/** Resolves { tenantId, amountPaise, label } for a purchase, re-checking the
 * same eligibility a client-trusting route would otherwise just assume. */
async function resolvePurchase(
  studentId: string,
  kind: (typeof paymentKindEnum.enumValues)[number],
  refId: string,
): Promise<{ tenantId: string; amountPaise: number; label: string }> {
  if (kind === "course") {
    const [course] = await db.select().from(courses).where(eq(courses.id, refId)).limit(1);
    if (!course) throw notFound("Course not found.");
    if (course.salePaise <= 0) throw badRequest("This course is free — no payment needed.");
    if (await alreadyPaid(studentId, "course", refId)) throw badRequest("You already have access to this course.");
    return { tenantId: course.tenantId, amountPaise: course.salePaise, label: course.name };
  }

  if (kind === "live_test") {
    const [test] = await db.select().from(liveTests).where(eq(liveTests.id, refId)).limit(1);
    if (!test) throw notFound("Live test not found.");
    if (test.pricePaise <= 0) throw badRequest("This live test is free — no payment needed.");
    if (await alreadyPaid(studentId, "live_test", refId)) throw badRequest("You already have access to this live test.");
    return { tenantId: test.tenantId, amountPaise: test.pricePaise, label: test.name };
  }

  // chatbot: refId is the tenantId itself (one purchase = current month's access for that tenant).
  const [config] = await db.select().from(chatbotConfigs).where(eq(chatbotConfigs.tenantId, refId)).limit(1);
  if (!config?.enabled) throw badRequest("Chatbot is not enabled for this coaching.");
  const amountPaise = config.priceRupeesPerMonth * 100;
  if (amountPaise <= 0) throw badRequest("Chatbot is free — no payment needed.");

  const periodMonth = new Date().toISOString().slice(0, 7);
  const [usage] = await db
    .select({ isPaid: chatbotUsage.isPaid })
    .from(chatbotUsage)
    .where(and(eq(chatbotUsage.studentProfileId, studentId), eq(chatbotUsage.periodMonth, periodMonth)))
    .limit(1);
  if (usage?.isPaid) throw badRequest("You already have chatbot access this month.");

  return { tenantId: refId, amountPaise, label: `AI Doubt Assistant (${periodMonth})` };
}

// POST /api/payments/create-order — looks up the real price server-side,
// creates a real Razorpay order, and records a Pending payment row carrying
// the order id. Returns what the frontend needs to open Razorpay's Checkout
// widget (never the key SECRET, only the key id + order id + amount).
router.post("/payments/create-order", authenticate, requireRole("student"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const kind = requireOneOf(body.kind, paymentKindEnum.enumValues, "kind");
  const refId = requireUuid(body.refId, "refId");

  const { tenantId, amountPaise, label } = await resolvePurchase(req.auth!.userId, kind, refId);
  if (req.auth!.tenantId !== tenantId) throw forbidden("You do not have access to this tenant.");

  const order = await createRazorpayOrder(amountPaise, { kind, refId, studentId: req.auth!.userId });

  const [row] = await db
    .insert(payments)
    .values({
      tenantId,
      studentProfileId: req.auth!.userId,
      kind,
      refId,
      label,
      totalPaise: amountPaise,
      platformSharePaise: 0,
      coachingSharePaise: 0,
      status: "Pending",
      provider: "razorpay",
      providerOrderId: order.id,
    })
    .returning();

  res.status(201).json({
    paymentId: row.id,
    orderId: order.id,
    amountPaise,
    currency: "INR",
    razorpayKeyId: order.keyId,
  });
});

// POST /api/payments/verify — the ONLY place a payment can become "Success".
// Independently recomputes the HMAC-SHA256 signature Razorpay's Checkout
// returns and compares it (constant-time) against what the client sent;
// only on a match does this flip status and compute the commission split.
// No separate "grant access" step is needed — see the file-top comment: a
// Success payments row for (studentProfileId, kind, refId) already IS the
// access grant that hasPurchasedAsync() (and the chatbot's own usage check
// above) reads.
router.post("/payments/verify", authenticate, requireRole("student"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const rzpOrderId = typeof body.orderId === "string" ? body.orderId : undefined;
  const rzpPaymentId = typeof body.paymentId === "string" ? body.paymentId : undefined;
  const rzpSignature = typeof body.signature === "string" ? body.signature : undefined;
  if (!rzpOrderId || !rzpPaymentId || !rzpSignature) {
    throw badRequest("orderId, paymentId and signature are required.");
  }

  const [payment] = await db.select().from(payments).where(eq(payments.providerOrderId, rzpOrderId)).limit(1);
  if (!payment) throw notFound("Payment record not found.");
  if (payment.studentProfileId !== req.auth!.userId) throw forbidden("This payment belongs to someone else.");
  if (payment.status === "Success") {
    res.json({ ok: true, alreadyProcessed: true });
    return;
  }

  const validSignature = verifyRazorpaySignature(rzpOrderId, rzpPaymentId, rzpSignature);
  if (!validSignature) {
    await db.update(payments).set({ status: "Failed" }).where(eq(payments.id, payment.id));
    throw badRequest("Signature verification failed — payment rejected.");
  }

  // BUSINESS RULE: a coaching's chronologically FIRST course is
  // commission-free — the coaching keeps 100% so a brand-new coaching can
  // try the platform risk-free on its very first offering. Every course
  // after that (2nd, 3rd, ...) pays the standard flat 50% split, unchanged.
  // This only ever applies to `kind: 'course'` payments — live_test and
  // chatbot payments always keep the plain 50/50 split below regardless of
  // which course they happen to be tied to.
  let platformSharePaise: number;
  let coachingSharePaise: number;
  let isFirstCourseFree = false;
  if (payment.kind === "course") {
    const [oldestCourse] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.tenantId, payment.tenantId))
      .orderBy(asc(courses.createdAt))
      .limit(1);
    isFirstCourseFree = !!oldestCourse && oldestCourse.id === payment.refId;
  }
  if (isFirstCourseFree) {
    platformSharePaise = 0;
    coachingSharePaise = payment.totalPaise;
  } else {
    platformSharePaise = Math.round(payment.totalPaise / 2);
    coachingSharePaise = payment.totalPaise - platformSharePaise;
  }

  const [updated] = await db
    .update(payments)
    .set({
      status: "Success",
      providerPaymentId: rzpPaymentId,
      platformSharePaise,
      coachingSharePaise,
    })
    .where(eq(payments.id, payment.id))
    .returning();

  if (payment.kind === "chatbot") {
    const periodMonth = new Date().toISOString().slice(0, 7);
    await db
      .insert(chatbotUsage)
      .values({ studentProfileId: payment.studentProfileId, tenantId: payment.tenantId, periodMonth, isPaid: true })
      .onConflictDoUpdate({
        target: [chatbotUsage.studentProfileId, chatbotUsage.periodMonth],
        set: { isPaid: true },
      });
  }

  const [student] = await db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, payment.studentProfileId)).limit(1);
  const rupees = (payment.totalPaise / 100).toFixed(2);
  await db.insert(notifications).values({
    role: "coaching",
    tenantId: payment.tenantId,
    subjectProfileId: payment.studentProfileId,
    kind: "payment_received",
    title: "New payment received",
    body: `${student?.name ?? "A student"} paid ₹${rupees} for ${payment.label}.`,
  });
  if (platformSharePaise + coachingSharePaise !== payment.totalPaise) {
    await db.insert(notifications).values({
      role: "platform",
      tenantId: null,
      subjectProfileId: null,
      kind: "payment_split_issue",
      title: "Payment split mismatch",
      body: `Payment ${payment.id}: platformSharePaise (${platformSharePaise}) + coachingSharePaise (${coachingSharePaise}) != totalPaise (${payment.totalPaise}).`,
    });
  }

  res.json({ ok: true, payment: updated });
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
