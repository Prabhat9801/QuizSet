import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Send } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Alert, Button, Card, Field, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { examService } from '@/services/mock';
import { ExamType } from '@/types';
import { formatRupees } from '@/lib/format';

const STEPS = ['Basic details', 'Configuration', 'Pricing', 'Review & create'];
const EXAM_TYPES: ExamType[] = ['Practice Quiz', 'Mock Test', 'Live Test', 'Previous Year', 'Topic-wise'];

/**
 * Exam-first, bank-second: a question bank is always requested FOR a
 * specific exam (see QuestionBanks.tsx), so it can't be chosen here — the
 * exam has to exist first. This wizard creates a Draft exam with no bank
 * yet; the "Request question bank" step happens from ExamEdit right after.
 */
export function CreateExam() {
  const { tenantId, toast } = useApp();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', description: '', subject: 'General', type: 'Mock Test' as ExamType, duration: '30', mrp: '', sale: '0', preview: '5' });

  const salePaise = Math.max(0, Number(form.sale) || 0);
  const mrpPaise = form.mrp.trim() ? Math.max(0, Number(form.mrp) || 0) : 0;
  const invalidMrp = mrpPaise > 0 && mrpPaise < salePaise;

  const finish = async () => {
    if (!tenantId || !form.name.trim()) return;
    const exam = await examService.create({
      tenantId,
      name: form.name.trim(),
      description: form.description || undefined,
      subject: form.subject || 'General',
      type: form.type,
      duration: form.type === 'Practice Quiz' ? 0 : Math.max(0, Number(form.duration) || 0),
      mrp: mrpPaise || salePaise,
      sale: salePaise,
      preview: Math.max(0, Number(form.preview) || 0),
      status: 'Draft',
    });
    toast('Exam created', 'Request a question bank next — it stays in Draft until that bank is finalized.');
    navigate(`/coaching/exams/${exam.id}`);
  };

  const next = () => {
    if (step === 0 && !form.name.trim()) {
      toast('Name your exam', 'Give it a clear name before continuing.', 'danger');
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  return (
    <>
      <PageHeader
        eyebrow="Exam studio"
        title="Create an exam"
        description="Set the shape of the assessment now — you'll request its question bank right after."
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
              <Field label="Subject">
                <input className="form-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Quantitative Aptitude, General English…" />
              </Field>
              <Field label="Description">
                <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will this exam help learners practise?" />
              </Field>
            </>
          )}

          {step === 1 && (
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

          {step === 2 && (
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

          {step === 3 && (
            <>
              <h2 className="wizard-title">Ready to create.</h2>
              <p className="wizard-sub">This exam starts in Draft — you'll request its question bank next, and can only publish once that bank is finalized.</p>
              <div className="publish-summary">
                <b>{form.name || 'Untitled exam'}</b>
                <span>
                  {form.type} · {form.subject} · {form.type === 'Practice Quiz' ? 'No timer' : `${form.duration} minutes`} · {salePaise ? formatRupees(salePaise) : 'Free'}
                </span>
              </div>
            </>
          )}

          <div className="form-actions">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>
              Previous
            </Button>
            {step === STEPS.length - 1 ? (
              <Button onClick={finish} disabled={invalidMrp || !form.name.trim()}>
                <Send size={14} /> Create exam
              </Button>
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
