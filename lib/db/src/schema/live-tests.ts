import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { liveTestStatusEnum } from "./enums";
import { courses } from "./courses";
import { tenants } from "./tenants";

// What a coaching picked as the question source for a live test — mirrors
// PracticeScope's shape (see attempts.ts) but deliberately its own type:
// live tests don't have 'topic'/'multi-unit'/'set' modes, and add a
// subject layer + optional manual weights that practice scope has no
// concept of. `mode: "full"` = the entire course's question bank, no
// no-repeat tracking (a full-syllabus test may legitimately reuse any
// question — see the no-repeat comment on questionIds below).
// `mode: "scoped"` = subjects/units/topics are OR-matched against each
// question (same OR semantics as PracticeScope's 'custom' mode) to build
// the candidate pool, and no-repeat tracking against past SCOPED live
// tests on the same course applies.
export type LiveTestScope =
  | { mode: "full" }
  | {
      mode: "scoped";
      subjects: string[];
      units: string[];
      topics: string[];
      // Explicit question COUNT (not percentage/weight) for a unit or topic
      // name. Absent = equal-split across every distinct unit/topic in scope.
      // Present for only some of them = those get their exact count; the
      // remainder of questionCount splits equally across the rest.
      weights?: Record<string, number>;
    };

// A scheduled, time-boxed test drawing its questions from a course. `status`
// is only the coaching's own publish control (Draft/Published/Cancelled) —
// the user-facing phase (Upcoming/Live/Ended) is always derived from
// scheduledStart/scheduledEnd at read time, never stored, so it can't go
// stale relative to the clock.
export const liveTests = pgTable(
  "live_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    scheduledStart: timestamp("scheduled_start", {
      withTimezone: true,
    }).notNull(),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    pricePaise: integer("price_paise").notNull(),
    status: liveTestStatusEnum("status").notNull().default("Draft"),
    // Nullable: existing rows created before this feature have no scope —
    // treated as `{ mode: "full" }` at read time by the app, not backfilled
    // here, since a null scope + null questionIds already reproduces the old
    // "whole course bank" behavior via the fallback in the picking logic /
    // StudentLiveTests.tsx.
    scope: jsonb("scope").$type<LiveTestScope>(),
    // How many total questions this test should have. Nullable for the same
    // pre-existing-row reason as `scope`.
    questionCount: integer("question_count"),
    // The actual, pre-picked question id list for this test — computed ONCE
    // at creation time by pickLiveTestQuestions() and stored here so every
    // student in this live test sees the exact same fixed set, and so the
    // no-repeat history for FUTURE scoped tests on this course has something
    // concrete to read (see attempts.questionIds joined through
    // liveTestId). Null for a `mode: "full"` test or for rows created before
    // this feature — both cases mean "read the whole course bank instead",
    // handled at the call site (StudentLiveTests.tsx), not here.
    questionIds: jsonb("question_ids").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("live_tests_tenant_id_idx").on(table.tenantId),
    index("live_tests_course_id_idx").on(table.courseId),
  ],
);
