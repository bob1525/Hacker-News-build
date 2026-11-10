"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { enforceRateLimit } from "@/lib/limits";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/types";

function refreshPost(postId: string, authorUsername: string) {
  revalidatePath("/");
  revalidatePath("/newest");
  revalidatePath("/ask");
  revalidatePath("/show");
  revalidatePath("/search");
  revalidatePath(`/item/${postId}`);
  revalidatePath(`/user/${authorUsername}`);
}

export async function votePost(postId: string): Promise<ActionResult<{ voted: boolean; points: number }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to vote." };

  const limited = enforceRateLimit("vote", user.id);
  if (!limited.ok) return { ok: false, error: limited.error };

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, author: { select: { username: true } } },
    });
    if (!post) return { ok: false, error: "That post no longer exists." };
    if (post.authorId === user.id) return { ok: false, error: "You can't vote on your own post." };

    const existing = await prisma.postVote.findUnique({
      where: { userId_postId: { userId: user.id, postId } },
    });

    if (existing) {
      await prisma.postVote.delete({ where: { userId_postId: { userId: user.id, postId } } });
    } else {
      await prisma.postVote.create({ data: { userId: user.id, postId } });
    }

    const points = await prisma.postVote.count({ where: { postId } });
    refreshPost(post.id, post.author.username);
    return { ok: true, data: { voted: !existing, points } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not record the vote. Please try again." };
  }
}

export async function voteComment(commentId: string): Promise<ActionResult<{ voted: boolean; points: number }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to vote." };

  const limited = enforceRateLimit("vote", user.id);
  if (!limited.ok) return { ok: false, error: limited.error };

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        authorId: true,
        deletedAt: true,
        author: { select: { username: true } },
      },
    });
    if (!comment) return { ok: false, error: "That comment no longer exists." };
    if (comment.deletedAt) return { ok: false, error: "You can't vote on a deleted comment." };
    if (comment.authorId === user.id) return { ok: false, error: "You can't vote on your own comment." };

    const existing = await prisma.commentVote.findUnique({
      where: { userId_commentId: { userId: user.id, commentId } },
    });

    if (existing) {
      await prisma.commentVote.delete({ where: { userId_commentId: { userId: user.id, commentId } } });
    } else {
      await prisma.commentVote.create({ data: { userId: user.id, commentId } });
    }

    const points = await prisma.commentVote.count({ where: { commentId } });
    revalidatePath(`/item/${comment.postId}`);
    revalidatePath("/comments");
    revalidatePath(`/user/${comment.author.username}`);
    return { ok: true, data: { voted: !existing, points } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not record the vote. Please try again." };
  }
}
