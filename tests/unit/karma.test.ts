import { describe, expect, it } from "vitest";
import { computeKarma, karmaFromEvents } from "@/lib/domain/karma";

describe("karma", () => {
  it("adds upvotes received on posts and comments", () => {
    expect(computeKarma(4, 2)).toBe(6);
    expect(computeKarma(0, 0)).toBe(0);
    expect(computeKarma(-3, 2)).toBe(2);
  });

  it("ignores self-votes and votes on other people", () => {
    const events = [
      { authorId: "nash", voterId: "pg" },
      { authorId: "nash", voterId: "nash" },
      { authorId: "pg", voterId: "nash" },
      { authorId: "nash", voterId: "dang" },
    ];
    expect(karmaFromEvents(events, "nash")).toBe(2);
    expect(karmaFromEvents(events, "pg")).toBe(1);
    expect(karmaFromEvents([], "nash")).toBe(0);
  });
});
