import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareTestDatabase } from "@/tests/helpers/database";
import { applyCommentVote, applyPostVote } from "@/lib/voting";

const voters = 24;

describe("concurrent votes", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("concurrency");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("counts one vote per user when many users vote on one post and one comment", async () => {
    const author = await db.user.create({
      data: { username: "author", email: "author@example.com", passwordHash: "x" },
    });
    const users = await Promise.all(
      Array.from({ length: voters }, (_, index) =>
        db.user.create({
          data: {
            username: `voter${index}`,
            email: `voter${index}@example.com`,
            passwordHash: "x",
          },
        }),
      ),
    );
    const post = await db.post.create({
      data: { title: "Shared post", text: "body", authorId: author.id },
    });
    const comment = await db.comment.create({
      data: { text: "Shared comment", postId: post.id, authorId: author.id },
    });

    await Promise.all(users.map((user) => applyPostVote(db, user.id, post.id)));
    expect(await db.postVote.count({ where: { postId: post.id } })).toBe(voters);

    await Promise.all(users.map((user) => applyCommentVote(db, user.id, comment.id)));
    expect(await db.commentVote.count({ where: { commentId: comment.id } })).toBe(voters);

    await Promise.all(users.map((user) => applyPostVote(db, user.id, post.id)));
    await Promise.all(users.map((user) => applyCommentVote(db, user.id, comment.id)));
    expect(await db.postVote.count({ where: { postId: post.id } })).toBe(0);
    expect(await db.commentVote.count({ where: { commentId: comment.id } })).toBe(0);
  }, 60_000);

  it("never stores more than one vote when the same user votes concurrently", async () => {
    const author = await db.user.create({
      data: { username: "author2", email: "author2@example.com", passwordHash: "x" },
    });
    const voter = await db.user.create({
      data: { username: "solo", email: "solo@example.com", passwordHash: "x" },
    });
    const post = await db.post.create({
      data: { title: "Race post", text: "body", authorId: author.id },
    });

    await Promise.all(Array.from({ length: 12 }, () => applyPostVote(db, voter.id, post.id)));
    expect(await db.postVote.count({ where: { postId: post.id } })).toBe(0);
  }, 60_000);
});
