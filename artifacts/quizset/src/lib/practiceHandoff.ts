import { PracticeScope } from '@/types';

type PendingPractice = { scope: PracticeScope; questionIds: string[] };

const key = (courseId: string) => `practiceSetup:${courseId}`;

/**
 * One-shot handoff from QuizSetup to Attempt: which exact questions (and
 * under what scope) the student just picked. sessionStorage rather than
 * wouter navigation state, since wouter's history API doesn't carry
 * arbitrary state across a route change in this app's router setup.
 */
export function setPendingPractice(courseId: string, data: PendingPractice) {
  sessionStorage.setItem(key(courseId), JSON.stringify(data));
}

export function takePendingPractice(courseId: string): PendingPractice | null {
  const raw = sessionStorage.getItem(key(courseId));
  if (!raw) return null;
  sessionStorage.removeItem(key(courseId));
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
