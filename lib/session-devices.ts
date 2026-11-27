import type { PrismaClient } from "@prisma/client";
import { simplifyUserAgent } from "@/lib/domain/session-device";

const DEVICE_LIST_LIMIT = 20;

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

export async function listSessions(
  db: PrismaClient,
  userId: string,
  currentSessionId: string | null,
): Promise<{ id: string; label: string; lastSeenAt: Date; current: boolean }[]> {
  const rows = await db.session.findMany({
    where: { userId, revokedAt: null },
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
