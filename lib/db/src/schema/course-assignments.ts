import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { courses } from "./courses";
import { profiles } from "./profiles";

// Which specific students can see a course. If a course has ZERO rows here,
// it's visible to the whole tenant — that convention is enforced at the
// app layer, not by this table (an empty join table is indistinguishable
// from "not restricted" on purpose).
export const courseAssignments = pgTable(
  "course_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("course_assignments_course_student_idx").on(
      table.courseId,
      table.studentProfileId,
    ),
    index("course_assignments_student_profile_id_idx").on(
      table.studentProfileId,
    ),
  ],
);
