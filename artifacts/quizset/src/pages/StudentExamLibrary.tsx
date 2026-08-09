import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Eye, FileText, Lock, Play, Sparkles } from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { Badge, Button, Card, Modal, PageHeader, Skeleton } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { examService, ExamWithCount, paymentService, questionService } from '@/services/mock';
import { Question } from '@/types';
import { formatRupees } from '@/lib/format';

// ------------------------------------------------------------------ library
export function StudentExams() {
  const { tenant, tenantId, user } = useApp();
  const [items, setItems] = useState<ExamWithCount[] | null>(null);

  useEffect(() => {
    if (tenantId && user) examService.listForStudent(tenantId, user.id).then((all) => setItems(all.filter((e) => e.status === 'Published')));
  }, [tenantId, user]);

  if (!items) return <Skeleton className="skeleton-page" />;

  return (
    <>
      <PageHeader eyebrow={tenant.name} title="Exam library" description="A focused set of assessments for your next step." />
      <div className="exam-grid">
        {items.map((e) => (
          <StudentMarketCard exam={e} key={e.id} />
        ))}
      </div>
    </>
  );
}

function StudentMarketCard({ exam }: { exam: ExamWithCount }) {
  const { user } = useApp();
  const purchased = exam.sale === 0 || (user ? paymentService.hasPurchased(user.id, 'exam', exam.id) : false);
  return (
    <Card className="exam-card market-card">
      <div className="exam-accent" />
      <div className="market-top">
        <Badge tone={purchased ? 'success' : 'info'}>{purchased ? (exam.sale === 0 ? 'FREE' : 'PURCHASED') : 'AVAILABLE'}</Badge>
      </div>
      <h3>{exam.name}</h3>
      <p>{exam.subject}</p>
      <div className="exam-meta">
        <span>
          <FileText size={12} />
          {exam.questionCount} questions
        </span>
        {exam.type !== 'Practice Quiz' && (
          <span>
            <Play size={12} />
            {exam.duration} minutes
          </span>
        )}
      </div>
      <div className="price">
        <strong>{exam.sale ? formatRupees(exam.sale) : 'Free'}</strong>
        {exam.mrp > exam.sale && (
          <>
            <del>{formatRupees(exam.mrp)}</del>
            <i>Save {Math.round(((exam.mrp - exam.sale) / exam.mrp) * 100)}%</i>
          </>
        )}
      </div>
      <div className="market-actions">
        <Link href={`/student/exams/${exam.id}`} className="btn btn-ghost" style={{ width: '100%' }}>
          View exam <ArrowRight size={14} />
        </Link>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------- detail
export function ExamDetail() {
  const [, params] = useRoute('/student/exams/:id');
  const { user, toast } = useApp();
  const [exam, setExam] = useState<ExamWithCount | null>(null);
  const [pay, setPay] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (params?.id) examService.getWithCount(params.id).then((e) => setExam(e || null));
  }, [params?.id]);

  if (!exam || !user) return <Skeleton className="skeleton-page" />;

  const purchased = exam.sale === 0 || paymentService.hasPurchased(user.id, 'exam', exam.id);

  const buy = async () => {
    setProcessing(true);
    const tx = await paymentService.purchase({ tenantId: exam.tenantId, studentId: user.id, kind: 'exam', refId: exam.id, label: exam.name, amount: exam.sale });
    setProcessing(false);
    setDone(true);
    toast('Payment successful', `Transaction ${tx.id} saved to your account.`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Exam details"
        title={exam.name}
        description={exam.description || 'A clear preview before you commit your focus.'}
        action={
          <Link href="/student/exams" className="btn btn-ghost">
            <ArrowLeft size={14} /> Back to library
          </Link>
        }
      />
      <div className="exam-detail-grid">
        <Card className="exam-detail-hero">
          <Badge tone={purchased ? 'success' : 'info'}>{purchased ? 'UNLOCKED' : 'AVAILABLE'}</Badge>
          <h2>{exam.name}</h2>
          <p>{exam.subject}</p>
          <div className="detail-metrics">
            <div>
              <b>{exam.questionCount}</b>
              <small>Questions</small>
            </div>
            <div>
              <b>{exam.type === 'Practice Quiz' ? 'No timer' : `${exam.duration} min`}</b>
              <small>{exam.type === 'Practice Quiz' ? 'Practice mode' : 'Duration'}</small>
            </div>
            <div>
              <b>{exam.preview}</b>
              <small>Free preview</small>
            </div>
          </div>
          <div className="detail-cta">
            {purchased ? (
              <Link href={exam.type === 'Practice Quiz' ? `/student/exams/${exam.id}/setup` : `/student/exams/${exam.id}/attempt`} className="btn btn-primary">
                <Play size={15} /> {exam.type === 'Practice Quiz' ? 'Start practice' : 'Start full exam'}
              </Link>
            ) : (
              <>
                {exam.preview > 0 && (
                  <Link href={`/student/exams/${exam.id}/preview`} className="btn btn-ghost">
                    <Eye size={15} /> Try free preview
                  </Link>
                )}
                <Button onClick={() => setPay(true)}>
                  <Lock size={14} /> Unlock for {formatRupees(exam.sale)}
                </Button>
              </>
            )}
          </div>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <h2>What you'll practise</h2>
              <p>Built for focused improvement</p>
            </div>
          </div>
          <div className="ai-box">
            <Sparkles size={17} />
            <p>{exam.preview > 0 && !purchased ? 'Start with the free preview. It covers the question style and difficulty you’ll see in the full test.' : 'Answer at a comfortable pace and review the explanation after every question you get wrong.'}</p>
          </div>
        </Card>
      </div>
      {pay && (
        <Modal title={done ? 'Payment complete' : 'Unlock your exam'} onClose={() => !processing && setPay(false)}>
          {done ? (
            <div className="success-panel">
              <CheckCircle2 size={30} />
              <h3>Your full exam is unlocked.</h3>
              <p>Payment simulated successfully.</p>
              <Link href={exam.type === 'Practice Quiz' ? `/student/exams/${exam.id}/setup` : `/student/exams/${exam.id}/attempt`} className="btn btn-primary">
                Start exam
              </Link>
            </div>
          ) : (
            <>
              <div className="payment-summary">
                <span>{exam.name}</span>
                <b>{formatRupees(exam.sale)}</b>
                {exam.mrp > exam.sale && (
                  <small>
                    Original price {formatRupees(exam.mrp)} · {Math.round(((exam.mrp - exam.sale) / exam.mrp) * 100)}% saved
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
  const [, params] = useRoute('/student/exams/:id/preview');
  const [exam, setExam] = useState<ExamWithCount | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  useEffect(() => {
    if (!params?.id) return;
    examService.getWithCount(params.id).then(async (e) => {
      if (!e) return;
      setExam(e);
      const all = await questionService.listByExam(e.id);
      setQuestions(all.slice(0, e.preview));
    });
  }, [params?.id]);

  if (!exam || !questions) return <Skeleton className="skeleton-page" />;
  if (questions.length === 0) return <div className="exam-interface" />;

  const q = questions[index];

  return (
    <div className="exam-interface">
      <div className="exam-top">
        <div>
          <h1>{exam.name}</h1>
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
            <small>Unlock the full exam whenever you're ready.</small>
          </span>
          <Link href={`/student/exams/${exam.id}`} className="btn btn-secondary">
            View full exam
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
              <Link href={`/student/exams/${exam.id}`} className="btn btn-primary">
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
