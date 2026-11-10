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
