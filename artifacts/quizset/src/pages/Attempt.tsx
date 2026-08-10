import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Skeleton } from '@/components/ui';
import { PracticeQuizRunner } from '@/components/QuizRunner';
import { useApp } from '@/contexts/AppContext';
import { attemptService, courseService, questionService } from '@/services/api';
import { Course, PracticeScope, Question } from '@/types';
import { takePendingPractice } from '@/lib/practiceHandoff';

const FULL_SCOPE: PracticeScope = { mode: 'full' };

/**
 * Every course attempt is untimed, personal practice — there's no course
 * "type" to branch on. Honours whatever scope QuizSetup handed off (Full /
 * Topic-wise / Unit-wise / Multi-unit / Custom) via a one-shot sessionStorage
 * key, falling back to a full-bank no-repeat pick if the student landed here
 * directly without going through setup. Saves a real Attempt record and
 * lands on the same result page every time.
 */
export function Attempt() {
  const [, params] = useRoute('/student/courses/:id/attempt');
  const [, navigate] = useLocation();
  const { user } = useApp();
  const [course, setCourse] = useState<Course | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [scope, setScope] = useState<PracticeScope>(FULL_SCOPE);
  const [timerSeconds, setTimerSeconds] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!params?.id || !user) return;
    courseService.get(params.id).then(async (c) => {
      if (!c) return;
      setCourse(c);
      const pool = await questionService.listByCourse(c.id);
      const pending = takePendingPractice(c.id);
      if (pending) {
        const byId = new Map(pool.map((q) => [q.id, q]));
        setScope(pending.scope);
        setQuestions(pending.questionIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q)));
        setTimerSeconds(pending.timerSeconds);
      } else {
        setScope(FULL_SCOPE);
        setQuestions(await attemptService.pickForPractice(user.id, c.id, FULL_SCOPE, pool, pool.length));
      }
    });
  }, [params?.id, user]);

  if (!course || !questions || !user) return <Skeleton className="skeleton-page" />;
  if (questions.length === 0) return <div className="exam-interface" />;

  const finish = async (answers: Record<number, number>, timeTakenSeconds: number) => {
    const score = questions.reduce((count, q, i) => (answers[i] === q.answer ? count + 1 : count), 0);
    const attempt = await attemptService.save({
      studentId: user.id,
      tenantId: course.tenantId,
      courseId: course.id,
      mode: 'practice',
      practiceScope: scope,
      answers,
      questionIds: questions.map((q) => q.id),
      score,
      totalAttempted: Object.keys(answers).length,
      timeTakenSeconds,
    });
    navigate(`/student/results/${attempt.id}`, { replace: true });
  };

  return <PracticeQuizRunner title={course.name} questions={questions} timerSeconds={timerSeconds} onFinish={finish} />;
}
