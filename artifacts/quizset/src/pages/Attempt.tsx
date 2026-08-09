import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Skeleton } from '@/components/ui';
import { PracticeQuizRunner, TimedQuizRunner } from '@/components/QuizRunner';
import { useApp } from '@/contexts/AppContext';
import { attemptService, examService, questionService } from '@/services/mock';
import { Exam, Question } from '@/types';

/**
 * Renders one of two genuinely different experiences depending on exam.type:
 * Practice Quiz is untimed with instant per-question feedback; everything
 * else is timed with a palette and submit confirmation. Both save a real
 * Attempt record and land on the same result page — no more `% 5` cycling
 * through a global 5-question array regardless of what the exam claims.
 */
export function Attempt() {
  const [, params] = useRoute('/student/exams/:id/attempt');
  const [, navigate] = useLocation();
  const { user } = useApp();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    examService.get(params.id).then(async (e) => {
      if (!e) return;
      setExam(e);
      setQuestions(await questionService.listByExam(e.id));
    });
  }, [params?.id]);

  if (!exam || !questions || !user) return <Skeleton className="skeleton-page" />;
  if (questions.length === 0) return <div className="exam-interface" />;

  const finish = async (answers: Record<number, number>, timeTakenSeconds: number) => {
    const score = questions.reduce((count, q, i) => (answers[i] === q.answer ? count + 1 : count), 0);
    const attempt = await attemptService.save({
      studentId: user.id,
      tenantId: exam.tenantId,
      examId: exam.id,
      mode: exam.type === 'Practice Quiz' ? 'practice' : 'timed',
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
