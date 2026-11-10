"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { FormState } from "@/lib/types";
import { fieldErrors, formString, postSchema } from "@/lib/validators";

function refreshFeeds() {
  revalidatePath("/");
  revalidatePath("/newest");
  revalidatePath("/ask");
  revalidatePath("/show");
  revalidatePath("/search");
}

export async function createPost(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to submit a post." };

  const parsed = postSchema.safeParse({
    title: formString(formData, "title"),
    url: formString(formData, "url"),
    text: formString(formData, "text"),
  });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  let postId = "";
  try {
    const post = await prisma.post.create({
      data: {
        title: parsed.data.title,
        url: parsed.data.url ? parsed.data.url : null,
        text: parsed.data.text,
        authorId: user.id,
      },
    });
    postId = post.id;
    refreshFeeds();
    revalidatePath(`/user/${user.username}`);
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not submit the post. Please try again." };
  }

  redirect(`/item/${postId}`);
}
