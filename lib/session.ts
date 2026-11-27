import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/config";
import { readSessionClaims, signSession, type SessionClaims } from "@/lib/session-token";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function setSession(userId: string, sessionVersion = 0): Promise<void> {
  const token = await signSession(userId, sessionVersion);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE_SECONDS));
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", cookieOptions(0));
}

export async function readSessionClaimsFromCookie(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionClaims(token);
}

export async function readSessionUserId(): Promise<string | null> {
  const claims = await readSessionClaimsFromCookie();
  return claims?.userId ?? null;
}
