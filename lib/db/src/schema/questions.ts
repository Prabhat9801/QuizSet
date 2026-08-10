import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { difficultyEnum } from "./enums";
import { questionBanks } from "./question-banks";

// A single MCQ inside a question bank. `unit` is the broad syllabus section
// (e.g. "Quantitative Aptitude"); `topic` is the specific concept within it
// (e.g. "Percentage") — this two-level hierarchy is what Topic-wise /
// Unit-wise practice modes group by.
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
    unit: text("unit").notNull(),
    topic: text("topic").notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("Medium"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("questions_question_bank_id_idx").on(table.questionBankId),
    index("questions_unit_idx").on(table.unit),
    index("questions_topic_idx").on(table.topic),
  ],
);
