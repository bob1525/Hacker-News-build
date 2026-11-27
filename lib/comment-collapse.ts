import type { PrismaClient } from "@prisma/client";

/** Logged-in collapse lives in the database. Logged-out collapse stays in this browser's localStorage. */
export function collapseStorage(viewerId: string | null): "database" | "local" {
  return viewerId ? "database" : "local";
}

/** One merge accepts at most this many distinct comment ids. Further ids stay for the next merge. */
export const GUEST_COLLAPSE_MERGE_LIMIT = 100;

export async function listCollapsedCommentIds(
  db: PrismaClient,
  userId: string,
  postId?: string,
): Promise<string[]> {
  const rows = await db.commentCollapse.findMany({
    where: { userId, ...(postId ? { comment: { postId } } : {}) },
    select: { commentId: true },
    orderBy: { commentId: "asc" },
  });
  return rows.map((row) => row.commentId);
}

export async function persistCommentCollapsed(
  db: PrismaClient,
  userId: string,
  commentId: string,
  collapsed: boolean,
): Promise<"ok" | "missing"> {
  const comment = await db.comment.findUnique({ where: { id: commentId }, select: { id: true } });
  if (!comment) return "missing";
  if (collapsed) {
    await db.commentCollapse.upsert({
      where: { userId_commentId: { userId, commentId } },
      create: { userId, commentId },
      update: {},
    });
  } else {
    await db.commentCollapse.deleteMany({ where: { userId, commentId } });
  }
  return "ok";
}

export async function mergeGuestCollapses(
  db: PrismaClient,
  userId: string,
  commentIds: readonly unknown[],
  limit = GUEST_COLLAPSE_MERGE_LIMIT,
): Promise<{ merged: string[]; missing: string[]; skipped: string[] }> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of commentIds) {
    if (typeof item !== "string" || item.length === 0 || item.length > 80 || seen.has(item)) continue;
    seen.add(item);
    unique.push(item);
  }
  const batch = unique.slice(0, limit);
  const skipped = unique.slice(limit);
  if (batch.length === 0) return { merged: [], missing: [], skipped };
  const existing = await db.comment.findMany({
    where: { id: { in: batch } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((row) => row.id));
  const merged = batch.filter((id) => existingIds.has(id));
  const missing = batch.filter((id) => !existingIds.has(id));
  if (merged.length > 0) {
    await db.$transaction(
      merged.map((commentId) =>
        db.commentCollapse.upsert({
          where: { userId_commentId: { userId, commentId } },
          create: { userId, commentId },
          update: {},
        }),
      ),
    );
  }
  return { merged, missing, skipped };
}
