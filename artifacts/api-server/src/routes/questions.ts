import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { courses, difficultyEnum, liveTests, questionBanks, questions } from "@workspace/db/schema";
import { authenticate } from "../middlewares/auth";
import { canAccessTenant, requireRole } from "../middlewares/authorize";
import { badRequest, forbidden, notFound } from "../lib/http-error";
import { optionalOneOf, optionalString, requireInt, requireString, requireStringArray, requireUuid } from "../lib/validate";

const router: IRouter = Router();

// NOTE: `authenticate` is applied per-route, not via `router.use(authenticate)`
// — see the comment in tenants.ts for why a blanket, path-less `.use()` here
// would leak into every other flat-mounted resource router.

async function loadBank(questionBankId: string) {
  const [bank] = await db.select().from(questionBanks).where(eq(questionBanks.id, questionBankId)).limit(1);
  if (!bank) throw notFound("Question bank not found.");
  return bank;
}

// GET /api/questions?questionBankId=
router.get("/questions", authenticate, async (req, res) => {
  const questionBankId = req.query.questionBankId;
  if (typeof questionBankId !== "string") throw badRequest("questionBankId query parameter is required.");
  requireUuid(questionBankId, "questionBankId");
  const bank = await loadBank(questionBankId);
  if (!canAccessTenant(req.auth!, bank.tenantId)) throw forbidden("You do not have access to this question bank.");
  if (req.auth!.role === "coaching" && bank.status !== "Coaching Review" && bank.status !== "Finalized") {
    throw forbidden("This question bank is not visible to your coaching yet.");
  }
  res.json(await db.select().from(questions).where(eq(questions.questionBankId, questionBankId)));
});

// GET /api/questions/syllabus-tree?courseId= — subject -> unit -> distinct
// topics, for the practice-mode-setup screen's mode pickers. `subject` lets
// a mixed bank (e.g. Chemistry+Physics+Maths) offer a subject filter before
// narrowing to a unit; single-subject banks just get one subject group.
router.get("/questions/syllabus-tree", authenticate, async (req, res) => {
  const courseId = req.query.courseId;
  if (typeof courseId !== "string") throw badRequest("courseId query parameter is required.");
  requireUuid(courseId, "courseId");

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) throw notFound("Course not found.");
  if (!canAccessTenant(req.auth!, course.tenantId)) throw forbidden("You do not have access to this course.");
  if (!course.questionBankId) return res.json([]);

  const rows = await db
    .select({ subject: questions.subject, unit: questions.unit, topic: questions.topic })
    .from(questions)
    .where(eq(questions.questionBankId, course.questionBankId));

  // Keyed by unit alone (not subject+unit) since a unit belongs to exactly
  // one subject in this data — if two different subjects' source files ever
  // reused the same unit name, the last-seen subject would silently win,
  // but that hasn't happened in the two real banks this seeds from.
  const byUnit = new Map<string, { subject: string; topics: Set<string> }>();
  for (const row of rows) {
    if (!byUnit.has(row.unit)) byUnit.set(row.unit, { subject: row.subject, topics: new Set() });
    byUnit.get(row.unit)!.topics.add(row.topic);
  }
  return res.json(
    Array.from(byUnit.entries()).map(([unit, { subject, topics }]) => ({ subject, unit, topics: Array.from(topics) })),
  );
});

// GET /api/questions/by-ids?liveTestId=&ids=<comma-separated uuids> — fetches
// exactly the given question ids, for a live test's own pre-picked
// `questionIds` list (see pickLiveTestQuestions() in live-tests.ts) instead
// of the whole course bank. `liveTestId` is required (rather than accepting
// a bare id list) so access is checked against the live test's tenant the
// same way every other live-test-scoped read is, instead of trusting the
// caller's ids blindly.
router.get("/questions/by-ids", authenticate, async (req, res) => {
  const liveTestId = req.query.liveTestId;
  if (typeof liveTestId !== "string") throw badRequest("liveTestId query parameter is required.");
  requireUuid(liveTestId, "liveTestId");
  const [test] = await db.select().from(liveTests).where(eq(liveTests.id, liveTestId)).limit(1);
  if (!test) throw notFound("Live test not found.");
  if (!canAccessTenant(req.auth!, test.tenantId)) throw forbidden("You do not have access to this live test.");

  const ids = test.questionIds ?? [];
  if (ids.length === 0) return res.json([]);
  const rows = await db.select().from(questions).where(inArray(questions.id, ids));
  // Preserve the live test's own stored order (its own shuffle at creation
  // time), not whatever order the DB happens to return rows in.
  const byId = new Map(rows.map((q) => [q.id, q]));
  return res.json(ids.map((id) => byId.get(id)).filter((q): q is typeof rows[number] => q !== undefined));
});

// POST /api/questions — platform/coaching authoring. A question bank in
// Finalized state is intentionally still editable here (mirrors mock.ts,
// which has no stage guard on questionService.create/update/remove) — the
// publish-guard lives on courses, not on question edits.
router.post("/questions", authenticate, requireRole("platform", "coaching"), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const questionBankId = requireUuid(body.questionBankId, "questionBankId");
  const bank = await loadBank(questionBankId);
  if (!canAccessTenant(req.auth!, bank.tenantId)) throw forbidden("You do not have access to this question bank.");

  const options = requireStringArray(body.options, "options");
  const answer = requireInt(body.answer, "answer");
  if (answer < 0 || answer >= options.length) throw badRequest("answer must be a valid index into options.");

  const [row] = await db
    .insert(questions)
    .values({
      questionBankId,
      text: requireString(body.text, "text"),
      options,
      answer,
      explanation: optionalString(body.explanation, "explanation") ?? "",
      unit: optionalString(body.unit, "unit") ?? "General",
      topic: optionalString(body.topic, "topic") ?? "General",
      difficulty: optionalOneOf(body.difficulty, difficultyEnum.enumValues, "difficulty") ?? "Medium",
    })
    .returning();
  res.status(201).json(row);
});

async function loadQuestionWithBank(id: string) {
  const [row] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!row) throw notFound("Question not found.");
  const [bank] = await db.select().from(questionBanks).where(eq(questionBanks.id, row.questionBankId)).limit(1);
  return { row, bank };
}

// PATCH /api/questions/:id
router.patch("/questions/:id", authenticate, requireRole("platform", "coaching"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const { row: current, bank } = await loadQuestionWithBank(id);
  if (bank && !canAccessTenant(req.auth!, bank.tenantId)) throw forbidden("You do not have access to this question.");

  const body = req.body as Record<string, unknown>;
  const patch: Partial<typeof questions.$inferInsert> = {};
  if (body.text !== undefined) patch.text = requireString(body.text, "text");
  if (body.options !== undefined) patch.options = requireStringArray(body.options, "options");
  if (body.explanation !== undefined) patch.explanation = requireString(body.explanation, "explanation");
  if (body.unit !== undefined) patch.unit = requireString(body.unit, "unit");
  if (body.topic !== undefined) patch.topic = requireString(body.topic, "topic");
  if (body.difficulty !== undefined) patch.difficulty = optionalOneOf(body.difficulty, difficultyEnum.enumValues, "difficulty")!;
  if (body.answer !== undefined) {
    const answer = requireInt(body.answer, "answer");
    const options = patch.options ?? current.options;
    if (answer < 0 || answer >= options.length) throw badRequest("answer must be a valid index into options.");
    patch.answer = answer;
  }

  const [row] = await db.update(questions).set(patch).where(eq(questions.id, id)).returning();
  res.json(row);
});

// DELETE /api/questions/:id
router.delete("/questions/:id", authenticate, requireRole("platform", "coaching"), async (req, res) => {
  const id = requireUuid(req.params.id, "id");
  const { bank } = await loadQuestionWithBank(id);
  if (bank && !canAccessTenant(req.auth!, bank.tenantId)) throw forbidden("You do not have access to this question.");
  await db.delete(questions).where(eq(questions.id, id));
  res.status(204).end();
});

export default router;
