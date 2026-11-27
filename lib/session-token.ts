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
};

/** Missing or non-integer `sv` counts as 0, which is the version of tokens issued before this claim existed. */
export function sessionVersionFromClaim(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function sessionVersionMatches(claims: SessionClaims, currentVersion: number): boolean {
  return claims.sessionVersion === currentVersion;
}

export async function signSession(userId: string, sessionVersion = 0): Promise<string> {
  return new SignJWT({ sv: sessionVersionFromClaim(sessionVersion) })
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
    return { userId: payload.sub, sessionVersion: sessionVersionFromClaim(payload.sv) };
  } catch {
    return null;
  }
}

export async function readSession(token: string): Promise<string | null> {
  const claims = await readSessionClaims(token);
  return claims?.userId ?? null;
}
