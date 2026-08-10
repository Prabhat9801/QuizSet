import type { Course } from '@/types';
import { apiGet, apiPatch, apiPost, apiPut, ApiError } from './http';
import { paiseToRupees, rupeesToPaise } from './money';

export type CourseWithCount = Course & { questionCount: number };

type CourseApiRow = {
  id: string;
  tenantId: string;
  questionBankId: string | null;
  name: string;
  description: string | null;
  mrpPaise: number;
  salePaise: number;
  previewCount: number;
  status: Course['status'];
  subject: string;
  createdAt: string;
};

type CourseApiRowWithCount = CourseApiRow & { questionCount: number };

/** `GET /api/course-assignments/:courseId` already returns exactly
 * `string[]` of student profile ids — the same shape as `assignedStudentIds`
 * — so no mapping is needed, just a name. */
async function fetchAssignedStudentIds(courseId: string): Promise<string[]> {
  return apiGet<string[]>(`/api/course-assignments/${courseId}`);
}

async function putAssignedStudentIds(courseId: string, studentProfileIds: string[]): Promise<void> {
  await apiPut(`/api/course-assignments/${courseId}`, { studentProfileIds });
}

/**
 * MISMATCH: `courses` has no `students` (enrolled/purchased count) column.
 * services/mock.ts's own `students` field is set to 0 at `create()` and
 * never recomputed anywhere else in mock.ts, so defaulting it to 0 here
 * preserves mock's actual behavior, not just its name. A real count would
 * need to be derived from `payments` (kind: 'course', refId: course.id,
 * status: 'Success', distinct studentProfileId) — not wired here since no
 * such aggregate endpoint exists in the given route plan.
 */
function mapCourse(row: CourseApiRow, assignedStudentIds: string[]): Course {
  return {
    id: row.id,
    tenantId: row.tenantId,
    questionBankId: row.questionBankId ?? '',
    name: row.name,
    description: row.description ?? undefined,
    mrp: paiseToRupees(row.mrpPaise),
    sale: paiseToRupees(row.salePaise),
    preview: row.previewCount,
    status: row.status,
    students: 0,
    subject: row.subject,
    assignedStudentIds,
  };
}

async function withAssignments(row: CourseApiRowWithCount): Promise<CourseWithCount> {
  const assignedStudentIds = await fetchAssignedStudentIds(row.id).catch(() => []);
  return { ...mapCourse(row, assignedStudentIds), questionCount: row.questionCount };
}

export const courseService = {
  /**
   * BEHAVIOR NOTE: mock.ts's `list()` returns EVERY course across every
   * tenant when `tenantId` is omitted (it just filters one flat local
   * array with `!tenantId || ...`). The real `GET /api/courses` route
   * requires `tenantId` (400s without it) and there is no all-tenants
   * variant anywhere in the route plan — a cross-tenant course listing
   * isn't a capability the real backend exposes. Returning `[]` here rather
   * than throwing keeps this a safe drop-in for callers that always pass a
   * tenantId (which is every real page); a caller that relies on the
   * cross-tenant scan would need a new endpoint, not a client-side fix.
   */
  async list(tenantId?: string): Promise<Course[]> {
    if (!tenantId) return [];
    const rows = await apiGet<CourseApiRowWithCount[]>('/api/courses', { tenantId });
    return Promise.all(rows.map(withAssignments));
  },

  async listWithCounts(tenantId?: string): Promise<CourseWithCount[]> {
    if (!tenantId) return [];
    const rows = await apiGet<CourseApiRowWithCount[]>('/api/courses', { tenantId });
    return Promise.all(rows.map(withAssignments));
  },

  async listForStudent(tenantId: string, studentId: string): Promise<CourseWithCount[]> {
    const rows = await apiGet<CourseApiRowWithCount[]>('/api/courses/for-student', { tenantId, studentId });
    return Promise.all(rows.map(withAssignments));
  },

  async get(id: string): Promise<Course | undefined> {
    try {
      const row = await apiGet<CourseApiRowWithCount>(`/api/courses/${id}`);
      const assignedStudentIds = await fetchAssignedStudentIds(id).catch(() => []);
      return mapCourse(row, assignedStudentIds);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },

  async getWithCount(id: string): Promise<CourseWithCount | undefined> {
    try {
      const row = await apiGet<CourseApiRowWithCount>(`/api/courses/${id}`);
      return await withAssignments(row);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },

  async create(data: Partial<Course> & { tenantId: string }): Promise<Course> {
    const row = await apiPost<CourseApiRowWithCount>('/api/courses', {
      tenantId: data.tenantId,
      name: data.name,
      description: data.description,
      status: data.status,
      subject: data.subject,
      questionBankId: data.questionBankId || undefined,
      mrpPaise: data.mrp !== undefined ? rupeesToPaise(data.mrp) : undefined,
      salePaise: data.sale !== undefined ? rupeesToPaise(data.sale) : undefined,
      previewCount: data.preview,
    });
    if (data.assignedStudentIds && data.assignedStudentIds.length > 0) {
      await putAssignedStudentIds(row.id, data.assignedStudentIds);
    }
    return mapCourse(row, data.assignedStudentIds ?? []);
  },

  async update(id: string, data: Partial<Course>): Promise<Course> {
    const body: Record<string, unknown> = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.description !== undefined) body.description = data.description;
    if (data.mrp !== undefined) body.mrpPaise = rupeesToPaise(data.mrp);
    if (data.sale !== undefined) body.salePaise = rupeesToPaise(data.sale);
    if (data.preview !== undefined) body.previewCount = data.preview;
    if (data.subject !== undefined) body.subject = data.subject;
    if (data.questionBankId !== undefined) body.questionBankId = data.questionBankId || null;
    if (data.status !== undefined) body.status = data.status;

    let row: CourseApiRowWithCount | undefined;
    if (Object.keys(body).length > 0) {
      row = await apiPatch<CourseApiRowWithCount>(`/api/courses/${id}`, body);
    }
    if (data.assignedStudentIds !== undefined) {
      await putAssignedStudentIds(id, data.assignedStudentIds);
    }
    if (!row) {
      row = await apiGet<CourseApiRowWithCount>(`/api/courses/${id}`);
    }
    const assignedStudentIds = data.assignedStudentIds ?? (await fetchAssignedStudentIds(id).catch(() => []));
    return mapCourse(row, assignedStudentIds);
  },

  async questionCount(courseId: string): Promise<number> {
    try {
      const row = await apiGet<CourseApiRowWithCount>(`/api/courses/${courseId}`);
      return row.questionCount;
    } catch {
      return 0;
    }
  },
};
