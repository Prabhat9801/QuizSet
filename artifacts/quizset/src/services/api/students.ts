import type { Student } from '@/types';
import { apiGet, apiPatch } from './http';

type ProfileApiRow = {
  id: string;
  tenantId: string | null;
  role: 'platform' | 'coaching' | 'student';
  name: string;
  email: string;
  status: Student['status'];
  createdAt: string;
};

/**
 * MISMATCH: there is no separate "students" table on the real backend — a
 * student IS a `profiles` row with `role: 'student'`. But `profiles` has no
 * `phone`, `courses`, or `score` columns at all, so those three `Student`
 * fields have no backing data source yet:
 *   - `phone` -> placeholder `''`.
 *   - `courses` / `score` -> placeholder `0`. services/mock.ts itself never
 *     actually recomputes these anywhere either (set once at record-creation
 *     time and never touched again), so this preserves mock's own effective
 *     behavior, not just its field names.
 *   - `joined` -> the profile's real ISO `createdAt`, since that's the only
 *     genuine timestamp available. mock.ts used loose relative strings
 *     ("Today", "Just now"); an ISO string satisfies the same `string` type,
 *     a display layer would just need to format it differently.
 */
function mapStudent(row: ProfileApiRow): Student {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: '',
    tenantId: row.tenantId ?? '',
    status: row.status,
    courses: 0,
    score: 0,
    joined: row.createdAt,
  };
}

export const studentService = {
  async list(tenantId: string): Promise<Student[]> {
    const rows = await apiGet<ProfileApiRow[]>('/api/profiles', { tenantId });
    return rows.filter((r) => r.role === 'student').map(mapStudent);
  },

  /**
   * SPECULATIVE: `PATCH /api/profiles/:id` is in the given route plan
   * ("GET/POST/PATCH /api/profiles") but not yet built — as of this writing
   * `artifacts/api-server/src/routes/profiles.ts` only has `GET /me` and
   * `GET` (list). Coded directly against the plan and the `profiles` schema.
   * Only `name`/`email`/`status` map to real columns; `phone`/`courses`/
   * `score`/`joined`/`tenantId` are dropped from the outgoing patch — no
   * column to write for the first four, and tenantId changes are a
   * deliberately separate operation (see `joinRequestService.joinByCode`).
   */
  async update(id: string, data: Partial<Student>): Promise<Student> {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.email !== undefined) body.email = data.email;
    if (data.status !== undefined) body.status = data.status;
    const row = await apiPatch<ProfileApiRow>(`/api/profiles/${id}`, body);
    return mapStudent(row);
  },
};
