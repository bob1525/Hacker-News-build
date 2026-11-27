import type { PrismaClient } from "@prisma/client";
import { revokeAllSessions } from "@/lib/session-devices";

/** True when the browser that opened the link is already this user, so it should get a fresh cookie. */
export function currentBrowserKeepsSession(viewerId: string | null | undefined, userId: string): boolean {
  return typeof viewerId === "string" && viewerId.length > 0 && viewerId === userId;
}

/** Bumps the user's session version. Cookies signed at the previous version stop working. */
export async function revokeOtherSessions(
  db: PrismaClient,
  userId: string,
): Promise<{ ok: true; sessionVersion: number } | { ok: false; error: string }> {
  const existing = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) return { ok: false, error: "Log in to sign out other devices." };
  const user = await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  await revokeAllSessions(db, userId);
  return { ok: true, sessionVersion: user.sessionVersion };
}
