"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { guardRateLimit } from "@/lib/limits";
import { applyCommentVote, applyPostVote } from "@/lib/voting";
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

  const limited = await guardRateLimit("vote", user.id);
  if (!limited.ok) return { ok: false, error: limited.error };

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, author: { select: { username: true } } },
    });
    if (!post) return { ok: false, error: "That post no longer exists." };
    if (post.authorId === user.id) return { ok: false, error: "You can't vote on your own post." };

    const result = await applyPostVote(prisma, user.id, post.id);
    refreshPost(post.id, post.author.username);
    return { ok: true, data: result };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not record the vote. Please try again." };
  }
}

export async function voteComment(commentId: string): Promise<ActionResult<{ voted: boolean; points: number }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to vote." };

  const limited = await guardRateLimit("vote", user.id);
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

    const result = await applyCommentVote(prisma, user.id, comment.id);
    revalidatePath(`/item/${comment.postId}`);
    revalidatePath("/comments");
    revalidatePath(`/user/${comment.author.username}`);
    return { ok: true, data: result };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not record the vote. Please try again." };
  }
}
