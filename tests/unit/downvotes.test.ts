import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DOWNVOTE_MIN_KARMA } from "@/lib/config";
import { downvoteDecision, nextVoteValue } from "@/lib/domain/downvotes";
import { computeKarma } from "@/lib/domain/karma";
import { hotScore } from "@/lib/domain/ranking";
import { pageHotPostIds } from "@/lib/domain/ranking-sql";
import { applyCommentVote, applyPostVote } from "@/lib/voting";
import { prepareTestDatabase } from "@/tests/helpers/database";

const now = new Date("2026-11-27T12:00:00.000Z");

describe("downvote rules", () => {
  it("cancels the same direction and switches the other", () => {
    expect(nextVoteValue(null, 1)).toBe(1);
    expect(nextVoteValue(1, 1)).toBeNull();
    expect(nextVoteValue(-1, -1)).toBeNull();
    expect(nextVoteValue(1, -1)).toBe(-1);
    expect(nextVoteValue(-1, 1)).toBe(1);
  });

  it("requires karma and rejects a vote on your own or deleted comment", () => {
    expect(
      downvoteDecision({ voterId: "ann", authorId: "ann", karma: 5, kind: "post" }),
    ).toEqual({ ok: false, error: "You can't vote on your own post." });
    expect(
      downvoteDecision({ voterId: "ann", authorId: "bea", karma: DOWNVOTE_MIN_KARMA - 1 }),
    ).toEqual({ ok: false, error: `You need at least ${DOWNVOTE_MIN_KARMA} karma to downvote.` });
    expect(downvoteDecision({ voterId: "ann", authorId: "bea", karma: DOWNVOTE_MIN_KARMA, deleted: true, kind: "comment" })).toEqual({
      ok: false,
      error: "You can't vote on a deleted comment.",
    });
    expect(downvoteDecision({ voterId: "ann", authorId: "bea", karma: DOWNVOTE_MIN_KARMA }).ok).toBe(true);
  });

  it("keeps the hot formula, including the existing floor at zero points", () => {
    const age = 2;
    expect(hotScore(-1, age)).toBeCloseTo(hotScore(0, age), 12);
    expect(hotScore(1, age)).toBeGreaterThan(hotScore(0, age));
    expect(hotScore(2, age)).toBeGreaterThan(hotScore(1, age));
  });
});

describe("downvote persistence", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("downvotes");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  async function user(username: string) {
    return db.user.create({
      data: { username, email: `${username}@example.com`, passwordHash: "x", emailVerifiedAt: now },
    });
  }

  it("still toggles an upvote on and off", async () => {
    const author = await user("cy");
    const voter = await user("dee");
    const post = await db.post.create({ data: { title: "up", text: "", authorId: author.id, createdAt: now } });
    const up = await applyPostVote(db, voter.id, post.id);
    expect(up).toMatchObject({ voted: true, downvoted: false, points: 1 });
    const cleared = await applyPostVote(db, voter.id, post.id);
    expect(cleared).toMatchObject({ voted: false, downvoted: false, points: 0 });
  });

  it("lowers points with a downvote and restores them when cancelled", async () => {
    const author = await user("eve");
    const voter = await user("fay");
    await db.postVote.create({
      data: {
        userId: author.id,
        postId: (await db.post.create({ data: { title: "karma", text: "", authorId: voter.id } })).id,
        value: 1,
      },
    });
    const post = await db.post.create({ data: { title: "down", text: "", authorId: author.id, createdAt: now } });
    const down = await applyPostVote(db, voter.id, post.id, -1);
    expect(down).toMatchObject({ voted: false, downvoted: true, points: -1 });
    const cleared = await applyPostVote(db, voter.id, post.id, -1);
    expect(cleared).toMatchObject({ voted: false, downvoted: false, points: 0 });
  });

  it("switches an upvote into a downvote and sums both directions into karma", async () => {
    const author = await user("gia");
    const upVoter = await user("hal");
    const downVoter = await user("ida");
    const post = await db.post.create({ data: { title: "switch", text: "", authorId: author.id, createdAt: now } });
    expect(await applyPostVote(db, upVoter.id, post.id)).toMatchObject({ points: 1 });
    expect(await applyPostVote(db, downVoter.id, post.id)).toMatchObject({ points: 2 });
    const before = await db.postVote.aggregate({
      where: { post: { authorId: author.id }, userId: { not: author.id } },
      _sum: { value: true },
    });
    expect(computeKarma(before._sum.value ?? 0, 0)).toBe(2);
    expect(await applyPostVote(db, upVoter.id, post.id, -1)).toMatchObject({ voted: false, downvoted: true, points: 0 });
    const received = await db.postVote.aggregate({
      where: { post: { authorId: author.id }, userId: { not: author.id } },
      _sum: { value: true },
    });
    expect(computeKarma(received._sum.value ?? 0, 0)).toBe(0);

    const comment = await db.comment.create({ data: { text: "note", authorId: author.id, postId: post.id } });
    expect(await applyCommentVote(db, upVoter.id, comment.id, -1)).toMatchObject({ downvoted: true, points: -1 });
  });

  it("ranks a cancelled vote below a positive vote and floors a negative total with zero", async () => {
    const author = await user("jay");
    const up = await user("kit");
    const down = await user("lee");
    const positive = await db.post.create({ data: { title: "warm", text: "", authorId: author.id, createdAt: now } });
    const cancelled = await db.post.create({ data: { title: "even", text: "", authorId: author.id, createdAt: now } });
    const negative = await db.post.create({ data: { title: "cold", text: "", authorId: author.id, createdAt: now } });
    const zero = await db.post.create({ data: { title: "flat", text: "", authorId: author.id, createdAt: now } });
    await db.postVote.create({ data: { userId: up.id, postId: positive.id, value: 1 } });
    await db.postVote.create({ data: { userId: up.id, postId: cancelled.id, value: 1 } });
    await db.postVote.create({ data: { userId: down.id, postId: cancelled.id, value: -1 } });
    await db.postVote.create({ data: { userId: down.id, postId: negative.id, value: -1 } });
    const ranked = await pageHotPostIds(db, {
      now,
      page: 1,
      pageSize: 10,
      ids: [positive.id, cancelled.id],
    });
    expect(ranked.ids).toEqual([positive.id, cancelled.id]);
    const floored = await pageHotPostIds(db, { now, page: 1, pageSize: 10, ids: [negative.id, zero.id] });
    expect(floored.ids).toEqual([negative.id, zero.id].sort((a, b) => b.localeCompare(a)));
  });
});
