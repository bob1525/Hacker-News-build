import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/config";
import {
  LAST_SEEN_THROTTLE_MS,
  REAUTH_MESSAGE,
  SESSION_MAX_AGE_MS,
  deviceSessionDecision,
  isSessionExpired,
  reauthMessageForClaims,
  sessionExpiresAt,
  shouldTouchLastSeen,
} from "@/lib/domain/session-device";
import { hashPassword } from "@/lib/password";
import { countStaleSessions, deleteStaleSessions, listSessions, openSession, revokeOneSession, touchLastSeen } from "@/lib/session-devices";
import { readSessionClaims, signSession } from "@/lib/session-token";
import { prepareTestDatabase } from "@/tests/helpers/database";

const secret = "unit-test-secret-key-not-for-production";

describe("session lifetime matches the JWT", () => {
  it("expires a device row at the same offset the token uses", async () => {
    process.env.AUTH_SECRET = secret;
    const issued = new Date("2026-11-27T18:00:00.000Z");
    const token = await signSession("user-1", 0, "session-1");
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as {
      iat: number;
      exp: number;
    };
    expect(payload.exp - payload.iat).toBe(SESSION_MAX_AGE_SECONDS);
    expect(sessionExpiresAt(issued).getTime() - issued.getTime()).toBe(SESSION_MAX_AGE_MS);
    expect(isSessionExpired(issued, new Date(issued.getTime() + SESSION_MAX_AGE_MS - 1))).toBe(false);
    expect(isSessionExpired(issued, new Date(issued.getTime() + SESSION_MAX_AGE_MS))).toBe(true);
  });

  it("rejects an expired row and still rejects a revoked row before checking age", () => {
    const now = new Date("2026-11-27T18:00:00.000Z");
    const fresh = new Date(now.getTime() - SESSION_MAX_AGE_MS + 1);
    const expired = new Date(now.getTime() - SESSION_MAX_AGE_MS);
    expect(
      deviceSessionDecision({
        claimsSessionId: "sid",
        claimsVersion: 0,
        userVersion: 0,
        userId: "user-1",
        session: { userId: "user-1", revokedAt: null, createdAt: fresh },
        now,
      }),
    ).toEqual({ ok: true });
    expect(
      deviceSessionDecision({
        claimsSessionId: "sid",
        claimsVersion: 0,
        userVersion: 0,
        userId: "user-1",
        session: { userId: "user-1", revokedAt: null, createdAt: expired },
        now,
      }),
    ).toEqual({ ok: false, reason: "expired" });
    expect(
      deviceSessionDecision({
        claimsSessionId: "sid",
        claimsVersion: 0,
        userVersion: 0,
        userId: "user-1",
        session: { userId: "user-1", revokedAt: now, createdAt: expired },
        now,
      }),
    ).toEqual({ ok: false, reason: "revoked" });
  });
});

describe("lastSeenAt throttle", () => {
  const seen = new Date("2026-11-27T18:00:00.000Z");

  it("skips a write at exactly one minute and allows the next millisecond", () => {
    expect(LAST_SEEN_THROTTLE_MS).toBe(60_000);
    expect(shouldTouchLastSeen(seen, new Date(seen.getTime() + LAST_SEEN_THROTTLE_MS - 1))).toBe(false);
    expect(shouldTouchLastSeen(seen, new Date(seen.getTime() + LAST_SEEN_THROTTLE_MS))).toBe(false);
    expect(shouldTouchLastSeen(seen, new Date(seen.getTime() + LAST_SEEN_THROTTLE_MS + 1))).toBe(true);
  });
});

describe("legacy cookie reauth copy", () => {
  it("asks for a new login only when the cookie has no session id", () => {
    expect(reauthMessageForClaims(null)).toBeNull();
    expect(reauthMessageForClaims({ sessionId: "sid" })).toBeNull();
    expect(reauthMessageForClaims({ sessionId: null })).toBe(REAUTH_MESSAGE);
    expect(REAUTH_MESSAGE).toBe("Please sign in again.");
  });
});

describe("session housekeeping store", () => {
  let db: PrismaClient;
  let databaseUrl = "";
  const now = new Date("2026-11-27T18:00:00.000Z");

  beforeAll(async () => {
    process.env.AUTH_SECRET = secret;
    databaseUrl = prepareTestDatabase("sessionHousekeeping");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("hides expired rows, marks the current device, and drops stale rows as it lists", async () => {
    const user = await db.user.create({
      data: { username: "house", email: "house@example.com", passwordHash: await hashPassword("password-1") },
    });
    const current = await openSession(db, user.id, "Mozilla/5.0 (X11; Linux) Chrome/120.0.0.0", now);
    const expired = await openSession(db, user.id, "Mozilla/5.0 Firefox/121.0", now);
    await db.session.update({
      where: { id: expired.id },
      data: { createdAt: new Date(now.getTime() - SESSION_MAX_AGE_MS) },
    });
    const listed = await listSessions(db, user.id, current.id, now);
    expect(listed.map((row) => row.id)).toEqual([current.id]);
    expect(listed[0]?.current).toBe(true);
    expect(listed[0]?.label).toBe("Chrome on Linux");
    expect(await db.session.findUnique({ where: { id: expired.id } })).toBeNull();
    const claims = await readSessionClaims(await signSession(user.id, 0, current.id));
    expect(claims?.sessionId).toBe(current.id);
  });

  it("writes lastSeenAt only after the throttle window", async () => {
    const user = await db.user.create({
      data: { username: "seen", email: "seen@example.com", passwordHash: await hashPassword("password-1") },
    });
    const opened = await openSession(db, user.id, "Mozilla/5.0 Firefox/121.0", now);
    const atMinute = new Date(now.getTime() + LAST_SEEN_THROTTLE_MS);
    expect(await touchLastSeen(db, opened.id, now, atMinute)).toBe(false);
    expect((await db.session.findUniqueOrThrow({ where: { id: opened.id } })).lastSeenAt).toEqual(now);
    const after = new Date(now.getTime() + LAST_SEEN_THROTTLE_MS + 1);
    expect(await touchLastSeen(db, opened.id, now, after)).toBe(true);
    expect((await db.session.findUniqueOrThrow({ where: { id: opened.id } })).lastSeenAt).toEqual(after);
    expect(await touchLastSeen(db, opened.id, after, new Date(after.getTime() + 1_000))).toBe(false);
  });

  it("deletes only revoked or expired rows and the script is a no-op the second time", async () => {
    const user = await db.user.create({
      data: { username: "sweep", email: "sweep@example.com", passwordHash: await hashPassword("password-1") },
    });
    const live = await openSession(db, user.id, "Mozilla/5.0 Chrome/120.0.0.0", now);
    const revoked = await openSession(db, user.id, "Mozilla/5.0 Firefox/121.0", now);
    expect(await revokeOneSession(db, user.id, revoked.id, now)).toEqual({ ok: true });
    const expired = await openSession(db, user.id, "Mozilla/5.0 Safari/17.0", now);
    await db.session.update({
      where: { id: expired.id },
      data: { createdAt: new Date(now.getTime() - SESSION_MAX_AGE_MS) },
    });
    const removed = await deleteStaleSessions(db, now, { userId: user.id });
    expect(removed).toBe(2);
    expect(await deleteStaleSessions(db, now, { userId: user.id })).toBe(0);
    expect(await db.session.findUnique({ where: { id: live.id } })).not.toBeNull();
    expect(await countStaleSessions(db, now, user.id)).toBe(0);

    const wall = new Date();
    const extra = await openSession(db, user.id, "Mozilla/5.0 Firefox/121.0", wall);
    expect(await revokeOneSession(db, user.id, extra.id, wall)).toEqual({ ok: true });
    const pending = await countStaleSessions(db, wall);
    expect(pending).toBeGreaterThanOrEqual(1);
    const output = execFileSync("npm", ["run", "sessions:cleanup"], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: "utf8",
    });
    expect(output).toContain(`sessions: removed ${pending}, removed 0`);
    expect(await countStaleSessions(db, wall)).toBe(0);
    expect(await db.session.findUnique({ where: { id: live.id } })).not.toBeNull();
    expect(await db.session.findUnique({ where: { id: extra.id } })).toBeNull();
  });
});
