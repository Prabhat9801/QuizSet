import { useEffect, useState } from 'react';
import { Link, useSearch } from 'wouter';
import { Eye, FileText, Plus } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, Tabs } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { courseService, CourseWithCount, tenantService } from '@/services/api';
import { formatRupees } from '@/lib/format';
import { Tenant } from '@/types';

const TABS = [
  { value: 'All', label: 'All' },
  { value: 'Published', label: 'Published' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Upcoming', label: 'Upcoming' },
  { value: 'Archived', label: 'Archived' },
];

export function CoursesPage({ scope = 'coaching' }: { scope?: 'coaching' | 'platform' }) {
  const { tenant, tenantId } = useApp();
  const search = new URLSearchParams(useSearch());
  const filterTenantId = scope === 'platform' ? search.get('tenant') : tenantId;

  const [items, setItems] = useState<CourseWithCount[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tab, setTab] = useState('All');

  useEffect(() => {
    courseService.listWithCounts(filterTenantId ?? undefined).then(setItems);
    if (scope === 'platform') tenantService.list().then(setTenants);
  }, [scope, filterTenantId]);

  if (!items) return null;

  const filtered = items.filter((c) => tab === 'All' || c.status === tab);
  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name || id;

  return (
    <>
      <PageHeader
        eyebrow={scope === 'platform' ? 'Platform catalog' : tenant.name}
        title="Practice Sets"
        description={scope === 'platform' ? 'Every practice set across the QuizSet network.' : 'Configure, publish and learn from your practice sets.'}
        action={
          scope === 'coaching' ? (
            <Link href="/coaching/courses/create" className="btn btn-primary">
              <Plus size={15} /> Create practice set
            </Link>
          ) : undefined
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {filtered.length === 0 ? (
        <Card>
          <EmptyState title="No practice sets in this view" description="Create or publish a practice set to make this list useful." action={scope === 'coaching' ? <Link href="/coaching/courses/create" className="btn btn-primary">Create practice set</Link> : undefined} />
        </Card>
      ) : (
        <div className="exam-grid">
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} scope={scope} coachingName={scope === 'platform' ? tenantName(c.tenantId) : undefined} />
          ))}
        </div>
      )}
    </>
  );
}

function CourseCard({ course, scope, coachingName }: { course: CourseWithCount; scope: 'coaching' | 'platform'; coachingName?: string }) {
  // Coaching opens the course to edit price/status; platform opens the course's
  // question bank, since adding questions is the platform owner's real job here.
  const viewHref = scope === 'platform' ? `/platform/question-banks/${course.questionBankId}` : `/coaching/courses/${course.id}`;
  const viewLabel = scope === 'platform' ? 'Manage questions' : 'Edit';
  return (
    <Card className="exam-card">
      <div className="exam-accent" />
      <Badge tone={course.status === 'Published' ? 'success' : course.status === 'Upcoming' ? 'warning' : 'neutral'}>{course.status.toUpperCase()}</Badge>
      <h3>{course.name}</h3>
      <p>
        {coachingName ? `${coachingName} · ` : ''}
        {course.subject}
      </p>
      <div className="exam-meta">
        <span>
          <FileText size={12} />
          {course.questionCount} question{course.questionCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="price">
        <strong>{course.sale ? formatRupees(course.sale) : 'Free'}</strong>
        {course.mrp > course.sale && (
          <>
            <del>{formatRupees(course.mrp)}</del>
            <i>{Math.round(((course.mrp - course.sale) / course.mrp) * 100)}% off</i>
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
