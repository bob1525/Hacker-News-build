import { Prisma, type PrismaClient } from "@prisma/client";

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

export async function applyPostVote(db: PrismaClient, userId: string, postId: string) {
  return enqueue(() => applyPostVoteOnce(db, userId, postId));
}

async function applyPostVoteOnce(db: PrismaClient, userId: string, postId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.postVote.findUnique({
        where: { userId_postId: { userId, postId } },
      });
      if (existing) {
        await tx.postVote.delete({ where: { userId_postId: { userId, postId } } });
      } else {
        await tx.postVote.create({ data: { userId, postId } });
      }
      const points = await tx.postVote.count({ where: { postId } });
      return { voted: !existing, points };
    }, transactionOptions);
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const points = await db.postVote.count({ where: { postId } });
    return { voted: true, points };
  }
}

export async function applyCommentVote(db: PrismaClient, userId: string, commentId: string) {
  return enqueue(() => applyCommentVoteOnce(db, userId, commentId));
}

async function applyCommentVoteOnce(db: PrismaClient, userId: string, commentId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.commentVote.findUnique({
        where: { userId_commentId: { userId, commentId } },
      });
      if (existing) {
        await tx.commentVote.delete({ where: { userId_commentId: { userId, commentId } } });
      } else {
        await tx.commentVote.create({ data: { userId, commentId } });
      }
      const points = await tx.commentVote.count({ where: { commentId } });
      return { voted: !existing, points };
    }, transactionOptions);
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const points = await db.commentVote.count({ where: { commentId } });
    return { voted: true, points };
  }
}
