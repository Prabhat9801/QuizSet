export type Role = 'platform' | 'coaching' | 'student';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId?: string;
};

export type Tenant = {
  id: string;
  name: string;
  initials: string;
  city: string;
  category: string;
  students: number;
  plan: string;
  primaryColor: string;
  secondaryColor: string;
  joinCode: string;
  owner: string;
  supportEmail: string;
};

// A coaching's exam-preparation offering — e.g. "SSC CGL 2026 preparation".
// Not a single sitting and not typed as one mode: every course gets the
// SAME complete practice system (Topic-wise/Unit-wise/Multi-unit/Custom/Full,
// via QuizSetup), always untimed and personal to each student. A course has
// no timer of its own — a coaching that wants a timed, scheduled, one-shot
// experience creates a LiveTest linked to the course instead; that's a
// deliberately separate feature, not a course "type".
export type Course = {
  id: string;
  tenantId: string;
  questionBankId: string;
  name: string;
  description?: string;
  mrp: number;
  sale: number;
  preview: number; // free preview question count
  status: 'Published' | 'Draft' | 'Upcoming' | 'Archived';
  students: number;
  subject: string;
  // Which students can see this course. Empty array = every student in the
  // tenant (the default, matching LiveTest.participantIds' convention) —
  // a coaching only needs to fill this in when it wants to restrict a course
  // to specific, approved students rather than its whole roster.
  assignedStudentIds: string[];
};

export type Student = {
  id: string;
  name: string;
  email: string;
  phone: string;
  tenantId: string;
  status: 'Active' | 'Pending' | 'Suspended';
  courses: number;
  score: number;
  joined: string;
};

export type Question = {
  id: string;
  questionBankId: string;
  text: string;
  options: string[];
  answer: number;
  explanation: string;
  // Unit is the broad syllabus section (e.g. "Quantitative Aptitude");
  // topic is the specific concept within it (e.g. "Percentage"). This
  // two-level hierarchy is what Topic-wise / Unit-wise practice modes group
  // by — without it those modes would have nothing real to filter on.
  unit: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
};

// A question bank is what a question-bank request eventually produces. A
// course always draws its question set from exactly one bank.
//
// Status is a content-review pipeline, not just a build-progress tracker:
//   Generating       -> only the platform owner can see it (being written)
//   Platform Review  -> platform owner is checking it; still invisible to
//                       the coaching that asked for it
//   Coaching Review  -> now visible to the coaching owner, who can view AND
//                       edit every question — but a course using this bank
//                       still cannot be published; students see nothing yet
//   Finalized        -> the coaching owner explicitly approved it; a course
//                       using this bank may now be published
export type QuestionBankStatus = 'Generating' | 'Platform Review' | 'Coaching Review' | 'Finalized';

export type QuestionBank = {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  status: QuestionBankStatus;
  requestId?: string; // the request that produced it, if any
};

// Coarse — just "is there a bank yet, and is it done". The bank's own
// `QuestionBankStatus` carries the fine-grained review stage; duplicating
// that same 4-way state here would just be two sources of truth to keep in
// sync, so this only tracks what a request needs to track for itself.
export type RequestStatus = 'Pending' | 'In Progress' | 'Finalized';

// A coaching's ask to the platform owner: "build me a question bank for this
// course." Mirrors the syllabus_requests concept from the real backend — this
// is the frontend-only stand-in for that same workflow.
export type QuestionBankRequest = {
  id: string;
  tenantId: string;
  courseId: string; // the real, already-created course this bank is for
  courseName: string; // denormalized at request time, so lists don't need an extra lookup
  subjects: string[];
  questionsRequired: number;
  difficulty: string;
  priority: 'Low' | 'Medium' | 'High';
  notes?: string;
  // Filled in by the coaching only if it already knows its own syllabus
  // breakdown; when empty, the platform owner derives units/topics from the
  // uploaded syllabus file instead — see services/mock.ts's advance() docs.
  unitsTopics?: string;
  syllabusFileName?: string;
  status: RequestStatus;
  questionBankId?: string; // set once a bank is created against this request
  createdAt: string;
  ownerNote?: string;
};

export type JoinRequestStatus = 'Pending' | 'Approved' | 'Rejected';

// Produced by the "search coaching, request to join" flow. The join-code flow
// bypasses this entirely (it enrolls immediately).
export type JoinRequest = {
  id: string;
  tenantId: string;
  studentName: string;
  studentEmail: string;
  status: JoinRequestStatus;
  createdAt: string;
};

// `status` is the coaching's own publish control. The user-facing phase
// (Upcoming / Live / Ended) is always derived from the time window at read
// time via `liveTestPhase()` in services/mock.ts — never stored — so it can
// never go stale relative to the clock.
export type LiveTest = {
  id: string;
  tenantId: string;
  courseId: string; // question source
  name: string;
  scheduledStart: string; // ISO
  scheduledEnd: string; // ISO
  durationMinutes: number;
  price: number;
  status: 'Draft' | 'Published' | 'Cancelled';
  participantIds: string[]; // student ids invited; empty = open to all tenant students
};

export type LiveTestPhase = 'Draft' | 'Upcoming' | 'Live' | 'Ended' | 'Cancelled';

// What a student picked on the Quiz Setup screen before starting a practice
// attempt. Recorded on the Attempt so no-repeat tracking can ask "which
// questions has this student already seen in exactly this mode+scope" —
// each mode+scope combination gets its own independent history, matching
// the original quiz-ITI behaviour (a Topic-wise run on "Percentage" doesn't
// affect what a Custom run sees, and vice versa).
export type PracticeScope =
  | { mode: 'full' }
  | { mode: 'topic'; topics: string[] }
  | { mode: 'unit'; units: string[] }
  | { mode: 'multi-unit'; units: string[] }
  | { mode: 'custom'; topics: string[]; units: string[] };

// One finished quiz/course/live-test run, saved so history/review/leaderboard
// have a real record to read from instead of recomputing from nothing.
export type Attempt = {
  id: string;
  studentId: string;
  tenantId: string;
  courseId: string;
  liveTestId?: string;
  mode: 'practice' | 'timed';
  practiceScope?: PracticeScope; // only set for mode: 'practice'
  answers: Record<number, number>; // question index -> chosen option index
  questionIds: string[]; // snapshot of the exact questions attempted, in order
  score: number; // correct count
  totalAttempted: number;
  timeTakenSeconds: number;
  createdAt: string;
};

export type ChatbotConfig = {
  tenantId: string;
  enabled: boolean;
  provider: 'OpenAI' | 'Gemini' | 'Claude';
  priceRupeesPerMonth: number;
  freeMessageLimit: number;
  monthlyMessageCap: number;
  systemPrompt: string;
};

export type PaymentKind = 'course' | 'live_test' | 'chatbot';

// A single simulated Razorpay-style transaction. Both Payments pages
// (platform + coaching) and the revenue stat tiles read from this list
// instead of hardcoded strings.
export type Transaction = {
  id: string;
  tenantId: string;
  studentId: string;
  kind: PaymentKind;
  refId: string; // courseId or liveTestId
  label: string;
  amount: number;
  status: 'Success' | 'Pending' | 'Failed';
  createdAt: string;
};

export type Notification = {
  id: string;
  role: Role;
  tenantId?: string; // undefined = platform-wide
  title: string;
  body: string;
  time: string;
  read: boolean;
};

export type Toast = { id: number; title: string; description?: string; tone?: 'success' | 'danger' | 'info' };

// One unit's target completion date inside a course's study plan.
export type StudyPlanItem = {
  id: string;
  studyPlanId: string;
  unit: string;
  targetDate: string; // ISO date (yyyy-mm-dd)
};

// A coaching's schedule for finishing one course's syllabus — one plan per
// course. `mode: 'manual'` means the coaching set each item's targetDate
// directly; `mode: 'auto'` means the API evenly distributed every unit across
// [startDate, endDate] and stored the result as ordinary items, so readers
// never need to re-derive anything — they just read `items`.
export type StudyPlan = {
  id: string;
  tenantId: string;
  courseId: string;
  mode: 'manual' | 'auto';
  startDate?: string;
  endDate?: string;
  items: StudyPlanItem[];
};

// Derived, never stored — always computed from `targetDate` vs. today at
// read time so it can't go stale. "Due now" covers today through 2 days
// past target; beyond that (with no activity signal available) it's
// "Overdue". A target date still in the future is "Upcoming".
export type StudyPlanItemStatus = 'Upcoming' | 'Due now' | 'Overdue';

// Manually issued by a coaching owner — never automatic on some completion
// threshold. Branding is snapshotted at issue time (name/logo/color) so a
// later rebrand never retroactively changes a certificate already handed
// out, and every certificate also carries a static "Powered by QuizSet"
// mark (rendered by the certificate view, not stored here). studentName and
// courseName are denormalized at issue time too, matching the same pattern
// QuestionBankRequest.courseName already uses in this file.
export type Certificate = {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  tenantId: string;
  certificateCode: string; // short, unique — what the public /certificate/:code route reads by
  coachingNameSnapshot: string;
  coachingLogoUrlSnapshot?: string;
  coachingThemeColorSnapshot: string;
  note?: string;
  issuedAt: string;
};

// A student's story about their coaching/course. Only becomes public (shown
// on the coaching's own context AND, conceptually, QuizSet's own landing
// page) once BOTH gates are true — two separate, sequential approvals, not
// one combined flag.
export type Testimonial = {
  id: string;
  studentId: string;
  studentName: string;
  tenantId: string;
  courseId?: string;
  courseName?: string;
  content: string;
  outcome?: string;
  coachingApproved: boolean;
  coachingApprovedAt?: string;
  platformApproved: boolean;
  platformApprovedAt?: string;
  createdAt: string;
};
