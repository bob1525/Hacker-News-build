import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { computeKarma } from "@/lib/domain/karma";
import { readSessionUserId } from "@/lib/session";

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  about: string;
  createdAt: Date;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      about: true,
      createdAt: true,
    },
  });
});

export async function getKarma(userId: string): Promise<number> {
  const [postUpvotes, commentUpvotes] = await Promise.all([
    prisma.postVote.count({
      where: {
        post: { authorId: userId },
        userId: { not: userId },
      },
    }),
    prisma.commentVote.count({
      where: {
        comment: { authorId: userId },
        userId: { not: userId },
      },
    }),
  ]);
  return computeKarma(postUpvotes, commentUpvotes);
}
