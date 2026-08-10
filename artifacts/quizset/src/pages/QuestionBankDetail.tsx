import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Edit3, Eye, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { Alert, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton, Tabs } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { questionBankService, questionService } from '@/services/api';
import { Question, QuestionBank, QuestionBankStatus } from '@/types';

const BLANK = { text: '', options: ['', '', '', ''], answer: 0, explanation: '', unit: '', topic: '', difficulty: 'Medium' as Question['difficulty'] };

const STAGE_TONE: Record<QuestionBankStatus, 'neutral' | 'info' | 'warning' | 'success'> = {
  Generating: 'neutral',
  'Platform Review': 'info',
  'Coaching Review': 'warning',
  Finalized: 'success',
};

/** Question CRUD for exactly one bank — the real replacement for the old page that showed 5 unrelated global questions no matter which bank you opened. */
export function QuestionBankDetail({ scope = 'coaching' }: { scope?: 'coaching' | 'platform' }) {
  const [, params] = useRoute(scope === 'platform' ? '/platform/question-banks/:id' : '/coaching/question-banks/:id');
  const { toast } = useApp();
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [items, setItems] = useState<Question[] | null>(null);
  const [selected, setSelected] = useState<Question | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(BLANK);
  // Formatted is the default once a bank is actually in someone's review
  // queue — a data table is fine for bulk edits, but reviewing content for
  // mistakes needs to look like the quiz a student will actually see.
  const [view, setView] = useState<'table' | 'formatted'>('formatted');
  const [filterUnit, setFilterUnit] = useState('All');
  const [filterTopic, setFilterTopic] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState<'All' | Question['difficulty']>('All');

  const load = useCallback(async () => {
    if (!params?.id) return;
    const [b, qs] = await Promise.all([questionBankService.get(params.id), questionService.listByBank(params.id)]);
    setBank(b || null);
    setItems(qs);
  }, [params?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(BLANK);
    setSelected(null);
    setEditing(true);
  };

  const save = async () => {
    if (!bank || !form.text || form.options.some((o) => !o.trim())) return;
    const payload = { text: form.text, options: form.options, answer: form.answer, explanation: form.explanation, unit: form.unit, topic: form.topic, difficulty: form.difficulty };
    if (selected) {
      await questionService.update(selected.id, payload);
    } else {
      await questionService.create({ questionBankId: bank.id, ...payload });
    }
    await load();
    setEditing(false);
    setSelected(null);
    toast(selected ? 'Question updated' : 'Question added', 'The bank is up to date.');
  };

  const remove = async (id: string) => {
    await questionService.remove(id);
    await load();
    toast('Question deleted', 'The bank is up to date.');
  };

  const advance = async () => {
    if (!bank) return;
    const updated = await questionBankService.advanceStage(bank.id);
    await load();
    toast('Bank moved forward', `${bank.name} is now "${updated.status}".`);
  };

  const sendBack = async () => {
    if (!bank) return;
    await questionBankService.sendBackStage(bank.id);
    await load();
    toast('Sent back a stage', 'You can keep editing before moving it forward again.', 'info');
  };

  const finalize = async () => {
    if (!bank) return;
    await questionBankService.finalize(bank.id);
    await load();
    toast('Bank finalized', `${bank.name} is approved — courses using it can now be published.`);
  };

  if (!bank || !items) return <Skeleton className="skeleton-page" />;

  const units = Array.from(new Set(items.map((q) => q.unit))).sort();
  const topics = Array.from(new Set(items.filter((q) => filterUnit === 'All' || q.unit === filterUnit).map((q) => q.topic))).sort();
  const filtered = items.filter(
    (q) => (filterUnit === 'All' || q.unit === filterUnit) && (filterTopic === 'All' || q.topic === filterTopic) && (filterDifficulty === 'All' || q.difficulty === filterDifficulty)
  );
  const filtersActive = filterUnit !== 'All' || filterTopic !== 'All' || filterDifficulty !== 'All';
  const clearFilters = () => {
    setFilterUnit('All');
    setFilterTopic('All');
    setFilterDifficulty('All');
  };

  // A coaching owner can only see a bank once it's reached Coaching Review —
  // Generating/Platform Review are the platform owner's own working stages.
  const hiddenFromCoaching = scope === 'coaching' && bank.status !== 'Coaching Review' && bank.status !== 'Finalized';
  if (hiddenFromCoaching) {
    return (
      <>
        <PageHeader eyebrow="Content system" title={bank.name} action={<Link href="/coaching/question-banks" className="btn btn-ghost"><ArrowLeft size={14} /> Back</Link>} />
        <Card>
          <EmptyState title="Not ready for review yet" description="The platform team is still working on this bank. You'll be able to review and edit it once it reaches Coaching Review." />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Content system"
        title={bank.name}
        description={`${bank.subject} · ${items.length} question${items.length === 1 ? '' : 's'}`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={scope === 'platform' ? '/platform/question-banks' : '/coaching/question-banks'} className="btn btn-ghost">
              <ArrowLeft size={14} /> Back
            </Link>
            <Button onClick={openNew}>
              <Plus size={15} /> Add question
            </Button>
          </div>
        }
      />

      <Card>
        <div className="card-title">
          <div>
            <h2>Review stage</h2>
            <p>
              {scope === 'platform'
                ? 'Move this bank forward once you are satisfied with its content.'
                : bank.status === 'Coaching Review'
                  ? 'Review every question, edit anything that needs it, then finalize when ready — students see nothing until you do.'
                  : 'Finalized — a course using this bank can be published.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone={STAGE_TONE[bank.status]}>{bank.status}</Badge>
            {scope === 'platform' && bank.status !== 'Finalized' && (
              <>
                {bank.status !== 'Generating' && (
                  <Button variant="ghost" size="sm" onClick={sendBack}>
                    <RotateCcw size={13} /> Send back
                  </Button>
                )}
                <Button size="sm" onClick={advance} disabled={items.length === 0}>
                  Advance <ArrowRight size={13} />
                </Button>
              </>
            )}
            {scope === 'coaching' && bank.status === 'Coaching Review' && (
              <Button size="sm" onClick={finalize}>
                <Check size={14} /> Finalize
              </Button>
            )}
          </div>
        </div>
        {scope === 'platform' && items.length === 0 && <Alert tone="warning">Add at least one question before advancing this bank.</Alert>}
      </Card>

      {items.length === 0 ? (
        <Card>
          <EmptyState title="No questions yet" description="Add your first MCQ to start building this bank." action={<Button onClick={openNew}>Add question</Button>} />
        </Card>
      ) : (
        <>
          <Card className="filter-bar">
            <select value={filterUnit} onChange={(e) => { setFilterUnit(e.target.value); setFilterTopic('All'); }}>
              <option value="All">All units</option>
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <select value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)}>
              <option value="All">All topics</option>
              {topics.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value as 'All' | Question['difficulty'])}>
              <option value="All">All difficulty</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <span className="filter-count">{filtered.length} of {items.length} question{items.length === 1 ? '' : 's'}</span>
            {filtersActive && (
              <button className="text-link" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </Card>

          <Tabs
            tabs={[
              { value: 'formatted', label: 'Formatted review' },
              { value: 'table', label: 'Table' },
            ]}
            value={view}
            onChange={(v) => setView(v as 'table' | 'formatted')}
          />

          {filtered.length === 0 ? (
            <Card>
              <EmptyState title="No questions match these filters" description="Try a different unit, topic or difficulty." action={<button className="btn btn-ghost" onClick={clearFilters}>Clear filters</button>} />
            </Card>
          ) : view === 'formatted' ? (
            <div className="review-list">
              {filtered.map((q, i) => (
                <Card key={q.id} className="question-preview">
                  <div className="card-title">
                    <div className="question-number">
                      QUESTION {i + 1} · {q.unit.toUpperCase()} · {q.topic.toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge tone={q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Medium' ? 'warning' : 'danger'}>{q.difficulty}</Badge>
                      <div className="row-actions">
                        <button
                          onClick={() => {
                            setForm({ text: q.text, options: [...q.options], answer: q.answer, explanation: q.explanation, unit: q.unit, topic: q.topic, difficulty: q.difficulty });
                            setSelected(q);
                            setEditing(true);
                          }}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => remove(q.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <h3>{q.text}</h3>
                  {q.options.map((o, oi) => (
                    <div className={`preview-option ${oi === q.answer ? 'correct' : ''}`} key={oi}>
                      <span>{String.fromCharCode(65 + oi)}</span>
                      {o}
                      {oi === q.answer && <Check size={15} />}
                    </div>
                  ))}
                  <div className="explanation">
                    <b>Explanation</b>
                    <p>{q.explanation || 'No explanation added yet — add one before finalizing.'}</p>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Unit</th>
                      <th>Topic</th>
                      <th>Difficulty</th>
                      <th>Answer</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((q) => (
                      <tr key={q.id}>
                        <td>
                          <b className="question-cell">{q.text}</b>
                        </td>
                        <td>{q.unit}</td>
                        <td>{q.topic}</td>
                        <td>
                          <Badge tone={q.difficulty === 'Easy' ? 'success' : q.difficulty === 'Medium' ? 'warning' : 'danger'}>{q.difficulty}</Badge>
                        </td>
                        <td>{String.fromCharCode(65 + q.answer)}</td>
                        <td className="row-actions">
                          <button onClick={() => setSelected(q)}>
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setForm({ text: q.text, options: [...q.options], answer: q.answer, explanation: q.explanation, unit: q.unit, topic: q.topic, difficulty: q.difficulty });
                              setSelected(q);
                              setEditing(true);
                            }}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => remove(q.id)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {selected && !editing && (
        <Modal title="Question preview" onClose={() => setSelected(null)}>
          <div className="question-preview">
            <div className="question-number">
              {selected.unit.toUpperCase()} · {selected.topic.toUpperCase()}
            </div>
            <h3>{selected.text}</h3>
            {selected.options.map((o, i) => (
              <div className={`preview-option ${i === selected.answer ? 'correct' : ''}`} key={i}>
                <span>{String.fromCharCode(65 + i)}</span>
                {o}
                {i === selected.answer && <Check size={15} />}
              </div>
            ))}
            <div className="explanation">
              <b>Explanation</b>
              <p>{selected.explanation}</p>
            </div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          title={selected ? 'Edit MCQ' : 'Add MCQ'}
          onClose={() => {
            setEditing(false);
            setSelected(null);
          }}
        >
          <Field label="Question" required>
            <textarea className="form-input" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Write the question prompt" />
          </Field>
          <Field label="Options — select the radio for the correct one" required>
            <div className="option-inputs">
              {form.options.map((opt, i) => (
                <label className="option-input-row" key={i}>
                  <input type="radio" checked={form.answer === i} onChange={() => setForm({ ...form, answer: i })} />
                  <input
                    className="form-input"
                    value={opt}
                    onChange={(e) => {
                      const options = [...form.options];
                      options[i] = e.target.value;
                      setForm({ ...form, options });
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  />
                </label>
              ))}
            </div>
          </Field>
          <div className="form-grid">
            <Field label="Unit" htmlFor="qUnit">
              <input id="qUnit" className="form-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. Quantitative Aptitude" />
            </Field>
            <Field label="Topic" htmlFor="qTopic">
              <input id="qTopic" className="form-input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Percentage" />
            </Field>
          </div>
          <Field label="Difficulty">
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Question['difficulty'] })}>
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </Field>
          <Field label="Explanation">
            <textarea className="form-input" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          </Field>
          <div className="form-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setSelected(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={save}>
              <Save size={14} /> Save question
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
