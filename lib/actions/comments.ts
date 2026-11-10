"use server";

import { unstable_rethrow } from "next/navigation";
import { COMMENT_DUPLICATE_WINDOW_MS, MAX_COMMENT_DEPTH } from "@/lib/config";
import { canDeleteComment, canEditComment } from "@/lib/domain/comment-moderation";
import { hasRecentDuplicate } from "@/lib/domain/duplicate";
import { enforceRateLimit } from "@/lib/limits";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult, FormState } from "@/lib/types";
import { commentSchema, editCommentSchema, fieldErrors, formString } from "@/lib/validators";

async function commentDepth(id: string): Promise<number> {
  let depth = 1;
  let current: string | null = id;
  const seen = new Set<string>();

  while (current) {
    if (seen.has(current)) return depth;
    seen.add(current);
    const row: { parentId: string | null } | null = await prisma.comment.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    if (!row?.parentId) break;
    current = row.parentId;
    depth += 1;
    if (depth > MAX_COMMENT_DEPTH + 2) break;
  }

  return depth;
}

export async function createComment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to comment." };

  const parsed = commentSchema.safeParse({
    postId: formString(formData, "postId"),
    parentId: formString(formData, "parentId"),
    text: formString(formData, "text"),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { error: errors.text ?? errors.postId ?? "Comment is invalid." };
  }

  const limited = enforceRateLimit("comment", user.id);
  if (!limited.ok) return { error: limited.error };

  const now = new Date();
  const recent = await prisma.comment.findMany({
    where: { authorId: user.id, createdAt: { gte: new Date(now.getTime() - COMMENT_DUPLICATE_WINDOW_MS) }, deletedAt: null },
    select: { text: true, createdAt: true },
  });
  if (hasRecentDuplicate(parsed.data.text, recent, now, COMMENT_DUPLICATE_WINDOW_MS)) {
    return { error: "You recently posted a very similar comment." };
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: parsed.data.postId },
      select: { id: true },
    });
    if (!post) return { error: "That post no longer exists." };

    const parentId = parsed.data.parentId?.trim() || null;
    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, postId: true },
      });
      if (!parent || parent.postId !== post.id) {
        return { error: "The comment you are replying to is not on this post." };
      }
      const depth = await commentDepth(parent.id);
      if (depth >= MAX_COMMENT_DEPTH) {
        return { error: `Replies only nest ${MAX_COMMENT_DEPTH} levels deep.` };
      }
    }

    await prisma.comment.create({
      data: {
        text: parsed.data.text,
        postId: post.id,
        authorId: user.id,
        parentId,
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not post the comment. Please try again." };
  }

  return { refresh: true };
}

export async function updateComment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to edit a comment." };

  const parsed = editCommentSchema.safeParse({
    commentId: formString(formData, "commentId"),
    text: formString(formData, "text"),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return { error: errors.text ?? errors.commentId ?? "Comment is invalid." };
  }

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: parsed.data.commentId },
      select: { id: true, authorId: true, createdAt: true, deletedAt: true },
    });
    if (!comment) return { error: "That comment no longer exists." };
    if (
      !canEditComment({
        authorId: comment.authorId,
        viewerId: user.id,
        createdAt: comment.createdAt,
        deletedAt: comment.deletedAt,
      })
    ) {
      return { error: "You can edit your own comment for 15 minutes after posting." };
    }

    await prisma.comment.update({
      where: { id: comment.id },
      data: { text: parsed.data.text, editedAt: new Date() },
    });
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not edit the comment. Please try again." };
  }

  return { refresh: true };
}

export async function deleteComment(commentId: string): Promise<ActionResult<{ deleted: true }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to delete a comment." };

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, deletedAt: true },
    });
    if (!comment) return { ok: false, error: "That comment no longer exists." };
    if (!canDeleteComment({ authorId: comment.authorId, viewerId: user.id, deletedAt: comment.deletedAt })) {
      return { ok: false, error: "You can only delete your own comment." };
    }

    await prisma.comment.update({
      where: { id: comment.id },
      data: { deletedAt: new Date() },
    });
    return { ok: true, data: { deleted: true } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not delete the comment. Please try again." };
  }
}
