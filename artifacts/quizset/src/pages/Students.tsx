import { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, Pause, Play, UserCheck, UserMinus, Users, X } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader, Stat, Tabs } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { joinRequestService, studentService } from '@/services/mock';
import { JoinRequest, Student } from '@/types';

export function StudentsPage() {
  const { tenant, tenantId, toast } = useApp();
  const [tab, setTab] = useState('students');
  const [items, setItems] = useState<Student[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!tenantId) return;
    const [students, reqs] = await Promise.all([studentService.list(tenantId), joinRequestService.listForTenant(tenantId)]);
    setItems(students);
    setRequests(reqs);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (s: Student, status: Student['status']) => {
    await studentService.update(s.id, { status });
    await load();
    toast('Student status updated', `${s.name} is now ${status.toLowerCase()}.`);
  };

  const decide = async (r: JoinRequest, approve: boolean) => {
    await joinRequestService.decide(r.id, approve);
    await load();
    toast(approve ? 'Student approved' : 'Request rejected', approve ? `${r.studentName} can now access your exams.` : `${r.studentName}'s request was declined.`);
  };

  const pendingRequests = requests.filter((r) => r.status === 'Pending');
  const active = items.filter((s) => s.status === 'Active').length;
  const pending = items.filter((s) => s.status === 'Pending').length;
  const suspended = items.filter((s) => s.status === 'Suspended').length;
  const q = query.trim().toLowerCase();
  const filteredStudents = items.filter(
    (s) => (statusFilter === 'All' || s.status === statusFilter) && (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
  );

  return (
    <>
      <PageHeader eyebrow="Learner community" title="Students" description="Keep every learner moving with clear access and useful insight." />
      <div className="stats-grid">
        <Stat label="Total students" value={String(items.length)} icon={<Users />} />
        <Stat label="Active" value={String(active)} icon={<UserCheck />} />
        <Stat label="Pending" value={String(pending)} icon={<Clock3 />} />
        <Stat label="Suspended" value={String(suspended)} icon={<UserMinus />} />
      </div>

      <Tabs
        tabs={[
          { value: 'students', label: 'Directory', count: items.length },
          { value: 'requests', label: 'Join requests', count: pendingRequests.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'students' &&
        (items.length === 0 ? (
          <Card>
            <EmptyState title="No students yet" description={`Share your join code (${tenant.joinCode}) so students can join.`} />
          </Card>
        ) : (
          <>
            <Card className="filter-bar">
              <input type="text" placeholder="Search by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Suspended">Suspended</option>
              </select>
              <span className="filter-count">
                {filteredStudents.length} of {items.length}
              </span>
            </Card>
            <Card>
            <div className="card-title">
              <div>
                <h2>Student directory</h2>
                <p>{tenant.name} · all cohorts</p>
              </div>
            </div>
            {filteredStudents.length === 0 ? (
              <EmptyState title="No students match" description="Try a different search or status." />
            ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Joined</th>
                    <th>Exams</th>
                    <th>Performance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <b>{s.name}</b>
                        <small className="table-sub">{s.phone || '—'}</small>
                      </td>
                      <td>{s.email}</td>
                      <td>{s.joined}</td>
                      <td>{s.exams}</td>
                      <td>
                        <span className="score">{s.score ? s.score + '%' : '—'}</span>
                      </td>
                      <td>
                        <Badge tone={s.status === 'Active' ? 'success' : s.status === 'Pending' ? 'warning' : 'danger'}>{s.status}</Badge>
                      </td>
                      <td className="row-actions">
                        {s.status === 'Pending' && (
                          <button onClick={() => update(s, 'Active')}>
                            <Check size={14} />
                          </button>
                        )}
                        {s.status === 'Active' && (
                          <button onClick={() => update(s, 'Suspended')}>
                            <Pause size={14} />
                          </button>
                        )}
                        {s.status === 'Suspended' && (
                          <button onClick={() => update(s, 'Active')}>
                            <Play size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            </Card>
          </>
        ))}

      {tab === 'requests' &&
        (pendingRequests.length === 0 ? (
          <Card>
            <EmptyState title="No pending requests" description="Students who search and request to join will show up here." />
          </Card>
        ) : (
          <div className="request-list">
            {pendingRequests.map((r) => (
              <Card key={r.id} className="request-card">
                <div className="request-top">
                  <div>
                    <b>{r.studentName}</b>
                    <small>
                      {r.studentEmail} · {r.createdAt}
                    </small>
                  </div>
                </div>
                <div className="form-actions">
                  <Button variant="ghost" onClick={() => decide(r, false)}>
                    <X size={14} /> Reject
                  </Button>
                  <Button onClick={() => decide(r, true)}>
                    <Check size={14} /> Approve
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ))}
    </>
  );
}
