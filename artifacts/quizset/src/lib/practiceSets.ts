import type { Question } from '@/types';

// Fixed, pre-baked practice worksheets — same seeded shuffle every time, so
// "Set 12" is always the same 100 questions for every student, matching the
// original kundan_quiz/quiz-ITI apps' Practice Sets feature. Computed live
// from the course's real question pool rather than stored, since the whole
// point is that it's deterministic: (questionBankId's question list, seed,
// setNumber) always produces the same slice — no DB write needed to make
// that reproducible.
export const SET_QUESTION_COUNT = 100;
const SEED = 42;

// mulberry32 — same seeded PRNG the original generate-practice-sets.mjs used,
// so results are reproducible across the whole app (not that it needs to
// match that script's exact output, just to be a real, deterministic shuffle).
function makeRng(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** How many fixed sets a course's real question pool supports, capped at
 * `maxSets` (50 for the Lab Assistant Science course, 30 for the ITI
 * Electronics course, per the two original apps) — never more than the pool
 * can fill without overlap. */
export function practiceSetCount(poolSize: number, maxSets: number): number {
  return Math.min(maxSets, Math.floor(poolSize / SET_QUESTION_COUNT));
}

/** The ordered, shuffled pool every set is sliced from — computed once per
 * (pool, maxSets) and reused by both `practiceSetCount` callers and
 * `getPracticeSet`, so every set number sees a consistent, non-overlapping
 * slice of the same shuffle. */
function shuffledPool(all: Question[]): Question[] {
  return seededShuffle(all, makeRng(SEED));
}

/** Set N's fixed 100 questions (1-indexed, matching the original apps'
 * "Set 1"..."Set 50" labeling). Returns fewer than 100 only if the pool
 * itself doesn't have enough questions past this slice — callers should
 * check `practiceSetCount` first to avoid offering a set that would be short. */
export function getPracticeSet(all: Question[], setNumber: number): Question[] {
  const shuffled = shuffledPool(all);
  const start = (setNumber - 1) * SET_QUESTION_COUNT;
  return shuffled.slice(start, start + SET_QUESTION_COUNT);
}
