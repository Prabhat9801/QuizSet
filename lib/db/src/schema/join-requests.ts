import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { joinRequestStatusEnum } from "./enums";
import { tenants } from "./tenants";

// The "search a coaching, request to join" flow. Deliberately has no FK to
// profiles — the requester doesn't have one yet (that's the whole point of
// this table; the join-code flow enrolls instantly and never creates a row
// here).
export const joinRequests = pgTable(
  "join_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentName: text("student_name").notNull(),
    studentEmail: text("student_email").notNull(),
    status: joinRequestStatusEnum("status").notNull().default("Pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("join_requests_tenant_id_idx").on(table.tenantId)],
);
