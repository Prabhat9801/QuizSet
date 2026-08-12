import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Send } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Alert, Button, Card, Field, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { courseService } from '@/services/api';
import { formatRupees } from '@/lib/format';

const STEPS = ['Basic details', 'Pricing', 'Review & create'];

/**
 * Course-first, bank-second: a question bank is always requested FOR a
 * specific course (see QuestionBanks.tsx), so it can't be chosen here — the
 * course has to exist first. This wizard creates a Draft course with no bank
 * yet; the "Request question bank" step happens from CourseEdit right after.
 *
 * No "type" or duration step — every course gets the exact same complete
 * practice system (Topic-wise/Unit-wise/Multi-unit/Custom/Full, always
 * untimed and personal to each student). A timed, scheduled, one-shot test
 * is a separate Live Test, not a course setting.
 */
export function CreateCourse() {
  const { tenantId, toast } = useApp();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', description: '', subject: 'General', mrp: '', sale: '0', preview: '5' });

  const salePaise = Math.max(0, Number(form.sale) || 0);
  const mrpPaise = form.mrp.trim() ? Math.max(0, Number(form.mrp) || 0) : 0;
  const invalidMrp = mrpPaise > 0 && mrpPaise < salePaise;

  const finish = async () => {
    if (!tenantId || !form.name.trim()) return;
    const course = await courseService.create({
      tenantId,
      name: form.name.trim(),
      description: form.description || undefined,
      subject: form.subject || 'General',
      mrp: mrpPaise || salePaise,
      sale: salePaise,
      preview: Math.max(0, Number(form.preview) || 0),
      status: 'Draft',
    });
    toast('Practice set created', 'Request a question bank next — it stays in Draft until that bank is finalized.');
    navigate(`/coaching/courses/${course.id}`);
  };

  const next = () => {
    if (step === 0 && !form.name.trim()) {
      toast('Name your practice set', 'Give it a clear name before continuing.', 'danger');
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  return (
    <>
      <PageHeader
        eyebrow="Practice set studio"
        title="Create a practice set"
        description="Set the shape of the practice set now — you'll request its question bank right after."
        action={
          <Link href="/coaching/courses" className="btn btn-ghost">
            <ArrowLeft size={14} /> Back to practice sets
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
              <h2 className="wizard-title">Give your practice set a clear shape.</h2>
              <p className="wizard-sub">Students should know what this practice set is for before they start. It'll come with its own complete practice system — Topic-wise, Unit-wise, Multi-unit, Custom and Full, all untimed.</p>
              <Field label="Practice set name" required>
                <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="SSC CGL 2026 preparation" />
              </Field>
              <Field label="Subject">
                <input className="form-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Quantitative Aptitude, General English…" />
              </Field>
              <Field label="Description">
                <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will this practice set help learners practise?" />
              </Field>
            </>
          )}

          {step === 1 && (
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

          {step === 2 && (
            <>
              <h2 className="wizard-title">Ready to create.</h2>
              <p className="wizard-sub">This practice set starts in Draft — you'll request its question bank next, and can only publish once that bank is finalized.</p>
              <div className="publish-summary">
                <b>{form.name || 'Untitled practice set'}</b>
                <span>
                  {form.subject} · {salePaise ? formatRupees(salePaise) : 'Free'}
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
                <Send size={14} /> Create practice set
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
