import { createHash, randomBytes } from "node:crypto";
import { EMAIL_VERIFICATION_TTL_MS } from "@/lib/config";

export function hashVerificationToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newVerificationSecret(): { raw: string; tokenHash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, tokenHash: hashVerificationToken(raw) };
}

export function verificationExpiry(now = new Date()): Date {
  return new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS);
}

type VerificationEnv = { REQUIRE_EMAIL_VERIFICATION?: string };

/** Local and tests leave this unset. Production can set it to 1, true, or yes. */
export function verificationRequired(env: VerificationEnv | NodeJS.ProcessEnv = process.env): boolean {
  const value = (env.REQUIRE_EMAIL_VERIFICATION ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function emailVerificationBlock(
  user: { emailVerifiedAt: Date | null },
  env: VerificationEnv | NodeJS.ProcessEnv = process.env,
): string | null {
  if (!verificationRequired(env)) return null;
  if (user.emailVerifiedAt) return null;
  return "Verify your email before posting, commenting, or voting.";
}

export function tokenAcceptance(input: { expiresAt: Date; usedAt: Date | null; now: Date }): "ok" | "expired" | "used" {
  if (input.usedAt) return "used";
  if (input.expiresAt.getTime() <= input.now.getTime()) return "expired";
  return "ok";
}

export function verificationLink(baseUrl: string, raw: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/verify?token=${encodeURIComponent(raw)}`;
}
