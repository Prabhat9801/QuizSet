import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profileStatusEnum, roleEnum } from "./enums";
import { tenants } from "./tenants";

// One row per user. `id` is the Supabase auth.users.id — there is no
// separate auth table in this schema, profiles IS the app-facing user record.
// `tenantId` is null for platform-role profiles (they span every tenant);
// coaching/student profiles always have exactly one.
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, {
      onDelete: "cascade",
    }),
    role: roleEnum("role").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    // Optional — filled in via the student's own Profile/Settings screen,
    // not at signup. Meaningful for every role in principle, but only
    // students have a settings screen that asks for it today.
    phone: text("phone"),
    // Meaningful mostly for students (Pending while a join request is
    // outstanding, Suspended to revoke access without deleting history).
    // Coaching/platform profiles are just always Active.
    status: profileStatusEnum("status").notNull().default("Active"),
    // Enforces "at most one active session per account" — a real business
    // risk this platform previously had no answer to: a student can hand
    // their join code + login to friends/family, letting many real people
    // share one paid "seat" while the coaching owner's per-student counts
    // silently undercount actual usage. Set by POST /api/auth/claim-session
    // right after every login (overwriting whatever the previous device
    // held); `authenticate` middleware checks it on every subsequent
    // request when the client sends one, rejecting a stale token with 401
    // SESSION_SUPERSEDED. Null until the first login after this column was
    // added, or for a profile that's never actually logged in through the
    // real (non-mock) auth path yet.
    activeSessionToken: uuid("active_session_token"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("profiles_tenant_id_idx").on(table.tenantId)],
);
