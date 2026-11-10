import { describe, expect, it } from "vitest";
import { buildCommentTree, countThreadNodes, maxThreadDepth } from "@/lib/domain/comments";

function at(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 3_600_000);
}

describe("comment threads", () => {
  it("nests replies under their parent, oldest first", () => {
    const tree = buildCommentTree([
      { id: "child", parentId: "root", createdAt: at(1), text: "child" },
      { id: "root", parentId: null, createdAt: at(3), text: "root" },
      { id: "later", parentId: null, createdAt: at(2), text: "later" },
    ]);

    expect(tree.map((node) => node.id)).toEqual(["root", "later"]);
    expect(tree[0]?.replies.map((node) => node.id)).toEqual(["child"]);
    expect(countThreadNodes(tree)).toBe(3);
  });

  it("keeps a four-level conversation intact", () => {
    const tree = buildCommentTree([
      { id: "a", parentId: null, createdAt: at(4) },
      { id: "b", parentId: "a", createdAt: at(3) },
      { id: "c", parentId: "b", createdAt: at(2) },
      { id: "d", parentId: "c", createdAt: at(1) },
    ]);
    expect(maxThreadDepth(tree)).toBe(4);
    expect(tree[0]?.replies[0]?.replies[0]?.replies[0]?.id).toBe("d");
  });

  it("promotes orphans and drops duplicate ids", () => {
    const tree = buildCommentTree([
      { id: "a", parentId: "missing", createdAt: at(2) },
      { id: "a", parentId: null, createdAt: at(1) },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe("a");
    expect(tree[0]?.parentId).toBe("missing");
  });

  it("breaks cycles so every comment is still rendered once", () => {
    const tree = buildCommentTree([
      { id: "a", parentId: "b", createdAt: at(2) },
      { id: "b", parentId: "a", createdAt: at(1) },
    ]);
    const ids: string[] = [];
    const walk = (nodes: typeof tree) => {
      for (const node of nodes) {
        ids.push(node.id);
        walk(node.replies);
      }
    };
    walk(tree);
    expect(ids.sort()).toEqual(["a", "b"]);
    expect(countThreadNodes(tree)).toBe(2);
  });

  it("does not treat a comment as its own parent", () => {
    const tree = buildCommentTree([{ id: "loop", parentId: "loop", createdAt: at(1) }]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.replies).toEqual([]);
  });
});
