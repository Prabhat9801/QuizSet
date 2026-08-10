import type { LiveTest, LiveTestPhase } from '@/types';
import { apiGet, apiPatch, apiPost, apiPut, ApiError } from './http';
import { paiseToRupees, rupeesToPaise } from './money';

type LiveTestApiRow = {
  id: string;
  tenantId: string;
  courseId: string;
  name: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  pricePaise: number;
  status: LiveTest['status'];
  createdAt: string;
  // The real route also attaches a computed `phase` field — see phaseOf() in
  // live-tests.ts. We ignore it and recompute locally in phase() below so
  // this stays a pure, synchronous, network-free function like mock.ts's.
  phase?: LiveTestPhase;
};

/** `MISMATCH: LiveTest.price` (frontend, rupees) vs `pricePaise` (backend) —
 * same paise/rupee boundary conversion as courses, see money.ts. */
function mapLiveTest(row: LiveTestApiRow, participantIds: string[]): LiveTest {
  return {
    id: row.id,
    tenantId: row.tenantId,
    courseId: row.courseId,
    name: row.name,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    durationMinutes: row.durationMinutes,
    price: paiseToRupees(row.pricePaise),
    status: row.status,
    participantIds,
  };
}

/** `GET /api/live-tests/:id/participants` already returns exactly
 * `string[]` of student profile ids — same shape as `participantIds`. */
async function fetchParticipantIds(liveTestId: string): Promise<string[]> {
  return apiGet<string[]>(`/api/live-tests/${liveTestId}/participants`);
}

async function putParticipantIds(liveTestId: string, studentProfileIds: string[]): Promise<void> {
  await apiPut(`/api/live-tests/${liveTestId}/participants`, { studentProfileIds });
}

export const liveTestService = {
  async list(tenantId?: string): Promise<LiveTest[]> {
    if (!tenantId) return [];
    const rows = await apiGet<LiveTestApiRow[]>('/api/live-tests', { tenantId });
    return Promise.all(rows.map(async (row) => mapLiveTest(row, await fetchParticipantIds(row.id).catch(() => []))));
  },

  async get(id: string): Promise<LiveTest | undefined> {
    try {
      const row = await apiGet<LiveTestApiRow>(`/api/live-tests/${id}`);
      const participantIds = await fetchParticipantIds(id).catch(() => []);
      return mapLiveTest(row, participantIds);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },

  async create(data: Partial<LiveTest> & { tenantId: string; courseId: string; name: string }): Promise<LiveTest> {
    const row = await apiPost<LiveTestApiRow>('/api/live-tests', {
      tenantId: data.tenantId,
      courseId: data.courseId,
      name: data.name,
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      durationMinutes: data.durationMinutes,
      pricePaise: data.price !== undefined ? rupeesToPaise(data.price) : undefined,
      status: data.status,
    });
    if (data.participantIds && data.participantIds.length > 0) {
      await putParticipantIds(row.id, data.participantIds);
    }
    return mapLiveTest(row, data.participantIds ?? []);
  },

  async update(id: string, data: Partial<LiveTest>): Promise<LiveTest> {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.scheduledStart !== undefined) body.scheduledStart = data.scheduledStart;
    if (data.scheduledEnd !== undefined) body.scheduledEnd = data.scheduledEnd;
    if (data.durationMinutes !== undefined) body.durationMinutes = data.durationMinutes;
    if (data.price !== undefined) body.pricePaise = rupeesToPaise(data.price);
    if (data.status !== undefined) body.status = data.status;

    let row: LiveTestApiRow | undefined;
    if (Object.keys(body).length > 0) {
      row = await apiPatch<LiveTestApiRow>(`/api/live-tests/${id}`, body);
    }
    if (data.participantIds !== undefined) {
      await putParticipantIds(id, data.participantIds);
    }
    if (!row) {
      row = await apiGet<LiveTestApiRow>(`/api/live-tests/${id}`);
    }
    const participantIds = data.participantIds ?? (await fetchParticipantIds(id).catch(() => []));
    return mapLiveTest(row, participantIds);
  },

  /**
   * Pure, clock-derived function — ported 1:1 from services/mock.ts's
   * `liveTestService.phase()`. The real server independently computes the
   * exact same thing (`phaseOf()` in `live-tests.ts`) and attaches it as an
   * extra `phase` field on every response, but we deliberately ignore that
   * and recompute locally so this stays synchronous and network-free,
   * matching mock.ts's call signature (`phase(test)`, not `await phase(test)`).
   */
  phase(test: LiveTest): LiveTestPhase {
    if (test.status !== 'Published') return test.status;
    const now = Date.now();
    const start = new Date(test.scheduledStart).getTime();
    const end = new Date(test.scheduledEnd).getTime();
    if (now < start) return 'Upcoming';
    if (now > end) return 'Ended';
    return 'Live';
  },
};
