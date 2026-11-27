import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collapseStorage, listCollapsedCommentIds, persistCommentCollapsed } from "@/lib/comment-collapse";
import { prepareTestDatabase } from "@/tests/helpers/database";

describe("comment collapse persistence", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("collapse");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  async function seed(username: string) {
    const user = await db.user.create({
      data: { username, email: `${username}@example.com`, passwordHash: "x" },
    });
    const post = await db.post.create({
      data: { title: `${username} post`, text: "", authorId: user.id },
    });
    const comment = await db.comment.create({
      data: { text: "a comment", authorId: user.id, postId: post.id },
    });
    return { user, post, comment };
  }

  it("keeps a logged-in collapse after it is written and drops it when expanded", async () => {
    const { user, post, comment } = await seed("ada");
    expect(await persistCommentCollapsed(db, user.id, comment.id, true)).toBe("ok");
    expect(await persistCommentCollapsed(db, user.id, comment.id, true)).toBe("ok");
    expect(await listCollapsedCommentIds(db, user.id, post.id)).toEqual([comment.id]);
    expect(await db.commentCollapse.count({ where: { userId: user.id, commentId: comment.id } })).toBe(1);

    expect(await persistCommentCollapsed(db, user.id, comment.id, false)).toBe("ok");
    expect(await listCollapsedCommentIds(db, user.id, post.id)).toEqual([]);
  });

  it("stores each user's collapses separately", async () => {
    const ada = await seed("bea");
    const bob = await seed("cam");
    await persistCommentCollapsed(db, ada.user.id, ada.comment.id, true);
    await persistCommentCollapsed(db, bob.user.id, bob.comment.id, true);

    expect(await listCollapsedCommentIds(db, ada.user.id)).toEqual([ada.comment.id]);
    expect(await listCollapsedCommentIds(db, bob.user.id)).toEqual([bob.comment.id]);
    expect(await listCollapsedCommentIds(db, ada.user.id, bob.post.id)).toEqual([]);
  });

  it("does not write a row for a missing comment and removes the row when the comment is deleted", async () => {
    expect(await persistCommentCollapsed(db, "missing-user", "missing-comment", true)).toBe("missing");
    expect(await db.commentCollapse.count({ where: { commentId: "missing-comment" } })).toBe(0);

    const { user, comment } = await seed("dee");
    await persistCommentCollapsed(db, user.id, comment.id, true);
    await db.comment.delete({ where: { id: comment.id } });
    expect(await listCollapsedCommentIds(db, user.id)).toEqual([]);
  });

  it("uses the database for a logged-in viewer and session storage otherwise", () => {
    expect(collapseStorage("user-1")).toBe("database");
    expect(collapseStorage(null)).toBe("session");
  });
});
