import {
  AuthUser,
  ChatbotConfig,
  Course,
  JoinRequest,
  LiveTest,
  Question,
  QuestionBank,
  QuestionBankRequest,
  Student,
  Tenant,
} from '@/types';

// ---------------------------------------------------------------- date helpers
// Generated relative to load time so the demo always looks current, instead of
// a hardcoded date silently going stale. Fine here — this isn't a Workflow
// script, just ordinary app seed data.
function isoAt(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// -------------------------------------------------------------------- users
export const users: AuthUser[] = [
  { id: 'u-admin', name: 'Aarav Mehta', email: 'admin@quizset.demo', role: 'platform' },
  { id: 'u-owner', name: 'Rajiv Sharma', email: 'owner@sunrise.demo', role: 'coaching', tenantId: 'sunrise' },
  { id: 'u-student', name: 'Rahul Sharma', email: 'rahul@student.demo', role: 'student', tenantId: 'sunrise' },
];

// ----------------------------------------------------------------- tenants
export const tenants: Tenant[] = [
  {
    id: 'sunrise',
    name: 'Sunrise Academy',
    initials: 'SA',
    city: 'Raipur',
    category: 'Competitive Exam Coaching',
    students: 2540,
    plan: 'Growth',
    primaryColor: '#4f46e5',
    secondaryColor: '#06b6d4',
    joinCode: 'SUNRISE2026',
    owner: 'Rajiv Sharma',
    supportEmail: 'hello@sunriseacademy.in',
  },
  {
    id: 'career',
    name: 'Career Point',
    initials: 'CP',
    city: 'Kota',
    category: 'Banking & SSC Coaching',
    students: 1890,
    plan: 'Enterprise',
    primaryColor: '#0891b2',
    secondaryColor: '#f59e0b',
    joinCode: 'CAREER2026',
    owner: 'Amit Verma',
    supportEmail: 'support@careerpoint.in',
  },
  {
    id: 'success',
    name: 'Success Institute',
    initials: 'SI',
    city: 'Patna',
    category: 'Civil Services Coaching',
    students: 950,
    plan: 'Starter',
    primaryColor: '#7c3aed',
    secondaryColor: '#16a34a',
    joinCode: 'SUCCESS2026',
    owner: 'Neha Jain',
    supportEmail: 'team@successinstitute.in',
  },
];

// ---------------------------------------------------------------- students
export const students: Student[] = [
  { id: 'rahul', name: 'Rahul Sharma', email: 'rahul@student.demo', phone: '+91 98765 43210', tenantId: 'sunrise', status: 'Active', courses: 12, score: 78, joined: '12 Jan 2025' },
  { id: 'ananya', name: 'Ananya Singh', email: 'ananya@sunrise.demo', phone: '+91 98111 22445', tenantId: 'sunrise', status: 'Active', courses: 18, score: 84, joined: '08 Jan 2025' },
  { id: 'vikas', name: 'Vikas Kumar', email: 'vikas@sunrise.demo', phone: '+91 99200 31876', tenantId: 'sunrise', status: 'Pending', courses: 0, score: 0, joined: '02 Jul 2025' },
  { id: 'meera', name: 'Meera Joshi', email: 'meera@sunrise.demo', phone: '+91 98001 10987', tenantId: 'sunrise', status: 'Suspended', courses: 9, score: 61, joined: '22 Dec 2024' },
];

// -------------------------------------------------------------- join requests
// Produced by the "search a coaching, request to join" flow — separate from
// the join-code flow, which enrolls immediately without a pending row.
export const joinRequests: JoinRequest[] = [
  { id: 'jr-1', tenantId: 'sunrise', studentName: 'Kabir Nanda', studentEmail: 'kabir.nanda@example.com', status: 'Pending', createdAt: '2 hours ago' },
];

// ------------------------------------------------------------- question banks
// Status is the content-review pipeline (see types.ts's QuestionBankStatus
// doc comment) — deliberately showing three different real stages in the
// demo data, not just the end state:
//   qb-ssc-cgl / qb-ssc-practice / qb-railway-gs / qb-banking-quant: already
//     Finalized (they power a Published-or-publishable course today).
//   qb-career-english: Coaching Review — the coaching owner can already see
//     and edit these 3 questions, but no course using this bank can publish yet.
export const questionBanks: QuestionBank[] = [
  { id: 'qb-ssc-cgl', tenantId: 'sunrise', name: 'SSC CGL 2026', subject: 'Quantitative Aptitude & Reasoning', status: 'Finalized', requestId: 'req-1' },
  { id: 'qb-ssc-practice', tenantId: 'sunrise', name: 'SSC CGL Reasoning Practice', subject: 'Reasoning', status: 'Finalized' },
  { id: 'qb-railway-gs', tenantId: 'sunrise', name: 'Railway Group D General Awareness', subject: 'General Awareness', status: 'Finalized' },
  { id: 'qb-banking-quant', tenantId: 'career', name: 'Banking PO Quant Sprint', subject: 'Quantitative Aptitude', status: 'Finalized' },
  { id: 'qb-career-english', tenantId: 'career', name: 'Banking PO English Section', subject: 'English', status: 'Coaching Review', requestId: 'req-2' },
];

// --------------------------------------------------------------- questions
// A real, hand-checked pool of MCQs (English, per the current content
// decision) — no placeholder/lorem-ipsum text. Distributed across the
// question banks above so each course has a genuine, distinct set instead of
// one shared array cycled with `% 5`. Every question now carries a `unit`
// (the broad syllabus section) alongside its `topic` (the specific concept)
// — that two-level hierarchy is what Topic-wise / Unit-wise practice groups by.
export const questions: Question[] = [
  // -- Quantitative Aptitude --
  { id: 'q-pct-1', questionBankId: 'qb-ssc-cgl', text: 'The price of an article is ₹500. It increases by 20%. What is the new price?', options: ['₹550', '₹580', '₹600', '₹620'], answer: 2, explanation: '20% of ₹500 is ₹100. Add it to the original price: ₹500 + ₹100 = ₹600.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Percentage', difficulty: 'Easy' },
  { id: 'q-pct-2', questionBankId: 'qb-ssc-cgl', text: 'In an election with only two candidates and 20,000 total votes, the winner got 55%. How many votes did the loser get?', options: ['8,000', '8,500', '9,000', '9,500'], answer: 2, explanation: 'Winner: 55% of 20,000 = 11,000. Loser: 20,000 − 11,000 = 9,000.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Percentage', difficulty: 'Medium' },
  { id: 'q-pct-3', questionBankId: 'qb-banking-quant', text: 'A number is first decreased by 25%, then the result is increased by 25%. What is the net percentage change?', options: ['−6.25%', '0%', '+6.25%', '−12.5%'], answer: 0, explanation: 'Let the number be 100. After a 25% decrease: 75. After a 25% increase on 75: 75 × 1.25 = 93.75. Net change = 93.75 − 100 = −6.25%.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Percentage', difficulty: 'Hard' },
  { id: 'q-pl-1', questionBankId: 'qb-ssc-cgl', text: 'A trader buys an article for ₹800 and sells it for ₹960. What is the profit percentage?', options: ['15%', '18%', '20%', '25%'], answer: 2, explanation: 'Profit = ₹960 − ₹800 = ₹160. Profit% = (160 / 800) × 100 = 20%.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Profit & Loss', difficulty: 'Easy' },
  { id: 'q-pl-2', questionBankId: 'qb-ssc-cgl', text: 'A shopkeeper marks his goods 40% above the cost price and then gives a 10% discount. What is his profit percentage?', options: ['20%', '24%', '26%', '30%'], answer: 2, explanation: 'Let CP = ₹100. Marked price = ₹140. Selling price after 10% discount = 140 × 0.9 = ₹126. Profit% = 26%.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Profit & Loss', difficulty: 'Medium' },
  { id: 'q-pl-3', questionBankId: 'qb-banking-quant', text: 'By selling an article for ₹450, a man loses 10%. What was the cost price?', options: ['₹480', '₹490', '₹500', '₹520'], answer: 2, explanation: 'SP = 0.9 × CP, so CP = 450 / 0.9 = ₹500.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Profit & Loss', difficulty: 'Medium' },
  { id: 'q-tw-1', questionBankId: 'qb-ssc-cgl', text: 'A can finish a piece of work in 12 days and B can finish it in 18 days. Working together, how many days will they take?', options: ['6 days', '7.2 days', '8 days', '9 days'], answer: 1, explanation: 'Combined rate = 1/12 + 1/18 = 5/36 of the work per day, so time taken = 36/5 = 7.2 days.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Time & Work', difficulty: 'Medium' },
  { id: 'q-tw-2', questionBankId: 'qb-banking-quant', text: '12 men can complete a job in 8 days. How many days will 16 men take to complete the same job?', options: ['5 days', '6 days', '7 days', '8 days'], answer: 1, explanation: 'Total work = 12 × 8 = 96 man-days. Time for 16 men = 96 / 16 = 6 days.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Time & Work', difficulty: 'Easy' },
  { id: 'q-ratio-1', questionBankId: 'qb-ssc-cgl', text: 'The ratio of two numbers is 3:5 and their sum is 64. Find the smaller number.', options: ['18', '20', '24', '28'], answer: 2, explanation: 'Total parts = 3 + 5 = 8. One part = 64 / 8 = 8. Smaller number = 3 × 8 = 24.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Ratio', difficulty: 'Medium' },
  { id: 'q-ratio-2', questionBankId: 'qb-banking-quant', text: 'Two numbers are in the ratio 4:7. If their sum is 99, find the larger number.', options: ['56', '63', '70', '77'], answer: 1, explanation: 'Total parts = 4 + 7 = 11. One part = 99 / 11 = 9. Larger number = 7 × 9 = 63.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Ratio', difficulty: 'Easy' },
  { id: 'q-td-1', questionBankId: 'qb-ssc-cgl', text: 'A train travels 360 km in 4 hours. What is its average speed?', options: ['80 km/h', '90 km/h', '100 km/h', '120 km/h'], answer: 1, explanation: 'Average speed = distance ÷ time = 360 ÷ 4 = 90 km/h.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Time & Distance', difficulty: 'Easy' },
  { id: 'q-td-2', questionBankId: 'qb-banking-quant', text: 'A car covers 150 km at 50 km/h and returns the same distance at 75 km/h. Find its average speed for the whole trip.', options: ['55 km/h', '58 km/h', '60 km/h', '62.5 km/h'], answer: 2, explanation: 'Average speed for equal distances = (2 × v1 × v2) / (v1 + v2) = (2 × 50 × 75) / 125 = 60 km/h.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Time & Distance', difficulty: 'Hard' },
  { id: 'q-si-1', questionBankId: 'qb-banking-quant', text: 'Find the simple interest on ₹8,000 at 10% per annum for 3 years.', options: ['₹2,000', '₹2,200', '₹2,400', '₹2,600'], answer: 2, explanation: 'SI = (P × R × T) / 100 = (8000 × 10 × 3) / 100 = ₹2,400.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Simple Interest', difficulty: 'Easy' },
  { id: 'q-avg-1', questionBankId: 'qb-ssc-cgl', text: 'The average of 5 numbers is 42. If one number is excluded, the average of the remaining 4 becomes 40. Find the excluded number.', options: ['40', '45', '50', '55'], answer: 2, explanation: 'Sum of 5 numbers = 5 × 42 = 210. Sum of remaining 4 = 4 × 40 = 160. Excluded number = 210 − 160 = 50.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Average', difficulty: 'Medium' },
  { id: 'q-frac-1', questionBankId: 'qb-banking-quant', text: 'Convert 0.75 into a fraction in its lowest terms.', options: ['1/2', '2/3', '3/4', '4/5'], answer: 2, explanation: '0.75 = 75/100, which simplifies to 3/4.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Number System', difficulty: 'Easy' },
  { id: 'q-unit-1', questionBankId: 'qb-banking-quant', text: "A train's speed is 72 km/h. What is its speed in metres per second?", options: ['15 m/s', '18 m/s', '20 m/s', '25 m/s'], answer: 2, explanation: 'To convert km/h to m/s, multiply by 5/18: 72 × 5/18 = 20 m/s.', subject: 'Quantitative Aptitude', unit: 'Quantitative Aptitude', topic: 'Time & Distance', difficulty: 'Easy' },

  // -- Reasoning --
  { id: 'q-ns-1', questionBankId: 'qb-ssc-cgl', text: 'Which number should replace the question mark: 3, 9, 27, 81, ?', options: ['162', '189', '243', '324'], answer: 2, explanation: 'Each term is multiplied by 3 to get the next: 81 × 3 = 243.', subject: 'Reasoning', unit: 'Reasoning', topic: 'Number Series', difficulty: 'Medium' },
  { id: 'q-ns-2', questionBankId: 'qb-ssc-practice', text: 'Find the odd one out: 27, 64, 125, 150.', options: ['27', '64', '125', '150'], answer: 3, explanation: '27, 64 and 125 are perfect cubes (3³, 4³, 5³). 150 is not a perfect cube.', subject: 'Reasoning', unit: 'Reasoning', topic: 'Number Series', difficulty: 'Medium' },
  { id: 'q-ls-1', questionBankId: 'qb-ssc-practice', text: 'Find the next term in the series: A, C, F, J, O, ?', options: ['T', 'U', 'V', 'W'], answer: 1, explanation: 'The gaps between letters increase by one each time: +2, +3, +4, +5, +6. O + 6 letters = U.', subject: 'Reasoning', unit: 'Reasoning', topic: 'Letter Series', difficulty: 'Medium' },
  { id: 'q-code-1', questionBankId: 'qb-ssc-practice', text: "If CAT is coded as DBU, how is DOG coded in the same language?", options: ['EPH', 'EPI', 'FPH', 'EQH'], answer: 0, explanation: 'Each letter is shifted forward by one: D→E, O→P, G→H, giving EPH.', subject: 'Reasoning', unit: 'Reasoning', topic: 'Coding-Decoding', difficulty: 'Medium' },
  { id: 'q-code-2', questionBankId: 'qb-ssc-practice', text: "In a certain code, 'PENCIL' is written as 'QFODJM'. How is 'ERASER' written in that code?", options: ['FSBTFS', 'FSATFR', 'ESBTFS', 'FTBSFR'], answer: 0, explanation: "Each letter shifts forward by one, same rule as PENCIL → QFODJM. ERASER → FSBTFS.", subject: 'Reasoning', unit: 'Reasoning', topic: 'Coding-Decoding', difficulty: 'Hard' },
  { id: 'q-analogy-1', questionBankId: 'qb-ssc-practice', text: 'Doctor is to Hospital as Teacher is to?', options: ['Hospital', 'Clinic', 'School', 'Office'], answer: 2, explanation: 'A doctor works at a hospital; a teacher works at a school. Same relationship.', subject: 'Reasoning', unit: 'Reasoning', topic: 'Analogy', difficulty: 'Easy' },
  { id: 'q-analogy-2', questionBankId: 'qb-ssc-practice', text: 'Pen is to Write as Knife is to?', options: ['Sharp', 'Cut', 'Kitchen', 'Blade'], answer: 1, explanation: 'A pen is used to write; a knife is used to cut. Same relationship — an object to its primary function.', subject: 'Reasoning', unit: 'Reasoning', topic: 'Analogy', difficulty: 'Easy' },

  // -- English --
  { id: 'q-vocab-1', questionBankId: 'qb-ssc-practice', text: "Choose the word most similar in meaning to 'Prudent'.", options: ['Careless', 'Wise', 'Rapid', 'Proud'], answer: 1, explanation: "'Prudent' means acting with careful thought; 'Wise' is the closest meaning.", subject: 'English', unit: 'English', topic: 'Vocabulary', difficulty: 'Easy' },
  { id: 'q-vocab-2', questionBankId: 'qb-ssc-practice', text: "Choose the antonym of 'Ancient'.", options: ['Old', 'Modern', 'Historic', 'Antique'], answer: 1, explanation: "'Ancient' means very old; its opposite is 'Modern'.", subject: 'English', unit: 'English', topic: 'Vocabulary', difficulty: 'Easy' },
  { id: 'q-vocab-3', questionBankId: 'qb-career-english', text: "Choose the synonym of 'Meticulous'.", options: ['Careless', 'Careful', 'Quick', 'Lazy'], answer: 1, explanation: "'Meticulous' means showing great attention to detail — closest in meaning to 'Careful'.", subject: 'English', unit: 'English', topic: 'Vocabulary', difficulty: 'Medium' },
  { id: 'q-gram-1', questionBankId: 'qb-career-english', text: 'Choose the correctly spelled word.', options: ['Recieve', 'Receive', 'Receve', 'Receeve'], answer: 1, explanation: "The correct spelling follows 'i before e except after c' — here it is 'Receive'.", subject: 'English', unit: 'English', topic: 'Grammar', difficulty: 'Easy' },
  { id: 'q-gram-2', questionBankId: 'qb-career-english', text: 'Identify the grammatically correct sentence.', options: ["He don't like tea.", "He doesn't likes tea.", "He doesn't like tea.", 'He not like tea.'], answer: 2, explanation: "Third-person singular ('He') takes 'doesn't' followed by the base verb 'like'.", subject: 'English', unit: 'English', topic: 'Grammar', difficulty: 'Medium' },

  // -- General Awareness --
  { id: 'q-gk-1', questionBankId: 'qb-railway-gs', text: "Who is known as the 'Father of the Indian Constitution'?", options: ['Mahatma Gandhi', 'Jawaharlal Nehru', 'B. R. Ambedkar', 'Sardar Patel'], answer: 2, explanation: 'Dr. B. R. Ambedkar chaired the Constitution Drafting Committee and is regarded as its chief architect.', subject: 'General Awareness', unit: 'General Awareness', topic: 'Polity', difficulty: 'Easy' },
  { id: 'q-gk-2', questionBankId: 'qb-railway-gs', text: 'What is the currency of Japan called?', options: ['Won', 'Yen', 'Yuan', 'Ringgit'], answer: 1, explanation: "Japan's official currency is the Yen.", subject: 'General Awareness', unit: 'General Awareness', topic: 'General Knowledge', difficulty: 'Easy' },
  { id: 'q-gk-3', questionBankId: 'qb-railway-gs', text: 'Which is the longest river in India?', options: ['Yamuna', 'Godavari', 'Ganga', 'Brahmaputra'], answer: 2, explanation: 'The Ganga is the longest river flowing within India.', subject: 'General Awareness', unit: 'General Awareness', topic: 'Geography', difficulty: 'Easy' },
  { id: 'q-gk-4', questionBankId: 'qb-railway-gs', text: 'Which Indian city hosted the G20 Leaders’ Summit in 2023?', options: ['Mumbai', 'New Delhi', 'Bengaluru', 'Chennai'], answer: 1, explanation: 'New Delhi hosted the G20 Leaders’ Summit in September 2023.', subject: 'General Awareness', unit: 'General Awareness', topic: 'Current Affairs', difficulty: 'Medium' },
];

// ------------------------------------------------------------------ courses
// `questions` count is intentionally derived at read time from the linked
// question bank, never a hand-typed number — see courseService.list/get in
// services/mock.ts. `assignedStudentIds: []` means every tenant student can
// see the course (the default) — a coaching only fills this in to restrict
// it to specific, approved students.
export const courses: Course[] = [
  { id: 'ssc-premium', tenantId: 'sunrise', questionBankId: 'qb-ssc-cgl', name: 'SSC CGL Premium', description: 'Complete Quantitative Aptitude and Reasoning practice — topic-wise, unit-wise or full-length, at your own pace.', mrp: 999, sale: 499, preview: 5, status: 'Published', students: 1248, subject: 'Quantitative Aptitude', assignedStudentIds: [] },
  { id: 'ssc-practice', tenantId: 'sunrise', questionBankId: 'qb-ssc-practice', name: 'SSC CGL Reasoning', description: 'Reasoning practice with instant feedback after every question.', mrp: 0, sale: 0, preview: 9, status: 'Published', students: 863, subject: 'Reasoning', assignedStudentIds: [] },
  { id: 'railway', tenantId: 'sunrise', questionBankId: 'qb-railway-gs', name: 'Railway Group D General Awareness', description: 'Complete General Awareness practice for the Railway Group D syllabus.', mrp: 699, sale: 349, preview: 2, status: 'Upcoming', students: 0, subject: 'General Awareness', assignedStudentIds: [] },
  { id: 'banking-quant', tenantId: 'career', questionBankId: 'qb-banking-quant', name: 'Banking PO Quant', description: 'A fast-paced Quantitative Aptitude practice system for Banking PO aspirants.', mrp: 399, sale: 199, preview: 3, status: 'Published', students: 432, subject: 'Quantitative Aptitude', assignedStudentIds: [] },
  // Draft courses that exist specifically so the two in-flight requests below
  // (req-2, req-3) have a real course to link to — a request always points
  // at an already-created course, even one that's still empty/Draft.
  { id: 'banking-english', tenantId: 'career', questionBankId: 'qb-career-english', name: 'Banking PO English', description: 'English section practice for Banking PO prelims.', mrp: 0, sale: 0, preview: 5, status: 'Draft', students: 0, subject: 'English', assignedStudentIds: [] },
  { id: 'upsc-csat', tenantId: 'success', questionBankId: '', name: 'UPSC CSAT Practice', description: 'CSAT-style reasoning and comprehension practice.', mrp: 0, sale: 0, preview: 5, status: 'Draft', students: 0, subject: 'Reasoning', assignedStudentIds: [] },
];

// -------------------------------------------------------------- live tests
export const liveTests: LiveTest[] = [
  // Currently inside its window — lets a demo student actually take a live test right away.
  { id: 'lt-live-now', tenantId: 'sunrise', courseId: 'ssc-premium', name: 'SSC CGL Live Mock — Evening Batch', scheduledStart: isoAt(0, -1), scheduledEnd: isoAt(0, 5), durationMinutes: 20, price: 0, status: 'Published', participantIds: [] },
  // Upcoming, tomorrow.
  { id: 'lt-upcoming', tenantId: 'sunrise', courseId: 'railway', name: 'Railway Group D Grand Test', scheduledStart: isoAt(1, 10), scheduledEnd: isoAt(1, 12), durationMinutes: 8, price: 49, status: 'Published', participantIds: [] },
  // Already ended, so Results have something to show.
  { id: 'lt-ended', tenantId: 'sunrise', courseId: 'ssc-practice', name: 'SSC CGL Weekly Practice Test', scheduledStart: isoAt(-2, 9), scheduledEnd: isoAt(-2, 11), durationMinutes: 15, price: 0, status: 'Published', participantIds: [] },
];

// -------------------------------------------------------- question-bank requests
// Deliberately at three different real stages, matching the three
// questionBanks stages above:
//   req-1: Finalized — fully delivered, course already published.
//   req-2: In Progress — bank exists and is in Coaching Review; the coaching
//     didn't specify units/topics itself (unitsTopics left unset), so the
//     platform owner derived the English breakdown from the syllabus file.
//   req-3: Pending — no bank yet at all; this one DID specify its own
//     breakdown up front, showing the "coaching already knows its syllabus"
//     path.
export const questionBankRequests: QuestionBankRequest[] = [
  { id: 'req-1', tenantId: 'sunrise', courseId: 'ssc-premium', courseName: 'SSC CGL Premium Mock Test', subjects: ['Quantitative Aptitude', 'Reasoning'], questionsRequired: 100, difficulty: 'Easy + Medium + Hard', priority: 'High', status: 'Finalized', questionBankId: 'qb-ssc-cgl', createdAt: '3 weeks ago', ownerNote: 'Delivered and published to the course catalog.' },
  { id: 'req-2', tenantId: 'career', courseId: 'banking-english', courseName: 'Banking PO English Section', subjects: ['English'], questionsRequired: 60, difficulty: 'Easy + Medium', priority: 'Medium', notes: 'Focus on grammar and vocabulary for the prelims level.', syllabusFileName: 'banking-po-english-syllabus.pdf', status: 'In Progress', questionBankId: 'qb-career-english', createdAt: '2 days ago', ownerNote: 'Syllabus breakdown was not provided, so units/topics were derived from the uploaded file. First batch of Grammar + Vocabulary is in for your review.' },
  { id: 'req-3', tenantId: 'success', courseId: 'upsc-csat', courseName: 'UPSC CSAT Practice', subjects: ['Reasoning', 'Comprehension'], questionsRequired: 150, difficulty: 'Medium + Hard', priority: 'High', notes: 'Please prioritize comprehension passages — that is our weakest area.', unitsTopics: 'Reasoning: Analogy, Coding-Decoding, Series. Comprehension: Passage-based inference, Vocabulary-in-context.', syllabusFileName: 'upsc-csat-syllabus.pdf', status: 'Pending', createdAt: 'Yesterday' },
];

// ------------------------------------------------------------- chatbot config
export const chatbotConfigs: ChatbotConfig[] = [
  { tenantId: 'sunrise', enabled: true, provider: 'Claude', priceRupeesPerMonth: 99, freeMessageLimit: 20, monthlyMessageCap: 300, systemPrompt: 'You are a friendly, encouraging study assistant for Sunrise Academy students preparing for competitive exams.' },
  { tenantId: 'career', enabled: false, provider: 'OpenAI', priceRupeesPerMonth: 0, freeMessageLimit: 0, monthlyMessageCap: 100, systemPrompt: '' },
  { tenantId: 'success', enabled: false, provider: 'Gemini', priceRupeesPerMonth: 0, freeMessageLimit: 0, monthlyMessageCap: 100, systemPrompt: '' },
];
