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
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
};

// A question bank is what a syllabus request eventually produces. An exam
// always draws its question set from exactly one bank.
export type QuestionBank = {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  status: 'Pending' | 'In Progress' | 'Ready';
  requestId?: string; // the syllabus request that produced it, if any
};

export type RequestStatus =
  | 'Pending'
  | 'Under Review'
  | 'Question Bank Being Created'
  | 'Question Bank Ready'
  | 'Published';

// A coaching's ask to the platform owner: "build me a question bank for this
// syllabus." Mirrors the syllabus_requests concept from the real backend —
// this is the frontend-only stand-in for that same workflow.
export type QuestionBankRequest = {
  id: string;
  tenantId: string;
  examName: string;
  subjects: string[];
  questionsRequired: number;
  difficulty: string;
  priority: 'Low' | 'Medium' | 'High';
  notes?: string;
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

// One finished quiz/exam/live-test run, saved so history/review/leaderboard
// have a real record to read from instead of recomputing from nothing.
export type Attempt = {
  id: string;
  studentId: string;
  tenantId: string;
  examId: string;
  liveTestId?: string;
  mode: 'practice' | 'timed';
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
