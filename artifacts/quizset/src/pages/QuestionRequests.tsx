import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Check, FileText, X } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Modal, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { questionBankRequestService, tenantService } from '@/services/mock';
import { QuestionBankRequest, Tenant } from '@/types';

const STAGES: QuestionBankRequest['status'][] = ['Pending', 'Under Review', 'Question Bank Being Created', 'Question Bank Ready', 'Published'];

const PRIORITY_TONE: Record<QuestionBankRequest['priority'], 'danger' | 'warning' | 'neutral'> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
};

/**
 * Platform-owner side of the syllabus → question-bank pipeline. This is the
 * real core workflow the platform owner does daily — turning a coaching's
 * syllabus into a usable question bank — not a decorative placeholder.
 */
export function QuestionRequests() {
  const { toast } = useApp();
  const [requests, setRequests] = useState<QuestionBankRequest[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<QuestionBankRequest | null>(null);

  const load = useCallback(async () => {
    const [reqs, tenantList] = await Promise.all([questionBankRequestService.list(), tenantService.list()]);
    setRequests(reqs);
    setTenants(tenantList);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name || id;

  const advance = async (r: QuestionBankRequest) => {
    const updated = await questionBankRequestService.advance(r.id);
    await load();
    setSelected(updated);
    toast('Request moved forward', `${r.examName} is now "${updated.status}".`);
  };

  const reject = async (r: QuestionBankRequest) => {
    await questionBankRequestService.reject(r.id);
    await load();
    setSelected(null);
    toast('Request sent back', `${r.examName} has been reset to Pending with a note.`, 'info');
  };

  if (!requests) return null;

  return (
    <>
      <PageHeader eyebrow="Content pipeline" title="Question requests" description="Review, accept and move every question-bank request through its production stages." />

      {requests.length === 0 ? (
        <Card>
          <EmptyState title="No requests yet" description="Coachings will show up here once they ask for a question bank." />
        </Card>
      ) : (
        <div className="request-list">
          {requests.map((r) => (
            <Card key={r.id} className="request-card" onClick={() => setSelected(r)}>
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
              <Badge tone={r.status === 'Published' ? 'success' : r.status === 'Pending' ? 'neutral' : 'info'}>{r.status}</Badge>
            </Card>
          ))}
        </div>
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
            {selected.notes && (
              <div className="request-notes">
                <b>Notes from the coaching</b>
                <p>{selected.notes}</p>
              </div>
            )}
            {selected.ownerNote && (
              <div className="request-notes">
                <b>Your last note</b>
                <p>{selected.ownerNote}</p>
              </div>
            )}
          </div>
          <div className="form-actions">
            {selected.status !== 'Published' && (
              <Button variant="ghost" onClick={() => reject(selected)}>
                <X size={14} /> Send back
              </Button>
            )}
            {selected.status === 'Published' ? (
              <Button variant="secondary" disabled>
                <Check size={14} /> Published
              </Button>
            ) : (
              <Button onClick={() => advance(selected)}>
                <BookOpen size={14} /> {selected.status === 'Question Bank Ready' ? 'Publish to exam catalog' : 'Move to next stage'} <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
