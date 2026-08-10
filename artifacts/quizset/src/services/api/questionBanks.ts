import type { QuestionBank } from '@/types';
import { apiGet, apiPatch, apiPost, ApiError } from './http';

// The real `question_banks` row shape (see lib/db/src/schema/question-banks.ts)
// matches the frontend `QuestionBank` type field-for-field (plus a
// `createdAt` the frontend type doesn't declare, which is harmless — extra
// properties on a value assigned to a narrower return type don't error).
// No naming/units mismatch here.

export const questionBankService = {
  async list(tenantId?: string): Promise<QuestionBank[]> {
    if (!tenantId) return [];
    return apiGet<QuestionBank[]>('/api/question-banks', { tenantId });
  },

  /** The real `GET /api/question-banks` route already applies this exact
   * stage filter server-side for a non-platform caller (see the handler in
   * `question-banks.ts`: Generating/Platform Review are stripped out unless
   * `req.auth.role === 'platform'`), so this is just `list()` again — kept
   * as its own method purely for call-site parity with mock.ts. */
  async listVisibleToCoaching(tenantId: string): Promise<QuestionBank[]> {
    return this.list(tenantId);
  },

  async get(id: string): Promise<QuestionBank | undefined> {
    try {
      return await apiGet<QuestionBank>(`/api/question-banks/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return undefined;
      throw err;
    }
  },

  async create(data: Partial<QuestionBank> & { tenantId: string }): Promise<QuestionBank> {
    return apiPost<QuestionBank>('/api/question-banks', {
      tenantId: data.tenantId,
      name: data.name,
      subject: data.subject,
      status: data.status,
      requestId: data.requestId,
    });
  },

  async update(id: string, data: Partial<QuestionBank>): Promise<QuestionBank> {
    return apiPatch<QuestionBank>(`/api/question-banks/${id}`, data);
  },

  /** Platform owner moves a bank forward one stage. */
  async advanceStage(id: string): Promise<QuestionBank> {
    return apiPost<QuestionBank>(`/api/question-banks/${id}/advance`);
  },

  /** Platform owner kicks a bank back a stage. */
  async sendBackStage(id: string): Promise<QuestionBank> {
    return apiPost<QuestionBank>(`/api/question-banks/${id}/send-back`);
  },

  /** Coaching owner's explicit "approve for students" action. */
  async finalize(id: string): Promise<QuestionBank> {
    return apiPost<QuestionBank>(`/api/question-banks/${id}/finalize`);
  },
};
