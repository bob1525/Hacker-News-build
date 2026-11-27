"use server";

import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/navigation";
import { afterRegistrationPath, registerUnverifiedAccount } from "@/lib/account-registration";
import { prisma } from "@/lib/db";
import { safeNextPath } from "@/lib/domain/url";
import { createMailer } from "@/lib/mailer";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clearSession, setSession } from "@/lib/session";
import type { FormState } from "@/lib/types";
import { fieldErrors, formString, loginSchema, registerSchema } from "@/lib/validators";

function rethrowNext(error: unknown): void {
  unstable_rethrow(error);
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    username: formString(formData, "username"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return { error: "Enter your username and password.", fieldErrors: fieldErrors(parsed.error) };
  }

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) {
    return { error: "Invalid username or password." };
  }

  await setSession(user.id, user.sessionVersion);
  redirect(safeNextPath(formString(formData, "next")));
}

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    username: formString(formData, "username"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  let nextPath = safeNextPath(formString(formData, "next"));
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const baseUrl = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
    const result = await registerUnverifiedAccount(
      prisma,
      createMailer(),
      { username: parsed.data.username, email: parsed.data.email, passwordHash },
      new Date(),
      baseUrl,
    );
    if (!result.ok) {
      if (result.field === "email") {
        return { error: result.error, fieldErrors: { email: "Already registered." } };
      }
      if (result.field === "username") {
        return { error: result.error, fieldErrors: { username: "Already taken." } };
      }
      return { error: result.error };
    }
    await setSession(result.userId);
    nextPath = afterRegistrationPath(result.mailed, nextPath);
  } catch (error) {
    rethrowNext(error);
    return { error: "Could not create the account. Please try again." };
  }

  redirect(nextPath);
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}
