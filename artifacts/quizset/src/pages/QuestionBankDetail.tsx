import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Edit3, Eye, Plus, Save, Trash2 } from 'lucide-react';
import { Link, useRoute } from 'wouter';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Skeleton } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { questionBankService, questionService } from '@/services/mock';
import { Question, QuestionBank } from '@/types';

const BLANK = { text: '', options: ['', '', '', ''], answer: 0, explanation: '', topic: '', difficulty: 'Medium' as Question['difficulty'] };

/** Question CRUD for exactly one bank — the real replacement for the old page that showed 5 unrelated global questions no matter which bank you opened. */
export function QuestionBankDetail({ scope = 'coaching' }: { scope?: 'coaching' | 'platform' }) {
  const [, params] = useRoute(scope === 'platform' ? '/platform/question-banks/:id' : '/coaching/question-banks/:id');
  const { toast } = useApp();
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [items, setItems] = useState<Question[] | null>(null);
  const [selected, setSelected] = useState<Question | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(BLANK);

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
    const payload = { text: form.text, options: form.options, answer: form.answer, explanation: form.explanation, topic: form.topic, difficulty: form.difficulty };
    if (selected) {
      await questionService.update(selected.id, payload);
    } else {
      await questionService.create({ questionBankId: bank.id, ...payload });
      if (bank.status === 'Pending') await questionBankService.update(bank.id, { status: 'In Progress' });
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

  const markReady = async () => {
    if (!bank) return;
    await questionBankService.update(bank.id, { status: 'Ready' });
    await load();
    toast('Bank marked ready', `${bank.name} can now be used in an exam.`);
  };

  if (!bank || !items) return <Skeleton className="skeleton-page" />;

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
            <h2>Bank status</h2>
            <p>{items.length === 0 ? 'Add at least one question before marking this bank ready.' : 'Ready to be linked from an exam once marked ready.'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge tone={bank.status === 'Ready' ? 'success' : bank.status === 'In Progress' ? 'warning' : 'neutral'}>{bank.status}</Badge>
            {bank.status !== 'Ready' && items.length > 0 && (
              <Button variant="secondary" onClick={markReady}>
                <Check size={14} /> Mark ready
              </Button>
            )}
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card>
          <EmptyState title="No questions yet" description="Add your first MCQ to start building this bank." action={<Button onClick={openNew}>Add question</Button>} />
        </Card>
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Topic</th>
                  <th>Difficulty</th>
                  <th>Answer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <b className="question-cell">{q.text}</b>
                    </td>
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
                          setForm({ text: q.text, options: [...q.options], answer: q.answer, explanation: q.explanation, topic: q.topic, difficulty: q.difficulty });
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

      {selected && !editing && (
        <Modal title="Question preview" onClose={() => setSelected(null)}>
          <div className="question-preview">
            <div className="question-number">{selected.topic.toUpperCase()}</div>
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
            <Field label="Topic">
              <input className="form-input" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </Field>
            <Field label="Difficulty">
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Question['difficulty'] })}>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </Field>
          </div>
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
