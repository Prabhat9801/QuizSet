import type { StudyPlan, StudyPlanItem, StudyPlanItemStatus } from '@/types';
import { apiGet, apiPut } from './http';

// Field-for-field match with lib/db/src/schema/study-plans.ts (studyPlans +
// studyPlanItems) — no naming mismatch, so no boundary mapping is needed
// beyond what the route already returns.

type StudyPlanItemRow = {
  id: string;
  studyPlanId: string;
  unit: string;
  targetDate: string;
};

type StudyPlanRow = {
  id: string;
  tenantId: string;
  courseId: string;
  mode: 'manual' | 'auto';
  startDate: string | null;
  endDate: string | null;
  items: StudyPlanItemRow[];
};

function mapItem(row: StudyPlanItemRow): StudyPlanItem {
  return { id: row.id, studyPlanId: row.studyPlanId, unit: row.unit, targetDate: row.targetDate };
}

function mapPlan(row: StudyPlanRow): StudyPlan {
  return {
    id: row.id,
    tenantId: row.tenantId,
    courseId: row.courseId,
    mode: row.mode,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    items: row.items.map(mapItem),
  };
}

export const studyPlanService = {
  /** `null` when no plan has been set yet — a real empty state, not an error. */
  async get(courseId: string): Promise<StudyPlan | null> {
    const row = await apiGet<StudyPlanRow | null>('/api/study-plans', { courseId });
    return row ? mapPlan(row) : null;
  },

  async setManual(courseId: string, items: { unit: string; targetDate: string }[]): Promise<StudyPlan> {
    const row = await apiPut<StudyPlanRow>('/api/study-plans', { courseId, mode: 'manual', items });
    return mapPlan(row);
  },

  async setAuto(courseId: string, startDate: string, endDate: string): Promise<StudyPlan> {
    const row = await apiPut<StudyPlanRow>('/api/study-plans', { courseId, mode: 'auto', startDate, endDate });
    return mapPlan(row);
  },

  /** Pure, derived-at-read-time status — never stored. "Due now" spans today
   * through 2 days past target; further out with no activity signal
   * available is "Overdue"; still ahead of target is "Upcoming". */
  statusOf(targetDate: string, today: Date = new Date()): StudyPlanItemStatus {
    const target = new Date(`${targetDate}T00:00:00`);
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((now.getTime() - target.getTime()) / 86_400_000);
    if (diffDays < 0) return 'Upcoming';
    if (diffDays <= 2) return 'Due now';
    return 'Overdue';
  },
};
