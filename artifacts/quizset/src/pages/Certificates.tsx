import { useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { Award, Copy, ShieldCheck } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { certificateService } from '@/services/api';
import { Certificate } from '@/types';

/** Same WCAG relative-luminance formula services/branding.ts uses, kept local since this is a one-off
 * per-certificate render (a snapshot color), not a live theme change — no reason to reach into that module. */
function readableOn(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#ffffff';
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(clean.slice(0, 2), 16));
  const g = channel(parseInt(clean.slice(2, 4), 16));
  const b = channel(parseInt(clean.slice(4, 6), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#1c2340' : '#ffffff';
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Student-facing list of their own issued certificates. */
export function StudentCertificates() {
  const { user, toast } = useApp();
  const [rows, setRows] = useState<Certificate[] | null>(null);

  useEffect(() => {
    if (!user) return;
    certificateService.listForStudent(user.id).then(setRows);
  }, [user]);

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/certificate/${code}`);
      toast('Link copied', 'Share it anywhere — no login needed to view it.', 'info');
    } catch {
      toast('Could not copy', 'Copy the link from your browser address bar instead.', 'danger');
    }
  };

  if (!rows) return <Skeleton className="skeleton-page" />;

  return (
    <>
      <PageHeader eyebrow="Recognition" title="Certificates" description="Branded certificates your coaching has issued you, each shareable with a public link." />
      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No certificates yet" description="Your coaching issues these manually — keep practising and it may award you one." />
        </Card>
      ) : (
        <div className="certificate-list">
          {rows.map((c) => (
            <Card key={c.id} className="certificate-list-item">
              <div className="certificate-list-icon" style={{ background: c.coachingThemeColorSnapshot }}>
                <Award size={18} color={readableOn(c.coachingThemeColorSnapshot)} />
              </div>
              <div className="certificate-list-body">
                <b>{c.courseName}</b>
                <small>
                  {c.coachingNameSnapshot} · issued {new Date(c.issuedAt).toLocaleDateString('en-IN')}
                </small>
              </div>
              <div className="table-actions">
                <Link href={`/certificate/${c.certificateCode}`} className="text-link" data-testid={`link-view-certificate-${c.id}`}>
                  View
                </Link>
                <button className="text-link" onClick={() => copyLink(c.certificateCode)} data-testid={`button-copy-certificate-${c.id}`}>
                  <Copy size={13} /> Copy link
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Shareable, public certificate view — reached at /certificate/:code, deliberately NOT wrapped in
 * <Protected>/AppShell so it renders even for a logged-out visitor. Renders the branding SNAPSHOT
 * carried on the certificate record, not the coaching's live branding — this is a one-off visual,
 * not a theme change, so it never touches services/branding.ts's applyBranding().
 */
export function CertificateView() {
  const [, params] = useRoute('/certificate/:code');
  const [certificate, setCertificate] = useState<Certificate | null | undefined>(undefined);

  useEffect(() => {
    if (!params?.code) return;
    certificateService.getByCode(params.code).then((c) => setCertificate(c ?? null));
  }, [params?.code]);

  if (certificate === undefined) {
    return (
      <div className="certificate-page">
        <div className="certificate-loading">
          <Skeleton className="skeleton-page" />
        </div>
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="certificate-page">
        <div className="certificate certificate-missing">
          <ShieldCheck size={30} />
          <h2>Certificate not found</h2>
          <p>This link doesn't match any issued certificate. Double-check the link and try again.</p>
          <Link href="/" className="text-link">
            Go to QuizSet
          </Link>
        </div>
      </div>
    );
  }

  const color = certificate.coachingThemeColorSnapshot;
  const sealText = readableOn(color);

  return (
    <div className="certificate-page">
      <div className="certificate" style={{ borderColor: color }}>
        <div className="certificate-topbar" style={{ background: color }} />
        <div className="certificate-header">
          {certificate.coachingLogoUrlSnapshot ? (
            <img src={certificate.coachingLogoUrlSnapshot} alt={certificate.coachingNameSnapshot} className="certificate-logo" />
          ) : (
            <span className="certificate-seal" style={{ background: color, color: sealText }}>
              {initialsOf(certificate.coachingNameSnapshot)}
            </span>
          )}
          <div>
            <strong>{certificate.coachingNameSnapshot}</strong>
            <small>Certificate of Completion</small>
          </div>
        </div>

        <div className="certificate-body">
          <div className="eyebrow" style={{ color }}>
            THIS CERTIFICATE IS PROUDLY PRESENTED TO
          </div>
          <h1 className="certificate-student">{certificate.studentName}</h1>
          <p className="certificate-lead">
            for successfully completing <b>{certificate.courseName}</b>
          </p>
          {certificate.note && <p className="certificate-note">&ldquo;{certificate.note}&rdquo;</p>}
          <div className="certificate-meta-row">
            <div>
              <small>Issued on</small>
              <b>{new Date(certificate.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</b>
            </div>
            <div>
              <small>Certificate code</small>
              <b className="certificate-code">{certificate.certificateCode}</b>
            </div>
          </div>
        </div>

        <div className="certificate-footer">
          <Badge tone="success">Verified</Badge>
          <span className="certificate-powered">Powered by QuizSet</span>
        </div>
      </div>
    </div>
  );
}
