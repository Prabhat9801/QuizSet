import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Building2, CheckCircle2, Search } from 'lucide-react';
import { Button, Card, PageHeader, Tabs } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { authService, joinRequestService, tenantService } from '@/services/mock';
import { Tenant } from '@/types';

/**
 * Shown whenever a logged-in student has no tenantId yet — see the route
 * guard in App.tsx. Two flows from the spec: an exact join code enrolls
 * immediately; searching and requesting to join creates a Pending row the
 * coaching approves later.
 */
export function JoinFlow() {
  const { user, login, toast } = useApp();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState('code');

  // ---- Flow A: join code ----
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Tenant | null>(null);
  const [codeError, setCodeError] = useState('');

  const lookupCode = async () => {
    setCodeError('');
    const tenant = await tenantService.findByJoinCode(code);
    if (!tenant) {
      setCodeError('No coaching found with that join code.');
      setFound(null);
      return;
    }
    setFound(tenant);
  };

  const joinNow = async () => {
    if (!found || !user) return;
    const { user: updated } = await joinRequestService.joinByCode(user.id, found.joinCode);
    login(updated);
    toast('Welcome to ' + found.name, 'You can now see your exams.');
    navigate('/student/dashboard', { replace: true });
  };

  // ---- Flow B: search + request ----
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Tenant[]>([]);
  const [requestedId, setRequestedId] = useState<string | null>(null);

  const search = async (q: string) => {
    setQuery(q);
    setResults(q.trim() ? await tenantService.search(q) : []);
  };

  const requestJoin = async (tenant: Tenant) => {
    if (!user) return;
    await joinRequestService.requestToJoin(user.name, user.email, tenant.id);
    setRequestedId(tenant.id);
    toast('Request sent', `${tenant.name} will review your request.`);
  };

  return (
    <div className="join-flow">
      <PageHeader eyebrow="One step left" title="Join your coaching" description="Use a join code from your coaching, or search for one and request to join." />
      <Card className="join-card">
        <Tabs
          tabs={[
            { value: 'code', label: 'Join code' },
            { value: 'search', label: 'Search coaching' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'code' && (
          <div className="join-code-flow">
            <label className="field">
              <span>Join code</span>
              <input className="form-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. SUNRISE2026" />
            </label>
            {codeError && <div className="login-error">{codeError}</div>}
            {!found ? (
              <Button onClick={lookupCode} disabled={!code.trim()}>
                Find coaching <ArrowRight size={14} />
              </Button>
            ) : (
              <div className="found-tenant">
                <div className="found-tenant-avatar">{found.initials}</div>
                <div>
                  <b>{found.name}</b>
                  <small>
                    {found.city} · {found.category}
                  </small>
                </div>
                <Button onClick={joinNow}>Join coaching</Button>
              </div>
            )}
          </div>
        )}

        {tab === 'search' && (
          <div className="join-search-flow">
            <label className="field">
              <span>Search by name or city</span>
              <div className="search-input-inline">
                <Search size={16} />
                <input value={query} onChange={(e) => search(e.target.value)} placeholder="Sunrise Academy" />
              </div>
            </label>
            <div className="search-results">
              {results.map((t) => (
                <div className="found-tenant" key={t.id}>
                  <div className="found-tenant-avatar">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <b>{t.name}</b>
                    <small>
                      {t.city} · {t.category}
                    </small>
                  </div>
                  {requestedId === t.id ? (
                    <span className="badge badge-warning">
                      <CheckCircle2 size={12} /> Pending
                    </span>
                  ) : (
                    <Button variant="secondary" onClick={() => requestJoin(t)}>
                      Request to join
                    </Button>
                  )}
                </div>
              ))}
              {query.trim() && results.length === 0 && <p className="search-empty">No coaching matches “{query}”.</p>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
