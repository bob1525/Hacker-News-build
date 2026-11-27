"use server";

import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { createMailer } from "@/lib/mailer";
import { requestPasswordReset, resetPassword } from "@/lib/password-reset-store";
import type { FormState } from "@/lib/types";
import { emailSchema, formString, passwordSchema } from "@/lib/validators";

function appBaseUrl(): string {
  return process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
}

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formString(formData, "email"));
  if (!parsed.success) {
    return { error: "Enter a valid email.", fieldErrors: { email: "Enter a valid email." } };
  }
  try {
    const result = await requestPasswordReset(prisma, createMailer(), parsed.data, new Date(), appBaseUrl());
    if (!result.ok) return { error: result.error };
    return { notice: "If that account exists, a reset link was sent." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not send the reset email. Please try again." };
  }
}

export async function completePasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = formString(formData, "token").trim();
  if (token.length < 20 || token.length > 200) {
    return { error: "That reset link is not valid." };
  }
  const parsed = passwordSchema.safeParse(formString(formData, "password"));
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: { password: parsed.error.issues[0]?.message ?? "Invalid password." } };
  }
  try {
    const result = await resetPassword(prisma, token, parsed.data, new Date());
    if (!result.ok) return { error: result.error };
  } catch (error) {
    unstable_rethrow(error);
    return { error: "Could not reset the password. Please try again." };
  }
  redirect("/login?reset=1");
}
