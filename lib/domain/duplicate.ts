export const DUPLICATE_SIMILARITY = 0.9;

export function normalizeContent(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function grams(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  const text = normalizeContent(value);
  if (!text) return counts;
  if (text.length < 2) {
    counts.set(text, 1);
    return counts;
  }
  for (let index = 0; index < text.length - 1; index += 1) {
    const gram = text.slice(index, index + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/** Dice coefficient over character bigrams of the normalized text. Identical text is 1. */
export function similarity(left: string, right: string): number {
  const a = grams(left);
  const b = grams(right);
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let leftTotal = 0;
  let rightTotal = 0;
  let overlap = 0;
  for (const count of a.values()) leftTotal += count;
  for (const count of b.values()) rightTotal += count;
  for (const [gram, count] of a) overlap += Math.min(count, b.get(gram) ?? 0);
  return (2 * overlap) / (leftTotal + rightTotal);
}

export function isNearDuplicate(
  candidate: string,
  recent: readonly string[],
  threshold = DUPLICATE_SIMILARITY,
): boolean {
  const normalized = normalizeContent(candidate);
  if (!normalized) return false;
  return recent.some((item) => {
    const other = normalizeContent(item);
    if (!other) return false;
    if (other === normalized) return true;
    return similarity(candidate, item) >= threshold;
  });
}

export function hasRecentDuplicate(
  candidate: string,
  recent: readonly { text: string; createdAt: Date }[],
  now: Date,
  windowMs: number,
): boolean {
  const fresh = recent
    .filter((item) => now.getTime() - item.createdAt.getTime() <= windowMs && now.getTime() >= item.createdAt.getTime())
    .map((item) => item.text);
  return isNearDuplicate(candidate, fresh);
}
