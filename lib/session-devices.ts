import type { PrismaClient } from "@prisma/client";
import { LAST_SEEN_THROTTLE_MS, SESSION_MAX_AGE_MS, shouldTouchLastSeen, simplifyUserAgent } from "@/lib/domain/session-device";

const DEVICE_LIST_LIMIT = 20;
/** Incidental cleanup stays bounded so a page view cannot scan the whole table. */
export const SESSION_CLEANUP_BATCH = 20;

function staleSessionWhere(now: Date, userId?: string) {
  const cutoff = new Date(now.getTime() - SESSION_MAX_AGE_MS);
  return {
    ...(userId ? { userId } : {}),
    OR: [{ revokedAt: { not: null } }, { createdAt: { lte: cutoff } }],
  };
}

export async function countStaleSessions(db: PrismaClient, now = new Date(), userId?: string): Promise<number> {
  return db.session.count({ where: staleSessionWhere(now, userId) });
}

/** Delete revoked or expired rows only. A second call deletes nothing new. */
export async function deleteStaleSessions(
  db: PrismaClient,
  now = new Date(),
  options?: { userId?: string; limit?: number },
): Promise<number> {
  const where = staleSessionWhere(now, options?.userId);
  if (options?.limit) {
    const rows = await db.session.findMany({ where, select: { id: true }, take: options.limit });
    if (rows.length === 0) return 0;
    const deleted = await db.session.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    return deleted.count;
  }
  const deleted = await db.session.deleteMany({ where });
  return deleted.count;
}

export async function openSession(
  db: PrismaClient,
  userId: string,
  userAgent: string,
  now = new Date(),
): Promise<{ id: string }> {
  return db.session.create({
    data: {
      userId,
      userAgent: simplifyUserAgent(userAgent),
      createdAt: now,
      lastSeenAt: now,
    },
    select: { id: true },
  });
}

export async function revokeAllSessions(db: PrismaClient, userId: string, now = new Date()): Promise<void> {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
}

export async function touchLastSeen(
  db: PrismaClient,
  sessionId: string,
  lastSeenAt: Date,
  now: Date,
): Promise<boolean> {
  if (!shouldTouchLastSeen(lastSeenAt, now)) return false;
  const updated = await db.session.updateMany({
    where: { id: sessionId, lastSeenAt: { lt: new Date(now.getTime() - LAST_SEEN_THROTTLE_MS) } },
    data: { lastSeenAt: now },
  });
  return updated.count === 1;
}

export async function listSessions(
  db: PrismaClient,
  userId: string,
  currentSessionId: string | null,
  now = new Date(),
): Promise<{ id: string; label: string; lastSeenAt: Date; current: boolean }[]> {
  await deleteStaleSessions(db, now, { userId, limit: SESSION_CLEANUP_BATCH });
  const cutoff = new Date(now.getTime() - SESSION_MAX_AGE_MS);
  const rows = await db.session.findMany({
    where: { userId, revokedAt: null, createdAt: { gt: cutoff } },
    orderBy: { lastSeenAt: "desc" },
    take: DEVICE_LIST_LIMIT,
    select: { id: true, userAgent: true, lastSeenAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.userAgent || "Unknown device",
    lastSeenAt: row.lastSeenAt,
    current: row.id === currentSessionId,
  }));
}

export async function revokeOneSession(
  db: PrismaClient,
  userId: string,
  sessionId: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; error: string }> {
  const updated = await db.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: now },
  });
  if (updated.count !== 1) return { ok: false, error: "That device is not signed in." };
  return { ok: true };
}
