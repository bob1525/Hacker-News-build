import { describe, expect, it } from "vitest";
import { HOT_GRAVITY, ageInHours, compareByHot, hotScore, sortByHot } from "@/lib/domain/ranking";

/**
 * Hand-checked values for score = (points - 1) / (ageHours + 2) ^ 1.8.
 * Powers were checked two ways: (age+2) ** 1.8 and exp(1.8 * ln(age+2)).
 * 2^1.8 = 3.482202253184, so (2-1)/2^1.8 = 0.287174588749
 * and (0-1)/2^1.8 = -0.287174588749.
 * 3^1.8 = 7.224674055842, so (5-1)/3^1.8 = 0.553658195385.
 */

const NOW = new Date("2026-01-01T00:00:00.000Z");

function hoursBefore(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000);
}

describe("hot score hand checks", () => {
  it("keeps gravity at 1.8 so the hand literals stay valid", () => {
    expect(HOT_GRAVITY).toBe(1.8);
  });

  it("scores a brand-new one-point story at exactly zero", () => {
    expect(hotScore(1, 0)).toBe(0);
  });

  it("scores a one-point story at zero no matter how old it is", () => {
    expect(hotScore(1, 100)).toBe(0);
    expect(hotScore(1, 10_000)).toBe(0);
  });

  it("scores a brand-new zero-point story at -1/2^1.8", () => {
    expect(hotScore(0, 0)).toBeCloseTo(-0.287174588749, 9);
  });

  it("scores a brand-new two-point story at +1/2^1.8", () => {
    expect(hotScore(2, 0)).toBeCloseTo(0.287174588749, 9);
  });

  it("scores a brand-new ten-point story at 9/2^1.8", () => {
    expect(hotScore(10, 0)).toBeCloseTo(2.584571298743, 9);
  });

  it("scores five points at one hour as 4/3^1.8", () => {
    expect(hotScore(5, 1)).toBeCloseTo(0.553658195385, 9);
  });

  it("scores one hundred points at twenty-four hours as 99/26^1.8", () => {
    expect(hotScore(100, 24)).toBeCloseTo(0.280985020667, 9);
  });

  it("ranks every zero-point story below every one-point story", () => {
    expect(hotScore(0, 4)).toBeCloseTo(-0.039749141142, 9);
    expect(hotScore(0, 4)).toBeLessThan(hotScore(1, 10_000));
    const ranked = sortByHot(
      [
        { id: "zero", points: 0, createdAt: hoursBefore(4) },
        { id: "one", points: 1, createdAt: hoursBefore(10_000) },
      ],
      NOW,
    );
    expect(ranked.map((item) => item.id)).toEqual(["one", "zero"]);
  });

  it("lets a fresh 15-point story outrank an 80-point story from 72 hours ago", () => {
    expect(hotScore(15, 0.5)).toBeCloseTo(2.690518732118, 9);
    expect(hotScore(80, 72)).toBeCloseTo(0.034120076465, 9);
    const ranked = sortByHot(
      [
        { id: "ancient", points: 80, createdAt: hoursBefore(72) },
        { id: "rocket", points: 15, createdAt: hoursBefore(0.5) },
      ],
      NOW,
    );
    expect(ranked.map((item) => item.id)).toEqual(["rocket", "ancient"]);
  });

  it("breaks an exact score tie toward the newer story", () => {
    const older = { id: "old", points: 1, createdAt: hoursBefore(100) };
    const newer = { id: "new", points: 1, createdAt: hoursBefore(1) };
    expect(hotScore(older.points, ageInHours(older.createdAt, NOW))).toBe(0);
    expect(hotScore(newer.points, ageInHours(newer.createdAt, NOW))).toBe(0);
    expect(sortByHot([older, newer], NOW).map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("clamps negative points to zero points and future timestamps to age zero", () => {
    expect(hotScore(-8, 0)).toBeCloseTo(hotScore(0, 0), 12);
    expect(hotScore(4, -3)).toBeCloseTo(hotScore(4, 0), 12);
    expect(ageInHours(new Date(NOW.getTime() + 5 * 3_600_000), NOW)).toBe(0);
    const ranked = sortByHot(
      [
        { id: "future", points: 4, createdAt: new Date(NOW.getTime() + 3_600_000) },
        { id: "now", points: 4, createdAt: NOW },
      ],
      NOW,
    );
    expect(ranked.map((item) => item.id)).toEqual(["future", "now"]);
  });

  it("keeps a ten-hour two-point story above a zero-point story", () => {
    expect(hotScore(2, 10)).toBeCloseTo(0.011414943261, 9);
    expect(hotScore(2, 10)).toBeGreaterThan(hotScore(0, 0));
    const ranked = sortByHot(
      [
        { id: "zero", points: 0, createdAt: NOW },
        { id: "aged", points: 2, createdAt: hoursBefore(10) },
      ],
      NOW,
    );
    expect(ranked[0]?.id).toBe("aged");
  });

  it("treats identical points and timestamps as equal", () => {
    const createdAt = hoursBefore(3);
    expect(compareByHot({ points: 6, createdAt }, { points: 6, createdAt }, NOW)).toBe(0);
  });

  it("treats non-finite points and ages as a zero-point story with age zero", () => {
    expect(Number.isFinite(Number.POSITIVE_INFINITY)).toBe(false);
    expect(hotScore(Number.NaN, Number.POSITIVE_INFINITY)).toBeCloseTo(-0.287174588749, 9);
    expect(hotScore(Number.POSITIVE_INFINITY, 0)).toBeCloseTo(-0.287174588749, 9);
  });
});
