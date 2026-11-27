import { describe, expect, it } from "vitest";
import { HOT_GRAVITY, hotScore, sortByHot, sortByNewest } from "@/lib/domain/ranking";
import { HOT_POST_TITLE, NEWEST_POST_TITLE, assertSeedRanking, seedRankingSamples } from "@/prisma/seed-data";

describe("hot ranking", () => {
  it("uses the classic gravity and treats a single point as a zero score", () => {
    expect(HOT_GRAVITY).toBe(1.8);
    expect(hotScore(1, 0)).toBe(0);
    expect(hotScore(2, 0)).toBeCloseTo(1 / 2 ** 1.8, 10);
    expect(hotScore(0, 4)).toBeLessThan(0);
    expect(hotScore(Number.NaN, Number.NaN)).toBeLessThan(0);
  });

  it("ranks more points above fewer points when the posts are the same age", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const createdAt = new Date("2025-12-31T12:00:00Z");
    const ranked = sortByHot(
      [
        { id: "low", points: 3, createdAt },
        { id: "high", points: 12, createdAt },
      ],
      now,
    );
    expect(ranked.map((item) => item.id)).toEqual(["high", "low"]);
  });

  it("lets a fresh well-voted story outrank an older story with more raw points", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const rocket = { id: "rocket", points: 15, createdAt: new Date(now.getTime() - 0.5 * 3_600_000) };
    const ancient = { id: "ancient", points: 80, createdAt: new Date(now.getTime() - 72 * 3_600_000) };
    expect(sortByHot([ancient, rocket], now)[0]?.id).toBe("rocket");
  });

  it("breaks one-point ties toward the newer story", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const ranked = sortByHot(
      [
        { id: "old", points: 1, createdAt: new Date("2025-01-01T00:00:00Z") },
        { id: "new", points: 1, createdAt: new Date("2025-06-01T00:00:00Z") },
      ],
      now,
    );
    expect(ranked.map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("does not mutate the input list", () => {
    const items = [{ points: 2, createdAt: new Date("2026-01-01T00:00:00Z") }];
    const copy = [...items];
    sortByHot(items);
    expect(items).toEqual(copy);
  });

  it("keeps the seeded front page and newest page in the intended order", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(() => assertSeedRanking(now)).not.toThrow();
    const samples = seedRankingSamples(now);
    expect(sortByHot(samples, now)[0]?.title).toBe(HOT_POST_TITLE);
    expect(sortByNewest(samples)[0]?.title).toBe(NEWEST_POST_TITLE);
    expect(sortByHot(samples, now)[0]?.title).not.toBe(sortByNewest(samples)[0]?.title);
  });
});
