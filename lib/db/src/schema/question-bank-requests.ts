import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { requestPriorityEnum, requestStatusEnum } from "./enums";
import { courses } from "./courses";
import { questionBanks } from "./question-banks";
import { tenants } from "./tenants";

// A coaching's ask to the platform owner: "build me a question bank for this
// course." Always FOR an already-existing course, hence `courseId` is
// required (not nullable). `status` is deliberately coarser than
// question_banks.status — it only tracks Pending / In Progress / Finalized
// for the request itself; the bank's own status carries the fine-grained
// review stage, so duplicating that 4-way state here would just be a second
// source of truth to keep in sync.
//
// `questionBankId` is set once a bank is created against this request, and
// forms a cycle with question_banks.requestId and courses.questionBankId —
// see the note in courses.ts. All three cross-file references in that cycle
// use the AnyPgColumn-typed deferred callback form so the circular imports
// between courses.ts / question-banks.ts / question-bank-requests.ts
// type-check.
export const questionBankRequests = pgTable(
  "question_bank_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => courses.id, { onDelete: "cascade" }),
    // Denormalized snapshot of the course's name at request time, so list
    // views don't need an extra join/lookup.
    courseName: text("course_name").notNull(),
    subjects: jsonb("subjects").notNull().$type<string[]>(),
    questionsRequired: integer("questions_required").notNull(),
    difficulty: text("difficulty").notNull(),
    priority: requestPriorityEnum("priority").notNull().default("Medium"),
    notes: text("notes"),
    // Filled in by the coaching only if it already knows its own syllabus
    // breakdown; when empty, the platform owner derives units/topics from
    // the uploaded syllabus file instead.
    unitsTopics: text("units_topics"),
    syllabusFileName: text("syllabus_file_name"),
    status: requestStatusEnum("status").notNull().default("Pending"),
    questionBankId: uuid("question_bank_id").references(
      (): AnyPgColumn => questionBanks.id,
      { onDelete: "set null" },
    ),
    // Platform owner's note back to the coaching (e.g. clarifying questions,
    // progress update) — distinct from the coaching's own `notes` above.
    ownerNote: text("owner_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("question_bank_requests_tenant_id_idx").on(table.tenantId),
    index("question_bank_requests_course_id_idx").on(table.courseId),
    index("question_bank_requests_question_bank_id_idx").on(
      table.questionBankId,
    ),
  ],
);
