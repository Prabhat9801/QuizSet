import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Layers, ListChecks, Puzzle, Rows3, Sparkles } from 'lucide-react';
import { Link, useLocation, useRoute } from 'wouter';
import { Alert, Badge, Button, Card, PageHeader, Skeleton } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { attemptService, examService, questionService } from '@/services/mock';
import { Exam, PracticeScope, Question } from '@/types';
import { setPendingPractice } from '@/lib/practiceHandoff';

type ModeOption = { mode: PracticeScope['mode']; label: string; hint: string; icon: typeof Layers };

const MODES: ModeOption[] = [
  { mode: 'full', label: 'Full exam', hint: 'Every question in this bank', icon: Sparkles },
  { mode: 'topic', label: 'Topic-wise', hint: 'Pick one or more specific topics', icon: ListChecks },
  { mode: 'unit', label: 'Unit-wise', hint: 'Practise one whole unit at a time', icon: Rows3 },
  { mode: 'multi-unit', label: 'Multi-unit', hint: 'Combine two or more units', icon: Layers },
  { mode: 'custom', label: 'Custom', hint: 'Mix specific units and topics', icon: Puzzle },
];

function poolForScope(scope: PracticeScope, all: Question[]): Question[] {
  switch (scope.mode) {
    case 'full':
      return all;
    case 'topic':
      return all.filter((q) => scope.topics.includes(q.topic));
    case 'unit':
    case 'multi-unit':
      return all.filter((q) => scope.units.includes(q.unit));
    case 'custom':
      return all.filter((q) => scope.topics.includes(q.topic) || scope.units.includes(q.unit));
  }
}

/**
 * Sits between "Start practice" and the actual attempt for Practice Quiz
 * exams — lets the student scope their run (Topic-wise / Unit-wise /
 * Multi-unit / Custom / Full), matching the mode picker the original
 * kundan_quiz app had, instead of always handing over the whole bank.
 */
export function QuizSetup() {
  const [, params] = useRoute('/student/exams/:id/setup');
  const [, navigate] = useLocation();
  const { user } = useApp();
  const [exam, setExam] = useState<Exam | null>(null);
  const [tree, setTree] = useState<{ unit: string; topics: string[] }[] | null>(null);
  const [all, setAll] = useState<Question[]>([]);
  const [mode, setMode] = useState<PracticeScope['mode']>('full');
  const [topics, setTopics] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [count, setCount] = useState('20');

  useEffect(() => {
    if (!params?.id) return;
    examService.get(params.id).then(async (e) => {
      if (!e) return;
      setExam(e);
      const [t, qs] = await Promise.all([questionService.syllabusTree(e.id), questionService.listByExam(e.id)]);
      setTree(t);
      setAll(qs);
    });
  }, [params?.id]);

  const scope: PracticeScope = useMemo(() => {
    switch (mode) {
      case 'full':
        return { mode: 'full' };
      case 'topic':
        return { mode: 'topic', topics };
      case 'unit':
      case 'multi-unit':
        return { mode, units };
      case 'custom':
        return { mode: 'custom', topics, units };
    }
  }, [mode, topics, units]);

  const pool = useMemo(() => poolForScope(scope, all), [scope, all]);

  if (!exam || !tree) return <Skeleton className="skeleton-page" />;

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const changeMode = (next: PracticeScope['mode']) => {
    setMode(next);
    setTopics([]);
    setUnits(next === 'unit' ? [] : units);
  };

  const requestedCount = Math.max(1, Number(count) || 1);
  const effectiveCount = Math.min(requestedCount, pool.length);
  const selectionIncomplete = (mode === 'topic' && topics.length === 0) || (mode === 'unit' && units.length === 0) || (mode === 'multi-unit' && units.length < 2) || (mode === 'custom' && topics.length === 0 && units.length === 0);

  const start = async () => {
    if (!user || selectionIncomplete || pool.length === 0) return;
    const picked = await attemptService.pickForPractice(user.id, exam.id, scope, pool, effectiveCount);
    setPendingPractice(exam.id, { scope, questionIds: picked.map((q) => q.id) });
    navigate(`/student/exams/${exam.id}/attempt`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Practice setup"
        title={exam.name}
        description="Choose what to practise before you start — your answers stay untimed either way."
        action={
          <Link href={`/student/exams/${exam.id}`} className="btn btn-ghost">
            <ArrowLeft size={14} /> Back
          </Link>
        }
      />

      <Card>
        <div className="card-title">
          <div>
            <h2>Practice mode</h2>
            <p>Each mode tracks its own progress, so switching modes never repeats a question you've already cycled through.</p>
          </div>
        </div>
        <div className="mode-grid">
          {MODES.map(({ mode: m, label, hint, icon: Icon }) => (
            <button key={m} className={`mode-tile ${mode === m ? 'selected' : ''}`} onClick={() => changeMode(m)}>
              <Icon size={18} />
              <b>{label}</b>
              <small>{hint}</small>
            </button>
          ))}
        </div>
      </Card>

      {(mode === 'topic' || mode === 'custom') && (
        <Card>
          <div className="card-title">
            <div>
              <h2>Topics</h2>
              <p>Select one or more topics across any unit.</p>
            </div>
          </div>
          <div className="chip-grid">
            {tree.flatMap((u) => u.topics).map((t) => (
              <button key={t} className={`chip ${topics.includes(t) ? 'selected' : ''}`} onClick={() => toggle(topics, setTopics, t)}>
                {t}
              </button>
            ))}
          </div>
        </Card>
      )}

      {(mode === 'unit' || mode === 'multi-unit' || mode === 'custom') && (
        <Card>
          <div className="card-title">
            <div>
              <h2>Units</h2>
              <p>{mode === 'unit' ? 'Pick the one unit you want to focus on.' : mode === 'multi-unit' ? 'Pick two or more units to combine.' : 'Pick whole units to add alongside your chosen topics.'}</p>
            </div>
          </div>
          <div className="chip-grid">
            {tree.map((u) => (
              <button key={u.unit} className={`chip ${units.includes(u.unit) ? 'selected' : ''}`} onClick={() => toggle(units, setUnits, u.unit)}>
                {u.unit}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="card-title">
          <div>
            <h2>How many questions</h2>
            <p>{pool.length} question{pool.length === 1 ? '' : 's'} available for this selection.</p>
          </div>
          <Badge tone={pool.length === 0 ? 'danger' : 'info'}>{pool.length === 0 ? 'No match' : `${effectiveCount} picked`}</Badge>
        </div>
        <input className="form-input" style={{ maxWidth: 160 }} value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" />
        {selectionIncomplete && <Alert tone="warning">Make a selection above to continue.</Alert>}
        {!selectionIncomplete && pool.length === 0 && <Alert tone="danger">No questions match this selection yet.</Alert>}
      </Card>

      <div className="form-actions">
        <Button disabled={selectionIncomplete || pool.length === 0} onClick={start}>
          Start practice <ArrowRight size={14} />
        </Button>
      </div>
    </>
  );
}
