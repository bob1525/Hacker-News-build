import { createHash, randomBytes } from "node:crypto";
import { PASSWORD_RESET_TTL_MS } from "@/lib/config";
import { tokenAcceptance } from "@/lib/domain/email-verification";

export { tokenAcceptance };

export function hashPasswordResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newPasswordResetSecret(): { raw: string; tokenHash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, tokenHash: hashPasswordResetToken(raw) };
}

export function passwordResetExpiry(now = new Date()): Date {
  return new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
}

export function passwordResetLink(baseUrl: string, raw: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(raw)}`;
}
