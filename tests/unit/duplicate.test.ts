import { describe, expect, it } from "vitest";
import { COMMENT_DUPLICATE_WINDOW_MS, POST_DUPLICATE_WINDOW_MS } from "@/lib/config";
import { hasRecentDuplicate, isNearDuplicate, normalizeContent, similarity } from "@/lib/domain/duplicate";

const now = new Date("2026-05-01T12:00:00.000Z");

describe("duplicate content", () => {
  it("treats case and punctuation as the same title", () => {
    expect(normalizeContent("Hello, World!")).toBe("hello world");
    expect(isNearDuplicate("Hello, World!", ["hello world"])).toBe(true);
  });

  it("flags a title that only changes one character in a long phrase", () => {
    const original = "Show HN: a tiny sqlite log viewer for local files";
    const tweaked = "Show HN: a tiny sqlite log viewer for local fils";
    expect(similarity(original, tweaked)).toBeGreaterThanOrEqual(0.9);
    expect(isNearDuplicate(tweaked, [original])).toBe(true);
  });

  it("allows a clearly different title", () => {
    expect(similarity("sqlite backup tips", "kubernetes ingress timeouts")).toBeLessThan(0.5);
    expect(isNearDuplicate("sqlite backup tips", ["kubernetes ingress timeouts"])).toBe(false);
  });

  it("does not treat empty text as a duplicate", () => {
    expect(isNearDuplicate("   ", ["hello"])).toBe(false);
    expect(isNearDuplicate("hello", ["", "   "])).toBe(false);
    expect(isNearDuplicate("hello", [])).toBe(false);
  });

  it("ignores an identical post from outside the window", () => {
    const recent = [
      { text: "Same title", createdAt: new Date(now.getTime() - POST_DUPLICATE_WINDOW_MS - 1) },
    ];
    expect(hasRecentDuplicate("Same title", recent, now, POST_DUPLICATE_WINDOW_MS)).toBe(false);
  });

  it("catches an identical comment inside the window", () => {
    const recent = [
      { text: "I agree with this.", createdAt: new Date(now.getTime() - COMMENT_DUPLICATE_WINDOW_MS + 1_000) },
    ];
    expect(hasRecentDuplicate("i agree with this", recent, now, COMMENT_DUPLICATE_WINDOW_MS)).toBe(true);
  });
});
