// Domain schema for QuizSet, the multi-tenant B2B2C coaching platform.
// Each table lives in its own file; this barrel re-exports everything so
// `import { db } from "@workspace/db"` (see ../index.ts) gets the full
// `schema` object drizzle needs for the relational query API, and consumers
// can `import { courses } from "@workspace/db/schema"` directly.
//
// File layout:
//   enums.ts                   - all pgEnum definitions, shared across tables
//   tenants.ts                 - coachings (the tenant boundary)
//   profiles.ts                - users (platform/coaching/student), 1 per auth user
//   courses.ts                 - a coaching's exam-prep offering
//   course-assignments.ts      - which students can see a restricted course
//   question-banks.ts          - a reviewed set of questions backing a course
//   question-bank-requests.ts - a coaching's ask for a new/extended bank
//   questions.ts               - individual MCQs inside a bank
//   live-tests.ts               - a scheduled, timed sitting drawing on a course
//   live-test-participants.ts  - which students are invited to a live test
//   attempts.ts                 - one finished practice/live-test run
//   payments.ts                 - a transaction (course/live-test/chatbot)
//   chatbot.ts                  - per-tenant config + per-student usage/messages
//   join-requests.ts            - "search a coaching, ask to join" flow
//   certificates.ts             - manually issued, branding-snapshotted certs
//   testimonials.ts             - student feedback pending dual approval
//   study-plans.ts               - per-course schedule (manual/auto) for finishing the syllabus
//   notifications.ts             - auto-triggered alerts (payments, inactivity, weak performance, etc.)
//   relations.ts                - drizzle relations() for the query API
//
// `courses.ts` / `question-banks.ts` / `question-bank-requests.ts` import
// each other (a genuine 3-table cycle by design — see the comments in
// courses.ts) and use the `AnyPgColumn`-typed deferred-callback form of
// `.references()` on the edges that close the cycle so it type-checks.

export * from "./enums";
export * from "./tenants";
export * from "./profiles";
export * from "./courses";
export * from "./course-assignments";
export * from "./question-banks";
export * from "./question-bank-requests";
export * from "./questions";
export * from "./live-tests";
export * from "./live-test-participants";
export * from "./attempts";
export * from "./payments";
export * from "./chatbot";
export * from "./join-requests";
export * from "./certificates";
export * from "./testimonials";
export * from "./study-plans";
export * from "./notifications";
export * from "./relations";
