import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link, useLocation, useRoute } from 'wouter';
import { Alert, Badge, Button, Card, PageHeader, Skeleton } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { attemptService, courseService, questionService } from '@/services/api';
import { Course, Question } from '@/types';
import { getPracticeSet, practiceSetCount } from '@/lib/practiceSets';
import { setPendingPractice } from '@/lib/practiceHandoff';

/** How many fixed sets each course offers — matches the two original apps
 * this feature is ported from: 50 for the Chemistry/Physics/Maths bank
 * (Lab Assistant Science), 30 for the ITI Electronics bank (Electronic
 * Mechanic / Radio & TV). Any other course's subject falls back to whatever
 * its real question count supports, capped at 50, rather than hardcoding a
 * number that assumes only these two courses will ever exist. */
function maxSetsFor(subject: string): number {
  if (subject === 'Electronics') return 30;
  return 50;
}

/**
 * Fixed, pre-baked 100-question worksheets — same seeded shuffle every time,
 * so "Set 12" is always the same 100 questions for every student. Ported
 * from the original kundan_quiz (50 sets) / quiz-ITI (30 sets) apps' own
 * Practice Sets page. Unlike QuizSetup's scoped modes, a set's question list
 * is computed once here and handed straight to the attempt — no server pick
 * needed, since it's fully deterministic from the course's real question pool.
 *
 * Shared between the standalone `/practice-sets` route below AND QuizSetup's
 * "Practice Sets" mode card, which renders this same picker inline as its
 * selector rather than sending the student to a separate page — every other
 * mode (Topic-wise, Unit-wise, etc.) works that way too, so Practice Sets
 * shouldn't be the only mode that navigates elsewhere just to pick a scope.
 */
export function PracticeSetPicker({ course, all }: { course: Course; all: Question[] }) {
  const { user } = useApp();
  const [, navigate] = useLocation();
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [openSet, setOpenSet] = useState<number | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerMinutes, setTimerMinutes] = useState('90');

  useEffect(() => {
    if (!user) return;
    attemptService.listForStudent(user.id).then((attempts) => {
      const done = new Set<number>();
      for (const a of attempts) {
        if (a.courseId === course.id && a.practiceScope?.mode === 'set') done.add(a.practiceScope.setNumber);
      }
      setCompleted(done);
    });
  }, [course.id, user]);

  const totalSets = useMemo(() => practiceSetCount(all.length, maxSetsFor(course.subject)), [course.subject, all.length]);

  const start = (setNumber: number) => {
    const questions = getPracticeSet(all, setNumber);
    const timerSeconds = timerEnabled ? Math.max(1, Number(timerMinutes) || 1) * 60 : undefined;
    setPendingPractice(course.id, { scope: { mode: 'set', setNumber }, questionIds: questions.map((q) => q.id), timerSeconds });
    navigate(`/student/courses/${course.id}/attempt`);
  };

  if (totalSets === 0) return <Alert tone="warning">This course's question bank isn't large enough yet for a fixed 100-question set.</Alert>;

  return (
    <>
      <p className="muted-hint" style={{ marginBottom: 14, display: 'block' }}>
        {totalSets} fixed sets, 100 questions each — the same set every time, so retrying "Set 5" always means the same 100 questions.
      </p>
      <div className="set-grid">
        {Array.from({ length: totalSets }, (_, i) => i + 1).map((n) => (
          <button key={n} className={`set-tile ${openSet === n ? 'selected' : ''}`} onClick={() => setOpenSet(openSet === n ? null : n)}>
            {completed.has(n) && (
              <span className="set-tile-check">
                <CheckCircle2 size={12} />
              </span>
            )}
            Set {n}
          </button>
        ))}
      </div>

      {openSet !== null && (
        <div className="set-detail">
          <div className="card-title">
            <div>
              <h2>Practice Set {openSet} — 100 questions</h2>
              <p>{completed.has(openSet) ? 'Already completed — you can retry any time, same 100 questions.' : 'A fixed worksheet, exam-style — feedback shows after each question, same as any other practice run.'}</p>
            </div>
            {completed.has(openSet) && <Badge tone="success">Completed</Badge>}
          </div>
          <label className="task" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} />
            <span>Set a timer</span>
          </label>
          {timerEnabled && (
            <div className="timer-minutes-row" style={{ marginBottom: 16 }}>
              <input
                className="form-input"
                style={{ maxWidth: 100 }}
                value={timerMinutes}
                onChange={(e) => setTimerMinutes(e.target.value)}
                onBlur={() => setTimerMinutes(String(Math.max(1, Number(timerMinutes) || 1)))}
                inputMode="numeric"
              />
              <span>minutes</span>
            </div>
          )}
          <div className="form-actions">
            <Button onClick={() => start(openSet)}>
              Start Set {openSet} <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Standalone page — still linked from CourseDetail for a direct way in,
 * kept alongside the inline QuizSetup mode rather than removed, since a
 * bookmarked/shared link to it should keep working. */
export function PracticeSets() {
  const [, params] = useRoute('/student/courses/:id/practice-sets');
  const [course, setCourse] = useState<Course | null>(null);
  const [all, setAll] = useState<Question[]>([]);

  useEffect(() => {
    if (!params?.id) return;
    courseService.get(params.id).then(async (c) => {
      if (!c) return;
      setCourse(c);
      setAll(await questionService.listByCourse(c.id));
    });
  }, [params?.id]);

  if (!course || all.length === 0) return <Skeleton className="skeleton-page" />;

  return (
    <>
      <PageHeader
        eyebrow="Practice sets"
        title={course.name}
        description="Fixed, pre-baked worksheets — pick a set below."
        action={
          <Link href={`/student/courses/${course.id}`} className="btn btn-ghost">
            <ArrowLeft size={14} /> Back
          </Link>
        }
      />
      <Card>
        <PracticeSetPicker course={course} all={all} />
      </Card>
    </>
  );
}
