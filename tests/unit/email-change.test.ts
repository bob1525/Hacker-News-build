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

  function confirmationMail() {
    const mail = [...recordedMail()].reverse().find((entry) => entry.subject === "Confirm your new email");
    expect(mail).toBeTruthy();
    return mail!;
  }

  function rawFromMail(): string {
    const match = confirmationMail().text.match(/token=([^\s]+)/);
    expect(match?.[1]).toBeTruthy();
    return decodeURIComponent(match?.[1] ?? "");
  }

  it("keeps the old email until the confirmation link is used", async () => {
    const user = await account("mailmove");
    const mailer = createMailer({ NODE_ENV: "test" });
    const requested = await requestEmailChange(db, mailer, user.id, "Next@Example.com", now, "http://localhost:3000");
    expect(requested).toEqual({ ok: true, sent: true });
    expect(confirmationMail().to).toBe("next@example.com");
    const requestedNotice = recordedMail().find((entry) => entry.subject === "Email change requested");
    expect(requestedNotice?.to).toBe("mailmove@example.com");
    expect(requestedNotice?.text ?? "").not.toMatch(/token=/);
    expect(requestedNotice?.text ?? "").not.toContain("/change-email");

    const raw = rawFromMail();
    const stored = await db.emailChangeToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(hashEmailChangeToken(raw));
    expect(stored.tokenHash).not.toContain(raw);
    expect(stored.newEmail).toBe("next@example.com");
    const before = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(before.email).toBe("mailmove@example.com");
    expect(before.emailVerifiedAt).toBeNull();
    expect(before.sessionVersion).toBe(0);

    const confirmed = await confirmEmailChange(db, mailer, raw, now);
    expect(confirmed).toEqual({ ok: true, username: "mailmove", userId: user.id, sessionVersion: 1 });
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.email).toBe("next@example.com");
    expect(after.emailVerifiedAt?.toISOString()).toBe(now.toISOString());
    expect(after.sessionVersion).toBe(1);
    expect(await db.user.findUnique({ where: { email: "mailmove@example.com" } })).toBeNull();
    const changedNotice = recordedMail().find((entry) => entry.subject === "Your email was changed");
    expect(changedNotice?.to).toBe("mailmove@example.com");
    expect(changedNotice?.text ?? "").not.toMatch(/token=/);
    expect(changedNotice?.text ?? "").not.toContain("/change-email");
    expect(await confirmEmailChange(db, mailer, raw, now)).toEqual({
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
    expect(await confirmEmailChange(db, mailer, rawFromMail(), now)).toEqual({
      ok: true,
      username: "mailfailchange",
      userId: user.id,
      sessionVersion: 1,
    });
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
    expect(await confirmEmailChange(db, mailer, raw, now)).toEqual({
      ok: false,
      error: "That confirmation link has expired.",
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("expiredmail@example.com");

    const other = await account("takenmail");
    expect((await requestEmailChange(db, mailer, other.id, "open@example.com", now)).ok).toBe(true);
    const pending = rawFromMail();
    await account("squatter", "open@example.com");
    expect(await confirmEmailChange(db, mailer, pending, now)).toEqual({
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
    expect(recordedMail().filter((entry) => entry.subject === "Confirm your new email")).toHaveLength(EMAIL_CHANGE_RATE_LIMIT);
    expect(recordedMail().filter((entry) => entry.subject === "Email change requested")).toHaveLength(EMAIL_CHANGE_RATE_LIMIT);
  });

  it("drops the token hash when the confirmation email cannot be sent", async () => {
    const user = await account("dropmail");
    const failing = createMailer(
      { MAILER: "smtp", SMTP_HOST: "smtp.example.com", SMTP_FROM: "news@example.com", NODE_ENV: "test" },
      { transport: { async send() { throw new Error("smtp down"); } } },
    );
    expect(await requestEmailChange(db, failing, user.id, "drop-next@example.com", now)).toEqual({
      ok: false,
      error: "Could not send the confirmation email. Please try again.",
    });
    expect(await db.emailChangeToken.count({ where: { userId: user.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("dropmail@example.com");
  });

  it("keeps the change when the old-address notice cannot be sent", async () => {
    const user = await account("noticemail");
    const { MailDeliveryError } = await import("@/lib/mailer");
    const sent: string[] = [];
    const requesting = {
      async send(mail: { to: string; subject: string; text: string }) {
        if (mail.subject !== "Confirm your new email") throw new MailDeliveryError();
        sent.push(mail.text);
      },
    };
    expect(await requestEmailChange(db, requesting, user.id, "notice-next@example.com", now)).toEqual({
      ok: true,
      sent: true,
    });
    expect(await db.emailChangeToken.count({ where: { userId: user.id } })).toBe(1);
    const raw = decodeURIComponent(sent[0]?.match(/token=([^\s]+)/)?.[1] ?? "");
    expect(raw.length).toBeGreaterThan(20);

    const confirming = {
      async send() {
        throw new MailDeliveryError();
      },
    };
    expect(await confirmEmailChange(db, confirming, raw, now)).toEqual({
      ok: true,
      username: "noticemail",
      userId: user.id,
      sessionVersion: 1,
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe("notice-next@example.com");
  });
});
