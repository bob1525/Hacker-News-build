import { Prisma, type PrismaClient } from "@prisma/client";
import {
  emailChangeExpiry,
  emailChangeLink,
  hashEmailChangeToken,
  newEmailChangeSecret,
  normalizeAccountEmail,
  tokenAcceptance,
} from "@/lib/domain/email-change";
import { guardRateLimit } from "@/lib/limits";
import { MailDeliveryError, type Mailer } from "@/lib/mailer";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;
const CONFIRM_SUBJECT = "Confirm your new email";
const REQUEST_NOTICE_SUBJECT = "Email change requested";
const CHANGED_NOTICE_SUBJECT = "Your email was changed";

function assertNoticeHasNoLink(text: string): void {
  if (/token=|\/change-email/i.test(text)) {
    throw new Error("Email-change notices must not include a confirmation link.");
  }
}

/** A notice to the old address is best-effort. A delivery failure does not undo the change. */
async function sendOldAddressNotice(mailer: Mailer, mail: { to: string; subject: string; text: string }): Promise<void> {
  assertNoticeHasNoLink(mail.text);
  try {
    await mailer.send(mail);
  } catch (error) {
    if (error instanceof MailDeliveryError) return;
    throw error;
  }
}

class EmailAlreadyUsed extends Error {
  constructor() {
    super("That email is already in use.");
    this.name = "EmailAlreadyUsed";
  }
}

export async function requestEmailChange(
  db: PrismaClient,
  mailer: Mailer,
  userId: string,
  email: string,
  now = new Date(),
  baseUrl = "http://localhost:3000",
): Promise<{ ok: true; sent: boolean } | { ok: false; error: string }> {
  const normalized = normalizeAccountEmail(email);
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 120) {
    return { ok: false, error: "Enter a valid email." };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true },
  });
  if (!user) return { ok: false, error: "Log in to change your email." };
  if (normalized === user.email.trim().toLowerCase()) {
    return { ok: false, error: "That is already your email." };
  }

  const limited = await guardRateLimit("emailChange", userId, now.getTime());
  if (!limited.ok) return { ok: false, error: limited.error };

  const owner = await db.user.findUnique({ where: { email: normalized }, select: { id: true } });
  if (owner) return { ok: false, error: "That email is already in use." };

  const secret = newEmailChangeSecret();
  await db.emailChangeToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await db.emailChangeToken.create({
    data: {
      userId: user.id,
      newEmail: normalized,
      tokenHash: secret.tokenHash,
      expiresAt: emailChangeExpiry(now),
      createdAt: now,
    },
  });
  const link = emailChangeLink(baseUrl, secret.raw);
  try {
    await mailer.send({
      to: normalized,
      subject: CONFIRM_SUBJECT,
      text: `Hi ${user.username}, open this link within 1 hour to confirm ${normalized}:\n${link}\nYour current address stays in place until you do.\n`,
    });
  } catch (error) {
    if (error instanceof MailDeliveryError) {
      await db.emailChangeToken.deleteMany({ where: { tokenHash: secret.tokenHash } });
      return { ok: false, error: "Could not send the confirmation email. Please try again." };
    }
    throw error;
  }
  await sendOldAddressNotice(mailer, {
    to: user.email,
    subject: REQUEST_NOTICE_SUBJECT,
    text: `Hi ${user.username}, a request was made to change the email on this account from ${user.email} to ${normalized}. If this was not you, you can ignore this message.\n`,
  });
  return { ok: true, sent: true };
}

export async function confirmEmailChange(
  db: PrismaClient,
  mailer: Mailer,
  raw: string,
  now = new Date(),
): Promise<{ ok: true; username: string; userId: string; sessionVersion: number } | { ok: false; error: string }> {
  const tokenHash = hashEmailChangeToken(raw.trim());
  const row = await db.emailChangeToken.findUnique({ where: { tokenHash } });
  if (!row) return { ok: false, error: "That confirmation link is not valid." };
  const acceptance = tokenAcceptance({ expiresAt: row.expiresAt, usedAt: row.usedAt, now });
  if (acceptance === "expired") return { ok: false, error: "That confirmation link has expired." };
  if (acceptance === "used") return { ok: false, error: "That confirmation link was already used." };

  try {
    const changed = await db.$transaction(async (tx) => {
      const updated = await tx.emailChangeToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (updated.count !== 1) return null;
      const taken = await tx.user.findUnique({ where: { email: row.newEmail }, select: { id: true } });
      if (taken && taken.id !== row.userId) throw new EmailAlreadyUsed();
      const current = await tx.user.findUnique({ where: { id: row.userId }, select: { email: true, username: true } });
      if (!current) return null;
      const user = await tx.user.update({
        where: { id: row.userId },
        data: { email: row.newEmail, emailVerifiedAt: now, sessionVersion: { increment: 1 } },
        select: { id: true, username: true, sessionVersion: true },
      });
      await tx.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.emailChangeToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: now },
      });
      return { username: user.username, userId: user.id, sessionVersion: user.sessionVersion, previousEmail: current.email };
    });
    if (!changed) return { ok: false, error: "That confirmation link is not valid." };
    await sendOldAddressNotice(mailer, {
      to: changed.previousEmail,
      subject: CHANGED_NOTICE_SUBJECT,
      text: `Hi ${changed.username}, the email on this account changed from ${changed.previousEmail} to ${row.newEmail}. If this was not you, reset your password.\n`,
    });
    return { ok: true, username: changed.username, userId: changed.userId, sessionVersion: changed.sessionVersion };
  } catch (error) {
    if (error instanceof EmailAlreadyUsed) return { ok: false, error: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "That email is already in use." };
    }
    throw error;
  }
}
