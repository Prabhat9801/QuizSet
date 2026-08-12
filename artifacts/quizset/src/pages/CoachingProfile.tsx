import { useEffect, useState } from 'react';
import { KeyRound, Mail, Save, User } from 'lucide-react';
import { Alert, Button, Card, Field, PageHeader } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { ApiError, profileService } from '@/services/api';

/**
 * Real `/coaching/settings` screen (previously a `GenericPage` placeholder —
 * see App.tsx's route table) — the coaching OWNER's own personal details
 * (name/email/phone), distinct from Branding.tsx's tenant-identity settings
 * (institute name, colors, logo, support contact, join code). This page
 * exists purely for "who am I", not "what does my coaching look like to
 * students" — a coaching owner looking for their institute's public
 * identity should go to Branding instead.
 *
 * Structurally a near-copy of Profile.tsx (the student version) since the
 * underlying data (name/email/phone on the same `profiles` row) and the
 * `PATCH /api/profiles/:id` route are identical for every role — kept as a
 * separate component rather than branching Profile.tsx on role, since the
 * copy/framing genuinely differs (a coaching owner needs the Branding
 * cross-reference note; a student doesn't).
 */
export function CoachingProfile() {
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
        title="Settings"
        description="Your own name and contact details — for your coaching's public branding, go to Branding instead."
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
            <p>This is about you, not your institute — see Branding for your coaching's name, logo and colors.</p>
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
          To change your password, sign out and use "Forgot password?" on the sign-in screen — it sends a real code to your email.
        </p>
      </Card>
    </>
  );
}
