import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { paymentKindEnum, paymentStatusEnum } from "./enums";
import { profiles } from "./profiles";
import { tenants } from "./tenants";

// A single transaction. The platform takes a flat 50% commission on every
// course/live-test payment (chatbot payments are the coaching's own — see
// chatbot_configs); both shares are computed and stored at write time as
// actual paise amounts, not just a percentage, so the ledger stays correct
// even if the commission rate changes later.
//
// `refId` is deliberately NOT a foreign key: it points at whichever row this
// payment is for (a course id or a live_test id, per `kind`), and a single
// column can't carry an FK to two different tables. Resolving it to the
// right table is an app-layer concern.
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: paymentKindEnum("kind").notNull(),
    refId: uuid("ref_id").notNull(),
    label: text("label").notNull(),
    totalPaise: integer("total_paise").notNull(),
    platformSharePaise: integer("platform_share_paise").notNull(),
    coachingSharePaise: integer("coaching_share_paise").notNull(),
    status: paymentStatusEnum("status").notNull().default("Pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("payments_tenant_id_idx").on(table.tenantId),
    index("payments_student_profile_id_idx").on(table.studentProfileId),
    index("payments_ref_id_idx").on(table.refId),
  ],
);
