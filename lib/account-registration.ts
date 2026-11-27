import { Prisma, type PrismaClient } from "@prisma/client";
import { issueEmailVerification } from "@/lib/email-verification-store";
import { MailDeliveryError, type Mailer } from "@/lib/mailer";

export const VERIFICATION_DELIVERY_FAILED_PATH = "/verify?delivery=failed";

export type RegistrationResult =
  | { ok: true; userId: string; mailed: boolean }
  | { ok: false; field: "username" | "email" | null; error: string };

/** Where to send the browser after the account row exists. Mail failure stays on the verification page. */
export function afterRegistrationPath(mailed: boolean, nextPath: string): string {
  return mailed ? nextPath : VERIFICATION_DELIVERY_FAILED_PATH;
}

/**
 * Create the account, then try to send the verification link.
 * A mail failure keeps the unverified account and its unused token so a later send can replace it.
 * A database failure is not reported as a mail failure.
 */
export async function registerUnverifiedAccount(
  db: PrismaClient,
  mailer: Mailer,
  input: { username: string; email: string; passwordHash: string },
  now = new Date(),
  baseUrl = "http://localhost:3000",
): Promise<RegistrationResult> {
  let user: { id: string; email: string; username: string };
  try {
    user = await db.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash: input.passwordHash,
        about: "",
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(" ") : String(error.meta?.target ?? "");
      if (target.toLowerCase().includes("email")) {
        return { ok: false, field: "email", error: "That email is already registered." };
      }
      return { ok: false, field: "username", error: "That username is taken." };
    }
    throw error;
  }

  try {
    await issueEmailVerification(db, mailer, user, now, baseUrl);
    return { ok: true, userId: user.id, mailed: true };
  } catch (error) {
    if (error instanceof MailDeliveryError) return { ok: true, userId: user.id, mailed: false };
    throw error;
  }
}
