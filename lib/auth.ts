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
  emailVerifiedAt: Date | null;
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
      emailVerifiedAt: true,
      createdAt: true,
    },
  });
});

export async function getKarma(userId: string): Promise<number> {
  const [postVotes, commentVotes] = await Promise.all([
    prisma.postVote.aggregate({
      where: {
        post: { authorId: userId },
        userId: { not: userId },
      },
      _sum: { value: true },
    }),
    prisma.commentVote.aggregate({
      where: {
        comment: { authorId: userId },
        userId: { not: userId },
      },
      _sum: { value: true },
    }),
  ]);
  return computeKarma(postVotes._sum.value ?? 0, commentVotes._sum.value ?? 0);
}
