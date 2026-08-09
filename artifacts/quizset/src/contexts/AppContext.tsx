import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '@/services/mock';
import { AuthUser, Role, Tenant, Toast } from '@/types';
import { storage } from '@/services/storage';
import { applyBranding, resetBranding } from '@/services/branding';
import { tenants as seedTenants } from '@/data/seed';

// A safe, neutral stand-in for contexts where there is genuinely no tenant —
// the platform owner isn't a member of any coaching, and a brand-new student
// who hasn't joined one yet isn't either. Never branded, never persisted.
const NO_TENANT: Tenant = {
  id: 'none',
  name: 'QuizSet',
  initials: 'QS',
  city: '',
  category: '',
  students: 0,
  plan: '',
  primaryColor: '#4f46e5',
  secondaryColor: '#06b6d4',
  joinCode: '',
  owner: '',
  supportEmail: '',
};

type Ctx = {
  user: AuthUser | null;
  /** Always derived from user.tenantId — never a separately switchable value. See CLAUDE.md's tenant-isolation note. */
  tenant: Tenant;
  tenantId: string | null;
  hasTenant: boolean;
  toast: (title: string, description?: string, tone?: Toast['tone']) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  login: (u: AuthUser) => void;
  logout: () => void;
  /** Call after any write that could change tenant fields (e.g. branding save, coaching creation). */
  refreshTenants: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(authService.current());
  // Read straight from storage (with the seed as fallback) rather than through
  // tenantService — that service simulates network latency via wait(), and the
  // shell needs a tenant synchronously on first paint to avoid a colour flash.
  // It's still the same underlying storage key, so this isn't a layering
  // violation in spirit — just skipping the artificial delay for one bootstrap read.
  const [allTenants, setAllTenants] = useState<Tenant[]>(() => storage.get('tenants', seedTenants));
  const [toasts, setToasts] = useState<Toast[]>([]);

  const tenant = useMemo(() => {
    if (!user?.tenantId) return NO_TENANT;
    return allTenants.find((t) => t.id === user.tenantId) || NO_TENANT;
  }, [allTenants, user?.tenantId]);

  // Real white-label repaint: every component that reads hsl(var(--primary))
  // (buttons, badges, charts, accents — see index.css) picks this up
  // instantly. Only coaching/student sessions are ever branded; the platform
  // owner's own console always stays on QuizSet's own palette.
  useEffect(() => {
    const isBrandedRole = user?.role === 'coaching' || user?.role === 'student';
    if (isBrandedRole && tenant.id !== 'none') applyBranding(tenant);
    else resetBranding();
  }, [tenant.id, tenant.primaryColor, tenant.secondaryColor, user?.role]);

  const toast = (title: string, description?: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, title, description, tone }]);
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), 3600);
  };

  const login = (u: AuthUser) => {
    storage.set('auth', u);
    setUser(u);
  };
  const logout = () => {
    authService.logout();
    setUser(null);
  };
  const refreshTenants = async () => {
    const { tenantService } = await import('@/services/mock');
    setAllTenants(await tenantService.list());
  };

  return (
    <AppCtx.Provider
      value={{
        user,
        tenant,
        tenantId: user?.tenantId ?? null,
        hasTenant: tenant.id !== 'none',
        toast,
        toasts,
        dismissToast: (id) => setToasts((x) => x.filter((t) => t.id !== id)),
        login,
        logout,
        refreshTenants,
      }}
    >
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <button data-testid={`toast-${t.id}`} key={t.id} onClick={() => setToasts((x) => x.filter((a) => a.id !== t.id))} className={`toast toast-${t.tone || 'success'}`}>
            <strong>{t.title}</strong>
            <span>{t.description}</span>
          </button>
        ))}
      </div>
    </AppCtx.Provider>
  );
}

export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppProvider missing');
  return c;
};

export const roleHome = (role: Role) => (role === 'platform' ? '/platform/dashboard' : role === 'coaching' ? '/coaching/dashboard' : '/student/dashboard');
