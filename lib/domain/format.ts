export function plural(count: number, noun: string): string {
  const safe = Number.isFinite(count) ? count : 0;
  return `${safe} ${noun}${safe === 1 ? "" : "s"}`;
}

export function parsePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  if (page < 1 || page > 1000) return 1;
  return page;
}
