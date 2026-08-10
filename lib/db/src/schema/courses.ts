import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { courseStatusEnum } from "./enums";
import { questionBanks } from "./question-banks";
import { tenants } from "./tenants";

// A coaching's exam-prep offering, e.g. "SSC CGL 2026 preparation". Every
// course gets the exact same untimed, self-paced practice system — there is
// deliberately no "type"/"duration" column here. A coaching that wants a
// scheduled, time-boxed sitting creates a separate LiveTest linked to the
// course; that's a distinct feature, not a course mode.
//
// `questionBankId` is nullable because a course can be created before its
// question bank exists (the coaching files a question_bank_request against
// it). `questionBankId` <-> `question_banks.requestId` <->
// `question_bank_requests.courseId`/`questionBankId` form a 3-table cycle by
// design — see the AnyPgColumn-typed deferred references in question-banks.ts
// and question-bank-requests.ts.
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    questionBankId: uuid("question_bank_id").references(
      (): AnyPgColumn => questionBanks.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    description: text("description"),
    mrpPaise: integer("mrp_paise").notNull(),
    salePaise: integer("sale_paise").notNull(),
    previewCount: integer("preview_count").notNull().default(0),
    status: courseStatusEnum("status").notNull().default("Draft"),
    subject: text("subject").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("courses_tenant_id_idx").on(table.tenantId),
    index("courses_question_bank_id_idx").on(table.questionBankId),
  ],
);
