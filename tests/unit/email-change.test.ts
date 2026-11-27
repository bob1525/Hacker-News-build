import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { EMAIL_CHANGE_RATE_LIMIT, EMAIL_CHANGE_TTL_MS } from "@/lib/config";
import {
  emailChangeExpiry,
  emailChangeLink,
  hashEmailChangeToken,
  newEmailChangeSecret,
} from "@/lib/domain/email-change";
import { confirmEmailChange, requestEmailChange } from "@/lib/email-change-store";
import { resetRateLimits } from "@/lib/limits";
import { clearRecordedMail, createMailer, recordedMail } from "@/lib/mailer";
import { prepareTestDatabase } from "@/tests/helpers/database";

const now = new Date("2026-11-27T15:00:00.000Z");

describe("email change rules", () => {
  it("stores a hash and builds a one-hour link", () => {
    const secret = newEmailChangeSecret();
    expect(secret.raw).not.toBe(secret.tokenHash);
    expect(secret.tokenHash).toBe(hashEmailChangeToken(secret.raw));
    expect(secret.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(emailChangeLink("http://localhost:3000/", secret.raw)).toBe(
      `http://localhost:3000/change-email?token=${encodeURIComponent(secret.raw)}`,
    );
    expect(emailChangeExpiry(now).getTime() - now.getTime()).toBe(EMAIL_CHANGE_TTL_MS);
  });
});

describe("email change persistence", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("emailChange");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  afterEach(() => {
    clearRecordedMail();
    resetRateLimits();
  });

  async function account(username: string, email = `${username}@example.com`) {
    return db.user.create({
      data: { username, email, passwordHash: "hash" },
    });
  }

  function rawFromMail(): string {
    const mail = recordedMail().at(-1);
    const match = mail?.text.match(/token=([^\s]+)/);
    expect(match?.[1]).toBeTruthy();
    return decodeURIComponent(match?.[1] ?? "");
  }

  it("keeps the old email until the confirmation link is used", async () => {
    const user = await account("mailmove");
    const mailer = createMailer({ NODE_ENV: "test" });
    const requested = await requestEmailChange(db, mailer, user.id, "Next@Example.com", now, "http://localhost:3000");
    expect(requested).toEqual({ ok: true, sent: true });
    expect(recordedMail().at(-1)?.to).toBe("next@example.com");

    const raw = rawFromMail();
    const stored = await db.emailChangeToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(hashEmailChangeToken(raw));
    expect(stored.tokenHash).not.toContain(raw);
    expect(stored.newEmail).toBe("next@example.com");
    const before = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(before.email).toBe("mailmove@example.com");
    expect(before.emailVerifiedAt).toBeNull();
    expect(before.sessionVersion).toBe(0);

    const confirmed = await confirmEmailChange(db, raw, now);
    expect(confirmed).toEqual({ ok: true, username: "mailmove" });
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.email).toBe("next@example.com");
    expect(after.emailVerifiedAt?.toISOString()).toBe(now.toISOString());
    expect(after.sessionVersion).toBe(0);
    expect(await db.user.findUnique({ where: { email: "mailmove@example.com" } })).toBeNull();
    expect(await confirmEmailChange(db, raw, now)).toEqual({
      ok: false,
      error: "That confirmation link was already used.",
    });
  });

  it("does not change the email when sending fails and a later link still works", async () => {
    const user = await account("mailfailchange");
    const token = "plaintext-email-change-token";
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
    const failed = await requestEmailChange(db, failing, user.id, "later@example.com", now);
    expect(failed).toEqual({ ok: false, error: "Could not send the confirmation email. Please try again." });
    expect(JSON.stringify(failed)).not.toContain(token);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("mailfailchange@example.com");
    expect(recordedMail()).toEqual([]);

    const mailer = createMailer({ NODE_ENV: "test" });
    expect(await requestEmailChange(db, mailer, user.id, "later@example.com", now)).toEqual({ ok: true, sent: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("mailfailchange@example.com");
    expect(await confirmEmailChange(db, rawFromMail(), now)).toEqual({ ok: true, username: "mailfailchange" });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("later@example.com");
  });

  it("does not change the email when the link is expired or the address was taken", async () => {
    const user = await account("expiredmail");
    const mailer = createMailer({ NODE_ENV: "test" });
    expect((await requestEmailChange(db, mailer, user.id, "fresh@example.com", now)).ok).toBe(true);
    const raw = rawFromMail();
    await db.emailChangeToken.update({
      where: { tokenHash: hashEmailChangeToken(raw) },
      data: { expiresAt: new Date(now.getTime() - 1_000) },
    });
    expect(await confirmEmailChange(db, raw, now)).toEqual({
      ok: false,
      error: "That confirmation link has expired.",
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("expiredmail@example.com");

    const other = await account("takenmail");
    expect((await requestEmailChange(db, mailer, other.id, "open@example.com", now)).ok).toBe(true);
    const pending = rawFromMail();
    await account("squatter", "open@example.com");
    expect(await confirmEmailChange(db, pending, now)).toEqual({
      ok: false,
      error: "That email is already in use.",
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: other.id } })).email).toBe("takenmail@example.com");
    const leftover = await db.emailChangeToken.findUniqueOrThrow({ where: { tokenHash: hashEmailChangeToken(pending) } });
    expect(leftover.usedAt).toBeNull();
  });

  it("rate limits change requests and rejects the current address", async () => {
    const user = await account("ratemail");
    const mailer = createMailer({ NODE_ENV: "test" });
    expect(await requestEmailChange(db, mailer, user.id, "ratemail@example.com", now)).toEqual({
      ok: false,
      error: "That is already your email.",
    });
    for (let attempt = 0; attempt < EMAIL_CHANGE_RATE_LIMIT; attempt += 1) {
      const result = await requestEmailChange(db, mailer, user.id, `slot${attempt}@example.com`, now);
      expect(result).toEqual({ ok: true, sent: true });
    }
    const blocked = await requestEmailChange(db, mailer, user.id, "one-more@example.com", now);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/Too many requests/);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("ratemail@example.com");
    expect(recordedMail()).toHaveLength(EMAIL_CHANGE_RATE_LIMIT);
  });
});
