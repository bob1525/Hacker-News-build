import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { computeKarma } from "@/lib/domain/karma";
import { deviceSessionDecision } from "@/lib/domain/session-device";
import { readSessionClaimsFromCookie } from "@/lib/session";
import { SESSION_CLEANUP_BATCH, deleteStaleSessions, touchLastSeen } from "@/lib/session-devices";

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
  if (!user) return null;
  const session = claims.sessionId
    ? await prisma.session.findUnique({
        where: { id: claims.sessionId },
        select: { userId: true, revokedAt: true, createdAt: true, lastSeenAt: true },
      })
    : null;
  const now = new Date();
  const decision = deviceSessionDecision({
    claimsSessionId: claims.sessionId,
    claimsVersion: claims.sessionVersion,
    userVersion: user.sessionVersion,
    userId: user.id,
    session,
    now,
  });
  if (!decision.ok) {
    await deleteStaleSessions(prisma, now, { userId: user.id, limit: SESSION_CLEANUP_BATCH });
    return null;
  }
  if (claims.sessionId && session) {
    await touchLastSeen(prisma, claims.sessionId, session.lastSeenAt, now);
  }
  await deleteStaleSessions(prisma, now, { userId: user.id, limit: SESSION_CLEANUP_BATCH });
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
