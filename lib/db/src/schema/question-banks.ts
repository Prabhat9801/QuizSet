import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { questionBankStatusEnum } from "./enums";
import { questionBankRequests } from "./question-bank-requests";
import { tenants } from "./tenants";

// What a question_bank_request eventually produces; a course always draws
// its questions from exactly one bank.
//
// `status` is a content-review pipeline, not just a build-progress tracker:
//   Generating       -> platform-owner-only working stage, being written
//   Platform Review  -> platform owner checking it; still invisible to the
//                       coaching that asked for it
//   Coaching Review  -> now visible to AND editable by the coaching owner;
//                       a course using this bank still cannot publish
//   Finalized        -> coaching owner approved it; a course using this
//                       bank may now be published
//
// `requestId` is nullable (a bank can in principle be created ad hoc,
// without a request) and forms a cycle with question_bank_requests and
// courses — see the note on courses.questionBankId in courses.ts.
export const questionBanks = pgTable(
  "question_banks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    status: questionBankStatusEnum("status").notNull().default("Generating"),
    requestId: uuid("request_id").references(
      (): AnyPgColumn => questionBankRequests.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("question_banks_tenant_id_idx").on(table.tenantId),
    index("question_banks_request_id_idx").on(table.requestId),
  ],
);
