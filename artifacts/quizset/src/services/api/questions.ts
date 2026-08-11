import type { Question } from '@/types';
import { courseService } from './courses';
import { apiDelete, apiGet, apiPatch, apiPost } from './http';

// Field-for-field match with lib/db/src/schema/questions.ts — no
// naming/units mismatch.

export const questionService = {
  async listByBank(questionBankId: string): Promise<Question[]> {
    return apiGet<Question[]>('/api/questions', { questionBankId });
  },

  async listByCourse(courseId: string): Promise<Question[]> {
    const course = await courseService.get(courseId);
    if (!course || !course.questionBankId) return [];
    return this.listByBank(course.questionBankId);
  },

  async syllabusTree(courseId: string): Promise<{ subject: string; unit: string; topics: string[] }[]> {
    return apiGet<{ subject: string; unit: string; topics: string[] }[]>('/api/questions/syllabus-tree', { courseId });
  },

  /** A live test's own pre-picked question list (see `LiveTest.questionIds`)
   * — order-preserving, scoped to that test's tenant server-side. */
  async listByIds(liveTestId: string): Promise<Question[]> {
    return apiGet<Question[]>('/api/questions/by-ids', { liveTestId });
  },

  async create(
    data: Partial<Question> & { questionBankId: string; text: string; options: string[]; answer: number },
  ): Promise<Question> {
    return apiPost<Question>('/api/questions', data);
  },

  async update(id: string, data: Partial<Question>): Promise<Question> {
    return apiPatch<Question>(`/api/questions/${id}`, data);
  },

  async remove(id: string): Promise<void> {
    await apiDelete<void>(`/api/questions/${id}`);
  },
};
