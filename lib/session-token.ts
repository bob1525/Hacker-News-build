import { SignJWT, jwtVerify } from "jose";
import { assertAuthSecret } from "@/lib/auth-secret";

function secretKey(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  assertAuthSecret(value);
  return new TextEncoder().encode(value);
}

export type SessionClaims = {
  userId: string;
  sessionVersion: number;
  /** Null when the cookie was issued before device sessions existed. */
  sessionId: string | null;
};

/** Missing or non-integer `sv` counts as 0, which is the version of tokens issued before this claim existed. */
export function sessionVersionFromClaim(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function sessionVersionMatches(claims: SessionClaims, currentVersion: number): boolean {
  return claims.sessionVersion === currentVersion;
}

/** Missing or blank `sid` means a legacy cookie with no device row. */
export function sessionIdFromClaim(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
}

export async function signSession(userId: string, sessionVersion = 0, sessionId?: string | null): Promise<string> {
  const claims: { sv: number; sid?: string } = { sv: sessionVersionFromClaim(sessionVersion) };
  const sid = sessionIdFromClaim(sessionId);
  if (sid) claims.sid = sid;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function readSessionClaims(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
    return {
      userId: payload.sub,
      sessionVersion: sessionVersionFromClaim(payload.sv),
      sessionId: sessionIdFromClaim(payload.sid),
    };
  } catch {
    return null;
  }
}

export async function readSession(token: string): Promise<string | null> {
  const claims = await readSessionClaims(token);
  return claims?.userId ?? null;
}
