import type { AuthUser, JoinRequest, Tenant } from '@/types';
import { apiGet, apiPost } from './http';

// `join_requests` (lib/db/src/schema/join-requests.ts) matches the frontend
// `JoinRequest` type field-for-field — no naming/units mismatch for
// requestToJoin()/listForTenant().

type ProfileApiRow = {
  id: string;
  tenantId: string | null;
  role: AuthUser['role'];
  name: string;
  email: string;
  status: string;
  createdAt: string;
};

export const joinRequestService = {
  /**
   * `POST /api/profiles/me/join` (artifacts/api-server/src/routes/profiles.ts)
   * looks up the tenant by code AND assigns it server-side in one step —
   * deliberately its own narrow endpoint rather than the generic profile
   * PATCH, which excludes `tenantId` on purpose (security-sensitive; see
   * that route's comments). Only ever succeeds for a caller with no tenant
   * yet. `userId` is unused here (kept for signature parity with mock.ts —
   * the real endpoint always acts on the caller's own token-derived id,
   * never an arbitrary id passed from the client).
   *
   * Unlike mock.ts, this does NOT call `storage.set('auth', user)` — that
   * was mock's local-session-cache side effect; the real session lives in
   * Supabase's own client-side storage (see services/supabase.ts), refreshed
   * automatically via AppContext's auth-state subscription.
   */
  async joinByCode(_userId: string, code: string): Promise<{ user: AuthUser; tenant: Tenant }> {
    const { profile, tenant } = await apiPost<{ profile: ProfileApiRow; tenant: Tenant }>('/api/profiles/me/join', { joinCode: code });
    const user: AuthUser = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      tenantId: profile.tenantId ?? undefined,
    };
    return { user, tenant };
  },

  /** Recovery path for `joinByCode`'s 409 ("account already belongs to a
   * coaching") — that response has no tenant object to hand back, so the
   * caller re-fetches its own current profile instead of trying to parse
   * one out of the error body. */
  async getMyProfile(): Promise<AuthUser> {
    const profile = await apiGet<ProfileApiRow>('/api/profiles/me');
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      tenantId: profile.tenantId ?? undefined,
    };
  },

  async requestToJoin(studentName: string, studentEmail: string, tenantId: string): Promise<JoinRequest> {
    return apiPost<JoinRequest>('/api/join-requests', { tenantId, studentName, studentEmail });
  },

  async listForTenant(tenantId: string): Promise<JoinRequest[]> {
    return apiGet<JoinRequest[]>('/api/join-requests', { tenantId });
  },

  async decide(id: string, approve: boolean): Promise<JoinRequest> {
    return apiPost<JoinRequest>(`/api/join-requests/${id}/decide`, { approve });
  },
};
