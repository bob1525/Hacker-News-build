"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { safeNextPath } from "@/lib/domain/url";
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

  await setSession(user.id);
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

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        email: parsed.data.email,
        passwordHash,
        about: "",
      },
    });
    await setSession(user.id);
  } catch (error) {
    rethrowNext(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(" ") : String(error.meta?.target ?? "");
      if (target.toLowerCase().includes("email")) {
        return { error: "That email is already registered.", fieldErrors: { email: "Already registered." } };
      }
      return { error: "That username is taken.", fieldErrors: { username: "Already taken." } };
    }
    return { error: "Could not create the account. Please try again." };
  }

  redirect(safeNextPath(formString(formData, "next")));
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}
