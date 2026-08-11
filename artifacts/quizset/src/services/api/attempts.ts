import type { Attempt, PracticeScope, Question, QuestionSnapshot } from '@/types';
import { apiGet, apiPost, ApiError } from './http';

type AttemptApiRow = {
  id: string;
  studentProfileId: string;
  tenantId: string;
  courseId: string;
  liveTestId: string | null;
  mode: Attempt['mode'];
  practiceScope: PracticeScope | null;
  answers: Record<number, number>;
  questionIds: string[];
  questionsSnapshot: (QuestionSnapshot | null)[] | null;
  score: number;
  totalAttempted: number;
  timeTakenSeconds: number;
  createdAt: string;
};

/**
 * NAMING MISMATCH: every Drizzle table names its student foreign key
 * `studentProfileId` (see `attempts.ts` / `profiles.ts` in
 * `lib/db/src/schema`), while the frontend `Attempt` type calls the exact
 * same value `studentId`. Renamed at this boundary so nothing above this
 * file needs to know the backend's column name.
 */
function mapAttempt(row: AttemptApiRow): Attempt {
  return {
    id: row.id,
    studentId: row.studentProfileId,
    tenantId: row.tenantId,
    courseId: row.courseId,
    liveTestId: row.liveTestId ?? undefined,
    mode: row.mode,
    practiceScope: row.practiceScope ?? undefined,
    answers: row.answers,
    questionIds: row.questionIds,
    questionsSnapshot: row.questionsSnapshot ?? undefined,
    score: row.score,
    totalAttempted: row.totalAttempted,
    timeTakenSeconds: row.timeTakenSeconds,
    createdAt: row.createdAt,
  };
}

export const attemptService = {
  /**
   * `data.studentId` is deliberately NOT sent: `POST /api/attempts` derives
   * the student from the caller's verified JWT (`req.auth.userId`), never
   * from the request body — the same "don't trust the client" rule the real
   * route already applies to `score`, which it recomputes server-side from
   * the actual question answers rather than trusting the client's number
   * (see the route's own comment in `attempts.ts`). We still pass
   * `data.score` along for shape completeness; the server simply ignores it.
   */
  async save(data: Omit<Attempt, 'id' | 'createdAt'>): Promise<Attempt> {
    const row = await apiPost<AttemptApiRow>('/api/attempts', {
      tenantId: data.tenantId,
      courseId: data.courseId,
      liveTestId: data.liveTestId,
      mode: data.mode,
      practiceScope: data.practiceScope,
      answers: data.answers,
      questionIds: data.questionIds,
      totalAttempted: data.totalAttempted,
      timeTakenSeconds: data.timeTakenSeconds,
    });
    return mapAttempt(row);
  },

  async listForStudent(studentId: string): Promise<Attempt[]> {
    const rows = await apiGet<AttemptApiRow[]>(`/api/attempts/student/${studentId}`);
    return rows.map(mapAttempt);
  },

  async listForCourse(courseId: string): Promise<Attempt[]> {
    const rows = await apiGet<AttemptApiRow[]>(`/api/attempts/course/${courseId}`);
    return rows.map(mapAttempt);
  },

  async get(id: string): Promise<Attempt | undefined> {
    try {
      const row = await apiGet<AttemptApiRow>(`/api/attempts/${id}`);
      return mapAttempt(row);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },

  /** No dedicated backend route for this exact (student, liveTestId) lookup
   * — reuses the per-student history endpoint and filters client-side.
   * Slightly wasteful (fetches the whole history to find one row) but
   * avoids inventing a new query-param contract the real route doesn't
   * support. */
  async findForLiveTest(studentId: string, liveTestId: string): Promise<Attempt | undefined> {
    const all = await this.listForStudent(studentId);
    return all.find((a) => a.liveTestId === liveTestId);
  },

  /**
   * `pool` is accepted only for call-signature parity with mock.ts — the
   * real endpoint (`POST /api/attempts/practice-questions`) fetches the
   * course's question pool itself, server-side, from the course's linked
   * question bank. mock.ts needed the caller to pass the pool because it
   * has no server to query it from; the real backend doesn't, so `pool` is
   * intentionally unused here.
   */
  async pickForPractice(
    studentId: string,
    courseId: string,
    scope: PracticeScope,
    pool: Question[],
    count: number,
  ): Promise<Question[]> {
    void pool;
    return apiPost<Question[]>('/api/attempts/practice-questions', {
      studentProfileId: studentId,
      courseId,
      scope,
      count,
    });
  },
};

export type TopicBreakdown = { unit: string; topic: string; attempted: number; correct: number };

/** Pure, network-free arithmetic — ported verbatim from services/mock.ts so
 * pages that import `computeTopicBreakdown` alongside `attemptService` keep
 * working unchanged. */
export function computeTopicBreakdown(attempts: Attempt[], allQuestions: Question[]): TopicBreakdown[] {
  const byId = new Map(allQuestions.map((q) => [q.id, q]));
  const rows = new Map<string, TopicBreakdown>();
  for (const attempt of attempts) {
    attempt.questionIds.forEach((qid, index) => {
      const q = byId.get(qid);
      const chosen = attempt.answers[index];
      if (!q || chosen === undefined) return;
      const key = `${q.unit}::${q.topic}`;
      if (!rows.has(key)) rows.set(key, { unit: q.unit, topic: q.topic, attempted: 0, correct: 0 });
      const row = rows.get(key)!;
      row.attempted += 1;
      if (chosen === q.answer) row.correct += 1;
    });
  }
  return Array.from(rows.values()).sort((a, b) => a.unit.localeCompare(b.unit) || a.topic.localeCompare(b.topic));
}
