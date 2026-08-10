import { relations } from "drizzle-orm";
import { attempts } from "./attempts";
import { certificates } from "./certificates";
import { chatbotConfigs, chatbotMessages, chatbotUsage } from "./chatbot";
import { courseAssignments } from "./course-assignments";
import { courses } from "./courses";
import { joinRequests } from "./join-requests";
import { liveTestParticipants } from "./live-test-participants";
import { liveTests } from "./live-tests";
import { payments } from "./payments";
import { profiles } from "./profiles";
import { questionBankRequests } from "./question-bank-requests";
import { questionBanks } from "./question-banks";
import { questions } from "./questions";
import { studyPlanItems, studyPlans } from "./study-plans";
import { tenants } from "./tenants";
import { testimonials } from "./testimonials";

// Most FK pairs below only ever have one edge between the two tables, so no
// `relationName` is needed. A few tables have more than one FK column
// pointing at the same target table — those edges are named explicitly on
// both sides so Drizzle's query builder (`db.query.x.findMany({ with })`)
// knows which edge is which:
//   - question_banks.request_id <-> question_bank_requests.question_bank_id
//     (a bank points back at the request that produced it, AND a request
//     points at the bank it produced — two independent columns, see the
//     comments in question-banks.ts / question-bank-requests.ts)
//   - profiles <-> certificates (student vs. issuer)
//   - profiles <-> testimonials (student vs. coaching-approver vs.
//     platform-approver)

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  profiles: many(profiles),
  courses: many(courses),
  questionBanks: many(questionBanks),
  questionBankRequests: many(questionBankRequests),
  liveTests: many(liveTests),
  attempts: many(attempts),
  payments: many(payments),
  joinRequests: many(joinRequests),
  certificates: many(certificates),
  testimonials: many(testimonials),
  chatbotConfig: one(chatbotConfigs),
  chatbotUsage: many(chatbotUsage),
  chatbotMessages: many(chatbotMessages),
  studyPlans: many(studyPlans),
}));

export const profilesRelations = relations(profiles, ({ many, one }) => ({
  tenant: one(tenants, { fields: [profiles.tenantId], references: [tenants.id] }),
  courseAssignments: many(courseAssignments),
  liveTestParticipants: many(liveTestParticipants),
  attempts: many(attempts),
  payments: many(payments),
  chatbotUsage: many(chatbotUsage),
  chatbotMessages: many(chatbotMessages),
  certificatesReceived: many(certificates, { relationName: "certificate_student" }),
  certificatesIssued: many(certificates, { relationName: "certificate_issuer" }),
  testimonials: many(testimonials, { relationName: "testimonial_student" }),
  testimonialsCoachingApproved: many(testimonials, {
    relationName: "testimonial_coaching_approver",
  }),
  testimonialsPlatformApproved: many(testimonials, {
    relationName: "testimonial_platform_approver",
  }),
}));

export const coursesRelations = relations(courses, ({ many, one }) => ({
  tenant: one(tenants, { fields: [courses.tenantId], references: [tenants.id] }),
  questionBank: one(questionBanks, {
    fields: [courses.questionBankId],
    references: [questionBanks.id],
  }),
  assignments: many(courseAssignments),
  liveTests: many(liveTests),
  attempts: many(attempts),
  questionBankRequests: many(questionBankRequests),
  certificates: many(certificates),
  testimonials: many(testimonials),
  studyPlan: one(studyPlans),
}));

export const courseAssignmentsRelations = relations(courseAssignments, ({ one }) => ({
  course: one(courses, { fields: [courseAssignments.courseId], references: [courses.id] }),
  student: one(profiles, {
    fields: [courseAssignments.studentProfileId],
    references: [profiles.id],
  }),
}));

export const questionBanksRelations = relations(questionBanks, ({ many, one }) => ({
  tenant: one(tenants, { fields: [questionBanks.tenantId], references: [tenants.id] }),
  request: one(questionBankRequests, {
    fields: [questionBanks.requestId],
    references: [questionBankRequests.id],
    relationName: "bank_request_origin",
  }),
  requestsThatProducedThisBank: many(questionBankRequests, {
    relationName: "request_produced_bank",
  }),
  questions: many(questions),
  courses: many(courses),
}));

export const questionBankRequestsRelations = relations(
  questionBankRequests,
  ({ many, one }) => ({
    tenant: one(tenants, {
      fields: [questionBankRequests.tenantId],
      references: [tenants.id],
    }),
    course: one(courses, {
      fields: [questionBankRequests.courseId],
      references: [courses.id],
    }),
    producedBank: one(questionBanks, {
      fields: [questionBankRequests.questionBankId],
      references: [questionBanks.id],
      relationName: "request_produced_bank",
    }),
    banksOriginatedFromThisRequest: many(questionBanks, {
      relationName: "bank_request_origin",
    }),
  }),
);

export const questionsRelations = relations(questions, ({ one }) => ({
  questionBank: one(questionBanks, {
    fields: [questions.questionBankId],
    references: [questionBanks.id],
  }),
}));

export const liveTestsRelations = relations(liveTests, ({ many, one }) => ({
  tenant: one(tenants, { fields: [liveTests.tenantId], references: [tenants.id] }),
  course: one(courses, { fields: [liveTests.courseId], references: [courses.id] }),
  participants: many(liveTestParticipants),
  attempts: many(attempts),
}));

export const liveTestParticipantsRelations = relations(liveTestParticipants, ({ one }) => ({
  liveTest: one(liveTests, {
    fields: [liveTestParticipants.liveTestId],
    references: [liveTests.id],
  }),
  student: one(profiles, {
    fields: [liveTestParticipants.studentProfileId],
    references: [profiles.id],
  }),
}));

export const attemptsRelations = relations(attempts, ({ one }) => ({
  student: one(profiles, {
    fields: [attempts.studentProfileId],
    references: [profiles.id],
  }),
  tenant: one(tenants, { fields: [attempts.tenantId], references: [tenants.id] }),
  course: one(courses, { fields: [attempts.courseId], references: [courses.id] }),
  liveTest: one(liveTests, { fields: [attempts.liveTestId], references: [liveTests.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, { fields: [payments.tenantId], references: [tenants.id] }),
  student: one(profiles, {
    fields: [payments.studentProfileId],
    references: [profiles.id],
  }),
}));

export const chatbotConfigsRelations = relations(chatbotConfigs, ({ one }) => ({
  tenant: one(tenants, { fields: [chatbotConfigs.tenantId], references: [tenants.id] }),
}));

export const chatbotUsageRelations = relations(chatbotUsage, ({ one }) => ({
  student: one(profiles, {
    fields: [chatbotUsage.studentProfileId],
    references: [profiles.id],
  }),
  tenant: one(tenants, { fields: [chatbotUsage.tenantId], references: [tenants.id] }),
}));

export const chatbotMessagesRelations = relations(chatbotMessages, ({ one }) => ({
  student: one(profiles, {
    fields: [chatbotMessages.studentProfileId],
    references: [profiles.id],
  }),
  tenant: one(tenants, { fields: [chatbotMessages.tenantId], references: [tenants.id] }),
}));

export const joinRequestsRelations = relations(joinRequests, ({ one }) => ({
  tenant: one(tenants, { fields: [joinRequests.tenantId], references: [tenants.id] }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  student: one(profiles, {
    fields: [certificates.studentProfileId],
    references: [profiles.id],
    relationName: "certificate_student",
  }),
  issuedBy: one(profiles, {
    fields: [certificates.issuedByProfileId],
    references: [profiles.id],
    relationName: "certificate_issuer",
  }),
  course: one(courses, { fields: [certificates.courseId], references: [courses.id] }),
  tenant: one(tenants, { fields: [certificates.tenantId], references: [tenants.id] }),
}));

export const testimonialsRelations = relations(testimonials, ({ one }) => ({
  student: one(profiles, {
    fields: [testimonials.studentProfileId],
    references: [profiles.id],
    relationName: "testimonial_student",
  }),
  coachingApprovedBy: one(profiles, {
    fields: [testimonials.coachingApprovedByProfileId],
    references: [profiles.id],
    relationName: "testimonial_coaching_approver",
  }),
  platformApprovedBy: one(profiles, {
    fields: [testimonials.platformApprovedByProfileId],
    references: [profiles.id],
    relationName: "testimonial_platform_approver",
  }),
  course: one(courses, { fields: [testimonials.courseId], references: [courses.id] }),
  tenant: one(tenants, { fields: [testimonials.tenantId], references: [tenants.id] }),
}));

export const studyPlansRelations = relations(studyPlans, ({ many, one }) => ({
  tenant: one(tenants, { fields: [studyPlans.tenantId], references: [tenants.id] }),
  course: one(courses, { fields: [studyPlans.courseId], references: [courses.id] }),
  items: many(studyPlanItems),
}));

export const studyPlanItemsRelations = relations(studyPlanItems, ({ one }) => ({
  studyPlan: one(studyPlans, {
    fields: [studyPlanItems.studyPlanId],
    references: [studyPlans.id],
  }),
}));
