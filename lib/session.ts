import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/config";
import { prisma } from "@/lib/db";
import { openSession } from "@/lib/session-devices";
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

export async function requestUserAgent(): Promise<string> {
  const incoming = await headers();
  return incoming.get("user-agent") ?? "";
}

export async function setSession(userId: string, sessionVersion = 0, userAgent = ""): Promise<void> {
  const opened = await openSession(prisma, userId, userAgent);
  const token = await signSession(userId, sessionVersion, opened.id);
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
