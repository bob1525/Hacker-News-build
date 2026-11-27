import { Prisma, type PrismaClient } from "@prisma/client";
import { nextVoteValue, type VoteValue } from "@/lib/domain/downvotes";

const transactionOptions = { maxWait: 20_000, timeout: 20_000 };

let writeQueue: Promise<unknown> = Promise.resolve();

/** SQLite allows one writer. Overlapping interactive transactions on that connection time out. */
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(run, run);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function applyPostVote(db: PrismaClient, userId: string, postId: string, direction: VoteValue = 1) {
  return enqueue(() => applyPostVoteOnce(db, userId, postId, direction));
}

async function postPoints(db: Prisma.TransactionClient | PrismaClient, postId: string): Promise<number> {
  const aggregate = await db.postVote.aggregate({ where: { postId }, _sum: { value: true } });
  return aggregate._sum.value ?? 0;
}

async function applyPostVoteOnce(db: PrismaClient, userId: string, postId: string, direction: VoteValue) {
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.postVote.findUnique({
        where: { userId_postId: { userId, postId } },
      });
      const current: VoteValue | null = existing ? (existing.value < 0 ? -1 : 1) : null;
      const next = nextVoteValue(current, direction);
      if (existing && !next) {
        await tx.postVote.delete({ where: { userId_postId: { userId, postId } } });
      } else if (existing && next) {
        await tx.postVote.update({ where: { userId_postId: { userId, postId } }, data: { value: next } });
      } else if (next) {
        await tx.postVote.create({ data: { userId, postId, value: next } });
      }
      return { voted: next === 1, downvoted: next === -1, points: await postPoints(tx, postId) };
    }, transactionOptions);
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const row = await db.postVote.findUnique({ where: { userId_postId: { userId, postId } } });
    const current: VoteValue | null = row ? (row.value < 0 ? -1 : 1) : null;
    return { voted: current === 1, downvoted: current === -1, points: await postPoints(db, postId) };
  }
}

export async function applyCommentVote(db: PrismaClient, userId: string, commentId: string, direction: VoteValue = 1) {
  return enqueue(() => applyCommentVoteOnce(db, userId, commentId, direction));
}

async function commentPoints(db: Prisma.TransactionClient | PrismaClient, commentId: string): Promise<number> {
  const aggregate = await db.commentVote.aggregate({ where: { commentId }, _sum: { value: true } });
  return aggregate._sum.value ?? 0;
}

async function applyCommentVoteOnce(db: PrismaClient, userId: string, commentId: string, direction: VoteValue) {
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.commentVote.findUnique({
        where: { userId_commentId: { userId, commentId } },
      });
      const current: VoteValue | null = existing ? (existing.value < 0 ? -1 : 1) : null;
      const next = nextVoteValue(current, direction);
      if (existing && !next) {
        await tx.commentVote.delete({ where: { userId_commentId: { userId, commentId } } });
      } else if (existing && next) {
        await tx.commentVote.update({ where: { userId_commentId: { userId, commentId } }, data: { value: next } });
      } else if (next) {
        await tx.commentVote.create({ data: { userId, commentId, value: next } });
      }
      return { voted: next === 1, downvoted: next === -1, points: await commentPoints(tx, commentId) };
    }, transactionOptions);
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const row = await db.commentVote.findUnique({ where: { userId_commentId: { userId, commentId } } });
    const current: VoteValue | null = row ? (row.value < 0 ? -1 : 1) : null;
    return { voted: current === 1, downvoted: current === -1, points: await commentPoints(db, commentId) };
  }
}
