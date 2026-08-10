import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { courses } from "./courses";
import { tenants } from "./tenants";

// A coaching-authored schedule for finishing a course's syllabus. One plan
// per course — `courseId` is unique, so "set a new plan" is an upsert
// (replace, not accumulate), matching the one-per-course pattern
// `chatbot_configs` uses for tenants (tenantId as its own PK there; here we
// keep a surrogate `id` since study_plan_items needs a real FK target that
// isn't the course id itself, but `courseId` stays unique to enforce the
// "at most one" invariant at the DB level too).
//
// `mode: 'manual'` — the coaching picks a target date per unit directly;
// `startDate`/`endDate` are meaningless and left null.
// `mode: 'auto'` — the coaching picks only `startDate`/`endDate`; the API
// computes one evenly-spaced `targetDate` per unit server-side (see
// artifacts/api-server/src/routes/study-plans.ts) and stores the result as
// ordinary study_plan_items rows, same as manual mode. This keeps every
// reader (student view, status computation) mode-agnostic — it only ever
// looks at study_plan_items, never re-derives auto dates on the fly.
export const studyPlanModeEnum = pgEnum("study_plan_mode", ["manual", "auto"]);

export const studyPlans = pgTable(
  "study_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .unique()
      .references(() => courses.id, { onDelete: "cascade" }),
    mode: studyPlanModeEnum("mode").notNull().default("manual"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("study_plans_tenant_id_idx").on(table.tenantId)],
);

// One row per unit in the plan, each with its own target completion date.
// Replace-all semantics from the API: every save deletes all rows for a
// studyPlanId and reinserts the current set, matching the
// course-assignments/live-test-participants pattern elsewhere in this repo.
export const studyPlanItems = pgTable(
  "study_plan_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyPlanId: uuid("study_plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    unit: text("unit").notNull(),
    targetDate: date("target_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("study_plan_items_study_plan_id_idx").on(table.studyPlanId)],
);
