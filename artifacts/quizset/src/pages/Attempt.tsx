import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Skeleton } from '@/components/ui';
import { PracticeQuizRunner, TimedQuizRunner } from '@/components/QuizRunner';
import { useApp } from '@/contexts/AppContext';
import { attemptService, examService, questionService } from '@/services/mock';
import { Exam, PracticeScope, Question } from '@/types';
import { takePendingPractice } from '@/lib/practiceHandoff';

const FULL_SCOPE: PracticeScope = { mode: 'full' };

/**
 * Renders one of two genuinely different experiences depending on exam.type:
 * Practice Quiz is untimed with instant per-question feedback; everything
 * else is timed with a palette and submit confirmation. Both save a real
 * Attempt record and land on the same result page — no more `% 5` cycling
 * through a global 5-question array regardless of what the exam claims.
 *
 * Practice Quiz also honours whatever scope QuizSetup handed off (Topic-wise
 * / Unit-wise / Multi-unit / Custom / Full) via a one-shot sessionStorage
 * key, falling back to a full-bank no-repeat pick if the student landed here
 * directly without going through setup.
 */
export function Attempt() {
  const [, params] = useRoute('/student/exams/:id/attempt');
  const [, navigate] = useLocation();
  const { user } = useApp();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [scope, setScope] = useState<PracticeScope>(FULL_SCOPE);

  useEffect(() => {
    if (!params?.id || !user) return;
    examService.get(params.id).then(async (e) => {
      if (!e) return;
      setExam(e);
      const pool = await questionService.listByExam(e.id);
      if (e.type !== 'Practice Quiz') {
        setQuestions(pool);
        return;
      }
      const pending = takePendingPractice(e.id);
      if (pending) {
        const byId = new Map(pool.map((q) => [q.id, q]));
        setScope(pending.scope);
        setQuestions(pending.questionIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q)));
      } else {
        setScope(FULL_SCOPE);
        setQuestions(await attemptService.pickForPractice(user.id, e.id, FULL_SCOPE, pool, pool.length));
      }
    });
  }, [params?.id, user]);

  if (!exam || !questions || !user) return <Skeleton className="skeleton-page" />;
  if (questions.length === 0) return <div className="exam-interface" />;

  const finish = async (answers: Record<number, number>, timeTakenSeconds: number) => {
    const score = questions.reduce((count, q, i) => (answers[i] === q.answer ? count + 1 : count), 0);
    const attempt = await attemptService.save({
      studentId: user.id,
      tenantId: exam.tenantId,
      examId: exam.id,
      mode: exam.type === 'Practice Quiz' ? 'practice' : 'timed',
      practiceScope: exam.type === 'Practice Quiz' ? scope : undefined,
      answers,
      questionIds: questions.map((q) => q.id),
      score,
      totalAttempted: Object.keys(answers).length,
      timeTakenSeconds,
    });
    navigate(`/student/results/${attempt.id}`, { replace: true });
  };

  if (exam.type === 'Practice Quiz') {
    return <PracticeQuizRunner title={exam.name} questions={questions} onFinish={finish} />;
  }
  return <TimedQuizRunner title={exam.name} questions={questions} totalSeconds={exam.duration * 60} onSubmit={finish} />;
}
