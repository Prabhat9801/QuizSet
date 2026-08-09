import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Lock, Send } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Alert, Badge, Button, Card, Field, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { examService, questionBankService } from '@/services/mock';
import { ExamType, QuestionBank } from '@/types';
import { formatRupees } from '@/lib/format';

const STEPS = ['Basic details', 'Question bank', 'Configuration', 'Pricing', 'Publishing'];
const EXAM_TYPES: ExamType[] = ['Practice Quiz', 'Mock Test', 'Live Test', 'Previous Year', 'Topic-wise'];

export function CreateExam() {
  const { tenant, tenantId, toast } = useApp();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [form, setForm] = useState({ name: '', description: '', type: 'Mock Test' as ExamType, questionBankId: '', duration: '30', mrp: '', sale: '0', preview: '5', subject: 'General' });

  useEffect(() => {
    if (tenantId) questionBankService.list(tenantId).then(setBanks);
  }, [tenantId]);

  const readyBanks = banks.filter((b) => b.status === 'Ready');
  const canProceedFromBankStep = Boolean(form.questionBankId);

  const salePaise = Math.max(0, Number(form.sale) || 0);
  const mrpPaise = form.mrp.trim() ? Math.max(0, Number(form.mrp) || 0) : 0;
  const invalidMrp = mrpPaise > 0 && mrpPaise < salePaise;

  const finish = async (status: 'Draft' | 'Published') => {
    if (!tenantId || !form.questionBankId) return;
    const bank = banks.find((b) => b.id === form.questionBankId);
    const exam = await examService.create({
      tenantId,
      questionBankId: form.questionBankId,
      name: form.name || 'New Assessment',
      description: form.description || undefined,
      type: form.type,
      duration: form.type === 'Practice Quiz' ? 0 : Math.max(0, Number(form.duration) || 0),
      mrp: mrpPaise || salePaise,
      sale: salePaise,
      preview: Math.max(0, Number(form.preview) || 0),
      status,
      subject: bank?.subject || 'General',
    });
    toast(status === 'Published' ? 'Exam published' : 'Draft saved', status === 'Published' ? 'Your assessment is live in the learner library.' : 'You can publish it later from the exams list.');
    navigate(`/coaching/exams/${exam.id}`);
  };

  const next = () => {
    if (step === 1 && !canProceedFromBankStep) {
      toast('Choose a question bank', 'Select a ready bank to continue.', 'danger');
      return;
    }
    if (step < 4) setStep(step + 1);
    else finish('Published');
  };

  return (
    <>
      <PageHeader
        eyebrow="Exam studio"
        title="Create an exam"
        description="A five-step path from a good question bank to a useful assessment."
        action={
          <Link href="/coaching/exams" className="btn btn-ghost">
            <ArrowLeft size={14} /> Back to exams
          </Link>
        }
      />
      <div className="wizard">
        <Card className="wizard-steps">
          {STEPS.map((s, i) => (
            <div className={`wizard-step ${step === i ? 'active' : ''}`} key={s}>
              <span>{i < step ? <Check size={13} /> : i + 1}</span>
              {s}
            </div>
          ))}
        </Card>
        <Card>
          {step === 0 && (
            <>
              <h2 className="wizard-title">Give your exam a clear shape.</h2>
              <p className="wizard-sub">Students should know what this assessment is for before they start.</p>
              <div className="form-grid">
                <Field label="Exam name" required>
                  <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="SSC CGL Premium Mock Test" />
                </Field>
                <Field label="Exam type">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ExamType })}>
                    {EXAM_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will this exam help learners practise?" />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="wizard-title">Choose the question bank.</h2>
              <p className="wizard-sub">Only banks marked "Ready" can power an exam.</p>
              {readyBanks.length === 0 ? (
                <Alert tone="warning">No ready banks yet. Request one from Question Banks first.</Alert>
              ) : (
                <div className="choice-list">
                  {banks.map((b) => (
                    <div className={`choice ${form.questionBankId === b.id ? 'selected' : ''} ${b.status !== 'Ready' ? 'disabled' : ''}`} key={b.id} onClick={() => b.status === 'Ready' && setForm({ ...form, questionBankId: b.id, subject: b.subject })}>
                      <BookOpen size={18} />
                      <div>
                        <b>{b.name}</b>
                        <small>{b.subject} · {b.status}</small>
                      </div>
                      {b.status === 'Ready' ? form.questionBankId === b.id ? <Check size={16} /> : null : <Lock size={15} />}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="wizard-title">Tune the experience.</h2>
              <p className="wizard-sub">
                {form.type === 'Practice Quiz' ? 'Practice quizzes have no timer — students answer at their own pace with instant feedback.' : 'Set the pace and challenge for your learners.'}
              </p>
              {form.type !== 'Practice Quiz' && (
                <Field label="Duration (minutes)">
                  <input className="form-input" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                </Field>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="wizard-title">Put a thoughtful price on it.</h2>
              <p className="wizard-sub">Make the value clear. A free preview helps students decide with confidence.</p>
              <div className="form-grid">
                <Field label="MRP (₹)">
                  <input className="form-input" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} placeholder="Optional" />
                </Field>
                <Field label="Sale price (₹)">
                  <input className="form-input" value={form.sale} onChange={(e) => setForm({ ...form, sale: e.target.value })} />
                </Field>
                <Field label="Free preview questions">
                  <input className="form-input" value={form.preview} onChange={(e) => setForm({ ...form, preview: e.target.value })} />
                </Field>
              </div>
              {invalidMrp && <Alert tone="danger">MRP cannot be lower than the sale price.</Alert>}
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="wizard-title">Ready to publish.</h2>
              <p className="wizard-sub">Review the essentials before your students see it.</p>
              <div className="publish-summary">
                <b>{form.name || 'Untitled exam'}</b>
                <span>
                  {form.type} · {form.type === 'Practice Quiz' ? 'No timer' : `${form.duration} minutes`} · {salePaise ? formatRupees(salePaise) : 'Free'}
                </span>
                <Badge tone={form.questionBankId ? 'success' : 'danger'}>{form.questionBankId ? 'Question bank linked' : 'No question bank selected'}</Badge>
              </div>
            </>
          )}

          <div className="form-actions">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>
              Previous
            </Button>
            {step === 4 ? (
              <>
                <Button variant="secondary" onClick={() => finish('Draft')}>
                  Save as draft
                </Button>
                <Button onClick={() => finish('Published')} disabled={invalidMrp || !form.questionBankId}>
                  <Send size={14} /> Publish exam
                </Button>
              </>
            ) : (
              <Button onClick={next}>
                Continue <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
