import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, FileText, ListTree, Lock, Play, Sparkles } from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { Badge, Button, Card, Modal, PageHeader, Skeleton } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { courseService, CourseWithCount, paymentService, questionService } from '@/services/api';
import { Question } from '@/types';
import { formatRupees } from '@/lib/format';

// ------------------------------------------------------------------ library
export function StudentCourses() {
  const { tenant, tenantId, user } = useApp();
  const [items, setItems] = useState<CourseWithCount[] | null>(null);

  useEffect(() => {
    if (tenantId && user) courseService.listForStudent(tenantId, user.id).then((all) => setItems(all.filter((c) => c.status === 'Published')));
  }, [tenantId, user]);

  if (!items) return <Skeleton className="skeleton-page" />;

  return (
    <>
      <PageHeader eyebrow={tenant.name} title="Course library" description="A focused set of courses for your next step." />
      <div className="exam-grid">
        {items.map((c) => (
          <StudentMarketCard course={c} key={c.id} />
        ))}
      </div>
    </>
  );
}

function StudentMarketCard({ course }: { course: CourseWithCount }) {
  const { user } = useApp();
  const purchased = course.sale === 0 || (user ? paymentService.hasPurchased(user.id, 'course', course.id) : false);
  return (
    <Card className="exam-card market-card">
      <div className="exam-accent" />
      <div className="market-top">
        <Badge tone={purchased ? 'success' : 'info'}>{purchased ? (course.sale === 0 ? 'FREE' : 'PURCHASED') : 'AVAILABLE'}</Badge>
      </div>
      <h3>{course.name}</h3>
      <p>{course.subject}</p>
      <div className="exam-meta">
        <span>
          <FileText size={12} />
          {course.questionCount} questions
        </span>
      </div>
      <div className="price">
        <strong>{course.sale ? formatRupees(course.sale) : 'Free'}</strong>
        {course.mrp > course.sale && (
          <>
            <del>{formatRupees(course.mrp)}</del>
            <i>Save {Math.round(((course.mrp - course.sale) / course.mrp) * 100)}%</i>
          </>
        )}
      </div>
      <div className="market-actions">
        <Link href={`/student/courses/${course.id}`} className="btn btn-ghost" style={{ width: '100%' }}>
          View course <ArrowRight size={14} />
        </Link>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------- detail
export function CourseDetail() {
  const [, params] = useRoute('/student/courses/:id');
  const { user, toast } = useApp();
  const [course, setCourse] = useState<CourseWithCount | null>(null);
  const [pay, setPay] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (params?.id) courseService.getWithCount(params.id).then((c) => setCourse(c || null));
  }, [params?.id]);

  if (!course || !user) return <Skeleton className="skeleton-page" />;

  const purchased = course.sale === 0 || paymentService.hasPurchased(user.id, 'course', course.id);

  const buy = async () => {
    setProcessing(true);
    const tx = await paymentService.purchase({ tenantId: course.tenantId, studentId: user.id, kind: 'course', refId: course.id, label: course.name, amount: course.sale });
    setProcessing(false);
    setDone(true);
    toast('Payment successful', `Transaction ${tx.id} saved to your account.`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Course details"
        title={course.name}
        description={course.description || 'A clear preview before you commit your focus.'}
        action={
          <Link href="/student/courses" className="btn btn-ghost">
            <ArrowLeft size={14} /> Back to library
          </Link>
        }
      />
      <div className="exam-detail-grid">
        <Card className="exam-detail-hero">
          <Badge tone={purchased ? 'success' : 'info'}>{purchased ? 'UNLOCKED' : 'AVAILABLE'}</Badge>
          <h2>{course.name}</h2>
          <p>{course.subject}</p>
          <div className="detail-metrics">
            <div>
              <b>{course.questionCount}</b>
              <small>Questions</small>
            </div>
            <div>
              <b>No timer</b>
              <small>Practice at your own pace</small>
            </div>
            <div>
              <b>{course.preview}</b>
              <small>Free preview</small>
            </div>
          </div>
          <div className="detail-cta">
            {purchased ? (
              <Link href={`/student/courses/${course.id}/setup`} className="btn btn-primary">
                <Play size={15} /> Start practice
              </Link>
            ) : (
              <>
                {course.preview > 0 && (
                  <Link href={`/student/courses/${course.id}/preview`} className="btn btn-ghost">
                    <Eye size={15} /> Try free preview
                  </Link>
                )}
                <Button onClick={() => setPay(true)}>
                  <Lock size={14} /> Unlock for {formatRupees(course.sale)}
                </Button>
              </>
            )}
            <Link href={`/student/courses/${course.id}/syllabus`} className="btn btn-ghost">
              <ListTree size={15} /> Syllabus
            </Link>
          </div>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <h2>What you'll practise</h2>
              <p>Topic-wise, Unit-wise, Multi-unit or Custom — pick your scope each time you practise</p>
            </div>
          </div>
          <div className="ai-box">
            <Sparkles size={17} />
            <p>{course.preview > 0 && !purchased ? 'Start with the free preview. It covers the question style and difficulty you’ll see in the full course.' : 'Choose a practice mode, answer at a comfortable pace, and review the explanation after every question you get wrong.'}</p>
          </div>
        </Card>
      </div>
      {pay && (
        <Modal title={done ? 'Payment complete' : 'Unlock your course'} onClose={() => !processing && setPay(false)}>
          {done ? (
            <div className="success-panel">
              <CheckCircle2 size={30} />
              <h3>Your course is unlocked.</h3>
              <p>Payment simulated successfully.</p>
              <Link href={`/student/courses/${course.id}/setup`} className="btn btn-primary">
                Start practice
              </Link>
            </div>
          ) : (
            <>
              <div className="payment-summary">
                <span>{course.name}</span>
                <b>{formatRupees(course.sale)}</b>
                {course.mrp > course.sale && (
                  <small>
                    Original price {formatRupees(course.mrp)} · {Math.round(((course.mrp - course.sale) / course.mrp) * 100)}% saved
                  </small>
                )}
              </div>
              <div className="payment-methods">
                <button className="selected">UPI</button>
                <button>Card</button>
                <button>Net banking</button>
              </div>
              <Button disabled={processing} onClick={buy} style={{ width: '100%' }}>
                {processing ? (
                  <>
                    <span className="loading-dot" /> Processing secure payment…
                  </>
                ) : (
                  <>
                    Complete payment <ArrowRight size={14} />
                  </>
                )}
              </Button>
              <small className="payment-note">This is a simulated payment for the demo workspace.</small>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------------ preview
export function Preview() {
  const [, params] = useRoute('/student/courses/:id/preview');
  const [course, setCourse] = useState<CourseWithCount | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  useEffect(() => {
    if (!params?.id) return;
    courseService.getWithCount(params.id).then(async (c) => {
      if (!c) return;
      setCourse(c);
      const all = await questionService.listByCourse(c.id);
      setQuestions(all.slice(0, c.preview));
    });
  }, [params?.id]);

  if (!course || !questions) return <Skeleton className="skeleton-page" />;
  if (questions.length === 0) return <div className="exam-interface" />;

  const q = questions[index];

  return (
    <div className="exam-interface">
      <div className="exam-top">
        <div>
          <h1>{course.name}</h1>
          <p>
            Free preview · {index + 1} of {questions.length} questions
          </p>
        </div>
        <Badge tone="info">PREVIEW MODE</Badge>
      </div>
      <div className="content">
        <div className="preview-banner">
          <Sparkles size={16} />
          <span>
            <b>You're exploring the first {questions.length} questions for free.</b>
            <small>Unlock the full course whenever you're ready.</small>
          </span>
          <Link href={`/student/courses/${course.id}`} className="btn btn-secondary">
            View full course
          </Link>
        </div>
        <Card className="preview-question">
          <div className="question-number">
            QUESTION {index + 1} OF {questions.length}
          </div>
          <h2>{q.text}</h2>
          {q.options.map((o, i) => (
            <button
              className={`question-option ${answers[index] === i ? 'selected' : ''}`}
              key={i}
              onClick={() =>
                setAnswers((x) => {
                  const a = [...x];
                  a[index] = i;
                  return a;
                })
              }
            >
              <span className="option-letter">{String.fromCharCode(65 + i)}</span>
              {o}
            </button>
          ))}
          <div className="form-actions">
            <Button variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              Previous
            </Button>
            {index === questions.length - 1 ? (
              <Link href={`/student/courses/${course.id}`} className="btn btn-primary">
                Finish preview <ArrowRight size={14} />
              </Link>
            ) : (
              <Button onClick={() => setIndex(index + 1)}>
                Next question <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
