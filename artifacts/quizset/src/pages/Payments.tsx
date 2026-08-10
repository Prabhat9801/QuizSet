import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, Skeleton, Stat } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { paymentService, tenantService } from '@/services/api';
import { Tenant, Transaction } from '@/types';
import { formatRupees } from '@/lib/format';

const KIND_LABEL: Record<Transaction['kind'], string> = { course: 'Course access', live_test: 'Live test', chatbot: 'AI assistant' };

export function PaymentsPage({ scope = 'coaching' }: { scope?: 'coaching' | 'platform' }) {
  const { tenantId } = useApp();
  const [rows, setRows] = useState<Transaction[] | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [kindFilter, setKindFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    const scopedTenantId = scope === 'coaching' ? tenantId ?? undefined : undefined;
    paymentService.list(scopedTenantId).then((all) => setRows(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())));
    if (scope === 'platform') tenantService.list().then(setTenants);
  }, [scope, tenantId]);

  if (!rows) return <Skeleton className="skeleton-page" />;

  const tenantName = (id: string) => tenants.find((t) => t.id === id)?.name || id;
  const successful = rows.filter((r) => r.status === 'Success');
  const total = successful.reduce((sum, r) => sum + r.amount, 0);
  const today = successful.filter((r) => new Date(r.createdAt).toDateString() === new Date().toDateString()).reduce((sum, r) => sum + r.amount, 0);
  const filteredRows = rows.filter((r) => (kindFilter === 'All' || r.kind === kindFilter) && (statusFilter === 'All' || r.status === statusFilter));

  return (
    <>
      <PageHeader eyebrow="Money in" title="Payments" description={scope === 'platform' ? 'Every transaction collected across the network.' : 'Track course, live test and chatbot revenue.'} />
      <div className="stats-grid">
        <Stat label="Today" value={formatRupees(today)} icon={<CreditCard />} />
        <Stat label="Total collected" value={formatRupees(total)} icon={<CreditCard />} />
        <Stat label="Transactions" value={String(rows.length)} icon={<CreditCard />} />
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No transactions yet" description="Payments will show up here as students purchase courses, live tests or the AI assistant." />
        </Card>
      ) : (
        <>
          <Card className="filter-bar">
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="All">All products</option>
              <option value="course">Course access</option>
              <option value="live_test">Live test</option>
              <option value="chatbot">AI assistant</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All statuses</option>
              <option value="Success">Success</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
            </select>
            <span className="filter-count">
              {filteredRows.length} of {rows.length}
            </span>
          </Card>
          {filteredRows.length === 0 ? (
            <Card>
              <EmptyState title="No transactions match" description="Try a different product or status." />
            </Card>
          ) : (
          <Card>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  {scope === 'platform' && <th>Coaching</th>}
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    {scope === 'platform' && <td>{tenantName(r.tenantId)}</td>}
                    <td>
                      {KIND_LABEL[r.kind]} · {r.label}
                    </td>
                    <td>{formatRupees(r.amount)}</td>
                    <td>
                      <Badge tone={r.status === 'Success' ? 'success' : r.status === 'Pending' ? 'warning' : 'danger'}>{r.status}</Badge>
                    </td>
                    <td>{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
          )}
        </>
      )}
    </>
  );
}
