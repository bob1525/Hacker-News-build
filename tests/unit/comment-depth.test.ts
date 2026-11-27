import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_COMMENT_DEPTH } from "@/lib/config";
import {
  ancestorDepth,
  buildCommentTree,
  canReplyAtDepth,
  commentDepthMark,
  commentIndentPx,
  commentIndentStepPx,
  commentThreadGutter,
  maxThreadDepth,
  replyDepthError,
} from "@/lib/domain/comments";
import { prepareTestDatabase } from "@/tests/helpers/database";

describe("comment depth cap", () => {
  it("allows a reply through level 16 and rejects the next one", async () => {
    expect(MAX_COMMENT_DEPTH).toBe(16);
    const parents = new Map<string, string | null>();
    let previous: string | null = null;
    for (let level = 1; level <= 16; level += 1) {
      const id = `c${level}`;
      parents.set(id, previous);
      previous = id;
    }
    expect(await ancestorDepth("c15", (id) => parents.get(id) ?? null)).toBe(15);
    expect(canReplyAtDepth(15)).toBe(true);
    expect(await ancestorDepth("c16", (id) => parents.get(id) ?? null)).toBe(16);
    expect(canReplyAtDepth(16)).toBe(false);
    expect(replyDepthError()).toBe("Replies only nest 16 levels deep.");
    expect(await ancestorDepth("c2", (id) => (id === "c2" ? "c1" : "c2"))).toBeLessThan(MAX_COMMENT_DEPTH + 3);
  });

  it("keeps indent, collapse targets, and a 16-level tree", () => {
    expect(commentIndentPx(0)).toBe(0);
    expect(commentIndentPx(6)).toBe(72);
    expect(commentIndentPx(16)).toBe(120);
    expect(commentIndentPx(16)).toBe(commentIndentPx(10));
    const rows = Array.from({ length: 16 }, (_, index) => ({
      id: `n${index + 1}`,
      parentId: index === 0 ? null : `n${index}`,
      createdAt: new Date(index),
    }));
    const tree = buildCommentTree(rows);
    expect(maxThreadDepth(tree)).toBe(16);
    expect(tree[0]?.replies[0]?.id).toBe("n2");
  });

  it("marks depths 11 through 16 without widening the 120px indent", () => {
    expect(commentDepthMark(10)).toBeNull();
    expect(commentDepthMark(0)).toBeNull();
    const marks = [11, 12, 13, 14, 15, 16].map((depth) => {
      expect(commentIndentPx(depth)).toBe(120);
      expect(commentIndentPx(depth)).toBe(commentIndentPx(10));
      return commentDepthMark(depth);
    });
    expect(marks).toEqual(["11", "12", "13", "14", "15", "16"]);
    expect(new Set(marks).size).toBe(6);
    expect(commentIndentStepPx(1)).toBe(12);
    expect(commentIndentStepPx(10)).toBe(12);
    expect(commentIndentStepPx(11)).toBe(0);
    expect(commentIndentStepPx(16)).toBe(0);
    const total = Array.from({ length: 17 }, (_, depth) => commentIndentStepPx(depth)).reduce((sum, step) => sum + step, 0);
    expect(total).toBe(120);
  });

  it("drops the nested border once the indent stops growing", () => {
    expect(commentThreadGutter(0)).toBe(false);
    expect(commentThreadGutter(1)).toBe(true);
    expect(commentThreadGutter(10)).toBe(true);
    for (const depth of [11, 12, 13, 14, 15, 16]) {
      expect(commentThreadGutter(depth)).toBe(false);
      expect(commentIndentStepPx(depth)).toBe(0);
      expect(commentDepthMark(depth)).toBe(String(depth));
    }
    expect(commentIndentPx(16)).toBe(120);
  });
});

describe("comment depth persistence", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("depth");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("stores a 16-level thread and refuses a reply to the last level", async () => {
    const author = await db.user.create({
      data: { username: "depth", email: "depth@example.com", passwordHash: "x" },
    });
    const post = await db.post.create({ data: { title: "deep", text: "", authorId: author.id } });
    let parentId: string | null = null;
    for (let level = 1; level <= 16; level += 1) {
      const created: { id: string } = await db.comment.create({
        data: { text: `level ${level}`, postId: post.id, authorId: author.id, parentId },
      });
      parentId = created.id;
    }
    const rows = await db.comment.findMany({ where: { postId: post.id }, select: { id: true, parentId: true, createdAt: true } });
    expect(maxThreadDepth(buildCommentTree(rows))).toBe(16);
    const parentOf = new Map(rows.map((row) => [row.id, row.parentId]));
    const leaf = rows.find((row) => row.parentId && ![...parentOf.values()].includes(row.id));
    expect(leaf).toBeTruthy();
    const leafDepth = await ancestorDepth(leaf!.id, (id) => parentOf.get(id) ?? null);
    expect(leafDepth).toBe(16);
    expect(canReplyAtDepth(leafDepth)).toBe(false);
  });
});
