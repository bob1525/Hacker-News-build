import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { EMAIL_VERIFICATION_TTL_MS, VERIFY_EMAIL_RATE_LIMIT } from "@/lib/config";
import {
  emailVerificationBlock,
  hashVerificationToken,
  newVerificationSecret,
  tokenAcceptance,
  verificationLink,
  verificationRequired,
} from "@/lib/domain/email-verification";
import { consumeEmailVerification, issueEmailVerification } from "@/lib/email-verification-store";
import { enforceRateLimit, useRateLimitStore } from "@/lib/limits";
import { clearRecordedMail, createMailer, recordedMail } from "@/lib/mailer";
import { MemoryRateLimitStore } from "@/lib/domain/rate-limit";
import { prepareTestDatabase } from "@/tests/helpers/database";

const now = new Date("2026-11-27T12:00:00.000Z");

describe("email verification rules", () => {
  it("stores a hash instead of the raw token", () => {
    const secret = newVerificationSecret();
    expect(secret.raw).not.toBe(secret.tokenHash);
    expect(secret.tokenHash).toBe(hashVerificationToken(secret.raw));
    expect(secret.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires verification only when the flag is explicitly on", () => {
    expect(verificationRequired({})).toBe(false);
    expect(verificationRequired({ REQUIRE_EMAIL_VERIFICATION: "0" })).toBe(false);
    expect(verificationRequired({ REQUIRE_EMAIL_VERIFICATION: "1" })).toBe(true);
    expect(verificationRequired({ REQUIRE_EMAIL_VERIFICATION: "true" })).toBe(true);
    expect(emailVerificationBlock({ emailVerifiedAt: null }, {})).toBeNull();
    expect(emailVerificationBlock({ emailVerifiedAt: null }, { REQUIRE_EMAIL_VERIFICATION: "1" })).toMatch(/Verify your email/);
    expect(emailVerificationBlock({ emailVerifiedAt: now }, { REQUIRE_EMAIL_VERIFICATION: "yes" })).toBeNull();
  });

  it("rejects expired and already used tokens", () => {
    expect(tokenAcceptance({ expiresAt: new Date(now.getTime() + 1_000), usedAt: null, now })).toBe("ok");
    expect(tokenAcceptance({ expiresAt: now, usedAt: null, now })).toBe("expired");
    expect(tokenAcceptance({ expiresAt: new Date(now.getTime() + 1_000), usedAt: now, now })).toBe("used");
  });

  it("builds a verify link and refuses an unknown mailer", () => {
    expect(verificationLink("http://localhost:3000/", "abc")).toBe("http://localhost:3000/verify?token=abc");
    expect(() => createMailer({ MAILER: "paid", NODE_ENV: "test" })).toThrow(/Unknown MAILER/);
  });

  it("rate limits verification resends without using the post budget", () => {
    useRateLimitStore(new MemoryRateLimitStore());
    for (let attempt = 0; attempt < VERIFY_EMAIL_RATE_LIMIT; attempt += 1) {
      expect(enforceRateLimit("verify", "ada", 1_000).ok).toBe(true);
    }
    expect(enforceRateLimit("verify", "ada", 1_000).ok).toBe(false);
    expect(enforceRateLimit("post", "ada", 1_000).ok).toBe(true);
    useRateLimitStore(null);
  });
});

describe("email verification persistence", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("email");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  afterEach(() => {
    clearRecordedMail();
  });

  async function user(username: string) {
    return db.user.create({
      data: { username, email: `${username}@example.com`, passwordHash: "x" },
    });
  }

  it("sends a console message and verifies the address once", async () => {
    const account = await user("ivy");
    const mailer = createMailer({ MAILER: "console", NODE_ENV: "test" });
    const issued = await issueEmailVerification(db, mailer, account, now, "http://localhost:3000");
    const mail = recordedMail().at(-1);
    expect(mail?.to).toBe(account.email);
    expect(mail?.text).toContain(verificationLink("http://localhost:3000", issued.raw));

    const stored = await db.emailVerificationToken.findFirstOrThrow({ where: { userId: account.id } });
    expect(stored.tokenHash).toBe(hashVerificationToken(issued.raw));
    expect(stored.tokenHash).not.toContain(issued.raw);
    expect(stored.expiresAt.getTime() - now.getTime()).toBe(EMAIL_VERIFICATION_TTL_MS);

    expect(await consumeEmailVerification(db, issued.raw, now)).toEqual({ ok: true, already: false });
    const verified = await db.user.findUniqueOrThrow({ where: { id: account.id } });
    expect(verified.emailVerifiedAt?.toISOString()).toBe(now.toISOString());
    expect(await consumeEmailVerification(db, issued.raw, new Date(now.getTime() + 1_000))).toEqual({
      ok: true,
      already: true,
    });
  });

  it("refuses an expired link and drops the previous link when a new one is issued", async () => {
    const account = await user("jo");
    const mailer = createMailer({ NODE_ENV: "test" });
    const first = await issueEmailVerification(db, mailer, account, now);
    await db.emailVerificationToken.update({
      where: { tokenHash: hashVerificationToken(first.raw) },
      data: { expiresAt: new Date(now.getTime() - 1_000) },
    });
    expect(await consumeEmailVerification(db, first.raw, now)).toEqual({
      ok: false,
      error: "That verification link has expired.",
    });

    const second = await issueEmailVerification(db, mailer, account, now);
    expect(await consumeEmailVerification(db, first.raw, now)).toEqual({
      ok: false,
      error: "That verification link is not valid.",
    });
    expect((await consumeEmailVerification(db, second.raw, now)).ok).toBe(true);
  });
});
