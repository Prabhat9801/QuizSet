import { pgEnum } from "drizzle-orm/pg-core";

// A user's role. `platform` spans every tenant; `coaching` and `student` are
// each scoped to exactly one tenant via profiles.tenant_id.
export const roleEnum = pgEnum("role", ["platform", "coaching", "student"]);

// Only meaningful for student profiles today (Active/Suspended toggle,
// Pending while a join request awaits approval) but lives on the shared
// profiles table rather than a student-only side table.
export const profileStatusEnum = pgEnum("profile_status", [
  "Active",
  "Pending",
  "Suspended",
]);

export const courseStatusEnum = pgEnum("course_status", [
  "Draft",
  "Published",
  "Upcoming",
  "Archived",
]);

// A content-review pipeline, not just a build-progress tracker — see the
// long comment on question_banks.status in questions.ts / question-banks.ts.
export const questionBankStatusEnum = pgEnum("question_bank_status", [
  "Generating",
  "Platform Review",
  "Coaching Review",
  "Finalized",
]);

export const requestPriorityEnum = pgEnum("request_priority", [
  "Low",
  "Medium",
  "High",
]);

// Deliberately coarser than question_bank_status — see comment on
// question_bank_requests in question-bank-requests.ts.
export const requestStatusEnum = pgEnum("request_status", [
  "Pending",
  "In Progress",
  "Finalized",
]);

export const difficultyEnum = pgEnum("difficulty", ["Easy", "Medium", "Hard"]);

export const liveTestStatusEnum = pgEnum("live_test_status", [
  "Draft",
  "Published",
  "Cancelled",
]);

export const attemptModeEnum = pgEnum("attempt_mode", ["practice", "timed"]);

export const paymentKindEnum = pgEnum("payment_kind", [
  "course",
  "live_test",
  "chatbot",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "Success",
  "Pending",
  "Failed",
]);

export const chatbotProviderEnum = pgEnum("chatbot_provider", [
  "OpenAI",
  "Gemini",
  "Claude",
]);

export const joinRequestStatusEnum = pgEnum("join_request_status", [
  "Pending",
  "Approved",
  "Rejected",
]);

export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "user",
  "assistant",
]);
