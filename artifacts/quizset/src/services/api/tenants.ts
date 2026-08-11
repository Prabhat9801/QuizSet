import type { Tenant } from '@/types';
import { apiGet, apiPatch, apiPost, ApiError } from './http';

type TenantApiRow = {
  id: string;
  name: string;
  initials: string;
  city: string;
  category: string;
  plan: string;
  primaryColor: string;
  secondaryColor: string;
  displayName: string | null;
  logoUrl: string | null;
  joinCode: string;
  owner: string;
  supportEmail: string;
  supportPhone: string | null;
  createdAt: string;
};

type ProfileApiRow = {
  id: string;
  tenantId: string | null;
  role: 'platform' | 'coaching' | 'student';
  name: string;
  email: string;
  status: string;
  createdAt: string;
};

/**
 * MISMATCH: `tenants` has no `students` column on the real backend — it is
 * not a stored count. We derive it live from `GET /api/profiles`
 * (role === 'student'), which is a genuine extra request per tenant (N+1 for
 * list()/search()) and — because that endpoint 403s for a `student`-role
 * caller (see `profiles.ts`: "Students cannot list profiles.") — silently
 * falls back to 0 when the caller isn't allowed to see the roster.
 * services/mock.ts's own `students` field was always a static 0 set once at
 * `create()` time and never recomputed anywhere else, so a 0 fallback here
 * is not a regression from mock's actual behavior, only from its *name*.
 */
async function studentCountFor(tenantId: string): Promise<number> {
  try {
    const rows = await apiGet<ProfileApiRow[]>('/api/profiles', { tenantId });
    return rows.filter((r) => r.role === 'student').length;
  } catch {
    return 0;
  }
}

function mapTenant(row: TenantApiRow, students: number): Tenant {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    city: row.city,
    category: row.category,
    students,
    plan: row.plan,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    joinCode: row.joinCode,
    owner: row.owner,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone ?? undefined,
  };
}

export const tenantService = {
  /**
   * ACCESS-CONTROL MISMATCH (behavioral, not units/naming — worth flagging
   * on its own): `GET /api/tenants` is platform-owner-only
   * (`requireRole("platform")` in `tenants.ts`). mock.ts's `list()` had no
   * such restriction — any caller got every tenant. A coaching/student
   * caller now gets a real `ApiError` with `status === 403` instead of a
   * result. Callers of this method must already be platform-owner screens.
   */
  async list(): Promise<Tenant[]> {
    const rows = await apiGet<TenantApiRow[]>('/api/tenants');
    return Promise.all(rows.map(async (row) => mapTenant(row, await studentCountFor(row.id))));
  },

  async get(id: string): Promise<Tenant | undefined> {
    try {
      const row = await apiGet<TenantApiRow>(`/api/tenants/${id}`);
      return mapTenant(row, await studentCountFor(id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },

  /**
   * `GET /api/tenants/by-join-code/:code` — deliberately open to any
   * authenticated role, not platform-only like the full list above (a
   * student mid-join-flow has no tenant yet and needs exactly this lookup).
   */
  async findByJoinCode(code: string): Promise<Tenant | undefined> {
    try {
      const row = await apiGet<TenantApiRow>(`/api/tenants/by-join-code/${encodeURIComponent(code.trim())}`);
      return mapTenant(row, await studentCountFor(row.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },

  /** `GET /api/tenants/search?q=` — same "open to any role" reasoning as above. */
  async search(query: string): Promise<Tenant[]> {
    const q = query.trim();
    if (!q) return [];
    const rows = await apiGet<TenantApiRow[]>('/api/tenants/search', { q });
    return Promise.all(rows.map(async (row) => mapTenant(row, await studentCountFor(row.id))));
  },

  async create(data: Partial<Tenant>): Promise<Tenant> {
    // Defaults mirror mock.ts's create() exactly, because the real route's
    // required fields (city/category/owner/supportEmail) have no server-side
    // default the way primaryColor/secondaryColor/joinCode do.
    const row = await apiPost<TenantApiRow>('/api/tenants', {
      name: data.name,
      initials: data.initials,
      city: data.city ?? 'India',
      category: data.category ?? 'Competitive Exam Coaching',
      plan: data.plan ?? 'Starter',
      primaryColor: data.primaryColor ?? '#4f46e5',
      secondaryColor: data.secondaryColor ?? '#06b6d4',
      joinCode: data.joinCode,
      owner: data.owner ?? 'Owner',
      supportEmail: data.supportEmail ?? 'support@example.in',
    });
    return mapTenant(row, 0);
  },

  async update(id: string, data: Partial<Tenant>): Promise<Tenant> {
    // `data.students` has no backend column — dropped, see mismatch note above.
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.initials !== undefined) body.initials = data.initials;
    if (data.city !== undefined) body.city = data.city;
    if (data.category !== undefined) body.category = data.category;
    if (data.plan !== undefined) body.plan = data.plan;
    if (data.primaryColor !== undefined) body.primaryColor = data.primaryColor;
    if (data.secondaryColor !== undefined) body.secondaryColor = data.secondaryColor;
    if (data.joinCode !== undefined) body.joinCode = data.joinCode;
    if (data.owner !== undefined) body.owner = data.owner;
    if (data.supportEmail !== undefined) body.supportEmail = data.supportEmail;
    if (data.supportPhone !== undefined) body.supportPhone = data.supportPhone;
    const row = await apiPatch<TenantApiRow>(`/api/tenants/${id}`, body);
    return mapTenant(row, await studentCountFor(id));
  },
};
