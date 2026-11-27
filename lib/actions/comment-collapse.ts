"use server";

import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { mergeGuestCollapses, persistCommentCollapsed } from "@/lib/comment-collapse";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/types";

export async function setCommentCollapsed(
  commentId: string,
  collapsed: boolean,
): Promise<ActionResult<{ collapsed: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to save a collapsed comment." };
  if (typeof commentId !== "string" || commentId.length === 0 || commentId.length > 80 || typeof collapsed !== "boolean") {
    return { ok: false, error: "That comment no longer exists." };
  }

  try {
    const result = await persistCommentCollapsed(prisma, user.id, commentId, collapsed);
    if (result === "missing") return { ok: false, error: "That comment no longer exists." };
    return { ok: true, data: { collapsed } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not save the collapsed comment. Please try again." };
  }
}

export async function mergeGuestCollapsesAction(
  commentIds: unknown,
): Promise<ActionResult<{ merged: string[]; missing: string[]; skipped: string[] }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to save collapsed comments." };
  if (!Array.isArray(commentIds)) return { ok: false, error: "Could not save collapsed comments." };
  try {
    const result = await mergeGuestCollapses(prisma, user.id, commentIds);
    return { ok: true, data: result };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not save collapsed comments. Please try again." };
  }
}
