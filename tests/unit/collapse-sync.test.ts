import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GUEST_COLLAPSE_MERGE_LIMIT, listCollapsedCommentIds, mergeGuestCollapses } from "@/lib/comment-collapse";
import { guestCollapseRemainder } from "@/lib/domain/collapsed-comments";
import { prepareTestDatabase } from "@/tests/helpers/database";

describe("guest collapse remainder", () => {
  it("drops merged and missing ids and keeps the ones still over the cap", () => {
    expect(guestCollapseRemainder(["a", "b", "c"], { merged: ["a"], missing: ["b"] })).toEqual(["c"]);
    expect(guestCollapseRemainder(["a"], { merged: ["a"], missing: [] })).toEqual([]);
  });
});

describe("merge guest collapses into the account", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("collapseSync");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  async function comment(username: string, text: string) {
    const user = await db.user.create({
      data: { username, email: `${username}@example.com`, passwordHash: "x" },
    });
    const post = await db.post.create({
      data: { title: `${username} post`, text: "", authorId: user.id },
    });
    const row = await db.comment.create({
      data: { text, authorId: user.id, postId: post.id },
    });
    return { user, comment: row };
  }

  it("merges only comments that exist, and a second merge does not add a row", async () => {
    const ada = await comment("syncada", "first");
    const other = await comment("syncother", "second");
    const first = await mergeGuestCollapses(db, ada.user.id, [ada.comment.id, "missing-comment", ada.comment.id, 12]);
    expect(first.merged).toEqual([ada.comment.id]);
    expect(first.missing).toEqual(["missing-comment"]);
    expect(await listCollapsedCommentIds(db, ada.user.id)).toEqual([ada.comment.id]);
    expect(await db.commentCollapse.count({ where: { userId: ada.user.id } })).toBe(1);

    const second = await mergeGuestCollapses(db, ada.user.id, [ada.comment.id, other.comment.id]);
    expect(second.merged).toEqual([ada.comment.id, other.comment.id]);
    expect(await db.commentCollapse.count({ where: { userId: ada.user.id, commentId: ada.comment.id } })).toBe(1);
    expect(await listCollapsedCommentIds(db, ada.user.id)).toEqual([ada.comment.id, other.comment.id].sort());
  });

  it("stops at the limit and leaves the rest to the next merge", async () => {
    expect(GUEST_COLLAPSE_MERGE_LIMIT).toBe(100);
    const owner = await comment("synccap", "cap");
    const ids = [];
    for (const text of ["one", "two", "three"]) {
      const row = await db.comment.create({
        data: { text, authorId: owner.user.id, postId: (await db.comment.findUniqueOrThrow({ where: { id: owner.comment.id } })).postId },
      });
      ids.push(row.id);
    }
    const limited = await mergeGuestCollapses(db, owner.user.id, ids, 2);
    expect(limited.merged).toEqual(ids.slice(0, 2));
    expect(limited.skipped).toEqual(ids.slice(2));
    expect(await db.commentCollapse.count({ where: { userId: owner.user.id, commentId: { in: ids } } })).toBe(2);

    const rest = await mergeGuestCollapses(db, owner.user.id, guestCollapseRemainder(ids, limited), 2);
    expect(rest.merged).toEqual(ids.slice(2));
    expect(await db.commentCollapse.count({ where: { userId: owner.user.id, commentId: { in: ids } } })).toBe(3);
  });
});
