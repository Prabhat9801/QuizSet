import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BookOpen, FileText, Save } from 'lucide-react';
import { useLocation } from 'wouter';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Tabs } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { questionBankRequestService, tenantService } from '@/services/mock';
import { QuestionBankRequest, RequestStatus, Tenant } from '@/types';

const STAGES: RequestStatus[] = ['Pending', 'In Progress', 'Finalized'];

const STAGE_TONE: Record<RequestStatus, 'neutral' | 'info' | 'success'> = {
  Pending: 'neutral',
  'In Progress': 'info',
  Finalized: 'success',
};

const PRIORITY_TONE: Record<QuestionBankRequest['priority'], 'danger' | 'warning' | 'neutral'> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
};

/**
 * Platform-owner side of the exam → question-bank pipeline. This page is
 * only for accepting a request and jumping into its bank — the actual
 * content-review stages (Generating -> Platform Review -> Coaching Review ->
 * Finalized) happen on the bank itself (QuestionBankDetail), since that's
 * where the questions actually live.
 */
export function QuestionRequests() {
  const { toast } = useApp();
  const [, navigate] = useLocation();
  const [requests, setRequests] = useState<QuestionBankRequest[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<QuestionBankRequest | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [tab, setTab] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  const load = useCallback(async () => {
    const [reqs, tenantList] = await Promise.all([questionBankRequestService.list(), tenantService.list()]);
    setRequests(reqs);
    setTenants(tenantList);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name || id;

  const openDetail = (r: QuestionBankRequest) => {
    setSelected(r);
    setNoteDraft(r.ownerNote || '');
  };

  const startBank = async (r: QuestionBankRequest) => {
    const updated = await questionBankRequestService.startBank(r.id);
    await load();
    toast('Bank started', `${r.examName}'s question bank is now being generated.`);
    if (updated.questionBankId) navigate(`/platform/question-banks/${updated.questionBankId}`);
  };

  const saveNote = async () => {
    if (!selected) return;
    await questionBankRequestService.setOwnerNote(selected.id, noteDraft);
    await load();
    toast('Note saved', 'The coaching will see this on their request.', 'info');
  };

  if (!requests) return null;

  const filtered = requests.filter((r) => (tab === 'All' || r.status === tab) && (priorityFilter === 'All' || r.priority === priorityFilter));

  return (
    <>
      <PageHeader eyebrow="Content pipeline" title="Question requests" description="Accept a request, then build and review its bank." />

      {requests.length === 0 ? (
        <Card>
          <EmptyState title="No requests yet" description="Coachings will show up here once they ask for a question bank." />
        </Card>
      ) : (
        <>
          <Tabs
            tabs={[
              { value: 'All', label: 'All', count: requests.length },
              { value: 'Pending', label: 'Pending', count: requests.filter((r) => r.status === 'Pending').length },
              { value: 'In Progress', label: 'In Progress', count: requests.filter((r) => r.status === 'In Progress').length },
              { value: 'Finalized', label: 'Finalized', count: requests.filter((r) => r.status === 'Finalized').length },
            ]}
            value={tab}
            onChange={setTab}
          />
          <Card className="filter-bar">
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="All">All priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <span className="filter-count">
              {filtered.length} of {requests.length}
            </span>
          </Card>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState title="No requests match" description="Try a different status or priority." />
            </Card>
          ) : (
            <div className="request-list">
              {filtered.map((r) => (
            <Card key={r.id} className="request-card" onClick={() => openDetail(r)}>
              <div className="request-top">
                <div>
                  <b>{r.examName}</b>
                  <small>
                    {tenantName(r.tenantId)} · {r.createdAt}
                  </small>
                </div>
                <Badge tone={PRIORITY_TONE[r.priority]}>{r.priority}</Badge>
              </div>
              <p className="request-meta">
                {r.subjects.join(', ')} · {r.questionsRequired} questions · {r.difficulty}
              </p>
              <div className="request-stepper">
                {STAGES.map((s, i) => (
                  <span key={s} className={STAGES.indexOf(r.status) >= i ? 'done' : ''} title={s} />
                ))}
              </div>
              <Badge tone={STAGE_TONE[r.status]}>{r.status}</Badge>
            </Card>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <Modal title={selected.examName} onClose={() => setSelected(null)}>
          <div className="request-detail">
            <div className="request-detail-row">
              <span>Coaching</span>
              <b>{tenantName(selected.tenantId)}</b>
            </div>
            <div className="request-detail-row">
              <span>Subjects</span>
              <b>{selected.subjects.join(', ')}</b>
            </div>
            <div className="request-detail-row">
              <span>Questions required</span>
              <b>{selected.questionsRequired}</b>
            </div>
            <div className="request-detail-row">
              <span>Difficulty</span>
              <b>{selected.difficulty}</b>
            </div>
            {selected.syllabusFileName && (
              <div className="request-detail-row">
                <span>Syllabus file</span>
                <b>
                  <FileText size={13} /> {selected.syllabusFileName}
                </b>
              </div>
            )}
          </div>

          <div className="request-notes">
            <b>{selected.unitsTopics ? 'Syllabus breakdown provided by the coaching' : 'No breakdown provided'}</b>
            <p>{selected.unitsTopics || 'The coaching did not list units/topics — derive them yourself from the syllabus file above.'}</p>
          </div>

          {selected.notes && (
            <div className="request-notes">
              <b>Notes from the coaching</b>
              <p>{selected.notes}</p>
            </div>
          )}

          <div className="request-notes">
            <b>Your note to the coaching</b>
            <textarea className="form-input" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Anything the coaching should know, or a question for them" />
            <Button variant="secondary" size="sm" onClick={saveNote} style={{ marginTop: 8 }}>
              <Save size={13} /> Save note
            </Button>
          </div>

          <div className="form-actions">
            {selected.status === 'Pending' ? (
              <Button onClick={() => startBank(selected)}>
                <BookOpen size={14} /> Start building <ArrowRight size={14} />
              </Button>
            ) : (
              <Button onClick={() => navigate(`/platform/question-banks/${selected.questionBankId}`)}>
                <BookOpen size={14} /> Open question bank <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
