import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { computeKarma } from "@/lib/domain/karma";
import { readSessionClaimsFromCookie } from "@/lib/session";
import { sessionVersionMatches } from "@/lib/session-token";

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  about: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const claims = await readSessionClaimsFromCookie();
  if (!claims) return null;
  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: {
      id: true,
      username: true,
      email: true,
      about: true,
      emailVerifiedAt: true,
      createdAt: true,
      sessionVersion: true,
    },
  });
  if (!user || !sessionVersionMatches(claims, user.sessionVersion)) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    about: user.about,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
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
