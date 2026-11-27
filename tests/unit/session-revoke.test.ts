import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/password";
import { requestPasswordReset, resetPassword } from "@/lib/password-reset-store";
import { clearRecordedMail, createMailer, recordedMail } from "@/lib/mailer";
import {
  readSessionClaims,
  sessionVersionMatches,
  signSession,
} from "@/lib/session-token";
import { prepareTestDatabase } from "@/tests/helpers/database";

const secret = "unit-test-secret-key-not-for-production";

describe("session version claims", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = secret;
  });

  it("rejects a token whose version is behind the user", async () => {
    const before = await signSession("user_1", 0);
    const claims = await readSessionClaims(before);
    expect(claims).toEqual({ userId: "user_1", sessionVersion: 0 });
    expect(sessionVersionMatches(claims!, 0)).toBe(true);
    expect(sessionVersionMatches(claims!, 1)).toBe(false);
  });

  it("accepts a token signed at the current version and rejects a newer one", async () => {
    const current = await signSession("user_1", 2);
    const claims = await readSessionClaims(current);
    expect(claims?.sessionVersion).toBe(2);
    expect(sessionVersionMatches(claims!, 2)).toBe(true);
    expect(sessionVersionMatches(claims!, 3)).toBe(false);
    expect(await readSessionClaims("not-a-token")).toBeNull();
  });
});

describe("password reset revokes sessions", () => {
  let db: PrismaClient;
  const now = new Date("2026-11-27T14:00:00.000Z");

  beforeAll(() => {
    process.env.AUTH_SECRET = secret;
    const databaseUrl = prepareTestDatabase("sessionRevoke");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects the session that was signed before the reset", async () => {
    const { hashPassword } = await import("@/lib/password");
    const user = await db.user.create({
      data: { username: "revoke", email: "revoke@example.com", passwordHash: await hashPassword("old-password-1") },
    });
    const oldToken = await signSession(user.id, user.sessionVersion);
    const mailer = createMailer({ NODE_ENV: "test" });
    const sent = await requestPasswordReset(db, mailer, user.email, now, "http://localhost:3000");
    expect(sent).toEqual({ ok: true, sent: true });
    const raw = decodeURIComponent(recordedMail().at(-1)?.text.match(/token=([^\s]+)/)?.[1] ?? "");
    clearRecordedMail();
    expect(await resetPassword(db, raw, "new-password-1", now)).toEqual({ ok: true });

    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.sessionVersion).toBe(user.sessionVersion + 1);
    const claims = await readSessionClaims(oldToken);
    expect(claims?.userId).toBe(user.id);
    expect(sessionVersionMatches(claims!, updated.sessionVersion)).toBe(false);
  });

  it("accepts a fresh login after the reset and keeps the new password", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { username: "revoke" } });
    const fresh = await signSession(user.id, user.sessionVersion);
    const claims = await readSessionClaims(fresh);
    expect(sessionVersionMatches(claims!, user.sessionVersion)).toBe(true);
    expect(claims?.userId).toBe(user.id);
    expect(await verifyPassword("new-password-1", user.passwordHash)).toBe(true);
    expect(await verifyPassword("old-password-1", user.passwordHash)).toBe(false);
  });
});
