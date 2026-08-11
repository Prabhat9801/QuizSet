import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock3, Play, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton, Stat } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { courseService, liveTestService, questionService } from '@/services/api';
import { Attempt, Course, LiveTest, LiveTestPhase, LiveTestScope } from '@/types';
import { formatDateTime, formatRupees } from '@/lib/format';
import { CustomTree, MultiSelectList, SelectDropdown } from '@/pages/QuizSetup';

const PHASE_TONE: Record<LiveTestPhase, 'neutral' | 'warning' | 'success' | 'info' | 'danger'> = {
  Draft: 'neutral',
  Upcoming: 'warning',
  Live: 'success',
  Ended: 'info',
  Cancelled: 'danger',
};

export function LiveTests() {
  const { tenant, tenantId, toast } = useApp();
  const [items, setItems] = useState<LiveTest[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const [openTest, setOpenTest] = useState<LiveTest | null>(null);
  const [form, setForm] = useState({ name: '', courseId: '', start: '', end: '', duration: '30', price: '0' });

  // Scope-picker state — only meaningful once a course is chosen (the
  // syllabus tree comes from that course's question bank).
  const [scopeMode, setScopeMode] = useState<'full' | 'scoped'>('full');
  const [tree, setTree] = useState<{ subject: string; unit: string; topics: string[] }[] | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState('50');
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [tests, allCourses] = await Promise.all([liveTestService.list(tenantId), courseService.list(tenantId)]);
    setItems(tests);
    setCourses(allCourses.filter((c) => c.status === 'Published'));
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  // Load the chosen course's syllabus tree so the scope picker has
  // something to show — mirrors QuizSetup.tsx's own tree-load effect.
  useEffect(() => {
    if (!form.courseId) {
      setTree(null);
      return;
    }
    questionService.syllabusTree(form.courseId).then(setTree);
  }, [form.courseId]);

  const resetScope = () => {
    setScopeMode('full');
    setSubjects([]);
    setUnits([]);
    setTopics([]);
    setWeights({});
    setAdvancedOpen(false);
  };

  // Every unit/topic name currently in scope — the same "buckets" the
  // backend's pickLiveTestQuestions() will split questionCount across, so
  // the Advanced weights section only ever offers inputs for names that
  // actually matter.
  const bucketsInScope = useMemo(() => {
    if (!tree) return [];
    const unitsPresent = tree.filter((u) => units.includes(u.unit)).map((u) => u.unit);
    const topicsPresent = tree.flatMap((u) => u.topics).filter((t) => topics.includes(t));
    return Array.from(new Set([...unitsPresent, ...topicsPresent]));
  }, [tree, units, topics]);

  const create = async () => {
    if (!tenantId || !form.name || !form.courseId || !form.start || !form.end) return;

    let scope: LiveTestScope | undefined;
    let count: number | undefined;
    if (scopeMode === 'scoped') {
      const parsedWeights: Record<string, number> = {};
      for (const [k, v] of Object.entries(weights)) {
        const n = Number(v);
        if (v.trim() !== '' && Number.isFinite(n) && n >= 0) parsedWeights[k] = Math.floor(n);
      }
      scope = {
        mode: 'scoped',
        subjects,
        units,
        topics,
        weights: Object.keys(parsedWeights).length > 0 ? parsedWeights : undefined,
      };
      count = Math.max(1, Number(questionCount) || 1);
    }

    await liveTestService.create({
      tenantId,
      courseId: form.courseId,
      name: form.name,
      scheduledStart: new Date(form.start).toISOString(),
      scheduledEnd: new Date(form.end).toISOString(),
      durationMinutes: Math.max(1, Number(form.duration) || 30),
      price: Math.max(0, Number(form.price) || 0),
      status: 'Draft',
      scope,
      questionCount: count,
    });
    await load();
    setOpen(false);
    setForm({ name: '', courseId: '', start: '', end: '', duration: '30', price: '0' });
    resetScope();
    toast('Live test created', 'Publish it once you are ready for students to see it.');
  };

  const togglePublish = async (test: LiveTest) => {
    await liveTestService.update(test.id, { status: test.status === 'Published' ? 'Draft' : 'Published' });
    await load();
    toast(test.status === 'Published' ? 'Unpublished' : 'Published', test.status === 'Published' ? 'Students can no longer see this test.' : 'Students in your coaching can now see this test.');
  };

  if (!items) return <Skeleton className="skeleton-page" />;

  const upcoming = items.filter((t) => liveTestService.phase(t) === 'Upcoming').length;
  const live = items.filter((t) => liveTestService.phase(t) === 'Live').length;
  const ended = items.filter((t) => liveTestService.phase(t) === 'Ended').length;

  return (
    <>
      <PageHeader
        eyebrow={tenant.name}
        title="Live tests"
        description="Bring your learners into a shared, time-boxed assessment."
        action={
          <Button onClick={() => setOpen(true)} disabled={courses.length === 0}>
            <Plus size={15} /> Schedule live test
          </Button>
        }
      />
      {courses.length === 0 && <div className="alert alert-warning">Publish at least one course first — a live test always draws its questions from one.</div>}

      <div className="stats-grid">
        <Stat label="Upcoming" value={String(upcoming)} icon={<Clock3 />} />
        <Stat label="Live now" value={String(live)} icon={<Play />} />
        <Stat label="Completed" value={String(ended)} icon={<Clock3 />} />
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState title="No live tests yet" description="Schedule one to bring your learners together at a set time." />
        </Card>
      ) : (
        <div className="live-test-list">
          {items.map((t) => (
            <Card key={t.id} className="live-test-card" onClick={() => setOpenTest(t)}>
              <div className="request-top">
                <div>
                  <b>{t.name}</b>
                  <small>
                    {formatDateTime(t.scheduledStart)} → {formatDateTime(t.scheduledEnd)}
                  </small>
                </div>
                <Badge tone={PHASE_TONE[liveTestService.phase(t)]}>{liveTestService.phase(t)}</Badge>
              </div>
              <p className="request-meta">
                {t.durationMinutes} min · {t.price ? formatRupees(t.price) : 'Free'}
                {t.scope?.mode === 'scoped' && <> · {t.questionCount ?? t.questionIds?.length ?? 0} questions (scoped)</>}
              </p>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <Modal
          title="Schedule a live test"
          onClose={() => {
            setOpen(false);
            resetScope();
          }}
        >
          <Field label="Test name" required>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="SSC CGL Grand Test" />
          </Field>
          <Field label="Question source (course)" required>
            <select
              value={form.courseId}
              onChange={(e) => {
                setForm({ ...form, courseId: e.target.value });
                resetScope();
              }}
            >
              <option value="">Choose a course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Start" required>
              <input className="form-input" type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </Field>
            <Field label="End" required>
              <input className="form-input" type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </Field>
            <Field label="Duration (minutes)">
              <input className="form-input" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </Field>
            <Field label="Price (₹)">
              <input className="form-input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
          </div>

          {form.courseId && (
            <Field label="Question scope">
              <div className="mode-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button type="button" className={`mode-tile ${scopeMode === 'full' ? 'selected' : ''}`} onClick={() => setScopeMode('full')}>
                  <b>Full syllabus</b>
                  <small>Every question in this course's bank</small>
                </button>
                <button type="button" className={`mode-tile ${scopeMode === 'scoped' ? 'selected' : ''}`} onClick={() => setScopeMode('scoped')}>
                  <b>Choose specific scope</b>
                  <small>Pick subjects/units/topics and a question count</small>
                </button>
              </div>
            </Field>
          )}

          {scopeMode === 'scoped' && tree && (
            <>
              <Field label="Subjects">
                <SelectDropdown
                  label={subjects.length > 0 ? `${subjects.length} subject(s) selected` : ''}
                  placeholder="-- Choose subjects --"
                >
                  <MultiSelectList
                    options={Array.from(new Set(tree.map((u) => u.subject))).map((s) => ({ value: s, label: s }))}
                    value={subjects}
                    onChange={setSubjects}
                  />
                </SelectDropdown>
              </Field>
              <Field label="Units / topics">
                <SelectDropdown
                  label={units.length > 0 || topics.length > 0 ? `${units.length} unit(s), ${topics.length} topic(s)` : ''}
                  placeholder="-- Choose units/topics --"
                >
                  <CustomTree tree={tree} topics={topics} units={units} setTopics={setTopics} setUnits={setUnits} />
                </SelectDropdown>
              </Field>
              <Field label="Number of questions" required>
                <input className="form-input" style={{ maxWidth: 160 }} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} inputMode="numeric" />
              </Field>

              {bucketsInScope.length > 0 && (
                <div className="collapsible-section">
                  <button type="button" className="btn btn-ghost" onClick={() => setAdvancedOpen((o) => !o)}>
                    {advancedOpen ? 'Hide' : 'Show'} advanced: set weights manually
                  </button>
                  {advancedOpen && (
                    <div className="weights-grid">
                      {bucketsInScope.map((name) => (
                        <Field key={name} label={name}>
                          <input
                            className="form-input"
                            placeholder="auto"
                            value={weights[name] ?? ''}
                            onChange={(e) => setWeights({ ...weights, [name]: e.target.value })}
                            inputMode="numeric"
                          />
                        </Field>
                      ))}
                    </div>
                  )}
                  <p className="muted-hint">Leave any blank to auto-split the remaining questions equally across it.</p>
                </div>
              )}

              {(subjects.length === 0 && units.length === 0 && topics.length === 0) && <div className="alert alert-warning">Pick at least a subject, unit, or topic to scope this test.</div>}
            </>
          )}

          <div className="alert alert-info">This test stays in Draft — publish it from the list once questions and timing look right.</div>
          <div className="form-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                resetScope();
              }}
            >
              Cancel
            </Button>
            <Button onClick={create}>Create test</Button>
          </div>
        </Modal>
      )}

      {openTest && <LiveTestDetailModal test={openTest} onClose={() => setOpenTest(null)} onTogglePublish={() => togglePublish(openTest)} />}
    </>
  );
}

function LiveTestDetailModal({ test, onClose, onTogglePublish }: { test: LiveTest; onClose: () => void; onTogglePublish: () => void }) {
  const [results, setResults] = useState<Attempt[] | null>(null);

  useEffect(() => {
    import('@/services/storage').then(({ storage }) => {
      const all = storage.get<Attempt[]>('attempts', []);
      setResults(all.filter((a) => a.liveTestId === test.id).sort((a, b) => b.score - a.score));
    });
  }, [test.id]);

  const phase = liveTestService.phase(test);

  return (
    <Modal title={test.name} onClose={onClose}>
      <div className="request-detail">
        <div className="request-detail-row">
          <span>Window</span>
          <b>
            {formatDateTime(test.scheduledStart)} → {formatDateTime(test.scheduledEnd)}
          </b>
        </div>
        <div className="request-detail-row">
          <span>Duration</span>
          <b>{test.durationMinutes} minutes</b>
        </div>
        <div className="request-detail-row">
          <span>Price</span>
          <b>{test.price ? formatRupees(test.price) : 'Free'}</b>
        </div>
        <div className="request-detail-row">
          <span>Scope</span>
          <b>{test.scope?.mode === 'scoped' ? `${test.questionCount ?? test.questionIds?.length ?? 0} questions, scoped` : 'Full syllabus'}</b>
        </div>
        <div className="request-detail-row">
          <span>Status</span>
          <Badge tone={PHASE_TONE[phase]}>{phase}</Badge>
        </div>
      </div>

      <div className="request-notes">
        <b>Results {results ? `(${results.length})` : ''}</b>
        {results && results.length === 0 && <p>No one has submitted this test yet.</p>}
        {results && results.length > 0 && (
          <div className="result-list">
            {results.map((r, i) => (
              <div className="result-row" key={r.id}>
                <span>#{i + 1}</span>
                <span>{r.score} correct</span>
                <span className="result-score-pill good">{r.totalAttempted ? Math.round((r.score / r.totalAttempted) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-actions">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft size={14} /> Close
        </Button>
        {test.status !== 'Cancelled' && (
          <Button variant={test.status === 'Published' ? 'secondary' : 'primary'} onClick={onTogglePublish}>
            {test.status === 'Published' ? 'Unpublish' : 'Publish'}
          </Button>
        )}
      </div>
    </Modal>
  );
}
