import { useEffect, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { Clock3, Eye, FileText, Plus } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, Tabs } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { examService, ExamWithCount, tenantService } from '@/services/mock';
import { formatRupees } from '@/lib/format';
import { Tenant } from '@/types';

const TABS = [
  { value: 'All', label: 'All' },
  { value: 'Published', label: 'Published' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Archived', label: 'Archived' },
];

export function ExamsPage({ scope = 'coaching' }: { scope?: 'coaching' | 'platform' }) {
  const { tenant, tenantId } = useApp();
  const search = new URLSearchParams(useSearch());
  const filterTenantId = scope === 'platform' ? search.get('tenant') : tenantId;

  const [items, setItems] = useState<ExamWithCount[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tab, setTab] = useState('All');

  useEffect(() => {
    examService.listWithCounts(filterTenantId ?? undefined).then(setItems);
    if (scope === 'platform') tenantService.list().then(setTenants);
  }, [scope, filterTenantId]);

  if (!items) return null;

  const filtered = items.filter((e) => tab === 'All' || e.status === tab);
  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name || id;

  return (
    <>
      <PageHeader
        eyebrow={scope === 'platform' ? 'Platform catalog' : tenant.name}
        title="Exams"
        description={scope === 'platform' ? 'Every assessment across the QuizSet network.' : 'Configure, publish and learn from your assessments.'}
        action={
          scope === 'coaching' ? (
            <Link href="/coaching/exams/create" className="btn btn-primary">
              <Plus size={15} /> Create exam
            </Link>
          ) : undefined
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {filtered.length === 0 ? (
        <Card>
          <EmptyState title="No exams in this view" description="Create or publish an exam to make this list useful." action={scope === 'coaching' ? <Link href="/coaching/exams/create" className="btn btn-primary">Create exam</Link> : undefined} />
        </Card>
      ) : (
        <div className="exam-grid">
          {filtered.map((e) => (
            <ExamCard key={e.id} exam={e} scope={scope} coachingName={scope === 'platform' ? tenantName(e.tenantId) : undefined} />
          ))}
        </div>
      )}
    </>
  );
}

function ExamCard({ exam, scope, coachingName }: { exam: ExamWithCount; scope: 'coaching' | 'platform'; coachingName?: string }) {
  // Coaching opens the exam to edit price/status; platform opens the exam's
  // question bank, since adding questions is the platform owner's real job here.
  const viewHref = scope === 'platform' ? `/platform/question-banks/${exam.questionBankId}` : `/coaching/exams/${exam.id}`;
  const viewLabel = scope === 'platform' ? 'Manage questions' : 'Edit';
  return (
    <Card className="exam-card">
      <div className="exam-accent" />
      <Badge tone={exam.status === 'Published' ? 'success' : exam.status === 'Upcoming' ? 'warning' : 'neutral'}>{exam.status.toUpperCase()}</Badge>
      <h3>{exam.name}</h3>
      <p>
        {coachingName ? `${coachingName} · ` : ''}
        {exam.subject} · {exam.type}
      </p>
      <div className="exam-meta">
        <span>
          <FileText size={12} />
          {exam.questionCount} question{exam.questionCount === 1 ? '' : 's'}
        </span>
        {exam.type !== 'Practice Quiz' && (
          <span>
            <Clock3 size={12} />
            {exam.duration} min
          </span>
        )}
      </div>
      <div className="price">
        <strong>{exam.sale ? formatRupees(exam.sale) : 'Free'}</strong>
        {exam.mrp > exam.sale && (
          <>
            <del>{formatRupees(exam.mrp)}</del>
            <i>{Math.round(((exam.mrp - exam.sale) / exam.mrp) * 100)}% off</i>
          </>
        )}
      </div>
      <div className="card-actions">
        <Link href={viewHref} className="btn btn-ghost">
          <Eye size={14} /> {viewLabel}
        </Link>
      </div>
    </Card>
  );
}
