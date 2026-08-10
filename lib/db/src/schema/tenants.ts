import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// A coaching institute — the tenant boundary. Every profile/course/exam/etc.
// belonging to a coaching hangs off this row's id. The `platform` role spans
// all tenants and has no row of its own here.
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    city: text("city").notNull(),
    category: text("category").notNull(),
    plan: text("plan").notNull(),
    // Brand colors used to theme the coaching's own UI. `displayName`/`logoUrl`
    // are separate, optional branding overrides — plain fields, no fallback
    // logic lives at the schema layer.
    primaryColor: text("primary_color").notNull(),
    secondaryColor: text("secondary_color").notNull(),
    displayName: text("display_name"),
    logoUrl: text("logo_url"),
    joinCode: text("join_code").notNull().unique(),
    owner: text("owner").notNull(),
    supportEmail: text("support_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "tenants_primary_color_hex",
      sql`${table.primaryColor} ~* '^#[0-9a-f]{6}$'`,
    ),
    check(
      "tenants_secondary_color_hex",
      sql`${table.secondaryColor} ~* '^#[0-9a-f]{6}$'`,
    ),
  ],
);
