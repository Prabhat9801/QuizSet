import type { QuestionBankRequest } from '@/types';
import { apiGet, apiPatch, apiPost } from './http';

// Field-for-field match with lib/db/src/schema/question-bank-requests.ts —
// no naming/units mismatch.

export const questionBankRequestService = {
  async list(tenantId?: string): Promise<QuestionBankRequest[]> {
    if (!tenantId) return [];
    return apiGet<QuestionBankRequest[]>('/api/question-bank-requests', { tenantId });
  },

  async create(
    data: Partial<QuestionBankRequest> & { tenantId: string; courseId: string; courseName: string },
  ): Promise<QuestionBankRequest> {
    // `courseName` is deliberately NOT sent: the real route derives it
    // server-side from the referenced course row (a trusted denormalized
    // snapshot, not something taken from the client) — see
    // `question-bank-requests.ts`'s POST handler (`courseName: course.name`).
    // A caller-supplied `courseName` is silently ignored server-side, so
    // omitting it here changes nothing observable.
    return apiPost<QuestionBankRequest>('/api/question-bank-requests', {
      tenantId: data.tenantId,
      courseId: data.courseId,
      subjects: data.subjects ?? [],
      questionsRequired: data.questionsRequired ?? 50,
      difficulty: data.difficulty ?? 'Easy + Medium',
      priority: data.priority ?? 'Medium',
      notes: data.notes,
      unitsTopics: data.unitsTopics,
      syllabusFileName: data.syllabusFileName,
    });
  },

  /**
   * Platform owner accepts a Pending request: creates its bank, moves the
   * request to In Progress, and links the bank onto the course — all in one
   * server-side transaction (see `question-bank-requests.ts`'s
   * `/start-bank` handler). mock.ts did the same 3-step sequence as 3
   * separate localStorage writes; the real endpoint keeps it atomic.
   */
  async startBank(id: string): Promise<QuestionBankRequest> {
    return apiPost<QuestionBankRequest>(`/api/question-bank-requests/${id}/start-bank`);
  },

  async setOwnerNote(id: string, ownerNote: string): Promise<QuestionBankRequest> {
    return apiPatch<QuestionBankRequest>(`/api/question-bank-requests/${id}`, { ownerNote });
  },
};
