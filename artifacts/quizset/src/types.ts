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

export type ExamType = 'Practice Quiz' | 'Mock Test' | 'Live Test' | 'Previous Year' | 'Topic-wise';

export type Exam = {
  id: string;
  tenantId: string;
  questionBankId: string;
  name: string;
  description?: string;
  type: ExamType;
  duration: number; // minutes
  mrp: number;
  sale: number;
  preview: number; // free preview question count
  status: 'Published' | 'Draft' | 'Upcoming' | 'Archived';
  students: number;
  subject: string;
  // Which students can see this exam. Empty array = every student in the
  // tenant (the default, matching LiveTest.participantIds' convention) —
  // a coaching only needs to fill this in when it wants to restrict an exam
  // to specific students rather than its whole roster.
  assignedStudentIds: string[];
};

export type Student = {
  id: string;
  name: string;
  email: string;
  phone: string;
  tenantId: string;
  status: 'Active' | 'Pending' | 'Suspended';
  exams: number;
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

// A question bank is what a question-bank request eventually produces. An
// exam always draws its question set from exactly one bank.
//
// Status is a content-review pipeline, not just a build-progress tracker:
//   Generating       -> only the platform owner can see it (being written)
//   Platform Review  -> platform owner is checking it; still invisible to
//                       the coaching that asked for it
//   Coaching Review  -> now visible to the coaching owner, who can view AND
//                       edit every question — but an exam using this bank
//                       still cannot be published; students see nothing yet
//   Finalized        -> the coaching owner explicitly approved it; an exam
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
// exam." Mirrors the syllabus_requests concept from the real backend — this
// is the frontend-only stand-in for that same workflow.
export type QuestionBankRequest = {
  id: string;
  tenantId: string;
  examId: string; // the real, already-created exam this bank is for
  examName: string; // denormalized at request time, so lists don't need an extra lookup
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
  examId: string; // question source
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

// One finished quiz/exam/live-test run, saved so history/review/leaderboard
// have a real record to read from instead of recomputing from nothing.
export type Attempt = {
  id: string;
  studentId: string;
  tenantId: string;
  examId: string;
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

export type PaymentKind = 'exam' | 'live_test' | 'chatbot';

// A single simulated Razorpay-style transaction. Both Payments pages
// (platform + coaching) and the revenue stat tiles read from this list
// instead of hardcoded strings.
export type Transaction = {
  id: string;
  tenantId: string;
  studentId: string;
  kind: PaymentKind;
  refId: string; // examId or liveTestId
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
