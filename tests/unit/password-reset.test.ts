import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { PASSWORD_RESET_RATE_LIMIT, PASSWORD_RESET_TTL_MS } from "@/lib/config";
import {
  hashPasswordResetToken,
  newPasswordResetSecret,
  passwordResetExpiry,
  passwordResetLink,
  tokenAcceptance,
} from "@/lib/domain/password-reset";
import { enforceRateLimit, resetRateLimits } from "@/lib/limits";
import { clearRecordedMail, createMailer, recordedMail } from "@/lib/mailer";
import { verifyPassword } from "@/lib/password";
import { requestPasswordReset, resetPassword } from "@/lib/password-reset-store";
import { prepareTestDatabase } from "@/tests/helpers/database";

const now = new Date("2026-11-27T13:00:00.000Z");

describe("password reset rules", () => {
  it("stores a hash and builds a one-hour link", () => {
    const secret = newPasswordResetSecret();
    expect(secret.raw).not.toBe(secret.tokenHash);
    expect(secret.tokenHash).toBe(hashPasswordResetToken(secret.raw));
    expect(secret.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(passwordResetLink("http://localhost:3000/", secret.raw)).toBe(
      `http://localhost:3000/reset-password?token=${encodeURIComponent(secret.raw)}`,
    );
    expect(passwordResetExpiry(now).getTime() - now.getTime()).toBe(PASSWORD_RESET_TTL_MS);
    expect(tokenAcceptance({ expiresAt: now, usedAt: null, now })).toBe("expired");
  });
});

describe("password reset persistence", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("passwordReset");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  afterEach(() => {
    clearRecordedMail();
    resetRateLimits();
  });

  async function account(username: string, password: string) {
    const { hashPassword } = await import("@/lib/password");
    return db.user.create({
      data: { username, email: `${username}@example.com`, passwordHash: await hashPassword(password) },
    });
  }

  function rawFromMail(): string {
    const mail = recordedMail().at(-1);
    const match = mail?.text.match(/token=([^\s]+)/);
    expect(match?.[1]).toBeTruthy();
    return decodeURIComponent(match?.[1] ?? "");
  }

  it("replaces the password so the old one no longer works", async () => {
    const user = await account("adareset", "old-password-1");
    const mailer = createMailer({ NODE_ENV: "test" });
    const first = await requestPasswordReset(db, mailer, "AdaReset@Example.com", now, "http://localhost:3000");
    expect(first).toEqual({ ok: true, sent: true });
    const firstRaw = rawFromMail();
    const stored = await db.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(hashPasswordResetToken(firstRaw));
    expect(stored.tokenHash).not.toContain(firstRaw);

    const second = await requestPasswordReset(db, mailer, "adareset@example.com", now, "http://localhost:3000");
    expect(second).toEqual({ ok: true, sent: true });
    const secondRaw = rawFromMail();
    expect(await resetPassword(db, firstRaw, "other-password", now)).toEqual({
      ok: false,
      error: "That reset link is not valid.",
    });
    expect(await resetPassword(db, secondRaw, "new-password-1", now)).toEqual({ ok: true });
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("old-password-1", updated.passwordHash)).toBe(false);
    expect(await verifyPassword("new-password-1", updated.passwordHash)).toBe(true);
    expect(await resetPassword(db, secondRaw, "another-password", now)).toEqual({
      ok: false,
      error: "That reset link was already used.",
    });
    expect(user.emailVerifiedAt).toBeNull();
  });

  it("does not change the password when the link is expired", async () => {
    const user = await account("expiredreset", "keep-password");
    const mailer = createMailer({ NODE_ENV: "test" });
    expect((await requestPasswordReset(db, mailer, user.email, now)).ok).toBe(true);
    const raw = rawFromMail();
    await db.passwordResetToken.update({
      where: { tokenHash: hashPasswordResetToken(raw) },
      data: { expiresAt: new Date(now.getTime() - 1_000) },
    });
    expect(await resetPassword(db, raw, "changed-password", now)).toEqual({
      ok: false,
      error: "That reset link has expired.",
    });
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("keep-password", stored.passwordHash)).toBe(true);
  });

  it("rate limits reset requests and stays quiet for an unknown email", async () => {
    const mailer = createMailer({ NODE_ENV: "test" });
    for (let attempt = 0; attempt < PASSWORD_RESET_RATE_LIMIT; attempt += 1) {
      const result = await requestPasswordReset(db, mailer, "missing@example.com", now);
      expect(result).toEqual({ ok: true, sent: false });
    }
    expect(recordedMail()).toEqual([]);
    const blocked = await requestPasswordReset(db, mailer, "missing@example.com", now);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Too many requests/);
    expect(enforceRateLimit("post", "missing@example.com", now.getTime()).ok).toBe(true);
  });

  it("keeps the old password when sending fails and does not expose the token", async () => {
    const user = await account("mailfail", "still-password");
    const token = "plaintext-reset-token";
    const failing = createMailer(
      { MAILER: "smtp", SMTP_HOST: "smtp.example.com", SMTP_FROM: "news@example.com", NODE_ENV: "test" },
      {
        transport: {
          async send() {
            throw new Error(`smtp down ${token}`);
          },
        },
      },
    );
    const result = await requestPasswordReset(db, failing, user.email, now);
    expect(result).toEqual({ ok: false, error: "Could not send the reset email. Please try again." });
    expect(JSON.stringify(result)).not.toContain(token);
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword("still-password", stored.passwordHash)).toBe(true);
    expect(recordedMail()).toEqual([]);
  });
});
