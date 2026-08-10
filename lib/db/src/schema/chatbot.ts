import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { chatMessageRoleEnum, chatbotProviderEnum } from "./enums";
import { profiles } from "./profiles";
import { tenants } from "./tenants";

// One config per tenant — tenantId IS the primary key, there's no separate
// surrogate id since a coaching only ever has one chatbot setup.
export const chatbotConfigs = pgTable("chatbot_configs", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  provider: chatbotProviderEnum("provider").notNull().default("OpenAI"),
  priceRupeesPerMonth: integer("price_rupees_per_month").notNull().default(0),
  freeMessageLimit: integer("free_message_limit").notNull().default(0),
  monthlyMessageCap: integer("monthly_message_cap").notNull().default(0),
  systemPrompt: text("system_prompt").notNull().default(""),
});

// Per-student, per-calendar-month message count + paid flag. `periodMonth`
// is stored as 'YYYY-MM' text (matches the "chatbot access is per calendar
// month and simply lapses" model) rather than a date, since it's never used
// for range math, only equality lookups for "this month's row".
export const chatbotUsage = pgTable(
  "chatbot_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    periodMonth: text("period_month").notNull(),
    messageCount: integer("message_count").notNull().default(0),
    isPaid: boolean("is_paid").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chatbot_usage_student_profile_id_idx").on(table.studentProfileId),
    index("chatbot_usage_tenant_id_idx").on(table.tenantId),
  ],
);

// The message log backing chatbot history.
export const chatbotMessages = pgTable(
  "chatbot_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: chatMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chatbot_messages_student_profile_id_idx").on(
      table.studentProfileId,
    ),
    index("chatbot_messages_tenant_id_idx").on(table.tenantId),
  ],
);
