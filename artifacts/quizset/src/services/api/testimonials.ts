import type { Testimonial } from '@/types';
import { apiGet, apiPost } from './http';
import { tenantService } from './tenants';

type TestimonialApiRow = {
  id: string;
  studentProfileId: string;
  tenantId: string;
  courseId: string | null;
  content: string;
  outcome: string | null;
  coachingApproved: boolean;
  coachingApprovedAt: string | null;
  platformApproved: boolean;
  platformApprovedAt: string | null;
  createdAt: string;
};

/**
 * MISMATCH: the real `testimonials` table (lib/db/src/schema/testimonials.ts)
 * does NOT persist `studentName`/`courseName` — only `studentProfileId`/
 * `courseId` foreign keys, same gap as `certificates` (see
 * `services/api/certificates.ts`'s comment). Resolved with the same
 * best-effort extra-lookup pattern: `GET /api/profiles?tenantId=` (403s for
 * a student caller — falls back to the 'Student' placeholder) and
 * `GET /api/courses/:id`.
 */
async function resolveStudentName(studentProfileId: string, tenantId: string): Promise<string> {
  try {
    const rows = await apiGet<{ id: string; name: string }[]>('/api/profiles', { tenantId });
    return rows.find((r) => r.id === studentProfileId)?.name ?? 'Student';
  } catch {
    return 'Student';
  }
}

async function resolveCourseName(courseId: string | null): Promise<string | undefined> {
  if (!courseId) return undefined;
  try {
    const course = await apiGet<{ name: string }>(`/api/courses/${courseId}`);
    return course.name;
  } catch {
    return undefined;
  }
}

async function mapTestimonial(row: TestimonialApiRow): Promise<Testimonial> {
  const [studentName, courseName] = await Promise.all([
    resolveStudentName(row.studentProfileId, row.tenantId),
    resolveCourseName(row.courseId),
  ]);
  return {
    id: row.id,
    studentId: row.studentProfileId,
    studentName,
    tenantId: row.tenantId,
    courseId: row.courseId ?? undefined,
    courseName,
    content: row.content,
    outcome: row.outcome ?? undefined,
    coachingApproved: row.coachingApproved,
    coachingApprovedAt: row.coachingApprovedAt ?? undefined,
    platformApproved: row.platformApproved,
    platformApprovedAt: row.platformApprovedAt ?? undefined,
    createdAt: row.createdAt,
  };
}

export const testimonialService = {
  /**
   * `data.studentId`/`data.tenantId` are NOT sent: `POST /api/testimonials`
   * requires the caller to be role `student` and always uses
   * `req.auth.userId`/`req.auth.tenantId`, never body fields — same
   * "don't trust the client" rule as `attemptService.save()`. `studentName`/
   * `courseName` have nowhere to be stored server-side either (see the
   * MISMATCH comment above), but the caller already knows both, so the
   * returned `Testimonial` is built directly from `data` instead of paying
   * for a redundant round-trip lookup right after creating the row.
   */
  async submit(data: {
    studentId: string;
    studentName: string;
    tenantId: string;
    courseId?: string;
    courseName?: string;
    content: string;
    outcome?: string;
  }): Promise<Testimonial> {
    const row = await apiPost<TestimonialApiRow>('/api/testimonials', {
      courseId: data.courseId,
      content: data.content,
      outcome: data.outcome,
    });
    return {
      id: row.id,
      studentId: data.studentId,
      studentName: data.studentName,
      tenantId: data.tenantId,
      courseId: data.courseId,
      courseName: data.courseName,
      content: row.content,
      outcome: row.outcome ?? undefined,
      coachingApproved: row.coachingApproved,
      coachingApprovedAt: row.coachingApprovedAt ?? undefined,
      platformApproved: row.platformApproved,
      platformApprovedAt: row.platformApprovedAt ?? undefined,
      createdAt: row.createdAt,
    };
  },

  /** Coaching owner's own approval queue — everything from their own tenant, any status. */
  async listForTenant(tenantId: string): Promise<Testimonial[]> {
    const rows = await apiGet<TestimonialApiRow[]>('/api/testimonials', { tenantId });
    const mapped = await Promise.all(rows.map(mapTestimonial));
    return mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * GAP, flagged rather than silently patched over: the given route plan
   * has no cross-tenant "everything coaching-approved, awaiting platform
   * approval" endpoint — `GET /api/testimonials` always requires a single
   * `tenantId` (see `testimonials.ts`'s handler). Reimplemented as
   * `GET /api/tenants` (platform-owner-only, same access this method already
   * needs) + one `GET /api/testimonials?tenantId=` per tenant, filtered
   * client-side — a genuine N+1 a real cross-tenant endpoint would avoid.
   */
  async listPendingPlatform(): Promise<Testimonial[]> {
    const tenants = await tenantService.list();
    const perTenant = await Promise.all(tenants.map((t) => this.listForTenant(t.id).catch(() => [])));
    return perTenant
      .flat()
      .filter((t) => t.coachingApproved && !t.platformApproved)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async approveCoaching(id: string): Promise<Testimonial> {
    const row = await apiPost<TestimonialApiRow>(`/api/testimonials/${id}/coaching-approve`);
    return mapTestimonial(row);
  },

  async approvePlatform(id: string): Promise<Testimonial> {
    const row = await apiPost<TestimonialApiRow>(`/api/testimonials/${id}/platform-approve`);
    return mapTestimonial(row);
  },

  /** Both gates true — this is what a landing page would eventually read from. No auth. */
  async listPublic(): Promise<Testimonial[]> {
    const rows = await apiGet<TestimonialApiRow[]>('/api/testimonials/public');
    const mapped = await Promise.all(rows.map(mapTestimonial));
    return mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
};
