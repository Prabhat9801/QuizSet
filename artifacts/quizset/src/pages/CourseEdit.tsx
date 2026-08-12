import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarClock, ListTree, Save, Users } from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { Alert, Badge, Button, Card, Checkbox, Field, PageHeader, Skeleton } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { courseService, questionService, studentService, studyPlanService } from '@/services/api';
import { Course, Student, StudyPlan, StudyPlanItemStatus } from '@/types';
import { formatRupees } from '@/lib/format';

const STATUS_TONE: Record<StudyPlanItemStatus, 'neutral' | 'warning' | 'danger'> = {
  Upcoming: 'neutral',
  'Due now': 'warning',
  Overdue: 'danger',
};

type ManualRow = { unit: string; targetDate: string };

/** Coaching-owner course settings — the piece the original wizard-only flow was missing: editing a course AFTER it's created. */
export function CourseEdit() {
  const [, params] = useRoute('/coaching/courses/:id');
  const { tenantId, toast } = useApp();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState({ name: '', description: '', mrp: '', sale: '0', preview: '5', status: 'Draft' as Course['status'] });
  const [restrictToSpecific, setRestrictToSpecific] = useState(false);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);

  const [units, setUnits] = useState<string[] | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [planMode, setPlanMode] = useState<'manual' | 'auto'>('manual');
  const [autoStart, setAutoStart] = useState('');
  const [autoEnd, setAutoEnd] = useState('');
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    if (!params?.id || !tenantId) return;
    Promise.all([courseService.get(params.id), studentService.list(tenantId)]).then(([c, studentList]) => {
      if (!c) return;
      setCourse(c);
      setForm({ name: c.name, description: c.description || '', mrp: c.mrp ? String(c.mrp) : '', sale: String(c.sale), preview: String(c.preview), status: c.status });
      setStudents(studentList);
      setRestrictToSpecific(c.assignedStudentIds.length > 0);
      setAssignedIds(c.assignedStudentIds);
    });
  }, [params?.id, tenantId]);

  useEffect(() => {
    if (!params?.id) return;
    Promise.all([questionService.syllabusTree(params.id), studyPlanService.get(params.id)]).then(([tree, existingPlan]) => {
      const unitList = tree.map((t) => t.unit);
      setUnits(unitList);
      setPlan(existingPlan);
      if (existingPlan) {
        setPlanMode(existingPlan.mode);
        setAutoStart(existingPlan.startDate || '');
        setAutoEnd(existingPlan.endDate || '');
        setManualRows(unitList.map((unit) => ({ unit, targetDate: existingPlan.items.find((i) => i.unit === unit)?.targetDate || '' })));
      } else {
        setManualRows(unitList.map((unit) => ({ unit, targetDate: '' })));
      }
    });
  }, [params?.id]);

  if (!course) return <Skeleton className="skeleton-page" />;

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
      await courseService.update(course.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        mrp: mrpPaise || salePaise,
        sale: salePaise,
        preview: Math.max(0, Number(form.preview) || 0),
        status: form.status,
        assignedStudentIds: restrictToSpecific ? assignedIds : [],
      });
      toast('Practice set saved', `${form.name} has been updated.`);
    } catch (err) {
      toast('Could not save', (err as Error).message, 'danger');
    }
  };

  const updateManualRow = (unit: string, targetDate: string) => {
    setManualRows((rows) => rows.map((r) => (r.unit === unit ? { ...r, targetDate } : r)));
  };

  const savePlan = async () => {
    setSavingPlan(true);
    try {
      let saved: StudyPlan;
      if (planMode === 'auto') {
        if (!autoStart || !autoEnd) {
          toast('Pick both dates', 'Start date and end date are required for an auto study plan.', 'danger');
          return;
        }
        saved = await studyPlanService.setAuto(course.id, autoStart, autoEnd);
      } else {
        const incomplete = manualRows.some((r) => !r.targetDate);
        if (manualRows.length === 0 || incomplete) {
          toast('Set every date', 'Pick a target date for each unit before saving.', 'danger');
          return;
        }
        saved = await studyPlanService.setManual(course.id, manualRows.map(({ unit, targetDate }) => ({ unit, targetDate })));
      }
      setPlan(saved);
      setPlanMode(saved.mode);
      setAutoStart(saved.startDate || '');
      setAutoEnd(saved.endDate || '');
      setManualRows((units || []).map((unit) => ({ unit, targetDate: saved.items.find((i) => i.unit === unit)?.targetDate || '' })));
      toast('Study plan saved', 'Target dates have been updated.');
    } catch (err) {
      toast('Could not save study plan', (err as Error).message, 'danger');
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Practice set settings"
        title={course.name}
        description="Update pricing, who can see it, and publish status."
        action={
          <Link href="/coaching/courses" className="btn btn-ghost">
            <ArrowLeft size={14} /> Back to practice sets
          </Link>
        }
      />
      <Card>
        <Field label="Practice set name" required>
          <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>

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
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Course['status'] })}>
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
            <h2>Who can see this practice set</h2>
            <p>Default is every student in your coaching — restrict it if this practice set is only for specific, approved students.</p>
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
        <Link href={`/coaching/question-banks?courseId=${course.id}`} className="btn btn-ghost">
          <BookOpen size={14} /> Request question bank
        </Link>
        {course.questionBankId && (
          <Link href={`/coaching/question-banks/${course.questionBankId}`} className="btn btn-ghost">
            Manage questions
          </Link>
        )}
        <Link href={`/coaching/courses/${course.id}/syllabus`} className="btn btn-ghost">
          <ListTree size={14} /> Syllabus
        </Link>
        <Link href={`/coaching/courses/${course.id}/students`} className="btn btn-ghost">
          <Users size={14} /> Student performance
        </Link>
        <Button onClick={save}>
          <Save size={14} /> Save changes
        </Button>
      </div>

      <Card id="study-plan">
        <div className="card-title">
          <div>
            <h2>
              <CalendarClock size={16} /> Study plan
            </h2>
            <p>Set a target completion date per unit, either by hand or evenly spread across a date range.</p>
          </div>
        </div>

        {units === null ? (
          <Skeleton className="skeleton-row" />
        ) : units.length === 0 ? (
          <Alert tone="warning">This practice set has no units yet — add questions to its bank before setting a study plan.</Alert>
        ) : (
          <>
            <div className="mode-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <button className={`mode-tile ${planMode === 'manual' ? 'selected' : ''}`} onClick={() => setPlanMode('manual')}>
                <ListTree size={18} />
                <b>Manual</b>
                <small>Pick each unit's own target date</small>
              </button>
              <button className={`mode-tile ${planMode === 'auto' ? 'selected' : ''}`} onClick={() => setPlanMode('auto')}>
                <CalendarClock size={18} />
                <b>Auto</b>
                <small>Evenly spread all units across a date range</small>
              </button>
            </div>

            {planMode === 'auto' ? (
              <div className="form-grid">
                <Field label="Start date" required>
                  <input type="date" className="form-input" value={autoStart} onChange={(e) => setAutoStart(e.target.value)} />
                </Field>
                <Field label="End date" required>
                  <input type="date" className="form-input" value={autoEnd} onChange={(e) => setAutoEnd(e.target.value)} />
                </Field>
              </div>
            ) : (
              <div className="student-assign-list">
                {manualRows.map((row) => {
                  const existing = plan?.mode === 'manual' ? plan.items.find((i) => i.unit === row.unit) : undefined;
                  const status = existing ? studyPlanService.statusOf(existing.targetDate) : null;
                  return (
                    <label className="task" key={row.unit}>
                      <span>{row.unit}</span>
                      {status && <Badge tone={STATUS_TONE[status]}>{status}</Badge>}
                      <input type="date" className="form-input" style={{ marginLeft: 'auto', maxWidth: 180 }} value={row.targetDate} onChange={(e) => updateManualRow(row.unit, e.target.value)} />
                    </label>
                  );
                })}
              </div>
            )}

            <div className="form-actions">
              <Button disabled={savingPlan} onClick={savePlan}>
                <Save size={14} /> {savingPlan ? 'Saving…' : 'Save study plan'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
