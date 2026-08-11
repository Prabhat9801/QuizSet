import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { difficultyEnum } from "./enums";
import { questionBanks } from "./question-banks";

// A single MCQ inside a question bank. `subject` is the broadest grouping
// (e.g. "Chemistry", "Physics", "Maths") for banks that mix more than one —
// the Practice Setup screen's Subject dropdown filters units/topics down to
// one subject before the student picks further. `unit` is the next syllabus
// section within that subject (e.g. "Chemical Kinetics"); `topic` is the
// specific concept within it (e.g. "Half-Life Period") — this hierarchy is
// what Topic-wise / Unit-wise practice modes group by. `subject` defaults to
// "General" for single-subject banks (e.g. the ITI Electronics bank), where
// a subject picker would be redundant.
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionBankId: uuid("question_bank_id")
      .notNull()
      .references(() => questionBanks.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    options: jsonb("options").notNull().$type<string[]>(),
    answer: integer("answer").notNull(),
    explanation: text("explanation").notNull(),
    subject: text("subject").notNull().default("General"),
    unit: text("unit").notNull(),
    topic: text("topic").notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("Medium"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("questions_question_bank_id_idx").on(table.questionBankId),
    index("questions_subject_idx").on(table.subject),
    index("questions_unit_idx").on(table.unit),
    index("questions_topic_idx").on(table.topic),
  ],
);
