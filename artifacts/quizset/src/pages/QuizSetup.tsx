import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Layers, ListChecks, ListOrdered, Puzzle, Rows3, Sparkles } from 'lucide-react';
import { Link, useLocation, useRoute, useSearch } from 'wouter';
import { Alert, Badge, Button, Card, PageHeader, Skeleton } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { attemptService, courseService, questionService } from '@/services/api';
import { Course, PracticeScope, Question } from '@/types';
import { setPendingPractice } from '@/lib/practiceHandoff';
import { PracticeSetPicker } from '@/pages/PracticeSets';

type ModeOption = { mode: PracticeScope['mode']; label: string; hint: string; icon: typeof Layers };

const MODES: ModeOption[] = [
  { mode: 'full', label: 'Full course', hint: 'Every question in this bank', icon: Sparkles },
  { mode: 'topic', label: 'Topic-wise', hint: 'Pick one or more specific topics', icon: ListChecks },
  { mode: 'unit', label: 'Unit-wise', hint: 'Practise one whole unit at a time', icon: Rows3 },
  { mode: 'multi-unit', label: 'Multi-unit', hint: 'Combine two or more units', icon: Layers },
  { mode: 'custom', label: 'Custom', hint: 'Mix specific units and topics', icon: Puzzle },
  // Always last — Practice Sets is a fixed, pre-baked worksheet rather than
  // a scope you build, so it reads as the "different kind of thing" option
  // at the end, matching the order requested: Full/Topic/Unit/Multi/Custom
  // first (the build-your-own-scope modes), Practice Sets last.
  { mode: 'set', label: 'Practice Sets', hint: 'Fixed 100-question worksheets, same set every time', icon: ListOrdered },
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
 * Generic click-to-open, closed-by-default dropdown: a single trigger button
 * shows the current selection summary, and the actual option list (with
 * checkboxes) only appears while open, scrolling inside its own bounded
 * panel. Used for every selection surface on this page (Unit/Topic pickers,
 * Multi-unit, and Custom's tree) so nothing is ever spread out across the
 * page the way flat chip grids were — with 48+ units and hundreds of topics,
 * everything has to live inside a compact, collapsed-by-default control,
 * matching the original kundan_quiz/quiz-ITI Setup.jsx's dropdown-driven
 * layout instead of a wall of buttons.
 */
function SelectDropdown({ label, placeholder, children }: { label: string; placeholder: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="select-dropdown" ref={ref}>
      <button type="button" className="select-dropdown-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{label || placeholder}</span>
        <ChevronDown size={14} className={open ? 'rotated' : ''} />
      </button>
      {open && <div className="select-dropdown-panel">{children}</div>}
    </div>
  );
}

/** Single-select list inside a SelectDropdown — used by Topic-wise's Unit and
 * Topic pickers, and Unit-wise's single Unit picker. Shows a radio-style
 * check on the active item rather than a real checkbox, since only one item
 * can ever be selected here. */
function SingleSelectList({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="select-dropdown-list">
      {options.map((o) => (
        <label className="select-dropdown-option" key={o.value}>
          <input type="radio" checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/** Multi-select checkbox list inside a SelectDropdown — used by Multi-unit's
 * unit picker. */
function MultiSelectList({ options, value, onChange }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="select-dropdown-list">
      {options.map((o) => (
        <label className="select-dropdown-option" key={o.value}>
          <input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * Custom mode's unit+topic tree, rendered INSIDE a SelectDropdown's panel
 * rather than spread across the page — a tri-state checkbox per unit
 * (checked = every topic in it selected, dash = some, empty = none) that
 * expands to per-topic checkboxes underneath. Matches the original
 * kundan_quiz/quiz-ITI Setup.jsx's Custom Practice tree, including the
 * "select whole syllabus" / "clear all" bulk actions above it.
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

  const selectedCountFor = (u: { unit: string; topics: string[] }) => u.topics.filter((t) => topics.includes(t)).length;

  const toggleUnit = (u: { unit: string; topics: string[] }) => {
    const allSelected = selectedCountFor(u) === u.topics.length;
    if (allSelected) {
      setTopics(topics.filter((t) => !u.topics.includes(t)));
      setUnits(units.filter((x) => x !== u.unit));
    } else {
      setTopics([...topics.filter((t) => !u.topics.includes(t)), ...u.topics]);
      setUnits(units.includes(u.unit) ? units : [...units, u.unit]);
    }
  };

  const toggleTopic = (unit: string, topic: string) => {
    setTopics(topics.includes(topic) ? topics.filter((t) => t !== topic) : [...topics, topic]);
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
      <div className="select-dropdown-list">
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
  const [tree, setTree] = useState<{ subject: string; unit: string; topics: string[] }[] | null>(null);
  const [all, setAll] = useState<Question[]>([]);
  const [mode, setMode] = useState<PracticeScope['mode']>('full');
  // Which subject's units are currently in scope for Topic-wise/Unit-wise/
  // Multi-unit/Custom — a mixed bank (Chemistry+Physics+Maths) needs this
  // filter before a unit dropdown is even navigable; a single-subject bank
  // (e.g. ITI Electronics) just has one subject, so the picker is a no-op.
  const [subject, setSubject] = useState('');
  const [topicUnit, setTopicUnit] = useState(''); // Topic-wise's own Unit dropdown — separate from Unit-wise's `units` selection
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
        // Placeholder only — Practice Sets renders PracticeSetPicker instead
        // of using `scope`/`pool`/the count-and-timer footer below, since a
        // set's question list is a fixed, deterministic slice rather than a
        // scope the student builds. Case exists so this switch stays
        // exhaustive over the shared PracticeScope mode union.
        return { mode: 'set', setNumber: 1 };
    }
  }, [mode, topics, units]);

  const pool = useMemo(() => poolForScope(scope, all), [scope, all]);

  const subjects = useMemo(() => Array.from(new Set((tree ?? []).map((u) => u.subject))), [tree]);
  // Only worth showing when the bank actually mixes subjects — a
  // single-subject bank (e.g. ITI Electronics, all "Electronics") would just
  // force an extra click through a dropdown with exactly one option.
  const showSubjectPicker = subjects.length > 1;
  const unitsInSubject = useMemo(() => (tree ?? []).filter((u) => !showSubjectPicker || u.subject === subject), [tree, subject, showSubjectPicker]);

  // Clamp the count field down whenever the max shrinks below what's
  // currently typed — never fight the user mid-typing by clamping up.
  // Kept ABOVE the `!course || !tree` early return below: every hook in a
  // component must run on every render regardless of any conditional return
  // that follows it, or React throws "rendered fewer hooks than expected"
  // (error #310) the moment `course`/`tree` finish loading and the early
  // return stops firing — this hook would then appear "new" on that render.
  useEffect(() => {
    if (pool.length === 0) return;
    setCount((prev) => {
      const n = Number(prev);
      if (!n) return prev;
      return n > pool.length ? String(pool.length) : prev;
    });
  }, [pool.length]);

  if (!course || !tree) return <Skeleton className="skeleton-page" />;

  const changeMode = (next: PracticeScope['mode']) => {
    setMode(next);
    setTopics([]);
    setUnits(next === 'unit' ? [] : units);
    setTopicUnit('');
    setSubject('');
  };

  const changeSubject = (next: string) => {
    setSubject(next);
    setTopicUnit('');
    setTopics([]);
    setUnits([]);
  };

  const topicsOfSelectedUnit = tree.find((u) => u.unit === topicUnit)?.topics ?? [];

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

      {showSubjectPicker && (mode === 'topic' || mode === 'unit' || mode === 'multi-unit' || mode === 'custom') && (
        <Card>
          <div className="card-title">
            <div>
              <h2>Subject</h2>
              <p>This bank covers more than one subject — pick one to narrow the units below.</p>
            </div>
          </div>
          <SelectDropdown label={subject} placeholder="-- Choose a subject --">
            <SingleSelectList options={subjects.map((s) => ({ value: s, label: s }))} value={subject} onChange={changeSubject} />
          </SelectDropdown>
        </Card>
      )}

      {mode === 'topic' && (!showSubjectPicker || subject) && (
        <Card>
          <div className="card-title">
            <div>
              <h2>Topic-wise</h2>
              <p>Pick a unit first, then a topic from inside it.</p>
            </div>
          </div>
          <div className="setup-dropdown-row">
            <SelectDropdown label={topicUnit} placeholder="-- Choose a unit --">
              <SingleSelectList
                options={unitsInSubject.map((u) => ({ value: u.unit, label: u.unit }))}
                value={topicUnit}
                onChange={(v) => {
                  setTopicUnit(v);
                  setTopics([]);
                }}
              />
            </SelectDropdown>
            {topicUnit && (
              <SelectDropdown label={topics[0] ?? ''} placeholder="-- Choose a topic --">
                <SingleSelectList options={topicsOfSelectedUnit.map((t) => ({ value: t, label: t }))} value={topics[0] ?? ''} onChange={(v) => setTopics([v])} />
              </SelectDropdown>
            )}
          </div>
        </Card>
      )}

      {mode === 'unit' && (!showSubjectPicker || subject) && (
        <Card>
          <div className="card-title">
            <div>
              <h2>Unit-wise</h2>
              <p>Pick the one unit you want to focus on.</p>
            </div>
          </div>
          <SelectDropdown label={units[0] ?? ''} placeholder="-- Choose a unit --">
            <SingleSelectList options={unitsInSubject.map((u) => ({ value: u.unit, label: `${u.unit} (${u.topics.length} topics)` }))} value={units[0] ?? ''} onChange={(v) => setUnits([v])} />
          </SelectDropdown>
        </Card>
      )}

      {mode === 'multi-unit' && (!showSubjectPicker || subject) && (
        <Card>
          <div className="card-title">
            <div>
              <h2>Multi-unit</h2>
              <p>Pick two or more units to combine.</p>
            </div>
          </div>
          <SelectDropdown label={units.length > 0 ? `${units.length} unit${units.length === 1 ? '' : 's'} selected` : ''} placeholder="-- Choose units --">
            <MultiSelectList options={unitsInSubject.map((u) => ({ value: u.unit, label: `${u.unit} (${u.topics.length} topics)` }))} value={units} onChange={setUnits} />
          </SelectDropdown>
        </Card>
      )}

      {mode === 'custom' && (!showSubjectPicker || subject) && (
        <Card>
          <div className="card-title">
            <div>
              <h2>Custom</h2>
              <p>Mix specific units and topics — check a unit to grab everything in it, or expand to pick individual topics.</p>
            </div>
          </div>
          <SelectDropdown
            label={
              topics.length > 0 || units.length > 0
                ? `${new Set([...units, ...unitsInSubject.filter((u) => topics.some((t) => u.topics.includes(t))).map((u) => u.unit)]).size} unit(s), ${topics.length} topic(s)`
                : ''
            }
            placeholder="-- Choose units/topics --"
          >
            <CustomTree tree={unitsInSubject} topics={topics} units={units} setTopics={setTopics} setUnits={setUnits} />
          </SelectDropdown>
        </Card>
      )}

      {mode === 'set' ? (
        <Card>
          <div className="card-title">
            <div>
              <h2>Practice Sets</h2>
            </div>
          </div>
          <PracticeSetPicker course={course} all={all} />
        </Card>
      ) : (
        <>
          <Card>
            <div className="card-title">
              <div>
                <h2>How many questions</h2>
                <p>
                  Number of questions {pool.length > 0 && <span className="muted-hint">(max {pool.length} available)</span>}
                </p>
              </div>
              <Badge tone={pool.length === 0 ? 'danger' : 'info'}>{pool.length === 0 ? 'No match' : `${effectiveCount} picked`}</Badge>
            </div>
            <input
              className="form-input"
              style={{ maxWidth: 160 }}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              onBlur={() => setCount((prev) => String(Math.max(1, Math.min(Number(prev) || 1, pool.length || 1))))}
              inputMode="numeric"
            />
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
      )}
    </>
  );
}
