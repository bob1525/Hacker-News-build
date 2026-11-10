import { describe, expect, it } from "vitest";
import { buildCommentTree } from "@/lib/domain/comments";
import { karmaFromEvents } from "@/lib/domain/karma";

function at(hoursAgo: number) {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, 0) - hoursAgo * 3_600_000);
}

describe("comment vote ranking", () => {
  it("ranks a higher-voted comment above an older one", () => {
    const tree = buildCommentTree([
      { id: "old", parentId: null, createdAt: at(5), points: 1 },
      { id: "hot", parentId: null, createdAt: at(1), points: 4 },
    ]);
    expect(tree.map((node) => node.id)).toEqual(["hot", "old"]);
  });

  it("keeps oldest-first when points are tied", () => {
    const tree = buildCommentTree([
      { id: "later", parentId: null, createdAt: at(1), points: 2 },
      { id: "earlier", parentId: null, createdAt: at(4), points: 2 },
    ]);
    expect(tree.map((node) => node.id)).toEqual(["earlier", "later"]);
  });

  it("moves a comment down after its vote is removed", () => {
    const voted = buildCommentTree([
      { id: "a", parentId: null, createdAt: at(3), points: 3 },
      { id: "b", parentId: null, createdAt: at(1), points: 1 },
    ]);
    expect(voted.map((node) => node.id)).toEqual(["a", "b"]);

    const unvoted = buildCommentTree([
      { id: "a", parentId: null, createdAt: at(3), points: 0 },
      { id: "b", parentId: null, createdAt: at(1), points: 1 },
    ]);
    expect(unvoted.map((node) => node.id)).toEqual(["b", "a"]);
  });

  it("sorts each sibling list on its own", () => {
    const tree = buildCommentTree([
      { id: "root", parentId: null, createdAt: at(6), points: 0 },
      { id: "low", parentId: "root", createdAt: at(1), points: 1 },
      { id: "high", parentId: "root", createdAt: at(2), points: 5 },
      { id: "tied-older", parentId: "root", createdAt: at(4), points: 1 },
    ]);
    expect(tree[0]?.replies.map((node) => node.id)).toEqual(["high", "tied-older", "low"]);
  });

  it("treats a missing point count as zero", () => {
    const tree = buildCommentTree([
      { id: "plain", parentId: null, createdAt: at(2) },
      { id: "voted", parentId: null, createdAt: at(1), points: 1 },
    ]);
    expect(tree.map((node) => node.id)).toEqual(["voted", "plain"]);
  });

  it("breaks a complete tie by id", () => {
    const createdAt = at(2);
    const tree = buildCommentTree([
      { id: "b", parentId: null, createdAt, points: 1 },
      { id: "a", parentId: null, createdAt, points: 1 },
    ]);
    expect(tree.map((node) => node.id)).toEqual(["a", "b"]);
  });
});

describe("comment vote karma", () => {
  it("adds karma when someone else upvotes your comment", () => {
    expect(karmaFromEvents([{ authorId: "dang", voterId: "demo" }], "dang")).toBe(1);
  });

  it("removes that karma when the vote is taken back", () => {
    const upvoted = [{ authorId: "dang", voterId: "demo" }];
    expect(karmaFromEvents(upvoted, "dang")).toBe(1);
    expect(karmaFromEvents([], "dang")).toBe(0);
  });

  it("does not count a vote on your own comment", () => {
    expect(karmaFromEvents([{ authorId: "dang", voterId: "dang" }], "dang")).toBe(0);
  });

  it("does not give you karma for a comment you did not write", () => {
    expect(karmaFromEvents([{ authorId: "pg", voterId: "demo" }], "dang")).toBe(0);
  });
});
