"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { decideFollow } from "@/lib/domain/social";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/lib/types";

export async function toggleFavorite(postId: string): Promise<ActionResult<{ favorited: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to favorite a story." };

  try {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) return { ok: false, error: "That post no longer exists." };

    const existing = await prisma.favorite.findUnique({
      where: { userId_postId: { userId: user.id, postId } },
    });
    if (existing) {
      await prisma.favorite.delete({ where: { userId_postId: { userId: user.id, postId } } });
    } else {
      await prisma.favorite.create({ data: { userId: user.id, postId } });
    }

    revalidatePath(`/item/${postId}`);
    revalidatePath(`/user/${user.username}`);
    revalidatePath("/");
    return { ok: true, data: { favorited: !existing } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not update the favorite. Please try again." };
  }
}

export async function toggleFollow(username: string): Promise<ActionResult<{ following: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to follow someone." };

  try {
    const target = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true },
    });
    if (!target) return { ok: false, error: "That user no longer exists." };

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: user.id, followingId: target.id } },
    });
    const decision = decideFollow(user.id, target.id, Boolean(existing));
    if (!decision.ok) return { ok: false, error: decision.error };

    if (existing) {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId: user.id, followingId: target.id } },
      });
    } else {
      await prisma.follow.create({ data: { followerId: user.id, followingId: target.id } });
    }

    revalidatePath(`/user/${target.username}`);
    revalidatePath(`/user/${user.username}`);
    revalidatePath("/following");
    return { ok: true, data: { following: decision.following } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not update the follow. Please try again." };
  }
}
