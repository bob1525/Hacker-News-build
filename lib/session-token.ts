import { SignJWT, jwtVerify } from "jose";
import { assertAuthSecret } from "@/lib/auth-secret";

function secretKey(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  assertAuthSecret(value);
  return new TextEncoder().encode(value);
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function readSession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
