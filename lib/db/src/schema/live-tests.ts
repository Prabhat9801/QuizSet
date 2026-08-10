import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { liveTestStatusEnum } from "./enums";
import { courses } from "./courses";
import { tenants } from "./tenants";

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("live_tests_tenant_id_idx").on(table.tenantId),
    index("live_tests_course_id_idx").on(table.courseId),
  ],
);
