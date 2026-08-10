import { useState } from 'react';
import { ArrowRight, RefreshCw, Save } from 'lucide-react';
import { Alert, Button, Card, Field, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { ApiError, tenantService } from '@/services/api';

/** Matches the api-server's own `joinCodeFrom()` — a short, memorable
 * upper-case code new coaching owners can hand out immediately without
 * having to think one up. The owner can still overwrite it with anything. */
function randomJoinCode(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7).toUpperCase() || 'COACHING';
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Unlike the earlier version of this page, saving here actually repaints the
 * whole app — not just this page's own preview card. `refreshTenants()`
 * reloads AppContext's tenant list, which re-runs the branding effect that
 * writes --primary/--secondary onto <html> (see services/branding.ts). Every
 * button, badge and accent that reads hsl(var(--primary)) updates instantly,
 * for this coaching's students too.
 */
export function Branding() {
  const { tenant, tenantId, toast, refreshTenants } = useApp();
  const [form, setForm] = useState({ name: tenant.name, supportEmail: tenant.supportEmail, primaryColor: tenant.primaryColor, secondaryColor: tenant.secondaryColor, welcome: 'Prepare with intent. Your next score starts here.' });
  const [saving, setSaving] = useState(false);

  const [joinCode, setJoinCode] = useState(tenant.joinCode);
  const [savingCode, setSavingCode] = useState(false);
  const [codeError, setCodeError] = useState('');

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    await tenantService.update(tenantId, { name: form.name, supportEmail: form.supportEmail, primaryColor: form.primaryColor, secondaryColor: form.secondaryColor });
    await refreshTenants();
    setSaving(false);
    toast('Branding saved', 'Your students see this the moment they next load a page.');
  };

  const saveJoinCode = async (code: string) => {
    if (!tenantId) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setCodeError('');
    setSavingCode(true);
    try {
      await tenantService.update(tenantId, { joinCode: trimmed });
      await refreshTenants();
      setJoinCode(trimmed);
      toast('Join code updated', 'Students use this code to join your coaching.');
    } catch (err) {
      setCodeError(err instanceof ApiError ? err.message : 'Could not update the join code.');
    } finally {
      setSavingCode(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="White-label studio"
        title="Make it unmistakably yours."
        description="Your brand is the first signal students trust."
        action={
          <Button onClick={save} disabled={saving}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />
      <div className="branding-grid">
        <Card>
          <div className="card-title">
            <div>
              <h2>Brand identity</h2>
              <p>Set the details your learners see everywhere</p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Institute name">
              <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Support email">
              <input className="form-input" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
            </Field>
            <Field label="Primary color">
              <input className="form-input color-field" type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            </Field>
            <Field label="Secondary color">
              <input className="form-input color-field" type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
            </Field>
          </div>
          <Field label="Welcome message">
            <textarea className="form-input" value={form.welcome} onChange={(e) => setForm({ ...form, welcome: e.target.value })} />
          </Field>
        </Card>
        <Card>
          <div className="card-title">
            <div>
              <h2>Join code</h2>
              <p>Share this with your students so they can join your coaching</p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Join code">
              <input
                className="form-input"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onBlur={() => joinCode.trim() && joinCode.trim().toUpperCase() !== tenant.joinCode && saveJoinCode(joinCode)}
                placeholder="e.g. SUNRISE2026"
              />
            </Field>
            <Field label=" ">
              <Button variant="secondary" disabled={savingCode} onClick={() => saveJoinCode(randomJoinCode(tenant.name))}>
                <RefreshCw size={14} /> Generate a new code
              </Button>
            </Field>
          </div>
          <Alert tone="danger">{codeError}</Alert>
        </Card>
        <Card className="brand-preview">
          <div className="preview-label">LIVE PREVIEW</div>
          <div className="brand-preview-window" style={{ '--brand': form.primaryColor } as any}>
            <div className="brand-preview-head">
              <span className="preview-logo">{tenant.initials}</span>
              <b>{form.name}</b>
              <small>Student workspace</small>
            </div>
            <div className="brand-preview-hero">
              <span>GOOD MORNING, RAHUL</span>
              <h2>
                {form.welcome.split('.')[0]}.
                <br />
                {form.welcome.split('.').slice(1).join('.')}
              </h2>
              <button>
                Continue learning <ArrowRight size={13} />
              </button>
            </div>
            <div className="brand-preview-stat">
              <div>
                <b>78%</b>
                <small>Performance</small>
              </div>
              <div>
                <b>6 days</b>
                <small>Streak</small>
              </div>
              <div>
                <b>12</b>
                <small>Tests complete</small>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
