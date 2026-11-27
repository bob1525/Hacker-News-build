import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deviceSessionDecision, simplifyUserAgent } from "@/lib/domain/session-device";
import { hashPassword } from "@/lib/password";
import { newPasswordResetSecret } from "@/lib/domain/password-reset";
import { resetPassword } from "@/lib/password-reset-store";
import { readSessionClaims, sessionVersionMatches, signSession } from "@/lib/session-token";
import { listSessions, openSession, revokeOneSession } from "@/lib/session-devices";
import { revokeOtherSessions } from "@/lib/session-management";
import { prepareTestDatabase } from "@/tests/helpers/database";

const secret = "unit-test-secret-key-not-for-production";

describe("device session labels", () => {
  it("stores a short browser label and a fallback for an empty agent", () => {
    expect(simplifyUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0")).toBe(
      "Chrome on Linux",
    );
    expect(simplifyUserAgent("")).toBe("Unknown device");
    expect(simplifyUserAgent("   ")).toBe("Unknown device");
  });
});

describe("one device can be revoked without touching the other", () => {
  let db: PrismaClient;
  const now = new Date("2026-11-27T18:10:00.000Z");

  beforeAll(() => {
    process.env.AUTH_SECRET = secret;
    const databaseUrl = prepareTestDatabase("sessionDevices");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("rejects a legacy cookie that has a matching version but no session id", async () => {
    const user = await db.user.create({
      data: { username: "legacy", email: "legacy@example.com", passwordHash: await hashPassword("password-1") },
    });
    const token = await signSession(user.id, 0);
    const claims = await readSessionClaims(token);
    expect(claims).toEqual({ userId: user.id, sessionVersion: 0, sessionId: null });
    expect(
      deviceSessionDecision({
        claimsSessionId: claims!.sessionId,
        claimsVersion: claims!.sessionVersion,
        userVersion: 0,
        userId: user.id,
        session: null,
      }),
    ).toEqual({ ok: false, reason: "legacy" });
  });

  it("revokes one session id and leaves the other session and the version in place", async () => {
    const user = await db.user.create({
      data: { username: "devices", email: "devices@example.com", passwordHash: await hashPassword("password-1") },
    });
    const phone = await openSession(db, user.id, "Mozilla/5.0 (iPhone) AppleWebKit Safari/17.0", now);
    const laptop = await openSession(
      db,
      user.id,
      "Mozilla/5.0 (Macintosh) AppleWebKit Chrome/120.0.0.0 Safari/537.36",
      now,
    );
    const phoneToken = await signSession(user.id, 0, phone.id);
    const laptopToken = await signSession(user.id, 0, laptop.id);
    const revoked = await revokeOneSession(db, user.id, phone.id, now);
    expect(revoked).toEqual({ ok: true });
    const still = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { sessionVersion: true } });
    expect(still.sessionVersion).toBe(0);

    const phoneClaims = await readSessionClaims(phoneToken);
    const laptopClaims = await readSessionClaims(laptopToken);
    const phoneRow = await db.session.findUniqueOrThrow({ where: { id: phone.id } });
    const laptopRow = await db.session.findUniqueOrThrow({ where: { id: laptop.id } });
    expect(
      deviceSessionDecision({
        claimsSessionId: phoneClaims!.sessionId,
        claimsVersion: phoneClaims!.sessionVersion,
        userVersion: still.sessionVersion,
        userId: user.id,
        session: phoneRow,
      }),
    ).toEqual({ ok: false, reason: "revoked" });
    expect(
      deviceSessionDecision({
        claimsSessionId: laptopClaims!.sessionId,
        claimsVersion: laptopClaims!.sessionVersion,
        userVersion: still.sessionVersion,
        userId: user.id,
        session: laptopRow,
      }),
    ).toEqual({ ok: true });
    expect(sessionVersionMatches(laptopClaims!, 0)).toBe(true);

    const listed = await listSessions(db, user.id, laptop.id);
    expect(listed.map((row) => row.id)).toEqual([laptop.id]);
    expect(listed[0]?.current).toBe(true);
    expect(listed[0]?.label).toBe("Chrome on macOS");
  });

  it("does nothing when the session id belongs to someone else", async () => {
    const owner = await db.user.create({
      data: { username: "owner", email: "owner@example.com", passwordHash: await hashPassword("password-1") },
    });
    const other = await db.user.create({
      data: { username: "other", email: "other@example.com", passwordHash: await hashPassword("password-1") },
    });
    const session = await openSession(db, owner.id, "Mozilla/5.0 Firefox/121.0", now);
    const result = await revokeOneSession(db, other.id, session.id, now);
    expect(result).toEqual({ ok: false, error: "That device is not signed in." });
    const row = await db.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.revokedAt).toBeNull();
  });

  it("still rejects a live session row when the cookie version is behind", async () => {
    const user = await db.user.create({
      data: {
        username: "behind",
        email: "behind@example.com",
        passwordHash: await hashPassword("password-1"),
        sessionVersion: 2,
      },
    });
    const session = await openSession(db, user.id, "Mozilla/5.0 Firefox/121.0", now);
    const token = await signSession(user.id, 1, session.id);
    const claims = await readSessionClaims(token);
    expect(
      deviceSessionDecision({
        claimsSessionId: claims!.sessionId,
        claimsVersion: claims!.sessionVersion,
        userVersion: 2,
        userId: user.id,
        session: { userId: user.id, revokedAt: null },
      }),
    ).toEqual({ ok: false, reason: "version" });
  });

  it("revokes every device row when signing out other devices, then a new row can be opened", async () => {
    const user = await db.user.create({
      data: { username: "bulk", email: "bulk@example.com", passwordHash: await hashPassword("password-1") },
    });
    const first = await openSession(db, user.id, "Mozilla/5.0 Firefox/121.0", now);
    const second = await openSession(db, user.id, "Mozilla/5.0 Chrome/120.0.0.0", now);
    const result = await revokeOtherSessions(db, user.id);
    expect(result).toEqual({ ok: true, sessionVersion: 1 });
    const rows = await db.session.findMany({ where: { userId: user.id } });
    expect(rows.every((row) => row.revokedAt)).toBe(true);
    expect(rows.map((row) => row.id).sort()).toEqual([first.id, second.id].sort());
    const replacement = await openSession(db, user.id, "Mozilla/5.0 Chrome/120.0.0.0", now);
    const listed = await listSessions(db, user.id, replacement.id);
    expect(listed.map((row) => row.id)).toEqual([replacement.id]);
  });

  it("revokes device rows on password reset and still increments the version", async () => {
    const user = await db.user.create({
      data: { username: "resetdev", email: "resetdev@example.com", passwordHash: await hashPassword("password-1") },
    });
    const session = await openSession(db, user.id, "Mozilla/5.0 Firefox/121.0", now);
    const secret = newPasswordResetSecret();
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: secret.tokenHash, expiresAt: new Date(now.getTime() + 60_000), createdAt: now },
    });
    const reset = await resetPassword(db, secret.raw, "password-2", now);
    expect(reset).toEqual({ ok: true });
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { sessionVersion: true } });
    expect(after.sessionVersion).toBe(1);
    const row = await db.session.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.revokedAt).toEqual(now);
  });
});
