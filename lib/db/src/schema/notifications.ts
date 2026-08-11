import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { roleEnum } from "./enums";
import { tenants } from "./tenants";

// What kind of event produced this notification — lets the frontend group/
// icon them without parsing free text, and lets a future "settings: mute
// this category" feature exist without a schema change.
export const notificationKindEnum = pgEnum("notification_kind", [
  "payment_received", // a student paid for a course/live-test/chatbot
  "student_joined", // a new student joined a coaching
  "live_test_ended", // a scheduled live test's window closed, results are ready
  "student_inactive", // a student hasn't attempted anything in N days
  "student_weak_performance", // a student's recent average dropped below threshold
  "self_inactive", // sent to the student themself: you've been inactive
  "self_weak_performance", // sent to the student themself: your recent scores are low
  "coaching_signed_up", // platform-owner-facing: a brand new tenant registered
  "coaching_new_course", // platform-owner-facing: a tenant created its 2nd+ course (commission now applies)
  "payment_split_issue", // platform-owner-facing: a payment's platform/coaching share didn't add up
]);

// One notification. `tenantId` is null for a platform-owner notification
// (those aren't scoped to any single coaching); `profileId` is null when the
// notification targets a whole role/tenant rather than one specific person
// (e.g. "student X is inactive" goes to the coaching, not to a single
// specific coaching-owner profile row, since a tenant's coaching role can
// have more than one login).
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: roleEnum("role").notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    // Set when this notification is about a specific student/user, so the
    // UI can deep-link ("View Aarav's report") without re-deriving it from
    // the body text.
    subjectProfileId: uuid("subject_profile_id"),
    kind: notificationKindEnum("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_role_idx").on(table.role),
    index("notifications_tenant_id_idx").on(table.tenantId),
    index("notifications_read_idx").on(table.read),
  ],
);
