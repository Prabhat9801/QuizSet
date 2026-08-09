import {
  AuthUser,
  Attempt,
  ChatbotConfig,
  Exam,
  JoinRequest,
  LiveTest,
  LiveTestPhase,
  Notification,
  Question,
  QuestionBank,
  QuestionBankRequest,
  Role,
  Student,
  Tenant,
  Transaction,
} from '@/types';
import { storage } from './storage';
import {
  chatbotConfigs,
  exams,
  joinRequests,
  liveTests,
  questionBankRequests,
  questionBanks,
  questions,
  students,
  tenants,
  users,
} from '@/data/seed';

const wait = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

// Every list/write goes through storage.get/.set with the seed array as the
// fallback, so a fresh browser sees the seed data and a returning one sees
// whatever it already persisted. This is the one place that pattern lives —
// individual services should not reimplement it.
function readList<T>(key: string, seed: T[]): T[] {
  return storage.get<T[]>(key, seed);
}
function writeList<T>(key: string, items: T[]): T[] {
  storage.set(key, items);
  return items;
}

// ------------------------------------------------------------------ auth
const demoPasswords: Record<string, string> = {
  'admin@quizset.demo': 'admin123',
  'owner@sunrise.demo': 'owner123',
  'rahul@student.demo': 'student123',
};

export const authService = {
  async login(email: string, password: string) {
    await wait(180);
    const all = readList('users', users);
    const match = all.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const knownPassword = demoPasswords[match?.email ?? ''] ?? storage.get<string | null>(`pw:${match?.id}`, null);
    if (!match || knownPassword !== password) throw new Error('Check your email and password.');
    storage.set('auth', match);
    return match;
  },
  /** Creates a brand-new student with no tenant yet — the entry point for the join-coaching demo flow. */
  async registerStudent(name: string, email: string, password: string) {
    await wait(200);
    const all = readList('users', users);
    if (all.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    const user: AuthUser = { id: `u-${Date.now()}`, name, email, role: 'student' };
    writeList('users', [...all, user]);
    storage.set(`pw:${user.id}`, password);
    storage.set('auth', user);
    return user;
  },
  logout() {
    storage.remove('auth');
  },
  current() {
    return storage.get<AuthUser | null>('auth', null);
  },
  /** Re-reads the persisted user record (e.g. after tenantId changes post-join). */
  async refresh(userId: string) {
    await wait(80);
    const all = readList('users', users);
    const fresh = all.find((u) => u.id === userId) ?? null;
    if (fresh) storage.set('auth', fresh);
    return fresh;
  },
};

// ---------------------------------------------------------------- tenants
export const tenantService = {
  async list(): Promise<Tenant[]> {
    await wait();
    return readList('tenants', tenants);
  },
  async get(id: string): Promise<Tenant | undefined> {
    await wait(80);
    return readList('tenants', tenants).find((t) => t.id === id);
  },
  async findByJoinCode(code: string): Promise<Tenant | undefined> {
    await wait(150);
    return readList('tenants', tenants).find((t) => t.joinCode.toLowerCase() === code.trim().toLowerCase());
  },
  async search(query: string): Promise<Tenant[]> {
    await wait(150);
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return readList('tenants', tenants).filter((t) => t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q));
  },
  async create(data: Partial<Tenant>): Promise<Tenant> {
    await wait();
    const all = readList('tenants', tenants);
    const item: Tenant = {
      id: `tenant-${Date.now()}`,
      name: data.name || 'New Coaching',
      initials: (data.name || 'NC').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase(),
      city: data.city || 'India',
      category: data.category || 'Competitive Exam Coaching',
      students: 0,
      plan: data.plan || 'Starter',
      primaryColor: data.primaryColor || '#4f46e5',
      secondaryColor: data.secondaryColor || '#06b6d4',
      joinCode: `${(data.name || 'COACHING').replace(/\s/g, '').slice(0, 7).toUpperCase()}2026`,
      owner: data.owner || 'Owner',
      supportEmail: data.supportEmail || 'support@example.in',
    };
    writeList('tenants', [...all, item]);
    return item;
  },
  async update(id: string, data: Partial<Tenant>): Promise<Tenant> {
    await wait();
    const all = readList('tenants', tenants).map((t) => (t.id === id ? { ...t, ...data } : t));
    writeList('tenants', all);
    return all.find((t) => t.id === id)!;
  },
};

// ------------------------------------------------------------ join requests
export const joinRequestService = {
  /** Join-code path: enrolls immediately, no pending row. Returns the updated user. */
  async joinByCode(userId: string, code: string): Promise<{ user: AuthUser; tenant: Tenant }> {
    await wait(200);
    const tenant = await tenantService.findByJoinCode(code);
    if (!tenant) throw new Error('No coaching found with that join code.');
    const allUsers = readList('users', users);
    const updatedUsers = allUsers.map((u) => (u.id === userId ? { ...u, tenantId: tenant.id } : u));
    writeList('users', updatedUsers);
    const allStudents = readList('students', students);
    const user = updatedUsers.find((u) => u.id === userId)!;
    if (!allStudents.some((s) => s.id === userId)) {
      const record: Student = { id: userId, name: user.name, email: user.email, phone: '', tenantId: tenant.id, status: 'Active', exams: 0, score: 0, joined: 'Today' };
      writeList('students', [...allStudents, record]);
    }
    storage.set('auth', user);
    return { user, tenant };
  },
  /** Search-and-request path: creates a Pending row; the coaching approves it later. */
  async requestToJoin(studentName: string, studentEmail: string, tenantId: string): Promise<JoinRequest> {
    await wait(200);
    const all = readList('joinRequests', joinRequests);
    const item: JoinRequest = { id: `jr-${Date.now()}`, tenantId, studentName, studentEmail, status: 'Pending', createdAt: 'Just now' };
    writeList('joinRequests', [...all, item]);
    return item;
  },
  async listForTenant(tenantId: string): Promise<JoinRequest[]> {
    await wait();
    return readList('joinRequests', joinRequests).filter((r) => r.tenantId === tenantId);
  },
  async decide(id: string, approve: boolean): Promise<JoinRequest> {
    await wait();
    const all = readList('joinRequests', joinRequests);
    const target = all.find((r) => r.id === id);
    if (!target) throw new Error('Request not found.');
    const updated = all.map((r) => (r.id === id ? { ...r, status: (approve ? 'Approved' : 'Rejected') as JoinRequest['status'] } : r));
    writeList('joinRequests', updated);
    if (approve) {
      const allStudents = readList('students', students);
      const record: Student = { id: `student-${Date.now()}`, name: target.studentName, email: target.studentEmail, phone: '', tenantId: target.tenantId, status: 'Active', exams: 0, score: 0, joined: 'Today' };
      writeList('students', [...allStudents, record]);
    }
    return updated.find((r) => r.id === id)!;
  },
};

// -------------------------------------------------------------------- exams
/** The count a student/coaching actually sees — always the real linked bank size, never a hand-typed lie. */
function realQuestionCount(exam: Exam, allQuestions: Question[]): number {
  return allQuestions.filter((q) => q.questionBankId === exam.questionBankId).length;
}

export type ExamWithCount = Exam & { questionCount: number };

export const examService = {
  async list(tenantId?: string): Promise<Exam[]> {
    await wait();
    return readList('exams', exams).filter((e) => !tenantId || e.tenantId === tenantId);
  },
  /** Same as list(), but with each exam's real question count attached — what pages should render. */
  async listWithCounts(tenantId?: string): Promise<ExamWithCount[]> {
    const [all, qs] = await Promise.all([this.list(tenantId), Promise.resolve(readList('questions', questions))]);
    return all.map((e) => ({ ...e, questionCount: realQuestionCount(e, qs) }));
  },
  async get(id: string): Promise<Exam | undefined> {
    await wait();
    return readList('exams', exams).find((e) => e.id === id);
  },
  async getWithCount(id: string): Promise<ExamWithCount | undefined> {
    const exam = await this.get(id);
    if (!exam) return undefined;
    return { ...exam, questionCount: realQuestionCount(exam, readList('questions', questions)) };
  },
  async create(data: Partial<Exam> & { tenantId: string; questionBankId: string }): Promise<Exam> {
    await wait();
    const all = readList('exams', exams);
    const item: Exam = {
      id: `exam-${Date.now()}`,
      tenantId: data.tenantId,
      questionBankId: data.questionBankId,
      name: data.name || 'New Assessment',
      description: data.description,
      type: data.type || 'Mock Test',
      duration: data.duration ?? 30,
      mrp: data.mrp ?? 0,
      sale: data.sale ?? 0,
      preview: data.preview ?? 5,
      status: data.status || 'Draft',
      students: 0,
      subject: data.subject || 'General',
    };
    writeList('exams', [...all, item]);
    return item;
  },
  async update(id: string, data: Partial<Exam>): Promise<Exam> {
    await wait();
    const all = readList('exams', exams).map((e) => (e.id === id ? { ...e, ...data } : e));
    writeList('exams', all);
    return all.find((e) => e.id === id)!;
  },
  /** The real question count for one exam — used everywhere a page needs to display or slice by it. */
  async questionCount(examId: string): Promise<number> {
    const exam = await this.get(examId);
    if (!exam) return 0;
    return realQuestionCount(exam, readList('questions', questions));
  },
};

// ------------------------------------------------------------------ question banks
export const questionBankService = {
  async list(tenantId?: string): Promise<QuestionBank[]> {
    await wait();
    return readList('questionBanks', questionBanks).filter((b) => !tenantId || b.tenantId === tenantId);
  },
  async get(id: string): Promise<QuestionBank | undefined> {
    await wait(80);
    return readList('questionBanks', questionBanks).find((b) => b.id === id);
  },
  async create(data: Partial<QuestionBank> & { tenantId: string }): Promise<QuestionBank> {
    await wait();
    const all = readList('questionBanks', questionBanks);
    const item: QuestionBank = {
      id: `qb-${Date.now()}`,
      tenantId: data.tenantId,
      name: data.name || 'New question bank',
      subject: data.subject || 'General',
      status: data.status || 'Pending',
      requestId: data.requestId,
    };
    writeList('questionBanks', [...all, item]);
    return item;
  },
  async update(id: string, data: Partial<QuestionBank>): Promise<QuestionBank> {
    await wait();
    const all = readList('questionBanks', questionBanks).map((b) => (b.id === id ? { ...b, ...data } : b));
    writeList('questionBanks', all);
    return all.find((b) => b.id === id)!;
  },
};

// --------------------------------------------------------------- question-bank requests
export const questionBankRequestService = {
  async list(tenantId?: string): Promise<QuestionBankRequest[]> {
    await wait();
    return readList('questionBankRequests', questionBankRequests).filter((r) => !tenantId || r.tenantId === tenantId);
  },
  async create(data: Partial<QuestionBankRequest> & { tenantId: string; examName: string }): Promise<QuestionBankRequest> {
    await wait();
    const all = readList('questionBankRequests', questionBankRequests);
    const item: QuestionBankRequest = {
      id: `req-${Date.now()}`,
      tenantId: data.tenantId,
      examName: data.examName,
      subjects: data.subjects || [],
      questionsRequired: data.questionsRequired ?? 50,
      difficulty: data.difficulty || 'Easy + Medium',
      priority: data.priority || 'Medium',
      notes: data.notes,
      syllabusFileName: data.syllabusFileName,
      status: 'Pending',
      createdAt: 'Just now',
    };
    writeList('questionBankRequests', [...all, item]);
    return item;
  },
  /** Advances a request one stage, creating/updating the linked question bank as needed. */
  async advance(id: string): Promise<QuestionBankRequest> {
    await wait();
    const all = readList('questionBankRequests', questionBankRequests);
    const target = all.find((r) => r.id === id);
    if (!target) throw new Error('Request not found.');

    const stages: QuestionBankRequest['status'][] = ['Pending', 'Under Review', 'Question Bank Being Created', 'Question Bank Ready', 'Published'];
    const nextIndex = Math.min(stages.indexOf(target.status) + 1, stages.length - 1);
    const nextStatus = stages[nextIndex];

    let questionBankId = target.questionBankId;
    if (nextStatus === 'Question Bank Being Created' && !questionBankId) {
      const bank = await questionBankService.create({ tenantId: target.tenantId, name: target.examName, subject: target.subjects.join(', '), status: 'In Progress', requestId: target.id });
      questionBankId = bank.id;
    }
    if (nextStatus === 'Question Bank Ready' && questionBankId) {
      await questionBankService.update(questionBankId, { status: 'Ready' });
    }

    const updated = all.map((r) => (r.id === id ? { ...r, status: nextStatus, questionBankId } : r));
    writeList('questionBankRequests', updated);
    return updated.find((r) => r.id === id)!;
  },
  async reject(id: string, ownerNote?: string): Promise<QuestionBankRequest> {
    await wait();
    const all = readList('questionBankRequests', questionBankRequests).map((r) => (r.id === id ? { ...r, status: 'Pending' as const, ownerNote: ownerNote || 'Rejected — please resubmit with more detail.' } : r));
    writeList('questionBankRequests', all);
    return all.find((r) => r.id === id)!;
  },
};

// ---------------------------------------------------------------- questions
export const questionService = {
  async listByBank(questionBankId: string): Promise<Question[]> {
    await wait();
    return readList('questions', questions).filter((q) => q.questionBankId === questionBankId);
  },
  async listByExam(examId: string): Promise<Question[]> {
    const exam = await examService.get(examId);
    if (!exam) return [];
    return this.listByBank(exam.questionBankId);
  },
  async create(data: Partial<Question> & { questionBankId: string; text: string; options: string[]; answer: number }): Promise<Question> {
    await wait();
    const all = readList('questions', questions);
    const item: Question = {
      id: `q-${Date.now()}`,
      questionBankId: data.questionBankId,
      text: data.text,
      options: data.options,
      answer: data.answer,
      explanation: data.explanation || '',
      topic: data.topic || 'General',
      difficulty: data.difficulty || 'Medium',
    };
    writeList('questions', [...all, item]);
    return item;
  },
  async update(id: string, data: Partial<Question>): Promise<Question> {
    await wait();
    const all = readList('questions', questions).map((q) => (q.id === id ? { ...q, ...data } : q));
    writeList('questions', all);
    return all.find((q) => q.id === id)!;
  },
  async remove(id: string): Promise<void> {
    await wait();
    writeList('questions', readList('questions', questions).filter((q) => q.id !== id));
  },
};

// --------------------------------------------------------------- students
export const studentService = {
  async list(tenantId: string): Promise<Student[]> {
    await wait();
    return readList('students', students).filter((s) => s.tenantId === tenantId);
  },
  async update(id: string, data: Partial<Student>): Promise<Student> {
    await wait();
    const all = readList('students', students).map((s) => (s.id === id ? { ...s, ...data } : s));
    writeList('students', all);
    return all.find((s) => s.id === id)!;
  },
};

// ----------------------------------------------------------------- live tests
export const liveTestService = {
  async list(tenantId?: string): Promise<LiveTest[]> {
    await wait();
    return readList('liveTests', liveTests).filter((t) => !tenantId || t.tenantId === tenantId);
  },
  async get(id: string): Promise<LiveTest | undefined> {
    await wait(80);
    return readList('liveTests', liveTests).find((t) => t.id === id);
  },
  async create(data: Partial<LiveTest> & { tenantId: string; examId: string; name: string }): Promise<LiveTest> {
    await wait();
    const all = readList('liveTests', liveTests);
    const item: LiveTest = {
      id: `lt-${Date.now()}`,
      tenantId: data.tenantId,
      examId: data.examId,
      name: data.name,
      scheduledStart: data.scheduledStart || new Date().toISOString(),
      scheduledEnd: data.scheduledEnd || new Date(Date.now() + 3600_000).toISOString(),
      durationMinutes: data.durationMinutes ?? 30,
      price: data.price ?? 0,
      status: data.status || 'Draft',
      participantIds: data.participantIds || [],
    };
    writeList('liveTests', [...all, item]);
    return item;
  },
  async update(id: string, data: Partial<LiveTest>): Promise<LiveTest> {
    await wait();
    const all = readList('liveTests', liveTests).map((t) => (t.id === id ? { ...t, ...data } : t));
    writeList('liveTests', all);
    return all.find((t) => t.id === id)!;
  },
  /** Pure function: the user-facing phase, always derived from the clock — never stored. */
  phase(test: LiveTest): LiveTestPhase {
    if (test.status !== 'Published') return test.status;
    const now = Date.now();
    const start = new Date(test.scheduledStart).getTime();
    const end = new Date(test.scheduledEnd).getTime();
    if (now < start) return 'Upcoming';
    if (now > end) return 'Ended';
    return 'Live';
  },
};

// ------------------------------------------------------------------- attempts
export const attemptService = {
  async save(data: Omit<Attempt, 'id' | 'createdAt'>): Promise<Attempt> {
    await wait(150);
    const all = readList<Attempt>('attempts', []);
    const item: Attempt = { ...data, id: `attempt-${Date.now()}`, createdAt: new Date().toISOString() };
    writeList('attempts', [...all, item]);
    return item;
  },
  async listForStudent(studentId: string): Promise<Attempt[]> {
    await wait();
    return readList<Attempt>('attempts', [])
      .filter((a) => a.studentId === studentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  async get(id: string): Promise<Attempt | undefined> {
    await wait(80);
    return readList<Attempt>('attempts', []).find((a) => a.id === id);
  },
  /** One-attempt-only enforcement for live tests — a repeat visit should land on the existing result, not let the student retake it. */
  async findForLiveTest(studentId: string, liveTestId: string): Promise<Attempt | undefined> {
    await wait(80);
    return readList<Attempt>('attempts', []).find((a) => a.studentId === studentId && a.liveTestId === liveTestId);
  },
};

// ------------------------------------------------------------------ payments
export const paymentService = {
  async purchase(input: { tenantId: string; studentId: string; kind: Transaction['kind']; refId: string; label: string; amount: number }): Promise<Transaction> {
    await wait(1200);
    const all = readList<Transaction>('transactions', []);
    const tx: Transaction = { id: `QS-TXN-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, status: 'Success', createdAt: new Date().toISOString(), ...input };
    writeList('transactions', [...all, tx]);
    return tx;
  },
  hasPurchased(studentId: string, kind: Transaction['kind'], refId: string): boolean {
    return readList<Transaction>('transactions', []).some((t) => t.studentId === studentId && t.kind === kind && t.refId === refId && t.status === 'Success');
  },
  async list(tenantId?: string): Promise<Transaction[]> {
    await wait();
    return readList<Transaction>('transactions', []).filter((t) => !tenantId || t.tenantId === tenantId);
  },
};

// ------------------------------------------------------------------- chatbot
export const chatbotConfigService = {
  async get(tenantId: string): Promise<ChatbotConfig> {
    await wait(100);
    const all = readList('chatbotConfigs', chatbotConfigs);
    return all.find((c) => c.tenantId === tenantId) || { tenantId, enabled: false, provider: 'OpenAI', priceRupeesPerMonth: 0, freeMessageLimit: 0, monthlyMessageCap: 100, systemPrompt: '' };
  },
  async save(tenantId: string, data: Partial<ChatbotConfig>): Promise<ChatbotConfig> {
    await wait();
    const all = readList('chatbotConfigs', chatbotConfigs);
    const existingIndex = all.findIndex((c) => c.tenantId === tenantId);
    const merged: ChatbotConfig = { tenantId, enabled: false, provider: 'OpenAI', priceRupeesPerMonth: 0, freeMessageLimit: 0, monthlyMessageCap: 100, systemPrompt: '', ...(existingIndex >= 0 ? all[existingIndex] : {}), ...data };
    const next = existingIndex >= 0 ? all.map((c, i) => (i === existingIndex ? merged : c)) : [...all, merged];
    writeList('chatbotConfigs', next);
    return merged;
  },
};

export const aiService = {
  async reply(message: string): Promise<string> {
    await wait(850);
    const text = message.toLowerCase();
    if (text.includes('percentage')) return 'Percentage is a great topic to sharpen. Start with 10 medium-difficulty questions, then review the ones you got wrong step by step.';
    if (text.includes('profit') || text.includes('loss')) return 'For Profit & Loss, always convert everything to a common cost-price base of 100 first — it makes percentage changes much easier to track.';
    if (text.includes('reasoning') || text.includes('coding')) return 'For coding-decoding questions, write out the alphabet with position numbers next to it — most patterns become obvious once you can see the shift visually.';
    if (text.includes('english') || text.includes('vocabulary') || text.includes('grammar')) return 'Reading a little bit of varied English content daily — news, short stories — builds vocabulary faster than memorising word lists alone.';
    if (text.includes('shortcut')) return 'A quick shortcut: for successive percentage changes of a% and b%, the net change is a + b + (a×b)/100. Try it on your next Percentage question.';
    if (text.includes('plan') || text.includes('study')) return "A focused 45-minute daily session — 20 minutes on your weakest topic, 25 minutes on a timed mini mock — tends to move scores faster than long unfocused sessions.";
    return "I can help you with a weak topic, an exam strategy, or explaining a question. Try asking about Percentage, Time & Work, or 'give me a shortcut'.";
  },
};

// -------------------------------------------------------------- notifications
const defaultNotifications: Record<Role, Notification[]> = {
  student: [
    { id: 'n-s1', role: 'student', title: 'Live test starting soon', body: 'SSC CGL Live Mock — Evening Batch is open now.', time: '10 minutes ago', read: false },
    { id: 'n-s2', role: 'student', title: 'Result published', body: 'Your SSC CGL Weekly Practice Test result is ready to review.', time: '2 days ago', read: false },
    { id: 'n-s3', role: 'student', title: 'Payment successful', body: 'SSC CGL Premium Mock Test has been unlocked.', time: 'Last week', read: true },
  ],
  coaching: [
    { id: 'n-c1', role: 'coaching', title: 'New join request', body: 'Kabir Nanda has requested to join Sunrise Academy.', time: '2 hours ago', read: false },
    { id: 'n-c2', role: 'coaching', title: 'Question bank ready', body: 'Your Banking PO English Section bank is being built by the platform team.', time: 'Yesterday', read: false },
    { id: 'n-c3', role: 'coaching', title: 'Payment received', body: '24 students purchased SSC CGL Premium Mock Test this week.', time: '3 days ago', read: true },
  ],
  platform: [
    { id: 'n-p1', role: 'platform', title: 'New question bank request', body: 'Success Institute submitted a request for UPSC CSAT Practice.', time: '1 hour ago', read: false },
    { id: 'n-p2', role: 'platform', title: 'New coaching signup', body: 'A new coaching workspace was created.', time: 'Yesterday', read: false },
  ],
};

export const notificationService = {
  async list(role: Role): Promise<Notification[]> {
    await wait();
    const key = `notifications:${role}`;
    const stored = storage.get<Notification[] | null>(key, null);
    if (stored) return stored;
    // First read: seed the default set and persist it, so markRead below has
    // something real to update instead of operating on an empty stored array.
    const seeded = defaultNotifications[role];
    storage.set(key, seeded);
    return seeded;
  },
  async markRead(role: Role, id: string): Promise<void> {
    const key = `notifications:${role}`;
    const items = storage.get<Notification[]>(key, defaultNotifications[role]).map((n) => (n.id === id ? { ...n, read: true } : n));
    storage.set(key, items);
  },
  async markAllRead(role: Role): Promise<void> {
    const key = `notifications:${role}`;
    const items = storage.get<Notification[]>(key, defaultNotifications[role]).map((n) => ({ ...n, read: true }));
    storage.set(key, items);
  },
};
