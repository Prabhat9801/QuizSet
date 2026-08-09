import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Save, Users } from 'lucide-react';
import { Link, useLocation, useRoute } from 'wouter';
import { Alert, Button, Card, Checkbox, Field, PageHeader, Skeleton } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { examService, studentService } from '@/services/mock';
import { Exam, ExamType, Student } from '@/types';
import { formatRupees } from '@/lib/format';

const EXAM_TYPES: ExamType[] = ['Practice Quiz', 'Mock Test', 'Live Test', 'Previous Year', 'Topic-wise'];

/** Coaching-owner exam settings — the piece the original wizard-only flow was missing: editing an exam AFTER it's created. */
export function ExamEdit() {
  const [, params] = useRoute('/coaching/exams/:id');
  const [, navigate] = useLocation();
  const { tenantId, toast } = useApp();
  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState({ name: '', description: '', type: 'Mock Test' as ExamType, duration: '30', mrp: '', sale: '0', preview: '5', status: 'Draft' as Exam['status'] });
  const [restrictToSpecific, setRestrictToSpecific] = useState(false);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!params?.id || !tenantId) return;
    Promise.all([examService.get(params.id), studentService.list(tenantId)]).then(([e, studentList]) => {
      if (!e) return;
      setExam(e);
      setForm({ name: e.name, description: e.description || '', type: e.type, duration: String(e.duration), mrp: e.mrp ? String(e.mrp) : '', sale: String(e.sale), preview: String(e.preview), status: e.status });
      setStudents(studentList);
      setRestrictToSpecific(e.assignedStudentIds.length > 0);
      setAssignedIds(e.assignedStudentIds);
    });
  }, [params?.id, tenantId]);

  if (!exam) return <Skeleton className="skeleton-page" />;

  const salePaise = Math.max(0, Number(form.sale) || 0);
  const mrpPaise = form.mrp.trim() ? Math.max(0, Number(form.mrp) || 0) : 0;
  const invalidMrp = mrpPaise > 0 && mrpPaise < salePaise;

  const toggleStudent = (id: string) => {
    setAssignedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    if (invalidMrp) {
      toast('Fix pricing first', 'MRP cannot be lower than the sale price.', 'danger');
      return;
    }
    try {
      await examService.update(exam.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        duration: Math.max(0, Number(form.duration) || 0),
        mrp: mrpPaise || salePaise,
        sale: salePaise,
        preview: Math.max(0, Number(form.preview) || 0),
        status: form.status,
        assignedStudentIds: restrictToSpecific ? assignedIds : [],
      });
      toast('Exam saved', `${form.name} has been updated.`);
    } catch (err) {
      toast('Could not save', (err as Error).message, 'danger');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Exam settings"
        title={exam.name}
        description="Update pricing, timing, who can see it, and publish status."
        action={
          <Link href="/coaching/exams" className="btn btn-ghost">
            <ArrowLeft size={14} /> Back to exams
          </Link>
        }
      />
      <Card>
        <div className="form-grid">
          <Field label="Exam name" required>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
          <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>

        {form.type !== 'Practice Quiz' && (
          <Field label="Duration (minutes)">
            <input className="form-input" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </Field>
        )}

        <div className="form-grid">
          <Field label="MRP (₹)">
            <input className="form-input" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} placeholder="Optional — shown struck through" />
          </Field>
          <Field label="Sale price (₹)">
            <input className="form-input" value={form.sale} onChange={(e) => setForm({ ...form, sale: e.target.value })} />
          </Field>
        </div>
        {invalidMrp && <Alert tone="danger">MRP cannot be lower than the sale price.</Alert>}
        {mrpPaise > salePaise && (
          <Alert tone="info">
            Students will see: <del>{formatRupees(mrpPaise)}</del> <b>{formatRupees(salePaise)}</b> — {Math.round(((mrpPaise - salePaise) / mrpPaise) * 100)}% off
          </Alert>
        )}

        <Field label="Free preview questions">
          <input className="form-input" value={form.preview} onChange={(e) => setForm({ ...form, preview: e.target.value })} />
        </Field>

        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Exam['status'] })}>
            <option>Draft</option>
            <option>Published</option>
            <option>Upcoming</option>
            <option>Archived</option>
          </select>
        </Field>
      </Card>

      <Card>
        <div className="card-title">
          <div>
            <h2>Who can see this exam</h2>
            <p>Default is every student in your coaching — restrict it if this exam is only for a specific batch.</p>
          </div>
        </div>
        <Checkbox label="Restrict to specific students" checked={restrictToSpecific} onChange={(e) => setRestrictToSpecific(e.target.checked)} />
        {restrictToSpecific && (
          <div className="student-assign-list">
            {students.length === 0 ? (
              <p className="bank-count">No students in your coaching yet.</p>
            ) : (
              students.map((s) => (
                <label className="task" key={s.id}>
                  <input type="checkbox" checked={assignedIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                  <span>{s.name}</span>
                  <small>{s.email}</small>
                </label>
              ))
            )}
          </div>
        )}
      </Card>

      <div className="form-actions">
        <Link href={`/coaching/question-banks?examId=${exam.id}`} className="btn btn-ghost">
          <BookOpen size={14} /> Request question bank
        </Link>
        {exam.questionBankId && (
          <Link href={`/coaching/question-banks/${exam.questionBankId}`} className="btn btn-ghost">
            Manage questions
          </Link>
        )}
        <Link href={`/coaching/exams/${exam.id}/students`} className="btn btn-ghost">
          <Users size={14} /> Student performance
        </Link>
        <Button onClick={save}>
          <Save size={14} /> Save changes
        </Button>
      </div>
    </>
  );
}
