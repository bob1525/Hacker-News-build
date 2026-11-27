export const COLLAPSED_COMMENTS_KEY = "hn-collapsed-comments";

export function parseCollapsedIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids = parsed.filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= 80);
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

export function toggleCollapsedId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

/** Ids still waiting in this browser after a merge. Merged and missing ids are dropped; the rest stay. */
export function guestCollapseRemainder(
  ids: readonly string[],
  result: { merged: readonly string[]; missing: readonly string[] },
): string[] {
  const drop = new Set([...result.merged, ...result.missing]);
  return ids.filter((id) => !drop.has(id));
}
