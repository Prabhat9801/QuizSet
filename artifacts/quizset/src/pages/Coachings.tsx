import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Edit3, Eye, Pause, Plus, Users } from 'lucide-react';
import { Link } from 'wouter';
import { Badge, Button, Card, Field, Modal, PageHeader, Stat } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { examService, paymentService, studentService, tenantService } from '@/services/mock';
import { Tenant } from '@/types';
import { formatRupees } from '@/lib/format';

/**
 * Platform-owner view of every coaching on the network. Previously this page
 * always rendered the seed array and never read back what tenantService had
 * persisted, so a newly created coaching disappeared on reload — fixed by
 * loading through tenantService like every other list here does.
 */
export function Coachings() {
  const { toast, refreshTenants } = useApp();
  const [items, setItems] = useState<Tenant[] | null>(null);
  const [revenueByTenant, setRevenueByTenant] = useState<Record<string, number>>({});
  const [examCounts, setExamCounts] = useState<Record<string, number>>({});
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<Tenant | null>(null);
  const [form, setForm] = useState({ name: '', owner: '', city: '', category: 'Competitive Exam Coaching', plan: 'Growth', supportEmail: '' });

  const load = useCallback(async () => {
    const list = await tenantService.list();
    setItems(list);
    const revenue: Record<string, number> = {};
    const exams: Record<string, number> = {};
    const students: Record<string, number> = {};
    for (const t of list) {
      revenue[t.id] = (await paymentService.list(t.id)).filter((tx) => tx.status === 'Success').reduce((sum, tx) => sum + tx.amount, 0);
      exams[t.id] = (await examService.list(t.id)).length;
      // t.students is a static seed number that never moves as students actually
      // join — the real, live count comes from the students list, same as the
      // coaching-owner's own Students page computes it.
      students[t.id] = (await studentService.list(t.id)).length;
    }
    setRevenueByTenant(revenue);
    setExamCounts(exams);
    setStudentCounts(students);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.name) return;
    const t = await tenantService.create(form);
    await load();
    await refreshTenants();
    setCreated(t);
    setOpen(false);
    toast('Coaching created', `${t.name} has its own workspace and join code.`);
  };

  const suspend = async (t: Tenant) => {
    toast('Status updated', `${t.name} would be suspended here — no separate "suspended" field exists yet on Tenant, so this is a UI acknowledgement only.`, 'info');
  };

  if (!items) return null;

  const active = items.length;
  const totalStudents = Object.values(studentCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        eyebrow="Platform network"
        title="Coachings"
        description="Manage every institute that trusts QuizSet with their digital exam business."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={15} /> Create coaching
          </Button>
        }
      />

      <div className="stats-grid">
        <Stat label="Total coachings" value={String(active)} icon={<Users />} />
        <Stat label="Total students across network" value={totalStudents.toLocaleString('en-IN')} icon={<CheckCircle2 />} />
        <Stat label="Exams published" value={String(Object.values(examCounts).reduce((a, b) => a + b, 0))} icon={<Clock3 />} />
        <Stat label="Revenue collected" value={formatRupees(Object.values(revenueByTenant).reduce((a, b) => a + b, 0))} icon={<Pause />} />
      </div>

      <Card>
        <div className="card-title">
          <div>
            <h2>All coachings</h2>
            <p>Tenant health and commercial status</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Coaching</th>
                <th>Owner</th>
                <th>Students</th>
                <th>Plan</th>
                <th>Exams</th>
                <th>Revenue</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.name}</b>
                    <small className="table-sub">
                      {t.city} · {t.id}
                    </small>
                  </td>
                  <td>{t.owner}</td>
                  <td>{(studentCounts[t.id] ?? 0).toLocaleString('en-IN')}</td>
                  <td>
                    <Badge tone={t.plan === 'Enterprise' ? 'info' : 'neutral'}>{t.plan}</Badge>
                  </td>
                  <td>{examCounts[t.id] ?? 0}</td>
                  <td>{formatRupees(revenueByTenant[t.id] ?? 0)}</td>
                  <td className="row-actions">
                    <Link href={`/platform/exams?tenant=${t.id}`}>
                      <Eye size={14} />
                    </Link>
                    <button onClick={() => toast('Edit mode ready', 'Connect a backend to persist advanced fields.')}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => suspend(t)}>
                      <Pause size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {open && (
        <Modal title="Create a coaching" onClose={() => setOpen(false)}>
          <div className="form-grid">
            <Field label="Institute name" required>
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. North Star Academy" />
            </Field>
            <Field label="Owner name">
              <input className="form-input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Owner full name" />
            </Field>
            <Field label="City">
              <input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
            </Field>
            <Field label="Plan">
              <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                <option>Starter</option>
                <option>Growth</option>
                <option>Enterprise</option>
              </select>
            </Field>
            <Field label="Support email">
              <input className="form-input" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} placeholder="support@institute.in" />
            </Field>
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Create coaching</Button>
          </div>
        </Modal>
      )}

      {created && (
        <Modal title="Workspace created" onClose={() => setCreated(null)}>
          <div className="success-panel">
            <CheckCircle2 size={27} />
            <h3>{created.name} is ready</h3>
            <p>Share this join code with students and use the workspace to configure your first exam.</p>
            <div className="code-grid">
              <div>
                <small>COACHING ID</small>
                <b>{created.id.toUpperCase()}</b>
              </div>
              <div>
                <small>JOIN CODE</small>
                <b>{created.joinCode}</b>
              </div>
            </div>
            <Button onClick={() => setCreated(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
