import { describe, expect, it } from "vitest";
import { paginate } from "@/lib/domain/pagination";
import { sortByHot, sortByNewest } from "@/lib/domain/ranking";

const NOW = new Date("2026-06-01T00:00:00.000Z");

function story(id: string, points: number, hoursAgo: number) {
  return { id, points, createdAt: new Date(NOW.getTime() - hoursAgo * 3_600_000) };
}

function pagesOf<T>(items: T[], pageSize: number) {
  const pages = [];
  for (let page = 1; ; page += 1) {
    const result = paginate(items, page, pageSize);
    pages.push(result);
    if (!result.hasMore) return pages;
  }
}

describe("ranked pagination", () => {
  const ranked = sortByHot(
    [
      story("fresh-low", 3, 1),
      story("old-high", 40, 30),
      story("mid", 12, 8),
      story("zero-a", 0, 2),
      story("zero-b", 0, 1),
      story("one-old", 1, 20),
      story("one-new", 1, 4),
      story("burst", 18, 2),
      story("ancient", 90, 80),
      story("tiny", 2, 6),
    ],
    NOW,
  );

  it("splits a hot list into pages with no duplicates and no omissions", () => {
    const pages = pagesOf(ranked, 3);
    const seen = pages.flatMap((page) => page.items.map((item) => item.id));
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual(ranked.map((item) => item.id));
    expect(pages[0]?.hasMore).toBe(true);
    expect(pages.at(-1)?.hasMore).toBe(false);
  });

  it("keeps the same hot order across the page boundary", () => {
    const first = paginate(ranked, 1, 4);
    const second = paginate(ranked, 2, 4);
    expect(first.items.map((item) => item.id)).toEqual(ranked.slice(0, 4).map((item) => item.id));
    expect(second.items.map((item) => item.id)).toEqual(ranked.slice(4, 8).map((item) => item.id));
    const lastOfFirst = first.items.at(-1)!;
    const firstOfSecond = second.items[0]!;
    expect(ranked.findIndex((item) => item.id === lastOfFirst.id)).toBe(
      ranked.findIndex((item) => item.id === firstOfSecond.id) - 1,
    );
  });

  it("does not swap equal-score stories when they fall on different pages", () => {
    const tied = sortByHot([story("older", 1, 50), story("newer", 1, 5), story("oldest", 1, 90)], NOW);
    expect(tied.map((item) => item.id)).toEqual(["newer", "older", "oldest"]);
    expect(paginate(tied, 1, 1).items.map((item) => item.id)).toEqual(["newer"]);
    expect(paginate(tied, 2, 1).items.map((item) => item.id)).toEqual(["older"]);
    expect(paginate(tied, 3, 1).items.map((item) => item.id)).toEqual(["oldest"]);
  });

  it("returns an empty page past the end without repeating earlier stories", () => {
    const page = paginate(ranked, 9, 4);
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.total).toBe(ranked.length);
    const firstIds = new Set(paginate(ranked, 1, 4).items.map((item) => item.id));
    expect(page.items.some((item) => firstIds.has(item.id))).toBe(false);
  });

  it("pages a newest list in time order without gaps", () => {
    const newest = sortByNewest(ranked);
    const seen = pagesOf(newest, 4).flatMap((page) => page.items.map((item) => item.id));
    expect(seen).toEqual(newest.map((item) => item.id));
    expect(paginate(newest, 1, 100).items).toHaveLength(newest.length);
    expect(paginate(newest, 1, 100).hasMore).toBe(false);
  });

  it("repeats the same page when the ranked input is unchanged", () => {
    const once = paginate(ranked, 2, 3);
    const twice = paginate(sortByHot(ranked, NOW), 2, 3);
    expect(twice.items.map((item) => item.id)).toEqual(once.items.map((item) => item.id));
  });
});
