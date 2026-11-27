import type { PrismaClient } from "@prisma/client";

/** Logged-in collapse lives in the database. Logged-out collapse stays in sessionStorage. */
export function collapseStorage(viewerId: string | null): "database" | "session" {
  return viewerId ? "database" : "session";
}

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
