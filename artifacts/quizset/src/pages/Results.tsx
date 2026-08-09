import { useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { ArrowLeft, Check, Clock3, FileText, X } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, Stat } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { attemptService, examService } from '@/services/mock';
import { Attempt, Exam, Question } from '@/types';
import { formatTimer } from '@/lib/format';

/** History list — the page that couldn't exist before, because attempts were never saved anywhere. */
export function ResultsHistory() {
  const { user } = useApp();
  const [rows, setRows] = useState<(Attempt & { examName: string })[] | null>(null);

  useEffect(() => {
    if (!user) return;
    attemptService.listForStudent(user.id).then(async (attempts) => {
      const withNames = await Promise.all(
        attempts.map(async (a) => ({ ...a, examName: (await examService.get(a.examId))?.name || 'Exam' }))
      );
      setRows(withNames);
    });
  }, [user]);

  if (!rows) return <Skeleton className="skeleton-page" />;

  return (
    <>
      <PageHeader eyebrow="Your progress" title="Results" description="Every attempt is a useful signal for your next one." />
      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No attempts yet" description="Take a practice quiz or an exam to see your results here." />
        </Card>
      ) : (
        <div className="result-list">
          {rows.map((r) => {
            const pct = r.totalAttempted ? Math.round((r.score / r.totalAttempted) * 100) : 0;
            return (
              <Link href={`/student/results/${r.id}`} key={r.id} className="result-row-link">
                <Card className="result-row">
                  <div>
                    <b>{r.examName}</b>
                    <small>
                      {new Date(r.createdAt).toLocaleDateString('en-IN')} · {r.totalAttempted} question{r.totalAttempted === 1 ? '' : 's'}
                    </small>
                  </div>
                  <span className={`result-score-pill ${pct >= 70 ? 'good' : pct >= 40 ? 'ok' : 'bad'}`}>{pct}%</span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Question-by-question review of one saved attempt — the student's own history. */
export function ResultReview() {
  const [, params] = useRoute('/student/results/:id');
  if (!params?.id) return null;
  return <AttemptReviewBody attemptId={params.id} backHref="/student/results" backLabel="Back to results" />;
}

/**
 * Same review, reached from a coaching owner's per-exam student dashboard
 * instead of the student's own history — attemptService.get() has no
 * ownership check, so this is safe to reuse as-is, just with a different
 * back link and route (gated to the coaching role, not student).
 */
export function CoachingAttemptReview() {
  const [, params] = useRoute('/coaching/exams/:examId/results/:id');
  if (!params?.id || !params?.examId) return null;
  return <AttemptReviewBody attemptId={params.id} backHref={`/coaching/exams/${params.examId}/students`} backLabel="Back to student dashboard" />;
}

function AttemptReviewBody({ attemptId, backHref, backLabel }: { attemptId: string; backHref: string; backLabel: string }) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);

  useEffect(() => {
    attemptService.get(attemptId).then(async (a) => {
      if (!a) return;
      setAttempt(a);
      const [e, { questionService }] = await Promise.all([examService.get(a.examId), import('@/services/mock')]);
      setExam(e || null);
      const allInBank = e ? await questionService.listByExam(e.id) : [];
      // Reconstruct in the exact order the attempt recorded, not the bank's current order.
      setQuestions(a.questionIds.map((id) => allInBank.find((q) => q.id === id)).filter(Boolean) as Question[]);
    });
  }, [attemptId]);

  if (!attempt || !exam || !questions) return <Skeleton className="skeleton-page" />;

  const pct = attempt.totalAttempted ? Math.round((attempt.score / attempt.totalAttempted) * 100) : 0;
  const wrong = attempt.totalAttempted - attempt.score;
  const skipped = questions.length - attempt.totalAttempted;

  return (
    <div className="exam-interface">
      <div className="exam-top">
        <div>
          <h1>{exam.name}</h1>
          <p>Attempt complete</p>
        </div>
        <Badge tone="success">RESULT READY</Badge>
      </div>
      <div className="content">
        <div className="result-hero">
          <div className="result-score">
            <strong>{pct}%</strong>
            <span>accuracy</span>
          </div>
          <div>
            <div className="eyebrow">YOUR RESULT IS READY</div>
            <h1>{pct >= 70 ? 'Strong work.' : pct >= 40 ? 'Good progress.' : "Let's build from here."}</h1>
            <p>
              You answered {attempt.totalAttempted} of {questions.length} questions in {formatTimer(attempt.timeTakenSeconds)}.
            </p>
            <Link href={backHref} className="btn btn-secondary">
              <ArrowLeft size={14} /> {backLabel}
            </Link>
          </div>
        </div>
        <div className="stats-grid">
          <Stat label="Correct answers" value={String(attempt.score)} icon={<Check />} />
          <Stat label="Wrong answers" value={String(wrong)} icon={<X />} />
          <Stat label="Skipped" value={String(skipped)} icon={<FileText />} />
          <Stat label="Time taken" value={formatTimer(attempt.timeTakenSeconds)} icon={<Clock3 />} />
        </div>
        <div className="review-list">
          {questions.map((q, i) => {
            const chosen = attempt.answers[i];
            return (
              <Card key={q.id}>
                <div className="question-number">
                  QUESTION {i + 1} · {chosen === undefined ? 'SKIPPED' : chosen === q.answer ? 'CORRECT' : 'WRONG'}
                </div>
                <h3 className="question-text">{q.text}</h3>
                {q.options.map((o, oi) => {
                  let cls = 'question-option';
                  if (oi === q.answer) cls += ' correct';
                  else if (oi === chosen) cls += ' wrong';
                  return (
                    <div key={oi} className={cls}>
                      <span className="option-letter">{String.fromCharCode(65 + oi)}</span>
                      {o}
                    </div>
                  );
                })}
                <div className="explanation">
                  <b>Explanation</b>
                  <p>{q.explanation}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
