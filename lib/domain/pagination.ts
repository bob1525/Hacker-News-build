export type Page<T> = {
  items: T[];
  page: number;
  hasMore: boolean;
  total: number;
};

/**
 * Slice a list that is already in its final order.
 * Page 1 is the first page. Every item appears on at most one page.
 */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 1;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const start = (safePage - 1) * size;
  const slice = start >= items.length ? [] : items.slice(start, start + size);
  return {
    items: slice,
    page: safePage,
    hasMore: start + size < items.length,
    total: items.length,
  };
}
