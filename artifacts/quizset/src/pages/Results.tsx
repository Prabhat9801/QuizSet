import { useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { ArrowLeft, Check, Clock3, FileText, MessageSquareQuote, X } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Skeleton, Stat } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { attemptService, courseService, testimonialService, type CourseWithCount } from '@/services/api';
import { Attempt, Course, Question, Testimonial } from '@/types';
import { formatTimer } from '@/lib/format';

/** History list — the page that couldn't exist before, because attempts were never saved anywhere. */
export function ResultsHistory() {
  const { user } = useApp();
  const [rows, setRows] = useState<(Attempt & { courseName: string })[] | null>(null);

  useEffect(() => {
    if (!user) return;
    attemptService.listForStudent(user.id).then(async (attempts) => {
      const withNames = await Promise.all(
        attempts.map(async (a) => ({ ...a, courseName: (await courseService.get(a.courseId))?.name || 'Course' }))
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
                    <b>{r.courseName}</b>
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

      <ShareStoryCard />
    </>
  );
}

const TESTIMONIAL_STATUS: Record<string, { label: string; tone: 'neutral' | 'info' | 'success' }> = {
  pending: { label: 'Pending coaching review', tone: 'neutral' },
  coaching: { label: 'Pending QuizSet review', tone: 'info' },
  public: { label: 'Public', tone: 'success' },
};

function testimonialStatus(t: Testimonial) {
  if (t.coachingApproved && t.platformApproved) return TESTIMONIAL_STATUS.public;
  if (t.coachingApproved) return TESTIMONIAL_STATUS.coaching;
  return TESTIMONIAL_STATUS.pending;
}

/**
 * A student's own one-time-ish submit form, sitting on their results page rather than getting a
 * dedicated nav item — see CLAUDE.md's guidance for this feature. A testimonial only goes public
 * once BOTH the coaching owner and the platform owner approve it (two separate, sequential gates);
 * this component only ever writes the initial, doubly-unapproved row.
 */
function ShareStoryCard() {
  const { user, tenantId, toast } = useApp();
  const [courses, setCourses] = useState<CourseWithCount[]>([]);
  const [mine, setMine] = useState<Testimonial[]>([]);
  const [courseId, setCourseId] = useState('');
  const [content, setContent] = useState('');
  const [outcome, setOutcome] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !tenantId) return;
    courseService.listForStudent(tenantId, user.id).then(setCourses);
    testimonialService.listForTenant(tenantId).then((all) => setMine(all.filter((t) => t.studentId === user.id)));
  }, [user, tenantId]);

  const submit = async () => {
    if (!user || !tenantId || !content.trim()) return;
    setSubmitting(true);
    try {
      const course = courses.find((c) => c.id === courseId);
      const created = await testimonialService.submit({
        studentId: user.id,
        studentName: user.name,
        tenantId,
        courseId: course?.id,
        courseName: course?.name,
        content: content.trim(),
        outcome: outcome.trim() || undefined,
      });
      setMine((m) => [created, ...m]);
      setContent('');
      setOutcome('');
      setCourseId('');
      toast('Thanks for sharing!', 'Your story is now with your coaching for review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ marginTop: 18 }}>
      <div className="card-title">
        <div>
          <h2>
            <MessageSquareQuote size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Share your story
          </h2>
          <p>Tell your coaching how it's going — with your and their approval, it may get featured publicly.</p>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Which course? (optional)" htmlFor="story-course">
          <select id="story-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} data-testid="select-testimonial-course">
            <option value="">General feedback</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Outcome (optional)" htmlFor="story-outcome">
          <input id="story-outcome" type="text" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Scored 92% in the mock test" data-testid="input-testimonial-outcome" />
        </Field>
      </div>
      <Field label="Your story" required htmlFor="story-content">
        <textarea
          id="story-content"
          className="form-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What changed for you since joining? Be as specific as you like."
          data-testid="textarea-testimonial-content"
        />
      </Field>
      <div className="form-actions">
        <Button onClick={submit} disabled={submitting || !content.trim()} data-testid="button-submit-testimonial">
          {submitting ? 'Sending…' : 'Submit story'}
        </Button>
      </div>

      {mine.length > 0 && (
        <div className="testimonial-mine-list">
          <p className="bank-count">Your submissions</p>
          {mine.map((t) => {
            const status = testimonialStatus(t);
            return (
              <div className="testimonial-mine-row" key={t.id}>
                <div>
                  <b>{t.courseName || 'General feedback'}</b>
                  <small>{t.content}</small>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** Question-by-question review of one saved attempt — the student's own history. */
export function ResultReview() {
  const [, params] = useRoute('/student/results/:id');
  if (!params?.id) return null;
  return <AttemptReviewBody attemptId={params.id} backHref="/student/results" backLabel="Back to results" />;
}

/**
 * Same review, reached from a coaching owner's per-course student dashboard
 * instead of the student's own history — attemptService.get() has no
 * ownership check, so this is safe to reuse as-is, just with a different
 * back link and route (gated to the coaching role, not student).
 */
export function CoachingAttemptReview() {
  const [, params] = useRoute('/coaching/courses/:courseId/results/:id');
  if (!params?.id || !params?.courseId) return null;
  return <AttemptReviewBody attemptId={params.id} backHref={`/coaching/courses/${params.courseId}/students`} backLabel="Back to student dashboard" />;
}

function AttemptReviewBody({ attemptId, backHref, backLabel }: { attemptId: string; backHref: string; backLabel: string }) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);

  useEffect(() => {
    attemptService.get(attemptId).then(async (a) => {
      if (!a) return;
      setAttempt(a);
      const [c, { questionService }] = await Promise.all([courseService.get(a.courseId), import('@/services/api')]);
      setCourse(c || null);
      const allInBank = c ? await questionService.listByCourse(c.id) : [];
      // Reconstruct in the exact order the attempt recorded, not the bank's current order.
      setQuestions(a.questionIds.map((id) => allInBank.find((q) => q.id === id)).filter(Boolean) as Question[]);
    });
  }, [attemptId]);

  if (!attempt || !course || !questions) return <Skeleton className="skeleton-page" />;

  const pct = attempt.totalAttempted ? Math.round((attempt.score / attempt.totalAttempted) * 100) : 0;
  const wrong = attempt.totalAttempted - attempt.score;
  const skipped = questions.length - attempt.totalAttempted;

  return (
    <div className="exam-interface">
      <div className="exam-top">
        <div>
          <h1>{course.name}</h1>
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
