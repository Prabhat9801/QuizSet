import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Layers, ListChecks, Puzzle, Rows3, Sparkles } from 'lucide-react';
import { Link, useLocation, useRoute, useSearch } from 'wouter';
import { Alert, Badge, Button, Card, PageHeader, Skeleton } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { attemptService, courseService, questionService } from '@/services/api';
import { Course, PracticeScope, Question } from '@/types';
import { setPendingPractice } from '@/lib/practiceHandoff';

type ModeOption = { mode: PracticeScope['mode']; label: string; hint: string; icon: typeof Layers };

const MODES: ModeOption[] = [
  { mode: 'full', label: 'Full course', hint: 'Every question in this bank', icon: Sparkles },
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
    case 'set':
      // Practice Sets have their own dedicated page (PracticeSets.tsx) that
      // computes the fixed slice directly via getPracticeSet() — this setup
      // screen never offers 'set' as a pickable mode, so this case only
      // exists to make the switch exhaustive over the shared PracticeScope type.
      return [];
  }
}

/**
 * Custom mode's unit+topic tree — a collapsible list of units, each with a
 * tri-state checkbox (checked = every topic in it selected, dash = some,
 * empty = none) that expands to per-topic checkboxes underneath. Matches the
 * original kundan_quiz/quiz-ITI Setup.jsx's Custom Practice tree, including
 * the "select whole syllabus" / "clear all" bulk actions above it.
 */
function CustomTree({
  tree,
  topics,
  units,
  setTopics,
  setUnits,
}: {
  tree: { unit: string; topics: string[] }[];
  topics: string[];
  units: string[];
  setTopics: (v: string[]) => void;
  setUnits: (v: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (unit: string) => {
    const next = new Set(expanded);
    if (next.has(unit)) next.delete(unit);
    else next.add(unit);
    setExpanded(next);
  };

  const topicsInUnit = (u: { unit: string; topics: string[] }) => u.topics;
  const selectedCountFor = (u: { unit: string; topics: string[] }) => topicsInUnit(u).filter((t) => topics.includes(t)).length;

  const toggleUnit = (u: { unit: string; topics: string[] }) => {
    const allSelected = selectedCountFor(u) === u.topics.length;
    if (allSelected) {
      // Fully selected -> clear this unit's topics (and the unit chip itself).
      setTopics(topics.filter((t) => !u.topics.includes(t)));
      setUnits(units.filter((x) => x !== u.unit));
    } else {
      // None or partially selected -> select every topic in this unit.
      setTopics([...topics.filter((t) => !u.topics.includes(t)), ...u.topics]);
      setUnits(units.includes(u.unit) ? units : [...units, u.unit]);
    }
  };

  const toggleTopic = (unit: string, topic: string) => {
    setTopics(topics.includes(topic) ? topics.filter((t) => t !== topic) : [...topics, topic]);
    // Keep the unit chip in sync so unit-level filtering (poolForScope's
    // 'custom' OR-match) reflects "every topic in this unit" once complete,
    // and drops out again the moment any one topic is unchecked.
    const unitTopics = tree.find((u) => u.unit === unit)?.topics ?? [];
    const willBeFullySelected = unitTopics.every((t) => (t === topic ? !topics.includes(t) : topics.includes(t)));
    if (willBeFullySelected && !units.includes(unit)) setUnits([...units, unit]);
    else if (!willBeFullySelected && units.includes(unit)) setUnits(units.filter((x) => x !== unit));
  };

  const selectAll = () => {
    setTopics(tree.flatMap((u) => u.topics));
    setUnits(tree.map((u) => u.unit));
  };
  const clearAll = () => {
    setTopics([]);
    setUnits([]);
  };

  return (
    <div className="custom-tree">
      <div className="tree-actions">
        <Button variant="secondary" size="sm" onClick={selectAll}>
          Select whole syllabus
        </Button>
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear all
        </Button>
      </div>
      {tree.map((u) => {
        const selected = selectedCountFor(u);
        const triState = selected === 0 ? 'none' : selected === u.topics.length ? 'checked' : 'partial';
        const isOpen = expanded.has(u.unit);
        return (
          <div className="tree-unit" key={u.unit}>
            <div className="tree-unit-head">
              <button type="button" className="tree-chevron" onClick={() => toggleExpanded(u.unit)} aria-label={isOpen ? 'Collapse' : 'Expand'}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <button type="button" className={`tree-checkbox ${triState}`} onClick={() => toggleUnit(u)} aria-label={`Toggle all topics in ${u.unit}`}>
                {triState === 'checked' && '✓'}
                {triState === 'partial' && '–'}
              </button>
              <span className="tree-unit-name" onClick={() => toggleExpanded(u.unit)}>
                {u.unit}
              </span>
              <span className="tree-unit-count">
                {selected}/{u.topics.length} topics
              </span>
            </div>
            {isOpen && (
              <div className="tree-topics">
                {u.topics.map((t) => (
                  <label className="tree-topic" key={t}>
                    <input type="checkbox" checked={topics.includes(t)} onChange={() => toggleTopic(u.unit, t)} />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Sits between "Start practice" and the actual attempt — lets the student
 * scope their run (Topic-wise / Unit-wise / Multi-unit / Custom / Full),
 * matching the mode picker the original kundan_quiz app had, instead of
 * always handing over the whole bank. Every course goes through this —
 * there's no other, "timed" flavor of a course attempt.
 */
export function QuizSetup() {
  const [, params] = useRoute('/student/courses/:id/setup');
  const [, navigate] = useLocation();
  const search = new URLSearchParams(useSearch());
  const { user } = useApp();
  const [course, setCourse] = useState<Course | null>(null);
  const [tree, setTree] = useState<{ unit: string; topics: string[] }[] | null>(null);
  const [all, setAll] = useState<Question[]>([]);
  const [mode, setMode] = useState<PracticeScope['mode']>('full');
  const [topics, setTopics] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [count, setCount] = useState('20');
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState('15');

  // Deep-link support (e.g. from the Study Plan's "Practice this unit"
  // action on Syllabus.tsx): ?mode=unit&unit=<name> pre-selects that mode and
  // unit on first load, without touching the normal no-preselection default
  // (mode stays 'full' whenever these params are absent).
  useEffect(() => {
    const modeParam = search.get('mode');
    const unitParam = search.get('unit');
    if (modeParam === 'unit' && unitParam) {
      setMode('unit');
      setUnits([unitParam]);
    }
    // Only ever applies once, on arrival — intentionally not re-run when the
    // user changes mode/units afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!params?.id) return;
    courseService.get(params.id).then(async (c) => {
      if (!c) return;
      setCourse(c);
      const [t, qs] = await Promise.all([questionService.syllabusTree(c.id), questionService.listByCourse(c.id)]);
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
      case 'set':
        // Unreachable — this setup screen's MODES list never offers 'set'
        // (Practice Sets are their own page). Case exists only so this
        // switch stays exhaustive over the shared PracticeScope mode union.
        return { mode: 'set', setNumber: 1 };
    }
  }, [mode, topics, units]);

  const pool = useMemo(() => poolForScope(scope, all), [scope, all]);

  if (!course || !tree) return <Skeleton className="skeleton-page" />;

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
    const picked = await attemptService.pickForPractice(user.id, course.id, scope, pool, effectiveCount);
    const timerSeconds = timerEnabled ? Math.max(1, Number(timerMinutes) || 1) * 60 : undefined;
    setPendingPractice(course.id, { scope, questionIds: picked.map((q) => q.id), timerSeconds });
    navigate(`/student/courses/${course.id}/attempt`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Practice setup"
        title={course.name}
        description="Choose what to practise before you start — your answers stay untimed either way."
        action={
          <Link href={`/student/courses/${course.id}`} className="btn btn-ghost">
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

      {mode === 'topic' && (
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

      {(mode === 'unit' || mode === 'multi-unit') && (
        <Card>
          <div className="card-title">
            <div>
              <h2>Units</h2>
              <p>{mode === 'unit' ? 'Pick the one unit you want to focus on.' : 'Pick two or more units to combine.'}</p>
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

      {mode === 'custom' && (
        <Card>
          <div className="card-title">
            <div>
              <h2>Select topics</h2>
              <p>Mix specific units and topics — check a unit to grab everything in it, or expand to pick individual topics.</p>
            </div>
          </div>
          <CustomTree tree={tree} topics={topics} units={units} setTopics={setTopics} setUnits={setUnits} />
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

      <Card>
        <div className="card-title">
          <div>
            <h2>Timer</h2>
            <p>Off by default — set one if you want a whole-run countdown. Running out only shows a warning, it never submits for you.</p>
          </div>
        </div>
        <label className="task">
          <input type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(e.target.checked)} />
          <span>Set a timer</span>
        </label>
        {timerEnabled && (
          <div className="timer-minutes-row">
            <input
              className="form-input"
              style={{ maxWidth: 100 }}
              value={timerMinutes}
              onChange={(e) => setTimerMinutes(e.target.value)}
              onBlur={() => setTimerMinutes(String(Math.max(1, Number(timerMinutes) || 1)))}
              inputMode="numeric"
            />
            <span>minutes</span>
          </div>
        )}
      </Card>

      <div className="form-actions">
        <Button disabled={selectionIncomplete || pool.length === 0} onClick={start}>
          Start practice <ArrowRight size={14} />
        </Button>
      </div>
    </>
  );
}
