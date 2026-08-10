import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { tenantService, testimonialService } from '@/services/api';
import { Tenant, Testimonial } from '@/types';

/**
 * Platform owner's queue — the second, final gate. Only ever shows
 * testimonials the coaching owner has ALREADY approved (see
 * testimonialService.listPendingPlatform) — a story the coaching hasn't
 * cleared yet never reaches this screen.
 */
export function PlatformTestimonials() {
  const { toast } = useApp();
  const [items, setItems] = useState<Testimonial[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [query, setQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState('All');

  const load = useCallback(async () => {
    const [pending, tenantList] = await Promise.all([testimonialService.listPendingPlatform(), tenantService.list()]);
    setItems(pending);
    setTenants(tenantList);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name || id;

  const approve = async (t: Testimonial) => {
    await testimonialService.approvePlatform(t.id);
    await load();
    toast('Story published', `${t.studentName}'s testimonial is now public.`);
  };

  if (!items) return null;

  const q = query.trim().toLowerCase();
  const filtered = items.filter(
    (t) => (tenantFilter === 'All' || t.tenantId === tenantFilter) && (!q || t.studentName.toLowerCase().includes(q) || t.content.toLowerCase().includes(q))
  );

  return (
    <>
      <PageHeader eyebrow="Trust & marketing" title="Testimonials" description="Stories the coaching has already approved — your sign-off is the last gate before they go public." />

      {items.length === 0 ? (
        <Card>
          <EmptyState title="Nothing waiting on you" description="Testimonials show up here only after their coaching owner approves them first." />
        </Card>
      ) : (
        <>
          <Card className="filter-bar">
            <input type="text" placeholder="Search by student or story" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
              <option value="All">All coachings</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="filter-count">
              {filtered.length} of {items.length}
            </span>
          </Card>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState title="No stories match" description="Try a different search or coaching." />
            </Card>
          ) : (
            <div className="request-list">
              {filtered.map((t) => (
                <Card key={t.id} className="request-card" style={{ cursor: 'default' }}>
                  <div className="request-top">
                    <div>
                      <b>{t.studentName}</b>
                      <small>
                        {tenantName(t.tenantId)} · {t.courseName || 'General feedback'}
                      </small>
                    </div>
                    <Badge tone="info">Coaching-approved</Badge>
                  </div>
                  <p className="request-meta">
                    “{t.content}”{t.outcome ? ` — ${t.outcome}` : ''}
                  </p>
                  <div className="form-actions">
                    <Button size="sm" onClick={() => approve(t)} data-testid={`button-approve-platform-testimonial-${t.id}`}>
                      <Check size={13} /> Approve for QuizSet
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
