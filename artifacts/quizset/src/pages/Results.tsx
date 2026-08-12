import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { ArrowLeft, Check, Clock3, FileText, MessageSquareQuote, RotateCcw, Target, X } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Skeleton, Stat } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { attemptService, computeTopicBreakdown, courseService, questionService, testimonialService, type CourseWithCount } from '@/services/api';
import { Attempt, Course, PracticeScope, Question, Testimonial } from '@/types';
import { formatTimer } from '@/lib/format';
import { setPendingPractice } from '@/lib/practiceHandoff';

/** The 7 user-facing labels a student's attempt can be categorised under —
 * used for both the ResultsHistory mode filter and the per-row badge, so the
 * two always agree on what an attempt "is". */
const MODE_LABELS = ['Topic-wise', 'Unit-wise', 'Multi-unit', 'Custom', 'Full practice set', 'Practice Sets', 'Live Test'] as const;
type ModeLabel = (typeof MODE_LABELS)[number];

function modeLabel(a: Attempt): ModeLabel {
  if (a.mode === 'timed' || a.liveTestId) return 'Live Test';
  switch (a.practiceScope?.mode) {
    case 'topic':
      return 'Topic-wise';
    case 'unit':
      return 'Unit-wise';
    case 'multi-unit':
      return 'Multi-unit';
    case 'custom':
      return 'Custom';
    case 'set':
      return 'Practice Sets';
    case 'full':
    default:
      return 'Full practice set';
  }
}

/** History list — the page that couldn't exist before, because attempts were never saved anywhere. */
export function ResultsHistory() {
  const { user } = useApp();
  const [rows, setRows] = useState<(Attempt & { courseName: string })[] | null>(null);
  const [courseFilter, setCourseFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');

  useEffect(() => {
    if (!user) return;
    attemptService.listForStudent(user.id).then(async (attempts) => {
      const withNames = await Promise.all(
        attempts.map(async (a) => ({ ...a, courseName: (await courseService.get(a.courseId))?.name || 'Practice Set' }))
      );
      setRows(withNames);
    });
  }, [user]);

  // Distinct courses the student actually has attempts in — derived from
  // the fetched rows themselves (each already carries a denormalized
  // courseName), so no separate course-list fetch is needed just for this.
  const courseOptions = useMemo(() => {
    if (!rows) return [];
    const byId = new Map<string, string>();
    rows.forEach((r) => byId.set(r.courseId, r.courseName));
    return Array.from(byId.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => (courseFilter === 'All' || r.courseId === courseFilter) && (modeFilter === 'All' || modeLabel(r) === modeFilter));
  }, [rows, courseFilter, modeFilter]);

  if (!rows) return <Skeleton className="skeleton-page" />;

  return (
    <>
      <PageHeader eyebrow="Your progress" title="Results" description="Every attempt is a useful signal for your next one." />

      <OverallWeakTopics attempts={rows} />

      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No attempts yet" description="Take a practice quiz or an exam to see your results here." />
        </Card>
      ) : (
        <>
          <div className="filter-bar">
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} data-testid="select-filter-course">
              <option value="All">All practice sets</option>
              {courseOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} data-testid="select-filter-mode">
              <option value="All">All modes</option>
              {MODE_LABELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="filter-count">
              {filteredRows.length} of {rows.length}
            </span>
          </div>

          {filteredRows.length === 0 ? (
            <Card>
              <EmptyState title="No attempts match" description="Try a different practice set or mode." />
            </Card>
          ) : (
            <div className="result-list">
              {filteredRows.map((r) => {
                const pct = r.totalAttempted ? Math.round((r.score / r.totalAttempted) * 100) : 0;
                return (
                  <Link href={`/student/results/${r.id}`} key={r.id} className="result-row-link">
                    <Card className="result-row">
                      <div>
                        <b>{r.courseName}</b>
                        <small>
                          {new Date(r.createdAt).toLocaleDateString('en-IN')} · {r.totalAttempted} question{r.totalAttempted === 1 ? '' : 's'}
                        </small>
                        <div style={{ marginTop: 6 }}>
                          <Badge tone="neutral">{modeLabel(r)}</Badge>
                        </div>
                      </div>
                      <span className={`result-score-pill ${pct >= 70 ? 'good' : pct >= 40 ? 'ok' : 'bad'}`}>{pct}%</span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      <ShareStoryCard />
    </>
  );
}

/**
 * Overall (all courses, unaffected by the Task 1 filters) recommended focus
 * areas — reuses computeTopicBreakdown, but that needs the full question
 * pool for every course the student has ever attempted, so we fetch each
 * distinct course's bank once and merge them into one array before calling it.
 */
function OverallWeakTopics({ attempts }: { attempts: Attempt[] }) {
  const [rows, setRows] = useState<{ unit: string; topic: string; attempted: number; correct: number; courseId: string }[] | null>(null);

  useEffect(() => {
    if (attempts.length < 2) {
      setRows([]);
      return;
    }
    const courseIds = Array.from(new Set(attempts.map((a) => a.courseId)));
    Promise.all(courseIds.map((id) => questionService.listByCourse(id))).then((pools) => {
      const allQuestions = pools.flat();
      const breakdown = computeTopicBreakdown(attempts, allQuestions);
      // computeTopicBreakdown doesn't carry courseId (it aggregates purely by
      // unit/topic), so re-derive which course each topic belongs to from the
      // per-course pools we just fetched, for the "Practice this" deep link.
      const courseIdByUnitTopic = new Map<string, string>();
      courseIds.forEach((cid, i) => {
        pools[i].forEach((q) => {
          const key = `${q.unit}::${q.topic}`;
          if (!courseIdByUnitTopic.has(key)) courseIdByUnitTopic.set(key, cid);
        });
      });
      setRows(breakdown.map((r) => ({ ...r, courseId: courseIdByUnitTopic.get(`${r.unit}::${r.topic}`) || courseIds[0] })));
    });
  }, [attempts]);

  if (rows === null) return null;
  if (attempts.length < 2) return null;

  const worst = rows
    .filter((r) => r.attempted >= 2)
    .map((r) => ({ ...r, pct: r.attempted ? Math.round((r.correct / r.attempted) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  if (worst.length === 0) return null;

  return (
    <Card style={{ marginBottom: 18 }}>
      <div className="card-title">
        <div>
          <h2>
            <Target size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Recommended focus areas
          </h2>
          <p>Across every practice set you've attempted — your weakest topics, worth practising next.</p>
        </div>
      </div>
      <div className="activity-list">
        {worst.map((r) => (
          <div className="activity" key={`${r.unit}::${r.topic}`}>
            <span className="activity-dot" />
            <div>
              <b>{r.topic}</b>
              <small>
                {r.unit} · {r.correct}/{r.attempted} correct
              </small>
            </div>
            <Badge tone={r.pct >= 40 ? 'warning' : 'danger'}>{r.pct}%</Badge>
            <Link href={`/student/courses/${r.courseId}/setup?mode=unit&unit=${encodeURIComponent(r.unit)}`} className="text-link">
              Practice this
            </Link>
          </div>
        ))}
      </div>
    </Card>
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
        <Field label="Which practice set? (optional)" htmlFor="story-course">
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

/** This attempt's own topics-to-review — a small local group-by, deliberately
 * NOT computeTopicBreakdown (that's for aggregating many attempts; a single
 * attempt just needs its own questions grouped by unit+topic). */
function attemptWeakTopics(attempt: Attempt, questions: Question[]) {
  const rows = new Map<string, { unit: string; topic: string; correct: number; incorrect: number }>();
  questions.forEach((q, i) => {
    const chosen = attempt.answers[i];
    if (chosen === undefined) return; // skipped — doesn't count toward right/wrong for this breakdown
    const key = `${q.unit}::${q.topic}`;
    if (!rows.has(key)) rows.set(key, { unit: q.unit, topic: q.topic, correct: 0, incorrect: 0 });
    const row = rows.get(key)!;
    if (chosen === q.answer) row.correct += 1;
    else row.incorrect += 1;
  });
  const all = Array.from(rows.values());
  const weak = all.filter((r) => r.correct < r.incorrect || r.correct === 0);
  return { all, weak };
}

function AttemptReviewBody({ attemptId, backHref, backLabel }: { attemptId: string; backHref: string; backLabel: string }) {
  const [, navigate] = useLocation();
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

  // Retry only makes sense for a repeatable practice run — a Live Test is a
  // one-time scheduled event, so it never gets this button.
  const canRetry = attempt.mode === 'practice' && !attempt.liveTestId && !!attempt.practiceScope;

  const retry = () => {
    if (!attempt.practiceScope) return;
    // Deliberately bypasses attemptService.pickForPractice (the no-repeat
    // endpoint) entirely — we hand Attempt.tsx the SAME questionIds, in the
    // SAME order, that this attempt already recorded, via the same one-shot
    // sessionStorage handoff QuizSetup uses for a freshly-picked run.
    setPendingPractice(attempt.courseId, { scope: attempt.practiceScope, questionIds: attempt.questionIds });
    navigate(`/student/courses/${attempt.courseId}/attempt`);
  };

  const { weak } = attemptWeakTopics(attempt, questions);

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
            <div className="form-actions" style={{ justifyContent: 'flex-start', paddingTop: 0 }}>
              <Link href={backHref} className="btn btn-secondary">
                <ArrowLeft size={14} /> {backLabel}
              </Link>
              {canRetry && (
                <Button variant="secondary" onClick={retry} data-testid="button-retry-attempt">
                  <RotateCcw size={14} /> Retry this quiz
                </Button>
              )}
            </div>
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

        <Card style={{ marginTop: 18 }}>
          <div className="card-title">
            <div>
              <h2>
                <Target size={15} style={{ verticalAlign: '-3px', marginRight: 6 }} />
                Topics to review from this attempt
              </h2>
            </div>
          </div>
          {weak.length === 0 ? (
            <p className="modal-copy">You did well across every topic in this run!</p>
          ) : (
            <div className="activity-list">
              {weak.map((r) => (
                <div className="activity" key={`${r.unit}::${r.topic}`}>
                  <span className="activity-dot" />
                  <div>
                    <b>{r.topic}</b>
                    <small>
                      {r.unit} · {r.correct}/{r.correct + r.incorrect} correct
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
