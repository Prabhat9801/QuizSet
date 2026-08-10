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
  | { mode: "custom"; topics: string[]; units: string[] };

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
    // Snapshot of the exact questions attempted, in order — so a later
    // review/PDF export reflects what was actually asked even if the bank
    // changes afterwards.
    questionIds: jsonb("question_ids").notNull().$type<string[]>(),
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
