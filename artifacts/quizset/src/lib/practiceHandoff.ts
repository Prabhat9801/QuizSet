import { PracticeScope } from '@/types';

type PendingPractice = { scope: PracticeScope; questionIds: string[] };

const key = (examId: string) => `practiceSetup:${examId}`;

/**
 * One-shot handoff from QuizSetup to Attempt: which exact questions (and
 * under what scope) the student just picked. sessionStorage rather than
 * wouter navigation state, since wouter's history API doesn't carry
 * arbitrary state across a route change in this app's router setup.
 */
export function setPendingPractice(examId: string, data: PendingPractice) {
  sessionStorage.setItem(key(examId), JSON.stringify(data));
}

export function takePendingPractice(examId: string): PendingPractice | null {
  const raw = sessionStorage.getItem(key(examId));
  if (!raw) return null;
  sessionStorage.removeItem(key(examId));
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
