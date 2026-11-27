import { describe, expect, it } from "vitest";
import { countFollowers, countFollowing, decideFavorite, decideFollow, followedAuthorIds } from "@/lib/domain/social";

const edges = [
  { followerId: "demo", followingId: "pg" },
  { followerId: "nash", followingId: "pg" },
  { followerId: "pg", followingId: "dang" },
  { followerId: "pg", followingId: "pg" },
];

describe("favorites and follows", () => {
  it("toggles a favorite on and off", () => {
    expect(decideFavorite(false)).toEqual({ favorited: true });
    expect(decideFavorite(true)).toEqual({ favorited: false });
  });

  it("rejects following yourself", () => {
    expect(decideFollow("demo", "demo", false)).toEqual({ ok: false, error: "You can't follow yourself." });
  });

  it("toggles a follow relationship", () => {
    expect(decideFollow("demo", "pg", false)).toEqual({ ok: true, following: true });
    expect(decideFollow("demo", "pg", true)).toEqual({ ok: true, following: false });
  });

  it("counts followers and following without a self-edge", () => {
    expect(countFollowers(edges, "pg")).toBe(2);
    expect(countFollowing(edges, "pg")).toBe(1);
    expect(countFollowers(edges, "demo")).toBe(0);
    expect(countFollowing([], "demo")).toBe(0);
  });

  it("keeps only followed authors, in order, once", () => {
    expect(followedAuthorIds(["pg", "dang", "pg", "nash"], ["nash", "pg"])).toEqual(["pg", "nash"]);
    expect(followedAuthorIds(["pg"], [])).toEqual([]);
  });
});
