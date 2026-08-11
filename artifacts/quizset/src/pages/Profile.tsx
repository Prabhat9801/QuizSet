import { useEffect, useState } from 'react';
import { KeyRound, Mail, Save, User } from 'lucide-react';
import { Alert, Button, Card, Field, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { ApiError, profileService } from '@/services/api';

/**
 * Real `/student/profile` screen (previously a `GenericPage` placeholder —
 * see App.tsx's route table). Email is read-only: it's the Supabase auth
 * identity, and changing it is out of scope here (would need a re-verification
 * flow, not a plain profile PATCH). Name/phone save via the same
 * `PATCH /api/profiles/:id` route Students.tsx already uses for name/status,
 * now also accepting `phone` — see profiles.ts's own comment on that guard.
 */
export function Profile() {
  const { user, toast } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await profileService.getMe();
        if (cancelled) return;
        setName(me.name);
        setPhone(me.phone || '');
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load your profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      await profileService.updateMe(user.id, { name, phone });
      toast('Profile saved', 'Your details have been updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="Profile"
        description="Keep your contact details up to date."
        action={
          <Button onClick={save} disabled={saving || loading}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />
      <Card>
        <div className="card-title">
          <div>
            <h2>Personal details</h2>
            <p>Visible only to you and your coaching</p>
          </div>
          <User size={19} color="hsl(var(--primary))" />
        </div>
        <Alert tone="danger">{error}</Alert>
        <div className="form-grid">
          <Field label="Name">
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
          </Field>
          <Field label="Email">
            <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--muted-foreground))' }}>
              <Mail size={14} /> {user?.email}
            </div>
          </Field>
          <Field label="Phone">
            <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} placeholder="e.g. 98765 43210" />
          </Field>
        </div>
      </Card>
      <div className="section-spacer" />
      <Card>
        <div className="card-title">
          <div>
            <h2>Password</h2>
            <p>Change your account password</p>
          </div>
          <KeyRound size={19} color="hsl(var(--primary))" />
        </div>
        <p style={{ color: 'hsl(var(--muted-foreground))' }}>
          Password changes aren't available from this screen yet — contact your coaching's support if you need a reset.
        </p>
      </Card>
    </>
  );
}
