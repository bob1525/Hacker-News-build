"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { MAX_COMMENT_DEPTH } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/types";
import { commentSchema, fieldErrors, formString } from "@/lib/validators";

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
    revalidatePath(`/item/${post.id}`);
    revalidatePath("/comments");
    revalidatePath(`/user/${user.username}`);
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not post the comment. Please try again." };
  }

  redirect(`/item/${parsed.data.postId}`);
}
