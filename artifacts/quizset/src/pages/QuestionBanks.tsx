import { useCallback, useEffect, useState } from 'react';
import { BookOpen, FileUp, Plus } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { questionBankRequestService, questionBankService, tenantService } from '@/services/mock';
import { QuestionBank, QuestionBankRequest, Tenant } from '@/types';

const BANK_TONE: Record<QuestionBank['status'], 'success' | 'warning' | 'neutral'> = {
  Ready: 'success',
  'In Progress': 'warning',
  Pending: 'neutral',
};

/**
 * `scope="platform"` shows every coaching's banks (read-only, for oversight).
 * `scope="coaching"` shows the caller's own banks plus the "request a new
 * bank" flow — the coaching-owner side of the syllabus pipeline, which had no
 * page at all before this.
 */
export function QuestionBanks({ scope = 'coaching' }: { scope?: 'coaching' | 'platform' }) {
  const { tenant, tenantId, toast } = useApp();
  const [banks, setBanks] = useState<QuestionBank[] | null>(null);
  const [requests, setRequests] = useState<QuestionBankRequest[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ examName: '', subjects: '', questionsRequired: '100', difficulty: 'Easy + Medium + Hard', priority: 'Medium' as QuestionBankRequest['priority'], notes: '', fileName: '' });

  const load = useCallback(async () => {
    const scopedTenantId = scope === 'coaching' ? tenantId ?? undefined : undefined;
    const [bankList, requestList, tenantList] = await Promise.all([
      questionBankService.list(scopedTenantId),
      questionBankRequestService.list(scopedTenantId),
      scope === 'platform' ? tenantService.list() : Promise.resolve([]),
    ]);
    setBanks(bankList);
    setRequests(requestList);
    setTenants(tenantList);
  }, [scope, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name || id;

  const submitRequest = async () => {
    if (!form.examName || !tenantId) return;
    await questionBankRequestService.create({
      tenantId,
      examName: form.examName,
      subjects: form.subjects.split(',').map((s) => s.trim()).filter(Boolean),
      questionsRequired: Number(form.questionsRequired) || 50,
      difficulty: form.difficulty,
      priority: form.priority,
      notes: form.notes || undefined,
      syllabusFileName: form.fileName || undefined,
    });
    await load();
    setOpen(false);
    setForm({ examName: '', subjects: '', questionsRequired: '100', difficulty: 'Easy + Medium + Hard', priority: 'Medium', notes: '', fileName: '' });
    toast('Request sent', 'The platform team will review it and start building your bank.');
  };

  if (!banks) return null;

  return (
    <>
      <PageHeader
        eyebrow="Content system"
        title="Question banks"
        description={scope === 'platform' ? 'Every question bank across the QuizSet network.' : 'Banks ready to power your exams, and requests in progress.'}
        action={
          scope === 'coaching' ? (
            <Button onClick={() => setOpen(true)}>
              <Plus size={15} /> Request a question bank
            </Button>
          ) : undefined
        }
      />

      {scope === 'coaching' && requests.filter((r) => r.status !== 'Published').length > 0 && (
        <Card className="request-inline-list">
          <div className="card-title">
            <div>
              <h2>Requests in progress</h2>
              <p>Not usable in an exam yet — you'll see them below once ready.</p>
            </div>
          </div>
          {requests
            .filter((r) => r.status !== 'Published')
            .map((r) => (
              <div className="activity" key={r.id}>
                <span className="activity-dot" />
                <div>
                  <b>{r.examName}</b>
                  <small>{r.status}</small>
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
            action={scope === 'coaching' ? <Button onClick={() => setOpen(true)}>Request a question bank</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="bank-grid">
          {banks.map((b) => (
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
            </Card>
          ))}
        </div>
      )}

      {open && (
        <Modal title="Request a question bank" onClose={() => setOpen(false)}>
          <Field label="Exam this is for" required>
            <input className="form-input" value={form.examName} onChange={(e) => setForm({ ...form, examName: e.target.value })} placeholder="e.g. SSC CGL 2026" />
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
          <Field label="Notes">
            <textarea className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything the platform team should know" />
          </Field>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRequest}>
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
