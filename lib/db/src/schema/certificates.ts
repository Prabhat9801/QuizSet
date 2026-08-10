import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { courses } from "./courses";
import { profiles } from "./profiles";
import { tenants } from "./tenants";

// Issuance is always a manual action by the coaching owner, never automatic
// (hence `issuedByProfileId` is required, not derived from anything). The
// coaching's branding is snapshotted AT ISSUE TIME so a certificate stays
// visually correct even if the coaching rebrands afterwards — these three
// snapshot columns are intentionally denormalized copies of tenants.*, not
// a join. The "Powered by QuizSet" mark shown alongside a certificate is a
// UI-layer constant, not a DB column.
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    issuedByProfileId: uuid("issued_by_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "set null" }),
    certificateCode: text("certificate_code").notNull().unique(),
    coachingNameSnapshot: text("coaching_name_snapshot").notNull(),
    coachingLogoUrlSnapshot: text("coaching_logo_url_snapshot"),
    coachingThemeColorSnapshot: text("coaching_theme_color_snapshot"),
    note: text("note"),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("certificates_student_profile_id_idx").on(table.studentProfileId),
    index("certificates_course_id_idx").on(table.courseId),
    index("certificates_tenant_id_idx").on(table.tenantId),
  ],
);
