/**
 * Classic Hacker News front-page ranking:
 * score = (points - 1) / (ageHours + 2) ^ gravity
 * Gravity 1.8 is the value used by the public HN algorithm.
 * A story with 0 points scores below zero. A story with 1 point scores 0.
 */
export const HOT_GRAVITY = 1.8;

export type Rankable = {
  points: number;
  createdAt: Date;
};

export function ageInHours(createdAt: Date, now = new Date()): number {
  const delta = (now.getTime() - createdAt.getTime()) / 3_600_000;
  if (!Number.isFinite(delta)) return 0;
  return Math.max(0, delta);
}

export function hotScore(points: number, ageHours: number): number {
  const safePoints = Number.isFinite(points) ? Math.max(0, points) : 0;
  const age = Number.isFinite(ageHours) ? Math.max(0, ageHours) : 0;
  return (safePoints - 1) / (age + 2) ** HOT_GRAVITY;
}

export function compareByHot(a: Rankable, b: Rankable, now = new Date()): number {
  const scoreDelta = hotScore(b.points, ageInHours(b.createdAt, now)) - hotScore(a.points, ageInHours(a.createdAt, now));
  if (scoreDelta !== 0) return scoreDelta;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export function compareByNewest(a: { createdAt: Date }, b: { createdAt: Date }): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export function sortByHot<T extends Rankable>(items: T[], now = new Date()): T[] {
  return [...items].sort((a, b) => compareByHot(a, b, now));
}

export function sortByNewest<T extends { createdAt: Date }>(items: T[]): T[] {
  return [...items].sort(compareByNewest);
}
