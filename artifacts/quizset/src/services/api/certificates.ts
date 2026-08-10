import type { Certificate } from '@/types';
import { apiGet, apiPost } from './http';

type CertificateApiRow = {
  id: string;
  studentProfileId: string;
  courseId: string;
  tenantId: string;
  issuedByProfileId: string;
  certificateCode: string;
  coachingNameSnapshot: string;
  coachingLogoUrlSnapshot: string | null;
  coachingThemeColorSnapshot: string | null;
  note: string | null;
  issuedAt: string;
};

/**
 * MISMATCH: the real `certificates` table (lib/db/src/schema/certificates.ts)
 * does NOT persist `studentName`/`courseName` at all — only the
 * `studentProfileId`/`courseId` foreign keys. mock.ts's `Certificate` type
 * denormalizes both at issue time (its own comment in types.ts says so
 * explicitly), and every certificate view needs them to render without an
 * extra join. Resolved here with two best-effort extra lookups per
 * certificate — a real cost this client pays that mock.ts never had to:
 *
 *   - `courseName` via `GET /api/courses/:id` — works for any authenticated
 *     role that can access the course's tenant.
 *   - `studentName` via `GET /api/profiles?tenantId=` (find by id in the
 *     roster) — this 403s for a `student`-role caller ("Students cannot
 *     list profiles."), so a student viewing their OWN certificate list
 *     will silently get the 'Student' placeholder instead of their real
 *     name. There is no `GET /api/profiles/:id` endpoint to resolve an
 *     arbitrary profile's name more directly; fixing this needs either that
 *     endpoint or denormalizing the name onto `certificates` itself.
 */
async function resolveStudentName(studentProfileId: string, tenantId: string): Promise<string> {
  try {
    const rows = await apiGet<{ id: string; name: string }[]>('/api/profiles', { tenantId });
    return rows.find((r) => r.id === studentProfileId)?.name ?? 'Student';
  } catch {
    return 'Student';
  }
}

async function resolveCourseName(courseId: string): Promise<string> {
  try {
    const course = await apiGet<{ name: string }>(`/api/courses/${courseId}`);
    return course.name;
  } catch {
    return 'Course';
  }
}

async function mapCertificate(row: CertificateApiRow): Promise<Certificate> {
  const [studentName, courseName] = await Promise.all([
    resolveStudentName(row.studentProfileId, row.tenantId),
    resolveCourseName(row.courseId),
  ]);
  return {
    id: row.id,
    studentId: row.studentProfileId,
    studentName,
    courseId: row.courseId,
    courseName,
    tenantId: row.tenantId,
    certificateCode: row.certificateCode,
    coachingNameSnapshot: row.coachingNameSnapshot,
    coachingLogoUrlSnapshot: row.coachingLogoUrlSnapshot ?? undefined,
    // MISMATCH: the schema's own comment calls this "coachingThemeColorSnapshot"
    // but there is no single "theme color" column on `tenants` — only
    // `primaryColor`/`secondaryColor`. The route
    // (artifacts/api-server/src/routes/certificates.ts) resolves this by
    // snapshotting `tenants.primaryColor`, a judgment call this client
    // simply passes through as-is.
    coachingThemeColorSnapshot: row.coachingThemeColorSnapshot ?? '#4f46e5',
    note: row.note ?? undefined,
    issuedAt: row.issuedAt,
  };
}

export const certificateService = {
  /**
   * `data.tenantId` is NOT sent: `POST /api/certificates` requires the
   * caller to be role `coaching` and always issues under
   * `req.auth.tenantId`, never a body field — a coaching owner can only ever
   * issue certificates for their own tenant. `data.studentId` maps to the
   * body's `studentProfileId`.
   */
  async issue(data: { tenantId: string; studentId: string; courseId: string; note?: string }): Promise<Certificate> {
    const row = await apiPost<CertificateApiRow>('/api/certificates', {
      studentProfileId: data.studentId,
      courseId: data.courseId,
      note: data.note,
    });
    return mapCertificate(row);
  },

  async listForStudent(studentId: string): Promise<Certificate[]> {
    const rows = await apiGet<CertificateApiRow[]>(`/api/certificates/student/${studentId}`);
    return Promise.all(rows.map(mapCertificate));
  },

  /** Public, unauthenticated lookup — what the shareable /certificate/:code view reads from. */
  async getByCode(code: string): Promise<Certificate | undefined> {
    try {
      const row = await apiGet<CertificateApiRow>(`/api/certificates/code/${code}`);
      return await mapCertificate(row);
    } catch {
      return undefined;
    }
  },
};
