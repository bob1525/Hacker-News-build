import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { afterRegistrationPath, registerUnverifiedAccount } from "@/lib/account-registration";
import { hashVerificationToken, verificationLink } from "@/lib/domain/email-verification";
import { consumeEmailVerification, issueEmailVerification } from "@/lib/email-verification-store";
import {
  clearRecordedMail,
  createMailer,
  MailDeliveryError,
  readSmtpConfig,
  recordedMail,
  smtpConnectionOptions,
  type SmtpMessage,
} from "@/lib/mailer";
import { prepareTestDatabase } from "@/tests/helpers/database";

const now = new Date("2026-11-27T12:40:00.000Z");
const smtpEnv = {
  MAILER: "smtp",
  SMTP_HOST: "smtp.example.com",
  SMTP_FROM: "news@example.com",
  NODE_ENV: "test",
};

describe("smtp mailer", () => {
  afterEach(() => {
    clearRecordedMail();
  });

  it("reads SMTP settings and rejects a missing host", () => {
    expect(readSmtpConfig({}).ok).toBe(false);
    const parsed = readSmtpConfig({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "news@example.com" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(smtpConnectionOptions(parsed.config)).toEqual({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: undefined,
    });
    const implicit = readSmtpConfig({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "news@example.com", SMTP_PORT: "465" });
    expect(implicit.ok && implicit.config.secure).toBe(true);
    const authed = readSmtpConfig({
      SMTP_HOST: "smtp.example.com",
      SMTP_FROM: "news@example.com",
      SMTP_USER: "news",
      SMTP_PASS: "secret",
    });
    expect(authed.ok && smtpConnectionOptions(authed.ok ? authed.config : parsed.config).auth).toEqual({
      user: "news",
      pass: "secret",
    });
    expect(readSmtpConfig({ SMTP_HOST: "smtp.example.com", SMTP_FROM: "news@example.com", SMTP_USER: "news" }).ok).toBe(
      false,
    );
    expect(() => createMailer({ MAILER: "smtp", NODE_ENV: "test" })).toThrow(/SMTP_HOST/);
    expect(() => createMailer({ MAILER: "", NODE_ENV: "test" })).not.toThrow();
  });

  it("delivers through an injected transport and does not echo the token", async () => {
    const sent: SmtpMessage[] = [];
    const token = "plaintext-token-must-not-leak";
    const mailer = createMailer(smtpEnv, {
      transport: {
        async send(message) {
          sent.push(message);
        },
      },
    });
    await mailer.send({ to: "ada@example.com", subject: "Verify your email", text: `link ${token}` });
    expect(sent).toEqual([
      { from: "news@example.com", to: "ada@example.com", subject: "Verify your email", text: `link ${token}` },
    ]);
    expect(recordedMail()).toEqual([]);

    const failing = createMailer(smtpEnv, {
      transport: {
        async send() {
          throw new Error(`smtp down ${token}`);
        },
      },
    });
    await expect(failing.send({ to: "ada@example.com", subject: "Verify your email", text: token })).rejects.toBeInstanceOf(
      MailDeliveryError,
    );
    try {
      await failing.send({ to: "ada@example.com", subject: "Verify your email", text: token });
    } catch (error) {
      expect(error).toBeInstanceOf(MailDeliveryError);
      expect(String(error)).not.toContain(token);
    }
  });
});

describe("registration when mail fails", () => {
  let db: PrismaClient;

  beforeAll(() => {
    const databaseUrl = prepareTestDatabase("emailDelivery");
    db = new PrismaClient({ datasourceUrl: databaseUrl });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  afterEach(() => {
    clearRecordedMail();
  });

  it("creates an unverified account and sends the verification link", async () => {
    const mailer = createMailer({ MAILER: "console", NODE_ENV: "test" });
    const result = await registerUnverifiedAccount(
      db,
      mailer,
      { username: "ada", email: "ada@example.com", passwordHash: "hash" },
      now,
      "http://localhost:3000",
    );
    expect(result).toEqual({ ok: true, userId: expect.any(String), mailed: true });
    if (!result.ok) return;
    expect(afterRegistrationPath(result.mailed, "/submit")).toBe("/submit");
    const user = await db.user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(user.emailVerifiedAt).toBeNull();
    const mail = recordedMail().at(-1);
    expect(mail?.to).toBe("ada@example.com");
    const link = mail?.text.match(/http:\/\/localhost:3000\/verify\?token=([^\s]+)/);
    expect(link?.[1]).toBeTruthy();
    const raw = decodeURIComponent(link?.[1] ?? "");
    const stored = await db.emailVerificationToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(hashVerificationToken(raw));
    expect(stored.tokenHash).not.toContain(raw);
    expect(mail?.text).toContain(verificationLink("http://localhost:3000", raw));
  });

  it("keeps the unverified account when sending fails and a retry link works", async () => {
    const failing = createMailer(smtpEnv, {
      transport: {
        async send() {
          throw new Error("connection reset");
        },
      },
    });
    const created = await registerUnverifiedAccount(
      db,
      failing,
      { username: "grace", email: "grace@example.com", passwordHash: "hash" },
      now,
      "http://localhost:3000",
    );
    expect(created).toMatchObject({ ok: true, mailed: false });
    if (!created.ok) return;
    expect(afterRegistrationPath(created.mailed, "/")).toBe("/verify?delivery=failed");
    const user = await db.user.findUniqueOrThrow({ where: { id: created.userId } });
    expect(user.emailVerifiedAt).toBeNull();
    expect(await db.emailVerificationToken.count({ where: { userId: user.id, usedAt: null } })).toBe(1);
    expect(recordedMail()).toEqual([]);

    const mailer = createMailer({ NODE_ENV: "test" });
    const retried = await issueEmailVerification(db, mailer, user, now, "http://localhost:3000");
    expect(await db.emailVerificationToken.count({ where: { userId: user.id, usedAt: null } })).toBe(1);
    expect(recordedMail().at(-1)?.text).toContain(verificationLink("http://localhost:3000", retried.raw));
    expect(await consumeEmailVerification(db, retried.raw, now)).toEqual({ ok: true, already: false });
    const verified = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(verified.emailVerifiedAt?.toISOString()).toBe(now.toISOString());
  });
});
