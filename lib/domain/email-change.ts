import { createHash, randomBytes } from "node:crypto";
import { EMAIL_CHANGE_TTL_MS } from "@/lib/config";
import { tokenAcceptance } from "@/lib/domain/email-verification";

export { tokenAcceptance };

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmailChangeToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newEmailChangeSecret(): { raw: string; tokenHash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, tokenHash: hashEmailChangeToken(raw) };
}

export function emailChangeExpiry(now = new Date()): Date {
  return new Date(now.getTime() + EMAIL_CHANGE_TTL_MS);
}

export function emailChangeLink(baseUrl: string, raw: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/change-email?token=${encodeURIComponent(raw)}`;
}
