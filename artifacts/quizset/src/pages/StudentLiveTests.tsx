import { useEffect, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { Clock3 } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { TimedQuizRunner } from '@/components/QuizRunner';
import { useApp } from '@/contexts/AppContext';
import { attemptService, courseService, liveTestService, questionService } from '@/services/api';
import { Course, LiveTest, LiveTestPhase, Question } from '@/types';
import { formatDateTime } from '@/lib/format';

const PHASE_TONE: Record<LiveTestPhase, 'neutral' | 'warning' | 'success' | 'info' | 'danger'> = {
  Draft: 'neutral',
  Upcoming: 'warning',
  Live: 'success',
  Ended: 'info',
  Cancelled: 'danger',
};

export function StudentLiveTests() {
  const { tenantId } = useApp();
  const [items, setItems] = useState<LiveTest[] | null>(null);

  useEffect(() => {
    if (tenantId) liveTestService.list(tenantId).then((all) => setItems(all.filter((t) => t.status === 'Published')));
  }, [tenantId]);

  if (!items) return <Skeleton className="skeleton-page" />;

  return (
    <>
      <PageHeader eyebrow="Scheduled together" title="Live tests" description="Time-boxed assessments your coaching has scheduled." />
      {items.length === 0 ? (
        <Card>
          <EmptyState title="No live tests scheduled" description="Check back once your coaching schedules one." />
        </Card>
      ) : (
        <div className="live-test-list">
          {items.map((t) => (
            <LiveTestRow key={t.id} test={t} />
          ))}
        </div>
      )}
    </>
  );
}

function LiveTestRow({ test }: { test: LiveTest }) {
  const { user } = useApp();
  const [attemptId, setAttemptId] = useState<string | null | undefined>(undefined);
  const phase = liveTestService.phase(test);

  useEffect(() => {
    if (!user) return;
    attemptService.findForLiveTest(user.id, test.id).then((a) => setAttemptId(a?.id ?? null));
  }, [user, test.id]);

  return (
    <Card className="live-test-card">
      <div className="request-top">
        <div>
          <b>{test.name}</b>
          <small>
            {formatDateTime(test.scheduledStart)} → {formatDateTime(test.scheduledEnd)}
          </small>
        </div>
        <Badge tone={PHASE_TONE[phase]}>{phase}</Badge>
      </div>
      <p className="request-meta">
        <Clock3 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        {test.durationMinutes} minutes
      </p>
      <div className="market-actions">
        {attemptId ? (
          <Link href={`/student/results/${attemptId}`} className="btn btn-ghost" style={{ width: '100%' }}>
            View result
          </Link>
        ) : phase === 'Live' ? (
          <Link href={`/student/live-tests/${test.id}/attempt`} className="btn btn-primary" style={{ width: '100%' }}>
            Join test now
          </Link>
        ) : phase === 'Upcoming' ? (
          <span className="btn btn-ghost disabled-look" style={{ width: '100%' }}>
            Opens {formatDateTime(test.scheduledStart)}
          </span>
        ) : (
          <span className="btn btn-ghost disabled-look" style={{ width: '100%' }}>
            {phase === 'Ended' ? 'Test window closed' : 'Cancelled'}
          </span>
        )}
      </div>
    </Card>
  );
}

/** The actual attempt experience — always timed, sourced from the linked course's question bank. */
export function LiveTestAttempt() {
  const [, params] = useRoute('/student/live-tests/:id/attempt');
  const [, navigate] = useLocation();
  const { user } = useApp();
  const [test, setTest] = useState<LiveTest | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!params?.id || !user) return;
    liveTestService.get(params.id).then(async (t) => {
      if (!t) return;
      const existing = await attemptService.findForLiveTest(user.id, t.id);
      if (existing) {
        navigate(`/student/results/${existing.id}`, { replace: true });
        return;
      }
      if (liveTestService.phase(t) !== 'Live') {
        setBlocked(true);
        return;
      }
      setTest(t);
      const c = await courseService.get(t.courseId);
      setCourse(c || null);
      if (!c) return;
      // A live test with a pre-picked scope stores its own fixed questionIds
      // (set once at creation time by pickLiveTestQuestions() server-side) —
      // read those specific questions instead of the whole course bank, so
      // every student sees the exact same scoped/weighted set. Falls back to
      // the full bank for a `mode: "full"` test or any pre-feature test row
      // that has no questionIds yet, matching the old, only-ever-behavior.
      if (t.questionIds && t.questionIds.length > 0) {
        setQuestions(await questionService.listByIds(t.id));
      } else {
        setQuestions(await questionService.listByCourse(c.id));
      }
    });
  }, [params?.id, user, navigate]);

  if (blocked) return <div className="exam-interface" />;
  if (!test || !course || !questions || !user) return <Skeleton className="skeleton-page" />;
  if (questions.length === 0) return <div className="exam-interface" />;

  const msLeftInWindow = new Date(test.scheduledEnd).getTime() - Date.now();
  const totalSeconds = Math.max(1, Math.min(test.durationMinutes * 60, Math.floor(msLeftInWindow / 1000)));

  const submit = async (answers: Record<number, number>, timeTakenSeconds: number) => {
    const score = questions.reduce((count, q, i) => (answers[i] === q.answer ? count + 1 : count), 0);
    const attempt = await attemptService.save({
      studentId: user.id,
      tenantId: test.tenantId,
      courseId: course.id,
      liveTestId: test.id,
      mode: 'timed',
      answers,
      questionIds: questions.map((q) => q.id),
      score,
      totalAttempted: Object.keys(answers).length,
      timeTakenSeconds,
    });
    navigate(`/student/results/${attempt.id}`, { replace: true });
  };

  return <TimedQuizRunner title={test.name} questions={questions} totalSeconds={totalSeconds} onSubmit={submit} />;
}
