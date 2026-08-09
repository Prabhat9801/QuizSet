import { useCallback, useEffect, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { BookOpen, Check, FileUp, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { examService, questionBankService, questionBankRequestService, tenantService } from '@/services/mock';
import { Exam, QuestionBank, QuestionBankRequest, QuestionBankStatus, Tenant } from '@/types';

const BANK_TONE: Record<QuestionBankStatus, 'neutral' | 'info' | 'warning' | 'success'> = {
  Generating: 'neutral',
  'Platform Review': 'info',
  'Coaching Review': 'warning',
  Finalized: 'success',
};

const BLANK_FORM = { examId: '', subjects: '', questionsRequired: '100', difficulty: 'Easy + Medium + Hard', priority: 'Medium' as QuestionBankRequest['priority'], notes: '', unitsTopics: '', fileName: '' };

/**
 * `scope="platform"` shows every coaching's banks, including ones still in
 * Generating/Platform Review (oversight — a coaching never sees those).
 * `scope="coaching"` shows only banks that have reached Coaching Review or
 * Finalized, plus the "request a new bank" flow.
 */
export function QuestionBanks({ scope = 'coaching' }: { scope?: 'coaching' | 'platform' }) {
  const { tenant, tenantId, toast } = useApp();
  const search = new URLSearchParams(useSearch());
  const [banks, setBanks] = useState<QuestionBank[] | null>(null);
  const [requests, setRequests] = useState<QuestionBankRequest[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [filterStatus, setFilterStatus] = useState('All');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const scopedTenantId = scope === 'coaching' ? tenantId ?? undefined : undefined;
    const [bankList, requestList, examList, tenantList] = await Promise.all([
      scope === 'coaching' && tenantId ? questionBankService.listVisibleToCoaching(tenantId) : questionBankService.list(scopedTenantId),
      questionBankRequestService.list(scopedTenantId),
      scope === 'coaching' && tenantId ? examService.list(tenantId) : Promise.resolve([]),
      scope === 'platform' ? tenantService.list() : Promise.resolve([]),
    ]);
    setBanks(bankList);
    setRequests(requestList);
    setExams(examList);
    setTenants(tenantList);
  }, [scope, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  // Arriving from an exam's own "Request question bank" button pre-selects that exam.
  useEffect(() => {
    const examIdParam = search.get('examId');
    if (examIdParam) {
      setForm((f) => ({ ...f, examId: examIdParam }));
      setOpen(true);
    }
  }, [search]);

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name || id;

  const submitRequest = async () => {
    const exam = exams.find((e) => e.id === form.examId);
    if (!exam || !tenantId) return;
    await questionBankRequestService.create({
      tenantId,
      examId: exam.id,
      examName: exam.name,
      subjects: form.subjects.split(',').map((s) => s.trim()).filter(Boolean),
      questionsRequired: Number(form.questionsRequired) || 50,
      difficulty: form.difficulty,
      priority: form.priority,
      notes: form.notes || undefined,
      unitsTopics: form.unitsTopics || undefined,
      syllabusFileName: form.fileName || undefined,
    });
    await load();
    setOpen(false);
    setForm(BLANK_FORM);
    toast('Request sent', 'The platform team will review it and start building your bank.');
  };

  const finalize = async (bank: QuestionBank) => {
    await questionBankService.finalize(bank.id);
    await load();
    toast('Bank finalized', `${bank.name} is approved — exams using it can now be published.`);
  };

  if (!banks) return null;

  const inProgress = requests.filter((r) => r.status !== 'Finalized');
  const q = query.trim().toLowerCase();
  const filteredBanks = banks.filter(
    (b) => (filterStatus === 'All' || b.status === filterStatus) && (!q || b.name.toLowerCase().includes(q) || b.subject.toLowerCase().includes(q))
  );
  const statusOptions: (QuestionBankStatus | 'All')[] = ['All', 'Generating', 'Platform Review', 'Coaching Review', 'Finalized'];

  return (
    <>
      <PageHeader
        eyebrow="Content system"
        title="Question banks"
        description={scope === 'platform' ? 'Every question bank across the QuizSet network, at every review stage.' : 'Banks ready to review or power your exams, and requests in progress.'}
        action={
          scope === 'coaching' ? (
            <Button onClick={() => setOpen(true)} disabled={exams.length === 0}>
              <Plus size={15} /> Request a question bank
            </Button>
          ) : undefined
        }
      />
      {scope === 'coaching' && exams.length === 0 && <div className="alert alert-warning">Create an exam first — a question-bank request is always for a specific exam.</div>}

      {scope === 'coaching' && inProgress.length > 0 && (
        <Card className="request-inline-list">
          <div className="card-title">
            <div>
              <h2>Requests in progress</h2>
              <p>Not usable in an exam yet — you'll see them below once they reach Coaching Review.</p>
            </div>
          </div>
          {inProgress.map((r) => (
            <div className="activity" key={r.id}>
              <span className="activity-dot" />
              <div>
                <b>{r.examName}</b>
                <small>{r.status === 'Pending' ? 'Waiting for the platform team to start' : 'Platform team is working on it'}</small>
              </div>
            </div>
          ))}
        </Card>
      )}

      {banks.length === 0 ? (
        <Card>
          <EmptyState
            title="No question banks yet"
            description={scope === 'coaching' ? 'Request one — the platform team will build it from your syllabus.' : 'No banks exist across the network yet.'}
            action={scope === 'coaching' && exams.length > 0 ? <Button onClick={() => setOpen(true)}>Request a question bank</Button> : undefined}
          />
        </Card>
      ) : (
        <>
          <Card className="filter-bar">
            <input type="text" placeholder="Search by name or subject" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All statuses' : s}
                </option>
              ))}
            </select>
            <span className="filter-count">
              {filteredBanks.length} of {banks.length}
            </span>
          </Card>

          {filteredBanks.length === 0 ? (
            <Card>
              <EmptyState title="No banks match" description="Try a different search or status." />
            </Card>
          ) : (
            <div className="bank-grid">
              {filteredBanks.map((b) => (
                <Card key={b.id} className="bank-card">
              <div className="card-title">
                <div>
                  <h2>{b.name}</h2>
                  <p>
                    {b.subject} {scope === 'platform' ? `· ${tenantName(b.tenantId)}` : ''}
                  </p>
                </div>
                <Badge tone={BANK_TONE[b.status]}>{b.status}</Badge>
              </div>
              <BankQuestionCount bankId={b.id} />
              <div className="card-actions">
                <Link href={`/${scope}/question-banks/${b.id}`} className="btn btn-ghost">
                  {scope === 'coaching' && b.status === 'Coaching Review' ? 'Review & edit' : 'View questions'}
                </Link>
                {scope === 'coaching' && b.status === 'Coaching Review' && (
                  <Button size="sm" onClick={() => finalize(b)}>
                    <Check size={13} /> Finalize
                  </Button>
                )}
                </div>
              </Card>
              ))}
            </div>
          )}
        </>
      )}

      {open && (
        <Modal
          title="Request a question bank"
          onClose={() => {
            setOpen(false);
            setForm(BLANK_FORM);
          }}
        >
          <Field label="Exam this is for" required>
            <select value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })}>
              <option value="">Choose an exam</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subjects" required>
            <input className="form-input" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="Quantitative Aptitude, Reasoning" />
          </Field>
          <div className="form-grid">
            <Field label="Questions required">
              <input className="form-input" value={form.questionsRequired} onChange={(e) => setForm({ ...form, questionsRequired: e.target.value })} />
            </Field>
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as QuestionBankRequest['priority'] })}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </Field>
          </div>
          <Field label="Difficulty mix">
            <input className="form-input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} />
          </Field>
          <Field label="Syllabus file" required>
            <label className="file-drop">
              <FileUp size={16} />
              <span>{form.fileName || 'Choose a PDF or image (simulated upload)'}</span>
              <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={(e) => setForm({ ...form, fileName: e.target.files?.[0]?.name || '' })} />
            </label>
          </Field>
          <Field label="Units / Topics (optional)" htmlFor="unitsTopics">
            <textarea
              id="unitsTopics"
              className="form-input"
              value={form.unitsTopics}
              onChange={(e) => setForm({ ...form, unitsTopics: e.target.value })}
              placeholder="If you already know your syllabus breakdown, list it here — e.g. Reasoning: Analogy, Coding-Decoding. Leave blank and the platform team will work it out from your syllabus file."
            />
          </Field>
          <Field label="Notes">
            <textarea className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything else the platform team should know" />
          </Field>
          <div className="form-actions">
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setForm(BLANK_FORM);
              }}
            >
              Cancel
            </Button>
            <Button onClick={submitRequest} disabled={!form.examId}>
              <BookOpen size={14} /> Send request
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function BankQuestionCount({ bankId }: { bankId: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    import('@/services/mock').then(({ questionService }) => questionService.listByBank(bankId)).then((qs) => setCount(qs.length));
  }, [bankId]);
  return <p className="bank-count">{count === null ? 'Loading…' : `${count} question${count === 1 ? '' : 's'}`}</p>;
}
