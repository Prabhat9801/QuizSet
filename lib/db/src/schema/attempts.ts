import { index, integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { attemptModeEnum } from "./enums";
import { courses } from "./courses";
import { liveTests } from "./live-tests";
import { profiles } from "./profiles";
import { tenants } from "./tenants";

// What a student picked on the Quiz Setup screen before a practice attempt.
// Recorded so no-repeat tracking can ask "which questions has this student
// already seen in exactly this mode+scope" — each mode+scope combination
// gets its own independent history.
export type PracticeScope =
  | { mode: "full" }
  | { mode: "topic"; topics: string[] }
  | { mode: "unit"; units: string[] }
  | { mode: "multi-unit"; units: string[] }
  | { mode: "custom"; topics: string[]; units: string[] }
  // A fixed, pre-baked 100-question worksheet ("Practice Sets") — the exact
  // question list is computed client-side (deterministic seeded shuffle),
  // never picked via the no-repeat endpoint below, so this variant only
  // needs to round-trip through storage/history, not drive scope filtering.
  | { mode: "set"; setNumber: number };

// Full question content as it existed at the moment of the attempt — text,
// options, the correct answer index, explanation, and its subject/unit/topic
// classification. Snapshotted onto the attempt (see `questionsSnapshot`
// below) so a later review/PDF export/report always reflects exactly what
// the student actually saw, even if the source question is edited or
// deleted from the bank afterwards. Without this, reconstructing a review
// by re-fetching the CURRENT bank state (the only option before this field
// existed) could silently show wrong content or drop a question entirely.
export type QuestionSnapshot = {
  id: string;
  text: string;
  options: string[];
  answer: number;
  explanation: string;
  subject: string;
  unit: string;
  topic: string;
};

// One finished quiz/live-test run. `liveTestId` is only set for a timed,
// live-test attempt; `practiceScope` is only set for mode: 'practice'.
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    liveTestId: uuid("live_test_id").references(() => liveTests.id, {
      onDelete: "set null",
    }),
    mode: attemptModeEnum("mode").notNull(),
    practiceScope: jsonb("practice_scope").$type<PracticeScope>(),
    // Map of question-index (position within this attempt) to chosen
    // option-index.
    answers: jsonb("answers").notNull().$type<Record<number, number>>(),
    // Snapshot of the exact question IDs attempted, in order — kept
    // alongside `questionsSnapshot` below (not replaced by it) since some
    // existing code paths (no-repeat tracking) only need the ID list, not
    // the full content.
    questionIds: jsonb("question_ids").notNull().$type<string[]>(),
    // Full question content at attempt time — nullable because attempts
    // created before this column existed have no snapshot; those fall back
    // to re-fetching from the live bank (the old, edit/delete-fragile path)
    // exactly as they always did. Every new attempt populates this. Array
    // elements are themselves nullable: a `null` slot means the question id
    // at that same position in `questionIds` no longer existed in the bank
    // at save time — the hole preserves index alignment with `answers`
    // rather than shifting every later position out of sync.
    questionsSnapshot: jsonb("questions_snapshot").$type<(QuestionSnapshot | null)[]>(),
    score: integer("score").notNull(),
    totalAttempted: integer("total_attempted").notNull(),
    timeTakenSeconds: integer("time_taken_seconds").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("attempts_student_profile_id_idx").on(table.studentProfileId),
    index("attempts_tenant_id_idx").on(table.tenantId),
    index("attempts_course_id_idx").on(table.courseId),
    index("attempts_live_test_id_idx").on(table.liveTestId),
  ],
);
