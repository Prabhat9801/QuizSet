import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { liveTests } from "./live-tests";
import { profiles } from "./profiles";

// Which students were invited to a live test. Same convention as
// course_assignments: zero rows means open to every student in the tenant.
export const liveTestParticipants = pgTable(
  "live_test_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    liveTestId: uuid("live_test_id")
      .notNull()
      .references(() => liveTests.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("live_test_participants_test_student_idx").on(
      table.liveTestId,
      table.studentProfileId,
    ),
    index("live_test_participants_student_profile_id_idx").on(
      table.studentProfileId,
    ),
  ],
);
