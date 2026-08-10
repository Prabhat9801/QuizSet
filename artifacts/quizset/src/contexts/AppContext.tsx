import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { authService } from '@/services/mock';
import { AuthUser, Role, Tenant, Toast } from '@/types';
import { storage } from '@/services/storage';
import { applyBranding, resetBranding } from '@/services/branding';
import { tenants as seedTenants } from '@/data/seed';
import { getSession, onAuthStateChange, signOut as supabaseSignOut } from '@/services/supabase';
import { apiGet, apiPost, ApiError } from '@/services/api/http';

// Shape of `GET /api/profiles/me` — see artifacts/api-server/src/routes/profiles.ts
// and lib/db/src/schema/profiles.ts. Matches AuthUser's fields one-to-one.
type ProfileApiRow = {
  id: string;
  tenantId: string | null;
  role: Role;
  name: string;
  email: string;
  status: string;
  createdAt: string;
};

function profileToAuthUser(profile: ProfileApiRow): AuthUser {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    tenantId: profile.tenantId ?? undefined,
  };
}

/**
 * Fetches the caller's own profile for a real Supabase session and maps it
 * to `AuthUser`. A 404 means a freshly signed-up user with no server-side
 * `profiles` row yet — self-heals by calling `POST /api/profiles/me` (see
 * artifacts/api-server/src/routes/profiles.ts), which creates a `role:
 * 'student'`, no-tenant row idempotently, then retries the fetch once. Any
 * other failure degrades to "not signed in" rather than crashing the shell.
 */
async function fetchAuthUserForSession(): Promise<AuthUser | null> {
  try {
    const profile = await apiGet<ProfileApiRow>('/api/profiles/me');
    return profileToAuthUser(profile);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      try {
        const created = await apiPost<ProfileApiRow>('/api/profiles/me');
        return profileToAuthUser(created);
      } catch (createErr) {
        console.error('Failed to self-provision a profile for the current Supabase session.', createErr);
        return null;
      }
    }
    if (err instanceof ApiError && err.status === 401) return null;
    console.error('Failed to load profile for the current Supabase session.', err);
    return null;
  }
}

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
  // Tracks whether `user` currently reflects a REAL Supabase session (as
  // opposed to the mock/demo `authService` path) — so `logout()` knows
  // whether it also needs to end the real Supabase session, and so the auth
  // listener below knows not to stomp on a mock-only sign-in with `null`.
  const hasRealSession = useRef(false);

  // Real-session bootstrap + live subscription. Runs once on mount:
  //  1. Check for an existing real Supabase session (e.g. after a page
  //     reload with a persisted session, or a real login on another tab).
  //  2. If one exists, fetch the matching profile via the real API client
  //     and use it as `user` — this is the "real path" described in
  //     services/supabase.ts.
  //  3. If no real session exists (the common case today — no env vars
  //     configured, or nobody has signed in with real Supabase Auth yet),
  //     leave `user` exactly as `authService.current()` already set it
  //     above: the existing mock/demo flow, untouched.
  //  4. Subscribe to further auth state changes (real sign-in elsewhere,
  //     sign-out, token refresh) for as long as the app is mounted.
  useEffect(() => {
    let cancelled = false;

    const applySession = async (session: Session | null) => {
      if (session) {
        const authUser = await fetchAuthUserForSession();
        if (cancelled) return;
        if (authUser) {
          hasRealSession.current = true;
          // A real, resolved Supabase session always wins over whatever
          // `user` already is — including a stale mock/demo session left in
          // localStorage from earlier testing (e.g. the seeded "sunrise"
          // tenant). Without this, a real login could still render pages
          // against the leftover mock tenantId until this effect resolves,
          // and every API call in flight before that would 400 with a
          // non-UUID tenantId. Clearing the mock `auth` key too, so a reload
          // can't reintroduce the same stale state.
          storage.remove('auth');
          setUser(authUser);
        }
        // A real session with no matching profile row (see the signup gap
        // noted in services/supabase.ts) intentionally falls through to
        // whatever `user` already is — never forces a sign-out of a working
        // mock session just because a stray real session token exists.
        return;
      }
      // Real session ended (or never existed). Only clear `user` if it was
      // populated FROM a real session — never clear a mock/demo login just
      // because there is no real Supabase session (there usually isn't one).
      if (hasRealSession.current) {
        hasRealSession.current = false;
        setUser(null);
      }
    };

    getSession().then((session) => {
      if (!cancelled) void applySession(session);
    });

    const unsubscribe = onAuthStateChange((session) => {
      if (!cancelled) void applySession(session);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const tenant = useMemo(() => {
    if (!user?.tenantId) return NO_TENANT;
    return allTenants.find((t) => t.id === user.tenantId) || NO_TENANT;
  }, [allTenants, user?.tenantId]);

  // Keeps `allTenants` (and therefore `tenant`/`hasTenant`) correct for a
  // REAL coaching/student session. `GET /api/tenants` (the full list
  // `refreshTenants` below reloads) is platform-owner-only — a coaching or
  // student caller gets a 403 — so `allTenants` never actually contained
  // this session's own tenant, and `tenant` silently fell back to NO_TENANT
  // even once `user.tenantId` was the correct real UUID. That made
  // `hasTenant` false forever, which is what kept re-bouncing an
  // already-joined student back to /student/join. Fetching just this one
  // tenant (allowed for any authenticated role on their own tenantId, per
  // the api-server's access rules) and merging it in fixes that without
  // needing platform-only access.
  useEffect(() => {
    if (!hasRealSession.current || !user?.tenantId) return;
    if (allTenants.some((t) => t.id === user.tenantId)) return;
    let cancelled = false;
    (async () => {
      const { tenantService } = await import('@/services/api');
      const real = await tenantService.get(user.tenantId!);
      if (!cancelled && real) setAllTenants((prev) => [...prev.filter((t) => t.id !== real.id), real]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.tenantId, allTenants]);

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
    // Called by the existing mock/demo login + signup flows in Public.tsx.
    // Explicitly marks this as NOT a real session, so a later real-session
    // check (e.g. this effect re-running) never mistakes a demo login for
    // one it's responsible for clearing.
    hasRealSession.current = false;
    storage.set('auth', u);
    setUser(u);
  };
  const logout = () => {
    authService.logout();
    if (hasRealSession.current) {
      hasRealSession.current = false;
      void supabaseSignOut();
    }
    setUser(null);
  };
  const refreshTenants = async () => {
    // A real session can only ever refresh ITS OWN tenant (`GET /api/tenants`
    // is platform-owner-only) — re-fetch just that one row instead of the
    // mock full-list call, which never reflected real saves anyway.
    if (hasRealSession.current) {
      if (!user?.tenantId) return;
      const { tenantService } = await import('@/services/api');
      const real = await tenantService.get(user.tenantId);
      if (real) setAllTenants((prev) => [...prev.filter((t) => t.id !== real.id), real]);
      return;
    }
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
