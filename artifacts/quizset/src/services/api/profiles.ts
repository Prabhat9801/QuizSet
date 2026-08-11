import { apiGet, apiPatch } from './http';

// Shape of a `profiles` row as the API returns it — see
// artifacts/api-server/src/routes/profiles.ts and lib/db/src/schema/profiles.ts.
export type ProfileApiRow = {
  id: string;
  tenantId: string | null;
  role: 'platform' | 'coaching' | 'student';
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
};

/**
 * The caller's own profile, for screens that need fields `AppContext`'s
 * `AuthUser` doesn't carry (e.g. `phone`) — `GET /api/profiles/me`.
 */
async function getMe(): Promise<ProfileApiRow> {
  return apiGet<ProfileApiRow>('/api/profiles/me');
}

/**
 * Updates the caller's own profile via `PATCH /api/profiles/:id`. The route
 * itself is the one that enforces "students may only update their own
 * profile" and keeps `role`/`tenantId` immutable — this is just a thin,
 * typed wrapper, not where that guard lives.
 */
async function updateMe(id: string, data: { name?: string; phone?: string }): Promise<ProfileApiRow> {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.phone !== undefined) body.phone = data.phone;
  return apiPatch<ProfileApiRow>(`/api/profiles/${id}`, body);
}

export const profileService = { getMe, updateMe };
