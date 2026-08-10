import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { courses } from "./courses";
import { profiles } from "./profiles";
import { tenants } from "./tenants";

// A student's written feedback, optionally course-specific. Only shown
// publicly (on the coaching's own page AND QuizSet's landing page) once
// BOTH coachingApproved AND platformApproved are true. That combined rule
// is deliberately an app-layer read filter (`WHERE coaching_approved AND
// platform_approved`) rather than a generated column — Drizzle pg-core's
// generated-column support is limited/version-sensitive, and a plain
// boolean pair is simpler to reason about and to selectively revoke one
// side of approval without touching the other.
export const testimonials = pgTable(
  "testimonials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    outcome: text("outcome"),
    coachingApproved: boolean("coaching_approved").notNull().default(false),
    coachingApprovedAt: timestamp("coaching_approved_at", {
      withTimezone: true,
    }),
    coachingApprovedByProfileId: uuid(
      "coaching_approved_by_profile_id",
    ).references(() => profiles.id, { onDelete: "set null" }),
    platformApproved: boolean("platform_approved").notNull().default(false),
    platformApprovedAt: timestamp("platform_approved_at", {
      withTimezone: true,
    }),
    platformApprovedByProfileId: uuid(
      "platform_approved_by_profile_id",
    ).references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("testimonials_student_profile_id_idx").on(table.studentProfileId),
    index("testimonials_tenant_id_idx").on(table.tenantId),
    index("testimonials_course_id_idx").on(table.courseId),
  ],
);
