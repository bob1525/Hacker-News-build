"use server";

import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { consumeEmailVerification, issueEmailVerification } from "@/lib/email-verification-store";
import { prisma } from "@/lib/db";
import { guardRateLimit } from "@/lib/limits";
import { createMailer } from "@/lib/mailer";
import type { ActionResult } from "@/lib/types";

function appBaseUrl(): string {
  return process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
}

export async function verifyEmailToken(raw: string): Promise<ActionResult<{ already: boolean }>> {
  if (typeof raw !== "string" || raw.trim().length < 20 || raw.length > 200) {
    return { ok: false, error: "That verification link is not valid." };
  }
  try {
    const result = await consumeEmailVerification(prisma, raw);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, data: { already: result.already } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not verify that email. Please try again." };
  }
}

export async function resendVerificationEmail(): Promise<ActionResult<{ sent: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Log in to resend the verification email." };
  if (user.emailVerifiedAt) return { ok: true, data: { sent: false } };

  const limited = await guardRateLimit("verify", user.id);
  if (!limited.ok) return { ok: false, error: limited.error };

  try {
    await issueEmailVerification(prisma, createMailer(), user, new Date(), appBaseUrl());
    return { ok: true, data: { sent: true } };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, error: "Could not send the verification email. Please try again." };
  }
}
