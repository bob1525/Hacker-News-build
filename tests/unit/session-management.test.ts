import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/password";
import { confirmEmailChange, requestEmailChange } from "@/lib/email-change-store";
import { createMailer, recordedMail } from "@/lib/mailer";
import { readSessionClaims, sessionVersionMatches, signSession } from "@/lib/session-token";
import { currentBrowserKeepsSession, revokeOtherSessions } from "@/lib/session-management";
import { prepareTestDatabase } from "@/tests/helpers/database";

const secret = "unit-test-secret-key-not-for-production";

describe("sign out other devices", () => {
  let db: PrismaClient;
  const now = new Date("2026-11-27T17:50:00.000Z");

  beforeAll(() => {
    process.env.AUTH_SECRET = secret;
    const databaseUrl = prepareTestDatabase("sessionManage");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it("increments the version so the previous cookie dies and the current one can be re-signed", async () => {
    const user = await db.user.create({
      data: { username: "others", email: "others@example.com", passwordHash: await hashPassword("password-1") },
    });
    const previous = await signSession(user.id, user.sessionVersion);
    const result = await revokeOtherSessions(db, user.id);
    expect(result).toEqual({ ok: true, sessionVersion: 1 });
    if (!result.ok) return;
    const oldClaims = await readSessionClaims(previous);
    expect(oldClaims?.userId).toBe(user.id);
    expect(sessionVersionMatches(oldClaims!, 1)).toBe(false);
    const current = await signSession(user.id, result.sessionVersion);
    const currentClaims = await readSessionClaims(current);
    expect(sessionVersionMatches(currentClaims!, 1)).toBe(true);
    expect(currentClaims?.userId).toBe(user.id);
  });

  it("does not invent a session for a missing user", async () => {
    expect(await revokeOtherSessions(db, "missing-user")).toEqual({
      ok: false,
      error: "Log in to sign out other devices.",
    });
  });

  it("re-signs only the browser that is already the same user", () => {
    expect(currentBrowserKeepsSession("user_1", "user_1")).toBe(true);
    expect(currentBrowserKeepsSession(null, "user_1")).toBe(false);
    expect(currentBrowserKeepsSession(undefined, "user_1")).toBe(false);
    expect(currentBrowserKeepsSession("user_2", "user_1")).toBe(false);
    expect(currentBrowserKeepsSession("", "user_1")).toBe(false);
  });

  it("increments the version when an email change is confirmed", async () => {
    const user = await db.user.create({
      data: { username: "mailrevoke", email: "mailrevoke@example.com", passwordHash: await hashPassword("password-1") },
    });
    const previous = await signSession(user.id, 0);
    const mailer = createMailer({ NODE_ENV: "test" });
    expect(await requestEmailChange(db, mailer, user.id, "mailrevoke-next@example.com", now)).toEqual({
      ok: true,
      sent: true,
    });
    const raw = decodeURIComponent(
      recordedMail()
        .find((entry) => entry.to === "mailrevoke-next@example.com" && entry.subject === "Confirm your new email")
        ?.text.match(/token=([^\s]+)/)?.[1] ?? "",
    );
    const confirmed = await confirmEmailChange(db, mailer, raw, now);
    expect(confirmed).toEqual({ ok: true, username: "mailrevoke", userId: user.id, sessionVersion: 1 });
    const claims = await readSessionClaims(previous);
    expect(sessionVersionMatches(claims!, 1)).toBe(false);
    expect(currentBrowserKeepsSession(user.id, user.id)).toBe(true);
    expect(currentBrowserKeepsSession(null, user.id)).toBe(false);
  });
});
