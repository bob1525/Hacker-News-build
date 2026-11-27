"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { confirmEmailChange, requestEmailChange } from "@/lib/email-change-store";
import { createMailer } from "@/lib/mailer";
import type { FormState } from "@/lib/types";
import { emailSchema, formString } from "@/lib/validators";

function appBaseUrl(): string {
  return process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
}

export async function requestEmailChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to change your email." };
  const parsed = emailSchema.safeParse(formString(formData, "email"));
  if (!parsed.success) {
    return { error: "Enter a valid email.", fieldErrors: { email: parsed.error.issues[0]?.message ?? "Enter a valid email." } };
  }
  try {
    const result = await requestEmailChange(prisma, createMailer(), user.id, parsed.data, new Date(), appBaseUrl());
    if (!result.ok) return { error: result.error };
    return {
      notice: "Check the new inbox for a confirmation link. This address stays in place until you open it.",
    };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not send the confirmation email. Please try again." };
  }
}

export async function confirmEmailChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = formString(formData, "token").trim();
  if (token.length < 20 || token.length > 200) {
    return { error: "That confirmation link is not valid." };
  }
  let username = "";
  try {
    const result = await confirmEmailChange(prisma, createMailer(), token, new Date());
    if (!result.ok) return { error: result.error };
    username = result.username;
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not change the email. Please try again." };
  }
  redirect(`/user/${username}`);
}
