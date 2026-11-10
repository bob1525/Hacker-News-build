import { describe, expect, it } from "vitest";
import { assertSeedIntegrity, commentCount, posts } from "@/prisma/seed-data";

describe("seed dataset", () => {
  it("is large enough to browse and internally consistent", () => {
    expect(() => assertSeedIntegrity()).not.toThrow();
    expect(posts.length).toBeGreaterThanOrEqual(32);
    expect(commentCount()).toBeGreaterThanOrEqual(40);
  });
});
